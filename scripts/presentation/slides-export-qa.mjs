#!/usr/bin/env node

import process from "node:process";
import { resolve } from "node:path";
import { createRequire } from "node:module";

import { runSlidesExportQa } from "./lib/export-qa.mjs";

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
  .scriptName("slides:export:qa")
  .option("project", {
    type: "string",
    default: "designer-health",
    describe: "Project id. v1 currently supports only designer-health.",
  })
  .option("packet", {
    type: "string",
    demandOption: true,
    describe: "Existing packet directory to validate.",
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
    const result = await runSlidesExportQa({
      repoRoot: process.cwd(),
      projectId: String(argv.project),
      packetDir: resolve(String(argv.packet)),
    });
    const payload = {
      ok: true,
      summaryPath: result.summaryPath,
      slideCount: result.summary.slideCount,
    };
    if (argv.json) {
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
      return;
    }
    process.stdout.write(`${payload.summaryPath}\n`);
  });
