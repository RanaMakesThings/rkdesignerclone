import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

export const DESIGNER_PROJECT_ID = "designer-health";
export const DEFAULT_SLIDE_VIEWPORT = {
  width: 1920,
  height: 1080,
};

export const slugify = (value, fallback = "slide") =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || fallback;

export const padDisplayNumber = (value) => {
  const raw = String(value ?? "").trim();
  if (!/^\d+$/.test(raw)) {
    return raw;
  }
  return String(Number(raw)).padStart(2, "0");
};

export const ensureDir = async (dirPath) => {
  await mkdir(dirPath, { recursive: true });
  return dirPath;
};

export const ensureParentDir = async (filePath) => {
  await ensureDir(dirname(filePath));
  return filePath;
};

export const pathExists = async (targetPath) => {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
};

export const writeJson = async (filePath, value) => {
  await ensureParentDir(filePath);
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
};

export const readJson = async (filePath) => JSON.parse(await readFile(filePath, "utf8"));

export const comparePngFiles = async ({ actualPath, expectedPath, diffPath }) => {
  const actual = PNG.sync.read(await readFile(actualPath));
  const expected = PNG.sync.read(await readFile(expectedPath));
  if (actual.width !== expected.width || actual.height !== expected.height) {
    throw new Error(
      `PNG dimensions differ: ${actual.width}x${actual.height} vs ${expected.width}x${expected.height}.`
    );
  }
  const diff = new PNG({ width: actual.width, height: actual.height });
  const mismatchPixels = pixelmatch(
    expected.data,
    actual.data,
    diff.data,
    actual.width,
    actual.height,
    {
      threshold: 0.1,
    }
  );
  await ensureParentDir(diffPath);
  await writeFile(diffPath, PNG.sync.write(diff));
  return {
    width: actual.width,
    height: actual.height,
    mismatchPixels,
    mismatchRatio: actual.width * actual.height > 0 ? mismatchPixels / (actual.width * actual.height) : 0,
  };
};

export const parseCssPx = (value, fallback = 0) => {
  const match = String(value ?? "").trim().match(/^-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : fallback;
};

export const normalizeCssLineHeight = ({ lineHeight, fontSize }) => {
  const numeric = parseCssPx(lineHeight, NaN);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric;
  }
  const fontPx = parseCssPx(fontSize, 16);
  return Number((fontPx * 1.2).toFixed(3));
};

export const normalizeTextValue = (value) =>
  String(value ?? "")
    .replace(/\u00a0/g, " ")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

export const cssColorToHex = (value, fallback = "000000") => {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return fallback;
  }
  const hexMatch = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    return hex.length === 3
      ? hex
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
          .toUpperCase()
      : hex.toUpperCase();
  }

  const rgbMatch = raw.match(
    /^rgba?\(\s*(\d{1,3})(?:\.\d+)?\s*,\s*(\d{1,3})(?:\.\d+)?\s*,\s*(\d{1,3})(?:\.\d+)?(?:\s*,\s*[\d.]+\s*)?\)$/i
  );
  if (!rgbMatch) {
    return fallback;
  }

  return rgbMatch.slice(1, 4).map((part) => Number(part).toString(16).padStart(2, "0")).join("").toUpperCase();
};

export const toPptFontFace = (fontFamily) => {
  const families = String(fontFamily ?? "")
    .split(",")
    .map((part) => part.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
  return families[0] || "Arial";
};

export const pxToPoints = (px) => Number((Number(px || 0) * 0.75).toFixed(3));
