import {
  DEFAULT_OPENAI_HTML_MAX_OUTPUT_TOKENS,
  DEFAULT_OPENAI_HTML_MODEL,
  generateOpenAIHtml,
  writeOpenAIHtmlArtifacts,
} from "../openai-html-lib.mjs";

const formatApprovedRegions = (approvedRegions = []) => {
  if (!Array.isArray(approvedRegions) || approvedRegions.length === 0) {
    return "None.";
  }

  return approvedRegions
    .map((region) =>
      [
        `- ${region.label || region.id || "Region"}`,
        `freeze=${region.freezeLevel || "semantic-stable"}`,
        `rect=(${region.x},${region.y},${region.width},${region.height})`,
        region.note ? `note=${region.note}` : "",
      ]
        .filter(Boolean)
        .join(" | ")
    )
    .join("\n");
};

const buildReferenceIntent = ({
  parentPreviewPath,
  officialPreviewPath,
  referenceImagePaths = [],
}) =>
  [
    `Image 1: official baseline preview (${officialPreviewPath})`,
    `Image 2: parent preview to edit from (${parentPreviewPath})`,
    ...referenceImagePaths.map(
      (imagePath, index) => `Image ${index + 3}: additional reference (${imagePath})`
    ),
  ].join("\n");

export const buildOpenAIHtmlEditPrompt = ({
  runType = "edit",
  mode = "repair",
  editableHtml,
  parentPreviewPath,
  officialPreviewPath,
  requestedChange,
  successChecks,
  guardrails = "",
  approvedRegions = [],
  referenceIntent = "",
  stopIf = "",
  retryBrief = "",
  slotVariationNote = "",
  referenceImagePaths = [],
}) =>
  [
    runType === "create"
      ? "You are authoring a fresh self-contained HTML deck slide from a seeded blank shell."
      : "You are editing an existing self-contained HTML deck slide.",
    runType === "create"
      ? "The current HTML is only a seeded shell. Fully resolve it into a finished slide and return one complete replacement HTML document only."
      : "The current HTML is the source of truth. Return one complete replacement HTML document only.",
    "Use inline CSS only. Inline SVG is allowed and preferred for lines, connectors, rulers, and geometry.",
    "Do not return markdown, commentary, code fences, patches, or explanations.",
    runType === "create"
      ? "Preserve the locked Designer shell, footer rule, footer logo, and deck-family continuity while building the actual slide content."
      : "Preserve family continuity unless the requested change explicitly requires otherwise.",
    "The output must remain a finished 1920x1080 presentation graphic, not a browser page or fragment.",
    runType === "create"
      ? "Remove placeholder copy and figure-stub elements. Do not leave Header, Subheader, or Graphic / Figure placeholders behind."
      : mode === "explore"
        ? "If a slightly broader local rethink helps the request, keep it within the same slide family."
        : "",
    "",
    "## Requested change",
    String(requestedChange ?? "").trim(),
    "",
    "## Success checks",
    String(successChecks ?? "").trim(),
    "",
    "## Guardrails",
    String(guardrails ?? "").trim() || "None.",
    "",
    "## Approved regions",
    formatApprovedRegions(approvedRegions),
    "",
    "## Slot variation",
    String(slotVariationNote ?? "").trim() || "Preserve family and make the requested change.",
    "",
    "## Retry brief",
    String(retryBrief ?? "").trim() || "None.",
    "",
    "## Stop if",
    String(stopIf ?? "").trim() || "Do not invent new content that breaks the current slide family.",
    "",
    "## Reference intent",
    String(referenceIntent ?? "").trim() ||
      "Use the image inputs for baseline comparison, family continuity, and optional quotation only.",
    "",
    "## Attached image order",
    buildReferenceIntent({
      parentPreviewPath,
      officialPreviewPath,
      referenceImagePaths,
    }),
    "",
    "## Current editable HTML",
    "```html",
    String(editableHtml ?? "").trim(),
    "```",
  ].join("\n");

export const generateOpenAIHtmlEditCandidate = async ({
  runType = "edit",
  mode = "repair",
  outputDir,
  editableHtml,
  parentPreviewPath,
  officialPreviewPath,
  referenceImagePaths = [],
  requestedChange,
  successChecks,
  guardrails = "",
  approvedRegions = [],
  referenceIntent = "",
  stopIf = "",
  retryBrief = "",
  slotVariationNote = "",
  model = DEFAULT_OPENAI_HTML_MODEL,
  temperature = undefined,
  reasoning = undefined,
  maxOutputTokens = DEFAULT_OPENAI_HTML_MAX_OUTPUT_TOKENS,
  saveRaw = false,
}) => {
  const prompt = buildOpenAIHtmlEditPrompt({
    runType,
    mode,
    editableHtml,
    parentPreviewPath,
    officialPreviewPath,
    requestedChange,
    successChecks,
    guardrails,
    approvedRegions,
    referenceIntent,
    stopIf,
    retryBrief,
    slotVariationNote,
    referenceImagePaths,
  });
  const imagePaths = [
    officialPreviewPath,
    parentPreviewPath,
    ...referenceImagePaths,
  ].filter(Boolean);

  const startedAt = Date.now();
  const result = await generateOpenAIHtml({
    prompt,
    imagePaths,
    model,
    temperature,
    reasoning,
    maxOutputTokens,
  });
  const elapsedMs = Date.now() - startedAt;
  const artifacts = await writeOpenAIHtmlArtifacts({
    dir: outputDir,
    prompt,
    model,
    imagePaths,
    temperature,
    reasoning,
    maxOutputTokens,
    result,
    saveRaw,
    elapsedMs,
  });

  return {
    provider: "openai",
    model,
    temperature,
    reasoning,
    prompt,
    elapsedMs,
    imagePaths,
    result,
    artifacts,
  };
};
