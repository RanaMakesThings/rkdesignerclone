import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";

import { importPlaywright } from "../../utils/html-screenshot-lib.mjs";
import { exportSlidesPacketToTempDir, readPacketManifest } from "./export-packet.mjs";
import { DESIGNER_PROJECT_ID, ensureDir, ensureParentDir, writeJson } from "./export-common.mjs";

const canExportEditableSvg = (packetSlide) =>
  (packetSlide.mode === "wrapper_svg_passthrough" || packetSlide.mode === "editable_svg") &&
  Boolean(packetSlide.paths?.visualSvg);

export const buildSvgExportsFromPacket = async ({
  packetDir,
  outputDir,
  slideFilter = null,
} = {}) => {
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

  const slides = [];
  for (const packetSlide of packetSlides) {
    const slideDirName = basename(packetSlide.paths?.dir ?? `slide-${packetSlide.displayNumber}`);
    const outputSlideDir = resolve(resolvedOutputDir, "slides", slideDirName);
    const editableSvgPath = resolve(outputSlideDir, "editable.svg");
    let exportedSvgPath = null;
    let skippedReason = null;

    if (canExportEditableSvg(packetSlide)) {
      const sourceSvgPath = resolve(resolvedPacketDir, packetSlide.paths.visualSvg);
      await ensureParentDir(editableSvgPath);
      await copyFile(sourceSvgPath, editableSvgPath);
      exportedSvgPath = `slides/${slideDirName}/editable.svg`;
    } else {
      skippedReason =
        packetSlide.mode === "raster_fallback"
          ? "Raster fallback slides do not emit editable SVG."
          : "No trusted pass-through SVG is available for this slide.";
    }

    slides.push({
      repoSlideId: packetSlide.repoSlideId,
      displayNumber: packetSlide.displayNumber,
      title: packetSlide.title,
      mode: packetSlide.mode,
      sourceClass: packetSlide.sourceClass,
      warnings: packetSlide.warnings ?? [],
      illustratorReadiness: packetSlide.illustratorReadiness ?? null,
      editableSvgPath: exportedSvgPath,
      skippedReason,
    });
  }

  const exportManifest = {
    exportVersion: 1,
    generatedAt: new Date().toISOString(),
    packetDir: resolvedPacketDir,
    slideCount: slides.length,
    exportedCount: slides.filter((slide) => slide.editableSvgPath).length,
    slides,
  };
  const manifestPath = resolve(resolvedOutputDir, "svg-export.json");
  await writeJson(manifestPath, exportManifest);
  return {
    outputDir: resolvedOutputDir,
    manifestPath,
    manifest: exportManifest,
    slideCount: exportManifest.slideCount,
    exportedCount: exportManifest.exportedCount,
  };
};

export const exportSlidesSvg = async ({
  repoRoot = process.cwd(),
  projectId = DESIGNER_PROJECT_ID,
  packetDir = null,
  outputDir,
  slideFilter = null,
  importPlaywrightImpl = importPlaywright,
} = {}) => {
  if (packetDir) {
    return buildSvgExportsFromPacket({
      packetDir: resolve(packetDir),
      outputDir,
      slideFilter,
    });
  }

  const packet = await exportSlidesPacketToTempDir({
    repoRoot,
    projectId,
    slideFilter,
    importPlaywrightImpl,
  });
  try {
    return await buildSvgExportsFromPacket({
      packetDir: packet.outputDir,
      outputDir,
      slideFilter,
    });
  } finally {
    await packet.cleanup();
  }
};

export const exportSlidesSvgToTempDir = async ({
  repoRoot = process.cwd(),
  projectId = DESIGNER_PROJECT_ID,
  packetDir = null,
  slideFilter = null,
  importPlaywrightImpl = importPlaywright,
} = {}) => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), "designer-illustrator-svg-"));
  try {
    const result = await exportSlidesSvg({
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
