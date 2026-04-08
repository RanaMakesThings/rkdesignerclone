import { readFile, writeFile } from "node:fs/promises";

import { applyEdits, modify } from "jsonc-parser";

import { resolveProjectRoot } from "./config.mjs";
import {
  invalidateProjectManifestCache,
  touchProjectManifestRefreshToken,
} from "./manifest-cache.mjs";
import { readDeckSpec } from "./read-deck-spec.mjs";

const JSON_FORMAT_OPTIONS = {
  insertSpaces: true,
  tabSize: 2,
  eol: "\n",
};

const normalizeSpecText = (value) => String(value ?? "").replace(/\r\n/g, "\n").trim();

const updateDeckSpecText = (source, path, value) => {
  const edits = modify(source, path, value, {
    formattingOptions: JSON_FORMAT_OPTIONS,
  });
  return applyEdits(source, edits);
};

export const updateSlideSpecText = async ({
  repoRoot,
  projectId,
  slideId,
  specText,
} = {}) => {
  if (!projectId || !slideId) {
    throw new Error("projectId and slideId are required.");
  }

  const normalizedSpecText = normalizeSpecText(specText);
  const projectRoot = resolveProjectRoot(repoRoot, projectId);
  const { deckSpecPath, deckSpec } = await readDeckSpec(projectRoot);
  const slideIndex = deckSpec.slides.findIndex((slide) => slide?.id === slideId);
  if (slideIndex === -1) {
    throw new Error(`Slide "${slideId}" was not found in deck-spec.json.`);
  }

  const deckSpecSource = await readFile(deckSpecPath, "utf8");
  let nextDeckSpecSource = updateDeckSpecText(
    deckSpecSource,
    ["slides", slideIndex, "specText"],
    normalizedSpecText
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
    specText: normalizedSpecText,
    deckSpecPath,
  };
};
