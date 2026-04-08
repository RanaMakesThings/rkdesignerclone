import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import test from "node:test";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assessFigureDir, parseClaudeAssessment } from "../lib/assessment.mjs";
import {
  applySelectedAssets,
  buildAssetReport,
  generateFigureAssets,
  generateStandaloneImageAssets,
  selectAssetCandidate,
} from "../lib/assets.mjs";
import { buildCoverageReport } from "../lib/check.mjs";
import { parseClaudeIdeation } from "../lib/ideation.mjs";
import { readJson, writeJson } from "../lib/io.mjs";
import { parseStandaloneImageRequestArgs } from "../lib/image-request.mjs";
import { resolvePexelsApiKey } from "../lib/pexels-client.mjs";
import { exportFigure, renderFigure } from "../lib/pipeline.mjs";
import {
  loadFigureSpec,
  normalizeFigureSpec,
  validateFigureSpec,
} from "../lib/spec.mjs";
import { renderFigureHtml } from "../lib/template.mjs";

const testDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
const repoRoot = resolve(testDir, "..", "..", "..");
const specDir = resolve(repoRoot, "projects", "designer-health", "figures", "specs");
const specPaths = [
  "slide-02-proof-tiles.json",
  "slide-02-wait-times-shortage-banner.json",
  "slide-01-one-human-story-to-structure.json",
  "slide-01-one-human-story-to-structure-membrane.json",
  "slide-03-segmented-focus-bar.json",
  "slide-03-compound-ribbon-before-after.json",
  "slide-05-history-wedge-v1.json",
  "compound-ribbon-v2-hero-day-view.json",
  "slide-04-transformation-flow.json",
  "slide-06-workflow-strip-v2.json",
  "slide-08-artifact-callouts.json",
  "slide-10-hero-metrics.json",
].map((name) => resolve(specDir, name));

const makeTempDir = async () => mkdtemp(join(tmpdir(), "ysn-figures-"));

const makeFakeImportPlaywright = (marker) => async () => ({
  chromium: {
    launch: async () => ({
      newPage: async () => ({
        goto: async () => {},
        screenshot: async ({ path }) => {
          await writeFile(path, marker, "utf8");
        },
        close: async () => {},
      }),
      close: async () => {},
    }),
  },
});

const seedArtifacts = async ({ dir, spec }) => {
  const meta = {
    slug: spec.meta.slug,
    family: spec.meta.family,
    deckId: spec.meta.deckId,
    title: spec.chrome.title,
  };
  const coverage = {
    summary: { total: 1, passed: 1, failed: 0 },
    pass: true,
    checks: [],
  };

  await mkdir(dir, { recursive: true });
  await writeJson(join(dir, "spec.json"), spec);
  await writeJson(join(dir, "meta.json"), meta);
  await writeJson(join(dir, "coverage.json"), coverage);
  await writeFile(join(dir, "figure.html"), "<html><body>ok</body></html>", "utf8");
  await writeFile(join(dir, "figure.png"), "", "utf8");
};

test("canonical figure specs load and render", async () => {
  for (const specPath of specPaths) {
    const spec = await loadFigureSpec(specPath);
    const html = renderFigureHtml(spec);
    assert.match(html, /<!doctype html>/i);
    assert.match(html, new RegExp(`family-${spec.meta.family}`));
    if (spec.meta.mode !== "body-only") {
      assert.match(html, new RegExp(spec.chrome.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  }
});

test("render writes standalone SVG for inline-svg families", async () => {
  const dir = await makeTempDir();
  const specPath = resolve(specDir, "slide-03-compound-ribbon-before-after.json");

  try {
    const result = await renderFigure({ specPath, outputDir: dir });
    const svg = await readFile(result.paths.svgPath, "utf8");
    assert.match(svg, /<svg\b/i);
    assert.match(svg, /Story reconstruction/);
    assert.ok(!svg.includes("<foreignObject"), svg);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("render falls back to foreignObject SVG for html-first families", async () => {
  const dir = await makeTempDir();
  const specPath = resolve(specDir, "slide-02-proof-tiles.json");

  try {
    const result = await renderFigure({ specPath, outputDir: dir });
    const svg = await readFile(result.paths.svgPath, "utf8");
    assert.match(svg, /<svg\b/i);
    assert.match(svg, /<foreignObject/i);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("family validation catches missing required body fields", async () => {
  const spec = await loadFigureSpec(resolve(specDir, "slide-10-hero-metrics.json"));
  const broken = normalizeFigureSpec({
    ...spec,
    body: {
      ...spec.body,
      hero: {
        ...spec.body.hero,
        primaryMetric: "",
      },
    },
  });

  const errors = validateFigureSpec(broken);
  assert.ok(
    errors.some((error) => error.includes("body.hero.primaryMetric")),
    errors.join("\n")
  );
});

test("media slots validation catches missing query", async () => {
  const spec = await loadFigureSpec(resolve(specDir, "slide-02-proof-tiles.json"));
  const broken = normalizeFigureSpec({
    ...spec,
    media: {
      slots: [
        {
          id: "hero-photo",
          label: "Hero photo",
          query: "",
          orientation: "landscape",
        },
      ],
    },
  });

  const errors = validateFigureSpec(broken);
  assert.ok(
    errors.some((error) => error.includes("media.slots[0].query")),
    errors.join("\n")
  );
});

test("media selection validation catches missing slot binding", async () => {
  const spec = await loadFigureSpec(resolve(specDir, "slide-02-proof-tiles.json"));
  const broken = normalizeFigureSpec({
    ...spec,
    media: {
      slots: [],
      selection: [
        {
          placement: "background",
        },
      ],
    },
  });

  const errors = validateFigureSpec(broken);
  assert.ok(
    errors.some((error) => error.includes("media.selection[0].slotId")),
    errors.join("\n")
  );
  assert.ok(
    errors.some((error) => error.includes("candidateId or candidateIndex")),
    errors.join("\n")
  );
});

test("render resolves selected media from assets manifest", async () => {
  const spec = await loadFigureSpec(resolve(specDir, "slide-02-proof-tiles.json"));
  const dir = await makeTempDir();
  const specPath = join(dir, "spec-with-selection.json");

  try {
    await writeJson(specPath, {
      ...spec,
      meta: {
        ...spec.meta,
        slug: "photo-selection-test",
        theme: "pd-template-1",
      },
      body: {
        ...spec.body,
        motif: "reception-window-photo",
      },
      media: {
        slots: [
          {
            id: "hero-photo",
            label: "Hero photo",
            query: "clinic front desk scheduling appointment board healthcare",
            orientation: "landscape",
          },
        ],
        selection: [
          {
            slotId: "hero-photo",
            candidateId: "6809657",
            placement: "background",
            treatment: "soft",
          },
        ],
      },
    });

    await writeJson(join(dir, "assets.json"), {
      generatedAt: new Date().toISOString(),
      provider: "pexels",
      slots: [
        {
          id: "hero-photo",
          label: "Hero photo",
          query: "clinic front desk scheduling appointment board healthcare",
          candidates: [
            {
              id: "6809657",
              alt: "Receptionist and client with appointment book.",
              boardImageUrl: "assets/hero-photo/01-6809657.jpeg",
              remoteImageUrl: "https://images.example.test/photo-6809657.jpeg",
              photographer: "Demo",
              photoUrl: "https://www.pexels.com/photo/mock-6809657/",
            },
          ],
        },
      ],
    });

    const result = await renderFigure({ specPath, outputDir: dir });
    assert.match(result.html, /assets\/hero-photo\/01-6809657\.jpeg/);
    assert.equal(result.meta.selectedMedia.length, 1);
    assert.equal(result.meta.selectedMedia[0].candidateId, "6809657");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("coverage fails when locked copy is not rendered", async () => {
  const spec = await loadFigureSpec(resolve(specDir, "slide-03-segmented-focus-bar.json"));
  const dir = await makeTempDir();

  try {
    const htmlPath = join(dir, "figure.html");
    const pngPath = join(dir, "figure.png");
    await writeFile(htmlPath, "<html><body>missing required labels</body></html>", "utf8");
    await writeFile(pngPath, "", "utf8");

    const coverage = buildCoverageReport({
      spec,
      paths: {
        htmlPath,
        pngPath,
      },
      html: "<html><body>missing required labels</body></html>",
    });

    assert.equal(coverage.pass, false);
    assert.ok(
      coverage.checks.some(
        (check) =>
          check.id === "copy.locked.History reconstruction" && check.pass === false
      )
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("coverage fails when forbidden copy appears in the render", async () => {
  const spec = await loadFigureSpec(resolve(specDir, "slide-10-hero-metrics.json"));
  const dir = await makeTempDir();

  try {
    const htmlPath = join(dir, "figure.html");
    const pngPath = join(dir, "figure.png");
    const html = "<html><body>table</body></html>";
    await writeFile(htmlPath, html, "utf8");
    await writeFile(pngPath, "", "utf8");

    const coverage = buildCoverageReport({
      spec,
      paths: {
        htmlPath,
        pngPath,
      },
      html,
    });

    assert.equal(coverage.pass, false);
    assert.ok(
      coverage.checks.some(
        (check) => check.id === "copy.forbidden.table" && check.pass === false
      )
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("coverage requires asset artifacts when media slots exist", async () => {
  const spec = await loadFigureSpec(resolve(specDir, "slide-02-proof-tiles.json"));
  const mediaSpec = normalizeFigureSpec({
    ...spec,
    media: {
      slots: [
        {
          id: "hero-photo",
          label: "Hero photo",
          query: "doctor patient consultation",
          orientation: "landscape",
        },
      ],
    },
  });
  const dir = await makeTempDir();

  try {
    const htmlPath = join(dir, "figure.html");
    const pngPath = join(dir, "figure.png");
    await writeFile(htmlPath, renderFigureHtml(mediaSpec), "utf8");
    await writeFile(pngPath, "", "utf8");

    const coverage = buildCoverageReport({
      spec: mediaSpec,
      paths: {
        htmlPath,
        pngPath,
        assetsManifestPath: join(dir, "assets.json"),
        assetBoardHtmlPath: join(dir, "asset-board.html"),
        assetBoardPngPath: join(dir, "asset-board.png"),
      },
      html: renderFigureHtml(mediaSpec),
    });

    assert.equal(coverage.pass, false);
    assert.ok(
      coverage.checks.some(
        (check) =>
          check.id === "artifacts.assets-manifest" && check.pass === false
      )
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("coverage can skip asset artifacts when images are explicitly disabled", async () => {
  const spec = await loadFigureSpec(resolve(specDir, "slide-02-proof-tiles.json"));
  const mediaSpec = normalizeFigureSpec({
    ...spec,
    media: {
      slots: [
        {
          id: "hero-photo",
          label: "Hero photo",
          query: "doctor patient consultation",
          orientation: "landscape",
        },
      ],
    },
  });
  const dir = await makeTempDir();

  try {
    const htmlPath = join(dir, "figure.html");
    const pngPath = join(dir, "figure.png");
    await writeFile(htmlPath, renderFigureHtml(mediaSpec), "utf8");
    await writeFile(pngPath, "", "utf8");

    const coverage = buildCoverageReport({
      spec: mediaSpec,
      paths: {
        htmlPath,
        pngPath,
        assetsManifestPath: join(dir, "assets.json"),
        assetBoardHtmlPath: join(dir, "asset-board.html"),
        assetBoardPngPath: join(dir, "asset-board.png"),
      },
      html: renderFigureHtml(mediaSpec),
      expectImages: false,
    });

    assert.equal(
      coverage.checks.some((check) => check.id === "artifacts.assets-manifest"),
      false
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("missing PEXELS_API_KEY throws a remediation error", () => {
  const originalKey = process.env.PEXELS_API_KEY;
  delete process.env.PEXELS_API_KEY;

  try {
    assert.throws(() => resolvePexelsApiKey(), /Missing PEXELS_API_KEY/);
  } finally {
    if (originalKey !== undefined) {
      process.env.PEXELS_API_KEY = originalKey;
    }
  }
});

test("standalone image request args parse with defaults", () => {
  const request = parseStandaloneImageRequestArgs([
    "--purpose",
    "Clinic waiting room scheduling pressure",
    "--orientation",
    "landscape",
    "--color",
    "blue",
    "--count",
    "4",
    "--no-download",
  ]);

  assert.deepEqual(request, {
    mode: "standalone",
    purpose: "Clinic waiting room scheduling pressure",
    orientation: "landscape",
    color: "blue",
    style: "",
    mood: "",
    shot: "",
    people: "",
    copySafe: "",
    provider: "pexels",
    approvedOnly: false,
    reuseFrom: "",
    count: 4,
    slug: "clinic-waiting-room-scheduling-pressure",
    outputDir: null,
    download: false,
  });
});

test("asset generation writes manifest, board, and downloads", async () => {
  const spec = await loadFigureSpec(resolve(specDir, "slide-02-proof-tiles.json"));
  const dir = await makeTempDir();
  const specPath = join(dir, "spec-with-media.json");
  const originalKey = process.env.PEXELS_API_KEY;
  process.env.PEXELS_API_KEY = "test-key";

  const boardPngMarker = "fake-png";
  const fakeImportPlaywright = makeFakeImportPlaywright(boardPngMarker);

  const fakeFetch = async (url, options = {}) => {
    const href = String(url);
    if (href.startsWith("https://api.pexels.com/v1/search")) {
      assert.equal(options.headers.Authorization, "test-key");
      return new Response(
        JSON.stringify({
          photos: [
            {
              id: 101,
              width: 2400,
              height: 1600,
              url: "https://www.pexels.com/photo/mock-101/",
              photographer: "Demo One",
              photographer_url: "https://www.pexels.com/@demo-one",
              avg_color: "#8899AA",
              src: {
                large2x: "https://images.example.test/photo-101.jpeg",
              },
              alt: "Doctor speaking with patient",
            },
            {
              id: 102,
              width: 2300,
              height: 1500,
              url: "https://www.pexels.com/photo/mock-102/",
              photographer: "Demo Two",
              photographer_url: "https://www.pexels.com/@demo-two",
              avg_color: "#445566",
              src: {
                large2x: "https://images.example.test/photo-102.jpeg",
              },
              alt: "Clinical teamwork in office",
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }
      );
    }

    if (href.startsWith("https://images.example.test/")) {
      return new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 200,
        headers: {
          "content-type": "image/jpeg",
        },
      });
    }

    throw new Error(`Unexpected fetch URL: ${href}`);
  };

  try {
    await writeJson(specPath, {
      ...spec,
      media: {
        slots: [
          {
            id: "hero-photo",
            label: "Hero photo",
            query: "doctor patient consultation clinic",
            orientation: "landscape",
            maxCandidates: 2,
            placementNote: "Support the proof-of-problem slide.",
          },
        ],
      },
    });

    const result = await generateFigureAssets({
      specPath,
      outputDir: dir,
      fetchImpl: fakeFetch,
      importPlaywrightImpl: fakeImportPlaywright,
    });

    const manifest = await readJson(result.paths.assetsManifestPath);
    assert.equal(manifest.provider, "pexels");
    assert.equal(manifest.slots.length, 1);
    assert.equal(manifest.slots[0].candidates.length, 2);
    assert.match(
      await readFile(result.paths.assetBoardHtmlPath, "utf8"),
      /candidate board/i
    );
    assert.equal(
      await readFile(result.paths.assetBoardPngPath, "utf8"),
      boardPngMarker
    );
    assert.ok(
      manifest.slots[0].candidates.every((candidate) => candidate.absoluteDownloadPath)
    );
  } finally {
    if (originalKey !== undefined) {
      process.env.PEXELS_API_KEY = originalKey;
    } else {
      delete process.env.PEXELS_API_KEY;
    }
    await rm(dir, { recursive: true, force: true });
  }
});

test("asset generation auto-suggests slots when media is absent", async () => {
  const spec = await loadFigureSpec(resolve(specDir, "slide-02-proof-tiles.json"));
  const dir = await makeTempDir();
  const specPath = join(dir, "spec-no-media.json");
  const originalKey = process.env.PEXELS_API_KEY;
  process.env.PEXELS_API_KEY = "test-key";

  const fakeImportPlaywright = async () => ({
    chromium: {
      launch: async () => ({
        newPage: async () => ({
          goto: async () => {},
          screenshot: async ({ path }) => {
            await writeFile(path, "auto-board", "utf8");
          },
          close: async () => {},
        }),
        close: async () => {},
      }),
    },
  });

  const fakeFetch = async (url, options = {}) => {
    const href = String(url);
    if (href.startsWith("https://api.pexels.com/v1/search")) {
      assert.equal(options.headers.Authorization, "test-key");
      return new Response(
        JSON.stringify({
          photos: [
            {
              id: 201,
              width: 2400,
              height: 1600,
              url: "https://www.pexels.com/photo/mock-201/",
              photographer: "Auto One",
              photographer_url: "https://www.pexels.com/@auto-one",
              avg_color: "#335577",
              src: {
                large2x: "https://images.example.test/photo-201.jpeg",
              },
              alt: "Doctor team discussing appointment backlog",
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }
      );
    }

    if (href.startsWith("https://images.example.test/")) {
      return new Response(new Uint8Array([9, 8, 7]), {
        status: 200,
        headers: {
          "content-type": "image/jpeg",
        },
      });
    }

    throw new Error(`Unexpected fetch URL: ${href}`);
  };

  try {
    await writeJson(specPath, spec);

    const result = await generateFigureAssets({
      specPath,
      outputDir: dir,
      fetchImpl: fakeFetch,
      importPlaywrightImpl: fakeImportPlaywright,
    });

    assert.equal(result.manifest.slotMode, "auto");
    assert.equal(result.manifest.slots.length, 2);
    assert.ok(
      result.manifest.slots.every((slot) => slot.autoGenerated === true)
    );
  } finally {
    if (originalKey !== undefined) {
      process.env.PEXELS_API_KEY = originalKey;
    } else {
      delete process.env.PEXELS_API_KEY;
    }
    await rm(dir, { recursive: true, force: true });
  }
});

test("asset generation prefers more diverse photographers within a slot", async () => {
  const spec = await loadFigureSpec(resolve(specDir, "slide-02-proof-tiles.json"));
  const dir = await makeTempDir();
  const specPath = join(dir, "spec-diversity.json");
  const originalKey = process.env.PEXELS_API_KEY;
  process.env.PEXELS_API_KEY = "test-key";

  const fakeFetch = async (url, options = {}) => {
    const href = String(url);
    if (href.startsWith("https://api.pexels.com/v1/search")) {
      assert.equal(options.headers.Authorization, "test-key");
      return new Response(
        JSON.stringify({
          photos: [
            {
              id: 301,
              width: 2400,
              height: 1600,
              url: "https://www.pexels.com/photo/mock-301/",
              photographer: "Repeat Photographer",
              photographer_url: "https://www.pexels.com/@repeat",
              avg_color: "#8899AA",
              src: {
                large2x: "https://images.example.test/photo-301.jpeg",
              },
              alt: "Busy clinic reception counter with patient waiting",
            },
            {
              id: 302,
              width: 2350,
              height: 1550,
              url: "https://www.pexels.com/photo/mock-302/",
              photographer: "Repeat Photographer",
              photographer_url: "https://www.pexels.com/@repeat",
              avg_color: "#778899",
              src: {
                large2x: "https://images.example.test/photo-302.jpeg",
              },
              alt: "Clinic reception desk helping waiting patient indoors",
            },
            {
              id: 303,
              width: 2300,
              height: 1500,
              url: "https://www.pexels.com/photo/mock-303/",
              photographer: "Different Photographer",
              photographer_url: "https://www.pexels.com/@different",
              avg_color: "#667788",
              src: {
                large2x: "https://images.example.test/photo-303.jpeg",
              },
              alt: "Medical receptionist assisting patients at front desk",
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }
      );
    }

    if (href.startsWith("https://images.example.test/")) {
      return new Response(new Uint8Array([5, 4, 3, 2]), {
        status: 200,
        headers: {
          "content-type": "image/jpeg",
        },
      });
    }

    throw new Error(`Unexpected fetch URL: ${href}`);
  };

  try {
    await writeJson(specPath, {
      ...spec,
      media: {
        slots: [
          {
            id: "hero-photo",
            label: "Hero photo",
            query: "clinic reception patients waiting",
            orientation: "landscape",
            maxCandidates: 2,
          },
        ],
      },
    });

    const result = await generateFigureAssets({
      specPath,
      outputDir: dir,
      fetchImpl: fakeFetch,
      importPlaywrightImpl: makeFakeImportPlaywright("diversity-board"),
    });

    const photographers = result.manifest.slots[0].candidates.map(
      (candidate) => candidate.photographer
    );
    assert.deepEqual(photographers, [
      "Repeat Photographer",
      "Different Photographer",
    ]);
  } finally {
    if (originalKey !== undefined) {
      process.env.PEXELS_API_KEY = originalKey;
    } else {
      delete process.env.PEXELS_API_KEY;
    }
    await rm(dir, { recursive: true, force: true });
  }
});

test("standalone image request writes board artifacts without downloads", async () => {
  const dir = await makeTempDir();
  const originalKey = process.env.PEXELS_API_KEY;
  process.env.PEXELS_API_KEY = "test-key";

  const fakeFetch = async (url, options = {}) => {
    const href = String(url);
    if (href.startsWith("https://api.pexels.com/v1/search")) {
      assert.equal(options.headers.Authorization, "test-key");
      const query = new URL(href).searchParams.get("query") ?? "";
      let photos = [];

      if (query.includes("atmosphere") || query.includes("texture")) {
        photos = [
          {
            id: 506,
            width: 2200,
            height: 1500,
            url: "https://www.pexels.com/photo/mock-506/",
            photographer: "Atmos One",
            photographer_url: "https://www.pexels.com/@atmos-one",
            avg_color: "#C0C7CF",
            src: {
              large2x: "https://images.example.test/photo-506.jpeg",
            },
            alt: "Quiet clinic lobby texture",
          },
        ];
      } else if (query.includes("healthcare") || query.includes("clinic")) {
        photos = [
          {
            id: 501,
            width: 2400,
            height: 1600,
            url: "https://www.pexels.com/photo/mock-501/",
            photographer: "Literal One",
            photographer_url: "https://www.pexels.com/@literal-one",
            avg_color: "#8899AA",
            src: {
              large2x: "https://images.example.test/photo-501.jpeg",
            },
            alt: "Clinic waiting room staff coordinating",
          },
          {
            id: 504,
            width: 2500,
            height: 1600,
            url: "https://www.pexels.com/photo/mock-504/",
            photographer: "Domain Two",
            photographer_url: "https://www.pexels.com/@domain-two",
            avg_color: "#556677",
            src: {
              large2x: "https://images.example.test/photo-504.jpeg",
            },
            alt: "Healthcare operations team in waiting area",
          },
          {
            id: 505,
            width: 2100,
            height: 1400,
            url: "https://www.pexels.com/photo/mock-505/",
            photographer: "Domain Three",
            photographer_url: "https://www.pexels.com/@domain-three",
            avg_color: "#778899",
            src: {
              large2x: "https://images.example.test/photo-505.jpeg",
            },
            alt: "Clinic reception coordination",
          },
        ];
      } else {
        photos = [
          {
            id: 501,
            width: 2400,
            height: 1600,
            url: "https://www.pexels.com/photo/mock-501/",
            photographer: "Literal One",
            photographer_url: "https://www.pexels.com/@literal-one",
            avg_color: "#8899AA",
            src: {
              large2x: "https://images.example.test/photo-501.jpeg",
            },
            alt: "Clinic waiting room staff coordinating",
          },
          {
            id: 502,
            width: 2300,
            height: 1500,
            url: "https://www.pexels.com/photo/mock-502/",
            photographer: "Literal Two",
            photographer_url: "https://www.pexels.com/@literal-two",
            avg_color: "#445566",
            src: {
              large2x: "https://images.example.test/photo-502.jpeg",
            },
            alt: "Patient waiting room scheduling pressure",
          },
          {
            id: 503,
            width: 2000,
            height: 1400,
            url: "https://www.pexels.com/photo/mock-503/",
            photographer: "Literal Three",
            photographer_url: "https://www.pexels.com/@literal-three",
            avg_color: "#334455",
            src: {
              large2x: "https://images.example.test/photo-503.jpeg",
            },
            alt: "Front desk scheduling team",
          },
        ];
      }

      return new Response(JSON.stringify({ photos }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }

    throw new Error(`Unexpected fetch URL: ${href}`);
  };

  try {
    const result = await generateStandaloneImageAssets({
      purpose: "Clinic waiting room scheduling pressure",
      orientation: "landscape",
      count: 5,
      outputDir: dir,
      download: false,
      fetchImpl: fakeFetch,
      importPlaywrightImpl: makeFakeImportPlaywright("standalone-board"),
    });

    const manifest = await readJson(result.paths.assetsManifestPath);
    const candidateIds = manifest.slots.flatMap((slot) =>
      slot.candidates.map((candidate) => candidate.id)
    );

    assert.equal(manifest.mode, "standalone");
    assert.equal(manifest.slotMode, "purpose");
    assert.equal(manifest.download, false);
    assert.equal(manifest.purpose, "Clinic waiting room scheduling pressure");
    assert.equal(manifest.slots.length, 4);
    assert.equal(candidateIds.length, 5);
    assert.equal(new Set(candidateIds).size, candidateIds.length);
    assert.ok(
      manifest.slots.every((slot) =>
        slot.candidates.every(
          (candidate) =>
            candidate.absoluteDownloadPath === null &&
            candidate.relativeDownloadPath === null
        )
      )
    );
    assert.equal(
      await readFile(result.paths.assetBoardPngPath, "utf8"),
      "standalone-board"
    );
    assert.equal(existsSync(join(dir, "assets")), false);
  } finally {
    if (originalKey !== undefined) {
      process.env.PEXELS_API_KEY = originalKey;
    } else {
      delete process.env.PEXELS_API_KEY;
    }
    await rm(dir, { recursive: true, force: true });
  }
});

test("approved-only standalone requests stay registry-only and skip live search", async () => {
  const dir = await makeTempDir();
  const originalKey = process.env.PEXELS_API_KEY;
  delete process.env.PEXELS_API_KEY;

  try {
    const result = await generateStandaloneImageAssets({
      purpose: "Quiet clinic atmosphere",
      approvedOnly: true,
      outputDir: dir,
      download: false,
      fetchImpl: async () => {
        throw new Error("fetch should not run for approved-only requests");
      },
      importPlaywrightImpl: makeFakeImportPlaywright("approved-only-board"),
    });

    assert.equal(result.manifest.mode, "standalone");
    assert.equal(result.manifest.request.approvedOnly, true);
    assert.equal(
      await readFile(result.paths.assetBoardPngPath, "utf8"),
      "approved-only-board"
    );
  } finally {
    if (originalKey !== undefined) {
      process.env.PEXELS_API_KEY = originalKey;
    }
    await rm(dir, { recursive: true, force: true });
  }
});

test("asset selection writes selection and render-assets manifests", async () => {
  const spec = await loadFigureSpec(resolve(specDir, "slide-02-proof-tiles.json"));
  const dir = await makeTempDir();
  const specPath = join(dir, "spec-select.json");
  const originalKey = process.env.PEXELS_API_KEY;
  process.env.PEXELS_API_KEY = "test-key";

  const fakeFetch = async (url, options = {}) => {
    const href = String(url);
    if (href.startsWith("https://api.pexels.com/v1/search")) {
      assert.equal(options.headers.Authorization, "test-key");
      return new Response(
        JSON.stringify({
          photos: [
            {
              id: 701,
              width: 2400,
              height: 1600,
              url: "https://www.pexels.com/photo/mock-701/",
              photographer: "Selector One",
              photographer_url: "https://www.pexels.com/@selector-one",
              avg_color: "#8899AA",
              src: {
                large2x: "https://images.example.test/photo-701.jpeg",
              },
              alt: "Clinic reception pressure scene",
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }
      );
    }

    if (href.startsWith("https://images.example.test/")) {
      return new Response(new Uint8Array([1, 7, 0, 1]), {
        status: 200,
        headers: {
          "content-type": "image/jpeg",
        },
      });
    }

    throw new Error(`Unexpected fetch URL: ${href}`);
  };

  try {
    await writeJson(specPath, {
      ...spec,
      media: {
        strategy: "photo",
        slots: [
          {
            id: "hero-photo",
            label: "Hero photo",
            role: "hero",
            query: "clinic reception pressure",
            orientation: "landscape",
            maxCandidates: 1,
          },
        ],
      },
    });

    const generated = await generateFigureAssets({
      specPath,
      outputDir: dir,
      fetchImpl: fakeFetch,
      importPlaywrightImpl: makeFakeImportPlaywright("selection-board"),
    });
    const selected = await selectAssetCandidate({
      dir: generated.paths.dir,
      slotId: "hero-photo",
      candidateId: "701",
      status: "approved",
    });

    assert.equal(selected.selected?.assetId, "pexels:701");
    const selectionDoc = await readJson(generated.paths.assetSelectionPath);
    const renderAssets = await readJson(generated.paths.renderAssetsPath);
    assert.equal(selectionDoc.decisions.length, 1);
    assert.equal(renderAssets.selections.length, 1);
    assert.equal(renderAssets.selections[0].placement, "hero");
    assert.ok(renderAssets.selections[0].src);
  } finally {
    if (originalKey !== undefined) {
      process.env.PEXELS_API_KEY = originalKey;
    } else {
      delete process.env.PEXELS_API_KEY;
    }
    await rm(dir, { recursive: true, force: true });
  }
});

test("applying selected assets writes selectedAssetRef back into the spec", async () => {
  const spec = await loadFigureSpec(resolve(specDir, "slide-02-proof-tiles.json"));
  const dir = await makeTempDir();
  const specPath = join(dir, "spec-apply.json");
  const originalKey = process.env.PEXELS_API_KEY;
  process.env.PEXELS_API_KEY = "test-key";

  const fakeFetch = async (url, options = {}) => {
    const href = String(url);
    if (href.startsWith("https://api.pexels.com/v1/search")) {
      assert.equal(options.headers.Authorization, "test-key");
      return new Response(
        JSON.stringify({
          photos: [
            {
              id: 801,
              width: 2400,
              height: 1600,
              url: "https://www.pexels.com/photo/mock-801/",
              photographer: "Apply One",
              photographer_url: "https://www.pexels.com/@apply-one",
              avg_color: "#8899AA",
              src: {
                large2x: "https://images.example.test/photo-801.jpeg",
              },
              alt: "Front-desk scheduling scene",
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }
      );
    }

    if (href.startsWith("https://images.example.test/")) {
      return new Response(new Uint8Array([8, 0, 1]), {
        status: 200,
        headers: {
          "content-type": "image/jpeg",
        },
      });
    }

    throw new Error(`Unexpected fetch URL: ${href}`);
  };

  try {
    await writeJson(specPath, {
      ...spec,
      media: {
        strategy: "photo",
        slots: [
          {
            id: "hero-photo",
            label: "Hero photo",
            role: "hero",
            query: "front desk scheduling scene",
            orientation: "landscape",
            maxCandidates: 1,
          },
        ],
      },
    });

    const generated = await generateFigureAssets({
      specPath,
      outputDir: dir,
      fetchImpl: fakeFetch,
      importPlaywrightImpl: makeFakeImportPlaywright("apply-board"),
    });
    await selectAssetCandidate({
      dir: generated.paths.dir,
      slotId: "hero-photo",
      candidateId: "801",
      status: "approved",
    });
    const applied = await applySelectedAssets({
      specPath,
      outputDir: dir,
    });

    assert.equal(
      applied.spec.media.slots[0].selectedAssetRef.assetId,
      "pexels:801"
    );
    assert.equal(
      applied.spec.media.slots[0].selectedAssetRef.status,
      "in_use"
    );
  } finally {
    if (originalKey !== undefined) {
      process.env.PEXELS_API_KEY = originalKey;
    } else {
      delete process.env.PEXELS_API_KEY;
    }
    await rm(dir, { recursive: true, force: true });
  }
});

test("asset report summarizes registry usage", async () => {
  const report = await buildAssetReport();
  assert.ok(typeof report.totalAssets === "number");
  assert.ok(report.statusCounts && typeof report.statusCounts === "object");
  assert.ok(Array.isArray(report.topReused));
});

test("export skips image search when disabled", async () => {
  const dir = await makeTempDir();
  const specPath = resolve(specDir, "slide-03-segmented-focus-bar.json");
  let imageCallCount = 0;

  try {
    const result = await exportFigure({
      specPath,
      outputDir: dir,
      enableImages: false,
      generateAssetsImpl: async () => {
        imageCallCount += 1;
      },
      importPlaywrightImpl: makeFakeImportPlaywright("export-no-images"),
    });

    assert.equal(imageCallCount, 0);
    assert.equal(await readFile(result.paths.pngPath, "utf8"), "export-no-images");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("export tolerates asset-search failure and still writes the PNG", async () => {
  const dir = await makeTempDir();
  const specPath = resolve(specDir, "slide-03-segmented-focus-bar.json");
  const originalKey = process.env.PEXELS_API_KEY;
  delete process.env.PEXELS_API_KEY;

  try {
    const result = await exportFigure({
      specPath,
      outputDir: dir,
      enableImages: true,
      importPlaywrightImpl: makeFakeImportPlaywright("export-best-effort"),
    });

    assert.equal(await readFile(result.paths.pngPath, "utf8"), "export-best-effort");
  } finally {
    if (originalKey !== undefined) {
      process.env.PEXELS_API_KEY = originalKey;
    }
    await rm(dir, { recursive: true, force: true });
  }
});

test("Claude assessment parser accepts fenced and unfenced JSON", () => {
  const base = JSON.stringify({
    timestamp: "2026-03-23T12:00:00.000Z",
    slug: "demo",
    family: "proof_tiles",
    summary: "Looks solid.",
    issues: [],
    scores: {
      overall: 8.2,
      categories: {
        specFidelity: 8,
        focalHierarchy: 8,
        conceptualClarity: 9,
        deckConsistency: 8,
        restraintPolish: 8,
        readabilityAtSlideScale: 8
      }
    },
    suggestedUpgrades: [],
    pass: true
  });

  assert.deepEqual(
    parseClaudeAssessment({ rawOutput: base, strictJson: true }),
    JSON.parse(base)
  );

  assert.deepEqual(
    parseClaudeAssessment({
      rawOutput: `\`\`\`json\n${base}\n\`\`\``,
      strictJson: false,
    }),
    JSON.parse(base)
  );

  assert.deepEqual(
    parseClaudeAssessment({
      rawOutput: `Here is the requested JSON.\n\n\`\`\`json\n${base}\n\`\`\``,
      strictJson: true,
    }),
    JSON.parse(base)
  );
});

test("Claude ideation parser accepts fenced and unfenced JSON", () => {
  const base = JSON.stringify({
    summary: "Strong scheduling-led directions.",
    ideas: [
      {
        name: "Booked-Out Month View",
        composition: "Calendar with week-4 opening.",
        placement: "Upper-middle.",
        assetMode: "native",
        imageQueries: [],
        whyItWorks: "Turns the stat into a visual object.",
        mainRisk: "Can feel expected."
      }
    ],
    shortlist: ["Booked-Out Month View"],
    selectionAdvice: "Prefer the option that unifies both proof stats."
  });

  assert.deepEqual(
    parseClaudeIdeation({ rawOutput: base, strictJson: true }),
    JSON.parse(base)
  );

  assert.deepEqual(
    parseClaudeIdeation({
      rawOutput: `\`\`\`json\n${base}\n\`\`\``,
      strictJson: false,
    }),
    JSON.parse(base)
  );

  assert.deepEqual(
    parseClaudeIdeation({
      rawOutput: `Here is the requested JSON.\n\n\`\`\`json\n${base}\n\`\`\``,
      strictJson: true,
    }),
    JSON.parse(base)
  );
});

test("provider=none writes a clean assessment without model execution", async () => {
  const spec = await loadFigureSpec(resolve(specDir, "slide-04-transformation-flow.json"));
  const dir = await makeTempDir();
  const policyPath = join(dir, "policy.json");

  try {
    await seedArtifacts({ dir, spec });
    await writeJson(policyPath, {
      assessor: {
        provider: "none",
        strictJson: true,
      },
    });

    const result = await assessFigureDir({ dir, policyPath });
    assert.equal(result.provider, "none");
    assert.equal(result.assessment.pass, null);
    assert.match(result.assessment.summary, /assessment skipped/i);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("provider=auto falls back to none when no model key is available", async () => {
  const spec = await loadFigureSpec(resolve(specDir, "slide-04-transformation-flow.json"));
  const dir = await makeTempDir();
  const policyPath = join(dir, "policy.json");
  const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
  const originalYsnAnthropicKey = process.env.YSN_ANTHROPIC_API_KEY;
  const originalOpenAIKey = process.env.OPENAI_API_KEY;
  const originalYsnOpenAIKey = process.env.YSN_OPENAI_API_KEY;

  try {
    await seedArtifacts({ dir, spec });
    await writeJson(policyPath, {
      assessor: {
        provider: "auto",
        strictJson: true,
      },
    });

    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.YSN_ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.YSN_OPENAI_API_KEY;

    const result = await assessFigureDir({ dir, policyPath });
    assert.equal(result.provider, "none");
    assert.equal(result.assessment.pass, null);
  } finally {
    if (originalAnthropicKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
    }
    if (originalYsnAnthropicKey === undefined) {
      delete process.env.YSN_ANTHROPIC_API_KEY;
    } else {
      process.env.YSN_ANTHROPIC_API_KEY = originalYsnAnthropicKey;
    }
    if (originalOpenAIKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAIKey;
    }
    if (originalYsnOpenAIKey === undefined) {
      delete process.env.YSN_OPENAI_API_KEY;
    } else {
      process.env.YSN_OPENAI_API_KEY = originalYsnOpenAIKey;
    }
    await rm(dir, { recursive: true, force: true });
  }
});

test("missing Anthropic key throws the expected remediation error", async () => {
  const spec = await loadFigureSpec(resolve(specDir, "slide-02-proof-tiles.json"));
  const dir = await makeTempDir();
  const policyPath = join(dir, "policy.json");
  const originalKey = process.env.ANTHROPIC_API_KEY;
  const originalYsnKey = process.env.YSN_ANTHROPIC_API_KEY;

  try {
    await seedArtifacts({ dir, spec });
    await writeJson(policyPath, {
      assessor: {
        provider: "claude",
        strictJson: true,
      },
    });

    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.YSN_ANTHROPIC_API_KEY;
    await assert.rejects(
      () => assessFigureDir({ dir, policyPath }),
      /Anthropic API key|Anthropic API key is available/
    );
  } finally {
    if (originalKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalKey;
    }
    if (originalYsnKey === undefined) {
      delete process.env.YSN_ANTHROPIC_API_KEY;
    } else {
      process.env.YSN_ANTHROPIC_API_KEY = originalYsnKey;
    }
    await rm(dir, { recursive: true, force: true });
  }
});
