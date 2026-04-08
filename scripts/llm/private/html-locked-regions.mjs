import { readFile } from "node:fs/promises";

import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toInteger = (value) => Math.round(Number(value));

const cropRegion = (png, region) => {
  const x = clamp(toInteger(region.x), 0, png.width);
  const y = clamp(toInteger(region.y), 0, png.height);
  const width = clamp(toInteger(region.width), 0, png.width - x);
  const height = clamp(toInteger(region.height), 0, png.height - y);

  if (width <= 0 || height <= 0) {
    throw new Error(`Approved region ${region.id || region.label || "unknown"} is empty.`);
  }

  const cropped = new PNG({ width, height });
  for (let row = 0; row < height; row += 1) {
    const sourceStart = ((y + row) * png.width + x) * 4;
    const sourceEnd = sourceStart + width * 4;
    const targetStart = row * width * 4;
    png.data.copy(cropped.data, targetStart, sourceStart, sourceEnd);
  }
  return cropped;
};

const readPng = async (filePath) => {
  const buffer = await readFile(filePath);
  return new Promise((resolve, reject) => {
    const png = new PNG();
    png.parse(buffer, (error, data) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(data);
    });
  });
};

const summarizeViolations = (violations) => {
  if (violations.length === 0) {
    return "No locked-region violations.";
  }
  return violations
    .map((violation) => {
      const ratio = `${(violation.diffRatio * 100).toFixed(2)}%`;
      return `${violation.label}: ${violation.outcome} (${ratio} changed, threshold ${(violation.threshold * 100).toFixed(2)}%)`;
    })
    .join("; ");
};

export const evaluateLockedRegions = async ({
  officialPreviewPath,
  candidatePreviewPath,
  approvedRegions = [],
  pixelStrictThreshold = 0.005,
  semanticStableThreshold = 0.05,
  pixelmatchThreshold = 0.1,
}) => {
  if (!Array.isArray(approvedRegions) || approvedRegions.length === 0) {
    return {
      ok: true,
      violations: [],
      warnings: [],
      summary: "No approved regions defined.",
    };
  }

  const [officialPng, candidatePng] = await Promise.all([
    readPng(officialPreviewPath),
    readPng(candidatePreviewPath),
  ]);

  if (
    officialPng.width !== candidatePng.width ||
    officialPng.height !== candidatePng.height
  ) {
    throw new Error(
      `Locked-region comparison requires matching preview dimensions. official=${officialPng.width}x${officialPng.height}, candidate=${candidatePng.width}x${candidatePng.height}`
    );
  }

  const violations = [];
  const warnings = [];

  for (const region of approvedRegions) {
    const officialCrop = cropRegion(officialPng, region);
    const candidateCrop = cropRegion(candidatePng, region);
    const mismatchPixels = pixelmatch(
      officialCrop.data,
      candidateCrop.data,
      null,
      officialCrop.width,
      officialCrop.height,
      {
        threshold: pixelmatchThreshold,
      }
    );
    const totalPixels = officialCrop.width * officialCrop.height;
    const diffRatio = totalPixels > 0 ? mismatchPixels / totalPixels : 0;
    const freezeLevel =
      String(region.freezeLevel ?? "").trim().toLowerCase() === "pixel-strict"
        ? "pixel-strict"
        : "semantic-stable";
    const threshold =
      freezeLevel === "pixel-strict" ? pixelStrictThreshold : semanticStableThreshold;
    const outcome =
      diffRatio > threshold
        ? freezeLevel === "pixel-strict"
          ? "block"
          : "warn"
        : "clear";

    const entry = {
      id: region.id || null,
      label: region.label || region.id || "Approved region",
      freezeLevel,
      x: toInteger(region.x),
      y: toInteger(region.y),
      width: toInteger(region.width),
      height: toInteger(region.height),
      mismatchedPixels: mismatchPixels,
      totalPixels,
      diffRatio,
      threshold,
      outcome,
      note: region.note || "",
    };

    if (outcome === "block") {
      violations.push(entry);
    } else if (outcome === "warn") {
      warnings.push(entry);
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    warnings,
    summary: summarizeViolations([...violations, ...warnings]),
  };
};
