import { copyFile, cp, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, extname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { importPlaywright } from "../../utils/html-screenshot-lib.mjs";
import { resolveDesignerSelectedSlides } from "../../../lib/repo/index.mjs";
import {
  comparePngFiles,
  DEFAULT_SLIDE_VIEWPORT,
  DESIGNER_PROJECT_ID,
  ensureDir,
  ensureParentDir,
  normalizeCssLineHeight,
  padDisplayNumber,
  pathExists,
  slugify,
  writeJson,
} from "./export-common.mjs";

const ATTR_REF_RE = /\b(src|href)\s*=\s*(["'])([^"'<>]+)\2/gi;
const CSS_URL_RE = /url\(\s*(["']?)([^)"']+)\1\s*\)/gi;
const EXCLUDED_REFERENCE_PREFIXES = ["#", "data:", "javascript:", "mailto:", "tel:", "about:"];
const REMOTE_REFERENCE_RE = /^(?:https?:)?\/\//i;
const VIEWPORT_EPSILON = 1;
const TEXT_MASK_STYLE_ID = "__pptx_text_mask_style__";
const DEFAULT_QA_THRESHOLD = 0.08;
const PACKET_VERSION = 2;
const BODY_ONLY_IMG_WRAPPER_RE =
  /<body\b[^>]*>\s*<img\b[^>]*\bsrc\s*=\s*(["'])([^"'<>]+)\1[\s\S]*<\/body>/i;
const HTML_ASSET_HEAVY_IMG_THRESHOLD = 8;
const HTML_ASSET_HEAVY_SVG_THRESHOLD = 6;

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const stripQueryAndHash = (value) => {
  const raw = String(value ?? "");
  const hashIndex = raw.indexOf("#");
  const queryIndex = raw.indexOf("?");
  const cutIndex =
    hashIndex >= 0 && queryIndex >= 0
      ? Math.min(hashIndex, queryIndex)
      : Math.max(hashIndex, queryIndex);
  return cutIndex >= 0 ? raw.slice(0, cutIndex) : raw;
};

const getQueryAndHashSuffix = (value) => String(value ?? "").slice(stripQueryAndHash(value).length);

const isSpecialReference = (value) =>
  EXCLUDED_REFERENCE_PREFIXES.some((prefix) => String(value ?? "").trim().toLowerCase().startsWith(prefix));

const isRemoteReference = (value) => REMOTE_REFERENCE_RE.test(String(value ?? "").trim());

const replaceAsync = async (input, regex, replacer) => {
  let output = "";
  let lastIndex = 0;
  for (const match of input.matchAll(regex)) {
    const index = match.index ?? 0;
    output += input.slice(lastIndex, index);
    // eslint-disable-next-line no-await-in-loop
    output += await replacer(...match, index, input);
    lastIndex = index + match[0].length;
  }
  output += input.slice(lastIndex);
  return output;
};

const loadFontsInPage = async (page) => {
  await page.evaluate(async () => {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
  });
};

const measureViewportInPage = async (page) =>
  page.evaluate(() => {
    const body = document.body;
    const root = document.documentElement;
    const width = Math.max(
      window.innerWidth || 0,
      root?.clientWidth || 0,
      root?.scrollWidth || 0,
      body?.clientWidth || 0,
      body?.scrollWidth || 0,
      1
    );
    const height = Math.max(
      window.innerHeight || 0,
      root?.clientHeight || 0,
      root?.scrollHeight || 0,
      body?.clientHeight || 0,
      body?.scrollHeight || 0,
      1
    );
    return {
      width: Math.ceil(width),
      height: Math.ceil(height),
    };
  });

const ensurePageViewport = async (page, desiredViewport) => {
  const current = page.viewportSize() ?? DEFAULT_SLIDE_VIEWPORT;
  if (
    Math.abs(Number(current.width) - Number(desiredViewport.width)) <= VIEWPORT_EPSILON &&
    Math.abs(Number(current.height) - Number(desiredViewport.height)) <= VIEWPORT_EPSILON
  ) {
    return desiredViewport;
  }

  await page.setViewportSize({
    width: Number(desiredViewport.width),
    height: Number(desiredViewport.height),
  });
  return desiredViewport;
};

const extractGroupedTextInPage = () => {
  const semanticTags = new Set([
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "P",
    "LI",
    "BLOCKQUOTE",
    "FIGCAPTION",
    "CAPTION",
    "TD",
    "TH",
  ]);
  const excludedTags = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "META", "HEAD"]);

  const normalizeText = (value) =>
    String(value ?? "")
      .replace(/\u00a0/g, " ")
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n");

  const getNodePath = (element) => {
    const parts = [];
    let current = element;
    while (current && current !== document.body && current.parentElement) {
      const siblings = Array.from(current.parentElement.children);
      const siblingIndex = siblings.indexOf(current);
      parts.unshift(`${current.tagName.toLowerCase()}:${siblingIndex}`);
      current = current.parentElement;
    }
    return parts.join("/") || "body";
  };

  const isVisible = (element) => {
    if (!(element instanceof HTMLElement)) {
      return false;
    }
    if (element.closest("svg")) {
      return false;
    }
    const styles = window.getComputedStyle(element);
    if (
      styles.display === "none" ||
      styles.visibility === "hidden" ||
      Number.parseFloat(styles.opacity || "1") === 0
    ) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0.5 && rect.height > 0.5;
  };

  const hasVisibleTextChild = (element) =>
    Array.from(element.children).some(
      (child) =>
        child instanceof HTMLElement &&
        !child.closest("svg") &&
        isVisible(child) &&
        normalizeText(child.innerText).length > 0
    );

  const candidates = [];
  let candidateIndex = 1;

  for (const element of Array.from(document.body?.querySelectorAll("*") ?? [])) {
    if (!(element instanceof HTMLElement)) {
      continue;
    }
    if (excludedTags.has(element.tagName) || element.closest("svg") || !isVisible(element)) {
      continue;
    }

    const text = normalizeText(element.innerText);
    if (!text) {
      continue;
    }

    const isSemantic = semanticTags.has(element.tagName);
    if (!isSemantic && hasVisibleTextChild(element)) {
      continue;
    }

    let duplicateSemanticAncestor = false;
    let ancestor = element.parentElement;
    while (ancestor) {
      if (
        semanticTags.has(ancestor.tagName) &&
        isVisible(ancestor) &&
        normalizeText(ancestor.innerText) === text
      ) {
        duplicateSemanticAncestor = true;
        break;
      }
      ancestor = ancestor.parentElement;
    }
    if (duplicateSemanticAncestor) {
      continue;
    }

    const rect = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);
    const candidateId = `candidate-${String(candidateIndex).padStart(4, "0")}`;
    candidateIndex += 1;
    element.dataset.pptxExportTextId = candidateId;

    candidates.push({
      id: candidateId,
      tagName: element.tagName.toLowerCase(),
      isSemantic,
      text,
      parentNodePath: element.parentElement ? getNodePath(element.parentElement) : "body",
      bounds: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
      },
      styles: {
        fontFamily: styles.fontFamily,
        fontSize: styles.fontSize,
        fontWeight: styles.fontWeight,
        fontStyle: styles.fontStyle,
        lineHeight: styles.lineHeight,
        letterSpacing: styles.letterSpacing,
        textAlign: styles.textAlign,
        color: styles.color,
        textTransform: styles.textTransform,
        textDecorationLine: styles.textDecorationLine,
      },
    });
  }

  const sortTopLeft = (left, right) =>
    left.bounds.top - right.bounds.top || left.bounds.left - right.bounds.left;

  const styleCompatible = (left, right) => {
    const leftFontSize = parseFloat(left.styles.fontSize) || 0;
    const rightFontSize = parseFloat(right.styles.fontSize) || 0;
    const leftWeight = parseInt(left.styles.fontWeight, 10) || 400;
    const rightWeight = parseInt(right.styles.fontWeight, 10) || 400;
    return (
      left.styles.fontFamily === right.styles.fontFamily &&
      Math.abs(leftFontSize - rightFontSize) <= 1.5 &&
      Math.abs(leftWeight - rightWeight) <= 100 &&
      left.styles.color === right.styles.color &&
      left.styles.textAlign === right.styles.textAlign &&
      left.styles.fontStyle === right.styles.fontStyle
    );
  };

  const isVerticalAligned = (nodes) => {
    const leftEdges = nodes.map((node) => node.bounds.left);
    const centers = nodes.map((node) => node.bounds.left + node.bounds.width / 2);
    return (
      Math.max(...leftEdges) - Math.min(...leftEdges) <= 24 ||
      Math.max(...centers) - Math.min(...centers) <= 24
    );
  };

  const isHorizontalAligned = (nodes) => {
    const topEdges = nodes.map((node) => node.bounds.top);
    const centers = nodes.map((node) => node.bounds.top + node.bounds.height / 2);
    return (
      Math.max(...topEdges) - Math.min(...topEdges) <= 20 ||
      Math.max(...centers) - Math.min(...centers) <= 20
    );
  };

  const buildGroup = (nodes, kind) => {
    const vertical = isVerticalAligned(nodes);
    const horizontal = isHorizontalAligned(nodes);
    const orientation =
      vertical && !horizontal ? "vertical" : horizontal && !vertical ? "horizontal" : "vertical";
    const ordered = [...nodes].sort((left, right) =>
      orientation === "horizontal"
        ? left.bounds.left - right.bounds.left || left.bounds.top - right.bounds.top
        : sortTopLeft(left, right)
    );
    const bounds = ordered.reduce(
      (accumulator, node) => ({
        left: Math.min(accumulator.left, node.bounds.left),
        top: Math.min(accumulator.top, node.bounds.top),
        right: Math.max(accumulator.right, node.bounds.right),
        bottom: Math.max(accumulator.bottom, node.bounds.bottom),
      }),
      {
        left: Number.POSITIVE_INFINITY,
        top: Number.POSITIVE_INFINITY,
        right: Number.NEGATIVE_INFINITY,
        bottom: Number.NEGATIVE_INFINITY,
      }
    );
    return {
      id: `layer-${String(groups.length + 1).padStart(4, "0")}`,
      kind,
      orientation,
      childIds: ordered.map((node) => node.id),
      text:
        ordered.length === 1
          ? ordered[0].text
          : ordered.map((node) => node.text).join(orientation === "horizontal" ? " " : "\n"),
      bounds: {
        left: bounds.left,
        top: bounds.top,
        width: bounds.right - bounds.left,
        height: bounds.bottom - bounds.top,
      },
      styles: ordered[0].styles,
    };
  };

  candidates.sort(sortTopLeft);
  const assigned = new Set();
  const groups = [];

  for (const candidate of candidates) {
    if (!candidate.isSemantic) {
      continue;
    }
    groups.push(buildGroup([candidate], "semantic"));
    assigned.add(candidate.id);
  }

  const parentBuckets = new Map();
  for (const candidate of candidates) {
    if (assigned.has(candidate.id)) {
      continue;
    }
    const existing = parentBuckets.get(candidate.parentNodePath) ?? [];
    existing.push(candidate);
    parentBuckets.set(candidate.parentNodePath, existing);
  }

  for (const bucket of parentBuckets.values()) {
    if (bucket.length < 2) {
      continue;
    }
    const [first, ...rest] = bucket;
    const compatible = rest.every((candidate) => styleCompatible(first, candidate));
    if (!compatible) {
      continue;
    }
    const vertical = isVerticalAligned(bucket);
    const horizontal = isHorizontalAligned(bucket);
    if (!vertical && !horizontal) {
      continue;
    }
    groups.push(buildGroup(bucket, "sibling-group"));
    for (const candidate of bucket) {
      assigned.add(candidate.id);
    }
  }

  for (const candidate of candidates) {
    if (assigned.has(candidate.id)) {
      continue;
    }
    groups.push(buildGroup([candidate], "leaf"));
    assigned.add(candidate.id);
  }

  const root = document.documentElement;
  const body = document.body;
  return {
    viewport: {
      width: Math.ceil(
        Math.max(
          window.innerWidth || 0,
          root?.clientWidth || 0,
          root?.scrollWidth || 0,
          body?.clientWidth || 0,
          body?.scrollWidth || 0,
          1
        )
      ),
      height: Math.ceil(
        Math.max(
          window.innerHeight || 0,
          root?.clientHeight || 0,
          root?.scrollHeight || 0,
          body?.clientHeight || 0,
          body?.scrollHeight || 0,
          1
        )
      ),
    },
    candidates,
    groups,
    maskCandidateIds: [...new Set(groups.flatMap((group) => group.childIds))],
  };
};

const applyTextMaskInPage = async (page, candidateIds) => {
  await page.evaluate(
    ({ ids, styleId }) => {
      const escapedSelectors = ids.map((id) => {
        const escapedId =
          typeof CSS?.escape === "function" ? CSS.escape(String(id)) : String(id).replace(/"/g, '\\"');
        return [
          `[data-pptx-export-text-id="${escapedId}"]`,
          `[data-pptx-export-text-id="${escapedId}"] *`,
        ].join(", ");
      });
      let styleElement = document.getElementById(styleId);
      if (!styleElement) {
        styleElement = document.createElement("style");
        styleElement.id = styleId;
        document.head.appendChild(styleElement);
      }
      styleElement.textContent = `
        ${escapedSelectors.join(", ")} {
          color: transparent !important;
          -webkit-text-fill-color: transparent !important;
          text-shadow: none !important;
          caret-color: transparent !important;
        }
      `;
    },
    {
      ids: candidateIds,
      styleId: TEXT_MASK_STYLE_ID,
    }
  );
};

const buildFallbackPreviewMarkup = ({ previewUrl }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      html, body {
        margin: 0;
        width: ${DEFAULT_SLIDE_VIEWPORT.width}px;
        height: ${DEFAULT_SLIDE_VIEWPORT.height}px;
        overflow: hidden;
        background: #ffffff;
      }

      body {
        display: grid;
        place-items: stretch;
      }

      img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    </style>
  </head>
  <body>
    <img src="${previewUrl}" alt="" />
  </body>
</html>`;

const buildSurrogateMarkup = ({ backgroundUrl, remoteStylesheets, textLayers, viewport }) => {
  const stylesheetTags = remoteStylesheets
    .map((href) => `<link rel="stylesheet" href="${escapeHtml(href)}" />`)
    .join("\n");
  const layersMarkup = textLayers.groups
    .map((group) => {
      const lineHeight = normalizeCssLineHeight({
        lineHeight: group.styles.lineHeight,
        fontSize: group.styles.fontSize,
      });
      const inlineStyles = [
        `left:${group.bounds.left}px`,
        `top:${group.bounds.top}px`,
        `width:${group.bounds.width}px`,
        `height:${group.bounds.height}px`,
        `font-family:${group.styles.fontFamily}`,
        `font-size:${group.styles.fontSize}`,
        `font-weight:${group.styles.fontWeight}`,
        `font-style:${group.styles.fontStyle}`,
        `line-height:${lineHeight}px`,
        `letter-spacing:${group.styles.letterSpacing}`,
        `text-align:${group.styles.textAlign}`,
        `color:${group.styles.color}`,
        `text-transform:${group.styles.textTransform}`,
        `text-decoration-line:${group.styles.textDecorationLine}`,
      ].join("; ");
      return `<div class="layer" style="${inlineStyles}">${escapeHtml(group.text).replace(/\n/g, "<br />")}</div>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    ${stylesheetTags}
    <style>
      html, body {
        margin: 0;
        width: ${viewport.width}px;
        height: ${viewport.height}px;
        overflow: hidden;
        background: #ffffff;
      }

      body {
        position: relative;
        width: ${viewport.width}px;
        height: ${viewport.height}px;
        font-synthesis: none;
        -webkit-font-smoothing: antialiased;
      }

      .background {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }

      .layer {
        position: absolute;
        margin: 0;
        padding: 0;
        white-space: pre-wrap;
        overflow: hidden;
      }
    </style>
  </head>
  <body>
    <img class="background" src="${backgroundUrl}" alt="" />
    ${layersMarkup}
  </body>
</html>`;
};

const collectRemoteStylesheets = (dependencyManifest) =>
  (dependencyManifest.remote ?? [])
    .map((entry) => entry.ref)
    .filter((ref) => /fonts\.googleapis\.com|\.css(?:$|\?)/i.test(String(ref ?? "")));

const copySourceAsset = async ({ repoRoot, sourceRelativePath, destinationPath }) => {
  if (!sourceRelativePath) {
    return null;
  }
  const absolutePath = resolve(repoRoot, sourceRelativePath);
  if (!(await pathExists(absolutePath))) {
    return null;
  }
  await ensureParentDir(destinationPath);
  await copyFile(absolutePath, destinationPath);
  return destinationPath;
};

const resolvePreferredVersionAssetPath = (slide, field) => {
  const currentVersion = (slide.versions ?? []).find(
    (version) => version.id === slide.currentVersionId
  );
  return currentVersion?.[field] ?? null;
};

const resolvePreferredHtmlSourcePath = (slide) => {
  const currentHtmlPath = slide.currentHtmlPath ?? null;
  const rootCurrentHtmlPath = slide.rootCurrentHtmlPath ?? null;
  const versionHtmlPath = resolvePreferredVersionAssetPath(slide, "htmlPath");
  if (!versionHtmlPath) {
    return currentHtmlPath;
  }
  if (!currentHtmlPath || currentHtmlPath === rootCurrentHtmlPath) {
    return versionHtmlPath;
  }
  return currentHtmlPath;
};

const inferWrapperAssetKind = (reference) =>
  /\.svg(?:[?#]|$)/i.test(String(reference ?? "").trim()) ? "svg" : "image";

const classifySlideSourceSurface = ({ slide, sourceHtml }) => {
  if (!slide.currentHtmlPath) {
    return {
      sourceClass: "preview_only",
      wrapperAssetKind: null,
      sourceWarnings: [...(slide.assetWarnings ?? [])],
    };
  }

  const sourceWarnings = [...(slide.assetWarnings ?? [])];
  const wrapperMatch = sourceHtml.match(BODY_ONLY_IMG_WRAPPER_RE);
  if (wrapperMatch) {
    const wrapperReference = String(wrapperMatch[2] ?? "").trim();
    const wrapperAssetKind = inferWrapperAssetKind(wrapperReference);
    const trustedSvgName = slide.trustedCurrentSvgPath
      ? basename(stripQueryAndHash(slide.trustedCurrentSvgPath)).toLowerCase()
      : null;
    const wrapperReferencesTrustedSvg =
      wrapperAssetKind === "svg" &&
      trustedSvgName &&
      basename(stripQueryAndHash(wrapperReference)).toLowerCase() === trustedSvgName;
    const resolvedWrapperAssetKind = wrapperReferencesTrustedSvg ? "svg" : "image";
    if (wrapperAssetKind === "svg" && !slide.trustedCurrentSvgPath) {
      sourceWarnings.push(
        "HTML wraps an SVG asset, but no trusted full-slide SVG pass-through is available."
      );
    }
    if (wrapperAssetKind === "svg" && slide.trustedCurrentSvgPath && !wrapperReferencesTrustedSvg) {
      sourceWarnings.push(
        "HTML references an SVG wrapper asset, but it does not match the trusted full-slide SVG."
      );
    }
    return {
      sourceClass: "html_wrapper_asset",
      wrapperAssetKind: resolvedWrapperAssetKind,
      sourceWarnings,
    };
  }

  const imageCount = (sourceHtml.match(/<img\b/gi) ?? []).length;
  const inlineSvgCount = (sourceHtml.match(/<svg\b/gi) ?? []).length;
  if (
    imageCount >= HTML_ASSET_HEAVY_IMG_THRESHOLD ||
    inlineSvgCount >= HTML_ASSET_HEAVY_SVG_THRESHOLD
  ) {
    return {
      sourceClass: "html_asset_heavy",
      wrapperAssetKind: imageCount >= inlineSvgCount ? "image" : "svg",
      sourceWarnings,
    };
  }

  return {
    sourceClass: "html_dom",
    wrapperAssetKind: null,
    sourceWarnings,
  };
};

const determinePacketMode = ({ slide, usedPreviewFallback }) => {
  if (usedPreviewFallback || slide.sourceClass === "preview_only") {
    return "raster_fallback";
  }
  if (slide.sourceClass === "html_wrapper_asset" && slide.wrapperAssetKind === "svg" && slide.trustedCurrentSvgPath) {
    return "wrapper_svg_passthrough";
  }
  return "pdf_primary";
};

const summarizeDependencyFreezeStatus = (dependencyManifest, sourceClass) => {
  if (sourceClass === "preview_only" || !dependencyManifest?.sourceHtmlPath) {
    return {
      status: "not_applicable",
      localCount: 0,
      remoteCount: 0,
      warningCount: 0,
    };
  }
  if (
    (dependencyManifest.warnings ?? []).some((warning) =>
      /missing local dependency/i.test(String(warning))
    )
  ) {
    return {
      status: "incomplete",
      localCount: (dependencyManifest.local ?? []).length,
      remoteCount: (dependencyManifest.remote ?? []).length,
      warningCount: (dependencyManifest.warnings ?? []).length,
    };
  }
  return {
    status:
      (dependencyManifest.remote ?? []).length > 0
        ? "local_assets_vendored_remote_recorded"
        : "local_assets_vendored",
    localCount: (dependencyManifest.local ?? []).length,
    remoteCount: (dependencyManifest.remote ?? []).length,
    warningCount: (dependencyManifest.warnings ?? []).length,
  };
};

const buildIllustratorReadiness = ({ mode, slide, warnings }) => {
  const notes = [...new Set([...(slide.sourceWarnings ?? []), ...(warnings ?? [])])];
  if (mode === "wrapper_svg_passthrough") {
    return {
      status: "preferred_svg",
      preferredAsset: "editable.svg",
      notes,
    };
  }
  if (mode === "pdf_primary") {
    return {
      status: "preferred_pdf",
      preferredAsset: "slide.pdf",
      notes: [...notes, "Manual Illustrator validation still required for PDF text editability."],
    };
  }
  return {
    status: "raster_only",
    preferredAsset: "slide.pdf",
    notes,
  };
};

const resolveLocalDependencyAbsolutePath = async ({
  repoRoot,
  sourceHtmlPath,
  dependencySourcePath,
  rawReference,
}) => {
  const strippedReference = stripQueryAndHash(rawReference);
  const directPath = resolve(dirname(sourceHtmlPath), strippedReference);
  if (await pathExists(directPath)) {
    return directPath;
  }

  const sourceRelativePath =
    String(dependencySourcePath ?? "").trim() ||
    relative(repoRoot, sourceHtmlPath).replaceAll("\\", "/");
  const projectMatch = sourceRelativePath.match(/^projects\/([^/]+)\//);
  if (!projectMatch) {
    return directPath;
  }

  const projectRoot = resolve(repoRoot, "projects", projectMatch[1]);
  const normalizedReference = strippedReference.replace(/^(?:\.\.\/)+/, "");
  const projectCandidate = resolve(projectRoot, normalizedReference);
  if (await pathExists(projectCandidate)) {
    return projectCandidate;
  }

  const assetMarkerIndex = normalizedReference.indexOf("assets/");
  if (assetMarkerIndex >= 0) {
    const assetSuffix = normalizedReference.slice(assetMarkerIndex + "assets/".length);
    const projectAssetCandidate = resolve(projectRoot, "assets", assetSuffix);
    if (await pathExists(projectAssetCandidate)) {
      return projectAssetCandidate;
    }
  }

  return directPath;
};

const normalizeHtmlDependencies = async ({
  html,
  repoRoot,
  sourceHtmlPath,
  assetsDir,
  dependencySourcePath,
}) => {
  const copiedAssets = new Map();
  const localDependencies = [];
  const remoteDependencies = [];
  const embeddedDependencies = [];
  const warnings = [];
  let assetIndex = 1;

  const rewriteReference = async ({ reference, via }) => {
    const rawReference = String(reference ?? "").trim();
    if (!rawReference || isSpecialReference(rawReference)) {
      if (rawReference) {
        embeddedDependencies.push({ ref: rawReference, via });
      }
      return rawReference;
    }
    if (isRemoteReference(rawReference)) {
      remoteDependencies.push({ ref: rawReference, via });
      return rawReference;
    }

    const assetSourcePath = await resolveLocalDependencyAbsolutePath({
      repoRoot,
      sourceHtmlPath,
      dependencySourcePath,
      rawReference,
    });
    if (!(await pathExists(assetSourcePath))) {
      warnings.push(`Missing local dependency: ${rawReference}`);
      return rawReference;
    }

    const cacheKey = assetSourcePath;
    let packetRelativePath = copiedAssets.get(cacheKey);
    if (!packetRelativePath) {
      const sourceExt = extname(assetSourcePath) || "";
      const baseName = basename(assetSourcePath, sourceExt);
      const targetName = `${String(assetIndex).padStart(2, "0")}-${slugify(baseName, "asset")}${sourceExt}`;
      assetIndex += 1;
      packetRelativePath = `assets/${targetName}`;
      await ensureDir(assetsDir);
      await copyFile(assetSourcePath, resolve(dirname(assetsDir), packetRelativePath));
      copiedAssets.set(cacheKey, packetRelativePath);
      localDependencies.push({
        ref: rawReference,
        via,
        sourcePath: assetSourcePath,
        packetPath: packetRelativePath,
      });
    }

    return `./${packetRelativePath}${getQueryAndHashSuffix(rawReference)}`;
  };

  let normalizedHtml = await replaceAsync(html, ATTR_REF_RE, async (match, attribute, quote, reference) => {
    const rewritten = await rewriteReference({
      reference,
      via: `attr:${String(attribute).toLowerCase()}`,
    });
    return `${attribute}=${quote}${rewritten}${quote}`;
  });

  normalizedHtml = await replaceAsync(normalizedHtml, CSS_URL_RE, async (match, quote, reference) => {
    const rewritten = await rewriteReference({
      reference,
      via: "css:url",
    });
    return `url(${quote}${rewritten}${quote})`;
  });

  return {
    normalizedHtml,
    manifest: {
      sourceHtmlPath: dependencySourcePath,
      local: localDependencies,
      remote: [...new Map(remoteDependencies.map((entry) => [`${entry.via}:${entry.ref}`, entry])).values()],
      embedded: [...new Map(embeddedDependencies.map((entry) => [`${entry.via}:${entry.ref}`, entry])).values()],
      warnings,
    },
  };
};

const renderHtmlSlide = async ({ browser, htmlPath, flattenedPath, backgroundPath, textLayersPath }) => {
  const page = await browser.newPage({
    viewport: { ...DEFAULT_SLIDE_VIEWPORT },
    deviceScaleFactor: 1,
  });

  try {
    await page.goto(pathToFileURL(htmlPath).href, {
      waitUntil: "networkidle",
    });
    await loadFontsInPage(page);

    const measuredViewport = await measureViewportInPage(page);
    await ensurePageViewport(page, measuredViewport);
    if (
      measuredViewport.width !== DEFAULT_SLIDE_VIEWPORT.width ||
      measuredViewport.height !== DEFAULT_SLIDE_VIEWPORT.height
    ) {
      await page.goto(pathToFileURL(htmlPath).href, {
        waitUntil: "networkidle",
      });
      await loadFontsInPage(page);
    }

    const textLayers = await page.evaluate(extractGroupedTextInPage);
    await ensureParentDir(flattenedPath);
    await page.screenshot({
      path: flattenedPath,
      type: "png",
    });

    await applyTextMaskInPage(page, textLayers.maskCandidateIds ?? []);
    await ensureParentDir(backgroundPath);
    await page.screenshot({
      path: backgroundPath,
      type: "png",
    });

    await writeJson(textLayersPath, textLayers);
    return textLayers;
  } finally {
    await page.close();
  }
};

const renderPreviewFallback = async ({ browser, previewPath, flattenedPath, backgroundPath, textLayersPath }) => {
  const page = await browser.newPage({
    viewport: { ...DEFAULT_SLIDE_VIEWPORT },
    deviceScaleFactor: 1,
  });
  const previewUrl = pathToFileURL(previewPath).href;

  try {
    await page.setContent(buildFallbackPreviewMarkup({ previewUrl }), {
      waitUntil: "load",
    });
    await ensureParentDir(flattenedPath);
    await page.screenshot({
      path: flattenedPath,
      type: "png",
    });
    await ensureParentDir(backgroundPath);
    await page.screenshot({
      path: backgroundPath,
      type: "png",
    });
    const textLayers = {
      viewport: { ...DEFAULT_SLIDE_VIEWPORT },
      candidates: [],
      groups: [],
      maskCandidateIds: [],
    };
    await writeJson(textLayersPath, textLayers);
    return textLayers;
  } finally {
    await page.close();
  }
};

const renderSurrogateAndCompare = async ({
  browser,
  backgroundPath,
  flattenedPath,
  surrogatePath,
  diffPath,
  qaPath,
  dependencyManifest,
  textLayers,
}) => {
  if (!Array.isArray(textLayers?.groups) || textLayers.groups.length === 0) {
    const qa = {
      status: "skipped",
      reason: "No editable text layers.",
      mismatchPixels: 0,
      mismatchRatio: 0,
    };
    await writeJson(qaPath, qa);
    return qa;
  }

  const page = await browser.newPage({
    viewport: {
      width: Number(textLayers.viewport?.width || DEFAULT_SLIDE_VIEWPORT.width),
      height: Number(textLayers.viewport?.height || DEFAULT_SLIDE_VIEWPORT.height),
    },
    deviceScaleFactor: 1,
  });
  try {
    await page.setContent(
      buildSurrogateMarkup({
        backgroundUrl: pathToFileURL(backgroundPath).href,
        remoteStylesheets: collectRemoteStylesheets(dependencyManifest),
        textLayers,
        viewport: {
          width: Number(textLayers.viewport?.width || DEFAULT_SLIDE_VIEWPORT.width),
          height: Number(textLayers.viewport?.height || DEFAULT_SLIDE_VIEWPORT.height),
        },
      }),
      { waitUntil: "networkidle" }
    );
    await loadFontsInPage(page);
    await ensureParentDir(surrogatePath);
    await page.screenshot({
      path: surrogatePath,
      type: "png",
    });
  } finally {
    await page.close();
  }

  const comparison = await comparePngFiles({
    actualPath: surrogatePath,
    expectedPath: flattenedPath,
    diffPath,
  });
  const qa = {
    status: comparison.mismatchRatio <= DEFAULT_QA_THRESHOLD ? "pass" : "warn",
    threshold: DEFAULT_QA_THRESHOLD,
    ...comparison,
  };
  await writeJson(qaPath, qa);
  return qa;
};

const buildSlideFolderName = (slide) =>
  `${padDisplayNumber(slide.displayNumber)}-${slugify(slide.title, slide.slideId)}`;

const buildSlideManifestEntry = ({
  packetRoot,
  slideFolderName,
  slide,
  mode,
  viewport,
  warnings,
  qa,
  dependencyFreezeStatus,
  illustratorReadiness,
}) => ({
  repoSlideId: slide.slideId,
  displayNumber: String(slide.displayNumber),
  title: slide.title,
  canonicalParam: slide.canonicalParam,
  currentVersionId: slide.currentVersionId,
  sourceClass: slide.sourceClass ?? (slide.currentHtmlPath ? "html_dom" : "preview_only"),
  wrapperAssetKind: slide.wrapperAssetKind ?? null,
  mode,
  viewport,
  warnings,
  dependencyFreezeStatus,
  illustratorReadiness,
  qa,
  paths: {
    dir: relative(packetRoot, resolve(packetRoot, "slides", slideFolderName)) || ".",
    sourceHtml: slide.currentHtmlPath ? `slides/${slideFolderName}/source.html` : null,
    sourceSvg: slide.currentSvgPath ? `slides/${slideFolderName}/source.svg` : null,
    sourcePreview: slide.currentPreviewPath
      ? `slides/${slideFolderName}/source-preview${extname(slide.currentPreviewPath) || ".png"}`
      : null,
    normalizedHtml: slide.currentHtmlPath ? `slides/${slideFolderName}/normalized.html` : null,
    flattenedPng: `slides/${slideFolderName}/flattened.png`,
    previewPng: `slides/${slideFolderName}/preview.png`,
    backgroundPng: `slides/${slideFolderName}/background.png`,
    textLayers: `slides/${slideFolderName}/text-layers.json`,
    dependencies: `slides/${slideFolderName}/dependencies.json`,
    visualSvg: slide.trustedCurrentSvgPath ? `slides/${slideFolderName}/visual.svg` : null,
    editableSvg: slide.trustedCurrentSvgPath ? `slides/${slideFolderName}/editable.svg` : null,
    slidePdf: `slides/${slideFolderName}/slide.pdf`,
    qa: {
      surrogatePng: `slides/${slideFolderName}/qa-surrogate.png`,
      diffPng: `slides/${slideFolderName}/qa-diff.png`,
      report: `slides/${slideFolderName}/qa.json`,
      exportReport: `slides/${slideFolderName}/export-qa.json`,
      pdfRenderPng: `slides/${slideFolderName}/qa-pdf-render.png`,
      pdfDiffPng: `slides/${slideFolderName}/qa-pdf-diff.png`,
      svgRenderPng: slide.trustedCurrentSvgPath ? `slides/${slideFolderName}/qa-svg-render.png` : null,
      svgDiffPng: slide.trustedCurrentSvgPath ? `slides/${slideFolderName}/qa-svg-diff.png` : null,
    },
  },
});

const exportSingleSlidePacket = async ({ repoRoot, packetRoot, slide, browser }) => {
  const slideFolderName = buildSlideFolderName(slide);
  const slideRoot = resolve(packetRoot, "slides", slideFolderName);
  const assetsDir = resolve(slideRoot, "assets");
  await ensureDir(slideRoot);

  const sourcePreviewExt = slide.currentPreviewPath ? extname(slide.currentPreviewPath) || ".png" : ".png";
  const sourcePreviewPath = resolve(slideRoot, `source-preview${sourcePreviewExt}`);
  const sourceHtmlPath = resolve(slideRoot, "source.html");
  const sourceSvgPath = resolve(slideRoot, "source.svg");
  const visualSvgPath = resolve(slideRoot, "visual.svg");
  const normalizedHtmlPath = resolve(slideRoot, "normalized.html");
  const flattenedPath = resolve(slideRoot, "flattened.png");
  const previewPath = resolve(slideRoot, "preview.png");
  const backgroundPath = resolve(slideRoot, "background.png");
  const textLayersPath = resolve(slideRoot, "text-layers.json");
  const dependenciesPath = resolve(slideRoot, "dependencies.json");
  const surrogatePath = resolve(slideRoot, "qa-surrogate.png");
  const diffPath = resolve(slideRoot, "qa-diff.png");
  const qaPath = resolve(slideRoot, "qa.json");
  const warnings = [...(slide.sourceWarnings ?? [])];
  const preferredHtmlPath = resolvePreferredHtmlSourcePath(slide);

  await copySourceAsset({
    repoRoot,
    sourceRelativePath: slide.currentPreviewPath,
    destinationPath: sourcePreviewPath,
  });
  await copySourceAsset({
    repoRoot,
    sourceRelativePath: slide.currentSvgPath,
    destinationPath: sourceSvgPath,
  });
  if (slide.trustedCurrentSvgPath) {
    await copySourceAsset({
      repoRoot,
      sourceRelativePath: slide.trustedCurrentSvgPath,
      destinationPath: visualSvgPath,
    });
  }

  let dependencyManifest = {
    sourceHtmlPath: preferredHtmlPath,
    local: [],
    remote: [],
    embedded: [],
    warnings: [],
  };
  let textLayers = null;
  let mode = slide.sourceClass === "preview_only" ? "raster_fallback" : "pdf_primary";
  let viewport = { ...DEFAULT_SLIDE_VIEWPORT };
  let usedPreviewFallback = false;

  if (preferredHtmlPath) {
    const absoluteSourceHtmlPath = resolve(repoRoot, preferredHtmlPath);
    const sourceHtml = await readFile(absoluteSourceHtmlPath, "utf8");
    await ensureParentDir(sourceHtmlPath);
    await writeFile(sourceHtmlPath, sourceHtml, "utf8");

    const normalized = await normalizeHtmlDependencies({
      html: sourceHtml,
      repoRoot,
      sourceHtmlPath: absoluteSourceHtmlPath,
      assetsDir,
      dependencySourcePath: preferredHtmlPath,
    });
    dependencyManifest = normalized.manifest;
    await writeJson(dependenciesPath, dependencyManifest);
    await writeFile(normalizedHtmlPath, normalized.normalizedHtml, "utf8");

    try {
      textLayers = await renderHtmlSlide({
        browser,
        htmlPath: normalizedHtmlPath,
        flattenedPath,
        backgroundPath,
        textLayersPath,
      });
      viewport = {
        width: Number(textLayers.viewport?.width || DEFAULT_SLIDE_VIEWPORT.width),
        height: Number(textLayers.viewport?.height || DEFAULT_SLIDE_VIEWPORT.height),
      };
    } catch (error) {
      warnings.push(`HTML render fallback: ${error instanceof Error ? error.message : String(error)}`);
      textLayers = null;
    }
  } else {
    await writeJson(dependenciesPath, dependencyManifest);
  }

  if (!textLayers) {
    if (!slide.currentPreviewPath) {
      throw new Error(`Slide ${slide.slideId} has neither a current HTML surface nor a preview fallback.`);
    }
    const previewAbsolutePath = resolve(repoRoot, slide.currentPreviewPath);
    textLayers = await renderPreviewFallback({
      browser,
      previewPath: previewAbsolutePath,
      flattenedPath,
      backgroundPath,
      textLayersPath,
    });
    viewport = { ...DEFAULT_SLIDE_VIEWPORT };
    usedPreviewFallback = true;
    warnings.push("Used image-only preview fallback.");
  }

  mode = determinePacketMode({
    slide,
    usedPreviewFallback,
  });

  dependencyManifest.warnings = [...new Set([...(dependencyManifest.warnings ?? []), ...warnings])];
  await writeJson(dependenciesPath, dependencyManifest);
  await copyFile(flattenedPath, previewPath);

  const qa = await renderSurrogateAndCompare({
    browser,
    backgroundPath,
    flattenedPath,
    surrogatePath,
    diffPath,
    qaPath,
    dependencyManifest,
    textLayers,
  });

  return buildSlideManifestEntry({
    packetRoot,
    slideFolderName,
    slide,
    mode,
    viewport,
    warnings: dependencyManifest.warnings ?? [],
    qa,
    dependencyFreezeStatus: summarizeDependencyFreezeStatus(
      dependencyManifest,
      slide.sourceClass
    ),
    illustratorReadiness: buildIllustratorReadiness({
      mode,
      slide,
      warnings: dependencyManifest.warnings ?? [],
    }),
  });
};

export const exportSlidesPacket = async ({
  repoRoot = process.cwd(),
  projectId = DESIGNER_PROJECT_ID,
  outputDir,
  slideFilter = null,
  importPlaywrightImpl = importPlaywright,
} = {}) => {
  if (!outputDir) {
    throw new Error("Provide an output directory via --out.");
  }

  const resolvedPacketRoot = resolve(outputDir);
  await ensureDir(resolve(resolvedPacketRoot, "slides"));
  const deck = await resolveDesignerSelectedSlides({
    repoRoot: resolve(repoRoot),
    projectId,
  });

  const filterSet = Array.isArray(slideFilter) && slideFilter.length > 0 ? new Set(slideFilter) : null;
  const selectedSlides = await Promise.all(
    (deck.activeSlides ?? [])
      .filter((slide) => !filterSet || filterSet.has(slide.slideId) || filterSet.has(String(slide.displayNumber)))
      .map(async (slide) => {
        if (slide.sourceClass) {
          return slide;
        }

        const preferredHtmlPath = resolvePreferredHtmlSourcePath(slide);
        if (!preferredHtmlPath) {
          return {
            ...slide,
            sourceClass: "preview_only",
            wrapperAssetKind: null,
            sourceWarnings: [...(slide.sourceWarnings ?? [])],
          };
        }

        const absoluteSourceHtmlPath = resolve(repoRoot, preferredHtmlPath);
        const sourceHtml = await readFile(absoluteSourceHtmlPath, "utf8");
        return {
          ...slide,
          ...classifySlideSourceSurface({
            slide: {
              ...slide,
              currentHtmlPath: preferredHtmlPath,
            },
            sourceHtml,
          }),
        };
      })
  );

  const { chromium } = await importPlaywrightImpl();
  const browser = await chromium.launch({ headless: true });

  try {
    const packetSlides = [];
    for (const slide of selectedSlides) {
      // eslint-disable-next-line no-await-in-loop
      packetSlides.push(
        await exportSingleSlidePacket({
          repoRoot: resolve(repoRoot),
          packetRoot: resolvedPacketRoot,
          slide,
          browser,
        })
      );
    }

    const manifest = {
      packetVersion: PACKET_VERSION,
      projectId: deck.projectId,
      title: deck.title,
      version: deck.version,
      status: deck.status,
      numberingSummary: deck.numberingSummary ?? "",
      deckSpecPath: deck.deckSpecPath,
      generatedAt: new Date().toISOString(),
      slideCount: packetSlides.length,
      paths: {
        deckPdf: null,
        qaReport: null,
      },
      slides: packetSlides,
    };
    const manifestPath = resolve(resolvedPacketRoot, "manifest.json");
    await writeJson(manifestPath, manifest);
    return {
      outputDir: resolvedPacketRoot,
      manifestPath,
      manifest,
    };
  } finally {
    await browser.close();
  }
};

export const exportSlidesPacketToTempDir = async ({
  repoRoot = process.cwd(),
  projectId = DESIGNER_PROJECT_ID,
  slideFilter = null,
  importPlaywrightImpl = importPlaywright,
} = {}) => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), "designer-pptx-packet-"));
  try {
    const result = await exportSlidesPacket({
      repoRoot,
      projectId,
      outputDir: tempRoot,
      slideFilter,
      importPlaywrightImpl,
    });
    return {
      ...result,
      cleanup: async () => {
        await rm(tempRoot, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await rm(tempRoot, { recursive: true, force: true });
    throw error;
  }
};

export const readPacketManifest = async (packetDir) => {
  const manifestPath = resolve(packetDir, "manifest.json");
  if (!(await pathExists(manifestPath))) {
    throw new Error(`Missing packet manifest: ${manifestPath}`);
  }
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  return {
    manifestPath,
    manifest,
  };
};

export const writePacketManifest = async (packetDir, manifest) => {
  const manifestPath = resolve(packetDir, "manifest.json");
  await writeJson(manifestPath, manifest);
  return {
    manifestPath,
    manifest,
  };
};

export const ensurePacketWorkspace = async ({
  repoRoot = process.cwd(),
  projectId = DESIGNER_PROJECT_ID,
  packetDir = null,
  outputDir,
  slideFilter = null,
  importPlaywrightImpl = importPlaywright,
} = {}) => {
  if (!outputDir) {
    throw new Error("Provide an output directory via --out.");
  }
  const resolvedOutputDir = resolve(outputDir);
  const resolvedPacketDir = packetDir ? resolve(packetDir) : null;
  if (!resolvedPacketDir) {
    const packet = await exportSlidesPacket({
      repoRoot,
      projectId,
      outputDir: resolvedOutputDir,
      slideFilter,
      importPlaywrightImpl,
    });
    return {
      outputDir: packet.outputDir,
      manifest: packet.manifest,
      manifestPath: packet.manifestPath,
      createdPacket: true,
    };
  }

  if (resolvedPacketDir !== resolvedOutputDir) {
    await rm(resolvedOutputDir, { recursive: true, force: true });
    await ensureDir(dirname(resolve(resolvedOutputDir, "manifest.json")));
    await cp(resolvedPacketDir, resolvedOutputDir, {
      recursive: true,
      force: true,
    });
  }

  const packet = await readPacketManifest(resolvedOutputDir);
  return {
    outputDir: resolvedOutputDir,
    manifest: packet.manifest,
    manifestPath: packet.manifestPath,
    createdPacket: false,
  };
};

export const inspectPacketOutputs = async (packetDir) => {
  const { manifest } = await readPacketManifest(packetDir);
  const slides = [];
  for (const slide of manifest.slides ?? []) {
    const flattenedPath = resolve(packetDir, slide.paths?.flattenedPng ?? "");
    const backgroundPath = resolve(packetDir, slide.paths?.backgroundPng ?? "");
    const flattenedStat = (await pathExists(flattenedPath)) ? await stat(flattenedPath) : null;
    const backgroundStat = (await pathExists(backgroundPath)) ? await stat(backgroundPath) : null;
    slides.push({
      repoSlideId: slide.repoSlideId,
      mode: slide.mode,
      flattenedBytes: flattenedStat?.size ?? 0,
      backgroundBytes: backgroundStat?.size ?? 0,
    });
  }
  return {
    slideCount: slides.length,
    slides,
  };
};

export const __test_extractTextLayersFromHtml = async ({
  htmlPath,
  importPlaywrightImpl = importPlaywright,
}) => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), "designer-packet-text-test-"));
  const flattenedPath = resolve(tempRoot, "flattened.png");
  const backgroundPath = resolve(tempRoot, "background.png");
  const textLayersPath = resolve(tempRoot, "text-layers.json");
  const { chromium } = await importPlaywrightImpl();
  const browser = await chromium.launch({ headless: true });
  try {
    return await renderHtmlSlide({
      browser,
      htmlPath: resolve(htmlPath),
      flattenedPath,
      backgroundPath,
      textLayersPath,
    });
  } finally {
    await browser.close();
    await rm(tempRoot, { recursive: true, force: true });
  }
};
