import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import test from "node:test";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  bootstrapSlideFromRoot,
  createSlideVersion,
  getProjectedRootArtifactPaths,
  getSlideNotesDir,
  getSlideReportPath,
  getVersionRegistryPath,
  importSlideHtmlVersion,
  migrateProjectSlideVersions,
  normalizeSlideVersionCss,
  promoteSlideVersion,
  readReconciledSlideManifest,
  readSlideManifest,
  readVersionDoc,
} from "../lib/slide-versioning.mjs";
import { readJson } from "../lib/io.mjs";
import { getSharedCssHrefForHtml } from "../lib/shared-css.mjs";

const makeTempDir = async () => mkdtemp(join(tmpdir(), "ysn-slide-versioning-"));

const seedDesignSystem = async (projectRoot) => {
  const designSystemDir = resolve(projectRoot, "design-system");
  await mkdir(designSystemDir, { recursive: true });
  await writeFile(
    resolve(designSystemDir, "vox-shared.css"),
    [
      "@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap');",
      "",
      ":root {",
      "  --accent: #0f766e;",
      "}",
      "",
    ].join("\n"),
    "utf8"
  );
};

const seedRootPayload = async (slideDir) => {
  await mkdir(slideDir, { recursive: true });
  await writeFile(resolve(slideDir, "generated.html"), "<html>root</html>\n", "utf8");
  await writeFile(resolve(slideDir, "preview.png"), "root-preview", "utf8");
  await writeFile(resolve(slideDir, "meta.json"), JSON.stringify({ source: "root" }), "utf8");
  await writeFile(resolve(slideDir, "README.md"), "# Keep me\n", "utf8");
  await writeFile(resolve(slideDir, "report.html"), "<html>report</html>\n", "utf8");
};

test("bootstrapSlideFromRoot seeds a manifest-backed current version", async () => {
  const dir = await makeTempDir();
  const projectRoot = resolve(dir, "projects", "designer-health");
  const slideDir = resolve(projectRoot, "slide-figures", "slide-01");

  try {
    await seedRootPayload(slideDir);
    const manifest = await bootstrapSlideFromRoot({
      projectRoot,
      slideId: "slide-01",
      slideDir,
    });

    const currentVersionEntry = manifest.versions.find(
      (entry) => entry.id === manifest.currentVersionId
    );
    assert.ok(currentVersionEntry);
    assert.equal(manifest.currentVersionId, "version-000001");
    assert.equal(currentVersionEntry.status, "current");
    assert.equal(currentVersionEntry.sourceKind, "legacy-import");
    assert.equal(currentVersionEntry.baseVersionId, null);

    const registry = await readJson(getVersionRegistryPath(projectRoot));
    assert.equal(registry.nextVersionNumber, 2);
    assert.deepEqual(registry.versions["version-000001"], {
      slideId: "slide-01",
      dir: currentVersionEntry.dir,
    });

    const versionDir = resolve(currentVersionEntry.dir);
    assert.ok(existsSync(resolve(versionDir, "generated.html")));
    assert.ok(existsSync(resolve(versionDir, "preview.png")));
    assert.ok(existsSync(resolve(versionDir, "meta.json")));
    assert.ok(existsSync(resolve(versionDir, "version.json")));
    assert.equal(existsSync(resolve(slideDir, "generated.html")), false);
    assert.equal(existsSync(resolve(slideDir, "preview.png")), false);
    const rootArtifacts = getProjectedRootArtifactPaths({
      slideDir,
      slideDirName: "slide-01",
      versionId: manifest.currentVersionId,
    });
    assert.ok(existsSync(rootArtifacts.htmlPath));
    assert.ok(existsSync(rootArtifacts.pngPath));
    assert.ok(
      existsSync(
        resolve(
          getSlideNotesDir({ projectRoot, slideId: "slide-01", slideDir }),
          "README.md"
        )
      )
    );
    assert.ok(
      existsSync(
        getSlideReportPath({ projectRoot, slideId: "slide-01", slideDir })
      )
    );

    const versionDoc = await readVersionDoc(versionDir);
    assert.equal(versionDoc.id, "version-000001");
    assert.equal(versionDoc.status, "current");
    assert.equal(versionDoc.sourceKind, "legacy-import");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("createSlideVersion clones the current payload into a draft version", async () => {
  const dir = await makeTempDir();
  const projectRoot = resolve(dir, "projects", "designer-health");
  const slideDir = resolve(projectRoot, "slide-figures", "slide-02");

  try {
    await seedRootPayload(slideDir);
    await bootstrapSlideFromRoot({
      projectRoot,
      slideId: "slide-02",
      slideDir,
    });
    const currentVersionId = (
      await readSlideManifest({
        projectRoot,
        slideId: "slide-02",
        slideDir,
      })
    ).currentVersionId;

    const created = await createSlideVersion({
      projectRoot,
      slideId: "slide-02",
      slideDir,
      label: "slide-02-fine-tune",
      sourceKind: "fine-tune-draft",
      cloneCurrent: true,
    });

    assert.match(created.versionId, /^version-\d{6}$/);
    assert.match(
      created.versionDir,
      new RegExp(`${created.versionId}--slide-02-fine-tune$`)
    );
    assert.ok(existsSync(resolve(created.versionDir, "generated.html")));
    assert.ok(existsSync(resolve(created.versionDir, "preview.png")));
    assert.ok(existsSync(resolve(created.versionDir, "version.json")));

    const manifest = await readSlideManifest({
      projectRoot,
      slideId: "slide-02",
      slideDir,
    });
    const draftEntry = manifest.versions.find(
      (entry) => entry.id === created.versionId
    );
    assert.ok(draftEntry);
    assert.equal(manifest.currentVersionId, currentVersionId);
    assert.equal(draftEntry.status, "draft");
    assert.equal(draftEntry.baseVersionId, currentVersionId);

    await writeFile(
      resolve(created.versionDir, "generated.html"),
      "<html>draft</html>\n",
      "utf8"
    );
    await writeFile(resolve(created.versionDir, "new-asset.txt"), "draft asset", "utf8");

    const currentVersionDir = resolve(
      manifest.versions.find((entry) => entry.id === currentVersionId).dir
    );
    assert.equal(
      await readFile(resolve(currentVersionDir, "generated.html"), "utf8"),
      "<html>root</html>\n"
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("createSlideVersion records artifact-root provenance fields for new versions", async () => {
  const dir = await makeTempDir();
  const projectRoot = resolve(dir, "projects", "designer-health");
  const slideDir = resolve(projectRoot, "slide-figures", "slide-02");
  const sourcePath = resolve(
    homedir(),
    "designer-data",
    "runs",
    "designer-health",
    "20260403T1830Z-example",
    "manifest.json"
  );
  const sourceImagePath = resolve(
    homedir(),
    "designer-data",
    "runs",
    "designer-health",
    "20260403T1830Z-example",
    "outputs",
    "image-01.png"
  );

  try {
    await seedRootPayload(slideDir);
    await bootstrapSlideFromRoot({
      projectRoot,
      slideId: "slide-02",
      slideDir,
    });

    const created = await createSlideVersion({
      projectRoot,
      slideId: "slide-02",
      slideDir,
      label: "slide-02-imported-artifact",
      sourceKind: "generated-import",
      metadata: {
        sourcePath,
        sourceImagePath,
      },
    });

    assert.equal(
      created.versionDoc.artifactPath,
      "runs/designer-health/20260403T1830Z-example/manifest.json"
    );
    assert.equal(
      created.versionDoc.artifactImagePath,
      "runs/designer-health/20260403T1830Z-example/outputs/image-01.png"
    );
    assert.equal(created.versionDoc.sourcePath, sourcePath);
    assert.equal(created.versionDoc.sourceImagePath, sourceImagePath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("importSlideHtmlVersion writes operator HTML into a new version bundle", async () => {
  const dir = await makeTempDir();
  const projectRoot = resolve(dir, "projects", "designer-health");
  const slideDir = resolve(projectRoot, "slide-figures", "slide-08");
  const screenshotCalls = [];
  const refreshCalls = [];
  const html = [
    "<!doctype html>",
    "<html>",
    "<head>",
    "  <style>",
    "    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap');",
    "",
    "    :root {",
    "      --accent: #0f766e;",
    "    }",
    "",
    "    .local-only {",
    "      color: #123456;",
    "    }",
    "  </style>",
    "</head>",
    '<body><main class="local-only">operator snapshot</main></body>',
    "</html>",
    "",
  ].join("\n");

  try {
    await seedDesignSystem(projectRoot);
    await seedRootPayload(slideDir);
    await bootstrapSlideFromRoot({
      projectRoot,
      slideId: "slide-08",
      slideDir,
    });
    const currentVersionId = (
      await readSlideManifest({
        projectRoot,
        slideId: "slide-08",
        slideDir,
      })
    ).currentVersionId;

    const imported = await importSlideHtmlVersion({
      projectRoot,
      slideId: "slide-08",
      slideDir,
      labelHint: "market-opportunity-v1",
      html,
      screenshotImpl: async ({ inputPath, outputPath, width, height, fullPage }) => {
        screenshotCalls.push({ inputPath, outputPath, width, height, fullPage });
        await writeFile(outputPath, "preview", "utf8");
        return outputPath;
      },
      touchRefreshTokenImpl: async ({ repoRoot }) => {
        refreshCalls.push(repoRoot);
        return resolve(repoRoot, ".designer", "studio-refresh.token");
      },
    });

    assert.equal(await readFile(imported.sourceHtmlPath, "utf8"), html);
    const generatedHtml = await readFile(imported.generatedHtmlPath, "utf8");
    const expectedSharedCssHref = getSharedCssHrefForHtml({
      projectRoot,
      htmlAbsolutePath: imported.generatedHtmlPath,
    });
    assert.match(generatedHtml, /data-designer-shared-css="true"/);
    assert.ok(generatedHtml.includes(`href="${expectedSharedCssHref}"`));
    assert.match(generatedHtml, /\.local-only\s*\{/);
    assert.doesNotMatch(generatedHtml, /:root\s*\{\s*--accent:\s*#0f766e;/);
    assert.deepEqual(screenshotCalls, [
      {
        inputPath: imported.generatedHtmlPath,
        outputPath: resolve(imported.versionDir, "preview.png"),
        width: 1920,
        height: 1080,
        fullPage: false,
      },
    ]);
    assert.deepEqual(refreshCalls, [resolve(projectRoot, "..", "..")]);

    const manifest = await readSlideManifest({
      projectRoot,
      slideId: "slide-08",
      slideDir,
    });
    const importedEntry = manifest.versions.find((entry) => entry.id === imported.versionId);
    assert.ok(importedEntry);
    assert.equal(manifest.currentVersionId, currentVersionId);
    assert.equal(importedEntry.status, "draft");
    assert.equal(importedEntry.baseVersionId, currentVersionId);
    assert.equal(importedEntry.sourceKind, "user-html-snapshot");

    const versionDoc = await readVersionDoc(imported.versionDir);
    assert.equal(versionDoc.mode, "shared-css");
    assert.equal(versionDoc.baseVersionId, currentVersionId);
    assert.equal(versionDoc.label, "slide-08-user-html-market-opportunity-v1");
    assert.equal(
      versionDoc.sharedCssPath,
      resolve(projectRoot, "design-system", "vox-shared.css")
    );
    assert.equal(versionDoc.sourceHtmlPath, imported.sourceHtmlPath);
    assert.equal(Object.prototype.hasOwnProperty.call(versionDoc, "artifactPath"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(versionDoc, "artifactImagePath"), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("normalizeSlideVersionCss creates a shared-css draft without rewriting the source version", async () => {
  const dir = await makeTempDir();
  const projectRoot = resolve(dir, "projects", "designer-health");
  const slideDir = resolve(projectRoot, "slide-figures", "slide-09");
  const screenshotCalls = [];
  const refreshCalls = [];

  try {
    await seedDesignSystem(projectRoot);
    await seedRootPayload(slideDir);
    await bootstrapSlideFromRoot({
      projectRoot,
      slideId: "slide-09",
      slideDir,
    });
    const sourceDraft = await createSlideVersion({
      projectRoot,
      slideId: "slide-09",
      slideDir,
      label: "slide-09-legacy-html",
      sourceKind: "fine-tune-draft",
      cloneCurrent: true,
    });
    const sourceHtml = [
      "<!doctype html>",
      "<html>",
      "<head>",
      "  <style>",
      "    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap');",
      "",
      "    :root {",
      "      --accent: #0f766e;",
      "    }",
      "",
      "    .legacy-only {",
      "      letter-spacing: 0.02em;",
      "    }",
      "  </style>",
      "</head>",
      '<body><main class="legacy-only">legacy version</main></body>',
      "</html>",
      "",
    ].join("\n");
    await writeFile(resolve(sourceDraft.versionDir, "generated.html"), sourceHtml, "utf8");

    const normalized = await normalizeSlideVersionCss({
      projectRoot,
      slideId: "slide-09",
      slideDir,
      versionId: sourceDraft.versionId,
      screenshotImpl: async ({ inputPath, outputPath, width, height, fullPage }) => {
        screenshotCalls.push({ inputPath, outputPath, width, height, fullPage });
        await writeFile(outputPath, "preview", "utf8");
        return outputPath;
      },
      touchRefreshTokenImpl: async ({ repoRoot }) => {
        refreshCalls.push(repoRoot);
        return resolve(repoRoot, ".designer", "studio-refresh.token");
      },
    });

    assert.equal(await readFile(resolve(sourceDraft.versionDir, "generated.html"), "utf8"), sourceHtml);
    assert.equal(await readFile(normalized.sourceHtmlPath, "utf8"), sourceHtml);
    const generatedHtml = await readFile(normalized.generatedHtmlPath, "utf8");
    assert.match(generatedHtml, /data-designer-shared-css="true"/);
    assert.match(generatedHtml, /\.legacy-only\s*\{/);
    assert.doesNotMatch(generatedHtml, /:root\s*\{\s*--accent:\s*#0f766e;/);
    assert.deepEqual(screenshotCalls, [
      {
        inputPath: normalized.generatedHtmlPath,
        outputPath: resolve(normalized.versionDir, "preview.png"),
        width: 1920,
        height: 1080,
        fullPage: false,
      },
    ]);
    assert.deepEqual(refreshCalls, [resolve(projectRoot, "..", "..")]);

    const sourceVersionDoc = await readVersionDoc(sourceDraft.versionDir);
    const normalizedVersionDoc = await readVersionDoc(normalized.versionDir);
    assert.equal(sourceVersionDoc.mode ?? null, null);
    assert.equal(normalizedVersionDoc.mode, "shared-css");
    assert.equal(normalizedVersionDoc.baseVersionId, sourceDraft.versionId);
    assert.equal(normalizedVersionDoc.sourceHtmlPath, normalized.sourceHtmlPath);
    assert.equal(
      normalizedVersionDoc.sharedCssPath,
      resolve(projectRoot, "design-system", "vox-shared.css")
    );

    const manifest = await readSlideManifest({
      projectRoot,
      slideId: "slide-09",
      slideDir,
    });
    const sourceEntry = manifest.versions.find((entry) => entry.id === sourceDraft.versionId);
    const normalizedEntry = manifest.versions.find((entry) => entry.id === normalized.versionId);
    assert.ok(sourceEntry);
    assert.ok(normalizedEntry);
    assert.equal(normalizedEntry.status, "draft");
    assert.equal(normalizedEntry.baseVersionId, sourceDraft.versionId);
    assert.equal(normalizedEntry.mode, "shared-css");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("copied on-disk version bundles are reconciled and advance next version ids", async () => {
  const dir = await makeTempDir();
  const projectRoot = resolve(dir, "projects", "designer-health");
  const slideDir = resolve(projectRoot, "slide-figures", "slide-06-quality-bar");

  try {
    await seedRootPayload(slideDir);
    await bootstrapSlideFromRoot({
      projectRoot,
      slideId: "slide-06",
      slideDir,
    });

    const copiedVersionDir = resolve(
      slideDir,
      "versions",
      "version-000010--manual-copy"
    );
    await mkdir(copiedVersionDir, { recursive: true });
    await writeFile(resolve(copiedVersionDir, "generated.html"), "<html>copied</html>\n", "utf8");
    await writeFile(resolve(copiedVersionDir, "preview.png"), "copied-preview", "utf8");
    await writeFile(
      resolve(copiedVersionDir, "version.json"),
      JSON.stringify(
        {
          id: "version-000001",
          slideId: "slide-06",
          slideDir: "projects/designer-health/slide-figures/slide-06-quality-bar",
          dir: "projects/designer-health/slide-figures/slide-06-quality-bar/versions/version-000001--slide-06-root",
          label: "stale-copy",
          status: "draft",
          sourceKind: "fine-tune-draft",
        },
        null,
        2
      ),
      "utf8"
    );

    const reconciledManifest = await readReconciledSlideManifest({
      projectRoot,
      slideId: "slide-06",
      slideDir,
    });
    const reconciledEntry = reconciledManifest.versions.find(
      (entry) => entry.id === "version-000010"
    );
    assert.ok(reconciledEntry);
    assert.match(
      reconciledEntry.dir,
      /slide-06-quality-bar\/versions\/version-000010--manual-copy$/
    );

    const created = await createSlideVersion({
      projectRoot,
      slideId: "slide-06",
      slideDir,
      label: "slide-06-next-draft",
      sourceKind: "fine-tune-draft",
      cloneCurrent: true,
    });

    assert.equal(created.versionId, "version-000011");

    const registry = await readJson(getVersionRegistryPath(projectRoot));
    assert.equal(registry.nextVersionNumber, 12);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("promoteSlideVersion copies the chosen version to the slide root", async () => {
  const dir = await makeTempDir();
  const projectRoot = resolve(dir, "projects", "designer-health");
  const slideDir = resolve(projectRoot, "slide-figures", "slide-03");

  try {
    await seedRootPayload(slideDir);
    await bootstrapSlideFromRoot({
      projectRoot,
      slideId: "slide-03",
      slideDir,
    });
    const currentVersionId = (
      await readSlideManifest({
        projectRoot,
        slideId: "slide-03",
        slideDir,
      })
    ).currentVersionId;

    const draft = await createSlideVersion({
      projectRoot,
      slideId: "slide-03",
      slideDir,
      label: "slide-03-fine-tune",
      sourceKind: "fine-tune-draft",
      cloneCurrent: true,
    });

    await writeFile(
      resolve(draft.versionDir, "generated.html"),
      "<html><body><img src=\"figure.png\" /></body></html>\n",
      "utf8"
    );
    await writeFile(
      resolve(draft.versionDir, "figure.svg"),
      "<svg><image href=\"figure.png\" /></svg>\n",
      "utf8"
    );
    await writeFile(resolve(draft.versionDir, "new-asset.txt"), "promoted asset", "utf8");

    const promoted = await promoteSlideVersion({
      projectRoot,
      slideId: "slide-03",
      slideDir,
      versionId: draft.versionId,
    });

    assert.equal(promoted.versionId, draft.versionId);
    assert.equal(existsSync(resolve(slideDir, "generated.html")), false);
    assert.equal(existsSync(resolve(slideDir, "new-asset.txt")), false);
    const rootArtifacts = getProjectedRootArtifactPaths({
      slideDir,
      slideDirName: "slide-03",
      versionId: draft.versionId,
    });
    assert.ok(existsSync(rootArtifacts.htmlPath));
    assert.ok(existsSync(rootArtifacts.pngPath));
    assert.ok(existsSync(rootArtifacts.svgPath));
    assert.equal(
      await readFile(rootArtifacts.htmlPath, "utf8"),
      `<html><body><img src="${rootArtifacts.pngPath.split("/").pop()}" /></body></html>\n`
    );
    assert.equal(
      await readFile(rootArtifacts.svgPath, "utf8"),
      `<svg><image href="${rootArtifacts.pngPath.split("/").pop()}" /></svg>\n`
    );

    const manifest = await readSlideManifest({
      projectRoot,
      slideId: "slide-03",
      slideDir,
    });
    assert.equal(manifest.currentVersionId, draft.versionId);
    assert.equal(
      manifest.versions.find((entry) => entry.id === draft.versionId).status,
      "current"
    );
    assert.equal(
      manifest.versions.find((entry) => entry.id === currentVersionId).status,
      "archived"
    );

    const promotedDoc = await readVersionDoc(draft.versionDir);
    assert.equal(promotedDoc.status, "current");
    const archivedDoc = await readVersionDoc(
      resolve(manifest.versions.find((entry) => entry.id === currentVersionId).dir)
    );
    assert.equal(archivedDoc.status, "archived");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("promoteSlideVersion rewrites shared CSS hrefs for projected slide-root HTML", async () => {
  const dir = await makeTempDir();
  const projectRoot = resolve(dir, "projects", "designer-health");
  const slideDir = resolve(projectRoot, "slide-figures", "slide-04");

  try {
    await seedDesignSystem(projectRoot);
    await seedRootPayload(slideDir);
    await bootstrapSlideFromRoot({
      projectRoot,
      slideId: "slide-04",
      slideDir,
    });

    const imported = await importSlideHtmlVersion({
      projectRoot,
      slideId: "slide-04",
      slideDir,
      label: "slide-04-shared-css-seed",
      html: "<!doctype html><html><body>shared css seed</body></html>\n",
      screenshotImpl: async ({ outputPath }) => {
        await writeFile(outputPath, "preview", "utf8");
        return outputPath;
      },
      touchRefreshTokenImpl: async () => null,
    });

    await promoteSlideVersion({
      projectRoot,
      slideId: "slide-04",
      slideDir,
      versionId: imported.versionId,
    });

    const rootArtifacts = getProjectedRootArtifactPaths({
      slideDir,
      slideDirName: "slide-04",
      versionId: imported.versionId,
    });
    const projectedHtml = await readFile(rootArtifacts.htmlPath, "utf8");
    const expectedHref = getSharedCssHrefForHtml({
      projectRoot,
      htmlAbsolutePath: rootArtifacts.htmlPath,
    });

    assert.ok(projectedHtml.includes(`href="${expectedHref}"`));
    assert.doesNotMatch(projectedHtml, /href="\.\.\/\.\.\/\.\.\/\.\.\/design-system\/vox-shared\.css"/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("promoteSlideVersion is a no-op when the requested version is already current", async () => {
  const dir = await makeTempDir();
  const projectRoot = resolve(dir, "projects", "designer-health");
  const slideDir = resolve(projectRoot, "slide-figures", "slide-03");

  try {
    await seedRootPayload(slideDir);
    const manifest = await bootstrapSlideFromRoot({
      projectRoot,
      slideId: "slide-03",
      slideDir,
    });
    const currentVersionId = manifest.currentVersionId;
    const draft = await createSlideVersion({
      projectRoot,
      slideId: "slide-03",
      slideDir,
      label: "slide-03-fine-tune",
      sourceKind: "fine-tune-draft",
      cloneCurrent: true,
    });

    const promoted = await promoteSlideVersion({
      projectRoot,
      slideId: "slide-03",
      slideDir,
      versionId: currentVersionId,
    });

    assert.equal(promoted.versionId, currentVersionId);

    const nextManifest = await readSlideManifest({
      projectRoot,
      slideId: "slide-03",
      slideDir,
    });
    assert.equal(nextManifest.currentVersionId, currentVersionId);
    assert.equal(
      nextManifest.versions.find((entry) => entry.id === currentVersionId)?.status,
      "current"
    );
    assert.equal(
      nextManifest.versions.find((entry) => entry.id === draft.versionId)?.status,
      "draft"
    );

    const currentDoc = await readVersionDoc(
      resolve(nextManifest.versions.find((entry) => entry.id === currentVersionId).dir)
    );
    assert.equal(currentDoc.status, "current");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("migrateProjectSlideVersions imports legacy layouts and rewrites deck spec paths", async () => {
  const dir = await makeTempDir();
  const projectRoot = resolve(dir, "projects", "designer-health");
  const slideFiguresRoot = resolve(projectRoot, "slide-figures");
  const slide01Dir = resolve(slideFiguresRoot, "slide-01");
  const slide02Dir = resolve(slideFiguresRoot, "slide-02");
  const slide03Dir = resolve(slideFiguresRoot, "slide-03");

  try {
    await mkdir(resolve(slide01Dir, "gemini-html", "tune", "run-20260331", "attempt-01"), {
      recursive: true,
    });
    await mkdir(resolve(slide01Dir, "gemini-image"), { recursive: true });
    await writeFile(resolve(slide01Dir, "README.md"), "# Slide 01\n", "utf8");
    await writeFile(resolve(slide01Dir, "report.html"), "<html>report</html>\n", "utf8");
    await writeFile(resolve(slide01Dir, "figure.png"), "png-01", "utf8");
    await writeFile(
      resolve(slide01Dir, "gemini-html", "generated.html"),
      "<html>slide-01</html>\n",
      "utf8"
    );
    await writeFile(resolve(slide01Dir, "gemini-html", "preview.png"), "preview-01", "utf8");
    await writeFile(resolve(slide01Dir, "gemini-image", "image-01.jpg"), "image-01", "utf8");
    await writeFile(
      resolve(slide01Dir, "gemini-html", "tune", "run-20260331", "attempt-01", "generated.html"),
      "<html>attempt-01</html>\n",
      "utf8"
    );

    await mkdir(resolve(slide02Dir, "variants", "option-a", "gemini-html"), {
      recursive: true,
    });
    await mkdir(resolve(slide02Dir, "variants", "option-b", "gemini-html"), {
      recursive: true,
    });
    await writeFile(resolve(slide02Dir, "README.md"), "# Slide 02\n", "utf8");
    await writeFile(
      resolve(slide02Dir, "variants", "option-a", "gemini-html", "preview.png"),
      "option-a",
      "utf8"
    );
    await writeFile(
      resolve(slide02Dir, "variants", "option-b", "gemini-html", "preview.png"),
      "option-b",
      "utf8"
    );

    await mkdir(resolve(slide03Dir, "hero-v1", "gemini-html"), { recursive: true });
    await mkdir(resolve(slide03Dir, "waterfall-v1", "gemini-html"), {
      recursive: true,
    });
    await writeFile(resolve(slide03Dir, "README.md"), "# Slide 03\n", "utf8");
    await writeFile(
      resolve(slide03Dir, "hero-v1", "gemini-html", "preview.png"),
      "hero-v1",
      "utf8"
    );
    await writeFile(
      resolve(slide03Dir, "waterfall-v1", "gemini-html", "preview.png"),
      "waterfall-v1",
      "utf8"
    );

    await writeFile(
      resolve(projectRoot, "deck-spec.json"),
      JSON.stringify(
        {
          slides: [
            {
              id: "slide-01",
              paths: {
                stampedDir: slide01Dir,
              },
              selectedVariantId: "current-root",
              variants: [
                {
                  id: "current-root",
                  previewPath: resolve(slide01Dir, "figure.png"),
                  files: [
                    {
                      label: "Current root",
                      path: slide01Dir,
                    },
                    {
                      label: "Slide report",
                      path: resolve(slide01Dir, "report.html"),
                    },
                  ],
                },
              ],
            },
            {
              id: "slide-02",
              paths: {
                stampedDir: slide02Dir,
              },
              selectedVariantId: "option-a",
              variants: [
                {
                  id: "option-a",
                  previewPath: resolve(
                    slide02Dir,
                    "variants",
                    "option-a",
                    "gemini-html",
                    "preview.png"
                  ),
                  files: [
                    {
                      label: "Option A",
                      path: resolve(slide02Dir, "variants", "option-a"),
                    },
                  ],
                },
              ],
            },
            {
              id: "slide-03",
              paths: {
                stampedDir: slide03Dir,
              },
              selectedVariantId: "hero-v1",
              variants: [
                {
                  id: "hero-v1",
                  previewPath: resolve(slide03Dir, "hero-v1", "gemini-html", "preview.png"),
                  files: [
                    {
                      label: "Hero",
                      path: resolve(slide03Dir, "hero-v1"),
                    },
                  ],
                },
              ],
            },
          ],
        },
        null,
        2
      ),
      "utf8"
    );

    const result = await migrateProjectSlideVersions({ projectRoot });
    assert.equal(result.ok, true);

    const slide01Manifest = await readSlideManifest({
      projectRoot,
      slideId: "slide-01",
      slideDir: slide01Dir,
    });
    assert.ok(slide01Manifest.currentVersionId);
    assert.equal(slide01Manifest.versions.length, 2);
    const slide01Current = slide01Manifest.versions.find(
      (entry) => entry.id === slide01Manifest.currentVersionId
    );
    const slide01Tune = slide01Manifest.versions.find(
      (entry) => entry.sourceKind === "gemini-html-tune"
    );
    assert.equal(slide01Current.sourceKind, "legacy-import");
    assert.ok(slide01Tune);
    const slide01RootArtifacts = getProjectedRootArtifactPaths({
      slideDir: slide01Dir,
      slideDirName: "slide-01",
      versionId: slide01Manifest.currentVersionId,
    });
    assert.ok(existsSync(slide01RootArtifacts.pngPath));
    assert.ok(existsSync(slide01RootArtifacts.htmlPath));
    assert.equal(existsSync(resolve(slide01Dir, "gemini-html", "generated.html")), false);
    assert.equal(existsSync(resolve(slide01Dir, "gemini-html", "tune")), false);
    assert.ok(
      existsSync(
        resolve(
          getSlideNotesDir({ projectRoot, slideId: "slide-01", slideDir: slide01Dir }),
          "README.md"
        )
      )
    );
    assert.ok(
      existsSync(
        getSlideReportPath({ projectRoot, slideId: "slide-01", slideDir: slide01Dir })
      )
    );

    const slide02Manifest = await readSlideManifest({
      projectRoot,
      slideId: "slide-02",
      slideDir: slide02Dir,
    });
    assert.equal(slide02Manifest.currentVersionId, null);
    assert.equal(slide02Manifest.versions.length, 2);
    assert.deepEqual(
      slide02Manifest.versions.map((entry) => entry.status),
      ["archived", "archived"]
    );

    const slide03Manifest = await readSlideManifest({
      projectRoot,
      slideId: "slide-03",
      slideDir: slide03Dir,
    });
    assert.equal(slide03Manifest.currentVersionId, null);
    assert.equal(slide03Manifest.versions.length, 2);
    assert.deepEqual(
      slide03Manifest.versions.map((entry) => entry.status),
      ["archived", "archived"]
    );

    const registry = await readJson(getVersionRegistryPath(projectRoot));
    assert.equal(registry.nextVersionNumber, 7);

    const deckSpec = await readJson(resolve(projectRoot, "deck-spec.json"));
    assert.match(
      deckSpec.slides[0].variants[0].previewPath,
      new RegExp(`${slide01Manifest.currentVersionId}--slide-01/figure\\.png$`)
    );
    assert.equal(
      deckSpec.slides[0].variants[0].files[1].path,
      getSlideReportPath({ projectRoot, slideId: "slide-01", slideDir: slide01Dir })
    );
    const slide02OptionA = slide02Manifest.versions.find(
      (entry) => entry.label === "option-a"
    );
    assert.match(
      deckSpec.slides[1].variants[0].previewPath,
      new RegExp(`${slide02OptionA.id}--option-a/gemini-html/preview\\.png$`)
    );
    const slide03Hero = slide03Manifest.versions.find((entry) => entry.label === "hero-v1");
    assert.match(
      deckSpec.slides[2].variants[0].files[0].path,
      new RegExp(`${slide03Hero.id}--hero-v1$`)
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
