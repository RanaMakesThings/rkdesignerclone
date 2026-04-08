import { basename } from "node:path";

const trimText = (value) => String(value ?? "").replace(/\r\n/g, "\n").trim();

const excerpt = (value, maxChars = 2400) => {
  const normalized = trimText(value);
  if (!normalized) {
    return "";
  }
  return normalized.length > maxChars
    ? `${normalized.slice(0, maxChars).trimEnd()}\n\n[truncated]`
    : normalized;
};

const bulletList = (items = []) =>
  items
    .filter(Boolean)
    .map((item) => `- ${item}`)
    .join("\n");

const buildRequestedChange = ({
  slide,
  lane,
  packetText,
  noteReadmeText,
  referenceFileSnapshots,
}) => {
  const lines = [
    "Create a finished Designer deck slide from the seeded blank template.",
    "",
    `Slide id: ${slide.id}`,
    `Lane: ${lane}`,
    `Slide title: ${slide.title || "(missing title)"}`,
    `Locked header: ${slide.header || "(none)"}`,
    `Locked subheader: ${slide.subheader || "(none)"}`,
    `Audience should leave believing: ${slide.takeaway || slide.purpose || "(not recorded)"}`,
    `Core claim: ${slide.takeaway || slide.figureRole || slide.purpose || "(not recorded)"}`,
    `Slide job: ${slide.purpose || slide.figureRole || "(not recorded)"}`,
    `Figure burden: ${slide.figureRole || "(not recorded)"}`,
    `Figure logic: ${slide.selectedDirection || slide.family || "(not recorded)"}`,
    `Build status: ${slide.buildStatus || "(not recorded)"}`,
    "",
  ];

  if (slide.specText) {
    lines.push("Locked spec guidance:");
    lines.push(excerpt(slide.specText));
    lines.push("");
  }

  if (packetText) {
    lines.push("Slide packet excerpt:");
    lines.push(excerpt(packetText));
    lines.push("");
  }

  if (noteReadmeText) {
    lines.push("Existing slide note excerpt:");
    lines.push(excerpt(noteReadmeText, 1600));
    lines.push("");
  }

  if (referenceFileSnapshots.length > 0) {
    lines.push("Supplemental reference excerpts:");
    for (const snapshot of referenceFileSnapshots) {
      lines.push(`${basename(snapshot.path)}:`);
      lines.push(excerpt(snapshot.content, 1200) || "(binary or unreadable reference)");
      lines.push("");
    }
  }

  lines.push("Must not become:");
  lines.push("- a browser page, generic app UI, or component gallery unless the brief explicitly requires it");
  lines.push("- a placeholder shell with the figure stub still visible");
  lines.push("- a slide that weakens or changes the locked claim");
  return lines.join("\n");
};

export const buildSlideCreateRequest = ({
  slide,
  lane,
  laneReason,
  templateId,
  draftVersionId,
  draftVersionDir,
  adjacentSlides = [],
  shellRegions = [],
  packetPath = null,
  packetText = "",
  noteReadmePath = null,
  noteReadmeText = "",
  referenceImagePaths = [],
  referenceFileSnapshots = [],
}) => {
  const adjacentLabels = adjacentSlides.map((entry) => entry.slideId).join(", ") || "(none)";
  const referenceFilesLabel =
    referenceFileSnapshots.map((entry) => basename(entry.path)).join(", ") || "(none)";

  return [
    `# ${slide.id} Create Request`,
    "",
    "Official slide context:",
    "",
    `- title: ${slide.title || "(missing title)"}`,
    `- lane: ${lane}`,
    `- lane reason: ${laneReason}`,
    `- draft version id: ${draftVersionId}`,
    `- draft version dir: ${draftVersionDir}`,
    `- template id: ${templateId}`,
    `- adjacent slides: ${adjacentLabels}`,
    `- packet path: ${packetPath || "(none)"}`,
    `- note readme path: ${noteReadmePath || "(none)"}`,
    `- reference images: ${referenceImagePaths.join(", ") || "(none)"}`,
    `- reference files: ${referenceFilesLabel}`,
    "",
    "## Approved regions",
    "",
    "```json",
    JSON.stringify(shellRegions, null, 2),
    "```",
    "",
    "## Requested change",
    "",
    buildRequestedChange({
      slide,
      lane,
      packetText,
      noteReadmeText,
      referenceFileSnapshots,
    }),
    "",
    "## Success checks",
    "",
    "- The slide is fully resolved and presentation-ready.",
    "- No template placeholders remain.",
    `- The header reads: ${slide.header || "(none)"}`,
    `- The subheader reads: ${slide.subheader || "(none)"}`,
    "- The figure visibly carries the specified burden.",
    "- The slide stays inside the locked Designer shell contract.",
    "- The footer rule and footer logo remain aligned with the shell.",
    "- The slide feels in-family with the adjacent official slides.",
    "",
    "## Guardrails",
    "",
    "- preserve the white Designer shell",
    "- preserve the footer rule and footer logo",
    "- do not leave the figure stub or placeholder copy visible",
    "- do not turn the slide into a browser page, app UI, or card grid unless the brief explicitly requires it",
    "- do not weaken the locked slide claim",
    "",
    "## Reference intent",
    "",
    "- Adjacent slide previews are for deck continuity only.",
    "- Optional reference images are for style or composition cues, not for literal copying unless explicitly stated.",
    `- Supplemental reference files are summarized above and may clarify slide intent.`,
    "",
    "## Stop if",
    "",
    "- the request actually needs a new slide concept rather than execution",
    "- the brief is missing core copy needed to build the slide",
    "- the best candidate still conflicts with the locked slide job after repeated rounds",
    "",
  ].join("\n");
};
