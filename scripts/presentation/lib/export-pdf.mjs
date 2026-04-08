import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { PDFDocument } from "pdf-lib";

import { importPlaywright } from "../../utils/html-screenshot-lib.mjs";
import { ensurePacketWorkspace, exportSlidesPacketToTempDir, readPacketManifest } from "./export-packet.mjs";
import {
  DEFAULT_SLIDE_VIEWPORT,
  DESIGNER_PROJECT_ID,
  ensureDir,
  ensureParentDir,
  pathExists,
  writeJson,
} from "./export-common.mjs";

const buildFallbackPreviewMarkup = ({ previewUrl, viewport }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      html, body {
        margin: 0;
        width: ${viewport.width}px;
        height: ${viewport.height}px;
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

const loadFontsInPage = async (page) => {
  await page.evaluate(async () => {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
  });
};

const toSlideViewport = (packetSlide) => ({
  width: Number(packetSlide.viewport?.width || DEFAULT_SLIDE_VIEWPORT.width),
  height: Number(packetSlide.viewport?.height || DEFAULT_SLIDE_VIEWPORT.height),
});

const renderPacketSlideContent = async ({ page, packetDir, packetSlide }) => {
  const viewport = toSlideViewport(packetSlide);
  await page.setViewportSize(viewport);

  const normalizedHtmlPath = packetSlide.paths?.normalizedHtml
    ? resolve(packetDir, packetSlide.paths.normalizedHtml)
    : null;
  const sourcePreviewPath = packetSlide.paths?.sourcePreview
    ? resolve(packetDir, packetSlide.paths.sourcePreview)
    : null;
  const flattenedPngPath = packetSlide.paths?.flattenedPng
    ? resolve(packetDir, packetSlide.paths.flattenedPng)
    : null;

  if (
    packetSlide.mode !== "raster_fallback" &&
    normalizedHtmlPath &&
    (await pathExists(normalizedHtmlPath))
  ) {
    await page.goto(pathToFileURL(normalizedHtmlPath).href, {
      waitUntil: "networkidle",
    });
    await loadFontsInPage(page);
    return viewport;
  }

  const previewPath =
    (sourcePreviewPath && (await pathExists(sourcePreviewPath)) && sourcePreviewPath) ||
    (flattenedPngPath && (await pathExists(flattenedPngPath)) && flattenedPngPath);
  if (!previewPath) {
    throw new Error(`No preview-backed PDF source is available for ${packetSlide.repoSlideId}.`);
  }

  await page.setContent(
    buildFallbackPreviewMarkup({
      previewUrl: pathToFileURL(previewPath).href,
      viewport,
    }),
    { waitUntil: "load" }
  );
  return viewport;
};

export const renderPacketSlidePdf = async ({
  browser,
  packetDir,
  packetSlide,
  outputFile,
}) => {
  const page = await browser.newPage({
    viewport: toSlideViewport(packetSlide),
    deviceScaleFactor: 1,
  });
  try {
    const viewport = await renderPacketSlideContent({
      page,
      packetDir,
      packetSlide,
    });
    await ensureParentDir(outputFile);
    await page.pdf({
      path: outputFile,
      width: `${viewport.width}px`,
      height: `${viewport.height}px`,
      printBackground: true,
      preferCSSPageSize: false,
      margin: {
        top: "0",
        right: "0",
        bottom: "0",
        left: "0",
      },
    });
    return {
      outputFile: resolve(outputFile),
      viewport,
    };
  } finally {
    await page.close();
  }
};

const mergeDeckPdf = async ({ slidePdfs, deckPdfPath }) => {
  const deckPdf = await PDFDocument.create();
  for (const slidePdf of slidePdfs) {
    const bytes = await readFile(slidePdf.absolutePdfPath);
    const sourcePdf = await PDFDocument.load(bytes);
    const pages = await deckPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
    for (const page of pages) {
      deckPdf.addPage(page);
    }
  }
  await ensureParentDir(deckPdfPath);
  await writeFile(deckPdfPath, await deckPdf.save());
  return deckPdfPath;
};

export const buildPdfExportsFromPacket = async ({
  packetDir,
  outputDir,
  slideFilter = null,
  importPlaywrightImpl = importPlaywright,
}) => {
  if (!outputDir) {
    throw new Error("Provide an output directory via --out.");
  }

  const resolvedPacketDir = resolve(packetDir);
  const resolvedOutputDir = resolve(outputDir);
  await ensureDir(resolve(resolvedOutputDir, "slides"));
  const { manifest } = await readPacketManifest(resolvedPacketDir);
  const filterSet = Array.isArray(slideFilter) && slideFilter.length > 0 ? new Set(slideFilter) : null;
  const packetSlides = (manifest.slides ?? []).filter(
    (slide) => !filterSet || filterSet.has(slide.repoSlideId) || filterSet.has(String(slide.displayNumber))
  );

  const { chromium } = await importPlaywrightImpl();
  const browser = await chromium.launch({ headless: true });
  try {
    const slides = [];
    for (const packetSlide of packetSlides) {
      const slideDirName = basename(packetSlide.paths?.dir ?? `slide-${packetSlide.displayNumber}`);
      const outputSlideDir = resolve(resolvedOutputDir, "slides", slideDirName);
      const outputPdfPath = resolve(outputSlideDir, "slide.pdf");
      // eslint-disable-next-line no-await-in-loop
      await renderPacketSlidePdf({
        browser,
        packetDir: resolvedPacketDir,
        packetSlide,
        outputFile: outputPdfPath,
      });
      slides.push({
        repoSlideId: packetSlide.repoSlideId,
        displayNumber: packetSlide.displayNumber,
        title: packetSlide.title,
        mode: packetSlide.mode,
        sourceClass: packetSlide.sourceClass,
        warnings: packetSlide.warnings ?? [],
        pdfPath: `slides/${slideDirName}/slide.pdf`,
        absolutePdfPath: outputPdfPath,
      });
    }

    const deckPdfPath = resolve(resolvedOutputDir, "deck.pdf");
    await mergeDeckPdf({
      slidePdfs: slides,
      deckPdfPath,
    });

    const exportManifest = {
      exportVersion: 1,
      generatedAt: new Date().toISOString(),
      packetDir: resolvedPacketDir,
      deckPdf: "deck.pdf",
      slideCount: slides.length,
      slides: slides.map(({ absolutePdfPath, ...slide }) => slide),
    };
    const manifestPath = resolve(resolvedOutputDir, "pdf-export.json");
    await writeJson(manifestPath, exportManifest);
    return {
      outputDir: resolvedOutputDir,
      manifestPath,
      manifest: exportManifest,
      deckPdfPath,
      slideCount: exportManifest.slideCount,
    };
  } finally {
    await browser.close();
  }
};

export const exportSlidesPdf = async ({
  repoRoot = process.cwd(),
  projectId = DESIGNER_PROJECT_ID,
  packetDir = null,
  outputDir,
  slideFilter = null,
  importPlaywrightImpl = importPlaywright,
} = {}) => {
  if (packetDir) {
    return buildPdfExportsFromPacket({
      packetDir: resolve(packetDir),
      outputDir,
      slideFilter,
      importPlaywrightImpl,
    });
  }

  const packet = await exportSlidesPacketToTempDir({
    repoRoot,
    projectId,
    slideFilter,
    importPlaywrightImpl,
  });
  try {
    return await buildPdfExportsFromPacket({
      packetDir: packet.outputDir,
      outputDir,
      slideFilter,
      importPlaywrightImpl,
    });
  } finally {
    await packet.cleanup();
  }
};

export const exportSlidesPdfFromPacketWorkspace = async ({
  repoRoot = process.cwd(),
  projectId = DESIGNER_PROJECT_ID,
  packetDir = null,
  outputDir,
  slideFilter = null,
  importPlaywrightImpl = importPlaywright,
} = {}) => {
  const packetWorkspace = await ensurePacketWorkspace({
    repoRoot,
    projectId,
    packetDir,
    outputDir,
    slideFilter,
    importPlaywrightImpl,
  });
  return buildPdfExportsFromPacket({
    packetDir: packetWorkspace.outputDir,
    outputDir: packetWorkspace.outputDir,
    slideFilter,
    importPlaywrightImpl,
  });
};

export const exportSlidesPdfToTempDir = async ({
  repoRoot = process.cwd(),
  projectId = DESIGNER_PROJECT_ID,
  packetDir = null,
  slideFilter = null,
  importPlaywrightImpl = importPlaywright,
} = {}) => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), "designer-illustrator-pdf-"));
  try {
    const result = await exportSlidesPdf({
      repoRoot,
      projectId,
      packetDir,
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
