import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";

import {
  __test_extractTextLayersFromHtml,
  exportSlidesPacket,
  readPacketManifest,
} from "../lib/export-packet.mjs";
import { exportSlidesPdf } from "../lib/export-pdf.mjs";
import { exportSlidesQa } from "../lib/export-qa.mjs";
import { exportSlidesSvg } from "../lib/export-svg.mjs";

const REPO_ROOT = process.cwd();
const REPRESENTATIVE_SLIDES = ["slide-07", "slide-08", "slide-09", "slide-10", "slide-11", "slide-12"];
const PDFTOPPM_AVAILABLE = spawnSync("pdftoppm", ["-h"], { stdio: "ignore" }).status === 0;
const PDFFONTS_AVAILABLE = spawnSync("pdffonts", ["-h"], { stdio: "ignore" }).status === 0;

const readJson = async (filePath) => JSON.parse(await readFile(filePath, "utf8"));
const findSlide = (slides, repoSlideId) => slides.find((slide) => slide.repoSlideId === repoSlideId);

test(
  "slides:export:packet writes the Illustrator handoff packet contract for representative slides",
  { timeout: 180000 },
  async () => {
    const outputDir = await mkdtemp(resolve(tmpdir(), "designer-illustrator-packet-"));
    try {
      const result = await exportSlidesPacket({
        repoRoot: REPO_ROOT,
        outputDir,
        slideFilter: REPRESENTATIVE_SLIDES,
      });

      assert.equal(result.manifest.packetVersion, 2);
      assert.equal(result.manifest.slideCount, REPRESENTATIVE_SLIDES.length);

      const slide07 = findSlide(result.manifest.slides, "slide-07");
      const slide08 = findSlide(result.manifest.slides, "slide-08");
      const slide09 = findSlide(result.manifest.slides, "slide-09");
      const slide10 = findSlide(result.manifest.slides, "slide-10");
      const slide11 = findSlide(result.manifest.slides, "slide-11");
      const slide12 = findSlide(result.manifest.slides, "slide-12");

      assert.equal(slide07?.sourceClass, "preview_only");
      assert.equal(slide07?.mode, "raster_fallback");
      assert.equal(slide07?.dependencyFreezeStatus?.status, "not_applicable");
      const slide07TextLayers = await readJson(resolve(outputDir, slide07.paths.textLayers));
      assert.deepEqual(slide07TextLayers.groups, []);

      assert.equal(slide08?.sourceClass, "html_dom");
      assert.equal(slide08?.mode, "pdf_primary");
      assert.equal(slide08?.illustratorReadiness?.status, "preferred_pdf");
      const slide08Dependencies = await readJson(resolve(outputDir, slide08.paths.dependencies));
      assert.ok(
        slide08Dependencies.remote.some((entry) =>
          String(entry.ref ?? "").includes("fonts.googleapis.com")
        )
      );

      assert.equal(slide09?.sourceClass, "html_asset_heavy");
      assert.equal(slide09?.mode, "pdf_primary");

      assert.equal(slide10?.sourceClass, "html_dom");
      assert.equal(slide10?.paths.visualSvg, null);
      assert.match((slide10?.warnings ?? []).join("\n"), /slide-sized|24x24/i);

      assert.equal(slide11?.sourceClass, "html_wrapper_asset");
      assert.equal(slide11?.wrapperAssetKind, "svg");
      assert.equal(slide11?.mode, "wrapper_svg_passthrough");
      const slide11VisualSvg = await readFile(resolve(outputDir, slide11.paths.visualSvg), "utf8");
      assert.match(slide11VisualSvg, /<svg\b/i);

      assert.equal(slide12?.sourceClass, "html_dom");
      assert.equal(slide12?.mode, "pdf_primary");
      const slide12Dependencies = await readJson(resolve(outputDir, slide12.paths.dependencies));
      assert.ok(
        slide12Dependencies.local.some((entry) =>
          String(entry.packetPath ?? "").includes("designer-health-logo-black.svg")
        )
      );
      const slide12NormalizedHtml = await readFile(resolve(outputDir, slide12.paths.normalizedHtml), "utf8");
      assert.match(slide12NormalizedHtml, /\.\/assets\//);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  }
);

test(
  "slides:export:pdf creates per-slide PDFs plus a bundled deck PDF",
  { timeout: 180000 },
  async () => {
    const outputDir = await mkdtemp(resolve(tmpdir(), "designer-illustrator-pdf-"));
    try {
      const result = await exportSlidesPdf({
        repoRoot: REPO_ROOT,
        outputDir,
        slideFilter: REPRESENTATIVE_SLIDES,
      });

      assert.equal(result.slideCount, REPRESENTATIVE_SLIDES.length);
      const exportManifest = await readJson(resolve(outputDir, "pdf-export.json"));
      assert.equal(exportManifest.slideCount, REPRESENTATIVE_SLIDES.length);
      const deckPdfBytes = await readFile(resolve(outputDir, exportManifest.deckPdf));
      assert.equal(deckPdfBytes.subarray(0, 5).toString("utf8"), "%PDF-");

      const slide08 = findSlide(exportManifest.slides, "slide-08");
      const slide08PdfPath = resolve(outputDir, slide08.pdfPath);
      const slide08PdfBytes = await readFile(slide08PdfPath);
      assert.equal(slide08PdfBytes.subarray(0, 5).toString("utf8"), "%PDF-");

      if (PDFFONTS_AVAILABLE) {
        const fontsOutput = execFileSync("pdffonts", [slide08PdfPath], {
          encoding: "utf8",
        });
        assert.match(fontsOutput, /name\s+type/i);
      }
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  }
);

test(
  "slides:export:svg only emits trusted pass-through SVG slides",
  { timeout: 180000 },
  async () => {
    const outputDir = await mkdtemp(resolve(tmpdir(), "designer-illustrator-svg-"));
    try {
      const result = await exportSlidesSvg({
        repoRoot: REPO_ROOT,
        outputDir,
        slideFilter: REPRESENTATIVE_SLIDES,
      });

      assert.equal(result.slideCount, REPRESENTATIVE_SLIDES.length);
      assert.equal(result.exportedCount, 1);
      const exportManifest = await readJson(resolve(outputDir, "svg-export.json"));
      const slide11 = findSlide(exportManifest.slides, "slide-11");
      const slide08 = findSlide(exportManifest.slides, "slide-08");
      const slide10 = findSlide(exportManifest.slides, "slide-10");
      const slide07 = findSlide(exportManifest.slides, "slide-07");

      assert.ok(slide11?.editableSvgPath);
      assert.equal(slide11?.mode, "wrapper_svg_passthrough");
      assert.match(await readFile(resolve(outputDir, slide11.editableSvgPath), "utf8"), /<svg\b/i);

      assert.equal(slide08?.editableSvgPath, null);
      assert.match(slide08?.skippedReason ?? "", /trusted pass-through SVG/i);
      assert.equal(slide10?.editableSvgPath, null);
      assert.match(slide10?.skippedReason ?? "", /trusted pass-through SVG/i);
      assert.equal(slide07?.editableSvgPath, null);
      assert.match(slide07?.skippedReason ?? "", /Raster fallback/i);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  }
);

test(
  "slides:export:qa renders PDF and SVG handoffs back to PNG and records results",
  { timeout: 180000, skip: !PDFTOPPM_AVAILABLE },
  async () => {
    const packetDir = await mkdtemp(resolve(tmpdir(), "designer-illustrator-qa-packet-"));
    try {
      await exportSlidesPacket({
        repoRoot: REPO_ROOT,
        outputDir: packetDir,
        slideFilter: REPRESENTATIVE_SLIDES,
      });

      const result = await exportSlidesQa({
        repoRoot: REPO_ROOT,
        packetDir,
      });

      assert.equal(result.slideCount, REPRESENTATIVE_SLIDES.length);
      const summary = await readJson(resolve(packetDir, "handoff-qa", "summary.json"));
      assert.equal(summary.slideCount, REPRESENTATIVE_SLIDES.length);

      const slide08 = findSlide(summary.slides, "slide-08");
      const slide11 = findSlide(summary.slides, "slide-11");
      const slide07 = findSlide(summary.slides, "slide-07");

      assert.ok(["pass", "warn"].includes(slide08?.pdf?.status));
      assert.ok(["pass", "warn"].includes(slide11?.pdf?.status));
      assert.ok(["pass", "warn"].includes(slide11?.svg?.status));
      assert.equal(slide07?.svg?.status, "skipped");

      const packetManifest = (await readPacketManifest(packetDir)).manifest;
      assert.equal(packetManifest.paths.qaReport, "handoff-qa/summary.json");
      const updatedSlide11 = findSlide(packetManifest.slides, "slide-11");
      assert.equal(
        updatedSlide11?.paths?.qa?.exportReport,
        `${updatedSlide11.paths.dir}/handoff-qa/report.json`
      );
    } finally {
      await rm(packetDir, { recursive: true, force: true });
    }
  }
);

test(
  "__test_extractTextLayersFromHtml groups semantic blocks before leaf fallback",
  { timeout: 180000 },
  async () => {
    const tempRoot = await mkdtemp(resolve(tmpdir(), "designer-illustrator-text-"));
    const htmlPath = resolve(tempRoot, "fixture.html");
    try {
      await writeFile(
        htmlPath,
        `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      html, body {
        margin: 0;
        width: 800px;
        height: 600px;
        overflow: hidden;
      }
      body {
        font-family: Arial, sans-serif;
        padding: 40px;
      }
      .chips {
        display: flex;
        gap: 16px;
        margin-top: 24px;
      }
      .chips span {
        font-size: 24px;
        color: rgb(15, 23, 42);
      }
    </style>
  </head>
  <body>
    <h1>Headline</h1>
    <p>Supporting copy</p>
    <div class="chips">
      <span>Alpha</span>
      <span>Beta</span>
    </div>
  </body>
</html>`,
        "utf8"
      );

      const textLayers = await __test_extractTextLayersFromHtml({ htmlPath });
      assert.ok(textLayers.groups.some((group) => group.kind === "semantic" && group.text === "Headline"));
      assert.ok(
        textLayers.groups.some(
          (group) => group.kind === "semantic" && group.text === "Supporting copy"
        )
      );
      assert.ok(
        textLayers.groups.some(
          (group) => group.kind === "sibling-group" && group.text === "Alpha Beta"
        )
      );
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }
);
