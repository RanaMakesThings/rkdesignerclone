export type RefLike = {
  path: string;
  absolutePath?: string | null;
  exists?: boolean;
  provenance?: string;
  canonicalNavigation?: boolean;
  label?: string | null;
  ref?: RefLike | null;
  source?: string;
};

export type ArtifactGroup = {
  id: string;
  label: string;
  bucket: string;
  dir: RefLike;
  preview?: RefLike;
};

export type CanonicalVariantRef = {
  id?: string | null;
  label?: string | null;
  status?: string | null;
  summary?: string | null;
  preview?: RefLike | null;
  files: Array<{
    label?: string | null;
    ref?: RefLike | null;
  }>;
};

export type CanonicalAssetRef = {
  assetId?: string | null;
  id: string;
  label: string;
  status?: string | null;
  kind?: string | null;
  role?: string | null;
  summary?: string | null;
  preview?: RefLike | null;
  files: Array<{
    label?: string | null;
    ref?: RefLike | null;
  }>;
  sourceFiles: Array<{
    label?: string | null;
    ref?: RefLike | null;
  }>;
  tags: string[];
  notes: string[];
};

export type CanonicalReferenceRef = {
  id: string;
  label: string;
  status?: string | null;
  sourceType?: string | null;
  citationText: string;
  url?: string | null;
  files: Array<{
    label?: string | null;
    ref?: RefLike | null;
  }>;
  summary?: string | null;
  tags: string[];
  notes: string[];
  sourceKeys: string[];
};

export type ReferenceUsageRef = {
  id: string;
  referenceId: string;
  slideId: string;
  slideTitle?: string | null;
  displayNumber?: string | null;
  claim: string;
  placement?: string | null;
  status?: string | null;
  sortKey?: number | null;
  appendixNumber?: number | null;
  reference?: CanonicalReferenceRef | null;
};

export type PromotionCandidate = {
  id: string;
  source: "canonical-variant" | "discovered-branch";
  derivedVariantId: string;
  label: string;
  status: string;
  summary?: string | null;
  preview?: RefLike | null;
  bucket?: string | null;
  dir?: RefLike | null;
  files: Array<{
    label: string;
    ref?: RefLike | null;
  }>;
};

export type SourcePrecedenceItem = {
  id: string;
  label: string;
  detail: string;
};

export type SlideManifest = {
  id: string;
  displayNumber: string;
  importedSlides: number[];
  status: "active" | "deprecated";
  title: string;
  header?: string;
  subheader?: string;
  purpose?: string;
  takeaway?: string;
  figureRole?: string;
  family?: string;
  buildStatus?: string;
  selectedDirection?: string;
  notes: string[];
  proof: string[];
  aliases: {
    all: string[];
    canonicalIds: string[];
    displayAliases: string[];
    importedAliases: string[];
    pathAliases: string[];
  };
  canonical: {
    packet?: RefLike | null;
    specs: RefLike[];
    stampedDir?: RefLike | null;
    assetsManifest?: RefLike | null;
    deckAssetsManifest?: RefLike | null;
    selectedVariantId?: string | null;
    selectedVariantIdResolved?: boolean;
    variants: CanonicalVariantRef[];
    slideAssets: CanonicalAssetRef[];
    deckAssets: CanonicalAssetRef[];
  };
  previews: {
    selected?: RefLike | null;
    stampedNative?: RefLike | null;
    sameAsset: boolean;
    bestDiscovered?: RefLike | null;
  };
  reports: {
    slideReport?: RefLike | null;
    discoveredReports: RefLike[];
  };
  references: {
    proofCitationKeys: string[];
    missingCitationKeys: string[];
    current: ReferenceUsageRef[];
    archived: ReferenceUsageRef[];
  };
  discovered: {
    slideFigureDirs: RefLike[];
    figureBriefs: RefLike[];
    ideationDocs: RefLike[];
    compositions: RefLike[];
    renderBriefs: RefLike[];
    extraSpecs: RefLike[];
    branchGroups: ArtifactGroup[];
    reviewGroups: ArtifactGroup[];
    tuneRuns: ArtifactGroup[];
    variantTrees?: ArtifactGroup[];
    references: RefLike[];
    prompts: RefLike[];
  };
  promotionCandidates: PromotionCandidate[];
  historyGroups: {
    canonicalVariants: CanonicalVariantRef[];
    legacyDirectories: RefLike[];
    reviewGroups: ArtifactGroup[];
    tuneRuns: ArtifactGroup[];
    historicalBranches: ArtifactGroup[];
    variantTrees: ArtifactGroup[];
    variantBranches: ArtifactGroup[];
    discoveredReports: RefLike[];
  };
  searchText: string;
  derived: {
    artifactStatus: string;
    lineageStatus: string[];
    warnings: WarningItem[];
  };
};

export type WarningItem = {
  code: string;
  message: string;
  severity?: "warning" | "info" | "error";
  displayNumber?: string;
  slideId?: string;
  path?: string | null;
};

export type ProjectManifest = {
  projectId: string;
  title: string;
  version: string;
  status: string;
  projectRoot: string;
  deckSpecPath: string;
  generatedAt: string;
  sourceFingerprint: {
    deckSpecMtimeMs: number;
    projectFilesScanned: number;
  };
  sourcePrecedenceSummary: SourcePrecedenceItem[];
  numberingPolicy: {
    summary?: string;
    activeSequence: string[];
    deprecatedSlides: string[];
    notes: string[];
  };
  narrativeSpine: string[];
  docs: {
    readme?: RefLike | null;
    workflow?: RefLike | null;
    masterSlideSpecs?: RefLike | null;
    deckMatrix?: RefLike | null;
    figureCompanion?: RefLike | null;
    assessment?: RefLike | null;
    slideFineTuning?: RefLike | null;
    inputs: RefLike[];
    deckReport?: RefLike | null;
    deckReportPreview?: RefLike | null;
  };
  counts: {
    activeSlides: number;
    deprecatedSlides: number;
    withPacket: number;
    withSpec: number;
    withAssets: number;
    withSelectedPreview: number;
    withStampedNative: number;
    withSlideReport: number;
    withWarnings: number;
    withLegacyMismatch: number;
    withDiscoveredUnlinkedArtifacts: number;
  };
  assets: {
    deckManifest?: RefLike | null;
    deckAssets: CanonicalAssetRef[];
  };
  references: {
    manifest?: RefLike | null;
    template?: RefLike | null;
    generated: {
      dir?: RefLike | null;
      json?: RefLike | null;
      markdown?: RefLike | null;
      appendixHtml?: RefLike | null;
    };
    library: CanonicalReferenceRef[];
    running: Array<{
      appendixNumber: number;
      referenceId: string;
      reference: CanonicalReferenceRef;
      firstSeenSlideId: string;
      firstSeenDisplayNumber: string;
      slideIds: string[];
      displayNumbers: string[];
      usages: ReferenceUsageRef[];
    }>;
    slides: Array<{
      slideId: string;
      displayNumber: string;
      title: string;
      status: "active" | "deprecated";
      proofCitationKeys: string[];
      missingCitationKeys: string[];
      current: ReferenceUsageRef[];
      archived: ReferenceUsageRef[];
    }>;
    warnings: WarningItem[];
    stats: {
      libraryCount: number;
      usageCount: number;
      currentUsageCount: number;
      runningCount: number;
      activeSlideCountWithReferences: number;
    };
  };
  slides: SlideManifest[];
  orphanArtifacts: RefLike[];
  warnings: WarningItem[];
};
