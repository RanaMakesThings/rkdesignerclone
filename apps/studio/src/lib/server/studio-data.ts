import { basename, resolve } from "node:path";

import {
  invalidateProjectManifestCache,
  listProjectManifests,
  resolveDesignerRepoRoot,
  touchProjectManifestRefreshToken,
} from "../../../../../lib/repo/index.mjs";
import type {
  ProjectManifest,
  RefLike,
  SlideManifest,
} from "../presentation/studio-types";
import {
  readAllowlistedFile,
  resolveAllowlistedFile,
} from "./file-access";

const repoRoot = resolveDesignerRepoRoot({
  cwd: process.cwd(),
  env: process.env,
});

export const getRepoRoot = () => repoRoot;

export const getProjectManifests = async (forceRefresh = false) =>
  (await listProjectManifests({
    repoRoot,
    forceRefresh,
  })) as ProjectManifest[];

export const getProjectManifestById = async (
  projectId: string,
  forceRefresh = false
) => {
  const manifests = await getProjectManifests(forceRefresh);
  const manifest = manifests.find((entry) => entry.projectId === projectId);
  if (!manifest) {
    throw new Error(`Unknown project ${projectId}`);
  }
  return manifest;
};

export const getSlideManifestById = async (
  projectId: string,
  slideId: string
): Promise<{ project: ProjectManifest; slide: SlideManifest }> => {
  const project = await getProjectManifestById(projectId);
  const slide = project.slides.find((entry) => entry.id === slideId);
  if (!slide) {
    throw new Error(`Unknown slide ${slideId} in project ${projectId}`);
  }
  return { project, slide };
};

export const refreshProjectData = async (projectId?: string) => {
  await touchProjectManifestRefreshToken({ repoRoot });
  invalidateProjectManifestCache(projectId ?? null, repoRoot);
};

export const readAllowedProjectText = async ({
  projectId,
  path,
}: {
  projectId: string;
  path: string;
}) => {
  const file = await resolveAllowlistedFile({
    pathLike: path,
    projectId,
    kind: "file",
  });
  return (await readAllowlistedFile(file)).toString("utf8");
};

export const getStampedReadmeRef = (slide: SlideManifest): RefLike | null => {
  const stampedDir = slide.canonical.stampedDir;
  if (!stampedDir?.path) {
    return null;
  }
  const readmePath = resolve(repoRoot, stampedDir.path, "README.md");
  return {
    path: `${stampedDir.path}/README.md`,
    absolutePath: readmePath,
    exists: true,
    provenance: "checked-in-generated",
    canonicalNavigation: true,
    label: "Stamped README",
  };
};

export const getDeckReportImageRef = (project: ProjectManifest) =>
  project.docs.deckReportPreview ?? project.docs.deckReport ?? null;

export const groupPrimaryProjectDocs = (project: ProjectManifest) =>
  [
    project.docs.readme,
    project.docs.workflow,
    project.docs.masterSlideSpecs,
    project.docs.deckMatrix,
    project.docs.figureCompanion,
    project.docs.assessment,
    project.docs.slideFineTuning,
    project.assets.deckManifest,
    project.references.manifest,
    project.references.template,
    project.references.generated.json,
    project.references.generated.markdown,
    project.references.generated.appendixHtml,
    ...project.docs.inputs,
  ].filter(Boolean) as RefLike[];

export const groupSlideDocs = (_projectId: string, slide: SlideManifest) => {
  const stampedReadme = getStampedReadmeRef(slide);
  const canonicalVariantFiles = slide.canonical.variants.flatMap((variant) => {
    const refs: RefLike[] = [];
    if (variant.preview?.path) {
      refs.push({
        label: `${variant.label} Preview`,
        path: variant.preview.path,
      });
    }
    for (const entry of variant.files ?? []) {
      if (!entry.ref?.path) {
        continue;
      }
      refs.push({
        label: entry.label ?? entry.ref.path,
        path: entry.ref.path,
      });
    }
    return refs;
  });
  return [
    slide.canonical.packet,
    ...slide.canonical.specs,
    slide.canonical.assetsManifest,
    slide.canonical.deckAssetsManifest,
    stampedReadme,
    ...canonicalVariantFiles,
    ...slide.discovered.figureBriefs,
    ...slide.discovered.ideationDocs,
    ...slide.discovered.compositions,
    ...slide.discovered.renderBriefs,
    ...slide.discovered.references,
    ...slide.discovered.prompts,
  ]
    .filter((item): item is RefLike => Boolean(item?.path))
    .map((item) => ({
      ...item,
      label: item.label ?? basename(item.path),
    }));
};
