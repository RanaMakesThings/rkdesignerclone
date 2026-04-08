import { existsSync, readFileSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { basename, resolve } from "node:path";

import {
  classifyPathReference,
  compileProjectReferences,
  resolveSlideCanonicalAssets,
  resolveDesignerRootCurrentAssets,
  resolveDesignerSelectedSlideContext,
  toDesignerCanonicalSlideParam,
} from "../../../../../lib/repo/index.mjs";
import { readReconciledSlideManifest } from "../../../../../scripts/figures/lib/slide-versioning.mjs";
import type {
  StudioAssetKind,
  StudioAssetRef,
  StudioCanonicalAsset,
  StudioDeckTemplate,
  StudioDeckManifest,
  StudioGeneratedGraphic,
  StudioSlideRoot,
  StudioVersionRecord,
} from "../presentation/designer-studio-types.ts";
import {
  getStudioDesignerDataPaths,
  resolveStudioDesignerDataPath,
  toStudioDesignerDataRelativePath,
} from "./designer-paths.ts";
import { getStudioRepoRoots } from "./repo-roots.ts";
import { resolveRepoRoot } from "./repo-contract.ts";

const DESIGNER_PROJECT_ID = "designer-health";
const DESIGNER_PROJECT_ROOT = "projects/designer-health";
const DESIGNER_DECK_SPEC_PATH = `${DESIGNER_PROJECT_ROOT}/deck-spec.json`;
const STUDIO_REFRESH_TOKEN_PATH = ".designer/studio-refresh.token";
const PRESENTATION_IMAGES_ROOT = "output/figures/presentation-images";
const CACHE_TTL_MS = 300_000;
const VERSION_PREVIEW_CANDIDATES = [
  "figure.png",
  "figure.jpg",
  "figure.jpeg",
  "figure.webp",
  "figure.svg",
  "preview.png",
  "preview.jpg",
  "preview.jpeg",
  "preview.webp",
  "preview.svg",
  "codex-html/preview.png",
  "codex-html/preview.jpg",
  "codex-html/preview.jpeg",
  "codex-html/preview.webp",
  "codex-html/preview.svg",
  "gemini-html/preview.png",
  "gemini-html/preview.jpg",
  "gemini-html/preview.jpeg",
  "gemini-html/preview.webp",
  "gemini-html/preview.svg",
  "image-01.jpg",
  "image-01.jpeg",
  "image-01.png",
  "image-01.webp",
];
const VERSION_HTML_CANDIDATES = [
  "figure.html",
  "generated.html",
  "gemini-html/generated.html",
];
const VERSION_SVG_CANDIDATES = [
  "figure.svg",
  "preview.svg",
  "gemini-html/preview.svg",
];

const readReconciledSlideManifestWithRoot = readReconciledSlideManifest as (args: {
  projectRoot: string;
  slideId: string;
  slideDir?: string | null;
}) => Promise<SlideRootManifest>;

type DeckSpecSlide = {
  id: string;
  displayNumber: string | number;
  importedSlides?: number[];
  historySourceSlideIds?: string[];
  status: string;
  title: string;
  buildStatus?: string;
  selectedDirection?: string;
  specText?: string;
  paths?: {
    stampedDir?: string | null;
    assetsManifest?: string | null;
  };
};

type DeckSpecTemplate = {
  id: string;
  status?: string | null;
  themeId?: string | null;
  sourceBoard?: string | null;
  summary?: string | null;
  paths?: {
    contractPath?: string | null;
    templateDir?: string | null;
    previewPath?: string | null;
    htmlPath?: string | null;
  };
  rules?: string[];
  notes?: string[];
};

type DeckSpec = {
  deckId: string;
  title: string;
  version: string;
  status: string;
  template?: DeckSpecTemplate | null;
  paths?: {
    deckAssetsManifest?: string | null;
  };
  numberingPolicy?: {
    summary?: string;
  };
  slides: DeckSpecSlide[];
};

type SlideRootManifestEntry = {
  id: string;
  label?: string | null;
  status?: string | null;
  sourceKind?: string | null;
  mode?: string | null;
  createdAt?: string | null;
  baseVersionId?: string | null;
  dir: string;
  runId?: string | null;
  attempt?: number | null;
  sharedCssPath?: string | null;
  sourceHtmlPath?: string | null;
};

type SlideRootManifest = {
  slideId: string;
  slideDir: string;
  currentVersionId: string | null;
  versions: SlideRootManifestEntry[];
};

type VersionManifest = {
  id: string;
  slideId: string;
  slideDir: string;
  dir: string;
  label?: string | null;
  status?: string | null;
  createdAt?: string | null;
  sourceKind?: string | null;
  mode?: string | null;
  baseVersionId?: string | null;
  runId?: string | null;
  attempt?: number | null;
  sharedCssPath?: string | null;
  sourceHtmlPath?: string | null;
};

type PresentationImageResult = {
  ok?: boolean;
  provider?: string | null;
  versionNumber?: number | null;
  versionId?: string | null;
  versionLabel?: string | null;
  variantId?: string | null;
  variantLabel?: string | null;
  graphicId?: string | null;
  dir?: string | null;
  imagePath?: string | null;
};

type PresentationImagesManifest = {
  batchId?: string | null;
  slug?: string | null;
  generatedAt?: string | null;
  results?: PresentationImageResult[];
};

type DeckCache = {
  createdAt: number;
  manifest: StudioDeckManifest;
  refreshTokenMtimeMs: number;
};

type GraphicsCache = {
  createdAt: number;
  graphics: StudioGeneratedGraphic[];
  refreshTokenMtimeMs: number;
};

type SlideContextCache = {
  createdAt: number;
  contextPromise: Promise<DesignerSlideContext>;
  refreshTokenMtimeMs: number;
};

type GetDeckOptions = {
  forceRefresh?: boolean;
  includeGeneratedGraphics?: boolean;
};

type DesignerSlideContext = {
  deck: StudioDeckManifest;
  slide: StudioDeckManifest["activeSlides"][number] | null;
  requestedSlideId: string;
  resolvedSlideId: string | null;
  canonicalParam: string | null;
};

const DECK_CACHE_KEY_BASE = "base";
const DECK_CACHE_KEY_WITH_GRAPHICS = "with-graphics";

const cachedDecks = new Map<string, DeckCache>();
let cachedGeneratedGraphics: GraphicsCache | null = null;
const cachedSlideContexts = new Map<string, SlideContextCache>();

const readJsonFile = <T>(absolutePath: string): T =>
  JSON.parse(readFileSync(absolutePath, "utf8")) as T;

const readTextFileIfExists = (absolutePath: string) =>
  existsSync(absolutePath) ? readFileSync(absolutePath, "utf8").trim() : "";

const safeStat = (absolutePath: string) => {
  try {
    return statSync(absolutePath);
  } catch {
    return null;
  }
};

const getRefreshTokenMtimeMs = (repoRoot: string) =>
  safeStat(resolve(repoRoot, STUDIO_REFRESH_TOKEN_PATH))?.mtimeMs ?? 0;

const isStudioCacheFresh = ({
  cached,
  now,
  refreshTokenMtimeMs,
}: {
  cached:
    | {
        createdAt: number;
        refreshTokenMtimeMs: number;
  }
    | null
    | undefined;
  now: number;
  refreshTokenMtimeMs: number;
}) => {
  if (!cached) {
    return false;
  }
  return (
    now - cached.createdAt <= CACHE_TTL_MS &&
    Number(cached.refreshTokenMtimeMs ?? 0) === refreshTokenMtimeMs
  );
};

const createAssetRef = (
  absolutePath: string,
  displayPath: string,
  kind: StudioAssetKind,
  label?: string,
  provenance = "checked-in-generated"
): StudioAssetRef => {
  return {
    path: displayPath,
    absolutePath,
    exists: existsSync(absolutePath),
    label,
    provenance,
    canonicalNavigation: true,
    kind,
  };
};

const createExistingAssetRef = (
  repoRoot: string,
  repoRelativePath: string | null | undefined,
  kind: StudioAssetKind,
  label?: string
) => {
  if (!repoRelativePath) {
    return null;
  }
  const ref = createAssetRef(
    resolve(repoRoot, repoRelativePath),
    repoRelativePath,
    kind,
    label
  );
  return ref.exists ? ref : null;
};

const createExistingAssetRefFromRoots = (
  repoRoots: string[],
  repoRelativePath: string | null | undefined,
  kind: StudioAssetKind,
  label?: string
) => {
  for (const candidateRoot of repoRoots) {
    const ref = createExistingAssetRef(candidateRoot, repoRelativePath, kind, label);
    if (ref) {
      return ref;
    }
  }
  return null;
};

const createExistingDesignerDataAssetRef = async (
  pathLike: string | null | undefined,
  kind: StudioAssetKind,
  label?: string
) => {
  if (!pathLike) {
    return null;
  }
  const absolutePath = await resolveStudioDesignerDataPath(pathLike);
  const relativePath = absolutePath
    ? await toStudioDesignerDataRelativePath(absolutePath)
    : null;
  if (!absolutePath || !relativePath) {
    return null;
  }
  const ref = createAssetRef(
    absolutePath,
    relativePath,
    kind,
    label,
    "artifact-store"
  );
  return ref.exists ? ref : null;
};

const createClassifiedAssetRef = async (
  repoRoots: string[],
  pathLike: string | null | undefined,
  kind: StudioAssetKind,
  label?: string
): Promise<StudioAssetRef | null> => {
  if (!pathLike) {
    return null;
  }

  for (const candidateRoot of repoRoots) {
    const classified = classifyPathReference(candidateRoot, pathLike);
    if (
      classified.kind === "repo-relative" &&
      classified.repoRelativePath &&
      classified.absolutePath
    ) {
      const ref = createAssetRef(
        classified.absolutePath,
        classified.repoRelativePath,
        kind,
        label
      );
      if (ref.exists) {
        return ref;
      }
    }
  }

  return createExistingDesignerDataAssetRef(pathLike, kind, label);
};

const parseNumericId = (value: string | null | undefined, prefix: string) => {
  const match = String(value ?? "").match(new RegExp(`^${prefix}-(\\d+)$`, "i"));
  return match ? Number(match[1]) : 0;
};

const toVersionId = (value: number) => `version-${String(value).padStart(2, "0")}`;

const toVersionLabel = (value: number) => `Version ${String(value).padStart(2, "0")}`;

const formatProviderLabel = (provider: string | null | undefined) => {
  const normalized = String(provider ?? "").trim().toLowerCase();
  if (normalized === "openai") {
    return "OpenAI";
  }
  if (normalized === "gemini") {
    return "Gemini";
  }
  return normalized || "Unknown";
};

const summarizeSpec = (specText: string) => {
  const lines = specText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const tagline = lines.find((line) => /^Tagline:/i.test(line));
  if (tagline) {
    return tagline.replace(/^Tagline:\s*/i, "").trim();
  }

  const subject = lines.find((line) => /^Subject:/i.test(line));
  if (subject) {
    return subject.replace(/^Subject:\s*/i, "").trim();
  }

  return (
    lines.find((line) => {
      const normalized = line.toLowerCase();
      if (normalized.startsWith("locked style reference:")) {
        return false;
      }
      if (normalized.startsWith("create a ")) {
        return false;
      }
      if (/^(style|composition|color guidance|mood):$/i.test(line)) {
        return false;
      }
      if (line.startsWith("- ")) {
        return false;
      }
      return true;
    }) ?? ""
  );
};

const buildGeneratedGraphicIdentity = ({
  batchId,
  batchSlug,
  result,
  index,
}: {
  batchId: string | null | undefined;
  batchSlug: string;
  result: PresentationImageResult;
  index: number;
}) => {
  const fallbackVersionNumber =
    Number.isInteger(result.versionNumber) && Number(result.versionNumber) > 0
      ? Number(result.versionNumber)
      : index + 1;
  const versionId =
    String(result.versionId ?? "").trim() || toVersionId(fallbackVersionNumber);
  const versionLabel =
    String(result.versionLabel ?? "").trim() || toVersionLabel(fallbackVersionNumber);
  return {
    batchId: String(batchId ?? "").trim() || `graphic-batch-${batchSlug}`,
    versionId,
    versionLabel,
    graphicId: String(result.graphicId ?? "").trim() || `graphic-${batchSlug}-${versionId}`,
  };
};

const buildDeckTemplate = ({
  repoRoot,
  template,
}: {
  repoRoot: string;
  template: DeckSpecTemplate;
}): StudioDeckTemplate | null => {
  const id = String(template.id ?? "").trim();
  if (!id) {
    return null;
  }

  const templateDirPath = template.paths?.templateDir?.trim() || null;

  return {
    id,
    status: template.status?.trim() || null,
    themeId: template.themeId?.trim() || null,
    sourceBoard: template.sourceBoard?.trim() || null,
    summary: template.summary?.trim() || null,
    rules: Array.isArray(template.rules) ? template.rules.filter(Boolean) : [],
    notes: Array.isArray(template.notes) ? template.notes.filter(Boolean) : [],
    contract: createExistingAssetRef(
      repoRoot,
      template.paths?.contractPath?.trim() || null,
      "other",
      "Template Contract"
    ),
    dir: createExistingAssetRef(repoRoot, templateDirPath, "directory", "Template Dir"),
    readme: createExistingAssetRef(
      repoRoot,
      templateDirPath ? `${templateDirPath}/README.md` : null,
      "other",
      "Template README"
    ),
    preview: createExistingAssetRef(
      repoRoot,
      template.paths?.previewPath?.trim() || null,
      "image",
      "Template Preview"
    ),
    html: createExistingAssetRef(
      repoRoot,
      template.paths?.htmlPath?.trim() || null,
      "html",
      "Template HTML"
    ),
  };
};

const sortGeneratedGraphics = (
  left: StudioGeneratedGraphic,
  right: StudioGeneratedGraphic
) => {
  const graphicDelta =
    parseNumericId(right.graphicId, "graphic") - parseNumericId(left.graphicId, "graphic");
  if (graphicDelta !== 0) {
    return graphicDelta;
  }
  const leftTime = left.batchGeneratedAt ? Date.parse(left.batchGeneratedAt) : 0;
  const rightTime = right.batchGeneratedAt ? Date.parse(right.batchGeneratedAt) : 0;
  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }
  if (left.batchSlug !== right.batchSlug) {
    return left.batchSlug.localeCompare(right.batchSlug);
  }
  return left.versionId.localeCompare(right.versionId, undefined, {
    numeric: true,
  });
};

const listGeneratedGraphics = async (
  repoRoot: string
): Promise<StudioGeneratedGraphic[]> => {
  const graphics: StudioGeneratedGraphic[] = [];
  const designerDataPaths = await getStudioDesignerDataPaths();
  const repoRoots = getStudioRepoRoots(repoRoot);
  const scanRoots = [
    ...repoRoots.map((candidateRoot) => ({
      absoluteRoot: resolve(candidateRoot, PRESENTATION_IMAGES_ROOT),
      buildLogicalPath: (...segments: string[]) =>
        [PRESENTATION_IMAGES_ROOT, ...segments].join("/"),
      sourceRoot: "repo" as const,
    })),
    {
      absoluteRoot: resolve(designerDataPaths.runsRoot, DESIGNER_PROJECT_ID),
      buildLogicalPath: (...segments: string[]) => ["runs", DESIGNER_PROJECT_ID, ...segments].join("/"),
      sourceRoot: "designer-data",
    },
  ];
  const seenBatchManifests = new Set<string>();

  for (const scanRoot of scanRoots) {
    if (!existsSync(scanRoot.absoluteRoot)) {
      continue;
    }

    const entries = await readdir(scanRoot.absoluteRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const batchDirPath = scanRoot.buildLogicalPath(entry.name);
      const manifestPath = scanRoot.buildLogicalPath(entry.name, "manifest.json");
      const manifestAbsolutePath = resolve(scanRoot.absoluteRoot, entry.name, "manifest.json");
      if (!existsSync(manifestAbsolutePath)) {
        continue;
      }
      const manifestKey = `${scanRoot.sourceRoot}:${manifestPath}`;
      if (seenBatchManifests.has(manifestKey)) {
        continue;
      }
      seenBatchManifests.add(manifestKey);

      const manifest = readJsonFile<PresentationImagesManifest>(manifestAbsolutePath);
      const batchSlug = String(manifest.slug ?? "").trim() || entry.name;
      const specPath = resolve(scanRoot.absoluteRoot, entry.name, "spec.txt");
      const specText = readTextFileIfExists(specPath);
      const specSummary = summarizeSpec(specText);

      for (const [index, result] of (manifest.results ?? []).entries()) {
        if (!result?.ok || !result.imagePath) {
          continue;
        }

        const identity = buildGeneratedGraphicIdentity({
          batchId: manifest.batchId,
          batchSlug,
          result,
          index,
        });
        const provider = String(result.provider ?? "").trim().toLowerCase();

        graphics.push({
          graphicId: identity.graphicId,
          batchId: identity.batchId,
          batchSlug,
          batchGeneratedAt: manifest.generatedAt ?? null,
          provider,
          providerLabel: formatProviderLabel(provider),
          versionId: identity.versionId,
          versionLabel: identity.versionLabel,
          variantId: result.variantId ? String(result.variantId) : null,
          variantLabel: result.variantLabel ? String(result.variantLabel) : null,
          summary: specSummary || null,
          specText,
          batchManifest:
            scanRoot.sourceRoot === "repo"
              ? createExistingAssetRefFromRoots(repoRoots, manifestPath, "json", "Batch Manifest")
              : await createExistingDesignerDataAssetRef(
                  manifestPath,
                  "json",
                  "Batch Manifest"
                ),
          batchDir:
            scanRoot.sourceRoot === "repo"
              ? createExistingAssetRefFromRoots(repoRoots, batchDirPath, "directory", "Batch Dir")
              : await createExistingDesignerDataAssetRef(
                  batchDirPath,
                  "directory",
                  "Batch Dir"
                ),
          dir: await createClassifiedAssetRef(repoRoots, result.dir, "directory", "Result Dir"),
          preview: await createClassifiedAssetRef(repoRoots, result.imagePath, "image", "Preview"),
          prompt: await createClassifiedAssetRef(
            repoRoots,
            result.dir ? `${String(result.dir).replace(/\/+$/, "")}/prompt.txt` : null,
            "other",
            "Prompt"
          ),
        });
      }
    }
  }

  return graphics.sort(sortGeneratedGraphics);
};

const inferAssetKind = (pathLike: string): StudioAssetKind => {
  if (pathLike.endsWith(".html")) {
    return "html";
  }
  if (pathLike.endsWith(".svg")) {
    return "svg";
  }
  if (pathLike.endsWith(".json")) {
    return "json";
  }
  if (/\.(png|jpe?g|webp|gif)$/i.test(pathLike)) {
    return "image";
  }
  if (!/\.[^/]+$/i.test(pathLike)) {
    return "directory";
  }
  return "other";
};

const toStudioAssetRef = (
  repoRoot: string,
  refLike: {
    path: string;
    absolutePath?: string | null;
    exists?: boolean;
    provenance?: string;
    canonicalNavigation?: boolean;
    label?: string | null;
  } | null | undefined,
  label?: string
): StudioAssetRef | null => {
  if (!refLike?.path) {
    return null;
  }

  return {
    path: refLike.path,
    absolutePath: refLike.absolutePath ?? resolve(repoRoot, refLike.path),
    exists: refLike.exists ?? existsSync(resolve(repoRoot, refLike.path)),
    provenance: refLike.provenance ?? "canonical-human-authored",
    canonicalNavigation: refLike.canonicalNavigation ?? true,
    label: label ?? refLike.label ?? null,
    kind: inferAssetKind(refLike.path),
  };
};

const toStudioCanonicalAsset = (
  repoRoot: string,
  asset: {
    assetId?: string | null;
    id: string;
    label: string;
    status?: string | null;
    kind?: string | null;
    role?: string | null;
    summary?: string | null;
    preview?: {
      path: string;
      absolutePath?: string | null;
      exists?: boolean;
      provenance?: string;
      canonicalNavigation?: boolean;
      label?: string | null;
    } | null;
    files?: Array<{
      label?: string | null;
      ref?: {
        path: string;
        absolutePath?: string | null;
        exists?: boolean;
        provenance?: string;
        canonicalNavigation?: boolean;
        label?: string | null;
      } | null;
    }>;
    sourceFiles?: Array<{
      label?: string | null;
      ref?: {
        path: string;
        absolutePath?: string | null;
        exists?: boolean;
        provenance?: string;
        canonicalNavigation?: boolean;
        label?: string | null;
      } | null;
    }>;
    tags?: string[];
    notes?: string[];
  }
): StudioCanonicalAsset => ({
  assetId: asset.assetId ?? null,
  id: asset.id,
  label: asset.label,
  status: asset.status ?? null,
  kind: asset.kind ?? null,
  role: asset.role ?? null,
  summary: asset.summary ?? null,
  preview: toStudioAssetRef(repoRoot, asset.preview, "Preview"),
  files: Array.isArray(asset.files)
    ? asset.files.map((entry) => ({
        label: entry.label ?? null,
        ref: toStudioAssetRef(repoRoot, entry.ref ?? null, entry.label ?? undefined),
      }))
    : [],
  sourceFiles: Array.isArray(asset.sourceFiles)
    ? asset.sourceFiles.map((entry) => ({
        label: entry.label ?? null,
        ref: toStudioAssetRef(repoRoot, entry.ref ?? null, entry.label ?? undefined),
      }))
    : [],
  tags: Array.isArray(asset.tags) ? asset.tags : [],
  notes: Array.isArray(asset.notes) ? asset.notes : [],
});

const toStudioReference = (
  repoRoot: string,
  reference: {
    id: string;
    label: string;
    status?: string | null;
    sourceType?: string | null;
    citationText: string;
    url?: string | null;
    files?: Array<{
      label?: string | null;
      ref?: {
        path: string;
        absolutePath?: string | null;
        exists?: boolean;
        provenance?: string;
        canonicalNavigation?: boolean;
        label?: string | null;
      } | null;
    }>;
    summary?: string | null;
    tags?: string[];
    notes?: string[];
    sourceKeys?: string[];
  } | null
) =>
  reference
    ? {
        id: reference.id,
        label: reference.label,
        status: reference.status ?? null,
        sourceType: reference.sourceType ?? null,
        citationText: reference.citationText,
        url: reference.url ?? null,
        files: Array.isArray(reference.files)
          ? reference.files.map((entry) => ({
              label: entry.label ?? null,
              ref: toStudioAssetRef(repoRoot, entry.ref ?? null, entry.label ?? undefined),
            }))
          : [],
        summary: reference.summary ?? null,
        tags: Array.isArray(reference.tags) ? reference.tags : [],
        notes: Array.isArray(reference.notes) ? reference.notes : [],
        sourceKeys: Array.isArray(reference.sourceKeys) ? reference.sourceKeys : [],
      }
    : null;

const toStudioReferenceUsage = (
  repoRoot: string,
  usage: {
    id: string;
    referenceId: string;
    slideId: string;
    slideTitle?: string | null;
    displayNumber?: string | null;
    claim: string;
    placement?: string | null;
    status?: string | null;
    sortKey?: number | null;
    appendixNumber?: number | null;
    reference?: {
      id: string;
      label: string;
      status?: string | null;
      sourceType?: string | null;
      citationText: string;
      url?: string | null;
      files?: Array<{
        label?: string | null;
        ref?: {
          path: string;
          absolutePath?: string | null;
          exists?: boolean;
          provenance?: string;
          canonicalNavigation?: boolean;
          label?: string | null;
        } | null;
      }>;
      summary?: string | null;
      tags?: string[];
      notes?: string[];
      sourceKeys?: string[];
    } | null;
  }
) => ({
  id: usage.id,
  referenceId: usage.referenceId,
  slideId: usage.slideId,
  slideTitle: usage.slideTitle ?? null,
  displayNumber: usage.displayNumber ?? null,
  claim: usage.claim,
  placement: usage.placement ?? null,
  status: usage.status ?? null,
  sortKey: usage.sortKey ?? null,
  appendixNumber: usage.appendixNumber ?? null,
  reference: toStudioReference(repoRoot, usage.reference ?? null),
});

const emptyStudioReferences = () => ({
  proofCitationKeys: [],
  missingCitationKeys: [],
  current: [],
  archived: [],
});

const toStudioProjectReferences = (
  repoRoot: string,
  compiled: {
    manifest?: {
      path: string;
      absolutePath?: string | null;
      exists?: boolean;
      provenance?: string;
      canonicalNavigation?: boolean;
      label?: string | null;
    } | null;
    template?: {
      path: string;
      absolutePath?: string | null;
      exists?: boolean;
      provenance?: string;
      canonicalNavigation?: boolean;
      label?: string | null;
    } | null;
    generated?: {
      dir?: {
        path: string;
        absolutePath?: string | null;
        exists?: boolean;
        provenance?: string;
        canonicalNavigation?: boolean;
        label?: string | null;
      } | null;
      json?: {
        path: string;
        absolutePath?: string | null;
        exists?: boolean;
        provenance?: string;
        canonicalNavigation?: boolean;
        label?: string | null;
      } | null;
      markdown?: {
        path: string;
        absolutePath?: string | null;
        exists?: boolean;
        provenance?: string;
        canonicalNavigation?: boolean;
        label?: string | null;
      } | null;
      appendixHtml?: {
        path: string;
        absolutePath?: string | null;
        exists?: boolean;
        provenance?: string;
        canonicalNavigation?: boolean;
        label?: string | null;
      } | null;
    };
    library?: Array<{
      id: string;
      label: string;
      status?: string | null;
      sourceType?: string | null;
      citationText: string;
      url?: string | null;
      files?: Array<{
        label?: string | null;
        ref?: {
          path: string;
          absolutePath?: string | null;
          exists?: boolean;
          provenance?: string;
          canonicalNavigation?: boolean;
          label?: string | null;
        } | null;
      }>;
      summary?: string | null;
      tags?: string[];
      notes?: string[];
      sourceKeys?: string[];
    }>;
    running?: Array<{
      appendixNumber: number;
      referenceId: string;
      reference: {
        id: string;
        label: string;
        status?: string | null;
        sourceType?: string | null;
        citationText: string;
        url?: string | null;
        files?: Array<{
          label?: string | null;
          ref?: {
            path: string;
            absolutePath?: string | null;
            exists?: boolean;
            provenance?: string;
            canonicalNavigation?: boolean;
            label?: string | null;
          } | null;
        }>;
        summary?: string | null;
        tags?: string[];
        notes?: string[];
        sourceKeys?: string[];
      };
      firstSeenSlideId: string;
      firstSeenDisplayNumber: string;
      slideIds: string[];
      displayNumbers: string[];
      usages: Array<{
        id: string;
        referenceId: string;
        slideId: string;
        slideTitle?: string | null;
        displayNumber?: string | null;
        claim: string;
        placement?: string | null;
        status?: string | null;
        sortKey?: number | null;
        appendixNumber?: number | null;
        reference?: {
          id: string;
          label: string;
          status?: string | null;
          sourceType?: string | null;
          citationText: string;
          url?: string | null;
          files?: Array<{
            label?: string | null;
            ref?: {
              path: string;
              absolutePath?: string | null;
              exists?: boolean;
              provenance?: string;
              canonicalNavigation?: boolean;
              label?: string | null;
            } | null;
          }>;
          summary?: string | null;
          tags?: string[];
          notes?: string[];
          sourceKeys?: string[];
        } | null;
      }>;
    }>;
    warnings?: Array<{
      code: string;
      message: string;
      severity?: string;
      slideId?: string;
    }>;
    stats: {
      libraryCount: number;
      usageCount: number;
      currentUsageCount: number;
      runningCount: number;
      activeSlideCountWithReferences: number;
    };
  }
) => {
  const library = Array.isArray(compiled.library)
    ? compiled.library.flatMap((reference) => {
        const normalized = toStudioReference(repoRoot, reference);
        return normalized ? [normalized] : [];
      })
    : [];

  const running = Array.isArray(compiled.running)
    ? compiled.running.flatMap((entry) => {
        const normalizedReference = toStudioReference(repoRoot, entry.reference);
        if (!normalizedReference) {
          return [];
        }

        return [
          {
            appendixNumber: entry.appendixNumber,
            referenceId: entry.referenceId,
            reference: normalizedReference,
            firstSeenSlideId: entry.firstSeenSlideId,
            firstSeenDisplayNumber: entry.firstSeenDisplayNumber,
            slideIds: Array.isArray(entry.slideIds) ? entry.slideIds : [],
            displayNumbers: Array.isArray(entry.displayNumbers) ? entry.displayNumbers : [],
            usages: Array.isArray(entry.usages)
              ? entry.usages.map((usage) => toStudioReferenceUsage(repoRoot, usage))
              : [],
          },
        ];
      })
    : [];

  return {
    manifest: toStudioAssetRef(repoRoot, compiled.manifest, "References Manifest"),
    template: toStudioAssetRef(repoRoot, compiled.template, "Reference Slide Template"),
    generated: {
      dir: toStudioAssetRef(repoRoot, compiled.generated?.dir ?? null, "Generated References"),
      json: toStudioAssetRef(
        repoRoot,
        compiled.generated?.json ?? null,
        "Running References JSON"
      ),
      markdown: toStudioAssetRef(
        repoRoot,
        compiled.generated?.markdown ?? null,
        "Running References Markdown"
      ),
      appendixHtml: toStudioAssetRef(
        repoRoot,
        compiled.generated?.appendixHtml ?? null,
        "References Appendix HTML"
      ),
    },
    library,
    running,
    warnings: Array.isArray(compiled.warnings) ? compiled.warnings : [],
    stats: compiled.stats,
  };
};

const findFirstExistingRef = (
  repoRoot: string,
  basePath: string,
  candidates: string[],
  kind: StudioAssetKind,
  label?: string
) => {
  for (const candidate of candidates) {
    const repoRelativePath = `${basePath}/${candidate}`.replaceAll("//", "/");
    const ref = createExistingAssetRef(repoRoot, repoRelativePath, kind, label);
    if (ref) {
      return ref;
    }
  }
  return null;
};

const sortVersions = (left: StudioVersionRecord, right: StudioVersionRecord) => {
  if (left.isCurrent !== right.isCurrent) {
    return left.isCurrent ? -1 : 1;
  }
  const leftTime = left.createdAt ? Date.parse(left.createdAt) : 0;
  const rightTime = right.createdAt ? Date.parse(right.createdAt) : 0;
  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }
  return right.id.localeCompare(left.id);
};

const resolveVersionSourceSlides = ({
  slide,
  slideById,
}: {
  slide: DeckSpecSlide;
  slideById: Map<string, DeckSpecSlide>;
}) => {
  const orderedSourceIds = [
    slide.id,
    ...(Array.isArray(slide.historySourceSlideIds) ? slide.historySourceSlideIds : []),
  ];
  const seen = new Set<string>();
  return orderedSourceIds
    .map((sourceId) => String(sourceId ?? "").trim())
    .filter((sourceId) => {
      if (!sourceId || seen.has(sourceId)) {
        return false;
      }
      seen.add(sourceId);
      return true;
    })
    .map((sourceId) => slideById.get(sourceId))
    .filter((candidate): candidate is DeckSpecSlide => Boolean(candidate));
};

const buildVersionSourceMetadata = (slide: DeckSpecSlide) => ({
  sourceSlideId: slide.id,
  sourceDisplayNumber: String(slide.displayNumber ?? ""),
  sourceTitle: slide.title ?? null,
  sourceStatus: slide.status ?? null,
  sourceStampedRootId: slide.paths?.stampedDir?.trim()
    ? basename(slide.paths.stampedDir.trim())
    : null,
});

const buildVersionRecord = async ({
  repoRoot,
  ownerSlide,
  sourceSlide,
  rootManifest,
  entry,
}: {
  repoRoot: string;
  ownerSlide: DeckSpecSlide;
  sourceSlide: DeckSpecSlide;
  rootManifest: SlideRootManifest;
  entry: SlideRootManifestEntry;
}): Promise<StudioVersionRecord> => {
  const manifestPath = `${entry.dir}/version.json`;
  const manifestAbsolutePath = resolve(repoRoot, manifestPath);
  const versionManifest = existsSync(manifestAbsolutePath)
    ? readJsonFile<VersionManifest>(manifestAbsolutePath)
    : null;

  const id = versionManifest?.id ?? entry.id;
  const preview = findFirstExistingRef(
    repoRoot,
    entry.dir,
    VERSION_PREVIEW_CANDIDATES,
    "image",
    "Preview"
  );
  const html = findFirstExistingRef(
    repoRoot,
    entry.dir,
    VERSION_HTML_CANDIDATES,
    "html",
    "HTML"
  );
  const svg = findFirstExistingRef(
    repoRoot,
    entry.dir,
    VERSION_SVG_CANDIDATES,
    "svg",
    "SVG"
  );
  const sourceHtml =
    versionManifest?.sourceHtmlPath && existsSync(resolve(repoRoot, versionManifest.sourceHtmlPath))
      ? createAssetRef(
          resolve(repoRoot, versionManifest.sourceHtmlPath),
          versionManifest.sourceHtmlPath,
          "html",
          "Source HTML"
        )
      : null;
  const sharedCss =
    versionManifest?.sharedCssPath && existsSync(resolve(repoRoot, versionManifest.sharedCssPath))
      ? createAssetRef(
          resolve(repoRoot, versionManifest.sharedCssPath),
          versionManifest.sharedCssPath,
          "other",
          "Shared CSS"
        )
      : null;
  const isOwnerSource = sourceSlide.id === ownerSlide.id;
  const isCurrent = isOwnerSource && id === rootManifest.currentVersionId;
  const status = isCurrent
    ? "current"
    : isOwnerSource && (versionManifest?.status ?? entry.status) === "draft"
      ? "draft"
      : "archived";

  return {
    id,
    slideId: ownerSlide.id,
    slideDir: ownerSlide.paths?.stampedDir?.trim() || rootManifest.slideDir,
    ...buildVersionSourceMetadata(sourceSlide),
    dir: createAssetRef(
      resolve(repoRoot, entry.dir),
      entry.dir,
      "directory",
      "Version Dir"
    ),
    manifest: existsSync(manifestAbsolutePath)
      ? createAssetRef(
          manifestAbsolutePath,
          manifestPath,
          "json",
          "Version JSON"
        )
      : null,
    label: versionManifest?.label ?? entry.label ?? id,
    status,
    sourceKind: versionManifest?.sourceKind ?? entry.sourceKind ?? "unknown",
    mode: versionManifest?.mode ?? entry.mode ?? null,
    createdAt: versionManifest?.createdAt ?? entry.createdAt ?? null,
    baseVersionId: versionManifest?.baseVersionId ?? entry.baseVersionId ?? null,
    runId: versionManifest?.runId ?? entry.runId ?? null,
    attempt: versionManifest?.attempt ?? entry.attempt ?? null,
    preview,
    html,
    sourceHtml,
    sharedCss,
    svg,
    isCurrent,
    promotable: isOwnerSource && !isCurrent,
  };
};

const buildUnavailableSlide = ({
  slide,
  stampedDirPath,
  deckAssetsManifestPath,
  reason,
  repoRoot,
}: {
  slide: DeckSpecSlide;
  stampedDirPath: string | null;
  deckAssetsManifestPath: string | null;
  reason: string;
  repoRoot: string;
}): StudioSlideRoot => {
  const resolvedAssets = resolveSlideCanonicalAssets({
    repoRoot,
    slideAssetsManifestPath: slide.paths?.assetsManifest?.trim() || null,
    deckAssetsManifestPath,
  });

  return {
    slideId: slide.id,
    displayNumber: String(slide.displayNumber),
    title: slide.title,
    canonicalParam: toDesignerCanonicalSlideParam({
      slideId: slide.id,
      displayNumber: String(slide.displayNumber),
    }),
    buildStatus: slide.buildStatus ?? "",
    selectedDirection: slide.selectedDirection ?? "",
    specText: slide.specText ?? "",
    stampedRootId: stampedDirPath ? basename(stampedDirPath) : null,
    stampedDir: stampedDirPath
      ? createAssetRef(
          resolve(repoRoot, stampedDirPath),
          stampedDirPath,
          "directory",
          "Stamped Root"
        )
      : null,
    manifest: stampedDirPath
      ? createExistingAssetRef(
          repoRoot,
          `${stampedDirPath}/manifest.json`,
          "json",
          "Slide Manifest"
        )
      : null,
    assetsManifest: toStudioAssetRef(repoRoot, resolvedAssets.slideManifest, "Slide Assets"),
    deckAssetsManifest: toStudioAssetRef(repoRoot, resolvedAssets.deckManifest, "Deck Assets"),
    currentVersionId: null,
    currentVersion: null,
    currentPreview: null,
    currentHtml: null,
    currentSvg: null,
    rootCurrentPreview: null,
    rootCurrentHtml: null,
    rootCurrentSvg: null,
    references: emptyStudioReferences(),
    slideAssets: resolvedAssets.slideAssets.map((asset) =>
      toStudioCanonicalAsset(repoRoot, asset)
    ),
    deckAssets: resolvedAssets.deckAssets.map((asset) =>
      toStudioCanonicalAsset(repoRoot, asset)
    ),
    assetCount: resolvedAssets.slideAssets.length + resolvedAssets.deckAssets.length,
    versions: [],
    reviewable: false,
    unavailableReason: reason,
  };
};

const buildSlideRoot = async ({
  repoRoot,
  slide,
  slideById,
  deckAssetsManifestPath,
}: {
  repoRoot: string;
  slide: DeckSpecSlide;
  slideById: Map<string, DeckSpecSlide>;
  deckAssetsManifestPath: string | null;
}): Promise<StudioSlideRoot> => {
  const stampedDirPath = slide.paths?.stampedDir?.trim() || null;
  const logicalSlideDirPath = `${DESIGNER_PROJECT_ROOT}/slide-figures/${slide.id}`;
  const resolvedRootDirPath = stampedDirPath || logicalSlideDirPath;
  const resolvedRootAbsolutePath = resolve(repoRoot, resolvedRootDirPath);
  const usingLogicalFallbackRoot = !stampedDirPath;
  const resolvedAssets = resolveSlideCanonicalAssets({
    repoRoot,
    slideAssetsManifestPath: slide.paths?.assetsManifest?.trim() || null,
    deckAssetsManifestPath,
  });
  if (!existsSync(resolvedRootAbsolutePath)) {
    return buildUnavailableSlide({
      slide,
      stampedDirPath: stampedDirPath || null,
      deckAssetsManifestPath,
      reason: stampedDirPath ? "No stamped root directory" : "No slide root",
      repoRoot,
    });
  }

  const manifestPath = `${resolvedRootDirPath}/manifest.json`;
  const manifestAbsolutePath = resolve(repoRoot, manifestPath);
  if (!usingLogicalFallbackRoot && !existsSync(manifestAbsolutePath)) {
    return buildUnavailableSlide({
      slide,
      stampedDirPath: resolvedRootDirPath,
      deckAssetsManifestPath,
      reason: "No slide manifest",
      repoRoot,
    });
  }

  const rootManifest = await readReconciledSlideManifestWithRoot({
    projectRoot: resolve(repoRoot, DESIGNER_PROJECT_ROOT),
    slideId: slide.id,
    slideDir: resolvedRootAbsolutePath,
  });
  const sourceSlides = resolveVersionSourceSlides({
    slide,
    slideById,
  });
  const sourceManifests = await Promise.all(
    sourceSlides.map(async (sourceSlide) => ({
      sourceSlide,
      manifest: await readReconciledSlideManifestWithRoot({
        projectRoot: resolve(repoRoot, DESIGNER_PROJECT_ROOT),
        slideId: sourceSlide.id,
      }),
    }))
  );
  const versions = (
    await Promise.all(
      sourceManifests.flatMap(({ sourceSlide, manifest }) =>
        (manifest.versions ?? []).map((entry) =>
          buildVersionRecord({
            repoRoot,
            ownerSlide: slide,
            sourceSlide,
            rootManifest: manifest,
            entry,
          })
        )
      )
    )
  ).sort(sortVersions);
  const currentVersion =
    versions.find(
      (version) =>
        version.sourceSlideId === slide.id && version.id === rootManifest.currentVersionId
    ) ?? null;
  const rootAssets = await resolveDesignerRootCurrentAssets({
    repoRoot,
    slideDir: rootManifest.slideDir,
    currentVersionId: rootManifest.currentVersionId,
  });
  const currentPreview = rootAssets.preview ?? currentVersion?.preview ?? null;
  const currentHtml = rootAssets.html ?? currentVersion?.html ?? null;
  const currentSvg = rootAssets.svg ?? currentVersion?.svg ?? null;
  const reviewable = Boolean(rootManifest.currentVersionId && currentVersion && currentPreview);

  let unavailableReason: string | null = null;
  if (!rootManifest.currentVersionId) {
    unavailableReason = "No current version";
  } else if (!currentVersion) {
    unavailableReason = "Current version missing";
  } else if (!currentPreview) {
    unavailableReason = "No preview asset";
  }

  return {
    slideId: slide.id,
    displayNumber: String(slide.displayNumber),
    title: slide.title,
    canonicalParam: toDesignerCanonicalSlideParam({
      slideId: slide.id,
      displayNumber: String(slide.displayNumber),
    }),
    buildStatus: slide.buildStatus ?? "",
    selectedDirection: slide.selectedDirection ?? "",
    specText: slide.specText ?? "",
    stampedRootId: basename(resolvedRootDirPath),
    stampedDir: createAssetRef(
      resolvedRootAbsolutePath,
      resolvedRootDirPath,
      "directory",
      "Stamped Root"
    ),
    manifest: createAssetRef(
      resolve(repoRoot, manifestPath),
      manifestPath,
      "json",
      "Slide Manifest"
    ),
    assetsManifest: toStudioAssetRef(repoRoot, resolvedAssets.slideManifest, "Slide Assets"),
    deckAssetsManifest: toStudioAssetRef(repoRoot, resolvedAssets.deckManifest, "Deck Assets"),
    currentVersionId: rootManifest.currentVersionId,
    currentVersion,
    currentPreview,
    currentHtml,
    currentSvg,
    rootCurrentPreview: rootAssets.preview,
    rootCurrentHtml: rootAssets.html,
    rootCurrentSvg: rootAssets.svg,
    references: emptyStudioReferences(),
    slideAssets: resolvedAssets.slideAssets.map((asset) =>
      toStudioCanonicalAsset(repoRoot, asset)
    ),
    deckAssets: resolvedAssets.deckAssets.map((asset) =>
      toStudioCanonicalAsset(repoRoot, asset)
    ),
    assetCount: resolvedAssets.slideAssets.length + resolvedAssets.deckAssets.length,
    versions,
    reviewable,
    unavailableReason,
  };
};

const buildDeckManifestBase = async (repoRoot: string): Promise<StudioDeckManifest> => {
  const deckSpecAbsolutePath = resolve(repoRoot, DESIGNER_DECK_SPEC_PATH);
  const deckSpec = readJsonFile<DeckSpec>(deckSpecAbsolutePath);
  const compiledReferences = compileProjectReferences({
    repoRoot,
    projectRoot: resolve(repoRoot, DESIGNER_PROJECT_ROOT),
    deckSpec,
  }) as Parameters<typeof toStudioProjectReferences>[1] & {
    slides?: Array<{
      slideId: string;
      proofCitationKeys?: string[];
      missingCitationKeys?: string[];
      current?: Parameters<typeof toStudioReferenceUsage>[1][];
      archived?: Parameters<typeof toStudioReferenceUsage>[1][];
    }>;
  };
  const slideReferencesById = new Map(
    (Array.isArray(compiledReferences.slides) ? compiledReferences.slides : []).map((entry) => [
      entry.slideId,
      entry,
    ])
  );
  const deckAssetsManifestPath = deckSpec.paths?.deckAssetsManifest?.trim() || null;
  const slideById = new Map(
    (Array.isArray(deckSpec.slides) ? deckSpec.slides : []).map((slide) => [slide.id, slide])
  );
  const template = deckSpec.template
    ? buildDeckTemplate({
        repoRoot,
        template: deckSpec.template,
      })
    : null;
  const activeSlidesBase = await Promise.all(
    deckSpec.slides
      .filter((slide) => slide.status === "active")
      .map((slide) =>
        buildSlideRoot({
          repoRoot,
          slide,
          slideById,
          deckAssetsManifestPath,
        })
      )
  );
  const activeSlides = activeSlidesBase.map((slide) => {
    const referenceContext = slideReferencesById.get(slide.slideId);
    return {
      ...slide,
      references: referenceContext
        ? {
            proofCitationKeys: Array.isArray(referenceContext.proofCitationKeys)
              ? referenceContext.proofCitationKeys
              : [],
            missingCitationKeys: Array.isArray(referenceContext.missingCitationKeys)
              ? referenceContext.missingCitationKeys
              : [],
            current: Array.isArray(referenceContext.current)
              ? referenceContext.current.map((usage: Parameters<typeof toStudioReferenceUsage>[1]) =>
                  toStudioReferenceUsage(repoRoot, usage)
                )
              : [],
            archived: Array.isArray(referenceContext.archived)
              ? referenceContext.archived.map((usage: Parameters<typeof toStudioReferenceUsage>[1]) =>
                  toStudioReferenceUsage(repoRoot, usage)
                )
              : [],
          }
        : emptyStudioReferences(),
    };
  });

  return {
    projectId: deckSpec.deckId,
    title: deckSpec.title,
    version: deckSpec.version,
    status: deckSpec.status,
    deckSpecPath: DESIGNER_DECK_SPEC_PATH,
    numberingSummary: deckSpec.numberingPolicy?.summary ?? "",
    generatedAt: new Date().toISOString(),
    reviewableSlides: activeSlides.filter((slide) => slide.reviewable),
    unavailableSlides: activeSlides.filter((slide) => !slide.reviewable),
    activeSlides,
    slidesWithAssets: activeSlides.filter((slide) => slide.assetCount > 0).length,
    references: toStudioProjectReferences(repoRoot, compiledReferences),
    templates: template ? [template] : [],
    generatedGraphics: [],
    generatedGraphicsCount: 0,
  };
};

export const clearDesignerStudioCache = () => {
  cachedDecks.clear();
  cachedGeneratedGraphics = null;
  cachedSlideContexts.clear();
};

export const getDesignerStudioGraphics = async (
  forceRefresh = false
): Promise<StudioGeneratedGraphic[]> => {
  const repoRoot = await resolveRepoRoot();
  const now = Date.now();
  const refreshTokenMtimeMs = getRefreshTokenMtimeMs(repoRoot);
  if (
    !forceRefresh &&
    isStudioCacheFresh({
      cached: cachedGeneratedGraphics,
      now,
      refreshTokenMtimeMs,
    })
  ) {
    return cachedGeneratedGraphics?.graphics ?? [];
  }

  const graphics = await listGeneratedGraphics(repoRoot);
  cachedGeneratedGraphics = {
    createdAt: now,
    graphics,
    refreshTokenMtimeMs,
  };
  return graphics;
};

export const getDesignerStudioSlideContext = async (
  requestedSlideId: string
): Promise<DesignerSlideContext> => {
  const normalizedSlideId = String(requestedSlideId ?? "").trim();
  if (!normalizedSlideId) {
    return {
      deck: await getDesignerStudioDeck({ includeGeneratedGraphics: false }),
      slide: null,
      requestedSlideId,
      resolvedSlideId: null,
      canonicalParam: null,
    };
  }

  const repoRoot = await resolveRepoRoot();
  const now = Date.now();
  const refreshTokenMtimeMs = getRefreshTokenMtimeMs(repoRoot);
  const cached = cachedSlideContexts.get(normalizedSlideId);
  if (
    cached &&
    isStudioCacheFresh({
      cached,
      now,
      refreshTokenMtimeMs,
    })
  ) {
    return cached.contextPromise;
  }
  cachedSlideContexts.delete(normalizedSlideId);

  const contextPromise = (async () => {
    const deck = await getDesignerStudioDeck({ includeGeneratedGraphics: false });
    const selected = resolveDesignerSelectedSlideContext({
      activeSlides: deck.activeSlides,
      requestedSlideId,
    });

    return {
      deck,
      slide: selected.slide,
      requestedSlideId,
      resolvedSlideId: selected.resolvedSlideId,
      canonicalParam: selected.canonicalParam,
    };
  })();

  cachedSlideContexts.set(normalizedSlideId, {
    createdAt: now,
    contextPromise,
    refreshTokenMtimeMs,
  });
  try {
    return await contextPromise;
  } catch (error) {
    cachedSlideContexts.delete(normalizedSlideId);
    throw error;
  }
};

export const getDesignerStudioDeck = async (
  options: GetDeckOptions = {}
): Promise<StudioDeckManifest> => {
  const { forceRefresh = false, includeGeneratedGraphics = true } = options;
  const cacheKey = includeGeneratedGraphics ? DECK_CACHE_KEY_WITH_GRAPHICS : DECK_CACHE_KEY_BASE;
  const repoRoot = await resolveRepoRoot();
  const now = Date.now();
  const refreshTokenMtimeMs = getRefreshTokenMtimeMs(repoRoot);
  const existing = cachedDecks.get(cacheKey);
  if (
    !forceRefresh &&
    existing &&
    isStudioCacheFresh({
      cached: existing,
      now,
      refreshTokenMtimeMs,
    })
  ) {
    return existing.manifest;
  }

  let baseManifest = cachedDecks.get(DECK_CACHE_KEY_BASE)?.manifest ?? null;
  const baseCacheIsFresh = isStudioCacheFresh({
    cached: cachedDecks.get(DECK_CACHE_KEY_BASE),
    now,
    refreshTokenMtimeMs,
  });
  if (!baseManifest || forceRefresh || !baseCacheIsFresh) {
    cachedSlideContexts.clear();
    baseManifest = await buildDeckManifestBase(repoRoot);
    cachedDecks.set(DECK_CACHE_KEY_BASE, {
      createdAt: now,
      manifest: baseManifest,
      refreshTokenMtimeMs,
    });
  }

  if (!includeGeneratedGraphics) {
    return baseManifest;
  }

  const generatedGraphics = await getDesignerStudioGraphics(forceRefresh);
  const manifest = {
    ...baseManifest,
    generatedGraphics,
    generatedGraphicsCount: generatedGraphics.length,
  };
  cachedDecks.set(DECK_CACHE_KEY_WITH_GRAPHICS, {
    createdAt: now,
    manifest,
    refreshTokenMtimeMs,
  });
  return manifest;
};

export const getDesignerStudioSlide = async (slideId: string) => {
  const { deck, slide, requestedSlideId, resolvedSlideId, canonicalParam } =
    await getDesignerStudioSlideContext(slideId);
  return {
    deck,
    slide,
    requestedSlideId,
    resolvedSlideId,
    canonicalParam,
  };
};

export const DESIGNER_STUDIO_PROJECT_ID = DESIGNER_PROJECT_ID;
