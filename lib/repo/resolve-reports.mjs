import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { classifyPathReference, toRepoRelativePath } from "./path-normalize.mjs";

export const resolveCanonicalSlideReport = ({ repoRoot, slide }) => {
  const stampedDirRef = classifyPathReference(repoRoot, slide?.paths?.stampedDir);
  if (stampedDirRef.kind !== "repo-relative") {
    return null;
  }
  const reportPath = resolve(stampedDirRef.absolutePath, "report.html");
  if (!existsSync(reportPath)) {
    return null;
  }
  return {
    path: toRepoRelativePath(repoRoot, reportPath),
    absolutePath: reportPath,
    exists: true,
    provenance: "checked-in-generated",
    source: "stamped-dir-report",
    canonicalNavigation: true,
  };
};

export const resolveDiscoveredReports = ({
  repoRoot,
  canonicalSlideReport,
  discoveredReportPaths = [],
}) => {
  const canonicalPath = canonicalSlideReport?.path ?? null;
  const refs = [];
  for (const reportPath of discoveredReportPaths) {
    if (!existsSync(reportPath)) {
      continue;
    }
    const repoRelativePath = toRepoRelativePath(repoRoot, reportPath);
    if (repoRelativePath === canonicalPath) {
      continue;
    }
    refs.push({
      path: repoRelativePath,
      absolutePath: reportPath,
      exists: true,
      provenance: "discovered",
      source: "discovered-report",
      canonicalNavigation: true,
    });
  }

  return refs.sort((left, right) => left.path.localeCompare(right.path));
};
