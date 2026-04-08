import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

import { readDeckSpec, resolveDeckSlideEntry } from "../../lib/repo/read-deck-spec.mjs";
import { buildCodexMicroReviewTemplate, parseCodexMicroReview } from "./private/html-tune-state.mjs";
import { writeJson } from "../figures/lib/io.mjs";
import {
  findVersionContextForPath,
  getProjectedRootArtifactPaths,
  getVersionDir,
  promoteVersionContextPath,
  readSlideManifest,
  resolveSlideVersionContext,
  resolveVersionedOutputDir,
} from "../figures/lib/slide-versioning.mjs";
import { captureHtmlScreenshot } from "../utils/html-screenshot-lib.mjs";
import { createHtmlScreenshotPool } from "../utils/html-screenshot-pool.mjs";
import { loadHtmlChangeRequest } from "./private/html-change-request.mjs";
import { buildHtmlEditRunReport } from "./private/html-edit-run-report.mjs";
import {
  buildHtmlEditRunConfig,
  createHtmlEditRunId,
  getSlotVariationNote,
} from "./private/html-edit-run-schema.mjs";
import {
  createInitialHtmlEditRunState,
  ensureHtmlEditRunSkeleton,
  getHtmlEditRunPaths,
  getRoundPaths,
  getSlotPaths,
  hasHtmlEditRunState,
  loadHtmlEditRunState,
  writeHtmlEditRunState,
  writeRoundArtifacts,
  writeWinnerDoc,
} from "./private/html-edit-run-state.mjs";
import { runHtmlCandidatePrefilter } from "./private/html-candidate-prefilter.mjs";
import { scoreHtmlCandidate, selectPassingCandidates } from "./private/html-candidate-score.mjs";
import {
  synthesizeGlobalRetryBrief,
  synthesizeSlotRetryBrief,
} from "./private/html-prompt-synthesis.mjs";
import {
  generateGeminiHtmlEditCandidate,
} from "./private/html-generator-gemini.mjs";
import {
  generateOpenAIHtmlEditCandidate,
} from "./private/html-generator-openai.mjs";
import {
  runClaudeHtmlDeltaJudge,
  runClaudeHtmlRegressionReview,
  runOpenAIHtmlDeltaJudge,
  runOpenAIHtmlRegressionReview,
} from "./private/html-delta-judge.mjs";

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

const createLimiter = (concurrency) => {
  const maxConcurrency = Math.max(1, Number(concurrency) || 1);
  let activeCount = 0;
  const queue = [];

  const pump = () => {
    if (activeCount >= maxConcurrency) {
      return;
    }
    const next = queue.shift();
    if (!next) {
      return;
    }
    activeCount += 1;
    Promise.resolve()
      .then(next.task)
      .then(next.resolve, next.reject)
      .finally(() => {
        activeCount -= 1;
        pump();
      });
  };

  return (task) =>
    new Promise((resolvePromise, rejectPromise) => {
      queue.push({
        task,
        resolve: resolvePromise,
        reject: rejectPromise,
      });
      pump();
    });
};

const nowIso = () => new Date().toISOString();

const isRetryableError = (error) => {
  const message = String(error?.message ?? error ?? "").toLowerCase();
  return (
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("temporar") ||
    message.includes("timeout") ||
    message.includes("503") ||
    message.includes("500")
  );
};

const runWithRetries = async (task, { retries = 2, baseDelayMs = 1500 } = {}) => {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !isRetryableError(error)) {
        throw error;
      }
      await sleep(baseDelayMs * (attempt + 1));
    }
  }
  throw lastError;
};

const writeReport = async ({ runDir, state }) => {
  const reportHtml = buildHtmlEditRunReport({ runDir, state });
  await writeFile(resolve(runDir, "report.html"), `${reportHtml}\n`, "utf8");
};

const ensurePreview = async ({
  htmlPath,
  previewPath,
  captureScreenshotImpl = captureHtmlScreenshot,
}) => {
  if (existsSync(previewPath)) {
    return previewPath;
  }
  await mkdir(dirname(previewPath), { recursive: true });
  await captureScreenshotImpl({
    inputPath: htmlPath,
    outputPath: previewPath,
  });
  return previewPath;
};

const resolveOfficialPreviewPath = async ({ context, manifest, fallbackPreviewPath }) => {
  if (context?.slideDir && manifest?.currentVersionId) {
    const projected = getProjectedRootArtifactPaths({
      slideDir: context.slideDir,
      slideDirName: context.slideDirName,
      versionId: manifest.currentVersionId,
    }).pngPath;
    if (existsSync(projected)) {
      return projected;
    }
  }
  return fallbackPreviewPath;
};

const resolveRunTarget = async ({
  artifactDir,
  projectRoot,
  slide,
  versionId = null,
  surface = "gemini-html",
  captureScreenshotImpl = captureHtmlScreenshot,
}) => {
  if (artifactDir) {
    const resolvedArtifactDir = resolve(String(artifactDir));
    const versionContext = await findVersionContextForPath(resolvedArtifactDir);
    const parentHtmlPath = resolve(resolvedArtifactDir, "generated.html");
    const parentPreviewPath = resolve(resolvedArtifactDir, "preview.png");
    if (!existsSync(parentHtmlPath)) {
      throw new Error(`Could not find generated.html under ${resolvedArtifactDir}.`);
    }
    await ensurePreview({
      htmlPath: parentHtmlPath,
      previewPath: parentPreviewPath,
      captureScreenshotImpl,
    });
    const currentManifest = versionContext?.manifest ?? null;
    const context =
      versionContext?.slideDir && versionContext?.versionDoc?.slideId
        ? await resolveSlideVersionContext({
            projectRoot: resolve(versionContext.slideDir, "..", ".."),
            slideId: versionContext.versionDoc.slideId,
            slideDir: versionContext.slideDir,
          })
        : null;
    const officialPreviewPath = await resolveOfficialPreviewPath({
      context,
      manifest: currentManifest,
      fallbackPreviewPath: parentPreviewPath,
    });
    return {
      artifactDir: resolvedArtifactDir,
      parentHtmlPath,
      parentPreviewPath,
      officialPreviewPath,
      projectRoot: context?.projectRoot ?? null,
      slideId: versionContext?.versionDoc?.slideId ?? null,
      versionId: versionContext?.versionDoc?.id ?? null,
      surface:
        surface ||
        (versionContext?.versionDir === resolvedArtifactDir
          ? "version-root"
          : basename(resolvedArtifactDir)),
    };
  }

  if (!projectRoot || !slide) {
    throw new Error("Provide either --artifact-dir or --project-root with --slide.");
  }

  const { deckSpec } = await readDeckSpec(resolve(String(projectRoot)));
  const slideEntry = resolveDeckSlideEntry({ deckSpec, slide });
  const context = await resolveSlideVersionContext({
    projectRoot,
    slideId: slideEntry.id,
  });
  const manifest = await readSlideManifest({
    projectRoot: context.projectRoot,
    slideId: context.slideId,
    slideDir: context.slideDir,
  });
  const resolvedVersionId = versionId || manifest.currentVersionId;
  if (!resolvedVersionId) {
    throw new Error(`No current version is set for ${context.slideId}.`);
  }

  const resolvedArtifactDir =
    surface === "current-html"
      ? context.slideDir
      : await resolveVersionedOutputDir({
          projectRoot: context.projectRoot,
          slideId: context.slideId,
          versionId: resolvedVersionId,
          branch: surface,
        });
  const parentHtmlPath = resolve(resolvedArtifactDir, "generated.html");
  const parentPreviewPath =
    surface === "current-html"
      ? getProjectedRootArtifactPaths({
          slideDir: context.slideDir,
          slideDirName: context.slideDirName,
          versionId: resolvedVersionId,
        }).pngPath
      : resolve(resolvedArtifactDir, "preview.png");
  if (!existsSync(parentHtmlPath)) {
    throw new Error(`Could not find generated.html under ${resolvedArtifactDir}.`);
  }
  await ensurePreview({
    htmlPath: parentHtmlPath,
    previewPath: parentPreviewPath,
    captureScreenshotImpl,
  });
  const officialPreviewPath = await resolveOfficialPreviewPath({
    context,
    manifest,
    fallbackPreviewPath: parentPreviewPath,
  });
  return {
    artifactDir: resolvedArtifactDir,
    parentHtmlPath,
    parentPreviewPath,
    officialPreviewPath,
    projectRoot: context.projectRoot,
    slideId: context.slideId,
    versionId: resolvedVersionId,
    surface,
  };
};

const writeJsonIfPresent = async (filePath, payload) => {
  if (payload === undefined || payload === null) {
    return;
  }
  await writeJson(filePath, payload);
};

const writeSlotEvaluationArtifacts = async ({
  slotPaths,
  prefilter,
  gptDelta,
  claudeDelta,
  gptRegression,
  claudeRegression,
  score,
  decision,
}) => {
  await writeJsonIfPresent(slotPaths.staticSanityPath, prefilter?.staticSanity);
  await writeJsonIfPresent(slotPaths.prefilterPath, prefilter);
  await writeJsonIfPresent(slotPaths.gptDeltaPath, gptDelta);
  await writeJsonIfPresent(slotPaths.claudeDeltaPath, claudeDelta);
  await writeJsonIfPresent(slotPaths.gptRegressionPath, gptRegression);
  await writeJsonIfPresent(slotPaths.claudeRegressionPath, claudeRegression);
  await writeJsonIfPresent(slotPaths.scorePath, score);
  await writeJsonIfPresent(slotPaths.decisionPath, decision);
};

const buildWinnerPayload = ({ runId, roundNumber, slot }) => ({
  runId,
  roundNumber,
  slotId: slot.slotId,
  provider: slot.provider,
  model: slot.model,
  settings: slot.settings ?? {},
  attemptNumber: slot.attemptNumber,
  status: slot.status,
  score: slot.score,
  decision: slot.decision,
  attemptDir: slot.attemptDir,
  htmlPath: slot.after?.htmlPath ?? null,
  previewPath: slot.after?.previewPath ?? null,
});

const promoteWinnerToArtifactDir = async ({
  artifactDir,
  winner,
  copyDebugFiles = true,
}) => {
  const targetMap = [
    ["generated.html", resolve(artifactDir, "generated.html")],
    ["preview.png", resolve(artifactDir, "preview.png")],
    ...(copyDebugFiles
      ? [
          ["prompt.txt", resolve(artifactDir, "prompt.txt")],
          ["request.json", resolve(artifactDir, "request.json")],
          ["result.json", resolve(artifactDir, "result.json")],
          ["response.txt", resolve(artifactDir, "response.txt")],
        ]
      : []),
  ];
  for (const [name, targetPath] of targetMap) {
    const sourcePath = resolve(winner.attemptDir, name);
    if (existsSync(sourcePath)) {
      await mkdir(dirname(targetPath), { recursive: true });
      await copyFile(sourcePath, targetPath);
    }
  }
  return resolve(artifactDir, "generated.html");
};

const finalizeCodexReview = async ({
  state,
  runDir,
  artifactDir,
  codexReviewFilePath,
  promoteVersionAfterMaterialize = true,
  copyDebugFiles = true,
}) => {
  if (!state.pendingCodexReview) {
    return null;
  }
  if (!codexReviewFilePath) {
    return {
      ok: false,
      status: "needs-codex-review",
      runDir,
      state,
    };
  }

  const review = parseCodexMicroReview(await readFile(codexReviewFilePath, "utf8"));
  if (review.verdict === "block") {
    state.status = "needs-human";
    state.failureReason = `Codex/operator micro-review blocked promotion. ${review.verdictText}`;
    state.pendingCodexReview = {
      ...state.pendingCodexReview,
      reviewPath: resolve(codexReviewFilePath),
      verdict: review.verdict,
    };
    const nextState = await writeHtmlEditRunState(runDir, state);
    await writeReport({ runDir, state: nextState });
    return {
      ok: false,
      status: nextState.status,
      runDir,
      state: nextState,
    };
  }

  const promotedHtmlPath = await promoteWinnerToArtifactDir({
    artifactDir,
    winner: state.pendingCodexReview,
    copyDebugFiles,
  });
  if (promoteVersionAfterMaterialize) {
    await promoteVersionContextPath(promotedHtmlPath);
  }
  state.status = "succeeded";
  state.winner = buildWinnerPayload({
    runId: state.runId,
    roundNumber: state.pendingCodexReview.roundNumber,
    slot: state.pendingCodexReview,
  });
  state.pendingCodexReview = null;
  const nextState = await writeHtmlEditRunState(runDir, state);
  await writeWinnerDoc({ runDir, winner: nextState.winner });
  await writeReport({ runDir, state: nextState });
  return {
    ok: true,
    status: nextState.status,
    runDir,
    state: nextState,
  };
};

const snapshotSlotForRound = (slot) => JSON.parse(JSON.stringify(slot));

export const runHtmlEditRun = async ({
  artifactDir = null,
  projectRoot = null,
  slide = null,
  versionId = null,
  runType = "edit",
  surface = "gemini-html",
  changeFilePath,
  approvedRegionsFilePath = null,
  imagePaths = [],
  mode = "repair",
  baselineOverride = null,
  materializeWinnerToArtifactRoot = false,
  promoteVersionAfterMaterialize = true,
  providers = ["openai", "gemini"],
  slotsPerProvider = 2,
  targetPassCount = 1,
  maxRounds = 4,
  maxSlotAttempts = 3,
  renderConcurrency = 2,
  judgeConcurrency = 6,
  generationConcurrency = 4,
  perProviderInFlightCap = 2,
  saveRaw = false,
  report = true,
  promoteOnPass = false,
  codexReviewFilePath = null,
  resume = null,
  openaiModel,
  openaiTemperature,
  openaiReasoning,
  geminiModel,
  geminiTemperature,
  geminiThinkingLevel,
  gptJudgeModel,
  claudeJudgeModel,
  deps = {},
}) => {
  const captureScreenshotImpl = deps.captureScreenshotImpl ?? captureHtmlScreenshot;
  const screenshotPoolFactory =
    deps.createHtmlScreenshotPoolImpl ?? createHtmlScreenshotPool;
  const runOpenAIDeltaJudgeImpl = deps.runOpenAIDeltaJudgeImpl ?? runOpenAIHtmlDeltaJudge;
  const runClaudeDeltaJudgeImpl = deps.runClaudeDeltaJudgeImpl ?? runClaudeHtmlDeltaJudge;
  const runOpenAIRegressionImpl =
    deps.runOpenAIRegressionImpl ?? runOpenAIHtmlRegressionReview;
  const runClaudeRegressionImpl =
    deps.runClaudeRegressionImpl ?? runClaudeHtmlRegressionReview;
  const generateGeminiCandidateImpl =
    deps.generateGeminiCandidateImpl ?? generateGeminiHtmlEditCandidate;
  const generateOpenAICandidateImpl =
    deps.generateOpenAICandidateImpl ?? generateOpenAIHtmlEditCandidate;

  let runDir;
  let state;
  let target;

  if (resume) {
    runDir = resolve(String(resume));
    if (!hasHtmlEditRunState(runDir)) {
      throw new Error(`Could not find state.json under ${runDir}.`);
    }
    state = await loadHtmlEditRunState(runDir);
    target = {
      artifactDir: state.artifactDir,
      projectRoot: state.projectRoot,
      slideId: state.slideId,
      versionId: state.versionId,
      surface: state.surface,
    };
    const finalized = await finalizeCodexReview({
      state,
      runDir,
      artifactDir: state.artifactDir,
      codexReviewFilePath,
      promoteVersionAfterMaterialize:
        state.promoteVersionAfterMaterialize ?? true,
      copyDebugFiles: state.copyDebugFiles ?? true,
    });
    if (finalized) {
      return {
        ok: finalized.ok,
        runDir,
        state: finalized.state,
        status: finalized.status,
      };
    }
  } else {
    if (!changeFilePath) {
      throw new Error("--change-file is required.");
    }
    target = await resolveRunTarget({
      artifactDir,
      projectRoot,
      slide,
      versionId,
      surface,
      captureScreenshotImpl,
    });
    const changeRequest = await loadHtmlChangeRequest({
      changeFilePath,
      approvedRegionsFilePath,
    });
    const runId = createHtmlEditRunId();
    const runPaths = getHtmlEditRunPaths({
      artifactDir: target.artifactDir,
      runId,
    });
    runDir = runPaths.runDir;
    const baseline = {
      officialPreviewPath: resolve(runPaths.baselineDir, "official-preview.png"),
      parentPreviewPath: resolve(runPaths.baselineDir, "parent-preview.png"),
      parentHtmlPath: resolve(runPaths.baselineDir, "parent-html.html"),
      officialHtmlPath: baselineOverride?.officialHtmlPath
        ? resolve(runPaths.baselineDir, "official-html.html")
        : null,
      approvedRegionsPath:
        changeRequest.approvedRegionsPath || baselineOverride?.approvedRegionsPath
        ? resolve(runPaths.baselineDir, "approved-regions.json")
        : null,
    };
    state = createInitialHtmlEditRunState({
      artifactDir: target.artifactDir,
      projectRoot: target.projectRoot,
      slideId: target.slideId,
      versionId: target.versionId,
      runType,
      surface: target.surface,
      mode,
      config: buildHtmlEditRunConfig({
        providers,
        slotsPerProvider,
        targetPassCount,
        maxRounds,
        maxSlotAttempts,
        renderConcurrency,
        judgeConcurrency,
        generationConcurrency,
        perProviderInFlightCap,
      }),
      baseline,
      request: {
        requestedChange: changeRequest.requestedChange,
        successChecks: changeRequest.successChecks,
        guardrails: changeRequest.guardrails,
        approvedRegions: changeRequest.approvedRegions,
        approvedRegionsPath: changeRequest.approvedRegionsPath,
        referenceIntent: changeRequest.referenceIntent,
        stopIf: changeRequest.stopIf,
        requiredTextSnippets:
          runType === "create"
            ? [
                changeRequest.requestedChange.match(/Locked header:\s*(.+)/i)?.[1] ?? "",
                changeRequest.requestedChange.match(/Locked subheader:\s*(.+)/i)?.[1] ?? "",
              ].filter(Boolean)
            : [],
      },
      runId,
    });
    state.promoteVersionAfterMaterialize = promoteVersionAfterMaterialize;
    state.copyDebugFiles = materializeWinnerToArtifactRoot ? false : true;
    await ensureHtmlEditRunSkeleton({
      artifactDir: target.artifactDir,
      runId,
      requestMarkdown: changeRequest.rawMarkdown,
      requestJson: state.request,
      baselineFiles: {
        "official-preview.png":
          baselineOverride?.officialPreviewPath ?? target.officialPreviewPath,
        "parent-preview.png":
          baselineOverride?.parentPreviewPath ?? target.parentPreviewPath,
        "parent-html.html":
          baselineOverride?.parentHtmlPath ?? target.parentHtmlPath,
        ...(baselineOverride?.officialHtmlPath
          ? { "official-html.html": baselineOverride.officialHtmlPath }
          : {}),
        ...(changeRequest.approvedRegionsPath || baselineOverride?.approvedRegionsPath
          ? {
              "approved-regions.json":
                changeRequest.approvedRegionsPath ?? baselineOverride?.approvedRegionsPath,
            }
          : {}),
      },
      state,
    });
    state = await loadHtmlEditRunState(runDir);
  }

  const screenshotPool = await screenshotPoolFactory({
    concurrency: state.config.renderConcurrency,
  });
  const generationLimit = createLimiter(state.config.generationConcurrency);
  const providerLimits = new Map(
    state.config.providers.map((provider) => [
      provider,
      createLimiter(state.config.perProviderInFlightCap),
    ])
  );
  const judgeLimit = createLimiter(state.config.judgeConcurrency);
  const resolvedReferenceImages = (Array.isArray(imagePaths) ? imagePaths : [])
    .map((value) => resolve(String(value)))
    .filter(Boolean);

  try {
    state.runType = state.runType || "edit";
    const completedRounds = Array.isArray(state.rounds) ? state.rounds.length : 0;
    for (
      let roundNumber = completedRounds + 1;
      roundNumber <= state.config.maxRounds;
      roundNumber += 1
    ) {
      const activeSlots = state.slots.filter(
        (slot) =>
          ["queued", "judged_retry"].includes(slot.status) &&
          slot.attemptNumber < state.config.maxSlotAttempts
      );
      if (activeSlots.length === 0) {
        break;
      }

      const roundPaths = getRoundPaths({ runDir, roundNumber });
      const roundState = {
        roundNumber,
        status: "running",
        startedAt: nowIso(),
        completedAt: null,
        slots: [],
        summary: {
          passCount: 0,
          retryCount: 0,
          blockedCount: 0,
          escalatedCount: 0,
        },
        retrySynthesis: {
          global: "",
          slotLocal: {},
        },
      };
      await writeRoundArtifacts({
        runDir,
        roundNumber,
        roundState,
        synthesisMarkdown: "",
      });

      const generationStartedAt = Date.now();
      const slotSettled = await Promise.allSettled(
        activeSlots.map((slot) =>
          generationLimit(() =>
            providerLimits.get(slot.provider)(() =>
              runWithRetries(async () => {
                const parentHtmlPath =
                  slot.after?.htmlPath && existsSync(slot.after.htmlPath)
                    ? slot.after.htmlPath
                    : state.baseline.parentHtmlPath;
                const parentPreviewPath =
                  slot.after?.previewPath && existsSync(slot.after.previewPath)
                    ? slot.after.previewPath
                    : state.baseline.parentPreviewPath;
                const editableHtml = await readFile(parentHtmlPath, "utf8");
                const slotPaths = getSlotPaths({
                  roundDir: roundPaths.roundDir,
                  slotId: slot.slotId,
                });
                await mkdir(slotPaths.slotDir, { recursive: true });

                const retryBrief = slot.retryBrief || "";
                const commonArgs = {
                  runType: state.runType,
                  mode: state.mode,
                  outputDir: slotPaths.slotDir,
                  editableHtml,
                  parentPreviewPath,
                  officialPreviewPath: state.baseline.officialPreviewPath,
                  referenceImagePaths: resolvedReferenceImages,
                  requestedChange: state.request.requestedChange,
                  successChecks: state.request.successChecks,
                  guardrails: state.request.guardrails,
                  approvedRegions: state.request.approvedRegions,
                  referenceIntent: state.request.referenceIntent,
                  stopIf: state.request.stopIf,
                  retryBrief,
                  slotVariationNote: getSlotVariationNote(slot.slotId, {
                    runType: state.runType,
                    mode: state.mode,
                  }),
                  saveRaw,
                };

                const candidate =
                  slot.provider === "gemini"
                    ? await generateGeminiCandidateImpl({
                        ...commonArgs,
                        model: geminiModel,
                        temperature: geminiTemperature,
                        thinkingLevel: geminiThinkingLevel,
                      })
                    : await generateOpenAICandidateImpl({
                        ...commonArgs,
                        model: openaiModel,
                        temperature: openaiTemperature,
                        reasoning: openaiReasoning,
                      });

                state.metrics.generationCalls += 1;
                return {
                  slotId: slot.slotId,
                  slotPaths,
                  parentHtmlPath,
                  parentPreviewPath,
                  candidate,
                };
              })
            )
          )
        )
      );
      state.metrics.timingsMs.generation += Date.now() - generationStartedAt;

      const slotResults = [];
      for (let index = 0; index < slotSettled.length; index += 1) {
        const slot = activeSlots[index];
        const settled = slotSettled[index];
        if (settled.status === "rejected") {
          const nextSlotState = {
            ...slot,
            attemptNumber: slot.attemptNumber + 1,
            status: "escalated",
            decision: {
              outcome: "escalate",
              reason: String(settled.reason?.message ?? settled.reason ?? "Generation failed."),
            },
            score: {
              class: "escalated",
              numeric: 0,
              status: "escalated",
              outcome: "escalate",
              reason: String(settled.reason?.message ?? settled.reason ?? "Generation failed."),
            },
          };
          Object.assign(slot, nextSlotState);
          slotResults.push(nextSlotState);
          roundState.slots.push(snapshotSlotForRound(nextSlotState));
          roundState.summary.escalatedCount += 1;
          continue;
        }

        const { slotPaths, candidate, parentHtmlPath, parentPreviewPath } = settled.value;
        const renderStartedAt = Date.now();
        try {
          await screenshotPool.capture({
            inputPath: slotPaths.htmlPath,
            outputPath: slotPaths.previewPath,
          });
          state.metrics.renderCalls += 1;
          state.metrics.timingsMs.render += Date.now() - renderStartedAt;
        } catch (error) {
          const nextSlotState = {
            ...slot,
            model: candidate.model,
            settings:
              slot.provider === "gemini"
                ? {
                    temperature: candidate.temperature,
                    thinkingLevel: candidate.thinkingLevel,
                  }
                : {
                    temperature: candidate.temperature,
                    reasoning: candidate.reasoning,
                  },
            attemptNumber: slot.attemptNumber + 1,
            status: "render_failed",
            attemptDir: slotPaths.slotDir,
            before: {
              officialPreviewPath: state.baseline.officialPreviewPath,
              parentPreviewPath,
              parentHtmlPath,
            },
            after: {
              htmlPath: slotPaths.htmlPath,
              previewPath: null,
            },
            decision: {
              outcome: "escalate",
              reason: `Render failed: ${String(error?.message ?? error)}`,
            },
            score: {
              class: "escalated",
              numeric: 0,
              status: "render_failed",
              outcome: "escalate",
              reason: `Render failed: ${String(error?.message ?? error)}`,
            },
          };
          Object.assign(slot, nextSlotState);
          slotResults.push(nextSlotState);
          roundState.slots.push(snapshotSlotForRound(nextSlotState));
          roundState.summary.escalatedCount += 1;
          continue;
        }

        const htmlText = await readFile(slotPaths.htmlPath, "utf8");
        const prefilter = await runHtmlCandidatePrefilter({
          runType: state.runType,
          htmlText,
          htmlPath: slotPaths.htmlPath,
          previewPath: slotPaths.previewPath,
          officialPreviewPath: state.baseline.officialPreviewPath,
          officialHtmlText: state.baseline.officialHtmlPath
            ? await readFile(state.baseline.officialHtmlPath, "utf8")
            : "",
          requiredTextSnippets: state.request.requiredTextSnippets,
          approvedRegions: state.request.approvedRegions,
        });
        const nextSlotState = {
          ...slot,
          model: candidate.model,
          settings:
            slot.provider === "gemini"
              ? {
                  temperature: candidate.temperature,
                  thinkingLevel: candidate.thinkingLevel,
                }
              : {
                  temperature: candidate.temperature,
                  reasoning: candidate.reasoning,
                },
          attemptNumber: slot.attemptNumber + 1,
          status: prefilter.ok ? "generated" : "prefilter_failed",
          attemptDir: slotPaths.slotDir,
          before: {
            officialPreviewPath: state.baseline.officialPreviewPath,
            parentPreviewPath,
            parentHtmlPath,
          },
          after: {
            htmlPath: slotPaths.htmlPath,
            previewPath: slotPaths.previewPath,
          },
          prefilter,
          judges: null,
          lockedRegions: prefilter.lockedRegions,
          score: null,
          decision: null,
        };

        if (!prefilter.ok) {
          state.metrics.prefilterRejects += 1;
          nextSlotState.score = scoreHtmlCandidate({ prefilter });
          nextSlotState.decision = {
            outcome: nextSlotState.score.outcome,
            reason: nextSlotState.score.reason,
          };
          await writeSlotEvaluationArtifacts({
            slotPaths,
            prefilter,
            score: nextSlotState.score,
            decision: nextSlotState.decision,
          });
          Object.assign(slot, nextSlotState);
          slotResults.push(nextSlotState);
          roundState.slots.push(snapshotSlotForRound(nextSlotState));
          roundState.summary.blockedCount += 1;
          continue;
        }

        const judgingStartedAt = Date.now();
        const [gptDelta, claudeDelta, gptRegression, claudeRegression] = await Promise.all([
          judgeLimit(() =>
            runOpenAIDeltaJudgeImpl({
              runType: state.runType,
              officialBaselineImagePath: state.baseline.officialPreviewPath,
              beforeImagePath: parentPreviewPath,
              afterImagePath: slotPaths.previewPath,
              referenceImagePaths: resolvedReferenceImages,
              changeRequest: state.request.requestedChange,
              successChecks: state.request.successChecks,
              guardrails: state.request.guardrails,
              model: gptJudgeModel,
            })
          ),
          judgeLimit(() =>
            runClaudeDeltaJudgeImpl({
              runType: state.runType,
              officialBaselineImagePath: state.baseline.officialPreviewPath,
              beforeImagePath: parentPreviewPath,
              afterImagePath: slotPaths.previewPath,
              referenceImagePaths: resolvedReferenceImages,
              changeRequest: state.request.requestedChange,
              successChecks: state.request.successChecks,
              guardrails: state.request.guardrails,
              model: claudeJudgeModel,
            })
          ),
          judgeLimit(() =>
            runOpenAIRegressionImpl({
              runType: state.runType,
              officialBaselineImagePath: state.baseline.officialPreviewPath,
              beforeImagePath: parentPreviewPath,
              afterImagePath: slotPaths.previewPath,
              referenceImagePaths: resolvedReferenceImages,
              changeRequest: state.request.requestedChange,
              model: gptJudgeModel,
            })
          ),
          judgeLimit(() =>
            runClaudeRegressionImpl({
              runType: state.runType,
              officialBaselineImagePath: state.baseline.officialPreviewPath,
              beforeImagePath: parentPreviewPath,
              afterImagePath: slotPaths.previewPath,
              referenceImagePaths: resolvedReferenceImages,
              changeRequest: state.request.requestedChange,
              model: claudeJudgeModel,
            })
          ),
        ]);
        state.metrics.judgeCalls += 4;
        state.metrics.timingsMs.judging += Date.now() - judgingStartedAt;

        nextSlotState.judges = {
          gptDelta: gptDelta.normalized,
          claudeDelta: claudeDelta.normalized,
          gptRegression: gptRegression.normalized,
          claudeRegression: claudeRegression.normalized,
        };
        nextSlotState.score = scoreHtmlCandidate({
          prefilter,
          gptDelta: gptDelta.normalized,
          claudeDelta: claudeDelta.normalized,
          gptRegression: gptRegression.normalized,
          claudeRegression: claudeRegression.normalized,
        });
        nextSlotState.status = nextSlotState.score.status;
        nextSlotState.decision = {
          outcome: nextSlotState.score.outcome,
          reason: nextSlotState.score.reason,
        };
        await writeSlotEvaluationArtifacts({
          slotPaths,
          prefilter,
          gptDelta: { ...gptDelta.normalized, raw: gptDelta.raw },
          claudeDelta: { ...claudeDelta.normalized, raw: claudeDelta.raw },
          gptRegression: { ...gptRegression.normalized, raw: gptRegression.raw },
          claudeRegression: { ...claudeRegression.normalized, raw: claudeRegression.raw },
          score: nextSlotState.score,
          decision: nextSlotState.decision,
        });
        Object.assign(slot, nextSlotState);
        slotResults.push(nextSlotState);
        roundState.slots.push(snapshotSlotForRound(nextSlotState));
        if (nextSlotState.score.class === "pass") {
          roundState.summary.passCount += 1;
        } else if (nextSlotState.score.class === "retry") {
          roundState.summary.retryCount += 1;
        } else if (nextSlotState.score.class === "blocked") {
          roundState.summary.blockedCount += 1;
        } else {
          roundState.summary.escalatedCount += 1;
        }
      }

      const winners = selectPassingCandidates({
        slotResults,
        targetPassCount: state.config.targetPassCount,
      });
      const retrySlots = slotResults.filter((slot) => slot.score?.class === "retry");
      const slotSyntheses = retrySlots.map((slot) =>
        synthesizeSlotRetryBrief({
          slotId: slot.slotId,
          requestedChange: state.request.requestedChange,
          guardrails: state.request.guardrails,
          prefilter: slot.prefilter,
          gptDelta: slot.judges?.gptDelta,
          claudeDelta: slot.judges?.claudeDelta,
          gptRegression: slot.judges?.gptRegression,
          claudeRegression: slot.judges?.claudeRegression,
        })
      );
      const synthesisStartedAt = Date.now();
      const globalSynthesis = synthesizeGlobalRetryBrief({
        roundNumber,
        slotSyntheses,
      });
      state.metrics.timingsMs.synthesis += Date.now() - synthesisStartedAt;
      for (const synthesis of slotSyntheses) {
        const slot = state.slots.find((entry) => entry.slotId === synthesis.slotId);
        if (slot) {
          slot.retryBrief = synthesis.markdown;
          slot.status = "judged_retry";
        }
      }
      roundState.retrySynthesis = {
        global: globalSynthesis.markdown,
        slotLocal: Object.fromEntries(
          slotSyntheses.map((entry) => [entry.slotId, entry.markdown])
        ),
      };
      roundState.completedAt = nowIso();
      roundState.status = "completed";
      state.rounds.push(roundState);
      state = await writeHtmlEditRunState(runDir, state);
      await writeRoundArtifacts({
        runDir,
        roundNumber,
        roundState,
        synthesisMarkdown: globalSynthesis.markdown,
      });

      if (winners.length >= state.config.targetPassCount) {
        const winner = winners[0];
        const winnerPayload = buildWinnerPayload({
          runId: state.runId,
          roundNumber,
          slot: winner,
        });
        state.winner = winnerPayload;
        await writeWinnerDoc({ runDir, winner: winnerPayload });

        if (!promoteOnPass) {
          if (materializeWinnerToArtifactRoot) {
            await promoteWinnerToArtifactDir({
              artifactDir: state.artifactDir,
              winner,
              copyDebugFiles: false,
            });
          }
          state.status = "succeeded";
          state = await writeHtmlEditRunState(runDir, state);
          if (report) {
            await writeReport({ runDir, state });
          }
          return {
            ok: true,
            status: state.status,
            runDir,
            state,
          };
        }

        if (!codexReviewFilePath) {
          const reviewPath = resolve(runDir, "codex-review.md");
          await writeFile(
            reviewPath,
            `${buildCodexMicroReviewTemplate({
              changeRequest: state.request.requestedChange,
              deltaSummary: winner.score.reason,
              regressionSummary:
                winner.judges?.gptRegression?.rationale ||
                winner.judges?.claudeRegression?.rationale ||
                "",
              blockers: winner.score.blockers ?? [],
            })}\n`,
            "utf8"
          );
          state.pendingCodexReview = {
            ...winner,
            roundNumber,
            codexReviewPath: reviewPath,
          };
          state.status = "needs-codex-review";
          state = await writeHtmlEditRunState(runDir, state);
          if (report) {
            await writeReport({ runDir, state });
          }
          return {
            ok: false,
            status: state.status,
            runDir,
            state,
          };
        }

        const review = parseCodexMicroReview(await readFile(codexReviewFilePath, "utf8"));
        if (review.verdict === "block") {
          state.status = "needs-human";
          state.failureReason = `Codex/operator micro-review blocked promotion. ${review.verdictText}`;
          state = await writeHtmlEditRunState(runDir, state);
          if (report) {
            await writeReport({ runDir, state });
          }
          return {
            ok: false,
            status: state.status,
            runDir,
            state,
          };
        }

        const promotedHtmlPath = await promoteWinnerToArtifactDir({
          artifactDir: state.artifactDir,
          winner,
          copyDebugFiles: state.copyDebugFiles ?? true,
        });
        if (promoteVersionAfterMaterialize) {
          await promoteVersionContextPath(promotedHtmlPath);
        }
        state.status = "succeeded";
        state = await writeHtmlEditRunState(runDir, state);
        if (report) {
          await writeReport({ runDir, state });
        }
        return {
          ok: true,
          status: state.status,
          runDir,
          state,
        };
      }
    }

    if (!state.winner) {
      state.status = "failed";
      state.failureReason =
        "Reached stop conditions without a promotable winner.";
      state = await writeHtmlEditRunState(runDir, state);
    }
    if (report) {
      await writeReport({ runDir, state });
    }
    return {
      ok: false,
      status: state.status,
      runDir,
      state,
    };
  } finally {
    await screenshotPool.close();
  }
};
