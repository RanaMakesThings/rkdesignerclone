import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { resolveDesignerExportHtml } from "./designer-slide-export.ts";

const makeTempDir = async () => mkdtemp(join(tmpdir(), "ysn-designer-export-"));

test("resolveDesignerExportHtml inlines shared CSS for shared-css versions", async () => {
  const dir = await makeTempDir();

  try {
    const htmlPath = resolve(dir, "slide.html");
    const cssPath = resolve(dir, "design-system", "vox-shared.css");
    await mkdir(resolve(dir, "design-system"), { recursive: true });
    await writeFile(
      htmlPath,
      [
        "<!doctype html>",
        "<html>",
        "<head>",
        '  <link rel="stylesheet" href="design-system/vox-shared.css" data-designer-shared-css="true" />',
        "</head>",
        "<body><main>preview</main></body>",
        "</html>",
        "",
      ].join("\n"),
      "utf8"
    );
    await writeFile(cssPath, "body { color: red; }\n", "utf8");

    const exportedHtml = await resolveDesignerExportHtml({
      repoRoot: dir,
      htmlPath: "slide.html",
      mode: "shared-css",
      sharedCssPath: "design-system/vox-shared.css",
    });

    assert.match(exportedHtml, /<style data-designer-shared-css="true">/);
    assert.match(exportedHtml, /body \{ color: red; \}/);
    assert.doesNotMatch(exportedHtml, /<link rel="stylesheet"/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("resolveDesignerExportHtml leaves non-shared-css versions unchanged", async () => {
  const dir = await makeTempDir();

  try {
    const htmlPath = resolve(dir, "slide.html");
    const sourceHtml = "<!doctype html><html><body>plain</body></html>\n";
    await writeFile(htmlPath, sourceHtml, "utf8");

    const exportedHtml = await resolveDesignerExportHtml({
      repoRoot: dir,
      htmlPath: "slide.html",
      mode: null,
      sharedCssPath: null,
    });

    assert.equal(exportedHtml, sourceHtml);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
