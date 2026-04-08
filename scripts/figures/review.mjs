#!/usr/bin/env node
import { getArg, hasFlag } from "./lib/io.mjs";
import { assessFigureDir } from "./lib/assessment.mjs";
import { checkFigure, exportFigure } from "./lib/pipeline.mjs";

const args = process.argv.slice(2);

const usage = () => {
  console.log(
    [
      "Figure review",
      "",
      "Usage:",
      "  node scripts/figures/review.mjs --spec <path> [--out <dir>] [--policy <path>] [--no-images]",
    ].join("\n")
  );
};

const main = async () => {
  if (hasFlag(args, "help") || hasFlag(args, "h")) {
    usage();
    return;
  }

  const specPath = getArg(args, "spec");
  const outputDir = getArg(args, "out");
  const policyPath = getArg(args, "policy");
  const enableImages = !hasFlag(args, "no-images");
  if (!specPath) {
    usage();
    process.exitCode = 1;
    return;
  }

  const exportResult = await exportFigure({ specPath, outputDir, enableImages });
  const checkResult = await checkFigure({
    specPath,
    outputDir,
    expectImages: enableImages ? null : false,
  });
  if (!checkResult.coverage.pass) {
    throw new Error(
      `Coverage failed for ${checkResult.spec.meta.slug}. Review loop aborted before model assessment.`
    );
  }

  const assessmentResult = await assessFigureDir({
    dir: exportResult.paths.dir,
    policyPath,
  });

  console.log(`Reviewed ${exportResult.spec.meta.slug}`);
  console.log(exportResult.paths.pngPath);
  console.log(`${assessmentResult.dir}/assessment.json`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
