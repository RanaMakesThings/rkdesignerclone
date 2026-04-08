#!/usr/bin/env node
import { generateStandaloneImageAssets } from "./lib/assets.mjs";
import { hasFlag } from "./lib/io.mjs";
import { parseStandaloneImageRequestArgs } from "./lib/image-request.mjs";

const args = process.argv.slice(2);

const usage = () => {
  console.log(
    [
      "Figure image request",
      "",
      "Usage:",
      '  node scripts/figures/images.mjs --purpose "<text>" [--orientation <landscape|portrait|square>] [--color <value>] [--style <text>] [--mood <text>] [--shot <text>] [--people <text>] [--copy-safe <left|right|top|bottom|center>] [--provider <id>] [--approved-only] [--reuse-from <text>] [--count <n>] [--slug <slug>] [--out <dir>] [--no-download]',
    ].join("\n")
  );
};

const main = async () => {
  if (hasFlag(args, "help") || hasFlag(args, "h")) {
    usage();
    return;
  }

  const request = parseStandaloneImageRequestArgs(args);
  const result = await generateStandaloneImageAssets(request);
  console.log(`Generated image request board for ${result.request.slug}`);
  console.log(result.paths.dir);
  console.log(result.paths.assetsManifestPath);
  console.log(result.paths.assetSelectionPath);
  console.log(result.paths.renderAssetsPath);
  console.log(result.paths.assetBoardHtmlPath);
  console.log(result.paths.assetBoardPngPath);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
