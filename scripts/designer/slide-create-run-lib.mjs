import { existsSync } from "node:fs";
import { copyFile } from "node:fs/promises";
import { resolve } from "node:path";

import { readJson } from "../figures/lib/io.mjs";
import { runHtmlEditRun } from "../llm/html-edit-run-lib.mjs";
import {
  DEFAULT_DESIGNER_PROJECT_ROOT,
  prepareDesignerSlideCreate,
} from "./slide-create-prep-lib.mjs";

const buildPromoteCommand = ({
  projectRoot,
  slideId,
  versionId,
}) =>
  [
    "npm run slide:versions -- promote --",
    `--project-root ${projectRoot}`,
    `--slide ${slideId}`,
    `--version-id ${versionId}`,
  ].join(" ");

const snapshotRequestFile = async ({ requestFilePath, snapshotPath }) => {
  if (!requestFilePath || !snapshotPath) {
    return;
  }
  if (resolve(requestFilePath) === resolve(snapshotPath)) {
    return;
  }
  await copyFile(resolve(requestFilePath), resolve(snapshotPath));
};

const buildNativeHandoff = ({
  slideEntry,
  requestFilePath,
  versionId,
  versionDir,
  projectRoot,
}) => {
  const specPaths = Array.isArray(slideEntry?.paths?.specs)
    ? slideEntry.paths.specs
    : [];
  const leadSpecPath = specPaths[0] || null;
  return {
    status: "native-handoff",
    ok: false,
    message: leadSpecPath
      ? `Native lane is scaffold-only in v1. Use ${leadSpecPath} as the resolved native starting point and carry the checked-in request into the current native figure workflow.`
      : "Native lane is scaffold-only in v1. No native spec path is recorded for this slide yet, so stop here and choose the current native/spec workflow manually.",
    slideId: slideEntry?.id || null,
    requestFilePath,
    versionId,
    versionDir,
    specPaths,
    promoteCommand: buildPromoteCommand({
      projectRoot,
      slideId: slideEntry?.id,
      versionId,
    }),
  };
};

export const runDesignerSlideCreate = async ({
  slide,
  projectRoot = DEFAULT_DESIGNER_PROJECT_ROOT,
  versionId = null,
  lane = "auto",
  label = "",
  templateId = "designer-deck-template-v1",
  requestFilePath = null,
  referenceImagePaths = [],
  referenceFilePaths = [],
  mode = "create",
  providers = "openai,gemini",
  slotsPerProvider = 2,
  targetPassCount = 1,
  maxRounds = 4,
  maxSlotAttempts = 3,
  codexReviewFilePath = null,
  force = false,
  deps = {},
}) => {
  const resolvedProjectRoot = resolve(String(projectRoot));
  const prep = await prepareDesignerSlideCreate({
    slide,
    projectRoot: resolvedProjectRoot,
    lane,
    label,
    templateId,
    referenceImagePaths,
    referenceFilePaths,
    versionId,
    force,
    screenshotImpl: deps.screenshotImpl,
  });

  const contextPayload = existsSync(prep.createContextPath)
    ? await readJson(prep.createContextPath)
    : null;
  const resolvedRequestFilePath = requestFilePath
    ? resolve(String(requestFilePath))
    : prep.createRequestPath;
  await snapshotRequestFile({
    requestFilePath: resolvedRequestFilePath,
    snapshotPath: prep.createRequestSnapshotPath,
  });

  if (prep.lane === "native") {
    return buildNativeHandoff({
      slideEntry: contextPayload?.slideEntry ?? contextPayload?.deckSlide,
      requestFilePath: resolvedRequestFilePath,
      versionId: prep.draftVersionId,
      versionDir: prep.draftVersionDir,
      projectRoot: resolvedProjectRoot,
    });
  }

  const imagePaths = [
    ...(Array.isArray(prep.adjacentPreviewPaths) ? prep.adjacentPreviewPaths : []),
    ...(Array.isArray(prep.referenceImagePaths) ? prep.referenceImagePaths : []),
  ];

  const runResult = await runHtmlEditRun({
    artifactDir: prep.draftVersionDir,
    projectRoot: resolvedProjectRoot,
    slide: prep.slideId,
    versionId: prep.draftVersionId,
    runType: "create",
    surface: "current-html",
    changeFilePath: resolvedRequestFilePath,
    approvedRegionsFilePath: prep.shellRegionsSnapshotPath || prep.shellRegionsPath,
    imagePaths,
    mode: String(mode || "create"),
    baselineOverride: {
      officialPreviewPath: prep.seed.templatePreviewPath,
      officialHtmlPath:
        prep.seed.snapshotTemplateHtmlPath || prep.seed.templateHtmlPath,
      parentPreviewPath: prep.seed.previewPath,
      parentHtmlPath: prep.seed.generatedHtmlPath,
    },
    materializeWinnerToArtifactRoot: true,
    promoteVersionAfterMaterialize: false,
    providers,
    slotsPerProvider,
    targetPassCount,
    maxRounds,
    maxSlotAttempts,
    codexReviewFilePath: codexReviewFilePath
      ? resolve(String(codexReviewFilePath))
      : null,
    deps,
  });

  return {
    ...runResult,
    slideId: prep.slideId,
    lane: prep.lane,
    versionId: prep.draftVersionId,
    versionDir: prep.draftVersionDir,
    changeFilePath: resolvedRequestFilePath,
    createContextPath: prep.createContextPath,
    promoteCommand: buildPromoteCommand({
      projectRoot: resolvedProjectRoot,
      slideId: prep.slideId,
      versionId: prep.draftVersionId,
    }),
  };
};
