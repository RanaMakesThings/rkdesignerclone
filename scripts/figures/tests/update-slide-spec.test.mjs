import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import { updateSlideSpecText } from "../../../lib/repo/index.mjs";

const sourceRepoRoot = process.cwd();
const sourceProjectRoot = resolve(sourceRepoRoot, "projects", "designer-health");

const setupTempRepo = async () => {
  const repoRoot = await mkdtemp(resolve(tmpdir(), "designer-slide-spec-"));
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

test("updating a slide spec writes normalized markdown into deck-spec", async (t) => {
  const tempRepo = await setupTempRepo();
  t.after(async () => tempRepo.cleanup());

  await updateSlideSpecText({
    repoRoot: tempRepo.repoRoot,
    projectId: "designer-health",
    slideId: "slide-02",
    specText: "\n## Fresh spec\r\n\r\n- tighter claim\r\n- cleaner proof\r\n",
  });

  const deckSpec = await tempRepo.readDeckSpec();
  const slide02 = getSlide(deckSpec, "slide-02");

  assert.equal(slide02.specText, "## Fresh spec\n\n- tighter claim\n- cleaner proof");
  assert.equal(
    slide02.paths.stampedDir,
    "projects/designer-health/slide-figures/slide-02"
  );
});

test("updating a slide spec preserves surrounding deck-spec formatting", async (t) => {
  const tempRepo = await setupTempRepo();
  t.after(async () => tempRepo.cleanup());

  await updateSlideSpecText({
    repoRoot: tempRepo.repoRoot,
    projectId: "designer-health",
    slideId: "slide-11",
    specText: "### Updated read\n\nA tighter beachhead story.",
  });

  const deckSpecText = await tempRepo.readDeckSpecText();

  assert.match(
    deckSpecText,
    /"activeSequence": \[\s*"1",\s*"2",\s*"3",\s*"4",\s*"5",\s*"6",\s*"7",\s*"8",\s*"9",\s*"10",\s*"11",\s*"12"\s*\]/
  );
  assert.match(deckSpecText, /"importedSlides": \[\s*1\s*\]/);
  assert.match(deckSpecText, /"specText": "### Updated read\\n\\nA tighter beachhead story\."/);
});

test("updating a slide spec refreshes the studio token surface", async (t) => {
  const tempRepo = await setupTempRepo();
  t.after(async () => tempRepo.cleanup());

  await updateSlideSpecText({
    repoRoot: tempRepo.repoRoot,
    projectId: "designer-health",
    slideId: "slide-03",
    specText: "### Saved from Studio",
  });

  const refreshTokenPath = resolve(tempRepo.repoRoot, ".designer", "studio-refresh.token");
  const refreshTokenStats = await stat(refreshTokenPath);

  assert.ok(refreshTokenStats.isFile());
});
