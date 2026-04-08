import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import {
  buildProjectManifest,
  classifyPathReference,
  discoverDeckProjects,
} from "../../../lib/repo/index.mjs";

const testDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
const repoRoot = resolve(testDir, "..", "..", "..");
const projectRoot = resolve(repoRoot, "projects", "designer-health");

const slideById = (manifest, id) => manifest.slides.find((slide) => slide.id === id);

test("discoverDeckProjects finds repo-backed deck projects", async () => {
  const projects = await discoverDeckProjects(repoRoot);
  assert.ok(projects.length >= 1);
  assert.ok(projects.some((project) => project.projectId === "designer-health"));
});

test("buildProjectManifest preserves Designer active/deprecated backbone", async () => {
  const manifest = await buildProjectManifest({ repoRoot, projectRoot });

  assert.equal(manifest.projectId, "designer-health");
  assert.deepEqual(manifest.numberingPolicy.activeSequence, ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]);
  assert.deepEqual(manifest.numberingPolicy.deprecatedSlides, ["4 (retired)", "4/5"]);
});

test("manifest resolves selected-vs-stamped split for slide 5", async () => {
  const manifest = await buildProjectManifest({ repoRoot, projectRoot });
  const slide05 = slideById(manifest, "slide-05");

  assert.ok(slide05);
  assert.equal(
    slide05.previews.selected.path,
    "projects/designer-health/slide-figures/slide-05/versions/version-000024--slide-05-20260329t214800z-attempt-01/preview.png"
  );
  assert.equal(slide05.previews.stampedNative, null);
  assert.equal(slide05.previews.sameAsset, false);
  assert.equal(slide05.displayNumber, "4");
  assert.ok(slide05.aliases.displayAliases.includes("slide-04"));
});

test("manifest resolves legacy slide-06 aliasing for canonical slide 7", async () => {
  const manifest = await buildProjectManifest({ repoRoot, projectRoot });
  const slide07 = slideById(manifest, "slide-07");

  assert.ok(slide07);
  assert.equal(slide07.displayNumber, "6");
  assert.ok(slide07.aliases.pathAliases.includes("slide-06"));
  assert.ok(slide07.aliases.displayAliases.includes("slide-06"));
  assert.equal(slide07.canonical.stampedDir.path, "projects/designer-health/slide-figures/slide-06");
});

test("manifest surfaces current selected work for slide 11", async () => {
  const manifest = await buildProjectManifest({ repoRoot, projectRoot });
  const slide11 = slideById(manifest, "slide-11");

  assert.ok(slide11);
  assert.equal(slide11.displayNumber, "10");
  assert.equal(slide11.canonical.stampedDir.path, "projects/designer-health/slide-figures/slide-11");
  assert.equal(slide11.previews.selected.path, "projects/designer-health/slide-figures/slide-11/versions/version-000047--beachhead-profile-hero-v1/gemini-html/preview.png");
  assert.equal(slide11.reports.slideReport, null);
});

test("manifest exposes promotion candidates and search text for slide 11", async () => {
  const manifest = await buildProjectManifest({ repoRoot, projectRoot });
  const slide11 = slideById(manifest, "slide-11");

  assert.ok(
    slide11.promotionCandidates.some(
      (candidate) =>
        candidate.source === "canonical-variant" &&
        candidate.derivedVariantId === "beachhead-profile-hero-v1"
    )
  );
  assert.ok(slide11.searchText.includes("beachhead-profile-hero-v1"));
});

test("manifest exposes history groups for legacy and variant-tree cases", async () => {
  const manifest = await buildProjectManifest({ repoRoot, projectRoot });
  const slide03 = slideById(manifest, "slide-03");
  const slide10 = slideById(manifest, "slide-10");

  assert.deepEqual(slide03.historyGroups.variantBranches, []);
  assert.ok(
    slide10.historyGroups.legacyDirectories.some((ref) =>
      ref.path.includes("projects/designer-health/slide-figures/slide-10/versions/version-000046--slide-10-legacy")
    )
  );
});

test("manifest keeps deprecated 4/5 visible and deprecated", async () => {
  const manifest = await buildProjectManifest({ repoRoot, projectRoot });
  const deprecated = slideById(manifest, "slide-04-05");

  assert.ok(deprecated);
  assert.equal(deprecated.status, "deprecated");
  assert.equal(deprecated.derived.artifactStatus, "deprecated");
});

test("manifest keeps output/figures references for canonical variants", async () => {
  const manifest = await buildProjectManifest({ repoRoot, projectRoot });
  const slide03 = slideById(manifest, "slide-03");
  const outputVariant = slide03.canonical.variants.find(
    (variant) => variant.id === "segmented-focus-bar"
  );

  assert.ok(outputVariant);
  assert.equal(
    outputVariant.preview.path,
    "projects/designer-health/slide-figures/slide-03/versions/version-000073--segmented-focus-bar-native/figure.png"
  );
});

test("manifest marks slide-10 legacy artifact lineage as historical", async () => {
  const manifest = await buildProjectManifest({ repoRoot, projectRoot });
  const slide10 = slideById(manifest, "slide-10");

  assert.ok(slide10);
  assert.ok(slide10.derived.lineageStatus.includes("orphan-historical-artifacts"));
});

test("project manifest exposes source precedence summary", async () => {
  const manifest = await buildProjectManifest({ repoRoot, projectRoot });

  assert.ok(Array.isArray(manifest.sourcePrecedenceSummary));
  assert.ok(manifest.sourcePrecedenceSummary.some((item) => item.id === "deck-spec"));
});

test("path classifier treats file:// and absolute external paths as stale external refs", () => {
  const fileUrlRef = classifyPathReference(
    repoRoot,
    "file:///Users/kabeer/Code/rkdesignerclone/projects/designer-health/deck-report.html"
  );
  const absoluteExternalRef = classifyPathReference(repoRoot, "/tmp/not-in-repo/example.txt");

  assert.equal(fileUrlRef.kind, "external-stale");
  assert.equal(fileUrlRef.reason, "url");
  assert.equal(absoluteExternalRef.kind, "external-stale");
  assert.equal(absoluteExternalRef.reason, "absolute-outside-repo");
});
