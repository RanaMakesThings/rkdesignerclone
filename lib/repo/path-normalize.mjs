import { existsSync } from "node:fs";
import { isAbsolute, normalize, relative, resolve, sep } from "node:path";

const FILE_URL_PREFIX = "file://";

const normalizeSlashes = (value) => String(value ?? "").replaceAll("\\", "/");

const stripDotPrefix = (value) => value.replace(/^\.\/+/, "");

export const normalizeRepoRelativePath = (value) => {
  const normalized = normalizeSlashes(stripDotPrefix(String(value ?? "").trim()));
  return normalized.replace(/\/+/g, "/");
};

export const isFileUrlReference = (value) =>
  String(value ?? "").trim().toLowerCase().startsWith(FILE_URL_PREFIX);

export const isLikelyExternalReference = (value) =>
  /^(?:https?:\/\/|file:\/\/)/i.test(String(value ?? "").trim());

export const isRepoContainedPath = (repoRoot, absolutePath) => {
  const rel = relative(resolve(repoRoot), resolve(absolutePath));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

export const classifyPathReference = (repoRoot, pathLike) => {
  const raw = String(pathLike ?? "").trim();
  if (!raw) {
    return {
      kind: "missing",
      raw,
      reason: "empty",
      repoRelativePath: null,
      absolutePath: null,
    };
  }

  if (isLikelyExternalReference(raw)) {
    return {
      kind: "external-stale",
      raw,
      reason: "url",
      repoRelativePath: null,
      absolutePath: null,
    };
  }

  if (isAbsolute(raw)) {
    if (!isRepoContainedPath(repoRoot, raw)) {
      return {
        kind: "external-stale",
        raw,
        reason: "absolute-outside-repo",
        repoRelativePath: null,
        absolutePath: resolve(raw),
      };
    }
    const absolutePath = resolve(raw);
    const repoRelativePath = normalizeRepoRelativePath(relative(repoRoot, absolutePath));
    return {
      kind: "repo-relative",
      raw,
      reason: "absolute-in-repo",
      repoRelativePath,
      absolutePath,
    };
  }

  const absolutePath = resolve(repoRoot, raw);
  if (!isRepoContainedPath(repoRoot, absolutePath)) {
    return {
      kind: "external-stale",
      raw,
      reason: "path-traversal",
      repoRelativePath: null,
      absolutePath: null,
    };
  }

  return {
    kind: "repo-relative",
    raw,
    reason: "repo-relative",
    repoRelativePath: normalizeRepoRelativePath(raw),
    absolutePath,
  };
};

export const resolveRepoPath = (repoRoot, pathLike, { mustExist = false } = {}) => {
  const classified = classifyPathReference(repoRoot, pathLike);
  if (classified.kind !== "repo-relative") {
    return null;
  }
  if (mustExist && !existsSync(classified.absolutePath)) {
    return null;
  }
  return classified.absolutePath;
};

export const toRepoRelativePath = (repoRoot, absolutePath) => {
  const rel = normalizeRepoRelativePath(relative(resolve(repoRoot), resolve(absolutePath)));
  return rel === "" ? "." : rel;
};

export const splitRepoPathSegments = (pathLike) =>
  normalizeRepoRelativePath(pathLike)
    .split("/")
    .filter(Boolean);

export const isWithinDir = (parentDir, childPath) => {
  const normalizedParent = resolve(parentDir);
  const normalizedChild = resolve(childPath);
  return (
    normalizedChild === normalizedParent ||
    normalizedChild.startsWith(`${normalizedParent}${sep}`)
  );
};
