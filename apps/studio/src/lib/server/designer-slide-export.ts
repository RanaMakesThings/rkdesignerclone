import { execFile } from "node:child_process";
import { access, copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { resolveDesignerSelectedSlides } from "../../../../../lib/repo/index.mjs";
import { getDesignerDesignSystemReference } from "@/lib/server/design-system-reference";
import { resolveRepoRoot } from "@/lib/server/repo-contract";

const execFileAsync = promisify(execFile);

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

const padDisplayNumber = (displayNumber: string) => {
  const numeric = Number.parseInt(displayNumber, 10);
  if (!Number.isNaN(numeric) && `${numeric}` === displayNumber) {
    return String(numeric).padStart(2, "0");
  }
  return displayNumber;
};

const ensureParentDir = async (filePath: string) => {
  await mkdir(path.dirname(filePath), { recursive: true });
};

const maybeCopy = async ({
  repoRoot,
  repoRelativePath,
  destinationPath,
}: {
  repoRoot: string;
  repoRelativePath: string | null;
  destinationPath: string;
}) => {
  if (!repoRelativePath) {
    return false;
  }

  const absolutePath = path.resolve(repoRoot, repoRelativePath);
  try {
    await access(absolutePath);
  } catch {
    return false;
  }

  await ensureParentDir(destinationPath);
  await copyFile(absolutePath, destinationPath);
  return true;
};

export const buildDesignerSlidesExportZip = async () => {
  const repoRoot = await resolveRepoRoot();
  const [deck, designSystemReference] = await Promise.all([
    resolveDesignerSelectedSlides({
      repoRoot,
      projectId: "designer-health",
    }),
    getDesignerDesignSystemReference(),
  ]);

  const tempRoot = await mkdtemp(path.join(tmpdir(), "designer-slide-export-"));
  const bundleRoot = path.join(tempRoot, "designer-slide-export");
  const zipPath = path.join(tempRoot, "designer-slide-export.zip");

  try {
    await mkdir(bundleRoot, { recursive: true });
    await mkdir(path.join(bundleRoot, "deck"), { recursive: true });
    await mkdir(path.join(bundleRoot, "slides"), { recursive: true });

    const exportedSlides = [];
    let exportedDesignSystem:
      | {
          title: string;
          sourcePath: string;
          fontHref: string | null;
          exportedFiles: {
            previewHtml: string;
            extractedCss: string | null;
          };
        }
      | null = null;

    if (designSystemReference) {
      const designSystemDir = path.join(bundleRoot, "design-system");
      const previewPath = path.join(designSystemDir, "preview.html");
      const cssPath = designSystemReference.css
        ? path.join(designSystemDir, "reference.css")
        : null;

      await mkdir(designSystemDir, { recursive: true });
      await writeFile(previewPath, designSystemReference.html, "utf8");

      if (cssPath) {
        await writeFile(cssPath, `${designSystemReference.css}\n`, "utf8");
      }

      exportedDesignSystem = {
        title: designSystemReference.title,
        sourcePath: designSystemReference.path,
        fontHref: designSystemReference.fontHref,
        exportedFiles: {
          previewHtml: "design-system/preview.html",
          extractedCss: cssPath ? "design-system/reference.css" : null,
        },
      };

      await writeFile(
        path.join(designSystemDir, "metadata.json"),
        `${JSON.stringify(exportedDesignSystem, null, 2)}\n`,
        "utf8"
      );
    }

    for (const slide of deck.activeSlides) {
      const slideFolderName = `${padDisplayNumber(slide.displayNumber)}-${slugify(slide.title)}`;
      const slideDir = path.join(bundleRoot, "slides", slideFolderName);
      await mkdir(slideDir, { recursive: true });

      const previewExt = slide.currentPreviewPath
        ? path.extname(slide.currentPreviewPath) || ".png"
        : null;
      const exportedPreview = await maybeCopy({
        repoRoot,
        repoRelativePath: slide.currentPreviewPath ?? null,
        destinationPath: previewExt
          ? path.join(slideDir, "assets", `preview${previewExt}`)
          : path.join(slideDir, "assets", "preview.png"),
      });

      const exportedHtml = await maybeCopy({
        repoRoot,
        repoRelativePath: slide.currentHtmlPath ?? null,
        destinationPath: path.join(slideDir, "html", "slide.html"),
      });

      const exportedSvg = await maybeCopy({
        repoRoot,
        repoRelativePath: slide.currentSvgPath ?? null,
        destinationPath: path.join(slideDir, "svg", "slide.svg"),
      });

      const metadata = {
        publicSlideNumber: slide.displayNumber,
        title: slide.title,
        canonicalRoute: `/slides/${slide.canonicalParam}`,
        repoSlideId: slide.slideId,
        stampedRootId: slide.stampedRootId,
        currentVersionId: slide.currentVersionId,
        reviewable: slide.reviewable,
        unavailableReason: slide.unavailableReason,
        exportedFiles: {
          preview: exportedPreview ? `assets/preview${previewExt ?? ".png"}` : null,
          html: exportedHtml ? "html/slide.html" : null,
          svg: exportedSvg ? "svg/slide.svg" : null,
        },
      };

      await writeFile(
        path.join(slideDir, "metadata.json"),
        `${JSON.stringify(metadata, null, 2)}\n`,
        "utf8"
      );

      exportedSlides.push(metadata);
    }

    const deckMetadata = {
      projectId: deck.projectId,
      title: deck.title,
      version: deck.version,
      status: deck.status,
      generatedAt: new Date().toISOString(),
      numberingSummary: deck.numberingSummary,
      slides: exportedSlides,
      designSystem: exportedDesignSystem,
    };

    await writeFile(
      path.join(bundleRoot, "deck", "deck-export.json"),
      `${JSON.stringify(deckMetadata, null, 2)}\n`,
      "utf8"
    );

    const readme = [
      "Designer slide export",
      "",
      "Structure:",
      "- deck/deck-export.json: deck-level metadata and current slide identities",
      "- design-system/preview.html: checked-in design-system reference preview",
      "- design-system/reference.css: extracted inline CSS from the design-system reference",
      "- design-system/metadata.json: source path and exported design-system files",
      "- slides/<NN-title>/metadata.json: public slide number, repo slide id, stamped root id, current version",
      "- slides/<NN-title>/assets/preview.*: current preview image when available",
      "- slides/<NN-title>/html/slide.html: current HTML surface when available",
      "- slides/<NN-title>/svg/slide.svg: current SVG surface when available",
      "",
      "Public numbering is canonical. Repo slide ids and stamped roots are included only as internal metadata.",
      "",
    ].join("\n");
    await writeFile(path.join(bundleRoot, "README.txt"), readme, "utf8");

    await execFileAsync("zip", ["-qr", "-X", zipPath, "."], { cwd: bundleRoot });
    return await readFile(zipPath);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
};
