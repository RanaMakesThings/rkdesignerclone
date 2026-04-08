import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { resolveProjectRoot } from "./config.mjs";
import {
  invalidateProjectManifestCache,
  touchProjectManifestRefreshToken,
} from "./manifest-cache.mjs";
import { classifyPathReference } from "./path-normalize.mjs";
import { readDeckSpec } from "./read-deck-spec.mjs";
import {
  createEmptyReferencesManifest,
  getProjectReferencesLayout,
  writeProjectReferenceArtifacts,
} from "./resolve-references.mjs";

const stringifyJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

const slugify = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

const normalizeString = (value) => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizeStringArray = (value) =>
  Array.isArray(value)
    ? value.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];

const normalizeFileEntries = ({ repoRoot, files }) =>
  (Array.isArray(files) ? files : [])
    .map((entry) => {
      const label = normalizeString(entry?.label);
      const rawPath = normalizeString(entry?.path);
      if (!rawPath) {
        return null;
      }

      const classified = classifyPathReference(repoRoot, rawPath);
      if (classified.kind !== "repo-relative" || !classified.repoRelativePath) {
        throw new Error(`Reference files must point to repo-local paths. Invalid path: ${rawPath}`);
      }

      return {
        label,
        path: classified.repoRelativePath,
      };
    })
    .filter(Boolean);

const readManifestSource = async ({ manifestPath, projectId }) => {
  if (!existsSync(manifestPath)) {
    return createEmptyReferencesManifest(projectId);
  }

  const source = await readFile(manifestPath, "utf8");
  const parsed = JSON.parse(source);
  return {
    ...createEmptyReferencesManifest(projectId),
    ...parsed,
    projectId,
    kind: "deck-references",
    manifestVersion: 1,
    references: Array.isArray(parsed?.references) ? parsed.references : [],
    usages: Array.isArray(parsed?.usages) ? parsed.usages : [],
  };
};

const ensureUniqueReferenceId = (references, proposedId, previousId = null) => {
  const ids = new Set(
    references
      .map((reference) => String(reference?.id ?? "").trim())
      .filter((id) => id && id !== previousId)
  );

  let candidate = proposedId;
  let suffix = 2;
  while (!candidate || ids.has(candidate)) {
    candidate = `${proposedId}-${suffix}`;
    suffix += 1;
  }
  return candidate;
};

const nextUsageId = (usages) => {
  let maxNumber = 0;
  for (const usage of usages) {
    const match = /^usage-(\d+)$/i.exec(String(usage?.id ?? ""));
    if (!match) {
      continue;
    }
    maxNumber = Math.max(maxNumber, Number(match[1]));
  }
  return `usage-${String(maxNumber + 1).padStart(6, "0")}`;
};

const nextSortKey = (usages, slideId) => {
  const maxSortKey = usages
    .filter((usage) => usage?.slideId === slideId)
    .map((usage) =>
      typeof usage?.sortKey === "number" && Number.isFinite(usage.sortKey) ? usage.sortKey : 0
    )
    .reduce((max, value) => Math.max(max, value), 0);
  return maxSortKey + 10;
};

const replaceReference = ({ manifest, referenceId, nextReference }) => ({
  ...manifest,
  references: manifest.references.map((reference) =>
    String(reference?.id ?? "") === referenceId ? nextReference : reference
  ),
});

const replaceUsage = ({ manifest, usageId, nextUsage }) => ({
  ...manifest,
  usages: manifest.usages.map((usage) => (String(usage?.id ?? "") === usageId ? nextUsage : usage)),
});

export const updateProjectReferences = async ({
  repoRoot,
  projectId,
  action,
  payload = {},
} = {}) => {
  if (!projectId) {
    throw new Error("projectId is required.");
  }

  if (!action) {
    throw new Error("action is required.");
  }

  const projectRoot = resolveProjectRoot(repoRoot, projectId);
  const { deckSpec } = await readDeckSpec(projectRoot);
  const slideIds = new Set(
    (Array.isArray(deckSpec?.slides) ? deckSpec.slides : []).map((slide) => String(slide.id))
  );
  const layout = getProjectReferencesLayout({ projectRoot });
  let manifest = await readManifestSource({
    manifestPath: layout.manifestPath,
    projectId,
  });

  const ensureReference = (referenceId) => {
    const reference = manifest.references.find((entry) => String(entry?.id ?? "") === referenceId);
    if (!reference) {
      throw new Error(`Unknown reference "${referenceId}".`);
    }
    return reference;
  };

  const ensureUsage = (usageId) => {
    const usage = manifest.usages.find((entry) => String(entry?.id ?? "") === usageId);
    if (!usage) {
      throw new Error(`Unknown usage "${usageId}".`);
    }
    return usage;
  };

  let result = { ok: true, action, projectId };

  if (action === "createReference") {
    const label = normalizeString(payload?.label);
    const citationText = normalizeString(payload?.citationText);
    if (!label || !citationText) {
      throw new Error("createReference requires label and citationText.");
    }

    const requestedId = normalizeString(payload?.id) ?? slugify(label);
    const id = ensureUniqueReferenceId(manifest.references, requestedId);
    const reference = {
      id,
      label,
      status: payload?.status === "archived" ? "archived" : "active",
      sourceType: normalizeString(payload?.sourceType),
      citationText,
      url: normalizeString(payload?.url),
      files: normalizeFileEntries({ repoRoot, files: payload?.files }),
      summary: normalizeString(payload?.summary),
      tags: normalizeStringArray(payload?.tags),
      notes: normalizeStringArray(payload?.notes),
      sourceKeys: normalizeStringArray(payload?.sourceKeys),
    };

    manifest = {
      ...manifest,
      references: [...manifest.references, reference],
    };
    result = { ...result, reference };
  } else if (action === "updateReference") {
    const referenceId = normalizeString(payload?.referenceId);
    if (!referenceId) {
      throw new Error("updateReference requires referenceId.");
    }

    const current = ensureReference(referenceId);
    const requestedId =
      normalizeString(payload?.id) ?? normalizeString(current.id) ?? slugify(current.label ?? "reference");
    const id = ensureUniqueReferenceId(manifest.references, requestedId, referenceId);
    const nextReference = {
      ...current,
      id,
      label: normalizeString(payload?.label) ?? current.label,
      status:
        payload?.status === "active" || payload?.status === "archived"
          ? payload.status
          : current.status ?? "active",
      sourceType:
        payload && Object.prototype.hasOwnProperty.call(payload, "sourceType")
          ? normalizeString(payload?.sourceType)
          : current.sourceType ?? null,
      citationText: normalizeString(payload?.citationText) ?? current.citationText,
      url:
        payload && Object.prototype.hasOwnProperty.call(payload, "url")
          ? normalizeString(payload?.url)
          : current.url ?? null,
      files:
        payload && Object.prototype.hasOwnProperty.call(payload, "files")
          ? normalizeFileEntries({ repoRoot, files: payload?.files })
          : Array.isArray(current.files)
            ? current.files
            : [],
      summary:
        payload && Object.prototype.hasOwnProperty.call(payload, "summary")
          ? normalizeString(payload?.summary)
          : current.summary ?? null,
      tags:
        payload && Object.prototype.hasOwnProperty.call(payload, "tags")
          ? normalizeStringArray(payload?.tags)
          : normalizeStringArray(current.tags),
      notes:
        payload && Object.prototype.hasOwnProperty.call(payload, "notes")
          ? normalizeStringArray(payload?.notes)
          : normalizeStringArray(current.notes),
      sourceKeys:
        payload && Object.prototype.hasOwnProperty.call(payload, "sourceKeys")
          ? normalizeStringArray(payload?.sourceKeys)
          : normalizeStringArray(current.sourceKeys),
    };

    manifest = replaceReference({
      manifest,
      referenceId,
      nextReference,
    });
    if (id !== referenceId) {
      manifest = {
        ...manifest,
        usages: manifest.usages.map((usage) =>
          usage.referenceId === referenceId ? { ...usage, referenceId: id } : usage
        ),
      };
    }
    result = { ...result, reference: nextReference };
  } else if (action === "archiveReference") {
    const referenceId = normalizeString(payload?.referenceId);
    if (!referenceId) {
      throw new Error("archiveReference requires referenceId.");
    }

    const current = ensureReference(referenceId);
    const nextReference = {
      ...current,
      status: "archived",
    };
    manifest = replaceReference({
      manifest,
      referenceId,
      nextReference,
    });
    result = { ...result, reference: nextReference };
  } else if (action === "createUsage") {
    const referenceId = normalizeString(payload?.referenceId);
    const slideId = normalizeString(payload?.slideId);
    if (!referenceId || !slideId) {
      throw new Error("createUsage requires referenceId and slideId.");
    }
    ensureReference(referenceId);
    if (!slideIds.has(slideId)) {
      throw new Error(`Unknown slide "${slideId}".`);
    }

    const usage = {
      id: nextUsageId(manifest.usages),
      referenceId,
      slideId,
      claim: normalizeString(payload?.claim) ?? "",
      placement: normalizeString(payload?.placement) ?? "proof",
      status: payload?.status === "archived" ? "archived" : "current",
      sortKey:
        typeof payload?.sortKey === "number" && Number.isFinite(payload.sortKey)
          ? payload.sortKey
          : nextSortKey(manifest.usages, slideId),
    };

    manifest = {
      ...manifest,
      usages: [...manifest.usages, usage],
    };
    result = { ...result, usage };
  } else if (action === "updateUsage") {
    const usageId = normalizeString(payload?.usageId);
    if (!usageId) {
      throw new Error("updateUsage requires usageId.");
    }

    const current = ensureUsage(usageId);
    const slideId = normalizeString(payload?.slideId) ?? current.slideId;
    const referenceId = normalizeString(payload?.referenceId) ?? current.referenceId;
    ensureReference(referenceId);
    if (!slideIds.has(slideId)) {
      throw new Error(`Unknown slide "${slideId}".`);
    }

    const nextUsage = {
      ...current,
      referenceId,
      slideId,
      claim:
        payload && Object.prototype.hasOwnProperty.call(payload, "claim")
          ? normalizeString(payload?.claim) ?? ""
          : current.claim ?? "",
      placement:
        payload && Object.prototype.hasOwnProperty.call(payload, "placement")
          ? normalizeString(payload?.placement) ?? "proof"
          : current.placement ?? "proof",
      status:
        payload?.status === "current" || payload?.status === "archived"
          ? payload.status
          : current.status ?? "current",
      sortKey:
        typeof payload?.sortKey === "number" && Number.isFinite(payload.sortKey)
          ? payload.sortKey
          : current.sortKey ?? nextSortKey(manifest.usages, slideId),
    };

    manifest = replaceUsage({
      manifest,
      usageId,
      nextUsage,
    });
    result = { ...result, usage: nextUsage };
  } else if (action === "deleteUsage") {
    const usageId = normalizeString(payload?.usageId);
    if (!usageId) {
      throw new Error("deleteUsage requires usageId.");
    }

    ensureUsage(usageId);
    manifest = {
      ...manifest,
      usages: manifest.usages.filter((usage) => String(usage?.id ?? "") !== usageId),
    };
    result = { ...result, usageId };
  } else if (action !== "regenerate") {
    throw new Error(`Unsupported references action "${action}".`);
  }

  await mkdir(layout.referencesDir, { recursive: true });
  await writeFile(layout.manifestPath, stringifyJson(manifest), "utf8");

  const syncResult = await writeProjectReferenceArtifacts({
    repoRoot,
    projectRoot,
    deckSpec,
  });

  await touchProjectManifestRefreshToken({ repoRoot });
  invalidateProjectManifestCache(projectId, repoRoot);

  return {
    ...result,
    referencesManifestPath: syncResult.manifestPath,
    generatedPaths: syncResult.generatedPaths,
    warningCount: syncResult.compiled.warnings.length,
    runningReferenceCount: syncResult.compiled.running.length,
  };
};
