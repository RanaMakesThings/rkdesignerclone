import { homedir } from "node:os";
import { isAbsolute, relative, resolve } from "node:path";

import { normalizeRepoRelativePath, isWithinDir } from "./path-normalize.mjs";
import { resolveDesignerRepoRoot } from "./config.mjs";

const DEFAULT_DATA_ROOT_NAME = "designer-data";

export const resolveDesignerDataRoot = ({
  env = process.env,
  homeDir = homedir(),
} = {}) => {
  const configured = String(env?.DESIGNER_DATA_DIR ?? "").trim();
  return configured ? resolve(configured) : resolve(homeDir, DEFAULT_DATA_ROOT_NAME);
};

export const isDesignerDataContainedPath = (dataRoot, absolutePath) =>
  isWithinDir(resolve(dataRoot), resolve(absolutePath));

export const toDesignerDataRelativePath = (dataRoot, absolutePath) => {
  const resolvedDataRoot = resolve(dataRoot);
  const resolvedPath = resolve(absolutePath);
  if (!isDesignerDataContainedPath(resolvedDataRoot, resolvedPath)) {
    return null;
  }
  const rel = normalizeRepoRelativePath(relative(resolvedDataRoot, resolvedPath));
  return rel === "" ? "." : rel;
};

export const resolveDesignerDataPath = (dataRoot, pathLike) => {
  const raw = String(pathLike ?? "").trim();
  if (!raw) {
    return null;
  }
  const absolutePath = isAbsolute(raw) ? resolve(raw) : resolve(dataRoot, raw);
  if (!isDesignerDataContainedPath(dataRoot, absolutePath)) {
    return null;
  }
  return absolutePath;
};

export const getDesignerDataPaths = ({
  cwd = process.cwd(),
  env = process.env,
  repoRoot = resolveDesignerRepoRoot({ cwd, env }),
  homeDir = homedir(),
} = {}) => {
  const dataRoot = resolveDesignerDataRoot({ env, homeDir });
  const cacheRoot = resolve(dataRoot, "cache");
  const thumbsRoot = resolve(cacheRoot, "thumbs");
  const parsedRoot = resolve(cacheRoot, "parsed");
  const runsRoot = resolve(dataRoot, "runs");
  const exportsRoot = resolve(dataRoot, "exports");
  const archiveRoot = resolve(dataRoot, "archive");
  const logsRoot = resolve(dataRoot, "logs");
  const sqliteRoot = resolve(dataRoot, "sqlite");
  const sqlitePath = resolve(sqliteRoot, "studio-index.db");
  return {
    repoRoot,
    dataRoot,
    cacheRoot,
    thumbsRoot,
    parsedRoot,
    runsRoot,
    exportsRoot,
    archiveRoot,
    logsRoot,
    sqliteRoot,
    sqlitePath,
    legacyPresentationImagesRoot: resolve(repoRoot, "output", "figures", "presentation-images"),
    legacyGeminiRoot: resolve(repoRoot, "output", "figures", "gemini"),
    legacyOpenAiRoot: resolve(repoRoot, "output", "figures", "openai"),
  };
};

export const getDesignerProjectRunsRoot = (paths, projectId) =>
  resolve(paths.runsRoot, String(projectId ?? "").trim() || "adhoc");

export const createArtifactRunSlug = ({
  slug,
  createdAt = new Date(),
}) => {
  const timestamp = createdAt
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
  const normalizedSlug =
    String(slug ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "artifact-run";
  return `${timestamp}-${normalizedSlug}`;
};
