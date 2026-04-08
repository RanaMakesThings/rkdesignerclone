import { existsSync } from "node:fs";

import { checkHtmlStaticSanity } from "./html-tune-state.mjs";
import { evaluateLockedRegions } from "./html-locked-regions.mjs";

const CREATE_PLACEHOLDER_RULES = [
  {
    pattern: /designer blank slide template/i,
    message: "Candidate still contains the blank template title text.",
  },
  {
    pattern: /figure-stub/i,
    message: "Candidate still contains the figure-stub placeholder.",
  },
  {
    pattern: /stub-label/i,
    message: "Candidate still contains stub-label placeholder markup.",
  },
  {
    pattern: />\s*graphic\s*\/\s*figure\s*</i,
    message: "Candidate still shows the Graphic / Figure placeholder label.",
  },
  {
    pattern: />\s*header\s*</i,
    message: "Candidate still shows the Header placeholder.",
  },
  {
    pattern: />\s*subheader\s*</i,
    message: "Candidate still shows the Subheader placeholder.",
  },
];

const normalizeComparableHtml = (value) =>
  String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const hasRenderableHtml = (htmlText) => {
  const text = String(htmlText ?? "").trim();
  return /^<!doctype html/i.test(text) || /<html[\s>]/i.test(text);
};

export const runHtmlCandidatePrefilter = async ({
  runType = "edit",
  htmlText,
  htmlPath,
  previewPath,
  officialPreviewPath,
  officialHtmlText = "",
  requiredTextSnippets = [],
  approvedRegions = [],
}) => {
  const blockers = [];
  const warnings = [];

  const staticSanity = checkHtmlStaticSanity(htmlText);
  if (!staticSanity.ok) {
    blockers.push(...(staticSanity.blockers ?? []));
  }

  const contract = {
    hasHtml: Boolean(String(htmlText ?? "").trim()),
    hasRenderableHtml: hasRenderableHtml(htmlText),
    htmlExists: existsSync(htmlPath),
    previewExists: existsSync(previewPath),
  };

  if (!contract.hasHtml) {
    blockers.push("Generated candidate HTML is empty.");
  }
  if (!contract.hasRenderableHtml) {
    blockers.push("Generated candidate HTML does not look like a full HTML document.");
  }
  if (!contract.htmlExists) {
    blockers.push("Generated candidate HTML file is missing on disk.");
  }
  if (!contract.previewExists) {
    blockers.push("Candidate preview is missing on disk.");
  }

  if (runType === "create") {
    for (const rule of CREATE_PLACEHOLDER_RULES) {
      if (rule.pattern.test(String(htmlText ?? ""))) {
        blockers.push(rule.message);
      }
    }

    const normalizedCandidate = normalizeComparableHtml(htmlText);
    const normalizedOfficial = normalizeComparableHtml(officialHtmlText);
    if (normalizedCandidate && normalizedOfficial && normalizedCandidate === normalizedOfficial) {
      blockers.push("Candidate is still effectively the seeded blank shell.");
    }

    for (const snippet of requiredTextSnippets) {
      const normalizedSnippet = String(snippet ?? "").trim();
      if (!normalizedSnippet) {
        continue;
      }
      if (!String(htmlText ?? "").includes(normalizedSnippet)) {
        warnings.push(`Candidate appears to be missing required locked copy: "${normalizedSnippet}".`);
      }
    }
  }

  let lockedRegions = {
    ok: true,
    violations: [],
    warnings: [],
    summary: "No approved regions defined.",
  };
  if (contract.previewExists && officialPreviewPath && approvedRegions.length > 0) {
    lockedRegions = await evaluateLockedRegions({
      officialPreviewPath,
      candidatePreviewPath: previewPath,
      approvedRegions,
    });
    if (!lockedRegions.ok) {
      blockers.push(...lockedRegions.violations.map((entry) => lockedRegions.summary || entry.label));
    }
    warnings.push(...lockedRegions.warnings.map((entry) => `${entry.label} drifted beyond semantic-stable threshold.`));
  }

  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
    summary:
      blockers.length === 0
        ? warnings.length > 0
          ? `Prefilter passed with warnings. ${warnings.join(" ")}`
          : "Prefilter passed."
        : blockers.join(" "),
    staticSanity,
    contract,
    lockedRegions,
  };
};
