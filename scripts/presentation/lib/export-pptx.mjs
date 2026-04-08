import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { readPacketManifest, exportSlidesPacketToTempDir } from "./export-packet.mjs";
import {
  DEFAULT_SLIDE_VIEWPORT,
  DESIGNER_PROJECT_ID,
  cssColorToHex,
  parseCssPx,
  pxToPoints,
  readJson,
  toPptFontFace,
} from "./export-common.mjs";

const PPT_LAYOUT = {
  width: 13.333,
  height: 7.5,
};

const importPptxGenJs = async () => {
  try {
    const module = await import("pptxgenjs");
    return module.default ?? module;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      [
        "pptxgenjs is required for slides:export:pptx but is unavailable.",
        `Details: ${message}`,
        "Run: npm install",
      ].join("\n")
    );
  }
};

const normalizeAlignment = (value) => {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "center" || raw === "right" || raw === "justify") {
    return raw;
  }
  return "left";
};

const normalizeTextBoxOptions = ({ group, viewport }) => {
  const viewWidth = Number(viewport?.width || DEFAULT_SLIDE_VIEWPORT.width);
  const viewHeight = Number(viewport?.height || DEFAULT_SLIDE_VIEWPORT.height);
  const fontSizePx = parseCssPx(group.styles?.fontSize, 20);
  const x = (Number(group.bounds?.left || 0) / viewWidth) * PPT_LAYOUT.width;
  const y = (Number(group.bounds?.top || 0) / viewHeight) * PPT_LAYOUT.height;
  const w = (Number(group.bounds?.width || 0) / viewWidth) * PPT_LAYOUT.width;
  const h = (Number(group.bounds?.height || 0) / viewHeight) * PPT_LAYOUT.height;
  const fontWeight = parseInt(group.styles?.fontWeight, 10) || 400;

  return {
    x: Number(x.toFixed(4)),
    y: Number(y.toFixed(4)),
    w: Number(w.toFixed(4)),
    h: Number(h.toFixed(4)),
    margin: 0,
    valign: "top",
    fit: "shrink",
    fontFace: toPptFontFace(group.styles?.fontFamily),
    fontSize: pxToPoints(fontSizePx),
    bold: fontWeight >= 600,
    italic: String(group.styles?.fontStyle || "").toLowerCase() === "italic",
    color: cssColorToHex(group.styles?.color, "111111"),
    align: normalizeAlignment(group.styles?.textAlign),
    breakLine: false,
  };
};

const addEditableTextLayers = async ({ slide, packetDir, packetSlide }) => {
  if (packetSlide.mode === "raster_fallback" || !packetSlide.paths?.textLayers) {
    return;
  }

  const textLayersPath = resolve(packetDir, packetSlide.paths.textLayers);
  const textLayers = await readJson(textLayersPath);
  if (!Array.isArray(textLayers.groups) || textLayers.groups.length === 0) {
    return;
  }
  const viewport = packetSlide.viewport ?? textLayers.viewport ?? DEFAULT_SLIDE_VIEWPORT;
  for (const group of textLayers.groups ?? []) {
    if (!String(group.text ?? "").trim()) {
      continue;
    }
    slide.addText(String(group.text), normalizeTextBoxOptions({ group, viewport }));
  }
};

export const buildPptxFromPacket = async ({ packetDir, outputFile }) => {
  if (!outputFile) {
    throw new Error("Provide an output file via --out.");
  }

  const { manifest } = await readPacketManifest(packetDir);
  const PptxGenJS = await importPptxGenJs();
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "OpenAI Codex";
  pptx.company = "Designer Health";
  pptx.subject = manifest.title ?? "Designer slide export";
  pptx.title = manifest.title ?? "Designer slide export";
  pptx.lang = "en-US";

  for (const packetSlide of manifest.slides ?? []) {
    const slide = pptx.addSlide();
    const backgroundPath = resolve(
      packetDir,
      packetSlide.paths?.backgroundPng ?? packetSlide.paths?.flattenedPng ?? ""
    );
    slide.addImage({
      path: backgroundPath,
      x: 0,
      y: 0,
      w: PPT_LAYOUT.width,
      h: PPT_LAYOUT.height,
    });
    // eslint-disable-next-line no-await-in-loop
    await addEditableTextLayers({
      slide,
      packetDir,
      packetSlide,
    });
    slide.addNotes(
      [
        `repoSlideId: ${packetSlide.repoSlideId}`,
        `displayNumber: ${packetSlide.displayNumber}`,
        `canonicalParam: ${packetSlide.canonicalParam}`,
        `currentVersionId: ${packetSlide.currentVersionId ?? "none"}`,
        `mode: ${packetSlide.mode}`,
      ].join("\n")
    );
  }

  await pptx.writeFile({
    fileName: resolve(outputFile),
  });

  return {
    outputFile: resolve(outputFile),
    slideCount: Array.isArray(manifest.slides) ? manifest.slides.length : 0,
  };
};

export const exportSlidesPptx = async ({
  repoRoot = process.cwd(),
  projectId = DESIGNER_PROJECT_ID,
  packetDir = null,
  outputFile,
  slideFilter = null,
  importPlaywrightImpl,
} = {}) => {
  if (packetDir) {
    return buildPptxFromPacket({
      packetDir: resolve(packetDir),
      outputFile,
    });
  }

  const packet = await exportSlidesPacketToTempDir({
    repoRoot,
    projectId,
    slideFilter,
    importPlaywrightImpl,
  });
  try {
    return await buildPptxFromPacket({
      packetDir: packet.outputDir,
      outputFile,
    });
  } finally {
    await packet.cleanup();
  }
};
