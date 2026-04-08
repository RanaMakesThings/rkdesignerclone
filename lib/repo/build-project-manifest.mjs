import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { resolve, basename, extname } from "node:path";

import { classifyArtifactStatus } from "./classify-artifact.mjs";
import { readDeckSpec } from "./read-deck-spec.mjs";
import {
  readCanonicalAssetManifest,
  resolveSlideCanonicalAssets,
} from "./resolve-assets.mjs";
import { resolveSlideAliases } from "./resolve-slide-aliases.mjs";
import {
  findProjectOrphanSlideFigureDirs,
  scanSlideArtifacts,
} from "./scan-slide-artifacts.mjs";
import {
  classifyPathReference,
  normalizeRepoRelativePath,
  toRepoRelativePath,
} from "./path-normalize.mjs";
import { resolveCanonicalPreviewSet } from "./resolve-previews.mjs";
import {
  resolveCanonicalSlideReport,
  resolveDiscoveredReports,
} from "./resolve-reports.mjs";
import { compileProjectReferences } from "./resolve-references.mjs";

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

const uniqueWarnings = (items) => {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    if (!item?.code) {
      continue;
    }
    const key = `${item.code}:${item.slideId ?? ""}:${item.path ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(item);
  }
  return out;
};

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

const humanizeSlug = (value) =>
  String(value ?? "")
    .replace(/^slide-\d+-/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase())
    .trim();

const normalizeSearchText = (parts) =>
  parts
    .flatMap((part) => {
      if (Array.isArray(part)) {
        return part;
      }
      return [part];
    })
    .map((part) => String(part ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");

const safeReaddir = async (dirPath) => {
  try {
    return await readdir(dirPath, { withFileTypes: true });
  } catch (_error) {
    return [];
  }
};

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

const buildSourcePrecedenceSummary = () => [
  {
    id: "deck-spec",
    label: "Deck spec",
    detail:
      "deck-spec.json controls active versus deprecated state, selected direction, selectedVariantId, and canonical stamped paths.",
  },
  {
    id: "selected-preview",
    label: "Selected preview",
    detail:
      "selectedVariantId resolves first. Selected preview and stamped-native preview stay separate when they diverge.",
  },
  {
    id: "discovered-work",
    label: "Discovered work",
    detail:
      "Branches, tune runs, and reports found on disk remain visible, but they never override canonical state unless promoted explicitly.",
  },
  {
    id: "external-refs",
    label: "External refs",
    detail:
      "file:// and absolute paths outside the repo are treated as informational stale references, not navigable sources of truth.",
  },
];

const sortByDisplayOrder = (slides, activeSequence = []) => {
  const position = new Map(
    activeSequence.map((displayNumber, index) => [String(displayNumber), index])
  );
  return [...slides].sort((left, right) => {
    const leftPos = position.has(left.displayNumber)
      ? position.get(left.displayNumber)
      : Number.POSITIVE_INFINITY;
    const rightPos = position.has(right.displayNumber)
      ? position.get(right.displayNumber)
      : Number.POSITIVE_INFINITY;
    if (left.status === "active" && right.status === "active") {
      if (leftPos !== rightPos) {
        return leftPos - rightPos;
      }
    }
    if (left.status !== right.status) {
      return left.status === "active" ? -1 : 1;
    }
    return String(left.displayNumber).localeCompare(String(right.displayNumber));
  });
};

const buildLineageStatuses = ({
  slide,
  aliases,
  canonical,
  previews,
  discovered,
  reports,
}) => {
  const statuses = [];
  const stampedDirBase = canonical.stampedDir?.path
    ? basename(canonical.stampedDir.path).toLowerCase()
    : null;
  const identityAliases = new Set([
    ...(aliases.canonicalIds ?? []),
    ...(aliases.displayAliases ?? []),
    ...(aliases.importedAliases ?? []),
  ]);
  if (stampedDirBase && !identityAliases.has(stampedDirBase)) {
    statuses.push("legacy-path-mismatch");
  }

  if (slide.selectedVariantId && !canonical.selectedVariantIdResolved) {
    statuses.push("selected-variant-missing");
  }

  if (
    previews.selected?.exists &&
    previews.stampedNative?.exists &&
    !previews.sameAsset
  ) {
    statuses.push("selected-branch-differs-from-stamped-native");
  }

  if (
    !canonical.stampedDir &&
    (discovered.slideFigureDirs.length > 0 || reports.discoveredReports.length > 0)
  ) {
    statuses.push("discovered-unlinked-artifacts");
  }

  if (
    discovered.slideFigureDirs.some((dirRef) => /-legacy$/i.test(dirRef.path ?? ""))
  ) {
    statuses.push("orphan-historical-artifacts");
  }

  if (
    reports.slideReport &&
    canonical.stampedDir &&
    !reports.slideReport.path.startsWith(canonical.stampedDir.path)
  ) {
    statuses.push("report-outside-stamped-dir");
  }

  return [...new Set(statuses)];
};

const buildSlideWarnings = ({
  slide,
  canonical,
  previews,
  reports,
  discovered,
  lineageStatuses,
  unresolvedDeckAssetIds = [],
}) => {
  const warnings = [];
  const warn = (code, message, path = null, severity = "warning") => {
    warnings.push({
      code,
      slideId: slide.id,
      displayNumber: slide.displayNumber,
      message,
      path,
      severity,
    });
  };

  if (slide.selectedVariantId && !canonical.selectedVariantIdResolved) {
    warn(
      "selected-variant-missing",
      `selectedVariantId "${slide.selectedVariantId}" did not match any variant.`
    );
  }

  if (canonical.packet && !canonical.packet.exists) {
    warn("packet-missing", "Canonical packet path does not exist.", canonical.packet.path);
  }

  if (slide.status === "active" && !canonical.assetsManifest) {
    warn("assets-manifest-missing", "No canonical slide assets manifest is linked.");
  }

  if (canonical.specs.length === 0) {
    warn("spec-missing", "No canonical specs are linked.");
  } else if (!canonical.specs.some((spec) => spec.exists)) {
    warn("spec-missing", "Canonical specs are linked but none exist on disk.");
  }

  if (canonical.stampedDir && !canonical.stampedDir.exists) {
    warn(
      "canonical-path-missing",
      "Canonical stamped dir is configured but missing on disk.",
      canonical.stampedDir.path
    );
  }

  if (canonical.stampedDir && !reports.slideReport) {
    warn("report-missing", "No canonical slide report found in stamped dir.");
  }

  if (slide.selectedVariantId && previews.selected && !previews.selected.exists) {
    warn(
      "selected-preview-missing",
      "Selected variant preview path is configured but missing on disk.",
      previews.selected.path
    );
  }

  if (lineageStatuses.includes("legacy-path-mismatch")) {
    warn(
      "legacy-path-mismatch",
      "Canonical slide identity and artifact directory aliases diverge."
    );
  }

  if (lineageStatuses.includes("discovered-unlinked-artifacts")) {
    warn(
      "discovered-unlinked-artifacts",
      "Discovered artifacts exist without canonical stamped linkage."
    );
  }

  if (
    slide.status === "deprecated" &&
    (previews.selected?.exists || previews.stampedNative?.exists)
  ) {
    warn(
      "deprecated-has-live-assets",
      "Deprecated slide still has active-looking preview artifacts."
    );
  }

  if (
    discovered.slideFigureDirs.length > 0 &&
    !canonical.stampedDir &&
    slide.status === "active"
  ) {
    warn(
      "canonical-path-missing",
      "Active slide has discovered figure dirs but no canonical stampedDir."
    );
  }

  if (unresolvedDeckAssetIds.length > 0) {
    warn(
      "deck-asset-missing",
      `Linked deck assets were not found in deck assets manifest: ${unresolvedDeckAssetIds.join(
        ", "
      )}.`
    );
  }

  return warnings;
};

const buildProjectDocs = (repoRoot, projectRoot) => {
  const maybe = (pathLike, provenance = "canonical-human-authored") =>
    buildFileRef(repoRoot, pathLike, provenance);

  const docs = {
    readme: maybe(resolve(projectRoot, "README.md")),
    workflow: maybe(resolve(projectRoot, "workflow.md")),
    masterSlideSpecs: maybe(resolve(projectRoot, "master-slide-specs.md")),
    deckMatrix: maybe(resolve(projectRoot, "deck-matrix.md")),
    figureCompanion: maybe(resolve(projectRoot, "figure-companion.md")),
    assessment: maybe(resolve(projectRoot, "assessment.md")),
    slideFineTuning: maybe(resolve(projectRoot, "slide-fine-tuning.md")),
    inputs: [],
    deckReport: maybe(resolve(projectRoot, "deck-report.html"), "checked-in-generated"),
    deckReportPreview: maybe(
      resolve(projectRoot, "deck-report-preview.png"),
      "checked-in-generated"
    ),
  };

  const inputFileNames = [
    "pitch_deck_figure_workflow_manual.md",
    "vox_deck_slide_specs_clean_pack.md",
    "vox-full-slide-map-copy.md",
  ];
  docs.inputs = inputFileNames
    .map((name) => maybe(resolve(projectRoot, "inputs", name)))
    .filter(Boolean);

  return docs;
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
  return groups.sort((left, right) => left.dir.path.localeCompare(right.dir.path));
};

const buildHistoryGroups = ({
  slide,
  canonicalVariants,
  discovered,
  reports,
  lineageStatuses,
  variantBranches,
  canonicalStampedDir,
}) => {
  const legacyDirectories = uniqueByKey(
    [
      ...(lineageStatuses.includes("legacy-path-mismatch") && canonicalStampedDir
        ? [canonicalStampedDir]
        : []),
      ...discovered.slideFigureDirs.filter((dirRef) => /-legacy$/i.test(dirRef.path ?? "")),
    ],
    (entry) => entry.path
  );

  return {
    canonicalVariants: canonicalVariants.filter((variant) => variant.status !== "selected"),
    legacyDirectories,
    reviewGroups: discovered.reviewGroups,
    tuneRuns: discovered.tuneRuns,
    historicalBranches: discovered.branchGroups.filter(
      (group) =>
        /legacy|historical|shelved/i.test(group.label) || slide.status === "deprecated"
    ),
    variantTrees: discovered.variantTrees,
    variantBranches,
    discoveredReports: reports.discoveredReports,
  };
};

const buildSlideSearchText = ({
  slide,
  aliases,
  canonical,
  references,
  discovered,
  reports,
  promotionCandidates,
  historyGroups,
}) =>
  normalizeSearchText([
    slide.id,
    slide.displayNumber,
    slide.status,
    slide.title,
    slide.header,
    slide.subheader,
    slide.purpose,
    slide.takeaway,
    slide.figureRole,
    slide.family,
    slide.buildStatus,
    slide.selectedDirection,
    slide.notes,
    slide.proof,
    aliases.all,
    canonical.selectedVariantId,
    canonical.variants.flatMap((variant) => [
      variant.id,
      variant.label,
      variant.status,
      variant.summary,
      variant.preview?.path,
      variant.files.map((file) => file.ref?.path),
    ]),
    canonical.slideAssets.flatMap((asset) => [
      asset.assetId,
      asset.id,
      asset.label,
      asset.status,
      asset.kind,
      asset.role,
      asset.summary,
      asset.preview?.path,
      asset.files.map((file) => file.ref?.path),
      asset.sourceFiles.map((file) => file.ref?.path),
      asset.tags,
      asset.notes,
    ]),
    canonical.deckAssets.flatMap((asset) => [
      asset.assetId,
      asset.id,
      asset.label,
      asset.status,
      asset.kind,
      asset.role,
      asset.summary,
      asset.preview?.path,
      asset.files.map((file) => file.ref?.path),
      asset.sourceFiles.map((file) => file.ref?.path),
      asset.tags,
      asset.notes,
    ]),
    discovered.branchGroups.flatMap((group) => [group.label, group.bucket, group.dir.path]),
    discovered.reviewGroups.flatMap((group) => [group.label, group.bucket, group.dir.path]),
    discovered.tuneRuns.flatMap((group) => [group.label, group.bucket, group.dir.path]),
    discovered.variantTrees.flatMap((group) => [group.label, group.bucket, group.dir.path]),
    discovered.slideFigureDirs.map((ref) => ref.path),
    reports.slideReport?.path,
    reports.discoveredReports.map((report) => report.path),
    promotionCandidates.flatMap((candidate) => [
      candidate.id,
      candidate.source,
      candidate.derivedVariantId,
      candidate.label,
      candidate.summary,
      candidate.preview?.path,
      candidate.files.map((file) => file.ref?.path),
    ]),
    historyGroups.canonicalVariants.flatMap((variant) => [
      variant.id,
      variant.label,
      variant.summary,
    ]),
    historyGroups.legacyDirectories.map((ref) => ref.path),
    historyGroups.reviewGroups.flatMap((group) => [group.label, group.dir.path]),
    historyGroups.tuneRuns.flatMap((group) => [group.label, group.dir.path]),
    historyGroups.variantBranches.flatMap((group) => [group.label, group.dir.path]),
    references.current.flatMap((usage) => [
      usage.id,
      usage.claim,
      usage.placement,
      usage.reference?.id,
      usage.reference?.label,
      usage.reference?.sourceType,
      usage.reference?.citationText,
      usage.reference?.summary,
      usage.reference?.url,
      usage.reference?.tags,
    ]),
  ]);

const buildSlideManifest = async ({
  repoRoot,
  projectRoot,
  slide,
  deckAssetsManifestPath = null,
  compiledReferences = null,
}) => {
  const aliases = resolveSlideAliases({ repoRoot, slide });

  const canonicalPacket = buildFileRef(
    repoRoot,
    slide?.paths?.packet,
    "canonical-human-authored"
  );
  const canonicalSpecs = (Array.isArray(slide?.paths?.specs) ? slide.paths.specs : [])
    .map((pathLike) => buildFileRef(repoRoot, pathLike, "canonical-human-authored"))
    .filter(Boolean);
  const canonicalStampedDir = buildFileRef(
    repoRoot,
    slide?.paths?.stampedDir,
    "checked-in-generated"
  );
  const canonicalVariants = buildCanonicalVariantRefs(
    repoRoot,
    Array.isArray(slide?.variants) ? slide.variants : []
  );
  const resolvedAssets = resolveSlideCanonicalAssets({
    repoRoot,
    slideAssetsManifestPath: slide?.paths?.assetsManifest ?? null,
    deckAssetsManifestPath,
  });

  const discovered = await scanSlideArtifacts({
    repoRoot,
    projectRoot,
    slide,
    aliases,
    canonicalPaths: {
      packet: slide?.paths?.packet,
      specs: slide?.paths?.specs,
      stampedDir: slide?.paths?.stampedDir,
      variantPaths: Array.isArray(slide?.variants)
        ? slide.variants.flatMap((variant) => [
            variant?.previewPath,
            ...(Array.isArray(variant?.files)
              ? variant.files.map((file) => file?.path)
              : []),
          ])
        : [],
    },
  });

  const previewSet = resolveCanonicalPreviewSet({
    repoRoot,
    slide,
    discoveredGroups: [...discovered.branchGroups, ...discovered.variantTrees],
  });

  const canonicalSlideReport = resolveCanonicalSlideReport({
    repoRoot,
    slide,
  });
  const discoveredReports = resolveDiscoveredReports({
    repoRoot,
    canonicalSlideReport,
    discoveredReportPaths: discovered.discoveredReportPaths,
  });

  const canonical = {
    packet: canonicalPacket,
    specs: canonicalSpecs,
    stampedDir: canonicalStampedDir,
    assetsManifest: resolvedAssets.slideManifest,
    deckAssetsManifest: resolvedAssets.deckManifest,
    selectedVariantId: slide?.selectedVariantId ?? null,
    selectedVariantIdResolved: Boolean(previewSet.selectedVariant),
    variants: canonicalVariants,
    slideAssets: resolvedAssets.slideAssets,
    deckAssets: resolvedAssets.deckAssets,
  };
  const previews = {
    selected: previewSet.selected,
    stampedNative: previewSet.stampedNative,
    sameAsset: previewSet.sameAsset,
    bestDiscovered: previewSet.bestDiscovered,
  };
  const reports = {
    slideReport: canonicalSlideReport,
    discoveredReports,
  };
  const discoveredLane = {
    slideFigureDirs: discovered.slideFigureDirs,
    figureBriefs: discovered.figureBriefs,
    ideationDocs: discovered.ideationDocs,
    compositions: discovered.compositions,
    renderBriefs: discovered.renderBriefs,
    extraSpecs: discovered.extraSpecs,
    branchGroups: discovered.branchGroups,
    reviewGroups: discovered.reviewGroups,
    tuneRuns: discovered.tuneRuns,
    variantTrees: discovered.variantTrees,
    references: discovered.references,
    prompts: discovered.prompts,
  };
  const variantBranches = await collectVariantTreeBranches({
    repoRoot,
    variantTrees: discoveredLane.variantTrees,
  });

  const lineageStatuses = buildLineageStatuses({
    slide,
    aliases,
    canonical,
    previews,
    discovered: discoveredLane,
    reports,
  });

  const promotionCandidates = uniqueByKey(
    [
      ...buildCanonicalPromotionCandidates(canonicalVariants),
      ...discoveredLane.branchGroups
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

  const artifactStatus = classifyArtifactStatus({
    status: slide.status,
    hasPacket: Boolean(canonical.packet?.exists),
    hasSpec: canonical.specs.some((spec) => spec.exists),
    hasSelectedPreview: Boolean(previews.selected?.exists),
    hasStampedNative: Boolean(previews.stampedNative?.exists),
    selectedDiffersFromStamped:
      Boolean(previews.selected?.exists) &&
      Boolean(previews.stampedNative?.exists) &&
      !previews.sameAsset,
  });

  const referenceContext =
    compiledReferences?.slides?.find((entry) => entry.slideId === slide.id) ?? null;
  const referenceWarnings = (compiledReferences?.warnings ?? []).filter(
    (warning) => warning.slideId === slide.id
  );

  const warnings = uniqueWarnings([
    ...buildSlideWarnings({
      slide,
      canonical,
      previews,
      reports,
      discovered: discoveredLane,
      lineageStatuses,
      unresolvedDeckAssetIds: resolvedAssets.unresolvedDeckAssetIds,
    }),
    ...referenceWarnings,
  ]);

  const references = {
    proofCitationKeys: referenceContext?.proofCitationKeys ?? [],
    missingCitationKeys: referenceContext?.missingCitationKeys ?? [],
    current: referenceContext?.current ?? [],
    archived: referenceContext?.archived ?? [],
  };

  const historyGroups = buildHistoryGroups({
    slide,
    canonicalVariants,
    discovered: discoveredLane,
    reports,
    lineageStatuses,
    variantBranches,
    canonicalStampedDir,
  });
  const searchText = buildSlideSearchText({
    slide,
    canonical,
    references,
    discovered: discoveredLane,
    reports,
    aliases,
    promotionCandidates,
    historyGroups,
  });

  return {
    id: slide.id,
    displayNumber: String(slide.displayNumber ?? ""),
    importedSlides: Array.isArray(slide.importedSlides) ? slide.importedSlides : [],
    status: slide.status === "deprecated" ? "deprecated" : "active",
    title: slide.title ?? "",
    purpose: slide.purpose ?? "",
    header: slide.header ?? "",
    subheader: slide.subheader ?? "",
    takeaway: slide.takeaway ?? "",
    figureRole: slide.figureRole ?? "",
    family: slide.family ?? "",
    buildStatus: slide.buildStatus ?? "",
    selectedDirection: slide.selectedDirection ?? "",
    notes: Array.isArray(slide.notes) ? slide.notes : [],
    proof: Array.isArray(slide.proof) ? slide.proof : [],
    aliases,
    canonical,
    previews,
    reports,
    references,
    discovered: discoveredLane,
    promotionCandidates,
    historyGroups,
    searchText,
    derived: {
      artifactStatus,
      lineageStatus: lineageStatuses,
      warnings,
    },
  };
};

const buildProjectWarnings = ({ deckSpec, slideManifests, orphanArtifacts }) => {
  const warnings = [];
  const activeSlides = slideManifests.filter((slide) => slide.status === "active");
  const activeSequence = Array.isArray(deckSpec?.numberingPolicy?.activeSequence)
    ? deckSpec.numberingPolicy.activeSequence.map((item) => String(item))
    : [];
  const activeDisplayNumbers = new Set(activeSlides.map((slide) => slide.displayNumber));

  const missingFromSequence = activeSlides
    .filter((slide) => !activeSequence.includes(slide.displayNumber))
    .map((slide) => slide.displayNumber);
  if (missingFromSequence.length > 0) {
    warnings.push({
      code: "active-sequence-mismatch",
      message: `Active slides missing from numberingPolicy.activeSequence: ${missingFromSequence.join(
        ", "
      )}`,
      severity: "warning",
    });
  }

  const unknownInSequence = activeSequence.filter((display) => !activeDisplayNumbers.has(display));
  if (unknownInSequence.length > 0) {
    warnings.push({
      code: "active-sequence-orphans",
      message: `numberingPolicy.activeSequence references unknown active slides: ${unknownInSequence.join(
        ", "
      )}`,
      severity: "warning",
    });
  }

  if (orphanArtifacts.length > 0) {
    warnings.push({
      code: "orphan-historical-artifacts",
      message: `Found ${orphanArtifacts.length} historical slide-figure dirs not linked to current slide aliases.`,
      severity: "info",
    });
  }

  return warnings;
};

export const buildProjectManifest = async ({
  repoRoot,
  projectRoot,
  generatedAt = new Date().toISOString(),
} = {}) => {
  const { deckSpecPath, deckSpec } = await readDeckSpec(projectRoot);
  const projectId = String(deckSpec.deckId ?? basename(projectRoot));
  const projectAssets = readCanonicalAssetManifest({
    repoRoot,
    manifestPath: deckSpec?.paths?.deckAssetsManifest ?? null,
  });
  const compiledReferences = compileProjectReferences({
    repoRoot,
    projectRoot,
    deckSpec,
    generatedAt,
  });
  const slideManifests = [];

  for (const slide of deckSpec.slides) {
    slideManifests.push(
      await buildSlideManifest({
        repoRoot,
        projectRoot,
        slide,
        deckAssetsManifestPath: deckSpec?.paths?.deckAssetsManifest ?? null,
        compiledReferences,
      })
    );
  }

  const orderedSlides = sortByDisplayOrder(
    slideManifests,
    deckSpec?.numberingPolicy?.activeSequence
  );

  const orphanArtifacts = await findProjectOrphanSlideFigureDirs({
    projectRoot,
    repoRoot,
    slideAliasSets: orderedSlides.map((slide) => slide.aliases),
  });

  const projectWarnings = buildProjectWarnings({
    deckSpec,
    slideManifests: orderedSlides,
    orphanArtifacts,
  });

  const allWarnings = uniqueWarnings([
    ...projectWarnings,
    ...(compiledReferences.warnings ?? []).filter((warning) => !warning.slideId),
    ...orderedSlides.flatMap((slide) => slide.derived.warnings),
  ]);

  const counts = {
    activeSlides: orderedSlides.filter((slide) => slide.status === "active").length,
    deprecatedSlides: orderedSlides.filter((slide) => slide.status === "deprecated").length,
    withPacket: orderedSlides.filter((slide) => slide.canonical.packet?.exists).length,
    withSpec: orderedSlides.filter((slide) =>
      slide.canonical.specs.some((spec) => spec.exists)
    ).length,
    withAssets: orderedSlides.filter(
      (slide) => slide.canonical.slideAssets.length + slide.canonical.deckAssets.length > 0
    ).length,
    withSelectedPreview: orderedSlides.filter((slide) => slide.previews.selected?.exists).length,
    withStampedNative: orderedSlides.filter((slide) => slide.previews.stampedNative?.exists)
      .length,
    withSlideReport: orderedSlides.filter((slide) => slide.reports.slideReport?.exists).length,
    withWarnings: orderedSlides.filter((slide) => slide.derived.warnings.length > 0).length,
    withLegacyMismatch: orderedSlides.filter((slide) =>
      slide.derived.lineageStatus.includes("legacy-path-mismatch")
    ).length,
    withDiscoveredUnlinkedArtifacts: orderedSlides.filter((slide) =>
      slide.derived.lineageStatus.includes("discovered-unlinked-artifacts")
    ).length,
  };

  const deckSpecMtimeMs = existsSync(deckSpecPath)
    ? (await stat(deckSpecPath)).mtimeMs
    : 0;

  return {
    projectId,
    title: String(deckSpec.title ?? projectId),
    version: String(deckSpec.version ?? ""),
    status: String(deckSpec.status ?? "unknown"),
    projectRoot: normalizeRepoRelativePath(toRepoRelativePath(repoRoot, projectRoot)),
    deckSpecPath: normalizeRepoRelativePath(toRepoRelativePath(repoRoot, deckSpecPath)),
    generatedAt,
    sourceFingerprint: {
      deckSpecMtimeMs,
      projectFilesScanned: orderedSlides.reduce(
        (sum, slide) =>
          sum +
          slide.discovered.slideFigureDirs.length +
          slide.discovered.figureBriefs.length +
          slide.discovered.ideationDocs.length +
          slide.discovered.compositions.length +
          slide.discovered.renderBriefs.length +
          slide.discovered.extraSpecs.length,
        0
      ),
    },
    sourcePrecedenceSummary: buildSourcePrecedenceSummary(),
    numberingPolicy: {
      summary: deckSpec?.numberingPolicy?.summary ?? "",
      activeSequence: Array.isArray(deckSpec?.numberingPolicy?.activeSequence)
        ? deckSpec.numberingPolicy.activeSequence
        : [],
      deprecatedSlides: Array.isArray(deckSpec?.numberingPolicy?.deprecatedSlides)
        ? deckSpec.numberingPolicy.deprecatedSlides
        : [],
      notes: Array.isArray(deckSpec?.numberingPolicy?.notes)
        ? deckSpec.numberingPolicy.notes
        : [],
    },
    narrativeSpine: Array.isArray(deckSpec.narrativeSpine) ? deckSpec.narrativeSpine : [],
    docs: buildProjectDocs(repoRoot, projectRoot),
    assets: {
      deckManifest: projectAssets.manifest,
      deckAssets: projectAssets.assets,
    },
    references: {
      manifest: compiledReferences.manifest,
      template: compiledReferences.template,
      generated: compiledReferences.generated,
      library: compiledReferences.library,
      running: compiledReferences.running,
      slides: compiledReferences.slides,
      warnings: compiledReferences.warnings,
      stats: compiledReferences.stats,
    },
    counts,
    slides: orderedSlides,
    orphanArtifacts,
    warnings: allWarnings,
  };
};
