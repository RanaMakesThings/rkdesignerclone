import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import {
  ASSESSMENT_SCHEMA_PATH,
  DEFAULT_CLAUDE_MODEL,
  DEFAULT_CLAUDE_MAX_TOKENS,
  DEFAULT_OPENAI_MAX_TOKENS,
  DEFAULT_OPENAI_VISION_MODEL,
  RUBRIC_PATH,
} from "./constants.mjs";
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
import { readJson, writeJson } from "./io.mjs";
import { loadWorkflowPolicy } from "./policy.mjs";
import { validateJsonAgainstSchema } from "./schema-validate.mjs";

const JSON_EXTRACT_REGEX = /\{[\s\S]*\}/;
const FENCED_JSON_REGEX = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;

const SCORE_KEYS = [
  "specFidelity",
  "focalHierarchy",
  "conceptualClarity",
  "deckConsistency",
  "restraintPolish",
  "readabilityAtSlideScale",
];

const defaultScores = () => ({
  specFidelity: null,
  focalHierarchy: null,
  conceptualClarity: null,
  deckConsistency: null,
  restraintPolish: null,
  readabilityAtSlideScale: null,
});

const coerceNullableScore = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  return Math.min(10, Math.max(0, value));
};

const coerceStringList = (value) =>
  Array.isArray(value)
    ? value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0)
    : [];

const coerceIssueList = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry === "string") {
        const message = entry.trim();
        if (!message) {
          return null;
        }
        return { message };
      }

      if (!entry || typeof entry !== "object") {
        return null;
      }

      const message = String(entry.message ?? "").trim();
      if (!message) {
        return null;
      }

      const issue = {
        message,
      };

      for (const key of [
        "severity",
        "type",
        "scope",
        "recommendation",
      ]) {
        if (typeof entry[key] === "string" && entry[key].trim()) {
          issue[key] = entry[key].trim();
        }
      }

      if (typeof entry.blocking === "boolean") {
        issue.blocking = entry.blocking;
      }

      const evidencePaths = coerceStringList(entry.evidencePaths);
      if (evidencePaths.length > 0) {
        issue.evidencePaths = evidencePaths;
      }

      return issue;
    })
    .filter(Boolean);
};

const normalizeAssessment = ({ rawAssessment, meta, provider, policyPath }) => {
  const categories = defaultScores();
  const rawCategories =
    rawAssessment &&
    typeof rawAssessment === "object" &&
    rawAssessment.scores &&
    rawAssessment.scores.categories &&
    typeof rawAssessment.scores.categories === "object"
      ? rawAssessment.scores.categories
      : {};

  for (const key of SCORE_KEYS) {
    categories[key] = coerceNullableScore(rawCategories[key]);
  }

  return {
    timestamp:
      typeof rawAssessment?.timestamp === "string" &&
      rawAssessment.timestamp.trim().length > 0
        ? rawAssessment.timestamp
        : new Date().toISOString(),
    slug: meta.slug,
    family: meta.family,
    provider,
    policyPath,
    summary:
      typeof rawAssessment?.summary === "string"
        ? rawAssessment.summary
        : "",
    issues: coerceIssueList(rawAssessment?.issues),
    scores: {
      overall: coerceNullableScore(rawAssessment?.scores?.overall),
      categories,
    },
    suggestedUpgrades: coerceStringList(rawAssessment?.suggestedUpgrades),
    pass:
      typeof rawAssessment?.pass === "boolean" ? rawAssessment.pass : null,
  };
};

export const parseClaudeAssessment = ({ rawOutput, strictJson }) => {
  const trimmed = String(rawOutput ?? "").trim();
  if (!trimmed) {
    throw new Error("Claude returned an empty response.");
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
      throw new Error(`Claude response was not strict JSON (${reason}).`);
    }
  }

  try {
    return JSON.parse(candidate);
  } catch {
    const jsonMatch = candidate.match(JSON_EXTRACT_REGEX);
    if (!jsonMatch) {
      throw new Error("No JSON object found in Claude response.");
    }
    return JSON.parse(jsonMatch[0]);
  }
};

const truncateText = (value, maxChars = 12000) => {
  const text = String(value ?? "");
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars)}\n...[truncated ${text.length - maxChars} chars]`;
};

const buildPrompt = ({ rubric, spec, meta, coverage, html }) => {
  return [
    "You are reviewing a pitch-deck body visual for quality and fidelity to a figure brief.",
    "The figure PNG is attached as an image in this message.",
    "The figure spec, metadata, deterministic coverage report, and HTML excerpt are inlined below.",
    "",
    "## Figure context",
    `- Slug: ${meta.slug}`,
    `- Family: ${meta.family}`,
    `- Deck: ${meta.deckId}`,
    `- Title: ${meta.title || "(none)"}`,
    "",
    "## Guidance",
    "- Coverage is deterministic and structural; use it as context, not as the only source of truth.",
    "- Judge the rendered figure primarily from the PNG while checking the spec and coverage for fidelity constraints.",
    "- This is a pitch-deck figure, not an app UI review.",
    "",
    "## Rubric",
    rubric,
    "",
    "## Output contract",
    "Return a single JSON object matching this structure:",
    "{",
    `  "timestamp": "${new Date().toISOString()}",`,
    `  "slug": ${JSON.stringify(meta.slug)},`,
    `  "family": ${JSON.stringify(meta.family)},`,
    '  "summary": "1-2 sentence assessment",',
    '  "issues": [',
    "    {",
    '      "severity": "critical|major|minor|info",',
    '      "type": "short machine-readable type",',
    '      "scope": "brief|layout|copy|style|readability",',
    '      "message": "actionable finding",',
    '      "recommendation": "optional recommendation",',
    '      "blocking": true,',
    '      "evidencePaths": ["absolute/path/to/figure.png"]',
    "    }",
    "  ],",
    '  "scores": {',
    '    "overall": 0-10 or null,',
    '    "categories": {',
    '      "specFidelity": 0-10 or null,',
    '      "focalHierarchy": 0-10 or null,',
    '      "conceptualClarity": 0-10 or null,',
    '      "deckConsistency": 0-10 or null,',
    '      "restraintPolish": 0-10 or null,',
    '      "readabilityAtSlideScale": 0-10 or null',
    "    }",
    "  },",
    '  "suggestedUpgrades": ["non-blocking improvement"],',
    '  "pass": true|false|null',
    "}",
    "",
    "Rules:",
    "- Strict mode: return only valid JSON, with no prose or markdown fences.",
    "- Put spec-fidelity failures ahead of styling feedback.",
    "- Keep issues concrete and limited to meaningful problems.",
    "- Use evidencePaths when you mention a rendered or structural artifact.",
    "- Suggested upgrades must be non-blocking.",
    "",
    "## Inline JSON context summary",
    JSON.stringify(
      {
        spec,
        meta,
        coverage,
      },
      null,
      2
    ),
    "",
    "## HTML excerpt",
    truncateText(html),
  ].join("\n");
};

const resolveAssessorProvider = (provider = "auto") => {
  const normalized = String(provider ?? "auto").trim().toLowerCase() || "auto";
  if (!["auto", "claude", "openai", "none"].includes(normalized)) {
    throw new Error(`Unsupported assessor provider "${provider}".`);
  }

  if (normalized === "none") {
    return "none";
  }

  if (normalized === "claude") {
    if (!hasAnthropicApiKey()) {
      throw new Error(
        "Claude assessment requested, but no Anthropic API key is available."
      );
    }
    return "claude";
  }

  if (normalized === "openai") {
    if (!hasOpenAIApiKey()) {
      throw new Error(
        "OpenAI assessment requested, but no OpenAI API key is available."
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

  return "none";
};

const runClaudePrompt = async ({
  prompt,
  pngBase64,
  model,
  maxTokens,
}) => {
  const content = [
    {
      type: "text",
      text: prompt,
    },
  ];

  if (pngBase64) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: pngBase64,
      },
    });
  }

  const payload = await createMessage({
    model,
    maxTokens,
    temperature: 0,
    messages: [
      {
        role: "user",
        content,
      },
    ],
  });

  const output = extractMessageText(payload);
  if (!output) {
    throw new Error("Claude assessment returned an empty response.");
  }
  return output;
};

const runOpenAIPrompt = async ({
  prompt,
  pngBase64,
  model,
  maxTokens,
}) => {
  const content = [
    {
      type: "input_text",
      text: prompt,
    },
  ];

  if (pngBase64) {
    content.push({
      type: "input_image",
      image_url: `data:image/png;base64,${pngBase64}`,
    });
  }

  const payload = await createResponse({
    model,
    input: [
      {
        role: "user",
        content,
      },
    ],
    max_output_tokens: maxTokens,
    text: {
      format: {
        type: "json_object",
      },
    },
  });

  const output = extractResponseText(payload);
  if (!output) {
    throw new Error("OpenAI assessment returned an empty response.");
  }
  return output;
};

export const assessFigureDir = async ({ dir, policyPath = null }) => {
  const { policy, policyPath: resolvedPolicyPath } = await loadWorkflowPolicy(
    policyPath
  );
  const spec = await readJson(`${dir}/spec.json`);
  const meta = await readJson(`${dir}/meta.json`);
  const coverage = await readJson(`${dir}/coverage.json`);
  const rubric = await readFile(RUBRIC_PATH, "utf8");
  const html = await readFile(`${dir}/figure.html`, "utf8");
  const pngBase64 = await readFile(`${dir}/figure.png`, "base64");
  const resolvedProvider = resolveAssessorProvider(policy.assessor.provider);
  const resolvedModel =
    policy.assessor.model ||
    (resolvedProvider === "openai"
      ? DEFAULT_OPENAI_VISION_MODEL
      : DEFAULT_CLAUDE_MODEL);
  const resolvedMaxTokens =
    typeof policy.assessor.maxTokens === "number" &&
    Number.isFinite(policy.assessor.maxTokens)
      ? policy.assessor.maxTokens
      : resolvedProvider === "openai"
        ? DEFAULT_OPENAI_MAX_TOKENS
        : DEFAULT_CLAUDE_MAX_TOKENS;

  let rawAssessment;
  if (resolvedProvider === "none") {
    rawAssessment = {
      timestamp: new Date().toISOString(),
      slug: meta.slug,
      family: meta.family,
      summary:
        "Assessment skipped because no configured model provider is available.",
      issues: [],
      scores: {
        overall: null,
        categories: defaultScores(),
      },
      suggestedUpgrades: [],
      pass: null,
    };
  } else {
    const prompt = buildPrompt({
      rubric,
      spec,
      meta,
      coverage,
      html,
    });
    const rawOutput =
      resolvedProvider === "openai"
        ? await runOpenAIPrompt({
            prompt,
            pngBase64,
            model: resolvedModel,
            maxTokens: resolvedMaxTokens,
          })
        : await runClaudePrompt({
            prompt,
            pngBase64,
            model: resolvedModel,
            maxTokens: resolvedMaxTokens,
          });
    rawAssessment = parseClaudeAssessment({
      rawOutput,
      strictJson: policy.assessor.strictJson,
    });
  }

  const normalized = normalizeAssessment({
    rawAssessment,
    meta,
    provider: resolvedProvider,
    policyPath: resolvedPolicyPath,
  });

  const validation = await validateJsonAgainstSchema({
    data: normalized,
    schemaPath: ASSESSMENT_SCHEMA_PATH,
    label: basename(`${dir}/assessment.json`),
  });
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  await writeJson(`${dir}/assessment.json`, normalized);
  return {
    dir,
    policyPath: resolvedPolicyPath,
    provider: resolvedProvider,
    assessment: normalized,
  };
};
