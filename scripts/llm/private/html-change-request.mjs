import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const REQUIRED_SECTIONS = ["Requested change", "Success checks"];
const OPTIONAL_SECTIONS = [
  "Approved regions",
  "Guardrails",
  "Reference intent",
  "Stop if",
];

const normalizeText = (value) => String(value ?? "").replace(/\r\n/g, "\n").trim();

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const sectionRegex = (heading) =>
  new RegExp(
    `(?:^|\\n)##\\s+${escapeRegExp(heading)}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+[^\\n]+\\s*\\n|$)`,
    "i"
  );

const extractSection = (text, heading) => {
  const match = normalizeText(text).match(sectionRegex(heading));
  return match?.[1] ? match[1].trim() : "";
};

const coerceFreezeLevel = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "pixel-strict" ? "pixel-strict" : "semantic-stable";
};

const coerceApprovedRegion = (value, index) => {
  if (!value || typeof value !== "object") {
    throw new Error(`approved region ${index + 1} must be an object`);
  }

  const x = Number(value.x);
  const y = Number(value.y);
  const width = Number(value.width);
  const height = Number(value.height);

  for (const [label, numericValue] of [
    ["x", x],
    ["y", y],
    ["width", width],
    ["height", height],
  ]) {
    if (!Number.isFinite(numericValue)) {
      throw new Error(`approved region ${index + 1} is missing numeric ${label}`);
    }
  }

  return {
    id: String(value.id ?? `region-${index + 1}`).trim() || `region-${index + 1}`,
    label: String(value.label ?? `Region ${index + 1}`).trim() || `Region ${index + 1}`,
    shape: "rect",
    x,
    y,
    width,
    height,
    freezeLevel: coerceFreezeLevel(value.freezeLevel),
    note: String(value.note ?? "").trim(),
  };
};

export const parseApprovedRegions = (value) => {
  if (!Array.isArray(value)) {
    throw new Error("Approved regions must be an array.");
  }
  return value.map((entry, index) => coerceApprovedRegion(entry, index));
};

const parseApprovedRegionsSection = (text) => {
  const normalized = normalizeText(text);
  if (!normalized) {
    return [];
  }

  const fencedMatch = normalized.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : normalized;
  if (!candidate.startsWith("[") && !candidate.startsWith("{")) {
    return [];
  }
  const parsed = JSON.parse(candidate);
  return parseApprovedRegions(Array.isArray(parsed) ? parsed : [parsed]);
};

export const parseHtmlChangeRequestText = (text) => {
  const requestedChange = extractSection(text, "Requested change");
  const successChecks = extractSection(text, "Success checks");
  const approvedRegionsText = extractSection(text, "Approved regions");
  const guardrails = extractSection(text, "Guardrails");
  const referenceIntent = extractSection(text, "Reference intent");
  const stopIf = extractSection(text, "Stop if");

  if (!requestedChange || !successChecks) {
    throw new Error(
      "Change file must include `## Requested change` and `## Success checks` sections."
    );
  }

  return {
    requestedChange,
    successChecks,
    guardrails,
    approvedRegionsText,
    referenceIntent,
    stopIf,
  };
};

export const normalizeHtmlChangeRequest = ({
  markdownText,
  approvedRegions = [],
  approvedRegionsPath = null,
  changeFilePath = null,
}) => {
  const parsed = parseHtmlChangeRequestText(markdownText);
  return {
    ...parsed,
    approvedRegions,
    approvedRegionsPath,
    changeFilePath,
    rawMarkdown: normalizeText(markdownText),
  };
};

export const loadHtmlChangeRequest = async ({
  changeFilePath,
  approvedRegionsFilePath = null,
}) => {
  const resolvedChangeFilePath = resolve(String(changeFilePath));
  const markdownText = await readFile(resolvedChangeFilePath, "utf8");

  const resolvedApprovedRegionsPath = approvedRegionsFilePath
    ? resolve(String(approvedRegionsFilePath))
    : resolve(dirname(resolvedChangeFilePath), "approved-regions.json");

  let approvedRegions = [];
  let approvedRegionsPath = null;
  if (existsSync(resolvedApprovedRegionsPath)) {
    approvedRegions = parseApprovedRegions(
      JSON.parse(await readFile(resolvedApprovedRegionsPath, "utf8"))
    );
    approvedRegionsPath = resolvedApprovedRegionsPath;
  } else {
    approvedRegions = parseApprovedRegionsSection(
      extractSection(markdownText, "Approved regions")
    );
  }

  return normalizeHtmlChangeRequest({
    markdownText,
    approvedRegions,
    approvedRegionsPath,
    changeFilePath: resolvedChangeFilePath,
  });
};

export const HTML_CHANGE_REQUEST_SECTIONS = {
  required: REQUIRED_SECTIONS,
  optional: OPTIONAL_SECTIONS,
};
