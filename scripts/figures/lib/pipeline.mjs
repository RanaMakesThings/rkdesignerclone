import { mkdir, readFile } from "node:fs/promises";
import {
  maybeGenerateFigureAssets,
  resolveRenderSelectionsFromArtifacts,
} from "./assets.mjs";
import {
  getOutputPaths,
  toFileUrl,
  writeJson,
  writeText,
} from "./io.mjs";
import { loadFigureSpec } from "./spec.mjs";
import { renderFigureSvgFromHtml } from "./svg.mjs";
import { renderFigureHtml } from "./template.mjs";
import { buildCoverageReport } from "./check.mjs";

const renderMetaDoc = ({ spec, specPath, paths }) => ({
  generatedAt: new Date().toISOString(),
  slug: spec.meta.slug,
  family: spec.meta.family,
  deckId: spec.meta.deckId,
  theme: spec.meta.theme,
  mode: spec.meta.mode,
  title: spec.chrome.title,
  subtitle: spec.chrome.subtitle,
  specPath,
  outputDir: paths.dir,
    artifacts: {
      spec: paths.specJsonPath,
      meta: paths.metaJsonPath,
      html: paths.htmlPath,
      svg: paths.svgPath,
      png: paths.pngPath,
      coverage: paths.coveragePath,
      assessment: paths.assessmentPath,
      assetsManifest: paths.assetsManifestPath,
    assetBoardHtml: paths.assetBoardHtmlPath,
    assetBoardPng: paths.assetBoardPngPath,
    assetSelection: paths.assetSelectionPath,
    renderAssets: paths.renderAssetsPath,
  },
});

const resolveSelectedMedia = async ({ spec, paths }) => {
  const resolved = await resolveRenderSelectionsFromArtifacts({ spec, paths });
  if (resolved.length > 0) {
    return resolved.map((entry, index) => ({
      id: entry.id || `selection-${index + 1}`,
      ...entry,
      resolved: true,
      source: "render-assets",
    }));
  }
  return [];
};

export const renderFigure = async ({ specPath, outputDir = null }) => {
  const spec = await loadFigureSpec(specPath);
  const paths = getOutputPaths({
    slug: spec.meta.slug,
    outputDir,
  });

  await mkdir(paths.dir, { recursive: true });

  const resolvedSelections = await resolveSelectedMedia({ spec, paths });
  const renderSpec = {
    ...spec,
    media: {
      ...spec.media,
      resolvedSelections,
    },
  };
  const html = renderFigureHtml(renderSpec);
  const svg = renderFigureSvgFromHtml(html);
  const meta = {
    ...renderMetaDoc({ spec, specPath, paths }),
    selectedMedia: resolvedSelections.map((entry) => ({
      id: entry.id,
      placement: entry.placement,
      slotId: entry.slotId,
      candidateId: entry.candidateId,
      src: entry.src,
      treatment: entry.treatment,
    })),
  };

  await writeJson(paths.specJsonPath, spec);
  await writeJson(paths.metaJsonPath, meta);
  await writeText(paths.htmlPath, html);
  await writeText(paths.svgPath, svg);

  return { spec: renderSpec, paths, html, svg, meta };
};

const importPlaywright = async () => {
  try {
    return await import("playwright");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      [
        "Playwright is required for HTML-to-PNG export but is unavailable.",
        `Details: ${message}`,
        "Remediation:",
        "1) Install dependencies with `npm install`.",
        "2) Install Chromium if needed with `npx playwright install chromium`.",
      ].join("\n")
    );
  }
};

export const exportFigure = async ({
  specPath,
  outputDir = null,
  enableImages = true,
  logger = console,
  generateAssetsImpl = maybeGenerateFigureAssets,
  importPlaywrightImpl = importPlaywright,
}) => {
  if (enableImages) {
    await generateAssetsImpl({
      specPath,
      outputDir,
      logger,
    });
  }
  const renderResult = await renderFigure({ specPath, outputDir });
  const { chromium } = await importPlaywrightImpl();
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
    });
    await page.goto(toFileUrl(renderResult.paths.htmlPath), {
      waitUntil: "networkidle",
    });
    await page.screenshot({
      path: renderResult.paths.pngPath,
      fullPage: false,
    });
    await page.close();
  } finally {
    await browser.close();
  }

  return renderResult;
};

export const checkFigure = async ({
  specPath,
  outputDir = null,
  expectImages = null,
}) => {
  const spec = await loadFigureSpec(specPath);
  const paths = getOutputPaths({ slug: spec.meta.slug, outputDir });
  let html = "";

  try {
    html = await readFile(paths.htmlPath, "utf8");
  } catch {
    html = "";
  }

  const coverage = buildCoverageReport({ spec, paths, html, expectImages });
  await writeJson(paths.coveragePath, coverage);
  return { spec, paths, coverage };
};
