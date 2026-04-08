import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { basename, resolve } from "node:path";

import { resolveDesignerSelectedSlides as resolveLegacyDesignerSelectedSlides } from "./designer-selected-slides.mjs";

const ROOT_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".svg"];
const DEFAULT_SLIDE_VIEWPORT = {
  width: 1920,
  height: 1080,
};
const SVG_SLIDE_MIN_DIMENSION = 1000;
const SVG_ASPECT_RATIO = DEFAULT_SLIDE_VIEWPORT.width / DEFAULT_SLIDE_VIEWPORT.height;
const SVG_ASPECT_TOLERANCE = 0.12;
const HTML_ASSET_HEAVY_IMAGE_THRESHOLD = 12;

const normalizeLookup = (value) => String(value ?? "").trim().toLowerCase();
const stripQueryAndHash = (value) => String(value ?? "").split(/[?#]/, 1)[0];

export const toDesignerDisplayAlias = (value) => {
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

export const toDesignerCanonicalSlideParam = (slide) =>
  /^\d+$/.test(String(slide?.displayNumber ?? "").trim())
    ? String(Number(slide.displayNumber))
    : String(slide?.slideId ?? "");

const createAssetRef = (
  absolutePath,
  displayPath,
  kind,
  label,
  provenance = "checked-in-generated"
) => ({
  path: displayPath,
  absolutePath,
  exists: existsSync(absolutePath),
  label: label ?? null,
  provenance,
  canonicalNavigation: true,
  kind,
});

export const resolveDesignerRootCurrentAssets = async ({
  repoRoot,
  slideDir,
  currentVersionId,
}) => {
  if (!currentVersionId) {
    return {
      preview: null,
      html: null,
      svg: null,
      svgTrust: {
        status: "missing",
        reason: "No current SVG asset.",
        trustedPath: null,
        containsForeignObject: false,
        dimensions: null,
      },
      svgPassThroughPath: null,
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
      svgTrust: {
        status: "missing",
        reason: "Current SVG asset path does not exist.",
        trustedPath: null,
        containsForeignObject: false,
        dimensions: null,
      },
      svgPassThroughPath: null,
    };
  }

  const currentFiles = entries
    .filter((entry) => entry.isFile() && entry.name.includes(`--${currentVersionId}`))
    .map((entry) => entry.name);

  const previewFile = ROOT_IMAGE_EXTENSIONS
    .map((extension) => currentFiles.find((fileName) => fileName.endsWith(extension)))
    .find(Boolean);
  const htmlFile = currentFiles.find((fileName) => fileName.endsWith(".html")) ?? null;
  const svgFile = currentFiles.find((fileName) => fileName.endsWith(".svg")) ?? null;

  const svgTrust = await classifySvgAssetTrust({
    repoRoot,
    svgPath: svgFile ? `${slideDir}/${svgFile}` : null,
  });

  return {
    preview: previewFile
      ? createAssetRef(resolve(repoRoot, `${slideDir}/${previewFile}`), `${slideDir}/${previewFile}`, "image", "Current Preview")
      : null,
    html: htmlFile
      ? createAssetRef(resolve(repoRoot, `${slideDir}/${htmlFile}`), `${slideDir}/${htmlFile}`, "html", "Current HTML")
      : null,
    svg: svgFile
      ? createAssetRef(resolve(repoRoot, `${slideDir}/${svgFile}`), `${slideDir}/${svgFile}`, "svg", "Current SVG")
      : null,
    svgTrust,
    svgPassThroughPath: svgTrust.trustedPath,
  };
};

export const resolveDesignerSelectedSlideContext = ({ activeSlides, requestedSlideId }) => {
  const normalizedRequested = normalizeLookup(requestedSlideId);
  if (!normalizedRequested) {
    return {
      slide: null,
      requestedSlideId,
      resolvedSlideId: null,
      canonicalParam: null,
    };
  }

  const repoSlideMatch =
    activeSlides.find((entry) => normalizeLookup(entry.slideId) === normalizedRequested) ?? null;
  if (repoSlideMatch) {
    return {
      slide: repoSlideMatch,
      requestedSlideId,
      resolvedSlideId: repoSlideMatch.slideId,
      canonicalParam:
        String(repoSlideMatch.canonicalParam ?? "").trim() ||
        toDesignerCanonicalSlideParam(repoSlideMatch),
    };
  }

  const displayMatch =
    activeSlides.find((entry) => normalizeLookup(entry.displayNumber) === normalizedRequested) ??
    null;
  if (displayMatch) {
    return {
      slide: displayMatch,
      requestedSlideId,
      resolvedSlideId: displayMatch.slideId,
      canonicalParam:
        String(displayMatch.canonicalParam ?? "").trim() ||
        toDesignerCanonicalSlideParam(displayMatch),
    };
  }

  const displayAlias = toDesignerDisplayAlias(requestedSlideId);
  if (displayAlias) {
    const aliasMatch =
      activeSlides.find(
        (entry) => normalizeLookup(entry.displayNumber) === normalizeLookup(displayAlias)
      ) ?? null;
    if (aliasMatch) {
      return {
        slide: aliasMatch,
        requestedSlideId,
        resolvedSlideId: aliasMatch.slideId,
        canonicalParam:
          String(aliasMatch.canonicalParam ?? "").trim() ||
          toDesignerCanonicalSlideParam(aliasMatch),
      };
    }
  }

  return {
    slide: null,
    requestedSlideId,
    resolvedSlideId: null,
    canonicalParam: null,
  };
};

const toPath = (ref) => ref?.path ?? null;

const parseNumericDimension = (value) => {
  const match = String(value ?? "").trim().match(/^-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
};

const classifySvgAssetTrust = async ({ repoRoot, svgPath }) => {
  if (!svgPath) {
    return {
      status: "missing",
      reason: "No current SVG asset.",
      trustedPath: null,
      containsForeignObject: false,
      dimensions: null,
    };
  }

  const absolutePath = resolve(repoRoot, svgPath);
  if (!existsSync(absolutePath)) {
    return {
      status: "missing",
      reason: "Current SVG asset path does not exist.",
      trustedPath: null,
      containsForeignObject: false,
      dimensions: null,
    };
  }

  const svg = await readFile(absolutePath, "utf8");
  const containsForeignObject = /<foreignObject\b/i.test(svg);
  const viewBoxMatch = svg.match(/\bviewBox\s*=\s*"([^"]+)"/i);
  const viewBoxParts = viewBoxMatch?.[1]
    ?.trim()
    .split(/[\s,]+/)
    .map(Number)
    .filter((part) => Number.isFinite(part));
  const widthMatch = svg.match(/\bwidth\s*=\s*"([^"]+)"/i);
  const heightMatch = svg.match(/\bheight\s*=\s*"([^"]+)"/i);
  const width = viewBoxParts?.length === 4 ? viewBoxParts[2] : parseNumericDimension(widthMatch?.[1]);
  const height = viewBoxParts?.length === 4 ? viewBoxParts[3] : parseNumericDimension(heightMatch?.[1]);
  const aspectRatio = width && height ? width / height : null;
  const dimensions =
    Number.isFinite(width) && Number.isFinite(height)
      ? {
          width,
          height,
          aspectRatio,
        }
      : null;

  if (containsForeignObject) {
    return {
      status: "untrusted",
      reason: "Current SVG embeds HTML via foreignObject.",
      trustedPath: null,
      containsForeignObject,
      dimensions,
    };
  }

  if (!dimensions) {
    return {
      status: "untrusted",
      reason: "Current SVG is missing a readable slide-sized viewport.",
      trustedPath: null,
      containsForeignObject,
      dimensions,
    };
  }

  if (
    Math.max(dimensions.width, dimensions.height) < SVG_SLIDE_MIN_DIMENSION ||
    !Number.isFinite(dimensions.aspectRatio) ||
    Math.abs(dimensions.aspectRatio - SVG_ASPECT_RATIO) > SVG_ASPECT_TOLERANCE
  ) {
    return {
      status: "untrusted",
      reason: `Current SVG viewport ${dimensions.width}x${dimensions.height} is not slide-sized.`,
      trustedPath: null,
      containsForeignObject,
      dimensions,
    };
  }

  return {
    status: "trusted",
    reason: "Current SVG has a full-slide viewport and no foreignObject wrapper.",
    trustedPath: svgPath,
    containsForeignObject,
    dimensions,
  };
};

const classifyHtmlSurface = async ({ repoRoot, htmlPath, trustedCurrentSvgPath }) => {
  if (!htmlPath) {
    return {
      sourceClass: "preview_only",
      wrapperAssetKind: null,
    };
  }

  const html = await readFile(resolve(repoRoot, htmlPath), "utf8");
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyContent = (bodyMatch?.[1] ?? html)
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const wrapperTagMatch =
    bodyContent.match(/^<img\b[^>]*>$/i) ||
    bodyContent.match(/^<img\b[^>]*\/>$/i) ||
    bodyContent.match(/^<(object|embed|svg)\b[\s\S]*<\/\1>$/i);

  if (wrapperTagMatch) {
    const wrapperTag = String(wrapperTagMatch[1] ?? "img").toLowerCase();
    const referenceMatch =
      bodyContent.match(/\b(?:src|data)\s*=\s*"([^"]+)"/i) ||
      bodyContent.match(/\b(?:src|data)\s*=\s*'([^']+)'/i);
    const reference = String(referenceMatch?.[1] ?? "").trim();
    const normalizedReference = stripQueryAndHash(reference).toLowerCase();
    const referenceLooksSvg = wrapperTag === "svg" || normalizedReference.endsWith(".svg");
    const trustedSvgName = trustedCurrentSvgPath
      ? basename(trustedCurrentSvgPath).toLowerCase()
      : null;
    const referencesTrustedSvg =
      Boolean(referenceLooksSvg && trustedSvgName) &&
      basename(normalizedReference) === trustedSvgName;
    const wrapperAssetKind =
      wrapperTag === "svg" || referencesTrustedSvg ? "svg" : "image";
    return {
      sourceClass: "html_wrapper_asset",
      wrapperAssetKind,
    };
  }

  const imageTags = (html.match(/<img\b/gi) || []).length;
  if (imageTags >= HTML_ASSET_HEAVY_IMAGE_THRESHOLD) {
    return {
      sourceClass: "html_asset_heavy",
      wrapperAssetKind: null,
    };
  }

  return {
    sourceClass: "html_dom",
    wrapperAssetKind: null,
  };
};

const toVersionSummary = (version) => ({
  id: version.id,
  slideId: version.slideId,
  slideDir: version.slideDir,
  sourceSlideId: version.sourceSlideId,
  sourceDisplayNumber: version.sourceDisplayNumber,
  sourceTitle: version.sourceTitle,
  sourceStatus: version.sourceStatus,
  sourceStampedRootId: version.sourceStampedRootId,
  label: version.label,
  status: version.status,
  sourceKind: version.sourceKind,
  createdAt: version.createdAt,
  baseVersionId: version.baseVersionId,
  runId: version.runId,
  attempt: version.attempt,
  isCurrent: Boolean(version.isCurrent),
  promotable: Boolean(version.promotable),
  dirPath: toPath(version.dir),
  manifestPath: toPath(version.manifest),
  previewPath: toPath(version.preview),
  htmlPath: toPath(version.html),
  svgPath: toPath(version.svg),
});

const toActiveSlideSummary = async (slide, repoRoot) => {
  const currentHtmlPath = toPath(slide.currentHtml);
  const currentSvgPath = toPath(slide.currentSvg);
  const currentSvgTrust = await classifySvgAssetTrust({
    repoRoot,
    svgPath: currentSvgPath,
  });
  const sourceClassification = await classifyHtmlSurface({
    repoRoot,
    htmlPath: currentHtmlPath,
    trustedCurrentSvgPath: currentSvgTrust.trustedPath,
  });
  const sourceWarnings = [];
  if (currentSvgPath && currentSvgTrust.status !== "trusted") {
    sourceWarnings.push(currentSvgTrust.reason);
  }

  return {
    slideId: slide.slideId,
    displayNumber: String(slide.displayNumber ?? ""),
    title: slide.title,
    canonicalParam:
      String(slide.canonicalParam ?? "").trim() || toDesignerCanonicalSlideParam(slide),
    stampedRootId: slide.stampedRootId ?? null,
    stampedDirPath: toPath(slide.stampedDir),
    manifestPath: toPath(slide.manifest),
    currentVersionId: slide.currentVersionId ?? null,
    currentPreviewPath: toPath(slide.currentPreview),
    currentHtmlPath,
    currentSvgPath,
    trustedCurrentSvgPath: currentSvgTrust.trustedPath,
    currentSvgTrusted: currentSvgTrust.status === "trusted",
    currentSvgTrustReason: currentSvgTrust.reason,
    rootCurrentPreviewPath: toPath(slide.rootCurrentPreview),
    rootCurrentHtmlPath: toPath(slide.rootCurrentHtml),
    rootCurrentSvgPath: toPath(slide.rootCurrentSvg),
    sourceClass: sourceClassification.sourceClass,
    wrapperAssetKind: sourceClassification.wrapperAssetKind,
    sourceWarnings,
    reviewable: Boolean(slide.reviewable),
    unavailableReason: slide.unavailableReason ?? null,
    versions: Array.isArray(slide.versions) ? slide.versions.map(toVersionSummary) : [],
  };
};

export const resolveDesignerSelectedSlides = async (options = {}) => {
  const legacy = await resolveLegacyDesignerSelectedSlides(options);
  const repoRoot = resolve(options.repoRoot ?? process.cwd());
  return {
    projectId: legacy.projectId,
    title: legacy.title,
    version: legacy.version,
    status: legacy.status,
    deckSpecPath: legacy.deckSpecPath,
    numberingSummary: legacy.numberingSummary,
    activeSlides: Array.isArray(legacy.activeSlides)
      ? await Promise.all(legacy.activeSlides.map((slide) => toActiveSlideSummary(slide, repoRoot)))
      : [],
  };
};
