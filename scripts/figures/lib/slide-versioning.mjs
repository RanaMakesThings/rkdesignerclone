import { existsSync } from "node:fs";
import {
  cp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, extname, relative, resolve } from "node:path";

import { REPO_ROOT } from "./constants.mjs";
import { readJson, writeJson } from "./io.mjs";
import {
  getProjectSharedCssAbsolutePath,
  normalizeHtmlWithSharedCss,
  rewriteSharedCssHrefInHtml,
  SHARED_CSS_MODE,
} from "./shared-css.mjs";
import { getDesignerDataPaths, toDesignerDataRelativePath } from "../../../lib/repo/designer-data.mjs";
import { touchProjectManifestRefreshToken } from "../../../lib/repo/manifest-cache.mjs";
import { captureHtmlScreenshot } from "../../utils/html-screenshot-lib.mjs";

const ROOT_DOC_ENTRY_NAMES = new Set([
  "manifest.json",
  "versions",
  "README.md",
  "report.html",
  "fine-tune-request.md",
]);

const ROOT_PROJECTED_ARTIFACT_EXTENSIONS = ["html", "png", "svg", "jpg", "webp"];

const TUNE_HISTORY_PREFIXES = ["gemini-html/tune"];
const VERSION_HTML_SOURCE_CANDIDATES = [
  "source-locked.html",
  "generated.html",
  "figure.html",
  "gemini-html/generated.html",
  "openai-html/generated.html",
  "anthropic-html/generated.html",
];
const DEFAULT_REGISTRY = {
  nextVersionNumber: 1,
  versions: {},
};

const slugify = (value, fallback = "version") =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || fallback;

export const normalizeSlideId = (value) => {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) {
    throw new Error("Slide is required.");
  }
  if (/^slide-\d+$/.test(raw)) {
    return `slide-${String(Number(raw.replace("slide-", ""))).padStart(2, "0")}`;
  }
  if (/^\d+$/.test(raw)) {
    return `slide-${String(Number(raw)).padStart(2, "0")}`;
  }
  return raw;
};

export const formatVersionId = (number) =>
  `version-${String(Number(number)).padStart(6, "0")}`;

const VERSION_DIRNAME_PATTERN = /^(version-\d{6})--/i;
const VERSION_ID_PATTERN = /^version-(\d{6})$/i;

const parseVersionNumber = (value) => {
  const match = String(value ?? "").trim().match(VERSION_ID_PATTERN);
  return match ? Number(match[1]) : 0;
};

const getVersionIdFromDirName = (dirName) => {
  const match = String(dirName ?? "").match(VERSION_DIRNAME_PATTERN);
  return match ? match[1] : null;
};

const sortVersionEntries = (entries) =>
  [...(entries ?? [])].sort((left, right) => {
    const byVersion = parseVersionNumber(left?.id) - parseVersionNumber(right?.id);
    if (byVersion !== 0) {
      return byVersion;
    }
    return String(left?.createdAt ?? "").localeCompare(String(right?.createdAt ?? ""));
  });

export const versionDirectoryName = ({ id, label }) =>
  `${id}--${slugify(label, id)}`;

export const getProjectedRootArtifactBaseName = ({ slideDirName, versionId }) =>
  `${String(slideDirName ?? "").trim()}--${String(versionId ?? "").trim()}`;

export const getProjectedRootArtifactName = ({
  slideDirName,
  versionId,
  extension,
}) =>
  `${getProjectedRootArtifactBaseName({ slideDirName, versionId })}.${String(
    extension ?? ""
  ).replace(/^\./, "")}`;

export const getProjectedRootArtifactNames = ({ slideDirName, versionId }) =>
  ROOT_PROJECTED_ARTIFACT_EXTENSIONS.map((extension) =>
    getProjectedRootArtifactName({ slideDirName, versionId, extension })
  );

const getProjectedRootArtifactNameSet = ({ slideDirName, versionId }) =>
  new Set(getProjectedRootArtifactNames({ slideDirName, versionId }));

const PROJECTED_ROOT_ARTIFACT_PATTERN = /^slide-[a-z0-9-]+--version-\d{6}\.(html|png|svg|jpg|webp)$/;

export const getProjectedRootArtifactPath = ({
  slideDir,
  slideDirName = basename(slideDir),
  versionId,
  extension,
}) =>
  resolve(
    slideDir,
    getProjectedRootArtifactName({ slideDirName, versionId, extension })
  );

export const getProjectedRootArtifactPaths = ({
  slideDir,
  slideDirName = basename(slideDir),
  versionId,
}) => ({
  htmlPath: getProjectedRootArtifactPath({
    slideDir,
    slideDirName,
    versionId,
    extension: "html",
  }),
  pngPath: getProjectedRootArtifactPath({
    slideDir,
    slideDirName,
    versionId,
    extension: "png",
  }),
  svgPath: getProjectedRootArtifactPath({
    slideDir,
    slideDirName,
    versionId,
    extension: "svg",
  }),
  jpgPath: getProjectedRootArtifactPath({
    slideDir,
    slideDirName,
    versionId,
    extension: "jpg",
  }),
  webpPath: getProjectedRootArtifactPath({
    slideDir,
    slideDirName,
    versionId,
    extension: "webp",
  }),
});

const toRepoRelativePath = (filePath) => {
  const rel = relative(REPO_ROOT, resolve(filePath));
  return rel.startsWith("..") ? resolve(filePath) : rel || ".";
};

const escapeRegExp = (value) => String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const rewriteLeadingSlideId = (value, { fromSlideId, toSlideId }) => {
  const source = String(value ?? "");
  const from = normalizeSlideId(fromSlideId);
  const to = normalizeSlideId(toSlideId);
  if (!source || !from || from === to) {
    return source;
  }
  return source.replace(new RegExp(`^${escapeRegExp(from)}(?=-|$)`, "i"), to);
};

const buildSlideTextReplacements = ({ fromSlideId, toSlideId, extraReplacements = [] }) => {
  const from = normalizeSlideId(fromSlideId);
  const to = normalizeSlideId(toSlideId);
  return [[from, to], ...extraReplacements].filter(
    ([source, target]) => String(source ?? "") && String(target ?? "") && source !== target
  );
};

const TEXT_REWRITE_EXTENSIONS = new Set([
  ".json",
  ".md",
  ".txt",
  ".html",
  ".yaml",
  ".yml",
  ".js",
  ".mjs",
]);

const applyLiteralReplacements = (text, replacements) => {
  let nextText = String(text ?? "");
  for (const [source, target] of replacements) {
    nextText = nextText.split(String(source)).join(String(target));
  }
  return nextText;
};

const rewriteTextFile = async ({ filePath, replacements }) => {
  if (!existsSync(filePath)) {
    return;
  }
  const originalText = await readFile(filePath, "utf8");
  const nextText = applyLiteralReplacements(originalText, replacements);
  if (nextText !== originalText) {
    await writeFile(filePath, nextText);
  }
};

const rewriteTextFilesUnderDir = async ({ dir, replacements }) => {
  if (!existsSync(dir)) {
    return;
  }
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      await rewriteTextFilesUnderDir({ dir: entryPath, replacements });
      continue;
    }
    if (!TEXT_REWRITE_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      continue;
    }
    await rewriteTextFile({ filePath: entryPath, replacements });
  }
};

const normalizeArtifactMetadataPath = (value, dataRoot) => {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return raw;
  }
  return toDesignerDataRelativePath(dataRoot, raw) ?? raw;
};

const normalizeVersionMetadata = (metadata) => {
  const nextMetadata = { ...(metadata ?? {}) };
  const designerDataPaths = getDesignerDataPaths({ repoRoot: REPO_ROOT });

  const normalizedArtifactPath = normalizeArtifactMetadataPath(
    nextMetadata.artifactPath,
    designerDataPaths.dataRoot
  );
  const normalizedArtifactImagePath = normalizeArtifactMetadataPath(
    nextMetadata.artifactImagePath,
    designerDataPaths.dataRoot
  );

  if (normalizedArtifactPath) {
    nextMetadata.artifactPath = normalizedArtifactPath;
  } else {
    delete nextMetadata.artifactPath;
  }
  if (normalizedArtifactImagePath) {
    nextMetadata.artifactImagePath = normalizedArtifactImagePath;
  } else {
    delete nextMetadata.artifactImagePath;
  }

  if (!nextMetadata.artifactPath && nextMetadata.sourcePath) {
    const artifactPath = toDesignerDataRelativePath(
      designerDataPaths.dataRoot,
      nextMetadata.sourcePath
    );
    if (artifactPath) {
      nextMetadata.artifactPath = artifactPath;
    }
  }

  if (!nextMetadata.artifactImagePath && nextMetadata.sourceImagePath) {
    const artifactImagePath = toDesignerDataRelativePath(
      designerDataPaths.dataRoot,
      nextMetadata.sourceImagePath
    );
    if (artifactImagePath) {
      nextMetadata.artifactImagePath = artifactImagePath;
    }
  }

  return nextMetadata;
};

const resolveMigrationSourcePath = ({ slideDir, source }) => {
  const raw = String(source ?? "").trim();
  if (!raw || raw === ".") {
    return resolve(slideDir);
  }
  if (raw.startsWith("/")) {
    return resolve(raw);
  }
  if (
    raw.startsWith("projects/") ||
    raw.startsWith("output/") ||
    raw.startsWith("docs/")
  ) {
    return resolve(REPO_ROOT, raw);
  }
  return resolve(slideDir, raw);
};

const getGroupSources = (group) =>
  [...new Set([group?.source, ...(Array.isArray(group?.extraSources) ? group.extraSources : [])])]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

const getSlideLocalTopName = ({ slideDir, source }) => {
  const rel = relative(
    slideDir,
    resolveMigrationSourcePath({ slideDir, source })
  ).replaceAll("\\", "/");
  if (!rel || rel === "." || rel.startsWith("../")) {
    return null;
  }
  return rel.split("/")[0] || null;
};

const loadDeckSpecMaybe = async (projectRoot) => {
  const deckSpecPath = resolve(projectRoot, "deck-spec.json");
  if (!existsSync(deckSpecPath)) {
    return null;
  }
  return readJson(deckSpecPath);
};

const normalizeStampedSlideDir = (slideDir) => {
  const raw = String(slideDir ?? "").trim();
  if (!raw) {
    return null;
  }
  const normalized = raw.replaceAll("\\", "/");
  const versionMarker = "/versions/";
  const versionIndex = normalized.indexOf(versionMarker);
  if (versionIndex >= 0) {
    return normalized.slice(0, versionIndex);
  }
  return raw;
};

const findSlideEntryById = async (projectRoot, slideId) => {
  const deckSpec = await loadDeckSpecMaybe(projectRoot);
  if (!Array.isArray(deckSpec?.slides)) {
    return null;
  }
  return deckSpec.slides.find((entry) => entry?.id === slideId) ?? null;
};

const findLogicalSlideIdForDirectory = async (projectRoot, directoryName) => {
  const deckSpec = await loadDeckSpecMaybe(projectRoot);
  if (!Array.isArray(deckSpec?.slides)) {
    return normalizeSlideId(directoryName);
  }
  const matched = deckSpec.slides.find((entry) => {
    const stampedDir = normalizeStampedSlideDir(entry?.paths?.stampedDir);
    return stampedDir && basename(stampedDir) === directoryName;
  });
  return matched?.id ? normalizeSlideId(matched.id) : normalizeSlideId(directoryName);
};

export const resolveSlideVersionContext = async ({
  projectRoot,
  slideId,
  slideDir = null,
}) => {
  const resolvedProjectRoot = resolve(String(projectRoot));
  const normalizedSlideId = normalizeSlideId(slideId);
  const slideEntry = await findSlideEntryById(resolvedProjectRoot, normalizedSlideId);
  const normalizedInputSlideDir = normalizeStampedSlideDir(slideDir);
  const normalizedStampedDir = normalizeStampedSlideDir(slideEntry?.paths?.stampedDir);
  const resolvedSlideDir = slideDir
    ? resolve(String(normalizedInputSlideDir))
    : normalizedStampedDir
      ? resolve(REPO_ROOT, normalizedStampedDir)
      : resolve(resolvedProjectRoot, "slide-figures", normalizedSlideId);
  return {
    projectRoot: resolvedProjectRoot,
    slideId: slideEntry?.id ? normalizeSlideId(slideEntry.id) : normalizedSlideId,
    slideEntry,
    slideDir: resolvedSlideDir,
    slideDirName: basename(resolvedSlideDir),
    slideFiguresRoot: resolve(resolvedProjectRoot, "slide-figures"),
  };
};

export const getVersionRegistryPath = (projectRoot) =>
  resolve(projectRoot, "slide-figures", "registry.json");

export const getMigrationMapPath = (projectRoot) =>
  resolve(projectRoot, "slide-figures", "migration-map.json");

export const getSlideNotesDir = ({
  projectRoot,
  slideId,
  slideDir = null,
  slideDirName = null,
}) =>
  resolve(
    projectRoot,
    "slide-notes",
    slideDirName || basename(slideDir || normalizeSlideId(slideId))
  );

export const getSlideReportPath = ({
  projectRoot,
  slideId,
  slideDir = null,
  slideDirName = null,
}) =>
  resolve(
    projectRoot,
    "slide-reports",
    `${slideDirName || basename(slideDir || normalizeSlideId(slideId))}.html`
  );

export const getSlideManifestPath = (slideDir) => resolve(slideDir, "manifest.json");

export const getSlideVersionsDir = (slideDir) => resolve(slideDir, "versions");

const readRegistry = async (projectRoot) => {
  const registryPath = getVersionRegistryPath(projectRoot);
  const registry = existsSync(registryPath) ? await readJson(registryPath) : null;
  const onDiskVersionIds = await listProjectVersionIds(projectRoot);
  const highestOnDiskVersionNumber = onDiskVersionIds.reduce(
    (max, versionId) => Math.max(max, parseVersionNumber(versionId)),
    0
  );
  return {
    nextVersionNumber: Math.max(
      Number(registry?.nextVersionNumber ?? DEFAULT_REGISTRY.nextVersionNumber),
      highestOnDiskVersionNumber + 1
    ),
    versions: {
      ...(registry?.versions ?? {}),
    },
  };
};

const writeRegistry = async (projectRoot, registry) => {
  await writeJson(getVersionRegistryPath(projectRoot), registry);
};

const defaultManifest = ({ slideId, slideDir }) => ({
  slideId,
  slideDir: toRepoRelativePath(slideDir),
  currentVersionId: null,
  versions: [],
});

export const readSlideManifest = async ({ slideId, projectRoot, slideDir = null }) => {
  const context = await resolveSlideVersionContext({ projectRoot, slideId, slideDir });
  const manifestPath = getSlideManifestPath(context.slideDir);
  if (!existsSync(manifestPath)) {
    return defaultManifest(context);
  }
  return readJson(manifestPath);
};

const writeSlideManifest = async ({ slideDir, manifest }) => {
  await writeJson(getSlideManifestPath(slideDir), manifest);
};

const listEntries = async (dir) => {
  if (!existsSync(dir)) {
    return [];
  }
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.sort((left, right) => left.name.localeCompare(right.name));
};

const hasPathPrefix = (relativePath, prefixes) =>
  prefixes.some((prefix) => relativePath === prefix || relativePath.startsWith(`${prefix}/`));

const copyContents = async ({
  fromDir,
  toDir,
  includeNames = null,
  omitTuneHistory = false,
  excludeRootNames = [],
}) => {
  const entries = await listEntries(fromDir);
  const includeSet = includeNames ? new Set(includeNames) : null;
  const excludeSet = new Set(excludeRootNames);
  await mkdir(toDir, { recursive: true });
  for (const entry of entries) {
    if (includeSet && !includeSet.has(entry.name)) {
      continue;
    }
    if (excludeSet.has(entry.name)) {
      continue;
    }
    const sourcePath = resolve(fromDir, entry.name);
    const targetPath = resolve(toDir, entry.name);
    await cp(sourcePath, targetPath, {
      recursive: true,
      force: true,
      filter: (source) => {
        if (!omitTuneHistory) {
          return true;
        }
        const rel = relative(fromDir, source).replaceAll("\\", "/");
        return !hasPathPrefix(rel, TUNE_HISTORY_PREFIXES);
      },
    });
  }
};

const removeEntries = async ({ dir, includeNames = null, excludeNames = [] }) => {
  const entries = await listEntries(dir);
  const includeSet = includeNames ? new Set(includeNames) : null;
  const excludeSet = new Set(excludeNames);
  for (const entry of entries) {
    if (includeSet && !includeSet.has(entry.name)) {
      continue;
    }
    if (excludeSet.has(entry.name)) {
      continue;
    }
    await rm(resolve(dir, entry.name), { recursive: true, force: true });
  }
};

const summarizeVersion = (versionDoc) => {
  const summary = {
    id: versionDoc.id,
    label: versionDoc.label,
    status: versionDoc.status,
    sourceKind: versionDoc.sourceKind,
    createdAt: versionDoc.createdAt,
    baseVersionId: versionDoc.baseVersionId ?? null,
    dir: versionDoc.dir,
    runId: versionDoc.runId ?? null,
    attempt: versionDoc.attempt ?? null,
  };

  if (versionDoc.mode) {
    summary.mode = versionDoc.mode;
  }
  if (versionDoc.sharedCssPath) {
    summary.sharedCssPath = versionDoc.sharedCssPath;
  }
  if (versionDoc.sourceHtmlPath) {
    summary.sourceHtmlPath = versionDoc.sourceHtmlPath;
  }

  return summary;
};

const syncManifestVersionSummary = async ({
  projectRoot,
  slideId,
  slideDir,
  versionDoc,
}) => {
  const manifest = await readSlideManifest({
    projectRoot,
    slideId,
    slideDir,
  });
  const nextVersions = manifest.versions.some((entry) => entry.id === versionDoc.id)
    ? manifest.versions.map((entry) =>
        entry.id === versionDoc.id ? summarizeVersion(versionDoc) : entry
      )
    : [...manifest.versions, summarizeVersion(versionDoc)];
  await writeSlideManifest({
    slideDir,
    manifest: {
      ...manifest,
      slideId,
      slideDir: toRepoRelativePath(slideDir),
      versions: nextVersions,
    },
  });
};

const writeVersionDoc = async ({ versionDir, versionDoc }) => {
  await writeJson(resolve(versionDir, "version.json"), versionDoc);
};

const updateVersionDocStatus = async ({ versionDir, status }) => {
  const versionDoc = await readVersionDoc(versionDir);
  if (versionDoc.status === status) {
    return versionDoc;
  }
  const nextVersionDoc = {
    ...versionDoc,
    status,
  };
  await writeVersionDoc({ versionDir, versionDoc: nextVersionDoc });
  return nextVersionDoc;
};

export const getVersionDocPath = (versionDir) => resolve(versionDir, "version.json");

export const readVersionDoc = async (versionDir) => readJson(getVersionDocPath(versionDir));

const normalizeVersionDocFromDisk = ({
  context,
  versionDir,
  rawVersionDoc,
}) => {
  const normalizedDir = toRepoRelativePath(versionDir);
  const idFromDirName = getVersionIdFromDirName(basename(versionDir));
  const normalizedId =
    idFromDirName && VERSION_ID_PATTERN.test(idFromDirName)
      ? idFromDirName
      : String(rawVersionDoc?.id ?? "").trim();
  if (!VERSION_ID_PATTERN.test(normalizedId)) {
    return null;
  }
  return {
    ...rawVersionDoc,
    id: normalizedId,
    slideId: context.slideId,
    slideDir: toRepoRelativePath(context.slideDir),
    dir: normalizedDir,
    label:
      String(rawVersionDoc?.label ?? "").trim() ||
      basename(versionDir).replace(`${normalizedId}--`, "") ||
      normalizedId,
    status: String(rawVersionDoc?.status ?? "").trim() || "draft",
    sourceKind: String(rawVersionDoc?.sourceKind ?? "").trim() || "draft",
    createdAt: rawVersionDoc?.createdAt ?? null,
    baseVersionId: rawVersionDoc?.baseVersionId ?? null,
    runId: rawVersionDoc?.runId ?? null,
    attempt: rawVersionDoc?.attempt ?? null,
    mode: rawVersionDoc?.mode === SHARED_CSS_MODE ? SHARED_CSS_MODE : null,
    sharedCssPath: rawVersionDoc?.sharedCssPath ?? null,
    sourceHtmlPath: rawVersionDoc?.sourceHtmlPath ?? null,
  };
};

const readVersionDocsFromDisk = async ({ projectRoot, slideId, slideDir = null }) => {
  const context = await resolveSlideVersionContext({ projectRoot, slideId, slideDir });
  const versionsDir = getSlideVersionsDir(context.slideDir);
  const entries = await listEntries(versionsDir);
  const versionDocs = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const versionIdFromDir = getVersionIdFromDirName(entry.name);
    if (!versionIdFromDir) {
      continue;
    }
    const versionDir = resolve(versionsDir, entry.name);
    const versionDocPath = getVersionDocPath(versionDir);
    if (!existsSync(versionDocPath)) {
      continue;
    }
    const normalized = normalizeVersionDocFromDisk({
      context,
      versionDir,
      rawVersionDoc: await readJson(versionDocPath),
    });
    if (normalized) {
      versionDocs.push(normalized);
    }
  }

  return versionDocs.sort((left, right) => left.id.localeCompare(right.id));
};

const mergeManifestWithDiskVersions = ({
  manifest,
  diskVersionDocs,
}) => {
  const merged = new Map(
    (manifest.versions ?? [])
      .filter((entry) => existsSync(resolve(REPO_ROOT, String(entry?.dir ?? ""))))
      .map((entry) => [
        entry.id,
        {
          ...entry,
        },
      ])
  );

  for (const versionDoc of diskVersionDocs) {
    const existing = merged.get(versionDoc.id);
    if (!existing) {
      merged.set(versionDoc.id, summarizeVersion(versionDoc));
      continue;
    }
    if (String(existing.dir ?? "").trim() === String(versionDoc.dir ?? "").trim()) {
      merged.set(versionDoc.id, summarizeVersion(versionDoc));
    }
  }

  return {
    ...manifest,
    versions: [...merged.values()].sort((left, right) => left.id.localeCompare(right.id)),
  };
};

export const readReconciledSlideManifest = async ({
  slideId,
  projectRoot,
  slideDir = null,
}) => {
  const context = await resolveSlideVersionContext({ projectRoot, slideId, slideDir });
  const manifest = await readSlideManifest({
    projectRoot: context.projectRoot,
    slideId: context.slideId,
    slideDir: context.slideDir,
  });
  const diskVersionDocs = await readVersionDocsFromDisk({
    projectRoot: context.projectRoot,
    slideId: context.slideId,
    slideDir: context.slideDir,
  });
  return mergeManifestWithDiskVersions({
    manifest: {
      ...manifest,
      slideId: context.slideId,
      slideDir: toRepoRelativePath(context.slideDir),
    },
    diskVersionDocs,
  });
};

const listProjectVersionIds = async (projectRoot) => {
  const slideFiguresRoot = resolve(projectRoot, "slide-figures");
  const slideEntries = await listEntries(slideFiguresRoot);
  const versionIds = new Set();

  for (const slideEntry of slideEntries) {
    if (!slideEntry.isDirectory() || !slideEntry.name.startsWith("slide-")) {
      continue;
    }
    const versionsDir = resolve(slideFiguresRoot, slideEntry.name, "versions");
    const versionEntries = await listEntries(versionsDir);
    for (const versionEntry of versionEntries) {
      if (!versionEntry.isDirectory()) {
        continue;
      }
      const versionId = getVersionIdFromDirName(versionEntry.name);
      if (versionId) {
        versionIds.add(versionId);
      }
    }
  }

  return [...versionIds];
};

const updateManifestVersionStatus = ({ manifest, currentVersionId = null, draftVersionId = null }) => ({
  ...manifest,
  currentVersionId,
  versions: manifest.versions.map((entry) => ({
    ...entry,
    status:
      entry.id === currentVersionId
        ? "current"
        : entry.id === draftVersionId
          ? "draft"
          : "archived",
  })),
});

export const getCurrentRootPayloadNames = async (slideDir) => {
  const slideDirName = basename(slideDir);
  const manifestPath = getSlideManifestPath(slideDir);
  const manifest = existsSync(manifestPath) ? await readJson(manifestPath) : null;
  const projectedRootNames =
    manifest?.currentVersionId
      ? getProjectedRootArtifactNameSet({
          slideDirName,
          versionId: manifest.currentVersionId,
        })
      : new Set();
  const entries = await listEntries(slideDir);
  return entries
    .map((entry) => entry.name)
    .filter((name) => !ROOT_DOC_ENTRY_NAMES.has(name))
    .filter((name) => !projectedRootNames.has(name))
    .filter((name) => !PROJECTED_ROOT_ARTIFACT_PATTERN.test(name));
};

export const getVersionDir = async ({ projectRoot, slideId, versionId, slideDir = null }) => {
  const manifest = await readReconciledSlideManifest({ projectRoot, slideId, slideDir });
  const entry = manifest.versions.find((item) => item.id === versionId);
  if (!entry?.dir) {
    throw new Error(`Could not find ${versionId} for ${slideId}.`);
  }
  return resolve(REPO_ROOT, entry.dir);
};

const resolveProjectionEntries = ({ versionDir, slideDirName, versionId }) => {
  const projectionMap = new Map();
  const addProjection = (sourcePath, targetExtension) => {
    const targetName = getProjectedRootArtifactName({
      slideDirName,
      versionId,
      extension: targetExtension,
    });
    if (projectionMap.has(targetName) || !existsSync(sourcePath)) {
      return;
    }
    projectionMap.set(targetName, {
      sourcePath,
      targetName,
      targetExtension,
    });
  };

  [
    ["figure.html", "html"],
    ["figure.png", "png"],
    ["figure.svg", "svg"],
    ["figure.jpg", "jpg"],
    ["figure.webp", "webp"],
    // Legacy slide roots could still carry these names directly.
    ["generated.html", "html"],
    ["preview.png", "png"],
    ["preview.svg", "svg"],
  ].forEach(([sourceName, targetExtension]) => {
    addProjection(resolve(versionDir, sourceName), targetExtension);
  });

  for (const providerName of ["gemini-html", "openai-html", "anthropic-html"]) {
    const providerDir = resolve(versionDir, providerName);
    const generatedHtml = resolve(providerDir, "generated.html");
    const previewPng = resolve(providerDir, "preview.png");
    const previewSvg = resolve(providerDir, "preview.svg");
    addProjection(generatedHtml, "html");
    addProjection(previewPng, "png");
    addProjection(previewSvg, "svg");
  }

  const hasProjectedRaster = () =>
    ["png", "jpg", "webp"].some((extension) =>
      projectionMap.has(
        getProjectedRootArtifactName({
          slideDirName,
          versionId,
          extension,
        })
      )
    );
  for (const [providerName, imageName] of [
    ["gemini-image", "image-01.jpg"],
    ["openai-image", "image-01.png"],
    ["anthropic-image", "image-01.png"],
  ]) {
    if (hasProjectedRaster()) {
      break;
    }
    const imagePath = resolve(versionDir, providerName, imageName);
    if (existsSync(imagePath)) {
      addProjection(
        imagePath,
        imageName.slice("image-01.".length)
      );
    }
  }

  return [...projectionMap.values()];
};

const buildProjectionRewriteMap = ({ slideDirName, versionId }) => ({
  "figure.html": getProjectedRootArtifactName({
    slideDirName,
    versionId,
    extension: "html",
  }),
  "generated.html": getProjectedRootArtifactName({
    slideDirName,
    versionId,
    extension: "html",
  }),
  "figure.png": getProjectedRootArtifactName({
    slideDirName,
    versionId,
    extension: "png",
  }),
  "preview.png": getProjectedRootArtifactName({
    slideDirName,
    versionId,
    extension: "png",
  }),
  "figure.svg": getProjectedRootArtifactName({
    slideDirName,
    versionId,
    extension: "svg",
  }),
  "preview.svg": getProjectedRootArtifactName({
    slideDirName,
    versionId,
    extension: "svg",
  }),
  "figure.jpg": getProjectedRootArtifactName({
    slideDirName,
    versionId,
    extension: "jpg",
  }),
  "image-01.jpg": getProjectedRootArtifactName({
    slideDirName,
    versionId,
    extension: "jpg",
  }),
  "figure.webp": getProjectedRootArtifactName({
    slideDirName,
    versionId,
    extension: "webp",
  }),
});

const rewriteProjectedTextFile = async ({ targetPath, rewriteMap, projectRoot }) => {
  const ext = basename(targetPath).split(".").pop()?.toLowerCase();
  if (!["html", "svg"].includes(ext)) {
    return;
  }
  let content = await readFile(targetPath, "utf8");
  for (const [from, to] of Object.entries(rewriteMap)) {
    if (!from || from === to) {
      continue;
    }
    content = content.split(from).join(to);
  }
  if (ext === "html") {
    content = rewriteSharedCssHrefInHtml({
      html: content,
      projectRoot,
      targetHtmlAbsolutePath: targetPath,
    });
  }
  await writeFile(targetPath, content, "utf8");
};

const moveEntryIfExists = async (sourcePath, targetPath) => {
  if (!existsSync(sourcePath)) {
    return false;
  }
  await mkdir(dirname(targetPath), { recursive: true });
  if (existsSync(targetPath)) {
    await rm(targetPath, { recursive: true, force: true });
  }
  await rename(sourcePath, targetPath);
  return true;
};

const moveLegacyRootDocs = async (context) => {
  const readmePath = resolve(context.slideDir, "README.md");
  const fineTuneRequestPath = resolve(context.slideDir, "fine-tune-request.md");
  const reportPath = resolve(context.slideDir, "report.html");
  const notesDir = getSlideNotesDir(context);
  const nextReportPath = getSlideReportPath(context);

  await moveEntryIfExists(readmePath, resolve(notesDir, "README.md"));
  await moveEntryIfExists(
    fineTuneRequestPath,
    resolve(notesDir, "fine-tune-request.md")
  );
  await moveEntryIfExists(reportPath, nextReportPath);

  return {
    notesDir,
    reportPath: nextReportPath,
  };
};

export const compactSlideRoot = async ({
  projectRoot,
  slideId,
  slideDir = null,
}) => {
  const context = await resolveSlideVersionContext({ projectRoot, slideId, slideDir });
  const manifestPath = getSlideManifestPath(context.slideDir);
  const manifest = await readSlideManifest({
    projectRoot: context.projectRoot,
    slideId: context.slideId,
    slideDir: context.slideDir,
  });
  if (!existsSync(manifestPath)) {
    await writeSlideManifest({
      slideDir: context.slideDir,
      manifest,
    });
  }
  await mkdir(getSlideVersionsDir(context.slideDir), { recursive: true });
  const currentVersionDir = manifest.currentVersionId
    ? await getVersionDir({
        projectRoot: context.projectRoot,
        slideId: context.slideId,
        slideDir: context.slideDir,
        versionId: manifest.currentVersionId,
      })
    : null;

  await moveLegacyRootDocs(context);
  await removeEntries({
    dir: context.slideDir,
    excludeNames: [...ROOT_DOC_ENTRY_NAMES],
  });
  if (!currentVersionDir) {
    return {
      ...context,
      currentVersionId: null,
      currentVersionDir: null,
    };
  }

  const projectionEntries = resolveProjectionEntries({
    versionDir: currentVersionDir,
    slideDirName: context.slideDirName,
    versionId: manifest.currentVersionId,
  });
  const rewriteMap = buildProjectionRewriteMap({
    slideDirName: context.slideDirName,
    versionId: manifest.currentVersionId,
  });
  for (const entry of projectionEntries) {
    const targetPath = resolve(context.slideDir, entry.targetName);
    await cp(entry.sourcePath, targetPath, {
      force: true,
    });
    await rewriteProjectedTextFile({
      targetPath,
      rewriteMap,
      projectRoot: context.projectRoot,
    });
  }

  return {
    ...context,
    currentVersionId: manifest.currentVersionId,
    currentVersionDir,
  };
};

export const createSlideVersion = async ({
  projectRoot,
  slideId,
  slideDir = null,
  label,
  sourceKind = "draft",
  cloneCurrent = false,
  currentVersionFallbackNames = null,
  metadata = {},
}) => {
  const context = await resolveSlideVersionContext({ projectRoot, slideId, slideDir });
  const registry = await readRegistry(context.projectRoot);
  const manifest = await readReconciledSlideManifest({
    projectRoot: context.projectRoot,
    slideId: context.slideId,
    slideDir: context.slideDir,
  });
  const versionId = formatVersionId(registry.nextVersionNumber ?? 1);
  const versionLabel = label || `${context.slideId}-${versionId}`;
  const versionDir = resolve(
    getSlideVersionsDir(context.slideDir),
    versionDirectoryName({ id: versionId, label: versionLabel })
  );

  await mkdir(versionDir, { recursive: true });

  let baseVersionId = null;
  if (cloneCurrent && manifest.currentVersionId) {
    baseVersionId = manifest.currentVersionId;
    const baseVersionDir = await getVersionDir({
      projectRoot: context.projectRoot,
      slideId: context.slideId,
      slideDir: context.slideDir,
      versionId: baseVersionId,
    });
    await copyContents({
      fromDir: baseVersionDir,
      toDir: versionDir,
      omitTuneHistory: true,
      excludeRootNames: ["version.json"],
    });
  } else if (cloneCurrent && Array.isArray(currentVersionFallbackNames)) {
    await copyContents({
      fromDir: context.slideDir,
      toDir: versionDir,
      includeNames: currentVersionFallbackNames,
      omitTuneHistory: true,
    });
  }

  const versionDoc = {
    id: versionId,
    slideId: context.slideId,
    slideDir: toRepoRelativePath(context.slideDir),
    dir: toRepoRelativePath(versionDir),
    label: versionLabel,
    status: "draft",
    createdAt: new Date().toISOString(),
    sourceKind,
    baseVersionId,
    legacySourcePaths: [],
    ...normalizeVersionMetadata(metadata),
  };

  await writeVersionDoc({ versionDir, versionDoc });

  registry.nextVersionNumber = Number(registry.nextVersionNumber ?? 1) + 1;
  registry.versions = {
    ...(registry.versions ?? {}),
    [versionId]: {
      slideId: context.slideId,
      dir: versionDoc.dir,
    },
  };
  await writeRegistry(context.projectRoot, registry);

  const nextManifest = {
    ...manifest,
    slideId: context.slideId,
    slideDir: toRepoRelativePath(context.slideDir),
    versions: [...manifest.versions, summarizeVersion(versionDoc)],
  };
  await writeSlideManifest({
    slideDir: context.slideDir,
    manifest: updateManifestVersionStatus({
      manifest: nextManifest,
      currentVersionId: manifest.currentVersionId,
      draftVersionId: versionId,
    }),
  });

  return {
    ...context,
    versionId,
    versionDir,
    versionDoc,
  };
};
const resolveImportedHtmlBuffer = (html) => {
  if (Buffer.isBuffer(html)) {
    return html;
  }
  if (typeof html === "string") {
    return Buffer.from(html, "utf8");
  }
  if (ArrayBuffer.isView(html)) {
    return Buffer.from(html.buffer, html.byteOffset, html.byteLength);
  }
  if (html instanceof ArrayBuffer) {
    return Buffer.from(html);
  }
  throw new Error("HTML input must be a string, Buffer, or Uint8Array.");
};

const resolveImportBaseVersionId = ({ manifest, baseVersionId }) => {
  const rawBaseVersionId = String(baseVersionId ?? "current").trim();
  if (!rawBaseVersionId || rawBaseVersionId === "current") {
    return manifest.currentVersionId ?? null;
  }
  if (rawBaseVersionId === "none") {
    return null;
  }
  const exists = manifest.versions.some((entry) => entry.id === rawBaseVersionId);
  if (!exists) {
    throw new Error(`Could not find base version ${rawBaseVersionId}.`);
  }
  return rawBaseVersionId;
};

const getVersionHtmlSourcePath = async (versionDir) => {
  for (const candidate of VERSION_HTML_SOURCE_CANDIDATES) {
    const absoluteCandidate = resolve(versionDir, candidate);
    if (existsSync(absoluteCandidate)) {
      return absoluteCandidate;
    }
  }
  return null;
};

const finalizeSharedCssVersion = async ({
  projectRoot,
  versionDir,
  rawHtmlBuffer,
  baseVersionId,
}) => {
  const sourceHtmlPath = resolve(versionDir, "source-locked.html");
  const generatedHtmlPath = resolve(versionDir, "generated.html");
  const sharedCssAbsolutePath = getProjectSharedCssAbsolutePath(projectRoot);
  const sharedCssText = await readFile(sharedCssAbsolutePath, "utf8");

  await writeFile(sourceHtmlPath, rawHtmlBuffer);
  await writeFile(
    generatedHtmlPath,
    normalizeHtmlWithSharedCss({
      html: rawHtmlBuffer.toString("utf8"),
      projectRoot,
      targetHtmlAbsolutePath: generatedHtmlPath,
      sharedCssText,
    }),
    "utf8"
  );

  const versionDoc = await readVersionDoc(versionDir);
  const nextVersionDoc = {
    ...versionDoc,
    baseVersionId: baseVersionId ?? versionDoc.baseVersionId ?? null,
    mode: SHARED_CSS_MODE,
    sharedCssPath: toRepoRelativePath(sharedCssAbsolutePath),
    sourceHtmlPath: toRepoRelativePath(sourceHtmlPath),
  };
  await writeVersionDoc({
    versionDir,
    versionDoc: nextVersionDoc,
  });

  return {
    generatedHtmlPath,
    sourceHtmlPath,
    versionDoc: nextVersionDoc,
  };
};

export const importSlideHtmlVersion = async ({
  projectRoot,
  slideId,
  slideDir = null,
  label = null,
  labelHint = null,
  html,
  sourceKind = "user-html-snapshot",
  baseVersionId = "current",
  promote = false,
  previewWidth = 1920,
  previewHeight = 1080,
  screenshotImpl = captureHtmlScreenshot,
  touchRefreshTokenImpl = touchProjectManifestRefreshToken,
}) => {
  const context = await resolveSlideVersionContext({ projectRoot, slideId, slideDir });
  const manifest = await readReconciledSlideManifest({
    projectRoot: context.projectRoot,
    slideId: context.slideId,
    slideDir: context.slideDir,
  });
  const htmlBuffer = resolveImportedHtmlBuffer(html);
  if (htmlBuffer.byteLength === 0) {
    throw new Error("HTML input is empty.");
  }

  const resolvedBaseVersionId = resolveImportBaseVersionId({
    manifest,
    baseVersionId,
  });
  const derivedLabelSuffix = labelHint
    ? `user-html-${slugify(labelHint, "snapshot")}`
    : "user-html";
  const created = await createSlideVersion({
    projectRoot: context.projectRoot,
    slideId: context.slideId,
    slideDir: context.slideDir,
    label: label || `${context.slideId}-${derivedLabelSuffix}`,
    sourceKind,
    metadata: resolvedBaseVersionId
      ? {
          baseVersionId: resolvedBaseVersionId,
        }
      : {},
  });

  const previewPath = resolve(created.versionDir, "preview.png");
  const finalized = await finalizeSharedCssVersion({
    projectRoot: context.projectRoot,
    versionDir: created.versionDir,
    rawHtmlBuffer: htmlBuffer,
    baseVersionId: resolvedBaseVersionId,
  });
  await syncManifestVersionSummary({
    projectRoot: context.projectRoot,
    slideId: context.slideId,
    slideDir: context.slideDir,
    versionDoc: finalized.versionDoc,
  });
  await screenshotImpl({
    inputPath: finalized.generatedHtmlPath,
    outputPath: previewPath,
    width: Number(previewWidth),
    height: Number(previewHeight),
    fullPage: false,
  });

  if (promote) {
    await promoteSlideVersion({
      projectRoot: context.projectRoot,
      slideId: context.slideId,
      slideDir: context.slideDir,
      versionId: created.versionId,
    });
  }

  await touchRefreshTokenImpl({
    repoRoot: resolve(context.projectRoot, "..", ".."),
  });

  return {
    ...context,
    versionId: created.versionId,
    versionDir: created.versionDir,
    versionDoc: finalized.versionDoc,
    generatedHtmlPath: finalized.generatedHtmlPath,
    sourceHtmlPath: finalized.sourceHtmlPath,
    previewPath,
    promoted: Boolean(promote),
  };
};

export const normalizeSlideVersionCss = async ({
  projectRoot,
  slideId,
  versionId,
  slideDir = null,
  label = null,
  previewWidth = 1920,
  previewHeight = 1080,
  screenshotImpl = captureHtmlScreenshot,
  touchRefreshTokenImpl = touchProjectManifestRefreshToken,
}) => {
  const context = await resolveSlideVersionContext({ projectRoot, slideId, slideDir });
  const manifest = await readReconciledSlideManifest({
    projectRoot: context.projectRoot,
    slideId: context.slideId,
    slideDir: context.slideDir,
  });
  const sourceEntry = manifest.versions.find((entry) => entry.id === versionId);
  if (!sourceEntry) {
    throw new Error(`Could not find ${versionId} for ${context.slideId}.`);
  }

  const sourceVersionDir = await getVersionDir({
    projectRoot: context.projectRoot,
    slideId: context.slideId,
    slideDir: context.slideDir,
    versionId,
  });
  const sourceVersionDoc = await readVersionDoc(sourceVersionDir);
  if (sourceVersionDoc.mode === SHARED_CSS_MODE) {
    throw new Error(`${versionId} already uses shared CSS.`);
  }

  const sourceHtmlAbsolutePath = await getVersionHtmlSourcePath(sourceVersionDir);
  if (!sourceHtmlAbsolutePath) {
    throw new Error(`Could not find an HTML source inside ${versionId}.`);
  }

  const rawHtmlBuffer = await readFile(sourceHtmlAbsolutePath);
  const created = await createSlideVersion({
    projectRoot: context.projectRoot,
    slideId: context.slideId,
    slideDir: context.slideDir,
    label:
      label ||
      `${rewriteLeadingSlideId(sourceVersionDoc.label, {
        fromSlideId: sourceVersionDoc.slideId,
        toSlideId: context.slideId,
      })}-shared-css`,
    sourceKind: "shared-css-normalized",
    metadata: {
      baseVersionId: versionId,
    },
  });
  const finalized = await finalizeSharedCssVersion({
    projectRoot: context.projectRoot,
    versionDir: created.versionDir,
    rawHtmlBuffer,
    baseVersionId: versionId,
  });
  await syncManifestVersionSummary({
    projectRoot: context.projectRoot,
    slideId: context.slideId,
    slideDir: context.slideDir,
    versionDoc: finalized.versionDoc,
  });
  const previewPath = resolve(created.versionDir, "preview.png");

  await screenshotImpl({
    inputPath: finalized.generatedHtmlPath,
    outputPath: previewPath,
    width: Number(previewWidth),
    height: Number(previewHeight),
    fullPage: false,
  });

  await touchRefreshTokenImpl({
    repoRoot: resolve(context.projectRoot, "..", ".."),
  });

  return {
    ...context,
    sourceVersionId: versionId,
    sourceVersionDir,
    versionId: created.versionId,
    versionDir: created.versionDir,
    versionDoc: finalized.versionDoc,
    generatedHtmlPath: finalized.generatedHtmlPath,
    sourceHtmlPath: finalized.sourceHtmlPath,
    previewPath,
  };
};
export const reassignSlideVersions = async ({
  projectRoot,
  fromSlideId,
  toSlideId,
  versionIds,
  targetStatus = "preserve",
  orphanBaseVersionId = null,
  noteFiles = [],
  renameSlidePrefixedLabels = true,
}) => {
  const normalizedFromSlideId = normalizeSlideId(fromSlideId);
  const normalizedToSlideId = normalizeSlideId(toSlideId);
  if (normalizedFromSlideId === normalizedToSlideId) {
    throw new Error("Source and destination slides must be different.");
  }
  const dedupedVersionIds = [...new Set((versionIds ?? []).map((value) => String(value ?? "").trim()))]
    .filter(Boolean);
  if (dedupedVersionIds.length === 0) {
    throw new Error("At least one --version-id is required.");
  }
  if (!["preserve", "draft", "archived"].includes(String(targetStatus))) {
    throw new Error("targetStatus must be preserve, draft, or archived.");
  }

  const sourceContext = await resolveSlideVersionContext({
    projectRoot,
    slideId: normalizedFromSlideId,
  });
  const targetContext = await resolveSlideVersionContext({
    projectRoot,
    slideId: normalizedToSlideId,
  });
  const sourceManifest = await readReconciledSlideManifest({
    projectRoot: sourceContext.projectRoot,
    slideId: sourceContext.slideId,
    slideDir: sourceContext.slideDir,
  });
  const targetManifest = await readReconciledSlideManifest({
    projectRoot: targetContext.projectRoot,
    slideId: targetContext.slideId,
    slideDir: targetContext.slideDir,
  });

  const sourceEntries = dedupedVersionIds.map((versionId) => {
    const entry = sourceManifest.versions.find((candidate) => candidate.id === versionId);
    if (!entry) {
      throw new Error(`Could not find ${versionId} in ${sourceContext.slideId}.`);
    }
    return entry;
  });
  if (sourceEntries.some((entry) => entry.id === sourceManifest.currentVersionId)) {
    throw new Error(
      "reassign does not move the current version; promote another current version first."
    );
  }
  if (
    orphanBaseVersionId &&
    !dedupedVersionIds.includes(String(orphanBaseVersionId)) &&
    !targetManifest.versions.some((entry) => entry.id === String(orphanBaseVersionId))
  ) {
    throw new Error(
      `orphanBaseVersionId ${orphanBaseVersionId} must already exist on ${targetContext.slideId} or be part of the moved set.`
    );
  }
  const noteNames = [...new Set((noteFiles ?? []).map((value) => String(value ?? "").trim()))].filter(
    Boolean
  );
  const sourceNotesDir = getSlideNotesDir(sourceContext);
  const targetNotesDir = getSlideNotesDir(targetContext);
  for (const noteName of noteNames) {
    const sourceNotePath = resolve(sourceNotesDir, noteName);
    const targetNotePath = resolve(targetNotesDir, noteName);
    if (!existsSync(sourceNotePath)) {
      throw new Error(`Could not find note file to move: ${toRepoRelativePath(sourceNotePath)}`);
    }
    if (existsSync(targetNotePath)) {
      throw new Error(`Target note file already exists: ${toRepoRelativePath(targetNotePath)}`);
    }
  }

  await mkdir(getSlideVersionsDir(targetContext.slideDir), { recursive: true });
  const registry = await readRegistry(sourceContext.projectRoot);
  const versionIdSet = new Set(dedupedVersionIds);
  const movedEntries = [];

  for (const sourceEntry of sourceEntries) {
    const sourceVersionDir = resolve(REPO_ROOT, sourceEntry.dir);
    const sourceVersionDoc = await readVersionDoc(sourceVersionDir);
    const nextLabel = renameSlidePrefixedLabels
      ? rewriteLeadingSlideId(sourceVersionDoc.label, {
          fromSlideId: sourceContext.slideId,
          toSlideId: targetContext.slideId,
        })
      : sourceVersionDoc.label;
    const targetVersionDir = resolve(
      getSlideVersionsDir(targetContext.slideDir),
      versionDirectoryName({ id: sourceVersionDoc.id, label: nextLabel })
    );
    if (existsSync(targetVersionDir)) {
      throw new Error(
        `Target version dir already exists for ${sourceVersionDoc.id}: ${toRepoRelativePath(
          targetVersionDir
        )}`
      );
    }
    const nextStatus =
      targetStatus === "preserve"
        ? String(sourceVersionDoc.status ?? sourceEntry.status ?? "draft")
        : targetStatus;
    if (nextStatus === "current") {
      throw new Error(
        `reassign does not preserve current status for ${sourceVersionDoc.id}; use draft or archived.`
      );
    }

    const previousVersionDirRel = toRepoRelativePath(sourceVersionDir);
    const nextVersionDirRel = toRepoRelativePath(targetVersionDir);
    await rename(sourceVersionDir, targetVersionDir);

    let nextBaseVersionId = sourceVersionDoc.baseVersionId ?? null;
    if (
      orphanBaseVersionId &&
      nextBaseVersionId &&
      !versionIdSet.has(nextBaseVersionId) &&
      !targetManifest.versions.some((entry) => entry.id === nextBaseVersionId)
    ) {
      nextBaseVersionId = String(orphanBaseVersionId);
    }

    const nextVersionDoc = {
      ...sourceVersionDoc,
      slideId: targetContext.slideId,
      slideDir: toRepoRelativePath(targetContext.slideDir),
      dir: nextVersionDirRel,
      label: nextLabel,
      status: nextStatus,
      baseVersionId: nextBaseVersionId,
    };
    await writeVersionDoc({
      versionDir: targetVersionDir,
      versionDoc: nextVersionDoc,
    });

    await rewriteTextFilesUnderDir({
      dir: resolve(targetVersionDir, "create"),
      replacements: buildSlideTextReplacements({
        fromSlideId: sourceContext.slideId,
        toSlideId: targetContext.slideId,
        extraReplacements: [
          [previousVersionDirRel, nextVersionDirRel],
          [toRepoRelativePath(sourceContext.slideDir), toRepoRelativePath(targetContext.slideDir)],
          [
            toRepoRelativePath(
              resolve(getSlideNotesDir(sourceContext), "create-request.md")
            ),
            toRepoRelativePath(
              resolve(getSlideNotesDir(targetContext), "create-request.md")
            ),
          ],
        ],
      }),
    });

    registry.versions[sourceVersionDoc.id] = {
      slideId: targetContext.slideId,
      dir: nextVersionDirRel,
    };
    movedEntries.push(summarizeVersion(nextVersionDoc));
  }

  const nextSourceManifest = {
    ...sourceManifest,
    slideId: sourceContext.slideId,
    slideDir: toRepoRelativePath(sourceContext.slideDir),
    versions: sortVersionEntries(
      sourceManifest.versions.filter((entry) => !versionIdSet.has(entry.id))
    ),
  };
  const nextTargetManifest = {
    ...targetManifest,
    slideId: targetContext.slideId,
    slideDir: toRepoRelativePath(targetContext.slideDir),
    versions: sortVersionEntries([...targetManifest.versions, ...movedEntries]),
  };

  await writeRegistry(sourceContext.projectRoot, registry);
  await writeSlideManifest({
    slideDir: sourceContext.slideDir,
    manifest: nextSourceManifest,
  });
  await writeSlideManifest({
    slideDir: targetContext.slideDir,
    manifest: nextTargetManifest,
  });

  const movedNotes = [];
  await mkdir(targetNotesDir, { recursive: true });
  for (const noteName of noteNames) {
    const sourceNotePath = resolve(sourceNotesDir, noteName);
    const targetNotePath = resolve(targetNotesDir, noteName);
    await rename(sourceNotePath, targetNotePath);
    await rewriteTextFile({
      filePath: targetNotePath,
      replacements: buildSlideTextReplacements({
        fromSlideId: sourceContext.slideId,
        toSlideId: targetContext.slideId,
      }),
    });
    movedNotes.push({
      from: toRepoRelativePath(sourceNotePath),
      to: toRepoRelativePath(targetNotePath),
    });
  }

  return {
    ok: true,
    fromSlideId: sourceContext.slideId,
    toSlideId: targetContext.slideId,
    versionIds: dedupedVersionIds,
    movedEntries,
    movedNotes,
  };
};
export const promoteSlideVersion = async ({
  projectRoot,
  slideId,
  versionId,
  slideDir = null,
}) => {
  const context = await resolveSlideVersionContext({ projectRoot, slideId, slideDir });
  const manifest = await readReconciledSlideManifest({
    projectRoot: context.projectRoot,
    slideId: context.slideId,
    slideDir: context.slideDir,
  });
  const versionDir = await getVersionDir({
    projectRoot: context.projectRoot,
    slideId: context.slideId,
    slideDir: context.slideDir,
    versionId,
  });
  const currentVersionDir =
    manifest.currentVersionId && manifest.currentVersionId !== versionId
    ? await getVersionDir({
        projectRoot: context.projectRoot,
        slideId: context.slideId,
        slideDir: context.slideDir,
        versionId: manifest.currentVersionId,
      })
    : null;

  await removeEntries({
    dir: context.slideDir,
    excludeNames: [...ROOT_DOC_ENTRY_NAMES],
  });
  await copyContents({
    fromDir: versionDir,
    toDir: context.slideDir,
    omitTuneHistory: true,
    excludeRootNames: ["version.json"],
  });

  await updateVersionDocStatus({ versionDir, status: "current" });
  if (currentVersionDir) {
    await updateVersionDocStatus({ versionDir: currentVersionDir, status: "archived" });
  }

  const versionEntries = manifest.versions.map((entry) => {
    if (entry.id === versionId) {
      return {
        ...entry,
        status: "current",
      };
    }
    if (
      manifest.currentVersionId &&
      manifest.currentVersionId !== versionId &&
      entry.id === manifest.currentVersionId
    ) {
      return {
        ...entry,
        status: "archived",
      };
    }
    return entry;
  });

  await writeSlideManifest({
    slideDir: context.slideDir,
    manifest: {
      ...manifest,
      slideId: context.slideId,
      slideDir: toRepoRelativePath(context.slideDir),
      currentVersionId: versionId,
      versions: versionEntries,
    },
  });
  await compactSlideRoot({
    projectRoot: context.projectRoot,
    slideId: context.slideId,
    slideDir: context.slideDir,
  });

  return {
    ...context,
    versionId,
    versionDir,
  };
};

export const bootstrapSlideFromRoot = async ({
  projectRoot,
  slideId,
  label = null,
  slideDir = null,
}) => {
  const context = await resolveSlideVersionContext({ projectRoot, slideId, slideDir });
  const manifestPath = getSlideManifestPath(context.slideDir);
  if (existsSync(manifestPath)) {
    return readSlideManifest({
      projectRoot: context.projectRoot,
      slideId: context.slideId,
      slideDir: context.slideDir,
    });
  }
  const rootPayloadNames = await getCurrentRootPayloadNames(context.slideDir);
  if (rootPayloadNames.length === 0) {
    const manifest = defaultManifest(context);
    await writeSlideManifest({ slideDir: context.slideDir, manifest });
    return manifest;
  }
  const created = await createSlideVersion({
    projectRoot: context.projectRoot,
    slideId: context.slideId,
    slideDir: context.slideDir,
    label: label || `${context.slideId}-root`,
    sourceKind: "legacy-import",
    cloneCurrent: true,
    currentVersionFallbackNames: rootPayloadNames,
  });
  await promoteSlideVersion({
    projectRoot: context.projectRoot,
    slideId: context.slideId,
    slideDir: context.slideDir,
    versionId: created.versionId,
  });
  return readSlideManifest({
    projectRoot: context.projectRoot,
    slideId: context.slideId,
    slideDir: context.slideDir,
  });
};

export const resolveVersionedOutputDir = async ({
  projectRoot,
  slideId,
  versionId = null,
  slideDir = null,
  branch = null,
}) => {
  const context = await resolveSlideVersionContext({ projectRoot, slideId, slideDir });
  const manifest = await readSlideManifest({
    projectRoot: context.projectRoot,
    slideId: context.slideId,
    slideDir: context.slideDir,
  });
  const resolvedVersionId = versionId || manifest.currentVersionId;
  if (!resolvedVersionId) {
    throw new Error(`No current version is set for ${context.slideId}.`);
  }
  const versionDir = await getVersionDir({
    projectRoot: context.projectRoot,
    slideId: context.slideId,
    slideDir: context.slideDir,
    versionId: resolvedVersionId,
  });
  return branch ? resolve(versionDir, branch) : versionDir;
};

export const findVersionContextForPath = async (filePath) => {
  let currentPath = resolve(String(filePath));
  try {
    const fileStat = await stat(currentPath);
    if (fileStat.isFile()) {
      currentPath = dirname(currentPath);
    }
  } catch {
    currentPath = dirname(currentPath);
  }

  while (currentPath !== dirname(currentPath)) {
    const versionDocPath = getVersionDocPath(currentPath);
    if (existsSync(versionDocPath)) {
      const versionDoc = await readVersionDoc(currentPath);
      const slideDir = resolve(currentPath, "..", "..");
      const manifestPath = getSlideManifestPath(slideDir);
      return {
        versionDir: currentPath,
        versionDoc,
        slideDir,
        manifestPath,
        manifest: existsSync(manifestPath) ? await readJson(manifestPath) : null,
      };
    }
    currentPath = dirname(currentPath);
  }
  return null;
};

export const promoteVersionContextPath = async (artifactPath) => {
  const context = await findVersionContextForPath(artifactPath);
  if (!context?.versionDoc?.slideId) {
    return null;
  }
  return promoteSlideVersion({
    projectRoot: resolve(context.slideDir, "..", ".."),
    slideId: context.versionDoc.slideId,
    slideDir: context.slideDir,
    versionId: context.versionDoc.id,
  });
};

const rewritePathPrefix = (value, replacements, projectRoot) => {
  const stringValue = String(value ?? "").trim();
  if (!stringValue) {
    return stringValue;
  }
  const normalizedValue = resolve(REPO_ROOT, stringValue);
  for (const [legacyAbs, nextAbs] of replacements) {
    if (normalizedValue === legacyAbs || normalizedValue.startsWith(`${legacyAbs}/`)) {
      const rel = relative(legacyAbs, normalizedValue).replaceAll("\\", "/");
      const topName = rel.split("/")[0];
      if (ROOT_DOC_ENTRY_NAMES.has(topName)) {
        if (basename(dirname(legacyAbs)) === "slide-figures") {
          const slideDirName = basename(legacyAbs);
          if (topName === "report.html") {
            return toRepoRelativePath(
              getSlideReportPath({
                projectRoot,
                slideId: slideDirName,
                slideDir: legacyAbs,
                slideDirName,
              })
            );
          }
          if (topName === "README.md" || topName === "fine-tune-request.md") {
            return toRepoRelativePath(
              resolve(
                getSlideNotesDir({
                  projectRoot,
                  slideId: slideDirName,
                  slideDir: legacyAbs,
                  slideDirName,
                }),
                topName
              )
            );
          }
        }
        return stringValue;
      }
      return toRepoRelativePath(
        resolve(nextAbs, rel)
      );
    }
  }
  return stringValue;
};

const loadMigrationMap = async (projectRoot) => {
  const migrationMapPath = getMigrationMapPath(projectRoot);
  if (!existsSync(migrationMapPath)) {
    return { slides: {} };
  }
  return readJson(migrationMapPath);
};

const ensureVersionDirectory = async (versionDir) => {
  await mkdir(versionDir, { recursive: true });
};

const copyGroupSourceToVersion = async ({
  slideDir,
  source,
  sources = null,
  versionDir,
}) => {
  for (const sourceEntry of sources ?? [source]) {
    const sourcePath = resolveMigrationSourcePath({
      slideDir,
      source: sourceEntry,
    });
    const sourceStat = await stat(sourcePath);
    if (sourceStat.isDirectory()) {
      await copyContents({
        fromDir: sourcePath,
        toDir: versionDir,
        omitTuneHistory: false,
      });
      continue;
    }
    await mkdir(versionDir, { recursive: true });
    await cp(sourcePath, resolve(versionDir, basename(sourcePath)), { force: true });
  }
};

const loadTopLevelHeuristicGroups = async ({ slideDir, currentSource = "." }) => {
  const groups = [];
  const entries = await listEntries(slideDir);
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (ROOT_DOC_ENTRY_NAMES.has(entry.name)) {
      continue;
    }
    if (currentSource !== "." && entry.name === currentSource) {
      continue;
    }
    if (entry.name === "versions") {
      continue;
    }
    if (currentSource === "." && ["gemini-html", "gemini-image", "gemini-review", "anthropic-review", "gemini-repair", "anthropic-repair"].includes(entry.name)) {
      continue;
    }
    const looksLikeVersion =
      entry.name === "variants" ||
      /^v\d+[-_]/.test(entry.name) ||
      /-(v\d+|legacy)$/.test(entry.name) ||
      entry.name.includes("hero") ||
      entry.name.includes("threshold") ||
      entry.name.includes("waterfall") ||
      entry.name.includes("motif") ||
      entry.name.includes("journey") ||
      entry.name.includes("clipboard") ||
      entry.name.includes("hallway") ||
      entry.name.includes("strip") ||
      entry.name.includes("column") ||
      entry.name.includes("ideation") ||
      entry.name.includes("review");
    if (!looksLikeVersion) {
      continue;
    }
    if (entry.name === "variants") {
      const childEntries = await listEntries(resolve(slideDir, entry.name));
      for (const childEntry of childEntries) {
        if (childEntry.isDirectory()) {
          groups.push({
            label: childEntry.name,
            source: `variants/${childEntry.name}`,
            sourceKind: "legacy-import",
          });
        }
      }
      continue;
    }
    groups.push({
      label: entry.name,
      source: entry.name,
      sourceKind: "legacy-import",
    });
  }
  return groups;
};

const buildMigrationGroups = async ({
  projectRoot,
  logicalSlideId,
  slideDir,
}) => {
  const migrationMap = await loadMigrationMap(projectRoot);
  const directoryName = basename(slideDir);
  const slideConfig =
    migrationMap?.slides?.[directoryName] ??
    migrationMap?.slides?.[logicalSlideId] ??
    {};
  if (slideConfig.skip) {
    return {
      skip: true,
      current: null,
      versions: [],
      metadata: slideConfig.metadata ?? {},
    };
  }
  const hasExplicitCurrent = Object.prototype.hasOwnProperty.call(slideConfig, "current");
  const current = hasExplicitCurrent
    ? slideConfig.current
    : {
        label: logicalSlideId,
        source: ".",
      };
  const heuristicGroups = await loadTopLevelHeuristicGroups({
    slideDir,
    currentSource: current?.source ?? ".",
  });
  const explicitGroups = Array.isArray(slideConfig.versions) ? slideConfig.versions : [];
  return {
    skip: false,
    current,
    versions: explicitGroups.length > 0 ? explicitGroups : heuristicGroups,
    metadata: slideConfig.metadata ?? {},
  };
};

const createImportedVersion = async ({
  projectRoot,
  slideId,
  slideDir,
  label,
  sourceKind,
  legacySources,
  metadata = {},
}) => {
  const created = await createSlideVersion({
    projectRoot,
    slideId,
    slideDir,
    label,
    sourceKind,
    metadata: {
      legacySourcePaths: legacySources.map((item) =>
        toRepoRelativePath(resolveMigrationSourcePath({ slideDir, source: item }))
      ),
      ...metadata,
    },
  });
  return created;
};

const importCurrentRootBundle = async ({
  projectRoot,
  slideId,
  slideDir,
  label,
  excludeNames = [],
}) => {
  const payloadNames = (await getCurrentRootPayloadNames(slideDir)).filter(
    (name) => !excludeNames.includes(name)
  );
  if (payloadNames.length === 0) {
    return null;
  }
  const created = await createSlideVersion({
    projectRoot,
    slideId,
    slideDir,
    label,
    sourceKind: "legacy-import",
  });
  await copyContents({
    fromDir: slideDir,
    toDir: created.versionDir,
    includeNames: payloadNames,
    omitTuneHistory: true,
  });
  const versionDoc = {
    ...created.versionDoc,
    legacySourcePaths: payloadNames.map((name) => toRepoRelativePath(resolve(slideDir, name))),
  };
  await writeVersionDoc({ versionDir: created.versionDir, versionDoc });
  return created;
};

const importHistoricalGroup = async ({
  projectRoot,
  slideId,
  slideDir,
  group,
}) => {
  const legacySources = getGroupSources(group);
  const created = await createImportedVersion({
    projectRoot,
    slideId,
    slideDir,
    label: group.label,
    sourceKind: group.sourceKind ?? "legacy-import",
    legacySources,
    metadata: group.metadata ?? {},
  });
  await copyGroupSourceToVersion({
    slideDir,
    sources: legacySources,
    versionDir: created.versionDir,
  });
  return created;
};

const maybeImportTuneAttempts = async ({
  projectRoot,
  slideId,
  slideDir,
  parentLabel,
  parentSource,
}) => {
  const tuneDir = resolve(slideDir, parentSource, "gemini-html", "tune");
  if (!existsSync(tuneDir)) {
    return [];
  }
  const imported = [];
  const runEntries = await listEntries(tuneDir);
  for (const runEntry of runEntries.filter((entry) => entry.isDirectory())) {
    const runId = runEntry.name;
    const attemptEntries = await listEntries(resolve(tuneDir, runId));
    for (const attemptEntry of attemptEntries.filter(
      (entry) => entry.isDirectory() && entry.name.startsWith("attempt-")
    )) {
      const attempt = attemptEntry.name;
      const source = `${parentSource}/gemini-html/tune/${runId}/${attempt}`;
      const created = await createImportedVersion({
        projectRoot,
        slideId,
        slideDir,
        label: `${parentLabel}-${runId}-${attempt}`,
        sourceKind: "gemini-html-tune",
        legacySources: [source],
        metadata: { runId, attempt },
      });
      await copyGroupSourceToVersion({
        slideDir,
        source,
        versionDir: created.versionDir,
      });
      imported.push(created);
    }
  }
  return imported;
};

const rewriteDeckSpecVersionPaths = async ({ projectRoot, replacements }) => {
  const deckSpecPath = resolve(projectRoot, "deck-spec.json");
  if (!existsSync(deckSpecPath)) {
    return;
  }
  const deckSpec = await readJson(deckSpecPath);
  deckSpec.slides = Array.isArray(deckSpec.slides)
    ? deckSpec.slides.map((slide) => ({
        ...slide,
        variants: Array.isArray(slide.variants)
          ? slide.variants.map((variant) => ({
              ...variant,
              previewPath: rewritePathPrefix(
                variant.previewPath,
                replacements,
                projectRoot
              ),
              files: Array.isArray(variant.files)
                ? variant.files.map((file) => ({
                    ...file,
                    path: rewritePathPrefix(file.path, replacements, projectRoot),
                  }))
                : [],
            }))
          : [],
      }))
    : [];
  await writeJson(deckSpecPath, deckSpec);
};

export const migrateProjectSlideVersions = async ({
  projectRoot,
  slideIds = [],
}) => {
  const resolvedProjectRoot = resolve(String(projectRoot));
  const slideFiguresRoot = resolve(resolvedProjectRoot, "slide-figures");
  const registry = await readRegistry(resolvedProjectRoot);
  if (!existsSync(getVersionRegistryPath(resolvedProjectRoot))) {
    await writeRegistry(resolvedProjectRoot, registry);
  }

  const entries = await listEntries(slideFiguresRoot);
  const targetDirs = entries
    .filter((entry) => entry.isDirectory())
    .filter((entry) => {
      if (!slideIds.length) {
        return true;
      }
      return slideIds.includes(entry.name) || slideIds.includes(normalizeSlideId(entry.name));
    });

  const replacements = new Map();
  const results = [];

  for (const entry of targetDirs) {
    const slideDir = resolve(slideFiguresRoot, entry.name);
    const logicalSlideId = await findLogicalSlideIdForDirectory(resolvedProjectRoot, entry.name);
    const manifestPath = getSlideManifestPath(slideDir);
    if (existsSync(manifestPath)) {
      results.push({ slideDir, slideId: logicalSlideId, skipped: true });
      continue;
    }

    const { skip, current, versions } = await buildMigrationGroups({
      projectRoot: resolvedProjectRoot,
      logicalSlideId,
      slideDir,
    });
    if (skip) {
      results.push({ slideDir, slideId: logicalSlideId, skipped: true });
      continue;
    }

    const historicalGroupNames = versions.flatMap((group) =>
      getGroupSources(group)
        .map((source) => getSlideLocalTopName({ slideDir, source }))
        .filter(Boolean)
    );

    let currentCreated = null;
    if (current?.source === ".") {
      currentCreated = await importCurrentRootBundle({
        projectRoot: resolvedProjectRoot,
        slideId: logicalSlideId,
        slideDir,
        label: current.label || logicalSlideId,
        excludeNames: [...new Set(historicalGroupNames)],
      });
      if (currentCreated) {
        replacements.set(resolve(slideDir), currentCreated.versionDir);
      }
      await maybeImportTuneAttempts({
        projectRoot: resolvedProjectRoot,
        slideId: logicalSlideId,
        slideDir,
        parentLabel: current?.label || logicalSlideId,
        parentSource: ".",
      });
    } else if (current?.source) {
      currentCreated = await importHistoricalGroup({
        projectRoot: resolvedProjectRoot,
        slideId: logicalSlideId,
        slideDir,
        group: {
          ...current,
          sourceKind: current.sourceKind ?? "legacy-import",
        },
      });
      replacements.set(
        resolveMigrationSourcePath({ slideDir, source: current.source }),
        currentCreated.versionDir
      );
      await maybeImportTuneAttempts({
        projectRoot: resolvedProjectRoot,
        slideId: logicalSlideId,
        slideDir,
        parentLabel: current.label || current.source,
        parentSource: current.source,
      });
    } else {
      await writeSlideManifest({
        slideDir,
        manifest: defaultManifest({ slideId: logicalSlideId, slideDir }),
      });
    }

    for (const group of versions) {
      const imported = await importHistoricalGroup({
        projectRoot: resolvedProjectRoot,
        slideId: logicalSlideId,
        slideDir,
        group,
      });
      replacements.set(
        resolveMigrationSourcePath({ slideDir, source: group.source }),
        imported.versionDir
      );
      await maybeImportTuneAttempts({
        projectRoot: resolvedProjectRoot,
        slideId: logicalSlideId,
        slideDir,
        parentLabel: group.label,
        parentSource: group.source,
      });
    }

    if (currentCreated) {
      await promoteSlideVersion({
        projectRoot: resolvedProjectRoot,
        slideId: logicalSlideId,
        slideDir,
        versionId: currentCreated.versionId,
      });
    } else {
      const manifest = await readSlideManifest({
        projectRoot: resolvedProjectRoot,
        slideId: logicalSlideId,
        slideDir,
      });
      if (manifest.versions.length > 0) {
        const versionEntries = [];
        for (const entry of manifest.versions) {
          const entryDir = resolve(REPO_ROOT, entry.dir);
          const versionDoc = await readVersionDoc(entryDir);
          const nextVersionDoc = {
            ...versionDoc,
            status: "archived",
          };
          await writeVersionDoc({ versionDir: entryDir, versionDoc: nextVersionDoc });
          versionEntries.push(summarizeVersion(nextVersionDoc));
        }
        await writeSlideManifest({
          slideDir,
          manifest: {
            ...manifest,
            slideId: logicalSlideId,
            slideDir: toRepoRelativePath(slideDir),
            currentVersionId: null,
            versions: versionEntries,
          },
        });
      }
      await compactSlideRoot({
        projectRoot: resolvedProjectRoot,
        slideId: logicalSlideId,
        slideDir,
      });
    }

    for (const group of versions) {
      for (const topName of getGroupSources(group)
        .map((source) => getSlideLocalTopName({ slideDir, source }))
        .filter(Boolean)) {
        if (existsSync(resolve(slideDir, topName))) {
          await rm(resolve(slideDir, topName), { recursive: true, force: true });
        }
      }
    }
    for (const topName of getGroupSources(current ?? {})
      .map((source) => getSlideLocalTopName({ slideDir, source }))
      .filter(Boolean)) {
      if (existsSync(resolve(slideDir, topName))) {
        await rm(resolve(slideDir, topName), { recursive: true, force: true });
      }
    }

    results.push({
      slideDir,
      slideId: logicalSlideId,
      currentVersionId: currentCreated?.versionId ?? null,
    });
  }

  await rewriteDeckSpecVersionPaths({
    projectRoot: resolvedProjectRoot,
    replacements,
  });

  return { ok: true, results };
};
