#!/usr/bin/env node
import { getArg, hasFlag } from "./lib/io.mjs";
import { refineImageRequest } from "./lib/assets.mjs";

const args = process.argv.slice(2);

const usage = () => {
  console.log(
    [
      "Refine an existing image request or figure asset board",
      "",
      "Usage:",
      "  node scripts/figures/images-refine.mjs --dir <outputDir> [--purpose <text>] [--orientation <landscape|portrait|square>] [--color <value>] [--style <text>] [--mood <text>] [--shot <text>] [--people <text>] [--copy-safe <left|right|top|bottom|center>] [--provider <id>] [--approved-only] [--reuse-from <text>] [--count <n>] [--no-download]",
    ].join("\n")
  );
};

const main = async () => {
  if (hasFlag(args, "help") || hasFlag(args, "h")) {
    usage();
    return;
  }

  const dir = getArg(args, "dir");
  if (!dir) {
    usage();
    process.exitCode = 1;
    return;
  }

  const result = await refineImageRequest({
    dir,
    purpose: getArg(args, "purpose") ?? "",
    orientation: getArg(args, "orientation") ?? "",
    color: getArg(args, "color") ?? "",
    style: getArg(args, "style") ?? "",
    mood: getArg(args, "mood") ?? "",
    shot: getArg(args, "shot") ?? "",
    people: getArg(args, "people") ?? "",
    copySafe: getArg(args, "copy-safe") ?? "",
    provider: getArg(args, "provider") ?? "",
    approvedOnly: hasFlag(args, "approved-only") ? true : null,
    reuseFrom: getArg(args, "reuse-from") ?? "",
    count: getArg(args, "count") ? Number(getArg(args, "count")) : null,
    download: hasFlag(args, "no-download") ? false : null,
  });

  console.log(`Refined image request for ${result.manifest.slug}`);
  console.log(result.paths.assetsManifestPath);
  console.log(result.paths.assetBoardPngPath);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
