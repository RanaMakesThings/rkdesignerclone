import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import {
  assignGraphicIdsToManifest,
  backfillPresentationImageGraphicIds,
  buildBatchPlan,
  resolveOpenAIReferenceRunnerModel,
  renderSummary,
} from "./presentation-images-cli.mjs";

test("buildBatchPlan assigns one talkable version sequence across the batch", () => {
  const variants = [
    { id: "v01-editorial", label: "Editorial Baseline", note: "note" },
    { id: "v02-bold", label: "Bold Contrast", note: "note" },
    { id: "v03-minimal", label: "Minimal Restraint", note: "note" },
  ];

  const plan = buildBatchPlan({
    providers: ["gemini", "openai"],
    variants,
  });

  assert.deepEqual(
    plan.map((entry) => ({
      versionNumber: entry.versionNumber,
      versionId: entry.versionId,
      provider: entry.provider,
      variantId: entry.variant.id,
      artifactSlug: entry.artifactSlug,
    })),
    [
      {
        versionNumber: 1,
        versionId: "version-01",
        provider: "gemini",
        variantId: "v01-editorial",
        artifactSlug: "version-01--editorial-baseline",
      },
      {
        versionNumber: 2,
        versionId: "version-02",
        provider: "gemini",
        variantId: "v02-bold",
        artifactSlug: "version-02--bold-contrast",
      },
      {
        versionNumber: 3,
        versionId: "version-03",
        provider: "gemini",
        variantId: "v03-minimal",
        artifactSlug: "version-03--minimal-restraint",
      },
      {
        versionNumber: 4,
        versionId: "version-04",
        provider: "openai",
        variantId: "v01-editorial",
        artifactSlug: "version-04--editorial-baseline",
      },
      {
        versionNumber: 5,
        versionId: "version-05",
        provider: "openai",
        variantId: "v02-bold",
        artifactSlug: "version-05--bold-contrast",
      },
      {
        versionNumber: 6,
        versionId: "version-06",
        provider: "openai",
        variantId: "v03-minimal",
        artifactSlug: "version-06--minimal-restraint",
      },
    ]
  );
});

test("resolveOpenAIReferenceRunnerModel upgrades image-only models for Responses tool calls", () => {
  assert.equal(resolveOpenAIReferenceRunnerModel("gpt-image-1.5"), "gpt-5.4");
  assert.equal(resolveOpenAIReferenceRunnerModel("gpt-image-1"), "gpt-5.4");
  assert.equal(resolveOpenAIReferenceRunnerModel("gpt-4.1"), "gpt-4.1");
  assert.equal(resolveOpenAIReferenceRunnerModel("gpt-5.4"), "gpt-5.4");
});

test("renderSummary surfaces version labels alongside provider and variant", () => {
  const summary = renderSummary({
    dir: "/tmp/presentation-images",
    spec: "Spec body",
    providers: ["gemini", "openai"],
    results: [
      {
        ok: true,
        graphicId: "graphic-000013",
        versionLabel: "Version 01",
        provider: "gemini",
        variantId: "v01-editorial",
        variantLabel: "Editorial Baseline",
        imagePath: "/tmp/presentation-images/gemini/version-01--editorial-baseline/image-01.jpg",
      },
      {
        ok: false,
        versionLabel: "Version 04",
        provider: "openai",
        variantId: "v01-editorial",
        variantLabel: "Editorial Baseline",
        error: "request failed",
      },
    ],
  });

  assert.match(
    summary,
    /`graphic-000013` · Version 01: Gemini \/ Editorial Baseline \(`v01-editorial`\): `\/tmp\/presentation-images\/gemini\/version-01--editorial-baseline\/image-01\.jpg`/
  );
  assert.match(
    summary,
    /Version 04: OpenAI \/ Editorial Baseline \(`v01-editorial`\): failed - request failed/
  );
});

test("assignGraphicIdsToManifest preserves existing ids and allocates the next global id", async () => {
  const rootDir = await mkdtemp(resolve(tmpdir(), "presentation-images-"));
  const oldOutputDir = resolve(rootDir, "older-batch");
  const currentOutputDir = resolve(rootDir, "current-batch");

  await mkdir(oldOutputDir, { recursive: true });
  await mkdir(currentOutputDir, { recursive: true });

  await writeFile(
    resolve(oldOutputDir, "manifest.json"),
    `${JSON.stringify(
      {
        batchId: "graphic-batch-000001",
        generatedAt: "2026-04-01T12:00:00.000Z",
        results: [
          {
            ok: true,
            versionId: "version-01",
            versionLabel: "Version 01",
            provider: "gemini",
            variantId: "v01-editorial",
            variantLabel: "Editorial Baseline",
            graphicId: "graphic-000001",
          },
        ],
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  await writeFile(
    resolve(currentOutputDir, "manifest.json"),
    `${JSON.stringify(
      {
        batchId: "graphic-batch-000002",
        generatedAt: "2026-04-01T13:00:00.000Z",
        results: [
          {
            ok: true,
            provider: "gemini",
            variantId: "v01-editorial",
            variantLabel: "Editorial Baseline",
            graphicId: "graphic-000002",
          },
        ],
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const manifest = await assignGraphicIdsToManifest({
    rootDir,
    outputDir: currentOutputDir,
    manifest: {
      generatedAt: "2026-04-01T13:05:00.000Z",
      results: [
        {
          ok: true,
          versionNumber: 1,
          versionId: "version-01",
          versionLabel: "Version 01",
          provider: "gemini",
          variantId: "v01-editorial",
          variantLabel: "Editorial Baseline",
        },
        {
          ok: true,
          versionNumber: 2,
          versionId: "version-02",
          versionLabel: "Version 02",
          provider: "gemini",
          variantId: "v02-bold",
          variantLabel: "Bold Contrast",
        },
      ],
    },
  });

  assert.equal(manifest.batchId, "graphic-batch-000002");
  assert.equal(manifest.results[0].graphicId, "graphic-000002");
  assert.equal(manifest.results[0].versionNumber, 1);
  assert.equal(manifest.results[0].versionId, "version-01");
  assert.equal(manifest.results[1].graphicId, "graphic-000003");
  assert.equal(manifest.results[1].versionLabel, "Version 02");
});

test("backfillPresentationImageGraphicIds assigns sequential global graphic ids", async () => {
  const rootDir = await mkdtemp(resolve(tmpdir(), "presentation-images-backfill-"));
  const olderDir = resolve(rootDir, "older-batch");
  const newerDir = resolve(rootDir, "newer-batch");

  await mkdir(olderDir, { recursive: true });
  await mkdir(newerDir, { recursive: true });

  await writeFile(resolve(olderDir, "spec.txt"), "Older batch spec\n", "utf8");
  await writeFile(resolve(newerDir, "spec.txt"), "Newer batch spec\n", "utf8");

  await writeFile(
    resolve(olderDir, "manifest.json"),
    `${JSON.stringify(
      {
        generatedAt: "2026-04-01T12:00:00.000Z",
        dir: olderDir,
        providers: ["gemini"],
        results: [
          {
            ok: true,
            provider: "gemini",
            variantId: "v01-editorial",
            variantLabel: "Editorial Baseline",
            imagePath: `${olderDir}/image-01.jpg`,
          },
        ],
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  await writeFile(
    resolve(newerDir, "manifest.json"),
    `${JSON.stringify(
      {
        generatedAt: "2026-04-01T13:00:00.000Z",
        dir: newerDir,
        providers: ["openai"],
        results: [
          {
            ok: true,
            provider: "openai",
            variantId: "v01-editorial",
            variantLabel: "Editorial Baseline",
            imagePath: `${newerDir}/image-01.png`,
          },
          {
            ok: true,
            provider: "openai",
            variantId: "v02-bold",
            variantLabel: "Bold Contrast",
            imagePath: `${newerDir}/image-02.png`,
          },
        ],
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  await backfillPresentationImageGraphicIds({ rootDir });

  const olderManifest = JSON.parse(
    await readFile(resolve(olderDir, "manifest.json"), "utf8")
  );
  const newerManifest = JSON.parse(
    await readFile(resolve(newerDir, "manifest.json"), "utf8")
  );
  const olderSummary = await readFile(resolve(olderDir, "summary.md"), "utf8");

  assert.equal(olderManifest.batchId, "graphic-batch-000001");
  assert.equal(olderManifest.results[0].graphicId, "graphic-000001");
  assert.equal(olderManifest.results[0].versionId, "version-01");
  assert.equal(olderManifest.results[0].versionLabel, "Version 01");

  assert.equal(newerManifest.batchId, "graphic-batch-000002");
  assert.equal(newerManifest.results[0].graphicId, "graphic-000002");
  assert.equal(newerManifest.results[1].graphicId, "graphic-000003");
  assert.equal(newerManifest.results[1].versionId, "version-02");

  assert.match(olderSummary, /`graphic-000001` · Version 01/);
});
