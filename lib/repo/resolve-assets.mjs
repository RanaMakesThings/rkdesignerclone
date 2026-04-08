import { existsSync, readFileSync } from "node:fs";

import { classifyPathReference } from "./path-normalize.mjs";

const buildRef = (
  repoRoot,
  pathLike,
  provenance = "canonical-human-authored",
  label = null
) => {
  if (!pathLike) {
    return null;
  }

  const classified = classifyPathReference(repoRoot, pathLike);
  if (classified.kind === "repo-relative") {
    return {
      path: classified.repoRelativePath,
      absolutePath: classified.absolutePath,
      exists: existsSync(classified.absolutePath),
      provenance,
      canonicalNavigation: true,
      label,
    };
  }

  if (classified.kind === "external-stale") {
    return {
      path: String(pathLike),
      absolutePath: null,
      exists: false,
      provenance: "external-stale",
      canonicalNavigation: false,
      label,
    };
  }

  return null;
};

const normalizeFileEntries = (repoRoot, entries, provenance) =>
  (Array.isArray(entries) ? entries : [])
    .map((entry) => {
      const ref = buildRef(repoRoot, entry?.path, provenance, entry?.label ?? null);
      if (!ref) {
        return null;
      }
      return {
        label: entry?.label ?? null,
        ref,
      };
    })
    .filter(Boolean);

const normalizeAssetRecord = (repoRoot, asset, provenance) => ({
  assetId: asset?.assetId ? String(asset.assetId) : null,
  id: String(asset?.id ?? ""),
  label: String(asset?.label ?? asset?.id ?? ""),
  status: asset?.status ? String(asset.status) : null,
  kind: asset?.kind ? String(asset.kind) : null,
  role: asset?.role ? String(asset.role) : null,
  summary: asset?.summary ? String(asset.summary) : null,
  preview: buildRef(repoRoot, asset?.previewPath, provenance, "Preview"),
  files: normalizeFileEntries(repoRoot, asset?.files, provenance),
  sourceFiles: normalizeFileEntries(repoRoot, asset?.sourceFiles, provenance),
  tags: Array.isArray(asset?.tags) ? asset.tags.map(String).filter(Boolean) : [],
  notes: Array.isArray(asset?.notes) ? asset.notes.map(String).filter(Boolean) : [],
});

export const readCanonicalAssetManifest = ({
  repoRoot,
  manifestPath,
  provenance = "canonical-human-authored",
} = {}) => {
  const manifest = buildRef(repoRoot, manifestPath, provenance, "Asset Manifest");
  if (!manifest?.absolutePath || !manifest.exists) {
    return {
      manifest,
      manifestVersion: null,
      projectId: null,
      kind: null,
      slideId: null,
      deckAssetIds: [],
      assets: [],
    };
  }

  const payload = JSON.parse(readFileSync(manifest.absolutePath, "utf8"));
  return {
    manifest,
    manifestVersion: payload?.manifestVersion ?? null,
    projectId: payload?.projectId ? String(payload.projectId) : null,
    kind: payload?.kind ? String(payload.kind) : null,
    slideId: payload?.slideId ? String(payload.slideId) : null,
    deckAssetIds: Array.isArray(payload?.deckAssetIds)
      ? payload.deckAssetIds.map(String).filter(Boolean)
      : [],
    assets: (Array.isArray(payload?.assets) ? payload.assets : [])
      .map((asset) => normalizeAssetRecord(repoRoot, asset, provenance))
      .filter((asset) => asset.id),
  };
};

export const resolveSlideCanonicalAssets = ({
  repoRoot,
  slideAssetsManifestPath,
  deckAssetsManifestPath,
  provenance = "canonical-human-authored",
} = {}) => {
  const slideManifest = readCanonicalAssetManifest({
    repoRoot,
    manifestPath: slideAssetsManifestPath,
    provenance,
  });
  const deckManifest = readCanonicalAssetManifest({
    repoRoot,
    manifestPath: deckAssetsManifestPath,
    provenance,
  });

  const deckAssetsById = new Map(deckManifest.assets.map((asset) => [asset.id, asset]));
  const unresolvedDeckAssetIds = [];
  const linkedDeckAssets = [];

  for (const deckAssetId of slideManifest.deckAssetIds) {
    const asset = deckAssetsById.get(deckAssetId);
    if (asset) {
      linkedDeckAssets.push(asset);
    } else {
      unresolvedDeckAssetIds.push(deckAssetId);
    }
  }

  return {
    slideManifest: slideManifest.manifest,
    deckManifest: deckManifest.manifest,
    slideAssets: slideManifest.assets,
    deckAssets: linkedDeckAssets,
    unresolvedDeckAssetIds,
  };
};
