import { createHash } from "node:crypto";

const normalizeText = (value) => String(value ?? "").replace(/\r\n/g, "\n").trim();

const sectionRegex = (heading, nextHeading) =>
  new RegExp(
    `(?:^|\\n)##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+${nextHeading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n|$)`,
    "i"
  );

const extractSection = (text, heading, nextHeading = null) => {
  const normalized = normalizeText(text);
  const pattern = nextHeading
    ? sectionRegex(heading, nextHeading)
    : new RegExp(
        `(?:^|\\n)##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n([\\s\\S]*)$`,
        "i"
      );
  const match = normalized.match(pattern);
  return match?.[1] ? match[1].trim() : "";
};

const truncate = (value, maxLength = 80) => {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}…`;
};

export const computeTextSha256 = (text) =>
  createHash("sha256").update(String(text ?? ""), "utf8").digest("hex");

export const checkHtmlStaticSanity = (htmlText) => {
  const normalized = String(htmlText ?? "").replace(/^\uFEFF/, "");
  const blockers = [];

  const withoutDoctype = normalized.replace(/^\s*<!doctype[^>]*>\s*/i, "");
  const withoutComments = withoutDoctype.replace(/^(?:\s*<!--[\s\S]*?-->\s*)*/, "");
  const rootMatch = withoutComments.match(/<(svg|html)\b/i);

  if (!rootMatch) {
    blockers.push("Missing root <svg> or <html> tag.");
    return {
      ok: false,
      summary: "Generated HTML is structurally invalid before rendering.",
      blockers,
    };
  }

  const rootIndex = rootMatch.index ?? 0;
  const preamble = withoutComments.slice(0, rootIndex).trim();
  if (preamble) {
    blockers.push(`Stray preamble text before root tag: "${truncate(preamble)}"`);
  }

  return {
    ok: blockers.length === 0,
    summary:
      blockers.length === 0
        ? "No static sanity issues detected before render."
        : "Static sanity check found visible pre-render blockers.",
    blockers,
  };
};

export const parseCodexMicroReview = (text) => {
  const verdictText = extractSection(text, "Verdict", "What changed");
  const whatChanged = extractSection(text, "What changed", "Regressions");
  const regressions = extractSection(text, "Regressions", "Notes");
  const notes = extractSection(text, "Notes");

  if (!verdictText) {
    throw new Error(
      "Codex micro-review must include a `## Verdict` section with `promote` or `block`."
    );
  }

  const lowered = verdictText.toLowerCase();
  let verdict = null;
  if (/\bpromote\b/.test(lowered) && !/\bblock\b/.test(lowered)) {
    verdict = "promote";
  } else if (/\bblock\b/.test(lowered) && !/\bpromote\b/.test(lowered)) {
    verdict = "block";
  }

  if (!verdict) {
    throw new Error(
      "Codex micro-review verdict must clearly say either `promote` or `block`."
    );
  }

  return {
    verdict,
    verdictText: normalizeText(verdictText),
    whatChanged: normalizeText(whatChanged),
    regressions: normalizeText(regressions),
    notes: normalizeText(notes),
  };
};

export const buildCodexMicroReviewTemplate = ({
  changeRequest,
  deltaSummary,
  regressionSummary,
  blockers = [],
} = {}) =>
  [
    "## Verdict",
    "TODO: promote or block",
    "",
    "## What changed",
    normalizeText(changeRequest) || "Describe the requested delta and whether it happened.",
    deltaSummary ? `Automated delta summary: ${normalizeText(deltaSummary)}` : "",
    "",
    "## Regressions",
    blockers.length > 0
      ? blockers.map((entry) => `- ${normalizeText(entry)}`).join("\n")
      : "- None observed.",
    regressionSummary
      ? `Automated regression summary: ${normalizeText(regressionSummary)}`
      : "",
    "",
    "## Notes",
    "- Focus on whether the current candidate is safe to promote.",
    "- If blocking, name the concrete visual break.",
    "- If promoting, confirm no concrete regressions remain.",
    "",
  ]
    .filter(Boolean)
    .join("\n");
