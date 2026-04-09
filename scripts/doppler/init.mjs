#!/usr/bin/env node

import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  ensureDopplerInstalled,
  fail,
  getDopplerContext,
  runInherit,
  runText,
} from "./common.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);

const usage = `Usage:
  node scripts/doppler/init.mjs [--require KEY]... [--require-value KEY]...

Options:
  --require KEY
  --require-value KEY
  --help, -h
`;

const parseArgs = (argv) => {
  const required = [];
  const requiredWithValue = [];
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--require" || arg === "--require-value") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`Missing value for ${arg}`);
      }
      if (arg === "--require") {
        required.push(value);
      } else {
        requiredWithValue.push(value);
      }
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { help, required, requiredWithValue };
};

const main = () => {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error("");
    console.error(usage);
    process.exit(1);
  }

  if (options.help) {
    console.log(usage);
    return;
  }

  ensureDopplerInstalled();

  const { dopplerScope, defaults, defaultsPath } = getDopplerContext();

  const me = runText("doppler", ["me", "--scope", dopplerScope]);
  if (me.status !== 0) {
    console.log("Logging into Doppler...");
    const login = runInherit("doppler", ["login", "--scope", dopplerScope]);
    if (login.status !== 0) {
      process.exit(login.status ?? 1);
    }
  }

  const setupArgs = ["setup", "--scope", dopplerScope];
  if (defaults) {
    setupArgs.push(
      "--project",
      defaults.project,
      "--config",
      defaults.config,
      "--no-interactive"
    );
  }

  const setup = runInherit("doppler", setupArgs);
  if (setup.status !== 0) {
    process.exit(setup.status ?? 1);
  }

  if (!defaults) {
    console.log("No default project/config found in doppler.yaml.");
  } else {
    console.log(
      `Configured Doppler scope ${dopplerScope} for ${defaults.project}/${defaults.config} from ${defaultsPath}.`
    );
  }

  if (options.required.length === 0 && options.requiredWithValue.length === 0) {
    return;
  }

  const verifyScript = resolve(SCRIPT_PATH, "../verify.mjs");
  const verifyArgs = [verifyScript];
  for (const key of options.required) {
    verifyArgs.push("--require", key);
  }
  for (const key of options.requiredWithValue) {
    verifyArgs.push("--require-value", key);
  }

  const verify = runInherit("node", verifyArgs);
  if (verify.status !== 0) {
    fail("Doppler init succeeded, but verification failed.");
  }
};

main();
