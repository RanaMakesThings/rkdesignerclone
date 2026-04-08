import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeReportHtml } from "./report-sanitize.ts";

const baseContext = {
  repoRoot: "/repo",
  reportAbsolutePath: "/repo/projects/designer-health/slide-figures/slide-06/report.html",
  isAllowedPath: (repoRelativePath: string) =>
    new Set([
      "projects/designer-health/slide-figures/slide-06/figure.png",
      "projects/designer-health/slide-figures/slide-06/report.html",
      "projects/designer-health/slide-figures/slide-11/report.html",
    ]).has(repoRelativePath),
  projectId: "designer-health",
};

test("sanitizeReportHtml strips scripts and inline event handlers", () => {
  const html = `<div onclick="boom()"><script>alert(1)</script><p>ok</p></div>`;
  const sanitized = sanitizeReportHtml(html, baseContext);

  assert.ok(!sanitized.includes("<script"));
  assert.ok(!sanitized.includes("onclick="));
  assert.ok(sanitized.includes("<p>ok</p>"));
});

test("sanitizeReportHtml rewrites allowlisted relative sources to /api/file", () => {
  const html = `<img src="figure.png" alt="preview" />`;
  const sanitized = sanitizeReportHtml(html, baseContext);

  assert.ok(
    sanitized.includes(
      `src="/api/file?path=projects%2Fdesigner-health%2Fslide-figures%2Fslide-06%2Ffigure.png&projectId=designer-health"`
    )
  );
});

test("sanitizeReportHtml rewrites allowlisted stylesheet links to /api/file", () => {
  const html = `<link rel="stylesheet" href="figure.css" />`;
  const sanitized = sanitizeReportHtml(html, {
    ...baseContext,
    isAllowedPath: (repoRelativePath: string) =>
      new Set([
        "projects/designer-health/slide-figures/slide-06/figure.css",
        "projects/designer-health/slide-figures/slide-06/report.html",
      ]).has(repoRelativePath),
  });

  assert.ok(
    sanitized.includes(
      `href="/api/file?path=projects%2Fdesigner-health%2Fslide-figures%2Fslide-06%2Ffigure.css&projectId=designer-health"`
    )
  );
});

test("sanitizeReportHtml blocks unallowlisted stylesheet links", () => {
  const html = `<link rel="stylesheet" href="../../../../secret.css" />`;
  const sanitized = sanitizeReportHtml(html, baseContext);

  assert.ok(sanitized.includes(`href="#"`));
  assert.ok(!sanitized.includes("secret.css"));
});

test("sanitizeReportHtml rewrites allowlisted report links to /api/report", () => {
  const html = `<a href="../slide-11/report.html">next report</a>`;
  const sanitized = sanitizeReportHtml(html, baseContext);

  assert.ok(
    sanitized.includes(
      `href="/api/report?path=projects%2Fdesigner-health%2Fslide-figures%2Fslide-11%2Freport.html&projectId=designer-health"`
    )
  );
});

test("sanitizeReportHtml neutralizes file:// links", () => {
  const html = `<a href="file:///Users/me/secrets.txt">local</a>`;
  const sanitized = sanitizeReportHtml(html, baseContext);

  assert.ok(sanitized.includes(`href="#"`));
  assert.ok(!sanitized.includes("file:///Users/me/secrets.txt"));
});
