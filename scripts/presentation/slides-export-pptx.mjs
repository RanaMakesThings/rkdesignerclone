#!/usr/bin/env node

import process from "node:process";
import { resolve } from "node:path";
import { createRequire } from "node:module";

import { exportSlidesPptx } from "./lib/export-pptx.mjs";

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

await yargs(hideBin(process.argv))
  .scriptName("slides:export:pptx")
  .option("project", {
    type: "string",
    default: "designer-health",
    describe: "Project id to export when --packet is not provided.",
  })
  .option("packet", {
    type: "string",
    describe: "Existing packet directory to compile into PPTX.",
  })
  .option("out", {
    type: "string",
    demandOption: true,
    describe: "Output .pptx file path.",
  })
  .option("slide", {
    type: "array",
    describe: "Optional internal filter by repo slide id or display number.",
  })
  .option("json", {
    type: "boolean",
    default: false,
    describe: "Print JSON output.",
  })
  .strict()
  .help()
  .parseAsync()
  .then(async (argv) => {
    const result = await exportSlidesPptx({
      repoRoot: process.cwd(),
      projectId: String(argv.project),
      packetDir: argv.packet ? resolve(String(argv.packet)) : null,
      outputFile: resolve(String(argv.out)),
      slideFilter: Array.isArray(argv.slide) ? argv.slide.map(String) : null,
    });
    const payload = {
      ok: true,
      outputFile: result.outputFile,
      slideCount: result.slideCount,
    };
    if (argv.json) {
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
      return;
    }
    process.stdout.write(`${payload.outputFile}\n`);
  });
