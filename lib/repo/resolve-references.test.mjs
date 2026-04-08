import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import { readDeckSpec } from "./read-deck-spec.mjs";
import { compileProjectReferences } from "./resolve-references.mjs";

test("project references compile into running appendix order and slide coverage", async () => {
  const repoRoot = process.cwd();
  const projectRoot = resolve(repoRoot, "projects/designer-health");
  const { deckSpec } = await readDeckSpec(projectRoot);
  const compiled = compileProjectReferences({
    repoRoot,
    projectRoot,
    deckSpec,
  });

  assert.equal(
    compiled.manifest?.path,
    "projects/designer-health/references/manifest.json"
  );
  assert.equal(compiled.library.length, 11);
  assert.equal(compiled.running.length, 8);
  assert.equal(compiled.stats.activeSlideCountWithReferences, 4);

  const slide02 = compiled.slides.find((slide) => slide.slideId === "slide-02");
  assert.ok(slide02);
  assert.deepEqual(
    slide02.current.map((usage) => usage.appendixNumber),
    [1, 2]
  );
  assert.deepEqual(slide02.missingCitationKeys, []);

  const slide10 = compiled.slides.find((slide) => slide.slideId === "slide-10");
  assert.ok(slide10);
  assert.deepEqual(
    slide10.current.map((usage) => usage.appendixNumber),
    [6, 7, 8]
  );

  assert.equal(compiled.generated.json?.path, "projects/designer-health/references/generated/running-references.json");
  assert.equal(
    compiled.generated.appendixHtml?.path,
    "projects/designer-health/references/generated/references-appendix.html"
  );
});
