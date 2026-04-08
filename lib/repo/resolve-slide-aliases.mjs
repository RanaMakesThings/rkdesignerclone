import { dirname } from "node:path";

import { classifyPathReference, splitRepoPathSegments } from "./path-normalize.mjs";

const uniqueSorted = (values) => [...new Set(values.filter(Boolean))].sort();

const normalizeDisplayNumber = (displayNumber) => {
  const raw = String(displayNumber ?? "").trim();
  if (!raw) {
    return [];
  }
  if (/^\d+$/.test(raw)) {
    const numberValue = Number(raw);
    return [`slide-${numberValue}`, `slide-${String(numberValue).padStart(2, "0")}`];
  }
  if (/^\d+\/\d+$/.test(raw)) {
    const [left, right] = raw.split("/").map((part) => Number(part));
    return [
      `slide-${left}-${right}`,
      `slide-${String(left).padStart(2, "0")}-${String(right).padStart(2, "0")}`,
    ];
  }
  return [`slide-${raw.replace(/[^\w-]+/g, "-").toLowerCase()}`];
};

const aliasFromSlideId = (slideId) => {
  const raw = String(slideId ?? "").trim().toLowerCase();
  if (!raw) {
    return [];
  }
  if (/^slide-\d+$/.test(raw)) {
    const numberValue = Number(raw.replace("slide-", ""));
    return [raw, `slide-${numberValue}`, `slide-${String(numberValue).padStart(2, "0")}`];
  }
  if (/^slide-\d+-\d+$/.test(raw)) {
    const [left, right] = raw
      .replace("slide-", "")
      .split("-")
      .map((part) => Number(part));
    return [
      raw,
      `slide-${left}-${right}`,
      `slide-${String(left).padStart(2, "0")}-${String(right).padStart(2, "0")}`,
    ];
  }
  return [raw];
};

const aliasesFromImportedSlides = (importedSlides) =>
  (Array.isArray(importedSlides) ? importedSlides : [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .flatMap((value) => [`slide-${value}`, `slide-${String(value).padStart(2, "0")}`]);

const aliasesFromPathRefs = (repoRoot, refs) => {
  const aliases = [];
  for (const ref of refs) {
    const classified = classifyPathReference(repoRoot, ref);
    if (classified.kind !== "repo-relative" || !classified.repoRelativePath) {
      continue;
    }
    const segments = splitRepoPathSegments(classified.repoRelativePath);
    const matched = segments.filter((segment) => /^slide-\d+(?:-\d+)?$/i.test(segment));
    aliases.push(...matched.map((segment) => segment.toLowerCase()));
    if (segments.length > 0) {
      const leafParent = dirname(classified.repoRelativePath).split("/").at(-1);
      if (/^slide-\d+(?:-\d+)?$/i.test(leafParent ?? "")) {
        aliases.push(String(leafParent).toLowerCase());
      }
    }
  }
  return aliases;
};

export const resolveSlideAliases = ({ repoRoot, slide }) => {
  const canonicalIds = uniqueSorted(aliasFromSlideId(slide?.id));
  const displayAliases = uniqueSorted(normalizeDisplayNumber(slide?.displayNumber));
  const importedAliases = uniqueSorted(aliasesFromImportedSlides(slide?.importedSlides));

  const pathRefs = [
    slide?.paths?.packet,
    ...(Array.isArray(slide?.paths?.specs) ? slide.paths.specs : []),
    slide?.paths?.stampedDir,
    ...(Array.isArray(slide?.variants)
      ? slide.variants.flatMap((variant) => [
          variant?.previewPath,
          ...(Array.isArray(variant?.files) ? variant.files.map((file) => file?.path) : []),
        ])
      : []),
  ];
  const pathAliases = uniqueSorted(aliasesFromPathRefs(repoRoot, pathRefs));

  return {
    canonicalIds,
    displayAliases,
    importedAliases,
    pathAliases,
    all: uniqueSorted([
      ...canonicalIds,
      ...displayAliases,
      ...importedAliases,
      ...pathAliases,
    ]),
  };
};
