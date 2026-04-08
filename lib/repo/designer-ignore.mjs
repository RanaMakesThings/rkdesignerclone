import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { normalizeRepoRelativePath } from "./path-normalize.mjs";

const escapeRegExp = (value) => value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");

const globToRegExp = (pattern) => {
  const normalized = String(pattern ?? "").trim();
  if (!normalized) {
    return null;
  }

  let source = "";
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];
    if (char === "*" && next === "*") {
      const after = normalized[index + 2];
      if (after === "/") {
        source += "(?:.*/)?";
        index += 2;
      } else {
        source += ".*";
        index += 1;
      }
      continue;
    }
    if (char === "*") {
      source += "[^/]*";
      continue;
    }
    source += escapeRegExp(char);
  }

  if (normalized.endsWith("/")) {
    return new RegExp(`(?:^|/)${source}(?:.*)?$`);
  }
  return new RegExp(`^(?:${source}|.*\\/${source})$`);
};

export const getDesignerIgnorePath = (repoRoot) => resolve(repoRoot, ".designerignore");

export const readDesignerIgnorePatterns = async (repoRoot) => {
  const ignorePath = getDesignerIgnorePath(repoRoot);
  if (!existsSync(ignorePath)) {
    return [];
  }
  const text = await readFile(ignorePath, "utf8");
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
};

export const createDesignerIgnoreMatcher = (patterns = []) => {
  const matchers = patterns
    .map((pattern) => globToRegExp(pattern))
    .filter(Boolean);

  return (pathLike) => {
    const normalizedPath = normalizeRepoRelativePath(pathLike);
    return matchers.some((matcher) => matcher.test(normalizedPath));
  };
};

export const loadDesignerIgnoreMatcher = async (repoRoot) =>
  createDesignerIgnoreMatcher(await readDesignerIgnorePatterns(repoRoot));
