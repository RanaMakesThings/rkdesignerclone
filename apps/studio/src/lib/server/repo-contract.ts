import {
  classifyPathReference,
  discoverDeckProjects,
  normalizeRepoRelativePath,
  resolveDesignerRepoRoot,
  toRepoRelativePath,
} from "../../../../../lib/repo/index.mjs";

type RepoProject = {
  projectId: string;
  projectRoot: string;
};

type BuildProjectManifestOptions = {
  repoRoot?: string;
  projectRoot?: string;
  generatedAt?: string;
  [key: string]: unknown;
};

type PromoteOfficialVariantOptions = {
  repoRoot?: string;
  projectId?: string;
  slideId?: string;
  candidateSource?: "canonical-variant" | "discovered-branch";
  candidateId?: string;
  [key: string]: unknown;
};

type UpdateSlideSpecTextOptions = {
  repoRoot?: string;
  projectId?: string;
  slideId?: string;
  specText?: string;
  [key: string]: unknown;
};

type UpdateProjectReferencesOptions = {
  repoRoot?: string;
  projectId?: string;
  action?: string;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
};

type PathClassification = {
  kind: "missing" | "repo-relative" | "external-stale";
  repoRelativePath: string | null;
  absolutePath: string | null;
};

type RepoContract = {
  resolveDesignerRepoRoot: (options?: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  }) => string;
  discoverDeckProjects: (repoRoot: string) => Promise<RepoProject[]>;
  buildProjectManifest: (options?: BuildProjectManifestOptions) => Promise<Record<string, unknown>>;
  promoteOfficialVariant: (
    options?: PromoteOfficialVariantOptions
  ) => Promise<Record<string, unknown>>;
  updateSlideSpecText: (
    options?: UpdateSlideSpecTextOptions
  ) => Promise<Record<string, unknown>>;
  updateProjectReferences: (
    options?: UpdateProjectReferencesOptions
  ) => Promise<Record<string, unknown>>;
  classifyPathReference: (repoRoot: string, pathLike: string) => PathClassification;
  normalizeRepoRelativePath: (value: string) => string;
  toRepoRelativePath: (repoRoot: string, absolutePath: string) => string;
};

const repoContract: RepoContract = {
  resolveDesignerRepoRoot,
  discoverDeckProjects,
  classifyPathReference,
  normalizeRepoRelativePath,
  toRepoRelativePath,
  buildProjectManifest: async (options = {}) => {
    const { buildProjectManifest } = await import(
      "../../../../../lib/repo/build-project-manifest.mjs"
    );
    return buildProjectManifest(options);
  },
  promoteOfficialVariant: async (options = {}) => {
    const { promoteOfficialVariant } = await import(
      "../../../../../lib/repo/promote-official-variant.mjs"
    );
    return promoteOfficialVariant(options);
  },
  updateSlideSpecText: async (options = {}) => {
    const { updateSlideSpecText } = await import(
      "../../../../../lib/repo/update-slide-spec.mjs"
    );
    return updateSlideSpecText(options);
  },
  updateProjectReferences: async (options = {}) => {
    const { updateProjectReferences } = await import(
      "../../../../../lib/repo/update-project-references.mjs"
    );
    return updateProjectReferences(options);
  },
};

export const loadRepoContract = async (): Promise<RepoContract> => repoContract;

export const resolveRepoRoot = async () =>
  repoContract.resolveDesignerRepoRoot({
    cwd: process.cwd(),
    env: process.env,
  });
