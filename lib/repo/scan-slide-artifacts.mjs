import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";

import { classifyArtifactBucket } from "./classify-artifact.mjs";
import { classifyPathReference, toRepoRelativePath } from "./path-normalize.mjs";

const PREVIEW_FILE_NAMES = [
  "preview.png",
  "preview.jpg",
  "preview.jpeg",
  "figure.png",
  "figure.jpg",
  "figure.jpeg",
  "image-01.jpg",
  "image-01.png",
];

const SOURCE_DOC_DIRS = ["briefs", "ideation", "compositions", "render-briefs", "specs"];
const HTML_SURFACE_RE = /(^|[-_/])(gemini|openai|anthropic|codex)?-?html$/i;

const uniqueSorted = (items) => [...new Set(items.filter(Boolean))].sort();

const safelyReadDir = async (dirPath) => {
  if (!existsSync(dirPath)) {
    return [];
  }
  try {
    return await readdir(dirPath, { withFileTypes: true });
  } catch (_error) {
    return [];
  }
};

const collectTopLevelSlideFigureDirs = async (projectRoot) => {
  const root = resolve(projectRoot, "slide-figures");
  const entries = await safelyReadDir(root);
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(root, entry.name));
};

const isAliasMatch = (dirName, aliasSet) => {
  const normalized = String(dirName ?? "").toLowerCase();
  if (aliasSet.has(normalized)) {
    return true;
  }
  for (const alias of aliasSet) {
    if (!alias.startsWith("slide-")) {
      continue;
    }
    if (normalized === alias || normalized.startsWith(`${alias}-`)) {
      return true;
    }
  }
  return false;
};

const toFileRef = (repoRoot, absolutePath, provenance = "discovered") => ({
  path: toRepoRelativePath(repoRoot, absolutePath),
  absolutePath,
  exists: existsSync(absolutePath),
  provenance,
  canonicalNavigation: true,
});

const findPreviewInDir = async (dirPath) => {
  const direct = PREVIEW_FILE_NAMES.map((name) => resolve(dirPath, name)).find((path) =>
    existsSync(path)
  );
  if (direct) {
    return direct;
  }

  const children = await safelyReadDir(dirPath);
  for (const child of children) {
    if (!child.isDirectory()) {
      continue;
    }
    const nestedDir = resolve(dirPath, child.name);
    const nestedCandidate = PREVIEW_FILE_NAMES.map((name) => resolve(nestedDir, name)).find(
      (path) => existsSync(path)
    );
    if (nestedCandidate) {
      return nestedCandidate;
    }
  }
  return null;
};

const collectReportPaths = async (dirPath) => {
  const reportPaths = [];
  const direct = resolve(dirPath, "report.html");
  if (existsSync(direct)) {
    reportPaths.push(direct);
  }
  const children = await safelyReadDir(dirPath);
  for (const child of children) {
    if (!child.isDirectory()) {
      continue;
    }
    const nested = resolve(dirPath, child.name, "report.html");
    if (existsSync(nested)) {
      reportPaths.push(nested);
    }
  }
  return reportPaths;
};

const collectMatchingProjectDocs = async ({
  projectRoot,
  repoRoot,
  aliases,
  dirName,
  excludePaths = [],
}) => {
  const root = resolve(projectRoot, "figures", dirName);
  const aliasSet = new Set(aliases);
  const excluded = new Set(
    excludePaths
      .map((path) => classifyPathReference(repoRoot, path))
      .filter((entry) => entry.kind === "repo-relative")
      .map((entry) => entry.absolutePath)
  );

  const entries = await safelyReadDir(root);
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => resolve(root, entry.name))
    .filter((fullPath) => {
      if (excluded.has(fullPath)) {
        return false;
      }
      const name = basename(fullPath).toLowerCase();
      return [...aliasSet].some((alias) => name.startsWith(alias));
    })
    .sort()
    .map((fullPath) => toFileRef(repoRoot, fullPath));
};

const collectMatchingFlatFiles = async ({ dirPath, repoRoot, aliases }) => {
  const entries = await safelyReadDir(dirPath);
  const aliasSet = new Set(aliases);
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => resolve(dirPath, entry.name))
    .filter((fullPath) => {
      const lowerName = basename(fullPath).toLowerCase();
      return [...aliasSet].some((alias) => lowerName.startsWith(alias));
    })
    .sort()
    .map((fullPath) => toFileRef(repoRoot, fullPath));
};

const buildArtifactGroup = ({ repoRoot, absoluteDirPath, bucket }) => ({
  id: basename(absoluteDirPath),
  label: basename(absoluteDirPath),
  bucket,
  dir: {
    path: toRepoRelativePath(repoRoot, absoluteDirPath),
    absolutePath: absoluteDirPath,
    exists: true,
    provenance: "discovered",
    canonicalNavigation: true,
  },
});

const addGroupPreview = (group, previewPath, repoRoot) => {
  if (!previewPath) {
    return group;
  }
  return {
    ...group,
    preview: {
      path: toRepoRelativePath(repoRoot, previewPath),
      absolutePath: previewPath,
      exists: true,
      provenance: "discovered",
      source: "discovered-group-preview",
      canonicalNavigation: true,
    },
  };
};

const collectNestedTuneRunGroups = async ({ repoRoot, artifactDir }) => {
  const tuneDir = resolve(artifactDir, "tune");
  const entries = await safelyReadDir(tuneDir);
  const groups = [];
  const reportPaths = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const runDir = resolve(tuneDir, entry.name);
    const statePath = resolve(runDir, "state.json");
    if (!existsSync(statePath)) {
      continue;
    }
    const previewPath = await findPreviewInDir(runDir);
    const reportPath = resolve(runDir, "report.html");
    if (existsSync(reportPath)) {
      reportPaths.push(reportPath);
    }
    groups.push(
      addGroupPreview(
        buildArtifactGroup({ repoRoot, absoluteDirPath: runDir, bucket: "tune" }),
        previewPath,
        repoRoot
      )
    );
  }

  return {
    groups,
    reportPaths,
  };
};

export const scanSlideArtifacts = async ({
  repoRoot,
  projectRoot,
  slide,
  aliases,
  canonicalPaths = {},
}) => {
  const aliasSet = new Set(
    uniqueSorted([
      ...(aliases?.all ?? []),
      ...(aliases?.pathAliases ?? []),
      ...(aliases?.displayAliases ?? []),
      ...(aliases?.canonicalIds ?? []),
      ...(aliases?.importedAliases ?? []),
    ]).map((value) => String(value).toLowerCase())
  );

  const canonicalDirCandidates = [
    canonicalPaths.packet,
    ...(canonicalPaths.specs ?? []),
    canonicalPaths.stampedDir,
    ...(canonicalPaths.variantPaths ?? []),
  ]
    .map((path) => classifyPathReference(repoRoot, path))
    .filter((entry) => entry.kind === "repo-relative")
    .map((entry) => entry.absolutePath);

  const canonicalParentDirs = canonicalDirCandidates
    .map((path) => (extname(path) ? resolve(path, "..") : path))
    .filter((path) => existsSync(path));

  const matchedSlideFigureDirs = (await collectTopLevelSlideFigureDirs(projectRoot)).filter(
    (dirPath) => isAliasMatch(basename(dirPath), aliasSet)
  );

  const candidateDirs = uniqueSorted([...canonicalParentDirs, ...matchedSlideFigureDirs])
    .filter((dirPath) => existsSync(dirPath));

  const branchGroups = [];
  const reviewGroups = [];
  const tuneRuns = [];
  const variantTrees = [];
  const reportPathSet = new Set();

  for (const dirPath of candidateDirs) {
    const reports = await collectReportPaths(dirPath);
    for (const reportPath of reports) {
      reportPathSet.add(reportPath);
    }

    const children = await safelyReadDir(dirPath);
    for (const child of children) {
      if (!child.isDirectory()) {
        continue;
      }
      const childDir = resolve(dirPath, child.name);
      const bucket = classifyArtifactBucket(child.name);
      const previewPath = await findPreviewInDir(childDir);
      const group = addGroupPreview(
        buildArtifactGroup({ repoRoot, absoluteDirPath: childDir, bucket }),
        previewPath,
        repoRoot
      );

      if (bucket === "review") {
        reviewGroups.push(group);
      } else if (bucket === "tune") {
        tuneRuns.push(group);
      } else if (bucket === "variant-tree") {
        variantTrees.push(group);
      } else if (bucket === "repair") {
        reviewGroups.push(group);
      } else {
        branchGroups.push(group);
      }

      if (HTML_SURFACE_RE.test(child.name)) {
        const nestedTuneRuns = await collectNestedTuneRunGroups({
          repoRoot,
          artifactDir: childDir,
        });
        tuneRuns.push(...nestedTuneRuns.groups);
        for (const reportPath of nestedTuneRuns.reportPaths) {
          reportPathSet.add(reportPath);
        }
      }
    }
  }

  const canonicalSpecPaths = Array.isArray(canonicalPaths.specs) ? canonicalPaths.specs : [];
  const figureBriefs = await collectMatchingProjectDocs({
    projectRoot,
    repoRoot,
    aliases: aliasSet,
    dirName: "briefs",
  });
  const ideationDocs = await collectMatchingProjectDocs({
    projectRoot,
    repoRoot,
    aliases: aliasSet,
    dirName: "ideation",
  });
  const compositions = await collectMatchingProjectDocs({
    projectRoot,
    repoRoot,
    aliases: aliasSet,
    dirName: "compositions",
  });
  const renderBriefs = await collectMatchingProjectDocs({
    projectRoot,
    repoRoot,
    aliases: aliasSet,
    dirName: "render-briefs",
  });
  const extraSpecs = await collectMatchingProjectDocs({
    projectRoot,
    repoRoot,
    aliases: aliasSet,
    dirName: "specs",
    excludePaths: canonicalSpecPaths,
  });

  const references = await collectMatchingFlatFiles({
    dirPath: resolve(projectRoot, "references"),
    repoRoot,
    aliases: aliasSet,
  });
  const prompts = await collectMatchingFlatFiles({
    dirPath: resolve(projectRoot, "prompts"),
    repoRoot,
    aliases: aliasSet,
  });

  return {
    slideFigureDirs: candidateDirs.map((dirPath) => ({
      path: toRepoRelativePath(repoRoot, dirPath),
      absolutePath: dirPath,
      exists: true,
      provenance: "discovered",
      canonicalNavigation: true,
    })),
    figureBriefs,
    ideationDocs,
    compositions,
    renderBriefs,
    extraSpecs,
    branchGroups: branchGroups.sort((left, right) => left.dir.path.localeCompare(right.dir.path)),
    reviewGroups: reviewGroups.sort((left, right) => left.dir.path.localeCompare(right.dir.path)),
    tuneRuns: tuneRuns.sort((left, right) => left.dir.path.localeCompare(right.dir.path)),
    variantTrees: variantTrees.sort((left, right) => left.dir.path.localeCompare(right.dir.path)),
    references,
    prompts,
    discoveredReportPaths: [...reportPathSet].sort(),
  };
};

export const findProjectOrphanSlideFigureDirs = async ({
  projectRoot,
  slideAliasSets = [],
  repoRoot,
}) => {
  const topLevelDirs = await collectTopLevelSlideFigureDirs(projectRoot);
  const aliasSets = slideAliasSets.map((aliases) =>
    new Set((aliases?.all ?? []).map((value) => String(value).toLowerCase()))
  );

  const orphans = [];
  for (const dirPath of topLevelDirs) {
    const name = basename(dirPath).toLowerCase();
    const isKnown = aliasSets.some((aliases) => isAliasMatch(name, aliases));
    if (!isKnown) {
      orphans.push({
        id: name,
        path: toRepoRelativePath(repoRoot, dirPath),
        absolutePath: dirPath,
        exists: true,
        provenance: "orphan-historical",
        canonicalNavigation: true,
      });
    }
  }
  return orphans.sort((left, right) => left.path.localeCompare(right.path));
};

export const getSourceDocDirs = () => [...SOURCE_DOC_DIRS];
