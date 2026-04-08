export { buildProjectManifest } from "./build-project-manifest.mjs";
export {
  getAllowedProjectPath,
  getProjectManifest,
  invalidateProjectManifestCache,
  listProjectManifests,
  touchProjectManifestRefreshToken,
  tryRebaseExternalProjectPath,
} from "./manifest-cache.mjs";
export { resolveDesignerRepoRoot, resolveProjectRoot } from "./config.mjs";
export {
  createArtifactRunSlug,
  getDesignerDataPaths,
  getDesignerProjectRunsRoot,
  isDesignerDataContainedPath,
  resolveDesignerDataPath,
  resolveDesignerDataRoot,
  toDesignerDataRelativePath,
} from "./designer-data.mjs";
export {
  createDesignerIgnoreMatcher,
  getDesignerIgnorePath,
  loadDesignerIgnoreMatcher,
  readDesignerIgnorePatterns,
} from "./designer-ignore.mjs";
export { discoverDeckProjects } from "./discover-projects.mjs";
export { promoteOfficialVariant } from "./promote-official-variant.mjs";
export { updateSlideSpecText } from "./update-slide-spec.mjs";
export {
  readCanonicalAssetManifest,
  resolveSlideCanonicalAssets,
} from "./resolve-assets.mjs";
export {
  resolveDesignerRootCurrentAssets,
  resolveDesignerSelectedSlideContext,
  resolveDesignerSelectedSlides,
  toDesignerCanonicalSlideParam,
  toDesignerDisplayAlias,
} from "./resolve-designer-selected-slides.mjs";
export {
  buildProjectReferenceArtifacts,
  compileProjectReferences,
  createEmptyReferencesManifest,
  getProjectReferencesLayout,
  readCanonicalReferencesManifest,
  renderReferenceAppendixHtml,
  renderRunningReferencesMarkdown,
  writeProjectReferenceArtifacts,
} from "./resolve-references.mjs";
export {
  classifyPathReference,
  isFileUrlReference,
  isLikelyExternalReference,
  isRepoContainedPath,
  isWithinDir,
  normalizeRepoRelativePath,
  resolveRepoPath,
  splitRepoPathSegments,
  toRepoRelativePath,
} from "./path-normalize.mjs";
export { updateProjectReferences } from "./update-project-references.mjs";
