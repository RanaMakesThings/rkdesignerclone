import { statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { buildProjectManifest } from "./build-project-manifest.mjs";
import { resolveDesignerRepoRoot, resolveProjectRoot } from "./config.mjs";
import { discoverDeckProjects } from "./discover-projects.mjs";
import {
  classifyPathReference,
  isRepoContainedPath,
  normalizeRepoRelativePath,
  toRepoRelativePath,
} from "./path-normalize.mjs";

const projectCache = new Map();

const toCacheKey = (repoRoot, projectId) => `${repoRoot}::${projectId}`;
const getRefreshTokenPath = (repoRoot) => resolve(repoRoot, ".designer", "studio-refresh.token");

const safeStat = (absolutePath) => {
  try {
    return statSync(absolutePath);
  } catch (_error) {
    return null;
  }
};

const getDeckSpecMtimeMs = ({ repoRoot, projectId }) => {
  const deckSpecPath = resolve(resolveProjectRoot(repoRoot, projectId), "deck-spec.json");
  const stats = safeStat(deckSpecPath);
  return stats?.mtimeMs ?? 0;
};

const getRefreshTokenMtimeMs = (repoRoot) => {
  const stats = safeStat(getRefreshTokenPath(repoRoot));
  return stats?.mtimeMs ?? 0;
};

const collectRefs = (value, refs = []) => {
  if (!value) {
    return refs;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectRefs(item, refs);
    }
    return refs;
  }
  if (typeof value !== "object") {
    return refs;
  }

  if (typeof value.path === "string" && value.absolutePath) {
    refs.push({
      path: value.path,
      absolutePath: value.absolutePath,
      canonicalNavigation: value.canonicalNavigation !== false,
    });
  }

  for (const item of Object.values(value)) {
    collectRefs(item, refs);
  }

  return refs;
};

const collectAllowedPaths = (manifest) => {
  const filePaths = new Set();
  const dirPaths = new Set();

  for (const ref of collectRefs(manifest)) {
    if (!ref.canonicalNavigation || !ref.absolutePath) {
      continue;
    }
    const stats = safeStat(ref.absolutePath);
    if (!stats) {
      continue;
    }
    if (stats.isDirectory()) {
      dirPaths.add(normalizeRepoRelativePath(ref.path));
    } else {
      filePaths.add(normalizeRepoRelativePath(ref.path));
    }
  }

  return {
    filePaths,
    dirPaths,
  };
};

const buildCachedManifest = async ({ repoRoot, projectId }) => {
  const projectRoot = resolveProjectRoot(repoRoot, projectId);
  const manifest = await buildProjectManifest({
    repoRoot,
    projectRoot,
  });
  const allowedPaths = collectAllowedPaths(manifest);
  return {
    manifest,
    allowedPaths,
    deckSpecMtimeMs: getDeckSpecMtimeMs({ repoRoot, projectId }),
    refreshTokenMtimeMs: getRefreshTokenMtimeMs(repoRoot),
  };
};

const isCacheCurrent = ({ cached, repoRoot, projectId }) =>
  Boolean(cached) &&
  getDeckSpecMtimeMs({ repoRoot, projectId }) === Number(cached.deckSpecMtimeMs ?? 0) &&
  getRefreshTokenMtimeMs(repoRoot) === Number(cached.refreshTokenMtimeMs ?? 0);

export const invalidateProjectManifestCache = (projectId = null, repoRoot = null) => {
  if (!projectId && !repoRoot) {
    projectCache.clear();
    return;
  }

  for (const key of projectCache.keys()) {
    const matchesProject = !projectId || key.endsWith(`::${projectId}`);
    const matchesRepo = !repoRoot || key.startsWith(`${repoRoot}::`);
    if (matchesProject && matchesRepo) {
      projectCache.delete(key);
    }
  }
};

export const touchProjectManifestRefreshToken = async ({
  repoRoot = resolveDesignerRepoRoot(),
} = {}) => {
  const tokenPath = getRefreshTokenPath(repoRoot);
  await mkdir(dirname(tokenPath), { recursive: true });
  await writeFile(tokenPath, `${Date.now()}\n`, "utf8");
  return tokenPath;
};

export const getProjectManifest = async ({
  repoRoot = resolveDesignerRepoRoot(),
  projectId,
  forceRefresh = false,
} = {}) => {
  const cacheKey = toCacheKey(repoRoot, projectId);
  const cached = projectCache.get(cacheKey);
  if (!forceRefresh && isCacheCurrent({ cached, repoRoot, projectId })) {
    return cached.manifest;
  }

  const nextCached = await buildCachedManifest({ repoRoot, projectId });
  projectCache.set(cacheKey, nextCached);
  return nextCached.manifest;
};

export const listProjectManifests = async ({
  repoRoot = resolveDesignerRepoRoot(),
  forceRefresh = false,
} = {}) => {
  const projects = await discoverDeckProjects(repoRoot);
  const manifests = [];
  for (const project of projects) {
    manifests.push(
      await getProjectManifest({
        repoRoot,
        projectId: project.projectId,
        forceRefresh,
      })
    );
  }
  return manifests;
};

export const getAllowedProjectPath = async ({
  repoRoot = resolveDesignerRepoRoot(),
  projectId,
  path,
  forceRefresh = false,
} = {}) => {
  const normalizedPath = normalizeRepoRelativePath(path);
  const cacheKey = toCacheKey(repoRoot, projectId);
  const cached = projectCache.get(cacheKey);
  const nextCached =
    !forceRefresh && isCacheCurrent({ cached, repoRoot, projectId })
      ? cached
      : await buildCachedManifest({ repoRoot, projectId });

  if (nextCached !== cached) {
    projectCache.set(cacheKey, nextCached);
  }

  const absolutePath = resolve(repoRoot, normalizedPath);
  if (!isRepoContainedPath(repoRoot, absolutePath)) {
    return null;
  }

  if (nextCached.allowedPaths.filePaths.has(normalizedPath)) {
    return {
      repoRelativePath: normalizedPath,
      absolutePath,
      kind: "file",
    };
  }

  for (const dirPath of nextCached.allowedPaths.dirPaths) {
    if (normalizedPath === dirPath || normalizedPath.startsWith(`${dirPath}/`)) {
      return {
        repoRelativePath: normalizedPath,
        absolutePath,
        kind: "descendant",
      };
    }
  }

  const classified = classifyPathReference(repoRoot, normalizedPath);
  if (classified.kind !== "repo-relative") {
    return null;
  }

  return null;
};

export const tryRebaseExternalProjectPath = async ({
  repoRoot = resolveDesignerRepoRoot(),
  projectId,
  path,
} = {}) => {
  const raw = String(path ?? "");
  if (!raw.startsWith("file://")) {
    return null;
  }

  try {
    const fileUrl = new URL(raw);
    const absolutePath = fileUrl.pathname;
    if (!isRepoContainedPath(repoRoot, absolutePath)) {
      return null;
    }
    const repoRelativePath = toRepoRelativePath(repoRoot, absolutePath);
    return await getAllowedProjectPath({
      repoRoot,
      projectId,
      path: repoRelativePath,
    });
  } catch (_error) {
    return null;
  }
};
