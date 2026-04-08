#!/usr/bin/env node

import process from "node:process";

import { createRequire } from "node:module";

import {
  getDefaultFigureIdeationConfigPath,
  getFigureIdeationSpecRoot,
  runFigureIdeation,
} from "./lib/figure-ideation.mjs";

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
    .scriptName("figures:ideation:run")
    .usage("Usage: npm run figures:ideation:run -- --input <packet.{yaml,json}> [options]")
    .option("input", {
      type: "string",
      demandOption: true,
      describe: "Path to the figure-ideation input packet (YAML or JSON)",
    })
    .option("config", {
      type: "string",
      describe: "Optional run config path (YAML or JSON)",
    })
    .option("profile", {
      type: "string",
      describe: "Optional preset profile id, e.g. designer",
    })
    .option("out", {
      type: "string",
      describe: "Optional explicit output dir for the run bundle",
    })
    .option("json", {
      type: "boolean",
      default: false,
      describe: "Print machine-readable run summary JSON",
    })
    .epilog(
      [
        `Spec root: ${getFigureIdeationSpecRoot()}`,
        `Default config: ${getDefaultFigureIdeationConfigPath()}`,
      ].join("\n")
    )
    .strict()
    .help()
    .parseAsync()
    .then(async (argv) => {
      const result = await runFigureIdeation({
        inputPath: String(argv.input),
        configPath: argv.config ? String(argv.config) : null,
        profile: argv.profile ? String(argv.profile) : null,
        outputDir: argv.out ? String(argv.out) : null,
      });

      if (argv.json) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else {
        process.stdout.write(`Figure ideation run completed\n${result.dir}\n`);
        process.stdout.write(`exit_state=${result.exitState}\n`);
        process.stdout.write(`${result.runManifestPath}\n`);
      }

      if (!result.ok) {
        process.exitCode = 1;
      }
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
};

await main();
