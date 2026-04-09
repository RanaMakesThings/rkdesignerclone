#!/usr/bin/env node

import process from "node:process";

import {
  ensureDopplerInstalled,
  fail,
  getConfiguredProjectAndConfig,
  getDopplerContext,
  parseSecretNames,
  runText,
} from "./common.mjs";

const usage = `Usage:
  node scripts/doppler/verify.mjs [--require KEY]... [--require-value KEY]...

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

  const { dopplerScope } = getDopplerContext();
  const configured = getConfiguredProjectAndConfig(dopplerScope);
  if (!configured) {
    fail(
      "This repo is not configured for a Doppler project/config.",
      ["Run `npm run doppler:init` first."]
    );
  }

  const secretNamesResult = runText("doppler", [
    "secrets",
    "--only-names",
    "--json",
    "--scope",
    dopplerScope,
  ]);
  if (secretNamesResult.status !== 0) {
    fail("Unable to read secrets from Doppler.", [
      secretNamesResult.stderr?.trim(),
      "Run `npm run doppler:init` to re-authenticate or re-scope this repo.",
    ]);
  }

  let secretNames;
  try {
    secretNames = parseSecretNames(JSON.parse(secretNamesResult.stdout || "{}"));
  } catch {
    fail("Unable to parse Doppler secret names.");
  }

  if (secretNames.length === 0) {
    fail(`No secrets found in ${configured.project}/${configured.config}.`);
  }

  const missing = [
    ...options.required.filter((key) => !secretNames.includes(key)),
    ...options.requiredWithValue.filter((key) => !secretNames.includes(key)),
  ];
  if (missing.length > 0) {
    fail("Missing required Doppler keys.", [missing.join(", ")]);
  }

  const empty = [];
  for (const key of options.requiredWithValue) {
    const valueResult = runText("doppler", [
      "secrets",
      "get",
      key,
      "--plain",
      "--scope",
      dopplerScope,
    ]);
    if (valueResult.status !== 0) {
      fail(`Unable to read Doppler value for ${key}.`, [
        valueResult.stderr?.trim(),
      ]);
    }
    if (!(valueResult.stdout || "").trim()) {
      empty.push(key);
    }
  }

  if (empty.length > 0) {
    fail("Required Doppler keys are present but empty.", [empty.join(", ")]);
  }

  console.log(
    `Doppler verified for ${configured.project}/${configured.config} (${secretNames.length} keys visible).`
  );
  if (options.required.length > 0 || options.requiredWithValue.length > 0) {
    console.log(
      `Checked keys: ${[...options.required, ...options.requiredWithValue].join(", ")}`
    );
  }
};

main();
