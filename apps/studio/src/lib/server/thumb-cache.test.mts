import assert from "node:assert/strict";
import { homedir } from "node:os";
import test from "node:test";

import { buildThumbCacheKey, getThumbCachePath } from "./thumb-cache.ts";

test("buildThumbCacheKey changes when the source stats or requested width change", () => {
  const base = buildThumbCacheKey({
    repoRelativePath: "projects/designer-health/slide-figures/slide-01/slide-01.png",
    width: 720,
    sourceSizeBytes: 1024,
    sourceMtimeMs: 10,
  });
  const widthChanged = buildThumbCacheKey({
    repoRelativePath: "projects/designer-health/slide-figures/slide-01/slide-01.png",
    width: 900,
    sourceSizeBytes: 1024,
    sourceMtimeMs: 10,
  });
  const statChanged = buildThumbCacheKey({
    repoRelativePath: "projects/designer-health/slide-figures/slide-01/slide-01.png",
    width: 720,
    sourceSizeBytes: 2048,
    sourceMtimeMs: 10,
  });

  assert.notEqual(base, widthChanged);
  assert.notEqual(base, statChanged);
});

test("getThumbCachePath resolves under the designer-data thumb cache", () => {
  const cachePath = getThumbCachePath({
    repoRoot: "/repo",
    thumbKey: "abc123",
  });

  assert.equal(cachePath, `${homedir()}/designer-data/cache/thumbs/abc123.webp`);
});
