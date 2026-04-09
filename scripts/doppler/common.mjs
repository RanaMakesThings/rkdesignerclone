import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

import { resolveDopplerScope } from "./scope.mjs";

const DOPPLER_DEFAULT_PROJECT_REGEX = /^\s*-\s*project:\s*([^\s#]+)\s*$/m;
const DOPPLER_DEFAULT_CONFIG_REGEX = /^\s*config:\s*([^\s#]+)\s*$/m;

export const LINE_SPLIT_REGEX = /\r?\n/;

export const runText = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    ...options,
  });
  if (result.error) {
    throw result.error;
  }
  return result;
};

export const runInherit = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options,
  });
  if (result.error) {
    throw result.error;
  }
  return result;
};

export const ensureDopplerInstalled = () => {
  const result = runText("doppler", ["--version"]);
  if (result.status === 0) {
    return (result.stdout || "").trim();
  }

  console.error("Doppler CLI is not installed or not on PATH.");
  console.error("Install it: https://docs.doppler.com/docs/install-cli");
  process.exit(1);
};

export const getDopplerContext = (cwd = process.cwd()) => {
  const { repoRoot, dopplerScope } = resolveDopplerScope(cwd);
  const defaultsPath = resolve(repoRoot, "doppler.yaml");
  let defaults = null;

  if (existsSync(defaultsPath)) {
    const text = readFileSync(defaultsPath, "utf8");
    const project = text.match(DOPPLER_DEFAULT_PROJECT_REGEX)?.[1] ?? null;
    const config = text.match(DOPPLER_DEFAULT_CONFIG_REGEX)?.[1] ?? null;
    if (project && config) {
      defaults = { project, config };
    }
  }

  return { repoRoot, dopplerScope, defaults, defaultsPath };
};

export const getConfiguredProjectAndConfig = (dopplerScope) => {
  const result = runText("doppler", [
    "configure",
    "get",
    "project",
    "config",
    "--plain",
    "--scope",
    dopplerScope,
  ]);

  if (result.status !== 0) {
    return null;
  }

  const [project, config] = (result.stdout || "")
    .split(LINE_SPLIT_REGEX)
    .map((value) => value.trim());

  if (!project || !config) {
    return null;
  }

  return { project, config };
};

export const parseSecretNames = (payload) => {
  if (Array.isArray(payload)) {
    return payload.filter((value) => typeof value === "string");
  }

  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.secrets)) {
      return payload.secrets.filter((value) => typeof value === "string");
    }
    return Object.keys(payload);
  }

  return [];
};

export const fail = (message, details = []) => {
  console.error(message);
  for (const detail of details) {
    if (detail) {
      console.error(detail);
    }
  }
  process.exit(1);
};
