import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { getActiveDeckSlides } from "./read-deck-spec.mjs";
import {
  classifyPathReference,
  normalizeRepoRelativePath,
  toRepoRelativePath,
} from "./path-normalize.mjs";

const CITE_MARKER_RE = /\[(\d+)\]/g;

const buildRef = (
  repoRoot,
  pathLike,
  provenance = "canonical-human-authored",
  label = null
) => {
  if (!pathLike) {
    return null;
  }

  const classified = classifyPathReference(repoRoot, pathLike);
  if (classified.kind === "repo-relative") {
    return {
      path: classified.repoRelativePath,
      absolutePath: classified.absolutePath,
      exists: existsSync(classified.absolutePath),
      provenance,
      canonicalNavigation: true,
      label,
    };
  }

  if (classified.kind === "external-stale") {
    return {
      path: String(pathLike),
      absolutePath: null,
      exists: false,
      provenance: "external-stale",
      canonicalNavigation: false,
      label,
    };
  }

  return null;
};

const normalizeStringArray = (value) =>
  Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];

const normalizeNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const sortByDisplayOrder = (slides, activeSequence = []) => {
  const position = new Map(
    (Array.isArray(activeSequence) ? activeSequence : []).map((displayNumber, index) => [
      String(displayNumber),
      index,
    ])
  );

  return [...slides].sort((left, right) => {
    const leftPos = position.has(String(left.displayNumber))
      ? position.get(String(left.displayNumber))
      : Number.POSITIVE_INFINITY;
    const rightPos = position.has(String(right.displayNumber))
      ? position.get(String(right.displayNumber))
      : Number.POSITIVE_INFINITY;
    if (leftPos !== rightPos) {
      return leftPos - rightPos;
    }

    const leftDisplay = Number(left.displayNumber);
    const rightDisplay = Number(right.displayNumber);
    if (Number.isFinite(leftDisplay) && Number.isFinite(rightDisplay)) {
      return leftDisplay - rightDisplay;
    }

    return String(left.displayNumber).localeCompare(String(right.displayNumber));
  });
};

const normalizeFileEntries = (repoRoot, entries, provenance) =>
  (Array.isArray(entries) ? entries : [])
    .map((entry) => {
      const ref = buildRef(repoRoot, entry?.path, provenance, entry?.label ?? null);
      if (!ref) {
        return null;
      }

      return {
        label: entry?.label ? String(entry.label) : null,
        ref,
      };
    })
    .filter(Boolean);

const normalizeReferenceRecord = (repoRoot, reference, provenance) => ({
  id: String(reference?.id ?? "").trim(),
  label: String(reference?.label ?? reference?.id ?? "").trim(),
  status: reference?.status === "archived" ? "archived" : "active",
  sourceType: reference?.sourceType ? String(reference.sourceType).trim() : null,
  citationText: String(reference?.citationText ?? "").trim(),
  url: reference?.url ? String(reference.url).trim() : null,
  files: normalizeFileEntries(repoRoot, reference?.files, provenance),
  summary: reference?.summary ? String(reference.summary).trim() : null,
  tags: normalizeStringArray(reference?.tags),
  notes: normalizeStringArray(reference?.notes),
  sourceKeys: normalizeStringArray(reference?.sourceKeys),
});

const normalizeUsageRecord = (usage) => ({
  id: String(usage?.id ?? "").trim(),
  referenceId: String(usage?.referenceId ?? "").trim(),
  slideId: String(usage?.slideId ?? "").trim(),
  claim: String(usage?.claim ?? "").trim(),
  placement: usage?.placement ? String(usage.placement).trim() : "proof",
  status: usage?.status === "archived" ? "archived" : "current",
  sortKey: normalizeNumber(usage?.sortKey),
});

const dedupeWarnings = (warnings) => {
  const seen = new Set();
  const out = [];
  for (const warning of warnings) {
    if (!warning?.code) {
      continue;
    }
    const key = [
      warning.code,
      warning.slideId ?? "",
      warning.referenceId ?? "",
      warning.usageId ?? "",
      warning.message ?? "",
    ].join("::");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(warning);
  }
  return out;
};

const findDuplicates = (values) => {
  const counts = new Map();
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (!normalized) {
      continue;
    }
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value);
};

const compareUsages = (left, right) => {
  const leftSort = left.sortKey ?? Number.POSITIVE_INFINITY;
  const rightSort = right.sortKey ?? Number.POSITIVE_INFINITY;
  if (leftSort !== rightSort) {
    return leftSort - rightSort;
  }
  return left.id.localeCompare(right.id);
};

const extractCitationMarkers = (proofLines) => {
  const markers = [];
  for (const line of Array.isArray(proofLines) ? proofLines : []) {
    const text = String(line ?? "");
    let match = null;
    while ((match = CITE_MARKER_RE.exec(text))) {
      markers.push(match[1]);
    }
    CITE_MARKER_RE.lastIndex = 0;
  }
  return [...new Set(markers)];
};

export const getProjectReferencesLayout = ({ projectRoot } = {}) => {
  const referencesDir = resolve(projectRoot, "references");
  const generatedDir = resolve(referencesDir, "generated");
  return {
    referencesDir,
    manifestPath: resolve(referencesDir, "manifest.json"),
    templatePath: resolve(referencesDir, "vox-design-system-reference.html"),
    generatedDir,
    generatedJsonPath: resolve(generatedDir, "running-references.json"),
    generatedMarkdownPath: resolve(generatedDir, "running-references.md"),
    generatedAppendixHtmlPath: resolve(generatedDir, "references-appendix.html"),
  };
};

export const createEmptyReferencesManifest = (projectId) => ({
  manifestVersion: 1,
  projectId,
  kind: "deck-references",
  references: [],
  usages: [],
});

export const readCanonicalReferencesManifest = ({
  repoRoot,
  manifestPath,
  provenance = "canonical-human-authored",
  projectId = null,
} = {}) => {
  const manifest = buildRef(repoRoot, manifestPath, provenance, "References Manifest");
  if (!manifest?.absolutePath || !manifest.exists) {
    return {
      manifest,
      manifestVersion: 1,
      projectId,
      kind: "deck-references",
      references: [],
      usages: [],
    };
  }

  const payload = JSON.parse(readFileSync(manifest.absolutePath, "utf8"));
  return {
    manifest,
    manifestVersion: Number(payload?.manifestVersion ?? 1),
    projectId: payload?.projectId ? String(payload.projectId) : projectId,
    kind: payload?.kind ? String(payload.kind) : "deck-references",
    references: (Array.isArray(payload?.references) ? payload.references : [])
      .map((reference) => normalizeReferenceRecord(repoRoot, reference, provenance))
      .filter((reference) => reference.id && reference.label && reference.citationText),
    usages: (Array.isArray(payload?.usages) ? payload.usages : [])
      .map(normalizeUsageRecord)
      .filter((usage) => usage.id && usage.referenceId && usage.slideId),
  };
};

const buildUsageView = ({
  usage,
  reference,
  appendixNumber = null,
  slideTitle = null,
  displayNumber = null,
}) => ({
  id: usage.id,
  referenceId: usage.referenceId,
  slideId: usage.slideId,
  slideTitle,
  displayNumber,
  claim: usage.claim,
  placement: usage.placement,
  status: usage.status,
  sortKey: usage.sortKey,
  appendixNumber,
  reference,
});

export const compileProjectReferences = ({
  repoRoot,
  projectRoot,
  deckSpec,
  generatedAt = new Date().toISOString(),
} = {}) => {
  const layout = getProjectReferencesLayout({ projectRoot });
  const manifestData = readCanonicalReferencesManifest({
    repoRoot,
    manifestPath: layout.manifestPath,
    projectId: deckSpec?.deckId ? String(deckSpec.deckId) : null,
  });

  const template = buildRef(
    repoRoot,
    layout.templatePath,
    "canonical-human-authored",
    "Reference Slide Template"
  );
  const generated = {
    dir: buildRef(repoRoot, layout.generatedDir, "checked-in-generated", "Generated References"),
    json: buildRef(
      repoRoot,
      layout.generatedJsonPath,
      "checked-in-generated",
      "Running References JSON"
    ),
    markdown: buildRef(
      repoRoot,
      layout.generatedMarkdownPath,
      "checked-in-generated",
      "Running References Markdown"
    ),
    appendixHtml: buildRef(
      repoRoot,
      layout.generatedAppendixHtmlPath,
      "checked-in-generated",
      "References Appendix HTML"
    ),
  };

  const allSlides = Array.isArray(deckSpec?.slides) ? deckSpec.slides : [];
  const allSlidesById = new Map(allSlides.map((slide) => [String(slide.id), slide]));
  const activeSlides = sortByDisplayOrder(
    getActiveDeckSlides(deckSpec),
    deckSpec?.numberingPolicy?.activeSequence
  );
  const activeSlideById = new Map(activeSlides.map((slide) => [String(slide.id), slide]));

  const warnings = [];
  const duplicateReferenceIds = findDuplicates(manifestData.references.map((reference) => reference.id));
  if (duplicateReferenceIds.length > 0) {
    warnings.push({
      code: "reference-duplicate-id",
      message: `Duplicate reference ids found: ${duplicateReferenceIds.join(", ")}.`,
      severity: "error",
    });
  }

  const duplicateUsageIds = findDuplicates(manifestData.usages.map((usage) => usage.id));
  if (duplicateUsageIds.length > 0) {
    warnings.push({
      code: "reference-usage-duplicate-id",
      message: `Duplicate reference usage ids found: ${duplicateUsageIds.join(", ")}.`,
      severity: "error",
    });
  }

  const referenceById = new Map();
  for (const reference of manifestData.references) {
    if (!referenceById.has(reference.id)) {
      referenceById.set(reference.id, reference);
    }
  }

  const usagesBySlide = new Map();
  for (const usage of manifestData.usages) {
    const slideList = usagesBySlide.get(usage.slideId) ?? [];
    slideList.push(usage);
    usagesBySlide.set(usage.slideId, slideList);

    if (!allSlidesById.has(usage.slideId)) {
      warnings.push({
        code: "reference-usage-unknown-slide",
        message: `Reference usage "${usage.id}" points to unknown slide "${usage.slideId}".`,
        severity: "warning",
        usageId: usage.id,
        slideId: usage.slideId,
      });
    }

    if (!referenceById.has(usage.referenceId)) {
      warnings.push({
        code: "reference-usage-unknown-reference",
        message: `Reference usage "${usage.id}" points to unknown reference "${usage.referenceId}".`,
        severity: "warning",
        usageId: usage.id,
        referenceId: usage.referenceId,
        slideId: usage.slideId,
      });
    }
  }

  const runningByReferenceId = new Map();
  let appendixNumber = 1;

  for (const slide of activeSlides) {
    const currentUsages = (usagesBySlide.get(slide.id) ?? [])
      .filter((usage) => usage.status === "current")
      .sort(compareUsages);

    for (const usage of currentUsages) {
      const reference = referenceById.get(usage.referenceId);
      if (!reference) {
        continue;
      }

      const existing = runningByReferenceId.get(reference.id);
      if (existing) {
        existing.slideIds = [...new Set([...existing.slideIds, slide.id])];
        existing.displayNumbers = [...new Set([...existing.displayNumbers, String(slide.displayNumber)])];
        existing.usages.push(
          buildUsageView({
            usage,
            reference,
            appendixNumber: existing.appendixNumber,
            slideTitle: slide.title ?? "",
            displayNumber: String(slide.displayNumber ?? ""),
          })
        );
        continue;
      }

      runningByReferenceId.set(reference.id, {
        appendixNumber,
        referenceId: reference.id,
        reference,
        firstSeenSlideId: slide.id,
        firstSeenDisplayNumber: String(slide.displayNumber ?? ""),
        slideIds: [slide.id],
        displayNumbers: [String(slide.displayNumber ?? "")],
        usages: [
          buildUsageView({
            usage,
            reference,
            appendixNumber,
            slideTitle: slide.title ?? "",
            displayNumber: String(slide.displayNumber ?? ""),
          }),
        ],
      });
      appendixNumber += 1;
    }
  }

  const running = [...runningByReferenceId.values()];
  const runningNumberByReferenceId = new Map(
    running.map((entry) => [entry.referenceId, entry.appendixNumber])
  );

  const slides = allSlides.map((slide) => {
    const usages = [...(usagesBySlide.get(slide.id) ?? [])].sort(compareUsages);
    const current = [];
    const archived = [];
    const proofCitationKeys = extractCitationMarkers(slide.proof);

    for (const usage of usages) {
      const reference = referenceById.get(usage.referenceId) ?? null;
      const view = buildUsageView({
        usage,
        reference,
        appendixNumber: runningNumberByReferenceId.get(usage.referenceId) ?? null,
        slideTitle: slide.title ?? "",
        displayNumber: String(slide.displayNumber ?? ""),
      });

      if (usage.status === "archived") {
        archived.push(view);
      } else {
        current.push(view);
      }
    }

    const matchedSourceKeys = new Set(
      current.flatMap((usage) => usage.reference?.sourceKeys ?? [])
    );
    const missingCitationKeys = proofCitationKeys.filter((key) => !matchedSourceKeys.has(key));

    if (proofCitationKeys.length > 0 && current.length === 0) {
      warnings.push({
        code: "reference-proof-untracked",
        message: `Slide ${slide.displayNumber} has citation markers in proof text but no linked references.`,
        severity: "warning",
        slideId: slide.id,
        displayNumber: String(slide.displayNumber ?? ""),
      });
    } else if (missingCitationKeys.length > 0) {
      warnings.push({
        code: "reference-proof-marker-missing",
        message: `Slide ${slide.displayNumber} is missing linked references for citation markers: ${missingCitationKeys.join(
          ", "
        )}.`,
        severity: "warning",
        slideId: slide.id,
        displayNumber: String(slide.displayNumber ?? ""),
      });
    }

    return {
      slideId: slide.id,
      displayNumber: String(slide.displayNumber ?? ""),
      title: slide.title ?? "",
      status: slide.status === "deprecated" ? "deprecated" : "active",
      proofCitationKeys,
      missingCitationKeys,
      current,
      archived,
    };
  });

  for (const usage of manifestData.usages) {
    if (usage.status !== "current") {
      continue;
    }

    if (!activeSlideById.has(usage.slideId)) {
      warnings.push({
        code: "reference-usage-not-running",
        message: `Current reference usage "${usage.id}" is linked to non-running slide "${usage.slideId}".`,
        severity: "info",
        usageId: usage.id,
        slideId: usage.slideId,
        referenceId: usage.referenceId,
      });
    }
  }

  return {
    manifest: manifestData.manifest,
    template,
    generated,
    manifestVersion: manifestData.manifestVersion,
    projectId:
      manifestData.projectId ?? (deckSpec?.deckId ? String(deckSpec.deckId) : null),
    kind: manifestData.kind,
    library: manifestData.references,
    usages: manifestData.usages,
    running,
    slides,
    warnings: dedupeWarnings(warnings),
    stats: {
      libraryCount: manifestData.references.length,
      usageCount: manifestData.usages.length,
      currentUsageCount: manifestData.usages.filter((usage) => usage.status === "current").length,
      runningCount: running.length,
      activeSlideCountWithReferences: slides.filter(
        (slide) => slide.status === "active" && slide.current.length > 0
      ).length,
    },
    layout,
    generatedAt,
  };
};

export const buildProjectReferencesJson = ({ compiled, projectTitle }) => ({
  projectId: compiled.projectId,
  projectTitle,
  generatedAt: compiled.generatedAt,
  manifestPath: compiled.manifest?.path ?? null,
  templatePath: compiled.template?.path ?? null,
  stats: compiled.stats,
  warnings: compiled.warnings,
  runningReferences: compiled.running.map((entry) => ({
    appendixNumber: entry.appendixNumber,
    referenceId: entry.referenceId,
    label: entry.reference.label,
    citationText: entry.reference.citationText,
    sourceType: entry.reference.sourceType,
    url: entry.reference.url,
    summary: entry.reference.summary,
    tags: entry.reference.tags,
    firstSeenSlideId: entry.firstSeenSlideId,
    firstSeenDisplayNumber: entry.firstSeenDisplayNumber,
    slideIds: entry.slideIds,
    displayNumbers: entry.displayNumbers,
    usages: entry.usages.map((usage) => ({
      id: usage.id,
      slideId: usage.slideId,
      displayNumber: usage.displayNumber,
      placement: usage.placement,
      claim: usage.claim,
    })),
  })),
  slides: compiled.slides.map((slide) => ({
    slideId: slide.slideId,
    displayNumber: slide.displayNumber,
    title: slide.title,
    proofCitationKeys: slide.proofCitationKeys,
    missingCitationKeys: slide.missingCitationKeys,
    currentReferences: slide.current.map((usage) => ({
      usageId: usage.id,
      appendixNumber: usage.appendixNumber,
      placement: usage.placement,
      claim: usage.claim,
      referenceId: usage.referenceId,
      label: usage.reference?.label ?? null,
      citationText: usage.reference?.citationText ?? null,
    })),
  })),
});

const wrapMarkdownText = (text, width = 78) => {
  const words = String(text ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [""];
  }

  const lines = [];
  let current = words.shift() ?? "";
  for (const word of words) {
    if (`${current} ${word}`.length > width) {
      lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`;
    }
  }
  lines.push(current);
  return lines;
};

const pushWrappedMarkdown = (lines, prefix, text, continuationPrefix = prefix) => {
  const words = String(text ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    lines.push(prefix.trimEnd());
    return;
  }

  const firstWidth = Math.max(20, 78 - prefix.length);
  const continuationWidth = Math.max(20, 78 - continuationPrefix.length);
  let currentPrefix = prefix;
  let currentWidth = firstWidth;
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }

    if (`${current} ${word}`.length > currentWidth) {
      lines.push(`${currentPrefix}${current}`);
      currentPrefix = continuationPrefix;
      currentWidth = continuationWidth;
      current = word;
    } else {
      current = `${current} ${word}`;
    }
  }

  lines.push(`${currentPrefix}${current}`);
};

export const renderRunningReferencesMarkdown = ({ compiled, projectTitle }) => {
  const lines = [
    `# ${projectTitle} Running References`,
    "",
    `- Generated: ${compiled.generatedAt}`,
    `- Manifest: \`${compiled.manifest?.path ?? "missing"}\``,
    `- Running references: ${compiled.running.length}`,
    "",
    "## By Slide",
    "",
  ];

  for (const slide of compiled.slides.filter((entry) => entry.status === "active")) {
    lines.push(`### Slide ${slide.displayNumber}`);
    lines.push("");
    pushWrappedMarkdown(lines, "", slide.title);
    lines.push("");
    if (slide.current.length === 0) {
      lines.push("_No current linked references._");
      lines.push("");
      continue;
    }

    for (const usage of slide.current) {
      lines.push(`- [${usage.appendixNumber ?? "?"}] ${usage.reference?.label ?? "Missing reference"}`);
      pushWrappedMarkdown(
        lines,
        "  Citation: ",
        usage.reference?.citationText ?? "Missing reference."
      );
      pushWrappedMarkdown(lines, "  Claim: ", usage.claim || "Not specified.");
      pushWrappedMarkdown(lines, "  Placement: ", usage.placement || "proof");
    }
    lines.push("");
  }

  lines.push("## Running Appendix", "");
  for (const entry of compiled.running) {
    const slideLabel = entry.displayNumbers
      .map((displayNumber) => `Slide ${displayNumber}`)
      .join(", ");
    pushWrappedMarkdown(
      lines,
      `${entry.appendixNumber}. `,
      entry.reference.citationText,
      "   "
    );
    pushWrappedMarkdown(lines, "   Used on: ", slideLabel);
    lines.push("");
  }

  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return `${lines.join("\n")}\n`;
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const renderSlideBadges = (entry) =>
  entry.displayNumbers
    .map(
      (displayNumber) => `<span class="slide-badge">Slide ${escapeHtml(displayNumber)}</span>`
    )
    .join("");

const paginateRunningReferences = (running) => {
  const pages = [];
  let currentPage = [];
  let currentWeight = 0;
  const maxWeight = 8;

  for (const entry of running) {
    const weight =
      1 +
      Math.max(0, Math.ceil(String(entry.reference.citationText ?? "").length / 180) - 1);

    if (currentPage.length > 0 && currentWeight + weight > maxWeight) {
      pages.push(currentPage);
      currentPage = [];
      currentWeight = 0;
    }

    currentPage.push(entry);
    currentWeight += weight;
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages.length > 0 ? pages : [[]];
};

export const renderReferenceAppendixHtml = ({ compiled, projectTitle }) => {
  const pages = paginateRunningReferences(compiled.running);
  const pageMarkup = pages
    .map((entries, pageIndex) => {
      const cards = entries
        .map(
          (entry) => `
            <article class="reference-card">
              <div class="reference-card-head">
                <span class="reference-index">${String(entry.appendixNumber).padStart(2, "0")}</span>
                <div class="reference-meta">
                  <p class="reference-label">${escapeHtml(entry.reference.label)}</p>
                  <div class="reference-slides">${renderSlideBadges(entry)}</div>
                </div>
              </div>
              <p class="reference-citation">${escapeHtml(entry.reference.citationText)}</p>
              ${
                entry.reference.url
                  ? `<p class="reference-url"><a href="${escapeHtml(entry.reference.url)}">${escapeHtml(
                      entry.reference.url
                    )}</a></p>`
                  : ""
              }
            </article>
          `
        )
        .join("");

      return `
        <section class="slide-page">
          <div class="slide-shell">
            <header class="slide-header">
              <div>
                <p class="slide-kicker">Appendix</p>
                <h1>${pageIndex === 0 ? "References" : "References (cont.)"}</h1>
              </div>
              <div class="slide-header-meta">
                <p>${escapeHtml(projectTitle)}</p>
                <p>Current running references</p>
              </div>
            </header>
            <div class="reference-list">${cards}</div>
            <footer class="slide-footer">
              <span>Generated from ${escapeHtml(compiled.manifest?.path ?? "manifest.json")}</span>
              <span>${pageIndex + 1} / ${pages.length}</span>
            </footer>
          </div>
        </section>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(projectTitle)} References Appendix</title>
    <link
      href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap"
      rel="stylesheet"
    />
    <style>
      :root {
        --bg: #f1f5f9;
        --card: #ffffff;
        --ink: #0f172a;
        --ink-soft: #475569;
        --line: #e2e8f0;
        --accent: #0f766e;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: "Montserrat", "Avenir Next", "Helvetica Neue", Arial, sans-serif;
        background: var(--bg);
        color: var(--ink);
      }

      .slide-page {
        width: 1920px;
        height: 1080px;
        margin: 0 auto;
        padding: 48px;
        background:
          radial-gradient(circle at top left, rgba(15, 118, 110, 0.08), transparent 38%),
          linear-gradient(180deg, #f8fbfd 0%, var(--bg) 100%);
      }

      .slide-shell {
        height: 100%;
        display: grid;
        grid-template-rows: auto 1fr auto;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.84);
        border-radius: 24px;
        padding: 54px 62px 34px;
      }

      .slide-header,
      .slide-footer,
      .reference-card-head {
        display: flex;
        justify-content: space-between;
        gap: 24px;
      }

      .slide-header {
        align-items: end;
        border-bottom: 2px solid var(--line);
        padding-bottom: 22px;
      }

      .slide-kicker {
        margin: 0 0 10px;
        font-size: 12px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        font-weight: 700;
        color: var(--accent);
      }

      h1 {
        margin: 0;
        font-size: 52px;
        line-height: 0.95;
        letter-spacing: -0.04em;
      }

      .slide-header-meta {
        text-align: right;
        font-size: 16px;
        font-weight: 500;
        color: var(--ink-soft);
      }

      .slide-header-meta p,
      .reference-label,
      .reference-citation,
      .reference-url,
      .slide-footer {
        margin: 0;
      }

      .reference-list {
        display: grid;
        gap: 18px;
        align-content: start;
        padding: 28px 0 18px;
      }

      .reference-card {
        border: 1px solid var(--line);
        border-radius: 18px;
        background: var(--card);
        padding: 22px 24px;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
      }

      .reference-index {
        flex: 0 0 auto;
        width: 54px;
        height: 54px;
        border-radius: 14px;
        background: rgba(15, 118, 110, 0.12);
        color: var(--accent);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
        font-weight: 800;
      }

      .reference-meta {
        display: grid;
        gap: 10px;
        flex: 1;
      }

      .reference-label {
        font-size: 14px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-weight: 700;
        color: var(--ink-soft);
      }

      .reference-slides {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .slide-badge {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: rgba(15, 118, 110, 0.08);
        color: var(--accent);
        font-size: 12px;
        font-weight: 700;
        padding: 6px 10px;
      }

      .reference-citation {
        margin-top: 16px;
        font-size: 23px;
        line-height: 1.45;
        letter-spacing: -0.02em;
      }

      .reference-url {
        margin-top: 12px;
        font-size: 14px;
        color: var(--ink-soft);
        word-break: break-all;
      }

      .reference-url a {
        color: inherit;
        text-decoration: none;
      }

      .slide-footer {
        align-items: center;
        font-size: 14px;
        color: var(--ink-soft);
        border-top: 2px solid var(--line);
        padding-top: 18px;
      }
    </style>
  </head>
  <body>
    ${pageMarkup}
  </body>
</html>
`;
};

export const buildProjectReferenceArtifacts = ({ compiled, projectTitle }) => {
  const json = `${JSON.stringify(
    buildProjectReferencesJson({ compiled, projectTitle }),
    null,
    2
  )}\n`;
  const markdown = renderRunningReferencesMarkdown({ compiled, projectTitle });
  const appendixHtml = renderReferenceAppendixHtml({ compiled, projectTitle });

  return {
    json,
    markdown,
    appendixHtml,
  };
};

export const writeProjectReferenceArtifacts = async ({
  repoRoot,
  projectRoot,
  deckSpec,
  generatedAt = new Date().toISOString(),
} = {}) => {
  const compiled = compileProjectReferences({
    repoRoot,
    projectRoot,
    deckSpec,
    generatedAt,
  });
  const projectTitle = String(deckSpec?.title ?? compiled.projectId ?? "Project");
  const artifacts = buildProjectReferenceArtifacts({
    compiled,
    projectTitle,
  });

  await mkdir(compiled.layout.generatedDir, { recursive: true });
  await writeFile(compiled.layout.generatedJsonPath, artifacts.json, "utf8");
  await writeFile(compiled.layout.generatedMarkdownPath, artifacts.markdown, "utf8");
  await writeFile(compiled.layout.generatedAppendixHtmlPath, artifacts.appendixHtml, "utf8");

  return {
    compiled,
    artifacts,
    manifestPath: normalizeRepoRelativePath(toRepoRelativePath(repoRoot, compiled.layout.manifestPath)),
    generatedPaths: {
      json: normalizeRepoRelativePath(
        toRepoRelativePath(repoRoot, compiled.layout.generatedJsonPath)
      ),
      markdown: normalizeRepoRelativePath(
        toRepoRelativePath(repoRoot, compiled.layout.generatedMarkdownPath)
      ),
      appendixHtml: normalizeRepoRelativePath(
        toRepoRelativePath(repoRoot, compiled.layout.generatedAppendixHtmlPath)
      ),
    },
  };
};
