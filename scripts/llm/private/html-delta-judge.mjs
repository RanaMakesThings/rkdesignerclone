import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  createMessage,
  DEFAULT_ANTHROPIC_MAX_TOKENS,
  DEFAULT_ANTHROPIC_MODEL,
  extractMessageText,
} from "../anthropic-client.mjs";
import {
  createResponse,
  extractResponseText,
} from "../openai-client.mjs";

const VALID_STATUSES = new Set([
  "applied",
  "partial",
  "not_applied",
  "ambiguous",
  "out_of_scope",
]);
const VALID_REGRESSION_VERDICTS = new Set(["ok", "blocker"]);

const JSON_EXTRACT_REGEX = /\{[\s\S]*\}/;
const FENCED_JSON_REGEX = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;
const DEFAULT_OPENAI_JUDGE_MODEL = "gpt-5.4";

const imageMediaTypeFromPath = (filePath) => {
  const normalized = String(filePath ?? "").toLowerCase();
  if (normalized.endsWith(".png")) {
    return "image/png";
  }
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (normalized.endsWith(".webp")) {
    return "image/webp";
  }
  if (normalized.endsWith(".gif")) {
    return "image/gif";
  }
  if (normalized.endsWith(".svg")) {
    return "image/svg+xml";
  }
  throw new Error(`Unsupported image type for HTML delta judge: ${filePath}`);
};

const parseJsonCandidate = (rawOutput, label) => {
  const trimmed = String(rawOutput ?? "").trim();
  if (!trimmed) {
    throw new Error(`${label} returned an empty response.`);
  }

  const fencedMatch = trimmed.match(FENCED_JSON_REGEX);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const jsonMatch = candidate.match(JSON_EXTRACT_REGEX);
    if (!jsonMatch) {
      throw new Error(`${label} returned no JSON object.`);
    }
    return JSON.parse(jsonMatch[0]);
  }
};

const normalizeString = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizeJudgeOutput = ({ raw, provider }) => {
  const status = normalizeString(raw?.status).toLowerCase();
  if (!VALID_STATUSES.has(status)) {
    throw new Error(
      `${provider} judge returned unsupported status "${raw?.status ?? ""}".`
    );
  }

  const evidence = Array.isArray(raw?.evidence)
    ? raw.evidence
        .map((entry) => normalizeString(entry))
        .filter(Boolean)
    : [];

  return {
    provider,
    status,
    summary: normalizeString(raw?.summary),
    evidence,
    nextPrompt: normalizeString(raw?.nextPrompt),
    needsHuman: raw?.needsHuman === true,
  };
};

const normalizeRegressionOutput = ({ raw, provider }) => {
  const verdict = normalizeString(raw?.verdict).toLowerCase();
  if (!VALID_REGRESSION_VERDICTS.has(verdict)) {
    throw new Error(
      `${provider} regression review returned unsupported verdict "${raw?.verdict ?? ""}".`
    );
  }

  const blockers = Array.isArray(raw?.blockers)
    ? raw.blockers
        .map((entry) => normalizeString(entry))
        .filter(Boolean)
    : [];

  return {
    provider,
    verdict,
    rationale: normalizeString(raw?.rationale),
    blockers,
    nextMove: normalizeString(raw?.nextMove),
  };
};

const normalizeReferenceImagePaths = ({
  referenceImagePath,
  referenceImagePaths = [],
}) =>
  [
    ...(Array.isArray(referenceImagePaths) ? referenceImagePaths : []),
    ...(referenceImagePath ? [referenceImagePath] : []),
  ]
    .map((entry) => resolve(String(entry)))
    .filter(Boolean);

export const buildHtmlDeltaJudgePrompt = ({
  runType = "edit",
  changeRequest,
  successChecks,
  guardrails,
  officialBaselineIncluded = false,
  referenceImageCount = 0,
}) =>
  [
    runType === "create"
      ? "You are evaluating one first-pass HTML slide creation attempt for a pitch-deck graphic."
      : "You are evaluating one targeted HTML tuning attempt for a pitch-deck graphic.",
    runType === "create"
      ? "Judge whether the candidate successfully realized the slide brief from the seeded shell while respecting the locked shell and family cues."
      : "Judge only whether the requested delta happened between the parent image and the candidate image while respecting the official baseline.",
    runType === "create"
      ? "Treat status=applied as: the slide brief is successfully realized from the shell."
      : "Do not grade overall quality unless it affects whether the requested delta is satisfied.",
    "If the request actually needs a broader redesign, family change, or semantic rethink, return out_of_scope.",
    "If the images do not let you judge reliably, return ambiguous.",
    "",
    "## Requested change",
    changeRequest,
    "",
    "## Success checks",
    successChecks,
    "",
    "## Guardrails",
    guardrails || "None.",
    "",
    "## Image order",
    officialBaselineIncluded ? "1. OFFICIAL BASELINE image" : "",
    officialBaselineIncluded ? "2. SLOT PARENT / BEFORE image" : "1. SLOT PARENT / BEFORE image",
    officialBaselineIncluded ? "3. CANDIDATE / AFTER image" : "2. CANDIDATE / AFTER image",
    ...Array.from({ length: Number(referenceImageCount) || 0 }, (_, index) =>
      officialBaselineIncluded
        ? `${index + 4}. OPTIONAL reference image`
        : `${index + 3}. OPTIONAL reference image`
    ),
    "",
    "## Output contract",
    "Return exactly one JSON object with this shape:",
    "{",
    '  "status": "applied|partial|not_applied|ambiguous|out_of_scope",',
    '  "summary": "one short paragraph",',
    '  "evidence": ["specific visual evidence"],',
    '  "nextPrompt": "optional concrete wording for the next retry prompt",',
    '  "needsHuman": true',
    "}",
    "",
    "Rules:",
    "- Use needsHuman=true when the request conflicts with the current artifact in a way that should go back to human review.",
    "- Use nextPrompt only for a concrete retry instruction.",
    "- Keep evidence specific and visual.",
    "- Return JSON only.",
  ].join("\n");

const readOpenAIImageBlock = async (imagePath) => {
  const filePath = resolve(String(imagePath));
  const raw = await readFile(filePath);
  return {
    type: "input_image",
    image_url: `data:${imageMediaTypeFromPath(filePath)};base64,${raw.toString("base64")}`,
  };
};

const readAnthropicImageBlock = async (imagePath) => {
  const filePath = resolve(String(imagePath));
  const raw = await readFile(filePath);
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: imageMediaTypeFromPath(filePath),
      data: raw.toString("base64"),
    },
  };
};

export const runOpenAIHtmlDeltaJudge = async ({
  runType = "edit",
  officialBaselineImagePath,
  beforeImagePath,
  afterImagePath,
  referenceImagePath,
  referenceImagePaths = [],
  changeRequest,
  successChecks,
  guardrails = "",
  model = DEFAULT_OPENAI_JUDGE_MODEL,
  maxOutputTokens = 900,
}) => {
  const normalizedReferenceImagePaths = normalizeReferenceImagePaths({
    referenceImagePath,
    referenceImagePaths,
  });
  const prompt = buildHtmlDeltaJudgePrompt({
    runType,
    changeRequest,
    successChecks,
    guardrails,
    officialBaselineIncluded: Boolean(officialBaselineImagePath),
    referenceImageCount: normalizedReferenceImagePaths.length,
  });
  const content = [
    {
      type: "input_text",
      text: prompt,
    },
  ];
  if (officialBaselineImagePath) {
    content.push(await readOpenAIImageBlock(officialBaselineImagePath));
  }
  content.push(await readOpenAIImageBlock(beforeImagePath));
  content.push(await readOpenAIImageBlock(afterImagePath));
  for (const imagePath of normalizedReferenceImagePaths) {
    content.push(await readOpenAIImageBlock(imagePath));
  }
  const response = await createResponse({
    model,
    input: [
      {
        role: "user",
        content,
      },
    ],
    max_output_tokens: Number(maxOutputTokens),
    text: {
      format: {
        type: "json_object",
      },
    },
  });
  const outputText = extractResponseText(response);
  const raw = parseJsonCandidate(outputText, "OpenAI HTML delta judge");
  return {
    normalized: normalizeJudgeOutput({ raw, provider: "gpt" }),
    raw,
    response,
  };
};

export const runClaudeHtmlDeltaJudge = async ({
  runType = "edit",
  officialBaselineImagePath,
  beforeImagePath,
  afterImagePath,
  referenceImagePath,
  referenceImagePaths = [],
  changeRequest,
  successChecks,
  guardrails = "",
  model = DEFAULT_ANTHROPIC_MODEL,
  maxTokens = DEFAULT_ANTHROPIC_MAX_TOKENS,
}) => {
  const normalizedReferenceImagePaths = normalizeReferenceImagePaths({
    referenceImagePath,
    referenceImagePaths,
  });
  const prompt = buildHtmlDeltaJudgePrompt({
    runType,
    changeRequest,
    successChecks,
    guardrails,
    officialBaselineIncluded: Boolean(officialBaselineImagePath),
    referenceImageCount: normalizedReferenceImagePaths.length,
  });
  const content = [
    {
      type: "text",
      text: prompt,
    },
  ];
  if (officialBaselineImagePath) {
    content.push(await readAnthropicImageBlock(officialBaselineImagePath));
  }
  content.push(await readAnthropicImageBlock(beforeImagePath));
  content.push(await readAnthropicImageBlock(afterImagePath));
  for (const imagePath of normalizedReferenceImagePaths) {
    content.push(await readAnthropicImageBlock(imagePath));
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
  const outputText = extractMessageText(payload);
  const raw = parseJsonCandidate(outputText, "Claude HTML delta judge");
  return {
    normalized: normalizeJudgeOutput({ raw, provider: "claude" }),
    raw,
    response: payload,
  };
};

export const buildHtmlRegressionPrompt = ({
  runType = "edit",
  changeRequest,
  officialBaselineIncluded = false,
  referenceImageCount = 0,
}) =>
  [
    runType === "create"
      ? "You are reviewing whether a first-pass HTML slide creation attempt introduced any visible blocker."
      : "You are reviewing whether a pitch-deck HTML tuning attempt introduced any visible regression.",
    runType === "create"
      ? "The candidate may look polished, but your job is to catch shell violations, unresolved placeholders, missing required objects, or obvious family drift."
      : "The requested delta may have succeeded; your job is to check whether anything else broke.",
    "",
    "Evaluate these concrete blocker checks:",
    ...(runType === "create"
      ? [
          "- do any template placeholders or stub graphics remain visible?",
          "- does the slide still look like the blank shell rather than a resolved slide?",
          "- is any required locked copy missing, clipped, or obviously wrong?",
          "- did the footer shell drift, break, or lose alignment?",
          "- does the slide feel visibly out-of-family with the adjacent or official cues?",
        ]
      : [
          "- did any directional marker or arrowhead disappear or become visually ambiguous?",
          "- is any text clipped, cropped, partially missing, or visibly truncated?",
          "- is any stray rendering artifact visible (for example: `xml`, raw text, browser chrome, or leaked markup)?",
          "- did the composition become under-filled, top-heavy, or fragment-like after removing or changing sections?",
          "- did any attachment, notch, connector, or join become awkward, inherited-looking, or obviously off?",
        ]),
    "",
    "Requested change for context:",
    changeRequest || "Not provided.",
    "",
    "Image order:",
    officialBaselineIncluded ? "1. OFFICIAL BASELINE image" : "",
    officialBaselineIncluded ? "2. SLOT PARENT image" : "1. SLOT PARENT image",
    officialBaselineIncluded ? "3. CANDIDATE image" : "2. CANDIDATE image",
    ...Array.from({ length: Number(referenceImageCount) || 0 }, (_, index) =>
      officialBaselineIncluded
        ? `${index + 4}. OPTIONAL reference image showing the intended family or earlier target`
        : `${index + 3}. OPTIONAL reference image showing the intended family or earlier target`
    ),
    "",
    "Output contract:",
    "Return exactly one JSON object with this shape:",
    "{",
    '  "verdict": "ok|blocker",',
    '  "rationale": "one short paragraph",',
    '  "blockers": ["specific visible regression"],',
    '  "nextMove": "one concrete next move"',
    "}",
    "",
    "Rules:",
    "- Use `blocker` if even one concrete visual regression is present.",
    "- Do not give a general design critique; focus on regression versus the baseline.",
    "- If the candidate is clean, return `ok` and an empty blockers array.",
    "- Return JSON only.",
  ]
    .filter(Boolean)
    .join("\n");

export const runOpenAIHtmlRegressionReview = async ({
  runType = "edit",
  officialBaselineImagePath,
  beforeImagePath,
  afterImagePath,
  referenceImagePath,
  referenceImagePaths = [],
  changeRequest = "",
  model = DEFAULT_OPENAI_JUDGE_MODEL,
  maxOutputTokens = 900,
}) => {
  const normalizedReferenceImagePaths = normalizeReferenceImagePaths({
    referenceImagePath,
    referenceImagePaths,
  });
  const prompt = buildHtmlRegressionPrompt({
    runType,
    changeRequest,
    officialBaselineIncluded: Boolean(officialBaselineImagePath),
    referenceImageCount: normalizedReferenceImagePaths.length,
  });
  const content = [
    {
      type: "input_text",
      text: prompt,
    },
  ];
  if (officialBaselineImagePath) {
    content.push(await readOpenAIImageBlock(officialBaselineImagePath));
  }
  content.push(await readOpenAIImageBlock(beforeImagePath));
  content.push(await readOpenAIImageBlock(afterImagePath));

  for (const imagePath of normalizedReferenceImagePaths) {
    content.push(await readOpenAIImageBlock(imagePath));
  }

  const response = await createResponse({
    model,
    input: [
      {
        role: "user",
        content,
      },
    ],
    max_output_tokens: Number(maxOutputTokens),
    text: {
      format: {
        type: "json_object",
      },
    },
  });
  const outputText = extractResponseText(response);
  const raw = parseJsonCandidate(outputText, "OpenAI HTML regression review");
  return {
    normalized: normalizeRegressionOutput({ raw, provider: "gpt" }),
    raw,
    response,
  };
};

export const runClaudeHtmlRegressionReview = async ({
  runType = "edit",
  officialBaselineImagePath,
  beforeImagePath,
  afterImagePath,
  referenceImagePath,
  referenceImagePaths = [],
  changeRequest = "",
  model = DEFAULT_ANTHROPIC_MODEL,
  maxTokens = DEFAULT_ANTHROPIC_MAX_TOKENS,
}) => {
  const normalizedReferenceImagePaths = normalizeReferenceImagePaths({
    referenceImagePath,
    referenceImagePaths,
  });
  const prompt = buildHtmlRegressionPrompt({
    runType,
    changeRequest,
    officialBaselineIncluded: Boolean(officialBaselineImagePath),
    referenceImageCount: normalizedReferenceImagePaths.length,
  });
  const content = [
    {
      type: "text",
      text: prompt,
    },
  ];
  if (officialBaselineImagePath) {
    content.push(await readAnthropicImageBlock(officialBaselineImagePath));
  }
  content.push(await readAnthropicImageBlock(beforeImagePath));
  content.push(await readAnthropicImageBlock(afterImagePath));

  for (const imagePath of normalizedReferenceImagePaths) {
    content.push(await readAnthropicImageBlock(imagePath));
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
  const outputText = extractMessageText(payload);
  const raw = parseJsonCandidate(outputText, "Claude HTML regression review");
  return {
    normalized: normalizeRegressionOutput({ raw, provider: "claude" }),
    raw,
    response: payload,
  };
};
