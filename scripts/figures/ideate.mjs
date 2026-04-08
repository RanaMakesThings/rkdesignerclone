#!/usr/bin/env node
import { getArg, hasFlag } from "./lib/io.mjs";
import { ideateFigureBrief } from "./lib/ideation.mjs";

const args = process.argv.slice(2);

const usage = () => {
  console.log(
    [
      "Figure ideation",
      "",
      "Usage:",
      "  node scripts/figures/ideate.mjs --brief <path> [--slug <slug>] [--out <dir>] [--count <n>]",
      "",
      "Notes:",
      "  Best-effort image boards are generated for shortlisted photo/hybrid ideas when PEXELS_API_KEY is available.",
    ].join("\n")
  );
};

const main = async () => {
  if (hasFlag(args, "help") || hasFlag(args, "h")) {
    usage();
    return;
  }

  const briefPath = getArg(args, "brief");
  const outputDir = getArg(args, "out");
  const slug = getArg(args, "slug");
  const count = getArg(args, "count");
  if (!briefPath) {
    usage();
    process.exitCode = 1;
    return;
  }

  const result = await ideateFigureBrief({
    briefPath,
    outputDir,
    slug,
    count: count ? Number(count) : 10,
  });
  console.log(`Ideated ${result.slug} with provider=${result.provider}`);
  console.log(result.paths.ideationPath);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
