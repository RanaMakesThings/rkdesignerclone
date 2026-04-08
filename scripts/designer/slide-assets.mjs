#!/usr/bin/env node

import process from "node:process";
import { resolve } from "node:path";
import { createRequire } from "node:module";

import { addDesignerSlideAsset } from "./slide-assets-lib.mjs";

const require = createRequire(import.meta.url);

const requireDep = (name, hint) => {
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    return require(name);
  } catch (_error) {
    console.error(`\nMissing dependency: ${name}`);
    if (hint) {
      console.error(hint);
    }
    console.error("Run: npm install\n");
    process.exit(1);
  }
};

const yargs = requireDep("yargs/yargs", "Needed for CLI argument parsing.");
const { hideBin } = requireDep("yargs/helpers", "Needed for CLI argument parsing.");

const main = async () => {
  await yargs(hideBin(process.argv))
    .scriptName("slide:assets")
    .usage("Usage: npm run slide:assets -- add --slide <slide-XX|N> --source <path> --label <text> [options]")
    .command(
      "add",
      "Add a canonical slide-local asset to a Designer slide asset manifest",
      (command) =>
        command
          .option("slide", {
            type: "string",
            demandOption: true,
            describe:
              "Designer slide id or public display number, e.g. slide-09, slide-8, or 8",
          })
          .option("source", {
            type: "string",
            demandOption: true,
            describe: "Source image file or source run directory",
          })
          .option("label", {
            type: "string",
            demandOption: true,
            describe: "Human-readable asset label",
          })
          .option("summary", {
            type: "string",
            default: "",
            describe: "Short summary shown in Studio",
          })
          .option("status", {
            type: "string",
            default: "reference",
            describe: "Canonical asset status, e.g. reference or selected",
          })
          .option("kind", {
            type: "string",
            default: "image",
            describe: "Asset kind, e.g. image, texture, brand-package",
          })
          .option("role", {
            type: "string",
            default: "reference",
            describe: "Asset role, e.g. reference, brand, texture",
          })
          .option("asset-id", {
            type: "string",
            default: "",
            describe: "Optional stable asset id; defaults to a slug of the label",
          })
          .option("tag", {
            type: "array",
            default: [],
            describe: "Repeatable asset tag",
          })
          .option("note", {
            type: "array",
            default: [],
            describe: "Repeatable asset note",
          })
          .option("project-root", {
            type: "string",
            default: "projects/designer-health",
            describe: "Designer project root",
          })
          .option("json", {
            type: "boolean",
            default: false,
            describe: "Print result metadata as JSON",
          }),
      async (argv) => {
        const result = await addDesignerSlideAsset({
          slide: argv.slide,
          source: String(argv.source),
          label: String(argv.label),
          summary: String(argv.summary),
          status: String(argv.status),
          kind: String(argv.kind),
          role: String(argv.role),
          tags: Array.isArray(argv.tag) ? argv.tag.map(String) : [],
          notes: Array.isArray(argv.note) ? argv.note.map(String) : [],
          assetId: argv.assetId ? String(argv.assetId) : null,
          projectRoot: resolve(String(argv.projectRoot)),
        });

        if (argv.json) {
          process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
          return;
        }

        process.stdout.write(
          [
            `${result.slideId} asset added.`,
            `Asset: ${result.label} (${result.assetId})`,
            `Canonical Asset ID: ${result.canonicalAssetId}`,
            `Manifest: ${result.manifestPath}`,
            `Preview: ${result.copiedPreviewPath}`,
          ].join("\n") + "\n"
        );
      }
    )
    .demandCommand(1)
    .strict()
    .help()
    .parseAsync()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
};

await main();
