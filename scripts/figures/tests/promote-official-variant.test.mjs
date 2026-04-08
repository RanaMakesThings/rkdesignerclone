import assert from "node:assert/strict";
import { mkdtemp, cp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import { promoteOfficialVariant } from "../../../lib/repo/index.mjs";

const sourceRepoRoot = process.cwd();
const sourceProjectRoot = resolve(sourceRepoRoot, "projects", "designer-health");

const setupTempRepo = async () => {
  const repoRoot = await mkdtemp(resolve(tmpdir(), "designer-studio-"));
  const projectRoot = resolve(repoRoot, "projects", "designer-health");
  await cp(sourceProjectRoot, projectRoot, { recursive: true });
  return {
    repoRoot,
    projectRoot,
    async readDeckSpec() {
      return JSON.parse(await readFile(resolve(projectRoot, "deck-spec.json"), "utf8"));
    },
    async readDeckSpecText() {
      return readFile(resolve(projectRoot, "deck-spec.json"), "utf8");
    },
    async cleanup() {
      await rm(repoRoot, { recursive: true, force: true });
    },
  };
};

const getSlide = (deckSpec, slideId) => deckSpec.slides.find((slide) => slide.id === slideId);

test("promoting a canonical variant updates selectedVariantId and statuses only", async (t) => {
  const tempRepo = await setupTempRepo();
  t.after(async () => tempRepo.cleanup());

  await promoteOfficialVariant({
    repoRoot: tempRepo.repoRoot,
    projectId: "designer-health",
    slideId: "slide-02",
    candidateSource: "canonical-variant",
    candidateId: "proof-tiles-legacy",
  });

  const deckSpec = await tempRepo.readDeckSpec();
  const slide02 = getSlide(deckSpec, "slide-02");

  assert.equal(slide02.selectedVariantId, "proof-tiles-legacy");
  assert.equal(slide02.paths.stampedDir, "projects/designer-health/slide-figures/slide-02");
  assert.equal(
    slide02.variants.find((variant) => variant.id === "proof-tiles-legacy")?.status,
    "selected"
  );
  assert.equal(
    slide02.variants.find((variant) => variant.id === "wait-times-shortage-banner-native")?.status,
    "option"
  );
});

test("promoting a discovered branch synthesizes or updates a canonical variant", async (t) => {
  const tempRepo = await setupTempRepo();
  t.after(async () => tempRepo.cleanup());

  await promoteOfficialVariant({
    repoRoot: tempRepo.repoRoot,
    projectId: "designer-health",
    slideId: "slide-11",
    candidateSource: "discovered-branch",
    candidateId:
      "projects/designer-health/slide-figures/slide-11/versions/version-000047--beachhead-profile-hero-v1/gemini-html",
  });

  const deckSpec = await tempRepo.readDeckSpec();
  const slide11 = getSlide(deckSpec, "slide-11");
  const promotedVariant = slide11.variants.find(
    (variant) => variant.id === "gemini-html"
  );

  assert.equal(slide11.selectedVariantId, "gemini-html");
  assert.equal(slide11.paths.stampedDir, "projects/designer-health/slide-figures/slide-11");
  assert.ok(promotedVariant);
  assert.equal(
    promotedVariant.previewPath,
    "projects/designer-health/slide-figures/slide-11/versions/version-000047--beachhead-profile-hero-v1/gemini-html/preview.png"
  );
  assert.ok(
    promotedVariant.files.some(
      (file) =>
        file.path ===
        "projects/designer-health/slide-figures/slide-11/versions/version-000047--beachhead-profile-hero-v1/gemini-html/generated.html"
    )
  );
});

test("promotion preserves surrounding deck-spec formatting outside the touched slide block", async (t) => {
  const tempRepo = await setupTempRepo();
  t.after(async () => tempRepo.cleanup());

  await promoteOfficialVariant({
    repoRoot: tempRepo.repoRoot,
    projectId: "designer-health",
    slideId: "slide-11",
    candidateSource: "discovered-branch",
    candidateId:
      "projects/designer-health/slide-figures/slide-11/versions/version-000047--beachhead-profile-hero-v1/gemini-html",
  });

  const deckSpecText = await tempRepo.readDeckSpecText();

  assert.match(
    deckSpecText,
    /"activeSequence": \[\s*"1",\s*"2",\s*"3",\s*"4",\s*"5",\s*"6",\s*"7",\s*"8",\s*"9",\s*"10",\s*"11",\s*"12"\s*\]/
  );
  assert.match(deckSpecText, /"importedSlides": \[\s*1\s*\]/);
  assert.match(deckSpecText, /"importedSlides": \[\s*11\s*\]/);
});

test("non-previewable or unsurfaced discovered branches are rejected", async (t) => {
  const tempRepo = await setupTempRepo();
  t.after(async () => tempRepo.cleanup());

  await assert.rejects(
    promoteOfficialVariant({
      repoRoot: tempRepo.repoRoot,
      projectId: "designer-health",
      slideId: "slide-11",
      candidateSource: "discovered-branch",
      candidateId: "projects/designer-health/slide-figures/slide-11/claude-ideation",
    }),
    /Promotion candidate/
  );
});

test("promotion ignores unrelated slides with malformed manifest-backed inputs", async (t) => {
  const tempRepo = await setupTempRepo();
  t.after(async () => tempRepo.cleanup());

  const deckSpec = await tempRepo.readDeckSpec();
  const unrelatedSlide = getSlide(deckSpec, "slide-01");
  unrelatedSlide.paths.assetsManifest = "projects/designer-health/bad-assets.json";
  await writeFile(resolve(tempRepo.projectRoot, "bad-assets.json"), "{not-json", "utf8");
  await writeFile(
    resolve(tempRepo.projectRoot, "deck-spec.json"),
    `${JSON.stringify(deckSpec, null, 2)}\n`,
    "utf8"
  );

  await promoteOfficialVariant({
    repoRoot: tempRepo.repoRoot,
    projectId: "designer-health",
    slideId: "slide-02",
    candidateSource: "canonical-variant",
    candidateId: "proof-tiles-legacy",
  });

  const nextDeckSpec = await tempRepo.readDeckSpec();
  assert.equal(getSlide(nextDeckSpec, "slide-02")?.selectedVariantId, "proof-tiles-legacy");
});
