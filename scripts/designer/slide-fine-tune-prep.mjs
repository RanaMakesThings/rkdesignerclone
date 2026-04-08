#!/usr/bin/env node

import process from "node:process";
import { resolve } from "node:path";
import { createRequire } from "node:module";

import { prepareDesignerSlideFineTune } from "./slide-fine-tune-prep-lib.mjs";

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
    .scriptName("slide:fine-tune:prep")
    .usage("Usage: npm run slide:fine-tune:prep -- --slide <slide-XX|N> [options]")
    .option("slide", {
      type: "string",
      demandOption: true,
      describe:
        "Designer slide id or public display number, e.g. slide-05, slide-4, or 4",
    })
    .option("project-root", {
      type: "string",
      default: "projects/designer-health",
      describe: "Designer project root",
    })
    .option("force", {
      type: "boolean",
      default: false,
      describe: "Overwrite the starter fine-tune request file if it already exists",
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
      const result = await prepareDesignerSlideFineTune({
        slide: argv.slide,
        projectRoot: resolve(String(argv.projectRoot)),
        force: Boolean(argv.force),
      });

      if (argv.json) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        return;
      }

      const lines = [
        `${result.slideId} ready for fine-tuning.`,
        `Title: ${result.title}`,
        `Header: ${result.header}`,
        `Stamped dir: ${result.stampedDir}`,
        `Preferred edit surface: ${result.preferredEditSurface}`,
      ];
      if (result.figurePngPath) {
        lines.push(`Official PNG: ${result.figurePngPath}`);
      }
      if (result.geminiPreviewPath) {
        lines.push(`Gemini preview: ${result.geminiPreviewPath}`);
      }
      if (result.geminiHtmlPath) {
        lines.push(`Gemini HTML: ${result.geminiHtmlPath}`);
      }
      if (result.reportPath) {
        lines.push(`Slide report: ${result.reportPath}`);
      }
      lines.push(`Starter change file: ${result.changeFilePath}`);
      process.stdout.write(`${lines.join("\n")}\n`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
};

await main();
