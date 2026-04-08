import { readFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import {
  DEFAULT_CLAUDE_MAX_TOKENS,
  DEFAULT_CLAUDE_MODEL,
  DEFAULT_OPENAI_MAX_TOKENS,
  DEFAULT_OPENAI_TEXT_MODEL,
  IDEATION_SCHEMA_PATH,
  OUTPUT_ROOT,
} from "./constants.mjs";
import { resolveRepoPath, writeJson, writeText } from "./io.mjs";
import { validateJsonAgainstSchema } from "./schema-validate.mjs";
import {
  hasAnthropicApiKey,
  createMessage,
  extractMessageText,
} from "../../llm/anthropic-client.mjs";
import {
  createResponse,
  extractResponseText,
  hasOpenAIApiKey,
} from "../../llm/openai-client.mjs";
import { generateStandaloneImageAssets } from "./assets.mjs";

const JSON_EXTRACT_REGEX = /\{[\s\S]*\}/;
const FENCED_JSON_REGEX = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;
const ASSET_MODES = new Set(["native", "photo", "hybrid"]);

const toCount = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 10;
  }
  return Math.max(4, Math.min(20, Math.floor(numeric)));
};

const deriveSlug = (briefPath) => {
  const resolved = resolveRepoPath(briefPath);
  const extension = extname(resolved);
  return basename(resolved, extension || undefined);
};

const coerceString = (value) =>
  typeof value === "string" ? value.trim() : "";

const coerceStringList = (value) =>
  Array.isArray(value)
    ? value.map((entry) => coerceString(entry)).filter(Boolean)
    : [];

const slugify = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "idea";

const OPENAI_IDEATION_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "ideas", "shortlist", "selectionAdvice"],
  properties: {
    summary: {
      type: "string",
    },
    ideas: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "name",
          "composition",
          "placement",
          "assetMode",
          "imageIntent",
          "styleIntent",
          "imageQueries",
          "whyItWorks",
          "mainRisk",
        ],
        properties: {
          name: {
            type: "string",
            minLength: 1,
          },
          composition: {
            type: "string",
            minLength: 1,
          },
          placement: {
            type: "string",
            minLength: 1,
          },
          assetMode: {
            type: "string",
            enum: ["native", "photo", "hybrid"],
          },
          imageIntent: {
            type: "string",
          },
          styleIntent: {
            type: "string",
          },
          imageQueries: {
            type: "array",
            items: {
              type: "string",
              minLength: 1,
            },
          },
          whyItWorks: {
            type: "string",
            minLength: 1,
          },
          mainRisk: {
            type: "string",
            minLength: 1,
          },
        },
      },
    },
    shortlist: {
      type: "array",
      items: {
        type: "string",
        minLength: 1,
      },
    },
    selectionAdvice: {
      type: "string",
    },
  },
};

const normalizeIdea = (entry) => ({
  name: coerceString(entry?.name),
  composition: coerceString(entry?.composition),
  placement: coerceString(entry?.placement),
  assetMode: ASSET_MODES.has(coerceString(entry?.assetMode))
    ? coerceString(entry?.assetMode)
    : "native",
  imageIntent: coerceString(entry?.imageIntent),
  styleIntent: coerceString(entry?.styleIntent),
  imageQueries: coerceStringList(entry?.imageQueries).slice(0, 3),
  imageBoard:
    entry?.imageBoard && typeof entry.imageBoard === "object"
      ? {
          dir: coerceString(entry.imageBoard?.dir),
          manifestPath: coerceString(entry.imageBoard?.manifestPath),
          assetBoardHtmlPath: coerceString(entry.imageBoard?.assetBoardHtmlPath),
          assetBoardPngPath: coerceString(entry.imageBoard?.assetBoardPngPath),
          verdict: coerceString(entry.imageBoard?.verdict),
          bestCandidateNote: coerceString(entry.imageBoard?.bestCandidateNote),
          error: coerceString(entry.imageBoard?.error),
        }
      : null,
  whyItWorks: coerceString(entry?.whyItWorks),
  mainRisk: coerceString(entry?.mainRisk),
});

export const parseClaudeIdeation = ({ rawOutput, strictJson }) => {
  const trimmed = String(rawOutput ?? "").trim();
  if (!trimmed) {
    throw new Error("Claude ideation returned an empty response.");
  }

  const fencedMatch = trimmed.match(FENCED_JSON_REGEX);
  const fencedCandidate = fencedMatch ? fencedMatch[1].trim() : null;
  const extractedCandidate = (() => {
    const blockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (blockMatch?.[1]) {
      return blockMatch[1].trim();
    }
    const jsonMatch = trimmed.match(JSON_EXTRACT_REGEX);
    return jsonMatch?.[0]?.trim() || null;
  })();
  const candidate = fencedCandidate || extractedCandidate || trimmed;

  if (strictJson) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Claude ideation was not strict JSON (${reason}).`);
    }
  }

  try {
    return JSON.parse(candidate);
  } catch {
    const jsonMatch = candidate.match(JSON_EXTRACT_REGEX);
    if (!jsonMatch) {
      throw new Error("No JSON object found in Claude ideation response.");
    }
    return JSON.parse(jsonMatch[0]);
  }
};

const normalizeIdeation = ({
  rawIdeation,
  slug,
  provider,
  model,
  briefPath,
  count,
}) => {
  const ideas = Array.isArray(rawIdeation?.ideas)
    ? rawIdeation.ideas.map(normalizeIdea).filter((idea) =>
        Object.values(idea).some(Boolean)
      )
    : [];

  return {
    timestamp: new Date().toISOString(),
    slug,
    provider,
    model,
    briefPath,
    summary: coerceString(rawIdeation?.summary),
    ideas: ideas.slice(0, count),
    shortlist: coerceStringList(rawIdeation?.shortlist).slice(
      0,
      Math.min(4, count)
    ),
    selectionAdvice: coerceString(rawIdeation?.selectionAdvice),
  };
};

const maybeAttachImageBoards = async ({
  ideation,
  outputDir,
}) => {
  const shortlisted = new Set(ideation.shortlist);
  const ideas = [];

  for (const idea of ideation.ideas) {
    if (
      !["photo", "hybrid"].includes(idea.assetMode) ||
      !shortlisted.has(idea.name)
    ) {
      ideas.push(idea);
      continue;
    }

    const purpose =
      idea.imageQueries[0] ||
      idea.imageIntent ||
      idea.composition ||
      idea.name;
    if (!purpose) {
      ideas.push(idea);
      continue;
    }

    const boardDir = resolve(outputDir, "image-boards", slugify(idea.name));
    try {
      const result = await generateStandaloneImageAssets({
        purpose,
        style: idea.styleIntent,
        count: 6,
        slug: slugify(idea.name),
        outputDir: boardDir,
        download: true,
      });
      ideas.push({
        ...idea,
        imageBoard: {
          dir: result.paths.dir,
          manifestPath: result.paths.assetsManifestPath,
          assetBoardHtmlPath: result.paths.assetBoardHtmlPath,
          assetBoardPngPath: result.paths.assetBoardPngPath,
          verdict: "unreviewed",
          bestCandidateNote: "",
          error: "",
        },
      });
    } catch (error) {
      ideas.push({
        ...idea,
        imageBoard: {
          dir: "",
          manifestPath: "",
          assetBoardHtmlPath: "",
          assetBoardPngPath: "",
          verdict: "unreviewed",
          bestCandidateNote: "",
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  return {
    ...ideation,
    ideas,
  };
};

const buildIdeationPrompt = ({ brief, slug, count }) =>
  [
    "You are helping generate figure concepts for a pitch-deck slide.",
    "The goal is not decoration. The goal is to create concrete candidate directions for the figure area of the slide.",
    "",
    "Requirements:",
    `- Return exactly ${count} candidate directions.`,
    "- Mix native drawn concepts, photo concepts, and hybrid concepts only when they genuinely fit the brief.",
    "- If photo or hybrid directions are plausible, include at least 2 of them in the set.",
    "- Favor serious pitch-deck composition over generic symbols or filler.",
    "- Each idea must describe a real visual object or composition.",
    "- Avoid meaningless shapes, bright infographic styling, or decorative noise.",
    "- Every photo or hybrid idea must include an explicit imageIntent and styleIntent.",
    "- For photo or hybrid ideas, include 1 to 3 concrete stock-image search queries that could be used with Pexels.",
    "- For native-only ideas, return empty strings for imageIntent/styleIntent and an empty imageQueries array.",
    "",
    "Output strict JSON only with this shape:",
    "{",
    '  "summary": "1-2 sentence read on the figure problem",',
    '  "ideas": [',
    "    {",
    '      "name": "short concept name",',
    '      "composition": "exact visual composition",',
    '      "placement": "where it sits relative to the text/stats",',
    '      "assetMode": "native|photo|hybrid",',
    '      "imageIntent": "what the sourced image should communicate",',
    '      "styleIntent": "documentary/editorial/quiet/interior/etc",',
    '      "imageQueries": ["query 1", "query 2"],',
    '      "whyItWorks": "why it is better than filler",',
    '      "mainRisk": "main downside or failure mode"',
    "    }",
    "  ],",
    '  "shortlist": ["name 1", "name 2", "name 3"],',
    '  "selectionAdvice": "how to choose among the best directions"',
    "}",
    "",
    "Context slug:",
    slug,
    "",
    "Brief:",
    brief,
  ].join("\n");

const resolveIdeationProvider = (provider = "auto") => {
  const normalized = String(provider ?? "auto").trim().toLowerCase() || "auto";
  if (!["auto", "claude", "openai"].includes(normalized)) {
    throw new Error(`Unsupported ideation provider "${provider}".`);
  }

  if (normalized === "claude") {
    if (!hasAnthropicApiKey()) {
      throw new Error(
        "Claude ideation requested, but no Anthropic API key is available."
      );
    }
    return "claude";
  }

  if (normalized === "openai") {
    if (!hasOpenAIApiKey()) {
      throw new Error(
        "OpenAI ideation requested, but no OpenAI API key is available."
      );
    }
    return "openai";
  }

  if (hasAnthropicApiKey()) {
    return "claude";
  }
  if (hasOpenAIApiKey()) {
    return "openai";
  }

  throw new Error(
    "Missing ideation provider credentials. Set ANTHROPIC_API_KEY/YSN_ANTHROPIC_API_KEY or OPENAI_API_KEY/YSN_OPENAI_API_KEY, or run through `npm run doppler:run -- ...`."
  );
};

const runClaudeIdeation = async ({ prompt, model, maxTokens }) => {
  const payload = await createMessage({
    model,
    maxTokens,
    temperature: 0.7,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const output = extractMessageText(payload);
  if (!output) {
    throw new Error("Claude ideation returned an empty response.");
  }
  return output;
};

const runOpenAIIdeation = async ({ prompt, model, maxTokens }) => {
  const payload = await createResponse({
    model,
    input: prompt,
    max_output_tokens: maxTokens,
    text: {
      format: {
        type: "json_schema",
        name: "figure_ideation",
        strict: true,
        schema: OPENAI_IDEATION_RESPONSE_SCHEMA,
      },
    },
  });

  const output = extractResponseText(payload);
  if (!output) {
    throw new Error("OpenAI ideation returned an empty response.");
  }
  return output;
};

export const ideateFigureBrief = async ({
  briefPath,
  outputDir = null,
  slug = null,
  count = 10,
  provider = "auto",
  model = "",
  maxTokens = null,
  strictJson = true,
}) => {
  if (!briefPath) {
    throw new Error("Missing brief path.");
  }

  const resolvedBriefPath = resolveRepoPath(briefPath);
  const resolvedSlug = slug ? String(slug).trim() : deriveSlug(resolvedBriefPath);
  const resolvedCount = toCount(count);
  const dir = outputDir
    ? resolveRepoPath(outputDir)
    : resolve(OUTPUT_ROOT, "ideation", resolvedSlug);

  const brief = await readFile(resolvedBriefPath, "utf8");
  const prompt = buildIdeationPrompt({
    brief,
    slug: resolvedSlug,
    count: resolvedCount,
  });
  const resolvedProvider = resolveIdeationProvider(provider);
  const resolvedModel =
    typeof model === "string" && model.trim()
      ? model.trim()
      : resolvedProvider === "openai"
        ? DEFAULT_OPENAI_TEXT_MODEL
        : DEFAULT_CLAUDE_MODEL;
  const resolvedMaxTokens =
    typeof maxTokens === "number" && Number.isFinite(maxTokens)
      ? maxTokens
      : resolvedProvider === "openai"
        ? Math.max(DEFAULT_OPENAI_MAX_TOKENS, 900 + resolvedCount * 500)
        : DEFAULT_CLAUDE_MAX_TOKENS;
  const rawOutput =
    resolvedProvider === "openai"
      ? await runOpenAIIdeation({
          prompt,
          model: resolvedModel,
          maxTokens: resolvedMaxTokens,
        })
      : await runClaudeIdeation({
          prompt,
          model: resolvedModel,
          maxTokens: resolvedMaxTokens,
        });
  const rawIdeation = parseClaudeIdeation({
    rawOutput,
    strictJson,
  });

  const normalized = normalizeIdeation({
    rawIdeation,
    slug: resolvedSlug,
    provider: resolvedProvider,
    model: resolvedModel,
    briefPath: resolvedBriefPath,
    count: resolvedCount,
  });
  const withBoards = await maybeAttachImageBoards({
    ideation: normalized,
    outputDir: dir,
  });

  const validation = await validateJsonAgainstSchema({
    data: withBoards,
    schemaPath: IDEATION_SCHEMA_PATH,
    label: basename(resolve(dir, "ideas.json")),
  });
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const paths = {
    dir,
    promptPath: resolve(dir, "ideation-prompt.txt"),
    responsePath: resolve(dir, "ideation-response.txt"),
    ideationPath: resolve(dir, "ideas.json"),
    briefCopyPath: resolve(dir, "brief.md"),
  };

  await writeText(paths.promptPath, `${prompt}\n`);
  await writeText(paths.responsePath, `${rawOutput.trim()}\n`);
  await writeText(paths.briefCopyPath, brief);
  await writeJson(paths.ideationPath, withBoards);

  return {
    slug: resolvedSlug,
    provider: resolvedProvider,
    model: resolvedModel,
    paths,
    ideation: withBoards,
  };
};
