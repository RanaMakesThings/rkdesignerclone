import { existsSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { basename, resolve } from "node:path";

import { readDeckSpec } from "./read-deck-spec.mjs";
import { resolveSlideCanonicalAssets } from "./resolve-assets.mjs";
import { toRepoRelativePath } from "./path-normalize.mjs";
import { readReconciledSlideManifest } from "../../scripts/figures/lib/slide-versioning.mjs";

const DESIGNER_PROJECT_ID = "designer-health";

const ROOT_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".svg"];
const VERSION_PREVIEW_CANDIDATES = [
  "figure.png",
  "figure.jpg",
  "figure.jpeg",
  "figure.webp",
  "figure.svg",
  "preview.png",
  "preview.jpg",
  "preview.jpeg",
  "preview.webp",
  "preview.svg",
  "codex-html/preview.png",
  "codex-html/preview.jpg",
  "codex-html/preview.jpeg",
  "codex-html/preview.webp",
  "codex-html/preview.svg",
  "gemini-html/preview.png",
  "gemini-html/preview.jpg",
  "gemini-html/preview.jpeg",
  "gemini-html/preview.webp",
  "gemini-html/preview.svg",
  "image-01.jpg",
  "image-01.jpeg",
  "image-01.png",
  "image-01.webp",
];
const VERSION_HTML_CANDIDATES = [
  "figure.html",
  "generated.html",
  "gemini-html/generated.html",
];
const VERSION_SVG_CANDIDATES = [
  "figure.svg",
  "preview.svg",
  "gemini-html/preview.svg",
];

const normalizeLookup = (value) => String(value ?? "").trim().toLowerCase();

const toDisplayAlias = (value) => {
  const raw = normalizeLookup(value);
  if (!raw) {
    return null;
  }
  if (/^\d+$/.test(raw)) {
    return String(Number(raw));
  }
  if (/^slide-\d+$/.test(raw)) {
    return String(Number(raw.replace("slide-", "")));
  }
  return null;
};

const toCanonicalSlideParam = (slide) =>
  /^\d+$/.test(String(slide?.displayNumber ?? "").trim())
    ? String(Number(slide.displayNumber))
    : String(slide?.slideId ?? "").trim();

const inferAssetKind = (pathLike) => {
  const normalized = String(pathLike ?? "").toLowerCase();
  if (!normalized) {
    return "other";
  }
  if (normalized.endsWith(".html")) {
    return "html";
  }
  if (normalized.endsWith(".svg")) {
    return "svg";
  }
  if (normalized.endsWith(".json")) {
    return "json";
  }
  if (/\.(png|jpe?g|webp|gif)$/i.test(normalized)) {
    return "image";
  }
  if (!/\.[^/]+$/i.test(normalized)) {
    return "directory";
  }
  return "other";
};

const createAssetRef = (
  absolutePath,
  displayPath,
  label = null,
  provenance = "checked-in-generated"
) => ({
  path: displayPath,
  absolutePath,
  exists: existsSync(absolutePath),
  provenance,
  canonicalNavigation: true,
  label,
  kind: inferAssetKind(displayPath),
});

const createExistingAssetRef = (repoRoot, repoRelativePath, label = null) => {
  if (!repoRelativePath) {
    return null;
  }
  const ref = createAssetRef(
    resolve(repoRoot, repoRelativePath),
    repoRelativePath,
    label
  );
  return ref.exists ? ref : null;
};

const readJsonFile = (absolutePath) =>
  JSON.parse(readFileSync(absolutePath, "utf8"));

const findFirstExistingRef = (repoRoot, basePath, candidates, label = null) => {
  for (const candidate of candidates) {
    const repoRelativePath = `${basePath}/${candidate}`.replaceAll("//", "/");
    const ref = createExistingAssetRef(repoRoot, repoRelativePath, label);
    if (ref) {
      return ref;
    }
  }
  return null;
};

const sortVersions = (left, right) => {
  if (left.isCurrent !== right.isCurrent) {
    return left.isCurrent ? -1 : 1;
  }
  const leftTime = left.createdAt ? Date.parse(left.createdAt) : 0;
  const rightTime = right.createdAt ? Date.parse(right.createdAt) : 0;
  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }
  return right.id.localeCompare(left.id);
};

const findRootCurrentAssets = async ({
  repoRoot,
  slideDir,
  currentVersionId,
}) => {
  if (!currentVersionId) {
    return {
      preview: null,
      html: null,
      svg: null,
    };
  }

  const absoluteSlideDir = resolve(repoRoot, slideDir);
  let entries = [];
  try {
    entries = await readdir(absoluteSlideDir, { withFileTypes: true });
  } catch {
    return {
      preview: null,
      html: null,
      svg: null,
    };
  }

  const currentFiles = entries
    .filter((entry) => entry.isFile() && entry.name.includes(`--${currentVersionId}`))
    .map((entry) => entry.name);

  const previewCandidate = ROOT_IMAGE_EXTENSIONS.map((extension) =>
    currentFiles.find((fileName) => fileName.endsWith(extension))
  ).find(Boolean);
  const htmlCandidate = currentFiles.find((fileName) => fileName.endsWith(".html")) ?? null;
  const svgCandidate = currentFiles.find((fileName) => fileName.endsWith(".svg")) ?? null;

  return {
    preview: previewCandidate
      ? createAssetRef(
          resolve(repoRoot, `${slideDir}/${previewCandidate}`),
          `${slideDir}/${previewCandidate}`,
          "Current Preview"
        )
      : null,
    html: htmlCandidate
      ? createAssetRef(
          resolve(repoRoot, `${slideDir}/${htmlCandidate}`),
          `${slideDir}/${htmlCandidate}`,
          "Current HTML"
        )
      : null,
    svg: svgCandidate
      ? createAssetRef(
          resolve(repoRoot, `${slideDir}/${svgCandidate}`),
          `${slideDir}/${svgCandidate}`,
          "Current SVG"
        )
      : null,
  };
};

const resolveVersionSourceSlides = ({ slide, slideById }) => {
  const orderedSourceIds = [
    slide.id,
    ...(Array.isArray(slide.historySourceSlideIds) ? slide.historySourceSlideIds : []),
  ];
  const seen = new Set();
  return orderedSourceIds
    .map((sourceId) => String(sourceId ?? "").trim())
    .filter((sourceId) => {
      if (!sourceId || seen.has(sourceId)) {
        return false;
      }
      seen.add(sourceId);
      return true;
    })
    .map((sourceId) => slideById.get(sourceId))
    .filter(Boolean);
};

const buildVersionSourceMetadata = (slide) => ({
  sourceSlideId: slide.id,
  sourceDisplayNumber: String(slide.displayNumber ?? ""),
  sourceTitle: slide.title ?? null,
  sourceStatus: slide.status ?? null,
  sourceStampedRootId: slide.paths?.stampedDir?.trim()
    ? basename(slide.paths.stampedDir.trim())
    : null,
});

const buildVersionRecord = async ({
  repoRoot,
  ownerSlide,
  sourceSlide,
  rootManifest,
  entry,
}) => {
  const manifestPath = `${entry.dir}/version.json`;
  const manifestAbsolutePath = resolve(repoRoot, manifestPath);
  const versionManifest = existsSync(manifestAbsolutePath)
    ? readJsonFile(manifestAbsolutePath)
    : null;

  const id = versionManifest?.id ?? entry.id;
  const preview = findFirstExistingRef(
    repoRoot,
    entry.dir,
    VERSION_PREVIEW_CANDIDATES,
    "Preview"
  );
  const html = findFirstExistingRef(
    repoRoot,
    entry.dir,
    VERSION_HTML_CANDIDATES,
    "HTML"
  );
  const svg = findFirstExistingRef(
    repoRoot,
    entry.dir,
    VERSION_SVG_CANDIDATES,
    "SVG"
  );
  const isOwnerSource = sourceSlide.id === ownerSlide.id;
  const isCurrent = isOwnerSource && id === rootManifest.currentVersionId;
  const status = isCurrent
    ? "current"
    : isOwnerSource && (versionManifest?.status ?? entry.status) === "draft"
      ? "draft"
      : "archived";

  return {
    id,
    slideId: ownerSlide.id,
    slideDir: ownerSlide.paths?.stampedDir?.trim() || rootManifest.slideDir,
    ...buildVersionSourceMetadata(sourceSlide),
    dir: createAssetRef(resolve(repoRoot, entry.dir), entry.dir, "Version Dir"),
    manifest: existsSync(manifestAbsolutePath)
      ? createAssetRef(manifestAbsolutePath, manifestPath, "Version JSON")
      : null,
    label: versionManifest?.label ?? entry.label ?? id,
    status,
    sourceKind: versionManifest?.sourceKind ?? entry.sourceKind ?? "unknown",
    createdAt: versionManifest?.createdAt ?? entry.createdAt ?? null,
    baseVersionId: versionManifest?.baseVersionId ?? entry.baseVersionId ?? null,
    runId: versionManifest?.runId ?? entry.runId ?? null,
    attempt: versionManifest?.attempt ?? entry.attempt ?? null,
    preview,
    html,
    svg,
    isCurrent,
    promotable: isOwnerSource && !isCurrent,
  };
};

const buildUnavailableSlide = ({
  slide,
  stampedDirPath,
  deckAssetsManifestPath,
  reason,
  repoRoot,
}) => {
  const resolvedAssets = resolveSlideCanonicalAssets({
    repoRoot,
    slideAssetsManifestPath: slide.paths?.assetsManifest?.trim() || null,
    deckAssetsManifestPath,
  });

  return {
    slideId: slide.id,
    displayNumber: String(slide.displayNumber),
    title: slide.title,
    canonicalParam: toCanonicalSlideParam({
      slideId: slide.id,
      displayNumber: String(slide.displayNumber),
    }),
    buildStatus: slide.buildStatus ?? "",
    selectedDirection: slide.selectedDirection ?? "",
    specText: slide.specText ?? "",
    stampedRootId: stampedDirPath ? basename(stampedDirPath) : null,
    stampedDir: stampedDirPath
      ? createAssetRef(
          resolve(repoRoot, stampedDirPath),
          stampedDirPath,
          "Stamped Root"
        )
      : null,
    manifest: stampedDirPath
      ? createExistingAssetRef(repoRoot, `${stampedDirPath}/manifest.json`, "Slide Manifest")
      : null,
    assetsManifest: resolvedAssets.slideManifest,
    deckAssetsManifest: resolvedAssets.deckManifest,
    currentVersionId: null,
    currentVersion: null,
    currentPreview: null,
    currentHtml: null,
    currentSvg: null,
    rootCurrentPreview: null,
    rootCurrentHtml: null,
    rootCurrentSvg: null,
    slideAssets: resolvedAssets.slideAssets,
    deckAssets: resolvedAssets.deckAssets,
    assetCount: resolvedAssets.slideAssets.length + resolvedAssets.deckAssets.length,
    versions: [],
    reviewable: false,
    unavailableReason: reason,
  };
};

const buildSlideRoot = async ({
  repoRoot,
  slide,
  slideById,
  deckAssetsManifestPath,
  projectRoot,
}) => {
  const stampedDirPath = slide.paths?.stampedDir?.trim() || null;
  const logicalSlideDirPath = `${toRepoRelativePath(
    repoRoot,
    projectRoot
  )}/slide-figures/${slide.id}`;
  const resolvedRootDirPath = stampedDirPath || logicalSlideDirPath;
  const resolvedRootAbsolutePath = resolve(repoRoot, resolvedRootDirPath);
  const usingLogicalFallbackRoot = !stampedDirPath;
  const resolvedAssets = resolveSlideCanonicalAssets({
    repoRoot,
    slideAssetsManifestPath: slide.paths?.assetsManifest?.trim() || null,
    deckAssetsManifestPath,
  });

  if (!existsSync(resolvedRootAbsolutePath)) {
    return buildUnavailableSlide({
      slide,
      stampedDirPath: stampedDirPath || null,
      deckAssetsManifestPath,
      reason: stampedDirPath ? "No stamped root directory" : "No slide root",
      repoRoot,
    });
  }

  const manifestPath = `${resolvedRootDirPath}/manifest.json`;
  const manifestAbsolutePath = resolve(repoRoot, manifestPath);
  if (!usingLogicalFallbackRoot && !existsSync(manifestAbsolutePath)) {
    return buildUnavailableSlide({
      slide,
      stampedDirPath: resolvedRootDirPath,
      deckAssetsManifestPath,
      reason: "No slide manifest",
      repoRoot,
    });
  }

  const rootManifest = await readReconciledSlideManifest({
    projectRoot,
    slideId: slide.id,
    slideDir: resolvedRootAbsolutePath,
  });
  const sourceSlides = resolveVersionSourceSlides({
    slide,
    slideById,
  });
  const sourceManifests = await Promise.all(
    sourceSlides.map(async (sourceSlide) => ({
      sourceSlide,
      manifest: await readReconciledSlideManifest({
        projectRoot,
        slideId: sourceSlide.id,
      }),
    }))
  );
  const versions = (
    await Promise.all(
      sourceManifests.flatMap(({ sourceSlide, manifest }) =>
        (manifest.versions ?? []).map((entry) =>
          buildVersionRecord({
            repoRoot,
            ownerSlide: slide,
            sourceSlide,
            rootManifest: manifest,
            entry,
          })
        )
      )
    )
  ).sort(sortVersions);
  const currentVersion =
    versions.find(
      (version) =>
        version.sourceSlideId === slide.id && version.id === rootManifest.currentVersionId
    ) ?? null;
  const rootAssets = await findRootCurrentAssets({
    repoRoot,
    slideDir: rootManifest.slideDir,
    currentVersionId: rootManifest.currentVersionId,
  });
  const currentPreview = rootAssets.preview ?? currentVersion?.preview ?? null;
  const currentHtml = rootAssets.html ?? currentVersion?.html ?? null;
  const currentSvg = rootAssets.svg ?? currentVersion?.svg ?? null;
  const reviewable = Boolean(rootManifest.currentVersionId && currentVersion && currentPreview);

  let unavailableReason = null;
  if (!rootManifest.currentVersionId) {
    unavailableReason = "No current version";
  } else if (!currentVersion) {
    unavailableReason = "Current version missing";
  } else if (!currentPreview) {
    unavailableReason = "No preview asset";
  }

  return {
    slideId: slide.id,
    displayNumber: String(slide.displayNumber),
    title: slide.title,
    canonicalParam: toCanonicalSlideParam({
      slideId: slide.id,
      displayNumber: String(slide.displayNumber),
    }),
    buildStatus: slide.buildStatus ?? "",
    selectedDirection: slide.selectedDirection ?? "",
    specText: slide.specText ?? "",
    stampedRootId: basename(resolvedRootDirPath),
    stampedDir: createAssetRef(
      resolvedRootAbsolutePath,
      resolvedRootDirPath,
      "Stamped Root"
    ),
    manifest: createAssetRef(
      resolve(repoRoot, manifestPath),
      manifestPath,
      "Slide Manifest"
    ),
    assetsManifest: resolvedAssets.slideManifest,
    deckAssetsManifest: resolvedAssets.deckManifest,
    currentVersionId: rootManifest.currentVersionId,
    currentVersion,
    currentPreview,
    currentHtml,
    currentSvg,
    rootCurrentPreview: rootAssets.preview,
    rootCurrentHtml: rootAssets.html,
    rootCurrentSvg: rootAssets.svg,
    slideAssets: resolvedAssets.slideAssets,
    deckAssets: resolvedAssets.deckAssets,
    assetCount: resolvedAssets.slideAssets.length + resolvedAssets.deckAssets.length,
    versions,
    reviewable,
    unavailableReason,
  };
};

const resolveRequestedSlides = ({ slides, requestedSlides }) => {
  if (!Array.isArray(requestedSlides) || requestedSlides.length === 0) {
    return slides;
  }

  const resolved = [];
  const seen = new Set();
  for (const requestedSlide of requestedSlides) {
    const raw = normalizeLookup(requestedSlide);
    if (!raw) {
      continue;
    }
    const directMatch =
      slides.find((slide) => normalizeLookup(slide.slideId) === raw) ??
      slides.find((slide) => normalizeLookup(slide.displayNumber) === raw) ??
      null;
    const alias = toDisplayAlias(requestedSlide);
    const aliasMatch =
      directMatch ??
      (alias
        ? slides.find(
            (slide) => normalizeLookup(slide.displayNumber) === normalizeLookup(alias)
          ) ?? null
        : null);
    if (!aliasMatch) {
      throw new Error(`Could not find active Designer slide "${requestedSlide}".`);
    }
    if (seen.has(aliasMatch.slideId)) {
      continue;
    }
    seen.add(aliasMatch.slideId);
    resolved.push(aliasMatch);
  }
  return resolved;
};

export const resolveDesignerSelectedSlides = async ({
  repoRoot,
  projectId = DESIGNER_PROJECT_ID,
  slides = null,
} = {}) => {
  const projectRoot = resolve(repoRoot, "projects", projectId);
  const { deckSpecPath, deckSpec } = await readDeckSpec(projectRoot);
  const deckAssetsManifestPath = deckSpec.paths?.deckAssetsManifest?.trim() || null;
  const slideById = new Map(
    (Array.isArray(deckSpec.slides) ? deckSpec.slides : []).map((slide) => [slide.id, slide])
  );

  const activeSlides = await Promise.all(
    deckSpec.slides
      .filter((slide) => slide.status === "active")
      .map((slide) =>
        buildSlideRoot({
          repoRoot,
          slide,
          slideById,
          deckAssetsManifestPath,
          projectRoot,
        })
      )
  );

  const filteredSlides = resolveRequestedSlides({
    slides: activeSlides,
    requestedSlides: slides,
  });

  return {
    projectId: deckSpec.deckId,
    projectRoot: toRepoRelativePath(repoRoot, projectRoot),
    title: deckSpec.title,
    version: deckSpec.version,
    status: deckSpec.status,
    deckSpecPath: toRepoRelativePath(repoRoot, deckSpecPath),
    numberingSummary: deckSpec.numberingPolicy?.summary ?? "",
    generatedAt: new Date().toISOString(),
    activeSlides: filteredSlides,
    reviewableSlides: filteredSlides.filter((slide) => slide.reviewable),
    unavailableSlides: filteredSlides.filter((slide) => !slide.reviewable),
    slidesWithAssets: filteredSlides.filter((slide) => slide.assetCount > 0).length,
  };
};

export const resolveDesignerSelectedSlideContext = async ({
  repoRoot,
  slide,
}) => {
  const deck = await resolveDesignerSelectedSlides({ repoRoot });
  const normalizedRequested = String(slide ?? "").trim();
  if (!normalizedRequested) {
    return {
      deck,
      slide: null,
      requestedSlideId: slide ?? "",
      resolvedSlideId: null,
      canonicalParam: null,
    };
  }

  const normalizedLookup = normalizeLookup(normalizedRequested);
  const repoSlideMatch =
    deck.activeSlides.find((entry) => normalizeLookup(entry.slideId) === normalizedLookup) ??
    null;
  if (repoSlideMatch) {
    return {
      deck,
      slide: repoSlideMatch,
      requestedSlideId: normalizedRequested,
      resolvedSlideId: repoSlideMatch.slideId,
      canonicalParam: repoSlideMatch.canonicalParam,
    };
  }

  const displayMatch =
    deck.activeSlides.find(
      (entry) => normalizeLookup(entry.displayNumber) === normalizedLookup
    ) ?? null;
  if (displayMatch) {
    return {
      deck,
      slide: displayMatch,
      requestedSlideId: normalizedRequested,
      resolvedSlideId: displayMatch.slideId,
      canonicalParam: displayMatch.canonicalParam,
    };
  }

  const displayAlias = toDisplayAlias(normalizedRequested);
  if (displayAlias) {
    const aliasMatch =
      deck.activeSlides.find(
        (entry) => normalizeLookup(entry.displayNumber) === normalizeLookup(displayAlias)
      ) ?? null;
    if (aliasMatch) {
      return {
        deck,
        slide: aliasMatch,
        requestedSlideId: normalizedRequested,
        resolvedSlideId: aliasMatch.slideId,
        canonicalParam: aliasMatch.canonicalParam,
      };
    }
  }

  return {
    deck,
    slide: null,
    requestedSlideId: normalizedRequested,
    resolvedSlideId: null,
    canonicalParam: null,
  };
};
