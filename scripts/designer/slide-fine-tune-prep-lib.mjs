import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { resolveDeckSlideEntry } from "../../lib/repo/read-deck-spec.mjs";
import { captureHtmlScreenshot } from "../utils/html-screenshot-lib.mjs";
import {
  bootstrapSlideFromRoot,
  createSlideVersion,
  getProjectedRootArtifactPaths,
  getSlideNotesDir,
  getSlideReportPath,
  readSlideManifest,
  resolveSlideVersionContext,
} from "../figures/lib/slide-versioning.mjs";

const DEFAULT_PROJECT_ROOT = resolve(
  process.cwd(),
  "projects",
  "designer-health"
);

const loadDeckSpec = async (projectRoot) =>
  JSON.parse(await readFile(resolve(projectRoot, "deck-spec.json"), "utf8"));

const shouldRefreshPreview = async ({ htmlPath, previewPath }) => {
  if (!existsSync(htmlPath)) {
    return false;
  }
  if (!existsSync(previewPath)) {
    return true;
  }
  try {
    const [htmlStats, previewStats] = await Promise.all([stat(htmlPath), stat(previewPath)]);
    return previewStats.mtimeMs + 1_000 < htmlStats.mtimeMs;
  } catch {
    return true;
  }
};

const buildChangeRequestTemplate = ({
  slide,
  stampedDir,
  editSurface,
  currentVersionId,
  draftVersionId,
  draftVersionDir,
}) =>
  [
    `# ${slide.id} Fine-Tune Request`,
    "",
    "Official slide context:",
    "",
    `- title: ${slide.title}`,
    `- header: ${slide.header}`,
    `- selected direction: ${slide.selectedDirection || "(none recorded)"}`,
    `- stamped dir: ${stampedDir}`,
    `- current version id: ${currentVersionId || "(none)"}`,
    `- draft version id: ${draftVersionId || "(none)"}`,
    `- draft version dir: ${draftVersionDir || "(none)"}`,
    `- preferred edit surface: ${editSurface}`,
    "",
    "Use this file for one concrete visual delta only. If the request changes",
    "the slide family, structure, or thesis, stop and reopen the broader",
    "workflow instead.",
    "",
    "## Approved regions",
    "",
    "- none yet",
    "- if the user approves a region, record it here as locked",
    "",
    "## Requested change",
    "",
    "- Fill in one concrete change.",
    "",
    "## Success checks",
    "",
    "- _say what should be visibly different in the refreshed preview_",
    "- approved regions remain visually unchanged from the official stamped",
    "  current PNG",
    "",
    "## Guardrails",
    "",
    "- keep the slide thesis and current family stable",
    "- preserve working copy and hierarchy unless the request explicitly",
    "  changes them",
    "- do not continue from exploration variants unless they have been",
    "  explicitly promoted to the official slide",
    "- once a region is approved, treat it as locked and compare it against",
    "  the official stamped current PNG before showing later passes",
    "",
  ].join("\n");

export const prepareDesignerSlideFineTune = async ({
  slide,
  projectRoot = DEFAULT_PROJECT_ROOT,
  force = false,
  screenshotImpl = captureHtmlScreenshot,
}) => {
  const resolvedProjectRoot = resolve(String(projectRoot));
  const deckSpec = await loadDeckSpec(resolvedProjectRoot);
  const slideEntry = resolveDeckSlideEntry({ deckSpec, slide });
  const slideId = slideEntry.id;

  const context = await resolveSlideVersionContext({
    projectRoot: resolvedProjectRoot,
    slideId,
  });
  const stampedDir = context.slideDir;
  const notesDir = getSlideNotesDir({
    projectRoot: resolvedProjectRoot,
    slideId,
    slideDir: stampedDir,
    slideDirName: context.slideDirName,
  });
  const reportPath = getSlideReportPath({
    projectRoot: resolvedProjectRoot,
    slideId,
    slideDir: stampedDir,
    slideDirName: context.slideDirName,
  });
  const readmePath = resolve(notesDir, "README.md");
  const changeFilePath = resolve(notesDir, "fine-tune-request.md");

  let manifest = await readSlideManifest({
    projectRoot: resolvedProjectRoot,
    slideId,
    slideDir: stampedDir,
  });
  if (!manifest.currentVersionId && existsSync(stampedDir)) {
    manifest = await bootstrapSlideFromRoot({
      projectRoot: resolvedProjectRoot,
      slideId,
      slideDir: stampedDir,
      label: slideEntry.selectedVariantId || slideEntry.id,
    });
  }

  if (!manifest.currentVersionId) {
    throw new Error(
      `Could not find a current slide version for ${slideId} under ${stampedDir}.`
    );
  }
  const figurePngPath = getProjectedRootArtifactPaths({
    slideDir: stampedDir,
    slideDirName: context.slideDirName,
    versionId: manifest.currentVersionId,
  }).pngPath;

  const draft = await createSlideVersion({
    projectRoot: resolvedProjectRoot,
    slideId,
    slideDir: stampedDir,
    label: `${slideEntry.selectedVariantId || slideEntry.id}-fine-tune`,
    sourceKind: "fine-tune-draft",
    cloneCurrent: true,
  });

  const geminiHtmlDir = resolve(draft.versionDir, "gemini-html");
  const geminiHtmlPath = resolve(geminiHtmlDir, "generated.html");
  const geminiPreviewPath = resolve(geminiHtmlDir, "preview.png");
  const hasGeminiHtml = existsSync(geminiHtmlPath);
  if (
    hasGeminiHtml &&
    (await shouldRefreshPreview({ htmlPath: geminiHtmlPath, previewPath: geminiPreviewPath }))
  ) {
    await mkdir(geminiHtmlDir, { recursive: true });
    await screenshotImpl({
      inputPath: geminiHtmlPath,
      outputPath: geminiPreviewPath,
    });
  }

  if (!existsSync(changeFilePath) || force) {
    await mkdir(notesDir, { recursive: true });
    await writeFile(
      changeFilePath,
      `${buildChangeRequestTemplate({
        slide: slideEntry,
        stampedDir,
        currentVersionId: manifest.currentVersionId,
        draftVersionId: draft.versionId,
        draftVersionDir: draft.versionDir,
        editSurface: hasGeminiHtml ? "gemini-html micro-pass" : "native/spec rerender",
      })}\n`,
      "utf8"
    );
  }

  return {
    ok: true,
    slideId,
    title: slideEntry.title,
    header: slideEntry.header,
    stampedDir,
    reportPath: existsSync(reportPath) ? reportPath : null,
    readmePath: existsSync(readmePath) ? readmePath : null,
    figurePngPath: existsSync(figurePngPath) ? figurePngPath : null,
    currentVersionId: manifest.currentVersionId,
    draftVersionId: draft.versionId,
    draftVersionDir: draft.versionDir,
    geminiHtmlPath: hasGeminiHtml ? geminiHtmlPath : null,
    geminiPreviewPath: hasGeminiHtml ? geminiPreviewPath : null,
    changeFilePath,
    preferredEditSurface: hasGeminiHtml ? "gemini-html micro-pass" : "native/spec rerender",
  };
};
