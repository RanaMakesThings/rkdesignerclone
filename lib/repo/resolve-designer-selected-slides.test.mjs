import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import {
  resolveDesignerRootCurrentAssets,
  resolveDesignerSelectedSlideContext,
  resolveDesignerSelectedSlides,
  toDesignerCanonicalSlideParam,
} from "./index.mjs";

test("toDesignerCanonicalSlideParam uses the public display number when it is numeric", () => {
  assert.equal(
    toDesignerCanonicalSlideParam({ slideId: "slide-05", displayNumber: "4" }),
    "4"
  );
  assert.equal(
    toDesignerCanonicalSlideParam({ slideId: "slide-11-team", displayNumber: "11" }),
    "11"
  );
  assert.equal(
    toDesignerCanonicalSlideParam({
      slideId: "slide-04-05",
      displayNumber: "4 (retired)",
    }),
    "slide-04-05"
  );
});

test("resolveDesignerSelectedSlideContext preserves Studio lookup precedence", () => {
  const activeSlides = [
    { slideId: "slide-05", displayNumber: "4", canonicalParam: "4" },
    { slideId: "slide-06", displayNumber: "5", canonicalParam: "5" },
    { slideId: "slide-07", displayNumber: "6", canonicalParam: "6" },
    { slideId: "slide-09", displayNumber: "8", canonicalParam: "8" },
  ];

  assert.equal(
    resolveDesignerSelectedSlideContext({ activeSlides, requestedSlideId: "4" }).slide?.slideId,
    "slide-05"
  );
  assert.equal(
    resolveDesignerSelectedSlideContext({ activeSlides, requestedSlideId: "slide-4" }).slide
      ?.slideId,
    "slide-05"
  );
  assert.equal(
    resolveDesignerSelectedSlideContext({ activeSlides, requestedSlideId: "slide-07" }).slide
      ?.slideId,
    "slide-07"
  );
  assert.equal(
    resolveDesignerSelectedSlideContext({ activeSlides, requestedSlideId: "8" }).resolvedSlideId,
    "slide-09"
  );
  assert.equal(
    resolveDesignerSelectedSlideContext({ activeSlides, requestedSlideId: "" }).slide,
    null
  );
});

test("resolveDesignerRootCurrentAssets resolves the current root preview, html, and svg", async () => {
  const repoRoot = await mkdtemp(resolve(tmpdir(), "ysn-designer-selected-slides-"));
  const slideDir = "projects/designer-health/slide-figures/slide-99";
  const absoluteSlideDir = resolve(repoRoot, slideDir);

  try {
    await mkdir(absoluteSlideDir, { recursive: true });
    await writeFile(
      resolve(absoluteSlideDir, "slide-99--version-000123.png"),
      "preview",
      "utf8"
    );
    await writeFile(
      resolve(absoluteSlideDir, "slide-99--version-000123.html"),
      "<html></html>",
      "utf8"
    );
    await writeFile(
      resolve(absoluteSlideDir, "slide-99--version-000123.svg"),
      "<svg></svg>",
      "utf8"
    );

    const assets = await resolveDesignerRootCurrentAssets({
      repoRoot,
      slideDir,
      currentVersionId: "version-000123",
    });

    assert.equal(assets.preview?.path, `${slideDir}/slide-99--version-000123.png`);
    assert.equal(assets.html?.path, `${slideDir}/slide-99--version-000123.html`);
    assert.equal(assets.svg?.path, `${slideDir}/slide-99--version-000123.svg`);
    assert.equal(assets.svgTrust.status, "untrusted");
    assert.equal(assets.svgPassThroughPath, null);
    assert.equal(assets.preview?.absolutePath, resolve(absoluteSlideDir, "slide-99--version-000123.png"));
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test("resolveDesignerRootCurrentAssets returns empty refs when there is no current version", async () => {
  const repoRoot = await mkdtemp(resolve(tmpdir(), "ysn-designer-selected-slides-"));

  try {
    const assets = await resolveDesignerRootCurrentAssets({
      repoRoot,
      slideDir: "projects/designer-health/slide-figures/slide-00",
      currentVersionId: null,
    });

    assert.deepEqual(assets, {
      preview: null,
      html: null,
      svg: null,
      svgTrust: {
        status: "missing",
        reason: "No current SVG asset.",
        trustedPath: null,
        containsForeignObject: false,
        dimensions: null,
      },
      svgPassThroughPath: null,
    });
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test("resolveDesignerSelectedSlides returns a path-based deck summary and SVG trust metadata", async () => {
  const deck = await resolveDesignerSelectedSlides({ repoRoot: process.cwd() });

  assert.ok(deck.projectId);
  assert.ok(deck.title);
  assert.ok(deck.version);
  assert.ok(deck.status);
  assert.ok(deck.deckSpecPath.endsWith("projects/designer-health/deck-spec.json"));
  assert.ok(Array.isArray(deck.activeSlides));
  assert.ok(deck.activeSlides.length > 0);

  const firstSlide = deck.activeSlides[0];
  assert.equal(typeof firstSlide.slideId, "string");
  assert.equal(typeof firstSlide.displayNumber, "string");
  assert.equal(typeof firstSlide.canonicalParam, "string");
  assert.equal(typeof firstSlide.stampedDirPath, "string");
  assert.equal(typeof firstSlide.currentVersionId, "string");
  assert.equal(typeof firstSlide.reviewable, "boolean");
  assert.ok(Array.isArray(firstSlide.versions));
  assert.ok(firstSlide.versions.length > 0);
  assert.equal(typeof firstSlide.versions[0].previewPath, "string");
  assert.equal(typeof firstSlide.versions[0].manifestPath, "string");

  const slide07 = deck.activeSlides.find((slide) => slide.slideId === "slide-07");
  const slide10 = deck.activeSlides.find((slide) => slide.slideId === "slide-10");
  const slide11 = deck.activeSlides.find((slide) => slide.slideId === "slide-11");

  assert.equal(slide07?.sourceClass, "preview_only");
  assert.equal(slide07?.currentSvgPath, null);
  assert.equal(slide07?.currentSvgTrusted, false);
  assert.equal(slide07?.trustedCurrentSvgPath, null);
  assert.equal(slide07?.currentSvgTrustReason, "No current SVG asset.");

  assert.equal(slide10?.sourceClass, "html_dom");
  assert.equal(slide10?.wrapperAssetKind, null);
  assert.equal(slide10?.currentSvgPath, "projects/designer-health/slide-figures/slide-10/slide-10--version-000038.svg");
  assert.equal(slide10?.currentSvgTrusted, false);
  assert.equal(slide10?.trustedCurrentSvgPath, null);
  assert.match(slide10?.currentSvgTrustReason ?? "", /24x24|slide-sized/i);

  assert.equal(slide11?.sourceClass, "html_wrapper_asset");
  assert.equal(slide11?.wrapperAssetKind, "svg");
  assert.equal(slide11?.currentSvgTrusted, true);
  assert.equal(slide11?.trustedCurrentSvgPath, slide11?.currentSvgPath);
  assert.match(slide11?.currentSvgTrustReason ?? "", /full-slide viewport/i);
});
