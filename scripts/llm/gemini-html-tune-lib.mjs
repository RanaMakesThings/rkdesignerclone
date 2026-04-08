import { existsSync } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { readJson, writeJson } from "../figures/lib/io.mjs";
import { promoteVersionContextPath } from "../figures/lib/slide-versioning.mjs";
import { captureHtmlScreenshot } from "../utils/html-screenshot-lib.mjs";
import {
  DEFAULT_GEMINI_TEXT_MODEL,
  DEFAULT_GEMINI_TEXT_TEMPERATURE,
  generateGeminiText,
} from "./gemini-text-client.mjs";
import {
  runClaudeHtmlDeltaJudge,
  runClaudeHtmlRegressionReview,
  runOpenAIHtmlDeltaJudge,
  runOpenAIHtmlRegressionReview,
} from "./private/html-delta-judge.mjs";
import {
  buildCodexMicroReviewTemplate,
  checkHtmlStaticSanity,
  computeTextSha256,
  parseCodexMicroReview,
} from "./private/html-tune-state.mjs";
import { buildRequestDoc, buildResultDoc, writeJsonDoc } from "./artifact-contract.mjs";

const REQUIRED_ARTIFACTS = ["generated.html", "prompt.txt"];
const CHANGE_HEADINGS = [
  "Requested change",
  "Success checks",
  "Guardrails",
];

const normalizeText = (value) => String(value ?? "").replace(/\r\n/g, "\n").trim();

const ensureDirArtifacts = (dir) => {
  const missing = REQUIRED_ARTIFACTS.filter((name) => !existsSync(resolve(dir, name)));
  if (
    !existsSync(resolve(dir, "request.json")) &&
    !existsSync(resolve(dir, "meta.json"))
  ) {
    missing.push("request.json");
  }
  if (missing.length > 0) {
    throw new Error(
      `Gemini HTML tune requires generated.html, prompt.txt, and request.json (or legacy meta.json) under ${dir}. Missing: ${missing.join(", ")}.`
    );
  }
};

const resolveRequestDocPath = (dir) => {
  const requestPath = resolve(dir, "request.json");
  if (existsSync(requestPath)) {
    return requestPath;
  }
  return resolve(dir, "meta.json");
};

const readRequestDoc = async (dir) => readJson(resolveRequestDocPath(dir));

const sectionRegex = (heading, nextHeading) =>
  new RegExp(
    `(?:^|\\n)##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+${nextHeading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n|$)`,
    "i"
  );

const extractSection = (text, heading, nextHeading = null) => {
  const normalized = normalizeText(text);
  const pattern = nextHeading
    ? sectionRegex(heading, nextHeading)
    : new RegExp(
        `(?:^|\\n)##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n([\\s\\S]*)$`,
        "i"
      );
  const match = normalized.match(pattern);
  return match?.[1] ? match[1].trim() : "";
};

export const parseChangeRequestText = (text) => {
  const requestedChange = extractSection(
    text,
    CHANGE_HEADINGS[0],
    CHANGE_HEADINGS[1]
  );
  const successChecks = extractSection(
    text,
    CHANGE_HEADINGS[1],
    CHANGE_HEADINGS[2]
  );
  const guardrails = extractSection(text, CHANGE_HEADINGS[2]);

  if (!requestedChange || !successChecks) {
    throw new Error(
      "Change file must include `## Requested change` and `## Success checks` sections."
    );
  }

  return {
    requestedChange,
    successChecks,
    guardrails,
  };
};

export const buildRepairPrompt = ({
  originalPrompt,
  requestedChange,
  successChecks,
  guardrails = "",
  previousMissSummary = "",
}) =>
  [
    "You are revising an existing self-contained HTML deck graphic.",
    "Keep the overall figure family and structure stable unless the requested change explicitly requires otherwise.",
    "Return HTML only. No markdown, prose, or code fences.",
    "Make the requested delta clearly visible in the new render while preserving unrelated working parts of the existing graphic.",
    "",
    "## Original generation prompt",
    normalizeText(originalPrompt),
    "",
    "## Requested change",
    normalizeText(requestedChange),
    "",
    "## Success checks",
    normalizeText(successChecks),
    "",
    "## Guardrails",
    normalizeText(guardrails) || "None.",
    previousMissSummary
      ? [
          "",
          "## What the previous attempt still missed",
          normalizeText(previousMissSummary),
        ].join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n");

export const summarizeJudgeMiss = (judge) => {
  const parts = [];
  if (judge.summary) {
    parts.push(judge.summary);
  }
  if (judge.evidence.length > 0) {
    parts.push(`Evidence: ${judge.evidence.join("; ")}`);
  }
  if (judge.nextPrompt) {
    parts.push(`Suggested retry wording: ${judge.nextPrompt}`);
  }
  return parts.join("\n");
};

const buildCombinedMissSummary = ({ gptJudge, claudeJudge }) =>
  [
    gptJudge.status !== "applied"
      ? `GPT judge: ${summarizeJudgeMiss(gptJudge)}`
      : "",
    claudeJudge.status !== "applied"
      ? `Claude judge: ${summarizeJudgeMiss(claudeJudge)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

export const decideAttempt = ({ gptJudge, claudeJudge }) => {
  const statuses = [gptJudge.status, claudeJudge.status];
  if (statuses.every((status) => status === "applied")) {
    return {
      outcome: "success",
      reason: "Both GPT and Claude marked the requested change as applied.",
      nextAction: "promote",
    };
  }

  if (
    gptJudge.needsHuman ||
    claudeJudge.needsHuman ||
    statuses.includes("ambiguous") ||
    statuses.includes("out_of_scope")
  ) {
    return {
      outcome: "escalate",
      reason: "A judge flagged ambiguity, out-of-scope change, or needsHuman.",
      nextAction: "needs-human",
    };
  }

  if (
    (gptJudge.status === "applied" && claudeJudge.status === "not_applied") ||
    (claudeJudge.status === "applied" && gptJudge.status === "not_applied")
  ) {
    return {
      outcome: "escalate",
      reason: "GPT and Claude contradicted each other on whether the change happened.",
      nextAction: "needs-human",
    };
  }

  if (statuses.every((status) => ["partial", "not_applied"].includes(status))) {
    return {
      outcome: "retry",
      reason: "At least one judge says the change is still partial or not applied.",
      nextAction: "retry",
    };
  }

  if (statuses.includes("partial") || statuses.includes("not_applied")) {
    return {
      outcome: "retry",
      reason: "One judge still sees a concrete miss and there is no hard contradiction.",
      nextAction: "retry",
    };
  }

  return {
    outcome: "escalate",
    reason: "Unexpected judge combination; escalate to human review.",
    nextAction: "needs-human",
  };
};

const summarizeRegressionReview = (review) => {
  const parts = [];
  if (review.rationale) {
    parts.push(review.rationale);
  }
  if (Array.isArray(review.blockers) && review.blockers.length > 0) {
    parts.push(`Blockers: ${review.blockers.join("; ")}`);
  }
  if (review.nextMove) {
    parts.push(`Next move: ${review.nextMove}`);
  }
  return parts.join("\n");
};

const collectRegressionBlockers = ({ gptReview, claudeReview, staticSanity }) =>
  [
    ...(staticSanity?.ok === false ? staticSanity.blockers ?? [] : []),
    ...(gptReview?.verdict === "blocker" ? gptReview.blockers ?? [] : []),
    ...(claudeReview?.verdict === "blocker" ? claudeReview.blockers ?? [] : []),
  ].filter(Boolean);

export const decideRegression = ({ gptReview, claudeReview, staticSanity }) => {
  if (staticSanity?.ok === false) {
    return {
      outcome: "block",
      reason: staticSanity.summary,
      nextAction: "needs-human",
      blockers: staticSanity.blockers ?? [],
    };
  }

  if (gptReview.verdict === "blocker" || claudeReview.verdict === "blocker") {
    return {
      outcome: "block",
      reason: "At least one regression review found a concrete visual break.",
      nextAction: "needs-human",
      blockers: collectRegressionBlockers({
        gptReview,
        claudeReview,
        staticSanity,
      }),
    };
  }

  return {
    outcome: "clear",
    reason: "No regression blockers were found.",
    nextAction: "clear",
    blockers: [],
  };
};

const resolveImageList = ({ topLevelMeta, imagePaths }) => {
  if (Array.isArray(imagePaths) && imagePaths.length > 0) {
    return imagePaths.map((value) => resolve(String(value)));
  }
  const priorImages = Array.isArray(topLevelMeta?.referenceImages)
    ? topLevelMeta.referenceImages
    : Array.isArray(topLevelMeta?.images)
      ? topLevelMeta.images
      : [];
  return priorImages.map((value) => resolve(String(value)));
};

const createRunId = () =>
  new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");

const attemptLabel = (attemptNumber) =>
  `attempt-${String(attemptNumber).padStart(2, "0")}`;

const writeAttemptArtifacts = async ({
  attemptDir,
  repairPrompt,
  htmlText,
  responseText,
  requestDoc,
  resultDoc,
  gptJudge,
  claudeJudge,
  gptRegressionReview,
  claudeRegressionReview,
  staticSanity,
  codexMicroReviewTemplate,
  decision,
}) => {
  await mkdir(attemptDir, { recursive: true });
  await writeFile(resolve(attemptDir, "repair-prompt.txt"), `${repairPrompt.trim()}\n`, "utf8");
  await writeFile(resolve(attemptDir, "generated.html"), `${htmlText.trim()}\n`, "utf8");
  await writeFile(
    resolve(attemptDir, "response.txt"),
    `${String(responseText ?? "").trim()}\n`,
    "utf8"
  );
  await writeJsonDoc(resolve(attemptDir, "request.json"), requestDoc);
  await writeJsonDoc(resolve(attemptDir, "result.json"), resultDoc);
  if (gptJudge) {
    await writeJson(resolve(attemptDir, "gpt-judge.json"), gptJudge);
    await writeJson(resolve(attemptDir, "gpt-delta-judge.json"), gptJudge);
  }
  if (claudeJudge) {
    await writeJson(resolve(attemptDir, "claude-judge.json"), claudeJudge);
    await writeJson(resolve(attemptDir, "claude-delta-judge.json"), claudeJudge);
  }
  if (gptRegressionReview) {
    await writeJson(
      resolve(attemptDir, "gpt-regression-review.json"),
      gptRegressionReview
    );
  }
  if (claudeRegressionReview) {
    await writeJson(
      resolve(attemptDir, "claude-regression-review.json"),
      claudeRegressionReview
    );
  }
  if (staticSanity) {
    await writeJson(resolve(attemptDir, "static-sanity.json"), staticSanity);
  }
  if (codexMicroReviewTemplate) {
    await writeFile(
      resolve(attemptDir, "codex-micro-review.md"),
      `${codexMicroReviewTemplate.trim()}\n`,
      "utf8"
    );
  }
  await writeJson(resolve(attemptDir, "decision.json"), decision);
};

const updateTopLevelMeta = async ({
  metaPath,
  priorMeta,
  images,
  tune = null,
}) => {
  const nextMeta = {
    ...priorMeta,
    referenceImages: images,
  };
  const priorTune =
    priorMeta?.tune && typeof priorMeta.tune === "object" ? priorMeta.tune : null;
  if (priorTune || tune) {
    nextMeta.tune = {
      ...(priorTune ?? {}),
      ...(tune ?? {}),
    };
  }
  await writeJson(metaPath, nextMeta);
  return nextMeta;
};

const resolveExistingCodexReviewPath = (explicitPath, pendingReview) => {
  if (explicitPath) {
    return resolve(String(explicitPath));
  }
  if (pendingReview?.codexReviewPath) {
    const candidate = resolve(String(pendingReview.codexReviewPath));
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
};

const promoteAttemptToTopLevel = async ({
  attemptDir,
  topLevelHtmlPath,
  topLevelPromptPath,
  topLevelResponsePath,
  topLevelResultPath,
  topLevelRequestPath,
  topLevelPreviewPath,
}) => {
  await copyFile(resolve(attemptDir, "generated.html"), topLevelHtmlPath);
  await copyFile(resolve(attemptDir, "response.txt"), topLevelResponsePath);
  await copyFile(resolve(attemptDir, "result.json"), topLevelResultPath);
  await copyFile(resolve(attemptDir, "request.json"), topLevelRequestPath);
  await copyFile(resolve(attemptDir, "repair-prompt.txt"), topLevelPromptPath);
  await copyFile(resolve(attemptDir, "preview.png"), topLevelPreviewPath);
};

const finalizePendingCodexReview = async ({
  topLevelMeta,
  topLevelMetaPath,
  topLevelHtmlPath,
  topLevelPromptPath,
  topLevelResponsePath,
  topLevelResultPath,
  topLevelRequestPath,
  topLevelPreviewPath,
  resolvedCodexReviewFilePath,
}) => {
  const pendingReview = topLevelMeta?.tune?.pendingCodexReview;
  if (!pendingReview) {
    return null;
  }

  const reviewPath = resolveExistingCodexReviewPath(
    resolvedCodexReviewFilePath,
    pendingReview
  );
  if (!reviewPath) {
    throw new TuneLoopError(
      `Gemini HTML tune is waiting on a Codex/operator micro-review note. Edit ${pendingReview.codexReviewPath} and rerun the command.`,
      pendingReview.statePath
    );
  }

  const reviewText = await readFile(reviewPath, "utf8");
  let codexReview;
  try {
    codexReview = parseCodexMicroReview(reviewText);
  } catch (error) {
    throw new TuneLoopError(
      `Gemini HTML tune is waiting on a valid Codex/operator micro-review note at ${reviewPath}. ${error instanceof Error ? error.message : String(error)}`,
      pendingReview.statePath
    );
  }
  const state = await readJson(pendingReview.statePath);
  state.codexReview = {
    ...codexReview,
    path: reviewPath,
  };

  if (codexReview.verdict === "block") {
    state.status = "needs-human";
    state.failureReason = `Codex/operator micro-review blocked promotion. ${codexReview.verdictText}`;
    await writeJson(pendingReview.statePath, state);
    await updateTopLevelMeta({
      metaPath: topLevelMetaPath,
      priorMeta: topLevelMeta,
      images: Array.isArray(topLevelMeta?.referenceImages)
        ? topLevelMeta.referenceImages
        : Array.isArray(topLevelMeta?.images)
          ? topLevelMeta.images
          : [],
      tune: {
        pendingCodexReview: null,
        lastCodexMicroReview: {
          verdict: codexReview.verdict,
          path: reviewPath,
          runId: pendingReview.runId,
          attempt: pendingReview.attempt,
        },
      },
    });
    throw new TuneLoopError(
      `Gemini HTML tune stopped for human review. Codex/operator micro-review blocked promotion: ${codexReview.verdictText}`,
      pendingReview.statePath
    );
  }

  await promoteAttemptToTopLevel({
    attemptDir: pendingReview.attemptDir,
    topLevelHtmlPath,
    topLevelPromptPath,
    topLevelResponsePath,
    topLevelResultPath,
    topLevelRequestPath,
    topLevelPreviewPath,
  });
  const promotedHtml = await readFile(topLevelHtmlPath, "utf8");
  const promotedHtmlSha = computeTextSha256(promotedHtml);

  state.status = "succeeded";
  state.winner = { runId: pendingReview.runId, attempt: pendingReview.attempt };
  await writeJson(pendingReview.statePath, state);

  await updateTopLevelMeta({
    metaPath: topLevelMetaPath,
    priorMeta: topLevelMeta,
    images: Array.isArray(topLevelMeta?.referenceImages)
      ? topLevelMeta.referenceImages
      : Array.isArray(topLevelMeta?.images)
        ? topLevelMeta.images
        : [],
    tune: {
      latestRunId: pendingReview.runId,
      winningAttempt: pendingReview.attempt,
      pendingCodexReview: null,
      approvedHtmlSha256: promotedHtmlSha,
      approvedAt: new Date().toISOString(),
      approvalStale: false,
      approvalStaleReason: "",
      lastCodexMicroReview: {
        verdict: codexReview.verdict,
        path: reviewPath,
        runId: pendingReview.runId,
        attempt: pendingReview.attempt,
      },
    },
  });

  await promoteVersionContextPath(topLevelHtmlPath);

  return {
    ok: true,
    dir: dirname(topLevelHtmlPath),
    runId: pendingReview.runId,
    winningAttempt: pendingReview.attempt,
    statePath: pendingReview.statePath,
  };
};

class TuneLoopError extends Error {
  constructor(message, statePath) {
    super(message);
    this.name = "TuneLoopError";
    this.statePath = statePath;
  }
}

export const runGeminiHtmlTune = async ({
  dir,
  changeFilePath,
  imagePaths = [],
  codexReviewFilePath = null,
  maxRetries = 3,
  deps = {},
}) => {
  const artifactDir = resolve(String(dir));
  ensureDirArtifacts(artifactDir);
  const resolvedCodexReviewFilePath = codexReviewFilePath
    ? resolve(String(codexReviewFilePath))
    : null;

  const importDeps = {
    generateGeminiTextImpl: deps.generateGeminiTextImpl ?? generateGeminiText,
    captureHtmlScreenshotImpl:
      deps.captureHtmlScreenshotImpl ?? captureHtmlScreenshot,
    runOpenAIJudgeImpl: deps.runOpenAIJudgeImpl ?? runOpenAIHtmlDeltaJudge,
    runClaudeJudgeImpl: deps.runClaudeJudgeImpl ?? runClaudeHtmlDeltaJudge,
    runOpenAIRegressionReviewImpl:
      deps.runOpenAIRegressionReviewImpl ?? runOpenAIHtmlRegressionReview,
    runClaudeRegressionReviewImpl:
      deps.runClaudeRegressionReviewImpl ?? runClaudeHtmlRegressionReview,
  };

  const maxRetriesNumber = Number(maxRetries);
  if (!Number.isInteger(maxRetriesNumber) || maxRetriesNumber <= 0) {
    throw new Error("--max-retries must be a positive integer.");
  }

  const changePath = resolve(String(changeFilePath));
  const changeText = await readFile(changePath, "utf8");
  const change = parseChangeRequestText(changeText);

  const topLevelHtmlPath = resolve(artifactDir, "generated.html");
  const topLevelPromptPath = resolve(artifactDir, "prompt.txt");
  const topLevelResponsePath = resolve(artifactDir, "response.txt");
  const topLevelResultPath = resolve(artifactDir, "result.json");
  const topLevelPreviewPath = resolve(artifactDir, "preview.png");
  const topLevelRequestPath = resolve(artifactDir, "request.json");
  const topLevelMetaPath = topLevelRequestPath;
  const topLevelMeta = await readRequestDoc(artifactDir);
  const pendingFinalize = await finalizePendingCodexReview({
    topLevelMeta,
    topLevelMetaPath,
    topLevelHtmlPath,
    topLevelPromptPath,
    topLevelResponsePath,
    topLevelResultPath,
    topLevelRequestPath,
    topLevelPreviewPath,
    resolvedCodexReviewFilePath,
  });
  if (pendingFinalize) {
    return pendingFinalize;
  }

  const currentTopLevelHtml = await readFile(topLevelHtmlPath, "utf8");
  const currentHtmlSha = computeTextSha256(currentTopLevelHtml);
  const resolvedImages = resolveImageList({
    topLevelMeta,
    imagePaths,
  });
  const priorTuneMeta =
    topLevelMeta?.tune && typeof topLevelMeta.tune === "object"
      ? topLevelMeta.tune
      : {};
  const approvalStale = Boolean(
    priorTuneMeta.approvedHtmlSha256 &&
      priorTuneMeta.approvedHtmlSha256 !== currentHtmlSha
  );
  await updateTopLevelMeta({
    metaPath: topLevelMetaPath,
    priorMeta: topLevelMeta,
    images: resolvedImages,
    tune: {
      lastSeenHtmlSha256: currentHtmlSha,
      approvalStale,
      approvalStaleReason: approvalStale
        ? "Current generated.html changed after the last approved micro-pass. Re-run regression review before treating it as current."
        : "",
    },
  });

  const currentModel =
    typeof topLevelMeta?.model === "string" && topLevelMeta.model.trim()
      ? topLevelMeta.model.trim()
      : DEFAULT_GEMINI_TEXT_MODEL;
  const currentTemperature =
    typeof topLevelMeta?.temperature === "number" &&
    Number.isFinite(topLevelMeta.temperature)
      ? topLevelMeta.temperature
      : DEFAULT_GEMINI_TEXT_TEMPERATURE;

  const tuneDir = resolve(artifactDir, "tune");
  const runId = createRunId();
  const runDir = resolve(tuneDir, runId);
  const baselinePreviewPath = resolve(runDir, "baseline-preview.png");
  const statePath = resolve(runDir, "state.json");

  await mkdir(runDir, { recursive: true });
  await writeFile(resolve(runDir, "change-request.md"), `${normalizeText(changeText)}\n`, "utf8");
  await importDeps.captureHtmlScreenshotImpl({
    inputPath: topLevelHtmlPath,
    outputPath: topLevelPreviewPath,
  });
  await copyFile(topLevelPreviewPath, baselinePreviewPath);

  const originalPrompt = await readFile(topLevelPromptPath, "utf8");
  const state = {
    runId,
    artifactDir,
    changeFilePath: changePath,
    maxRetries: maxRetriesNumber,
    baselinePreviewPath,
    status: "running",
    winner: null,
    attempts: [],
  };
  await writeJson(statePath, state);

  let currentReferenceImagePath = topLevelPreviewPath;
  let previousMissSummary = "";

  for (let attemptNumber = 1; attemptNumber <= maxRetriesNumber; attemptNumber += 1) {
    const label = attemptLabel(attemptNumber);
    const attemptDir = resolve(runDir, label);
    const repairPrompt = buildRepairPrompt({
      originalPrompt,
      requestedChange: change.requestedChange,
      successChecks: change.successChecks,
      guardrails: change.guardrails,
      previousMissSummary,
    });

    const geminiResult = await importDeps.generateGeminiTextImpl({
      prompt: repairPrompt,
      imagePaths: [currentReferenceImagePath, ...resolvedImages],
      model: currentModel,
      temperature: currentTemperature,
    });
    const generatedHtml = String(geminiResult?.text ?? "")
      .trim()
      .replace(/^```html\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "");
    const htmlWithDoctype =
      /^<!doctype html/i.test(generatedHtml) || /^<html[\s>]/i.test(generatedHtml)
        ? generatedHtml
        : `<!doctype html>\n${generatedHtml}`;
    const requestDoc = buildRequestDoc({
      provider: "gemini",
      model: currentModel,
      temperature: currentTemperature,
      referenceImages: [currentReferenceImagePath, ...resolvedImages],
    });
    const resultDoc = buildResultDoc({
      provider: "gemini",
      model: currentModel,
      created_at: new Date().toISOString(),
      outputs: ["generated.html", "response.txt", "preview.png"],
      variant_id: null,
      variant_label: null,
      width: null,
      height: null,
      elapsed_ms: null,
      text: geminiResult?.text ?? "",
    });

    await mkdir(attemptDir, { recursive: true });
    const attemptHtmlPath = resolve(attemptDir, "generated.html");
    const attemptPreviewPath = resolve(attemptDir, "preview.png");
    await writeFile(attemptHtmlPath, `${htmlWithDoctype.trim()}\n`, "utf8");
    const staticSanity = checkHtmlStaticSanity(htmlWithDoctype);
    if (!staticSanity.ok) {
      const decision = {
        outcome: "escalate",
        reason: staticSanity.summary,
        nextAction: "needs-human",
        beforeImagePath: currentReferenceImagePath,
        afterImagePath: null,
        blockers: staticSanity.blockers,
        delta: null,
        regression: {
          outcome: "block",
          reason: staticSanity.summary,
        },
      };
      await writeAttemptArtifacts({
        attemptDir,
        repairPrompt,
        htmlText: htmlWithDoctype,
        responseText: geminiResult?.text ?? "",
        requestDoc,
        resultDoc,
        staticSanity,
        decision,
      });
      state.attempts.push({
        label,
        attemptDir,
        beforeImagePath: currentReferenceImagePath,
        afterImagePath: null,
        outcome: decision.outcome,
        nextAction: decision.nextAction,
        blockers: staticSanity.blockers,
        staticSanity,
      });
      state.status = "needs-human";
      state.failureReason = `${staticSanity.summary} ${staticSanity.blockers.join("; ")}`.trim();
      await writeJson(statePath, state);
      throw new TuneLoopError(
        `Gemini HTML tune stopped for human review. ${state.failureReason}`,
        statePath
      );
    }
    await importDeps.captureHtmlScreenshotImpl({
      inputPath: attemptHtmlPath,
      outputPath: attemptPreviewPath,
    });

    const [
      gptJudgeResult,
      claudeJudgeResult,
      gptRegressionResult,
      claudeRegressionResult,
    ] = await Promise.all([
      importDeps.runOpenAIJudgeImpl({
        beforeImagePath: currentReferenceImagePath,
        afterImagePath: attemptPreviewPath,
        changeRequest: change.requestedChange,
        successChecks: change.successChecks,
        guardrails: change.guardrails,
      }),
      importDeps.runClaudeJudgeImpl({
        beforeImagePath: currentReferenceImagePath,
        afterImagePath: attemptPreviewPath,
        changeRequest: change.requestedChange,
        successChecks: change.successChecks,
        guardrails: change.guardrails,
      }),
      importDeps.runOpenAIRegressionReviewImpl({
        beforeImagePath: currentReferenceImagePath,
        afterImagePath: attemptPreviewPath,
        referenceImagePath: resolvedImages[0],
        changeRequest: change.requestedChange,
      }),
      importDeps.runClaudeRegressionReviewImpl({
        beforeImagePath: currentReferenceImagePath,
        afterImagePath: attemptPreviewPath,
        referenceImagePath: resolvedImages[0],
        changeRequest: change.requestedChange,
      }),
    ]);

    const deltaDecision = decideAttempt({
      gptJudge: gptJudgeResult.normalized,
      claudeJudge: claudeJudgeResult.normalized,
    });
    const regressionDecision = decideRegression({
      gptReview: gptRegressionResult.normalized,
      claudeReview: claudeRegressionResult.normalized,
      staticSanity,
    });
    const blockerList = collectRegressionBlockers({
      gptReview: gptRegressionResult.normalized,
      claudeReview: claudeRegressionResult.normalized,
      staticSanity,
    });

    let codexReview = null;
    let codexMicroReviewTemplate = "";
    let decision = {
      outcome: deltaDecision.outcome,
      reason: deltaDecision.reason,
      nextAction: deltaDecision.nextAction,
      beforeImagePath: currentReferenceImagePath,
      afterImagePath: attemptPreviewPath,
      blockers: blockerList,
      delta: {
        outcome: deltaDecision.outcome,
        reason: deltaDecision.reason,
      },
      regression: {
        outcome: regressionDecision.outcome,
        reason: regressionDecision.reason,
      },
    };

    if (regressionDecision.outcome === "block") {
      decision = {
        ...decision,
        outcome: "escalate",
        reason: regressionDecision.reason,
        nextAction: "needs-human",
      };
    } else if (deltaDecision.outcome === "success") {
      if (
        resolvedCodexReviewFilePath &&
        existsSync(resolvedCodexReviewFilePath)
      ) {
        const codexReviewText = await readFile(resolvedCodexReviewFilePath, "utf8");
        try {
          codexReview = {
            ...parseCodexMicroReview(codexReviewText),
            path: resolvedCodexReviewFilePath,
          };
        } catch (error) {
          throw new TuneLoopError(
            `Gemini HTML tune stopped for human review. Invalid Codex/operator micro-review note at ${resolvedCodexReviewFilePath}. ${error instanceof Error ? error.message : String(error)}`,
            statePath
          );
        }
        if (codexReview.verdict === "block") {
          decision = {
            ...decision,
            outcome: "escalate",
            reason: `Codex/operator micro-review blocked promotion. ${codexReview.verdictText}`,
            nextAction: "needs-human",
          };
        }
      } else {
        const codexReviewPath = resolve(attemptDir, "codex-micro-review.md");
        codexMicroReviewTemplate = buildCodexMicroReviewTemplate({
          changeRequest: change.requestedChange,
          deltaSummary: buildCombinedMissSummary({
            gptJudge: { ...gptJudgeResult.normalized, status: "applied" },
            claudeJudge: { ...claudeJudgeResult.normalized, status: "applied" },
          }) || "Both delta judges marked the requested change as applied.",
          regressionSummary: [
            `GPT regression review: ${summarizeRegressionReview(gptRegressionResult.normalized)}`,
            `Claude regression review: ${summarizeRegressionReview(claudeRegressionResult.normalized)}`,
          ].join("\n\n"),
          blockers: blockerList,
        });
        decision = {
          ...decision,
          outcome: "needs-codex-review",
          reason:
            "Automated checks passed. A checked-in Codex/operator micro-review is now required before promotion.",
          nextAction: "needs-codex-review",
          codexReviewPath,
        };
      }
    }

    await writeAttemptArtifacts({
      attemptDir,
      repairPrompt,
      htmlText: htmlWithDoctype,
      responseText: geminiResult?.text ?? "",
      requestDoc,
      resultDoc,
      gptJudge: {
        ...gptJudgeResult.normalized,
        raw: gptJudgeResult.raw,
      },
      claudeJudge: {
        ...claudeJudgeResult.normalized,
        raw: claudeJudgeResult.raw,
      },
      gptRegressionReview: {
        ...gptRegressionResult.normalized,
        raw: gptRegressionResult.raw,
      },
      claudeRegressionReview: {
        ...claudeRegressionResult.normalized,
        raw: claudeRegressionResult.raw,
      },
      staticSanity,
      codexMicroReviewTemplate,
      decision,
    });

    state.attempts.push({
      label,
      attemptDir,
      beforeImagePath: currentReferenceImagePath,
      afterImagePath: attemptPreviewPath,
      outcome: decision.outcome,
      nextAction: decision.nextAction,
      blockers: blockerList,
      gpt: gptJudgeResult.normalized,
      claude: claudeJudgeResult.normalized,
      gptRegression: gptRegressionResult.normalized,
      claudeRegression: claudeRegressionResult.normalized,
      codexReview,
    });

    if (decision.outcome === "success") {
      await promoteAttemptToTopLevel({
        attemptDir,
        topLevelHtmlPath,
        topLevelPromptPath,
        topLevelResponsePath,
        topLevelResultPath,
        topLevelRequestPath,
        topLevelPreviewPath,
      });
      const promotedHtml = await readFile(topLevelHtmlPath, "utf8");
      const promotedHtmlSha = computeTextSha256(promotedHtml);
      await updateTopLevelMeta({
        metaPath: topLevelMetaPath,
        priorMeta: await readRequestDoc(artifactDir),
        images: resolvedImages,
        tune: {
          latestRunId: runId,
          winningAttempt: label,
          pendingCodexReview: null,
          approvedHtmlSha256: promotedHtmlSha,
          approvedAt: new Date().toISOString(),
          approvalStale: false,
          approvalStaleReason: "",
          lastCodexMicroReview: codexReview
            ? {
                verdict: codexReview.verdict,
                path: codexReview.path,
                runId,
                attempt: label,
              }
            : null,
          },
      });
      await promoteVersionContextPath(topLevelHtmlPath);
      state.status = "succeeded";
      state.winner = { runId, attempt: label };
      await writeJson(statePath, state);
      return {
        ok: true,
        dir: artifactDir,
        runId,
        winningAttempt: label,
        statePath,
      };
    }

    if (decision.outcome === "needs-codex-review") {
      state.status = "needs-codex-review";
      state.pendingCodexReview = {
        runId,
        attempt: label,
        attemptDir,
        codexReviewPath: decision.codexReviewPath,
        statePath,
      };
      await writeJson(statePath, state);
      await updateTopLevelMeta({
        metaPath: topLevelMetaPath,
        priorMeta: await readRequestDoc(artifactDir),
        images: resolvedImages,
        tune: {
          pendingCodexReview: state.pendingCodexReview,
        },
      });
      throw new TuneLoopError(
        `Gemini HTML tune stopped for human review. Edit ${decision.codexReviewPath} with a Codex/operator micro-review verdict and rerun the command.`,
        statePath
      );
    }

    if (decision.outcome === "escalate") {
      state.status = "needs-human";
      state.failureReason = decision.reason;
      await writeJson(statePath, state);
      throw new TuneLoopError(
        `Gemini HTML tune stopped for human review. ${decision.reason}`,
        statePath
      );
    }

    previousMissSummary = buildCombinedMissSummary({
      gptJudge: gptJudgeResult.normalized,
      claudeJudge: claudeJudgeResult.normalized,
    });
    currentReferenceImagePath = attemptPreviewPath;
    await writeJson(statePath, state);
  }

  state.status = "failed";
  state.failureReason =
    "Reached max retries without clearing both the requested delta and regression checks.";
  await writeJson(statePath, state);
  throw new TuneLoopError(state.failureReason, statePath);
};

export const isTuneLoopError = (error) => error instanceof TuneLoopError;
