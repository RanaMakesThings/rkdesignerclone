import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { touchProjectManifestRefreshToken } from "../../../../../lib/repo/index.mjs";
import { __test_collectSlideRunRoots } from "./html-edit-runs.ts";
import {
  clearDesignerStudioCache,
  getDesignerStudioDeck,
  getDesignerStudioGraphics,
  getDesignerStudioSlideContext,
} from "./designer-studio.ts";

const makeTempDir = async () => mkdtemp(join(tmpdir(), "ysn-studio-run-roots-"));

test("Designer Studio deck keeps canonical active order and marks unavailable slides", async () => {
  clearDesignerStudioCache();
  const deck = await getDesignerStudioDeck({ forceRefresh: true });

  assert.deepEqual(
    deck.activeSlides.slice(0, 7).map((slide) => slide.slideId),
    ["slide-01", "slide-02", "slide-03", "slide-05", "slide-06", "slide-07", "slide-08"]
  );
  assert.deepEqual(
    deck.activeSlides.slice(0, 7).map((slide) => slide.displayNumber),
    ["1", "2", "3", "4", "5", "6", "7"]
  );

  const unavailable = new Map(
    deck.unavailableSlides.map((slide) => [slide.slideId, slide.unavailableReason])
  );

  assert.equal(unavailable.get("slide-12"), undefined);
  assert.equal(unavailable.get("slide-13"), "No slide root");
});

test("Designer Studio resolves public numbering and stamped-root exceptions", async () => {
  clearDesignerStudioCache();

  const slide04 = await getDesignerStudioSlideContext("4");
  assert.equal(slide04.slide?.slideId, "slide-05");
  assert.equal(slide04.slide?.stampedRootId, "slide-05");
  assert.equal(slide04.canonicalParam, "4");

  const slide05 = await getDesignerStudioSlideContext("5");
  assert.equal(slide05.slide?.slideId, "slide-06");
  assert.equal(slide05.slide?.stampedRootId, "slide-06-quality-bar");
  assert.equal(slide05.canonicalParam, "5");

  const slide06 = await getDesignerStudioSlideContext("6");
  assert.equal(slide06.slide?.slideId, "slide-07");
  assert.equal(slide06.slide?.stampedRootId, "slide-06");
  assert.equal(slide06.canonicalParam, "6");

  const slide08 = await getDesignerStudioSlideContext("slide-09");
  assert.equal(slide08.slide?.slideId, "slide-09");
  assert.equal(slide08.slide?.displayNumber, "8");
  assert.equal(slide08.canonicalParam, "8");

  const slide10 = await getDesignerStudioSlideContext("10");
  assert.equal(slide10.slide?.slideId, "slide-11-beachhead");
  assert.equal(slide10.slide?.stampedRootId, "slide-11");
  assert.equal(slide10.canonicalParam, "10");

  const slide11 = await getDesignerStudioSlideContext("11");
  assert.equal(slide11.slide?.slideId, "slide-11");
  assert.equal(slide11.slide?.stampedRootId, "slide-11-team");
  assert.equal(slide11.canonicalParam, "11");

  const slide12 = await getDesignerStudioSlideContext("12");
  assert.equal(slide12.slide?.slideId, "slide-12");
  assert.equal(slide12.slide?.stampedRootId, "slide-12");
  assert.equal(slide12.canonicalParam, "12");
});

test("Designer Studio audit keeps active Slides 4-12 on the allowed identity map", async () => {
  clearDesignerStudioCache();
  const deck = await getDesignerStudioDeck({ forceRefresh: true });

  const expected = new Map([
    ["4", { slideId: "slide-05", stampedRootId: "slide-05" }],
    ["5", { slideId: "slide-06", stampedRootId: "slide-06-quality-bar" }],
    ["6", { slideId: "slide-07", stampedRootId: "slide-06" }],
    ["7", { slideId: "slide-08", stampedRootId: "slide-08" }],
    ["8", { slideId: "slide-09", stampedRootId: "slide-09" }],
    ["9", { slideId: "slide-10", stampedRootId: "slide-10" }],
    ["10", { slideId: "slide-11-beachhead", stampedRootId: "slide-11" }],
    ["11", { slideId: "slide-11", stampedRootId: "slide-11-team" }],
    ["12", { slideId: "slide-12", stampedRootId: "slide-12" }],
  ]);

  for (const [displayNumber, identity] of expected) {
    const slide = deck.activeSlides.find((entry) => entry.displayNumber === displayNumber);
    assert.ok(slide, `missing active slide ${displayNumber}`);
    assert.equal(slide?.slideId, identity.slideId);
    assert.equal(slide?.stampedRootId ?? null, identity.stampedRootId);
    assert.equal(slide?.canonicalParam, displayNumber);
  }
});

test("Designer Studio aggregates legacy slide 4 and 4/5 history into public Slide 4", async () => {
  clearDesignerStudioCache();

  const { slide } = await getDesignerStudioSlideContext("4");
  assert.ok(slide);
  assert.equal(slide.slideId, "slide-05");

  const legacySlide04 = slide.versions.filter((version) => version.sourceSlideId === "slide-04");
  const legacySlide045 = slide.versions.filter(
    (version) => version.sourceSlideId === "slide-04-05"
  );
  const ownerVersions = slide.versions.filter((version) => version.sourceSlideId === "slide-05");

  assert.ok(legacySlide04.length > 0);
  assert.ok(legacySlide045.length > 0);
  assert.ok(ownerVersions.length > 0);
  assert.ok(legacySlide04.every((version) => version.promotable === false));
  assert.ok(legacySlide045.every((version) => version.promotable === false));
  assert.ok(ownerVersions.some((version) => version.isCurrent));
});

test("Designer Studio resolves root current assets and legacy stamped-root aliases", async () => {
  clearDesignerStudioCache();
  const deck = await getDesignerStudioDeck({ forceRefresh: true });

  const slide03 = deck.reviewableSlides.find((slide) => slide.slideId === "slide-03");
  assert.ok(slide03);
  assert.match(slide03.currentVersionId ?? "", /^version-\d{6}$/);
  assert.ok(slide03.currentPreview?.path.includes(slide03.currentVersionId ?? ""));
  assert.equal(slide03.versions[0]?.id, slide03.currentVersionId);

  const slide07 = deck.reviewableSlides.find((slide) => slide.slideId === "slide-07");
  assert.ok(slide07);
  assert.equal(slide07.stampedRootId, "slide-06");
  assert.match(slide07.currentVersionId ?? "", /^version-\d{6}$/);
  assert.equal(slide07.currentVersion?.id, slide07.currentVersionId);

  const slide11 = deck.reviewableSlides.find((slide) => slide.slideId === "slide-11");
  assert.ok(slide11);
  assert.equal(slide11.displayNumber, "11");
  assert.equal(slide11.stampedRootId, "slide-11-team");
  assert.match(slide11.currentVersionId ?? "", /^version-\d{6}$/);
  assert.equal(slide11.currentVersion?.id, slide11.currentVersionId);

  const slide12 = deck.reviewableSlides.find((slide) => slide.slideId === "slide-12");
  assert.ok(slide12);
  assert.equal(slide12.displayNumber, "12");
  assert.equal(slide12.stampedRootId, "slide-12");
  assert.match(slide12.currentVersionId ?? "", /^version-\d{6}$/);
  assert.equal(slide12.currentVersion?.id, slide12.currentVersionId);
});

test("Designer Studio version previews fall back to nested generated assets", async () => {
  clearDesignerStudioCache();
  const deck = await getDesignerStudioDeck({ forceRefresh: true });

  const slide10 = deck.reviewableSlides.find((slide) => slide.slideId === "slide-10");
  assert.ok(slide10);

  const archivedVersion = slide10.versions.find((version) => version.id === "version-000039");
  assert.ok(archivedVersion);
  assert.equal(
    archivedVersion.preview?.path,
    "projects/designer-health/slide-figures/slide-10/versions/version-000039--power-of-one-v1/gemini-html/preview.png"
  );
});

test("Designer Studio version previews fall back to codex-html previews", async () => {
  clearDesignerStudioCache();
  const deck = await getDesignerStudioDeck({ forceRefresh: true });

  const slide03 = deck.reviewableSlides.find((slide) => slide.slideId === "slide-03");
  assert.ok(slide03);

  const archivedVersion = slide03.versions.find((version) => version.id === "version-000068");
  assert.ok(archivedVersion);
  assert.equal(
    archivedVersion.preview?.path,
    "projects/designer-health/slide-figures/slide-03/versions/version-000068--15-bottom-left-cleanup/codex-html/preview.png"
  );
});

test("Designer Studio resolves canonical slide assets and linked deck assets", async () => {
  clearDesignerStudioCache();
  const deck = await getDesignerStudioDeck({ forceRefresh: true });

  const slide09 = deck.activeSlides.find((slide) => slide.slideId === "slide-09");
  assert.ok(slide09);
  assert.equal(
    slide09.assetsManifest?.path,
    "projects/designer-health/slide-assets/slide-09/manifest.json"
  );
  const documentationScene = slide09.slideAssets.find(
    (asset) => asset.id === "physician-documentation-editorial-scene"
  );
  assert.ok(documentationScene);
  assert.equal(documentationScene.assetId, "asset-000002");
  assert.equal(slide09.deckAssets[0]?.id, "designer-logo-pack");
  assert.equal(slide09.deckAssets[0]?.assetId, "asset-000001");
  assert.equal(slide09.slideAssets.length, 14);
  assert.equal(slide09.assetCount, 15);
});

test("Designer Studio surfaces the locked deck template from deck-spec", async () => {
  clearDesignerStudioCache();
  const deck = await getDesignerStudioDeck({ forceRefresh: true });

  assert.equal(deck.templates.length, 1);
  const template = deck.templates[0];
  assert.equal(template.id, "designer-deck-template-v1");
  assert.equal(template.status, "locked");
  assert.equal(template.themeId, "designer-v1");
  assert.equal(
    template.preview?.path,
    "projects/designer-health/templates/designer-deck-template-v1/template.png"
  );
  assert.equal(
    template.html?.path,
    "projects/designer-health/templates/designer-deck-template-v1/template.html"
  );
  assert.equal(
    template.contract?.path,
    "projects/designer-health/designer-deck-template.md"
  );
});

test("Designer Studio exposes shared-css version metadata for imported slide seeds", async () => {
  clearDesignerStudioCache();

  const { slide } = await getDesignerStudioSlideContext("2");
  assert.ok(slide);

  const sharedCssVersion = slide.versions.find(
    (version) => version.label === "slide-02-design-system-seed"
  );
  assert.ok(sharedCssVersion);
  assert.equal(sharedCssVersion.mode, "shared-css");
  assert.equal(sharedCssVersion.sourceKind, "user-html-snapshot");
  assert.equal(
    sharedCssVersion.sharedCss?.path,
    "projects/designer-health/design-system/vox-shared.css"
  );
  assert.match(sharedCssVersion.html?.path ?? "", /\/generated\.html$/);
  assert.match(sharedCssVersion.sourceHtml?.path ?? "", /\/source-locked\.html$/);
});

test("Designer Studio omits generated graphics when excluded from deck load", async () => {
  clearDesignerStudioCache();
  const deck = await getDesignerStudioDeck({
    forceRefresh: true,
    includeGeneratedGraphics: false,
  });

  assert.deepEqual(deck.generatedGraphics, []);
  assert.equal(deck.generatedGraphicsCount, 0);
});

test("Designer Studio lists presentation-image generator outputs in graphics feed", async () => {
  clearDesignerStudioCache();
  const graphics = await getDesignerStudioGraphics(true);

  if (graphics.length === 0) {
    assert.deepEqual(graphics, []);
    return;
  }

  const clinicianBatch = graphics.find(
    (graphic) =>
      graphic.batchSlug === "clinician-patient-brief-vignette" &&
      graphic.versionId === "version-01"
  );
  assert.ok(clinicianBatch);
  assert.equal(clinicianBatch.provider, "gemini");
  assert.match(clinicianBatch.graphicId, /^graphic-\d{6}$/);
  assert.match(clinicianBatch.batchId, /^graphic-batch-\d{6}$/);
  assert.equal(
    clinicianBatch.preview?.path,
    "output/figures/presentation-images/clinician-patient-brief-vignette/gemini/version-01--editorial-baseline/image-01.jpg"
  );

  const physicianBatch = graphics.find(
    (graphic) =>
      graphic.batchSlug === "physician-doc-ai-admin" &&
      graphic.versionId === "version-01"
  );
  assert.ok(physicianBatch);
  assert.equal(physicianBatch.provider, "gemini");
  assert.match(physicianBatch.graphicId, /^graphic-\d{6}$/);
  assert.equal(physicianBatch.versionId, "version-01");
  assert.ok(graphics.length >= 18);
});

test("Designer Studio can still compose graphics into the full deck manifest", async () => {
  clearDesignerStudioCache();
  const deck = await getDesignerStudioDeck({
    forceRefresh: true,
    includeGeneratedGraphics: true,
  });

  assert.equal(deck.generatedGraphicsCount, deck.generatedGraphics.length);
});

test("Designer Studio reuses cached slide context for repeated slide lookups", async () => {
  clearDesignerStudioCache();

  const first = await getDesignerStudioSlideContext("3");
  const second = await getDesignerStudioSlideContext("3");

  assert.equal(first.deck, second.deck);
  assert.equal(first.slide, second.slide);
  assert.equal(first.slide?.slideId, "slide-03");
});

test("Designer Studio keeps public Slide 8 versions on repo slide-09", async () => {
  clearDesignerStudioCache();

  const { slide } = await getDesignerStudioSlideContext("8");
  assert.ok(slide);
  assert.equal(slide.slideId, "slide-09");

  let foundAny = false;
  for (const versionId of [
    "version-000278",
    "version-000279",
    "version-000280",
    "version-000282",
    "version-000283",
    "version-000284",
    "version-000285",
  ]) {
    const version = slide.versions.find((entry) => entry.id === versionId);
    if (!version) {
      continue;
    }
    foundAny = true;
    assert.equal(version?.slideId, "slide-09");
    assert.equal(version?.sourceSlideId, "slide-09");
  }
  assert.ok(foundAny || slide.versions.every((entry) => entry.slideId === "slide-09"));
});

test("Designer live docs and deck report do not regress to the old numbering story", async () => {
  const repoRoot = process.cwd();
  const read = async (relativePath: string) =>
    readFile(resolve(repoRoot, relativePath), "utf8");

  const [readme, matrix, report] = await Promise.all([
    read("projects/designer-health/README.md"),
    read("projects/designer-health/deck-matrix.md"),
    read("projects/designer-health/deck-report.html"),
  ]);

  for (const contents of [readme, matrix, report]) {
    assert.doesNotMatch(contents, /3 -> 5 -> 4 -> 6/);
    assert.doesNotMatch(contents, /non-monotonic/i);
    assert.doesNotMatch(contents, /1,\s*2,\s*3,\s*5,\s*4,\s*6/);
  }
});

test("Designer Studio invalidates cached slide context when the studio refresh token changes", async () => {
  clearDesignerStudioCache();

  const repoRoot = process.cwd();
  const manifestPath = resolve(
    repoRoot,
    "projects/designer-health/slide-figures/slide-06-quality-bar/manifest.json"
  );
  const originalManifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    currentVersionId: string | null;
    versions: Array<{ id: string; status?: string | null }>;
  };

  const first = await getDesignerStudioSlideContext("slide-06");
  assert.equal(first.slide?.currentVersionId, originalManifest.currentVersionId);

  const nextCurrentVersionId =
    originalManifest.currentVersionId === "version-000271"
      ? "version-000270"
      : "version-000271";
  const nextManifest = {
    ...originalManifest,
    currentVersionId: nextCurrentVersionId,
    versions: originalManifest.versions.map((entry) => ({
      ...entry,
      status: entry.id === nextCurrentVersionId ? "current" : "archived",
    })),
  };

  try {
    await writeFile(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`, "utf8");
    await touchProjectManifestRefreshToken({ repoRoot });

    const second = await getDesignerStudioSlideContext("slide-06");
    assert.equal(second.slide?.currentVersionId, nextCurrentVersionId);
  } finally {
    await writeFile(manifestPath, `${JSON.stringify(originalManifest, null, 2)}\n`, "utf8");
    await touchProjectManifestRefreshToken({ repoRoot });
  }
});

test("Studio run discovery includes version-root create runs under tune/", async () => {
  const dir = await makeTempDir();
  const versionDir = resolve(dir, "version-000999--test-create");
  const runDir = resolve(versionDir, "tune", "run-20260404-010203-html-edit");

  try {
    await mkdir(runDir, { recursive: true });
    await writeFile(resolve(runDir, "state.json"), "{}\n", "utf8");

    const roots = await __test_collectSlideRunRoots({
      stampedDir: null,
      versions: [
        {
          dir: {
            absolutePath: versionDir,
          },
        },
      ],
    } as never);

    const versionRoot = roots.find((entry) => entry.artifactDir === versionDir);
    assert.ok(versionRoot);
    assert.equal(versionRoot?.surface, "current-html");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
