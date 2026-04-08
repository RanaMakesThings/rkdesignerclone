#!/usr/bin/env node
import { resolve } from "node:path";
import { buildAssetReport } from "./lib/assets.mjs";
import { getArg, hasFlag, writeJson } from "./lib/io.mjs";

const args = process.argv.slice(2);

const usage = () => {
  console.log(
    [
      "Asset registry report",
      "",
      "Usage:",
      "  node scripts/figures/images-report.mjs [--dir <outputDir>] [--out <path>]",
    ].join("\n")
  );
};

const main = async () => {
  if (hasFlag(args, "help") || hasFlag(args, "h")) {
    usage();
    return;
  }

  const dir = getArg(args, "dir") ?? "";
  const report = await buildAssetReport({ dir });
  const outPath = getArg(args, "out") ?? (dir ? resolve(dir, "asset-report.json") : "");

  if (outPath) {
    await writeJson(outPath, report);
    console.log(outPath);
    return;
  }

  console.log(JSON.stringify(report, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
