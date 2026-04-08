import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { importPlaywright } from "../../utils/html-screenshot-lib.mjs";
import {
  ensurePacketWorkspace,
  readPacketManifest,
  writePacketManifest,
} from "./export-packet.mjs";
import { buildPdfExportsFromPacket } from "./export-pdf.mjs";
import { buildSvgExportsFromPacket } from "./export-svg.mjs";
import {
  comparePngFiles,
  DEFAULT_SLIDE_VIEWPORT,
  DESIGNER_PROJECT_ID,
  ensureDir,
  ensureParentDir,
  pathExists,
  writeJson,
} from "./export-common.mjs";

const execFile = promisify(execFileCallback);
const HANDOFF_QA_THRESHOLD = 0.08;

const buildSvgWrapperMarkup = ({ svgUrl, viewport }) => `<!doctype html>
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
        object-fit: contain;
      }
    </style>
  </head>
  <body>
    <img src="${svgUrl}" alt="" />
  </body>
</html>`;

const toViewport = (packetSlide) => ({
  width: Number(packetSlide.viewport?.width || DEFAULT_SLIDE_VIEWPORT.width),
  height: Number(packetSlide.viewport?.height || DEFAULT_SLIDE_VIEWPORT.height),
});

const ensurePdftoppm = async () => {
  try {
    await execFile("pdftoppm", ["-h"]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/ENOENT/i.test(message)) {
      throw new Error("pdftoppm is required for slides:export:qa but is not available on PATH.");
    }
  }
};

const renderPdfPageToPng = async ({ pdfPath, outputPath, viewport }) => {
  const outputPrefix = outputPath.slice(0, Math.max(0, outputPath.length - extname(outputPath).length));
  await ensureParentDir(outputPath);
  await execFile("pdftoppm", [
    "-png",
    "-singlefile",
    "-scale-to-x",
    String(viewport.width),
    "-scale-to-y",
    String(viewport.height),
    pdfPath,
    outputPrefix,
  ]);
  return outputPath;
};

const renderSvgToPng = async ({ browser, svgPath, viewport, outputPath }) => {
  const page = await browser.newPage({
    viewport,
    deviceScaleFactor: 1,
  });
  try {
    await page.setContent(
      buildSvgWrapperMarkup({
        svgUrl: pathToFileURL(svgPath).href,
        viewport,
      }),
      { waitUntil: "load" }
    );
    await ensureParentDir(outputPath);
    await page.screenshot({
      path: outputPath,
      type: "png",
    });
  } finally {
    await page.close();
  }
  return outputPath;
};

const summarizeComparison = (comparison, renderPath, diffPath) => ({
  status: comparison.mismatchRatio <= HANDOFF_QA_THRESHOLD ? "pass" : "warn",
  threshold: HANDOFF_QA_THRESHOLD,
  renderPath,
  diffPath,
  ...comparison,
});

export const runSlidesExportQa = async ({
  repoRoot = process.cwd(),
  projectId = DESIGNER_PROJECT_ID,
  packetDir,
  importPlaywrightImpl = importPlaywright,
} = {}) => {
  if (!packetDir) {
    throw new Error("Provide a packet directory via --packet.");
  }

  await ensurePdftoppm();

  const resolvedPacketDir = resolve(packetDir);
  const tempRoot = await mkdtemp(resolve(tmpdir(), "designer-illustrator-qa-"));
  const workspace = await ensurePacketWorkspace({
    repoRoot,
    projectId,
    packetDir: resolvedPacketDir,
    outputDir: tempRoot,
    importPlaywrightImpl,
  });

  const { chromium } = await importPlaywrightImpl();
  const browser = await chromium.launch({ headless: true });
  try {
    await buildPdfExportsFromPacket({
      packetDir: workspace.outputDir,
      outputDir: workspace.outputDir,
      importPlaywrightImpl,
    });
    await buildSvgExportsFromPacket({
      packetDir: workspace.outputDir,
      outputDir: workspace.outputDir,
    });

    const { manifest } = await readPacketManifest(resolvedPacketDir);
    const updatedManifest = JSON.parse(JSON.stringify(manifest));
    const slideResults = [];

    for (const packetSlide of manifest.slides ?? []) {
      const slideDirName = basename(packetSlide.paths?.dir ?? `slide-${packetSlide.displayNumber}`);
      const qaDir = resolve(resolvedPacketDir, packetSlide.paths?.dir ?? "", "handoff-qa");
      await ensureDir(qaDir);

      const referencePngPath = resolve(resolvedPacketDir, packetSlide.paths?.flattenedPng ?? "");
      const pdfPath = resolve(workspace.outputDir, packetSlide.paths?.slidePdf ?? "");
      const svgPath = packetSlide.paths?.editableSvg
        ? resolve(workspace.outputDir, packetSlide.paths.editableSvg)
        : null;
      const pdfRenderPath = resolve(qaDir, "pdf-render.png");
      const pdfDiffPath = resolve(qaDir, "pdf-diff.png");
      const svgRenderPath = resolve(qaDir, "svg-render.png");
      const svgDiffPath = resolve(qaDir, "svg-diff.png");
      const slideReportPath = resolve(qaDir, "report.json");

      let pdfResult = {
        status: "skipped",
        reason: "No PDF export was produced for this slide.",
      };
      if (await pathExists(pdfPath)) {
        const viewport = toViewport(packetSlide);
        await renderPdfPageToPng({
          pdfPath,
          viewport,
          outputPath: pdfRenderPath,
        });
        const comparison = await comparePngFiles({
          actualPath: pdfRenderPath,
          expectedPath: referencePngPath,
          diffPath: pdfDiffPath,
        });
        pdfResult = summarizeComparison(
          comparison,
          `${packetSlide.paths.dir}/handoff-qa/pdf-render.png`,
          `${packetSlide.paths.dir}/handoff-qa/pdf-diff.png`
        );
      }

      let svgResult = {
        status: "skipped",
        reason: "No trusted editable SVG export was produced for this slide.",
      };
      if (svgPath && (await pathExists(svgPath))) {
        await renderSvgToPng({
          browser,
          svgPath,
          viewport: toViewport(packetSlide),
          outputPath: svgRenderPath,
        });
        const comparison = await comparePngFiles({
          actualPath: svgRenderPath,
          expectedPath: referencePngPath,
          diffPath: svgDiffPath,
        });
        svgResult = summarizeComparison(
          comparison,
          `${packetSlide.paths.dir}/handoff-qa/svg-render.png`,
          `${packetSlide.paths.dir}/handoff-qa/svg-diff.png`
        );
      }

      const slideReport = {
        repoSlideId: packetSlide.repoSlideId,
        displayNumber: packetSlide.displayNumber,
        mode: packetSlide.mode,
        sourceClass: packetSlide.sourceClass,
        pdf: pdfResult,
        svg: svgResult,
      };
      await writeJson(slideReportPath, slideReport);
      slideResults.push({
        ...slideReport,
        reportPath: `${packetSlide.paths.dir}/handoff-qa/report.json`,
      });

      const updatedSlide = updatedManifest.slides.find(
        (slide) => slide.repoSlideId === packetSlide.repoSlideId
      );
      if (updatedSlide?.paths?.qa) {
        updatedSlide.paths.qa.exportReport = `${packetSlide.paths.dir}/handoff-qa/report.json`;
        updatedSlide.paths.qa.pdfRenderPng =
          pdfResult.status === "skipped" ? null : `${packetSlide.paths.dir}/handoff-qa/pdf-render.png`;
        updatedSlide.paths.qa.pdfDiffPng =
          pdfResult.status === "skipped" ? null : `${packetSlide.paths.dir}/handoff-qa/pdf-diff.png`;
        updatedSlide.paths.qa.svgRenderPng =
          svgResult.status === "skipped" ? null : `${packetSlide.paths.dir}/handoff-qa/svg-render.png`;
        updatedSlide.paths.qa.svgDiffPng =
          svgResult.status === "skipped" ? null : `${packetSlide.paths.dir}/handoff-qa/svg-diff.png`;
      }
    }

    const summary = {
      generatedAt: new Date().toISOString(),
      packetDir: resolvedPacketDir,
      slideCount: slideResults.length,
      slides: slideResults,
    };
    const summaryPath = resolve(resolvedPacketDir, "handoff-qa", "summary.json");
    await writeJson(summaryPath, summary);
    updatedManifest.paths = {
      ...(updatedManifest.paths ?? {}),
      qaReport: "handoff-qa/summary.json",
    };
    await writePacketManifest(resolvedPacketDir, updatedManifest);
    return {
      summaryPath,
      summary,
      slideCount: summary.slideCount,
    };
  } finally {
    await browser.close();
    await rm(tempRoot, { recursive: true, force: true });
  }
};

export const exportSlidesQa = runSlidesExportQa;
