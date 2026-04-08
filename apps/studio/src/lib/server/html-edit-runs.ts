import { existsSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { basename, resolve } from "node:path";

import { classifyPathReference } from "../../../../../lib/repo/index.mjs";
import type { StudioAssetKind, StudioAssetRef } from "../presentation/designer-studio-types.ts";
import { getDesignerStudioSlideContext } from "./designer-studio.ts";
import {
  resolveStudioDesignerDataPath,
  toStudioDesignerDataRelativePath,
} from "./designer-paths.ts";
import { resolveRepoRoot } from "./repo-contract.ts";

type HtmlEditRunState = {
  runId?: string;
  status?: string;
  mode?: string;
  surface?: string;
  createdAt?: string;
  updatedAt?: string;
  artifactDir?: string;
  projectRoot?: string | null;
  slideId?: string | null;
  versionId?: string | null;
  baseline?: {
    officialPreviewPath?: string | null;
    parentPreviewPath?: string | null;
    parentHtmlPath?: string | null;
    approvedRegionsPath?: string | null;
  };
  request?: {
    requestedChange?: string | null;
    successChecks?: string | null;
    guardrails?: string | null;
    approvedRegions?: Array<{
      id?: string | null;
      label?: string | null;
      freezeLevel?: string | null;
    }>;
    referenceIntent?: string | null;
    stopIf?: string | null;
  };
  rounds?: Array<{
    roundNumber?: number;
    status?: string;
    startedAt?: string | null;
    completedAt?: string | null;
    summary?: {
      passCount?: number;
      retryCount?: number;
      blockedCount?: number;
      escalatedCount?: number;
    } | null;
    retrySynthesis?: {
      global?: string | null;
      slotLocal?: Record<string, string>;
    } | null;
    slots?: Array<{
      slotId?: string;
      provider?: string | null;
      model?: string | null;
      settings?: Record<string, unknown> | null;
      status?: string;
      attemptNumber?: number;
      attemptDir?: string | null;
      retryBrief?: string | null;
      before?: {
        officialPreviewPath?: string | null;
        parentPreviewPath?: string | null;
        parentHtmlPath?: string | null;
      } | null;
      after?: {
        htmlPath?: string | null;
        previewPath?: string | null;
      } | null;
      score?: {
        class?: string | null;
        numeric?: number | null;
        status?: string | null;
        outcome?: string | null;
        reason?: string | null;
        blockers?: string[];
      } | null;
      decision?: {
        outcome?: string | null;
        reason?: string | null;
      } | null;
      lockedRegions?: {
        violations?: Array<{
          regionId?: string | null;
          label?: string | null;
          freezeLevel?: string | null;
          blocked?: boolean;
          warning?: boolean;
          reason?: string | null;
        }>;
      } | null;
      judges?: {
        gptDelta?: {
          status?: string | null;
          summary?: string | null;
          evidence?: string[];
        } | null;
        claudeDelta?: {
          status?: string | null;
          summary?: string | null;
          evidence?: string[];
        } | null;
        gptRegression?: {
          verdict?: string | null;
          rationale?: string | null;
          blockers?: string[];
        } | null;
        claudeRegression?: {
          verdict?: string | null;
          rationale?: string | null;
          blockers?: string[];
        } | null;
      } | null;
    }>;
  }>;
  attempts?: Array<{
    label?: string | null;
    attemptDir?: string | null;
    beforeImagePath?: string | null;
    afterImagePath?: string | null;
    outcome?: string | null;
    nextAction?: string | null;
    blockers?: string[];
  }>;
  winner?: {
    slotId?: string | null;
    provider?: string | null;
    roundNumber?: number | null;
    status?: string | null;
    score?: {
      class?: string | null;
      outcome?: string | null;
      reason?: string | null;
      blockers?: string[];
    } | null;
    decision?: {
      outcome?: string | null;
      reason?: string | null;
    } | null;
    attemptDir?: string | null;
    htmlPath?: string | null;
    previewPath?: string | null;
  } | null;
  pendingCodexReview?: {
    slotId?: string | null;
    provider?: string | null;
    roundNumber?: number | null;
    codexReviewPath?: string | null;
    attemptDir?: string | null;
    previewPath?: string | null;
  } | null;
  failureReason?: string | null;
};

export type StudioHtmlEditRunSummary = {
  runId: string;
  schema: "multimodal-html-edit" | "legacy-gemini-tune";
  status: string;
  mode: string | null;
  surface: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  artifactDir: StudioAssetRef | null;
  runDir: StudioAssetRef | null;
  requestMarkdown: StudioAssetRef | null;
  requestJson: StudioAssetRef | null;
  report: StudioAssetRef | null;
  state: StudioAssetRef | null;
  winner: {
    slotId: string | null;
    provider: string | null;
    roundNumber: number | null;
    preview: StudioAssetRef | null;
  } | null;
  roundsCount: number;
  slotCount: number;
  legacyAttemptCount: number;
  needsCodexReview: boolean;
};

export type StudioHtmlEditRunSlotDetail = {
  slotId: string;
  provider: string | null;
  model: string | null;
  settings: Record<string, unknown> | null;
  status: string;
  attemptNumber: number;
  retryBrief: string | null;
  parentPreview: StudioAssetRef | null;
  parentHtml: StudioAssetRef | null;
  candidatePreview: StudioAssetRef | null;
  candidateHtml: StudioAssetRef | null;
  prompt: StudioAssetRef | null;
  prefilter: StudioAssetRef | null;
  scoreFile: StudioAssetRef | null;
  decisionFile: StudioAssetRef | null;
  gptDeltaFile: StudioAssetRef | null;
  claudeDeltaFile: StudioAssetRef | null;
  gptRegressionFile: StudioAssetRef | null;
  claudeRegressionFile: StudioAssetRef | null;
  score: {
    class: string | null;
    outcome: string | null;
    reason: string | null;
    blockers: string[];
  } | null;
  decision: {
    outcome: string | null;
    reason: string | null;
  } | null;
  lockedViolations: Array<{
    regionId: string | null;
    label: string | null;
    freezeLevel: string | null;
    blocked: boolean;
    warning: boolean;
    reason: string | null;
  }>;
  judges: {
    gptDelta: {
      status: string | null;
      summary: string | null;
      evidence: string[];
    } | null;
    claudeDelta: {
      status: string | null;
      summary: string | null;
      evidence: string[];
    } | null;
    gptRegression: {
      verdict: string | null;
      rationale: string | null;
      blockers: string[];
    } | null;
    claudeRegression: {
      verdict: string | null;
      rationale: string | null;
      blockers: string[];
    } | null;
  };
};

export type StudioHtmlEditRunRoundDetail = {
  roundNumber: number;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  summary: {
    passCount: number;
    retryCount: number;
    blockedCount: number;
    escalatedCount: number;
  };
  synthesisMarkdown: string | null;
  slots: StudioHtmlEditRunSlotDetail[];
};

export type StudioLegacyHtmlEditAttempt = {
  label: string;
  attemptDir: StudioAssetRef | null;
  beforePreview: StudioAssetRef | null;
  afterPreview: StudioAssetRef | null;
  outcome: string | null;
  nextAction: string | null;
  blockers: string[];
};

export type StudioHtmlEditRunDetail = StudioHtmlEditRunSummary & {
  request: {
    requestedChange: string | null;
    successChecks: string | null;
    guardrails: string | null;
    referenceIntent: string | null;
    stopIf: string | null;
    approvedRegions: Array<{
      id: string | null;
      label: string | null;
      freezeLevel: string | null;
    }>;
  };
  baseline: {
    officialPreview: StudioAssetRef | null;
    parentPreview: StudioAssetRef | null;
    parentHtml: StudioAssetRef | null;
    approvedRegions: StudioAssetRef | null;
  };
  rounds: StudioHtmlEditRunRoundDetail[];
  legacyAttempts: StudioLegacyHtmlEditAttempt[];
  winnerHtml: StudioAssetRef | null;
  winnerPreview: StudioAssetRef | null;
  pendingCodexReview: {
    slotId: string | null;
    provider: string | null;
    roundNumber: number | null;
    reviewFile: StudioAssetRef | null;
  } | null;
  winnerFile: StudioAssetRef | null;
  codexReviewTemplate: StudioAssetRef | null;
  failureReason: string | null;
};

type SlideRunRoot = {
  artifactDir: string;
  surface: string;
};

const MULTIMODAL_HTML_SURFACES = new Set([
  "gemini-html",
  "openai-html",
  "codex-html",
]);

const readJsonFile = <T>(absolutePath: string): T =>
  JSON.parse(readFileSync(absolutePath, "utf8")) as T;

const safeReadDir = async (absolutePath: string) => {
  if (!existsSync(absolutePath)) {
    return [];
  }
  try {
    return await readdir(absolutePath, { withFileTypes: true });
  } catch {
    return [];
  }
};

const createAssetRef = (
  absolutePath: string,
  displayPath: string,
  kind: StudioAssetKind,
  label?: string,
  provenance = "checked-in-generated"
): StudioAssetRef => ({
  path: displayPath,
  absolutePath,
  exists: existsSync(absolutePath),
  label,
  provenance,
  canonicalNavigation: true,
  kind,
});

const createClassifiedAssetRef = async (
  repoRoot: string,
  pathLike: string | null | undefined,
  kind: StudioAssetKind,
  label?: string
): Promise<StudioAssetRef | null> => {
  if (!pathLike) {
    return null;
  }
  const classified = classifyPathReference(repoRoot, pathLike);
  if (
    classified.kind === "repo-relative" &&
    classified.repoRelativePath &&
    classified.absolutePath
  ) {
    const ref = createAssetRef(
      classified.absolutePath,
      classified.repoRelativePath,
      kind,
      label
    );
    return ref.exists ? ref : null;
  }

  const absolutePath = resolveStudioDesignerDataPath(pathLike);
  const relativePath = absolutePath
    ? toStudioDesignerDataRelativePath(absolutePath)
    : null;
  if (!absolutePath || !relativePath) {
    return null;
  }
  const ref = createAssetRef(
    absolutePath,
    relativePath,
    kind,
    label,
    "artifact-store"
  );
  return ref.exists ? ref : null;
};

const createMaybeFileRef = async (
  repoRoot: string,
  absolutePath: string | null | undefined,
  kind: StudioAssetKind,
  label?: string
) => {
  if (!absolutePath || !existsSync(absolutePath)) {
    return null;
  }
  return createClassifiedAssetRef(repoRoot, absolutePath, kind, label);
};

const inferSchema = (state: HtmlEditRunState): "multimodal-html-edit" | "legacy-gemini-tune" =>
  Array.isArray(state.rounds) ? "multimodal-html-edit" : "legacy-gemini-tune";

const collectSlideRunRoots = async (
  slide: Awaited<ReturnType<typeof getDesignerStudioSlideContext>>["slide"]
) => {
  if (!slide) {
    return [];
  }
  const roots = new Map<string, SlideRunRoot>();
  if (slide.stampedDir?.absolutePath) {
    roots.set(slide.stampedDir.absolutePath, {
      artifactDir: slide.stampedDir.absolutePath,
      surface: "current-html",
    });
  }
  for (const version of slide.versions) {
    const versionDir = version.dir.absolutePath;
    if (!versionDir) {
      continue;
    }
    const entries = await safeReadDir(versionDir);
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      if (!MULTIMODAL_HTML_SURFACES.has(entry.name) && entry.name !== "tune") {
        continue;
      }
      const artifactDir = entry.name === "tune" ? versionDir : resolve(versionDir, entry.name);
      const tuneDir = resolve(artifactDir, "tune");
      if (!existsSync(tuneDir)) {
        continue;
      }
      roots.set(artifactDir, {
        artifactDir,
        surface: entry.name === "tune" ? "current-html" : entry.name,
      });
    }
  }
  return [...roots.values()];
};

export const __test_collectSlideRunRoots = collectSlideRunRoots;

const listRunDirectories = async (artifactDir: string) => {
  const tuneDir = resolve(artifactDir, "tune");
  const entries = await safeReadDir(tuneDir);
  return entries
    .filter((entry) => entry.isDirectory() && existsSync(resolve(tuneDir, entry.name, "state.json")))
    .map((entry) => resolve(tuneDir, entry.name));
};

const buildSummaryFromState = async ({
  repoRoot,
  state,
  runDir,
  surface,
}: {
  repoRoot: string;
  state: HtmlEditRunState;
  runDir: string;
  surface: string;
}): Promise<StudioHtmlEditRunSummary> => {
  const requestMarkdownPath = ["request.md", "change-request.md"]
    .map((name) => resolve(runDir, name))
    .find((path) => existsSync(path)) ?? null;
  const requestJsonPath = ["request.json", "meta.json"]
    .map((name) => resolve(runDir, name))
    .find((path) => existsSync(path)) ?? null;
  const reportPath = resolve(runDir, "report.html");
  const statePath = resolve(runDir, "state.json");
  const winnerPreviewPath = state.winner?.previewPath ?? null;
  const summary = {
    runId: String(state.runId ?? basename(runDir)),
    schema: inferSchema(state),
    status: String(state.status ?? "unknown"),
    mode: state.mode ?? null,
    surface: state.surface ?? surface ?? null,
    createdAt: state.createdAt ?? null,
    updatedAt: state.updatedAt ?? null,
    artifactDir: await createMaybeFileRef(
      repoRoot,
      state.artifactDir ?? null,
      "directory",
      "Artifact Dir"
    ),
    runDir: await createMaybeFileRef(repoRoot, runDir, "directory", "Run Dir"),
    requestMarkdown: await createMaybeFileRef(
      repoRoot,
      requestMarkdownPath,
      "other",
      "Request Markdown"
    ),
    requestJson: await createMaybeFileRef(repoRoot, requestJsonPath, "json", "Request JSON"),
    report: await createMaybeFileRef(repoRoot, reportPath, "html", "Run Report"),
    state: await createMaybeFileRef(repoRoot, statePath, "json", "Run State"),
    winner: state.winner
      ? {
          slotId: state.winner.slotId ?? null,
          provider: state.winner.provider ?? null,
          roundNumber: state.winner.roundNumber ?? null,
          preview: await createMaybeFileRef(
            repoRoot,
            winnerPreviewPath,
            "image",
            "Winner Preview"
          ),
        }
      : null,
    roundsCount: Array.isArray(state.rounds) ? state.rounds.length : 0,
    slotCount: Array.isArray(state.rounds)
      ? new Set(
          state.rounds.flatMap((round) => (round.slots ?? []).map((slot) => slot.slotId ?? ""))
        ).size
      : 0,
    legacyAttemptCount: Array.isArray(state.attempts) ? state.attempts.length : 0,
    needsCodexReview: state.status === "needs-codex-review",
  };
  return summary;
};

const buildRoundSlotDetails = async ({
  repoRoot,
  slot,
}: {
  repoRoot: string;
  slot: NonNullable<NonNullable<HtmlEditRunState["rounds"]>[number]["slots"]>[number];
}): Promise<StudioHtmlEditRunSlotDetail> => {
  const attemptDir = slot.attemptDir ? resolve(slot.attemptDir) : null;
  const slotId = String(slot.slotId ?? "slot");
  return {
    slotId,
    provider: slot.provider ?? null,
    model: slot.model ?? null,
    settings: slot.settings ?? null,
    status: String(slot.status ?? "unknown"),
    attemptNumber: Number(slot.attemptNumber ?? 0),
    retryBrief: slot.retryBrief ?? null,
    parentPreview: await createMaybeFileRef(
      repoRoot,
      slot.before?.parentPreviewPath ?? null,
      "image",
      "Parent Preview"
    ),
    parentHtml: await createMaybeFileRef(
      repoRoot,
      slot.before?.parentHtmlPath ?? null,
      "html",
      "Parent HTML"
    ),
    candidatePreview: await createMaybeFileRef(
      repoRoot,
      slot.after?.previewPath ?? null,
      "image",
      "Candidate Preview"
    ),
    candidateHtml: await createMaybeFileRef(
      repoRoot,
      slot.after?.htmlPath ?? null,
      "html",
      "Candidate HTML"
    ),
    prompt: await createMaybeFileRef(
      repoRoot,
      attemptDir ? resolve(attemptDir, "prompt.txt") : null,
      "other",
      "Prompt"
    ),
    prefilter: await createMaybeFileRef(
      repoRoot,
      attemptDir ? resolve(attemptDir, "prefilter.json") : null,
      "json",
      "Prefilter"
    ),
    scoreFile: await createMaybeFileRef(
      repoRoot,
      attemptDir ? resolve(attemptDir, "score.json") : null,
      "json",
      "Score"
    ),
    decisionFile: await createMaybeFileRef(
      repoRoot,
      attemptDir ? resolve(attemptDir, "decision.json") : null,
      "json",
      "Decision"
    ),
    gptDeltaFile: await createMaybeFileRef(
      repoRoot,
      attemptDir ? resolve(attemptDir, "gpt-delta.json") : null,
      "json",
      "GPT Delta"
    ),
    claudeDeltaFile: await createMaybeFileRef(
      repoRoot,
      attemptDir ? resolve(attemptDir, "claude-delta.json") : null,
      "json",
      "Claude Delta"
    ),
    gptRegressionFile: await createMaybeFileRef(
      repoRoot,
      attemptDir ? resolve(attemptDir, "gpt-regression.json") : null,
      "json",
      "GPT Regression"
    ),
    claudeRegressionFile: await createMaybeFileRef(
      repoRoot,
      attemptDir ? resolve(attemptDir, "claude-regression.json") : null,
      "json",
      "Claude Regression"
    ),
    score: slot.score
      ? {
          class: slot.score.class ?? null,
          outcome: slot.score.outcome ?? null,
          reason: slot.score.reason ?? null,
          blockers: Array.isArray(slot.score.blockers) ? slot.score.blockers : [],
        }
      : null,
    decision: slot.decision
      ? {
          outcome: slot.decision.outcome ?? null,
          reason: slot.decision.reason ?? null,
        }
      : null,
    lockedViolations: Array.isArray(slot.lockedRegions?.violations)
      ? slot.lockedRegions?.violations.map((violation) => ({
          regionId: violation.regionId ?? null,
          label: violation.label ?? null,
          freezeLevel: violation.freezeLevel ?? null,
          blocked: Boolean(violation.blocked),
          warning: Boolean(violation.warning),
          reason: violation.reason ?? null,
        }))
      : [],
    judges: {
      gptDelta: slot.judges?.gptDelta
        ? {
            status: slot.judges.gptDelta.status ?? null,
            summary: slot.judges.gptDelta.summary ?? null,
            evidence: Array.isArray(slot.judges.gptDelta.evidence)
              ? slot.judges.gptDelta.evidence
              : [],
          }
        : null,
      claudeDelta: slot.judges?.claudeDelta
        ? {
            status: slot.judges.claudeDelta.status ?? null,
            summary: slot.judges.claudeDelta.summary ?? null,
            evidence: Array.isArray(slot.judges.claudeDelta.evidence)
              ? slot.judges.claudeDelta.evidence
              : [],
          }
        : null,
      gptRegression: slot.judges?.gptRegression
        ? {
            verdict: slot.judges.gptRegression.verdict ?? null,
            rationale: slot.judges.gptRegression.rationale ?? null,
            blockers: Array.isArray(slot.judges.gptRegression.blockers)
              ? slot.judges.gptRegression.blockers
              : [],
          }
        : null,
      claudeRegression: slot.judges?.claudeRegression
        ? {
            verdict: slot.judges.claudeRegression.verdict ?? null,
            rationale: slot.judges.claudeRegression.rationale ?? null,
            blockers: Array.isArray(slot.judges.claudeRegression.blockers)
              ? slot.judges.claudeRegression.blockers
              : [],
          }
        : null,
    },
  };
};

const buildLegacyAttempts = async ({
  repoRoot,
  state,
}: {
  repoRoot: string;
  state: HtmlEditRunState;
}): Promise<StudioLegacyHtmlEditAttempt[]> =>
  Promise.all(
    (state.attempts ?? []).map(async (attempt) => ({
      label: String(attempt.label ?? "attempt"),
      attemptDir: await createMaybeFileRef(
        repoRoot,
        attempt.attemptDir ?? null,
        "directory",
        "Attempt Dir"
      ),
      beforePreview: await createMaybeFileRef(
        repoRoot,
        attempt.beforeImagePath ?? null,
        "image",
        "Before Preview"
      ),
      afterPreview: await createMaybeFileRef(
        repoRoot,
        attempt.afterImagePath ?? null,
        "image",
        "After Preview"
      ),
      outcome: attempt.outcome ?? null,
      nextAction: attempt.nextAction ?? null,
      blockers: Array.isArray(attempt.blockers) ? attempt.blockers : [],
    }))
  );

const buildRunDetail = async ({
  repoRoot,
  state,
  summary,
  runDir,
}: {
  repoRoot: string;
  state: HtmlEditRunState;
  summary: StudioHtmlEditRunSummary;
  runDir: string;
}): Promise<StudioHtmlEditRunDetail> => ({
  ...summary,
  request: {
    requestedChange: state.request?.requestedChange ?? null,
    successChecks: state.request?.successChecks ?? null,
    guardrails: state.request?.guardrails ?? null,
    referenceIntent: state.request?.referenceIntent ?? null,
    stopIf: state.request?.stopIf ?? null,
    approvedRegions: Array.isArray(state.request?.approvedRegions)
      ? state.request?.approvedRegions.map((region) => ({
          id: region.id ?? null,
          label: region.label ?? null,
          freezeLevel: region.freezeLevel ?? null,
        }))
      : [],
  },
  baseline: {
    officialPreview: await createMaybeFileRef(
      repoRoot,
      state.baseline?.officialPreviewPath ?? null,
      "image",
      "Official Baseline"
    ),
    parentPreview: await createMaybeFileRef(
      repoRoot,
      state.baseline?.parentPreviewPath ?? null,
      "image",
      "Parent Preview"
    ),
    parentHtml: await createMaybeFileRef(
      repoRoot,
      state.baseline?.parentHtmlPath ?? null,
      "html",
      "Parent HTML"
    ),
    approvedRegions: await createMaybeFileRef(
      repoRoot,
      state.baseline?.approvedRegionsPath ?? null,
      "json",
      "Approved Regions"
    ),
  },
  rounds: await Promise.all(
    (state.rounds ?? []).map(async (round) => ({
      roundNumber: Number(round.roundNumber ?? 0),
      status: String(round.status ?? "unknown"),
      startedAt: round.startedAt ?? null,
      completedAt: round.completedAt ?? null,
      summary: {
        passCount: Number(round.summary?.passCount ?? 0),
        retryCount: Number(round.summary?.retryCount ?? 0),
        blockedCount: Number(round.summary?.blockedCount ?? 0),
        escalatedCount: Number(round.summary?.escalatedCount ?? 0),
      },
      synthesisMarkdown: round.retrySynthesis?.global ?? null,
      slots: await Promise.all(
        (round.slots ?? []).map((slot) =>
          buildRoundSlotDetails({
            repoRoot,
            slot,
          })
        )
      ),
    }))
  ),
  legacyAttempts: await buildLegacyAttempts({
    repoRoot,
    state,
  }),
  winnerHtml: await createMaybeFileRef(
    repoRoot,
    state.winner?.htmlPath ?? null,
    "html",
    "Winner HTML"
  ),
  winnerPreview: await createMaybeFileRef(
    repoRoot,
    state.winner?.previewPath ?? null,
    "image",
    "Winner Preview"
  ),
  pendingCodexReview: state.pendingCodexReview
    ? {
        slotId: state.pendingCodexReview.slotId ?? null,
        provider: state.pendingCodexReview.provider ?? null,
        roundNumber: state.pendingCodexReview.roundNumber ?? null,
        reviewFile: await createMaybeFileRef(
          repoRoot,
          state.pendingCodexReview.codexReviewPath ?? null,
          "other",
          "Codex Review"
        ),
      }
    : null,
  winnerFile: await createMaybeFileRef(repoRoot, resolve(runDir, "winner.json"), "json", "Winner"),
  codexReviewTemplate: await createMaybeFileRef(
    repoRoot,
    resolve(runDir, "codex-review.md"),
    "other",
    "Codex Review Template"
  ),
  failureReason: state.failureReason ?? null,
});

const loadRunSummary = async ({
  repoRoot,
  runDir,
  surface,
}: {
  repoRoot: string;
  runDir: string;
  surface: string;
}) => {
  const statePath = resolve(runDir, "state.json");
  if (!existsSync(statePath)) {
    return null;
  }
  const state = readJsonFile<HtmlEditRunState>(statePath);
  return buildSummaryFromState({
    repoRoot,
    state,
    runDir,
    surface,
  });
};

const collectRunEntriesForSlide = async ({
  repoRoot,
  slide,
}: {
  repoRoot: string;
  slide: Awaited<ReturnType<typeof getDesignerStudioSlideContext>>["slide"];
}) => {
  if (!slide) {
    return {
      slide: null,
      entries: [],
    };
  }

  const roots = await collectSlideRunRoots(slide);
  const entries: Array<{
    runDir: string;
    surface: string;
    summary: StudioHtmlEditRunSummary;
  }> = [];

  for (const root of roots) {
    const runDirs = await listRunDirectories(root.artifactDir);
    for (const runDir of runDirs) {
      const summary = await loadRunSummary({
        repoRoot,
        runDir,
        surface: root.surface,
      });
      if (!summary) {
        continue;
      }
      entries.push({
        runDir,
        surface: root.surface,
        summary,
      });
    }
  }

  entries.sort((left, right) => {
    const leftTime = left.summary.updatedAt ? Date.parse(left.summary.updatedAt) : 0;
    const rightTime = right.summary.updatedAt ? Date.parse(right.summary.updatedAt) : 0;
    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }
    return right.summary.runId.localeCompare(left.summary.runId);
  });

  return {
    slide,
    entries,
  };
};

export const getDesignerStudioSlideRunSummaries = async (slideId: string) => {
  const repoRoot = await resolveRepoRoot();
  const { slide } = await getDesignerStudioSlideContext(slideId);
  const { entries } = await collectRunEntriesForSlide({ repoRoot, slide });
  return entries.map((entry) => entry.summary);
};

export const getDesignerStudioSlideRun = async (slideId: string, runId: string) => {
  const repoRoot = await resolveRepoRoot();
  const slideContextPromise = getDesignerStudioSlideContext(slideId);
  const runDataPromise = slideContextPromise.then(({ slide }) =>
    collectRunEntriesForSlide({
      repoRoot,
      slide,
    })
  );
  const [{ deck, slide, canonicalParam }, runData] = await Promise.all([
    slideContextPromise,
    runDataPromise,
  ]);
  const matched = runData.entries.find((entry) => entry.summary.runId === runId) ?? null;
  if (!slide || !matched) {
    return {
      deck,
      slide,
      canonicalParam,
      run: null,
    };
  }
  const state = readJsonFile<HtmlEditRunState>(resolve(matched.runDir, "state.json"));
  const run = await buildRunDetail({
    repoRoot,
    state,
    summary: matched.summary,
    runDir: matched.runDir,
  });
  return {
    deck,
    slide,
    canonicalParam,
    run,
  };
};
