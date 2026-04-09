#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import process from "node:process";

import {
  ensureDopplerInstalled,
  fail,
  getDopplerContext,
  runInherit,
  runText,
} from "./common.mjs";

const usage = `Usage:
  node scripts/doppler/set-admin-token.mjs [options]

Options:
  --project, -p <name>
  --config, -c <name>
  --key <name>
  --bytes <n>
  --no-output
  --help, -h
`;

const parseArgs = (argv) => {
  const options = {
    project: null,
    config: null,
    key: "ADMIN_API_TOKEN",
    bytes: 32,
    output: true,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--no-output") {
      options.output = false;
      continue;
    }
    if (
      arg === "--project" ||
      arg === "-p" ||
      arg === "--config" ||
      arg === "-c" ||
      arg === "--key" ||
      arg === "--bytes"
    ) {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`Missing value for ${arg}`);
      }
      if (arg === "--project" || arg === "-p") {
        options.project = value;
      } else if (arg === "--config" || arg === "-c") {
        options.config = value;
      } else if (arg === "--key") {
        options.key = value;
      } else {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isInteger(parsed) || parsed <= 0) {
          throw new Error(`Invalid --bytes value: ${value}`);
        }
        options.bytes = parsed;
      }
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
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

  const { dopplerScope } = getDopplerContext();
  const me = runText("doppler", ["me", "--scope", dopplerScope]);
  if (me.status !== 0) {
    fail("Doppler login required.", ["Run `npm run doppler:init` first."]);
  }

  const token = randomBytes(options.bytes).toString("hex");
  const args = [
    "secrets",
    "set",
    `${options.key}=${token}`,
    "--scope",
    dopplerScope,
  ];
  if (options.project) {
    args.push("--project", options.project);
  }
  if (options.config) {
    args.push("--config", options.config);
  }

  const save = runInherit("doppler", args);
  if (save.status !== 0) {
    process.exit(save.status ?? 1);
  }

  console.log(`${options.key} saved to Doppler.`);
  if (options.output) {
    console.log(`${options.key}=${token}`);
  }
};

main();
