#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import process from "node:process";
import { createRequire } from "node:module";

import { getDesignerDataPaths, loadDesignerIgnoreMatcher } from "../../lib/repo/index.mjs";

const require = createRequire(import.meta.url);
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");

const LEGACY_PRESENTATION_REF = "output/figures/presentation-images/";
const RAW_RESPONSE_PATTERN = /(^|\/)response\.json$/;
const NONCANONICAL_TREE_PATTERN = /(^|\/)(exports|experiments|archive|tmp|raw)(\/|$)/;

const listTrackedFiles = (repoRoot) =>
  execFileSync("git", ["ls-files", "-z"], {
    cwd: repoRoot,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);

const isTrackedRawPayload = (filePath) => RAW_RESPONSE_PATTERN.test(filePath);

const isCleanupCandidate = (filePath) =>
  isTrackedRawPayload(filePath) || NONCANONICAL_TREE_PATTERN.test(filePath);

const isFutureWriteViolation = (filePath) =>
  filePath.startsWith("output/") ||
  filePath.startsWith("_handoff/") ||
  filePath.startsWith("apps/studio/.next/") ||
  isCleanupCandidate(filePath);

const countByPrefix = (paths) => {
  const buckets = new Map();
  for (const filePath of paths) {
    const bucket =
      filePath.startsWith("projects/designer-health/slide-figures/")
        ? "slide-figures"
        : filePath.startsWith("projects/designer-health/experiments/")
          ? "experiments"
          : filePath.startsWith("projects/designer-health/slide-assets/")
            ? "slide-assets"
            : "other";
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }
  return Object.fromEntries(
    [...buckets.entries()].sort(([left], [right]) => left.localeCompare(right))
  );
};

const toSizeLabel = (sizeBytes) => {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (sizeBytes >= 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }
  return `${sizeBytes} B`;
};

const main = async () => {
  const argv = await yargs(hideBin(process.argv))
    .scriptName("studio:audit")
    .option("json", {
      type: "boolean",
      default: false,
      describe: "Print audit output as JSON",
    })
    .strict()
    .help()
    .parseAsync();

  const repoRoot = resolve(process.cwd());
  const designerDataPaths = getDesignerDataPaths({ cwd: repoRoot });
  const ignoreMatcher = await loadDesignerIgnoreMatcher(repoRoot);
  const trackedFiles = listTrackedFiles(repoRoot);

  const rawPayloads = trackedFiles.filter(isTrackedRawPayload);
  const cleanupCandidates = trackedFiles.filter(isCleanupCandidate);
  const futureWriteViolations = trackedFiles.filter(isFutureWriteViolation);
  const ignoredTrackedFiles = trackedFiles.filter((filePath) => ignoreMatcher(filePath));
  const handoffSurface = trackedFiles.filter((filePath) => !ignoreMatcher(filePath));

  const legacyCompatibilityRefs = [];
  for (const filePath of trackedFiles) {
    if (basename(filePath) !== "version.json") {
      continue;
    }
    const absolutePath = resolve(repoRoot, filePath);
    if (!existsSync(absolutePath)) {
      continue;
    }
    const contents = await readFile(absolutePath, "utf8");
    if (contents.includes(LEGACY_PRESENTATION_REF)) {
      legacyCompatibilityRefs.push(filePath);
    }
  }

  const largeNoncanonicalFiles = [];
  for (const filePath of cleanupCandidates) {
    const absolutePath = resolve(repoRoot, filePath);
    if (!existsSync(absolutePath)) {
      continue;
    }
    const fileStat = await stat(absolutePath);
    if (!fileStat.isFile()) {
      continue;
    }
    largeNoncanonicalFiles.push({
      path: filePath,
      sizeBytes: fileStat.size,
    });
  }
  largeNoncanonicalFiles.sort((left, right) => right.sizeBytes - left.sizeBytes);

  const report = {
    repoRoot,
    designerDataRoot: designerDataPaths.dataRoot,
    summary: {
      trackedFileCount: trackedFiles.length,
      handoffSurfaceCount: handoffSurface.length,
      ignoredTrackedCount: ignoredTrackedFiles.length,
      futureWriteViolationCount: futureWriteViolations.length,
      cleanupCandidateCount: cleanupCandidates.length,
      rawPayloadCount: rawPayloads.length,
      legacyCompatibilityRefCount: legacyCompatibilityRefs.length,
    },
    futureWriteViolations: futureWriteViolations.slice(0, 100),
    cleanupCandidates: cleanupCandidates.slice(0, 200),
    rawPayloadBreakdown: countByPrefix(rawPayloads),
    legacyCompatibilityRefs,
    ignoredTrackedSample: ignoredTrackedFiles.slice(0, 100),
    largeNoncanonicalFiles: largeNoncanonicalFiles.slice(0, 25),
  };

  if (argv.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  const lines = [
    "Designer Studio Audit",
    "",
    `Repo root: ${repoRoot}`,
    `Designer data root: ${designerDataPaths.dataRoot}`,
    "",
    "Summary",
    `- tracked files: ${report.summary.trackedFileCount}`,
    `- handoff surface after .designerignore: ${report.summary.handoffSurfaceCount}`,
    `- ignored tracked files: ${report.summary.ignoredTrackedCount}`,
    `- future-write violations: ${report.summary.futureWriteViolationCount}`,
    `- cleanup candidates: ${report.summary.cleanupCandidateCount}`,
    `- tracked raw payloads: ${report.summary.rawPayloadCount}`,
    `- legacy presentation-image refs: ${report.summary.legacyCompatibilityRefCount}`,
    "",
    "Tracked raw payload breakdown",
  ];

  for (const [bucket, count] of Object.entries(report.rawPayloadBreakdown)) {
    lines.push(`- ${bucket}: ${count}`);
  }

  lines.push("", "Top noncanonical files");
  for (const entry of report.largeNoncanonicalFiles) {
    lines.push(`- ${entry.path} (${toSizeLabel(entry.sizeBytes)})`);
  }

  lines.push("", "Legacy compatibility refs");
  for (const filePath of legacyCompatibilityRefs.slice(0, 100)) {
    lines.push(`- ${filePath}`);
  }

  process.stdout.write(`${lines.join("\n")}\n`);
};

await main();
