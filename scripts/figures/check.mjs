#!/usr/bin/env node
import { getArg, hasFlag } from "./lib/io.mjs";
import { checkFigure } from "./lib/pipeline.mjs";

const args = process.argv.slice(2);

const usage = () => {
  console.log(
    [
      "Figure check",
      "",
      "Usage:",
      "  node scripts/figures/check.mjs --spec <path> [--out <dir>]",
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
  if (!specPath) {
    usage();
    process.exitCode = 1;
    return;
  }

  const result = await checkFigure({ specPath, outputDir });
  console.log(
    `Coverage ${result.coverage.pass ? "passed" : "failed"} for ${
      result.spec.meta.slug
    }`
  );
  console.log(result.paths.coveragePath);

  if (!result.coverage.pass) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
