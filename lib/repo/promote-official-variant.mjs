import { readFile, writeFile } from "node:fs/promises";
import { applyEdits, modify } from "jsonc-parser";

import { resolveProjectRoot } from "./config.mjs";
import {
  invalidateProjectManifestCache,
  touchProjectManifestRefreshToken,
} from "./manifest-cache.mjs";
import { readDeckSpec } from "./read-deck-spec.mjs";
import { resolveSlidePromotionCandidates } from "./resolve-slide-promotion-candidates.mjs";

const normalizeVariantStatuses = (variants = [], selectedId) =>
  variants.map((variant) => ({
    ...variant,
    status: variant?.id === selectedId ? "selected" : "option",
  }));

const toDeckSpecFiles = (files = []) =>
  files
    .map((file) => ({
      label: file?.label ?? "File",
      path: file?.ref?.path ?? null,
    }))
    .filter((file) => file.path);

const upsertVariant = (variants = [], nextVariant) => {
  const index = variants.findIndex((variant) => variant?.id === nextVariant.id);
  if (index === -1) {
    return [...variants, nextVariant];
  }
  const copy = [...variants];
  copy[index] = {
    ...copy[index],
    ...nextVariant,
  };
  return copy;
};

const JSON_FORMAT_OPTIONS = {
  insertSpaces: true,
  tabSize: 2,
  eol: "\n",
};

const updateDeckSpecText = (source, path, value) => {
  const edits = modify(source, path, value, {
    formattingOptions: JSON_FORMAT_OPTIONS,
  });
  return applyEdits(source, edits);
};

export const promoteOfficialVariant = async ({
  repoRoot,
  projectId,
  slideId,
  candidateSource,
  candidateId,
} = {}) => {
  if (!projectId || !slideId || !candidateSource || !candidateId) {
    throw new Error("projectId, slideId, candidateSource, and candidateId are required.");
  }

  if (!["canonical-variant", "discovered-branch"].includes(candidateSource)) {
    throw new Error(`Unsupported candidateSource "${candidateSource}".`);
  }

  const projectRoot = resolveProjectRoot(repoRoot, projectId);
  const { deckSpecPath, deckSpec } = await readDeckSpec(projectRoot);
  const slideIndex = deckSpec.slides.findIndex((slide) => slide?.id === slideId);
  if (slideIndex === -1) {
    throw new Error(`Slide "${slideId}" was not found in deck-spec.json.`);
  }
  const currentSlide = deckSpec.slides[slideIndex];
  const promotionCandidates = await resolveSlidePromotionCandidates({
    repoRoot,
    projectRoot,
    slide: currentSlide,
  });
  const candidate = promotionCandidates.find(
    (entry) => entry.source === candidateSource && entry.id === candidateId
  );
  if (!candidate) {
    throw new Error(
      `Promotion candidate "${candidateId}" was not found on slide "${slideId}".`
    );
  }

  if (candidateSource === "discovered-branch" && !candidate.preview?.path) {
    throw new Error(`Promotion candidate "${candidateId}" does not expose a previewable asset.`);
  }

  const nextDeckSpec = structuredClone(deckSpec);
  const nextSlide = nextDeckSpec.slides[slideIndex];
  const originalStampedDir = nextSlide?.paths?.stampedDir ?? null;
  const currentVariants = Array.isArray(nextSlide?.variants) ? nextSlide.variants : [];

  if (candidateSource === "canonical-variant") {
    nextSlide.selectedVariantId = candidate.derivedVariantId;
    nextSlide.variants = normalizeVariantStatuses(currentVariants, candidate.derivedVariantId);
  } else {
    const promotedVariant = {
      id: candidate.derivedVariantId,
      label: candidate.label,
      status: "selected",
      summary:
        candidate.summary ??
        `Promoted discovered branch rooted at ${candidate.dir?.path ?? candidateId}.`,
      previewPath: candidate.preview.path,
      files: toDeckSpecFiles(candidate.files),
    };

    nextSlide.selectedVariantId = candidate.derivedVariantId;
    nextSlide.variants = normalizeVariantStatuses(
      upsertVariant(currentVariants, promotedVariant),
      candidate.derivedVariantId
    );
  }

  if ((nextSlide?.paths?.stampedDir ?? null) !== originalStampedDir) {
    throw new Error("Promotion attempted to rewrite paths.stampedDir, which is not allowed.");
  }

  const deckSpecSource = await readFile(deckSpecPath, "utf8");
  let nextDeckSpecSource = updateDeckSpecText(
    deckSpecSource,
    ["slides", slideIndex, "selectedVariantId"],
    nextSlide.selectedVariantId ?? null
  );
  nextDeckSpecSource = updateDeckSpecText(
    nextDeckSpecSource,
    ["slides", slideIndex, "variants"],
    nextSlide.variants ?? []
  );

  if (!nextDeckSpecSource.endsWith("\n")) {
    nextDeckSpecSource = `${nextDeckSpecSource}\n`;
  }

  await writeFile(deckSpecPath, nextDeckSpecSource, "utf8");
  await touchProjectManifestRefreshToken({ repoRoot });
  invalidateProjectManifestCache(projectId, repoRoot);

  return {
    ok: true,
    projectId,
    slideId,
    candidateSource,
    candidateId,
    selectedVariantId: nextSlide.selectedVariantId ?? null,
    deckSpecPath,
  };
};
