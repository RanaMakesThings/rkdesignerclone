#!/usr/bin/env node
import { getArg, hasFlag } from "./lib/io.mjs";
import { selectAssetCandidate } from "./lib/assets.mjs";

const args = process.argv.slice(2);

const usage = () => {
  console.log(
    [
      "Figure image selection",
      "",
      "Usage:",
      "  node scripts/figures/images-select.mjs --dir <outputDir> --slot <slotId> [--candidate <candidateId> | --asset <assetId>] [--status <approved|shortlisted|rejected|archived|in_use>] [--placement <hook>] [--treatment <name>] [--object-position <css>] [--opacity <0-1>] [--crop-variant <id>] [--alt <text>] [--reason <text>]",
    ].join("\n")
  );
};

const parseOpacity = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1) {
    throw new Error("Invalid --opacity. Use a number between 0 and 1.");
  }
  return numeric;
};

const main = async () => {
  if (hasFlag(args, "help") || hasFlag(args, "h")) {
    usage();
    return;
  }

  const dir = getArg(args, "dir");
  const slotId = getArg(args, "slot");
  const candidateId = getArg(args, "candidate") ?? "";
  const assetId = getArg(args, "asset") ?? "";
  if (!dir || !slotId || (!candidateId && !assetId)) {
    usage();
    process.exitCode = 1;
    return;
  }

  const result = await selectAssetCandidate({
    dir,
    slotId,
    candidateId,
    assetId,
    status: getArg(args, "status") ?? "approved",
    placement: getArg(args, "placement") ?? "",
    treatment: getArg(args, "treatment") ?? "",
    objectPosition: getArg(args, "object-position") ?? "",
    opacity: parseOpacity(getArg(args, "opacity")),
    cropVariant: getArg(args, "crop-variant") ?? "original",
    alt: getArg(args, "alt") ?? "",
    reason: getArg(args, "reason") ?? "",
  });

  console.log(`Updated image selection for ${result.manifest.slug} / ${slotId}`);
  console.log(`${dir}/asset-selection.json`);
  console.log(`${dir}/render-assets.json`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
