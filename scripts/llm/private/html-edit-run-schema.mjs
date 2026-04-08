const RUN_STATUS = [
  "running",
  "needs-codex-review",
  "succeeded",
  "failed",
  "needs-human",
];

const SLOT_STATUS = [
  "queued",
  "generated",
  "render_failed",
  "prefilter_failed",
  "judged_retry",
  "judged_pass",
  "blocked",
  "escalated",
];

const ROUND_STATUS = ["queued", "running", "completed"];

export const DEFAULT_HTML_EDIT_PROVIDERS = ["openai", "gemini"];
export const DEFAULT_HTML_EDIT_MODE = "repair";
export const DEFAULT_HTML_EDIT_SURFACE = "gemini-html";
export const DEFAULT_TARGET_PASS_COUNT = 1;
export const DEFAULT_MAX_ROUNDS = 4;
export const DEFAULT_MAX_SLOT_ATTEMPTS = 3;
export const DEFAULT_RENDER_CONCURRENCY = 2;
export const DEFAULT_JUDGE_CONCURRENCY = 6;
export const DEFAULT_GENERATION_CONCURRENCY = 4;
export const DEFAULT_PROVIDER_IN_FLIGHT_CAP = 2;
export const DEFAULT_SLOTS_PER_PROVIDER = 2;

const EDIT_SLOT_VARIATIONS = {
  "openai-a": "Preserve structure aggressively and make the narrowest valid delta.",
  "openai-b":
    "Preserve family continuity but allow a stronger expression of the requested delta.",
  "gemini-a": "Prioritize unmistakable visual clarity of the requested delta.",
  "gemini-b": "Prioritize polish and composition balance while still satisfying the delta.",
};

const CREATE_SLOT_VARIATIONS = {
  "openai-a":
    "Preserve the locked shell and realize the slide brief with the narrowest valid composition.",
  "openai-b":
    "Preserve the shell but allow a bolder editorial composition if it strengthens the slide brief.",
  "gemini-a":
    "Prioritize clear first-pass communication of the slide thesis inside the locked shell.",
  "gemini-b":
    "Prioritize polish, hierarchy, and family continuity while fully resolving the blank shell.",
};

const CREATE_EXPLORE_SLOT_VARIATIONS = {
  "openai-a":
    "Keep the shell stable while testing a disciplined alternative composition for the same slide brief.",
  "openai-b":
    "Allow a stronger editorial reframe inside the same shell if it still lands the locked slide claim.",
  "gemini-a":
    "Explore a sharper figure/object choice while staying recognizably in-family with the deck shell.",
  "gemini-b":
    "Explore a more expressive first-pass composition, but keep the shell, copy burden, and deck tone intact.",
};

export const isValidRunStatus = (value) => RUN_STATUS.includes(String(value));
export const isValidSlotStatus = (value) => SLOT_STATUS.includes(String(value));
export const isValidRoundStatus = (value) => ROUND_STATUS.includes(String(value));

const pad = (value) => String(value).padStart(2, "0");

export const createHtmlEditRunId = (date = new Date()) => {
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hour = pad(date.getUTCHours());
  const minute = pad(date.getUTCMinutes());
  const second = pad(date.getUTCSeconds());
  return `run-${year}${month}${day}-${hour}${minute}${second}-html-edit`;
};

export const roundDirName = (roundNumber) =>
  `round-${String(Number(roundNumber)).padStart(2, "0")}`;

export const slotDirName = (slotId) => `slot-${String(slotId).trim()}`;

export const normalizeProviders = (providers = DEFAULT_HTML_EDIT_PROVIDERS) =>
  [...new Set((Array.isArray(providers) ? providers : String(providers).split(","))
    .map((value) => String(value).trim().toLowerCase())
    .filter(Boolean))];

const slotSuffixes = ["a", "b", "c", "d", "e", "f"];

export const buildDefaultSlotIds = ({
  providers = DEFAULT_HTML_EDIT_PROVIDERS,
  slotsPerProvider = DEFAULT_SLOTS_PER_PROVIDER,
}) =>
  normalizeProviders(providers).flatMap((provider) =>
    slotSuffixes
      .slice(0, Number(slotsPerProvider))
      .map((suffix) => `${provider}-${suffix}`)
  );

export const getSlotVariationNote = (slotId, options = {}) => {
  const normalizedSlotId = String(slotId).trim();
  const runType = String(options?.runType ?? "edit").trim().toLowerCase();
  const mode = String(options?.mode ?? DEFAULT_HTML_EDIT_MODE).trim().toLowerCase();
  const variationMap =
    runType === "create"
      ? mode === "explore"
        ? CREATE_EXPLORE_SLOT_VARIATIONS
        : CREATE_SLOT_VARIATIONS
      : EDIT_SLOT_VARIATIONS;
  return (
    variationMap[normalizedSlotId] ??
    (runType === "create"
      ? "Preserve the shell and resolve the slide brief without unnecessary drift."
      : "Preserve the family and satisfy the requested change without unnecessary drift.")
  );
};

export const buildHtmlEditRunConfig = ({
  providers = DEFAULT_HTML_EDIT_PROVIDERS,
  slotsPerProvider = DEFAULT_SLOTS_PER_PROVIDER,
  targetPassCount = DEFAULT_TARGET_PASS_COUNT,
  maxRounds = DEFAULT_MAX_ROUNDS,
  maxSlotAttempts = DEFAULT_MAX_SLOT_ATTEMPTS,
  renderConcurrency = DEFAULT_RENDER_CONCURRENCY,
  judgeConcurrency = DEFAULT_JUDGE_CONCURRENCY,
  generationConcurrency = DEFAULT_GENERATION_CONCURRENCY,
  perProviderInFlightCap = DEFAULT_PROVIDER_IN_FLIGHT_CAP,
} = {}) => ({
  providers: normalizeProviders(providers),
  slotsPerProvider: Number(slotsPerProvider),
  targetPassCount: Number(targetPassCount),
  maxRounds: Number(maxRounds),
  maxSlotAttempts: Number(maxSlotAttempts),
  renderConcurrency: Number(renderConcurrency),
  judgeConcurrency: Number(judgeConcurrency),
  generationConcurrency: Number(generationConcurrency),
  perProviderInFlightCap: Number(perProviderInFlightCap),
});

export const createEmptyRunMetrics = () => ({
  generationCalls: 0,
  judgeCalls: 0,
  renderCalls: 0,
  prefilterRejects: 0,
  timingsMs: {
    generation: 0,
    render: 0,
    judging: 0,
    synthesis: 0,
  },
});

export const RUN_STATUS_VALUES = RUN_STATUS;
export const SLOT_STATUS_VALUES = SLOT_STATUS;
export const ROUND_STATUS_VALUES = ROUND_STATUS;
