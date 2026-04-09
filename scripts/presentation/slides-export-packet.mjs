#!/usr/bin/env node

import process from "node:process";
import { resolve } from "node:path";
import { createRequire } from "node:module";

import { exportSlidesPacket } from "./lib/export-packet.mjs";

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
  .scriptName("slides:export:packet")
  .option("project", {
    type: "string",
    default: "designer-health",
    describe: "Project id to export.",
  })
  .option("out", {
    type: "string",
    demandOption: true,
    describe: "Output directory for the packet bundle.",
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
    const result = await exportSlidesPacket({
      repoRoot: process.cwd(),
      projectId: String(argv.project),
      outputDir: resolve(String(argv.out)),
      slideFilter: Array.isArray(argv.slide) ? argv.slide.map(String) : null,
    });
    const payload = {
      ok: true,
      outputDir: result.outputDir,
      manifestPath: result.manifestPath,
      slideCount: result.manifest.slideCount,
    };
    if (argv.json) {
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
      return;
    }
    process.stdout.write(`${payload.manifestPath}\n`);
  });
