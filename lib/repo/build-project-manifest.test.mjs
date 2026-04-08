import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";

import { buildProjectManifest } from "./build-project-manifest.mjs";

test("project manifest resolves canonical slide and deck assets", async () => {
  const repoRoot = process.cwd();
  const manifest = await buildProjectManifest({
    repoRoot,
    projectRoot: resolve(repoRoot, "projects/designer-health"),
  });

  assert.equal(
    manifest.assets.deckManifest?.path,
    "projects/designer-health/assets/manifest.json"
  );
  assert.equal(
    manifest.references.manifest?.path,
    "projects/designer-health/references/manifest.json"
  );
  assert.equal(manifest.references.running.length, 8);
  assert.equal(manifest.assets.deckAssets[0]?.id, "designer-logo-pack");
  assert.equal(manifest.assets.deckAssets[0]?.assetId, "asset-000001");

  const slide09 = manifest.slides.find((slide) => slide.id === "slide-09");
  assert.ok(slide09);
  assert.equal(
    slide09.canonical.assetsManifest?.path,
    "projects/designer-health/slide-assets/slide-09/manifest.json"
  );
  const documentationScene = slide09.canonical.slideAssets.find(
    (asset) => asset.id === "physician-documentation-editorial-scene"
  );
  assert.ok(documentationScene);
  assert.equal(documentationScene.assetId, "asset-000002");
  assert.equal(slide09.canonical.deckAssets[0]?.id, "designer-logo-pack");
  assert.equal(slide09.canonical.deckAssets[0]?.assetId, "asset-000001");
  assert.equal(slide09.references.current.length, 2);
  assert.ok(
    slide09.searchText.includes("physician documentation editorial scene"),
    "slide search text should include canonical asset metadata"
  );
  assert.ok(
    slide09.searchText.includes("ambient artificial intelligence scribes"),
    "slide search text should include linked reference metadata"
  );
});
