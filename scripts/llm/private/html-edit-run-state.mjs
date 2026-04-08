import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  buildDefaultSlotIds,
  buildHtmlEditRunConfig,
  createEmptyRunMetrics,
  createHtmlEditRunId,
  roundDirName,
  slotDirName,
} from "./html-edit-run-schema.mjs";
import { writeJsonDoc } from "../artifact-contract.mjs";

const nowIso = () => new Date().toISOString();

export const getHtmlEditRunPaths = ({ artifactDir, runId }) => {
  const resolvedArtifactDir = resolve(String(artifactDir));
  const resolvedRunId = String(runId).trim();
  const runDir = resolve(resolvedArtifactDir, "tune", resolvedRunId);
  return {
    artifactDir: resolvedArtifactDir,
    runId: resolvedRunId,
    runDir,
    statePath: resolve(runDir, "state.json"),
    requestMarkdownPath: resolve(runDir, "request.md"),
    requestJsonPath: resolve(runDir, "request.json"),
    reportPath: resolve(runDir, "report.html"),
    winnerPath: resolve(runDir, "winner.json"),
    baselineDir: resolve(runDir, "baseline"),
  };
};

export const createInitialHtmlEditRunState = ({
  artifactDir,
  projectRoot = null,
  slideId = null,
  versionId = null,
  runType = "edit",
  surface,
  mode,
  config,
  baseline,
  request,
  runId = createHtmlEditRunId(),
}) => {
  const normalizedConfig = buildHtmlEditRunConfig(config);
  const createdAt = nowIso();
  return {
    runId,
    status: "running",
    runType,
    mode,
    artifactDir: resolve(String(artifactDir)),
    projectRoot: projectRoot ? resolve(String(projectRoot)) : null,
    slideId,
    versionId,
    surface,
    createdAt,
    updatedAt: createdAt,
    config: normalizedConfig,
    baseline,
    request,
    rounds: [],
    slots: buildDefaultSlotIds(normalizedConfig).map((slotId) => ({
      slotId,
      provider: slotId.split("-")[0],
      status: "queued",
      attemptNumber: 0,
      parentSlotId: null,
      parentAttemptRef: "baseline",
      attemptDir: null,
      before: {
        officialPreviewPath: baseline.officialPreviewPath,
        parentPreviewPath: baseline.parentPreviewPath,
        parentHtmlPath: baseline.parentHtmlPath,
      },
      after: {
        htmlPath: null,
        previewPath: null,
      },
      prefilter: null,
      judges: null,
      lockedRegions: {
        violations: [],
      },
      score: null,
      decision: null,
    })),
    winner: null,
    pendingCodexReview: null,
    failureReason: null,
    metrics: createEmptyRunMetrics(),
  };
};

export const loadHtmlEditRunState = async (runDir) =>
  JSON.parse(await readFile(resolve(String(runDir), "state.json"), "utf8"));

export const writeHtmlEditRunState = async (runDir, state) => {
  const nextState = {
    ...state,
    updatedAt: nowIso(),
  };
  await writeJsonDoc(resolve(String(runDir), "state.json"), nextState);
  return nextState;
};

export const ensureHtmlEditRunSkeleton = async ({
  artifactDir,
  runId,
  requestMarkdown,
  requestJson,
  baselineFiles,
  state,
}) => {
  const paths = getHtmlEditRunPaths({ artifactDir, runId });
  await mkdir(paths.baselineDir, { recursive: true });
  await writeFile(paths.requestMarkdownPath, `${String(requestMarkdown ?? "").trim()}\n`, "utf8");
  await writeJsonDoc(paths.requestJsonPath, requestJson);
  for (const [name, sourcePath] of Object.entries(baselineFiles ?? {})) {
    if (!sourcePath) {
      continue;
    }
    const targetPath = resolve(paths.baselineDir, name);
    const raw = await readFile(resolve(String(sourcePath)));
    await writeFile(targetPath, raw);
  }
  await writeHtmlEditRunState(paths.runDir, state);
  return paths;
};

export const getRoundPaths = ({ runDir, roundNumber }) => {
  const roundDir = resolve(String(runDir), roundDirName(roundNumber));
  return {
    roundDir,
    roundJsonPath: resolve(roundDir, "round.json"),
    synthesisPath: resolve(roundDir, "synthesis.md"),
  };
};

export const getSlotPaths = ({ roundDir, slotId }) => {
  const slotDir = resolve(String(roundDir), slotDirName(slotId));
  return {
    slotDir,
    promptPath: resolve(slotDir, "prompt.txt"),
    requestPath: resolve(slotDir, "request.json"),
    htmlPath: resolve(slotDir, "generated.html"),
    previewPath: resolve(slotDir, "preview.png"),
    staticSanityPath: resolve(slotDir, "static-sanity.json"),
    prefilterPath: resolve(slotDir, "prefilter.json"),
    gptDeltaPath: resolve(slotDir, "gpt-delta.json"),
    claudeDeltaPath: resolve(slotDir, "claude-delta.json"),
    gptRegressionPath: resolve(slotDir, "gpt-regression.json"),
    claudeRegressionPath: resolve(slotDir, "claude-regression.json"),
    scorePath: resolve(slotDir, "score.json"),
    decisionPath: resolve(slotDir, "decision.json"),
  };
};

export const writeRoundArtifacts = async ({
  runDir,
  roundNumber,
  roundState,
  synthesisMarkdown,
}) => {
  const paths = getRoundPaths({ runDir, roundNumber });
  await mkdir(paths.roundDir, { recursive: true });
  await writeJsonDoc(paths.roundJsonPath, roundState);
  await writeFile(paths.synthesisPath, `${String(synthesisMarkdown ?? "").trim()}\n`, "utf8");
  return paths;
};

export const writeWinnerDoc = async ({ runDir, winner }) => {
  if (!winner) {
    return null;
  }
  const winnerPath = resolve(String(runDir), "winner.json");
  await writeJsonDoc(winnerPath, winner);
  return winnerPath;
};

export const hasHtmlEditRunState = (runDir) =>
  existsSync(resolve(String(runDir), "state.json"));
