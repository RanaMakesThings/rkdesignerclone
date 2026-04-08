#!/usr/bin/env node
import { generateFigureAssets } from "./lib/assets.mjs";
import { getArg, hasFlag } from "./lib/io.mjs";

const args = process.argv.slice(2);

const usage = () => {
  console.log(
    [
      "Figure assets",
      "",
      "Usage:",
      "  node scripts/figures/assets.mjs --spec <path> [--out <dir>] [--approved-only] [--reuse-from <text>]",
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
  const approvedOnly = hasFlag(args, "approved-only");
  const reuseFrom = getArg(args, "reuse-from") ?? "";
  if (!specPath) {
    usage();
    process.exitCode = 1;
    return;
  }

  const result = await generateFigureAssets({
    specPath,
    outputDir,
    approvedOnly,
    reuseFrom,
  });
  console.log(`Generated asset board for ${result.spec.meta.slug}`);
  console.log(result.paths.assetsManifestPath);
  console.log(result.paths.assetSelectionPath);
  console.log(result.paths.renderAssetsPath);
  console.log(result.paths.assetBoardPngPath);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
