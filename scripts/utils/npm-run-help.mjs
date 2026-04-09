import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const packageJsonPath = resolve(process.cwd(), "package.json");
const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));

const scripts = pkg.scripts ?? {};

const args = process.argv.slice(2);
const noColor = args.includes("--no-color");
const checkMode = args.includes("--check");
const verboseMode = args.includes("--verbose");
const filters = args.filter((arg) => !arg.startsWith("--"));
const filterText = filters.length > 0 ? filters.join(" ") : null;

const colorsEnabled =
  !(noColor || process.env.NO_COLOR) &&
  process.stdout.isTTY &&
  process.env.TERM !== "dumb";

const outputWidth =
  process.stdout.isTTY && typeof process.stdout.columns === "number"
    ? process.stdout.columns
    : 100;

const WHITESPACE_RE = /\s+/;
const SHELL_SEGMENT_SPLIT_RE = /&&|\|\||;/;
const REPO_SCRIPT_RE = /\bnode\s+(\.\/)?scripts\//;

const ANSI = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  cyan: "\u001b[36m",
  gray: "\u001b[90m",
  yellow: "\u001b[33m",
};

const style = (text, ...codes) => {
  if (!colorsEnabled) {
    return text;
  }
  return `${codes.join("")}${text}${ANSI.reset}`;
};

const wrapText = (text, width) => {
  const normalized = String(text).trim().split(WHITESPACE_RE).join(" ");
  if (normalized.length === 0) {
    return [""];
  }

  const lines = [];
  let remaining = normalized;

  while (remaining.length > width) {
    let cut = remaining.lastIndexOf(" ", width);
    if (cut <= 0) {
      cut = width;
    }
    lines.push(remaining.slice(0, cut).trimEnd());
    remaining = remaining.slice(cut).trimStart();
  }

  lines.push(remaining);
  return lines;
};

const splitShellSegments = (command) =>
  String(command)
    .split(SHELL_SEGMENT_SPLIT_RE)
    .map((part) => part.trim())
    .filter(Boolean);

const SHELL_DIRECTORY_WORDS = new Set(["cd", "pushd", "popd"]);
const KNOWN_RUNNER_TAGS = new Map([
  ["git", "git"],
  ["doppler", "doppler"],
  ["npx", "npx"],
  ["npm", "npm"],
  ["node", "node"],
  ["markdownlint-cli2", "markdownlint"],
  ["gh", "gh"],
]);

const getPrimaryRunner = (command) => {
  for (const segment of splitShellSegments(command)) {
    const [head, next] = segment.split(WHITESPACE_RE, 2);
    if (!head || SHELL_DIRECTORY_WORDS.has(head)) {
      continue;
    }

    if (
      head === "node" &&
      (next?.startsWith("scripts/") || next?.startsWith("./scripts/"))
    ) {
      return "node(script)";
    }

    return KNOWN_RUNNER_TAGS.get(head) ?? head;
  }

  return "sh";
};

const isRepoScript = (command) => REPO_SCRIPT_RE.test(String(command));

const SCRIPT_DESCRIPTIONS = {
  help: "Show what each root npm script does",
  "help:check":
    "Validate that npm-run-help descriptions match package.json scripts",
  "studio:install": "Install the Designer Studio app dependencies",
  "studio:dev": "Run the Designer Studio app locally",
  "studio:build": "Build the Designer Studio app for production",
  "studio:start": "Start the built Designer Studio app",
  "studio:check": "Run Designer Studio lint and build checks",
  "studio:audit":
    "Report repo-local token bloat, raw payloads, legacy output refs, and handoff exclusions",

  "figures:assets": "Fetch and stage stock-image candidates for a figure spec",
  "figures:images": "Request stock-image candidates by purpose text",
  "figures:images:select": "Approve or reject a candidate for a slot/request",
  "figures:images:apply": "Write approved image selections back into a figure spec",
  "figures:images:refine": "Re-run an existing image request or figure asset board",
  "figures:images:report": "Summarize asset cache, reuse, and decision history",
  "figures:render": "Render a figure spec to HTML and metadata artifacts",
  "figures:export": "Export a rendered figure spec to a 1920x1080 PNG",
  "figures:check": "Run deterministic coverage checks for a figure spec",
  "figures:assess": "Run provider-backed review on a rendered figure output dir",
  "figures:review": "Run export, coverage, and assessment as one review loop",
  "figures:ideate":
    "Generate a provider-backed idea-set artifact from a figure brief for synthesis",
  "figures:ideation:run":
    "Run the v1 figure-ideation orchestrator from a strict packet and emit a durable run bundle",
  "figures:report": "Build a clean HTML slide-pass report from project artifacts",
  "figures:deck-report":
    "Build a deck-level HTML summary from the project slide specs and stamped artifacts",
  "figures:repair-loop":
    "Run Gemini + Anthropic repair consults and generate a repair-synthesis scaffold",
  "figures:test": "Run figure pipeline tests",

  "doppler:run": "Run an arbitrary command with Doppler secrets injected",
  "doppler:init": "Initialize Doppler project/config locally",
  "doppler:verify": "Verify current Doppler config and required keys",
  "doppler:upload": "Upload env vars to Doppler",
  "doppler:set-admin-token":
    "Generate + store ADMIN_API_TOKEN in Doppler (prints token)",
  anthropic: "Run Anthropic CLI (messages and raw API calls)",
  "gemini:image": "Generate images from prompts via Gemini and save local artifacts",
  "gemini:html": "Generate self-contained HTML from prompts via Gemini",
  "gemini:html:tune":
    "Iterate an existing Gemini HTML artifact dir until GPT + Claude agree a requested delta happened",
  "gemini:review": "Review a local image with Gemini and save text critique artifacts",
  "html:edit:run":
    "Run a multi-provider multimodal HTML edit search loop with retry state and judges",
  "openai:image":
    "Generate images from prompts via OpenAI Responses image_generation and save local artifacts",
  "openai:html": "Generate self-contained HTML from prompts via OpenAI Responses",
  "presentation:images":
    "Generate multi-variant presentation graphics with global graphic IDs across Gemini and OpenAI from one spec",
  "html:screenshot": "Capture a PNG preview from a local HTML file via Playwright",
  "slides:export:packet":
    "Build an Illustrator-first export packet for the current selected Designer slides",
  "slides:export:pdf":
    "Render per-slide PDFs and a bundled deck PDF from the current selected Designer slides or an existing packet",
  "slides:export:svg":
    "Emit trusted pass-through editable SVG files from an existing packet or the current selected Designer slides",
  "slides:export:qa":
    "Render exported PDF and SVG handoffs back to PNG and diff them against the browser-rendered packet",
  "slides:export:pptx":
    "Legacy adapter: compile the current selected Designer slides, or an existing packet, into a PowerPoint deck",
  "slides:export:test":
    "Run the shared Designer slide resolver tests plus the Illustrator handoff export integration tests",
  "presentation:test": "Run Illustrator handoff export pipeline tests",
  "slide:versions":
    "Create, import, promote, and migrate manifest-backed slide figure versions",
  "slide:assets":
    "Attach canonical repo-owned assets to a Designer slide asset manifest",
  "references:sync":
    "Sync a project reference directory into the repo-native Designer layout",
  "slide:create:prep":
    "Allocate a Designer create draft, seed it from the deck template, and scaffold a create request",
  "slide:create:run":
    "Run the Designer first-draft HTML bootstrap over a template-seeded draft version",
  "slide:fine-tune:prep":
    "Resolve the official Designer slide, refresh its preview, and scaffold a fine-tune request",

  "lint:md": "Lint markdown with markdownlint-cli2",
  check: "Run markdown lint",
  gates: "Default local gates",

  "zip:code":
    "Create a designer-specific code-only repo zip that filters artifact-heavy paths",
  "zip:repo":
    "Unavailable in this trimmed checkout; shared repo-zip helper is not vendored",
  "pr:from-zip":
    "Unavailable in this trimmed checkout; shared zip-to-PR helper is not vendored",
  "gh:pr":
    "Unavailable in this trimmed checkout; shared GitHub PR helper is not vendored",
  "ops-core:init": "No-op in this trimmed checkout; there is no ops-core submodule",
};

const SCRIPT_DETAILS = {
  help: [
    "Options: --no-color, --check, --verbose",
    "Notes: filter by substring via `npm run help -- <text>`.",
  ],
  "help:check": [
    "Notes: exits non-zero if descriptions are missing or stale.",
    "Options: --no-color, --verbose",
  ],
  "studio:install": [
    "Usage: npm run studio:install",
    "Notes: runs npm install inside apps/studio.",
  ],
  "studio:dev": [
    "Usage: npm run studio:dev",
    "Notes: proxies to the Next.js dev server in apps/studio.",
  ],
  "studio:build": [
    "Usage: npm run studio:build",
    "Notes: proxies to the Next.js production build in apps/studio.",
  ],
  "studio:start": [
    "Usage: npm run studio:start",
    "Notes: starts the built Next.js app from apps/studio.",
  ],
  "studio:check": [
    "Usage: npm run studio:check",
    "Notes: runs Designer Studio lint and build checks in sequence.",
  ],
  "studio:audit": [
    "Usage: npm run studio:audit [-- --json]",
    "Notes: reports tracked raw payloads, repo-local artifact trees, stale legacy output references, large noncanonical files, and the current .designerignore handoff surface.",
  ],
  "figures:assets": [
    "Usage: npm run figures:assets -- --spec <path> [--out <dir>] [--approved-only] [--reuse-from <text>]",
    "Notes: Doppler-wrapped by default; requires PEXELS_API_KEY for live search and writes assets.json, asset-selection.json, render-assets.json, and the asset board artifacts.",
  ],
  "figures:images": [
    'Usage: npm run figures:images -- --purpose "<text>" [--orientation <landscape|portrait|square>] [--color <value>] [--style <text>] [--mood <text>] [--shot <text>] [--people <text>] [--copy-safe <left|right|top|bottom|center>] [--provider <id>] [--approved-only] [--reuse-from <text>] [--count <n>] [--slug <slug>] [--out <dir>] [--no-download]',
    "Notes: Doppler-wrapped by default; writes assets.json, asset-selection.json, render-assets.json, asset-board.html, and asset-board.png under output/figures/image-requests/<slug>/ unless --out is set.",
  ],
  "figures:images:select": [
    "Usage: npm run figures:images:select -- --dir <outputDir> --slot <slotId> [--candidate <candidateId>|--asset <assetId>] [--status <approved|shortlisted|rejected|archived|in_use>] [--placement <hook>] [--treatment <name>] [--object-position <css>] [--opacity <0-1>] [--crop-variant <id>] [--alt <text>] [--reason <text>]",
    "Notes: updates asset-selection.json and render-assets.json for the target request or figure output dir.",
  ],
  "figures:images:apply": [
    "Usage: npm run figures:images:apply -- --spec <path> [--out <dir>]",
    "Notes: writes approved/in-use selections into media.slots[].selectedAssetRef in the source spec and marks those assets as in_use.",
  ],
  "figures:images:refine": [
    "Usage: npm run figures:images:refine -- --dir <outputDir> [--purpose <text>] [--orientation <landscape|portrait|square>] [--color <value>] [--style <text>] [--mood <text>] [--shot <text>] [--people <text>] [--copy-safe <left|right|top|bottom|center>] [--provider <id>] [--approved-only] [--reuse-from <text>] [--count <n>] [--no-download]",
    "Notes: Doppler-wrapped by default; reloads the prior manifest context and re-runs search into the same output dir.",
  ],
  "presentation:images": [
    "Usage: npm run presentation:images -- --spec <text>|--spec-file <path> [--image <path> ...] [--provider <both|gemini|openai>] [--count-per-provider <n>] [--slug <slug>] [--out <dir>]",
    "Notes: writes to DESIGNER_DATA_DIR/runs/designer-health/<timestamp>-<slug>/ by default with spec.txt, manifest.json, summary.md, version-01 style batch labels, global raw graphic IDs like graphic-000013, and can pass locked reference images through the batch.",
  ],
  "figures:images:report": [
    "Usage: npm run figures:images:report -- [--dir <outputDir>] [--out <path>]",
    "Notes: summarizes the global asset registry and, when --dir is provided, the current request's approval/rejection state too.",
  ],
  "figures:render": [
    "Usage: npm run figures:render -- --spec <path> [--out <dir>]",
    "Notes: writes spec.json, meta.json, and figure.html under output/figures/<slug>/ by default.",
  ],
  "figures:export": [
    "Usage: npm run figures:export -- --spec <path> [--out <dir>] [--no-images]",
    "Notes: requires Playwright; if PEXELS_API_KEY is available, export also attempts a best-effort asset board pass unless --no-images is set.",
  ],
  "figures:check": [
    "Usage: npm run figures:check -- --spec <path> [--out <dir>]",
    "Notes: writes coverage.json and exits non-zero on blocking failures.",
  ],
  "figures:assess": [
    "Usage: npm run figures:assess -- --dir <outputDir> [--policy <path>]",
    "Notes: Doppler-wrapped by default; default policy uses provider=auto and will prefer Anthropic, then OpenAI, then provider=none when neither key is available.",
  ],
  "figures:review": [
    "Usage: npm run figures:review -- --spec <path> [--out <dir>] [--policy <path>] [--no-images]",
    "Notes: Doppler-wrapped by default; runs export, check, then assessment; export will also attempt asset search when PEXELS_API_KEY is available unless --no-images is set.",
  ],
  "figures:ideate": [
    "Usage: npm run figures:ideate -- --brief <path> [--slug <slug>] [--out <dir>] [--count <n>]",
    "Notes: Doppler-wrapped by default; writes a raw ideation artifact under output/figures/ideation/<slug>/ and best-effort image boards for shortlisted photo/hybrid ideas when PEXELS_API_KEY is available.",
  ],
  "figures:ideation:run": [
    "Usage: npm run figures:ideation:run -- --input <packet.{yaml,json}> [--config <path>] [--profile <id>] [--out <dir>] [--json]",
    "Notes: Doppler-wrapped by default; runs the full v1 validation -> ideation -> shortlist -> thumbnails -> critique -> packaging pipeline using the canonical spec pack under scripts/figures/ideation-system/v1.1 and writes a run bundle under DESIGNER_DATA_DIR/runs/<project>/figure-ideation/ unless --out is set.",
  ],
  "figures:report": [
    "Usage: npm run figures:report -- --project-root <path> --slide <slide-XX> [--out <path>]",
    "Notes: builds a reviewable HTML report that assembles the slide packet, figure docs, and visual branch artifacts into one page.",
  ],
  "figures:deck-report": [
    "Usage: npm run figures:deck-report -- --project-root <path> [--out <path>]",
    "Notes: builds a deck-level HTML summary from master-slide-specs.md, deck-matrix.md, and any stamped slide figure assets already present.",
  ],
  "figures:repair-loop": [
    "Usage: npm run figures:repair-loop -- --project-root <path> --slide <slide-XX> [--prompt-file <path>] [--image <path>] [--codex-file <path>] [--synthesis-out <path>]",
    "Notes: expects a checked-in codex-repair.md as the GPT-5.4 input, then runs Gemini and Anthropic repair consults into the canonical slide dirs and writes a generated repair-synthesis scaffold.",
  ],
  "figures:test": [
    "Usage: npm run figures:test",
    "Notes: runs spec, coverage, and assessment parser tests via the Node test runner.",
  ],
  "doppler:run": ["Usage: npm run doppler:run -- <cmd> [args...]"],
  "doppler:init": ["Options: --require <KEY>, --require-value <KEY>, --help"],
  "doppler:verify": ["Options: --require <KEY>, --require-value <KEY>, --help"],
  "doppler:upload": [
    "Options: --file/-f, --project/-p, --config/-c, --yes/-y, --dry-run, --no-silent, --help",
  ],
  "doppler:set-admin-token": [
    "Options: --project/-p, --config/-c, --key, --bytes, --no-output, --help",
  ],
  anthropic: [
    "Usage: npm run anthropic -- <messages|api|review> [options]",
    "Notes: Doppler-wrapped by default; `review` accepts --image plus --prompt/--prompt-file and reads ANTHROPIC_API_KEY or YSN_ANTHROPIC_API_KEY from the injected env.",
  ],
  "gemini:image": [
    "Usage: npm run gemini:image -- [--prompt <text> | --prompt-file <path>] [--model <id>] [--aspect-ratio <ratio>] [--image-size <size>] [--slug <slug>] [--out <dir>] [--save-raw] [--json]",
    "Notes: Doppler-wrapped by default; reads GEMINI_API_KEY from the injected env and writes prompt.txt, request.json, result.json, and outputs/image-*.png under DESIGNER_DATA_DIR/runs/adhoc/<timestamp>-<slug>/ unless --out is set. Use --save-raw only when you explicitly need debug/response.json.",
  ],
  "gemini:html": [
    "Usage: npm run gemini:html -- [--prompt <text> | --prompt-file <path>] [--model <id>] [--temperature <n>] [--slug <slug>] [--out <dir>] [--json]",
    "Notes: Doppler-wrapped by default; reads GEMINI_API_KEY from the injected env and writes prompt.txt, request.json, result.json, response.txt, and generated.html under DESIGNER_DATA_DIR/runs/adhoc/<timestamp>-<slug>/ unless --out is set. request.json records any reference image paths under referenceImages.",
  ],
  "gemini:html:tune": [
    "Usage: npm run gemini:html:tune -- --dir <artifactDir> --change-file <path> [--image <path> ...] [--codex-review-file <path>] [--max-retries <n>] [--json]",
    "Notes: Doppler-wrapped by default; expects an existing Gemini HTML artifact dir with generated.html, prompt.txt, and request.json, refreshes preview.png, writes tune/<run-id>/ attempt history, runs both delta and regression checks, blocks on any single concrete regression, and only promotes after a checked-in Codex/operator micro-review clears the candidate.",
  ],
  "gemini:review": [
    "Usage: npm run gemini:review -- --image <path> [--prompt <text> | --prompt-file <path>] [--model <id>] [--temperature <n>] [--slug <slug>] [--out <dir>] [--json]",
    "Notes: Doppler-wrapped by default; reads GEMINI_API_KEY from the injected env and writes prompt.txt, request.json, result.json, and response.txt under the review output dir. Without --out, it defaults to DESIGNER_DATA_DIR/runs/adhoc/<timestamp>-<slug>/.",
  ],
  "html:edit:run": [
    "Usage: npm run html:edit:run -- [--artifact-dir <dir> | --project-root <path> --slide <id>] --change-file <path> [--image <path> ...] [--mode <repair|explore>] [--providers <openai,gemini>] [--slots-per-provider <n>] [--target-pass-count <n>] [--max-rounds <n>] [--promote-on-pass] [--resume <runDir>] [--json]",
    "Notes: Doppler-wrapped by default; creates a schema-driven tune/<run-id>/ ledger with official-baseline + slot-parent + candidate judging, 2+2 style multi-provider slot fanout, retry synthesis, and optional Codex/operator-gated promotion of a clean winner.",
  ],
  "openai:image": [
    "Usage: npm run openai:image -- [--prompt <text> | --prompt-file <path>] [--model <id>] [--image <path> ...] [--size <WxH>] [--quality <level>] [--slug <slug>] [--out <dir>] [--save-raw] [--json]",
    "Notes: Doppler-wrapped by default; reads OPENAI_API_KEY from the injected env and writes prompt.txt, request.json, result.json, and outputs/image-01.png under DESIGNER_DATA_DIR/runs/adhoc/<timestamp>-<slug>/ unless --out is set. Use --save-raw only when you explicitly need debug/response.json.",
  ],
  "openai:html": [
    "Usage: npm run openai:html -- [--prompt <text> | --prompt-file <path>] [--model <id>] [--image <path> ...] [--slug <slug>] [--out <dir>] [--json]",
    "Notes: Doppler-wrapped by default; reads OPENAI_API_KEY from the injected env and writes prompt.txt, request.json, result.json, response.txt, and generated.html under DESIGNER_DATA_DIR/runs/adhoc/<timestamp>-<slug>/ unless --out is set.",
  ],
  "presentation:images": [
    "Usage: npm run presentation:images -- [--spec <text> | --spec-file <path>] [--image <path> ...] [--provider <both|gemini|openai>] [--count-per-provider <n>] [--slug <slug>] [--out <dir>] [--save-raw] [--json]",
    "Notes: Doppler-wrapped by default; applies a presentation-graphics prompt scaffold, can pass one or more local reference images through each provider run, assigns a global version-01/version-02/... sequence across the batch, and writes spec.txt, manifest.json, summary.md, plus provider/version-* artifact dirs with prompt.txt, request.json, result.json, and outputs/image-01.* under DESIGNER_DATA_DIR/runs/designer-health/<timestamp>-<slug>/ unless --out is set. Use --save-raw only when you explicitly need debug/response.json.",
  ],
  "html:screenshot": [
    "Usage: npm run html:screenshot -- --input <html> --output <png> [--width <n>] [--height <n>] [--full-page]",
    "Notes: uses Playwright locally to render a file:// HTML page into a PNG preview for comparison or review.",
  ],
  "slides:export:packet": [
    "Usage: npm run slides:export:packet -- --project designer-health --out <dir> [--slide <slide-XX|N> ...] [--json]",
    "Notes: writes manifest.json plus per-slide source.html/source.svg/source-preview, normalized.html, flattened.png, preview.png, background.png, text-layers.json, dependencies.json, source classification, illustratorReadiness metadata, and QA surrogate artifacts for the current selected Designer slides.",
  ],
  "slides:export:pdf": [
    "Usage: npm run slides:export:pdf -- --project designer-health --out <dir> [--packet <dir>] [--slide <slide-XX|N> ...] [--json]",
    "Notes: renders one slide.pdf per exported slide plus deck.pdf. DOM-backed slides render through Playwright from normalized.html; preview-only slides fall back to a PDF page backed by the packet preview image.",
  ],
  "slides:export:svg": [
    "Usage: npm run slides:export:svg -- --project designer-health --out <dir> [--packet <dir>] [--slide <slide-XX|N> ...] [--json]",
    "Notes: emits editable.svg only for trusted pass-through SVG slides such as wrapper assets with a verified full-slide SVG. It does not attempt general HTML-to-SVG reconstruction in v1.",
  ],
  "slides:export:qa": [
    "Usage: npm run slides:export:qa -- --packet <dir> [--json]",
    "Notes: builds PDF and SVG handoffs in a temp workspace, renders them back to PNG, diffs them against flattened.png, and records a handoff-qa/summary.json plus per-slide QA reports back into the packet.",
  ],
  "slides:export:pptx": [
    "Usage: npm run slides:export:pptx -- --project designer-health --out <file.pptx> [--packet <dir>] [--slide <slide-XX|N> ...] [--json]",
    "Notes: legacy compatibility adapter. Builds a widescreen PPTX with background.png as the base visual and recreates extracted text groups as editable native text boxes. Without --packet it first compiles a temporary packet from the current selected Designer slides.",
  ],
  "slides:export:test": [
    "Usage: npm run slides:export:test",
    "Notes: runs the focused Designer selected-slide resolver tests and the packet/PDF/SVG/QA export integration tests via the Node test runner.",
  ],
  "presentation:test": [
    "Usage: npm run presentation:test",
    "Notes: runs the focused Illustrator handoff packet/PDF/SVG/QA integration tests via the Node test runner.",
  ],
  "slide:versions": [
    "Usage: npm run slide:versions -- <create|import-html|promote|reassign|compact|migrate> [options]",
    "Notes: manages slide-figures/registry.json, per-slide manifest.json files, versions/version-*/ bundles, clean slide-root figure projections, and direct operator HTML imports with preview rendering.",
  ],
  "slide:assets": [
    "Usage: npm run slide:assets -- add --slide <slide-XX|N> --source <path> --label <text> [--summary <text>] [--status <value>] [--kind <value>] [--role <value>] [--asset-id <id>] [--tag <text>] [--note <text>] [--json]",
    "Notes: creates or updates projects/designer-health/slide-assets/slide-XX/manifest.json, copies the chosen canonical preview into the checked-in slide-assets folder, and preserves repo-local provenance back to the source run when possible.",
  ],
  "references:sync": [
    "Usage: npm run references:sync -- --project-root <path> [--json]",
    "Notes: normalizes project reference material into the checked-in Designer references layout.",
  ],
  "slide:create:prep": [
    "Usage: npm run slide:create:prep -- --slide <slide-XX|N> [--project-root <path>] [--lane <auto|html|native|hybrid>] [--reference-image <path> ...] [--reference-file <path> ...] [--version-id <id>] [--force] [--json]",
    "Notes: local-only Designer bootstrap prep; resolves the slide through deck-spec.json, allocates or reuses a create-draft version bundle, seeds version-root generated.html and preview.png from the deck template shell, snapshots context under versions/version-*/create/, and writes slide-notes/<slide>/create-request.md.",
  ],
  "slide:create:run": [
    "Usage: npm run slide:create:run -- --slide <slide-XX|N> [--project-root <path>] [--version-id <id>] [--lane <auto|html|native|hybrid>] [--request-file <path>] [--reference-image <path> ...] [--mode <create|explore>] [--providers <openai,gemini>] [--slots-per-provider <n>] [--target-pass-count <n>] [--max-rounds <n>] [--max-slot-attempts <n>] [--json]",
    "Notes: Doppler-wrapped by default; runs the template-seeded first-draft HTML bootstrap, reuses the multimodal edit-run engine in internal create mode, materializes a passing winner back to the draft version root, and leaves promotion manual via slide:versions promote. Native lane is scaffold-only in this first cut.",
  ],
  "slide:fine-tune:prep": [
    "Usage: npm run slide:fine-tune:prep -- --slide <slide-XX|N> [--project-root <path>] [--force] [--json]",
    "Notes: local-only prep command for Designer slide polish; resolves the official stamped slide from deck-spec.json, refreshes gemini-html/preview.png when a Gemini HTML branch exists, and writes a starter slide-notes/<slide>/fine-tune-request.md without running any model calls.",
  ],
  "lint:md": ["Options: see markdownlint-cli2 docs."],
  check: ["Notes: same as lint:md."],
  gates: ["Notes: runs markdown lint plus Designer Studio lint/build checks."],
  "zip:code": [
    "Options: --out <path>, --max-file-mb <n>, --policy <path>, --source <text>, --dry-run, --verbose, --json",
    "Notes: includes tracked plus untracked non-ignored files, excludes designer artifact trees via scripts/repo/code-zip-policy.json, and injects .github/repo-stamp.json.",
  ],
  "zip:repo": [
    "Notes: unavailable in this trimmed checkout because the shared ops-core zip helper is not vendored.",
  ],
  "pr:from-zip": [
    "Notes: unavailable in this trimmed checkout because the shared ops-core zip-to-PR helper is not vendored.",
  ],
  "gh:pr": [
    "Notes: unavailable in this trimmed checkout because the shared ops-core GitHub PR helper is not vendored.",
  ],
  "ops-core:init": [
    "Usage: npm run ops-core:init",
    "Notes: prints a no-op message because this checkout does not vendor ops-core.",
  ],
};

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const matchesFilter = (name) => {
  if (!filterText) {
    return true;
  }
  return name.toLowerCase().includes(filterText.toLowerCase());
};

const getDetailLines = (name) => {
  const details = SCRIPT_DETAILS[name];
  if (!details) {
    return null;
  }
  return Array.isArray(details) ? details : [details];
};

const entries = Object.entries(scripts)
  .filter(([name]) => matchesFilter(name))
  .sort(([a], [b]) => collator.compare(a, b));
const nameWidth = Math.max(...entries.map(([name]) => name.length), 0);
const tags = entries.map(([, command]) => getPrimaryRunner(command));
const tagWidth = Math.max(...tags.map((tag) => tag.length), 0);

const GROUPS = [
  {
    title: "Figures",
    match: (name) => name.startsWith("figures:"),
  },
  {
    title: "Env & Secrets",
    match: (name) => name.startsWith("doppler:"),
  },
  {
    title: "LLM",
    match: (name) =>
      name === "anthropic" ||
      name.startsWith("gemini:") ||
      name.startsWith("openai:"),
  },
  {
    title: "Quality Gates",
    match: (name) =>
      name === "gates" || name === "check" || name === "lint:md",
  },
  {
    title: "GitHub",
    match: (name) => name === "gh:pr",
  },
  {
    title: "Utils",
    match: (name) =>
      name === "help" ||
      name === "help:check" ||
      name === "slide:fine-tune:prep",
  },
  {
    title: "Other",
    match: () => true,
  },
];

const printed = new Set();
const missingDetails = new Set();

if (!checkMode || verboseMode) {
  console.log(style("Root npm scripts", ANSI.bold));
  console.log(style("Run via:", ANSI.gray), "`npm run <name>`");
  if (filterText) {
    console.log(style("Filter:", ANSI.gray), JSON.stringify(filterText));
  } else {
    console.log(style("Tip:", ANSI.gray), "`npm run help -- <substring>`");
  }
  console.log(style("Flags:", ANSI.gray), "`--no-color` `--check` `--verbose`");
  console.log(
    style("Legend:", ANSI.gray),
    `${style("*", ANSI.bold)} runs repo JS in ${style("scripts/", ANSI.bold)}, [tool] = primary runner`
  );

  for (const group of GROUPS) {
    const groupEntries = entries.filter(([name]) => !printed.has(name));

    const items = groupEntries.filter(([name]) => group.match(name));
    if (items.length === 0) {
      continue;
    }

    console.log(`\n${style(group.title, ANSI.bold, ANSI.cyan)}`);

    for (const [name, command] of items) {
      printed.add(name);
      const description = SCRIPT_DESCRIPTIONS[name];
      const descriptionText = description ?? "TODO: add description";

      const runner = getPrimaryRunner(command);
      const marker = isRepoScript(command) ? style("*", ANSI.bold) : " ";

      const nameText = style(name.padEnd(nameWidth), ANSI.bold);
      const tagText = style(`[${runner.padEnd(tagWidth)}]`, ANSI.gray);

      const prefixWidth = 2 + 1 + 1 + nameWidth + 1 + (tagWidth + 2) + 2;
      const descAvailable = Math.max(24, outputWidth - prefixWidth);
      const descLines = wrapText(descriptionText, descAvailable);
      const formatDesc = (line) => (description ? line : style(line, ANSI.yellow));

      console.log(
        `  ${marker} ${nameText} ${tagText}  ${formatDesc(descLines[0])}`
      );
      for (const line of descLines.slice(1)) {
        console.log(`${" ".repeat(prefixWidth)}${formatDesc(line)}`);
      }

      const cmdAvailable = Math.max(24, outputWidth - 4);
      const cmdLines = wrapText(String(command).trim(), cmdAvailable);
      const cmdPrefix = `  ${style("│", ANSI.gray)} `;
      for (const line of cmdLines) {
        console.log(`${cmdPrefix}${style(line, ANSI.dim)}`);
      }

      if (verboseMode) {
        const detailLines = getDetailLines(name);
        if (detailLines) {
          const detailPrefix = `  ${style(">", ANSI.gray)} `;
          const detailAvailable = Math.max(24, outputWidth - detailPrefix.length);
          for (const detail of detailLines) {
            const detailWrapped = wrapText(detail, detailAvailable);
            console.log(`${detailPrefix}${style(detailWrapped[0], ANSI.gray)}`);
            for (const line of detailWrapped.slice(1)) {
              console.log(
                `${" ".repeat(detailPrefix.length)}${style(line, ANSI.gray)}`
              );
            }
          }
        } else {
          missingDetails.add(name);
        }
      }
    }
  }
}

const allScriptNames = Object.keys(scripts).sort((a, b) => collator.compare(a, b));
const missingDescriptions = allScriptNames.filter(
  (name) => !(name in SCRIPT_DESCRIPTIONS)
);
const staleDescriptions = Object.keys(SCRIPT_DESCRIPTIONS).filter(
  (name) => !(name in scripts)
);

if (missingDescriptions.length > 0 || staleDescriptions.length > 0) {
  console.log(`\n${style("Description map status", ANSI.bold)}`);
  if (missingDescriptions.length > 0) {
    console.log(
      style("Missing descriptions:", ANSI.yellow),
      missingDescriptions.join(", ")
    );
  }
  if (staleDescriptions.length > 0) {
    console.log(
      style("Stale descriptions:", ANSI.yellow),
      staleDescriptions.join(", ")
    );
  }

  const codexPromptLines = [
    "Update `scripts/utils/npm-run-help.mjs` to sync `SCRIPT_DESCRIPTIONS` with `package.json` scripts.",
  ];
  if (missingDescriptions.length > 0) {
    codexPromptLines.push(
      `Add descriptions for: ${missingDescriptions.join(", ")}.`
    );
  }
  if (staleDescriptions.length > 0) {
    codexPromptLines.push(
      `Remove stale entries for: ${staleDescriptions.join(", ")}.`
    );
  }
  codexPromptLines.push("Then run `npm run help:check` to validate the descriptions.");

  console.log(`\n${style("Paste into Codex", ANSI.bold)}`);
  console.log(codexPromptLines.map((line) => `- ${line}`).join("\n"));

  if (missingDescriptions.length > 0) {
    console.log(`\n${style("Add these to SCRIPT_DESCRIPTIONS", ANSI.bold)}\n`);
    for (const name of missingDescriptions) {
      console.log(`  ${JSON.stringify(name)}: \"TODO: describe\",`);
    }
  }

  if (staleDescriptions.length > 0) {
    console.log(`\n${style("Remove these from SCRIPT_DESCRIPTIONS", ANSI.bold)}\n`);
    for (const name of staleDescriptions) {
      console.log(`  ${JSON.stringify(name)},`);
    }
  }
}

if (checkMode && missingDescriptions.length === 0 && staleDescriptions.length === 0) {
  console.log("Help description map OK.");
}

if (verboseMode && missingDetails.size > 0) {
  console.log(`\n${style("Verbose details status", ANSI.bold)}`);
  console.log(
    style("Missing details:", ANSI.yellow),
    Array.from(missingDetails)
      .sort((a, b) => collator.compare(a, b))
      .join(", ")
  );
}

if (checkMode && (missingDescriptions.length > 0 || staleDescriptions.length > 0)) {
  process.exitCode = 1;
}
