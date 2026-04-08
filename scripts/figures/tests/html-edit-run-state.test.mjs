import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import test from "node:test";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  createInitialHtmlEditRunState,
  ensureHtmlEditRunSkeleton,
  getHtmlEditRunPaths,
  loadHtmlEditRunState,
  writeHtmlEditRunState,
} from "../../llm/private/html-edit-run-state.mjs";
import { loadHtmlChangeRequest } from "../../llm/private/html-change-request.mjs";

const makeTempDir = async () => mkdtemp(join(tmpdir(), "ysn-html-edit-state-"));

test("loadHtmlChangeRequest parses required sections and sibling approved-regions.json", async () => {
  const dir = await makeTempDir();
  try {
    const changeFilePath = resolve(dir, "change-request.md");
    const approvedRegionsPath = resolve(dir, "approved-regions.json");
    await writeFile(
      changeFilePath,
      [
        "## Requested change",
        "Move the callout farther right.",
        "",
        "## Success checks",
        "The callout clearly sits to the right of the divider.",
        "",
        "## Guardrails",
        "Do not change copy.",
        "",
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      approvedRegionsPath,
      JSON.stringify([
        {
          id: "lock-1",
          label: "Title block",
          x: 10,
          y: 20,
          width: 300,
          height: 120,
          freezeLevel: "pixel-strict",
        },
      ]),
      "utf8"
    );

    const request = await loadHtmlChangeRequest({ changeFilePath });
    assert.equal(request.requestedChange, "Move the callout farther right.");
    assert.equal(request.successChecks, "The callout clearly sits to the right of the divider.");
    assert.equal(request.guardrails, "Do not change copy.");
    assert.equal(request.approvedRegions.length, 1);
    assert.equal(request.approvedRegions[0].freezeLevel, "pixel-strict");
    assert.equal(request.approvedRegionsPath, approvedRegionsPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("html edit run state helpers create skeleton and round-trip state", async () => {
  const dir = await makeTempDir();
  const artifactDir = resolve(dir, "artifact");
  const sourceDir = resolve(dir, "source");
  try {
    const officialPreviewPath = resolve(sourceDir, "official-preview.png");
    const parentPreviewPath = resolve(sourceDir, "parent-preview.png");
    const parentHtmlPath = resolve(sourceDir, "parent-html.html");
    await mkdir(sourceDir, { recursive: true });
    await writeFile(officialPreviewPath, "official", "utf8");
    await writeFile(parentPreviewPath, "parent", "utf8");
    await writeFile(parentHtmlPath, "<html><body>parent</body></html>\n", "utf8");

    const runId = "run-20260404-120000-html-edit";
    const paths = getHtmlEditRunPaths({ artifactDir, runId });
    const state = createInitialHtmlEditRunState({
      artifactDir,
      projectRoot: resolve(dir, "project"),
      slideId: "slide-09",
      versionId: "version-000123",
      surface: "gemini-html",
      mode: "repair",
      config: {
        providers: ["openai", "gemini"],
        slotsPerProvider: 2,
      },
      baseline: {
        officialPreviewPath: resolve(paths.baselineDir, "official-preview.png"),
        parentPreviewPath: resolve(paths.baselineDir, "parent-preview.png"),
        parentHtmlPath: resolve(paths.baselineDir, "parent-html.html"),
      },
      request: {
        requestedChange: "Shift the callout right.",
        successChecks: "The callout is visibly farther right.",
        guardrails: "Do not change copy.",
        approvedRegions: [],
      },
      runId,
    });

    await ensureHtmlEditRunSkeleton({
      artifactDir,
      runId,
      requestMarkdown:
        "## Requested change\nShift the callout right.\n\n## Success checks\nThe callout is visibly farther right.\n",
      requestJson: state.request,
      baselineFiles: {
        "official-preview.png": officialPreviewPath,
        "parent-preview.png": parentPreviewPath,
        "parent-html.html": parentHtmlPath,
      },
      state,
    });

    assert.ok(existsSync(paths.statePath));
    assert.ok(existsSync(resolve(paths.baselineDir, "official-preview.png")));
    assert.equal(
      await readFile(resolve(paths.baselineDir, "parent-html.html"), "utf8"),
      "<html><body>parent</body></html>\n"
    );

    const saved = await loadHtmlEditRunState(paths.runDir);
    assert.equal(saved.runId, runId);
    assert.equal(saved.slots.length, 4);
    saved.status = "needs-human";
    const updated = await writeHtmlEditRunState(paths.runDir, saved);
    assert.equal(updated.status, "needs-human");
    assert.ok(updated.updatedAt);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
