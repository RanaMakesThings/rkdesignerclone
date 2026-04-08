#!/usr/bin/env node
import { getArg, hasFlag, resolveRepoPath } from "./lib/io.mjs";
import { assessFigureDir } from "./lib/assessment.mjs";

const args = process.argv.slice(2);

const usage = () => {
  console.log(
    [
      "Figure assess",
      "",
      "Usage:",
      "  node scripts/figures/assess.mjs --dir <outputDir> [--policy <path>]",
    ].join("\n")
  );
};

const main = async () => {
  if (hasFlag(args, "help") || hasFlag(args, "h")) {
    usage();
    return;
  }

  const dir = getArg(args, "dir");
  const policyPath = getArg(args, "policy");
  if (!dir) {
    usage();
    process.exitCode = 1;
    return;
  }

  const result = await assessFigureDir({
    dir: resolveRepoPath(dir),
    policyPath: policyPath ? resolveRepoPath(policyPath) : null,
  });
  console.log(
    `Assessed ${result.assessment.slug} with provider=${result.provider}`
  );
  console.log(`${result.dir}/assessment.json`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
