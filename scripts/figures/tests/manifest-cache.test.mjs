import assert from "node:assert/strict";
import { cp, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import {
  getProjectManifest,
  touchProjectManifestRefreshToken,
} from "../../../lib/repo/index.mjs";

const sourceRepoRoot = process.cwd();
const sourceProjectRoot = resolve(sourceRepoRoot, "projects", "designer-health");

const setupTempRepo = async () => {
  const repoRoot = await mkdtemp(resolve(tmpdir(), "designer-manifest-cache-"));
  const projectRoot = resolve(repoRoot, "projects", "designer-health");
  await cp(sourceProjectRoot, projectRoot, { recursive: true });
  return {
    repoRoot,
    projectRoot,
    async cleanup() {
      await rm(repoRoot, { recursive: true, force: true });
    },
  };
};

const getSlide = (manifest, slideId) => manifest.slides.find((slide) => slide.id === slideId);

test("refresh token invalidates cached manifest for discovered artifact changes", async (t) => {
  const tempRepo = await setupTempRepo();
  t.after(async () => tempRepo.cleanup());

  const before = await getProjectManifest({
    repoRoot: tempRepo.repoRoot,
    projectId: "designer-health",
  });
  assert.ok(
    !getSlide(before, "slide-11").promotionCandidates.some(
      (candidate) => candidate.derivedVariantId === "refresh-token-branch"
    )
  );

  const branchDir = resolve(
    tempRepo.projectRoot,
    "slide-figures",
    "slide-11",
    "refresh-token-branch",
    "gemini-html"
  );
  await mkdir(branchDir, { recursive: true });
  await writeFile(resolve(branchDir, "preview.png"), "not-a-real-png", "utf8");
  await writeFile(resolve(branchDir, "generated.html"), "<html></html>", "utf8");

  const stillCached = await getProjectManifest({
    repoRoot: tempRepo.repoRoot,
    projectId: "designer-health",
  });
  assert.ok(
    !getSlide(stillCached, "slide-11").promotionCandidates.some(
      (candidate) => candidate.derivedVariantId === "refresh-token-branch"
    )
  );

  await touchProjectManifestRefreshToken({ repoRoot: tempRepo.repoRoot });

  const refreshed = await getProjectManifest({
    repoRoot: tempRepo.repoRoot,
    projectId: "designer-health",
  });
  assert.ok(
    getSlide(refreshed, "slide-11").promotionCandidates.some(
      (candidate) => candidate.derivedVariantId === "refresh-token-branch"
    )
  );
});
