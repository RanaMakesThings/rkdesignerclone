#!/usr/bin/env node

import { readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, relative, resolve } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import {
  getProjectedRootArtifactPaths,
  getSlideNotesDir,
  getSlideReportPath,
  readSlideManifest,
} from "./lib/slide-versioning.mjs";

const require = createRequire(import.meta.url);

const requireDep = (name, hint) => {
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    return require(name);
  } catch (_error) {
    console.error(`\nMissing dependency: ${name}`);
    if (hint) {
      console.error(hint);
    }
    console.error("Run: npm install\n");
    process.exit(1);
  }
};

const yargs = requireDep("yargs/yargs", "Needed for CLI argument parsing.");
const { hideBin } = requireDep("yargs/helpers", "Needed for CLI argument parsing.");

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderInline = (value) =>
  escapeHtml(value)
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer">$1</a>'
    )
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

const toFileHref = (filePath) => pathToFileURL(filePath).href;

const relativeHref = (fromPath, toPath) => {
  const rel = relative(resolve(fromPath, ".."), toPath);
  return rel || ".";
};

const markdownToHtml = (markdown) => {
  const lines = String(markdown ?? "").replace(/\r\n/g, "\n").split("\n");
  const chunks = [];
  let inCode = false;
  let codeLines = [];
  let listType = null;
  let listItems = [];
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return;
    }
    chunks.push(`<p>${renderInline(paragraph.join(" ").trim())}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!listType || listItems.length === 0) {
      listType = null;
      listItems = [];
      return;
    }
    chunks.push(
      `<${listType}>${listItems
        .map((item) => `<li>${renderInline(item.trim())}</li>`)
        .join("")}</${listType}>`
    );
    listType = null;
    listItems = [];
  };

  const flushCode = () => {
    if (!inCode) {
      return;
    }
    chunks.push(
      `<pre><code>${escapeHtml(codeLines.join("\n")).trimEnd()}</code></pre>`
    );
    inCode = false;
    codeLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, "  ");
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      flushParagraph();
      flushList();
      if (inCode) {
        flushCode();
      } else {
        inCode = true;
        codeLines = [];
      }
      continue;
    }

    if (inCode) {
      codeLines.push(rawLine);
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = Math.min(headingMatch[1].length + 1, 6);
      chunks.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    const unorderedMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (unorderedMatch) {
      flushParagraph();
      if (listType && listType !== "ul") {
        flushList();
      }
      listType = "ul";
      listItems.push(unorderedMatch[1]);
      continue;
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      if (listType && listType !== "ol") {
        flushList();
      }
      listType = "ol";
      listItems.push(orderedMatch[1]);
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  flushCode();

  return chunks.join("\n");
};

const readTextMaybe = async (filePath) => {
  if (!filePath || !existsSync(filePath)) {
    return null;
  }
  return readFile(filePath, "utf8");
};

const readJsonMaybe = async (filePath) => {
  const text = await readTextMaybe(filePath);
  if (!text) {
    return null;
  }
  return JSON.parse(text);
};

const findPrefixedFile = async (dir, prefix, extension) => {
  if (!existsSync(dir)) {
    return null;
  }
  const entries = await readdir(dir, { withFileTypes: true });
  const matches = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.startsWith(prefix) &&
        entry.name.endsWith(extension)
    )
    .map((entry) => resolve(dir, entry.name))
    .sort();
  return matches.at(-1) ?? null;
};

const findAllPrefixedFiles = async (dir, prefix, extension) => {
  if (!existsSync(dir)) {
    return [];
  }
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.startsWith(prefix) &&
        entry.name.endsWith(extension)
    )
    .map((entry) => resolve(dir, entry.name))
    .sort();
};

const extractSection = (markdown, headingPrefix, nextHeadingPrefix) => {
  const pattern = new RegExp(
    `^${headingPrefix}[\\s\\S]*?(?=^${nextHeadingPrefix}|\\Z)`,
    "m"
  );
  const match = String(markdown ?? "").match(pattern);
  return match ? match[0].trim() : "";
};

const extractSlideSection = (markdown, slideNumber) =>
  extractSection(
    markdown,
    `## Slide ${slideNumber} —`,
    "## Slide \\d+ —|## References"
  );

const extractLegacySlideSection = (markdown, slideNumber) =>
  extractSection(markdown, `## Slide ${slideNumber}`, "## Slide \\d+|## References");

const extractMarkdownSectionByHeading = (markdown, heading, nextHeadings = []) => {
  const lines = String(markdown ?? "").replace(/\r\n/g, "\n").split("\n");
  const startIndex = lines.findIndex((line) => line.trim() === heading);
  if (startIndex === -1) {
    return "";
  }

  let endIndex = lines.length;
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (nextHeadings.includes(trimmed)) {
      endIndex = index;
      break;
    }
  }

  return lines.slice(startIndex + 1, endIndex).join("\n").trim();
};

const buildImportedSuggestionMarkdown = ({
  importedSlides,
  displayNumber,
  cleanPack,
  fullSlideMap,
}) => {
  const legacySlides = Array.isArray(importedSlides) ? importedSlides : [];
  const sections = [];

  if (legacySlides.length > 1) {
    sections.push(
      `_Current slide ${displayNumber} merges multiple legacy source slides, so all imported figure suggestions are shown here._`
    );
  }

  for (const legacySlideNumber of legacySlides) {
    const cleanPackSection = extractSlideSection(cleanPack, legacySlideNumber);
    const fullSlideMapSection = extractLegacySlideSection(
      fullSlideMap,
      legacySlideNumber
    );

    if (!cleanPackSection && !fullSlideMapSection) {
      continue;
    }

    const cleanPackTitle =
      cleanPackSection.match(
        new RegExp(`^## Slide ${legacySlideNumber} —\\s+(.*)$`, "m")
      )?.[1]?.trim() ?? `Legacy slide ${legacySlideNumber}`;

    if (legacySlides.length > 1) {
      sections.push(`### Legacy slide ${legacySlideNumber} — ${cleanPackTitle}`);
    }

    const cleanFigureJob = extractMarkdownSectionByHeading(
      cleanPackSection,
      "### Figure job",
      [
        "### Selected direction",
        "### Core idea",
        "### Composition",
        "### Text inventory",
        "### Object inventory",
        "### Emphasis rules",
        "### Avoid",
        "### Concise prose spec",
      ]
    );
    const cleanSelectedDirection = extractMarkdownSectionByHeading(
      cleanPackSection,
      "### Selected direction",
      [
        "### Core idea",
        "### Composition",
        "### Text inventory",
        "### Object inventory",
        "### Emphasis rules",
        "### Avoid",
        "### Concise prose spec",
      ]
    );
    const cleanCoreIdea = extractMarkdownSectionByHeading(
      cleanPackSection,
      "### Core idea",
      [
        "### Composition",
        "### Text inventory",
        "### Object inventory",
        "### Emphasis rules",
        "### Avoid",
        "### Concise prose spec",
      ]
    );
    const cleanComposition = extractMarkdownSectionByHeading(
      cleanPackSection,
      "### Composition",
      [
        "### Text inventory",
        "### Object inventory",
        "### Emphasis rules",
        "### Avoid",
        "### Concise prose spec",
      ]
    );
    const cleanAvoid = extractMarkdownSectionByHeading(
      cleanPackSection,
      "### Avoid",
      ["### Concise prose spec"]
    );
    const fullProposedSummary = extractMarkdownSectionByHeading(
      fullSlideMapSection,
      "**Proposed figure summary**",
      ["**Figure details**", "**Additional comments**"]
    );
    const fullFigureDetails = extractMarkdownSectionByHeading(
      fullSlideMapSection,
      "**Figure details**",
      ["**Additional comments**"]
    );
    const fullAdditionalComments = extractMarkdownSectionByHeading(
      fullSlideMapSection,
      "**Additional comments**",
      ["---"]
    );

    if (
      cleanFigureJob ||
      cleanSelectedDirection ||
      cleanCoreIdea ||
      cleanComposition ||
      cleanAvoid
    ) {
      sections.push("#### Clean pack direction");
      if (cleanFigureJob) {
        sections.push(`##### Figure job\n${cleanFigureJob}`);
      }
      if (cleanSelectedDirection) {
        sections.push(`##### Selected direction\n${cleanSelectedDirection}`);
      }
      if (cleanCoreIdea) {
        sections.push(`##### Core idea\n${cleanCoreIdea}`);
      }
      if (cleanComposition) {
        sections.push(`##### Composition\n${cleanComposition}`);
      }
      if (cleanAvoid) {
        sections.push(`##### Avoid\n${cleanAvoid}`);
      }
    }

    if (fullProposedSummary || fullFigureDetails || fullAdditionalComments) {
      sections.push("#### Full slide map proposal");
      if (fullProposedSummary) {
        sections.push(`##### Proposed figure summary\n${fullProposedSummary}`);
      }
      if (fullFigureDetails) {
        sections.push(`##### Figure details\n${fullFigureDetails}`);
      }
      if (fullAdditionalComments) {
        sections.push(
          `##### Additional comments\n${fullAdditionalComments}`
        );
      }
    }
  }

  return sections.join("\n\n").trim() || "_No imported figure suggestion found._";
};

const resolveRepoPathMaybe = (repoRoot, maybeRepoRelativePath) => {
  if (!maybeRepoRelativePath) {
    return null;
  }
  return resolve(repoRoot, String(maybeRepoRelativePath));
};

const bulletize = (items = []) =>
  Array.isArray(items) && items.length > 0
    ? items.map((item) => `- ${item}`).join("\n")
    : "- none";

const quotedValue = (value) => {
  const normalized = String(value ?? "").trim();
  return normalized ? `\`${normalized}\`` : "_none_";
};

const buildCurrentSpecMarkdown = (slide) => {
  const lines = [
    `- Status: ${slide.status}`,
    `- Purpose: ${slide.purpose || "none"}`,
    `- Header: ${quotedValue(slide.header)}`,
    `- Subheader: ${quotedValue(slide.subheader)}`,
    `- Takeaway: ${slide.takeaway || "none"}`,
    `- Figure role: ${slide.figureRole || "none"}`,
    `- Family: ${slide.family || "none"}`,
  ];

  if (Array.isArray(slide.proof) && slide.proof.length > 0) {
    lines.push("- Proof / citation:");
    lines.push(...slide.proof.map((item) => `- ${item}`));
  }

  return lines.join("\n");
};

const buildBuildNotesMarkdown = (slide) => {
  const lines = [
    `- Build status: ${slide.buildStatus || "unknown"}`,
    `- Selected direction: ${slide.selectedDirection || "none"}`,
  ];
  if (slide.selectedVariant?.label) {
    lines.push(`- Main selected option: ${slide.selectedVariant.label}`);
  }
  if (Array.isArray(slide.notes) && slide.notes.length > 0) {
    lines.push("- Notes:");
    lines.push(...slide.notes.map((item) => `- ${item}`));
  }
  if (slide.deprecated?.reason) {
    lines.push(`- Deprecation reason: ${slide.deprecated.reason}`);
  }
  if (slide.deprecated?.replacedBy) {
    lines.push(`- Replaced by: slide ${slide.deprecated.replacedBy}`);
  }
  return lines.join("\n");
};

const renderVariantCard = (reportPath, variant) => {
  const statusClass =
    variant.status === "selected" ? "variant-selected" : "variant-option";
  const statusLabel = variant.status === "selected" ? "main selected" : "option";
  const preview = renderSlidePreview(
    reportPath,
    variant.previewPath,
    `${variant.label} preview`
  );
  return `
    <article class="variant-card ${statusClass}">
      <div class="variant-head">
        <div>
          <div class="eyebrow">${variant.status === "selected" ? "Current Selection" : "Figure Option"}</div>
          <h3>${escapeHtml(variant.label)}</h3>
        </div>
        <div class="variant-pill">${escapeHtml(statusLabel)}</div>
      </div>
      ${preview}
      <div class="variant-body">
        <p>${escapeHtml(variant.summary || "")}</p>
        <div class="file-row">${renderFileList(variant.files || [])}</div>
      </div>
    </article>
  `;
};

const renderFileList = (files) =>
  files
    .filter((file) => file?.path && existsSync(file.path))
    .map(
      (file) =>
        `<a class="file-chip" href="${escapeHtml(toFileHref(file.path))}">${escapeHtml(
          file.label
        )}</a>`
    )
    .join("");

const renderSlidePreview = (reportPath, imagePath, caption) => {
  if (!imagePath || !existsSync(imagePath)) {
    return `<div class="missing">No stamped preview yet.</div>`;
  }

  return `
    <figure class="artifact-shot">
      <img src="${escapeHtml(relativeHref(reportPath, imagePath))}" alt="${escapeHtml(
        caption
      )}" />
      <figcaption>${escapeHtml(caption)}</figcaption>
    </figure>
  `;
};

const main = async () => {
  await yargs(hideBin(process.argv))
    .scriptName("figures:deck-report")
    .usage("Usage: npm run figures:deck-report -- --project-root <path> [--out <path>]")
    .option("project-root", {
      type: "string",
      demandOption: true,
      describe: "Project root, e.g. projects/designer-health",
    })
    .option("out", {
      type: "string",
      describe: "Explicit output HTML path",
    })
    .strict()
    .help()
    .parseAsync()
    .then(async (argv) => {
      const projectRoot = resolve(String(argv.projectRoot));
      const repoRoot = resolve(projectRoot, "..", "..");
      const outPath = argv.out
        ? resolve(String(argv.out))
        : resolve(projectRoot, "deck-report.html");

      const deckSpecPath = resolve(projectRoot, "deck-spec.json");
      const masterSpecsPath = resolve(projectRoot, "master-slide-specs.md");
      const deckMatrixPath = resolve(projectRoot, "deck-matrix.md");
      const figureCompanionPath = resolve(projectRoot, "figure-companion.md");
      const workflowPath = resolve(projectRoot, "workflow.md");
      const assessmentPath = resolve(projectRoot, "assessment.md");
      const cleanPackPath = resolve(
        projectRoot,
        "inputs",
        "vox_deck_slide_specs_clean_pack.md"
      );
      const fullSlideMapPath = resolve(
        projectRoot,
        "inputs",
        "vox-full-slide-map-copy.md"
      );
      const deckSpec = await readJsonMaybe(deckSpecPath);
      if (!deckSpec || !Array.isArray(deckSpec.slides)) {
        throw new Error(`Invalid or missing deck spec at ${deckSpecPath}`);
      }

      const cleanPack = (await readTextMaybe(cleanPackPath)) ?? "";
      const fullSlideMap = (await readTextMaybe(fullSlideMapPath)) ?? "";
      const allSlides = await Promise.all(
        deckSpec.slides.map(async (slide) => {
          const packetPath = resolveRepoPathMaybe(repoRoot, slide.paths?.packet);
          const specPaths = Array.isArray(slide.paths?.specs)
            ? slide.paths.specs.map((path) => resolveRepoPathMaybe(repoRoot, path))
            : [];
          const stampedDir = resolveRepoPathMaybe(repoRoot, slide.paths?.stampedDir);
          const manifestPath =
            stampedDir && existsSync(resolve(stampedDir, "manifest.json"))
              ? resolve(stampedDir, "manifest.json")
              : null;
          const slideManifest = manifestPath
            ? await readSlideManifest({
                projectRoot,
                slideId: slide.id,
                slideDir: stampedDir,
              })
            : null;
          const currentVersionEntry = slideManifest?.currentVersionId
            ? slideManifest.versions.find(
                (entry) => entry.id === slideManifest.currentVersionId
              ) ?? null
            : null;
          const currentVersionDir = currentVersionEntry?.dir
            ? resolveRepoPathMaybe(repoRoot, currentVersionEntry.dir)
            : null;
          const currentProjectedRootPng =
            stampedDir && slideManifest?.currentVersionId
              ? getProjectedRootArtifactPaths({
                  slideDir: stampedDir,
                  slideDirName: basename(stampedDir),
                  versionId: slideManifest.currentVersionId,
                }).pngPath
              : null;
          const imagePath =
            currentProjectedRootPng && existsSync(currentProjectedRootPng)
              ? currentProjectedRootPng
              : null;
          const slideNotePath =
            stampedDir &&
            existsSync(
              resolve(
                getSlideNotesDir({
                  projectRoot,
                  slideId: slide.id,
                  slideDir: stampedDir,
                }),
                "README.md"
              )
            )
              ? resolve(
                  getSlideNotesDir({
                    projectRoot,
                    slideId: slide.id,
                    slideDir: stampedDir,
                  }),
                  "README.md"
                )
              : null;
          const slideReportPath =
            stampedDir &&
            existsSync(
              getSlideReportPath({
                projectRoot,
                slideId: slide.id,
                slideDir: stampedDir,
              })
            )
              ? getSlideReportPath({
                  projectRoot,
                  slideId: slide.id,
                  slideDir: stampedDir,
                })
              : null;

          const variants = Array.isArray(slide.variants)
            ? slide.variants.map((variant) => ({
                ...variant,
                previewPath: resolveRepoPathMaybe(repoRoot, variant.previewPath),
                files: Array.isArray(variant.files)
                  ? variant.files.map((file) => ({
                      ...file,
                      path: resolveRepoPathMaybe(repoRoot, file.path),
                    }))
                  : [],
              }))
            : [];
          const selectedVariant = variants.find(
            (variant) => variant.id === slide.selectedVariantId
          );

          return {
            ...slide,
            importedSuggestionMarkdown: buildImportedSuggestionMarkdown({
              importedSlides: slide.importedSlides,
              displayNumber: slide.displayNumber,
              cleanPack,
              fullSlideMap,
            }),
            currentSpecMarkdown: buildCurrentSpecMarkdown(slide),
            buildNotesMarkdown: buildBuildNotesMarkdown(slide),
            packetPath,
            specPaths: specPaths.filter(Boolean),
            stampedDir,
            manifestPath,
            currentVersionId: slideManifest?.currentVersionId ?? null,
            currentVersionDir,
            imagePath: imagePath || selectedVariant?.previewPath || null,
            slideNotePath,
            slideReportPath,
            variants,
            selectedVariant,
          };
        })
      );

      const activeSlides = allSlides.filter((slide) => slide.status === "active");
      const deprecatedSlides = allSlides.filter(
        (slide) => slide.status === "deprecated"
      );
      const slideSelectorOptions = [
        {
          value: "__all_active__",
          label: "All active slides",
        },
        {
          value: "__all__",
          label: "All slides",
        },
        ...allSlides.map((slide) => ({
          value: slide.id,
          label: `Slide ${slide.displayNumber} — ${slide.title}`,
        })),
      ];

      const stampedCount = activeSlides.filter((slide) => slide.imagePath).length;
      const packetCount = activeSlides.filter((slide) => slide.packetPath).length;
      const currentBackboneMarkdown = [
        `- Version: ${deckSpec.version}`,
        `- Active sequence: ${deckSpec.numberingPolicy?.activeSequence?.join(" → ") || "unknown"}`,
        `- Deprecated slides: ${deckSpec.numberingPolicy?.deprecatedSlides?.join(", ") || "none"}`,
        `- Policy: ${deckSpec.numberingPolicy?.summary || "none"}`,
        "- Notes:",
        ...((deckSpec.numberingPolicy?.notes || []).map((item) => `- ${item}`))
      ].join("\n");
      const narrativeSpineMarkdown = bulletize(deckSpec.narrativeSpine || []);

      const files = [
        { label: "Deck spec", path: deckSpecPath },
        { label: "Master slide specs", path: masterSpecsPath },
        { label: "Deck matrix", path: deckMatrixPath },
        { label: "Figure companion", path: figureCompanionPath },
        { label: "Workflow", path: workflowPath },
        { label: "Assessment", path: assessmentPath },
        { label: "Clean pack", path: cleanPackPath },
        { label: "Full slide map", path: fullSlideMapPath },
      ];

      const renderSlideCard = (slide) => {
        const slideFiles = [
          slide.manifestPath
            ? { label: "Manifest", path: slide.manifestPath }
            : null,
          slide.currentVersionDir
            ? {
                label: slide.currentVersionId
                  ? `Current ${slide.currentVersionId}`
                  : "Current version dir",
                path: slide.currentVersionDir,
              }
            : null,
          slide.slideNotePath
            ? { label: "Slide note", path: slide.slideNotePath }
            : null,
          slide.packetPath ? { label: "Slide packet", path: slide.packetPath } : null,
          slide.slideReportPath
            ? { label: "Slide report", path: slide.slideReportPath }
            : null,
          slide.imagePath ? { label: "Figure PNG", path: slide.imagePath } : null,
          slide.stampedDir ? { label: "Stamped dir", path: slide.stampedDir } : null,
          ...slide.specPaths.map((path, index) => ({
            label:
              slide.specPaths.length === 1
                ? "Spec"
                : `Spec ${index + 1}`,
            path,
          })),
        ].filter(Boolean);

        const statusClass =
          slide.status === "deprecated"
            ? "status-deprecated"
            : slide.imagePath
              ? "status-live"
              : "status-open";
        const statusLabel =
          slide.status === "deprecated"
            ? "Deprecated"
            : slide.imagePath
              ? "Stamped figure exists"
              : "No stamped figure yet";
        const optionGallery =
          Array.isArray(slide.variants) && slide.variants.length > 0
            ? `
              <article class="slide-panel slide-options">
                <div class="eyebrow">Figure Options</div>
                <p class="options-copy">
                  ${slide.selectedVariant?.label
                    ? `Main selected direction: ${escapeHtml(slide.selectedVariant.label)}.`
                    : "Reference options and prior directions."}
                </p>
                <div class="variant-grid">
                  ${slide.variants
                    .map((variant) => renderVariantCard(outPath, variant))
                    .join("\n")}
                </div>
              </article>
            `
            : "";

        return `
          <section class="slide-card" id="${escapeHtml(slide.id)}">
            <div class="slide-card-head">
              <div>
                <div class="eyebrow">Slide ${escapeHtml(slide.displayNumber)}</div>
                <h2>${escapeHtml(slide.title)}</h2>
              </div>
              <div class="status-pill ${statusClass}">
                ${statusLabel}
              </div>
            </div>
            <div class="slide-grid">
              <div class="slide-preview">
                ${renderSlidePreview(
                  outPath,
                  slide.imagePath,
                  `${slide.id} preview`
                )}
                <div class="file-row">${renderFileList(slideFiles)}</div>
              </div>
              <article class="slide-panel">
                <div class="eyebrow">Current Running Spec</div>
                ${
                  slide.currentVersionId
                    ? `<p class="body-copy"><strong>Current version:</strong> ${escapeHtml(
                        slide.currentVersionId
                      )}</p>`
                    : ""
                }
                <div class="markdown">${markdownToHtml(
                  slide.currentSpecMarkdown
                )}</div>
              </article>
              <article class="slide-panel">
                <div class="eyebrow">Build Notes</div>
                <div class="markdown">${markdownToHtml(
                  slide.buildNotesMarkdown
                )}</div>
              </article>
              <article class="slide-panel slide-source">
                <div class="eyebrow">Imported Figure Suggestion</div>
                <div class="markdown">${markdownToHtml(
                  slide.importedSuggestionMarkdown
                )}</div>
              </article>
              ${optionGallery}
            </div>
          </section>
        `;
      };

      const activeSlideCards = activeSlides
        .map((slide) => {
          return renderSlideCard(slide);
        })
        .join("\n");

      const deprecatedSlideCards = deprecatedSlides
        .map((slide) => renderSlideCard(slide))
        .join("\n");
      const slideSelectorMarkup = slideSelectorOptions
        .map(
          (option) =>
            `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`
        )
        .join("\n");
      const slideMetaJson = JSON.stringify(
        allSlides.map((slide) => ({
          id: slide.id,
          displayNumber: slide.displayNumber,
          title: slide.title,
          status: slide.status,
        }))
      );

      const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml("Designer deck report")}</title>
    <style>
      :root {
        --bg: #f5f7fb;
        --panel: #ffffff;
        --text: #12202f;
        --muted: #617286;
        --line: #dbe3ec;
        --accent: #4a89c8;
        --accent-soft: #eef5fc;
        --good: #1d766c;
        --warn: #9a6a18;
        --shadow: 0 16px 40px rgba(18, 32, 47, 0.08);
        --radius: 22px;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 32px;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: linear-gradient(180deg, #f8fafc 0%, var(--bg) 100%);
        color: var(--text);
      }
      .page {
        max-width: 1440px;
        margin: 0 auto;
      }
      .hero, .card, .slide-card {
        border: 1px solid var(--line);
        border-radius: 28px;
        background: var(--panel);
        box-shadow: var(--shadow);
      }
      .hero {
        padding: 30px 32px;
        background:
          radial-gradient(circle at top right, rgba(74, 137, 200, 0.09), transparent 32%),
          var(--panel);
      }
      .eyebrow {
        color: var(--accent);
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      h1 {
        margin: 12px 0 0;
        font-size: 48px;
        line-height: 1;
        letter-spacing: -0.04em;
      }
      h2 {
        margin: 0;
        font-size: 28px;
        line-height: 1.1;
        letter-spacing: -0.03em;
      }
      .summary {
        margin-top: 14px;
        max-width: 980px;
        font-size: 19px;
        line-height: 1.45;
        color: var(--muted);
      }
      .chips, .file-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .chips { margin-top: 20px; }
      .file-row { margin-top: 14px; }
      .file-chip, .stat-chip, .status-pill {
        display: inline-flex;
        align-items: center;
        padding: 9px 12px;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: #fff;
        color: var(--muted);
        text-decoration: none;
        font-size: 13px;
        font-weight: 700;
      }
      .file-chip:hover { border-color: var(--accent); color: var(--accent); }
      .status-live {
        border-color: rgba(29, 118, 108, 0.2);
        color: var(--good);
        background: rgba(29, 118, 108, 0.06);
      }
      .status-open {
        border-color: rgba(154, 106, 24, 0.2);
        color: var(--warn);
        background: rgba(154, 106, 24, 0.06);
      }
      .status-deprecated {
        border-color: rgba(97, 114, 134, 0.18);
        color: var(--muted);
        background: rgba(97, 114, 134, 0.08);
      }
      .top-grid {
        display: grid;
        gap: 20px;
        grid-template-columns: 1.1fr 0.9fr;
        margin-top: 24px;
      }
      .card {
        padding: 22px 24px;
      }
      .selector-bar {
        position: sticky;
        top: 16px;
        z-index: 20;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        margin-top: 24px;
        padding: 18px 20px;
        border: 1px solid var(--line);
        border-radius: 24px;
        background: rgba(255, 255, 255, 0.94);
        box-shadow: var(--shadow);
        backdrop-filter: blur(12px);
      }
      .selector-copy {
        min-width: 220px;
      }
      .selector-copy p {
        margin: 8px 0 0;
        color: var(--muted);
        font-size: 14px;
        line-height: 1.45;
      }
      .selector-controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
      }
      .selector-controls select,
      .selector-controls button {
        height: 44px;
        border-radius: 14px;
        border: 1px solid var(--line);
        background: #fff;
        color: var(--text);
        font-size: 14px;
      }
      .selector-controls select {
        min-width: 320px;
        padding: 0 14px;
      }
      .selector-controls button {
        padding: 0 14px;
        font-weight: 700;
        cursor: pointer;
      }
      .selector-controls button:disabled {
        cursor: default;
        color: #9aa8b7;
        background: #f6f8fb;
      }
      .selector-status {
        min-height: 20px;
        color: var(--muted);
        font-size: 14px;
        font-weight: 600;
      }
      .stats {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 16px;
      }
      .slide-list {
        display: grid;
        gap: 22px;
        margin-top: 26px;
      }
      .section-title {
        margin: 28px 0 0;
        font-size: 32px;
        line-height: 1.05;
        letter-spacing: -0.03em;
      }
      .section-copy {
        margin: 10px 0 0;
        color: var(--muted);
        font-size: 17px;
        line-height: 1.45;
      }
      .slide-card {
        padding: 22px 24px 24px;
      }
      .slide-card.is-hidden {
        display: none;
      }
      .slide-card-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 20px;
        margin-bottom: 18px;
      }
      .slide-grid {
        display: grid;
        gap: 18px;
        grid-template-columns: 420px 1fr 1fr;
      }
      .slide-panel {
        border: 1px solid var(--line);
        border-radius: 18px;
        background: #fbfdff;
        padding: 18px;
      }
      .slide-source {
        grid-column: 2 / span 2;
      }
      .slide-options {
        grid-column: 1 / -1;
      }
      .options-copy {
        margin: 10px 0 0;
        color: var(--muted);
        font-size: 14px;
        line-height: 1.45;
      }
      .variant-grid {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        margin-top: 12px;
      }
      .variant-card {
        border: 1px solid var(--line);
        border-radius: 18px;
        background: #fff;
        overflow: hidden;
      }
      .variant-selected {
        border-color: rgba(74, 137, 200, 0.4);
        box-shadow: 0 12px 28px rgba(74, 137, 200, 0.12);
      }
      .variant-option {
        background: #fcfdff;
      }
      .variant-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
        padding: 16px 16px 0;
      }
      .variant-head h3 {
        margin: 6px 0 0;
        font-size: 20px;
        line-height: 1.1;
        letter-spacing: -0.02em;
      }
      .variant-pill {
        flex: 0 0 auto;
        padding: 8px 10px;
        border-radius: 999px;
        border: 1px solid var(--line);
        color: var(--muted);
        background: #fff;
        font-size: 12px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .variant-body {
        padding: 14px 16px 16px;
      }
      .variant-body p {
        margin: 0;
        color: #243344;
        font-size: 14px;
        line-height: 1.5;
      }
      .artifact-shot {
        margin: 0;
        overflow: hidden;
        border-radius: 18px;
        border: 1px solid var(--line);
        background: #fff;
      }
      .artifact-shot img {
        display: block;
        width: 100%;
        height: auto;
      }
      .artifact-shot figcaption {
        padding: 12px 14px;
        border-top: 1px solid var(--line);
        color: var(--muted);
        font-size: 14px;
        line-height: 1.4;
      }
      .missing {
        padding: 22px;
        border-radius: 18px;
        border: 1px dashed var(--line);
        color: var(--muted);
        background: #fbfcfe;
      }
      .markdown h3, .markdown h4 {
        margin: 1.1em 0 0.45em;
        line-height: 1.15;
      }
      .markdown h3 { font-size: 18px; }
      .markdown h4 { font-size: 16px; }
      .markdown p, .markdown li {
        font-size: 15px;
        line-height: 1.55;
        color: #243344;
      }
      .markdown ul, .markdown ol {
        padding-left: 22px;
      }
      .markdown code {
        padding: 1px 6px;
        border-radius: 8px;
        background: #f2f6fa;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 0.92em;
      }
      @media (max-width: 1180px) {
        .top-grid, .slide-grid { grid-template-columns: 1fr; }
        .slide-card-head { flex-direction: column; }
        .slide-source { grid-column: auto; }
        .slide-options { grid-column: auto; }
        .variant-grid { grid-template-columns: 1fr; }
        .selector-bar { position: static; }
        .selector-controls { width: 100%; }
        .selector-controls select { min-width: 0; width: 100%; }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <section class="hero">
        <div class="eyebrow">Designer Health</div>
        <h1>Current deck spec and build status</h1>
        <div class="summary">
          This is the current running deck view. It uses the canonical deck spec
          with intentionally preserved slide numbering, explicitly marks
          deprecated and shelved concepts, and shows the current selected
          direction plus alternate explored figure options wherever they already
          exist.
        </div>
        <div class="chips">${renderFileList(files)}</div>
      </section>

      <section class="top-grid">
        <article class="card">
          <div class="eyebrow">Current Backbone</div>
          <div class="markdown">${markdownToHtml(currentBackboneMarkdown)}</div>
          <div class="eyebrow" style="margin-top:20px;">Narrative Spine</div>
          <div class="markdown">${markdownToHtml(narrativeSpineMarkdown)}</div>
        </article>
        <article class="card">
          <div class="eyebrow">Coverage Snapshot</div>
          <div class="stats">
            <span class="stat-chip">${escapeHtml(`${activeSlides.length} active slides`)}</span>
            <span class="stat-chip">${escapeHtml(`${deprecatedSlides.length} deprecated ${deprecatedSlides.length === 1 ? "slide" : "slides"}`)}</span>
            <span class="stat-chip">${escapeHtml(`${packetCount} slide packets checked in`)}</span>
            <span class="stat-chip">${escapeHtml(`${stampedCount} stamped slide figures`)}</span>
          </div>
          <div class="eyebrow" style="margin-top:20px;">Spec Notes</div>
          <div class="markdown"><p><code>deck-spec.json</code> is the canonical current deck backbone. The markdown docs remain companion references, but the report now renders the active / deprecated state directly from the codified spec.</p></div>
        </article>
      </section>

      <section class="selector-bar">
        <div class="selector-copy">
          <div class="eyebrow">Slide Selector</div>
          <p>Pick one slide to inspect, or switch back to the full deck view.</p>
        </div>
        <div class="selector-controls">
          <button type="button" id="slide-prev">Previous</button>
          <select id="slide-selector" aria-label="Select slide">
            ${slideSelectorMarkup}
          </select>
          <button type="button" id="slide-next">Next</button>
          <span class="selector-status" id="slide-selector-status"></span>
        </div>
      </section>

      <h2 class="section-title" data-section-heading="active">Active Backbone</h2>
      <p class="section-copy" data-section-copy="active">
        These are the slides currently in the running deck. Public slide
        numbers come directly from <code>deck-spec.json</code>; when repo slide
        ids or stamped roots differ, those legacy storage identities are shown
        separately instead of being treated as the public deck order.
      </p>
      <section class="slide-list" data-slide-section="active">
        ${activeSlideCards}
      </section>

      <h2 class="section-title" data-section-heading="deprecated">Deprecated / Shelved</h2>
      <p class="section-copy" data-section-copy="deprecated">
        These slides and concepts are retained only as historical context. They
        are not part of the current backbone, but they remain useful for
        tracking what was merged, reopened, or shelved.
      </p>
      <section class="slide-list" data-slide-section="deprecated">
        ${deprecatedSlideCards}
      </section>
    </div>
    <script>
      (() => {
        const slides = ${slideMetaJson};
        const defaultValue = window.location.hash
          ? decodeURIComponent(window.location.hash.slice(1))
          : (slides.find((slide) => slide.status === "active")?.id || "__all_active__");
        const validValues = new Set(["__all_active__", "__all__", ...slides.map((slide) => slide.id)]);
        const selector = document.getElementById("slide-selector");
        const prevButton = document.getElementById("slide-prev");
        const nextButton = document.getElementById("slide-next");
        const status = document.getElementById("slide-selector-status");
        const cards = Array.from(document.querySelectorAll(".slide-card"));
        const sections = {
          active: {
            heading: document.querySelector('[data-section-heading="active"]'),
            copy: document.querySelector('[data-section-copy="active"]'),
            body: document.querySelector('[data-slide-section="active"]'),
          },
          deprecated: {
            heading: document.querySelector('[data-section-heading="deprecated"]'),
            copy: document.querySelector('[data-section-copy="deprecated"]'),
            body: document.querySelector('[data-slide-section="deprecated"]'),
          },
        };

        const setSectionVisible = (sectionKey, visible) => {
          for (const node of Object.values(sections[sectionKey])) {
            if (node) {
              node.style.display = visible ? "" : "none";
            }
          }
        };

        const visibleSlidesForValue = (value) => {
          if (value === "__all__") {
            return slides.map((slide) => slide.id);
          }
          if (value === "__all_active__") {
            return slides.filter((slide) => slide.status === "active").map((slide) => slide.id);
          }
          return slides.some((slide) => slide.id === value) ? [value] : [];
        };

        const updateControls = (value) => {
          const slideIndex = slides.findIndex((slide) => slide.id === value);
          const isSingleSlide = slideIndex !== -1;
          prevButton.disabled = !isSingleSlide || slideIndex === 0;
          nextButton.disabled = !isSingleSlide || slideIndex === slides.length - 1;
          if (value === "__all__") {
            status.textContent = "Showing the full deck.";
            return;
          }
          if (value === "__all_active__") {
            status.textContent = "Showing active slides only.";
            return;
          }
          const slide = slides[slideIndex];
          status.textContent = slide
            ? "Viewing slide " + slide.displayNumber + " of " + slides.length + "."
            : "";
        };

        const applySelection = (rawValue, pushHash = true) => {
          const value = validValues.has(rawValue) ? rawValue : "__all_active__";
          selector.value = value;
          const visibleIds = new Set(visibleSlidesForValue(value));
          cards.forEach((card) => {
            card.classList.toggle("is-hidden", !visibleIds.has(card.id));
          });

          if (value === "__all__") {
            setSectionVisible("active", true);
            setSectionVisible("deprecated", true);
          } else if (value === "__all_active__") {
            setSectionVisible("active", true);
            setSectionVisible("deprecated", false);
          } else {
            const slide = slides.find((item) => item.id === value);
            setSectionVisible("active", slide?.status === "active");
            setSectionVisible("deprecated", slide?.status === "deprecated");
          }

          updateControls(value);
          if (pushHash) {
            const hashValue = value === "__all_active__" ? "all-active" : value === "__all__" ? "all" : value;
            history.replaceState(null, "", "#" + encodeURIComponent(hashValue));
          }
        };

        selector.addEventListener("change", (event) => {
          applySelection(event.target.value);
        });

        prevButton.addEventListener("click", () => {
          const index = slides.findIndex((slide) => slide.id === selector.value);
          if (index > 0) {
            applySelection(slides[index - 1].id);
          }
        });

        nextButton.addEventListener("click", () => {
          const index = slides.findIndex((slide) => slide.id === selector.value);
          if (index !== -1 && index < slides.length - 1) {
            applySelection(slides[index + 1].id);
          }
        });

        const hashValue = decodeURIComponent(window.location.hash.slice(1));
        const initialValue =
          hashValue === "all"
            ? "__all__"
            : hashValue === "all-active"
              ? "__all_active__"
              : defaultValue;
        applySelection(initialValue, false);
      })();
    </script>
  </body>
</html>`;

      await writeFile(outPath, html, "utf8");
      process.stdout.write(`${outPath}\n`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
};

await main();
