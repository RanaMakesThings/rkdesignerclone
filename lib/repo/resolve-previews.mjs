import { extname, resolve } from "node:path";
import { existsSync } from "node:fs";

import {
  classifyPathReference,
  normalizeRepoRelativePath,
  toRepoRelativePath,
} from "./path-normalize.mjs";

const PREVIEW_FILE_RE = /\.(png|jpg|jpeg|webp|svg)$/i;
const PREVIEW_PRIORITY = [".png", ".jpg", ".jpeg", ".webp", ".svg", ".html"];

const makePreviewRef = ({ repoRoot, pathLike, provenance, source, allowMissing = false }) => {
  const classified = classifyPathReference(repoRoot, pathLike);
  if (classified.kind !== "repo-relative") {
    return classified.kind === "external-stale"
      ? {
          path: String(pathLike),
          absolutePath: null,
          exists: false,
          provenance: "external-stale",
          source,
          canonicalNavigation: false,
        }
      : null;
  }
  const exists = existsSync(classified.absolutePath);
  if (!exists && !allowMissing) {
    return null;
  }
  return {
    path: classified.repoRelativePath,
    absolutePath: classified.absolutePath,
    exists,
    provenance,
    source,
    canonicalNavigation: true,
  };
};

const pickPreviewFromFiles = ({ repoRoot, files }) => {
  const normalized = (Array.isArray(files) ? files : [])
    .map((entry) => entry?.path ?? entry)
    .filter(Boolean)
    .map((pathLike) => classifyPathReference(repoRoot, pathLike))
    .filter((entry) => entry.kind === "repo-relative")
    .map((entry) => entry.absolutePath)
    .filter((absolutePath) => existsSync(absolutePath));

  const byExt = PREVIEW_PRIORITY.flatMap((extension) =>
    normalized.filter((absolutePath) => extname(absolutePath).toLowerCase() === extension)
  );
  const candidatePath = byExt.at(0);
  if (!candidatePath) {
    return null;
  }

  return makePreviewRef({
    repoRoot,
    pathLike: normalizeRepoRelativePath(toRepoRelativePath(repoRoot, candidatePath)),
    provenance: "canonical",
    source: "selected-variant-files",
  });
};

export const resolveCanonicalSelectedVariant = (slide) => {
  if (!slide?.selectedVariantId || !Array.isArray(slide?.variants)) {
    return null;
  }
  return slide.variants.find((variant) => variant?.id === slide.selectedVariantId) ?? null;
};

export const resolveCanonicalSelectedPreview = ({ repoRoot, slide, selectedVariant }) => {
  if (!selectedVariant) {
    return null;
  }

  const directPreview = makePreviewRef({
    repoRoot,
    pathLike: selectedVariant.previewPath,
    provenance: "canonical",
    source: "selected-variant-previewPath",
    allowMissing: true,
  });
  if (directPreview?.exists) {
    return directPreview;
  }

  const fromFiles = pickPreviewFromFiles({
    repoRoot,
    files: Array.isArray(selectedVariant.files)
      ? selectedVariant.files.map((entry) => entry?.path)
      : [],
  });
  if (fromFiles) {
    return fromFiles;
  }

  return directPreview;
};

export const resolveStampedNativePreview = ({ repoRoot, slide }) => {
  const stampedDirRef = classifyPathReference(repoRoot, slide?.paths?.stampedDir);
  if (stampedDirRef.kind !== "repo-relative") {
    return null;
  }

  const stampedCandidates = ["figure.png", "figure.jpg", "figure.jpeg"];
  for (const candidate of stampedCandidates) {
    const fullPath = resolve(stampedDirRef.absolutePath, candidate);
    if (existsSync(fullPath)) {
      return {
        path: normalizeRepoRelativePath(toRepoRelativePath(repoRoot, fullPath)),
        absolutePath: fullPath,
        exists: true,
        provenance: "checked-in-generated",
        source: `stamped-dir-${candidate}`,
        canonicalNavigation: true,
      };
    }
  }
  return null;
};

export const resolveBestDiscoveredPreview = ({ discoveredGroups }) => {
  for (const group of discoveredGroups ?? []) {
    if (group?.preview && PREVIEW_FILE_RE.test(group.preview.path ?? "")) {
      return group.preview;
    }
  }
  return null;
};

export const previewsPointToSameAsset = (left, right) => {
  if (!left?.path || !right?.path) {
    return false;
  }
  return normalizeRepoRelativePath(left.path) === normalizeRepoRelativePath(right.path);
};

export const resolveCanonicalPreviewSet = ({
  repoRoot,
  slide,
  discoveredGroups = [],
}) => {
  const selectedVariant = resolveCanonicalSelectedVariant(slide);
  const selected = resolveCanonicalSelectedPreview({
    repoRoot,
    slide,
    selectedVariant,
  });
  const stampedNative = resolveStampedNativePreview({ repoRoot, slide });
  const bestDiscovered = resolveBestDiscoveredPreview({ discoveredGroups });

  return {
    selected,
    stampedNative,
    sameAsset: previewsPointToSameAsset(selected, stampedNative),
    bestDiscovered,
    selectedVariant,
  };
};
