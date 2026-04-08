#!/usr/bin/env node
import { getArg, hasFlag } from "./lib/io.mjs";
import { renderFigure } from "./lib/pipeline.mjs";
import { resolveVersionedOutputDir } from "./lib/slide-versioning.mjs";

const args = process.argv.slice(2);

const usage = () => {
  console.log(
    [
      "Figure render",
      "",
      "Usage:",
      "  node scripts/figures/render.mjs --spec <path> [--out <dir>]",
      "  node scripts/figures/render.mjs --spec <path> --project-root <path> --slide <slide-XX> [--version-id <id>]",
    ].join("\n")
  );
};

const main = async () => {
  if (hasFlag(args, "help") || hasFlag(args, "h")) {
    usage();
    return;
  }

  const specPath = getArg(args, "spec");
  const directOutputDir = getArg(args, "out");
  const slideId = getArg(args, "slide");
  const projectRoot = getArg(args, "project-root");
  const versionId = getArg(args, "version-id");
  if (!specPath) {
    usage();
    process.exitCode = 1;
    return;
  }
  if (slideId && !projectRoot) {
    throw new Error("--project-root is required when using --slide.");
  }
  if (directOutputDir && slideId) {
    throw new Error("Use either --out or --project-root/--slide/--version-id, not both.");
  }
  const outputDir = slideId
    ? await resolveVersionedOutputDir({
        projectRoot,
        slideId,
        versionId,
      })
    : directOutputDir;

  const result = await renderFigure({ specPath, outputDir });
  console.log(`Rendered ${result.spec.meta.slug}`);
  console.log(result.paths.htmlPath);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
