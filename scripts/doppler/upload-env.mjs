#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";

import {
  ensureDopplerInstalled,
  getDopplerContext,
  runInherit,
} from "./common.mjs";

const DEFAULT_FILE = ".env.shared";
const LINE_SPLIT_REGEX = /\r?\n/;
const ENV_KEY_REGEX = /^([A-Za-z_][A-Za-z0-9_]*)\s*=/;

const usage = `Usage:
  node scripts/doppler/upload-env.mjs [options]

Options:
  --file, -f <path>
  --project, -p <name>
  --config, -c <name>
  --yes, -y
  --dry-run
  --no-silent
  --help, -h
`;

const parseArgs = (argv) => {
  const options = {
    file: DEFAULT_FILE,
    project: null,
    config: null,
    yes: false,
    dryRun: false,
    silent: true,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--yes" || arg === "-y") {
      options.yes = true;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--no-silent") {
      options.silent = false;
      continue;
    }
    if (
      arg === "--file" ||
      arg === "-f" ||
      arg === "--project" ||
      arg === "-p" ||
      arg === "--config" ||
      arg === "-c"
    ) {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`Missing value for ${arg}`);
      }
      if (arg === "--file" || arg === "-f") {
        options.file = value;
      } else if (arg === "--project" || arg === "-p") {
        options.project = value;
      } else {
        options.config = value;
      }
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
};

const extractKeys = (filePath) => {
  const keys = [];
  for (const rawLine of readFileSync(filePath, "utf8").split(LINE_SPLIT_REGEX)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const normalized = trimmed.startsWith("export ")
      ? trimmed.slice("export ".length).trim()
      : trimmed;
    const match = normalized.match(ENV_KEY_REGEX);
    if (match) {
      keys.push(match[1]);
    }
  }
  return keys;
};

const confirm = async () => {
  if (!process.stdin.isTTY) {
    return false;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question("Proceed with upload? [y/N] ");
    return ["y", "yes"].includes(answer.trim().toLowerCase());
  } finally {
    rl.close();
  }
};

const main = async () => {
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
  const filePath = resolve(process.cwd(), options.file);
  if (!existsSync(filePath)) {
    console.error(`Env file not found: ${filePath}`);
    process.exit(1);
  }

  const keys = extractKeys(filePath);
  if (keys.length === 0) {
    console.error(`No env keys found in ${filePath}`);
    process.exit(1);
  }

  console.log(`Uploading ${keys.length} keys from ${filePath}`);

  if (options.dryRun) {
    console.log("Dry run only. No secrets were uploaded.");
    return;
  }

  if (!options.yes) {
    const ok = await confirm();
    if (!ok) {
      console.log("Canceled.");
      process.exit(0);
    }
  }

  const args = ["secrets", "upload", filePath, "--scope", dopplerScope];
  if (options.project) {
    args.push("--project", options.project);
  }
  if (options.config) {
    args.push("--config", options.config);
  }
  if (options.silent) {
    args.push("--silent");
  }

  const upload = runInherit("doppler", args);
  if (upload.status !== 0) {
    process.exit(upload.status ?? 1);
  }
};

await main();
