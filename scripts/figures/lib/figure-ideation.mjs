import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { resolve, dirname, extname, basename, relative } from "node:path";

import yaml from "js-yaml";

import {
  FIGURES_ROOT,
  DEFAULT_CLAUDE_MAX_TOKENS,
  DEFAULT_CLAUDE_MODEL,
  DEFAULT_OPENAI_MAX_TOKENS,
  DEFAULT_OPENAI_TEXT_MODEL,
  DEFAULT_OPENAI_VISION_MODEL,
} from "./constants.mjs";
import { validateJsonAgainstSchema } from "./schema-validate.mjs";
import { writeJson, writeText } from "./io.mjs";
import {
  createResponse,
  extractResponseText,
  hasOpenAIApiKey,
} from "../../llm/openai-client.mjs";
import {
  createMessage,
  extractMessageText,
  hasAnthropicApiKey,
} from "../../llm/anthropic-client.mjs";
import {
  DEFAULT_GEMINI_TEXT_MODEL,
  generateGeminiText,
} from "../../llm/gemini-text-client.mjs";
import {
  DEFAULT_GEMINI_IMAGE_MODEL,
  generateGeminiImages,
  hasGeminiApiKey,
  writeGeminiImageArtifacts,
} from "../../llm/gemini-image-client.mjs";
import {
  DEFAULT_OPENAI_IMAGE_MODEL,
  generateOpenAIImage,
  writeOpenAIImageArtifacts,
} from "../../llm/openai-image-lib.mjs";
import {
  createArtifactRunSlug,
  getDesignerDataPaths,
  getDesignerProjectRunsRoot,
} from "../../../lib/repo/designer-data.mjs";

const IDEATION_SYSTEM_ROOT = resolve(FIGURES_ROOT, "ideation-system", "v1.1");
const PROMPTS_PATH = resolve(
  IDEATION_SYSTEM_ROOT,
  "prompts",
  "llm-role-prompts-v1.1.md"
);
const CONFIG_TEMPLATE_PATH = resolve(
  IDEATION_SYSTEM_ROOT,
  "templates",
  "figure-ideation-run-config-v1.1.yaml"
);
const PROFILE_DIR = resolve(IDEATION_SYSTEM_ROOT, "profiles");
const SCHEMA_DIR = resolve(IDEATION_SYSTEM_ROOT, "schemas");
const DEFAULT_CONFIG_OVERRIDES = {
  run_defaults: {
    auto_promote_allowed: false,
    human_review_required_by_default: true,
  },
  thresholds: {
    min_interpretation_confidence: 0.7,
    min_candidate_diversity: 0.55,
    min_thumbnail_diversity: 0.5,
    candidate_auto_reject: {
      min_job_fidelity: 7,
      min_figure_burden_fit: 7,
      min_collapse_resistance: 6,
    },
    candidate_auto_win: {
      min_weighted_total: 8.7,
      min_runner_up_gap: 0.8,
    },
    thumbnail_auto_win: {
      min_aggregate_score: 8.3,
      min_collapse_resistance: 7,
      max_disagreement_score: 2,
    },
    disagreement: {
      mild: 1,
      significant: 2,
      high: 3,
    },
  },
  thumbnail_defaults: {
    standard_count: 4,
    exploratory_count: 6,
    strict_count: 3,
    use_real_copy_by_default: true,
    preserve_template_header_area: true,
  },
  retry_policy: {
    max_provider_retries: 2,
    max_stage_reruns: 2,
    max_full_run_retries: 1,
  },
  artifact_paths: {
    build_spec: "slide-{slide_number}-build-spec-v{version}.md",
    critique_report: "slide-{slide_number}-figure-critique-v{version}.json",
    thumbnail_manifest: "slide-{slide_number}-thumbnails-v{version}.json",
    run_manifest: "slide-{slide_number}-run-manifest-v{version}.json",
  },
};

const JSON_BLOCK_REGEX = /```(?:json)?\s*([\s\S]*?)\s*```/i;
const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "how",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "with",
]);

const FAMILY_KEYWORDS = [
  ["pull-out / magnification", ["callout", "pull-out", "zoom", "magnify", "detail"]],
  ["territory comparison", ["territory", "position", "compare", "comparison", "adjacent"]],
  ["density vs whitespace", ["density", "dense", "sparse", "open", "whitespace", "crowded"]],
  ["workbench / reasoning surface", ["clipboard", "workbench", "surface", "reasoning", "brief"]],
  ["staged emergence", ["reveal", "emergence", "opening", "unfold"]],
  ["hero object with supporting field", ["hero", "chip", "object", "beacon"]],
  ["clustered ecosystem vs singular position", ["ecosystem", "cluster", "singular", "lone"]],
  ["sequence with emphasized zone", ["sequence", "timeline", "strip", "before", "after", "stage"]],
  ["matrix / map-like field", ["matrix", "map", "field", "grid", "landscape"]],
  ["layered stack", ["layer", "stack", "stacked", "strata"]],
];

const MODE_THUMBNAIL_COUNT = {
  strict: 3,
  standard: 4,
  exploratory: 6,
  high_confidence: 4,
};

const STAGE_ORDER = [
  "received",
  "validated",
  "normalized",
  "ideated",
  "shortlisted",
  "spatialized",
  "thumbnailed",
  "critiqued",
  "packaged",
];

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const clamp = (value, min = 0, max = 10) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return min;
  }
  return Math.max(min, Math.min(max, numeric));
};

const normalizeScaleTenScore = (value, multiplier = 1, fallback = 7) => {
  if (value === undefined || value === null || value === "") {
    return clamp(fallback);
  }
  return clamp(Number(value) * multiplier);
};

const inferPredictedScoreMultiplier = (predictedScores) => {
  const numeric = Object.values(predictedScores ?? {})
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (numeric.length === 0) {
    return 1;
  }
  return numeric.every((value) => value >= 0 && value <= 1.2) ? 10 : 1;
};

const average = (values) => {
  const numeric = values.filter((value) => Number.isFinite(value));
  if (numeric.length === 0) {
    return 0;
  }
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
};

const slugify = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "figure-ideation";

const normalizeHeadingKey = (value) =>
  String(value ?? "")
    .trim()
    .replace(/^\d+\.\s*/, "")
    .toLowerCase();

const normalizeVersionLabel = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "0.1";
  }
  return raw.replace(/^v/i, "") || "0.1";
};

const toArray = (value) => (Array.isArray(value) ? value : []);
const toString = (value) =>
  typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
const toStringArray = (value) =>
  toArray(value).map((entry) => toString(entry)).filter(Boolean);
const compactObject = (value) =>
  Object.fromEntries(
    Object.entries(value).filter(([_key, entry]) => entry !== null && entry !== undefined)
  );

const deepMerge = (base, override) => {
  if (Array.isArray(base) || Array.isArray(override)) {
    return override === undefined ? structuredClone(base) : structuredClone(override);
  }
  if (
    base &&
    typeof base === "object" &&
    override &&
    typeof override === "object"
  ) {
    const merged = {
      ...base,
    };
    for (const key of Object.keys(override)) {
      merged[key] = key in base ? deepMerge(base[key], override[key]) : structuredClone(override[key]);
    }
    return merged;
  }
  return override === undefined ? structuredClone(base) : structuredClone(override);
};

const sha1 = (value) =>
  createHash("sha1").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");

const safeStructuredClone = (value) =>
  value === undefined ? undefined : structuredClone(value);

const parseStructuredFile = async (filePath) => {
  const resolvedPath = resolve(String(filePath));
  const raw = await readFile(resolvedPath, "utf8");
  const extension = extname(resolvedPath).toLowerCase();
  if (extension === ".yaml" || extension === ".yml") {
    return yaml.load(raw);
  }
  return JSON.parse(raw);
};

const renderTemplate = (template, values) =>
  String(template ?? "").replace(/\{([^}]+)\}/g, (_match, key) => String(values[key] ?? ""));

const guessProjectId = ({ packet, profileId, profileData }) => {
  if (profileData?.project_id) {
    return String(profileData.project_id);
  }
  if (profileId === "designer") {
    return "designer-health";
  }
  const rawProject = toString(packet?.authoring_context?.project);
  if (!rawProject) {
    return "adhoc";
  }
  return slugify(rawProject);
};

const normalizePacket = (packet) => {
  const slideNumber = (() => {
    const raw = packet?.slide_metadata?.slide_number;
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return String(Math.trunc(raw)).padStart(2, "0");
    }
    const text = toString(raw);
    if (/^\d+$/.test(text) && text.length < 2) {
      return text.padStart(2, "0");
    }
    return text;
  })();

  return {
    ...packet,
    artifact_type: toString(packet?.artifact_type),
    version: toString(packet?.version),
    run_mode: toString(packet?.run_mode) || "standard",
    authoring_context: {
      project: toString(packet?.authoring_context?.project),
      source_artifacts: toStringArray(packet?.authoring_context?.source_artifacts),
      parent_run_id: toString(packet?.authoring_context?.parent_run_id),
    },
    slide_metadata: {
      slide_number: slideNumber,
      working_title: toString(packet?.slide_metadata?.working_title),
      status: toString(packet?.slide_metadata?.status),
      adjacent_slides: toStringArray(packet?.slide_metadata?.adjacent_slides),
    },
    locked_meaning: {
      slide_job: toString(packet?.locked_meaning?.slide_job),
      audience_should_leave_believing: toString(
        packet?.locked_meaning?.audience_should_leave_believing
      ),
      core_claim: toString(packet?.locked_meaning?.core_claim),
    },
    slide_copy: {
      text_first: {
        header: toString(packet?.slide_copy?.text_first?.header),
        support_line: toString(packet?.slide_copy?.text_first?.support_line),
      },
      compressed: {
        header: toString(packet?.slide_copy?.compressed?.header),
        subheader: toString(packet?.slide_copy?.compressed?.subheader),
      },
    },
    figure_copy: {
      panel_labels: toStringArray(packet?.figure_copy?.panel_labels),
      figure_labels: toStringArray(packet?.figure_copy?.figure_labels),
    },
    figure_requirements: {
      figure_burden: toStringArray(packet?.figure_requirements?.figure_burden),
      figure_logic: toString(packet?.figure_requirements?.figure_logic),
      must_not_become: toStringArray(packet?.figure_requirements?.must_not_become),
    },
    starting_hypothesis: {
      proposed_figure_direction: toString(
        packet?.starting_hypothesis?.proposed_figure_direction
      ),
      treat_as: toString(packet?.starting_hypothesis?.treat_as),
      explore_alternatives:
        typeof packet?.starting_hypothesis?.explore_alternatives === "boolean"
          ? packet.starting_hypothesis.explore_alternatives
          : true,
    },
    current_visual_context: {
      keep: toStringArray(packet?.current_visual_context?.keep),
      change: toStringArray(packet?.current_visual_context?.change),
    },
    design_constraints: {
      tone: toStringArray(packet?.design_constraints?.tone),
      density_target: toString(packet?.design_constraints?.density_target),
      template: toString(packet?.design_constraints?.template),
      max_candidates: Number(packet?.design_constraints?.max_candidates ?? 8) || 8,
      shortlist_count: Number(packet?.design_constraints?.shortlist_count ?? 3) || 3,
      thumbnail_count: Number(packet?.design_constraints?.thumbnail_count ?? 0) || 0,
      allow_high_risk_candidate:
        typeof packet?.design_constraints?.allow_high_risk_candidate === "boolean"
          ? packet.design_constraints.allow_high_risk_candidate
          : false,
    },
    assets: {
      current_slide_image: toString(packet?.assets?.current_slide_image),
      template_file: toString(packet?.assets?.template_file),
      editable_source: toString(packet?.assets?.editable_source),
      reference_images: toStringArray(packet?.assets?.reference_images),
      adjacent_slide_images: toStringArray(packet?.assets?.adjacent_slide_images),
      prior_build_spec: toString(packet?.assets?.prior_build_spec),
      prior_critique_report: toString(packet?.assets?.prior_critique_report),
    },
    provider_preferences: {
      text_ideators: toStringArray(packet?.provider_preferences?.text_ideators),
      image_generators: toStringArray(packet?.provider_preferences?.image_generators),
      vision_critics: toStringArray(packet?.provider_preferences?.vision_critics),
    },
    orchestration_overrides: compactObject({
      ideator_worker_count: Number(packet?.orchestration_overrides?.ideator_worker_count ?? 0) || null,
      generator_worker_count: Number(packet?.orchestration_overrides?.generator_worker_count ?? 0) || null,
      critic_worker_count: Number(packet?.orchestration_overrides?.critic_worker_count ?? 0) || null,
      auto_promote_allowed:
        typeof packet?.orchestration_overrides?.auto_promote_allowed === "boolean"
          ? packet.orchestration_overrides.auto_promote_allowed
          : undefined,
      human_review_required:
        typeof packet?.orchestration_overrides?.human_review_required === "boolean"
          ? packet.orchestration_overrides.human_review_required
          : undefined,
    }),
    requested_outputs: toStringArray(packet?.requested_outputs),
    output_target: {
      build_spec_filename: toString(packet?.output_target?.build_spec_filename),
      critique_filename: toString(packet?.output_target?.critique_filename),
      manifest_filename: toString(packet?.output_target?.manifest_filename),
    },
  };
};

const hasExplicitFigureCopy = (packet) =>
  toStringArray(packet?.figure_copy?.panel_labels).length > 0 ||
  toStringArray(packet?.figure_copy?.figure_labels).length > 0;

const shouldUseRealCopy = ({ packet, config }) =>
  Boolean(config?.thumbnail_defaults?.use_real_copy_by_default) || hasExplicitFigureCopy(packet);

const getFigureCopyInstructions = (packet) => {
  const panelLabels = toStringArray(packet?.figure_copy?.panel_labels);
  const figureLabels = toStringArray(packet?.figure_copy?.figure_labels);
  return {
    panelLabels,
    figureLabels,
    hasExplicitCopy: panelLabels.length > 0 || figureLabels.length > 0,
  };
};

const tokenize = (value) =>
  toString(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token && !STOPWORDS.has(token));

const keywordOverlapScore = (text, targets) => {
  const textTokens = new Set(tokenize(text));
  const targetTokens = new Set(toStringArray(targets).flatMap((entry) => tokenize(entry)));
  if (targetTokens.size === 0) {
    return 0.5;
  }
  let hits = 0;
  for (const token of targetTokens) {
    if (textTokens.has(token)) {
      hits += 1;
    }
  }
  return hits / targetTokens.size;
};

const inferFigureFamily = (candidate) => {
  const haystack = `${toString(candidate?.move_name)} ${toString(candidate?.one_sentence_logic)} ${toString(
    candidate?.viewer_sees_first
  )}`.toLowerCase();
  for (const [family, keywords] of FAMILY_KEYWORDS) {
    if (keywords.some((keyword) => haystack.includes(keyword))) {
      return family;
    }
  }
  return "territory comparison";
};

const parsePromptSections = async () => {
  const markdown = await readFile(PROMPTS_PATH, "utf8");
  const matches = [...markdown.matchAll(/^##\s+(.+)$/gm)];
  const sections = new Map();
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const start = match.index + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : markdown.length;
    sections.set(
      normalizeHeadingKey(match[1]),
      markdown.slice(start, end).trim()
    );
  }
  return sections;
};

const getPromptSection = async (name) => {
  const sections = await parsePromptSections();
  const key = normalizeHeadingKey(name);
  const section = sections.get(key);
  if (!section) {
    throw new Error(`Missing prompt section "${name}".`);
  }
  return section;
};

const readSchemaPath = (fileName) => resolve(SCHEMA_DIR, fileName);

const resolveStageDir = (runDir, id, name, fullRunAttempt = 1) =>
  resolve(
    resolveAttemptRoot(runDir, fullRunAttempt),
    "stages",
    `${String(id).padStart(2, "0")}-${slugify(name)}`
  );

const toRelativeRunPath = (runDir, targetPath) =>
  relative(runDir, targetPath).split("\\").join("/");

const stripCodeFence = (value) => {
  const text = toString(value);
  const fencedMatch = text.match(JSON_BLOCK_REGEX);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }
  return text;
};

export const parseStructuredJson = (rawOutput, label = "response") => {
  const trimmed = stripCodeFence(rawOutput);
  if (!trimmed) {
    throw new Error(`${label} returned an empty response.`);
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.search(/[\[{]/);
    if (firstBrace === -1) {
      throw new Error(`${label} did not contain JSON.`);
    }
    const firstChar = trimmed[firstBrace];
    const closingChar = firstChar === "[" ? "]" : "}";
    const lastIndex = trimmed.lastIndexOf(closingChar);
    if (lastIndex === -1 || lastIndex <= firstBrace) {
      throw new Error(`${label} contained malformed JSON.`);
    }
    return JSON.parse(trimmed.slice(firstBrace, lastIndex + 1));
  }
};

const defaultProviderAvailability = {
  openai: hasOpenAIApiKey(),
  anthropic: hasAnthropicApiKey(),
  google: hasGeminiApiKey(),
};

const resolveProviderFamilyFromAlias = (value) => {
  const alias = toString(value).toLowerCase();
  if (alias.includes("openai")) {
    return "openai";
  }
  if (alias.includes("anthropic") || alias.includes("claude")) {
    return "anthropic";
  }
  if (alias.includes("google") || alias.includes("gemini")) {
    return "google";
  }
  return "openai";
};

const resolveModelDefaults = ({ providerFamily, purpose = "text" }) => {
  if (providerFamily === "anthropic") {
    return {
      model: DEFAULT_CLAUDE_MODEL,
      maxTokens: DEFAULT_CLAUDE_MAX_TOKENS,
    };
  }
  if (providerFamily === "google") {
    return {
      model: purpose === "image" ? DEFAULT_GEMINI_IMAGE_MODEL : DEFAULT_GEMINI_TEXT_MODEL,
      maxTokens: DEFAULT_OPENAI_MAX_TOKENS,
    };
  }
  return {
    model:
      purpose === "vision"
        ? DEFAULT_OPENAI_VISION_MODEL
        : purpose === "image"
          ? DEFAULT_OPENAI_IMAGE_MODEL
          : DEFAULT_OPENAI_TEXT_MODEL,
    maxTokens: DEFAULT_OPENAI_MAX_TOKENS,
  };
};

const normalizeWorkerSpec = (value, fallbackAlias) => {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    return {
      alias: value,
      provider_family: resolveProviderFamilyFromAlias(value),
      task: "",
    };
  }
  if (typeof value === "object") {
    const alias = toString(value.alias) || fallbackAlias;
    return {
      alias,
      provider_family:
        toString(value.provider_family) || resolveProviderFamilyFromAlias(alias),
      task: toString(value.task),
    };
  }
  return null;
};

const pushUniqueWorker = (workers, value, fallbackAlias) => {
  const worker = normalizeWorkerSpec(value, fallbackAlias);
  if (!worker) {
    return;
  }
  if (
    workers.some(
      (entry) =>
        entry.alias === worker.alias && entry.provider_family === worker.provider_family
    )
  ) {
    return;
  }
  workers.push(worker);
};

const parseSingleStageRouting = ({ section, stageKey, deprecationNotes }) => {
  if (!section || toString(section.mode) === "deterministic") {
    return [];
  }

  const providers = [];
  pushUniqueWorker(providers, section.primary, `${stageKey}-primary`);
  for (const [index, fallback] of toArray(section.fallbacks).entries()) {
    pushUniqueWorker(providers, fallback, `${stageKey}-fallback-${index + 1}`);
  }

  if (section.fallback) {
    deprecationNotes.push(
      `${stageKey} uses deprecated "fallback"; migrate to "fallbacks".`
    );
    pushUniqueWorker(providers, section.fallback, `${stageKey}-fallback-legacy`);
  }
  if (section.optional_secondary) {
    deprecationNotes.push(
      `${stageKey} uses deprecated "optional_secondary"; migrate to "fallbacks".`
    );
    pushUniqueWorker(
      providers,
      section.optional_secondary,
      `${stageKey}-fallback-legacy-secondary`
    );
  }

  if (providers.some((provider) => typeof section.primary === "string")) {
    deprecationNotes.push(
      `${stageKey} uses deprecated string routing; prefer worker objects with alias and provider_family.`
    );
  }

  return providers;
};

const resolveAttemptRoot = (runDir, fullRunAttempt = 1) =>
  fullRunAttempt > 1
    ? resolve(runDir, "attempts", `attempt-${String(fullRunAttempt).padStart(2, "0")}`)
    : runDir;

const recordStageAttempt = ({
  stageAttempts,
  fullRunAttempt,
  stage,
  providerFamily,
  providerAlias,
  attempt,
  outcome,
  message = "",
}) => {
  stageAttempts.push({
    full_run_attempt: fullRunAttempt,
    stage,
    provider_family: providerFamily,
    provider_alias: providerAlias,
    attempt,
    outcome,
    ...(message ? { message } : {}),
  });
};

const executeProviderActionChain = async ({
  providers,
  stage,
  stageId,
  stageName,
  runDir,
  services,
  fullRunAttempt = 1,
  retryPolicy,
  retryCounts,
  stageAttempts,
  action,
}) => {
  const normalizedProviders = toArray(providers).map((provider, index) =>
    normalizeWorkerSpec(provider, `${stage}-provider-${index + 1}`)
  ).filter(
    (provider) =>
      provider && providerIsAvailable(services, provider.provider_family)
  );

  if (normalizedProviders.length === 0) {
    throw new Error(`No providers configured for ${stage}.`);
  }

  const maxProviderAttempts = Math.max(
    1,
    Number(retryPolicy?.max_provider_retries ?? 0) + 1
  );
  const failures = [];

  for (const provider of normalizedProviders) {
    const providerFamily = provider.provider_family;
    const providerAlias = provider.alias || providerFamily;
    for (let attempt = 1; attempt <= maxProviderAttempts; attempt += 1) {
      const stageDir = resolve(
        resolveStageDir(runDir, stageId, stageName, fullRunAttempt),
        providerAlias,
        `provider-attempt-${String(attempt).padStart(2, "0")}`
      );
      try {
        const result = await action({
          provider,
          providerFamily,
          providerAlias,
          stageDir,
          attempt,
        });
        recordStageAttempt({
          stageAttempts,
          fullRunAttempt,
          stage,
          providerFamily,
          providerAlias,
          attempt,
          outcome: "success",
        });
        return {
          ...result,
          providerFamily,
          providerAlias,
        };
      } catch (error) {
        retryCounts.providers[providerFamily] = (retryCounts.providers[providerFamily] ?? 0) + 1;
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${providerAlias}#${attempt}: ${message}`);
        recordStageAttempt({
          stageAttempts,
          fullRunAttempt,
          stage,
          providerFamily,
          providerAlias,
          attempt,
          outcome: attempt < maxProviderAttempts ? "retryable_failure" : "failed",
          message,
        });
      }
    }
  }

  throw new Error(`Stage ${stage} exhausted providers: ${failures.join("; ")}`);
};

const mimeTypeFromImagePath = (filePath) => {
  const lower = String(filePath ?? "").toLowerCase();
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lower.endsWith(".webp")) {
    return "image/webp";
  }
  if (lower.endsWith(".gif")) {
    return "image/gif";
  }
  return "application/octet-stream";
};

const buildOpenAIInputContent = async ({ prompt, imagePaths = [] }) => {
  const content = [
    {
      type: "input_text",
      text: prompt,
    },
  ];

  for (const imagePath of imagePaths) {
    const filePath = resolve(String(imagePath));
    const buffer = await readFile(filePath);
    content.push({
      type: "input_image",
      image_url: `data:${mimeTypeFromImagePath(filePath)};base64,${buffer.toString("base64")}`,
    });
  }

  return content;
};

const buildAnthropicContent = async ({ prompt, imagePaths = [] }) => {
  const content = [
    {
      type: "text",
      text: prompt,
    },
  ];
  for (const imagePath of imagePaths) {
    const filePath = resolve(String(imagePath));
    const buffer = await readFile(filePath);
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: mimeTypeFromImagePath(filePath),
        data: buffer.toString("base64"),
      },
    });
  }
  return content;
};

const defaultServices = {
  availability: defaultProviderAvailability,
  async runStageModel({
    providerFamily,
    prompt,
    schemaPath = null,
    stageDir,
    purpose = "text",
    imagePaths = [],
  }) {
    await mkdir(stageDir, { recursive: true });
    await writeText(resolve(stageDir, "prompt.txt"), `${prompt.trim()}\n`);
    const { model, maxTokens } = resolveModelDefaults({
      providerFamily,
      purpose,
    });

    let rawText = "";
    if (providerFamily === "anthropic") {
      const payload = await createMessage({
        model,
        maxTokens,
        temperature: 0.2,
        messages: [
          {
            role: "user",
            content: await buildAnthropicContent({ prompt, imagePaths }),
          },
        ],
      });
      rawText = extractMessageText(payload);
    } else if (providerFamily === "google") {
      const result = await generateGeminiText({
        prompt,
        imagePaths,
        model,
        temperature: 0.2,
      });
      rawText = result.text;
    } else {
      const payload = await createResponse({
        model,
        input: [
          {
            role: "user",
            content: await buildOpenAIInputContent({ prompt, imagePaths }),
          },
        ],
        max_output_tokens: maxTokens,
        ...(schemaPath
          ? {
              text: {
                format: {
                  type: "json_schema",
                  name: slugify(basename(schemaPath, extname(schemaPath))),
                  strict: true,
                  schema: JSON.parse(await readFile(schemaPath, "utf8")),
                },
              },
            }
          : {
              text: {
                format: {
                  type: "json_object",
                },
              },
            }),
      });
      rawText = extractResponseText(payload);
    }

    if (!rawText) {
      throw new Error(`${providerFamily} returned an empty response.`);
    }

    await writeText(resolve(stageDir, "response.txt"), `${rawText.trim()}\n`);
    const data = parseStructuredJson(rawText, `${providerFamily} stage`);
    if (schemaPath) {
      const validation = await validateJsonAgainstSchema({
        data,
        schemaPath,
        label: basename(schemaPath),
      });
      if (!validation.ok) {
        throw new Error(validation.message);
      }
    }
    await writeJson(resolve(stageDir, "result.json"), data);
    return {
      data,
      model,
      providerFamily,
      responseText: rawText,
    };
  },
  async generateImage({ providerFamily, prompt, outDir, referenceImages = [] }) {
    if (providerFamily === "google") {
      const startedAt = Date.now();
      const result = await generateGeminiImages({
        prompt,
        images: referenceImages,
      });
      const artifacts = await writeGeminiImageArtifacts({
        dir: outDir,
        prompt,
        model: DEFAULT_GEMINI_IMAGE_MODEL,
        aspectRatio: "16:9",
        imageSize: "2K",
        result,
        referenceImages,
        elapsedMs: Date.now() - startedAt,
      });
      return {
        providerFamily,
        model: DEFAULT_GEMINI_IMAGE_MODEL,
        filePath: artifacts.primary,
      };
    }

    const startedAt = Date.now();
    const result = await generateOpenAIImage({
      prompt,
      imagePaths: referenceImages,
    });
    const artifacts = await writeOpenAIImageArtifacts({
      dir: outDir,
      prompt,
      model: DEFAULT_OPENAI_IMAGE_MODEL,
      result,
      referenceImages,
      elapsedMs: Date.now() - startedAt,
    });
    return {
      providerFamily,
      model: DEFAULT_OPENAI_IMAGE_MODEL,
      filePath: artifacts.imagePath,
    };
  },
};

const providerIsAvailable = (services, providerFamily) => {
  if (hasOwn(services?.availability ?? {}, providerFamily)) {
    return Boolean(services.availability[providerFamily]);
  }
  return Boolean(defaultProviderAvailability[providerFamily]);
};

const computeRecommendedRunMode = (packet, config) =>
  toString(packet?.run_mode) || toString(config?.run_defaults?.run_mode) || "standard";

export const validateFigureIdeationPacket = async ({
  packet,
  config,
  profileData = null,
}) => {
  const normalizedPacket = normalizePacket(packet);
  const validation = await validateJsonAgainstSchema({
    data: normalizedPacket,
    schemaPath: readSchemaPath("figure-ideation-input.schema.json"),
    label: "figure-ideation-input",
  });

  const hardErrors = [];
  const softWarnings = [];
  const inferredFields = [];

  if (!validation.ok) {
    hardErrors.push(validation.message);
  }
  if (!normalizedPacket.locked_meaning.slide_job) {
    hardErrors.push("slide_job is required.");
  }
  if (!normalizedPacket.locked_meaning.core_claim) {
    hardErrors.push("core_claim is required.");
  }
  if (!normalizedPacket.locked_meaning.audience_should_leave_believing) {
    hardErrors.push("audience_should_leave_believing is required.");
  }
  if (normalizedPacket.figure_requirements.figure_burden.length === 0) {
    hardErrors.push("figure_burden must contain at least one item.");
  }
  if (normalizedPacket.figure_requirements.must_not_become.length === 0) {
    hardErrors.push("must_not_become must contain at least one guardrail.");
  }
  if (normalizedPacket.requested_outputs.length === 0) {
    hardErrors.push("requested_outputs must not be empty.");
  }

  if (
    normalizedPacket.slide_copy.text_first.header &&
    !normalizedPacket.slide_copy.compressed.header
  ) {
    softWarnings.push("compressed.header is missing while text_first.header exists.");
  }
  if (!normalizedPacket.assets.template_file) {
    softWarnings.push("template_file is missing.");
  }
  if (normalizedPacket.assets.adjacent_slide_images.length === 0) {
    softWarnings.push("adjacent_slide_images is missing.");
  }
  if (normalizedPacket.current_visual_context.keep.length === 0) {
    softWarnings.push("current_visual_context.keep is missing.");
  }
  if (!normalizedPacket.run_mode) {
    inferredFields.push("run_mode");
  }
  if (
    normalizedPacket.starting_hypothesis.proposed_figure_direction &&
    normalizedPacket.figure_requirements.must_not_become.some((entry) =>
      normalizedPacket.starting_hypothesis.proposed_figure_direction
        .toLowerCase()
        .includes(entry.toLowerCase())
    )
  ) {
    softWarnings.push("starting_hypothesis conflicts with must_not_become.");
  }
  if (
    profileData?.guardrails &&
    normalizedPacket.design_constraints.tone.length === 0
  ) {
    softWarnings.push("design_constraints.tone is missing for profile guardrails.");
  }

  return {
    packet: normalizedPacket,
    valid: hardErrors.length === 0,
    hard_errors: hardErrors,
    soft_warnings: softWarnings,
    inferred_fields: inferredFields,
    recommended_run_mode: computeRecommendedRunMode(normalizedPacket, config),
  };
};

const deriveInterpretationConfidence = ({ validation, packet }) => {
  let confidence = 0.95;
  confidence -= validation.soft_warnings.length * 0.03;
  confidence -= packet.current_visual_context.keep.length === 0 ? 0.05 : 0;
  confidence -= packet.assets.reference_images.length === 0 ? 0.02 : 0;
  return Math.max(0.4, Math.min(0.99, confidence));
};

const buildNormalizedBrief = ({ packet, validation }) => ({
  slide_job: packet.locked_meaning.slide_job,
  audience_belief: packet.locked_meaning.audience_should_leave_believing,
  core_claim: packet.locked_meaning.core_claim,
  text_first_header: packet.slide_copy.text_first.header,
  text_first_support: packet.slide_copy.text_first.support_line,
  compressed_header: packet.slide_copy.compressed.header,
  compressed_subheader: packet.slide_copy.compressed.subheader,
  figure_burden: packet.figure_requirements.figure_burden,
  figure_logic: packet.figure_requirements.figure_logic,
  must_not_become: packet.figure_requirements.must_not_become,
  keep_from_current: packet.current_visual_context.keep,
  change_from_current: packet.current_visual_context.change,
  unresolved_questions: [],
  interpretation_summary: `${packet.slide_metadata.working_title}: ${packet.locked_meaning.core_claim}`,
  what_this_slide_is_really_trying_to_do: packet.locked_meaning.slide_job,
  what_this_slide_is_not_allowed_to_become: packet.figure_requirements.must_not_become.join("; "),
  interpretation_confidence: deriveInterpretationConfidence({ validation, packet }),
  contradictions: validation.soft_warnings.filter((warning) =>
    warning.toLowerCase().includes("conflict")
  ),
  missing_fields: validation.inferred_fields,
  ambiguity: validation.soft_warnings.filter((warning) =>
    warning.toLowerCase().includes("missing")
  ),
  overlap_with_adjacent_slides: [],
});

const buildFigureBrief = ({ packet, normalizedBrief }) => ({
  figure_burden_summary: packet.figure_requirements.figure_burden.join("; "),
  one_sentence_figure_logic: packet.figure_requirements.figure_logic,
  viewer_should_see_first:
    packet.starting_hypothesis.proposed_figure_direction ||
    normalizedBrief.core_claim,
  what_must_be_shown_spatially: packet.figure_requirements.figure_burden,
  what_text_should_keep_carrying: toStringArray([
    packet.slide_copy.text_first.header,
    packet.slide_copy.text_first.support_line,
  ]),
  what_should_remain_sparse:
    packet.design_constraints.density_target === "sparse"
      ? ["Protected whitespace", "Headline block", "Unoccupied comparison area"]
      : ["Headline block"],
  what_should_be_dense: toStringArray([
    packet.figure_requirements.figure_logic,
    ...packet.current_visual_context.change,
  ]),
  acceptable_abstraction_level:
    packet.design_constraints.density_target === "sparse" ? "moderate-to-abstract" : "moderate",
  failure_risks_if_figure_is_wrong: toStringArray([
    ...packet.figure_requirements.must_not_become,
    "Slide collapses into semantic positioning without proof.",
  ]),
});

const buildPromptEnvelope = async ({
  roleName,
  contract,
  context,
  extraRules = [],
}) => {
  const rolePrompt = await getPromptSection(roleName);
  return [
    rolePrompt,
    "",
    contract ? `Schema or contract:\n${contract}` : "",
    extraRules.length > 0 ? `Additional rules:\n- ${extraRules.join("\n- ")}` : "",
    "",
    "Context JSON:",
    JSON.stringify(context, null, 2),
    "",
    "Return only the requested output.",
  ]
    .filter(Boolean)
    .join("\n");
};

const loadContractText = async (schemaPath) => {
  if (!schemaPath || !existsSync(schemaPath)) {
    return "";
  }
  return readFile(schemaPath, "utf8");
};

const buildIdeationPrompt = async ({ packet, normalizedBrief, figureBrief, count, diversityPass }) =>
  buildPromptEnvelope({
    roleName: "Figure Move Ideator",
    contract: await loadContractText(readSchemaPath("figure-move-ideator-output.schema.json")),
    context: {
      packet,
      normalized_brief: normalizedBrief,
      figure_brief: figureBrief,
      expected_candidate_count: count,
      diversity_pass: diversityPass,
    },
    extraRules: [
      `Generate ${count} candidates.`,
      diversityPass ? "Broaden the search away from any previously dominant pattern." : "Honor the starting hypothesis as a hypothesis, not a fixed answer.",
      packet.design_constraints.allow_high_risk_candidate
        ? "You may include one high-risk option."
        : "Do not include high-risk novelty for novelty's sake.",
    ],
  });

const normalizeCandidate = (candidate, providerAlias, index) => {
  const rawPredictedScores = {
    job_fidelity: candidate?.predicted_scores?.job_fidelity,
    clarity: candidate?.predicted_scores?.clarity,
    distinctness: candidate?.predicted_scores?.distinctness,
    collapse_resistance: candidate?.predicted_scores?.collapse_resistance,
    buildability: candidate?.predicted_scores?.buildability,
  };
  const multiplier = inferPredictedScoreMultiplier(rawPredictedScores);
  return {
    candidate_id:
      toString(candidate?.candidate_id) ||
      `${providerAlias}-candidate-${String(index + 1).padStart(2, "0")}`,
    move_name: toString(candidate?.move_name),
    one_sentence_logic: toString(candidate?.one_sentence_logic),
    what_makes_it_smart: toString(candidate?.what_makes_it_smart),
    viewer_sees_first: toString(candidate?.viewer_sees_first),
    fits_slide_because: toString(candidate?.fits_slide_because),
    failure_mode: toString(candidate?.failure_mode),
    predicted_scores: {
      job_fidelity: normalizeScaleTenScore(rawPredictedScores.job_fidelity, multiplier),
      clarity: normalizeScaleTenScore(rawPredictedScores.clarity, multiplier),
      distinctness: normalizeScaleTenScore(rawPredictedScores.distinctness, multiplier),
      collapse_resistance: normalizeScaleTenScore(
        rawPredictedScores.collapse_resistance,
        multiplier
      ),
      buildability: normalizeScaleTenScore(rawPredictedScores.buildability, multiplier),
    },
    provider_alias: providerAlias,
    family_guess: inferFigureFamily(candidate),
  };
};

const jaccardSimilarity = (left, right) => {
  const leftSet = new Set(tokenize(left));
  const rightSet = new Set(tokenize(right));
  if (leftSet.size === 0 && rightSet.size === 0) {
    return 1;
  }
  let intersection = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) {
      intersection += 1;
    }
  }
  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 0 : intersection / union;
};

const scoreCandidateDeterministically = ({ candidate, packet, config }) => {
  const figureBurdenFit = clamp(
    7 + keywordOverlapScore(
      `${candidate.one_sentence_logic} ${candidate.fits_slide_because}`,
      packet.figure_requirements.figure_burden
    ) *
      3
  );
  const audienceBeliefFidelity = clamp(
    average([
      candidate.predicted_scores.job_fidelity,
      candidate.predicted_scores.collapse_resistance,
      figureBurdenFit,
    ])
  );
  const eleganceRestraint = clamp(
    candidate.move_name.toLowerCase().includes("matrix") ||
      candidate.one_sentence_logic.toLowerCase().includes("dashboard")
      ? 5.5
      : 8
  );
  const scores = {
    job_fidelity: candidate.predicted_scores.job_fidelity,
    audience_belief_fidelity: audienceBeliefFidelity,
    figure_burden_fit: figureBurdenFit,
    two_second_clarity: candidate.predicted_scores.clarity,
    distinctness: candidate.predicted_scores.distinctness,
    collapse_resistance: candidate.predicted_scores.collapse_resistance,
    elegance_restraint: eleganceRestraint,
    buildability: candidate.predicted_scores.buildability,
  };
  const weights = config.weights;
  const weighted_total =
    scores.job_fidelity * weights.job_fidelity +
    scores.audience_belief_fidelity * weights.audience_belief_fidelity +
    scores.figure_burden_fit * weights.figure_burden_fit +
    scores.two_second_clarity * weights.two_second_clarity +
    scores.distinctness * weights.distinctness +
    scores.collapse_resistance * weights.collapse_resistance +
    scores.elegance_restraint * weights.elegance_restraint +
    scores.buildability * weights.buildability;

  return {
    ...candidate,
    scores,
    weighted_total: Number(weighted_total.toFixed(3)),
  };
};

export const computeCandidateWeightedTotal = ({ scores, weights }) =>
  Number(
    (
      scores.job_fidelity * weights.job_fidelity +
      scores.audience_belief_fidelity * weights.audience_belief_fidelity +
      scores.figure_burden_fit * weights.figure_burden_fit +
      scores.two_second_clarity * weights.two_second_clarity +
      scores.distinctness * weights.distinctness +
      scores.collapse_resistance * weights.collapse_resistance +
      scores.elegance_restraint * weights.elegance_restraint +
      scores.buildability * weights.buildability
    ).toFixed(3)
  );

const mergeAndClusterCandidates = ({ rawCandidates }) => {
  const canonicalCandidates = [];
  const rawToCanonicalMap = [];
  const duplicateWarnings = [];

  for (const candidate of rawCandidates) {
    const existing = canonicalCandidates.find((entry) => {
      if (entry.family_guess !== candidate.family_guess) {
        return false;
      }
      const similarity = jaccardSimilarity(
        `${entry.move_name} ${entry.one_sentence_logic}`,
        `${candidate.move_name} ${candidate.one_sentence_logic}`
      );
      return similarity >= 0.72;
    });

    if (!existing) {
      canonicalCandidates.push(candidate);
      rawToCanonicalMap.push({
        raw_candidate_id: candidate.candidate_id,
        canonical_candidate_id: candidate.candidate_id,
        merge_reason: "unique",
        cluster_id: slugify(candidate.family_guess),
      });
      continue;
    }

    const currentAverage = average(Object.values(existing.predicted_scores));
    const nextAverage = average(Object.values(candidate.predicted_scores));
    const keeper = nextAverage > currentAverage ? candidate : existing;
    const duplicate = keeper === candidate ? existing : candidate;

    if (keeper === candidate) {
      const index = canonicalCandidates.findIndex((entry) => entry.candidate_id === existing.candidate_id);
      canonicalCandidates.splice(index, 1, candidate);
    }

    rawToCanonicalMap.push({
      raw_candidate_id: candidate.candidate_id,
      canonical_candidate_id: keeper.candidate_id,
      merge_reason: "semantic-duplicate",
      cluster_id: slugify(keeper.family_guess),
    });
    duplicateWarnings.push(
      `Merged ${duplicate.candidate_id} into ${keeper.candidate_id} due to semantic overlap.`
    );
  }

  const clusters = [...new Set(canonicalCandidates.map((candidate) => candidate.family_guess))].map(
    (familyGuess) => ({
      cluster_id: slugify(familyGuess),
      family_guess: familyGuess,
      candidate_ids: canonicalCandidates
        .filter((candidate) => candidate.family_guess === familyGuess)
        .map((candidate) => candidate.candidate_id),
    })
  );

  const familyDiversity = Math.min(1, clusters.length / 3);
  const providerDiversity = Math.min(
    1,
    new Set(canonicalCandidates.map((candidate) => candidate.provider_alias)).size / 3
  );
  const viewpointDiversity = Math.min(
    1,
    new Set(canonicalCandidates.map((candidate) => slugify(candidate.viewer_sees_first))).size /
      Math.max(1, canonicalCandidates.length)
  );
  const diversityScore = Number(
    average([familyDiversity * 10, providerDiversity * 10, viewpointDiversity * 10]).toFixed(3)
  );

  return {
    raw_candidates: rawCandidates,
    canonical_candidates: canonicalCandidates,
    clusters,
    raw_to_canonical_map: rawToCanonicalMap,
    diversity_score: Number((diversityScore / 10).toFixed(3)),
    duplicate_warnings: duplicateWarnings,
  };
};

const shortlistCandidates = ({ candidatePool, packet, config }) => {
  const scoredCandidates = candidatePool.canonical_candidates
    .map((candidate) => scoreCandidateDeterministically({ candidate, packet, config }))
    .sort((left, right) => right.weighted_total - left.weighted_total);

  const autoRejects = [];
  const viable = [];
  for (const candidate of scoredCandidates) {
    const rejects = [];
    if (candidate.scores.job_fidelity < config.thresholds.candidate_auto_reject.min_job_fidelity) {
      rejects.push("job_fidelity");
    }
    if (
      candidate.scores.figure_burden_fit <
      config.thresholds.candidate_auto_reject.min_figure_burden_fit
    ) {
      rejects.push("figure_burden_fit");
    }
    if (
      candidate.scores.collapse_resistance <
      config.thresholds.candidate_auto_reject.min_collapse_resistance
    ) {
      rejects.push("collapse_resistance");
    }
    if (rejects.length > 0) {
      autoRejects.push({
        candidate_id: candidate.candidate_id,
        reasons: rejects,
      });
      continue;
    }
    viable.push(candidate);
  }

  let shortlist = viable.slice(0, packet.design_constraints.shortlist_count || 3);
  const top = viable[0];
  const runnerUp = viable[1];
  if (
    top &&
    top.weighted_total >= config.thresholds.candidate_auto_win.min_weighted_total &&
    (!runnerUp ||
      top.weighted_total - runnerUp.weighted_total >=
        config.thresholds.candidate_auto_win.min_runner_up_gap)
  ) {
    shortlist = [top];
  }

  return {
    scored_candidates: scoredCandidates,
    auto_rejects: autoRejects,
    shortlist,
    diversity_sufficient:
      candidatePool.diversity_score >= config.thresholds.min_candidate_diversity,
    selection_notes: shortlist.map(
      (candidate) =>
        `${candidate.candidate_id} advanced with weighted_total=${candidate.weighted_total}.`
    ),
  };
};

const selectFigureFamily = ({ shortlist }) => {
  const familyRank = shortlist.reduce((acc, candidate) => {
    acc[candidate.family_guess] = (acc[candidate.family_guess] ?? 0) + candidate.weighted_total;
    return acc;
  }, {});
  const ranking = Object.entries(familyRank)
    .sort((left, right) => right[1] - left[1])
    .map(([family, score]) => ({
      family,
      score: Number(score.toFixed(3)),
    }));
  const selectedFamily = ranking[0]?.family || shortlist[0]?.family_guess || "territory comparison";
  return {
    ranking,
    selected_family: selectedFamily,
    family_definition: `${selectedFamily} best supports the strongest shortlisted move.`,
    why_it_wins: `${selectedFamily} aligned best with the shortlisted candidate logic and restraint needs.`,
    why_runner_up_families_lose: ranking.slice(1).map((entry) => `${entry.family} scored lower.`),
    risk_notes: shortlist.map((candidate) => `${candidate.candidate_id}: ${candidate.failure_mode}`),
  };
};

const buildSpatializerPrompt = async ({
  packet,
  normalizedBrief,
  figureBrief,
  shortlist,
  familySelection,
  config,
}) => {
  const figureCopy = getFigureCopyInstructions(packet);
  return buildPromptEnvelope({
    roleName: "Spatializer",
    contract: await loadContractText(readSchemaPath("spatial-spec.schema.json")),
    context: {
      packet,
      normalized_brief: normalizedBrief,
      figure_brief: figureBrief,
      shortlisted_candidates: shortlist,
      family_selection: familySelection,
    },
    extraRules: [
      "Preserve protected whitespace when density_target is sparse.",
      "Make the spatial specs concrete enough that a builder can work directly from them.",
      shouldUseRealCopy({ packet, config })
        ? "Use real copy rather than placeholder copy for named figure elements."
        : "Placeholder copy is allowed only where the packet does not provide exact figure wording.",
      figureCopy.hasExplicitCopy
        ? `Carry forward the exact figure copy. Panel labels: ${figureCopy.panelLabels.join(" | ")}. Figure labels: ${figureCopy.figureLabels.join(" | ")}.`
        : "If the packet names chips, labels, or hero text explicitly, preserve them instead of anonymizing them.",
      "Do not convert named figure copy into anonymous chips or unlabeled boxes unless the packet explicitly asks for abstraction.",
    ],
  });
};

const buildThumbnailPromptBuilderPrompt = async ({
  packet,
  normalizedBrief,
  figureBrief,
  spatialSpec,
  thumbnailCount,
  config,
}) => {
  const figureCopy = getFigureCopyInstructions(packet);
  return buildPromptEnvelope({
    roleName: "Thumbnail Prompt Builder",
    contract: await loadContractText(readSchemaPath("thumbnail-prompt-output.schema.json")),
    context: {
      packet,
      normalized_brief: normalizedBrief,
      figure_brief: figureBrief,
      spatial_spec: spatialSpec,
      thumbnail_count: thumbnailCount,
    },
    extraRules: [
      `Return ${thumbnailCount} thumbnail prompts in total.`,
      "Vary one meaningful layout dimension at a time.",
      "Optimize for visual logic, hierarchy, and the slide job, not polish.",
      shouldUseRealCopy({ packet, config })
        ? "Set whether_copy_is_real_or_placeholder to real and keep the actual slide and figure copy in the prompt."
        : "Use placeholder copy only when no explicit figure copy is supplied.",
      figureCopy.hasExplicitCopy
        ? `Preserve the exact figure copy. Panel labels: ${figureCopy.panelLabels.join(" | ")}. Figure labels: ${figureCopy.figureLabels.join(" | ")}.`
        : "If the packet or spatial spec contains named chips or labels, keep them as written.",
      "Do not collapse named market/category labels into anonymous gray boxes.",
    ],
  });
};

const buildThumbnailFallbackPrompt = async ({
  packet,
  normalizedBrief,
  spatialSpec,
  thumbnailCount,
  config,
}) => {
  const figureCopy = getFigureCopyInstructions(packet);
  return buildPromptEnvelope({
    roleName: "Thumbnail Planner (No-image fallback)",
    contract: "",
    context: {
      packet,
      normalized_brief: normalizedBrief,
      spatial_spec: spatialSpec,
      thumbnail_count: thumbnailCount,
    },
    extraRules: [
      `Return ${thumbnailCount} thumbnail directions as JSON array.`,
      "Each direction must describe what the viewer sees first and why it might work.",
      shouldUseRealCopy({ packet, config })
        ? "Use the real slide and figure copy in the thumbnail directions."
        : "Placeholder copy is allowed only when no explicit figure copy is available.",
      figureCopy.hasExplicitCopy
        ? `Preserve the exact figure copy. Panel labels: ${figureCopy.panelLabels.join(" | ")}. Figure labels: ${figureCopy.figureLabels.join(" | ")}.`
        : "",
    ],
  });
};

const buildCriticPrompt = async ({
  packet,
  normalizedBrief,
  figureBrief,
  thumbnails,
}) =>
  buildPromptEnvelope({
    roleName: "Vision Critic",
    contract: await loadContractText(readSchemaPath("vision-critic-output.schema.json")),
    context: {
      packet,
      normalized_brief: normalizedBrief,
      figure_brief: figureBrief,
      thumbnails: thumbnails.map((thumbnail) => ({
        thumbnail_id: thumbnail.thumbnail_id,
        source_candidate_id: thumbnail.source_candidate_id,
        description: thumbnail.description,
        variation_dimension: thumbnail.variation_dimension,
        file_path: thumbnail.file_path ?? null,
      })),
    },
    extraRules: [
      "Rank every thumbnail and keep the scores calibrated to the slide job.",
      "If the thumbnails are text-only, critique the structural direction rather than pixel polish.",
    ],
  });

const normalizeThumbnailPrompts = (payload) => {
  const prompts = Array.isArray(payload?.thumbnail_prompts) ? payload.thumbnail_prompts : [];
  return {
    thumbnail_prompts: prompts.map((entry, index) => ({
      thumbnail_prompt_id:
        toString(entry?.thumbnail_prompt_id) || `thumbnail-prompt-${String(index + 1).padStart(2, "0")}`,
      source_spatial_spec_id: toString(entry?.source_spatial_spec_id),
      source_candidate_id: toString(entry?.source_candidate_id),
      generator_target: toString(entry?.generator_target) || "image_generation",
      prompt_text: toString(entry?.prompt_text),
      expected_variation_dimension: toString(entry?.expected_variation_dimension),
      whether_copy_is_real_or_placeholder: toString(
        entry?.whether_copy_is_real_or_placeholder
      ),
      whether_images_are_literal_or_abstract: toString(
        entry?.whether_images_are_literal_or_abstract
      ),
      likely_risk: toString(entry?.likely_risk),
    })),
  };
};

const normalizeCriticReport = (report) => {
  const thumbnailReports = toArray(report?.thumbnail_reports).map((entry) => ({
    thumbnail_id: toString(entry?.thumbnail_id),
    scores: {
      two_second_clarity: clamp(entry?.scores?.two_second_clarity ?? 0),
      strategic_fidelity: clamp(entry?.scores?.strategic_fidelity ?? 0),
      figure_burden_fit: clamp(entry?.scores?.figure_burden_fit ?? 0),
      adjacent_slide_distinctness: clamp(entry?.scores?.adjacent_slide_distinctness ?? 0),
      collapse_resistance: clamp(entry?.scores?.collapse_resistance ?? 0),
      elegance_restraint: clamp(entry?.scores?.elegance_restraint ?? 0),
      visual_balance: clamp(entry?.scores?.visual_balance ?? 0),
      build_feasibility: clamp(entry?.scores?.build_feasibility ?? 0),
      investor_readability: clamp(entry?.scores?.investor_readability ?? 0),
    },
    overall_score: clamp(entry?.overall_score ?? 0),
    top_strength: toString(entry?.top_strength),
    top_weakness: toString(entry?.top_weakness),
    keep: toStringArray(entry?.keep),
    remove: toStringArray(entry?.remove),
    exact_revision: toString(entry?.exact_revision),
    confidence: clamp(entry?.confidence ?? 0, 0, 1),
  }));

  return {
    thumbnail_reports: thumbnailReports,
    ranked_list: toStringArray(report?.ranked_list),
    winner: toString(report?.winner),
    why_winner_wins: toString(report?.why_winner_wins),
    whether_upstream_truth_should_be_reopened: Boolean(
      report?.whether_upstream_truth_should_be_reopened
    ),
    whether_human_review_is_recommended: Boolean(
      report?.whether_human_review_is_recommended
    ),
    next_action: toString(report?.next_action),
  };
};

export const aggregateCritiqueReports = ({
  criticReports,
  thumbnails,
  config,
  acceptanceFlags = [],
  criticQuorum = 2,
  humanReviewRequiredByDefault = false,
  autoPromoteAllowed = true,
}) => {
  const perThumbnail = thumbnails.map((thumbnail) => {
    const reports = criticReports
      .map((critic) =>
        critic.thumbnail_reports.find((entry) => entry.thumbnail_id === thumbnail.thumbnail_id)
      )
      .filter(Boolean);
    const aggregateScores = {
      two_second_clarity: average(reports.map((entry) => entry.scores.two_second_clarity)),
      strategic_fidelity: average(reports.map((entry) => entry.scores.strategic_fidelity)),
      figure_burden_fit: average(reports.map((entry) => entry.scores.figure_burden_fit)),
      adjacent_slide_distinctness: average(
        reports.map((entry) => entry.scores.adjacent_slide_distinctness)
      ),
      collapse_resistance: average(reports.map((entry) => entry.scores.collapse_resistance)),
      elegance_restraint: average(reports.map((entry) => entry.scores.elegance_restraint)),
      visual_balance: average(reports.map((entry) => entry.scores.visual_balance)),
      build_feasibility: average(reports.map((entry) => entry.scores.build_feasibility)),
      investor_readability: average(reports.map((entry) => entry.scores.investor_readability)),
    };
    const overall = average(reports.map((entry) => entry.overall_score));
    return {
      thumbnail_id: thumbnail.thumbnail_id,
      reports_count: reports.length,
      aggregate_scores: Object.fromEntries(
        Object.entries(aggregateScores).map(([key, value]) => [key, Number(value.toFixed(3))])
      ),
      aggregate_overall_score: Number(overall.toFixed(3)),
      exact_revisions: reports.map((entry) => entry.exact_revision).filter(Boolean),
      strengths: reports.map((entry) => entry.top_strength).filter(Boolean),
      weaknesses: reports.map((entry) => entry.top_weakness).filter(Boolean),
    };
  });

  const rankedList = [...perThumbnail]
    .sort((left, right) => right.aggregate_overall_score - left.aggregate_overall_score)
    .map((entry) => entry.thumbnail_id);
  const winner = perThumbnail.find((entry) => entry.thumbnail_id === rankedList[0]) ?? null;
  const topScores = criticReports
    .map((critic) =>
      critic.thumbnail_reports.find((entry) => entry.thumbnail_id === winner?.thumbnail_id)?.overall_score
    )
    .filter((value) => Number.isFinite(value));
  const disagreementScore = Number(
    (
      (topScores.length > 0 ? Math.max(...topScores) - Math.min(...topScores) : 0) +
      (new Set(criticReports.map((report) => report.winner)).size > 1 ? 1 : 0)
    ).toFixed(3)
  );

  const allWeakStrategic = perThumbnail.every(
    (entry) =>
      entry.aggregate_scores.strategic_fidelity < 7 ||
      entry.aggregate_scores.figure_burden_fit < 7
  );
  const retryThumbnails = Boolean(
    winner &&
      winner.aggregate_scores.strategic_fidelity >= 7 &&
      winner.aggregate_scores.figure_burden_fit >= 7 &&
      winner.aggregate_scores.build_feasibility < 7
  );
  const humanReviewRequired =
    humanReviewRequiredByDefault ||
    !autoPromoteAllowed ||
    criticReports.length < criticQuorum ||
    disagreementScore >= config.thresholds.disagreement.high ||
    acceptanceFlags.length > 0 ||
    (winner != null &&
      rankedList.length > 1 &&
      Math.abs(
        winner.aggregate_overall_score -
          (perThumbnail.find((entry) => entry.thumbnail_id === rankedList[1])?.aggregate_overall_score ?? 0)
      ) <= 0.2 &&
      new Set(criticReports.map((report) => report.winner)).size > 1);

  const whyWinnerWins = winner
    ? `Highest aggregate overall score at ${winner.aggregate_overall_score}.`
    : "No winner identified.";

  return {
    aggregate_scores: perThumbnail,
    ranked_list: rankedList,
    winner: winner?.thumbnail_id ?? "",
    why_winner_wins: whyWinnerWins,
    disagreement_score: disagreementScore,
    critic_quorum: criticQuorum,
    critics_completed: criticReports.length,
    human_review_required: humanReviewRequired,
    reopen_upstream_truth: allWeakStrategic,
    retry_thumbnails: retryThumbnails,
    next_action: allWeakStrategic
      ? "reopen_upstream_truth"
      : humanReviewRequired
        ? "human_review_required"
        : retryThumbnails
          ? "retry_thumbnails"
          : "package",
    acceptance_flags: acceptanceFlags,
  };
};

const detectAcceptanceFlags = ({ packet, profileData, selectedMove, selectedThumbnail }) => {
  const slideNumber = packet.slide_metadata.slide_number;
  const tests = toArray(profileData?.acceptance_tests?.[slideNumber]);
  const haystack = `${toString(selectedMove?.move_name)} ${toString(selectedMove?.one_sentence_logic)} ${toString(
    selectedThumbnail?.description
  )}`.toLowerCase();

  const matched = [];
  for (const phrase of tests) {
    const normalized = toString(phrase).toLowerCase();
    const keyTokens = tokenize(normalized);
    if (keyTokens.length === 0) {
      continue;
    }
    const matches = keyTokens.filter((token) => haystack.includes(token));
    if (matches.length >= Math.max(1, Math.ceil(keyTokens.length / 2))) {
      matched.push(phrase);
    }
  }
  return matched;
};

const resolveWinnerLineage = ({
  thumbnailManifest,
  spatialSpec,
  shortlist,
  aggregateCritique,
  familySelection,
}) => {
  const thumbnails = toArray(thumbnailManifest?.thumbnails);
  const spatialSpecs = toArray(spatialSpec?.spatial_specs);
  const shortlistedCandidates = toArray(shortlist?.shortlist);

  const selectedThumbnailId = aggregateCritique?.winner || thumbnails[0]?.thumbnail_id || "";
  const selectedThumbnail = thumbnails.find((entry) => entry.thumbnail_id === selectedThumbnailId);
  if (!selectedThumbnail) {
    throw new Error(`Unable to resolve winning thumbnail "${selectedThumbnailId}".`);
  }

  const bySpatialSpecId = spatialSpecs.filter(
    (entry) => entry.spatial_spec_id === selectedThumbnail.source_spatial_spec_id
  );
  if (bySpatialSpecId.length > 1) {
    throw new Error(
      `Winning thumbnail "${selectedThumbnailId}" matched multiple spatial specs.`
    );
  }

  let selectedSpatialSpec = bySpatialSpecId[0] ?? null;
  if (!selectedSpatialSpec) {
    const byCandidateId = spatialSpecs.filter(
      (entry) => entry.source_candidate_id === selectedThumbnail.source_candidate_id
    );
    if (byCandidateId.length > 1) {
      throw new Error(
        `Winning thumbnail "${selectedThumbnailId}" matched multiple candidate spatial specs.`
      );
    }
    selectedSpatialSpec = byCandidateId[0] ?? null;
  }
  if (!selectedSpatialSpec) {
    throw new Error(`Unable to resolve spatial spec for winning thumbnail "${selectedThumbnailId}".`);
  }

  if (
    selectedSpatialSpec.source_candidate_id &&
    selectedThumbnail.source_candidate_id &&
    selectedSpatialSpec.source_candidate_id !== selectedThumbnail.source_candidate_id
  ) {
    throw new Error(
      `Winning thumbnail "${selectedThumbnailId}" conflicts with its spatial spec candidate lineage.`
    );
  }

  const selectedCandidateId =
    selectedThumbnail.source_candidate_id || selectedSpatialSpec.source_candidate_id;
  const selectedMove = shortlistedCandidates.find(
    (entry) => entry.candidate_id === selectedCandidateId
  );
  if (!selectedMove) {
    throw new Error(
      `Unable to resolve shortlisted candidate "${selectedCandidateId}" for winning thumbnail "${selectedThumbnailId}".`
    );
  }

  const selectedFamily =
    toString(selectedSpatialSpec.selected_family) ||
    toString(selectedMove.family_guess) ||
    toString(familySelection?.selected_family) ||
    "territory comparison";

  return {
    thumbnail: selectedThumbnail,
    spatialSpec: selectedSpatialSpec,
    candidate: selectedMove,
    winnerLineage: {
      thumbnail_id: selectedThumbnail.thumbnail_id,
      spatial_spec_id: selectedSpatialSpec.spatial_spec_id,
      candidate_id: selectedMove.candidate_id,
      family: selectedFamily,
    },
  };
};

const resolveThumbnailGeneratorOrder = ({
  promptPlan,
  generatorPool,
  promptIndex,
}) => {
  if (generatorPool.length <= 1) {
    return generatorPool;
  }
  const target = toString(promptPlan?.generator_target).toLowerCase();
  const explicitTarget = generatorPool.find(
    (worker) =>
      worker.provider_family === target || toString(worker.alias).toLowerCase() === target
  );
  if (explicitTarget) {
    return [
      ...generatorPool.filter((worker) => worker === explicitTarget),
      ...generatorPool.filter((worker) => worker !== explicitTarget),
    ];
  }
  const offset = promptIndex % generatorPool.length;
  return [...generatorPool.slice(offset), ...generatorPool.slice(0, offset)];
};

const buildBuildSpecObject = ({
  packet,
  config,
  selectedMove,
  selectedFamily,
  selectedThumbnailId,
  selectedSpatialSpec,
  aggregateCritique,
  emittedArtifacts,
}) => ({
  metadata: {
    slide_number: packet.slide_metadata.slide_number,
    working_title: packet.slide_metadata.working_title,
    artifact_type: "build-spec",
    version: packet.version,
    status: aggregateCritique.human_review_required ? "needs-review" : "ready-for-build",
  },
  source_artifacts: emittedArtifacts,
  locked_meaning_snapshot: {
    slide_job: packet.locked_meaning.slide_job,
    audience_belief: packet.locked_meaning.audience_should_leave_believing,
    core_claim: packet.locked_meaning.core_claim,
  },
  copy_recommendation: {
    header: packet.slide_copy.compressed.header || packet.slide_copy.text_first.header,
    subheader: packet.slide_copy.compressed.subheader || packet.slide_copy.text_first.support_line,
    panel_labels: toStringArray(packet.figure_copy?.panel_labels),
    figure_labels: toStringArray(packet.figure_copy?.figure_labels),
  },
  selected_candidate_id: selectedMove.candidate_id,
  selected_spatial_spec_id: selectedSpatialSpec.spatial_spec_id,
  selected_figure_move: {
    candidate_id: selectedMove.candidate_id,
    move_name: selectedMove.move_name,
    one_sentence_logic: selectedMove.one_sentence_logic,
  },
  selected_family: selectedFamily,
  selected_thumbnail_id: selectedThumbnailId,
  spatial_spec: {
    visual_anchor: selectedSpatialSpec.visual_anchor,
    viewer_order: selectedSpatialSpec.viewer_order,
    regions: selectedSpatialSpec.regions,
    density_map: selectedSpatialSpec.density_map,
    accent_usage: selectedSpatialSpec.accent_usage,
    text_load: selectedSpatialSpec.text_load,
    figure_load: selectedSpatialSpec.figure_load,
    protected_whitespace: toStringArray(selectedSpatialSpec.regions?.protected_whitespace),
  },
  element_inventory: toStringArray(selectedSpatialSpec.element_inventory),
  keep_remove: safeStructuredClone(selectedSpatialSpec.keep_remove ?? {}),
  critique_summary: {
    winner: selectedThumbnailId,
    why_winner_wins: aggregateCritique.why_winner_wins,
    revision_before_build: winnerRevisions(aggregateCritique, selectedThumbnailId),
    disagreement_score: aggregateCritique.disagreement_score,
    human_review_required: aggregateCritique.human_review_required,
  },
  builder_handoff_notes: [
    packet.assets.editable_source
      ? "Reuse the current editable source where possible."
      : "Rebuild the chosen direction from the selected spatial spec.",
    shouldUseRealCopy({ packet, config })
      ? "Use real locked copy for named figure elements."
      : "Placeholder figure copy may be used where the packet leaves labels unspecified.",
    "V1 auto-promote means internal winner selection only; do not mutate canonical deck state.",
    "Optional structural HTML/SVG thumbnail generation is deferred in v1.",
  ],
  lock_status: aggregateCritique.human_review_required ? "candidate_locked_pending_review" : "candidate_locked",
  still_unresolved: aggregateCritique.acceptance_flags ?? [],
  next_action: aggregateCritique.human_review_required ? "human review" : "build chosen direction",
  version_status: {
    version: packet.version,
    status: aggregateCritique.human_review_required ? "needs-review" : "selected",
    changes_from_previous_version: toStringArray(packet.current_visual_context.change),
  },
});

const winnerRevisions = (aggregateCritique, selectedThumbnailId) =>
  toArray(aggregateCritique.aggregate_scores)
    .find((entry) => entry.thumbnail_id === selectedThumbnailId)
    ?.exact_revisions.filter(Boolean) ?? [];

const renderBuildSpecMarkdown = (buildSpec) =>
  [
    `# Slide ${buildSpec.metadata.slide_number} Build Spec`,
    "",
    `- Working title: ${buildSpec.metadata.working_title}`,
    `- Version: ${buildSpec.metadata.version}`,
    `- Status: ${buildSpec.metadata.status}`,
    "",
    "## Selected move",
    `- Candidate: ${buildSpec.selected_figure_move.candidate_id}`,
    `- Spatial Spec: ${buildSpec.selected_spatial_spec_id}`,
    `- Move: ${buildSpec.selected_figure_move.move_name}`,
    `- Logic: ${buildSpec.selected_figure_move.one_sentence_logic}`,
    `- Family: ${buildSpec.selected_family}`,
    `- Thumbnail: ${buildSpec.selected_thumbnail_id}`,
    "",
    "## Copy recommendation",
    `- Header: ${buildSpec.copy_recommendation.header}`,
    buildSpec.copy_recommendation.subheader
      ? `- Subheader: ${buildSpec.copy_recommendation.subheader}`
      : "",
    ...buildSpec.copy_recommendation.panel_labels.map((label) => `- Panel label: ${label}`),
    ...buildSpec.copy_recommendation.figure_labels.map((label) => `- Figure label: ${label}`),
    "",
    "## Builder notes",
    ...buildSpec.builder_handoff_notes.map((note) => `- ${note}`),
    "",
    "## Structured payload",
    "```json",
    JSON.stringify(buildSpec, null, 2),
    "```",
    "",
  ]
    .filter(Boolean)
    .join("\n");

const buildRunManifestObject = ({
  runId,
  packet,
  config,
  stateTransitions,
  emittedArtifacts,
  selectedCandidateId,
  selectedThumbnailId,
  exitState,
  aggregateCritique,
  retryCounts,
  stageAttempts,
  winnerLineage = null,
  timestampStart,
  timestampEnd,
  deprecationNotes = [],
  notes = [],
}) => ({
  run_id: runId,
  parent_run_id: packet.authoring_context.parent_run_id || undefined,
  timestamp_start: timestampStart,
  timestamp_end: timestampEnd,
  slide_number: packet.slide_metadata.slide_number,
  working_title: packet.slide_metadata.working_title,
  run_mode: packet.run_mode,
  source_artifacts: packet.authoring_context.source_artifacts,
  model_routing: safeStructuredClone(config.model_assignment),
  thresholds: safeStructuredClone(config.thresholds),
  state_transitions: stateTransitions,
  emitted_artifacts: emittedArtifacts,
  selected_candidate_id: selectedCandidateId || "",
  selected_thumbnail_id: selectedThumbnailId || "",
  winner_lineage: winnerLineage ?? undefined,
  exit_state: exitState,
  human_review_required: Boolean(aggregateCritique?.human_review_required),
  reopen_upstream_truth: Boolean(aggregateCritique?.reopen_upstream_truth),
  retry_counts: retryCounts,
  stage_attempts: stageAttempts,
  deprecation_notes: [...new Set(deprecationNotes)],
  notes,
});

const writeArtifactAndTrack = async ({ runDir, emittedArtifacts, absolutePath, value, asText = false }) => {
  if (asText) {
    await writeText(absolutePath, value);
  } else {
    await writeJson(absolutePath, value);
  }
  const relativePath = toRelativeRunPath(runDir, absolutePath);
  if (!emittedArtifacts.includes(relativePath)) {
    emittedArtifacts.push(relativePath);
  }
};

const resolveArtifactNames = ({ packet, config }) => {
  const templateValues = {
    slide_number: packet.slide_metadata.slide_number,
    version: normalizeVersionLabel(packet.version),
  };

  return {
    buildSpec: packet.output_target.build_spec_filename
      ? packet.output_target.build_spec_filename
      : renderTemplate(config.artifact_paths.build_spec, templateValues),
    critiqueReport: packet.output_target.critique_filename
      ? packet.output_target.critique_filename
      : renderTemplate(config.artifact_paths.critique_report, templateValues),
    thumbnailManifest: renderTemplate(config.artifact_paths.thumbnail_manifest, templateValues),
    runManifest: packet.output_target.manifest_filename
      ? packet.output_target.manifest_filename
      : renderTemplate(config.artifact_paths.run_manifest, templateValues),
  };
};

const resolveThumbnailCount = ({ packet, runMode }) =>
  packet.design_constraints.thumbnail_count ||
  MODE_THUMBNAIL_COUNT[runMode] ||
  MODE_THUMBNAIL_COUNT.standard;

const chooseProviders = ({ candidates, services, preferred = [] }) => {
  const preferredSet = new Set(preferred.map((entry) => entry.toLowerCase()));
  const normalized = candidates.filter((entry) => providerIsAvailable(services, entry.provider_family));
  if (preferredSet.size === 0) {
    return normalized;
  }
  const preferredMatches = normalized.filter((entry) =>
    preferredSet.has(entry.provider_family) ||
    preferredSet.has(entry.alias?.toLowerCase()) ||
    preferredSet.has(
      entry.provider_family === "google" ? "google_optional" : entry.provider_family
    )
  );
  return preferredMatches.length > 0 ? preferredMatches : normalized;
};

const buildRunSummary = ({ exitState, runDir, artifactNames }) => {
  const artifactPaths = {
    buildSpec: resolve(runDir, artifactNames.buildSpec),
    critiqueReport: resolve(runDir, artifactNames.critiqueReport),
    thumbnailManifest: resolve(runDir, artifactNames.thumbnailManifest),
    runManifest: resolve(runDir, artifactNames.runManifest),
  };

  return {
    ok: exitState !== "failed",
    exitState,
    dir: runDir,
    artifactPaths,
    buildSpecPath: artifactPaths.buildSpec,
    critiqueReportPath: artifactPaths.critiqueReport,
    thumbnailManifestPath: artifactPaths.thumbnailManifest,
    runManifestPath: artifactPaths.runManifest,
  };
};

const initializeRunDir = async ({ packet, outputDir, profileId, profileData }) => {
  if (outputDir) {
    await mkdir(outputDir, { recursive: true });
    return resolve(outputDir);
  }

  const designerDataPaths = getDesignerDataPaths({
    cwd: process.cwd(),
    env: process.env,
  });
  const projectId = guessProjectId({ packet, profileId, profileData });
  const slug = slugify(
    `${packet.slide_metadata.slide_number}-${packet.slide_metadata.working_title}-${packet.version}`
  );
  const runSlug = createArtifactRunSlug({ slug });
  const baseRunsRoot = resolve(getDesignerProjectRunsRoot(designerDataPaths, projectId), "figure-ideation");
  const runDir = resolve(baseRunsRoot, runSlug);
  await mkdir(runDir, { recursive: true });
  return runDir;
};

const maybeCopyInputFile = async ({ sourcePath, targetPath, fallbackValue }) => {
  if (sourcePath && existsSync(sourcePath)) {
    await mkdir(dirname(targetPath), { recursive: true });
    await copyFile(sourcePath, targetPath);
    return;
  }
  if (fallbackValue !== undefined) {
    await writeText(targetPath, `${JSON.stringify(fallbackValue, null, 2)}\n`);
  }
};

const loadConfig = async ({ configPath, profileId }) => {
  const templateConfig = await parseStructuredFile(CONFIG_TEMPLATE_PATH);
  const profilePath = profileId ? resolve(PROFILE_DIR, `${profileId}.json`) : null;
  const profileData =
    profilePath && existsSync(profilePath) ? await parseStructuredFile(profilePath) : null;
  const userConfig =
    configPath && existsSync(resolve(configPath)) ? await parseStructuredFile(configPath) : {};

  return {
    config: deepMerge(
      deepMerge(templateConfig, DEFAULT_CONFIG_OVERRIDES),
      userConfig
    ),
    profileData,
  };
};

const coerceConfigForPacket = ({ config, packet }) => {
  const nextConfig = deepMerge(config, {});
  nextConfig.run_defaults = {
    ...nextConfig.run_defaults,
    run_mode: computeRecommendedRunMode(packet, nextConfig),
    auto_promote_allowed:
      packet.orchestration_overrides.auto_promote_allowed ??
      nextConfig.run_defaults.auto_promote_allowed,
    human_review_required_by_default:
      packet.orchestration_overrides.human_review_required ??
      nextConfig.run_defaults.human_review_required_by_default,
  };
  nextConfig.model_assignment = {
    ...nextConfig.model_assignment,
    interpretation: {
      mode: toString(nextConfig.model_assignment?.interpretation?.mode) || "deterministic",
      ...nextConfig.model_assignment?.interpretation,
    },
    merge_and_cluster: {
      mode: toString(nextConfig.model_assignment?.merge_and_cluster?.mode) || "deterministic_first",
      ...nextConfig.model_assignment?.merge_and_cluster,
    },
    shortlist_selection: {
      mode: toString(nextConfig.model_assignment?.shortlist_selection?.mode) || "deterministic",
      ...nextConfig.model_assignment?.shortlist_selection,
    },
    figure_family_selection: {
      mode:
        toString(nextConfig.model_assignment?.figure_family_selection?.mode) || "deterministic",
      ...nextConfig.model_assignment?.figure_family_selection,
    },
    packaging: {
      mode: toString(nextConfig.model_assignment?.packaging?.mode) || "deterministic",
      ...nextConfig.model_assignment?.packaging,
    },
    critique: {
      quorum:
        Number(nextConfig.model_assignment?.critique?.quorum ?? 2) || 2,
      ...nextConfig.model_assignment?.critique,
    },
  };
  return nextConfig;
};

const collectConfigDeprecationNotes = (config) => {
  const notes = [];
  const interpretation = config.model_assignment?.interpretation;
  if (interpretation?.primary || interpretation?.fallback) {
    notes.push(
      "model_assignment.interpretation provider routing is deprecated and ignored; interpretation is deterministic."
    );
  }
  const shortlistSelection = config.model_assignment?.shortlist_selection;
  if (shortlistSelection?.primary || shortlistSelection?.fallback) {
    notes.push(
      "model_assignment.shortlist_selection provider routing is deprecated and ignored; shortlist selection is deterministic."
    );
  }
  const familySelection = config.model_assignment?.figure_family_selection;
  if (familySelection?.primary || familySelection?.fallback) {
    notes.push(
      "model_assignment.figure_family_selection provider routing is deprecated and ignored; family selection is deterministic."
    );
  }
  const packaging = config.model_assignment?.packaging;
  if (packaging?.primary || packaging?.fallback) {
    notes.push(
      "model_assignment.packaging provider routing is deprecated and ignored; packaging is deterministic."
    );
  }
  if (config.model_assignment?.merge_and_cluster?.fallback_model) {
    notes.push(
      "model_assignment.merge_and_cluster.fallback_model is deprecated and ignored; merge_and_cluster is deterministic_first."
    );
  }
  if (toArray(config.model_assignment?.thumbnail_generation?.optional_workers).length > 0) {
    notes.push(
      "model_assignment.thumbnail_generation.optional_workers is deprecated and ignored unless implemented explicitly."
    );
  }
  return [...new Set(notes)];
};

const createStateTracker = () => {
  const transitions = [];
  return {
    push(state) {
      if (transitions[transitions.length - 1] === state) {
        return;
      }
      transitions.push(state);
    },
    values() {
      return [...transitions];
    },
  };
};

export const runFigureIdeationFromPacket = async ({
  packet,
  config,
  profileId = null,
  profileData = null,
  runDir,
  services = defaultServices,
  inputPath = null,
  configPath = null,
}) => {
  const normalizedPacket = normalizePacket(packet);
  const resolvedConfig = coerceConfigForPacket({
    config,
    packet: normalizedPacket,
  });
  const deprecationNotes = collectConfigDeprecationNotes(resolvedConfig);
  const artifactNames = resolveArtifactNames({
    packet: normalizedPacket,
    config: resolvedConfig,
  });
  const runId = basename(runDir);
  const timestampStart = new Date().toISOString();
  const emittedArtifacts = [];
  const stageAttempts = [];
  const retryCounts = {
    ideation: 0,
    thumbnails: 0,
    critique: 0,
    full_runs: 0,
    providers: {},
  };

  await maybeCopyInputFile({
    sourcePath: inputPath,
    targetPath: resolve(runDir, "inputs", basename(inputPath || "input-packet.json")),
    fallbackValue: normalizedPacket,
  });
  await maybeCopyInputFile({
    sourcePath: configPath,
    targetPath: resolve(runDir, "inputs", basename(configPath || "run-config.json")),
    fallbackValue: resolvedConfig,
  });
  emittedArtifacts.push(toRelativeRunPath(runDir, resolve(runDir, "inputs", basename(inputPath || "input-packet.json"))));
  emittedArtifacts.push(toRelativeRunPath(runDir, resolve(runDir, "inputs", basename(configPath || "run-config.json"))));
  const finalizeAttempt = async ({
    stateTracker,
    exitState,
    aggregateCritique = null,
    winnerLineage = null,
    selectedCandidateId = "",
    selectedThumbnailId = "",
    notes = [],
    buildSpec = null,
    critiqueReport = null,
    thumbnailManifest = null,
  }) => {
    const timestampEnd = new Date().toISOString();
    if (thumbnailManifest) {
      await writeArtifactAndTrack({
        runDir,
        emittedArtifacts,
        absolutePath: resolve(runDir, artifactNames.thumbnailManifest),
        value: thumbnailManifest,
      });
    }
    if (critiqueReport) {
      await writeArtifactAndTrack({
        runDir,
        emittedArtifacts,
        absolutePath: resolve(runDir, artifactNames.critiqueReport),
        value: critiqueReport,
      });
    }
    if (buildSpec) {
      await writeArtifactAndTrack({
        runDir,
        emittedArtifacts,
        absolutePath: resolve(runDir, artifactNames.buildSpec),
        value: renderBuildSpecMarkdown(buildSpec),
        asText: true,
      });
    }
    const manifest = buildRunManifestObject({
      runId,
      packet: normalizedPacket,
      config: resolvedConfig,
      stateTransitions: stateTracker.values(),
      emittedArtifacts,
      selectedCandidateId,
      selectedThumbnailId,
      exitState,
      aggregateCritique,
      retryCounts,
      stageAttempts,
      winnerLineage,
      timestampStart,
      timestampEnd,
      deprecationNotes,
      notes,
    });
    const manifestValidation = await validateJsonAgainstSchema({
      data: manifest,
      schemaPath: readSchemaPath("run-manifest.schema.json"),
      label: "run-manifest",
    });
    if (!manifestValidation.ok) {
      throw new Error(manifestValidation.message);
    }
    await writeArtifactAndTrack({
      runDir,
      emittedArtifacts,
      absolutePath: resolve(runDir, artifactNames.runManifest),
      value: manifest,
    });
    return {
      ...buildRunSummary({ exitState, runDir, artifactNames }),
      runManifest: manifest,
      buildSpec,
      critiqueReport,
      thumbnailManifest,
    };
  };

  const runAttempt = async (fullRunAttempt) => {
    const stateTracker = createStateTracker();
    stateTracker.push("received");

    const validation = await validateFigureIdeationPacket({
      packet: normalizedPacket,
      config: resolvedConfig,
      profileData,
    });
    const validationPath = resolve(
      resolveStageDir(runDir, 1, "validation", fullRunAttempt),
      "validation.json"
    );
    await writeArtifactAndTrack({
      runDir,
      emittedArtifacts,
      absolutePath: validationPath,
      value: validation,
    });
    if (!validation.valid) {
      stateTracker.push("failed");
      return finalizeAttempt({
        stateTracker,
        exitState: "failed",
        notes: validation.hard_errors,
      });
    }

    stateTracker.push("validated");

    const normalizedBrief = buildNormalizedBrief({
      packet: normalizedPacket,
      validation,
    });
    const normalizedBriefPath = resolve(
      resolveStageDir(runDir, 2, "normalized-brief", fullRunAttempt),
      "normalized-brief.json"
    );
    await writeArtifactAndTrack({
      runDir,
      emittedArtifacts,
      absolutePath: normalizedBriefPath,
      value: normalizedBrief,
    });
    if (
      normalizedBrief.interpretation_confidence <
      resolvedConfig.thresholds.min_interpretation_confidence
    ) {
      stateTracker.push("failed");
      return finalizeAttempt({
        stateTracker,
        exitState: "failed",
        notes: ["interpretation_confidence below threshold"],
      });
    }

    const figureBrief = buildFigureBrief({
      packet: normalizedPacket,
      normalizedBrief,
    });
    const figureBriefPath = resolve(
      resolveStageDir(runDir, 3, "figure-brief", fullRunAttempt),
      "figure-brief.json"
    );
    await writeArtifactAndTrack({
      runDir,
      emittedArtifacts,
      absolutePath: figureBriefPath,
      value: figureBrief,
    });
    stateTracker.push("normalized");

    const ideatorCandidates = chooseProviders({
      candidates: [
        ...toArray(resolvedConfig.model_assignment?.figure_move_search?.required_workers),
        ...toArray(resolvedConfig.model_assignment?.figure_move_search?.optional_workers),
      ],
      services,
      preferred: normalizedPacket.provider_preferences.text_ideators,
    });
    const requiredIdeators = Math.max(
      2,
      normalizedPacket.orchestration_overrides.ideator_worker_count ||
        toArray(resolvedConfig.model_assignment?.figure_move_search?.required_workers).length ||
        2
    );
    const activeIdeators = ideatorCandidates.slice(0, requiredIdeators);
    if (activeIdeators.length === 0) {
      stateTracker.push("failed");
      return finalizeAttempt({
        stateTracker,
        exitState: "failed",
        notes: ["No ideator providers are available."],
      });
    }

    const candidateCountPerWorker = Math.max(
      4,
      Math.min(
        8,
        Math.ceil(
          normalizedPacket.design_constraints.max_candidates / Math.max(1, activeIdeators.length)
        ) + 2
      )
    );

    const runIdeationPass = async (diversityPass = false) => {
      const results = await Promise.all(
        activeIdeators.map(async (worker, index) => {
          try {
            const prompt = await buildIdeationPrompt({
              packet: normalizedPacket,
              normalizedBrief,
              figureBrief,
              count: candidateCountPerWorker,
              diversityPass,
            });
            const result = await executeProviderActionChain({
              providers: [worker],
              stage: "figure_move_search",
              stageId: 4,
              stageName: "ideation",
              runDir,
              services,
              fullRunAttempt,
              retryPolicy: resolvedConfig.retry_policy,
              retryCounts,
              stageAttempts,
              action: async ({ providerFamily, stageDir }) =>
                services.runStageModel({
                  providerFamily,
                  prompt,
                  schemaPath: readSchemaPath("figure-move-ideator-output.schema.json"),
                  stageDir,
                  purpose: "text",
                }),
            });
            return toArray(result.data).map((candidate, candidateIndex) =>
              normalizeCandidate(candidate, result.providerAlias, candidateIndex)
            );
          } catch (_error) {
            return [];
          }
        })
      );
      return results.flat();
    };

    let rawCandidates = await runIdeationPass(false);
    let candidatePool = mergeAndClusterCandidates({ rawCandidates });
    let ideationStageReruns = 0;
    while (
      candidatePool.diversity_score < resolvedConfig.thresholds.min_candidate_diversity &&
      ideationStageReruns < Number(resolvedConfig.retry_policy?.max_stage_reruns ?? 0)
    ) {
      retryCounts.ideation += 1;
      stateTracker.push("retry_ideation");
      ideationStageReruns += 1;
      rawCandidates = rawCandidates.concat(await runIdeationPass(true));
      candidatePool = mergeAndClusterCandidates({ rawCandidates });
    }

    const candidatePoolPath = resolve(
      resolveStageDir(runDir, 5, "candidate-pool", fullRunAttempt),
      "candidate-pool.json"
    );
    await writeArtifactAndTrack({
      runDir,
      emittedArtifacts,
      absolutePath: candidatePoolPath,
      value: candidatePool,
    });

    if (
      rawCandidates.length === 0 ||
      candidatePool.diversity_score < resolvedConfig.thresholds.min_candidate_diversity
    ) {
      stateTracker.push("retry_ideation");
      return finalizeAttempt({
        stateTracker,
        exitState: "retry_ideation",
        notes: ["Candidate diversity remained below threshold after retry budget."],
      });
    }

    stateTracker.push("ideated");

    const shortlist = shortlistCandidates({
      candidatePool,
      packet: normalizedPacket,
      config: resolvedConfig,
    });
    const shortlistPath = resolve(
      resolveStageDir(runDir, 6, "shortlist", fullRunAttempt),
      "shortlist.json"
    );
    await writeArtifactAndTrack({
      runDir,
      emittedArtifacts,
      absolutePath: shortlistPath,
      value: shortlist,
    });
    if (shortlist.shortlist.length === 0) {
      stateTracker.push("retry_ideation");
      return finalizeAttempt({
        stateTracker,
        exitState: "retry_ideation",
        notes: ["No viable candidates survived shortlist thresholds."],
      });
    }

    stateTracker.push("shortlisted");

    const familySelection = selectFigureFamily({
      shortlist: shortlist.shortlist,
    });
    const familySelectionPath = resolve(
      resolveStageDir(runDir, 7, "family-selection", fullRunAttempt),
      "family-selection.json"
    );
    await writeArtifactAndTrack({
      runDir,
      emittedArtifacts,
      absolutePath: familySelectionPath,
      value: familySelection,
    });

    const spatializationProviders = parseSingleStageRouting({
      section: resolvedConfig.model_assignment?.spatialization,
      stageKey: "spatialization",
      deprecationNotes,
    });
    const spatializerPrompt = await buildSpatializerPrompt({
      packet: normalizedPacket,
      normalizedBrief,
      figureBrief,
      shortlist: shortlist.shortlist,
      familySelection,
      config: resolvedConfig,
    });
    const spatializerResult = await executeProviderActionChain({
      providers: spatializationProviders,
      stage: "spatialization",
      stageId: 8,
      stageName: "spatialization",
      runDir,
      services,
      fullRunAttempt,
      retryPolicy: resolvedConfig.retry_policy,
      retryCounts,
      stageAttempts,
      action: async ({ providerFamily, stageDir }) =>
        services.runStageModel({
          providerFamily,
          prompt: spatializerPrompt,
          schemaPath: readSchemaPath("spatial-spec.schema.json"),
          stageDir,
          purpose: "text",
        }),
    });
    const spatialSpec = spatializerResult.data;
    const spatialSpecPath = resolve(
      resolveStageDir(runDir, 8, "spatialization", fullRunAttempt),
      "spatial-spec.json"
    );
    await writeArtifactAndTrack({
      runDir,
      emittedArtifacts,
      absolutePath: spatialSpecPath,
      value: spatialSpec,
    });
    stateTracker.push("spatialized");

    const thumbnailCount = resolveThumbnailCount({
      packet: normalizedPacket,
      runMode: normalizedPacket.run_mode,
    });
    const thumbnailPromptProviders = parseSingleStageRouting({
      section: resolvedConfig.model_assignment?.thumbnail_prompt_builder,
      stageKey: "thumbnail_prompt_builder",
      deprecationNotes,
    });
    const generatorPool = chooseProviders({
      candidates: toArray(resolvedConfig.model_assignment?.thumbnail_generation?.required_workers),
      services,
      preferred: normalizedPacket.provider_preferences.image_generators,
    }).slice(
      0,
      normalizedPacket.orchestration_overrides.generator_worker_count ||
        toArray(resolvedConfig.model_assignment?.thumbnail_generation?.required_workers).length ||
        2
    );

    const buildThumbnailStage = async () => {
      const thumbnailPromptResult = await executeProviderActionChain({
        providers: thumbnailPromptProviders,
        stage: "thumbnail_prompt_builder",
        stageId: 9,
        stageName: "thumbnail-prompts",
        runDir,
        services,
        fullRunAttempt,
        retryPolicy: resolvedConfig.retry_policy,
        retryCounts,
        stageAttempts,
        action: async ({ providerFamily, stageDir }) =>
          services.runStageModel({
            providerFamily,
            prompt: await buildThumbnailPromptBuilderPrompt({
              packet: normalizedPacket,
              normalizedBrief,
              figureBrief,
              spatialSpec,
              thumbnailCount,
              config: resolvedConfig,
            }),
            schemaPath: readSchemaPath("thumbnail-prompt-output.schema.json"),
            stageDir,
            purpose: "text",
          }),
      });
      const thumbnailPromptPayload = normalizeThumbnailPrompts(thumbnailPromptResult.data);

      const thumbnails = [];
      const promptGroups = thumbnailPromptPayload.thumbnail_prompts.slice(0, thumbnailCount);
      for (const [promptIndex, promptPlan] of promptGroups.entries()) {
        const orderedGenerators = resolveThumbnailGeneratorOrder({
          promptPlan,
          generatorPool,
          promptIndex,
        });
        try {
          const imageResult = await executeProviderActionChain({
            providers: orderedGenerators,
            stage: "thumbnail_generation",
            stageId: 10,
            stageName: "thumbnails",
            runDir,
            services,
            fullRunAttempt,
            retryPolicy: resolvedConfig.retry_policy,
            retryCounts,
            stageAttempts,
            action: async ({ providerFamily, stageDir }) =>
              services.generateImage({
                providerFamily,
                prompt: promptPlan.prompt_text,
                outDir: resolve(stageDir, promptPlan.thumbnail_prompt_id),
                referenceImages: normalizedPacket.assets.reference_images,
              }),
          });
          thumbnails.push({
            thumbnail_id: promptPlan.thumbnail_prompt_id.replace("thumbnail-prompt", "thumbnail"),
            source_candidate_id: promptPlan.source_candidate_id,
            source_spatial_spec_id: promptPlan.source_spatial_spec_id,
            generator_target: imageResult.providerFamily,
            file_path: imageResult.filePath,
            prompt_hash: sha1(promptPlan.prompt_text),
            description: promptPlan.prompt_text,
            what_viewer_sees_first: promptPlan.prompt_text.split(".")[0],
            variation_dimension: promptPlan.expected_variation_dimension,
            copy_mode: promptPlan.whether_copy_is_real_or_placeholder,
            image_mode: promptPlan.whether_images_are_literal_or_abstract,
          });
        } catch (_error) {
          // fall through to fallback stage below
        }
      }

      if (thumbnails.length < 3) {
        const fallbackProviders = ["openai", "anthropic", "google"]
          .filter((providerFamily) => providerIsAvailable(services, providerFamily))
          .map((providerFamily) => ({
            alias: `${providerFamily}-thumbnail-fallback`,
            provider_family: providerFamily,
            task: "text_thumbnail_fallback",
          }));
        const fallbackReport = await executeProviderActionChain({
          providers: fallbackProviders,
          stage: "thumbnail_fallback",
          stageId: 10,
          stageName: "thumbnails",
          runDir,
          services,
          fullRunAttempt,
          retryPolicy: resolvedConfig.retry_policy,
          retryCounts,
          stageAttempts,
          action: async ({ providerFamily, stageDir }) =>
            services.runStageModel({
              providerFamily,
              prompt: await buildThumbnailFallbackPrompt({
                packet: normalizedPacket,
                normalizedBrief,
                spatialSpec,
                thumbnailCount: Math.max(3, thumbnailCount),
                config: resolvedConfig,
              }),
              stageDir: resolve(stageDir, "fallback-text"),
              purpose: "text",
            }),
        });
        const fallbackEntries = toArray(fallbackReport.data).map((entry, index) => ({
          thumbnail_id:
            toString(entry?.thumbnail_id) ||
            `thumbnail-text-${String(index + 1).padStart(2, "0")}`,
          source_candidate_id:
            toString(entry?.linked_candidate_id) ||
            spatialSpec.spatial_specs?.[0]?.source_candidate_id ||
            "",
          source_spatial_spec_id: spatialSpec.spatial_specs?.[0]?.spatial_spec_id || "",
          generator_target: "text_fallback",
          prompt_hash: sha1(JSON.stringify(entry)),
          description: toString(entry?.one_sentence_description),
          what_viewer_sees_first: toString(entry?.what_the_viewer_sees_first),
          variation_dimension:
            toString(entry?.rough_layout_summary) || "structural fallback",
          copy_mode: shouldUseRealCopy({ packet: normalizedPacket, config: resolvedConfig })
            ? "real"
            : "placeholder",
          image_mode: "textual",
        }));
        thumbnails.push(...fallbackEntries);
      }

      return {
        thumbnailPromptPayload,
        thumbnailManifest: {
          thumbnails: thumbnails.slice(0, Math.max(3, thumbnailCount)),
          diversity_score: Number(
            (
              new Set(thumbnails.map((entry) => slugify(entry.variation_dimension))).size /
              Math.max(1, thumbnails.length)
            ).toFixed(3)
          ),
        },
      };
    };

    let thumbnailManifest = null;
    let thumbnailPromptPayload = null;
    let thumbnailStageReruns = 0;
    while (true) {
      try {
        const result = await buildThumbnailStage();
        thumbnailPromptPayload = result.thumbnailPromptPayload;
        thumbnailManifest = result.thumbnailManifest;
      } catch (_error) {
        thumbnailManifest = null;
      }

      if (
        thumbnailManifest &&
        thumbnailManifest.thumbnails.length >= 3 &&
        thumbnailManifest.diversity_score >= resolvedConfig.thresholds.min_thumbnail_diversity
      ) {
        break;
      }
      if (thumbnailStageReruns >= Number(resolvedConfig.retry_policy?.max_stage_reruns ?? 0)) {
        stateTracker.push("retry_thumbnails");
        return finalizeAttempt({
          stateTracker,
          exitState: "retry_thumbnails",
          selectedCandidateId: shortlist.shortlist[0]?.candidate_id ?? "",
          notes: ["Thumbnail generation exhausted its retry budget."],
          thumbnailManifest,
        });
      }
      retryCounts.thumbnails += 1;
      thumbnailStageReruns += 1;
      stateTracker.push("retry_thumbnails");
    }

    const thumbnailManifestPath = resolve(runDir, artifactNames.thumbnailManifest);
    await writeArtifactAndTrack({
      runDir,
      emittedArtifacts,
      absolutePath: thumbnailManifestPath,
      value: thumbnailManifest,
    });
    stateTracker.push("thumbnailed");

    const criticWorkers = chooseProviders({
      candidates: toArray(resolvedConfig.model_assignment?.critique?.required_workers),
      services,
      preferred: normalizedPacket.provider_preferences.vision_critics,
    }).slice(
      0,
      normalizedPacket.orchestration_overrides.critic_worker_count ||
        toArray(resolvedConfig.model_assignment?.critique?.required_workers).length ||
        3
    );
    const criticQuorum = Math.min(
      Number(resolvedConfig.model_assignment?.critique?.quorum ?? 2) || 2,
      Math.max(1, criticWorkers.length)
    );
    if (criticWorkers.length === 0) {
      stateTracker.push("failed");
      return finalizeAttempt({
        stateTracker,
        exitState: "failed",
        notes: ["No critique providers are available."],
        thumbnailManifest,
      });
    }

    const criticReports = [];
    let pendingCritics = [...criticWorkers];
    let critiqueStageReruns = 0;
    while (
      pendingCritics.length > 0 &&
      critiqueStageReruns <= Number(resolvedConfig.retry_policy?.max_stage_reruns ?? 0) &&
      criticReports.length < criticQuorum
    ) {
      const nextPending = [];
      for (const worker of pendingCritics) {
        try {
          const result = await executeProviderActionChain({
            providers: [worker],
            stage: "critique",
            stageId: 11,
            stageName: "critique",
            runDir,
            services,
            fullRunAttempt,
            retryPolicy: resolvedConfig.retry_policy,
            retryCounts,
            stageAttempts,
            action: async ({ providerFamily, stageDir }) =>
              services.runStageModel({
                providerFamily,
                prompt: await buildCriticPrompt({
                  packet: normalizedPacket,
                  normalizedBrief,
                  figureBrief,
                  thumbnails: thumbnailManifest.thumbnails,
                }),
                schemaPath: readSchemaPath("vision-critic-output.schema.json"),
                stageDir,
                purpose: "vision",
                imagePaths: thumbnailManifest.thumbnails
                  .map((thumbnail) => thumbnail.file_path)
                  .filter(Boolean),
              }),
          });
          criticReports.push({
            provider: result.providerFamily,
            provider_alias: result.providerAlias,
            ...normalizeCriticReport(result.data),
          });
        } catch (_error) {
          nextPending.push(worker);
        }
      }
      if (criticReports.length >= criticQuorum || nextPending.length === 0) {
        break;
      }
      retryCounts.critique += 1;
      critiqueStageReruns += 1;
      pendingCritics = nextPending;
    }

    if (criticReports.length === 0) {
      stateTracker.push("failed");
      return finalizeAttempt({
        stateTracker,
        exitState: "failed",
        notes: ["Critique stage produced no successful critic reports."],
        thumbnailManifest,
      });
    }

    const aggregateCritiqueBase = aggregateCritiqueReports({
      criticReports,
      thumbnails: thumbnailManifest.thumbnails,
      config: resolvedConfig,
      acceptanceFlags: [],
      criticQuorum,
      humanReviewRequiredByDefault: resolvedConfig.run_defaults.human_review_required_by_default,
      autoPromoteAllowed: resolvedConfig.run_defaults.auto_promote_allowed,
    });
    let winnerResolution;
    try {
      winnerResolution = resolveWinnerLineage({
        thumbnailManifest,
        spatialSpec,
        shortlist,
        aggregateCritique: aggregateCritiqueBase,
        familySelection,
      });
    } catch (error) {
      stateTracker.push("failed");
      return finalizeAttempt({
        stateTracker,
        exitState: "failed",
        notes: [error instanceof Error ? error.message : String(error)],
        thumbnailManifest,
      });
    }

    const acceptanceFlags = detectAcceptanceFlags({
      packet: normalizedPacket,
      profileData,
      selectedMove: winnerResolution.candidate,
      selectedThumbnail: winnerResolution.thumbnail,
    });
    const aggregateCritique = aggregateCritiqueReports({
      criticReports,
      thumbnails: thumbnailManifest.thumbnails,
      config: resolvedConfig,
      acceptanceFlags,
      criticQuorum,
      humanReviewRequiredByDefault: resolvedConfig.run_defaults.human_review_required_by_default,
      autoPromoteAllowed: resolvedConfig.run_defaults.auto_promote_allowed,
    });

    const critiqueReport = {
      slide_number: normalizedPacket.slide_metadata.slide_number,
      version: normalizedPacket.version,
      thumbnail_reports: criticReports,
      aggregate_scores: aggregateCritique.aggregate_scores,
      disagreement_score: aggregateCritique.disagreement_score,
      critic_quorum: criticQuorum,
      critics_completed: criticReports.length,
      winner: aggregateCritique.winner,
      why_winner_wins: aggregateCritique.why_winner_wins,
      human_review_required: aggregateCritique.human_review_required,
      reopen_upstream_truth: aggregateCritique.reopen_upstream_truth,
      retry_thumbnails: aggregateCritique.retry_thumbnails,
      next_action: aggregateCritique.next_action,
    };
    const critiqueReportPath = resolve(runDir, artifactNames.critiqueReport);
    await writeArtifactAndTrack({
      runDir,
      emittedArtifacts,
      absolutePath: critiqueReportPath,
      value: critiqueReport,
    });
    stateTracker.push("critiqued");

    let exitState = "packaged";
    if (aggregateCritique.reopen_upstream_truth) {
      exitState = "reopen_upstream_truth";
    } else if (aggregateCritique.human_review_required) {
      exitState = "human_review_required";
    } else if (aggregateCritique.retry_thumbnails) {
      exitState = "retry_thumbnails";
    }

    if (exitState === "reopen_upstream_truth") {
      stateTracker.push("reopen_upstream_truth");
    } else if (exitState === "human_review_required") {
      stateTracker.push("human_review_required");
    } else if (exitState === "retry_thumbnails") {
      stateTracker.push("retry_thumbnails");
    }

    let buildSpec = null;
    if (exitState === "packaged" || exitState === "human_review_required") {
      buildSpec = buildBuildSpecObject({
        packet: normalizedPacket,
        config: resolvedConfig,
        selectedMove: winnerResolution.candidate,
        selectedFamily: winnerResolution.winnerLineage.family,
        selectedThumbnailId: winnerResolution.winnerLineage.thumbnail_id,
        selectedSpatialSpec: winnerResolution.spatialSpec,
        aggregateCritique,
        emittedArtifacts,
      });
      const buildSpecJsonPath = resolve(
        resolveStageDir(runDir, 12, "packaging", fullRunAttempt),
        "build-spec.json"
      );
      const buildSpecValidation = await validateJsonAgainstSchema({
        data: buildSpec,
        schemaPath: readSchemaPath("build-spec-output.schema.json"),
        label: "build-spec",
      });
      if (!buildSpecValidation.ok) {
        throw new Error(buildSpecValidation.message);
      }
      await writeArtifactAndTrack({
        runDir,
        emittedArtifacts,
        absolutePath: buildSpecJsonPath,
        value: buildSpec,
      });
      await writeArtifactAndTrack({
        runDir,
        emittedArtifacts,
        absolutePath: resolve(runDir, artifactNames.buildSpec),
        value: renderBuildSpecMarkdown(buildSpec),
        asText: true,
      });
    }

    if (exitState === "packaged") {
      stateTracker.push("packaged");
    }

    return finalizeAttempt({
      stateTracker,
      exitState,
      aggregateCritique,
      winnerLineage: winnerResolution.winnerLineage,
      selectedCandidateId: winnerResolution.winnerLineage.candidate_id,
      selectedThumbnailId: winnerResolution.winnerLineage.thumbnail_id,
      notes: [
        ...acceptanceFlags,
        ...(criticReports.length < criticQuorum
          ? [`Critique quorum unmet: ${criticReports.length}/${criticQuorum}.`]
          : []),
      ],
      buildSpec,
      critiqueReport,
      thumbnailManifest,
    });
  };

  const maxFullRunAttempts = Math.max(
    1,
    Number(resolvedConfig.retry_policy?.max_full_run_retries ?? 0) + 1
  );
  let result = null;
  for (let fullRunAttempt = 1; fullRunAttempt <= maxFullRunAttempts; fullRunAttempt += 1) {
    if (fullRunAttempt > 1) {
      retryCounts.full_runs += 1;
    }
    result = await runAttempt(fullRunAttempt);
    if (
      !["retry_ideation", "retry_thumbnails"].includes(result.exitState) ||
      fullRunAttempt === maxFullRunAttempts
    ) {
      return result;
    }
  }

  return result;
};

export const runFigureIdeation = async ({
  inputPath,
  configPath = null,
  profile = null,
  outputDir = null,
  services = defaultServices,
}) => {
  if (!inputPath) {
    throw new Error("Missing --input path.");
  }

  const packet = await parseStructuredFile(inputPath);
  const { config, profileData } = await loadConfig({
    configPath,
    profileId: profile,
  });
  const runDir = await initializeRunDir({
    packet,
    outputDir,
    profileId: profile,
    profileData,
  });
  return runFigureIdeationFromPacket({
    packet,
    config,
    profileId: profile,
    profileData,
    runDir,
    services,
    inputPath,
    configPath,
  });
};

export const getFigureIdeationSpecRoot = () => IDEATION_SYSTEM_ROOT;
export const getDefaultFigureIdeationConfigPath = () => CONFIG_TEMPLATE_PATH;
