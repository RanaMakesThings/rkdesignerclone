import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";

import {
  classifyPathReference,
  toRepoRelativePath,
} from "./path-normalize.mjs";
import { resolveSlideAliases } from "./resolve-slide-aliases.mjs";
import { scanSlideArtifacts } from "./scan-slide-artifacts.mjs";

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

const KNOWN_PROMOTION_FILES = [
  ["HTML", "generated.html"],
  ["Preview SVG", "preview.svg"],
  ["Figure HTML", "figure.html"],
  ["Figure PNG", "figure.png"],
  ["Figure JPG", "figure.jpg"],
  ["Report", "report.html"],
  ["Spec", "spec.json"],
];

const uniqueByKey = (items, keyFn) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const safeReaddir = async (dirPath) => {
  try {
    return await readdir(dirPath, { withFileTypes: true });
  } catch (_error) {
    return [];
  }
};

const buildFileRef = (repoRoot, pathLike, provenance = "canonical") => {
  const classified = classifyPathReference(repoRoot, pathLike);
  if (classified.kind === "repo-relative") {
    return {
      path: classified.repoRelativePath,
      absolutePath: classified.absolutePath,
      exists: existsSync(classified.absolutePath),
      provenance,
      canonicalNavigation: true,
    };
  }
  if (classified.kind === "external-stale") {
    return {
      path: String(pathLike ?? ""),
      absolutePath: null,
      exists: false,
      provenance: "external-stale",
      canonicalNavigation: false,
    };
  }
  return null;
};

const humanizeSlug = (value) =>
  String(value ?? "")
    .replace(/^slide-\d+-/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase())
    .trim();

const findPreviewPath = async (dirPath) => {
  const direct = PREVIEW_FILE_NAMES.map((name) => resolve(dirPath, name)).find((path) =>
    existsSync(path)
  );
  if (direct) {
    return direct;
  }

  const entries = await safeReaddir(dirPath);
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const nestedDir = resolve(dirPath, entry.name);
    const nested = PREVIEW_FILE_NAMES.map((name) => resolve(nestedDir, name)).find((path) =>
      existsSync(path)
    );
    if (nested) {
      return nested;
    }
  }
  return null;
};

const buildDiscoveredArtifactGroup = async ({
  repoRoot,
  absoluteDirPath,
  bucket = "branch",
}) => {
  const previewPath = await findPreviewPath(absoluteDirPath);
  return {
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
    preview: previewPath ? buildFileRef(repoRoot, previewPath, "discovered") : null,
  };
};

const collectPromotionFiles = ({
  repoRoot,
  candidateDir,
  previewRef,
}) => {
  const refs = [];
  const pushRef = (label, absolutePath, provenance = "discovered") => {
    const ref = buildFileRef(repoRoot, absolutePath, provenance);
    if (ref) {
      refs.push({ label, ref });
    }
  };

  pushRef("Discovered Branch", candidateDir, "discovered");

  if (previewRef?.absolutePath) {
    pushRef("Preview", previewRef.absolutePath, previewRef.provenance ?? "discovered");
    const siblingDirs = uniqueByKey(
      [resolve(candidateDir), resolve(previewRef.absolutePath, "..")],
      (entry) => entry
    );
    for (const siblingDir of siblingDirs) {
      for (const [label, fileName] of KNOWN_PROMOTION_FILES) {
        const candidate = resolve(siblingDir, fileName);
        if (existsSync(candidate)) {
          pushRef(label, candidate, "discovered");
        }
      }
    }
  }

  return uniqueByKey(refs, (entry) => entry.ref?.path ?? `${entry.label}:${candidateDir}`);
};

const buildCanonicalVariantRefs = (repoRoot, variants = []) =>
  variants.map((variant) => ({
    id: variant.id ?? null,
    label: variant.label ?? null,
    status: variant.status ?? null,
    summary: variant.summary ?? null,
    preview: buildFileRef(repoRoot, variant.previewPath, "canonical"),
    files: Array.isArray(variant.files)
      ? variant.files
          .map((file) => ({
            label: file?.label ?? null,
            ref: buildFileRef(repoRoot, file?.path, "canonical"),
          }))
          .filter((item) => item.ref)
      : [],
  }));

const buildCanonicalPromotionCandidates = (canonicalVariants = []) =>
  canonicalVariants
    .filter((variant) => variant.id)
    .map((variant) => ({
      id: String(variant.id),
      source: "canonical-variant",
      derivedVariantId: String(variant.id),
      label: variant.label ?? humanizeSlug(variant.id),
      status: variant.status ?? "option",
      summary: variant.summary ?? null,
      preview: variant.preview ?? null,
      bucket: "canonical-variant",
      dir: variant.files.find((file) => file.ref?.absolutePath && !extname(file.ref.absolutePath))
        ?.ref ?? null,
      files: variant.files.map((file) => ({
        label: file.label ?? "File",
        ref: file.ref ?? null,
      })),
    }));

const buildDiscoveredPromotionCandidate = ({
  repoRoot,
  group,
  bucket = group.bucket,
}) => {
  if (!group?.dir?.absolutePath || !group?.preview?.path) {
    return null;
  }

  const derivedVariantId = basename(group.dir.absolutePath);
  return {
    id: group.dir.path,
    source: "discovered-branch",
    derivedVariantId,
    label: humanizeSlug(group.label ?? derivedVariantId) || derivedVariantId,
    status: "discovered",
    summary: `Previewable discovered ${bucket.replace(/-/g, " ")} rooted at ${group.dir.path}.`,
    preview: group.preview,
    bucket,
    dir: group.dir,
    files: collectPromotionFiles({
      repoRoot,
      candidateDir: group.dir.absolutePath,
      previewRef: group.preview,
    }),
  };
};

const collectVariantTreeBranches = async ({ repoRoot, variantTrees = [] }) => {
  const groups = [];
  for (const tree of variantTrees) {
    const treeDir = tree?.dir?.absolutePath;
    if (!treeDir) {
      continue;
    }
    const entries = await safeReaddir(treeDir);
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const childGroup = await buildDiscoveredArtifactGroup({
        repoRoot,
        absoluteDirPath: resolve(treeDir, entry.name),
        bucket: "variant-branch",
      });
      if (childGroup.preview?.path) {
        groups.push(childGroup);
      }
    }
  }
  return groups;
};

export const resolveSlidePromotionCandidates = async ({
  repoRoot,
  projectRoot,
  slide,
}) => {
  if (!repoRoot || !projectRoot || !slide) {
    throw new Error("repoRoot, projectRoot, and slide are required.");
  }

  const aliases = resolveSlideAliases({ repoRoot, slide });
  const canonicalPaths = {
    packet: slide?.paths?.packet ?? null,
    specs: Array.isArray(slide?.paths?.specs) ? slide.paths.specs : [],
    stampedDir: slide?.paths?.stampedDir ?? null,
    variantPaths: Array.isArray(slide?.variants)
      ? slide.variants.flatMap((variant) => [
          variant?.previewPath,
          ...(Array.isArray(variant?.files) ? variant.files.map((file) => file?.path) : []),
        ])
      : [],
  };
  const discovered = await scanSlideArtifacts({
    repoRoot,
    projectRoot,
    slide,
    aliases,
    canonicalPaths,
  });
  const canonicalVariants = buildCanonicalVariantRefs(repoRoot, slide?.variants ?? []);
  const variantBranches = await collectVariantTreeBranches({
    repoRoot,
    variantTrees: discovered.variantTrees,
  });

  return uniqueByKey(
    [
      ...buildCanonicalPromotionCandidates(canonicalVariants),
      ...discovered.branchGroups
        .map((group) => buildDiscoveredPromotionCandidate({ repoRoot, group }))
        .filter(Boolean),
      ...variantBranches
        .map((group) =>
          buildDiscoveredPromotionCandidate({
            repoRoot,
            group,
            bucket: "variant-branch",
          })
        )
        .filter(Boolean),
    ],
    (candidate) => `${candidate.source}:${candidate.id}`
  );
};
