import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const hasRepoMarkers = (dirPath) =>
  existsSync(resolve(dirPath, "package.json")) &&
  existsSync(resolve(dirPath, "projects"));

const findRepoRootFrom = (startDir) => {
  let current = resolve(startDir);
  while (true) {
    if (hasRepoMarkers(current)) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
};

export const resolveDesignerRepoRoot = ({
  cwd = process.cwd(),
  env = process.env,
} = {}) => {
  const fromEnv = env?.DESIGNER_REPO_ROOT ? resolve(env.DESIGNER_REPO_ROOT) : null;
  if (fromEnv && hasRepoMarkers(fromEnv)) {
    return fromEnv;
  }

  const discovered = findRepoRootFrom(cwd);
  if (discovered) {
    return discovered;
  }

  throw new Error(
    "Could not resolve repo root. Set DESIGNER_REPO_ROOT or run inside the designer repo."
  );
};

export const resolveProjectRoot = (repoRoot, projectId) =>
  resolve(repoRoot, "projects", projectId);
