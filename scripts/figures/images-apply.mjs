#!/usr/bin/env node
import { getArg, hasFlag } from "./lib/io.mjs";
import { applySelectedAssets } from "./lib/assets.mjs";

const args = process.argv.slice(2);

const usage = () => {
  console.log(
    [
      "Apply approved image selections to a figure spec",
      "",
      "Usage:",
      "  node scripts/figures/images-apply.mjs --spec <path> [--out <dir>]",
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

  const result = await applySelectedAssets({
    specPath,
    outputDir,
  });
  console.log(`Applied approved image selections to ${result.spec.meta.slug}`);
  console.log(specPath);
  console.log(result.paths.renderAssetsPath);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
