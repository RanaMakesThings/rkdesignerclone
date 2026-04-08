#!/usr/bin/env node

import { readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";
import { createRequire } from "node:module";
import {
  getActiveDeckSlides,
  parseDeckSlideDisplayNumber,
  readDeckSpec,
  resolveDeckSlideEntry,
} from "../../lib/repo/read-deck-spec.mjs";
import { computeTextSha256 } from "../llm/private/html-tune-state.mjs";
import {
  getSlideNotesDir,
  getSlideReportPath,
  readSlideManifest,
  resolveSlideVersionContext,
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
  escapeHtml(value).replace(/`([^`]+)`/g, "<code>$1</code>");

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
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const readRequestDocMaybe = async (dir) =>
  (await readJsonMaybe(resolve(dir, "request.json"))) ??
  (await readJsonMaybe(resolve(dir, "meta.json")));

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

const findPrefixedFileFromPrefixes = async (dir, prefixes, extension) => {
  for (const prefix of [...new Set((prefixes ?? []).filter(Boolean))]) {
    const matched = await findPrefixedFile(dir, prefix, extension);
    if (matched) {
      return matched;
    }
  }
  return null;
};

const findPrefixedDir = async (dir, prefix) => {
  if (!existsSync(dir)) {
    return null;
  }
  const entries = await readdir(dir, { withFileTypes: true });
  const matches = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
    .map((entry) => resolve(dir, entry.name))
    .sort();
  return matches.at(-1) ?? null;
};

const findExactOrPrefixedDir = async (dir, exactName, prefix = exactName) => {
  const exactPath = resolve(dir, exactName);
  if (existsSync(exactPath)) {
    return exactPath;
  }
  return findPrefixedDir(dir, prefix);
};

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
      const level = headingMatch[1].length;
      chunks.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    const unorderedMatch = trimmed.match(/^-\s+(.*)$/);
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

const extractSlideSection = (markdown, slideNumber) => {
  const pattern = new RegExp(
    `^## Slide ${slideNumber} —[\\s\\S]*?(?=^## Slide \\d+ —|^## References|\\Z)`,
    "m"
  );
  const match = String(markdown ?? "").match(pattern);
  return match ? match[0].trim() : "";
};

const cardImage = (src, label) =>
  src && existsSync(src)
    ? `
      <figure class="artifact-shot">
        <img src="${escapeHtml(label.href)}" alt="${escapeHtml(label.alt)}" />
        <figcaption>${escapeHtml(label.caption)}</figcaption>
      </figure>
    `
    : `<div class="missing">Missing artifact: ${escapeHtml(
        src ? basename(src) : "unknown"
      )}</div>`;

const resolveRepoPathMaybe = (repoRoot, repoRelativePath) => {
  const raw = String(repoRelativePath ?? "").trim();
  if (!raw) {
    return null;
  }
  return raw.startsWith("/") ? resolve(raw) : resolve(repoRoot, raw);
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

const renderMiniChips = (items) =>
  items
    .filter(Boolean)
    .map((item) => `<span class="mini-chip">${escapeHtml(item)}</span>`)
    .join("");

const summarizeReview = (text) => {
  const normalized = String(text ?? "").trim();
  if (!normalized) {
    return null;
  }

  const verdictMatch = normalized.match(/(?:^|\n)#+\s*1\.\s*Verdict\s*\n+([\s\S]*?)(?=\n#+\s*2\.|\n\*\*2\.|$)/i)
    || normalized.match(/(?:^|\n)\*\*1\.\s*Verdict\*\*\s*\n+([\s\S]*?)(?=\n\*\*2\.|$)/i);
  const nextMoveMatch =
    normalized.match(/(?:^|\n)#+\s*5\.\s*Best next move\s*\n+([\s\S]*?)$/i) ||
    normalized.match(/(?:^|\n)\*\*5\.\s*Best next move\*\*\s*\n+([\s\S]*?)$/i);

  const firstParagraph = normalized
    .replace(/^#+\s.*$/gm, "")
    .replace(/^\*\*.*\*\*$/gm, "")
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .find(Boolean);

  const verdict = verdictMatch?.[1]?.replace(/\s+/g, " ").trim() || firstParagraph || "";
  const nextMove = nextMoveMatch?.[1]?.replace(/\s+/g, " ").trim() || "";

  return { verdict, nextMove };
};

const summarizeRepair = (text) => {
  const normalized = String(text ?? "").trim();
  if (!normalized) {
    return null;
  }

  const familyMatch =
    normalized.match(
      /(?:^|\n)#+\s*2\.\s*Stay in current family\?\s*\n+([\s\S]*?)(?=\n#+\s*3\.|\n\*\*3\.|$)/i
    ) ||
    normalized.match(
      /(?:^|\n)\*\*2\.\s*Stay in current family\?\*\*\s*\n+([\s\S]*?)(?=\n\*\*3\.|$)/i
    );
  const nextMoveMatch =
    normalized.match(
      /(?:^|\n)#+\s*3\.\s*Exact next move\s*\n+([\s\S]*?)(?=\n#+\s*4\.|\n\*\*4\.|$)/i
    ) ||
    normalized.match(
      /(?:^|\n)\*\*3\.\s*Exact next move\*\*\s*\n+([\s\S]*?)(?=\n\*\*4\.|$)/i
    );

  return {
    family: familyMatch?.[1]?.replace(/\s+/g, " ").trim() || "",
    nextMove: nextMoveMatch?.[1]?.replace(/\s+/g, " ").trim() || "",
  };
};

const summarizeRegressionJson = (value) => {
  if (!value || typeof value !== "object") {
    return null;
  }
  return {
    verdict: String(value.verdict ?? "").trim(),
    rationale: String(value.rationale ?? "").trim(),
    blockers: Array.isArray(value.blockers)
      ? value.blockers.map((entry) => String(entry).trim()).filter(Boolean)
      : [],
    nextMove: String(value.nextMove ?? "").trim(),
  };
};

const summarizeDeltaJson = (value) => {
  if (!value || typeof value !== "object") {
    return null;
  }
  return {
    status: String(value.status ?? "").trim(),
    summary: String(value.summary ?? "").trim(),
    nextPrompt: String(value.nextPrompt ?? "").trim(),
    evidence: Array.isArray(value.evidence)
      ? value.evidence.map((entry) => String(entry).trim()).filter(Boolean)
      : [],
  };
};

const selectLatestNewRunSlot = (state) => {
  const winnerAttemptDir = state?.winner?.attemptDir
    ? resolve(state.winner.attemptDir)
    : null;
  if (winnerAttemptDir) {
    const winnerRound = Array.isArray(state?.rounds)
      ? state.rounds.find((round) =>
          Array.isArray(round?.slots) &&
          round.slots.some((slot) => resolve(slot?.attemptDir ?? "") === winnerAttemptDir)
        )
      : null;
    const winnerSlot = winnerRound?.slots?.find(
      (slot) => resolve(slot?.attemptDir ?? "") === winnerAttemptDir
    );
    if (winnerSlot) {
      return winnerSlot;
    }
  }

  const latestRound = Array.isArray(state?.rounds) ? state.rounds.at(-1) : null;
  if (!latestRound || !Array.isArray(latestRound.slots) || latestRound.slots.length === 0) {
    return null;
  }
  return [...latestRound.slots].sort((left, right) => {
    const leftScore = Number(left?.score?.numeric ?? 0);
    const rightScore = Number(right?.score?.numeric ?? 0);
    return rightScore - leftScore;
  })[0];
};

const loadLatestTuneRun = async (artifactRoot) => {
  const tuneRoots = [
    resolve(artifactRoot, "gemini-html", "tune"),
    resolve(artifactRoot, "openai-html", "tune"),
    resolve(artifactRoot, "tune"),
  ];
  const tuneDir = tuneRoots.find((path) => existsSync(path));
  if (!tuneDir) {
    return null;
  }

  const runDir = await findPrefixedDir(tuneDir, "");
  if (!runDir) {
    return null;
  }

  const statePath = resolve(runDir, "state.json");
  const state = await readJsonMaybe(statePath);
  if (!state) {
    return null;
  }

  const isLegacyRun = Array.isArray(state.attempts);
  const latestAttempt = isLegacyRun ? state.attempts.at(-1) : selectLatestNewRunSlot(state);
  const attemptDir = latestAttempt?.attemptDir ? resolve(latestAttempt.attemptDir) : null;
  const changeRequestPath = existsSync(resolve(runDir, "request.md"))
    ? resolve(runDir, "request.md")
    : resolve(runDir, "change-request.md");

  return {
    runDir,
    statePath,
    state,
    changeRequestPath,
    baselinePreviewPath: isLegacyRun
      ? state.baselinePreviewPath
        ? resolve(state.baselinePreviewPath)
        : null
      : state?.baseline?.officialPreviewPath
        ? resolve(state.baseline.officialPreviewPath)
        : null,
    latestAttempt,
    attemptDir,
    decisionPath: attemptDir ? resolve(attemptDir, "decision.json") : null,
    gptDeltaPath: attemptDir
      ? existsSync(resolve(attemptDir, "gpt-delta.json"))
        ? resolve(attemptDir, "gpt-delta.json")
        : resolve(attemptDir, "gpt-delta-judge.json")
      : null,
    claudeDeltaPath: attemptDir
      ? existsSync(resolve(attemptDir, "claude-delta.json"))
        ? resolve(attemptDir, "claude-delta.json")
        : resolve(attemptDir, "claude-delta-judge.json")
      : null,
    gptRegressionPath: attemptDir
      ? existsSync(resolve(attemptDir, "gpt-regression.json"))
        ? resolve(attemptDir, "gpt-regression.json")
        : resolve(attemptDir, "gpt-regression-review.json")
      : null,
    claudeRegressionPath: attemptDir
      ? existsSync(resolve(attemptDir, "claude-regression.json"))
        ? resolve(attemptDir, "claude-regression.json")
        : resolve(attemptDir, "claude-regression-review.json")
      : null,
    staticSanityPath: attemptDir ? resolve(attemptDir, "static-sanity.json") : null,
    codexMicroReviewPath: existsSync(resolve(runDir, "codex-review.md"))
      ? resolve(runDir, "codex-review.md")
      : attemptDir
        ? resolve(attemptDir, "codex-micro-review.md")
        : null,
    latestPreviewPath: isLegacyRun
      ? latestAttempt?.afterImagePath
        ? resolve(latestAttempt.afterImagePath)
        : null
      : latestAttempt?.after?.previewPath
        ? resolve(latestAttempt.after.previewPath)
        : null,
  };
};

const main = async () => {
  await yargs(hideBin(process.argv))
    .scriptName("figures:report")
    .usage("Usage: npm run figures:report -- --project-root <path> --slide <slide-XX>")
    .option("project-root", {
      type: "string",
      demandOption: true,
      describe: "Project root, e.g. projects/designer-health",
    })
    .option("slide", {
      type: "string",
      demandOption: true,
      describe:
        "Slide id or current public display number, e.g. slide-06, slide-5, or 5",
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
      const { deckSpec } = await readDeckSpec(projectRoot);
      const slideEntry = resolveDeckSlideEntry({
        deckSpec,
        slide: argv.slide,
      });
      const context = await resolveSlideVersionContext({
        projectRoot,
        slideId: slideEntry.id,
      });
      const slideSlug = context.slideId;
      const slideDir = context.slideDir;
      const slideNumberLabel = String(slideEntry.displayNumber ?? slideSlug);
      const slideNumber = parseDeckSlideDisplayNumber(slideEntry.displayNumber);
      const hasExplicitLegacyReferences =
        Boolean(slideEntry.paths?.packet) ||
        (Array.isArray(slideEntry.paths?.specs) && slideEntry.paths.specs.length > 0);
      const lookupPrefixes = hasExplicitLegacyReferences
        ? [slideSlug, context.slideDirName]
        : [context.slideDirName === slideSlug ? slideSlug : context.slideDirName];
      const outPath = argv.out
        ? resolve(String(argv.out))
        : getSlideReportPath({
            projectRoot,
            slideId: slideSlug,
            slideDir,
            slideDirName: context.slideDirName,
          });
      const notesDir = getSlideNotesDir({
        projectRoot,
        slideId: slideSlug,
        slideDir,
        slideDirName: context.slideDirName,
      });
      const manifestPath = resolve(slideDir, "manifest.json");
      const slideNotePath = resolve(notesDir, "README.md");
      const fineTuneRequestPath = resolve(notesDir, "fine-tune-request.md");
      const manifest = existsSync(manifestPath)
        ? await readSlideManifest({
            projectRoot,
            slideId: slideSlug,
            slideDir,
          })
        : null;
      const currentVersionEntry = manifest?.currentVersionId
        ? manifest.versions.find((entry) => entry.id === manifest.currentVersionId) ?? null
        : null;
      const currentVersionDir = currentVersionEntry?.dir
        ? resolve(projectRoot, "..", "..", currentVersionEntry.dir)
        : null;
      const artifactRoot = currentVersionDir || slideDir;
      const tuneArtifactRoot = artifactRoot;

      const packetPath =
        resolveRepoPathMaybe(repoRoot, slideEntry.paths?.packet) ??
        (await findPrefixedFileFromPrefixes(
          resolve(projectRoot, "slide-packets"),
          lookupPrefixes,
          ".md"
        ));
      const briefPath = await findPrefixedFileFromPrefixes(
        resolve(projectRoot, "figures", "briefs"),
        lookupPrefixes,
        ".md"
      );
      const ideationPath = await findPrefixedFileFromPrefixes(
        resolve(projectRoot, "figures", "ideation"),
        lookupPrefixes,
        ".md"
      );
      const compositionPath = await findPrefixedFileFromPrefixes(
        resolve(projectRoot, "figures", "compositions"),
        lookupPrefixes,
        ".md"
      );
      const renderBriefPath = await findPrefixedFileFromPrefixes(
        resolve(projectRoot, "figures", "render-briefs"),
        lookupPrefixes,
        ".md"
      );
      const specPath =
        resolveRepoPathMaybe(repoRoot, slideEntry.paths?.specs?.[0]) ??
        (await findPrefixedFileFromPrefixes(
          resolve(projectRoot, "figures", "specs"),
          lookupPrefixes,
          ".json"
        ));
      const processReviewPrefixes = lookupPrefixes.map(
        (prefix) => `process-review-${prefix}`
      );
      const processReviewPath = await findPrefixedFileFromPrefixes(
        projectRoot,
        processReviewPrefixes,
        ".md"
      );
      const masterSpecsPath = resolve(projectRoot, "master-slide-specs.md");
      const workflowPath = resolve(projectRoot, "workflow.md");

      const masterSpecs = (await readTextMaybe(masterSpecsPath)) ?? "";
      const workflow = (await readTextMaybe(workflowPath)) ?? "";
      const packet = (await readTextMaybe(packetPath)) ?? "";
      const brief = (await readTextMaybe(briefPath)) ?? "";
      const ideation = (await readTextMaybe(ideationPath)) ?? "";
      const composition = (await readTextMaybe(compositionPath)) ?? "";
      const renderBrief = (await readTextMaybe(renderBriefPath)) ?? "";
      const processReview = (await readTextMaybe(processReviewPath)) ?? "";
      const codexReviewPath = resolve(artifactRoot, "codex-review.md");
      const codexRepairPath = resolve(artifactRoot, "codex-repair.md");
      const assessmentSynthesisPath = resolve(artifactRoot, "assessment-synthesis.md");
      const repairSynthesisPath = resolve(artifactRoot, "repair-synthesis.md");
      const nextPassPath = resolve(artifactRoot, "next-pass.md");
      const codexReview = (await readTextMaybe(codexReviewPath)) ?? "";
      const codexRepair = (await readTextMaybe(codexRepairPath)) ?? "";
      const assessmentSynthesis = (await readTextMaybe(assessmentSynthesisPath)) ?? "";
      const repairSynthesis = (await readTextMaybe(repairSynthesisPath)) ?? "";
      const nextPass = (await readTextMaybe(nextPassPath)) ?? "";

      const nativeImagePath = resolve(artifactRoot, "figure.png");
      const nativeHtmlPath = resolve(artifactRoot, "figure.html");
      const nativeSvgPath = resolve(artifactRoot, "figure.svg");
      const nativeCoveragePath = resolve(artifactRoot, "coverage.json");
      const nativeMetaPath = resolve(artifactRoot, "meta.json");
      const geminiImagePath = resolve(artifactRoot, "gemini-image", "image-01.jpg");
      const geminiHtmlPath = resolve(artifactRoot, "gemini-html", "generated.html");
      const geminiHtmlPreviewPath = resolve(artifactRoot, "gemini-html", "preview.png");
      const geminiReviewDir = await findExactOrPrefixedDir(artifactRoot, "gemini-review");
      const anthropicReviewDir = await findExactOrPrefixedDir(
        artifactRoot,
        "anthropic-review"
      );
      const geminiRepairDir = await findExactOrPrefixedDir(artifactRoot, "gemini-repair");
      const anthropicRepairDir = await findExactOrPrefixedDir(
        artifactRoot,
        "anthropic-repair"
      );
      const geminiReviewPath = geminiReviewDir
        ? resolve(geminiReviewDir, "response.txt")
        : null;
      const anthropicReviewPath = anthropicReviewDir
        ? resolve(anthropicReviewDir, "response.txt")
        : null;
      const geminiRepairPath = geminiRepairDir
        ? resolve(geminiRepairDir, "response.txt")
        : null;
      const anthropicRepairPath = anthropicRepairDir
        ? resolve(anthropicRepairDir, "response.txt")
        : null;
      const geminiReview = (await readTextMaybe(geminiReviewPath)) ?? "";
      const anthropicReview = (await readTextMaybe(anthropicReviewPath)) ?? "";
      const geminiRepair = (await readTextMaybe(geminiRepairPath)) ?? "";
      const anthropicRepair = (await readTextMaybe(anthropicRepairPath)) ?? "";
      const latestTune = await loadLatestTuneRun(tuneArtifactRoot);
      const latestTuneChangeRequest = latestTune
        ? (await readTextMaybe(latestTune.changeRequestPath)) ?? ""
        : "";
      const latestTuneDecision = latestTune?.decisionPath
        ? await readJsonMaybe(latestTune.decisionPath)
        : null;
      const latestTuneGptDelta = summarizeDeltaJson(
        latestTune?.gptDeltaPath ? await readJsonMaybe(latestTune.gptDeltaPath) : null
      );
      const latestTuneClaudeDelta = summarizeDeltaJson(
        latestTune?.claudeDeltaPath
          ? await readJsonMaybe(latestTune.claudeDeltaPath)
          : null
      );
      const latestTuneGptRegression = summarizeRegressionJson(
        latestTune?.gptRegressionPath
          ? await readJsonMaybe(latestTune.gptRegressionPath)
          : null
      );
      const latestTuneClaudeRegression = summarizeRegressionJson(
        latestTune?.claudeRegressionPath
          ? await readJsonMaybe(latestTune.claudeRegressionPath)
          : null
      );
      const latestTuneStaticSanity = latestTune?.staticSanityPath
        ? await readJsonMaybe(latestTune.staticSanityPath)
        : null;
      const latestTuneCodexMicroReview = latestTune?.codexMicroReviewPath
        ? (await readTextMaybe(latestTune.codexMicroReviewPath)) ?? ""
        : "";
      const geminiHtmlMeta = await readRequestDocMaybe(
        resolve(tuneArtifactRoot, "gemini-html")
      );
      const currentGeminiHtmlText =
        (await readTextMaybe(geminiHtmlPath)) ?? "";
      const currentGeminiHtmlSha = currentGeminiHtmlText
        ? computeTextSha256(currentGeminiHtmlText)
        : null;
      const tuneApprovalStale = Boolean(
        geminiHtmlMeta?.tune?.approvedHtmlSha256 &&
          currentGeminiHtmlSha &&
          geminiHtmlMeta.tune.approvedHtmlSha256 !== currentGeminiHtmlSha
      );
      const ideationJsonPath = resolve(
        process.cwd(),
        "output",
        "figures",
        "ideation",
        basename(briefPath ?? "").replace(/\.md$/, ""),
        "ideas.json"
      );
      const ideationJson = await readJsonMaybe(ideationJsonPath);

      const activeSlides = getActiveDeckSlides(deckSpec);
      const activeIndex = activeSlides.findIndex((entry) => entry?.id === slideEntry.id);
      const prevSlideEntry =
        activeIndex > 0 ? activeSlides[activeIndex - 1] : null;
      const nextSlideEntry =
        activeIndex >= 0 && activeIndex < activeSlides.length - 1
          ? activeSlides[activeIndex + 1]
          : null;
      const prevSection =
        Number.isInteger(parseDeckSlideDisplayNumber(prevSlideEntry?.displayNumber))
          ? extractSlideSection(
              masterSpecs,
              parseDeckSlideDisplayNumber(prevSlideEntry?.displayNumber)
            )
          : "";
      const currentSection =
        Number.isInteger(slideNumber) ? extractSlideSection(masterSpecs, slideNumber) : "";
      const nextSection =
        Number.isInteger(parseDeckSlideDisplayNumber(nextSlideEntry?.displayNumber))
          ? extractSlideSection(
              masterSpecs,
              parseDeckSlideDisplayNumber(nextSlideEntry?.displayNumber)
            )
          : "";

      const files = [
        { label: "Workflow doc", path: workflowPath },
        { label: "Master slide specs", path: masterSpecsPath },
        { label: "Slide manifest", path: manifestPath },
        { label: "Slide note", path: slideNotePath },
        { label: "Fine-tune request", path: fineTuneRequestPath },
        { label: "Current version dir", path: currentVersionDir },
        { label: "Slide packet", path: packetPath },
        { label: "Figure brief", path: briefPath },
        { label: "Ideation note", path: ideationPath },
        { label: "Composition note", path: compositionPath },
        { label: "Render brief", path: renderBriefPath },
        { label: "Native spec", path: specPath },
        { label: "Process review", path: processReviewPath },
        { label: "Native HTML", path: nativeHtmlPath },
        { label: "Native SVG", path: nativeSvgPath },
        { label: "Native PNG", path: nativeImagePath },
        { label: "Coverage", path: nativeCoveragePath },
        { label: "Meta", path: nativeMetaPath },
        { label: "Gemini image", path: geminiImagePath },
        { label: "Gemini HTML", path: geminiHtmlPath },
        { label: "Gemini HTML preview", path: geminiHtmlPreviewPath },
        { label: "Latest tune state", path: latestTune?.statePath },
        { label: "Latest tune change request", path: latestTune?.changeRequestPath },
        { label: "Latest tune decision", path: latestTune?.decisionPath },
        { label: "Latest tune Codex micro-review", path: latestTune?.codexMicroReviewPath },
        { label: "Codex review", path: codexReviewPath },
        { label: "Gemini review", path: geminiReviewPath },
        { label: "Anthropic review", path: anthropicReviewPath },
        { label: "Assessment synthesis", path: assessmentSynthesisPath },
        { label: "Codex repair", path: codexRepairPath },
        { label: "Gemini repair", path: geminiRepairPath },
        { label: "Anthropic repair", path: anthropicRepairPath },
        { label: "Repair synthesis", path: repairSynthesisPath },
        { label: "Next pass", path: nextPassPath },
      ];

      const codexSummary = summarizeReview(codexReview);
      const geminiSummary = summarizeReview(geminiReview);
      const anthropicSummary = summarizeReview(anthropicReview);
      const codexRepairSummary = summarizeRepair(codexRepair);
      const geminiRepairSummary = summarizeRepair(geminiRepair);
      const anthropicRepairSummary = summarizeRepair(anthropicRepair);

      const visualBranches = [
        existsSync(nativeImagePath) ? "Native render" : null,
        existsSync(geminiImagePath) ? "Gemini image branch" : null,
        existsSync(geminiHtmlPreviewPath) ? "Gemini HTML branch" : null,
      ].filter(Boolean);

      const reviewBranches = [
        codexReview ? "Codex review" : null,
        geminiReview ? "Gemini review" : null,
        anthropicReview ? "Anthropic review" : null,
      ].filter(Boolean);

      const repairBranches = [
        codexRepair ? "Codex repair" : null,
        geminiRepair ? "Gemini repair" : null,
        anthropicRepair ? "Anthropic repair" : null,
      ].filter(Boolean);
      const tuneBlockers = [
        ...(latestTuneStaticSanity?.blockers ?? []),
        ...(latestTuneGptRegression?.blockers ?? []),
        ...(latestTuneClaudeRegression?.blockers ?? []),
      ].filter(Boolean);

      const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(`Designer ${slideSlug} report`)}</title>
    <style>
      :root {
        --bg: #f5f7fb;
        --panel: #ffffff;
        --text: #12202f;
        --muted: #617286;
        --line: #dbe3ec;
        --accent: #4a89c8;
        --accent-soft: #eef5fc;
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
        max-width: 1380px;
        margin: 0 auto;
      }
      .hero {
        padding: 30px 32px;
        border: 1px solid var(--line);
        border-radius: 28px;
        background: radial-gradient(circle at top right, rgba(74, 137, 200, 0.09), transparent 32%), var(--panel);
        box-shadow: var(--shadow);
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
      .summary {
        margin-top: 14px;
        max-width: 940px;
        font-size: 19px;
        line-height: 1.45;
        color: var(--muted);
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 20px;
      }
      .file-chip, .mini-chip {
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
      .grid {
        display: grid;
        gap: 20px;
        margin-top: 24px;
      }
      .grid.context {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .grid.visuals {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .grid.summary {
        grid-template-columns: 1.2fr 1fr 1fr;
      }
      .card, .step {
        border: 1px solid var(--line);
        border-radius: var(--radius);
        background: var(--panel);
        box-shadow: var(--shadow);
      }
      .card {
        padding: 22px 24px;
      }
      .step {
        margin-top: 22px;
        overflow: hidden;
      }
      .step-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        padding: 20px 24px;
        border-bottom: 1px solid var(--line);
        background: linear-gradient(180deg, rgba(238, 245, 252, 0.68), rgba(255,255,255,0.98));
      }
      .step-index {
        color: var(--accent);
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .step-title {
        margin-top: 6px;
        font-size: 26px;
        line-height: 1.1;
        letter-spacing: -0.03em;
      }
      .step-body {
        padding: 24px;
      }
      .markdown h1, .markdown h2, .markdown h3, .markdown h4 {
        margin: 1.1em 0 0.45em;
        line-height: 1.15;
      }
      .markdown h1 { font-size: 30px; }
      .markdown h2 { font-size: 24px; }
      .markdown h3 { font-size: 18px; text-transform: none; }
      .markdown p, .markdown li {
        font-size: 16px;
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
      .markdown pre {
        padding: 14px 16px;
        border-radius: 16px;
        background: #0f1720;
        color: #eff6ff;
        overflow: auto;
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
        padding: 18px;
        border-radius: 16px;
        border: 1px dashed var(--line);
        color: var(--muted);
        background: #fbfcfe;
      }
      .shortlist {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 14px;
      }
      .note {
        margin-top: 10px;
        color: var(--muted);
        font-size: 15px;
        line-height: 1.5;
      }
      .summary-list {
        display: grid;
        gap: 10px;
        margin-top: 14px;
      }
      .summary-item {
        padding: 12px 14px;
        border-radius: 14px;
        background: #f8fbfe;
        border: 1px solid var(--line);
      }
      .summary-item strong {
        display: block;
        margin-bottom: 6px;
        font-size: 13px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--accent);
      }
      .review-grid {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .review-card {
        padding: 18px;
        border-radius: 18px;
        border: 1px solid var(--line);
        background: #fbfdff;
      }
      .review-card h3 {
        margin: 0;
        font-size: 18px;
        line-height: 1.1;
      }
      .review-card p {
        margin: 12px 0 0;
        font-size: 15px;
        line-height: 1.5;
        color: #243344;
      }
      @media (max-width: 1100px) {
        .grid.context, .grid.visuals, .grid.summary, .review-grid { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <section class="hero">
        <div class="eyebrow">Designer Health Slide Report</div>
        <h1>${escapeHtml(`Slide ${slideNumberLabel} report`)}</h1>
        <div class="summary">
          This report captures the full working pass for ${escapeHtml(
            slideSlug
          )}, but it leads with the decision: what happened, what was made, what
          the three reviewers said, and what happens next.
        </div>
        ${
          manifest?.currentVersionId
            ? `<div class="chips"><span class="mini-chip">Current version: ${escapeHtml(
                manifest.currentVersionId
              )}</span></div>`
            : ""
        }
        <div class="chips">${renderFileList(files)}</div>
      </section>

      <section class="grid summary">
        <article class="card">
          <div class="eyebrow">Executive Summary</div>
          <div class="markdown">${markdownToHtml(
            assessmentSynthesis || "_No assessment synthesis found._"
          )}</div>
        </article>
        <article class="card">
          <div class="eyebrow">What Was Made</div>
          <div class="summary-list">
            <div class="summary-item"><strong>Visual branches</strong>${renderMiniChips(visualBranches)}</div>
            <div class="summary-item"><strong>Reviews run</strong>${renderMiniChips(reviewBranches)}</div>
            <div class="summary-item"><strong>Repair consults</strong>${renderMiniChips(repairBranches)}</div>
            <div class="summary-item"><strong>Latest micro-pass</strong>${escapeHtml(
              latestTune?.state?.status || "No micro-pass recorded"
            )}</div>
            <div class="summary-item"><strong>Approval state</strong>${escapeHtml(
              tuneApprovalStale
                ? "Stale: current Gemini HTML changed after the last approved micro-pass"
                : geminiHtmlMeta?.tune?.approvedAt
                  ? `Approved at ${geminiHtmlMeta.tune.approvedAt}`
                  : "No approved micro-pass yet"
            )}</div>
            <div class="summary-item"><strong>Current native spec</strong>${escapeHtml(
              basename(specPath || "missing")
            )}</div>
          </div>
        </article>
        <article class="card">
          <div class="eyebrow">What Happens Next</div>
          <div class="markdown">${markdownToHtml(
            nextPass || "_No next-pass plan found._"
          )}</div>
        </article>
      </section>

      <section class="step" id="assessments">
        <div class="step-head">
          <div>
            <div class="step-index">Assessments</div>
            <div class="step-title">Three-review readout</div>
          </div>
        </div>
        <div class="step-body">
          <div class="review-grid">
            <article class="review-card">
              <h3>Codex</h3>
              <p>${escapeHtml(
                codexSummary?.verdict || "No Codex review summary found."
              )}</p>
              ${
                codexSummary?.nextMove
                  ? `<p><strong>Next:</strong> ${escapeHtml(codexSummary.nextMove)}</p>`
                  : ""
              }
            </article>
            <article class="review-card">
              <h3>Gemini</h3>
              <p>${escapeHtml(
                geminiSummary?.verdict || "No Gemini review summary found."
              )}</p>
              ${
                geminiSummary?.nextMove
                  ? `<p><strong>Next:</strong> ${escapeHtml(geminiSummary.nextMove)}</p>`
                  : ""
              }
            </article>
            <article class="review-card">
              <h3>Anthropic</h3>
              <p>${escapeHtml(
                anthropicSummary?.verdict || "No Anthropic review summary found."
              )}</p>
              ${
                anthropicSummary?.nextMove
                  ? `<p><strong>Next:</strong> ${escapeHtml(anthropicSummary.nextMove)}</p>`
                  : ""
              }
            </article>
          </div>
        </div>
      </section>

      <section class="step" id="repair">
        <div class="step-head">
          <div>
            <div class="step-index">Repair</div>
            <div class="step-title">What the three tools said to do next</div>
          </div>
        </div>
        <div class="step-body">
          <div class="review-grid">
            <article class="review-card">
              <h3>Codex repair</h3>
              <p>${escapeHtml(
                codexRepairSummary?.family || "No Codex repair summary found."
              )}</p>
              ${
                codexRepairSummary?.nextMove
                  ? `<p><strong>Next:</strong> ${escapeHtml(codexRepairSummary.nextMove)}</p>`
                  : ""
              }
            </article>
            <article class="review-card">
              <h3>Gemini repair</h3>
              <p>${escapeHtml(
                geminiRepairSummary?.family || "No Gemini repair summary found."
              )}</p>
              ${
                geminiRepairSummary?.nextMove
                  ? `<p><strong>Next:</strong> ${escapeHtml(geminiRepairSummary.nextMove)}</p>`
                  : ""
              }
            </article>
            <article class="review-card">
              <h3>Anthropic repair</h3>
              <p>${escapeHtml(
                anthropicRepairSummary?.family || "No Anthropic repair summary found."
              )}</p>
              ${
                anthropicRepairSummary?.nextMove
                  ? `<p><strong>Next:</strong> ${escapeHtml(anthropicRepairSummary.nextMove)}</p>`
                  : ""
              }
            </article>
          </div>
          <div class="card" style="margin-top:16px;">
            <div class="eyebrow">Repair synthesis</div>
            <div class="markdown">${markdownToHtml(
              repairSynthesis || "_No repair synthesis found._"
            )}</div>
          </div>
        </div>
      </section>

      <section class="grid context">
        <article class="card">
          <div class="eyebrow">Lead In</div>
          <div class="markdown">${markdownToHtml(prevSection || "_No prior slide section found._")}</div>
        </article>
        <article class="card">
          <div class="eyebrow">Current Slide</div>
          <div class="markdown">${markdownToHtml(currentSection || "_No current slide section found._")}</div>
        </article>
        <article class="card">
          <div class="eyebrow">What Comes Next</div>
          <div class="markdown">${markdownToHtml(nextSection || "_No next slide section found._")}</div>
        </article>
      </section>

      <section class="step" id="workflow">
        <div class="step-head">
          <div>
            <div class="step-index">Workflow</div>
            <div class="step-title">Current project methodology</div>
          </div>
        </div>
        <div class="step-body">
          <div class="markdown">${markdownToHtml(workflow)}</div>
        </div>
      </section>

      <section class="step" id="packet">
        <div class="step-head">
          <div>
            <div class="step-index">Step 1</div>
            <div class="step-title">Slide packet</div>
          </div>
        </div>
        <div class="step-body">
          <div class="markdown">${markdownToHtml(packet)}</div>
        </div>
      </section>

      <section class="step" id="brief">
        <div class="step-head">
          <div>
            <div class="step-index">Step 2</div>
            <div class="step-title">Figure brief</div>
          </div>
        </div>
        <div class="step-body">
          <div class="markdown">${markdownToHtml(brief)}</div>
        </div>
      </section>

      <section class="step" id="ideation">
        <div class="step-head">
          <div>
            <div class="step-index">Step 3</div>
            <div class="step-title">Ideation synthesis</div>
          </div>
        </div>
        <div class="step-body">
          ${
            ideationJson
              ? `
                <div class="eyebrow">Raw model summary</div>
                <div class="note">${escapeHtml(ideationJson.summary ?? "")}</div>
                <div class="shortlist">
                  ${String(ideationJson.shortlist ?? [])
                    .split(",")
                    .filter(Boolean)
                    .map((item) => `<span class="mini-chip">${escapeHtml(item.trim())}</span>`)
                    .join("")}
                </div>
              `
              : ""
          }
          <div class="markdown">${markdownToHtml(ideation)}</div>
        </div>
      </section>

      <section class="step" id="composition">
        <div class="step-head">
          <div>
            <div class="step-index">Step 4</div>
            <div class="step-title">Composition choice</div>
          </div>
        </div>
        <div class="step-body">
          <div class="markdown">${markdownToHtml(composition)}</div>
        </div>
      </section>

      <section class="step" id="render-brief">
        <div class="step-head">
          <div>
            <div class="step-index">Step 5</div>
            <div class="step-title">Render brief</div>
          </div>
        </div>
        <div class="step-body">
          <div class="markdown">${markdownToHtml(renderBrief)}</div>
        </div>
      </section>

      ${
        latestTune
          ? `
      <section class="step" id="micro-pass">
        <div class="step-head">
          <div>
            <div class="step-index">Step 5A</div>
            <div class="step-title">Latest micro-tune pass</div>
          </div>
        </div>
        <div class="step-body">
          <div class="summary-list">
            <div class="summary-item"><strong>Requested delta</strong>${escapeHtml(
              latestTuneChangeRequest || "No change request found."
            )}</div>
            <div class="summary-item"><strong>Run status</strong>${escapeHtml(
              latestTune.state?.status || "Unknown"
            )}</div>
            <div class="summary-item"><strong>Delta verdict</strong>${escapeHtml(
              [latestTuneGptDelta?.status, latestTuneClaudeDelta?.status]
                .filter(Boolean)
                .join(" / ") || "No delta verdict recorded."
            )}</div>
            <div class="summary-item"><strong>Regression verdict</strong>${escapeHtml(
              [latestTuneGptRegression?.verdict, latestTuneClaudeRegression?.verdict]
                .filter(Boolean)
                .join(" / ") || "No regression verdict recorded."
            )}</div>
            <div class="summary-item"><strong>Unique blocker findings</strong>${
              tuneBlockers.length > 0
                ? `<ul>${tuneBlockers
                    .map((entry) => `<li>${escapeHtml(entry)}</li>`)
                    .join("")}</ul>`
                : "No blocker findings recorded."
            }</div>
          </div>
          <div class="grid visuals" style="margin-top:16px;">
            <article class="card">
              <div class="eyebrow">Before</div>
              ${cardImage(latestTune.baselinePreviewPath, {
                href: latestTune.baselinePreviewPath
                  ? relativeHref(outPath, latestTune.baselinePreviewPath)
                  : ".",
                alt: "Baseline preview",
                caption: "Baseline preview before the latest micro-pass."
              })}
            </article>
            <article class="card">
              <div class="eyebrow">After</div>
              ${cardImage(latestTune.latestPreviewPath, {
                href: latestTune.latestPreviewPath
                  ? relativeHref(outPath, latestTune.latestPreviewPath)
                  : ".",
                alt: "Candidate preview",
                caption: "Candidate preview produced by the latest micro-pass."
              })}
            </article>
            <article class="card">
              <div class="eyebrow">Operator note</div>
              <div class="markdown">${markdownToHtml(
                latestTuneCodexMicroReview || "_No Codex/operator micro-review note found yet._"
              )}</div>
            </article>
          </div>
          <div class="review-grid" style="margin-top:16px;">
            <article class="review-card">
              <h3>GPT delta</h3>
              <p>${escapeHtml(
                latestTuneGptDelta?.summary || "No GPT delta review found."
              )}</p>
            </article>
            <article class="review-card">
              <h3>Claude delta</h3>
              <p>${escapeHtml(
                latestTuneClaudeDelta?.summary || "No Claude delta review found."
              )}</p>
            </article>
            <article class="review-card">
              <h3>GPT regression</h3>
              <p>${escapeHtml(
                latestTuneGptRegression?.rationale || "No GPT regression review found."
              )}</p>
            </article>
            <article class="review-card">
              <h3>Claude regression</h3>
              <p>${escapeHtml(
                latestTuneClaudeRegression?.rationale || "No Claude regression review found."
              )}</p>
            </article>
          </div>
        </div>
      </section>
      `
          : ""
      }

      <section class="step" id="outputs">
        <div class="step-head">
          <div>
            <div class="step-index">Step 6</div>
            <div class="step-title">Visual branches</div>
          </div>
        </div>
        <div class="step-body">
          <div class="grid visuals">
            <article class="card">
              <div class="eyebrow">Native preferred branch</div>
              ${cardImage(nativeImagePath, {
                href: relativeHref(outPath, nativeImagePath),
                alt: "Native slide preview",
                caption: "Current preferred native branch stamped from the canonical spec."
              })}
            </article>
            <article class="card">
              <div class="eyebrow">Gemini image branch</div>
              ${cardImage(geminiImagePath, {
                href: relativeHref(outPath, geminiImagePath),
                alt: "Gemini image branch",
                caption: "Gemini image pass used as a taste and composition comparison branch."
              })}
            </article>
            <article class="card">
              <div class="eyebrow">Gemini HTML branch</div>
              ${cardImage(geminiHtmlPreviewPath, {
                href: relativeHref(outPath, geminiHtmlPreviewPath),
                alt: "Gemini HTML preview",
                caption: "PNG preview of the Gemini HTML branch generated via html:screenshot."
              })}
            </article>
          </div>
        </div>
      </section>

      <section class="step" id="review">
        <div class="step-head">
          <div>
            <div class="step-index">Step 7</div>
            <div class="step-title">Process review and decision</div>
          </div>
        </div>
        <div class="step-body">
          <div class="markdown">${markdownToHtml(processReview)}</div>
        </div>
      </section>
    </div>
  </body>
</html>
`;

      await writeFile(outPath, html, "utf8");
      process.stdout.write(`${outPath}\n`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
};

await main();
