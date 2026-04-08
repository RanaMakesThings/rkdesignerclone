#!/usr/bin/env node

import { resolve } from "node:path";
import process from "node:process";
import { createRequire } from "node:module";

import { captureHtmlScreenshot } from "./html-screenshot-lib.mjs";

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
    .scriptName("html:screenshot")
    .usage("Usage: npm run html:screenshot -- --input <html> --output <png>")
    .option("input", {
      type: "string",
      demandOption: true,
      describe: "Path to the source HTML file",
    })
    .option("output", {
      type: "string",
      demandOption: true,
      describe: "Path to the output PNG file",
    })
    .option("width", {
      type: "number",
      default: 1920,
      describe: "Viewport width",
    })
    .option("height", {
      type: "number",
      default: 1080,
      describe: "Viewport height",
    })
    .option("full-page", {
      type: "boolean",
      default: false,
      describe: "Capture the full scrollable page instead of the viewport",
    })
    .strict()
    .help()
    .parseAsync()
    .then(async (argv) => {
      const inputPath = resolve(String(argv.input));
      const outputPath = resolve(String(argv.output));
      await captureHtmlScreenshot({
        inputPath,
        outputPath,
        width: Number(argv.width),
        height: Number(argv.height),
        fullPage: Boolean(argv.fullPage),
      });
      process.stdout.write(`${outputPath}\n`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
};

await main();
