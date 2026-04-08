import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, relative, resolve } from "node:path";
import {
  ASSET_CACHE_ROOT,
  ASSET_PROVIDERS,
  DEFAULT_ASSET_CANDIDATES,
  DEFAULT_ASSET_PROVIDER,
  MEDIA_DECISION_STATUSES,
} from "./constants.mjs";
import {
  getOutputPaths,
  readJson,
  slugToImageRequestOutputDir,
  toFileUrl,
  writeJson,
  writeText,
} from "./io.mjs";
import {
  resolvePexelsApiKey,
  searchPexelsPhotos,
} from "./pexels-client.mjs";
import {
  collectStrings,
  loadFigureSpec,
  normalizeFigureSpec,
} from "./spec.mjs";

const AUTO_MEDIA_SLOT_COUNT = 2;
const ASSET_REGISTRY_VERSION = 1;
const DEFAULT_COPY_SAFE = "center";
const DEFAULT_CROP_VARIANT = "original";
const DEFAULT_SELECTION_STATUS = "approved";
const DEFAULT_TREATMENT = "mono";
const PREVIEW_VARIANTS = [
  {
    id: "original",
    label: "Original",
    objectPosition: null,
    treatment: null,
    opacity: null,
  },
  {
    id: "left-copy",
    label: "Left-copy crop",
    objectPosition: "35% center",
    treatment: null,
    opacity: null,
  },
  {
    id: "right-copy",
    label: "Right-copy crop",
    objectPosition: "65% center",
    treatment: null,
    opacity: null,
  },
  {
    id: "center-safe",
    label: "Center-safe crop",
    objectPosition: "center center",
    treatment: null,
    opacity: null,
  },
  {
    id: "background-blurred",
    label: "Background / blurred",
    objectPosition: "center center",
    treatment: "soft",
    opacity: 0.86,
  },
  {
    id: "duotone-muted",
    label: "Duotone / muted",
    objectPosition: "center center",
    treatment: "duotone-muted",
    opacity: 0.96,
  },
];
const STANDALONE_GENERIC_EXCLUDE_TERMS = [
  "illustration",
  "mockup",
  "render",
  "vector",
];
const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "against",
  "also",
  "among",
  "because",
  "before",
  "being",
  "between",
  "could",
  "demand",
  "enough",
  "every",
  "figure",
  "from",
  "have",
  "history",
  "into",
  "just",
  "make",
  "most",
  "only",
  "proof",
  "quiet",
  "should",
  "slide",
  "than",
  "that",
  "their",
  "them",
  "there",
  "they",
  "this",
  "tiles",
  "turning",
  "visit",
  "wall",
  "what",
  "when",
  "where",
  "which",
  "with",
  "without",
]);

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const normalizeNeedles = (values) =>
  values
    .map((value) => String(value ?? "").trim().toLowerCase())
    .filter(Boolean);

const uniq = (values) => [...new Set(values)];

const isNonEmptyString = (value) => String(value ?? "").trim().length > 0;

const sanitizeSegment = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "slot";

const inferOrientation = ({ width, height }) => {
  const safeWidth = Number(width);
  const safeHeight = Number(height);
  if (
    !Number.isFinite(safeWidth) ||
    !Number.isFinite(safeHeight) ||
    safeWidth <= 0 ||
    safeHeight <= 0
  ) {
    return "unknown";
  }
  if (safeWidth > safeHeight * 1.1) {
    return "landscape";
  }
  if (safeHeight > safeWidth * 1.1) {
    return "portrait";
  }
  return "square";
};

const megapixelsFor = ({ width, height }) => {
  const safeWidth = Number(width);
  const safeHeight = Number(height);
  if (
    !Number.isFinite(safeWidth) ||
    !Number.isFinite(safeHeight) ||
    safeWidth <= 0 ||
    safeHeight <= 0
  ) {
    return 0;
  }
  return Number(((safeWidth * safeHeight) / 1_000_000).toFixed(2));
};

const buildCandidateHaystack = (photo) =>
  [photo?.alt, photo?.url, photo?.photographer].join(" ").toLowerCase();

const tokenizeText = (value) =>
  uniq(
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 4)
      .filter((token) => !STOP_WORDS.has(token))
  );

const countTokenOverlap = (left, right) => {
  const rightSet = new Set(right);
  let overlap = 0;
  for (const token of left) {
    if (rightSet.has(token)) {
      overlap += 1;
    }
  }
  return overlap;
};

const normalizePhotographerKey = (value) =>
  String(value ?? "").trim().toLowerCase();

const getAssetRegistryPath = () => resolve(ASSET_CACHE_ROOT, "registry.json");

const makeAssetId = (provider, externalId) => `${provider}:${externalId}`;

const computeChecksum = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");

const normalizeStatus = (value, fallback = "discovered") => {
  const normalized = String(value ?? "").trim();
  return MEDIA_DECISION_STATUSES.has(normalized) ? normalized : fallback;
};

const mergeAssetStatus = (existing, next) => {
  const safeExisting = normalizeStatus(existing, "discovered");
  const safeNext = normalizeStatus(next, safeExisting);
  if (safeNext === "discovered") {
    return safeExisting;
  }
  if (safeExisting === "in_use" && safeNext === "approved") {
    return safeExisting;
  }
  if (safeExisting === "approved" && safeNext === "shortlisted") {
    return safeExisting;
  }
  return safeNext;
};

const uniqBy = (items, keyFn) => {
  const seen = new Set();
  const results = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    results.push(item);
  }
  return results;
};

const emptyAssetRegistry = () => ({
  version: ASSET_REGISTRY_VERSION,
  generatedAt: new Date().toISOString(),
  assets: {},
});

const loadAssetRegistry = async () => {
  try {
    const registry = await readJson(getAssetRegistryPath());
    if (!registry || typeof registry !== "object") {
      return emptyAssetRegistry();
    }
    return {
      version: Number(registry.version ?? ASSET_REGISTRY_VERSION),
      generatedAt: String(registry.generatedAt ?? "").trim() || new Date().toISOString(),
      assets:
        registry.assets && typeof registry.assets === "object"
          ? registry.assets
          : {},
    };
  } catch {
    return emptyAssetRegistry();
  }
};

const saveAssetRegistry = async (registry) => {
  const payload = {
    ...registry,
    version: ASSET_REGISTRY_VERSION,
    generatedAt: new Date().toISOString(),
  };
  await writeJson(getAssetRegistryPath(), payload);
};

const upsertRegistryAsset = ({ registry, record }) => {
  const existing = registry.assets[record.assetId] ?? null;
  const merged = {
    ...(existing ?? {}),
    ...record,
    dimensions: record.dimensions ?? existing?.dimensions ?? { width: 0, height: 0 },
    attribution: record.attribution ?? existing?.attribution ?? {},
    searchOrigins: uniqBy(
      [...(existing?.searchOrigins ?? []), ...(record.searchOrigins ?? [])],
      (item) => JSON.stringify(item)
    ),
    downloadedVariants: {
      ...(existing?.downloadedVariants ?? {}),
      ...(record.downloadedVariants ?? {}),
    },
    approvedUses: uniqBy(
      [...(existing?.approvedUses ?? []), ...(record.approvedUses ?? [])],
      (item) => JSON.stringify(item)
    ),
    rejectionReasons: uniq([
      ...(existing?.rejectionReasons ?? []),
      ...(record.rejectionReasons ?? []),
    ]),
    status: mergeAssetStatus(existing?.status, record.status),
  };
  registry.assets[record.assetId] = merged;
  return merged;
};

const resolveAssetProvider = (provider = DEFAULT_ASSET_PROVIDER) => {
  const providerId = String(provider ?? "").trim() || DEFAULT_ASSET_PROVIDER;
  if (!ASSET_PROVIDERS.has(providerId)) {
    throw new Error(
      `Unsupported asset provider "${providerId}". Supported providers: ${Array.from(
        ASSET_PROVIDERS
      ).join(", ")}.`
    );
  }

  if (providerId === "pexels") {
    return {
      id: "pexels",
      licenseClass: "pexels-api",
      async search({
        query,
        orientation = "",
        color = "",
        perPage = 18,
        apiKey,
        fetchImpl,
      }) {
        const photos = await searchPexelsPhotos({
          query,
          orientation,
          color,
          perPage,
          apiKey,
          fetchImpl,
        });

        return photos.map((photo) => {
          const externalId = String(photo?.id ?? "").trim();
          return {
            provider: "pexels",
            assetId: makeAssetId("pexels", externalId),
            externalId,
            canonicalUrl: String(photo?.url ?? "").trim(),
            photographer: String(photo?.photographer ?? "").trim(),
            photographerUrl: String(photo?.photographer_url ?? "").trim(),
            attribution: {
              providerLabel: "Pexels",
              photographer: String(photo?.photographer ?? "").trim(),
              photographerUrl: String(photo?.photographer_url ?? "").trim(),
              canonicalUrl: String(photo?.url ?? "").trim(),
            },
            licenseClass: "pexels-api",
            dimensions: {
              width: Number(photo?.width ?? 0),
              height: Number(photo?.height ?? 0),
            },
            avgColor: String(photo?.avg_color ?? "").trim(),
            alt: String(photo?.alt ?? "").trim(),
            sourceUrls: {
              original: String(photo?.src?.original ?? "").trim(),
              large2x: String(photo?.src?.large2x ?? "").trim(),
              large: String(photo?.src?.large ?? "").trim(),
              landscape: String(photo?.src?.landscape ?? "").trim(),
              portrait: String(photo?.src?.portrait ?? "").trim(),
            },
            downloadUrl: pickDownloadUrl(photo),
            raw: photo,
          };
        });
      },
    };
  }

  throw new Error(`No provider adapter registered for "${providerId}".`);
};

const normalizeCacheVariantKey = (value) =>
  String(value ?? "").trim() || "primary";

const getCachedVariantPath = ({ provider, externalId, variantKey, downloadUrl }) => {
  const extension = getFileExtension(downloadUrl);
  return resolve(
    ASSET_CACHE_ROOT,
    provider,
    externalId,
    `${normalizeCacheVariantKey(variantKey)}${extension}`
  );
};

const ensureCachedAssetVariant = async ({
  candidate,
  fetchImpl,
  registry,
  variantKey = "primary",
}) => {
  const assetRecord = registry.assets[candidate.assetId] ?? null;
  const existingVariant =
    assetRecord?.downloadedVariants?.[normalizeCacheVariantKey(variantKey)] ?? null;
  if (existingVariant?.absolutePath) {
    return existingVariant;
  }

  const response = await fetchImpl(candidate.downloadUrl);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Failed to download ${candidate.assetId} (${response.status}): ${detail.trim() || response.statusText}`
    );
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const checksum = computeChecksum(bytes);
  const absolutePath = getCachedVariantPath({
    provider: candidate.provider,
    externalId: candidate.externalId,
    variantKey,
    downloadUrl: candidate.downloadUrl,
  });
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, bytes);

  return {
    variantKey: normalizeCacheVariantKey(variantKey),
    absolutePath,
    checksum,
    cachedAt: new Date().toISOString(),
  };
};

const searchApprovedRegistryAssets = ({
  registry,
  provider,
  queryTokens,
  reuseFrom = "",
  approvedOnly = false,
}) => {
  const reuseNeedle = String(reuseFrom ?? "").trim().toLowerCase();
  if (!approvedOnly && !reuseNeedle) {
    return [];
  }

  return Object.values(registry.assets)
    .filter((asset) => asset.provider === provider)
    .filter((asset) =>
      approvedOnly
        ? ["approved", "in_use"].includes(asset.status)
        : true
    )
    .filter((asset) => {
      if (!reuseNeedle) {
        return true;
      }
      return (asset.approvedUses ?? []).some((use) =>
        [use.slug, use.deckId, use.source]
          .map((value) => String(value ?? "").toLowerCase())
          .some((value) => value.includes(reuseNeedle))
      );
    })
    .map((asset) => {
      const haystackTokens = tokenizeText(
        [
          asset.alt,
          ...(asset.searchOrigins ?? []).map((origin) => origin.query),
          ...(asset.searchOrigins ?? []).flatMap((origin) => origin.tags ?? []),
        ].join(" ")
      );
      const overlap = countTokenOverlap(queryTokens, haystackTokens);
      return {
        ...asset,
        reuseScore:
          overlap * 20 +
          (asset.status === "in_use" ? 8 : asset.status === "approved" ? 4 : 0),
      };
    })
    .filter((asset) => asset.reuseScore > 0 || reuseNeedle)
    .sort((left, right) => right.reuseScore - left.reuseScore);
};

const buildKeywordPoolFromTexts = (values) =>
  uniq(
    values
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 4)
      .filter((token) => !STOP_WORDS.has(token))
  );

const buildKeywordPool = (spec) => {
  const rawStrings = collectStrings({
    title: spec.chrome.title,
    subtitle: spec.chrome.subtitle,
    figureJob: spec.constraints.figureJob,
    focalPoint: spec.constraints.focalPoint,
    layout: spec.constraints.layout,
    body: spec.body,
  });

  return buildKeywordPoolFromTexts(rawStrings);
};

const buildDomainSuffix = (keywords) => {
  const healthTerms = [
    "clinic",
    "clinical",
    "doctor",
    "patient",
    "care",
    "appointment",
    "clinician",
    "healthcare",
    "medical",
  ];
  return keywords.some((keyword) => healthTerms.includes(keyword))
    ? ["healthcare", "clinic"]
    : ["people", "teamwork"];
};

const distributeCandidateCounts = (total, bucketCount) => {
  if (bucketCount <= 0) {
    return [];
  }

  const safeTotal = Math.max(1, Number(total) || DEFAULT_ASSET_CANDIDATES);
  const base = Math.floor(safeTotal / bucketCount);
  const remainder = safeTotal % bucketCount;

  return Array.from({ length: bucketCount }, (_, index) =>
    base + (index < remainder ? 1 : 0)
  );
};

const deriveAutoMediaSlots = (spec) => {
  const keywords = buildKeywordPool(spec);
  const suffix = buildDomainSuffix(keywords);
  const primaryTokens = uniq([...keywords.slice(0, 4), ...suffix]).slice(0, 6);
  const secondaryTokens = uniq([
    ...keywords.slice(0, 3),
    "abstract",
    "texture",
    ...suffix.slice(0, 1),
  ]).slice(0, 6);
  const safePrimaryTokens =
    primaryTokens.length > 0 ? primaryTokens : ["healthcare", "clinic", "teamwork"];
  const safeSecondaryTokens =
    secondaryTokens.length > 0
      ? secondaryTokens
      : ["abstract", "texture", "healthcare"];

  return [
    {
      id: "auto-primary-scene",
      label: "Primary supporting image",
      query: safePrimaryTokens.join(" "),
      orientation: "landscape",
      color: "",
      excludeTerms: [],
      maxCandidates: DEFAULT_ASSET_CANDIDATES,
      placementNote:
        "Auto-suggested from the figure brief. Consider for a hero/supporting visual.",
      autoGenerated: true,
    },
    {
      id: "auto-supporting-texture",
      label: "Secondary atmosphere / texture",
      query: safeSecondaryTokens.join(" "),
      orientation: "landscape",
      color: "",
      excludeTerms: [],
      maxCandidates: Math.max(4, DEFAULT_ASSET_CANDIDATES - 2),
      placementNote:
        "Auto-suggested from the figure brief. Consider for quiet texture or section support.",
      autoGenerated: true,
    },
  ].slice(0, AUTO_MEDIA_SLOT_COUNT);
};

const resolveFigureAssetSlots = (spec) => {
  if ((spec.media?.slots ?? []).length > 0) {
    return spec.media.slots.map((slot) => ({
      ...slot,
      autoGenerated: false,
    }));
  }

  return deriveAutoMediaSlots(spec);
};

const deriveStandaloneMediaSlots = ({
  purpose,
  orientation = "",
  color = "",
  style = "",
  mood = "",
  shot = "",
  people = "",
  copySafe = DEFAULT_COPY_SAFE,
  count = DEFAULT_ASSET_CANDIDATES,
}) => {
  const normalizedPurpose = String(purpose ?? "").trim().replace(/\s+/g, " ");
  const keywords = buildKeywordPoolFromTexts([normalizedPurpose]);
  const suffix = buildDomainSuffix(keywords);
  const styleToken = String(style ?? "").trim();
  const moodToken = String(mood ?? "").trim();
  const shotToken = String(shot ?? "").trim();
  const peopleToken = String(people ?? "").trim();
  const strengthenedTokens = uniq([...keywords.slice(0, 5), ...suffix]).slice(0, 7);
  const textureTokens = uniq([
    ...keywords.slice(0, 3),
    "atmosphere",
    "texture",
    ...suffix.slice(0, 1),
  ]).slice(0, 6);

  const tracks = [
    {
      id: "purpose-literal-scene",
      label: "Literal scene pass",
      query: uniq([normalizedPurpose, shotToken, peopleToken].filter(Boolean)).join(" "),
      placementNote:
        "Direct interpretation of the request. Start here for obvious literal fits.",
    },
    {
      id: "purpose-domain-scene",
      label: "Documentary / candid pass",
      query:
        strengthenedTokens.length > 0
          ? [...strengthenedTokens, "candid", "documentary", styleToken]
              .filter(Boolean)
              .slice(0, 9)
              .join(" ")
          : uniq([normalizedPurpose, "candid", styleToken].filter(Boolean)).join(" "),
      placementNote:
        "Pushes toward more candid, documentary-style results instead of generic stock staging.",
    },
    {
      id: "purpose-atmosphere",
      label: "Atmosphere / texture pass",
      query:
        textureTokens.length > 0
          ? [...textureTokens, "interior", "ambient", moodToken]
              .filter(Boolean)
              .slice(0, 9)
              .join(" ")
          : uniq(["abstract", "texture", "interior", "ambient", moodToken].filter(Boolean)).join(" "),
      placementNote:
        "Quieter imagery for backgrounds, crops, or subtle support.",
    },
    {
      id: "purpose-editorial",
      label: "Editorial / premium pass",
      query: uniq([
        ...strengthenedTokens.slice(0, 5),
        "editorial",
        "premium",
        styleToken,
        moodToken,
      ]).slice(0, 9).join(" "),
      placementNote:
        "Biases toward cleaner, more premium commercial photography when the first passes look too generic.",
    },
  ];

  const uniqueTracks = [];
  const seenQueries = new Set();
  for (const track of tracks) {
    const normalizedQuery = track.query.trim().toLowerCase();
    if (!normalizedQuery || seenQueries.has(normalizedQuery)) {
      continue;
    }
    seenQueries.add(normalizedQuery);
    uniqueTracks.push(track);
  }

  const safeCount = Math.max(1, Number(count) || DEFAULT_ASSET_CANDIDATES);
  const desiredTrackCount = Math.min(
    uniqueTracks.length,
    safeCount >= 4 ? 4 : safeCount
  );
  const selectedTracks = uniqueTracks.slice(0, Math.max(1, desiredTrackCount));
  const candidateCounts = distributeCandidateCounts(safeCount, selectedTracks.length);

  return selectedTracks.map((track, index) => ({
    ...track,
    orientation,
    color,
    styleTags: styleToken ? [styleToken] : [],
    moodTags: moodToken ? [moodToken] : [],
    subjectTags: peopleToken ? [peopleToken] : [],
    copySafeZones: copySafe ? [copySafe] : [],
    desiredShotType: shotToken,
    excludeTerms: [...STANDALONE_GENERIC_EXCLUDE_TERMS],
    maxCandidates: candidateCounts[index] || 1,
    autoGenerated: true,
  }));
};

const pickDownloadUrl = (photo) =>
  photo?.src?.large2x ||
  photo?.src?.large ||
  photo?.src?.landscape ||
  photo?.src?.portrait ||
  photo?.src?.original ||
  "";

const getFileExtension = (urlValue) => {
  try {
    const pathname = new URL(urlValue).pathname;
    const extension = extname(pathname).toLowerCase();
    if (
      extension === ".jpeg" ||
      extension === ".jpg" ||
      extension === ".png" ||
      extension === ".webp"
    ) {
      return extension;
    }
  } catch {
    return ".jpg";
  }
  return ".jpg";
};

const scorePhoto = ({ photo, index, slot, forbiddenTerms }) => {
  const orientation = inferOrientation(photo);
  const haystack = buildCandidateHaystack(photo);
  const matchedForbiddenTerms = forbiddenTerms.filter((term) =>
    haystack.includes(term)
  );
  const baseOrderScore = Math.max(0, 100 - index * 6);
  const orientationScore = slot.orientation
    ? orientation === slot.orientation
      ? 30
      : -20
    : 0;
  const resolutionScore = Math.min(20, Math.round(megapixelsFor(photo)));
  const colorScore = slot.color && photo?.avg_color ? 8 : 0;
  const totalScore =
    baseOrderScore + orientationScore + resolutionScore + colorScore;

  return {
    totalScore,
    breakdown: {
      baseOrderScore,
      orientationScore,
      resolutionScore,
      colorScore,
    },
    matchedForbiddenTerms,
    orientation,
  };
};

const importPlaywright = async () => {
  try {
    return await import("playwright");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      [
        "Playwright is required for asset board export but is unavailable.",
        `Details: ${message}`,
        "Remediation:",
        "1) Install dependencies with `npm install`.",
        "2) Install Chromium if needed with `npx playwright install chromium`.",
      ].join("\n")
    );
  }
};

const renderCandidateCard = (candidate) => {
  const imageUrl =
    candidate.boardImageUrl ||
    candidate.relativeDownloadPath ||
    candidate.remoteImageUrl;

  return `
    <article class="candidate-card">
      <div class="candidate-media">
        <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(candidate.alt || "Pexels candidate")}" />
      </div>
      <div class="candidate-body">
        <div class="candidate-score">Score ${escapeHtml(candidate.score)}</div>
        <div class="candidate-title">${escapeHtml(candidate.alt || "Untitled photo")}</div>
        <div class="candidate-meta">${escapeHtml(candidate.width)} x ${escapeHtml(candidate.height)} · ${escapeHtml(candidate.orientation)} · ${escapeHtml(candidate.avgColor || "n/a")}</div>
        <div class="candidate-credit">
          Photo by <a href="${escapeHtml(candidate.photographerUrl)}">${escapeHtml(candidate.photographer)}</a>
          on <a href="${escapeHtml(candidate.photoUrl)}">Pexels</a>
        </div>
      </div>
    </article>
  `;
};

const renderSlotSection = (slot) => {
  const candidatesHtml =
    slot.candidates.length > 0
      ? slot.candidates.map(renderCandidateCard).join("")
      : `<div class="empty-state">No candidates matched this slot.</div>`;

  return `
    <section class="slot-section">
      <div class="slot-header">
        <div>
          <div class="slot-label">${escapeHtml(slot.label)}</div>
          <div class="slot-query">${escapeHtml(slot.query)}</div>
          ${
            slot.autoGenerated
              ? `<div class="slot-auto-note">Auto-suggested from the brief</div>`
              : ""
          }
        </div>
        <div class="slot-summary">
          <span>${escapeHtml(slot.candidates.length)} shown</span>
          ${
            slot.orientation
              ? `<span>orientation: ${escapeHtml(slot.orientation)}</span>`
              : ""
          }
          ${
            slot.color
              ? `<span>color: ${escapeHtml(slot.color)}</span>`
              : ""
          }
        </div>
      </div>
      ${
        slot.placementNote
          ? `<div class="slot-note">${escapeHtml(slot.placementNote)}</div>`
          : ""
      }
      <div class="candidate-grid">
        ${candidatesHtml}
      </div>
    </section>
  `;
};

const renderAssetBoardHtml = ({ eyebrow, title, summary, manifest }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(manifest.slug)} asset board</title>
    <style>
      :root {
        color-scheme: light;
        --page-bg: #efe9de;
        --ink: #17322d;
        --muted: #6b7d79;
        --line: rgba(23, 50, 45, 0.12);
        --panel: rgba(255, 255, 255, 0.92);
        --accent: #1d766c;
        --accent-soft: #dcedea;
        --shadow: 0 16px 42px rgba(23, 50, 45, 0.12);
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        min-height: 100%;
      }

      body {
        padding: 28px;
        color: var(--ink);
        background:
          radial-gradient(900px 420px at 0% 0%, rgba(29, 118, 108, 0.12) 0%, rgba(29, 118, 108, 0) 68%),
          linear-gradient(180deg, #f5f1ea 0%, var(--page-bg) 100%);
        font-family: "Manrope", "Avenir Next", system-ui, sans-serif;
      }

      a {
        color: inherit;
      }

      .page {
        display: grid;
        gap: 18px;
      }

      .hero {
        padding: 24px 26px;
        border: 1px solid var(--line);
        border-radius: 24px;
        background: var(--panel);
        box-shadow: var(--shadow);
      }

      .eyebrow {
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--muted);
      }

      h1 {
        margin: 10px 0 8px;
        font-size: 34px;
        line-height: 1;
      }

      .summary {
        color: var(--muted);
        font-size: 15px;
      }

      .slot-section {
        padding: 22px;
        border: 1px solid var(--line);
        border-radius: 24px;
        background: var(--panel);
        box-shadow: var(--shadow);
      }

      .slot-header {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        align-items: flex-start;
      }

      .slot-label {
        font-size: 26px;
        font-weight: 800;
        line-height: 1.05;
      }

      .slot-query {
        margin-top: 8px;
        font-size: 15px;
        color: var(--muted);
      }

      .slot-auto-note {
        margin-top: 8px;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--accent);
      }

      .slot-summary {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: flex-end;
      }

      .slot-summary span {
        padding: 7px 10px;
        border-radius: 999px;
        background: var(--accent-soft);
        font-size: 12px;
        font-weight: 700;
      }

      .slot-note {
        margin-top: 12px;
        color: var(--muted);
        font-size: 14px;
      }

      .candidate-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
        margin-top: 18px;
      }

      .candidate-card {
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.96);
      }

      .candidate-media {
        aspect-ratio: 16 / 10;
        background: #e8ece9;
      }

      .candidate-media img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .candidate-body {
        display: grid;
        gap: 8px;
        padding: 14px;
      }

      .candidate-score {
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--accent);
      }

      .candidate-title {
        font-size: 18px;
        line-height: 1.18;
        font-weight: 800;
      }

      .candidate-meta,
      .candidate-credit,
      .empty-state {
        color: var(--muted);
        font-size: 13px;
        line-height: 1.4;
      }

      .empty-state {
        padding: 18px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.82);
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <div class="eyebrow">${escapeHtml(eyebrow)}</div>
        <h1>${escapeHtml(title)}</h1>
        <div class="summary">${escapeHtml(summary)}</div>
      </section>
      ${manifest.slots.map(renderSlotSection).join("")}
    </main>
  </body>
</html>
`;

const exportAssetBoard = async ({ paths, importPlaywrightImpl }) => {
  const { chromium } = await importPlaywrightImpl();
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      viewport: { width: 1600, height: 900 },
      deviceScaleFactor: 1,
    });
    await page.goto(toFileUrl(paths.assetBoardHtmlPath), {
      waitUntil: "networkidle",
    });
    await page.screenshot({
      path: paths.assetBoardPngPath,
      fullPage: true,
    });
    await page.close();
  } finally {
    await browser.close();
  }
};

const toScoreablePhoto = (candidate) => ({
  alt: candidate.alt,
  url: candidate.canonicalUrl,
  photographer: candidate.photographer,
  width: candidate.dimensions?.width ?? 0,
  height: candidate.dimensions?.height ?? 0,
  avg_color: candidate.avgColor,
});

const resolveCachedBoardPath = ({ runDir, absolutePath }) => {
  if (!absolutePath) {
    return null;
  }
  return relative(runDir, absolutePath).replaceAll("\\", "/");
};

const buildAssetSearchOrigin = ({ context, slot }) => ({
  slug: context.slug,
  mode: context.mode,
  scope: context.scope,
  specPath: context.specPath ?? "",
  query: slot.query,
  slotId: slot.id,
  role: slot.role ?? "",
  tags: uniq([
    ...(slot.styleTags ?? []),
    ...(slot.moodTags ?? []),
    ...(slot.subjectTags ?? []),
    ...(slot.copySafeZones ?? []),
    slot.desiredShotType ?? "",
  ]).filter(Boolean),
  generatedAt: new Date().toISOString(),
});

const buildRegistryRecord = ({
  context,
  slot,
  candidate,
  score,
  scoreBreakdown,
  diversityPenalty,
  cachedVariant = null,
}) => ({
  assetId: candidate.assetId,
  provider: candidate.provider,
  externalId: candidate.externalId,
  canonicalUrl: candidate.canonicalUrl,
  photographer: candidate.photographer,
  attribution: candidate.attribution,
  licenseClass: candidate.licenseClass,
  dimensions: candidate.dimensions,
  avgColor: candidate.avgColor,
  alt: candidate.alt,
  sourceUrls: candidate.sourceUrls ?? {},
  downloadUrl: candidate.downloadUrl || "",
  checksum: cachedVariant?.checksum ?? null,
  downloadedVariants: cachedVariant
    ? {
        [cachedVariant.variantKey]: cachedVariant,
      }
    : {},
  searchOrigins: [buildAssetSearchOrigin({ context, slot })],
  scores: {
    latest: {
      score,
      scoreBreakdown,
      diversityPenalty,
      slotId: slot.id,
    },
  },
  status: "discovered",
  approvedUses: [],
  rejectionReasons: [],
});

const emptySelectionDoc = ({ manifest }) => ({
  generatedAt: new Date().toISOString(),
  slug: manifest.slug,
  provider: manifest.provider,
  scope: manifest.scope,
  manifestPath: manifest.outputDir,
  decisions: [],
});

const buildPreviewVariants = (selection) =>
  PREVIEW_VARIANTS.map((variant) => ({
    id: variant.id,
    label: variant.label,
    src: selection.src,
    placement: selection.placement,
    objectPosition: variant.objectPosition || selection.objectPosition || "center center",
    treatment: variant.treatment || selection.treatment || DEFAULT_TREATMENT,
    opacity:
      variant.opacity ?? selection.opacity ?? null,
  }));

const buildRenderAssetsDoc = ({ manifest, selectionDoc, spec = null }) => {
  const approved = selectionDoc.decisions.filter((entry) =>
    ["approved", "in_use"].includes(entry.status)
  );

  return {
    generatedAt: new Date().toISOString(),
    slug: manifest.slug,
    provider: manifest.provider,
    scope: manifest.scope,
    strategy: spec?.media?.strategy ?? "native",
    selections: approved.map((entry) => ({
      slotId: entry.slotId,
      assetId: entry.assetId,
      candidateId: entry.candidateId,
      status: entry.status,
      placement: entry.placement,
      treatment: entry.treatment,
      objectPosition: entry.objectPosition,
      opacity: entry.opacity,
      cropVariant: entry.cropVariant,
      alt: entry.alt,
      src: entry.src,
      photographer: entry.photographer,
      photoUrl: entry.photoUrl,
      variants: buildPreviewVariants(entry),
    })),
  };
};

const buildSelectionDocFromSpec = ({ spec, manifest }) => {
  const doc = emptySelectionDoc({ manifest });
  const legacySelection = Array.isArray(spec?.media?.selection)
    ? spec.media.selection
    : [];
  const slotSelections = (spec?.media?.slots ?? [])
    .filter((slot) => slot.selectedAssetRef?.assetId)
    .map((slot, index) => ({
      id: `${slot.id || "slot"}-approved-${index + 1}`,
      slotId: slot.id,
      assetId: slot.selectedAssetRef.assetId,
      candidateId: slot.selectedAssetRef.candidateId || "",
      candidateIndex: null,
      status: normalizeStatus(slot.selectedAssetRef.status, DEFAULT_SELECTION_STATUS),
      placement:
        slot.selectedAssetRef.placement ||
        slot.placement?.target ||
        slot.role ||
        "motif",
      treatment:
        slot.selectedAssetRef.treatment ||
        slot.treatmentDefaults?.treatment ||
        DEFAULT_TREATMENT,
      objectPosition:
        slot.selectedAssetRef.objectPosition ||
        slot.placement?.objectPosition ||
        "center center",
      opacity:
        slot.selectedAssetRef.opacity ??
        slot.treatmentDefaults?.opacity ??
        null,
      cropVariant: slot.selectedAssetRef.cropVariant || DEFAULT_CROP_VARIANT,
      alt: slot.selectedAssetRef.alt || "",
      reason: "",
      photographer: "",
      photoUrl: "",
      src: "",
    }));

  doc.decisions = [...legacySelection, ...slotSelections].map((entry, index) => ({
    id: entry.id || `selection-${index + 1}`,
    slotId: entry.slotId || "",
    assetId: entry.assetId || "",
    candidateId: entry.candidateId || "",
    candidateIndex:
      Number.isInteger(entry.candidateIndex) && entry.candidateIndex >= 0
        ? entry.candidateIndex
        : null,
    status: normalizeStatus(entry.status, DEFAULT_SELECTION_STATUS),
    placement: entry.placement || "motif",
    treatment: entry.treatment || DEFAULT_TREATMENT,
    objectPosition: entry.objectPosition || "center center",
    opacity: entry.opacity ?? null,
    cropVariant: entry.cropVariant || DEFAULT_CROP_VARIANT,
    alt: entry.alt || "",
    reason: entry.reason || "",
    photographer: entry.photographer || "",
    photoUrl: entry.photoUrl || "",
    src: entry.src || "",
  }));

  return doc;
};

const GENERIC_STOCK_PENALTIES = [
  "handshake",
  "thumbs up",
  "smiling at camera",
  "posed",
  "posing",
  "call center",
  "customer service",
];

const ROLE_PLACEMENT_DEFAULTS = {
  hero: "hero",
  supporting: "motif",
  background: "background",
  texture: "background",
  card: "card",
  strip: "strip",
  inset: "inset",
};

const registryAssetToCandidate = (asset) => ({
  provider: asset.provider,
  assetId: asset.assetId,
  externalId: asset.externalId,
  canonicalUrl: asset.canonicalUrl,
  photographer: asset.photographer,
  photographerUrl: asset.attribution?.photographerUrl || "",
  attribution: asset.attribution ?? {},
  licenseClass: asset.licenseClass,
  dimensions: asset.dimensions ?? { width: 0, height: 0 },
  avgColor: asset.avgColor,
  alt: asset.alt,
  sourceUrls: asset.sourceUrls ?? {},
  downloadUrl:
    asset.downloadUrl ||
    asset.sourceUrls?.large2x ||
    asset.sourceUrls?.large ||
    asset.sourceUrls?.original ||
    "",
  reuseScore: Number(asset.reuseScore ?? 0),
  status: normalizeStatus(asset.status, "discovered"),
  downloadedVariants: asset.downloadedVariants ?? {},
  approvedUses: asset.approvedUses ?? [],
  fromRegistry: true,
});

const resolvePlacementForSlot = (slot, fallback = "motif") =>
  slot?.placement?.target ||
  ROLE_PLACEMENT_DEFAULTS[slot?.role] ||
  fallback;

const resolveObjectPositionForSlot = (slot) =>
  slot?.placement?.objectPosition || "center center";

const resolveTreatmentForSlot = (slot) =>
  slot?.treatmentDefaults?.treatment || DEFAULT_TREATMENT;

const resolveOpacityForSlot = (slot) =>
  slot?.treatmentDefaults?.opacity ?? null;

const scoreSlotIntent = ({ candidate, slot }) => {
  const haystack = buildCandidateHaystack({
    alt: candidate.alt,
    url: candidate.canonicalUrl,
    photographer: candidate.photographer,
  });
  const shotTokens = tokenizeText(slot.desiredShotType);
  const styleTokens = [
    ...(slot.styleTags ?? []),
    ...(slot.moodTags ?? []),
    ...(slot.subjectTags ?? []),
  ].flatMap((value) => tokenizeText(value));

  const role = String(slot.role ?? "supporting").trim();
  const copySafeRequested = Array.isArray(slot.copySafeZones)
    ? slot.copySafeZones.length > 0
    : false;
  const shotScore = shotTokens.some((token) => haystack.includes(token)) ? 10 : 0;
  const styleScore = Math.min(
    10,
    styleTokens.filter((token) => haystack.includes(token)).length * 4
  );
  const copySafeScore =
    copySafeRequested &&
    ["hero", "background", "strip", "supporting"].includes(role) &&
    (slot.orientation || "").trim() === "landscape"
      ? 6
      : 0;
  const roleScore =
    role === "texture" || role === "background"
      ? haystack.includes("texture") || haystack.includes("interior")
        ? 10
        : -4
      : role === "inset"
        ? haystack.includes("detail") || haystack.includes("close")
          ? 8
          : 0
        : haystack.includes("patient") ||
            haystack.includes("doctor") ||
            haystack.includes("team") ||
            haystack.includes("clinic")
          ? 8
          : 0;
  const clichePenalty = GENERIC_STOCK_PENALTIES.reduce(
    (total, term) => total + (haystack.includes(term) ? 10 : 0),
    0
  );

  return {
    shotScore,
    styleScore,
    copySafeScore,
    roleScore,
    clichePenalty,
    total:
      shotScore +
      styleScore +
      copySafeScore +
      roleScore -
      clichePenalty,
  };
};

const toManifestCandidate = ({
  runDir,
  candidate,
  scoring,
  diversityPenalty,
  cachedVariant = null,
}) => {
  const relativeDownloadPath = cachedVariant
    ? resolveCachedBoardPath({
        runDir,
        absolutePath: cachedVariant.absolutePath,
      })
    : null;

  return {
    id: String(candidate.externalId || candidate.assetId),
    assetId: candidate.assetId,
    externalId: candidate.externalId,
    provider: candidate.provider,
    status: normalizeStatus(candidate.status, "discovered"),
    score: scoring.totalScore,
    scoreBreakdown: scoring.breakdown,
    diversityPenalty,
    alt: String(candidate.alt ?? "").trim(),
    width: Number(candidate.dimensions?.width ?? 0),
    height: Number(candidate.dimensions?.height ?? 0),
    orientation: scoring.orientation,
    megapixels: megapixelsFor(candidate.dimensions ?? {}),
    avgColor: String(candidate.avgColor ?? "").trim(),
    photographer: String(candidate.photographer ?? "").trim(),
    photographerUrl:
      String(candidate.photographerUrl ?? "") ||
      String(candidate.attribution?.photographerUrl ?? ""),
    photoUrl:
      String(candidate.canonicalUrl ?? "") ||
      String(candidate.attribution?.canonicalUrl ?? ""),
    remoteImageUrl: candidate.downloadUrl || "",
    boardImageUrl: relativeDownloadPath || candidate.downloadUrl || "",
    relativeDownloadPath,
    absoluteDownloadPath: cachedVariant?.absolutePath ?? null,
    attribution: candidate.attribution ?? {},
    licenseClass: candidate.licenseClass,
    approvedUses: candidate.approvedUses ?? [],
  };
};

const findManifestCandidate = ({
  manifest,
  slotId = "",
  candidateId = "",
  assetId = "",
  candidateIndex = null,
}) => {
  for (const slot of manifest.slots ?? []) {
    if (slotId && slot.id !== slotId) {
      continue;
    }
    const match =
      (slot.candidates ?? []).find((candidate) => {
      if (assetId && candidate.assetId === assetId) {
        return true;
      }
      if (candidateId && String(candidate.id) === String(candidateId)) {
        return true;
      }
      return false;
      }) ??
      (Number.isInteger(candidateIndex)
        ? slot.candidates?.[candidateIndex] ?? null
        : null);
    if (match) {
      return {
        slot,
        candidate: match,
      };
    }
  }
  return null;
};

const resolveSelectionSource = ({
  manifest,
  registry,
  runDir,
  decision,
}) => {
  if (decision.src) {
    return {
      src: decision.src,
      alt: decision.alt || "",
      photographer: decision.photographer || "",
      photoUrl: decision.photoUrl || "",
      assetId: decision.assetId || "",
      candidateId: decision.candidateId || "",
    };
  }

  const manifestMatch = findManifestCandidate({
    manifest,
    slotId: decision.slotId,
    candidateId: decision.candidateId,
    assetId: decision.assetId,
    candidateIndex: decision.candidateIndex,
  });

  if (manifestMatch) {
    const candidate = manifestMatch.candidate;
    return {
      slot: manifestMatch.slot,
      src: candidate.relativeDownloadPath || candidate.boardImageUrl || candidate.remoteImageUrl,
      alt: decision.alt || candidate.alt || "",
      photographer: candidate.photographer || "",
      photoUrl: candidate.photoUrl || "",
      assetId: candidate.assetId,
      candidateId: candidate.id,
    };
  }

  const asset = registry.assets[decision.assetId] ?? null;
  if (!asset) {
    return null;
  }

  const preferredVariant =
    asset.downloadedVariants?.primary ??
    Object.values(asset.downloadedVariants ?? {})[0] ??
    null;
  const relativePath = preferredVariant?.absolutePath
    ? resolveCachedBoardPath({
        runDir,
        absolutePath: preferredVariant.absolutePath,
      })
    : null;

  return {
    slot: null,
    src: relativePath || asset.downloadUrl || "",
    alt: decision.alt || asset.alt || "",
    photographer: asset.photographer || "",
    photoUrl: asset.canonicalUrl || "",
    assetId: asset.assetId,
    candidateId: decision.candidateId || asset.externalId || "",
  };
};

const hydrateSelectionDoc = ({
  manifest,
  selectionDoc,
  registry,
}) => ({
  ...selectionDoc,
  decisions: selectionDoc.decisions
    .map((decision) => {
      const source = resolveSelectionSource({
        manifest,
        registry,
        runDir: manifest.outputDir,
        decision,
      });
      if (!source) {
        return {
          ...decision,
          resolved: false,
        };
      }

      const slot =
        source.slot ??
        (manifest.slots ?? []).find((item) => item.id === decision.slotId) ??
        null;

      return {
        ...decision,
        assetId: source.assetId || decision.assetId || "",
        candidateId: source.candidateId || decision.candidateId || "",
        placement: decision.placement || resolvePlacementForSlot(slot),
        treatment: decision.treatment || resolveTreatmentForSlot(slot),
        objectPosition:
          decision.objectPosition || resolveObjectPositionForSlot(slot),
        opacity:
          decision.opacity ?? resolveOpacityForSlot(slot),
        alt: source.alt || decision.alt || "",
        photographer: source.photographer || decision.photographer || "",
        photoUrl: source.photoUrl || decision.photoUrl || "",
        src: source.src || "",
        resolved: Boolean(source.src),
      };
    })
    .filter((decision) => decision.assetId || decision.src),
});

const syncRegistryDecisions = async ({
  registry,
  decisions,
  manifest,
}) => {
  for (const decision of decisions) {
    const asset = registry.assets[decision.assetId] ?? null;
    if (!asset) {
      continue;
    }

    const approvedUse =
      decision.status === "approved" || decision.status === "in_use"
        ? [
            {
              slug: manifest.slug,
              source: manifest.mode,
              deckId: manifest.deckId || "",
              slotId: decision.slotId || "",
              appliedAt: new Date().toISOString(),
            },
          ]
        : [];

    upsertRegistryAsset({
      registry,
      record: {
        ...asset,
        status: decision.status,
        approvedUses: approvedUse,
        rejectionReasons: decision.reason ? [decision.reason] : [],
      },
    });
  }
  await saveAssetRegistry(registry);
};

const writeSelectionArtifacts = async ({
  spec = null,
  paths,
  manifest,
  registry,
}) => {
  const baseSelectionDoc = spec
    ? buildSelectionDocFromSpec({ spec, manifest })
    : emptySelectionDoc({ manifest });
  const selectionDoc = hydrateSelectionDoc({
    manifest,
    selectionDoc: baseSelectionDoc,
    registry,
  });
  const renderAssets = buildRenderAssetsDoc({
    manifest,
    selectionDoc,
    spec,
  });

  await writeJson(paths.assetSelectionPath, selectionDoc);
  await writeJson(paths.renderAssetsPath, renderAssets);
  await syncRegistryDecisions({
    registry,
    decisions: selectionDoc.decisions,
    manifest,
  });

  return {
    selectionDoc,
    renderAssets,
  };
};

const buildSlotManifest = async ({
  context,
  slot,
  provider,
  paths,
  fetchImpl,
  registry,
  baseForbiddenTerms = [],
  download = true,
  selectionState = null,
  approvedOnly = false,
  reuseFrom = "",
}) => {
  const requestedCandidates = slot.maxCandidates || DEFAULT_ASSET_CANDIDATES;
  const forbiddenTerms = normalizeNeedles([
    ...baseForbiddenTerms,
    ...(slot.excludeTerms ?? []),
  ]);
  const queryTokens = buildKeywordPoolFromTexts([
    slot.query,
    ...(slot.styleTags ?? []),
    ...(slot.moodTags ?? []),
    ...(slot.subjectTags ?? []),
  ]);
  const registryReuseCandidates = searchApprovedRegistryAssets({
    registry,
    provider: provider.id,
    queryTokens,
    reuseFrom,
    approvedOnly,
  })
    .slice(0, Math.max(requestedCandidates * 2, 6))
    .map(registryAssetToCandidate);

  const needProviderSearch = !approvedOnly;
  const apiKey =
    needProviderSearch && provider.id === "pexels" ? resolvePexelsApiKey() : "";
  const providerCandidates = needProviderSearch
    ? await provider.search({
        query: slot.query,
        orientation: slot.orientation,
        color: slot.color,
        perPage: Math.min(80, Math.max(requestedCandidates * 4, 18)),
        apiKey,
        fetchImpl,
      })
    : [];

  const rawCandidates = uniqBy(
    [...registryReuseCandidates, ...providerCandidates].filter((candidate) =>
      isNonEmptyString(candidate.assetId || candidate.externalId)
    ),
    (candidate) => candidate.assetId
  );

  const scoredCandidates = rawCandidates
    .map((candidate, index) => {
      const photo = toScoreablePhoto(candidate);
      const base = scorePhoto({
        photo,
        index,
        slot,
        forbiddenTerms,
      });
      const intent = scoreSlotIntent({ candidate, slot });
      return {
        candidate,
        photographerKey: normalizePhotographerKey(candidate?.photographer),
        altTokens: tokenizeText(candidate?.alt),
        scoring: {
          totalScore: base.totalScore + intent.total + Number(candidate.reuseScore ?? 0),
          breakdown: {
            ...base.breakdown,
            intentScore: intent.total,
            shotScore: intent.shotScore,
            styleScore: intent.styleScore,
            copySafeScore: intent.copySafeScore,
            roleScore: intent.roleScore,
            clichePenalty: intent.clichePenalty,
            reuseScore: Number(candidate.reuseScore ?? 0),
          },
          matchedForbiddenTerms: base.matchedForbiddenTerms,
          orientation: base.orientation,
        },
      };
    })
    .filter((entry) => entry.scoring.matchedForbiddenTerms.length === 0)
    .sort((left, right) => right.scoring.totalScore - left.scoring.totalScore);

  const candidates = [];
  const selectedAltTokenSets = [];
  const localSelections = [];
  const localPhotographerCounts = new Map();

  while (
    candidates.length < requestedCandidates &&
    localSelections.length < scoredCandidates.length
  ) {
    let bestIndex = -1;
    let bestAdjustedScore = Number.NEGATIVE_INFINITY;
    let bestPenalty = {
      photographerPenalty: 0,
      similarityPenalty: 0,
    };

    for (const [index, entry] of scoredCandidates.entries()) {
      if (localSelections.includes(index)) {
        continue;
      }

      if (selectionState?.seenAssetIds instanceof Set) {
        if (selectionState.seenAssetIds.has(entry.candidate.assetId)) {
          continue;
        }
      }

      const globalPhotographerCount =
        selectionState?.photographerCounts instanceof Map && entry.photographerKey
          ? selectionState.photographerCounts.get(entry.photographerKey) ?? 0
          : 0;
      const localPhotographerCount = entry.photographerKey
        ? localPhotographerCounts.get(entry.photographerKey) ?? 0
        : 0;
      const photographerPenalty =
        (globalPhotographerCount + localPhotographerCount) * 24;
      const similarityPenalty = selectedAltTokenSets.reduce((maxPenalty, tokens) => {
        const overlap = countTokenOverlap(entry.altTokens, tokens);
        if (overlap >= 4) {
          return Math.max(maxPenalty, 24);
        }
        if (overlap >= 3) {
          return Math.max(maxPenalty, 16);
        }
        if (overlap >= 2) {
          return Math.max(maxPenalty, 8);
        }
        return maxPenalty;
      }, 0);
      const adjustedScore =
        entry.scoring.totalScore - photographerPenalty - similarityPenalty;

      if (adjustedScore > bestAdjustedScore) {
        bestIndex = index;
        bestAdjustedScore = adjustedScore;
        bestPenalty = {
          photographerPenalty,
          similarityPenalty,
        };
      }
    }

    if (bestIndex === -1) {
      break;
    }

    localSelections.push(bestIndex);
    const entry = scoredCandidates[bestIndex];
    let cachedVariant =
      entry.candidate.downloadedVariants?.primary ??
      Object.values(entry.candidate.downloadedVariants ?? {})[0] ??
      null;

    if (!cachedVariant?.absolutePath && download && entry.candidate.downloadUrl) {
      cachedVariant = await ensureCachedAssetVariant({
        candidate: entry.candidate,
        fetchImpl,
        registry,
        variantKey: "primary",
      });
    }

    const manifestCandidate = toManifestCandidate({
      runDir: paths.dir,
      candidate: entry.candidate,
      scoring: {
        totalScore: bestAdjustedScore,
        breakdown: entry.scoring.breakdown,
        orientation: entry.scoring.orientation,
      },
      diversityPenalty: bestPenalty,
      cachedVariant,
    });
    candidates.push(manifestCandidate);

    upsertRegistryAsset({
      registry,
      record: buildRegistryRecord({
        context,
        slot,
        candidate: entry.candidate,
        score: bestAdjustedScore,
        scoreBreakdown: entry.scoring.breakdown,
        diversityPenalty: bestPenalty,
        cachedVariant,
      }),
    });

    if (selectionState?.seenAssetIds instanceof Set) {
      selectionState.seenAssetIds.add(entry.candidate.assetId);
    }
    if (entry.photographerKey) {
      localPhotographerCounts.set(
        entry.photographerKey,
        (localPhotographerCounts.get(entry.photographerKey) ?? 0) + 1
      );
      if (selectionState?.photographerCounts instanceof Map) {
        selectionState.photographerCounts.set(
          entry.photographerKey,
          (selectionState.photographerCounts.get(entry.photographerKey) ?? 0) + 1
        );
      }
    }
    selectedAltTokenSets.push(entry.altTokens);
  }

  return {
    id: slot.id,
    label: slot.label,
    role: slot.role || "supporting",
    required: Boolean(slot.required),
    query: slot.query,
    orientation: slot.orientation,
    color: slot.color,
    placementNote: slot.placementNote,
    autoGenerated: Boolean(slot.autoGenerated),
    maxCandidates: requestedCandidates,
    styleTracks: slot.styleTracks ?? [],
    moodTags: slot.moodTags ?? [],
    styleTags: slot.styleTags ?? [],
    subjectTags: slot.subjectTags ?? [],
    avoidTags: slot.avoidTags ?? [],
    copySafeZones: slot.copySafeZones ?? [],
    desiredShotType: slot.desiredShotType ?? "",
    desiredPeopleCount: slot.desiredPeopleCount ?? null,
    clutterTarget: slot.clutterTarget ?? "medium",
    placement: slot.placement ?? null,
    treatmentDefaults: slot.treatmentDefaults ?? null,
    candidates,
  };
};

const buildManifestSummary = ({ manifest, resolvedSelectionCount }) => {
  const candidateCount = manifest.slots.reduce(
    (total, slot) => total + (slot.candidates?.length ?? 0),
    0
  );
  return {
    slotCount: manifest.slots.length,
    candidateCount,
    resolvedSelectionCount,
  };
};

const generateAssetBundle = async ({
  slug,
  outputDir = null,
  slots,
  slotMode,
  mode,
  title,
  eyebrow,
  summaryBuilder,
  spec = null,
  specPath = null,
  purpose = "",
  request = null,
  providerId = DEFAULT_ASSET_PROVIDER,
  fetchImpl = globalThis.fetch,
  importPlaywrightImpl = importPlaywright,
  baseForbiddenTerms = [],
  download = true,
  dedupeAcrossSlots = false,
  approvedOnly = false,
  reuseFrom = "",
} = {}) => {
  if (typeof fetchImpl !== "function") {
    throw new Error("This script requires Node.js v18+ (global fetch is missing).");
  }

  const provider = resolveAssetProvider(providerId);

  const paths = getOutputPaths({ slug, outputDir });
  await mkdir(paths.dir, { recursive: true });
  await mkdir(ASSET_CACHE_ROOT, { recursive: true });

  const registry = await loadAssetRegistry();
  const selectionState = dedupeAcrossSlots
    ? {
        seenAssetIds: new Set(),
        photographerCounts: new Map(),
      }
    : null;
  const context = {
    slug,
    mode,
    scope: paths.dir,
    specPath,
  };

  const manifestSlots = [];
  for (const slot of slots) {
    manifestSlots.push(
      await buildSlotManifest({
        context,
        slot,
        provider,
        paths,
        fetchImpl,
        registry,
        baseForbiddenTerms,
        download,
        selectionState,
        approvedOnly,
        reuseFrom,
      })
    );
  }

  await saveAssetRegistry(registry);

  const manifest = {
    version: ASSET_REGISTRY_VERSION,
    generatedAt: new Date().toISOString(),
    provider: provider.id,
    mode,
    slug,
    outputDir: paths.dir,
    slotMode,
    download,
    scope: paths.dir,
    deckId: spec?.meta?.deckId ?? "",
    strategy: spec?.media?.strategy ?? "native",
    cacheRoot: ASSET_CACHE_ROOT,
    registryPath: getAssetRegistryPath(),
    ...(specPath ? { specPath } : {}),
    ...(purpose ? { purpose } : {}),
    ...(request ? { request } : {}),
    slots: manifestSlots,
  };

  const { selectionDoc, renderAssets } = await writeSelectionArtifacts({
    spec,
    paths,
    manifest,
    registry,
  });
  manifest.summary = buildManifestSummary({
    manifest,
    resolvedSelectionCount: renderAssets.selections.length,
  });

  const html = renderAssetBoardHtml({
    eyebrow,
    title,
    summary: summaryBuilder(manifest),
    manifest,
  });
  await writeJson(paths.assetsManifestPath, manifest);
  await writeText(paths.assetBoardHtmlPath, html);
  await exportAssetBoard({
    paths,
    importPlaywrightImpl,
  });

  return {
    paths,
    manifest,
    selectionDoc,
    renderAssets,
  };
};

export const resolveRenderSelectionsFromArtifacts = async ({
  spec,
  paths,
}) => {
  try {
    const renderAssets = await readJson(paths.renderAssetsPath);
    if (Array.isArray(renderAssets?.selections)) {
      return renderAssets.selections.filter((entry) => entry.src);
    }
  } catch {}

  try {
    const manifest = await readJson(paths.assetsManifestPath);
    const registry = await loadAssetRegistry();
    const selectionDoc = await readJson(paths.assetSelectionPath).catch(() =>
      buildSelectionDocFromSpec({ spec, manifest })
    );
    const hydrated = hydrateSelectionDoc({
      manifest,
      selectionDoc,
      registry,
    });
    const renderAssets = buildRenderAssetsDoc({
      manifest,
      selectionDoc: hydrated,
      spec,
    });
    await writeJson(paths.assetSelectionPath, hydrated);
    await writeJson(paths.renderAssetsPath, renderAssets);
    return renderAssets.selections.filter((entry) => entry.src);
  } catch {
    return [];
  }
};

export const generateFigureAssets = async ({
  specPath,
  outputDir = null,
  fetchImpl = globalThis.fetch,
  importPlaywrightImpl = importPlaywright,
  approvedOnly = false,
  reuseFrom = "",
} = {}) => {
  const spec = await loadFigureSpec(specPath);
  const result = await generateAssetBundle({
    slug: spec.meta.slug,
    outputDir,
    slots: resolveFigureAssetSlots(spec),
    slotMode: (spec.media?.slots ?? []).length > 0 ? "explicit" : "auto",
    mode: "figure",
    title: spec.chrome.title || spec.meta.slug,
    eyebrow: "Stock-image candidate board",
    summaryBuilder: (manifest) =>
      `${manifest.slots.length} slot(s) · Provider: ${manifest.provider} · ${
        manifest.summary?.resolvedSelectionCount ?? 0
      } approved/in-use selection(s) · Generated ${manifest.generatedAt}`,
    spec,
    specPath: spec.meta.sourcePath,
    providerId: spec.media?.provider || DEFAULT_ASSET_PROVIDER,
    fetchImpl,
    importPlaywrightImpl,
    baseForbiddenTerms: normalizeNeedles([
      ...spec.constraints.forbidden,
      ...spec.copyPolicy.forbidden,
      ...(spec.media?.slots ?? []).flatMap((slot) => slot.avoidTags ?? []),
    ]),
    approvedOnly,
    reuseFrom,
  });

  return {
    spec,
    ...result,
  };
};

export const generateStandaloneImageAssets = async ({
  purpose,
  orientation = "",
  color = "",
  style = "",
  mood = "",
  shot = "",
  people = "",
  copySafe = DEFAULT_COPY_SAFE,
  provider = DEFAULT_ASSET_PROVIDER,
  approvedOnly = false,
  reuseFrom = "",
  count = DEFAULT_ASSET_CANDIDATES,
  slug = "",
  outputDir = null,
  download = true,
  fetchImpl = globalThis.fetch,
  importPlaywrightImpl = importPlaywright,
} = {}) => {
  const normalizedPurpose = String(purpose ?? "").trim();
  if (!normalizedPurpose) {
    throw new Error("Purpose is required for standalone image requests.");
  }

  const safeSlug = sanitizeSegment(slug || normalizedPurpose) || "image-request";
  const resolvedOutputDir = outputDir || slugToImageRequestOutputDir(safeSlug);
  const safeCount = Math.max(1, Number(count) || DEFAULT_ASSET_CANDIDATES);
  const request = {
    mode: "standalone",
    purpose: normalizedPurpose,
    orientation,
    color,
    style,
    mood,
    shot,
    people,
    copySafe,
    provider,
    approvedOnly,
    reuseFrom,
    count: safeCount,
    slug: safeSlug,
    outputDir: resolvedOutputDir,
    download,
  };

  const result = await generateAssetBundle({
    slug: safeSlug,
    outputDir: resolvedOutputDir,
    slots: deriveStandaloneMediaSlots({
      purpose: normalizedPurpose,
      orientation,
      color,
      style,
      mood,
      shot,
      people,
      copySafe,
      count: safeCount,
    }),
    slotMode: "purpose",
    mode: "standalone",
    title: normalizedPurpose,
    eyebrow: "Stock-image request",
    summaryBuilder: (manifest) =>
      `${manifest.slots.length} search track(s) · ${
        manifest.download ? "cached top candidates" : "metadata-only board"
      } · Provider: ${manifest.provider} · Generated ${manifest.generatedAt}`,
    purpose: normalizedPurpose,
    request,
    providerId: provider,
    fetchImpl,
    importPlaywrightImpl,
    download,
    dedupeAcrossSlots: true,
    approvedOnly,
    reuseFrom,
  });

  return {
    request,
    ...result,
  };
};

export const selectAssetCandidate = async ({
  dir,
  slotId,
  candidateId = "",
  assetId = "",
  status = DEFAULT_SELECTION_STATUS,
  placement = "",
  treatment = "",
  objectPosition = "",
  opacity = null,
  cropVariant = DEFAULT_CROP_VARIANT,
  alt = "",
  reason = "",
  fetchImpl = globalThis.fetch,
} = {}) => {
  const manifest = await readJson(resolve(dir, "assets.json"));
  const selectionPath = resolve(dir, "asset-selection.json");
  const renderAssetsPath = resolve(dir, "render-assets.json");
  const registry = await loadAssetRegistry();
  const selectionDoc = await readJson(selectionPath).catch(() =>
    emptySelectionDoc({ manifest })
  );
  const match = findManifestCandidate({
    manifest,
    slotId,
    candidateId,
    assetId,
  });
  if (!match) {
    throw new Error(
      `No candidate found for slot "${slotId}" with ${
        assetId ? `assetId "${assetId}"` : `candidateId "${candidateId}"`
      }.`
    );
  }

  const asset = registry.assets[match.candidate.assetId] ?? null;
  if (
    !match.candidate.absoluteDownloadPath &&
    !asset?.downloadedVariants?.primary?.absolutePath &&
    match.candidate.remoteImageUrl
  ) {
    const cachedVariant = await ensureCachedAssetVariant({
      candidate: {
        provider: match.candidate.provider,
        assetId: match.candidate.assetId,
        externalId: match.candidate.externalId,
        downloadUrl: match.candidate.remoteImageUrl,
      },
      fetchImpl,
      registry,
      variantKey: "primary",
    });
    upsertRegistryAsset({
      registry,
      record: {
        ...(asset ?? {}),
        assetId: match.candidate.assetId,
        provider: match.candidate.provider,
        externalId: match.candidate.externalId,
        canonicalUrl: match.candidate.photoUrl,
        photographer: match.candidate.photographer,
        attribution: match.candidate.attribution ?? {},
        licenseClass: match.candidate.licenseClass,
        dimensions: {
          width: match.candidate.width,
          height: match.candidate.height,
        },
        avgColor: match.candidate.avgColor,
        alt: match.candidate.alt,
        downloadUrl: match.candidate.remoteImageUrl,
        downloadedVariants: {
          primary: cachedVariant,
        },
      },
    });
  }

  const nextDecision = {
    id: `${slotId}-${normalizeStatus(status, DEFAULT_SELECTION_STATUS)}`,
    slotId,
    assetId: match.candidate.assetId,
    candidateId: String(match.candidate.id),
    status: normalizeStatus(status, DEFAULT_SELECTION_STATUS),
    placement: placement || resolvePlacementForSlot(match.slot),
    treatment: treatment || resolveTreatmentForSlot(match.slot),
    objectPosition: objectPosition || resolveObjectPositionForSlot(match.slot),
    opacity: opacity ?? resolveOpacityForSlot(match.slot),
    cropVariant: cropVariant || DEFAULT_CROP_VARIANT,
    alt: alt || match.candidate.alt || "",
    reason: reason || "",
    photographer: match.candidate.photographer || "",
    photoUrl: match.candidate.photoUrl || "",
    src:
      match.candidate.relativeDownloadPath ||
      match.candidate.boardImageUrl ||
      match.candidate.remoteImageUrl ||
      "",
  };

  const withoutSlot = selectionDoc.decisions.filter((entry) => entry.slotId !== slotId);
  const hydrated = hydrateSelectionDoc({
    manifest,
    selectionDoc: {
      ...selectionDoc,
      decisions: [...withoutSlot, nextDecision],
    },
    registry,
  });
  const renderAssets = buildRenderAssetsDoc({
    manifest,
    selectionDoc: hydrated,
  });

  await writeJson(selectionPath, hydrated);
  await writeJson(renderAssetsPath, renderAssets);
  await syncRegistryDecisions({
    registry,
    decisions: hydrated.decisions,
    manifest,
  });

  return {
    manifest,
    selectionDoc: hydrated,
    renderAssets,
    selected: hydrated.decisions.find((entry) => entry.slotId === slotId) ?? null,
  };
};

export const applySelectedAssets = async ({
  specPath,
  outputDir = null,
} = {}) => {
  const spec = await loadFigureSpec(specPath);
  const paths = getOutputPaths({
    slug: spec.meta.slug,
    outputDir,
  });
  const manifest = await readJson(paths.assetsManifestPath);
  const selectionDoc = await readJson(paths.assetSelectionPath);
  const registry = await loadAssetRegistry();
  const hydrated = hydrateSelectionDoc({
    manifest,
    selectionDoc,
    registry,
  });

  const approvedBySlot = new Map(
    hydrated.decisions
      .filter((entry) => ["approved", "in_use"].includes(entry.status))
      .map((entry) => [entry.slotId, entry])
  );

  const nextSpec = normalizeFigureSpec({
    ...spec,
    media: {
      ...spec.media,
      slots: (spec.media?.slots ?? []).map((slot) => {
        const decision = approvedBySlot.get(slot.id);
        if (!decision) {
          return slot;
        }
        return {
          ...slot,
          selectedAssetRef: {
            assetId: decision.assetId,
            candidateId: decision.candidateId,
            status: "in_use",
            placement: decision.placement,
            treatment: decision.treatment,
            objectPosition: decision.objectPosition,
            cropVariant: decision.cropVariant,
            opacity: decision.opacity,
            alt: decision.alt,
          },
        };
      }),
    },
  });

  await writeJson(specPath, nextSpec);
  const nextSelectionDoc = {
    ...hydrated,
    decisions: hydrated.decisions.map((entry) =>
      approvedBySlot.has(entry.slotId)
        ? {
            ...entry,
            status: "in_use",
          }
        : entry
    ),
  };
  const renderAssets = buildRenderAssetsDoc({
    manifest,
    selectionDoc: nextSelectionDoc,
    spec: nextSpec,
  });
  await writeJson(paths.assetSelectionPath, nextSelectionDoc);
  await writeJson(paths.renderAssetsPath, renderAssets);
  await syncRegistryDecisions({
    registry,
    decisions: nextSelectionDoc.decisions,
    manifest: {
      ...manifest,
      deckId: nextSpec.meta.deckId,
      slug: nextSpec.meta.slug,
    },
  });

  return {
    spec: nextSpec,
    paths,
    selectionDoc: nextSelectionDoc,
    renderAssets,
  };
};

export const refineImageRequest = async ({
  dir,
  purpose = "",
  orientation = "",
  color = "",
  style = "",
  mood = "",
  shot = "",
  people = "",
  copySafe = "",
  provider = "",
  approvedOnly = null,
  reuseFrom = "",
  count = null,
  download = null,
  fetchImpl = globalThis.fetch,
  importPlaywrightImpl = importPlaywright,
} = {}) => {
  const manifest = await readJson(resolve(dir, "assets.json"));
  if (manifest.mode === "standalone") {
    const request = manifest.request ?? {};
    return generateStandaloneImageAssets({
      purpose: purpose || request.purpose || manifest.purpose,
      orientation: orientation || request.orientation || "",
      color: color || request.color || "",
      style: style || request.style || "",
      mood: mood || request.mood || "",
      shot: shot || request.shot || "",
      people: people || request.people || "",
      copySafe: copySafe || request.copySafe || DEFAULT_COPY_SAFE,
      provider: provider || request.provider || manifest.provider || DEFAULT_ASSET_PROVIDER,
      approvedOnly: approvedOnly ?? Boolean(request.approvedOnly),
      reuseFrom: reuseFrom || request.reuseFrom || "",
      count: count ?? request.count ?? DEFAULT_ASSET_CANDIDATES,
      slug: request.slug || manifest.slug,
      outputDir: dir,
      download: download ?? Boolean(request.download ?? manifest.download),
      fetchImpl,
      importPlaywrightImpl,
    });
  }

  if (manifest.mode === "figure" && manifest.specPath) {
    return generateFigureAssets({
      specPath: manifest.specPath,
      outputDir: dir,
      fetchImpl,
      importPlaywrightImpl,
      approvedOnly: approvedOnly ?? false,
      reuseFrom: reuseFrom || "",
    });
  }

  throw new Error(`Cannot refine asset request in ${dir}. Missing supported manifest context.`);
};

export const buildAssetReport = async ({
  dir = "",
} = {}) => {
  const registry = await loadAssetRegistry();
  const assets = Object.values(registry.assets);
  const statusCounts = assets.reduce((totals, asset) => {
    const key = normalizeStatus(asset.status, "discovered");
    totals[key] = (totals[key] ?? 0) + 1;
    return totals;
  }, {});
  const rejectedReasons = assets
    .flatMap((asset) => asset.rejectionReasons ?? [])
    .filter(Boolean)
    .reduce((totals, reason) => {
      totals[reason] = (totals[reason] ?? 0) + 1;
      return totals;
    }, {});
  const topReused = [...assets]
    .map((asset) => ({
      assetId: asset.assetId,
      photographer: asset.photographer,
      alt: asset.alt,
      uses: (asset.approvedUses ?? []).length,
      status: asset.status,
    }))
    .sort((left, right) => right.uses - left.uses)
    .slice(0, 10);

  const report = {
    generatedAt: new Date().toISOString(),
    registryPath: getAssetRegistryPath(),
    totalAssets: assets.length,
    statusCounts,
    rejectedReasons,
    topReused,
  };

  if (dir) {
    const manifest = await readJson(resolve(dir, "assets.json"));
    const selectionDoc = await readJson(resolve(dir, "asset-selection.json")).catch(
      () => ({ decisions: [] })
    );
    report.request = {
      slug: manifest.slug,
      mode: manifest.mode,
      provider: manifest.provider,
      slotCount: manifest.slots?.length ?? 0,
      approvedSelections: (selectionDoc.decisions ?? []).filter((entry) =>
        ["approved", "in_use"].includes(entry.status)
      ).length,
      rejectedSelections: (selectionDoc.decisions ?? []).filter(
        (entry) => entry.status === "rejected"
      ).length,
    };
  }

  return report;
};

export const maybeGenerateFigureAssets = async ({
  specPath,
  outputDir = null,
  logger = console,
} = {}) => {
  try {
    return await generateFigureAssets({ specPath, outputDir });
  } catch (error) {
    if (logger && typeof logger.warn === "function") {
      logger.warn(
        `Asset search skipped for ${specPath}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    return null;
  }
};
