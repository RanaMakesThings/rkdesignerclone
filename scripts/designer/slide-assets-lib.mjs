import { existsSync } from "node:fs";
import {
  copyFile,
  stat,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";

import {
  normalizeRepoRelativePath,
  resolveDesignerRepoRoot,
  toRepoRelativePath,
} from "../../lib/repo/index.mjs";
import {
  readDeckSpec,
  resolveDeckSlideEntry,
} from "../../lib/repo/read-deck-spec.mjs";

const DEFAULT_PROJECT_ROOT = "projects/designer-health";
const ASSET_ID_RE = /^asset-(\d{6})$/i;

const PREVIEW_CANDIDATES = [
  "figure.png",
  "figure.jpg",
  "figure.jpeg",
  "figure.webp",
  "preview.png",
  "preview.jpg",
  "preview.jpeg",
  "preview.webp",
  "image-01.png",
  "image-01.jpg",
  "image-01.jpeg",
  "image-01.webp",
];

const slugify = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "asset";

const readJson = async (filePath) =>
  JSON.parse(await readFile(filePath, "utf8"));

const formatAssetId = (value) => `asset-${String(value).padStart(6, "0")}`;

const parseAssetIdNumber = (value) => {
  const match = String(value ?? "").match(ASSET_ID_RE);
  return match ? Number(match[1]) : null;
};

const writeJson = async (filePath, value) => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const readOrCreateManifest = async ({
  manifestPath,
  slideId,
}) => {
  if (existsSync(manifestPath)) {
    return readJson(manifestPath);
  }

  return {
    manifestVersion: 1,
    projectId: "designer-health",
    kind: "slide-assets",
    slideId,
    deckAssetIds: [],
    assets: [],
  };
};

const allocateNextAssetId = async ({
  repoRoot,
  deckSpec,
}) => {
  const manifestPaths = new Set();

  if (deckSpec?.paths?.deckAssetsManifest) {
    manifestPaths.add(resolve(repoRoot, deckSpec.paths.deckAssetsManifest));
  }

  for (const slideEntry of Array.isArray(deckSpec?.slides) ? deckSpec.slides : []) {
    if (slideEntry?.paths?.assetsManifest) {
      manifestPaths.add(resolve(repoRoot, slideEntry.paths.assetsManifest));
    }
  }

  let maxAssetNumber = 0;
  for (const manifestPath of manifestPaths) {
    if (!existsSync(manifestPath)) {
      continue;
    }
    const manifest = await readJson(manifestPath);
    for (const asset of Array.isArray(manifest?.assets) ? manifest.assets : []) {
      const parsed = parseAssetIdNumber(asset?.assetId);
      if (parsed && parsed > maxAssetNumber) {
        maxAssetNumber = parsed;
      }
    }
  }

  return formatAssetId(maxAssetNumber + 1);
};

const toRepoPath = (repoRoot, absolutePath) =>
  normalizeRepoRelativePath(toRepoRelativePath(repoRoot, absolutePath));

const findPreviewInDir = async (dirPath, depth = 0) => {
  for (const fileName of PREVIEW_CANDIDATES) {
    const candidate = resolve(dirPath, fileName);
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  if (depth >= 3) {
    return null;
  }

  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const nested = await findPreviewInDir(resolve(dirPath, entry.name), depth + 1);
    if (nested) {
      return nested;
    }
  }

  return null;
};

const resolveSourcePreview = async (sourcePath) => {
  if (!existsSync(sourcePath)) {
    throw new Error(`Source path does not exist: ${sourcePath}`);
  }

  const stats = await stat(sourcePath);
  if (stats.isDirectory()) {
    const previewPath = await findPreviewInDir(sourcePath);
    if (!previewPath) {
      throw new Error(`Could not find a previewable asset in ${sourcePath}.`);
    }
    return {
      sourceType: "directory",
      previewPath,
    };
  }

  return {
    sourceType: "file",
    previewPath: sourcePath,
  };
};

const buildSourceFiles = ({ repoRoot, sourcePath, previewPath, sourceType }) => {
  const sourceFiles = [];
  const pushSource = (label, absolutePath) => {
    if (!absolutePath.startsWith(resolve(repoRoot))) {
      return;
    }
    sourceFiles.push({
      label,
      path: toRepoPath(repoRoot, absolutePath),
    });
  };

  pushSource(sourceType === "directory" ? "Source Run" : "Source File", sourcePath);
  if (previewPath !== sourcePath) {
    pushSource("Source Preview", previewPath);
  }
  return sourceFiles;
};

export const addDesignerSlideAsset = async ({
  slide,
  source,
  label,
  summary = "",
  status = "reference",
  kind = "image",
  role = "reference",
  tags = [],
  notes = [],
  assetId = null,
  projectRoot = DEFAULT_PROJECT_ROOT,
}) => {
  const repoRoot = resolveDesignerRepoRoot({
    cwd: process.cwd(),
    env: process.env,
  });
  const resolvedProjectRoot = resolve(repoRoot, projectRoot);
  const { deckSpec } = await readDeckSpec(resolvedProjectRoot);
  const slideEntry = resolveDeckSlideEntry({ deckSpec, slide });
  const slideId = slideEntry.id;

  const sourcePath = resolve(String(source));
  const { sourceType, previewPath } = await resolveSourcePreview(sourcePath);
  const resolvedAssetId = assetId ? slugify(assetId) : slugify(label);

  const slideAssetsDir = resolve(resolvedProjectRoot, "slide-assets", slideId);
  const manifestPath = slideEntry?.paths?.assetsManifest
    ? resolve(repoRoot, slideEntry.paths.assetsManifest)
    : resolve(slideAssetsDir, "manifest.json");
  const assetDir = resolve(slideAssetsDir, resolvedAssetId);
  await mkdir(assetDir, { recursive: true });

  const previewExt = extname(previewPath) || ".png";
  const copiedPreviewPath = resolve(assetDir, `preview${previewExt}`);
  await copyFile(previewPath, copiedPreviewPath);

  const manifest = await readOrCreateManifest({
    manifestPath,
    slideId,
  });
  const existingAssets = Array.isArray(manifest.assets) ? manifest.assets : [];
  const existingAsset = existingAssets.find(
    (entry) => String(entry?.id ?? "") === resolvedAssetId
  );
  const canonicalAssetId =
    existingAsset?.assetId && parseAssetIdNumber(existingAsset.assetId)
      ? String(existingAsset.assetId)
      : await allocateNextAssetId({
          repoRoot,
          deckSpec,
        });

  const assetRecord = {
    assetId: canonicalAssetId,
    id: resolvedAssetId,
    label: String(label),
    status: String(status),
    kind: String(kind),
    role: String(role),
    summary: String(summary),
    previewPath: toRepoPath(repoRoot, copiedPreviewPath),
    files: [
      {
        label: "Preview",
        path: toRepoPath(repoRoot, copiedPreviewPath),
      },
    ],
    sourceFiles: buildSourceFiles({
      repoRoot,
      sourcePath,
      previewPath,
      sourceType,
    }),
    tags: Array.isArray(tags) ? tags.map(String).filter(Boolean) : [],
    notes: Array.isArray(notes) ? notes.map(String).filter(Boolean) : [],
  };

  const nextAssets = [
    ...existingAssets.filter((entry) => String(entry?.id ?? "") !== resolvedAssetId),
    assetRecord,
  ].sort((left, right) => String(left.id).localeCompare(String(right.id)));

  const nextManifest = {
    manifestVersion: manifest.manifestVersion ?? 1,
    projectId: manifest.projectId ?? "designer-health",
    kind: "slide-assets",
    slideId,
    deckAssetIds: Array.isArray(manifest.deckAssetIds) ? manifest.deckAssetIds : [],
    assets: nextAssets,
  };

  await writeJson(manifestPath, nextManifest);

  return {
    ok: true,
    slideId,
    canonicalAssetId,
    label: assetRecord.label,
    assetId: resolvedAssetId,
    manifestPath,
    copiedPreviewPath,
  };
};
