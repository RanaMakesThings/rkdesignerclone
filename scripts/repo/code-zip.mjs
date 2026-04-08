import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT_DIR = "repo-zips";
const DEFAULT_OUT_BASE = "designer-code";
const DEFAULT_MAX_FILE_MB = 4;
const DEFAULT_SOURCE = "npm run zip:code";
const DEFAULT_TOP_COUNT = 10;
const POLICY_PATH = path.join(SCRIPT_DIR, "code-zip-policy.json");
const STAMP_PATH = ".github/repo-stamp.json";

const SECRET_SUFFIXES = [
  ".pem",
  ".key",
  ".p12",
  ".pfx",
  ".mobileprovision",
];

const run = (command, args, { allowFailure = false, trim = true } = {}) => {
  try {
    const output = execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return trim ? output.trim() : output;
  } catch (error) {
    if (allowFailure) {
      return "";
    }
    throw error;
  }
};

const toPosixPath = (value) => value.replaceAll(path.sep, "/");

const formatBytes = (bytes) => {
  if (bytes < 1024) {
    return `${bytes}B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
};

const formatStampTimestamp = (iso) =>
  iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

const globToRegExp = (glob) => {
  let pattern = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  pattern = pattern.replaceAll("**", "\u0000");
  pattern = pattern.replaceAll("*", "[^/]*");
  pattern = pattern.replaceAll("\u0000", ".*");
  return new RegExp(`^${pattern}$`);
};

const parseArgs = (argv) => {
  const args = {
    out: null,
    maxFileMb: DEFAULT_MAX_FILE_MB,
    policy: POLICY_PATH,
    source: DEFAULT_SOURCE,
    dryRun: false,
    verbose: false,
    json: false,
    help: false,
  };

  const iterator = argv[Symbol.iterator]();
  const takeValue = () => {
    const next = iterator.next();
    if (next.done) {
      return null;
    }
    return next.value;
  };

  for (const arg of iterator) {
    switch (arg) {
      case "--out":
        args.out = takeValue() ?? args.out;
        break;
      case "--max-file-mb":
        args.maxFileMb = Number(takeValue() ?? args.maxFileMb);
        break;
      case "--policy":
        args.policy = takeValue() ?? args.policy;
        break;
      case "--source":
        args.source = takeValue() ?? args.source;
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--verbose":
        args.verbose = true;
        break;
      case "--json":
        args.json = true;
        break;
      case "--help":
      case "-h":
        args.help = true;
        break;
      default:
        break;
    }
  }

  if (!Number.isFinite(args.maxFileMb) || args.maxFileMb <= 0) {
    throw new Error(`Invalid --max-file-mb value: ${args.maxFileMb}`);
  }

  return args;
};

const loadPolicy = async (policyPath) => {
  const raw = await readFile(policyPath, "utf8");
  const parsed = JSON.parse(raw);
  const excludePathGlobs = Array.isArray(parsed.excludePathGlobs)
    ? parsed.excludePathGlobs.filter((value) => typeof value === "string")
    : [];
  const excludeExtensions = Array.isArray(parsed.excludeExtensions)
    ? parsed.excludeExtensions
        .filter((value) => typeof value === "string")
        .map((value) => value.toLowerCase())
    : [];

  return {
    path: policyPath,
    excludePathGlobs,
    excludePathRegexes: excludePathGlobs.map(globToRegExp),
    excludeExtensions,
  };
};

const getRepoRoot = () => run("git", ["rev-parse", "--show-toplevel"]);

const getGitSha = () => run("git", ["rev-parse", "HEAD"], { allowFailure: true });

const getUntrackedFileSet = () => {
  const raw = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z"]);
  return new Set(raw.toString("utf8").split("\0").filter(Boolean));
};

const isSecretPath = (relativePath) => {
  const lower = relativePath.toLowerCase();
  const basename = path.posix.basename(lower);

  if (
    basename === ".env" ||
    basename.startsWith(".env.") ||
    basename.endsWith(".env") ||
    lower.includes("/.env.")
  ) {
    return true;
  }

  if (
    basename === ".npmrc" ||
    basename === "token.json" ||
    basename === "credentials.json"
  ) {
    return true;
  }

  if (basename.startsWith("client_secret") && basename.endsWith(".json")) {
    return true;
  }

  return SECRET_SUFFIXES.some((suffix) => basename.endsWith(suffix));
};

const matchesPolicyPath = (relativePath, policy) =>
  policy.excludePathRegexes.some((regex) => regex.test(relativePath));

const matchesExcludedExtension = (relativePath, policy) => {
  const lower = relativePath.toLowerCase();
  return policy.excludeExtensions.some((extension) => lower.endsWith(extension));
};

const buildOutPath = ({ repoRoot, outArg, gitSha, generatedAtUtc }) => {
  if (outArg) {
    return path.isAbsolute(outArg) ? outArg : path.join(repoRoot, outArg);
  }

  const safeSha = gitSha ? gitSha.slice(0, 12) : "nogit";
  const stampedName = `${DEFAULT_OUT_BASE}-${safeSha}-${formatStampTimestamp(generatedAtUtc)}.zip`;
  return path.join(repoRoot, DEFAULT_OUT_DIR, stampedName);
};

const buildFileList = ({ policy, maxFileBytes, verbose }) => {
  const raw = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"]);
  const files = raw
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const skipped = {
    secret: 0,
    policyPath: 0,
    extension: 0,
    tooLarge: 0,
    missing: 0,
  };
  const samples = {
    secret: [],
    policyPath: [],
    extension: [],
    tooLarge: [],
  };
  const included = [];

  for (const rawPath of files) {
    const relativePath = toPosixPath(rawPath);

    if (isSecretPath(relativePath)) {
      skipped.secret += 1;
      if (samples.secret.length < 5) {
        samples.secret.push(relativePath);
      }
      continue;
    }

    if (matchesPolicyPath(relativePath, policy)) {
      skipped.policyPath += 1;
      if (samples.policyPath.length < 5) {
        samples.policyPath.push(relativePath);
      }
      continue;
    }

    if (matchesExcludedExtension(relativePath, policy)) {
      skipped.extension += 1;
      if (samples.extension.length < 5) {
        samples.extension.push(relativePath);
      }
      continue;
    }

    let size = 0;
    try {
      size = statSync(relativePath).size;
    } catch {
      skipped.missing += 1;
      continue;
    }

    if (size > maxFileBytes) {
      skipped.tooLarge += 1;
      if (samples.tooLarge.length < 5) {
        samples.tooLarge.push(`${relativePath} (${formatBytes(size)})`);
      }
      continue;
    }

    included.push({ path: relativePath, size });
  }

  if (verbose) {
    console.error(
      `zip:code selected ${included.length} files (skipped: secret=${skipped.secret}, policyPath=${skipped.policyPath}, extension=${skipped.extension}, tooLarge=${skipped.tooLarge}, missing=${skipped.missing})`
    );
  }

  return { included, skipped, samples };
};

const makeZip = async ({ outPath, includedPaths }) => {
  await rm(outPath, { force: true });
  execFileSync("zip", ["-q", "-X", "-9", outPath, "-@"], {
    input: includedPaths.join("\n"),
    stdio: ["pipe", "ignore", "inherit"],
  });
};

const addStampToZip = async ({ zipPath, stamp }) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "designer-code-zip-"));
  try {
    const stampDiskPath = path.join(tempDir, ...STAMP_PATH.split("/"));
    await mkdir(path.dirname(stampDiskPath), { recursive: true });
    await writeFile(stampDiskPath, `${JSON.stringify(stamp, null, 2)}\n`, "utf8");
    execFileSync("zip", ["-q", "-X", "-9", zipPath, STAMP_PATH], {
      cwd: tempDir,
      stdio: ["ignore", "ignore", "inherit"],
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};

const printSummary = (summary, { json }) => {
  if (json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(`Code zip: ${summary.outPath}`);
  console.log(`generated_at_utc: ${summary.generatedAtUtc}`);
  console.log(`git_sha: ${summary.gitSha ?? "null"}`);
  console.log(`timezone: ${summary.timezone}`);
  console.log(`policy: ${summary.policyPath}`);
  console.log(
    `included_files: ${summary.includedCount} (tracked=${summary.includedTrackedCount}, untracked=${summary.includedUntrackedCount})`
  );
  console.log(
    `excluded_files: secret=${summary.skipped.secret}, policyPath=${summary.skipped.policyPath}, extension=${summary.skipped.extension}, tooLarge=${summary.skipped.tooLarge}, missing=${summary.skipped.missing}`
  );
  console.log(`max_file_size: ${summary.maxFileSize}`);
  if (summary.zipSize) {
    console.log(`zip_size: ${summary.zipSize}`);
  } else {
    console.log("zip_size: dry-run");
  }

  if (summary.largestIncludedFiles.length > 0) {
    console.log("largest_included_files:");
    for (const entry of summary.largestIncludedFiles) {
      console.log(`  - ${entry.size}: ${entry.path}`);
    }
  }
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`Usage:
  node scripts/repo/code-zip.mjs [options]

Options:
  --out <path>           Output zip path (default: repo-zips/designer-code-<sha>-<timestamp>.zip)
  --max-file-mb <n>      Exclude files larger than this size in MB (default: ${DEFAULT_MAX_FILE_MB})
  --policy <path>        Policy JSON with excludePathGlobs/excludeExtensions
  --source <text>        Override zip_source stamp value (default: ${DEFAULT_SOURCE})
  --dry-run              Print the file-selection summary without writing a zip
  --verbose              Print selection counts to stderr while building
  --json                 Print the final summary as JSON
  --help, -h             Show this help text

Notes:
  - Includes tracked and untracked non-ignored files via git ls-files -co --exclude-standard.
  - Excludes repo-local artifact trees and common heavy binary extensions via the policy file.
  - Injects .github/repo-stamp.json for traceability and downstream zip workflows.
`);
    return;
  }

  run("git", ["rev-parse", "--is-inside-work-tree"]);
  if (!args.dryRun) {
    run("zip", ["-v"]);
  }

  const repoRoot = getRepoRoot();
  process.chdir(repoRoot);

  const policyPath = path.isAbsolute(args.policy)
    ? args.policy
    : path.join(repoRoot, args.policy);
  const policy = await loadPolicy(policyPath);
  const generatedAtUtc = new Date().toISOString();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const gitSha = getGitSha() || null;
  const outPath = buildOutPath({
    repoRoot,
    outArg: args.out,
    gitSha,
    generatedAtUtc,
  });
  const maxFileBytes = Math.floor(args.maxFileMb * 1024 * 1024);
  const untrackedFileSet = getUntrackedFileSet();

  const { included, skipped, samples } = buildFileList({
    policy,
    maxFileBytes,
    verbose: args.verbose,
  });

  if (included.length === 0) {
    throw new Error("No files selected for zip:code. Relax the policy or max-file limit.");
  }

  const includedTrackedCount = included.filter(
    ({ path: relativePath }) => !untrackedFileSet.has(relativePath)
  ).length;
  const includedUntrackedCount = included.length - includedTrackedCount;
  const largestIncludedFiles = [...included]
    .sort((a, b) => b.size - a.size || a.path.localeCompare(b.path))
    .slice(0, DEFAULT_TOP_COUNT)
    .map((entry) => ({
      path: entry.path,
      size: formatBytes(entry.size),
      bytes: entry.size,
    }));

  let zipBytes = null;
  if (!args.dryRun) {
    await mkdir(path.dirname(outPath), { recursive: true });
    await makeZip({
      outPath,
      includedPaths: included.map((entry) => entry.path),
    });

    const stamp = {
      generated_at_utc: generatedAtUtc,
      timezone,
      git_sha: gitSha,
      zip_source: args.source,
      zip_mode: "code",
    };
    await addStampToZip({ zipPath: outPath, stamp });
    zipBytes = statSync(outPath).size;
  }

  const summary = {
    outPath,
    generatedAtUtc,
    gitSha,
    timezone,
    policyPath,
    includedCount: included.length,
    includedTrackedCount,
    includedUntrackedCount,
    skipped,
    samples,
    maxFileSize: formatBytes(maxFileBytes),
    zipSize: zipBytes === null ? null : formatBytes(zipBytes),
    zipBytes,
    largestIncludedFiles,
  };

  printSummary(summary, { json: args.json });
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
