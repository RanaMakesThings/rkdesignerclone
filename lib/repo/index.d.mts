export type RepoProject = {
  projectId: string;
  projectRoot: string;
  deckSpecPath: string;
  title: string;
  version: string;
  status: string;
  slideCount: number;
};

export type PathClassification = {
  kind: "missing" | "repo-relative" | "external-stale";
  raw: string;
  reason: string;
  repoRelativePath: string | null;
  absolutePath: string | null;
};

export type RepoFileRef = {
  path: string;
  absolutePath?: string | null;
  exists?: boolean;
  provenance?: string;
  canonicalNavigation?: boolean;
  label?: string | null;
};

export type RepoAssetKind =
  | "image"
  | "html"
  | "svg"
  | "json"
  | "directory"
  | "other";

export type RepoAssetRef = RepoFileRef & {
  kind: RepoAssetKind;
};

export type RepoCanonicalAsset = {
  assetId?: string | null;
  id: string;
  label: string;
  status?: string | null;
  kind?: string | null;
  role?: string | null;
  summary?: string | null;
  preview?: RepoFileRef | null;
  files: Array<{
    label?: string | null;
    ref?: RepoFileRef | null;
  }>;
  sourceFiles: Array<{
    label?: string | null;
    ref?: RepoFileRef | null;
  }>;
  tags: string[];
  notes: string[];
};

export type RepoCanonicalReference = {
  id: string;
  label: string;
  status?: string | null;
  sourceType?: string | null;
  citationText: string;
  url?: string | null;
  files: Array<{
    label?: string | null;
    ref?: RepoFileRef | null;
  }>;
  summary?: string | null;
  tags: string[];
  notes: string[];
  sourceKeys: string[];
};

export type DesignerSelectedVersion = {
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
  createdAt: string | null;
  baseVersionId: string | null;
  runId: string | null;
  attempt: number | null;
  isCurrent: boolean;
  promotable: boolean;
  dirPath: string | null;
  manifestPath: string | null;
  previewPath: string | null;
  htmlPath: string | null;
  svgPath: string | null;
};

export type DesignerSelectedSlide = {
  slideId: string;
  displayNumber: string;
  title: string;
  canonicalParam: string;
  stampedRootId: string | null;
  stampedDirPath: string | null;
  manifestPath: string | null;
  currentVersionId: string | null;
  currentPreviewPath: string | null;
  currentHtmlPath: string | null;
  currentSvgPath: string | null;
  trustedCurrentSvgPath: string | null;
  currentSvgTrusted: boolean;
  currentSvgTrustReason: string | null;
  rootCurrentPreviewPath: string | null;
  rootCurrentHtmlPath: string | null;
  rootCurrentSvgPath: string | null;
  sourceClass: "html_dom" | "html_wrapper_asset" | "html_asset_heavy" | "preview_only";
  wrapperAssetKind: "svg" | "image" | null;
  sourceWarnings: string[];
  reviewable: boolean;
  unavailableReason: string | null;
  versions: DesignerSelectedVersion[];
};

export type DesignerSelectedSlidesDeck = {
  projectId: string;
  title: string;
  version: string;
  status: string;
  deckSpecPath: string;
  numberingSummary: string;
  activeSlides: DesignerSelectedSlide[];
};

export type DesignerCurrentAssets = {
  preview: RepoAssetRef | null;
  html: RepoAssetRef | null;
  svg: RepoAssetRef | null;
  svgTrust: {
    status: "missing" | "untrusted" | "trusted";
    reason: string | null;
    trustedPath: string | null;
    containsForeignObject: boolean;
    dimensions:
      | {
          width: number;
          height: number;
          aspectRatio: number | null;
        }
      | null;
  };
  svgPassThroughPath: string | null;
};

export type DesignerSelectedSlideContext<TSlide = {
  slideId: string;
  displayNumber: string | number;
  canonicalParam?: string | null;
}> = {
  slide: TSlide | null;
  requestedSlideId: string;
  resolvedSlideId: string | null;
  canonicalParam: string | null;
};

export function buildProjectManifest(options: {
  repoRoot: string;
  projectRoot: string;
  generatedAt?: string;
}): Promise<Record<string, unknown>>;

export function readCanonicalAssetManifest(options: {
  repoRoot: string;
  manifestPath?: string | null;
  provenance?: string;
}): {
  manifest: RepoFileRef | null;
  manifestVersion: number | null;
  projectId: string | null;
  kind: string | null;
  slideId: string | null;
  deckAssetIds: string[];
  assets: RepoCanonicalAsset[];
};

export function resolveSlideCanonicalAssets(options: {
  repoRoot: string;
  slideAssetsManifestPath?: string | null;
  deckAssetsManifestPath?: string | null;
  provenance?: string;
}): {
  slideManifest: RepoFileRef | null;
  deckManifest: RepoFileRef | null;
  slideAssets: RepoCanonicalAsset[];
  deckAssets: RepoCanonicalAsset[];
  unresolvedDeckAssetIds: string[];
};

export function toDesignerCanonicalSlideParam(slide: {
  slideId: string;
  displayNumber: string | number;
}): string;

export function toDesignerDisplayAlias(value: string | null | undefined): string | null;

export function resolveDesignerRootCurrentAssets(options: {
  repoRoot: string;
  slideDir: string;
  currentVersionId: string | null;
}): Promise<DesignerCurrentAssets>;

export function resolveDesignerSelectedSlides(options?: {
  repoRoot: string;
  projectId?: string;
}): Promise<DesignerSelectedSlidesDeck>;

export function resolveDesignerSelectedSlideContext<TSlide extends {
  slideId: string;
  displayNumber: string | number;
  canonicalParam?: string | null;
}>(options: {
  activeSlides: TSlide[];
  requestedSlideId: string;
}): DesignerSelectedSlideContext<TSlide>;

export function getProjectReferencesLayout(options: {
  projectRoot: string;
}): {
  referencesDir: string;
  manifestPath: string;
  templatePath: string;
  generatedDir: string;
  generatedJsonPath: string;
  generatedMarkdownPath: string;
  generatedAppendixHtmlPath: string;
};

export function createEmptyReferencesManifest(projectId: string): {
  manifestVersion: number;
  projectId: string;
  kind: string;
  references: RepoCanonicalReference[];
  usages: Record<string, unknown>[];
};

export function readCanonicalReferencesManifest(options: {
  repoRoot: string;
  manifestPath?: string | null;
  provenance?: string;
  projectId?: string | null;
}): {
  manifest: RepoFileRef | null;
  manifestVersion: number;
  projectId: string | null;
  kind: string;
  references: RepoCanonicalReference[];
  usages: Record<string, unknown>[];
};

export function compileProjectReferences(options: {
  repoRoot: string;
  projectRoot: string;
  deckSpec: Record<string, unknown>;
  generatedAt?: string;
}): Record<string, unknown>;

export function buildProjectReferenceArtifacts(options: {
  compiled: Record<string, unknown>;
  projectTitle: string;
}): {
  json: string;
  markdown: string;
  appendixHtml: string;
};

export function renderRunningReferencesMarkdown(options: {
  compiled: Record<string, unknown>;
  projectTitle: string;
}): string;

export function renderReferenceAppendixHtml(options: {
  compiled: Record<string, unknown>;
  projectTitle: string;
}): string;

export function writeProjectReferenceArtifacts(options: {
  repoRoot: string;
  projectRoot: string;
  deckSpec: Record<string, unknown>;
  generatedAt?: string;
}): Promise<Record<string, unknown>>;

export function getAllowedProjectPath(options?: {
  repoRoot?: string;
  projectId?: string;
  path?: string;
  forceRefresh?: boolean;
}): Promise<
  | {
      repoRelativePath: string;
      absolutePath: string;
      kind: "file" | "descendant";
    }
  | null
>;

export function getProjectManifest(options?: {
  repoRoot?: string;
  projectId?: string;
  forceRefresh?: boolean;
}): Promise<Record<string, unknown>>;

export function invalidateProjectManifestCache(
  projectId?: string | null,
  repoRoot?: string | null
): void;

export function listProjectManifests(options?: {
  repoRoot?: string;
  forceRefresh?: boolean;
}): Promise<Record<string, unknown>[]>;

export function touchProjectManifestRefreshToken(options?: {
  repoRoot?: string;
}): Promise<string>;

export function tryRebaseExternalProjectPath(options?: {
  repoRoot?: string;
  projectId?: string;
  path?: string;
}): Promise<
  | {
      repoRelativePath: string;
      absolutePath: string;
      kind: "file" | "descendant";
    }
  | null
>;

export function resolveDesignerRepoRoot(options?: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}): string;

export function resolveProjectRoot(repoRoot: string, projectId: string): string;

export function discoverDeckProjects(repoRoot: string): Promise<RepoProject[]>;

export function promoteOfficialVariant(options: {
  repoRoot: string;
  projectId: string;
  slideId: string;
  candidateSource: "canonical-variant" | "discovered-branch";
  candidateId: string;
}): Promise<{
  ok: true;
  projectId: string;
  slideId: string;
  candidateSource: "canonical-variant" | "discovered-branch";
  candidateId: string;
  selectedVariantId: string | null;
  deckSpecPath: string;
}>;

export function updateSlideSpecText(options: {
  repoRoot: string;
  projectId: string;
  slideId: string;
  specText?: string;
}): Promise<{
  ok: true;
  projectId: string;
  slideId: string;
  specText: string;
  deckSpecPath: string;
}>;

export function updateProjectReferences(options: {
  repoRoot: string;
  projectId: string;
  action: string;
  payload?: Record<string, unknown>;
}): Promise<Record<string, unknown>>;

export function classifyPathReference(
  repoRoot: string,
  pathLike: string
): PathClassification;

export function isFileUrlReference(value: string): boolean;

export function isLikelyExternalReference(value: string): boolean;

export function isRepoContainedPath(repoRoot: string, absolutePath: string): boolean;

export function isWithinDir(parentDir: string, childPath: string): boolean;

export function normalizeRepoRelativePath(value: string): string;

export function resolveRepoPath(
  repoRoot: string,
  pathLike: string,
  options?: { mustExist?: boolean }
): string | null;

export function splitRepoPathSegments(pathLike: string): string[];

export function toRepoRelativePath(repoRoot: string, absolutePath: string): string;
