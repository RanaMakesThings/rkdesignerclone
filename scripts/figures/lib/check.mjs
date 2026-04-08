import { existsSync } from "node:fs";
const normalizeText = (value) => String(value ?? "").toLowerCase();
const pathExists = (filePath) => (filePath ? existsSync(filePath) : false);

const extractVisibleText = (html) =>
  String(html ?? "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replace(/\s+/g, " ")
    .trim();

const REQUIRED_TRACE_TARGETS = (spec) => {
  const targets = [
    "constraints.figureJob",
    "constraints.focalPoint",
    "constraints.layout",
  ];

  if (spec.chrome.title) {
    targets.push("chrome.title");
  }
  if (spec.chrome.subtitle) {
    targets.push("chrome.subtitle");
  }
  if (spec.copyPolicy.locked.length > 0) {
    targets.push("copyPolicy.locked");
  }
  return targets;
};

const hasTargetPrefix = (trace, target) =>
  trace.some((entry) => entry.targetPath === target || entry.targetPath.startsWith(`${target}.`));

const makeCheck = (id, pass, message, severity = "error", details = null) => ({
  id,
  pass,
  severity,
  message,
  details,
});

const hasDisplayText = (displayText, needle) =>
  normalizeText(displayText).includes(normalizeText(needle));

const semanticChecks = (spec, allText) => {
  const checks = [];
  const guards = new Set(spec.constraints.semanticGuards);
  const combined = normalizeText(allText.join("\n"));

  if (guards.has("avoid_exact_time_claim")) {
    const pass = !/\b\d+\s*(minute|minutes|min)\b/.test(combined);
    checks.push(
      makeCheck(
        "semantic.exact-time-claim",
        pass,
        pass
          ? "No displayed exact-time claim detected."
          : "Displayed copy includes an exact-time claim despite the guard."
      )
    );
  }

  if (guards.has("no_fake_precision")) {
    const pass = !/\b\d+\.\d+\b/.test(combined) && !/%/.test(combined);
    checks.push(
      makeCheck(
        "semantic.fake-precision",
        pass,
        pass
          ? "No visibly precise numeric claims detected."
          : "Displayed copy includes precision or percentages despite the guard."
      )
    );
  }

  if (guards.has("no_ui")) {
    checks.push(
      makeCheck(
        "semantic.no-ui",
        true,
        "Figure family renders conceptual objects only; no product UI chrome emitted.",
        "info"
      )
    );
  }

  if (
    guards.has("focused_segment_not_largest") &&
    spec.meta.family === "segmented_focus_bar"
  ) {
    const segments = spec.body.segments ?? [];
    const focus = segments.find((segment) => segment.role === "focus");
    const otherWidths = segments
      .filter((segment) => segment.role !== "focus")
      .map((segment) => Number(segment.width));
    const focusWidth = Number(focus?.width ?? 0);
    const largestOther = otherWidths.length > 0 ? Math.max(...otherWidths) : 0;
    const pass = focusWidth <= largestOther || largestOther === 0;
    checks.push(
      makeCheck(
        "semantic.focused-segment-dominance",
        pass,
        pass
          ? "Focused segment is not larger than the largest comparison segment."
          : "Focused segment is larger than every comparison segment."
      )
    );
  }

  if (
    guards.has("focus_segment_reasonable_share") &&
    spec.meta.family === "segmented_focus_bar"
  ) {
    const focus = spec.body.segments.find((segment) => segment.role === "focus");
    const width = Number(focus?.width ?? 0);
    const asPercent = width <= 1 ? width * 100 : width;
    const pass = asPercent >= 18 && asPercent <= 42;
    checks.push(
      makeCheck(
        "semantic.focused-segment-share",
        pass,
        pass
          ? "Focused segment stays within the conceptual-share range."
          : "Focused segment falls outside the conceptual-share range."
      )
    );
  }

  return checks;
};

export const buildCoverageReport = ({
  spec,
  paths,
  html,
  expectImages = null,
}) => {
  const htmlText = typeof html === "string" ? html : "";
  const displayText = extractVisibleText(htmlText);
  const trace = spec.trace ?? [];
  const forbiddenNeedles = [...spec.copyPolicy.forbidden];
  const shouldExpectImages =
    expectImages === null ? (spec.media?.slots ?? []).length > 0 : Boolean(expectImages);

  const checks = [];

  checks.push(
    makeCheck(
      "artifacts.html",
      pathExists(paths.htmlPath),
      pathExists(paths.htmlPath)
        ? "Rendered HTML artifact exists."
        : "Rendered HTML artifact is missing."
    )
  );

  checks.push(
    makeCheck(
      "artifacts.png",
      true,
      pathExists(paths.pngPath)
        ? "PNG artifact exists."
        : "PNG artifact is missing; run `figures:export` to generate it.",
      "info"
    )
  );

  if (shouldExpectImages) {
    checks.push(
      makeCheck(
        "artifacts.assets-manifest",
        pathExists(paths.assetsManifestPath),
        pathExists(paths.assetsManifestPath)
          ? "Asset manifest exists."
          : "Asset manifest is missing."
      )
    );

    checks.push(
      makeCheck(
        "artifacts.asset-board-html",
        pathExists(paths.assetBoardHtmlPath),
        pathExists(paths.assetBoardHtmlPath)
          ? "Asset board HTML exists."
          : "Asset board HTML is missing."
      )
    );

    checks.push(
      makeCheck(
        "artifacts.asset-board-png",
        pathExists(paths.assetBoardPngPath),
        pathExists(paths.assetBoardPngPath)
          ? "Asset board PNG exists."
          : "Asset board PNG is missing."
      )
    );

    checks.push(
      makeCheck(
        "artifacts.asset-selection",
        pathExists(paths.assetSelectionPath),
        pathExists(paths.assetSelectionPath)
          ? "Asset selection manifest exists."
          : "Asset selection manifest is missing."
      )
    );

    checks.push(
      makeCheck(
        "artifacts.render-assets",
        pathExists(paths.renderAssetsPath),
        pathExists(paths.renderAssetsPath)
          ? "Render-assets manifest exists."
          : "Render-assets manifest is missing."
      )
    );
  }

  checks.push(
    makeCheck(
      "constraints.focal-point",
      Boolean(spec.constraints.focalPoint),
      spec.constraints.focalPoint
        ? "Focal point is declared."
        : "Focal point is missing."
    )
  );

  checks.push(
    makeCheck(
      "constraints.accent-targets",
      spec.constraints.accentTargets.length > 0,
      spec.constraints.accentTargets.length > 0
        ? "Accent targets are declared."
        : "Accent targets are missing."
    )
  );

  for (const locked of spec.copyPolicy.locked) {
    const pass = hasDisplayText(displayText, locked);
    checks.push(
      makeCheck(
        `copy.locked.${locked}`,
        pass,
        pass
          ? `Locked copy present: "${locked}".`
          : `Locked copy missing from rendered figure: "${locked}".`
      )
    );
  }

  for (const forbidden of forbiddenNeedles) {
    const pass = !hasDisplayText(displayText, forbidden);
    checks.push(
      makeCheck(
        `copy.forbidden.${forbidden}`,
        pass,
        pass
          ? `Forbidden copy absent: "${forbidden}".`
          : `Forbidden copy detected: "${forbidden}".`
      )
    );
  }

  for (const target of REQUIRED_TRACE_TARGETS(spec)) {
    const pass = hasTargetPrefix(trace, target);
    checks.push(
      makeCheck(
        `trace.${target}`,
        pass,
        pass
          ? `Trace covers ${target}.`
          : `Trace is missing a mapping entry for ${target}.`
      )
    );
  }

  checks.push(
    ...semanticChecks(spec, [displayText])
  );

  const failed = checks.filter((check) => !check.pass);
  return {
    generatedAt: new Date().toISOString(),
    slug: spec.meta.slug,
    family: spec.meta.family,
    pass: failed.length === 0,
    summary: {
      total: checks.length,
      passed: checks.length - failed.length,
      failed: failed.length,
    },
    checks,
  };
};
