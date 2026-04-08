import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import test from "node:test";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { prepareDesignerSlideFineTune } from "../../designer/slide-fine-tune-prep-lib.mjs";
import { readJson } from "../lib/io.mjs";
import {
  createSlideVersion,
  getProjectedRootArtifactPaths,
  getSlideNotesDir,
  getSlideReportPath,
  promoteSlideVersion,
} from "../lib/slide-versioning.mjs";

const makeTempDir = async () => mkdtemp(join(tmpdir(), "ysn-slide-prep-"));

test("prepareDesignerSlideFineTune reuses a fresh preview and scaffolds the change file", async () => {
  const dir = await makeTempDir();
  const projectRoot = resolve(dir, "projects", "designer-health");
  const stampedDir = resolve(projectRoot, "slide-figures", "slide-03");
  let screenshotCalls = 0;

  try {
    await mkdir(projectRoot, { recursive: true });
    await mkdir(stampedDir, { recursive: true });
    await writeFile(
      resolve(projectRoot, "deck-spec.json"),
      JSON.stringify(
        {
          slides: [
            {
              id: "slide-03",
              title: "More efficient visits will increase supply",
              header: "More efficient visits will increase supply.",
              selectedDirection: "Compound ribbon before/after.",
              paths: {
                stampedDir,
              },
            },
          ],
        },
        null,
        2
      ),
      "utf8"
    );
    await writeFile(resolve(stampedDir, "report.html"), "<html></html>\n", "utf8");
    await writeFile(resolve(stampedDir, "README.md"), "# Slide 03\n", "utf8");
    await writeFile(resolve(stampedDir, "figure.png"), "png", "utf8");

    const selected = await createSlideVersion({
      projectRoot,
      slideId: "slide-03",
      slideDir: stampedDir,
      label: "slide-03-selected",
      sourceKind: "legacy-import",
    });
    const geminiHtmlDir = resolve(selected.versionDir, "gemini-html");
    await mkdir(geminiHtmlDir, { recursive: true });
    await writeFile(
      resolve(geminiHtmlDir, "generated.html"),
      "<!doctype html><html><body>slide 3</body></html>\n",
      "utf8"
    );
    await writeFile(resolve(geminiHtmlDir, "preview.png"), "preview", "utf8");
    await promoteSlideVersion({
      projectRoot,
      slideId: "slide-03",
      slideDir: stampedDir,
      versionId: selected.versionId,
    });

    const result = await prepareDesignerSlideFineTune({
      slide: "3",
      projectRoot,
      screenshotImpl: async ({ inputPath, outputPath }) => {
        screenshotCalls += 1;
        await writeFile(outputPath, `preview:${inputPath}`, "utf8");
      },
    });

    assert.equal(result.slideId, "slide-03");
    assert.equal(result.currentVersionId, selected.versionId);
    assert.match(result.draftVersionId, /^version-\d{6}$/);
    assert.notEqual(result.draftVersionId, result.currentVersionId);
    assert.equal(
      result.draftVersionDir,
      resolve(
        stampedDir,
        "versions",
        `${result.draftVersionId}--slide-03-fine-tune`
      )
    );
    assert.equal(
      result.geminiHtmlPath,
      resolve(result.draftVersionDir, "gemini-html", "generated.html")
    );
    assert.equal(
      result.geminiPreviewPath,
      resolve(result.draftVersionDir, "gemini-html", "preview.png")
    );
    assert.equal(
      result.reportPath,
      getSlideReportPath({ projectRoot, slideId: "slide-03", slideDir: stampedDir })
    );
    assert.equal(
      result.readmePath,
      resolve(
        getSlideNotesDir({ projectRoot, slideId: "slide-03", slideDir: stampedDir }),
        "README.md"
      )
    );
    assert.equal(
      result.figurePngPath,
      getProjectedRootArtifactPaths({
        slideDir: stampedDir,
        slideDirName: "slide-03",
        versionId: selected.versionId,
      }).pngPath
    );
    assert.ok(existsSync(result.geminiPreviewPath));
    assert.ok(existsSync(result.changeFilePath));
    assert.equal(screenshotCalls, 0);
    assert.match(result.preferredEditSurface, /gemini-html micro-pass|native\/spec rerender/);

    const manifest = await readJson(resolve(stampedDir, "manifest.json"));
    assert.equal(manifest.currentVersionId, selected.versionId);
    assert.equal(manifest.versions.length, 2);
    assert.equal(manifest.versions.find((entry) => entry.id === result.draftVersionId).status, "draft");

    const changeFile = await readFile(result.changeFilePath, "utf8");
    assert.match(changeFile, /## Requested change/);
    assert.match(changeFile, /## Success checks/);
    assert.match(changeFile, /## Guardrails/);
    assert.match(changeFile, new RegExp(`current version id: ${selected.versionId}`));
    assert.match(changeFile, new RegExp(`draft version id: ${result.draftVersionId}`));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("prepareDesignerSlideFineTune refreshes preview when the draft copy is missing one", async () => {
  const dir = await makeTempDir();
  const projectRoot = resolve(dir, "projects", "designer-health");
  const stampedDir = resolve(projectRoot, "slide-figures", "slide-03");
  let screenshotCalls = 0;

  try {
    await mkdir(projectRoot, { recursive: true });
    await mkdir(stampedDir, { recursive: true });
    await writeFile(
      resolve(projectRoot, "deck-spec.json"),
      JSON.stringify(
        {
          slides: [
            {
              id: "slide-03",
              title: "More efficient visits will increase supply",
              header: "More efficient visits will increase supply.",
              selectedDirection: "Compound ribbon before/after.",
              paths: {
                stampedDir,
              },
            },
          ],
        },
        null,
        2
      ),
      "utf8"
    );
    await writeFile(resolve(stampedDir, "report.html"), "<html></html>\n", "utf8");
    await writeFile(resolve(stampedDir, "README.md"), "# Slide 03\n", "utf8");
    await writeFile(resolve(stampedDir, "figure.png"), "png", "utf8");

    const selected = await createSlideVersion({
      projectRoot,
      slideId: "slide-03",
      slideDir: stampedDir,
      label: "slide-03-selected",
      sourceKind: "legacy-import",
    });
    const geminiHtmlDir = resolve(selected.versionDir, "gemini-html");
    await mkdir(geminiHtmlDir, { recursive: true });
    await writeFile(
      resolve(geminiHtmlDir, "generated.html"),
      "<!doctype html><html><body>slide 3</body></html>\n",
      "utf8"
    );
    await promoteSlideVersion({
      projectRoot,
      slideId: "slide-03",
      slideDir: stampedDir,
      versionId: selected.versionId,
    });

    const result = await prepareDesignerSlideFineTune({
      slide: "3",
      projectRoot,
      screenshotImpl: async ({ inputPath, outputPath }) => {
        screenshotCalls += 1;
        await writeFile(outputPath, `preview:${inputPath}`, "utf8");
      },
    });

    assert.equal(screenshotCalls, 1);
    assert.equal(
      await readFile(result.geminiPreviewPath, "utf8"),
      `preview:${result.geminiHtmlPath}`
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("prepareDesignerSlideFineTune resolves the current public slide number via deck-spec", async () => {
  const dir = await makeTempDir();
  const projectRoot = resolve(dir, "projects", "designer-health");
  const stampedDir = resolve(projectRoot, "slide-figures", "slide-05");

  try {
    await mkdir(projectRoot, { recursive: true });
    await mkdir(stampedDir, { recursive: true });
    await writeFile(
      resolve(projectRoot, "deck-spec.json"),
      JSON.stringify(
        {
          slides: [
            {
              id: "slide-05",
              displayNumber: "4",
              status: "active",
              title: "History is the cleanest place to reclaim minutes",
              header: "History is the cleanest place to reclaim minutes.",
              selectedDirection: "History wedge.",
              paths: {
                stampedDir,
              },
            },
            {
              id: "slide-04",
              displayNumber: "4 (retired)",
              status: "deprecated",
              title: "Visits start with story, not structure",
              header: "Visits start with story, not structure.",
              paths: {
                stampedDir: resolve(projectRoot, "slide-figures", "slide-04"),
              },
            },
          ],
        },
        null,
        2
      ),
      "utf8"
    );
    await writeFile(resolve(stampedDir, "report.html"), "<html></html>\n", "utf8");
    await writeFile(resolve(stampedDir, "README.md"), "# Slide 05\n", "utf8");
    await writeFile(resolve(stampedDir, "figure.png"), "png", "utf8");

    const selected = await createSlideVersion({
      projectRoot,
      slideId: "slide-05",
      slideDir: stampedDir,
      label: "slide-05-selected",
      sourceKind: "legacy-import",
    });
    await promoteSlideVersion({
      projectRoot,
      slideId: "slide-05",
      slideDir: stampedDir,
      versionId: selected.versionId,
    });

    const result = await prepareDesignerSlideFineTune({
      slide: "4",
      projectRoot,
      screenshotImpl: async ({ outputPath }) => {
        await writeFile(outputPath, "preview", "utf8");
      },
    });

    assert.equal(result.slideId, "slide-05");
    assert.equal(result.stampedDir, stampedDir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
