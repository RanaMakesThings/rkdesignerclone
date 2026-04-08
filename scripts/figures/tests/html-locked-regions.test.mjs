import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import test from "node:test";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { PNG } from "pngjs";

import { evaluateLockedRegions } from "../../llm/private/html-locked-regions.mjs";

const makeTempDir = async () => mkdtemp(join(tmpdir(), "ysn-html-locks-"));

const writePng = async ({ filePath, fill = [255, 255, 255, 255], mutate = null }) => {
  const png = new PNG({ width: 40, height: 40 });
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const index = (png.width * y + x) * 4;
      png.data[index] = fill[0];
      png.data[index + 1] = fill[1];
      png.data[index + 2] = fill[2];
      png.data[index + 3] = fill[3];
    }
  }
  if (typeof mutate === "function") {
    mutate(png);
  }
  const buffer = PNG.sync.write(png);
  await writeFile(filePath, buffer);
};

test("evaluateLockedRegions hard-blocks pixel-strict drift and warns on semantic-stable drift", async () => {
  const dir = await makeTempDir();
  try {
    const official = resolve(dir, "official.png");
    const candidate = resolve(dir, "candidate.png");
    await writePng({ filePath: official });
    await writePng({
      filePath: candidate,
      mutate: (png) => {
        for (let y = 0; y < 8; y += 1) {
          for (let x = 0; x < 8; x += 1) {
            const index = (png.width * y + x) * 4;
            png.data[index] = 0;
            png.data[index + 1] = 0;
            png.data[index + 2] = 0;
          }
        }
        for (let y = 20; y < 26; y += 1) {
          for (let x = 20; x < 26; x += 1) {
            const index = (png.width * y + x) * 4;
            png.data[index] = 0;
            png.data[index + 1] = 0;
            png.data[index + 2] = 255;
          }
        }
      },
    });

    const result = await evaluateLockedRegions({
      officialPreviewPath: official,
      candidatePreviewPath: candidate,
      approvedRegions: [
        {
          id: "title",
          label: "Title lock",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          freezeLevel: "pixel-strict",
        },
        {
          id: "body",
          label: "Body lock",
          x: 18,
          y: 18,
          width: 10,
          height: 10,
          freezeLevel: "semantic-stable",
        },
      ],
      pixelStrictThreshold: 0.001,
      semanticStableThreshold: 0.02,
    });

    assert.equal(result.ok, false);
    assert.equal(result.violations.length, 1);
    assert.equal(result.violations[0].freezeLevel, "pixel-strict");
    assert.equal(result.warnings.length, 1);
    assert.equal(result.warnings[0].freezeLevel, "semantic-stable");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
