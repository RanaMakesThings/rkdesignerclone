import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import test from "node:test";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { buildSlideCreateRequest } from "../../designer/private/slide-create-brief.mjs";
import {
  rewriteTemplateAssetPaths,
  seedVersionFromTemplate,
} from "../../designer/private/slide-create-seed.mjs";
import { parseApprovedRegions } from "../../llm/private/html-change-request.mjs";

const makeTempDir = async () => mkdtemp(join(tmpdir(), "ysn-slide-create-seed-"));

test("rewriteTemplateAssetPaths and seedVersionFromTemplate rewrite template assets into the version bundle", async () => {
  const dir = await makeTempDir();
  const templateDir = resolve(dir, "templates", "designer-deck-template-v1");
  const versionDir = resolve(dir, "slide-figures", "slide-12", "versions", "version-000001--test");

  try {
    await mkdir(templateDir, { recursive: true });
    await mkdir(versionDir, { recursive: true });
    await writeFile(
      resolve(templateDir, "template.html"),
      [
        "<!doctype html>",
        '<html><body style="background-image:url(\'./bg.png\')">',
        '<img src="../../assets/logo.svg" alt="Logo" />',
        "</body></html>",
      ].join(""),
      "utf8"
    );
    await writeFile(resolve(templateDir, "template.png"), "template-preview", "utf8");
    await writeFile(resolve(templateDir, "shell-regions.json"), "[]\n", "utf8");

    const rewritten = rewriteTemplateAssetPaths({
      html: await readFile(resolve(templateDir, "template.html"), "utf8"),
      templateDir,
      versionDir,
    });
    assert.doesNotMatch(rewritten, /src="..\/..\/assets\/logo\.svg"/);
    assert.match(rewritten, /logo\.svg/);
    assert.match(rewritten, /bg\.png/);

    const seeded = await seedVersionFromTemplate({
      versionDir,
      templateDir,
      shellRegionsPath: resolve(templateDir, "shell-regions.json"),
    });

    const seededHtml = await readFile(seeded.generatedHtmlPath, "utf8");
    const snapshotHtml = await readFile(seeded.snapshotTemplateHtmlPath, "utf8");
    assert.equal(seededHtml, snapshotHtml);
    assert.match(seededHtml, /logo\.svg/);
    assert.match(seededHtml, /bg\.png/);
    assert.equal(
      await readFile(seeded.previewPath, "utf8"),
      "template-preview"
    );
    assert.equal(
      await readFile(seeded.snapshotTemplatePreviewPath, "utf8"),
      "template-preview"
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("checked-in shell regions parse through the approved-regions loader and create request includes required sections", async () => {
  const shellRegionsPath = resolve(
    process.cwd(),
    "projects",
    "designer-health",
    "templates",
    "designer-deck-template-v1",
    "shell-regions.json"
  );
  const shellRegions = parseApprovedRegions(
    JSON.parse(await readFile(shellRegionsPath, "utf8"))
  );

  assert.ok(shellRegions.length >= 2);
  assert.equal(shellRegions[0].shape, "rect");
  assert.match(shellRegions[0].freezeLevel, /pixel-strict|semantic-stable/);

  const request = buildSlideCreateRequest({
    slide: {
      id: "slide-12",
      title: "Beachhead",
      header: "Beachhead header",
      subheader: "Beachhead subheader",
      takeaway: "Focused initial market",
      purpose: "Make the beachhead believable",
      figureRole: "Single editorial proof object",
      selectedDirection: "Focused proof column",
      buildStatus: "draft",
      specText: "Use a calm proof column.",
    },
    lane: "html",
    laneReason: "Default HTML lane",
    templateId: "designer-deck-template-v1",
    draftVersionId: "version-000001",
    draftVersionDir: "/tmp/version-000001",
    adjacentSlides: [],
    shellRegions,
    packetPath: "/tmp/packet.md",
    packetText: "# Packet\n",
    noteReadmePath: "/tmp/README.md",
    noteReadmeText: "# Notes\n",
    referenceImagePaths: [],
    referenceFileSnapshots: [],
  });

  for (const heading of [
    "## Approved regions",
    "## Requested change",
    "## Success checks",
    "## Guardrails",
    "## Reference intent",
    "## Stop if",
  ]) {
    assert.match(request, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
