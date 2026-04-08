#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import process from "node:process";

import { resolveDopplerScope } from "./scope.mjs";

const usage = `Usage:
  node scripts/doppler/run.mjs -- <command> [args...]

Runs <command> under \`doppler run\` using this repo's canonical Doppler scope.
In Git worktrees, the scope resolves to the main working tree so all worktrees
share the same Doppler auth/config.

Overrides:
  DOPPLER_SCOPE=<path>     Use a specific Doppler scope directory
  NO_DOPPLER=1             Run the command without Doppler
`;

const ensureDopplerInstalled = () => {
  const result = spawnSync("doppler", ["--version"], { stdio: "ignore" });
  if (result.error || result.status !== 0) {
    console.error("Doppler CLI is not installed (or not on PATH).");
    console.error("Install it: https://docs.doppler.com/docs/install-cli");
    process.exit(1);
  }
};

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
    ...options,
  });
  if (result.error) {
    throw result.error;
  }
  return result;
};

const main = () => {
  const raw = process.argv.slice(2);
  const splitIndex = raw.indexOf("--");
  const commandArgs = splitIndex === -1 ? raw : raw.slice(splitIndex + 1);

  if (commandArgs.length === 0) {
    console.error(usage);
    process.exit(1);
  }

  if (process.env.NO_DOPPLER) {
    const result = run(commandArgs[0], commandArgs.slice(1));
    process.exit(result.status ?? 1);
  }

  ensureDopplerInstalled();

  const { dopplerScope } = resolveDopplerScope(process.cwd());
  const result = run("doppler", ["run", "--scope", dopplerScope, "--", ...commandArgs]);
  process.exit(result.status ?? 1);
};

main();
