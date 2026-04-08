import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const WORKTREE_PATH_SEGMENT = `${path.sep}.git${path.sep}worktrees${path.sep}`;

const readGitRepoRoot = (cwd) => {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.status !== 0) {
    return null;
  }
  return (result.stdout || "").trim() || null;
};

const parseGitdirPointer = (contents) => {
  const match = String(contents).match(/^\s*gitdir:\s*(.+)\s*$/m);
  return match ? match[1].trim() : null;
};

/**
 * Resolve the canonical Doppler scope for this repo.
 *
 * - Non-worktree: scope is the repo root.
 * - Git worktree: scope is the main working tree root so all worktrees share
 *   the same Doppler auth/config.
 *
 * Override with DOPPLER_SCOPE (or YSN_DOPPLER_SCOPE).
 */
export const resolveDopplerScope = (cwd = process.cwd()) => {
  const repoRoot = readGitRepoRoot(cwd) ?? cwd;

  const override = process.env.DOPPLER_SCOPE || process.env.YSN_DOPPLER_SCOPE;
  if (override) {
    return {
      repoRoot,
      dopplerScope: path.resolve(override),
    };
  }

  const dotGit = path.join(repoRoot, ".git");
  try {
    const stat = fs.statSync(dotGit);
    if (!stat.isFile()) {
      return { repoRoot, dopplerScope: repoRoot };
    }

    const pointer = fs.readFileSync(dotGit, "utf8");
    const gitdirRaw = parseGitdirPointer(pointer);
    if (!gitdirRaw) {
      return { repoRoot, dopplerScope: repoRoot };
    }

    const gitdirPath = path.isAbsolute(gitdirRaw)
      ? gitdirRaw
      : path.resolve(repoRoot, gitdirRaw);

    const idx = gitdirPath.indexOf(WORKTREE_PATH_SEGMENT);
    if (idx === -1) {
      return { repoRoot, dopplerScope: repoRoot };
    }

    const mainRoot = gitdirPath.slice(0, idx);
    if (!mainRoot || !fs.existsSync(mainRoot)) {
      return { repoRoot, dopplerScope: repoRoot };
    }

    return { repoRoot, dopplerScope: mainRoot };
  } catch {
    return { repoRoot, dopplerScope: repoRoot };
  }
};
