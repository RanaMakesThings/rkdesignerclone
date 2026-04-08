# Slide Figures

Manifest-backed stamped slide folders for the Designer deck.

Use one folder per slide. Each slide directory is the official stamped surface
for the current selected version, while historical candidates live in a
version history bundle under the same slide directory.

## Slide directory contract

Each `slide-XX/` folder keeps the invariant top-level files and directories:

- `manifest.json`
- `versions/`
- version-tagged current projection files such as:
  `slide-03--version-000050.html`
  `slide-03--version-000050.svg`
  `slide-03--version-000050.png`
  and optional alternates like `slide-03--version-000050.jpg`

The selected version is projected into the slide root for fast browsing and for
compatibility with older tooling. All branch payload, review artifacts, repair
artifacts, and attempt notes belong to version bundles or sibling slide-level
docs, not the slide root itself.

## Version bundles

Historical and draft candidates live under:

- `versions/version-000123--<slug>/`

Each version bundle carries its own `version.json` and the canonical artifact
names for that attempt, such as:

- `generated.html`
- `source-locked.html` for raw imported or normalized baked HTML snapshots
- `preview.png`
- `figure.html`
- `figure.svg`
- `figure.png`
- comparison and review artifacts
- repair artifacts
- change notes for micro-passes

The project registry assigns version ids globally, and the slide manifest keeps
the ordered history plus the current `currentVersionId`.

Shared-CSS versions also record design-system metadata in `version.json`:

- `mode: "shared-css"`
- `sharedCssPath`
- `sourceHtmlPath`

## Common layout

Per slide, expect:

- current promoted native asset mirrored at the slide root:
  - `slide-XX--version-YYYYYY.png`
  - `slide-XX--version-YYYYYY.svg`
  - `slide-XX--version-YYYYYY.html`
- active editable branches inside the current version bundle:
  - `gemini-image/`
  - `gemini-html/`
  - `openai-html/`
  - `anthropic-html/`
- version history under `versions/version-*--<slug>/`
- assessment artifacts inside the relevant version bundle:
  - `codex-review.md`
  - `gemini-review/`
  - `anthropic-review/`
  - `assessment-synthesis.md`
- repair artifacts inside the relevant version bundle when the pass fails:
  - `codex-repair.md`
  - `gemini-repair/`
  - `anthropic-repair/`
  - `repair-synthesis.md`
  - `next-pass.md`
- slide-level notes:
  - `../slide-notes/<slide-dir>/README.md`
  - `../slide-notes/<slide-dir>/fine-tune-request.md`
- review report:
  - `../slide-reports/<slide-dir>.html`

For fresh-chat slide-by-slide polish on the current official slide, use
`../slide-fine-tuning.md`. For version creation, direct HTML imports,
promotion, slide-family reassignment, archival/migration hygiene, or root
compaction, use
`npm run slide:versions -- <create|import-html|promote|reassign|compact|migrate>`.

## Importing finished HTML

Use `import-html` when the HTML is already done and should become a new version
bundle without mutation.

Checklist:

- pass the logical slide via `--slide`
- provide HTML by file path or pipe it through stdin
- set a label when you care about the archive name
- promote separately unless the HTML should become current immediately

Examples:

- file input:
  `npm run slide:versions -- import-html --slide 8 --html-file`
  `/tmp/slide-08.html --label slide-08-user-html-market-opportunity-v1`
- stdin input:
  `pbpaste | npm run slide:versions -- import-html --slide 8`
  `--label slide-08-user-html-market-opportunity-v1`
- import and make current in one step:
  `npm run slide:versions -- import-html --slide 8 --html-file`
  `/tmp/slide-08.html --label slide-08-user-html-market-opportunity-v1`
  `--promote`

What `import-html` does:

- allocates the next global `version-XXXXXX`
- writes the HTML byte-for-byte to `generated.html`
- renders `preview.png` at 1920×1080
- registers the version in the slide manifest and global registry
- keeps the prior current version untouched unless `--promote` is set
- bumps `.designer/studio-refresh.token` so Studio sees the new bundle quickly

First-run prerequisite:

- `import-html` uses Playwright to render `preview.png`
- if Chromium is not installed yet, run `npx playwright install chromium`

What `import-html` now writes for shared-CSS workflow:

- `source-locked.html` keeps the supplied HTML byte-for-byte
- `generated.html` links `projects/designer-health/design-system/vox-shared.css`
- only exact known shared CSS is stripped; ambiguous or slide-local CSS stays inline
- `preview.png` is rendered from the normalized `generated.html`

Use `reassign` when a draft family landed under the wrong logical slide
directory, especially during public-numbering corrections. Example:

- `npm run slide:versions -- reassign --from slide-08 --to slide-09`
  `--version-id version-000278 --version-id version-000279`
- Add `--note-file create-request.md` to move slide-local request notes with
  the same operation.

## Converting legacy baked slides

Use `normalize-css` when a version bundle already exists and you want a new
shared-CSS draft without rewriting the original version in place.

Example:

- `npm run slide:versions -- normalize-css --slide slide-02`
  `--version-id version-000002 --label slide-02-shared-css-pass`

What `normalize-css` does:

- copies the source HTML into a new version bundle as `source-locked.html`
- writes a linked shared-CSS `generated.html`
- preserves residual slide-local CSS inline
- renders a fresh `preview.png`
- records `mode`, `sharedCssPath`, and `sourceHtmlPath` in `version.json`

## Designer design system files

The project-scoped shared CSS surface lives under:

- `projects/designer-health/design-system/vox-shared.css`
- `projects/designer-health/design-system/style-preview.html`
- `projects/designer-health/design-system/style-preview.source-locked.html`

Use Studio `/design-system` to edit or upload the master CSS and preview it against
the checked-in preview shell before importing or normalizing slide versions.

## Exporting the current selected deck

Use the slide export commands when you need an Illustrator-oriented handoff
from the current selected Designer slides.

Commands:

- packet export:
  `npm run slides:export:packet -- --project designer-health --out`
  `output/design-export/designer-packet`
- PDF handoff export:
  `npm run slides:export:pdf -- --project designer-health --out`
  `output/design-export/pdf`
- rebuild PDFs from an existing packet:
  `npm run slides:export:pdf -- --packet output/design-export/designer-packet`
  `--out output/design-export/pdf`
- trusted SVG pass-through export:
  `npm run slides:export:svg -- --packet output/design-export/designer-packet`
  `--out output/design-export/svg`
- handoff QA:
  `npm run slides:export:qa -- --packet output/design-export/designer-packet`

Packet contents:

- `manifest.json` with public numbering, repo slide ids, current version ids,
  source classes, export modes, dependency freeze status, Illustrator readiness,
  warnings, and per-slide paths
- per-slide `source.html`, `source.svg` when available, and `source-preview.*`
- per-slide `normalized.html`, `flattened.png`, `preview.png`,
  `background.png`, `text-layers.json`, `dependencies.json`, and QA artifacts
- optional `visual.svg` only when the slide already has a trusted full-slide
  SVG surface

Current v1 behavior:

- local relative assets referenced by the source HTML are copied into the packet
- remote CSS/font/CDN dependencies are recorded in `dependencies.json`
- DOM-backed slides default to `pdf_primary`
- trusted full-slide SVG wrappers export as `wrapper_svg_passthrough`
- preview-only slides fall back to `raster_fallback`
- existing `foreignObject` SVG assets are not treated as editable SVG handoffs
- `slides:export:pptx` still exists as a legacy compatibility adapter, but it
  is not the primary workflow for this cycle
