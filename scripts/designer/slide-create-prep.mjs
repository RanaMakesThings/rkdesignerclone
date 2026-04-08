#!/usr/bin/env node

import process from "node:process";
import { resolve } from "node:path";
import { createRequire } from "node:module";

import { prepareDesignerSlideCreate } from "./slide-create-prep-lib.mjs";

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
    .scriptName("slide:create:prep")
    .usage("Usage: npm run slide:create:prep -- --slide <slide-XX|N> [options]")
    .option("slide", {
      type: "string",
      demandOption: true,
      describe:
        "Designer slide id or current public display number, e.g. slide-07, slide-6, or 6",
    })
    .option("project-root", {
      type: "string",
      default: "projects/designer-health",
      describe: "Designer project root",
    })
    .option("lane", {
      type: "string",
      default: "auto",
      describe: "Bootstrap lane (auto|html|native|hybrid)",
    })
    .option("label", {
      type: "string",
      describe: "Optional draft version label override",
    })
    .option("template-id", {
      type: "string",
      describe: "Optional template id override; defaults to the deck template",
    })
    .option("reference-image", {
      type: "array",
      string: true,
      default: [],
      describe: "Optional reference image(s) to carry into create mode",
    })
    .option("reference-file", {
      type: "array",
      string: true,
      default: [],
      describe: "Optional reference file(s) to summarize into the create request",
    })
    .option("version-id", {
      type: "string",
      describe: "Reuse an existing create-draft version instead of allocating a new one",
    })
    .option("force", {
      type: "boolean",
      default: false,
      describe: "Overwrite the checked-in create request and reseed the draft if needed",
    })
    .option("json", {
      type: "boolean",
      default: false,
      describe: "Print result metadata as JSON",
    })
    .strict()
    .help()
    .parseAsync()
    .then(async (argv) => {
      const result = await prepareDesignerSlideCreate({
        slide: argv.slide,
        projectRoot: resolve(String(argv.projectRoot)),
        lane: String(argv.lane),
        label: argv.label ? String(argv.label) : null,
        templateId: argv.templateId ? String(argv.templateId) : null,
        referenceImagePaths: Array.isArray(argv.referenceImage)
          ? argv.referenceImage.map((value) => resolve(String(value)))
          : [],
        referenceFilePaths: Array.isArray(argv.referenceFile)
          ? argv.referenceFile.map((value) => resolve(String(value)))
          : [],
        versionId: argv.versionId ? String(argv.versionId) : null,
        force: Boolean(argv.force),
      });

      if (argv.json) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        return;
      }

      const lines = [
        `${result.slideId} ready for slide:create.`,
        `Title: ${result.title || "(missing title)"}`,
        `Lane: ${result.lane}`,
        `Lane reason: ${result.laneReason}`,
        `Draft version: ${result.draftVersionId}`,
        `Draft version dir: ${result.draftVersionDir}`,
        `Template seed HTML: ${result.seedHtmlPath}`,
        `Template seed preview: ${result.seedPreviewPath}`,
        `Create request: ${result.createRequestPath}`,
        `Context snapshot: ${result.createContextPath}`,
        `Recommended run: ${result.preferredNextCommand}`,
      ];
      process.stdout.write(`${lines.join("\n")}\n`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
};

await main();
