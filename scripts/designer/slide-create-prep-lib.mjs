import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  getActiveDeckSlides,
  resolveDeckSlideEntry,
} from "../../lib/repo/read-deck-spec.mjs";
import { REPO_ROOT } from "../figures/lib/constants.mjs";
import { readJson, writeJson } from "../figures/lib/io.mjs";
import {
  createSlideVersion,
  getProjectedRootArtifactPaths,
  getSlideNotesDir,
  getVersionDir,
  readReconciledSlideManifest,
  readVersionDoc,
  resolveSlideVersionContext,
} from "../figures/lib/slide-versioning.mjs";
import { captureHtmlScreenshot } from "../utils/html-screenshot-lib.mjs";
import { buildSlideCreateRequest } from "./private/slide-create-brief.mjs";
import { selectSlideCreateLane } from "./private/slide-create-lane-selector.mjs";
import {
  ensureTemplateSeedSnapshot,
  seedVersionFromTemplate,
} from "./private/slide-create-seed.mjs";

export const DEFAULT_DESIGNER_PROJECT_ROOT = resolve(
  process.cwd(),
  "projects",
  "designer-health"
);
export const DEFAULT_DESIGNER_TEMPLATE_ID = "designer-deck-template-v1";

const resolveRepoPath = (value, fallbackBase = REPO_ROOT) => {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }
  if (raw.startsWith("/")) {
    return resolve(raw);
  }
  return resolve(fallbackBase, raw);
};

const readTextIfExists = async (filePath) => {
  if (!filePath || !existsSync(filePath)) {
    return "";
  }
  return readFile(filePath, "utf8");
};

const readReferenceFileSnapshot = async (filePath) => {
  const resolvedPath = resolve(String(filePath));
  try {
    return {
      path: resolvedPath,
      content: await readFile(resolvedPath, "utf8"),
    };
  } catch {
    return {
      path: resolvedPath,
      content: "",
    };
  }
};

const loadDeckSpec = async (projectRoot) =>
  readJson(resolve(projectRoot, "deck-spec.json"));

const resolveAdjacentOfficialPreviews = async ({
  projectRoot,
  deckSpec,
  slideId,
}) => {
  const slides = getActiveDeckSlides(deckSpec);
  const index = slides.findIndex((entry) => entry?.id === slideId);
  if (index < 0) {
    return [];
  }

  const neighbors = [slides[index - 1], slides[index + 1]].filter(Boolean);
  const results = [];
  for (const entry of neighbors) {
    const context = await resolveSlideVersionContext({
      projectRoot,
      slideId: entry.id,
    });
    const manifest = await readReconciledSlideManifest({
      projectRoot,
      slideId: entry.id,
      slideDir: context.slideDir,
    });
    if (!manifest.currentVersionId) {
      continue;
    }
    const previewPath = getProjectedRootArtifactPaths({
      slideDir: context.slideDir,
      slideDirName: context.slideDirName,
      versionId: manifest.currentVersionId,
    }).pngPath;
    if (!existsSync(previewPath)) {
      continue;
    }
    results.push({
      slideId: entry.id,
      displayNumber: entry.displayNumber ?? null,
      title: entry.title ?? null,
      versionId: manifest.currentVersionId,
      previewPath,
    });
  }
  return results;
};

const resolveTemplateContract = ({ deckSpec, projectRoot, templateId }) => {
  const deckTemplate = deckSpec?.template ?? {};
  const resolvedTemplateId =
    String(templateId ?? "").trim() ||
    deckTemplate.id ||
    DEFAULT_DESIGNER_TEMPLATE_ID;
  const templateDir =
    resolveRepoPath(deckTemplate?.paths?.templateDir) ??
    resolve(projectRoot, "templates", resolvedTemplateId);
  return {
    templateId: resolvedTemplateId,
    templateDir,
    contractPath:
      resolveRepoPath(deckTemplate?.paths?.contractPath) ??
      resolve(projectRoot, "designer-deck-template.md"),
    canonicalPreviewPath:
      resolveRepoPath(deckTemplate?.paths?.previewPath) ??
      resolve(templateDir, "template.png"),
    canonicalHtmlPath:
      resolveRepoPath(deckTemplate?.paths?.htmlPath) ??
      resolve(templateDir, "template.html"),
    shellRegionsPath: resolve(templateDir, "shell-regions.json"),
  };
};

const ensureCreateVersion = async ({
  projectRoot,
  slideId,
  slideDir,
  versionId = null,
  label = null,
  lane,
  templateId,
  slideEntry,
}) => {
  if (versionId) {
    const versionDir = await getVersionDir({
      projectRoot,
      slideId,
      slideDir,
      versionId,
    });
    const versionDoc = await readVersionDoc(versionDir);
    if (String(versionDoc?.status ?? "").trim() !== "draft") {
      throw new Error(
        `Version ${versionId} is not a draft and cannot be reused for slide:create.`
      );
    }
    if (String(versionDoc?.sourceKind ?? "").trim() !== "create-draft") {
      throw new Error(
        `Version ${versionId} has sourceKind=${versionDoc?.sourceKind ?? "(missing)"}; slide:create expects a create-draft version.`
      );
    }
    return {
      created: false,
      versionId,
      versionDir,
      versionDoc,
    };
  }

  const created = await createSlideVersion({
    projectRoot,
    slideId,
    slideDir,
    label:
      label ||
      `${slideEntry.selectedVariantId || slideEntry.id || slideId}-create-draft`,
    sourceKind: "create-draft",
    cloneCurrent: false,
    metadata: {
      createLane: lane,
      templateId,
      bootstrapMode: "from-spec",
      runType: "slide-create",
    },
  });
  return {
    created: true,
    versionId: created.versionId,
    versionDir: created.versionDir,
    versionDoc: created.versionDoc,
  };
};

const quoteArg = (value) => {
  const raw = String(value ?? "");
  return /\s/.test(raw) ? JSON.stringify(raw) : raw;
};

const buildRecommendedRunCommand = ({
  projectRoot,
  slideId,
  versionId,
  createRequestPath,
  lane,
  referenceImagePaths = [],
}) => {
  const parts = [
    "npm run slide:create:run --",
    "--project-root",
    quoteArg(projectRoot),
    "--slide",
    quoteArg(slideId),
    "--version-id",
    quoteArg(versionId),
    "--lane",
    quoteArg(lane),
    "--request-file",
    quoteArg(createRequestPath),
  ];
  for (const imagePath of referenceImagePaths) {
    parts.push("--reference-image", quoteArg(imagePath));
  }
  return parts.join(" ");
};

export const prepareDesignerSlideCreate = async ({
  slide,
  projectRoot = DEFAULT_DESIGNER_PROJECT_ROOT,
  lane = "auto",
  label = null,
  templateId = null,
  referenceImagePaths = [],
  referenceFilePaths = [],
  versionId = null,
  force = false,
  screenshotImpl = captureHtmlScreenshot,
}) => {
  const resolvedProjectRoot = resolve(String(projectRoot));
  const deckSpec = await loadDeckSpec(resolvedProjectRoot);
  const slideEntry = resolveDeckSlideEntry({
    deckSpec,
    slide,
  });
  const context = await resolveSlideVersionContext({
    projectRoot: resolvedProjectRoot,
    slideId: slideEntry.id,
  });
  const notesDir = getSlideNotesDir({
    projectRoot: resolvedProjectRoot,
    slideId: slideEntry.id,
    slideDir: context.slideDir,
    slideDirName: context.slideDirName,
  });
  const noteReadmePath = resolve(notesDir, "README.md");
  const packetPath = resolveRepoPath(slideEntry?.paths?.packet) ?? null;
  const resolvedReferenceImagePaths = (Array.isArray(referenceImagePaths)
    ? referenceImagePaths
    : []
  )
    .map((value) => resolve(String(value)))
    .filter(Boolean);
  const resolvedReferenceFilePaths = (Array.isArray(referenceFilePaths)
    ? referenceFilePaths
    : []
  )
    .map((value) => resolve(String(value)))
    .filter(Boolean);
  const laneDecision = selectSlideCreateLane({
    deckSlide: slideEntry,
    referenceImagePaths: resolvedReferenceImagePaths,
    explicitLane: lane,
  });
  const template = resolveTemplateContract({
    deckSpec,
    projectRoot: resolvedProjectRoot,
    templateId,
  });
  const draftVersion = await ensureCreateVersion({
    projectRoot: resolvedProjectRoot,
    slideId: slideEntry.id,
    slideDir: context.slideDir,
    versionId,
    label,
    lane: laneDecision.lane,
    templateId: template.templateId,
    slideEntry,
  });

  const existingGeneratedHtmlPath = resolve(draftVersion.versionDir, "generated.html");
  const existingPreviewPath = resolve(draftVersion.versionDir, "preview.png");
  let seed;
  if (
    force ||
    !existsSync(existingGeneratedHtmlPath) ||
    !existsSync(existingPreviewPath)
  ) {
    seed = await seedVersionFromTemplate({
      versionDir: draftVersion.versionDir,
      templateDir: template.templateDir,
      shellRegionsPath: template.shellRegionsPath,
      screenshotImpl,
    });
  } else {
    seed = {
      generatedHtmlPath: existingGeneratedHtmlPath,
      previewPath: existingPreviewPath,
      ...(await ensureTemplateSeedSnapshot({
        versionDir: draftVersion.versionDir,
        templateDir: template.templateDir,
        shellRegionsPath: template.shellRegionsPath,
        screenshotImpl,
      })),
    };
  }

  const adjacentSlides = await resolveAdjacentOfficialPreviews({
    projectRoot: resolvedProjectRoot,
    deckSpec,
    slideId: slideEntry.id,
  });
  const packetText = await readTextIfExists(packetPath);
  const noteReadmeText = await readTextIfExists(noteReadmePath);
  const referenceFileSnapshots = await Promise.all(
    resolvedReferenceFilePaths.map((filePath) => readReferenceFileSnapshot(filePath))
  );

  const shellRegions = existsSync(seed.snapshotShellRegionsPath ?? "")
    ? await readJson(seed.snapshotShellRegionsPath)
    : existsSync(template.shellRegionsPath)
      ? await readJson(template.shellRegionsPath)
      : [];

  const createRequestPath = resolve(notesDir, "create-request.md");
  const createRequestSnapshotPath = resolve(
    draftVersion.versionDir,
    "create",
    "create-request.snapshot.md"
  );
  const createContextPath = resolve(draftVersion.versionDir, "create", "context.json");
  const requestMarkdown = buildSlideCreateRequest({
    slide: slideEntry,
    lane: laneDecision.lane,
    laneReason: laneDecision.reason,
    templateId: template.templateId,
    draftVersionId: draftVersion.versionId,
    draftVersionDir: draftVersion.versionDir,
    adjacentSlides,
    shellRegions,
    packetPath,
    packetText,
    noteReadmePath: existsSync(noteReadmePath) ? noteReadmePath : null,
    noteReadmeText,
    referenceImagePaths: resolvedReferenceImagePaths,
    referenceFileSnapshots,
  });

  await mkdir(notesDir, { recursive: true });
  if (!existsSync(createRequestPath) || force) {
    await writeFile(createRequestPath, `${requestMarkdown.trim()}\n`, "utf8");
  }
  const checkedInRequestMarkdown = await readFile(createRequestPath, "utf8");
  await writeFile(
    createRequestSnapshotPath,
    `${checkedInRequestMarkdown.trim()}\n`,
    "utf8"
  );

  const createContext = {
    slideId: slideEntry.id,
    displayNumber: slideEntry.displayNumber ?? null,
    lane: laneDecision.lane,
    laneReason: laneDecision.reason,
    createdDraftVersion: draftVersion.created,
    draftVersionId: draftVersion.versionId,
    draftVersionDir: draftVersion.versionDir,
    projectRoot: resolvedProjectRoot,
    slideDir: context.slideDir,
    deckSpecPath: resolve(resolvedProjectRoot, "deck-spec.json"),
    packetPath,
    packetText,
    noteReadmePath: existsSync(noteReadmePath) ? noteReadmePath : null,
    noteReadmeText,
    deckSlide: slideEntry,
    slideEntry,
    adjacentSlides,
    referenceImagePaths: resolvedReferenceImagePaths,
    referenceFilePaths: resolvedReferenceFilePaths,
    referenceFileSnapshots,
    template: {
      templateId: template.templateId,
      templateDir: template.templateDir,
      contractPath: template.contractPath,
      canonicalHtmlPath: template.canonicalHtmlPath,
      canonicalPreviewPath: template.canonicalPreviewPath,
      shellRegionsPath: template.shellRegionsPath,
      seededTemplateHtmlPath: seed.templateHtmlPath,
      seededTemplatePreviewPath: seed.templatePreviewPath,
    },
    seed: {
      generatedHtmlPath: seed.generatedHtmlPath,
      previewPath: seed.previewPath,
      templateHtmlPath: seed.templateHtmlPath,
      templatePreviewPath: seed.templatePreviewPath,
      shellRegionsPath:
        seed.snapshotShellRegionsPath || template.shellRegionsPath || null,
    },
    createRequestPath,
    createRequestSnapshotPath,
  };
  await writeJson(createContextPath, createContext);

  const preferredNextCommand = buildRecommendedRunCommand({
    projectRoot: resolvedProjectRoot,
    slideId: slideEntry.id,
    versionId: draftVersion.versionId,
    createRequestPath,
    lane: laneDecision.lane,
    referenceImagePaths: resolvedReferenceImagePaths,
  });

  return {
    ok: true,
    slideId: slideEntry.id,
    displayNumber: slideEntry.displayNumber ?? null,
    title: slideEntry.title ?? null,
    header: slideEntry.header ?? null,
    subheader: slideEntry.subheader ?? null,
    lane: laneDecision.lane,
    laneReason: laneDecision.reason,
    projectRoot: resolvedProjectRoot,
    slideDir: context.slideDir,
    templateId: template.templateId,
    templateDir: template.templateDir,
    templateContractPath: template.contractPath,
    templateHtmlPath: seed.templateHtmlPath,
    templatePreviewPath: seed.templatePreviewPath,
    shellRegionsPath: seed.snapshotShellRegionsPath || template.shellRegionsPath || null,
    shellRegionsSnapshotPath: seed.snapshotShellRegionsPath || null,
    draftVersionCreated: draftVersion.created,
    draftVersionId: draftVersion.versionId,
    draftVersionDir: draftVersion.versionDir,
    seedHtmlPath: seed.generatedHtmlPath,
    seedPreviewPath: seed.previewPath,
    seed,
    createRequestPath,
    changeFilePath: createRequestPath,
    createRequestSnapshotPath,
    createContextPath,
    adjacentPreviewPaths: adjacentSlides.map((entry) => entry.previewPath),
    referenceImagePaths: resolvedReferenceImagePaths,
    referenceFilePaths: resolvedReferenceFilePaths,
    preferredNextCommand,
  };
};
