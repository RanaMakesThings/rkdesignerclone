import type { RefLike } from "./studio-types";

export type StudioAssetKind =
  | "image"
  | "html"
  | "svg"
  | "json"
  | "directory"
  | "other";

export type StudioAssetRef = RefLike & {
  kind: StudioAssetKind;
};

export type StudioCanonicalAsset = {
  assetId: string | null;
  id: string;
  label: string;
  status: string | null;
  kind: string | null;
  role: string | null;
  summary: string | null;
  preview: StudioAssetRef | null;
  files: Array<{
    label?: string | null;
    ref?: StudioAssetRef | null;
  }>;
  sourceFiles: Array<{
    label?: string | null;
    ref?: StudioAssetRef | null;
  }>;
  tags: string[];
  notes: string[];
};

export type StudioReference = {
  id: string;
  label: string;
  status: string | null;
  sourceType: string | null;
  citationText: string;
  url: string | null;
  files: Array<{
    label?: string | null;
    ref?: StudioAssetRef | null;
  }>;
  summary: string | null;
  tags: string[];
  notes: string[];
  sourceKeys: string[];
};

export type StudioReferenceUsage = {
  id: string;
  referenceId: string;
  slideId: string;
  slideTitle: string | null;
  displayNumber: string | null;
  claim: string;
  placement: string | null;
  status: string | null;
  sortKey: number | null;
  appendixNumber: number | null;
  reference: StudioReference | null;
};

export type StudioProjectReferences = {
  manifest: StudioAssetRef | null;
  template: StudioAssetRef | null;
  generated: {
    dir: StudioAssetRef | null;
    json: StudioAssetRef | null;
    markdown: StudioAssetRef | null;
    appendixHtml: StudioAssetRef | null;
  };
  library: StudioReference[];
  running: Array<{
    appendixNumber: number;
    referenceId: string;
    reference: StudioReference;
    firstSeenSlideId: string;
    firstSeenDisplayNumber: string;
    slideIds: string[];
    displayNumbers: string[];
    usages: StudioReferenceUsage[];
  }>;
  warnings: Array<{
    code: string;
    message: string;
    severity?: string;
    slideId?: string;
  }>;
  stats: {
    libraryCount: number;
    usageCount: number;
    currentUsageCount: number;
    runningCount: number;
    activeSlideCountWithReferences: number;
  };
};

export type StudioGeneratedGraphic = {
  graphicId: string;
  batchId: string;
  batchSlug: string;
  batchGeneratedAt: string | null;
  provider: string;
  providerLabel: string;
  versionId: string;
  versionLabel: string;
  variantId: string | null;
  variantLabel: string | null;
  summary: string | null;
  specText: string;
  batchManifest: StudioAssetRef | null;
  batchDir: StudioAssetRef | null;
  dir: StudioAssetRef | null;
  preview: StudioAssetRef | null;
  prompt: StudioAssetRef | null;
};

export type StudioDeckTemplate = {
  id: string;
  status: string | null;
  themeId: string | null;
  sourceBoard: string | null;
  summary: string | null;
  rules: string[];
  notes: string[];
  contract: StudioAssetRef | null;
  dir: StudioAssetRef | null;
  readme: StudioAssetRef | null;
  preview: StudioAssetRef | null;
  html: StudioAssetRef | null;
};

export type StudioVersionRecord = {
  id: string;
  slideId: string;
  slideDir: string;
  sourceSlideId: string | null;
  sourceDisplayNumber: string | null;
  sourceTitle: string | null;
  sourceStatus: string | null;
  sourceStampedRootId: string | null;
  label: string;
  status: string;
  sourceKind: string;
  mode: string | null;
  createdAt: string | null;
  baseVersionId: string | null;
  runId: string | null;
  attempt: number | null;
  isCurrent: boolean;
  promotable: boolean;
  dir: StudioAssetRef;
  manifest: StudioAssetRef | null;
  preview: StudioAssetRef | null;
  html: StudioAssetRef | null;
  sourceHtml: StudioAssetRef | null;
  sharedCss: StudioAssetRef | null;
  svg: StudioAssetRef | null;
};

export type StudioSlideRoot = {
  slideId: string;
  displayNumber: string;
  title: string;
  canonicalParam: string;
  buildStatus: string;
  selectedDirection: string;
  specText: string;
  stampedRootId: string | null;
  stampedDir: StudioAssetRef | null;
  manifest: StudioAssetRef | null;
  assetsManifest: StudioAssetRef | null;
  deckAssetsManifest: StudioAssetRef | null;
  currentVersionId: string | null;
  currentVersion: StudioVersionRecord | null;
  currentPreview: StudioAssetRef | null;
  currentHtml: StudioAssetRef | null;
  currentSvg: StudioAssetRef | null;
  rootCurrentPreview: StudioAssetRef | null;
  rootCurrentHtml: StudioAssetRef | null;
  rootCurrentSvg: StudioAssetRef | null;
  references: {
    proofCitationKeys: string[];
    missingCitationKeys: string[];
    current: StudioReferenceUsage[];
    archived: StudioReferenceUsage[];
  };
  slideAssets: StudioCanonicalAsset[];
  deckAssets: StudioCanonicalAsset[];
  assetCount: number;
  versions: StudioVersionRecord[];
  reviewable: boolean;
  unavailableReason: string | null;
};

export type StudioDeckManifest = {
  projectId: string;
  title: string;
  version: string;
  status: string;
  deckSpecPath: string;
  numberingSummary: string;
  generatedAt: string;
  activeSlides: StudioSlideRoot[];
  reviewableSlides: StudioSlideRoot[];
  unavailableSlides: StudioSlideRoot[];
  slidesWithAssets: number;
  references: StudioProjectReferences;
  templates: StudioDeckTemplate[];
  generatedGraphics: StudioGeneratedGraphic[];
  generatedGraphicsCount: number;
};
