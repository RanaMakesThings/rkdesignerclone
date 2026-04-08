import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

const resolveLinkedGitDir = (repoRoot: string) => {
  const gitPath = resolve(repoRoot, ".git");
  if (!existsSync(gitPath)) {
    return null;
  }

  let gitStats;
  try {
    gitStats = statSync(gitPath);
  } catch {
    return null;
  }

  if (!gitStats.isFile()) {
    return null;
  }

  const raw = readFileSync(gitPath, "utf8").trim();
  const match = raw.match(/^gitdir:\s*(.+)$/i);
  if (!match) {
    return null;
  }

  return resolve(repoRoot, match[1]);
};

const resolveSharedCheckoutRoot = (repoRoot: string) => {
  const linkedGitDir = resolveLinkedGitDir(repoRoot);
  if (!linkedGitDir) {
    return null;
  }

  const commonGitDir = resolve(linkedGitDir, "..", "..");
  if (basename(commonGitDir) !== ".git") {
    return null;
  }

  const sharedCheckoutRoot = dirname(commonGitDir);
  const normalizedRepoRoot = resolve(repoRoot);
  return sharedCheckoutRoot === normalizedRepoRoot ? null : sharedCheckoutRoot;
};

export const getStudioRepoRoots = (repoRoot: string) => {
  const roots = [resolve(repoRoot)];
  const sharedCheckoutRoot = resolveSharedCheckoutRoot(repoRoot);
  if (sharedCheckoutRoot && !roots.includes(sharedCheckoutRoot)) {
    roots.push(sharedCheckoutRoot);
  }
  return roots;
};
