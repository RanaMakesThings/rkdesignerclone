#!/usr/bin/env node

import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { captureHtmlScreenshot } from "../utils/html-screenshot-lib.mjs";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const projectRoot = resolve(repoRoot, "projects", "customgpt");
const deckSpecPath = resolve(projectRoot, "deck-spec.json");
const masterSpecsPath = resolve(projectRoot, "master-slide-specs.md");
const deckMatrixPath = resolve(projectRoot, "deck-matrix.md");
const readmePath = resolve(projectRoot, "README.md");
const restructurePlanPath = resolve(projectRoot, "inputs", "RESTRUCTURE_PLAN.md");
const slidePacketsDir = resolve(projectRoot, "slide-packets");
const slideAssetsDir = resolve(projectRoot, "slide-assets");
const templatesDir = resolve(projectRoot, "templates");
const graphicsDir = resolve(projectRoot, "assets", "graphics");

const pad = (value) => String(value).padStart(2, "0");

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const familyLabel = (value) =>
  String(value ?? "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const styleOpenQuestion = {
  title: "Does the opening need a different workshop promise, title emphasis, or speaker treatment later?",
  speaker: "Does this speaker-intro slide establish credibility quickly without slowing the story down?",
  problem: "Which policy question or role example would make this operational burden feel real fastest?",
  concept: "Which sample question-and-answer pair best defines the object in one glance?",
  cards: "Which one or two points deserve the strongest visual weight later?",
  process: "Should any one step split into its own screenshot or demo beat later?",
  compare: "Which example question would make this comparison land fastest?",
  checklist: "Should any checklist item become its own richer example slide later?",
  interface: "Swap this seed UI for a current product screenshot when we capture the latest surface?",
  governance: "Which operating habit deserves the strongest emphasis for this audience?",
  closing: "Do we want a QR code, contact block, or resource link on the close?",
};

const SAEM_TEMPLATE = {
  id: "saem-conference-template-v1",
  conference: "SAEM Annual Meeting",
  session: "Workshop / Didactic",
  date: "May 2026",
  navy: "#0E2841",
  teal: "#156082",
  orange: "#E97132",
  neutral: "#E8E8E8",
  backgroundPath: "projects/customgpt/assets/powerpoint-template/saem-master-background.png",
  powerpointPath:
    "projects/customgpt/assets/powerpoint-template/saem-annual-meeting-powerpoint-template.pptx",
  studioTemplateDir: "projects/customgpt/templates/saem-conference-template-v1",
};

const SOURCE_ASSET_BASE = "../../../../assets/source-deck";
const sourceDeckAsset = (filename) => `${SOURCE_ASSET_BASE}/${filename}`;
const GRAPHIC_ASSET_BASE = "../../../../assets/graphics";
const graphicAsset = (filename) => `${GRAPHIC_ASSET_BASE}/${filename}`;

const SOURCE_DECK_ASSETS = {
  speakerConnor: sourceDeckAsset("speaker-connor.png"),
  speakerRana: sourceDeckAsset("speaker-rana.png"),
  speakerEddie: sourceDeckAsset("speaker-eddie.png"),
  gptsExplore: sourceDeckAsset("gpts-explore.png"),
  gptCreateView: sourceDeckAsset("gpt-create-view.png"),
  gptConfigureOverview: sourceDeckAsset("gpt-configure-overview.png"),
  gptInstructionsScreen: sourceDeckAsset("gpt-instructions-screen.png"),
  gptKnowledgeFiles: sourceDeckAsset("gpt-knowledge-files.png"),
  gptCapabilitiesScreen: sourceDeckAsset("gpt-capabilities-screen.png"),
  gptPreviewCard: sourceDeckAsset("gpt-preview-card.png"),
  gptShareModal: sourceDeckAsset("gpt-share-modal.png"),
  qrCode: sourceDeckAsset("qr-code.png"),
  roadCurve: sourceDeckAsset("road-curve.png"),
};

const CUSTOM_GRAPHICS = {
  policyLoop: graphicAsset("policy-question-loop.svg"),
  groundedAssistant: graphicAsset("grounded-assistant-system.svg"),
  privacyBoundary: graphicAsset("privacy-boundary.svg"),
  governanceCycle: graphicAsset("governance-cycle.svg"),
};

const SPEAKER_CARDS = [
  {
    name: "Connor Grant, MD",
    role: "Residency operations",
    image: SOURCE_DECK_ASSETS.speakerConnor,
    focus: "Brings the real workflow pain point and the original workshop backbone.",
  },
  {
    name: "Rana Kabeer, MD",
    role: "Implementation and faculty translation",
    image: SOURCE_DECK_ASSETS.speakerRana,
    focus: "Shapes the build into a practical session for mixed technical audiences.",
  },
  {
    name: "Eddie Garcia, MD",
    role: "Education and adoption",
    image: SOURCE_DECK_ASSETS.speakerEddie,
    focus: "Connects the pattern to teaching, operations, and practical uptake.",
  },
];

const SAEM_TITLE_LAYOUT = {
  x: 240,
  y: 177,
  width: 1440,
  height: 376,
};

const SAEM_SUBTITLE_LAYOUT = {
  x: 240,
  y: 567,
  width: 1440,
  height: 261,
};

const SAEM_FOOTER_LAYOUT = {
  date: { x: 132, y: 1001, width: 432, height: 58 },
  footer: { x: 636, y: 1001, width: 648, height: 58 },
  slide: { x: 1356, y: 1001, width: 432, height: 58 },
};

const SAEM_TEMPLATE_CONTRACT = {
  id: SAEM_TEMPLATE.id,
  status: "locked",
  themeId: "saem-annual-meeting-2026",
  sourceBoard: null,
  summary:
    "Use the checked-in SAEM conference PowerPoint template as the canonical deck shell, including the Atlanta skyline footer art, Aptos typography, and conference footer geometry.",
  paths: {
    contractPath: "projects/customgpt/assets/powerpoint-template/template-integration.md",
    templateDir: SAEM_TEMPLATE.studioTemplateDir,
    previewPath: `${SAEM_TEMPLATE.studioTemplateDir}/template.png`,
    htmlPath: `${SAEM_TEMPLATE.studioTemplateDir}/template.html`,
  },
  rules: [
    "Use the SAEM conference master art and skyline footer as part of the locked shell.",
    "Respect the 16:9 conference slide size and footer placeholder behavior from the PowerPoint template.",
    "Use Aptos Display for strong display moments and Aptos for supporting text.",
    "Keep the canvas predominantly white and avoid introducing unrelated frame chrome around the slide.",
    "Treat the checked-in PowerPoint template as the final conference packaging target, not just a loose mood board.",
  ],
  notes: [
    "The template source file lives in assets/powerpoint-template/saem-annual-meeting-powerpoint-template.pptx.",
    "The Studio preview shell uses the extracted master background art so the live deck reads like the conference template.",
  ],
};

const toneForSlide = (number) => {
  const warmSlides = new Set([5, 13, 17, 30]);
  if (warmSlides.has(number)) {
    return {
      accent: SAEM_TEMPLATE.orange,
      strong: SAEM_TEMPLATE.navy,
      soft: "rgba(233, 113, 50, 0.12)",
    };
  }

  return {
    accent: SAEM_TEMPLATE.teal,
    strong: SAEM_TEMPLATE.navy,
    soft: "rgba(21, 96, 130, 0.12)",
  };
};

const unique = (values) => [...new Set(values.filter(Boolean))];

const getSelectedVariant = (slide) => {
  const variants = Array.isArray(slide?.variants) ? slide.variants : [];
  return (
    variants.find((variant) => variant?.id === slide?.selectedVariantId) ??
    variants.find((variant) => variant?.status === "selected") ??
    variants[0] ??
    null
  );
};

const getVariantDirPath = (variant) => {
  if (!variant) {
    return null;
  }

  const explicitDir = Array.isArray(variant.files)
    ? variant.files.find(
        (file) =>
          typeof file?.path === "string" &&
          String(file?.label ?? "").toLowerCase() === "version dir"
      )?.path
    : null;
  if (explicitDir) {
    return explicitDir;
  }

  if (typeof variant.previewPath === "string" && variant.previewPath.trim()) {
    return dirname(variant.previewPath);
  }

  return null;
};

const buildSlideSpecText = (slide) =>
  [
    `# ${slide.title}`,
    "",
    "## Purpose",
    "",
    `- ${slide.purpose}`,
    `- ${slide.figureRole}`,
    "",
    "## Core copy",
    "",
    `- Header: ${slide.header}`,
    `- Subheader: ${slide.subheader}`,
    `- Takeaway: ${slide.takeaway}`,
    "",
    "## Visual notes",
    "",
    ...(Array.isArray(slide.notes) && slide.notes.length > 0
      ? slide.notes.map((note) => `- ${note}`)
      : ["- No slide-local notes yet."]),
    "",
  ].join("\n");

const buildGeneratedSpec = (slide, variantDir) => ({
  specVersion: 1,
  meta: {
    slug: `${slide.id}-${slide.title}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    family: slide.family ?? "customgpt-slide",
    deckId: "customgpt",
    theme: "saem",
    mode: "full-slide",
    sourcePath: slide.paths?.packet ?? `${variantDir}/generated.html`,
  },
  chrome: {
    title: slide.header ?? slide.title,
    subtitle: slide.subheader ?? "",
    chips: [slide.title, `Slide ${slide.displayNumber}`].filter(Boolean),
    footnote: slide.takeaway ?? "",
  },
  constraints: {
    figureJob: slide.figureRole ?? slide.purpose ?? "",
    focalPoint: slide.notes?.[0] ?? slide.takeaway ?? slide.header ?? "",
    layout: slide.family ?? "customgpt-seeded",
    big: [slide.header ?? slide.title, slide.notes?.[0] ?? slide.takeaway].filter(Boolean),
    quiet: [slide.subheader ?? "", slide.takeaway ?? ""].filter(Boolean),
    accentTargets: [slide.takeaway ?? slide.notes?.[0] ?? ""].filter(Boolean),
    forbidden: [],
    semanticGuards: ["saem-shell", "studio-seeded-mockup"],
  },
  copyPolicy: {
    locked: [slide.header, slide.subheader, slide.takeaway].filter(Boolean),
    preferred: Array.isArray(slide.notes) ? slide.notes : [],
    optional: [],
    forbidden: [],
  },
  body: {
    purpose: slide.purpose ?? "",
    figureRole: slide.figureRole ?? "",
    notes: Array.isArray(slide.notes) ? slide.notes : [],
    selectedDirection: slide.selectedDirection ?? "",
  },
  trace: [
    {
      excerpt: slide.header ?? slide.title,
      targetPath: "chrome.title",
      ruleType: "chrome",
      note: "Carry the working slide headline into the generated canonical spec.",
    },
    {
      excerpt: slide.figureRole ?? slide.purpose ?? "",
      targetPath: "constraints.figureJob",
      ruleType: "constraint",
      note: "Preserve the intended teaching job of the slide.",
    },
  ],
});

const buildGeneratedReportHtml = (slide, variant) => {
  const variantLabel = variant?.label ?? slide.selectedVariantId ?? "Selected variant";
  const notesMarkup =
    Array.isArray(slide.notes) && slide.notes.length > 0
      ? `<ul>${slide.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>`
      : "<p>No slide notes saved yet.</p>";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(slide.title)} report</title>
    <style>
      :root {
        --navy: ${SAEM_TEMPLATE.navy};
        --teal: ${SAEM_TEMPLATE.teal};
        --orange: ${SAEM_TEMPLATE.orange};
        --line: rgba(14, 40, 65, 0.12);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 32px;
        font-family: "Aptos", "Segoe UI", Arial, sans-serif;
        color: #13273b;
        background: linear-gradient(180deg, #f9fbfd 0%, #eef3f8 100%);
      }
      .shell {
        max-width: 1280px;
        margin: 0 auto;
        display: grid;
        gap: 24px;
      }
      .hero {
        display: grid;
        gap: 10px;
        padding: 24px 28px;
        border-radius: 24px;
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.94);
      }
      .kicker {
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--teal);
      }
      h1 {
        margin: 0;
        font-size: 42px;
        line-height: 1.04;
        letter-spacing: -0.04em;
        color: var(--navy);
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .pill {
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(21, 96, 130, 0.1);
        border: 1px solid rgba(21, 96, 130, 0.12);
        color: var(--navy);
        font-size: 14px;
        font-weight: 700;
      }
      .grid {
        display: grid;
        grid-template-columns: minmax(0, 1.4fr) minmax(300px, 0.6fr);
        gap: 24px;
      }
      .panel {
        padding: 20px 22px;
        border-radius: 24px;
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.94);
      }
      h2 {
        margin: 0 0 14px;
        font-size: 18px;
        letter-spacing: -0.02em;
        color: var(--navy);
      }
      p, li {
        font-size: 16px;
        line-height: 1.5;
      }
      img {
        display: block;
        width: 100%;
        border-radius: 18px;
        border: 1px solid var(--line);
        background: #fff;
      }
      ul {
        margin: 0;
        padding-left: 20px;
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="hero">
        <div class="kicker">CustomGPT Creation · Canonical slide report</div>
        <h1>${escapeHtml(slide.title)}</h1>
        <p>${escapeHtml(slide.purpose ?? "")}</p>
        <div class="meta">
          <span class="pill">${escapeHtml(slide.id)}</span>
          <span class="pill">${escapeHtml(variantLabel)}</span>
          <span class="pill">Imported slides: ${escapeHtml(
            Array.isArray(slide.importedSlides) && slide.importedSlides.length > 0
              ? slide.importedSlides.join(", ")
              : "none"
          )}</span>
        </div>
      </section>
      <section class="grid">
        <div class="panel">
          <h2>Selected preview</h2>
          <img src="./preview.png" alt="${escapeHtml(slide.title)} preview" />
        </div>
        <div class="panel">
          <h2>Working notes</h2>
          <p><strong>Header:</strong> ${escapeHtml(slide.header ?? "")}</p>
          <p><strong>Takeaway:</strong> ${escapeHtml(slide.takeaway ?? "")}</p>
          ${notesMarkup}
        </div>
      </section>
    </main>
  </body>
</html>
`;
};

const buildStudioTemplateHtml = () => `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SAEM Conference Template</title>
    <style>
      :root {
        --navy: ${SAEM_TEMPLATE.navy};
        --teal: ${SAEM_TEMPLATE.teal};
        --muted: rgba(14, 40, 65, 0.64);
        --line: rgba(14, 40, 65, 0.14);
      }

      html,
      body {
        margin: 0;
        width: 1920px;
        height: 1080px;
        overflow: hidden;
        background: #ffffff;
        font-family: "Aptos", "Segoe UI", Arial, sans-serif;
        color: var(--navy);
      }

      .slide {
        position: relative;
        width: 100%;
        height: 100%;
        background:
          url("../../assets/powerpoint-template/saem-master-background.png")
            center bottom / cover no-repeat,
          #ffffff;
      }

      .title-box,
      .subtitle-box,
      .footer-box {
        position: absolute;
        border: 2px dashed rgba(14, 40, 65, 0.16);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.72);
      }

      .title-box {
        left: ${SAEM_TITLE_LAYOUT.x}px;
        top: ${SAEM_TITLE_LAYOUT.y}px;
        width: ${SAEM_TITLE_LAYOUT.width}px;
        height: ${SAEM_TITLE_LAYOUT.height}px;
      }

      .subtitle-box {
        left: ${SAEM_SUBTITLE_LAYOUT.x}px;
        top: ${SAEM_SUBTITLE_LAYOUT.y}px;
        width: ${SAEM_SUBTITLE_LAYOUT.width}px;
        height: ${SAEM_SUBTITLE_LAYOUT.height}px;
      }

      .footer-date {
        left: ${SAEM_FOOTER_LAYOUT.date.x}px;
        top: ${SAEM_FOOTER_LAYOUT.date.y}px;
        width: ${SAEM_FOOTER_LAYOUT.date.width}px;
        height: ${SAEM_FOOTER_LAYOUT.date.height}px;
      }

      .footer-copy {
        left: ${SAEM_FOOTER_LAYOUT.footer.x}px;
        top: ${SAEM_FOOTER_LAYOUT.footer.y}px;
        width: ${SAEM_FOOTER_LAYOUT.footer.width}px;
        height: ${SAEM_FOOTER_LAYOUT.footer.height}px;
      }

      .footer-slide {
        left: ${SAEM_FOOTER_LAYOUT.slide.x}px;
        top: ${SAEM_FOOTER_LAYOUT.slide.y}px;
        width: ${SAEM_FOOTER_LAYOUT.slide.width}px;
        height: ${SAEM_FOOTER_LAYOUT.slide.height}px;
      }

      .label {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        text-align: center;
        padding: 20px;
        font-size: 22px;
        font-weight: 700;
        color: var(--muted);
      }

      .template-note {
        position: absolute;
        right: 96px;
        top: 68px;
        padding: 10px 16px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.9);
        border: 1px solid var(--line);
        font-size: 16px;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--teal);
      }
    </style>
  </head>
  <body>
    <section class="slide" aria-label="SAEM conference slide template">
      <div class="template-note">Locked SAEM Template</div>
      <div class="title-box"><div class="label">Title Placeholder</div></div>
      <div class="subtitle-box"><div class="label">Subtitle / Body Placeholder</div></div>
      <div class="footer-box footer-date"><div class="label">Date</div></div>
      <div class="footer-box footer-copy"><div class="label">Footer</div></div>
      <div class="footer-box footer-slide"><div class="label">Slide Number</div></div>
    </section>
  </body>
</html>
`;

const buildStudioTemplateReadme = () =>
  [
    "# SAEM Conference Template v1",
    "",
    "Studio-facing shell derived from the checked-in SAEM PowerPoint template.",
    "",
    "Files in this folder are not the conference source of truth by themselves.",
    "They exist so Studio can surface the template clearly while the final",
    "speaker-ready deck is still assembled in the real PowerPoint shell.",
    "",
    "## Source references",
    "",
    `- PowerPoint template: \`${SAEM_TEMPLATE.powerpointPath}\``,
    `- Extracted master background: \`${SAEM_TEMPLATE.backgroundPath}\``,
    "- Contract notes: `projects/customgpt/assets/powerpoint-template/template-integration.md`",
    "",
    "## Working intent",
    "",
    "- show the real SAEM skyline/footer art inside Studio",
    "- preserve the title, subtitle, and footer placeholder geometry from the template",
    "- keep the live deck visibly connected to the actual conference shell",
    "",
  ].join("\n");

const buildStudioTemplateShellRegions = () =>
  JSON.stringify(
    [
      {
        id: "title-placeholder",
        label: "Title Placeholder",
        x: SAEM_TITLE_LAYOUT.x,
        y: SAEM_TITLE_LAYOUT.y,
        width: SAEM_TITLE_LAYOUT.width,
        height: SAEM_TITLE_LAYOUT.height,
        freezeLevel: "semantic-stable",
        note: "Centered SAEM title region from the title-slide layout.",
      },
      {
        id: "subtitle-placeholder",
        label: "Subtitle Placeholder",
        x: SAEM_SUBTITLE_LAYOUT.x,
        y: SAEM_SUBTITLE_LAYOUT.y,
        width: SAEM_SUBTITLE_LAYOUT.width,
        height: SAEM_SUBTITLE_LAYOUT.height,
        freezeLevel: "semantic-stable",
        note: "Subtitle/body region from the SAEM title-slide layout.",
      },
      {
        id: "footer-date",
        label: "Date Placeholder",
        x: SAEM_FOOTER_LAYOUT.date.x,
        y: SAEM_FOOTER_LAYOUT.date.y,
        width: SAEM_FOOTER_LAYOUT.date.width,
        height: SAEM_FOOTER_LAYOUT.date.height,
        freezeLevel: "pixel-strict",
        note: "Conference date placeholder region from the PPTX layout.",
      },
      {
        id: "footer-copy",
        label: "Footer Placeholder",
        x: SAEM_FOOTER_LAYOUT.footer.x,
        y: SAEM_FOOTER_LAYOUT.footer.y,
        width: SAEM_FOOTER_LAYOUT.footer.width,
        height: SAEM_FOOTER_LAYOUT.footer.height,
        freezeLevel: "pixel-strict",
        note: "Footer copy placeholder region from the PPTX layout.",
      },
      {
        id: "footer-slide-number",
        label: "Slide Number Placeholder",
        x: SAEM_FOOTER_LAYOUT.slide.x,
        y: SAEM_FOOTER_LAYOUT.slide.y,
        width: SAEM_FOOTER_LAYOUT.slide.width,
        height: SAEM_FOOTER_LAYOUT.slide.height,
        freezeLevel: "pixel-strict",
        note: "Slide number placeholder region from the PPTX layout.",
      },
    ],
    null,
    2
  );

const buildEmptySlideAssetsManifest = (slideId) => ({
  manifestVersion: 1,
  projectId: "customgpt",
  kind: "slide-assets",
  slideId,
  deckAssetIds: [],
  assets: [],
});

const ensureCanonicalSlideRecord = (slide) => {
  const selectedVariant = getSelectedVariant(slide);
  const variantDir = getVariantDirPath(selectedVariant);
  const packetPath =
    slide?.paths?.packet ?? `projects/customgpt/slide-packets/${slide.id}.md`;
  const assetsManifestPath =
    slide?.paths?.assetsManifest ?? `projects/customgpt/slide-assets/${slide.id}/manifest.json`;
  const specPath = variantDir ? `${variantDir}/spec.json` : null;
  const stampedDir = slide?.paths?.stampedDir ?? variantDir;
  const existingSpecs = Array.isArray(slide?.paths?.specs) ? slide.paths.specs : [];

  return {
    ...slide,
    specText:
      typeof slide?.specText === "string" && slide.specText.trim()
        ? slide.specText.trim()
        : buildSlideSpecText(slide),
    paths: {
      packet: packetPath,
      specs: unique([...existingSpecs, specPath]),
      stampedDir,
      assetsManifest: assetsManifestPath,
    },
  };
};

const openingSlides = [
  {
    number: 1,
    slug: "title-promise",
    title: "Workshop Title and Promise",
    importedSlides: [1, 3],
    purpose: "Open the workshop with a clear thesis and a visually strong product promise.",
    header: "From PDF to Policy Assistant",
    subheader: "Designing a practical custom GPT for residency administration support",
    takeaway: "This workshop will show what the tool is, why it works, and how to build one.",
    figureRole: "Use a strong SAEM opener with a clear promise panel and a custom hero graphic rather than speaker portraits.",
    family: "conference-title",
    style: "title",
    notes: [
      "What this is",
      "Why it works",
      "How to build it live",
    ],
    variantId: "title-promise-v1",
    variantLabel: "Title Promise V1",
    variantSummary:
      "Typographic opener that uses the SAEM shell, a document-to-answer hero graphic, and a three-step workshop promise panel.",
  },
  {
    number: 2,
    slug: "who-we-are",
    title: "Who We Are",
    importedSlides: [2],
    purpose: "Introduce the presenters once, explain why this group is teaching this workshop, and set expectations for the session.",
    header: "Who we are and what we are building together",
    subheader:
      "This is a practical workshop from people who live the residency workflow problem, teach within it, and build within current product constraints.",
    takeaway: "The session is operational, grounded, and intentionally narrow.",
    figureRole: "Use presenter portraits only here, paired with a compact session roadmap and practical framing.",
    family: "speaker-intro",
    style: "speaker",
    notes: [
      "Connor brings the real residency workflow pain point and the original workshop backbone.",
      "Rana brings implementation, product-shaping, and faculty translation for a mixed audience.",
      "Eddie helps connect the build pattern to teaching, operations, and audience adoption.",
    ],
    variantId: "who-we-are-v1",
    variantLabel: "Who We Are V1",
    variantSummary:
      "Dedicated presenter-intro slide with portraits, role framing, and the practical workshop promise.",
  },
  {
    number: 3,
    slug: "workflow-burden",
    title: "Why This Matters",
    importedSlides: [4, 6, 47],
    purpose: "Show the administrative pain point and why the audience should care immediately.",
    header: "Policy questions keep landing on the same people.",
    subheader:
      "Residency leaders and chiefs repeatedly search static documents for operational answers that should be fast, consistent, and source-bounded.",
    takeaway: "This is a repeated workflow problem that creates delay, inconsistency, and interruption.",
    figureRole: "Make the workflow burden visible with role cards, repeated question loops, and an operational payoff.",
    family: "problem-frame",
    style: "problem",
    notes: [
      "Program leaders absorb decision bottlenecks.",
      "Chief residents keep translating policy PDFs into real-time coverage answers.",
      "Program coordinators reopen the same documents instead of advancing the work.",
    ],
    variantId: "workflow-burden-v1",
    variantLabel: "Workflow Burden V1",
    variantSummary:
      "Operational burden frame showing the same questions cycling through the same people and files.",
  },
  {
    number: 4,
    slug: "policy-assistant-object",
    title: "What This Tool Is",
    importedSlides: [7],
    purpose: "Define the product object plainly before any theory or build mechanics.",
    header: "A custom GPT can act like a residency policy assistant.",
    subheader:
      "It answers with uploaded policies and explicit instructions inside ChatGPT, returning a cited answer or a bounded refusal.",
    takeaway: "Understand the object before hearing how it is built.",
    figureRole: "Show a realistic question, grounded answer, and the design ingredients that make the object useful.",
    family: "concept-card",
    style: "concept",
    notes: [
      "The assistant is narrow on purpose.",
      "It answers from uploaded files, not general web knowledge.",
      "It should cite the source or say the answer is unsupported.",
    ],
    variantId: "policy-assistant-object-v1",
    variantLabel: "Policy Assistant Object V1",
    variantSummary:
      "Question-to-answer concept card that defines the assistant as a grounded, bounded policy-support tool.",
  },
];

const slidePlan = [
  {
    number: 4,
    slug: "workflow-repetition",
    title: "Residency Policy Work Is Repetitive",
    importedSlides: [4],
    purpose: "Make the repeated lookup work concrete before we talk about product mechanics.",
    header: "The same policy questions keep getting answered from scratch",
    subheader:
      "Leave, scheduling, conference, evaluation, and remediation questions keep cycling through the same small set of people",
    takeaway: "The pain point is repetitive operational lookup work, not lack of effort.",
    figureRole: "Show a repeated question loop hitting the same program roles.",
    family: "problem-loop",
    style: "cards",
    notes: [
      "The same leave and duty-hour questions recur every block.",
      "People reopen PDFs and email chains to reconstruct the answer.",
      "Chiefs, coordinators, APDs, and faculty absorb the interruption.",
    ],
    variantId: "workflow-repetition-v1",
    variantLabel: "Workflow Repetition V1",
    variantSummary:
      "Loop-based problem frame that shows the same operational questions recurring across the residency team.",
  },
  {
    number: 5,
    slug: "burden-data",
    title: "Administrative Burden Shows Up in Burnout and Friction",
    importedSlides: [6, 47],
    purpose: "Connect the policy-lookup problem to resident stress and administrative drag.",
    header: "Administrative confusion is not a small annoyance",
    subheader:
      "Connor's original deck linked administrative load, schedule stress, and support bottlenecks to the lived experience of residency operations",
    takeaway: "Reducing answer-friction is a meaningful workflow improvement.",
    figureRole: "Use evidence-backed burden cards instead of a wall of text.",
    family: "burden-data",
    style: "cards",
    notes: [
      "Administrative tasks are a visible contributor to burnout.",
      "Schedule and policy uncertainty become recurring stressors.",
      "Support bottlenecks force the same questions back onto leaders.",
    ],
    variantId: "burden-data-v1",
    variantLabel: "Burden Data V1",
    variantSummary:
      "Evidence-flavored burden board tying policy confusion to burnout, interruptions, and avoidable stress.",
  },
  {
    number: 6,
    slug: "solution-at-a-glance",
    title: "Our Solution at a Glance",
    importedSlides: [7],
    purpose: "Translate Connor's solution slide into a clear product-shaped promise.",
    header: "A custom GPT can become a grounded residency policy assistant",
    subheader:
      "Ask a plain-language question, retrieve relevant guidance from approved files, and return a cited answer or a refusal",
    takeaway: "The workshop is about building a narrow, grounded assistant, not a general chatbot.",
    figureRole: "Show the assistant as a practical input-output workflow.",
    family: "solution-card",
    style: "cards",
    notes: [
      "Ask a residency policy question in ordinary language.",
      "Search only the approved residency and GME documents.",
      "Answer with citation, limits, and next step when needed.",
    ],
    variantId: "solution-at-a-glance-v1",
    variantLabel: "Solution at a Glance V1",
    variantSummary: "Three-card solution frame that makes the assistant feel concrete and bounded.",
  },
  {
    number: 7,
    slug: "program-operations-fit",
    title: "Where This Fits in Program Operations",
    importedSlides: [2, 4, 7],
    purpose: "Show who benefits from the tool and where it belongs in day-to-day work.",
    header: "This assistant supports the people already answering these questions",
    subheader:
      "Residents, chiefs, coordinators, and program leaders all gain from faster, more standardized access to the same operational guidance",
    takeaway: "The right mental model is team support, not AI replacement.",
    figureRole: "Map the assistant to the real roles in the residency workflow.",
    family: "stakeholder-map",
    style: "cards",
    notes: [
      "Residents need faster answers to common operational questions.",
      "Chiefs need consistency when they are triaging the same asks.",
      "Coordinators and leaders need fewer repetitive interruptions.",
    ],
    variantId: "program-operations-fit-v1",
    variantLabel: "Program Operations Fit V1",
    variantSummary:
      "Role-based support map showing where the assistant reduces repeated policy interrupts.",
  },
  {
    number: 8,
    slug: "why-it-works",
    title: "Why It Works",
    importedSlides: [10, 11, 12, 13, 14, 15],
    purpose: "Explain the mechanism in plain language without turning this into a theory lecture.",
    header: "Good policy assistants are configured, grounded workflows",
    subheader:
      "Instructions shape behavior, knowledge files provide source material, and selected capabilities extend what the GPT can do",
    takeaway: "This is configuration work more than deep engineering.",
    figureRole: "Use a simple three-part system map rather than dense architecture.",
    family: "system-diagram",
    style: "process",
    notes: [
      "Instructions set the role and rules.",
      "Knowledge files supply the source material.",
      "Capabilities extend what the GPT can do.",
    ],
    variantId: "why-it-works-v1",
    variantLabel: "Why It Works V1",
    variantSummary:
      "Plain-language systems slide showing instructions, knowledge, and capabilities working together.",
  },
  {
    number: 9,
    slug: "retrieval-plain-language",
    title: "Retrieval in Plain Language",
    importedSlides: [11, 12],
    purpose: "Give the audience one simple retrieval explanation they can repeat later.",
    header: "The GPT does not magically know your residency handbook",
    subheader:
      "It has to find relevant passages, bring them into context, and then answer from that evidence",
    takeaway: "Retrieval is the bridge between the question and the source files.",
    figureRole: "Break retrieval into a few memorable steps.",
    family: "grounded-flow",
    style: "process",
    notes: [
      "A user asks a question.",
      "Relevant document passages are pulled into context.",
      "The model answers from those passages.",
    ],
    variantId: "retrieval-plain-language-v1",
    variantLabel: "Retrieval Plain Language V1",
    variantSummary:
      "Three-step retrieval explainer that keeps the mechanism teachable and concrete.",
  },
  {
    number: 10,
    slug: "benefits-of-grounding",
    title: "Benefits of Grounding",
    importedSlides: [13, 14],
    purpose: "Land the upside of grounded answers without overselling the tool.",
    header: "Grounding makes the assistant more useful and more governable",
    subheader:
      "The payoff is not magic. It is better source control, better citations, and more consistent answers.",
    takeaway: "Grounding is why this feels operationally trustworthy.",
    figureRole: "Use a benefit grid with clear operational payoffs.",
    family: "benefit-grid",
    style: "cards",
    notes: [
      "Answers can cite the source document.",
      "Hallucination risk drops when the answer stays in-bounds.",
      "Common questions get answered more consistently.",
    ],
    variantId: "benefits-of-grounding-v1",
    variantLabel: "Benefits of Grounding V1",
    variantSummary:
      "Benefit grid showing why grounded answers are easier to trust and deploy.",
  },
  {
    number: 11,
    slug: "limits-and-failure-modes",
    title: "Limits and Failure Modes",
    importedSlides: [15],
    purpose: "Make the boundaries explicit before the live build creates false confidence.",
    header: "Grounded systems still fail when the inputs or expectations are wrong",
    subheader:
      "Outdated files, conflicting policies, or ambiguous questions can still produce weak answers even with good instructions",
    takeaway: "A grounded assistant is useful, but it still needs judgement and upkeep.",
    figureRole: "Show the main failure modes as bounded risks.",
    family: "limitation-grid",
    style: "cards",
    notes: [
      "Outdated files produce outdated guidance.",
      "Conflicting policies need explicit conflict handling.",
      "The tool cannot replace human judgement.",
    ],
    variantId: "limits-and-failure-modes-v1",
    variantLabel: "Limits and Failure Modes V1",
    variantSummary:
      "Risk grid showing document quality, conflict, and judgement limits without alarmism.",
  },
  {
    number: 12,
    slug: "what-good-looks-like",
    title: "What Good Looks Like",
    importedSlides: [31, 35],
    purpose: "Set the answer-quality bar before the audience sees the build.",
    header: "A good answer is specific, sourced, and bounded",
    subheader:
      "The assistant should answer from the documents, cite the source, and say when it does not know",
    takeaway: "This is the quality bar we will hold the live demo to.",
    figureRole: "Use three quality pillars instead of abstract prompting advice.",
    family: "quality-pillars",
    style: "cards",
    notes: [
      "Specific enough to resolve the question.",
      "Cited to the right file and page or section.",
      "Bounded enough to refuse unsupported claims.",
    ],
    variantId: "what-good-looks-like-v1",
    variantLabel: "What Good Looks Like V1",
    variantSummary:
      "Three-pillar answer-quality slide that defines success before the walkthrough.",
  },
  {
    number: 13,
    slug: "good-vs-bad-answer",
    title: "Good Answer Versus Bad Answer",
    importedSlides: [31, 35, 40, 46],
    purpose: "Turn the quality bar into a side-by-side comparison the audience can judge quickly.",
    header: "Teach the audience to evaluate the answer, not just admire the build",
    subheader:
      "A grounded answer looks very different from a vague or overconfident answer even when both sound polished",
    takeaway: "This workshop is really about quality control.",
    figureRole: "Show a good answer and a risky answer side by side.",
    family: "answer-compare",
    style: "compare",
    notes: [
      "Grounded answer: cites the policy, stays in scope, and names the limit when the files do not fully support an answer.",
      "Risky answer: sounds confident, skips the citation, and blurs the difference between what the files say and what the model is guessing.",
      "Use the same question across both panels so the contrast is obvious.",
    ],
    variantId: "good-vs-bad-answer-v1",
    variantLabel: "Good vs Bad Answer V1",
    variantSummary:
      "Side-by-side answer comparison showing what good grounding looks like in practice.",
  },
  {
    number: 14,
    slug: "source-prep",
    title: "Source Prep",
    importedSlides: [20],
    purpose: "Show the preparation work that determines whether the assistant is any good.",
    header: "The files matter as much as the model",
    subheader:
      "Start with current, resident-facing, text-forward operational documents before you expand into everything else",
    takeaway: "The hidden implementation work is knowledge hygiene.",
    figureRole: "Turn source prep into a clean checklist the audience can copy later.",
    family: "workflow-checklist",
    style: "checklist",
    notes: [
      "Start with resident-facing operational policies.",
      "Prefer text-native PDFs over scans whenever possible.",
      "Keep the scope narrow for the first build.",
      "Choose files that people actually consult.",
    ],
    variantId: "source-prep-v1",
    variantLabel: "Source Prep V1",
    variantSummary:
      "Checklist-first slide that makes source preparation feel concrete and manageable.",
  },
  {
    number: 15,
    slug: "what-to-upload",
    title: "What to Upload",
    importedSlides: [21],
    purpose: "Make the first knowledge-base contents concrete for the audience.",
    header: "Start with the documents people already trust",
    subheader:
      "A resident handbook alone is rarely enough. Combine program, institutional, and requirement-level guidance thoughtfully.",
    takeaway: "Choose a small, high-value document set for the first version.",
    figureRole: "Show the starter document stack clearly.",
    family: "document-stack",
    style: "checklist",
    notes: [
      "Residency handbook.",
      "Program-specific policies.",
      "Institutional GME guidance.",
      "ACGME requirements.",
      "Contact and link sheet.",
    ],
    variantId: "what-to-upload-v1",
    variantLabel: "What to Upload V1",
    variantSummary:
      "Starter document stack for the first grounded policy assistant knowledge base.",
  },
  {
    number: 16,
    slug: "file-hygiene-versioning",
    title: "File Hygiene and Versioning",
    importedSlides: [20, 21, 39],
    purpose: "Carry Connor's document-prep advice into a maintainable operating habit.",
    header: "Name files clearly and keep the source set clean",
    subheader:
      "Deduplicate overlapping documents, use obvious names, and replace outdated files quickly so the GPT does not drift into stale guidance",
    takeaway: "Versioning is part of the product, not an afterthought.",
    figureRole: "Show the difference between messy and maintainable document practices.",
    family: "file-hygiene",
    style: "checklist",
    notes: [
      "Deduplicate overlapping files.",
      "Use simple names with year or version in them.",
      "Swap out outdated documents fast.",
      "Know who is responsible for the next update.",
    ],
    variantId: "file-hygiene-versioning-v1",
    variantLabel: "File Hygiene and Versioning V1",
    variantSummary:
      "Document-hygiene slide that reframes versioning as part of safe deployment.",
  },
  {
    number: 17,
    slug: "gigo",
    title: "Garbage In, Garbage Out",
    importedSlides: [22],
    purpose: "Keep Connor's GIGO point as a memorable quality-control warning.",
    header: "The assistant can only be as good as the policy set you feed it",
    subheader:
      "Messy, conflicting, or outdated inputs create brittle outputs even when the interface looks polished",
    takeaway: "Bad inputs are a product risk, not just a content issue.",
    figureRole: "Use a stark compare that makes the warning memorable.",
    family: "input-output-compare",
    style: "compare",
    notes: [
      "Clean in: current files, clear names, and scoped coverage create answers that are easier to trust and test.",
      "Messy in: outdated, duplicated, or vague documents push the GPT toward confusion, omission, or false certainty.",
      "Document quality is product quality.",
    ],
    variantId: "gigo-v1",
    variantLabel: "GIGO V1",
    variantSummary:
      "Sharp clean-vs-messy input comparison that keeps the GIGO warning easy to remember.",
  },
  {
    number: 18,
    slug: "privacy-and-security",
    title: "Privacy and Security Boundaries",
    importedSlides: [40, 41, 44],
    purpose: "Make privacy, access, and security boundaries explicit before the audience leaves with an overly casual mental model.",
    header: "Privacy and security boundaries matter more than novelty",
    subheader:
      "A useful custom GPT stays narrow, uses approved documents, avoids sensitive data, and is shared only with the right audience",
    takeaway: "Sharing and source selection are governance decisions, not convenience features.",
    figureRole: "Use a strong boundary graphic that makes the allowed-vs-not-allowed distinction unmistakable.",
    family: "privacy-boundary",
    style: "cards",
    notes: [
      "Do not upload PHI, patient-care notes, or sensitive personal data.",
      "Use approved policy and administrative documents only.",
      "Know who can access the GPT and the files behind it.",
      "Treat sharing as an access decision with real consequences.",
    ],
    variantId: "privacy-and-security-v1",
    variantLabel: "Privacy and Security V1",
    variantSummary:
      "Boundary-setting slide that frames privacy, access, and source approval as core design decisions.",
  },
  {
    number: 19,
    slug: "five-step-build-workflow",
    title: "The Five-Step Build Workflow",
    importedSlides: [19],
    purpose: "Preserve Connor's five-step build map as the main workshop sequence.",
    header: "The workshop build follows five practical steps",
    subheader:
      "Prepare the files, start the GPT, configure it carefully, test in preview, then deploy with an owner and clear rules",
    takeaway: "The build flow is straightforward once the sequence is visible.",
    figureRole: "Use the five-step map as the workshop backbone.",
    family: "step-roadmap",
    style: "process",
    notes: [
      "Prepare the policy files.",
      "Start a new GPT.",
      "Configure instructions and knowledge.",
      "Test in preview.",
      "Deploy and govern.",
    ],
    variantId: "five-step-build-workflow-v1",
    variantLabel: "Five-Step Build Workflow V1",
    variantSummary:
      "Five-step workflow map adapted from Connor's original build sequence.",
  },
  {
    number: 20,
    slug: "live-walkthrough-setup",
    title: "Live Walkthrough Setup",
    importedSlides: [19],
    purpose: "Tell the audience what to watch for during the live build.",
    header: "We are about to build the assistant live",
    subheader:
      "Watch how scope, files, and testing decisions shape the result more than any single prompt flourish",
    takeaway: "The live demo is a lesson in judgment, not just button-clicking.",
    figureRole: "Frame the walkthrough with a few watch-fors.",
    family: "demo-roadmap",
    style: "process",
    notes: [
      "Watch how the scope gets defined.",
      "Watch which files are intentionally included.",
      "Watch how testing changes the build.",
    ],
    variantId: "live-walkthrough-setup-v1",
    variantLabel: "Live Walkthrough Setup V1",
    variantSummary:
      "Demo-orientation slide that tells the audience what to pay attention to during the build.",
  },
  {
    number: 21,
    slug: "start-a-custom-gpt",
    title: "Start a Custom GPT",
    importedSlides: [23],
    purpose: "Modernize Connor's start-here instructions into a clean visual checkpoint.",
    header: "Start in the GPTs area of ChatGPT",
    subheader:
      "From there you create a new GPT, give it a narrow job, and move into the configuration surface",
    takeaway: "The product entry point is concrete and accessible.",
    figureRole: "Show the start surface clearly without drowning the slide in tiny UI text.",
    family: "ui-entry",
    style: "interface",
    notes: [
      "Open the GPTs area inside ChatGPT.",
      "Create a new GPT around one narrow admin job.",
      "Move into the configuration flow with preview beside you.",
    ],
    variantId: "start-a-custom-gpt-v1",
    variantLabel: "Start a Custom GPT V1",
    variantSummary:
      "Seed interface mockup for the GPTs entry point and new-GPT start state.",
  },
  {
    number: 22,
    slug: "create-vs-configure",
    title: "Create Versus Configure",
    importedSlides: [26, 28],
    purpose: "Keep Connor's create-versus-configure distinction because it is genuinely helpful to learners.",
    header: "The friendly builder helps, but the Configure view is where control really lives",
    subheader:
      "Create can get you started. Configure is where you lock the role, files, capabilities, and sharing behavior.",
    takeaway: "Teach the audience where the durable controls actually are.",
    figureRole: "Compare the two surfaces while making Configure feel primary.",
    family: "ui-split",
    style: "interface",
    notes: [
      "Create is a conversational helper for the first draft.",
      "Configure is where you lock the actual product behavior.",
      "Preview is the running checkpoint beside both views.",
    ],
    variantId: "create-vs-configure-v1",
    variantLabel: "Create Versus Configure V1",
    variantSummary:
      "Split-surface interface slide showing why Configure is the durable build surface.",
  },
  {
    number: 23,
    slug: "role-and-scope",
    title: "Instructions: Role and Scope",
    importedSlides: [31],
    purpose: "Turn Connor's role-and-scope guidance into a dedicated builder step.",
    header: "Tell the GPT exactly what job it has and what job it does not have",
    subheader:
      "A strong role statement narrows the assistant to uploaded policy support and defines what it should do when the answer is missing",
    takeaway: "A good scope statement prevents both drift and overconfidence.",
    figureRole: "Show the role and scope instructions as the core guardrail.",
    family: "instruction-card",
    style: "interface",
    notes: [
      "Define the assistant as a policy-support tool.",
      "Limit answers to the uploaded documents.",
      "Instruct it to say when the answer is unsupported.",
    ],
    variantId: "role-and-scope-v1",
    variantLabel: "Role and Scope V1",
    variantSummary:
      "Instruction-focused UI seed showing the importance of a narrow, explicit role statement.",
  },
  {
    number: 24,
    slug: "knowledge-and-capabilities",
    title: "Knowledge and Capabilities",
    importedSlides: [28, 31],
    purpose: "Separate files and capabilities into their own build decision slide.",
    header: "Knowledge files and capabilities should both be chosen intentionally",
    subheader:
      "Upload only what helps the job, and enable only the capabilities that support the workflow you actually want",
    takeaway: "More tools do not automatically make a better assistant.",
    figureRole: "Make the file and capability choices feel concrete and governable.",
    family: "capability-stack",
    style: "interface",
    notes: [
      "Upload the right documents, not every document.",
      "Choose only capabilities that help the task.",
      "Disable open web if grounding matters most.",
    ],
    variantId: "knowledge-and-capabilities-v1",
    variantLabel: "Knowledge and Capabilities V1",
    variantSummary:
      "Configuration-focused slide for file uploads, capability selection, and intentional scope control.",
  },
  {
    number: 25,
    slug: "guardrails",
    title: "Guardrails: Citations, Refusals, Tone",
    importedSlides: [31, 35, 40],
    purpose: "Preserve Connor's strong instruction guardrails as a dedicated design checkpoint.",
    header: "Citations, refusal language, and tone are product features",
    subheader:
      "The assistant should cite the source, refuse unsupported claims, and stay concise, neutral, and action-oriented",
    takeaway: "Guardrails are what make the assistant safe to trust operationally.",
    figureRole: "Show the instruction guardrails as visible build choices.",
    family: "guardrail-grid",
    style: "interface",
    notes: [
      "Always cite the source file and page or section.",
      "Refuse unsupported answers instead of guessing.",
      "Keep the tone concise, neutral, and helpful.",
    ],
    variantId: "guardrails-v1",
    variantLabel: "Guardrails V1",
    variantSummary:
      "Guardrail board showing citation, refusal, and tone as the key instruction controls.",
  },
  {
    number: 26,
    slug: "test-in-preview",
    title: "Test in Preview",
    importedSlides: [35],
    purpose: "Keep preview testing central instead of treating it as a final polish step.",
    header: "Preview is where you learn whether the build is actually working",
    subheader:
      "Test known-answer questions, unsupported questions, and ambiguity before you ever think about sharing the tool",
    takeaway: "The build is not real until it survives preview testing.",
    figureRole: "Turn testing into a concrete checklist of scenarios.",
    family: "preview-testing",
    style: "checklist",
    notes: [
      "Ask a question the files can clearly answer.",
      "Ask one the files cannot support.",
      "Ask one that requires a citation to be useful.",
      "Watch whether the first answer is clear enough to resolve the task.",
    ],
    variantId: "test-in-preview-v1",
    variantLabel: "Test in Preview V1",
    variantSummary:
      "Preview-testing checklist that frames validation as part of the build itself.",
  },
  {
    number: 27,
    slug: "unknowns-and-conflicts",
    title: "Push on Unknowns and Conflicts",
    importedSlides: [31, 35],
    purpose: "Make edge-case testing explicit so the audience sees what safe behavior looks like.",
    header: "A strong GPT should handle missing answers and conflicting files gracefully",
    subheader:
      "The goal is not just one good answer. It is reliable behavior when the evidence is thin, absent, or inconsistent.",
    takeaway: "Good refusals and conflict flags are signs of quality, not weakness.",
    figureRole: "Compare the behavior we want under uncertainty with the behavior we do not want.",
    family: "edge-case-grid",
    style: "compare",
    notes: [
      "Desired behavior: say what the files support, what they do not support, and where the human should go next.",
      "Risky behavior: smooth over ambiguity, hide conflict, or turn a gap in the files into a confident answer.",
      "Reliable behavior under uncertainty is one of the strongest signs of a mature build.",
    ],
    variantId: "unknowns-and-conflicts-v1",
    variantLabel: "Unknowns and Conflicts V1",
    variantSummary:
      "Edge-case testing slide that makes refusals and conflict flags feel like product wins.",
  },
  {
    number: 28,
    slug: "deploy-and-share",
    title: "Deploy and Share",
    importedSlides: [36],
    purpose: "Preserve Connor's deployment step while keeping the audience focused on readiness.",
    header: "Share only after the tool has earned it",
    subheader:
      "Once the build is tested, choose the right sharing mode, explain the expectations, and keep the audience aware of access or capacity limits",
    takeaway: "Deployment is a product decision, not a finish button.",
    figureRole: "Show deployment as a final gate rather than a casual click.",
    family: "deployment-roadmap",
    style: "process",
    notes: [
      "Finalize after testing and revisions.",
      "Choose the right sharing audience or link mode.",
      "Set expectations about access, limits, and support.",
    ],
    variantId: "deploy-and-share-v1",
    variantLabel: "Deploy and Share V1",
    variantSummary:
      "Deployment slide that reframes sharing as a readiness gate with audience expectations attached.",
  },
  {
    number: 29,
    slug: "governance-and-maintenance",
    title: "Governance and Maintenance",
    importedSlides: [39],
    purpose: "Carry Connor's maintenance slide into the operational close of the talk.",
    header: "The tool needs an owner, an update habit, and a source-of-truth policy set",
    subheader:
      "Governance means someone knows what files belong in the GPT, when they get updated, and how the tool gets re-tested",
    takeaway: "A useful GPT is maintained like a real program asset.",
    figureRole: "Use an operational governance grid, not a compliance wall of text.",
    family: "governance-grid",
    style: "cards",
    notes: [
      "Assign a named owner or small governance team.",
      "Review and replace important files on a schedule.",
      "Keep one approved source set and re-test after updates.",
    ],
    variantId: "governance-and-maintenance-v1",
    variantLabel: "Governance and Maintenance V1",
    variantSummary:
      "Governance grid showing ownership, update cadence, and source control as the core maintenance habits.",
  },
  {
    number: 30,
    slug: "best-practices",
    title: "Best Practices",
    importedSlides: [40, 41, 42, 43, 44, 45, 46],
    purpose: "Consolidate Connor's repeated best-practice slides into one stronger board.",
    header: "A few best practices do most of the safety work",
    subheader:
      "No PHI, strong prompt guardrails, visible citations, and a clear source-of-truth disclaimer will carry you far",
    takeaway: "A compact best-practice board is more useful than six nearly duplicated slides.",
    figureRole: "Turn the repeated best-practice content into one memorable grid.",
    family: "practice-grid",
    style: "cards",
    notes: [
      "No PHI in uploads or prompts.",
      "The policy document stays authoritative.",
      "Strong guardrails matter more than clever phrasing.",
      "Citations should always be visible.",
    ],
    variantId: "best-practices-v1",
    variantLabel: "Best Practices V1",
    variantSummary:
      "Consolidated best-practice board built from Connor's repeated close-section guidance.",
  },
  {
    number: 31,
    slug: "future-opportunities",
    title: "Future Opportunities",
    importedSlides: [48],
    purpose: "Keep Connor's future-opportunities slide as the optimistic near-close.",
    header: "The same design pattern can support other educational and operational jobs",
    subheader:
      "Once the team understands scope, grounding, and governance, the pattern can extend into onboarding, teaching, and study workflows",
    takeaway: "A well-governed policy assistant can be the starting point, not the endpoint.",
    figureRole: "Show adjacent opportunities without making the current talk feel unfocused.",
    family: "opportunity-grid",
    style: "cards",
    notes: [
      "Rotation onboarding assistants.",
      "Didactic support and summarization tools.",
      "Study and resource guides.",
      "Simulation or research helpers.",
    ],
    variantId: "future-opportunities-v1",
    variantLabel: "Future Opportunities V1",
    variantSummary:
      "Opportunity grid that keeps Connor's forward-looking energy while staying connected to the workshop theme.",
  },
  {
    number: 32,
    slug: "takeaways-qa",
    title: "Takeaways and Q&A",
    importedSlides: [49, 51],
    purpose: "Close the workshop cleanly with practical next steps and room for discussion.",
    header: "Build small, ground it well, test it hard, and govern it like it matters",
    subheader:
      "That is how a custom GPT becomes a useful policy-support tool instead of an impressive but fragile demo",
    takeaway: "The audience should leave with a practical first move and a realistic quality bar.",
    figureRole: "Use a crisp closing summary with optional contact or QR space.",
    family: "closing-summary",
    style: "closing",
    notes: [
      "Build small and specific.",
      "Ground it in current files.",
      "Test edge cases before sharing.",
      "Govern it like a real tool.",
    ],
    variantId: "takeaways-qa-v1",
    variantLabel: "Takeaways and Q&A V1",
    variantSummary:
      "Closing summary slide that turns the workshop into a compact operating checklist.",
  },
];

const preferredSequence = [
  "title-promise",
  "who-we-are",
  "workflow-burden",
  "policy-assistant-object",
  "what-good-looks-like",
  "good-vs-bad-answer",
  "why-it-works",
  "limits-and-failure-modes",
  "solution-at-a-glance",
  "program-operations-fit",
  "workflow-repetition",
  "burden-data",
  "retrieval-plain-language",
  "benefits-of-grounding",
  "source-prep",
  "what-to-upload",
  "file-hygiene-versioning",
  "gigo",
  "privacy-and-security",
  "five-step-build-workflow",
  "live-walkthrough-setup",
  "start-a-custom-gpt",
  "create-vs-configure",
  "role-and-scope",
  "knowledge-and-capabilities",
  "guardrails",
  "test-in-preview",
  "unknowns-and-conflicts",
  "deploy-and-share",
  "governance-and-maintenance",
  "best-practices",
  "future-opportunities",
  "takeaways-qa",
];

const slidesBySlug = new Map([...openingSlides, ...slidePlan].map((slide) => [slide.slug, slide]));
const seedSlides = preferredSequence.map((slug, index) => {
  const slide = slidesBySlug.get(slug);
  if (!slide) {
    throw new Error(`Missing slide definition for slug: ${slug}`);
  }

  return {
    ...slide,
    number: index + 1,
  };
});

for (const slide of seedSlides) {
  slide.id = `slide-${pad(slide.number)}`;
  slide.packetPath = `projects/customgpt/slide-packets/${slide.id}-${slide.slug}.md`;
  slide.variantDir = `projects/customgpt/slide-figures/${slide.id}/versions/version-000001--${slide.variantId}`;
}

const buildPacket = (slide) => {
  const assetLine =
    slide.style === "interface"
      ? "Connor source screenshots and current ChatGPT surface references"
      : slide.style === "speaker"
        ? "speaker headshots, compact role framing, and session roadmap graphic"
      : slide.style === "title"
        ? "conference shell, custom document-to-answer hero graphic, and workshop promise panel"
        : "none yet";
  const openQuestion = styleOpenQuestion[slide.style] ?? "What needs to change before this is speaker-ready?";

  return [
    `# Slide ${pad(slide.number)} Packet — ${slide.title}`,
    "",
    "## Objective",
    "",
    `- ${slide.purpose}`,
    `- ${slide.figureRole}`,
    "",
    "## Copy",
    "",
    "- Header:",
    `  \`${slide.header}\``,
    "- Subheader:",
    `  \`${slide.subheader}\``,
    "- Takeaway:",
    `  \`${slide.takeaway}\``,
    "",
    "## Visual direction",
    "",
    "- preferred family:",
    `  ${familyLabel(slide.family)}`,
    "- assets needed:",
    `  ${assetLine}`,
    "- references:",
    `  Connor original slide${slide.importedSlides.length > 1 ? "s" : ""} ${slide.importedSlides.join(", ")}`,
    "",
    "## Open questions",
    "",
    `- ${openQuestion}`,
    "",
  ].join("\n");
};

const toDeckSlide = (slide) => ({
  id: slide.id,
  displayNumber: String(slide.number),
  importedSlides: slide.importedSlides,
  status: "active",
  title: slide.title,
  purpose: slide.purpose,
  header: slide.header,
  subheader: slide.subheader,
  takeaway: slide.takeaway,
  figureRole: slide.figureRole,
  family: slide.family,
  buildStatus: "packet and seeded mockup drafted",
  proof: [],
  paths: {
    packet: slide.packetPath,
    specs: [],
    stampedDir: null,
    assetsManifest: null,
  },
  selectedDirection: `${slide.variantLabel} is the current selected mockup.`,
  notes: slide.notes,
  selectedVariantId: slide.variantId,
  variants: [
    {
      id: slide.variantId,
      label: slide.variantLabel,
      status: "selected",
      summary: slide.variantSummary,
      previewPath: `${slide.variantDir}/preview.png`,
      files: [
        { label: "Version dir", path: slide.variantDir },
        { label: "HTML", path: `${slide.variantDir}/generated.html` },
        { label: "Preview", path: `${slide.variantDir}/preview.png` },
      ],
    },
  ],
});

const buildMasterSpecs = (slides, activeSequence) => {
  const sections = slides
    .map(
      (slide) =>
        [
          `## Slide ${slide.displayNumber} — ${slide.title}`,
          "",
          `- Purpose: ${slide.purpose || "TBD"}`,
          `- Header: \`${slide.header || "TBD"}\``,
          `- Subheader: \`${slide.subheader || "TBD"}\``,
          `- Takeaway: ${slide.takeaway || "TBD"}`,
          `- Figure role: ${slide.figureRole || "TBD"}`,
          `- Imported source slides: ${slide.importedSlides?.length ? slide.importedSlides.join(", ") : "none"}`,
          "",
        ].join("\n")
    )
    .join("\n");

  return [
    "# CustomGPT Creation — Master Slide Specs",
    "",
    "Human-readable companion to `deck-spec.json`.",
    "",
    "Use this file for quick deck reading and copy review. Use `deck-spec.json` as",
    "the canonical current deck backbone for active versus deprecated status,",
    "numbering policy, and report rendering.",
    "",
    "## Working precedence",
    "",
    "- current active / deprecated backbone:",
    "  `deck-spec.json`",
    "- visual direction defaults to:",
    "  `inputs/VISUAL_SOURCE_DOC.md`",
    "- header / subheader / citation language defaults to:",
    "  `inputs/COPY_SOURCE_DOC.md`",
    "- process and artifact structure default to:",
    "  `workflow.md`",
    "",
    "## Current note",
    "",
    "- active sequence:",
    `  \`${activeSequence.join(", ")}\``,
    "- deprecated:",
    "  none yet",
    "- current direction:",
    "  expanded workshop master deck with Connor's original material reorganized into a clearer teaching flow",
    "",
    "## Deck spine",
    "",
    "1. The residency-admin policy problem is real and repetitive.",
    "2. A custom GPT can solve a narrow version of it if designed carefully.",
    "3. The audience should understand the build sequence before the UI arrives.",
    "4. Governance and maintenance belong in the main story, not the appendix.",
    "",
    "## Active Slide Specs",
    "",
    sections,
  ].join("\n");
};

const buildDeckMatrix = (slides, activeSequence) => {
  const inventory = slides
    .map(
      (slide) =>
        [
          `### Slide ${slide.displayNumber} — ${slide.title}`,
          "",
          `- role: ${slide.purpose || "TBD"}`,
          `- figure importance: ${Number(slide.displayNumber) <= 3 || Number(slide.displayNumber) >= 19 ? "essential" : "helpful"}`,
          `- family: ${slide.family || "unspecified"}`,
          `- current status: ${slide.buildStatus || "packet drafted"}`,
          `- next artifact: ${slide.selectedVariantId ? "selected mockup already present" : "seed mockup"}`,
          "",
        ].join("\n")
    )
    .join("\n");

  return [
    "# Deck Matrix",
    "",
    "Human-readable status companion to `deck-spec.json`.",
    "",
    "Use `deck-spec.json` for the canonical current backbone. Use this file for a",
    "quick per-slide execution map.",
    "",
    "## Current note",
    "",
    "- active sequence:",
    `  \`${activeSequence.join(", ")}\``,
    "- deprecated:",
    "  none yet",
    "- current direction:",
    "  expanded workshop deck with seeded mockups across the full slide wall",
    "",
    "## Narrative spine",
    "",
    "- Buried policy answers create real administrative drag",
    "- A custom GPT can become a grounded policy assistant",
    "- The workshop should move from concept to build without over-teaching theory",
    "- Governance and maintenance stay inside the main narrative",
    "",
    "## Visual sibling groups",
    "",
    "- Slides 1 to 7:",
    "  workshop opening, problem framing, and product object",
    "- Slides 8 to 13:",
    "  mechanism, benefits, limits, and quality bar",
    "- Slides 14 to 18:",
    "  source prep and tool-selection guidance",
    "- Slides 19 to 28:",
    "  build walkthrough, configuration, testing, and deployment",
    "- Slides 29 to 32:",
    "  governance, best practices, future opportunities, and close",
    "",
    "## Active Slide Inventory",
    "",
    inventory,
  ].join("\n");
};

const buildReadme = () =>
  [
    "# SAEM Custom GPT Creation",
    "",
    "Working project for the SAEM workshop:",
    "`CustomGPT Creation`.",
    "",
    "Current presenters:",
    "",
    "- Connor Grant, MD",
    "- Rana Kabeer, MD",
    "- Eddie Garcia, MD",
    "",
    "This folder is the project home for:",
    "",
    "- the rebuilt workshop deck in `deck-spec.json`",
    "- the narrative rewrite in `master-slide-specs.md`",
    "- the execution map in `deck-matrix.md`",
    "- program assumptions in `inputs/PROGRAM_NOTES.md`",
    "- the audit of Connor's original deck in `inputs/CURRENT_DECK_AUDIT.md`",
    "- the expanded rebuild plan in `inputs/RESTRUCTURE_PLAN.md`",
    "- source deck files in `references/source-deck/`",
    "- the locked Studio template in `templates/saem-conference-template-v1/`",
    "- packet files for the active slide sequence in `slide-packets/`",
    "- seeded and generated mockups in `slide-figures/`",
    "",
    "## Working goal",
    "",
    "Turn Connor's original 51-slide source deck into a clearer 30-plus-slide",
    "workshop that:",
    "",
    "- defines the policy-assistant object early",
    "- keeps the strongest parts of Connor's problem, build, and governance content",
    "- spends real time on source prep, guardrails, testing, and maintenance",
    "- stays browseable in Studio as a living master deck rather than a thin repo index",
    "",
    "## Source material",
    "",
    "- Connor's original deck:",
    "  `references/source-deck/connor-original-deck.pptx`",
    "- workshop packet preview:",
    "  `references/source-deck/workshop-packet-preview.png`",
    "- conference template:",
    "  `assets/powerpoint-template/saem-annual-meeting-powerpoint-template.pptx`",
    "",
    "## Current structure",
    "",
    "- 32 active slides",
    "- slides 1 to 3 keep the existing bespoke mockups",
    "- slides 4 to 32 are seeded with first-pass mockups so the whole deck is visible in Studio",
    "- the deck order now preserves Connor's strongest material while reorganizing it into a more teachable sequence",
    "",
    "## Suggested next moves",
    "",
    "- replace seed mockups on the most important build slides with screenshot-backed variants",
    "- add final citations and evidence language to the burden slides",
    "- tighten the talk to the desired live speaking length once the new sequence is reviewed",
    "",
  ].join("\n");

const buildRestructurePlan = () =>
  [
    "# Restructure Plan",
    "",
    "## Current recommendation",
    "",
    "The earlier compressed 11-slide rebuild is now superseded.",
    "",
    "Rebuild the current 51-slide source deck into an expanded 32-slide workshop",
    "sequence that keeps Connor's strongest material while reorganizing it into a",
    "clearer teaching flow.",
    "",
    "## Why this direction changed",
    "",
    "- the talk needs more room to break down the concepts slide by slide",
    "- Connor's original work contains several strong pieces worth preserving",
    "- the Studio workspace is more useful when the deck behaves like a real master",
    "  deck rather than a minimal summary",
    "",
    "## Expanded slide spine",
    "",
    ...seedSlides.map((slide) => `${slide.number}. ${slide.title}`),
    "",
    "## Product-state updates to reflect",
    "",
    "Use the current OpenAI product surface, not the older deck assumptions:",
    "",
    "- GPTs are created from the GPTs area in ChatGPT",
    "- GPTs are configured with instructions, knowledge, and selected capabilities",
    "- model choices may change over time, so the talk should not over-anchor to one",
    "  product-generation assumption",
    "- testing in Preview is central",
    "",
    "## Visual priorities",
    "",
    "- a dense master-deck Studio view with visible mockups for every slide",
    "- screenshot-backed interface slides for the build sequence",
    "- stronger comparison slides for answer quality and failure modes",
    "- one consolidated best-practice board rather than repeated near-duplicate slides",
    "",
  ].join("\n");

const PROMISE_DETAILS = [
  "A custom GPT that answers policy questions from your uploaded documents.",
  "Instructions, knowledge files, and careful testing drive the quality.",
  "We will create, test, and refine one in the current ChatGPT workflow.",
];

const QUESTION_LOOP_EXAMPLES = [
  "Can I switch this shift if I am post-call the next morning?",
  "Where is the moonlighting approval process written down?",
  "How many vacation days can be used during an elective block?",
  "What is the escalation path if jeopardy coverage falls through?",
];

const CONCEPT_EXAMPLES = {
  "concept-card": {
    question: "Can a resident use vacation during an ICU month, and who approves it?",
    answer:
      "The uploaded leave policy says vacation requests during ICU blocks require program approval and should be submitted with as much advance notice as possible. If the schedule is already locked, the chief resident should be contacted before the request is finalized.",
    citation: "Residency Handbook · Vacation and Leave",
  },
  "solution-card": {
    question: "Where is the moonlighting approval process written down?",
    answer:
      "The assistant can retrieve the moonlighting policy, summarize the approval steps, and point the learner to the right coordinator or form instead of forcing a manual PDF search.",
    citation: "GME Policies 2025–2026 · Moonlighting",
  },
  "quality-pillars": {
    question: "Can I use educational leave for this conference?",
    answer:
      "A good answer should cite the policy, explain the relevant rule in plain language, and say what to do next if the file does not fully resolve the case.",
    citation: "Conference Attendance Policy · Resident Handbook",
  },
};

const buildPolicyLoopGraphicSvg = () => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="800" viewBox="0 0 1600 800" fill="none">
  <rect width="1600" height="800" rx="36" fill="#F7FAFD"/>
  <path d="M332 212C526 108 782 108 968 208" stroke="#156082" stroke-width="10" stroke-linecap="round" stroke-dasharray="12 18" opacity="0.28"/>
  <path d="M306 548C520 696 874 692 1094 542" stroke="#E97132" stroke-width="10" stroke-linecap="round" stroke-dasharray="12 18" opacity="0.26"/>
  <path d="M1084 230C1242 310 1260 500 1108 578" stroke="#0E2841" stroke-width="10" stroke-linecap="round" stroke-dasharray="12 18" opacity="0.26"/>

  <rect x="520" y="182" width="560" height="428" rx="34" fill="white" stroke="#DCE6EE" stroke-width="4"/>
  <text x="560" y="240" fill="#156082" font-family="Aptos, Segoe UI, Arial, sans-serif" font-size="26" font-weight="700" letter-spacing="3">APPROVED POLICY SET</text>
  <rect x="564" y="280" width="472" height="88" rx="22" fill="#F5F9FD" stroke="#DCE6EE" stroke-width="3"/>
  <text x="600" y="332" fill="#0E2841" font-family="Aptos Display, Aptos, Arial, sans-serif" font-size="34" font-weight="800">Resident Handbook</text>
  <rect x="564" y="388" width="472" height="88" rx="22" fill="#F7F2EF" stroke="#F2D8C8" stroke-width="3"/>
  <text x="600" y="440" fill="#0E2841" font-family="Aptos Display, Aptos, Arial, sans-serif" font-size="34" font-weight="800">Leave / Coverage Policies</text>
  <rect x="564" y="496" width="472" height="72" rx="20" fill="#F5F9FD" stroke="#DCE6EE" stroke-width="3"/>
  <text x="600" y="540" fill="#0E2841" font-family="Aptos, Segoe UI, Arial, sans-serif" font-size="28" font-weight="700">Moonlighting • Conference • Jeopardy</text>

  <g>
    <circle cx="258" cy="206" r="86" fill="#0E2841"/>
    <text x="258" y="196" text-anchor="middle" fill="white" font-family="Aptos Display, Aptos, Arial, sans-serif" font-size="34" font-weight="800">PD</text>
    <text x="258" y="230" text-anchor="middle" fill="white" font-family="Aptos, Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">Program Director</text>
  </g>
  <g>
    <circle cx="256" cy="610" r="86" fill="#156082"/>
    <text x="256" y="600" text-anchor="middle" fill="white" font-family="Aptos Display, Aptos, Arial, sans-serif" font-size="32" font-weight="800">CR</text>
    <text x="256" y="634" text-anchor="middle" fill="white" font-family="Aptos, Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">Chief Resident</text>
  </g>
  <g>
    <circle cx="1290" cy="404" r="86" fill="#E97132"/>
    <text x="1290" y="394" text-anchor="middle" fill="white" font-family="Aptos Display, Aptos, Arial, sans-serif" font-size="32" font-weight="800">PC</text>
    <text x="1290" y="428" text-anchor="middle" fill="white" font-family="Aptos, Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">Program Coordinator</text>
  </g>

  <rect x="348" y="112" width="240" height="64" rx="20" fill="white" stroke="#DCE6EE" stroke-width="3"/>
  <text x="374" y="152" fill="#0E2841" font-family="Aptos, Segoe UI, Arial, sans-serif" font-size="24" font-weight="700">Can I switch post-call?</text>
  <rect x="278" y="674" width="268" height="64" rx="20" fill="white" stroke="#DCE6EE" stroke-width="3"/>
  <text x="304" y="714" fill="#0E2841" font-family="Aptos, Segoe UI, Arial, sans-serif" font-size="24" font-weight="700">Where is moonlighting?</text>
  <rect x="1068" y="150" width="296" height="64" rx="20" fill="white" stroke="#DCE6EE" stroke-width="3"/>
  <text x="1094" y="190" fill="#0E2841" font-family="Aptos, Segoe UI, Arial, sans-serif" font-size="24" font-weight="700">How many vacation days?</text>
  <rect x="1088" y="610" width="264" height="64" rx="20" fill="white" stroke="#DCE6EE" stroke-width="3"/>
  <text x="1114" y="650" fill="#0E2841" font-family="Aptos, Segoe UI, Arial, sans-serif" font-size="24" font-weight="700">Who approves the change?</text>

  <rect x="636" y="642" width="332" height="78" rx="24" fill="#0E2841"/>
  <text x="802" y="687" text-anchor="middle" fill="white" font-family="Aptos, Segoe UI, Arial, sans-serif" font-size="28" font-weight="700">The same files keep generating the same loop</text>
</svg>`;

const buildGroundedAssistantGraphicSvg = () => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="800" viewBox="0 0 1600 800" fill="none">
  <rect width="1600" height="800" rx="36" fill="#F7FAFD"/>
  <rect x="96" y="192" width="356" height="172" rx="28" fill="white" stroke="#DCE6EE" stroke-width="4"/>
  <text x="132" y="244" fill="#156082" font-family="Aptos, Segoe UI, Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="3">QUESTION</text>
  <text x="132" y="304" fill="#0E2841" font-family="Aptos Display, Aptos, Arial, sans-serif" font-size="38" font-weight="800">Can I use vacation</text>
  <text x="132" y="350" fill="#0E2841" font-family="Aptos Display, Aptos, Arial, sans-serif" font-size="38" font-weight="800">during ICU?</text>

  <path d="M470 278H572" stroke="#156082" stroke-width="12" stroke-linecap="round"/>
  <path d="M552 254L592 278L552 302" stroke="#156082" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>

  <rect x="596" y="120" width="368" height="148" rx="28" fill="white" stroke="#DCE6EE" stroke-width="4"/>
  <rect x="596" y="318" width="368" height="148" rx="28" fill="white" stroke="#DCE6EE" stroke-width="4"/>
  <rect x="596" y="516" width="368" height="148" rx="28" fill="white" stroke="#DCE6EE" stroke-width="4"/>
  <text x="632" y="174" fill="#156082" font-family="Aptos, Segoe UI, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="3">INSTRUCTIONS</text>
  <text x="632" y="226" fill="#0E2841" font-family="Aptos Display, Aptos, Arial, sans-serif" font-size="34" font-weight="800">Narrow role + refusal rules</text>
  <text x="632" y="372" fill="#156082" font-family="Aptos, Segoe UI, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="3">KNOWLEDGE</text>
  <text x="632" y="424" fill="#0E2841" font-family="Aptos Display, Aptos, Arial, sans-serif" font-size="34" font-weight="800">Approved policy files only</text>
  <text x="632" y="570" fill="#156082" font-family="Aptos, Segoe UI, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="3">TESTING</text>
  <text x="632" y="622" fill="#0E2841" font-family="Aptos Display, Aptos, Arial, sans-serif" font-size="34" font-weight="800">Known answers + unsupported cases</text>

  <path d="M990 392H1092" stroke="#E97132" stroke-width="12" stroke-linecap="round"/>
  <path d="M1072 368L1112 392L1072 416" stroke="#E97132" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>

  <rect x="1116" y="176" width="388" height="288" rx="32" fill="#0E2841"/>
  <text x="1154" y="228" fill="#A8D7EA" font-family="Aptos, Segoe UI, Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="3">GROUNDED ANSWER</text>
  <text x="1154" y="298" fill="white" font-family="Aptos Display, Aptos, Arial, sans-serif" font-size="36" font-weight="800">The policy allows vacation only</text>
  <text x="1154" y="340" fill="white" font-family="Aptos Display, Aptos, Arial, sans-serif" font-size="36" font-weight="800">with program approval during ICU.</text>
  <rect x="1154" y="390" width="164" height="46" rx="16" fill="#164B6D"/>
  <rect x="1332" y="390" width="124" height="46" rx="16" fill="#164B6D"/>
  <text x="1236" y="420" text-anchor="middle" fill="white" font-family="Aptos, Segoe UI, Arial, sans-serif" font-size="20" font-weight="700">Source cited</text>
  <text x="1394" y="420" text-anchor="middle" fill="white" font-family="Aptos, Segoe UI, Arial, sans-serif" font-size="20" font-weight="700">Bounded</text>

  <rect x="1140" y="516" width="340" height="96" rx="24" fill="white" stroke="#F2D8C8" stroke-width="4"/>
  <text x="1174" y="570" fill="#0E2841" font-family="Aptos, Segoe UI, Arial, sans-serif" font-size="28" font-weight="700">If the files do not support it, the GPT should say so.</text>
</svg>`;

const buildPrivacyBoundaryGraphicSvg = () => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="800" viewBox="0 0 1600 800" fill="none">
  <rect width="1600" height="800" rx="36" fill="#F7FAFD"/>
  <rect x="628" y="150" width="344" height="356" rx="42" fill="#0E2841"/>
  <path d="M800 198L912 242V356C912 438 852 498 800 526C748 498 688 438 688 356V242L800 198Z" fill="#156082"/>
  <text x="800" y="330" text-anchor="middle" fill="white" font-family="Aptos Display, Aptos, Arial, sans-serif" font-size="40" font-weight="800">Policy</text>
  <text x="800" y="376" text-anchor="middle" fill="white" font-family="Aptos Display, Aptos, Arial, sans-serif" font-size="40" font-weight="800">Support GPT</text>
  <text x="800" y="430" text-anchor="middle" fill="#CDEAF5" font-family="Aptos, Segoe UI, Arial, sans-serif" font-size="24" font-weight="700">Grounded, narrow, auditable</text>

  <rect x="112" y="172" width="372" height="108" rx="28" fill="white" stroke="#DCE6EE" stroke-width="4"/>
  <rect x="112" y="308" width="372" height="108" rx="28" fill="white" stroke="#DCE6EE" stroke-width="4"/>
  <rect x="112" y="444" width="372" height="108" rx="28" fill="white" stroke="#DCE6EE" stroke-width="4"/>
  <text x="150" y="216" fill="#156082" font-family="Aptos, Segoe UI, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="3">ALLOWED INPUTS</text>
  <text x="150" y="256" fill="#0E2841" font-family="Aptos Display, Aptos, Arial, sans-serif" font-size="32" font-weight="800">Current program policies</text>
  <text x="150" y="352" fill="#0E2841" font-family="Aptos Display, Aptos, Arial, sans-serif" font-size="32" font-weight="800">Resident-facing guidance</text>
  <text x="150" y="488" fill="#0E2841" font-family="Aptos Display, Aptos, Arial, sans-serif" font-size="32" font-weight="800">Approved institutional docs</text>

  <rect x="1116" y="172" width="372" height="108" rx="28" fill="#FFF7F3" stroke="#F2D8C8" stroke-width="4"/>
  <rect x="1116" y="308" width="372" height="108" rx="28" fill="#FFF7F3" stroke="#F2D8C8" stroke-width="4"/>
  <rect x="1116" y="444" width="372" height="108" rx="28" fill="#FFF7F3" stroke="#F2D8C8" stroke-width="4"/>
  <text x="1154" y="216" fill="#E97132" font-family="Aptos, Segoe UI, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="3">DO NOT FEED IT</text>
  <text x="1154" y="256" fill="#0E2841" font-family="Aptos Display, Aptos, Arial, sans-serif" font-size="32" font-weight="800">PHI or patient-care data</text>
  <text x="1154" y="352" fill="#0E2841" font-family="Aptos Display, Aptos, Arial, sans-serif" font-size="32" font-weight="800">Messy personal inbox context</text>
  <text x="1154" y="488" fill="#0E2841" font-family="Aptos Display, Aptos, Arial, sans-serif" font-size="32" font-weight="800">Unapproved broad sharing</text>

  <path d="M496 356H612" stroke="#156082" stroke-width="12" stroke-linecap="round"/>
  <path d="M588 332L628 356L588 380" stroke="#156082" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M988 356H1104" stroke="#E97132" stroke-width="12" stroke-linecap="round"/>
  <path d="M1080 332L1120 356L1080 380" stroke="#E97132" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>

  <rect x="430" y="620" width="742" height="96" rx="26" fill="white" stroke="#DCE6EE" stroke-width="4"/>
  <text x="801" y="676" text-anchor="middle" fill="#0E2841" font-family="Aptos, Segoe UI, Arial, sans-serif" font-size="30" font-weight="700">Sharing is an access decision: know the audience, the files, and the privacy boundary.</text>
</svg>`;

const buildGovernanceCycleGraphicSvg = () => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="800" viewBox="0 0 1600 800" fill="none">
  <rect width="1600" height="800" rx="36" fill="#F7FAFD"/>
  <circle cx="800" cy="400" r="198" fill="white" stroke="#DCE6EE" stroke-width="6"/>
  <circle cx="800" cy="400" r="110" fill="#0E2841"/>
  <text x="800" y="376" text-anchor="middle" fill="white" font-family="Aptos Display, Aptos, Arial, sans-serif" font-size="38" font-weight="800">Useful GPT</text>
  <text x="800" y="424" text-anchor="middle" fill="#CDEAF5" font-family="Aptos, Segoe UI, Arial, sans-serif" font-size="24" font-weight="700">Program asset</text>

  <path d="M800 92C942 92 1068 170 1136 288" stroke="#156082" stroke-width="12" stroke-linecap="round"/>
  <path d="M1124 254L1150 308L1090 302" stroke="#156082" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M1248 400C1248 544 1164 668 1036 732" stroke="#E97132" stroke-width="12" stroke-linecap="round"/>
  <path d="M1072 706L1018 740L1018 676" stroke="#E97132" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M796 736C654 736 530 658 464 542" stroke="#156082" stroke-width="12" stroke-linecap="round"/>
  <path d="M510 570L450 532L510 516" stroke="#156082" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M356 400C356 256 440 132 568 68" stroke="#E97132" stroke-width="12" stroke-linecap="round"/>
  <path d="M534 94L588 60L588 124" stroke="#E97132" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>

  <g>
    <rect x="666" y="34" width="268" height="92" rx="28" fill="white" stroke="#DCE6EE" stroke-width="4"/>
    <text x="800" y="72" text-anchor="middle" fill="#156082" font-family="Aptos, Segoe UI, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="3">01 OWNER</text>
    <text x="800" y="106" text-anchor="middle" fill="#0E2841" font-family="Aptos Display, Aptos, Arial, sans-serif" font-size="28" font-weight="800">Named person or team</text>
  </g>
  <g>
    <rect x="1088" y="266" width="356" height="92" rx="28" fill="white" stroke="#DCE6EE" stroke-width="4"/>
    <text x="1266" y="304" text-anchor="middle" fill="#156082" font-family="Aptos, Segoe UI, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="3">02 SOURCES</text>
    <text x="1266" y="338" text-anchor="middle" fill="#0E2841" font-family="Aptos Display, Aptos, Arial, sans-serif" font-size="28" font-weight="800">Review source set</text>
  </g>
  <g>
    <rect x="1038" y="658" width="328" height="92" rx="28" fill="white" stroke="#DCE6EE" stroke-width="4"/>
    <text x="1202" y="696" text-anchor="middle" fill="#156082" font-family="Aptos, Segoe UI, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="3">03 TESTING</text>
    <text x="1202" y="730" text-anchor="middle" fill="#0E2841" font-family="Aptos Display, Aptos, Arial, sans-serif" font-size="28" font-weight="800">Re-run critical questions</text>
  </g>
  <g>
    <rect x="220" y="658" width="330" height="92" rx="28" fill="white" stroke="#DCE6EE" stroke-width="4"/>
    <text x="385" y="696" text-anchor="middle" fill="#156082" font-family="Aptos, Segoe UI, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="3">04 SHARING</text>
    <text x="385" y="730" text-anchor="middle" fill="#0E2841" font-family="Aptos Display, Aptos, Arial, sans-serif" font-size="28" font-weight="800">Check access</text>
  </g>
</svg>`;

const compareConfigForFamily = (family) => {
  if (family === "input-output-compare") {
    return {
      leftLabel: "Clean inputs",
      leftTitle: "Trustworthy output",
      rightLabel: "Messy inputs",
      rightTitle: "Brittle output",
    };
  }
  if (family === "edge-case-grid") {
    return {
      leftLabel: "Desired under uncertainty",
      leftTitle: "Graceful handling",
      rightLabel: "Risky under uncertainty",
      rightTitle: "Overconfident handling",
    };
  }
  return {
    leftLabel: "Preferred",
    leftTitle: "Desired behavior",
    rightLabel: "Watch out",
    rightTitle: "Risky behavior",
  };
};

const renderAnnotationCards = (notes) =>
  notes
    .map(
      (note, index) => `
        <article class="annotation-card">
          <span class="meta-label">0${index + 1}</span>
          <p>${escapeHtml(note)}</p>
        </article>`
    )
    .join("");

const renderConferenceTitleBody = (slide) => `
  <section class="opening-board opening-board-title">
    <article class="title-hero-card">
      <span class="meta-label">Workshop frame</span>
      <article class="graphic-panel graphic-panel-hero">
        <img class="graphic-image" src="${CUSTOM_GRAPHICS.groundedAssistant}" alt="Grounded assistant concept graphic" />
      </article>
      <div class="goal-strip">
        <span class="meta-label">Primary mission</span>
        <p>Turn static policy PDFs into faster, clearer, and safer first-pass operational answers.</p>
      </div>
    </article>
    <aside class="promise-panel">
      <span class="meta-label">Workshop Promise</span>
      <div class="promise-list">
        ${slide.notes
          .map(
            (note, index) => `
              <article class="promise-step">
                <div class="promise-num">${index + 1}</div>
                <div class="promise-copy">
                  <strong>${escapeHtml(note)}</strong>
                  <p>${escapeHtml(PROMISE_DETAILS[index] ?? "")}</p>
                </div>
              </article>`
          )
          .join("")}
      </div>
    </aside>
  </section>`;

const renderSpeakerIntroBody = (slide) => `
  <section class="speaker-intro-board">
    <div class="speaker-stack">
      ${SPEAKER_CARDS.map(
        (speaker) => `
          <article class="speaker-card speaker-card-detailed">
            <img class="speaker-avatar" src="${speaker.image}" alt="${escapeHtml(speaker.name)}" />
            <div class="speaker-copy">
              <span class="meta-label">${escapeHtml(speaker.role)}</span>
              <strong>${escapeHtml(speaker.name)}</strong>
              <p>${escapeHtml(speaker.focus ?? "")}</p>
            </div>
          </article>`
      ).join("")}
    </div>
    <aside class="session-roadmap">
      <span class="meta-label">What happens in the room</span>
      <div class="session-roadmap-list session-roadmap-list-lined">
        <article class="session-roadmap-step">
          <span class="promise-num">1</span>
          <div>
            <strong>Define the object</strong>
            <p>We show what a grounded policy assistant is and what good answers look like.</p>
          </div>
        </article>
        <article class="session-roadmap-step">
          <span class="promise-num">2</span>
          <div>
            <strong>Build it live</strong>
            <p>We walk through the current ChatGPT builder with scope, files, guardrails, and preview testing.</p>
          </div>
        </article>
        <article class="session-roadmap-step">
          <span class="promise-num">3</span>
          <div>
            <strong>Leave with a playbook</strong>
            <p>We close on governance, best practices, and the first narrow assistant to pilot responsibly.</p>
          </div>
        </article>
      </div>
      <div class="goal-strip">
        <span class="meta-label">What this is not</span>
        <p>Not a hype talk, not a patient-care tool, and not a generic AI lecture.</p>
      </div>
    </aside>
  </section>`;

const renderTitleBody = (slide) => {
  if (slide.family === "speaker-intro") {
    return renderSpeakerIntroBody(slide);
  }

  return renderConferenceTitleBody(slide);
};

const renderProblemBody = (slide) => {
  const roleLabels = ["Program Director", "Chief Resident", "Program Coordinator"];

  if (slide.family === "burden-data") {
    return `
      <section class="burden-board">
        <article class="feature-lead-card burden-hero-card">
          <div class="card-topline">
            <span class="meta-label">Why this matters</span>
            <span class="card-line"></span>
          </div>
          <p>${escapeHtml(slide.notes[0])}</p>
          <div class="impact-strip">
            <div class="impact-chip">
              <span>Burnout</span>
              <strong>Repeated uncertainty adds avoidable stress.</strong>
            </div>
            <div class="impact-chip">
              <span>Friction</span>
              <strong>Answers stall when one person holds the context.</strong>
            </div>
            <div class="impact-chip">
              <span>Consistency</span>
              <strong>Grounded first-pass answers reduce rework.</strong>
            </div>
          </div>
        </article>
        <div class="bento-grid">
          ${slide.notes
            .slice(1)
            .map(
              (note, index) => `
                <article class="info-card">
                  <div class="card-topline">
                    <span class="meta-label">0${index + 2}</span>
                    <span class="card-line"></span>
                  </div>
                  <p>${escapeHtml(note)}</p>
                </article>`
            )
            .join("")}
          <article class="highlight-card highlight-card-accent">
            <span class="meta-label">Operational payoff</span>
            <p>${escapeHtml(slide.takeaway)}</p>
          </article>
        </div>
      </section>`;
  }

  if (slide.family === "stakeholder-map") {
    return `
      <section class="stakeholder-board">
        <div class="stakeholder-center">
          <span class="meta-label">Shared support layer</span>
          <h3>Residency policy assistant</h3>
          <p>One grounded tool can reduce repeated policy interrupts across the team.</p>
        </div>
        <div class="stakeholder-grid">
          ${slide.notes
            .map(
              (note, index) => `
                <article class="info-card orbit-card">
                  <div class="card-topline">
                    <span class="meta-label">0${index + 1}</span>
                    <span class="card-line"></span>
                  </div>
                  <p>${escapeHtml(note)}</p>
                </article>`
            )
            .join("")}
        </div>
      </section>`;
  }

  if (slide.family === "problem-frame") {
    return `
      <section class="problem-board problem-board-illustrated">
        <div class="problem-copy-column">
          <article class="problem-thesis">
            <span class="meta-label">Operational reality</span>
            <p>This is not a novelty problem. The same questions keep returning to the same small group of people because the source material is trapped in static documents.</p>
          </article>
          <div class="role-ribbon-stack">
            ${slide.notes
              .map(
                (note, index) => `
                  <div class="role-ribbon role-ribbon-${index + 1}">
                    <span class="role-label">${roleLabels[index] ?? `Role ${index + 1}`}</span>
                    <p>${escapeHtml(note)}</p>
                  </div>`
              )
              .join("")}
          </div>
        </div>
        <article class="graphic-panel graphic-panel-problem">
          <img class="graphic-image" src="${CUSTOM_GRAPHICS.policyLoop}" alt="Repeated policy question loop graphic" />
        </article>
      </section>`;
  }

  return `
    <section class="problem-board">
      <div class="problem-role-column">
        ${slide.notes
          .map(
            (note, index) => `
              <article class="role-card role-card-${index + 1}">
                <span class="role-label">${roleLabels[index] ?? `Role ${index + 1}`}</span>
                <p>${escapeHtml(note)}</p>
              </article>`
          )
          .join("")}
      </div>
      <div class="problem-figure">
        <article class="info-card problem-callout">
          <span class="meta-label">What this means</span>
          <p>This is not a novelty demo. It is a repeated administrative workflow problem that keeps consuming the same time and attention.</p>
        </article>
        <article class="dark-panel question-loop-panel">
          <span class="meta-label">The same source files still generate the same question loop</span>
          <div class="question-loop-grid">
            ${QUESTION_LOOP_EXAMPLES.map(
              (question, index) => `
                <article class="question-card">
                  <span class="question-label">Question ${index + 1}</span>
                  <p>${escapeHtml(question)}</p>
                </article>`
            ).join("")}
          </div>
          <div class="impact-strip">
            <div class="impact-chip">
              <span>Input</span>
              <strong>Static PDFs and policy documents</strong>
            </div>
            <div class="impact-chip">
              <span>Current state</span>
              <strong>Manual search and repeated interpretation</strong>
            </div>
            <div class="impact-chip">
              <span>Opportunity</span>
              <strong>Faster first-pass answers with clear source boundaries</strong>
            </div>
          </div>
        </article>
      </div>
    </section>`;
};

const renderConceptBody = (slide) => {
  const example =
    CONCEPT_EXAMPLES[slide.family] ?? CONCEPT_EXAMPLES["concept-card"];

  if (slide.family === "concept-card") {
    return `
      <section class="concept-board concept-board-graphic">
        <article class="graphic-panel graphic-panel-concept">
          <img class="graphic-image" src="${CUSTOM_GRAPHICS.groundedAssistant}" alt="Grounded assistant system graphic" />
        </article>
        <div class="concept-side-notes">
          <article class="info-card concept-note-card">
            <span class="meta-label">Narrow on purpose</span>
            <p>The assistant exists to answer operational policy questions from approved files, not to imitate a general-purpose chatbot.</p>
          </article>
          <div class="annotation-list">
            ${renderAnnotationCards(slide.notes)}
          </div>
        </div>
      </section>`;
  }

  if (slide.family === "quality-pillars") {
    return `
      <section class="quality-board">
        <article class="quality-example-card">
          <span class="meta-label">Example policy answer</span>
          <div class="chat-bubble chat-bubble-user">${escapeHtml(example.question)}</div>
          <div class="chat-bubble chat-bubble-ai">
            ${escapeHtml(example.answer)}
            <div class="citation-row">
              <span class="source-chip">${escapeHtml(example.citation)}</span>
              <span class="source-chip">Source bounded</span>
            </div>
          </div>
        </article>
        <div class="quality-pillars">
          <article class="quality-pillar quality-pillar-1">
            <span class="quality-pillar-num">01</span>
            <strong>Specific</strong>
            <p>${escapeHtml(slide.notes[0])}</p>
          </article>
          <article class="quality-pillar quality-pillar-2">
            <span class="quality-pillar-num">02</span>
            <strong>Cited</strong>
            <p>${escapeHtml(slide.notes[1])}</p>
          </article>
          <article class="quality-pillar quality-pillar-3">
            <span class="quality-pillar-num">03</span>
            <strong>Bounded</strong>
            <p>${escapeHtml(slide.notes[2])}</p>
          </article>
        </div>
      </section>`;
  }

  return `
    <section class="concept-board">
      <article class="chat-surface">
        <span class="meta-label">Example policy question</span>
        <div class="chat-bubble chat-bubble-user">${escapeHtml(example.question)}</div>
        <div class="chat-bubble chat-bubble-ai">
          ${escapeHtml(example.answer)}
          <div class="citation-row">
            <span class="source-chip">${escapeHtml(example.citation)}</span>
            <span class="source-chip">Source bounded</span>
          </div>
        </div>
        <div class="ingredient-strip">
          <article class="ingredient-card">
            <span class="meta-label">Instructions</span>
            <p>Define the role, limits, and refusal behavior.</p>
          </article>
          <article class="ingredient-card">
            <span class="meta-label">Knowledge</span>
            <p>Upload the policy set that should ground the answer.</p>
          </article>
          <article class="ingredient-card">
            <span class="meta-label">Output</span>
            <p>Return a cited answer or say the files do not support one.</p>
          </article>
        </div>
      </article>
      <div class="annotation-list">
        ${renderAnnotationCards(slide.notes)}
      </div>
    </section>`;
};

const renderBentoCards = (slide) => `
  <section class="bento-board">
    <article class="feature-lead-card">
      <div class="card-topline">
        <span class="meta-label">Lead point</span>
        <span class="card-line"></span>
      </div>
      <p>${escapeHtml(slide.notes[0] ?? slide.takeaway)}</p>
    </article>
    <div class="bento-grid">
      ${slide.notes
        .slice(1)
        .map(
          (note, index) => `
            <article class="info-card">
              <div class="card-topline">
                <span class="meta-label">0${index + 2}</span>
                <span class="card-line"></span>
              </div>
              <p>${escapeHtml(note)}</p>
            </article>`
        )
        .join("")}
      <article class="highlight-card highlight-card-accent">
        <span class="meta-label">Primary takeaway</span>
        <p>${escapeHtml(slide.takeaway)}</p>
      </article>
    </div>
  </section>`;

const renderToolLandscape = (slide) => `
  <section class="landscape-board">
    ${slide.notes
      .map(
        (note, index) => `
          <article class="tool-card${index === 0 ? " tool-card-featured" : ""}">
            <span class="meta-label">Option ${index + 1}</span>
            <strong>${escapeHtml(note)}</strong>
          </article>`
      )
      .join("")}
    <article class="highlight-card">
      <span class="meta-label">Main point</span>
      <p>${escapeHtml(slide.takeaway)}</p>
    </article>
  </section>`;

const renderProcess = (slide) => {
  if (slide.family === "step-roadmap") {
    return `
      <section class="roadmap-board">
        <div class="roadmap-track">
          ${slide.notes
            .map(
              (note, index) => `
                <article class="roadmap-step">
                  <span class="roadmap-num">${index + 1}</span>
                  <p>${escapeHtml(note)}</p>
                </article>`
            )
            .join("")}
        </div>
        <article class="highlight-card roadmap-callout">
          <span class="meta-label">Workshop sequence</span>
          <p>${escapeHtml(slide.takeaway)}</p>
          <div class="citation-row">
            <span class="source-chip">Problem framing</span>
            <span class="source-chip">Live build</span>
            <span class="source-chip">Governance close</span>
          </div>
        </article>
      </section>`;
  }

  if (slide.family === "system-diagram" || slide.family === "grounded-flow") {
    return `
      <section class="system-board">
        <article class="system-node system-node-question">
          <span class="meta-label">Question</span>
          <p>Can a resident use vacation during an ICU month?</p>
        </article>
        <div class="system-arrow">→</div>
        <div class="system-stack">
          ${slide.notes
            .map(
              (note, index) => `
                <article class="process-step system-step">
                  <span class="process-num">${index + 1}</span>
                  <p>${escapeHtml(note)}</p>
                </article>`
            )
            .join("")}
        </div>
        <div class="system-arrow">→</div>
        <article class="system-node system-node-answer">
          <span class="meta-label">Grounded response</span>
          <p>Retrieve the relevant passage, answer plainly, and point back to the exact policy section.</p>
          <span class="source-chip">Resident Handbook · Vacation policy</span>
        </article>
      </section>`;
  }

  if (slide.family === "deployment-roadmap") {
    return `
      <section class="deployment-board">
        <div class="deployment-copy">
          ${slide.notes
            .map(
              (note, index) => `
                <article class="process-step">
                  <span class="process-num">${index + 1}</span>
                  <p>${escapeHtml(note)}</p>
                </article>`
            )
            .join("")}
        </div>
        <article class="road-card">
          <img class="road-image" src="${SOURCE_DECK_ASSETS.roadCurve}" alt="Roadmap image" />
        </article>
      </section>`;
  }

  return `
    <section class="process-strip" style="grid-template-columns: repeat(${Math.min(3, slide.notes.length)}, minmax(0, 1fr));">
      ${slide.notes
        .map(
          (note, index) => `
            <article class="process-step tall-process-step">
              <span class="process-num">${index + 1}</span>
              <p>${escapeHtml(note)}</p>
            </article>`
        )
        .join("")}
    </section>`;
};

const renderCompare = (slide) => {
  const [preferred, risk, third] = slide.notes;
  const config = compareConfigForFamily(slide.family);
  if (slide.family === "answer-compare") {
    return `
      <section class="answer-compare-board">
        <article class="question-banner">
          <span class="meta-label">Same evaluation question</span>
          <p>Can I use educational leave for this conference, and what should I do next?</p>
        </article>
        <div class="compare-grid compare-grid-answer">
          <article class="compare-panel compare-panel-positive compare-panel-answer">
            <span class="meta-label">${config.leftLabel}</span>
            <h3>${config.leftTitle}</h3>
            <div class="chat-bubble chat-bubble-ai">
              You may be able to use educational leave if the conference meets the handbook criteria and your request is approved in advance. The assistant should cite the conference policy, say who approves the request, and point to the next step if the file does not fully resolve the case.
              <div class="citation-row">
                <span class="source-chip">Conference Attendance Policy</span>
                <span class="source-chip">Resident Handbook</span>
              </div>
            </div>
            <p>${escapeHtml(preferred)}</p>
          </article>
          <article class="compare-panel compare-panel-risk compare-panel-answer">
            <span class="meta-label">${config.rightLabel}</span>
            <h3>${config.rightTitle}</h3>
            <div class="chat-bubble chat-bubble-user chat-bubble-risk">
              Yes, you can probably use educational leave for this conference. Just submit the form and your program should approve it.
            </div>
            <p>${escapeHtml(risk)}</p>
          </article>
        </div>
        <aside class="highlight-card compare-verdict compare-verdict-wide">
          <span class="meta-label">Main point</span>
          <p>${escapeHtml(third || slide.takeaway)}</p>
        </aside>
      </section>`;
  }
  return `
    <section class="compare-shell">
      <div class="compare-grid">
        <article class="compare-panel compare-panel-positive">
          <span class="meta-label">${config.leftLabel}</span>
          <h3>${config.leftTitle}</h3>
          <p>${escapeHtml(preferred)}</p>
        </article>
        <article class="compare-panel compare-panel-risk">
          <span class="meta-label">${config.rightLabel}</span>
          <h3>${config.rightTitle}</h3>
          <p>${escapeHtml(risk)}</p>
        </article>
      </div>
      <aside class="highlight-card compare-verdict">
        <span class="meta-label">Main point</span>
        <p>${escapeHtml(third || slide.takeaway)}</p>
      </aside>
    </section>`;
};

const renderChecklist = (slide) => {
  if (slide.family === "preview-testing") {
    return `
      <section class="preview-test-board">
        <div class="checklist-list">
          ${slide.notes
            .map(
              (note) => `
                <div class="check-item">
                  <span class="check-mark">✓</span>
                  <p>${escapeHtml(note)}</p>
                </div>`
            )
            .join("")}
        </div>
        <article class="screen-card">
          <img src="${SOURCE_DECK_ASSETS.gptPreviewCard}" alt="Preview testing screen" />
        </article>
      </section>`;
  }

  if (slide.family === "document-stack") {
    return `
      <section class="document-board">
        <div class="document-stack">
          ${slide.notes
            .map(
              (note, index) => `
                <article class="document-sheet document-sheet-${index + 1}">
                  <span class="meta-label">Source ${index + 1}</span>
                  <p>${escapeHtml(note)}</p>
                </article>`
            )
            .join("")}
        </div>
        <article class="highlight-card">
          <span class="meta-label">Starter set</span>
          <p>${escapeHtml(slide.takeaway)}</p>
        </article>
      </section>`;
  }

  if (slide.family === "file-hygiene") {
    return `
      <section class="file-hygiene-board">
        <article class="info-card file-column file-column-bad">
          <span class="meta-label">Messy set</span>
          <div class="file-line">leavepolicy_FINAL2.pdf</div>
          <div class="file-line">moonlighting-new.pdf</div>
          <div class="file-line">faculty-handbook-copy.pdf</div>
          <div class="file-line">updatedrulesREAL.pdf</div>
        </article>
        <article class="info-card file-column file-column-good">
          <span class="meta-label">Maintainable set</span>
          <div class="file-line">Residency_Leave_Policy_2026.pdf</div>
          <div class="file-line">GME_Moonlighting_2026.pdf</div>
          <div class="file-line">Resident_Handbook_2026.pdf</div>
          <div class="file-line">Conference_Policy_2026.pdf</div>
        </article>
        <div class="annotation-list">
          ${renderAnnotationCards(slide.notes)}
        </div>
      </section>`;
  }

  return `
    <section class="checklist-shell">
      <div class="checklist-list">
        ${slide.notes
          .map(
            (note) => `
              <div class="check-item">
                <span class="check-mark">✓</span>
                <p>${escapeHtml(note)}</p>
              </div>`
          )
          .join("")}
      </div>
      <aside class="highlight-card">
        <span class="meta-label">Main point</span>
        <p>${escapeHtml(slide.takeaway)}</p>
      </aside>
    </section>`;
};

const renderInterface = (slide) => {
  if (slide.family === "ui-entry") {
    return `
      <section class="interface-board">
        <div class="annotation-list">
          ${renderAnnotationCards(slide.notes)}
        </div>
        <article class="screen-card screen-card-wide screen-card-entry">
          <img class="screen-image screen-image-entry" src="${SOURCE_DECK_ASSETS.gptsExplore}" alt="GPTs area in ChatGPT" />
          <div class="screen-caption-bar">
            <span>Explore GPTs</span>
            <span>Create</span>
            <span>Move into Configure</span>
          </div>
        </article>
      </section>`;
  }

  if (slide.family === "ui-split") {
    return `
      <section class="ui-split-board">
        <article class="screen-card screen-card-create">
          <span class="screen-label">Create</span>
          <img class="screen-image screen-image-create" src="${SOURCE_DECK_ASSETS.gptCreateView}" alt="Create tab" />
          <div class="screen-caption-bar">
            <span>Conversational draft</span>
            <span>Fast first pass</span>
          </div>
        </article>
        <article class="screen-card screen-card-priority screen-card-configure">
          <span class="screen-label">Configure</span>
          <img class="screen-image screen-image-configure" src="${SOURCE_DECK_ASSETS.gptConfigureOverview}" alt="Configure tab" />
          <div class="screen-caption-bar">
            <span>Role</span>
            <span>Files</span>
            <span>Capabilities</span>
          </div>
        </article>
        <article class="highlight-card">
          <span class="meta-label">Why Configure matters</span>
          <p>${escapeHtml(slide.takeaway)}</p>
          <div class="annotation-list compact-annotation-list">
            ${renderAnnotationCards(slide.notes.slice(0, 2))}
          </div>
        </article>
      </section>`;
  }

  if (slide.family === "instruction-card") {
    return `
      <section class="instruction-board">
        <article class="screen-card">
          <img class="screen-image screen-image-instructions" src="${SOURCE_DECK_ASSETS.gptInstructionsScreen}" alt="Instructions screen" />
        </article>
        <div class="annotation-list">
          ${renderAnnotationCards(slide.notes)}
        </div>
        <article class="prompt-panel dark-panel">
          <span class="meta-label">Instruction pattern</span>
          <p>You answer using the uploaded files only. If the answer is outside the scope or not supported by the files, say you do not know based on the documents provided.</p>
        </article>
      </section>`;
  }

  if (slide.family === "capability-stack") {
    return `
      <section class="capability-board">
        <div class="screen-stack">
          <article class="screen-card">
            <span class="screen-label">Knowledge</span>
            <img class="screen-image screen-image-knowledge" src="${SOURCE_DECK_ASSETS.gptKnowledgeFiles}" alt="Knowledge files" />
          </article>
          <article class="screen-card">
            <span class="screen-label">Capabilities</span>
            <img class="screen-image screen-image-capabilities" src="${SOURCE_DECK_ASSETS.gptCapabilitiesScreen}" alt="Capabilities screen" />
          </article>
        </div>
        <div class="annotation-list">
          ${renderAnnotationCards(slide.notes)}
        </div>
      </section>`;
  }

  if (slide.family === "guardrail-grid") {
    return `
      <section class="guardrail-board">
        <article class="prompt-panel dark-panel">
          <span class="meta-label">Guardrail excerpt</span>
          <p>For every answer: cite the source file and page or section. Refuse unsupported claims instead of guessing. Stay concise, neutral, and action-oriented.</p>
        </article>
        <div class="bento-grid">
          ${slide.notes
            .map(
              (note, index) => `
                <article class="info-card">
                  <div class="card-topline">
                    <span class="meta-label">0${index + 1}</span>
                    <span class="card-line"></span>
                  </div>
                  <p>${escapeHtml(note)}</p>
                </article>`
            )
            .join("")}
        </div>
      </section>`;
  }

  return `
    <section class="interface-board">
      <div class="annotation-list">
        ${renderAnnotationCards(slide.notes)}
      </div>
      <article class="screen-card screen-card-wide">
        <img src="${SOURCE_DECK_ASSETS.gptConfigureOverview}" alt="GPT configuration screen" />
      </article>
  </section>`;
};

const renderPrivacyBody = (slide) => `
  <section class="privacy-board">
    <article class="graphic-panel privacy-graphic-panel">
      <img class="graphic-image" src="${CUSTOM_GRAPHICS.privacyBoundary}" alt="Privacy and security boundary graphic" />
    </article>
    <div class="privacy-copy">
      ${slide.notes
        .map(
          (note, index) => `
            <article class="info-card">
              <div class="card-topline">
                <span class="meta-label">0${index + 1}</span>
                <span class="card-line"></span>
              </div>
              <p>${escapeHtml(note)}</p>
            </article>`
        )
        .join("")}
    </div>
  </section>`;

const renderGovernanceBody = (slide) => `
  <section class="governance-board">
    <article class="graphic-panel governance-graphic-panel">
      <img class="graphic-image" src="${CUSTOM_GRAPHICS.governanceCycle}" alt="Governance cycle graphic" />
    </article>
    <div class="governance-detail-grid">
      ${slide.notes
        .map(
          (note, index) => `
            <article class="info-card governance-detail-card">
              <div class="card-topline">
                <span class="meta-label">0${index + 1}</span>
                <span class="card-line"></span>
              </div>
              <p>${escapeHtml(note)}</p>
            </article>`
        )
        .join("")}
      <article class="highlight-card highlight-card-accent governance-source-card">
        <span class="meta-label">Approved source set</span>
        <div class="mini-file-stack">
          <div class="mini-file">Resident_Handbook_2026.pdf</div>
          <div class="mini-file">Leave_Policy_2026.pdf</div>
          <div class="mini-file">Moonlighting_Policy_2026.pdf</div>
        </div>
      </article>
    </div>
  </section>`;

const renderPracticeBody = (slide) => {
  const labels = [
    "Data hygiene",
    "Source authority",
    "Prompt guardrails",
    "Visible citations",
  ];
  const support = [
    "Keep people and sensitive details out of both uploads and examples.",
    "Treat the policy document as the authority, not the model's phrasing.",
    "Strong refusals and narrow instructions matter more than cleverness.",
    "The audience should always be able to see where the answer came from.",
  ];

  return `
    <section class="practice-board">
      <article class="practice-hero dark-panel">
        <div class="card-topline">
          <span class="meta-label">Safety baseline</span>
          <span class="card-line"></span>
        </div>
        <h3>Four habits do most of the operational safety work.</h3>
        <p>That is the real lesson behind Connor's repeated best-practice slides: disciplined inputs, clear authority, visible boundaries, and easy verification.</p>
        <div class="practice-chip-row">
          <span class="source-chip">No PHI</span>
          <span class="source-chip">Grounded answers</span>
          <span class="source-chip">Clear refusal behavior</span>
          <span class="source-chip">Visible citations</span>
        </div>
      </article>
      <div class="practice-grid">
        ${slide.notes
          .map(
            (note, index) => `
              <article class="practice-card practice-card-${index + 1}">
                <span class="practice-card-index">0${index + 1}</span>
                <span class="meta-label">${labels[index] ?? `Practice ${index + 1}`}</span>
                <strong>${escapeHtml(note)}</strong>
                <p>${escapeHtml(support[index] ?? slide.takeaway)}</p>
              </article>`
          )
          .join("")}
      </div>
    </section>`;
};

const renderOpportunityBody = (slide) => {
  const support = [
    "Use the same grounded pattern to help learners navigate their first month.",
    "Support teaching workflows when the scope is narrow and the files are curated.",
    "Turn stable program materials into accessible study companions.",
    "Apply the pattern to bounded simulation, research, or resource workflows.",
  ];

  return `
    <section class="opportunity-board">
      <article class="opportunity-anchor">
        <span class="meta-label">Start with the proven pattern</span>
        <h3>Grounded assistant design</h3>
        <p>Scope, files, guardrails, testing, and governance form a reusable pattern. The policy assistant is the first trustworthy use case, not the only one.</p>
        <div class="practice-chip-row">
          <span class="source-chip">Scope first</span>
          <span class="source-chip">Grounding</span>
          <span class="source-chip">Preview tests</span>
          <span class="source-chip">Ownership</span>
        </div>
      </article>
      <div class="opportunity-grid">
        ${slide.notes
          .map(
            (note, index) => `
              <article class="opportunity-card">
                <span class="opportunity-card-index">0${index + 1}</span>
                <strong>${escapeHtml(note)}</strong>
                <p>${escapeHtml(support[index] ?? slide.takeaway)}</p>
              </article>`
          )
          .join("")}
      </div>
    </section>`;
};

const renderClosing = (slide) => `
  <section class="closing-board">
    <div class="closing-path">
      ${slide.notes
        .map(
          (note, index) => `
            <article class="closing-card closing-step-card">
              <div class="closing-step-head">
                <span class="closing-step-num">0${index + 1}</span>
                <span class="card-line"></span>
              </div>
              <p>${escapeHtml(note)}</p>
            </article>`
        )
        .join("")}
    </div>
    <aside class="qa-panel qa-panel-rich">
      <span class="meta-label">Discussion prompt</span>
      <p>What is one narrow policy-support assistant your program could responsibly pilot first?</p>
      <div class="qr-panel">
        <img class="qr-image" src="${SOURCE_DECK_ASSETS.qrCode}" alt="Workshop QR code" />
        <div class="qr-copy">
          <span class="meta-label">Companion</span>
          <p>Scan for the workshop companion and shared resources.</p>
        </div>
      </div>
    </aside>
  </section>`;

const renderCards = (slide) => {
  if (slide.family === "problem-frame" || slide.family === "problem-loop" || slide.family === "burden-data" || slide.family === "stakeholder-map") {
    return renderProblemBody(slide);
  }
  if (slide.family === "concept-card" || slide.family === "solution-card" || slide.family === "quality-pillars") {
    return renderConceptBody(slide);
  }
  if (slide.family === "privacy-boundary") {
    return renderPrivacyBody(slide);
  }
  if (slide.family === "governance-grid") {
    return renderGovernanceBody(slide);
  }
  if (slide.family === "practice-grid") {
    return renderPracticeBody(slide);
  }
  if (slide.family === "opportunity-grid") {
    return renderOpportunityBody(slide);
  }
  if (slide.family === "tool-landscape") {
    return renderToolLandscape(slide);
  }
  return renderBentoCards(slide);
};

const renderBody = (slide) => {
  switch (slide.style) {
    case "title":
      return renderTitleBody(slide);
    case "speaker":
      return renderSpeakerIntroBody(slide);
    case "problem":
      return renderProblemBody(slide);
    case "concept":
      return renderConceptBody(slide);
    case "process":
      return renderProcess(slide);
    case "compare":
      return renderCompare(slide);
    case "checklist":
      return renderChecklist(slide);
    case "interface":
      return renderInterface(slide);
    case "closing":
      return renderClosing(slide);
    case "cards":
    default:
      return renderCards(slide);
  }
};

const renderSlideHtml = (slide) => {
  const tone = toneForSlide(slide.number);
  const backgroundRelativePath = "../../../../assets/powerpoint-template/saem-master-background.png";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CustomGPT Creation - Slide ${pad(slide.number)}</title>
    <style>
      :root {
        --accent: ${tone.accent};
        --accent-strong: ${tone.strong};
        --accent-soft: ${tone.soft};
        --warm: ${SAEM_TEMPLATE.orange};
        --ink: #102237;
        --muted: #587087;
        --line: rgba(16, 34, 55, 0.12);
        --white: #ffffff;
        --neutral: ${SAEM_TEMPLATE.neutral};
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        width: 1920px;
        height: 1080px;
        overflow: hidden;
        font-family: "Aptos", "Segoe UI", Arial, sans-serif;
        color: var(--ink);
        background: #ffffff;
      }

      body {
        position: relative;
        padding: 58px 88px 208px;
        display: grid;
        grid-template-rows: auto 1fr;
        gap: 22px;
      }

      body::before {
        content: "";
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at 86% 14%, rgba(21, 96, 130, 0.12), rgba(21, 96, 130, 0) 24%),
          radial-gradient(circle at 18% 18%, rgba(233, 113, 50, 0.08), rgba(233, 113, 50, 0) 18%),
          linear-gradient(180deg, rgba(247, 250, 253, 0.92) 0%, rgba(255, 255, 255, 0) 28%);
        z-index: 0;
        pointer-events: none;
      }

      .master-background {
        position: absolute;
        inset: 0;
        background:
          url("${backgroundRelativePath}") center bottom / cover no-repeat,
          #ffffff;
        z-index: 0;
      }

      .hero-shell,
      .content-shell {
        position: relative;
        z-index: 1;
      }

      .kicker,
      .meta-label {
        text-transform: uppercase;
        letter-spacing: 0.16em;
        font-size: 14px;
        font-weight: 800;
        color: var(--accent);
      }

      .kicker {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        font-size: 18px;
        color: var(--accent-strong);
      }

      .kicker::before {
        content: "";
        width: 68px;
        height: 5px;
        border-radius: 999px;
        background: linear-gradient(90deg, var(--accent-strong), var(--accent));
      }

      h1 {
        margin: 0;
        font-family: "Aptos Display", "Aptos", "Segoe UI", Arial, sans-serif;
        font-size: 62px;
        line-height: 0.94;
        letter-spacing: -0.045em;
        max-width: 1440px;
        color: var(--accent-strong);
      }

      .hero-shell {
        display: grid;
        gap: 12px;
        align-content: start;
      }

      .title-shell {
        display: grid;
        gap: 10px;
        padding: 4px 0 0;
      }

      .subtitle,
      .highlight-card p,
      .compare-panel p,
      .info-card p,
      .closing-card p,
      .annotation-card p,
      .check-item p,
      .process-step p {
        margin: 0;
        line-height: 1.34;
      }

      .subtitle {
        font-size: 26px;
        color: #325066;
        max-width: 1320px;
      }

      .content-shell {
        min-height: 0;
        display: grid;
        align-content: stretch;
      }

      .card-grid,
      .feature-shell,
      .feature-stack,
      .closing-grid,
      .process-strip,
      .compare-grid,
      .compare-shell,
      .checklist-shell,
      .interface-shell,
      .closing-shell {
        display: grid;
        gap: 18px;
        min-height: 0;
        height: 100%;
      }

      .info-card,
      .feature-lead-card,
      .closing-card,
      .annotation-card,
      .compare-panel,
      .highlight-card,
      .check-item,
      .process-step {
        border-radius: 20px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.94);
        box-shadow: 0 14px 30px rgba(16, 34, 55, 0.06);
      }

      .info-card,
      .feature-lead-card,
      .closing-card,
      .annotation-card,
      .highlight-card,
      .compare-panel,
      .process-step {
        padding: 24px;
        display: grid;
        gap: 12px;
      }

      .info-card p,
      .feature-lead-card p,
      .closing-card p,
      .annotation-card p,
      .highlight-card p,
      .compare-panel p,
      .check-item p,
      .process-step p {
        font-size: 23px;
      }

      .card-grid,
      .closing-grid {
        grid-auto-rows: 1fr;
      }

      .feature-shell {
        grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
      }

      .feature-stack {
        grid-template-rows: repeat(2, minmax(0, 1fr));
      }

      .info-card,
      .feature-lead-card,
      .compact-card,
      .compare-panel,
      .highlight-card,
      .closing-card,
      .annotation-card,
      .process-step {
        position: relative;
        overflow: hidden;
      }

      .info-card::after,
      .feature-lead-card::after,
      .compact-card::after,
      .compare-panel::after,
      .annotation-card::after,
      .closing-card::after,
      .process-step::after {
        content: "";
        position: absolute;
        right: -44px;
        bottom: -56px;
        width: 180px;
        height: 180px;
        border-radius: 999px;
        background: radial-gradient(circle, rgba(21, 96, 130, 0.12) 0%, rgba(21, 96, 130, 0.03) 52%, rgba(21, 96, 130, 0) 72%);
      }

      .info-card > *,
      .feature-lead-card > *,
      .compact-card > *,
      .compare-panel > *,
      .highlight-card > *,
      .annotation-card > *,
      .closing-card > *,
      .process-step > * {
        position: relative;
        z-index: 1;
      }

      .card-topline {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .card-line {
        flex: 1;
        height: 2px;
        border-radius: 999px;
        background: linear-gradient(90deg, rgba(21, 96, 130, 0.22), rgba(21, 96, 130, 0));
      }

      .feature-lead-card {
        grid-template-rows: auto auto 1fr auto;
        background: linear-gradient(180deg, rgba(245, 249, 253, 0.98) 0%, rgba(255, 255, 255, 0.96) 100%);
      }

      .feature-mark {
        font-size: 92px;
        line-height: 0.9;
        letter-spacing: -0.06em;
        font-weight: 900;
        color: rgba(14, 40, 65, 0.14);
      }

      .support-pill,
      .status-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: fit-content;
        padding: 8px 14px;
        border-radius: 999px;
        font-size: 15px;
        font-weight: 800;
        letter-spacing: 0.04em;
      }

      .support-pill {
        color: var(--accent-strong);
        background: rgba(21, 96, 130, 0.1);
        border: 1px solid rgba(21, 96, 130, 0.14);
      }

      .compare-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .compare-shell {
        grid-template-columns: minmax(0, 1.18fr) minmax(280px, 0.82fr);
      }

      .answer-compare-board {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr) auto;
        gap: 16px;
        min-height: 0;
      }

      .question-banner {
        padding: 16px 20px;
        border-radius: 20px;
        border: 1px solid var(--line);
        background: linear-gradient(180deg, rgba(245, 249, 253, 0.98), rgba(255, 255, 255, 0.96));
        display: grid;
        gap: 6px;
      }

      .question-banner p {
        margin: 0;
        font-size: 24px;
        line-height: 1.24;
        color: var(--accent-strong);
      }

      .compare-grid-answer {
        min-height: 0;
      }

      .compare-panel-answer {
        align-content: start;
      }

      .chat-bubble-risk {
        background: rgba(255, 244, 239, 0.98);
        color: var(--ink);
      }

      .compare-verdict-wide {
        min-height: 0;
      }

      .compare-panel h3 {
        margin: 0;
        font-size: 30px;
        line-height: 1.05;
        letter-spacing: -0.03em;
        color: var(--accent-strong);
      }

      .process-num,
      .check-mark {
        width: 48px;
        height: 48px;
        border-radius: 16px;
        display: grid;
        place-items: center;
        color: var(--white);
        font-weight: 900;
        background: linear-gradient(135deg, var(--accent), var(--accent-strong));
      }

      .checklist-shell,
      .interface-shell,
      .closing-shell {
        grid-template-columns: 1.2fr 0.8fr;
      }

      .checklist-list,
      .annotation-list {
        display: grid;
        gap: 14px;
      }

      .check-item {
        padding: 18px 20px;
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 14px;
        align-items: start;
      }

      .fake-app {
        border-radius: 20px;
        overflow: hidden;
        border: 1px solid var(--line);
        background: #f9fbfd;
        box-shadow: 0 18px 36px rgba(16, 34, 55, 0.08);
        min-height: 0;
      }

      .fake-toolbar {
        height: 54px;
        padding: 0 18px;
        display: flex;
        align-items: center;
        gap: 10px;
        background: #eaf0f7;
        border-bottom: 1px solid rgba(16, 34, 55, 0.08);
      }

      .fake-toolbar span {
        width: 12px;
        height: 12px;
        border-radius: 999px;
        background: var(--accent);
      }

      .fake-app-body {
        display: grid;
        grid-template-columns: 220px 1fr;
        min-height: 100%;
        height: 100%;
      }

      .fake-left-rail {
        padding: 20px;
        display: grid;
        align-content: start;
        gap: 12px;
        background: rgba(16, 34, 55, 0.04);
        border-right: 1px solid rgba(16, 34, 55, 0.08);
      }

      .rail-chip {
        padding: 14px 16px;
        border-radius: 18px;
        border: 1px solid rgba(16, 34, 55, 0.08);
        background: rgba(255, 255, 255, 0.82);
        font-size: 19px;
        font-weight: 700;
        color: #3e556b;
      }

      .rail-chip-active {
        color: var(--white);
        background: linear-gradient(135deg, var(--accent), var(--accent-strong));
        border-color: transparent;
      }

      .fake-main-panel {
        padding: 24px;
        display: grid;
        align-content: start;
        gap: 16px;
      }

      .fake-title-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }

      .fake-title {
        font-size: 32px;
        font-weight: 800;
        letter-spacing: -0.03em;
        color: var(--accent-strong);
      }

      .status-pill {
        color: var(--white);
        background: linear-gradient(135deg, var(--accent), var(--accent-strong));
      }

      .builder-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.08fr) minmax(260px, 0.92fr);
        gap: 16px;
        min-height: 0;
      }

      .builder-column {
        display: grid;
        align-content: start;
        gap: 14px;
      }

      .fake-field-row {
        padding: 18px 20px;
        border-radius: 22px;
        border: 1px solid rgba(16, 34, 55, 0.08);
        background: rgba(255, 255, 255, 0.94);
        display: grid;
        gap: 6px;
      }

      .fake-field-row span {
        font-size: 15px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        color: var(--accent);
      }

      .fake-field-row strong {
        font-size: 24px;
        line-height: 1.3;
      }

      .chip-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .chip-row em {
        font-style: normal;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(21, 96, 130, 0.09);
        color: var(--accent-strong);
        border: 1px solid rgba(21, 96, 130, 0.12);
        font-size: 16px;
        font-weight: 700;
      }

      .preview-panel {
        padding: 18px;
        border-radius: 24px;
        border: 1px solid rgba(16, 34, 55, 0.08);
        background: linear-gradient(180deg, rgba(250, 251, 254, 0.98) 0%, rgba(241, 246, 251, 0.96) 100%);
        display: grid;
        align-content: start;
        gap: 12px;
      }

      .chat-bubble {
        padding: 16px 18px;
        border-radius: 20px;
        font-size: 19px;
        line-height: 1.38;
        border: 1px solid rgba(16, 34, 55, 0.08);
      }

      .chat-bubble-user {
        background: rgba(255, 255, 255, 0.94);
        color: var(--accent-strong);
      }

      .chat-bubble-ai {
        background: rgba(21, 96, 130, 0.11);
        color: var(--ink);
      }

      .opening-board,
      .problem-board,
      .burden-board,
      .stakeholder-board,
      .governance-board,
      .practice-board,
      .opportunity-board,
      .concept-board,
      .bento-board,
      .landscape-board,
      .roadmap-board,
      .system-board,
      .deployment-board,
      .preview-test-board,
      .interface-board,
      .ui-split-board,
      .instruction-board,
      .capability-board,
      .guardrail-board,
      .document-board,
      .file-hygiene-board,
      .closing-board {
        display: grid;
        gap: 18px;
        min-height: 0;
        height: 100%;
      }

      .opening-board {
        grid-template-columns: minmax(0, 1.05fr) minmax(360px, 0.95fr);
      }

      .opening-board-title {
        grid-template-columns: minmax(0, 1.18fr) minmax(360px, 0.82fr);
      }

      .speaker-intro-board {
        display: grid;
        grid-template-columns: minmax(0, 1.02fr) minmax(360px, 0.98fr);
        gap: 18px;
        min-height: 0;
        height: 100%;
      }

      .speaker-stack,
      .promise-list,
      .problem-role-column,
      .annotation-list,
      .screen-stack,
      .session-roadmap-list {
        display: grid;
        gap: 14px;
      }

      .speaker-card,
      .promise-step,
      .role-card,
      .tool-card,
      .roadmap-step,
      .practice-card,
      .opportunity-card,
      .governance-node,
      .screen-card,
      .document-sheet,
      .qa-panel {
        border-radius: 22px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.95);
        box-shadow: 0 14px 30px rgba(16, 34, 55, 0.06);
      }

      .speaker-card {
        padding: 14px 16px;
        display: grid;
        grid-template-columns: 82px 1fr;
        gap: 14px;
        align-items: center;
      }

      .speaker-card-detailed {
        padding: 18px;
      }

      .speaker-avatar,
      .speaker-mini {
        display: block;
        object-fit: cover;
        background: #f3f5f8;
      }

      .speaker-avatar {
        width: 82px;
        height: 82px;
        border-radius: 22px;
      }

      .speaker-copy {
        display: grid;
        gap: 6px;
      }

      .speaker-copy p {
        margin: 0;
        color: var(--muted);
        font-size: 17px;
        line-height: 1.34;
      }

      .speaker-copy strong,
      .promise-copy strong,
      .tool-card strong {
        font-size: 24px;
        line-height: 1.05;
        color: var(--accent-strong);
      }

      .speaker-copy strong {
        font-size: 22px;
      }

      .promise-panel,
      .goal-strip,
      .title-hero-card,
      .session-roadmap,
      .stakeholder-center,
      .prompt-panel,
      .road-card,
      .highlight-card-accent {
        padding: 22px 24px;
      }

      .promise-panel {
        border-radius: 24px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.94);
        box-shadow: 0 14px 30px rgba(16, 34, 55, 0.06);
        display: grid;
        gap: 16px;
      }

      .title-hero-card,
      .session-roadmap {
        border-radius: 24px;
        border: 1px solid var(--line);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.97), rgba(247, 250, 253, 0.95));
        box-shadow: 0 14px 30px rgba(16, 34, 55, 0.06);
        display: grid;
        gap: 18px;
      }

      .graphic-panel {
        border-radius: 28px;
        overflow: hidden;
        border: 1px solid rgba(16, 34, 55, 0.08);
        background: linear-gradient(180deg, rgba(247, 250, 253, 0.98), rgba(255, 255, 255, 0.96));
        box-shadow: 0 18px 34px rgba(16, 34, 55, 0.08);
      }

      .graphic-image {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .graphic-panel-hero {
        min-height: 420px;
      }

      .session-roadmap-list-lined {
        position: relative;
        padding-left: 18px;
      }

      .session-roadmap-list-lined::before {
        content: "";
        position: absolute;
        left: 28px;
        top: 10px;
        bottom: 10px;
        width: 2px;
        background: linear-gradient(180deg, rgba(21, 96, 130, 0.24), rgba(233, 113, 50, 0.18));
      }

      .artifact-constellation {
        display: grid;
        grid-template-columns: minmax(0, 0.88fr) auto minmax(0, 1.12fr);
        gap: 18px;
        align-items: center;
      }

      .doc-stack,
      .answer-shell {
        display: grid;
        gap: 14px;
      }

      .doc-sheet,
      .answer-card,
      .session-roadmap-step {
        border-radius: 20px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.96);
        box-shadow: 0 14px 30px rgba(16, 34, 55, 0.06);
      }

      .doc-sheet,
      .answer-card {
        padding: 18px 20px;
        display: grid;
        gap: 8px;
      }

      .doc-sheet strong,
      .answer-card p,
      .session-roadmap-step strong {
        color: var(--accent-strong);
      }

      .doc-sheet strong,
      .session-roadmap-step strong {
        font-size: 24px;
        line-height: 1.05;
      }

      .doc-sheet p,
      .answer-card p,
      .session-roadmap-step p {
        margin: 0;
        font-size: 18px;
        line-height: 1.34;
      }

      .doc-sheet p,
      .session-roadmap-step p {
        color: var(--muted);
      }

      .doc-sheet-a {
        transform: rotate(-3deg);
      }

      .doc-sheet-b {
        transform: rotate(2deg);
        margin-left: 22px;
      }

      .artifact-beam {
        writing-mode: vertical-rl;
        transform: rotate(180deg);
        padding: 14px 10px;
        border-radius: 999px;
        background: linear-gradient(180deg, rgba(21, 96, 130, 0.14), rgba(233, 113, 50, 0.14));
        color: var(--accent-strong);
        font-size: 14px;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .answer-card-question {
        background: rgba(255, 255, 255, 0.96);
      }

      .answer-card-answer {
        background: linear-gradient(180deg, rgba(245, 249, 253, 0.98), rgba(255, 255, 255, 0.96));
      }

      .session-roadmap-step {
        padding: 16px 18px;
        display: grid;
        grid-template-columns: 56px 1fr;
        gap: 14px;
        align-items: start;
        position: relative;
        z-index: 1;
      }

      .promise-step {
        padding: 16px 18px;
        display: grid;
        grid-template-columns: 56px 1fr;
        gap: 14px;
        align-items: start;
      }

      .promise-num {
        width: 56px;
        height: 56px;
        border-radius: 18px;
        display: grid;
        place-items: center;
        background: linear-gradient(135deg, var(--accent), var(--accent-strong));
        color: #fff;
        font-size: 24px;
        font-weight: 900;
      }

      .promise-copy {
        display: grid;
        gap: 6px;
      }

      .promise-copy p,
      .goal-strip p,
      .role-card p,
      .question-card p,
      .impact-chip strong,
      .ingredient-card p,
      .tool-card strong,
      .document-sheet p,
      .file-line,
      .qa-panel p,
      .system-node p {
        margin: 0;
        line-height: 1.32;
      }

      .promise-copy p,
      .goal-strip p {
        font-size: 18px;
        color: var(--muted);
      }

      .goal-strip {
        border-radius: 20px;
        background: linear-gradient(135deg, rgba(21, 96, 130, 0.1), rgba(233, 113, 50, 0.12));
      }

      .goal-strip p {
        color: var(--accent-strong);
        font-size: 20px;
      }

      .problem-board {
        grid-template-columns: minmax(310px, 0.72fr) minmax(0, 1.28fr);
      }

      .problem-board-illustrated {
        grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
        align-items: stretch;
      }

      .problem-copy-column {
        display: grid;
        align-content: start;
        gap: 18px;
      }

      .problem-thesis {
        padding: 24px 26px;
        border-radius: 24px;
        background: linear-gradient(180deg, rgba(14, 40, 65, 0.96), rgba(21, 52, 82, 0.94));
        color: white;
        box-shadow: 0 20px 36px rgba(16, 34, 55, 0.16);
        display: grid;
        gap: 10px;
      }

      .problem-thesis .meta-label {
        color: rgba(255, 255, 255, 0.72);
      }

      .problem-thesis p {
        margin: 0;
        font-size: 28px;
        line-height: 1.26;
      }

      .role-ribbon-stack {
        display: grid;
        gap: 12px;
      }

      .role-ribbon {
        padding: 18px 20px;
        border-radius: 24px;
        display: grid;
        gap: 8px;
        color: white;
        box-shadow: 0 14px 30px rgba(16, 34, 55, 0.08);
      }

      .role-ribbon-1 { background: linear-gradient(135deg, rgba(14, 40, 65, 0.94), rgba(14, 40, 65, 0.82)); }
      .role-ribbon-2 { background: linear-gradient(135deg, rgba(21, 96, 130, 0.94), rgba(21, 96, 130, 0.8)); }
      .role-ribbon-3 { background: linear-gradient(135deg, rgba(233, 113, 50, 0.94), rgba(233, 113, 50, 0.8)); }

      .role-ribbon p {
        margin: 0;
        font-size: 22px;
        line-height: 1.3;
      }

      .graphic-panel-problem {
        min-height: 100%;
      }

      .problem-figure,
      .deployment-copy {
        display: grid;
        gap: 14px;
        min-height: 0;
      }

      .role-card {
        padding: 20px 22px;
        display: grid;
        gap: 10px;
      }

      .role-card-1 { background: linear-gradient(135deg, rgba(14, 40, 65, 0.92), rgba(14, 40, 65, 0.82)); color: #fff; }
      .role-card-2 { background: linear-gradient(135deg, rgba(21, 96, 130, 0.9), rgba(21, 96, 130, 0.78)); color: #fff; }
      .role-card-3 { background: linear-gradient(135deg, rgba(233, 113, 50, 0.92), rgba(233, 113, 50, 0.78)); color: #fff; }

      .role-card .role-label {
        font-size: 14px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.14em;
      }

      .role-card p {
        font-size: 24px;
      }

      .dark-panel {
        border-radius: 24px;
        background: linear-gradient(180deg, rgba(14, 40, 65, 0.96), rgba(21, 52, 82, 0.94));
        color: #fff;
        box-shadow: 0 20px 36px rgba(16, 34, 55, 0.16);
      }

      .dark-panel .meta-label,
      .prompt-panel .meta-label {
        color: rgba(255, 255, 255, 0.72);
      }

      .problem-callout p {
        font-size: 24px;
        color: var(--accent-strong);
      }

      .question-loop-panel {
        padding: 22px 24px;
        display: grid;
        gap: 16px;
      }

      .question-loop-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }

      .question-card {
        padding: 16px 18px;
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.12);
        display: grid;
        gap: 10px;
      }

      .question-label,
      .impact-chip span,
      .screen-label {
        font-size: 13px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.14em;
      }

      .question-card p {
        font-size: 20px;
        color: rgba(255, 255, 255, 0.96);
      }

      .impact-strip {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }

      .impact-chip {
        border-radius: 18px;
        padding: 16px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.12);
        display: grid;
        gap: 8px;
      }

      .impact-chip strong {
        font-size: 19px;
        color: rgba(255, 255, 255, 0.96);
      }

      .burden-board {
        grid-template-columns: minmax(0, 1.04fr) minmax(0, 0.96fr);
      }

      .burden-hero-card {
        display: grid;
        align-content: start;
        gap: 16px;
      }

      .stakeholder-board {
        grid-template-columns: minmax(320px, 0.72fr) minmax(0, 1.28fr);
      }

      .governance-board {
        grid-template-columns: minmax(0, 1.02fr) minmax(0, 0.98fr);
      }

      .privacy-board {
        display: grid;
        grid-template-columns: minmax(0, 1.08fr) minmax(340px, 0.92fr);
        gap: 18px;
        min-height: 0;
        height: 100%;
      }

      .privacy-copy {
        display: grid;
        gap: 14px;
        align-content: start;
      }

      .governance-cycle,
      .opportunity-anchor,
      .practice-hero {
        padding: 24px 26px;
        display: grid;
        gap: 18px;
      }

      .governance-graphic-panel,
      .privacy-graphic-panel {
        min-height: 100%;
      }

      .governance-flow {
        display: grid;
        gap: 12px;
      }

      .governance-node {
        padding: 18px 20px;
        display: grid;
        gap: 8px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.12);
      }

      .governance-node strong,
      .practice-hero h3,
      .opportunity-anchor h3 {
        margin: 0;
        font-family: "Aptos Display", "Aptos", "Segoe UI", Arial, sans-serif;
        font-size: 30px;
        line-height: 1.02;
      }

      .governance-node p,
      .practice-hero p,
      .opportunity-anchor p,
      .qr-copy p {
        margin: 0;
        font-size: 19px;
        line-height: 1.35;
      }

      .governance-node-label,
      .practice-card-index,
      .opportunity-card-index,
      .closing-step-num {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        border-radius: 14px;
        font-size: 15px;
        font-weight: 900;
        letter-spacing: 0.08em;
        color: #fff;
        background: linear-gradient(135deg, var(--accent), var(--accent-strong));
      }

      .governance-track,
      .practice-chip-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .governance-detail-grid,
      .practice-grid,
      .opportunity-grid {
        display: grid;
        gap: 14px;
      }

      .governance-detail-grid,
      .practice-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .governance-detail-card,
      .governance-source-card {
        min-height: 0;
      }

      .mini-file-stack {
        display: grid;
        gap: 10px;
      }

      .mini-file {
        padding: 12px 14px;
        border-radius: 16px;
        background: rgba(14, 40, 65, 0.06);
        color: var(--accent-strong);
        font-size: 17px;
        font-weight: 700;
      }

      .practice-board {
        grid-template-columns: minmax(320px, 0.78fr) minmax(0, 1.22fr);
      }

      .practice-card,
      .opportunity-card {
        padding: 20px 22px;
        display: grid;
        gap: 12px;
        align-content: start;
        position: relative;
        overflow: hidden;
      }

      .practice-card strong,
      .opportunity-card strong {
        font-size: 25px;
        line-height: 1.1;
        color: var(--accent-strong);
      }

      .practice-card p,
      .opportunity-card p {
        margin: 0;
        font-size: 18px;
        line-height: 1.34;
        color: var(--muted);
      }

      .practice-card-1 { background: linear-gradient(180deg, rgba(255, 249, 246, 0.98), rgba(255, 255, 255, 0.96)); }
      .practice-card-2 { background: linear-gradient(180deg, rgba(245, 249, 253, 0.98), rgba(255, 255, 255, 0.96)); }
      .practice-card-3 { background: linear-gradient(180deg, rgba(245, 247, 255, 0.98), rgba(255, 255, 255, 0.96)); }
      .practice-card-4 { background: linear-gradient(180deg, rgba(252, 248, 242, 0.98), rgba(255, 255, 255, 0.96)); }

      .opportunity-board {
        grid-template-columns: minmax(320px, 0.78fr) minmax(0, 1.22fr);
      }

      .opportunity-anchor {
        border-radius: 24px;
        border: 1px solid var(--line);
        background: linear-gradient(180deg, rgba(14, 40, 65, 0.96), rgba(21, 52, 82, 0.94));
        color: #fff;
        box-shadow: 0 20px 36px rgba(16, 34, 55, 0.16);
      }

      .opportunity-anchor .meta-label {
        color: rgba(255, 255, 255, 0.72);
      }

      .opportunity-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .opportunity-card {
        border-radius: 22px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.94);
        box-shadow: 0 14px 30px rgba(16, 34, 55, 0.06);
      }

      .stakeholder-center {
        border-radius: 24px;
        border: 1px solid var(--line);
        background: linear-gradient(180deg, rgba(245, 249, 253, 0.98), rgba(255, 255, 255, 0.96));
        display: grid;
        gap: 14px;
        align-content: center;
      }

      .stakeholder-center h3 {
        margin: 0;
        font-size: 42px;
        line-height: 0.95;
        letter-spacing: -0.04em;
        color: var(--accent-strong);
      }

      .stakeholder-center p {
        margin: 0;
        font-size: 22px;
        line-height: 1.34;
      }

      .stakeholder-grid,
      .bento-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }

      .concept-board {
        grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
      }

      .concept-board-graphic {
        grid-template-columns: minmax(0, 1.14fr) minmax(320px, 0.86fr);
      }

      .graphic-panel-concept {
        min-height: 100%;
      }

      .concept-side-notes {
        display: grid;
        gap: 14px;
        align-content: start;
      }

      .concept-note-card p {
        font-size: 24px;
        line-height: 1.32;
      }

      .quality-board {
        display: grid;
        grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
        gap: 18px;
        min-height: 0;
        height: 100%;
      }

      .quality-example-card {
        padding: 24px;
        border-radius: 24px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.95);
        box-shadow: 0 14px 30px rgba(16, 34, 55, 0.06);
        display: grid;
        gap: 16px;
      }

      .quality-pillars {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
      }

      .quality-pillar {
        padding: 22px 18px;
        border-radius: 28px 28px 18px 18px;
        display: grid;
        align-content: start;
        gap: 12px;
        box-shadow: 0 14px 30px rgba(16, 34, 55, 0.06);
      }

      .quality-pillar-1 { background: linear-gradient(180deg, rgba(14, 40, 65, 0.96), rgba(14, 40, 65, 0.82)); color: white; }
      .quality-pillar-2 { background: linear-gradient(180deg, rgba(21, 96, 130, 0.94), rgba(21, 96, 130, 0.82)); color: white; }
      .quality-pillar-3 { background: linear-gradient(180deg, rgba(233, 113, 50, 0.94), rgba(233, 113, 50, 0.82)); color: white; }

      .quality-pillar strong {
        font-family: "Aptos Display", "Aptos", "Segoe UI", Arial, sans-serif;
        font-size: 32px;
        line-height: 1;
      }

      .quality-pillar p {
        margin: 0;
        font-size: 21px;
        line-height: 1.32;
      }

      .quality-pillar-num {
        font-size: 14px;
        font-weight: 900;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .chat-surface {
        border-radius: 24px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.95);
        box-shadow: 0 14px 30px rgba(16, 34, 55, 0.06);
        padding: 24px;
        display: grid;
        gap: 16px;
      }

      .citation-row,
      .ingredient-strip,
      .speaker-mini-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .source-chip {
        display: inline-flex;
        align-items: center;
        padding: 9px 12px;
        border-radius: 999px;
        background: rgba(21, 96, 130, 0.08);
        border: 1px solid rgba(21, 96, 130, 0.12);
        color: var(--accent-strong);
        font-size: 15px;
        font-weight: 700;
      }

      .ingredient-strip {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .ingredient-card {
        border-radius: 18px;
        padding: 16px;
        background: linear-gradient(180deg, rgba(248, 250, 252, 0.96), rgba(242, 247, 251, 0.96));
        border: 1px solid var(--line);
        display: grid;
        gap: 8px;
      }

      .ingredient-card p {
        font-size: 18px;
        color: var(--ink);
      }

      .bento-board {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      }

      .highlight-card-accent {
        background: linear-gradient(135deg, rgba(21, 96, 130, 0.09), rgba(233, 113, 50, 0.1));
      }

      .landscape-board {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        grid-auto-rows: 1fr;
      }

      .tool-card {
        padding: 20px 22px;
        display: grid;
        gap: 10px;
      }

      .tool-card-featured {
        background: linear-gradient(180deg, rgba(245, 249, 253, 0.98), rgba(255, 255, 255, 0.96));
      }

      .tool-card strong {
        font-size: 22px;
      }

      .roadmap-board {
        grid-template-rows: auto auto;
        align-content: start;
      }

      .roadmap-track {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 16px;
        position: relative;
      }

      .roadmap-step {
        padding: 20px;
        display: grid;
        gap: 12px;
      }

      .roadmap-num {
        width: 54px;
        height: 54px;
        border-radius: 18px;
        display: grid;
        place-items: center;
        background: linear-gradient(135deg, var(--accent), var(--accent-strong));
        color: #fff;
        font-size: 24px;
        font-weight: 900;
      }

      .roadmap-step p,
      .system-node p {
        font-size: 21px;
      }

      .system-board {
        grid-template-columns: minmax(260px, 0.75fr) auto minmax(0, 1.1fr) auto minmax(260px, 0.75fr);
        align-items: center;
      }

      .system-node {
        border-radius: 24px;
        padding: 22px 24px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.95);
        box-shadow: 0 14px 30px rgba(16, 34, 55, 0.06);
        display: grid;
        gap: 12px;
      }

      .system-stack {
        display: grid;
        gap: 14px;
      }

      .system-arrow {
        font-size: 44px;
        font-weight: 700;
        color: rgba(14, 40, 65, 0.28);
      }

      .deployment-board {
        grid-template-columns: minmax(0, 0.95fr) minmax(360px, 1.05fr);
      }

      .road-card {
        display: grid;
        place-items: center;
      }

      .road-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 20px;
      }

      .compare-panel-positive {
        background: linear-gradient(180deg, rgba(245, 249, 253, 0.98), rgba(255, 255, 255, 0.96));
      }

      .compare-panel-risk {
        background: linear-gradient(180deg, rgba(255, 249, 246, 0.98), rgba(255, 255, 255, 0.96));
      }

      .compare-verdict {
        align-content: center;
      }

      .preview-test-board,
      .interface-board,
      .capability-board {
        grid-template-columns: minmax(320px, 0.72fr) minmax(0, 1.28fr);
      }

      .screen-card,
      .road-card {
        overflow: hidden;
      }

      .screen-card {
        position: relative;
        background: linear-gradient(180deg, #11151b 0%, #151b23 100%);
        padding: 18px;
      }

      .screen-card img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        border: 0;
        border-radius: 18px;
        background: #0f1115;
      }

      .screen-image-entry {
        object-fit: cover;
        object-position: center top;
        transform: scale(1.12);
        transform-origin: center top;
      }

      .screen-image-create,
      .screen-image-configure,
      .screen-image-instructions,
      .screen-image-knowledge,
      .screen-image-capabilities {
        object-fit: cover;
        object-position: left top;
      }

      .screen-image-create {
        transform: scale(1.34);
        transform-origin: left top;
      }

      .screen-image-configure {
        transform: scale(1.26);
        transform-origin: left top;
      }

      .screen-image-instructions,
      .screen-image-knowledge,
      .screen-image-capabilities {
        transform: scale(1.18);
        transform-origin: left top;
      }

      .screen-card-entry {
        padding: 12px;
      }

      .screen-caption-bar {
        position: absolute;
        left: 18px;
        right: 18px;
        bottom: 16px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        z-index: 2;
      }

      .screen-caption-bar span {
        display: inline-flex;
        align-items: center;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: rgba(255, 255, 255, 0.92);
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.04em;
      }

      .screen-card-wide {
        min-height: 420px;
      }

      .ui-split-board {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .screen-card-priority {
        box-shadow: 0 0 0 3px rgba(21, 96, 130, 0.18), 0 14px 30px rgba(16, 34, 55, 0.08);
      }

      .screen-label {
        position: absolute;
        left: 16px;
        top: 16px;
        z-index: 1;
        color: #fff;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(14, 40, 65, 0.8);
      }

      .instruction-board {
        grid-template-columns: minmax(0, 1.08fr) minmax(280px, 0.52fr) minmax(280px, 0.4fr);
      }

      .prompt-panel {
        display: grid;
        gap: 14px;
      }

      .prompt-panel p {
        margin: 0;
        font-size: 22px;
        line-height: 1.4;
      }

      .guardrail-board {
        grid-template-columns: minmax(340px, 0.8fr) minmax(0, 1.2fr);
      }

      .document-board {
        grid-template-columns: minmax(0, 1.05fr) minmax(300px, 0.95fr);
      }

      .document-stack {
        position: relative;
        min-height: 100%;
      }

      .document-sheet {
        position: absolute;
        width: 72%;
        padding: 20px;
        display: grid;
        gap: 10px;
      }

      .document-sheet p {
        font-size: 20px;
      }

      .document-sheet-1 { left: 4%; top: 4%; transform: rotate(-5deg); }
      .document-sheet-2 { left: 18%; top: 18%; transform: rotate(3deg); }
      .document-sheet-3 { left: 10%; top: 40%; transform: rotate(-2deg); }
      .document-sheet-4 { left: 26%; top: 56%; transform: rotate(4deg); }
      .document-sheet-5 { left: 12%; top: 72%; transform: rotate(-3deg); }

      .file-hygiene-board {
        grid-template-columns: minmax(0, 0.8fr) minmax(0, 0.8fr) minmax(320px, 0.85fr);
      }

      .file-column {
        padding: 22px 24px;
        display: grid;
        gap: 12px;
        align-content: start;
      }

      .file-column-bad {
        background: linear-gradient(180deg, rgba(255, 249, 246, 0.98), rgba(255, 255, 255, 0.96));
      }

      .file-column-good {
        background: linear-gradient(180deg, rgba(245, 249, 253, 0.98), rgba(255, 255, 255, 0.96));
      }

      .file-line {
        padding: 12px 14px;
        border-radius: 16px;
        background: rgba(14, 40, 65, 0.05);
        font-size: 18px;
        font-weight: 700;
      }

      .closing-board {
        grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
      }

      .closing-path {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
        min-height: 0;
      }

      .closing-step-card {
        align-content: start;
      }

      .closing-step-head {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .qa-panel {
        padding: 24px;
        display: grid;
        gap: 16px;
        align-content: start;
      }

      .qa-panel p {
        font-size: 24px;
        color: var(--accent-strong);
      }

      .feature-lead-card::after {
        content: none;
      }

      .compact-annotation-list {
        gap: 10px;
      }

      .compact-annotation-list .annotation-card {
        padding: 16px;
      }

      .compact-annotation-list .annotation-card p {
        font-size: 18px;
      }

      .speaker-mini-row {
        gap: 12px;
      }

      .speaker-mini {
        width: 54px;
        height: 54px;
        border-radius: 16px;
      }

      .qa-panel-rich {
        grid-template-rows: auto auto auto 1fr;
      }

      .qr-panel {
        margin-top: 6px;
        padding: 16px;
        border-radius: 20px;
        border: 1px solid rgba(16, 34, 55, 0.08);
        background: rgba(14, 40, 65, 0.04);
        display: grid;
        grid-template-columns: 104px 1fr;
        gap: 16px;
        align-items: center;
      }

      .qr-image {
        width: 104px;
        height: 104px;
        border-radius: 14px;
        background: #fff;
        padding: 8px;
      }

      .qr-copy {
        display: grid;
        gap: 8px;
      }
    </style>
  </head>
  <body>
    <div class="master-background" aria-hidden="true"></div>
    <section class="hero-shell">
      <div class="title-shell">
        <h1>${escapeHtml(slide.header)}</h1>
        <p class="subtitle">${escapeHtml(slide.subheader)}</p>
      </div>
    </section>
    <main class="content-shell">
      ${renderBody(slide)}
    </main>
  </body>
</html>
`;
};

const main = async () => {
  const existingDeck = JSON.parse(await readFile(deckSpecPath, "utf8"));
  void existingDeck;
  const expandedSlides = seedSlides.map(toDeckSlide).map(ensureCanonicalSlideRecord);
  const activeSequence = expandedSlides.map((slide) => slide.displayNumber);

  const nextDeck = {
    deckId: "customgpt",
    title: "CustomGPT Creation",
    version: "2026-04-08.2",
    status: "active",
    template: SAEM_TEMPLATE_CONTRACT,
    numberingPolicy: {
      summary:
        "Use simple linear numbering for the expanded workshop deck and keep the story moving from problem to build to governance.",
      activeSequence,
      deprecatedSlides: [],
      notes: [
        "The compressed 11-slide experiment has been superseded by this expanded workshop master deck.",
        "Keep the first third concept-light, the middle third build-heavy, and the close operational.",
      ],
    },
    narrativeSpine: [
      "Buried policy answers create real administrative drag in residency programs.",
      "A custom GPT can become a grounded policy assistant when scope, files, and guardrails are designed well.",
      "The audience should leave knowing how to build, test, deploy, and maintain one responsibly.",
      "Connor's original workshop deck remains the source backbone, but the material is now reorganized into a more teachable sequence.",
    ],
    slides: expandedSlides,
  };

  await writeFile(deckSpecPath, `${JSON.stringify(nextDeck, null, 2)}\n`, "utf8");
  await writeFile(masterSpecsPath, `${buildMasterSpecs(expandedSlides, activeSequence)}\n`, "utf8");
  await writeFile(deckMatrixPath, `${buildDeckMatrix(expandedSlides, activeSequence)}\n`, "utf8");
  await writeFile(readmePath, buildReadme(), "utf8");
  await writeFile(restructurePlanPath, buildRestructurePlan(), "utf8");

  await mkdir(graphicsDir, { recursive: true });
  await writeFile(resolve(graphicsDir, "policy-question-loop.svg"), buildPolicyLoopGraphicSvg(), "utf8");
  await writeFile(resolve(graphicsDir, "grounded-assistant-system.svg"), buildGroundedAssistantGraphicSvg(), "utf8");
  await writeFile(resolve(graphicsDir, "privacy-boundary.svg"), buildPrivacyBoundaryGraphicSvg(), "utf8");
  await writeFile(resolve(graphicsDir, "governance-cycle.svg"), buildGovernanceCycleGraphicSvg(), "utf8");

  const studioTemplateDir = resolve(repoRoot, SAEM_TEMPLATE.studioTemplateDir);
  const studioTemplateHtmlPath = resolve(studioTemplateDir, "template.html");
  const studioTemplatePreviewPath = resolve(studioTemplateDir, "template.png");
  const studioTemplateReadmePath = resolve(studioTemplateDir, "README.md");
  const studioTemplateShellRegionsPath = resolve(studioTemplateDir, "shell-regions.json");

  await mkdir(studioTemplateDir, { recursive: true });
  await writeFile(studioTemplateHtmlPath, buildStudioTemplateHtml(), "utf8");
  await writeFile(studioTemplateReadmePath, `${buildStudioTemplateReadme()}\n`, "utf8");
  await writeFile(
    studioTemplateShellRegionsPath,
    `${buildStudioTemplateShellRegions()}\n`,
    "utf8"
  );
  await captureHtmlScreenshot({
    inputPath: studioTemplateHtmlPath,
    outputPath: studioTemplatePreviewPath,
    width: 1920,
    height: 1080,
    fullPage: false,
  });

  const keepPackets = new Set([
    "_template.md",
    "slide-01-title-promise.md",
    "slide-02-why-this-matters.md",
    "slide-03-what-this-tool-is.md",
  ]);
  for (const entry of await readdir(slidePacketsDir)) {
    if (!entry.endsWith(".md") || keepPackets.has(entry)) {
      continue;
    }
    await rm(resolve(slidePacketsDir, entry), { force: true });
  }

  for (const slide of seedSlides) {
    const packetAbsPath = resolve(repoRoot, slide.packetPath);
    await mkdir(dirname(packetAbsPath), { recursive: true });
    await writeFile(packetAbsPath, buildPacket(slide), "utf8");
  }

  for (const slide of expandedSlides) {
    const selectedVariant = getSelectedVariant(slide);
    const variantDirPath = getVariantDirPath(selectedVariant);
    if (!variantDirPath) {
      continue;
    }

    const versionDir = resolve(repoRoot, variantDirPath);
    const specPath = resolve(versionDir, "spec.json");
    const reportPath = resolve(versionDir, "report.html");
    const assetsManifestPath = resolve(
      repoRoot,
      slide.paths.assetsManifest ?? `projects/customgpt/slide-assets/${slide.id}/manifest.json`
    );

    await mkdir(dirname(assetsManifestPath), { recursive: true });
    await writeFile(
      assetsManifestPath,
      `${JSON.stringify(buildEmptySlideAssetsManifest(slide.id), null, 2)}\n`,
      "utf8"
    );

    await mkdir(versionDir, { recursive: true });
    await writeFile(specPath, `${JSON.stringify(buildGeneratedSpec(slide, variantDirPath), null, 2)}\n`, "utf8");
    await writeFile(reportPath, buildGeneratedReportHtml(slide, selectedVariant), "utf8");
  }

  for (const slide of seedSlides) {
    const versionDir = resolve(repoRoot, slide.variantDir);
    const htmlPath = resolve(versionDir, "generated.html");
    const previewPath = resolve(versionDir, "preview.png");
    await mkdir(versionDir, { recursive: true });
    await writeFile(htmlPath, renderSlideHtml(slide), "utf8");
    await captureHtmlScreenshot({
      inputPath: htmlPath,
      outputPath: previewPath,
      width: 1920,
      height: 1080,
      fullPage: false,
    });
  }

  console.log(`Expanded CustomGPT deck to ${expandedSlides.length} active slides.`);
  console.log(`Seeded ${seedSlides.length} mockups under projects/customgpt/slide-figures/.`);
};

await main();
