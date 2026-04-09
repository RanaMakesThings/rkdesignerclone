# Tooling agent guide

Use this guide for local utility tooling in this repo.

## Workflow routing

Workflow selection is canonical here. Prefer the smallest valid surface for
the request, then open the linked source-of-truth file before touching assets
or prompts.

### Existing official Designer slide polish

- Use when:
  the user wants polish on an already stamped Designer slide and the current
  direction is still valid
- Do not use when:
  the user wants a blank-sheet first draft or the slide needs a different
  concept family
- First command:
  `npm run slide:fine-tune:prep -- --slide 3`
- Next source of truth:
  `projects/designer-health/slide-fine-tuning.md`

### New first draft from the locked Designer shell

- Use when:
  the user wants a brand-new Designer slide draft or a blank-sheet first pass
  from the locked template
- Do not use when:
  the user is iterating on an existing official HTML surface
- First command:
  `npm run slide:create:prep -- --slide 12`
- Next source of truth:
  `projects/designer-health/slide-creation.md`

### One concrete HTML delta on an existing branch

- Use when:
  one contained change on an existing `gemini-html/generated.html` branch is
  the next move
- Do not use when:
  you need blank-sheet generation or a broader multi-provider search
- First command:
  `npm run gemini:html:tune -- --dir <path> --change-file <path>`
- Next source of truth:
  `projects/designer-health/slide-fine-tuning.md`

### Direct user HTML import into a new version bundle

- Use when:
  the user already has finished HTML and wants it registered as a new slide
  version without model edits or shell regeneration
- Do not use when:
  the request is a polish pass on an existing branch, a blank-sheet draft from
  the locked template, or a broader multi-provider search
- First command:
  `npm run slide:versions -- import-html --slide 8`
  `--html-file /tmp/slide-08.html --label slide-08-user-html-v1`
- Next source of truth:
  `projects/designer-health/slide-figures/README.md`

### Shared-CSS normalization for an existing version bundle

- Use when:
  the user wants to convert an existing baked slide version into a new
  shared-CSS draft while preserving the source version untouched
- Do not use when:
  the user is importing brand-new HTML from outside the repo
- First command:
  `npm run slide:versions -- normalize-css --slide slide-02`
  `--version-id version-000002`
- Next source of truth:
  `projects/designer-health/slide-figures/README.md`

### Multi-provider HTML edit search on an existing surface

- Use when:
  an HTML surface already exists and you want OpenAI/Gemini search, judges,
  and retry state around a change request
- Do not use when:
  the request is a single HTML/CSS micro-pass or a brand-new slide draft from
  the template
- First command:
  `npm run html:edit:run -- --artifact-dir <dir> --change-file <path>`
- Next source of truth:
  `scripts/llm/README.md`

### Fast stamped/current version switch

- Use when:
  the user wants to swap the stamped current version for one slide only
- Do not use when:
  the goal is to change selected variant metadata in `deck-spec.json`
- First command:
  `npm run slide:versions -- promote --slide slide-06 --version-id version-000028`
- Next source of truth:
  `projects/designer-health/slide-figures/README.md`

### Fast version-family reassignment / numbering correction

- Use when:
  version bundles were created under the wrong logical slide directory and need
  to move to another slide without regenerating assets
- Do not use when:
  the task is a public-number deck-spec renumber only with no version-bundle
  move
- First command:
  `npm run slide:versions -- reassign --from slide-08 --to slide-09`
  `--version-id version-000278`
- Next source of truth:
  `projects/designer-health/slide-figures/README.md`

### Illustrator handoff export for the current selected Designer deck

- Use when:
  you need a reusable slide packet, PDF handoff, trusted pass-through SVG, or
  QA bundle for the current selected Designer slides
- Do not use when:
  the task is a stamped/current version swap, a slide polish pass, or a new
  slide draft
- First command:
  `npm run slides:export:packet -- --project designer-health --out <dir>`
  or `npm run slides:export:pdf -- --project designer-health --out <dir>`
- Notes:
  packet export writes normalized HTML, rendered PNGs, grouped text-layer
  metadata, dependency manifests, source classification, and QA surrogate
  artifacts; PDF export is the primary Illustrator handoff; SVG export only
  passes through trusted full-slide SVG wrappers in v1
- Next source of truth:
  `scripts/presentation/README.md`

### Studio selected-variant promotion

- Use when:
  the user wants to change selected variant state in Studio via “Make Official”
- Do not use when:
  the goal is only to swap the stamped current version quickly
- First command:
  use the Studio “Make Official” action on `/slides/<slideId>`
- Next source of truth:
  `projects/designer-health/deck-spec.json`

### Lightweight figure ideation from a brief

- Use when:
  you need a simple model-backed ideation artifact from a brief
- Do not use when:
  strict packet validation, multi-provider synthesis, thumbnails, critique,
  and a packaged run bundle are required
- First command:
  `npm run figures:ideate -- --brief <path>`
- Next source of truth:
  `projects/figures/README.md`

### Packet-driven figure ideation orchestration

- Use when:
  strict packet validation, multi-provider synthesis, thumbnails, critique
  aggregation, and a packaged run bundle matter
- Do not use when:
  a lightweight ideation artifact is enough
- First command:
  `npm run figures:ideation:run -- --input <packet.{yaml,json}> [--profile designer]`
- Next source of truth:
  `scripts/figures/ideation-system/v1.1/README.md`

## Commands

- List npm scripts with descriptions:
  - `npm run help`
  - Filter: `npm run help -- <substring>`
  - Validate descriptions: `npm run help:check`

- Designer Studio app:
  - Install app dependencies:
    `npm run studio:install`
  - Start the local app:
    `npm run studio:dev`
  - Local dev uses webpack mode for reliable hot reload in repo worktrees
  - Build the app:
    `npm run studio:build`
  - Start the production app:
    `npm run studio:start`
  - Run app lint + build checks:
    `npm run studio:check`
  - Studio remains repo-native:
    `projects/<project>/deck-spec.json` is canonical, and the app builds an
    in-memory manifest from checked-in files rather than syncing to SQL
  - Canonical asset manifests are also checked in:
    `projects/<project>/assets/manifest.json` for deck-global reusable assets,
    and `projects/<project>/slide-assets/<slide-id>/manifest.json` for
    curated slide-local assets
  - Canonical factual references now live beside the deck:
    `projects/<project>/references/manifest.json` stores the library plus
    slide-level usage links, and `projects/<project>/references/generated/**`
    is derived output only
  - Refresh the running references rollup and appendix artifact with:
    `npm run references:sync -- --project-root projects/designer-health`
  - Canonical asset records carry both a semantic `id` and a global numbered
    `assetId` like `asset-000001`
  - First-class studio routes:
    `/`, `/graphics`, `/styles`, and `/slides/<slideId>`
  - `/styles` is the Designer shared design-system surface:
    it edits `projects/designer-health/design-system/vox-shared.css`, previews
    that CSS against `style-preview.html`, and supports CSS file upload before
    saving back to the checked-in master stylesheet
  - Legacy Designer routes redirect into the current slide-browser routes:
    `/projects/designer-health`, `/projects/designer-health/deck`,
    `/projects/designer-health/history`, and
    `/projects/designer-health/slides/<slideId>`
  - `/graphics` is the global visual archive:
    it flattens every previewable slide version across the active deck and
    pairs that with the canonical slide/deck asset manifests so generated
    graphics do not disappear into per-slide folders
  - Official-promotion write surface:
    use the studio “Make Official” action to change selected variant state;
    this edits only `deck-spec.json`, updates `selectedVariantId` plus variant
    statuses, and does not rewrite `paths.stampedDir`
  - Fast stamped-version switch for one slide:
    `npm run slide:versions -- promote --slide slide-06 --version-id version-000028`
  - Use `slide:versions promote` when the user wants to swap the stamped or
    current version only. Do not send that request through `slide:fine-tune:prep`,
    deck-report rebuilds, or Studio “Make Official”.

- Figure tooling:
  - Generate a provider-backed ideation artifact from a brief:
    `npm run figures:ideate -- --brief projects/designer-health/figures/briefs/<brief>.md`
  - Run the v1 packet-driven figure ideation orchestrator:
    `npm run figures:ideation:run -- --input`
    `scripts/figures/ideation-system/v1.1/examples/slide-09-figure-ideation-input-v0.2.yaml`
    `--profile designer`
  - Figure ideation now defaults to human-review-first:
    the stock config preserves real slide/figure copy when provided and ends in
    `human_review_required` unless the packet explicitly opts back into
    auto-promotion.
  - For named figure elements, include `figure_copy.panel_labels` and
    `figure_copy.figure_labels` in the packet so the thumbnail prompt builder
    does not collapse them into anonymous placeholder chips.
  - The stock provider route is optimized for stability observed in this repo:
    Anthropic + Google for text ideation/spatialization, OpenAI + Gemini for
    image/vision stages, with critique quorum reduced so one flaky critic does
    not stall the run.
  - Ask for stock-image candidates by purpose text:
    `npm run figures:images -- --purpose "clinic waiting room scheduling pressure"`
    `--style documentary --copy-safe right`
  - Approve or reject a candidate:
    `npm run figures:images:select -- --dir`
    `output/figures/image-requests/<slug> --slot <slotId>`
    `--candidate <candidateId>`
  - Apply approved selections into a figure spec:
    `npm run figures:images:apply -- --spec projects/designer-health/figures/specs/<spec>.json`
  - Refine an existing image request:
    `npm run figures:images:refine -- --dir`
    `output/figures/image-requests/<slug> --mood quiet --style editorial`
  - Summarize asset reuse and registry state:
    `npm run figures:images:report -- --dir output/figures/<slug>`
  - Build a stock-asset board directly from a figure spec:
    `npm run figures:assets -- --spec projects/designer-health/figures/specs/<spec>.json`
  - Render HTML + SVG + metadata:
    `npm run figures:render -- --spec projects/designer-health/figures/specs/slide-04-transformation-flow.json`
  - Export 1920x1080 PNG and stamp `figure.svg`:
    `npm run figures:export -- --spec projects/designer-health/figures/specs/slide-04-transformation-flow.json`
  - Export without image search:
    `npm run figures:export -- --spec`
    `projects/designer-health/figures/specs/slide-04-transformation-flow.json --no-images`
  - Run deterministic coverage checks:
    `npm run figures:check -- --spec projects/designer-health/figures/specs/slide-04-transformation-flow.json`
  - Run the full review loop:
    `npm run figures:review -- --spec projects/designer-health/figures/specs/slide-04-transformation-flow.json`
  - Re-run model review on an existing artifact dir:
    `npm run figures:assess -- --dir output/figures/slide-04-transformation-flow`
  - Build a clean HTML report for one slide pass:
    `npm run figures:report -- --project-root projects/designer-health`
    `--slide slide-06`
  - Build a deck-level HTML summary:
    `npm run figures:deck-report -- --project-root projects/designer-health`
  - Manage manifest-backed slide versions:
    `npm run slide:versions -- create`
    `npm run slide:versions -- promote`
    `npm run slide:versions -- normalize-css`
    `npm run slide:versions -- migrate`
  - Attach a canonical slide-local asset:
    `npm run slide:assets -- add --slide 9 --source`
    `~/designer-data/runs/designer-health/20260403T1830Z-example/openai/version-04--editorial-baseline`
    `--label "Reference Scene"`
  - `slide:assets` auto-assigns the next global canonical `assetId` while
    preserving the semantic slug `id`
  - Slide-targeted render/export/report commands resolve through the slide
    manifest; use version-aware targeting when you want a draft bundle instead
    of the current root mirror.
  - Public-numbered Designer slide workflows now resolve through
    `projects/designer-health/deck-spec.json` first:
    bare numbers like `4` or loose ids like `slide-4` mean the current public
    deck slot, while an explicit legacy id like `slide-04` still targets that
    archived workstream directly.
  - This public-number resolution now applies to
    `slide:fine-tune:prep`, `slide:create:prep`, `slide:create:run`,
    `slide:assets`, `figures:report`, `figures:repair-loop`, and
    manifest-backed `html:edit:run`.
- `slide:versions` remains logical-id based on purpose:
    use explicit ids like `slide-05` or `slide-04` there, not public renumbered
    deck slots.
  - Export the current selected Designer slides as a reusable packet:
    `npm run slides:export:packet -- --project designer-health --out`
    `output/design-export/designer-packet`
  - Export per-slide PDFs plus a bundled deck PDF:
    `npm run slides:export:pdf -- --project designer-health --out`
    `output/design-export/pdf`
  - Rebuild PDF handoffs from an existing packet:
    `npm run slides:export:pdf -- --packet output/design-export/designer-packet`
    `--out output/design-export/pdf`
  - Export trusted pass-through SVG handoffs from an existing packet:
    `npm run slides:export:svg -- --packet output/design-export/designer-packet`
    `--out output/design-export/svg`
  - Render exported handoffs back to PNG and diff them against the packet:
    `npm run slides:export:qa -- --packet output/design-export/designer-packet`
  - Packet output always records remote CSS/font/CDN dependencies in
    `dependencies.json` and copies local relative assets into the packet's
    `assets/` folder when referenced by the source HTML.
  - Illustrator handoff export is mixed-mode in v1:
    DOM-backed slides default to `pdf_primary`, trusted full-slide SVG
    wrappers become `wrapper_svg_passthrough`, and preview-only slides fall
    back to `raster_fallback`.
  - `slides:export:pptx` remains available as a legacy compatibility adapter,
    but it is not the primary workflow for this cycle.
  - Run the repair consultation wrapper after Codex/GPT-5.4 has written
    `codex-repair.md`:
    `npm run figures:repair-loop -- --project-root projects/designer-health`
    `--slide slide-06`

- Doppler / shared ops tooling:
  - `npm run doppler:init`
  - `npm run doppler:verify -- --require-value OPENAI_API_KEY`
  - `npm run doppler:verify -- --require-value PEXELS_API_KEY`
  - `npm run doppler:run -- <cmd> [args...]`
  - `npm run doppler:upload -- --file .env.example`
  - `npm run doppler:set-admin-token`

- Anthropic tooling:
  - `npm run anthropic -- messages --model claude-sonnet-4-6`
    `--input "List 5 concepts"`
  - `npm run anthropic -- html --prompt-file prompts/figure-html.txt`
    `--image projects/designer-health/slide-figures/slide-03/slide-03--version-000050.png`
  - `npm run anthropic -- review --image projects/designer-health/slide-figures/slide-06/slide-06--version-000028.png`
    `--prompt-file projects/designer-health/prompts/slide-06-workflow-strip-critique.txt`
  - `npm run anthropic -- review --image projects/designer-health/slide-figures/slide-06/slide-06--version-000028.png`
    `--prompt-file projects/designer-health/prompts/slide-06-workflow-strip-repair.txt`
    `--out projects/designer-health/slide-figures/slide-06/versions/version-000028--slide-07/anthropic-repair`
  - `npm run anthropic -- api --method POST --path /messages`
    `--body '{"model":"claude-sonnet-4-6","max_tokens":128,`
    `"messages":[{"role":"user","content":"Hello"}]}'`

- Gemini image tooling:
  - `npm run gemini:image -- --prompt-file prompts/figure.txt`
  - Add one or more reference images:
    `npm run gemini:image -- --prompt-file prompts/figure.txt`
    `--image projects/designer-health/slide-figures/slide-03/slide-03--version-000050.png`
  - `npm run gemini:image -- --prompt "Clean editorial 16:9 pitch-deck figure"`
    `--aspect-ratio 16:9 --image-size 2K`
  - Gemini image generation defaults to `2K`; treat `1K` as an exploration-only
    override when speed matters more than fidelity.
  - If a user asks for high-resolution output, rerun Gemini natively at the
    highest supported size first. Do not present a local upscale as true
    high-resolution output.
  - `npm run gemini:html -- --prompt-file prompts/figure-html.txt`
  - Raise Gemini reasoning/search breadth when exploring:
    `npm run gemini:html -- --prompt-file prompts/figure-html.txt`
    `--temperature 0.8 --thinking-level high`
  - Add one or more reference images:
    `npm run gemini:html -- --prompt-file prompts/figure-html.txt`
    `--image projects/designer-health/slide-figures/slide-03/slide-03--version-000050.png`
  - `npm run gemini:html -- --prompt "Generate a self-contained HTML`
    `pitch-deck figure with inline SVG only"`
  - Run the HTML delta-tuning loop on an existing artifact dir:
    `npm run gemini:html:tune -- --dir`
    `projects/designer-health/slide-figures/slide-06/versions/version-000028--slide-07/gemini-html`
    `--change-file`
    `projects/workspaces/example-html-delta.md`
  - `npm run gemini:review -- --image projects/designer-health/slide-figures/slide-06/slide-06--version-000028.png`
    `--prompt-file projects/designer-health/prompts/slide-06-workflow-strip-critique.txt`
  - `npm run gemini:review -- --image projects/designer-health/slide-figures/slide-06/slide-06--version-000028.png`
    `--prompt-file projects/designer-health/prompts/slide-06-workflow-strip-repair.txt`
    `--out projects/designer-health/slide-figures/slide-06/versions/version-000028--slide-07/gemini-repair`
  - `npm run html:screenshot -- --input ~/designer-data/runs/adhoc/foo/generated.html`
    `--output ~/designer-data/runs/adhoc/foo/preview.png`

- OpenAI tooling:
  - `npm run openai:image -- --prompt-file prompts/figure.txt`
  - Add one or more reference images:
    `npm run openai:image -- --prompt-file prompts/figure.txt`
    `--image projects/designer-health/slide-figures/slide-03/slide-03--version-000050.png`
  - Reference-backed OpenAI image runs use the Responses API with a
    text-capable runner model; direct no-reference runs still use the image
    generation endpoint.
  - `npm run openai:html -- --prompt-file prompts/figure-html.txt`
  - Raise OpenAI variation and reasoning for HTML exploration:
    `npm run openai:html -- --prompt-file prompts/figure-html.txt`
    `--temperature 0.8 --reasoning high`
  - Add one or more reference images:
    `npm run openai:html -- --prompt-file prompts/figure-html.txt`
    `--image projects/designer-health/slide-figures/slide-03/slide-03--version-000050.png`
  - Run the new multimodal HTML edit orchestrator over one existing surface:
    `npm run html:edit:run -- --artifact-dir`
    `projects/designer-health/slide-figures/slide-06/versions/version-000028--slide-07/gemini-html`
    `--change-file projects/workspaces/example-html-delta.md`
  - Manifest-backed edit runs also work:
    `npm run html:edit:run -- --project-root projects/designer-health`
    `--slide slide-06 --surface gemini-html`
    `--change-file projects/workspaces/example-html-delta.md`
  - Bootstrap a brand-new Designer slide draft from the locked deck shell:
    `npm run slide:create:prep -- --slide 12`
  - Run the first-draft HTML bootstrap on that draft:
    `npm run slide:create:run -- --slide 12`
  - `npm run html:screenshot -- --input ~/designer-data/runs/adhoc/foo/generated.html`
    `--output ~/designer-data/runs/adhoc/foo/preview.png`
  - Quick presentation-image batch across Gemini and OpenAI:
    `npm run presentation:images -- --spec-file`
    `scripts/llm/presentation-image-spec-template.md --slug example`
  - Add one or more reference images to the full batch:
    `npm run presentation:images -- --spec-file spec.md`
    `--image projects/designer-health/slide-figures/slide-06/versions/version-000113--slide-07-v108-native-2k-gemini-v2/image-01.jpg`
  - On the OpenAI side, reference-backed `presentation:images` runs
    automatically switch to a text-capable Responses runner model so attached
    images continue to work.
  - `presentation:images` assigns two numbering layers:
    batch-local `version-01` style labels inside one run, and global raw
    `graphic-0000xx` / `graphic-batch-0000xx` IDs that Studio shows in the
    Graphics tab
  - For Design Studio visibility in the current checkout, prefer the default
    output under `~/designer-data/runs/designer-health/` or set `--out` under
    this checkout's `output/figures/presentation-images/`
  - Do not point `presentation:images --out` at a different repo checkout's
    `output/figures/presentation-images/` directory if you expect the current
    Design Studio to index the batch; Studio only scans the current repo root
    plus shared `~/designer-data/runs/designer-health/`

- Repo helpers:
  - `npm run zip:code -- --help`
  - `npm run zip:repo -- --help`
  - `npm run pr:from-zip -- --help`
  - `npm run gh:pr -- --help`
  - `npm run slide:fine-tune:prep -- --slide 3`

### Code-only repo zip

- Use when:
  the user wants a shareable designer code snapshot without heavy generated
  artifacts, local app build output, or slide source-run caches
- Do not use when:
  the user needs the full remote GitHub archive or the generic ops-core local
  zip behavior
- First command:
  `npm run zip:code`
- Notes:
  includes tracked plus untracked non-ignored files, filters repo-local
  artifact trees via `scripts/repo/code-zip-policy.json`, keeps
  `.github/repo-stamp.json` in the archive, and defaults output to the
  gitignored `repo-zips/` folder

## Notes

- Figure review defaults to `scripts/figures/workflow-policy.json`, which uses
  `provider=auto`: Anthropic when `ANTHROPIC_API_KEY` is available, otherwise
  OpenAI when `OPENAI_API_KEY` is available, otherwise `provider=none`.

- Figure ideation happens in layers:
  1. Codex generates its own candidate set from the brief.
  2. `figures:ideate` generates a model-backed candidate artifact.
  3. `figures:ideation:run` is the separate v1 orchestration lane for strict
     packet-driven figure ideation when you need validation, multi-provider
     synthesis, thumbnail generation, critique aggregation, and a packaged run
     bundle.
  4. The v1 orchestrator loads its canonical prompts, schemas, config template,
     and Designer profile from `scripts/figures/ideation-system/v1.1/`. Treat
     that folder as the repo-owned source of truth for the packet contract.
  5. V1 run bundles land under `DESIGNER_DATA_DIR/runs/<project>/figure-ideation/`
     by default and do not mutate `projects/<project>/deck-spec.json`.
  6. The v1 runtime is deterministic-first: normalized brief, figure brief,
     merge / dedupe, shortlist scoring, family selection, and packaging are
     code-driven; figure move search, spatialization, thumbnail prompt
     building, thumbnail generation, and critique are provider-routed stages.
  7. Stage-owned routing matters: `spatialization` and
     `thumbnail_prompt_builder` use ordered `primary` then `fallbacks`, and the
     critique stage packages as `human_review_required` when critic quorum is
     not met.
  8. The current v1 lane does not expose HTML / SVG structural thumbnail
     generation as a first-class worker. The supported non-image fallback is
     textual thumbnail planning.
  9. For essential slides or when the wrapper is brittle, also gather direct
     ideation passes from GPT-5.4, Claude, and Gemini text.
  10. For shortlisted `photo` or `hybrid` directions, require explicit
     `imageIntent` and `styleIntent`, and run the image-board flow before
     locking the direction.
  11. Codex synthesizes the Codex ideas, model ideas, and any image-board
     findings into the checked-in ideation doc under
     `projects/designer-health/figures/ideation/`.
  12. Claude-backed ideation and assessment now tolerate fenced JSON even when
     the model wraps it in a short prose preamble, so do not treat markdown
     fences alone as a reason to abandon the run.

- Figure PNG export uses Playwright. If Chromium is missing locally, install it
  with `npx playwright install chromium`.

- `figures:render` now writes `figure.svg` alongside `figure.html`. For
  inline-SVG families this is a standalone extracted SVG; for HTML-first
  families it falls back to an SVG `foreignObject` wrapper so every render has
  an SVG artifact.

- `figures:report` writes an HTML report that assembles the slide packet,
  checked-in figure docs, the slide manifest, and the current selected
  version's native / Gemini artifacts for one slide into a single review page.

- `figures:deck-report` writes a deck-level HTML summary that assembles the
  canonical `deck-spec.json` backbone, imported figure-suggestion layer from
  the source docs, the manifest-resolved selected version for each slide,
  alternate explored options when they exist, and any stamped slide previews
  into one browseable page.
- Canonical asset state is separate from slide versions and spec text:
  `deck-spec.json` points at the deck asset manifest and each active slide's
  slide-asset manifest; those manifests hold curated repo-owned ingredients
  plus provenance links back to source runs or image boards.
- Source-of-truth boundaries for versioned slides:
  - `deck-spec.json` owns canonical slide and variant selection metadata
  - `manifest.json` plus per-version `version.json` own current, draft, and
    archived version state
  - projected root artifacts under `slide-figures/slide-XX/` are compatibility
    outputs, not the primary source of truth
  - transient generated exploration should land under `DESIGNER_DATA_DIR`
- Current stamped root artifacts are version-tagged. Prefer the exact current
  root filename from `manifest.json` or `slide:fine-tune:prep` output instead
  of assuming `slide-figures/slide-XX/figure.png`.
- For choosing between Designer create, fine-tune, `gemini:html:tune`, and
  `html:edit:run`, use Workflow routing above.
- Project-local Designer handoff guides:
  - `projects/designer-health/slide-creation.md`
  - `projects/designer-health/slide-fine-tuning.md`
- In Designer polish or edit-search mode, resolve the official slide through
  `projects/designer-health/deck-spec.json`, read `paths.stampedDir` plus the
  slide manifest, and treat the current selected version bundle under
  `slide-figures/slide-XX/versions/version-*--<slug>/` as the working folder
  for the next candidate.
- Designer Studio now reconciles slide manifests against on-disk
  `versions/version-*--<slug>/` bundles at read time, so copied draft bundles
  with a valid `version.json` still appear in Studio even before promotion.
- Slide version allocation also scans existing version bundle directories before
  choosing the next id, so stale `registry.json` counters do not collide with
  manually copied draft bundles.
- For small visual deltas on an official slide, prefer the stamped
  `gemini-html/generated.html` micro-pass inside the current version bundle
  when that branch is still aligned with the winner; otherwise edit the
  canonical native spec and rerender.
- For quick slide-HTML iteration inside an already chosen draft bundle, use the
  fast path: overwrite that bundle's `generated.html`, rerender its
  `preview.png`, and show the result. Do not create a new version bundle,
  promote, or refresh deck-wide reports unless the user explicitly asks for
  that heavier workflow.
- If the user specifies the exact draft version to update, skip the extra
  confirmation reads and go directly to file overwrite plus preview rerender.
  Only pause for investigation when the path is missing or the render fails.
- Imported figure suggestions in the deck report should surface the actual
  planning sections from the clean pack and full slide map, not just a thin
  summary stub. Keep composition/details/comments visible enough that the deck
  report can serve as a real figure-planning overview.
- The deck report should be navigable as a report viewer, not just a long
  scroll. Prefer a slide selector that can filter to one slide at a time while
  preserving an option to show the full deck.

- `figures:repair-loop` expects a checked-in `codex-repair.md` as the local
  Codex / GPT-5.4 repair input, then runs Gemini and Anthropic against the same
  repair prompt and writes `repair-synthesis.generated.md` as a scaffold.

- `figures:assets` expects `PEXELS_API_KEY` when running live stock-image
  search.

- `figures:assets`, `figures:ideate`, `figures:assess`, `figures:review`,
  `figures:images`, `anthropic`, and `gemini:image` are Doppler-wrapped by
  default.

- `gemini:image` expects `GEMINI_API_KEY` and writes artifacts under
  `DESIGNER_DATA_DIR/runs/adhoc/<timestamp>-<slug>/` unless `--out` is
  provided.
  The default artifact contract is now `prompt.txt`, `request.json`,
  `result.json`, and `outputs/image-*`; use `--save-raw` only when you
  explicitly need a sanitized provider payload under `debug/response.json`.
  Use this for provider-specific exploration, debugging, or sidecar reference
  passes only. It does not create the `presentation-images` batch manifest that
  Designer Studio `/graphics` reads.

- `presentation:images` writes `spec.txt`, `manifest.json`, `summary.md`, and
  provider result dirs under
  `DESIGNER_DATA_DIR/runs/designer-health/<timestamp>-<slug>/`.
  Provider result dirs now default to `prompt.txt`, `request.json`,
  `result.json`, `outputs/image-01.*`, and optional `debug/response.json`
  only when `--save-raw` is passed.
  Result records now carry global raw generated-graphic IDs like
  `graphic-000013`; these are distinct from stamped slide `version-0000xx`
  history and canonical `asset-000xxx` asset records.

- `gemini:html` expects `GEMINI_API_KEY` and writes artifacts under
  `DESIGNER_DATA_DIR/runs/adhoc/<timestamp>-<slug>/`, including
  `generated.html`, unless `--out` is provided. `request.json` records
  `referenceImages` when reference paths were supplied. It now also accepts
  `--thinking-level` for Gemini 3 thinking control.

- `gemini:html:tune` expects `GEMINI_API_KEY`, `OPENAI_API_KEY`, and
  `ANTHROPIC_API_KEY` or `YSN_ANTHROPIC_API_KEY`, starts from an existing
  Gemini HTML artifact dir, refreshes `preview.png`, writes attempt history
  under the draft version bundle's `tune/<run-id>/`, and now treats
  fine-tuning as a gated micro-pass:
  - both GPT and Claude must say the requested delta happened
  - GPT and Claude regression reviews must both clear the candidate
  - a checked-in Codex/operator micro-review note must clear the candidate
  - any single concrete blocker from regression review blocks promotion

- `gemini:html:tune` change files must use:
  - `## Requested change`
  - `## Success checks`
  - optional `## Guardrails`

- `gemini:html:tune` also accepts:
  - `--codex-review-file <path>` to finalize a pending micro-pass after writing
    the checked-in Codex/operator note.

- `gemini:html:tune` is for concrete HTML deltas only, such as position,
  spacing, size, or one contained visibility fix. If the request is really a
  layout, family, or semantic redesign, stop and use the normal review and
  repair flow instead of forcing more retries.

- `gemini:html:tune` now runs a lightweight static sanity check before image
  review and blocks immediately on leaked preamble text such as stray `xml`
  before the root SVG/HTML tag.

- `gemini:review` expects `GEMINI_API_KEY` and writes prompt/response artifacts
  for image critique under the target review dir. Without `--out`, use
  `DESIGNER_DATA_DIR/runs/adhoc/<timestamp>-<slug>/`.

- `openai:image` expects `OPENAI_API_KEY` and writes prompt/response artifacts
  under `DESIGNER_DATA_DIR/runs/adhoc/<timestamp>-<slug>/` unless `--out` is
  provided.
  The default artifact contract is now `prompt.txt`, `request.json`,
  `result.json`, and `outputs/image-01.png`; use `--save-raw` only when you
  explicitly need a sanitized provider payload under `debug/response.json`.
  Use this for provider-specific exploration, debugging, or sidecar reference
  passes only. It does not create the `presentation-images` batch manifest that
  Designer Studio `/graphics` reads.

- `openai:html` expects `OPENAI_API_KEY` and writes prompt/response artifacts
  plus `generated.html` under `DESIGNER_DATA_DIR/runs/adhoc/<timestamp>-<slug>/`
  unless `--out` is provided. It now also accepts `--temperature` and
  `--reasoning`.

- `html:edit:run` expects the same provider keys as the providers it uses,
  writes a full `tune/run-YYYYMMDD-HHMMSS-html-edit/` ledger under the chosen
  artifact dir, preserves the official baseline separately from the slot
  parent, fans out OpenAI/Gemini slot attempts in parallel, writes
  `state.json`, `report.html`, per-round synthesis, and per-slot judge
  artifacts, and can stop after one clean winner by default.

- `anthropic -- review` and `anthropic -- html` also default to
  `DESIGNER_DATA_DIR/runs/adhoc/<timestamp>-<slug>/` unless `--out` is
  provided, and now use the same `request.json` / `result.json` contract.

- `presentation:images` expects both `GEMINI_API_KEY` and `OPENAI_API_KEY`
  when `--provider both` is used, defaults to `3` variants per provider, and
  writes:
  - `spec.txt`
  - `manifest.json`
  - `summary.md`
  - one talkable global version sequence across the returned set
    (`version-01`, `version-02`, ...)
  - `gemini/<version-id>--<variant-slug>/...`
  - `openai/<version-id>--<variant-slug>/...`

- `presentation:images` is for quick presentation or pitch-deck image
  exploration from a design spec. It adds its own prompt scaffold, so the input
  can stay spec-like instead of becoming a fully-written generation prompt.
  Default to this when the user explicitly asks for a graphic, generated image,
  or a batch of pitch-deck visuals and expects the result to appear in the
  Graphics dashboard. Use the provider-specific `openai:image` or
  `gemini:image` commands only when the user clearly wants a provider-specific
  pass or when doing disposable sidecar iteration that does not need dashboard
  visibility.
  `presentation:images` also accepts `--image <path> ...` for locked style or
  composition references that should be passed through to each provider run
  while still producing a dashboard-visible batch manifest.

- `npm run anthropic -- review ...` expects `ANTHROPIC_API_KEY` or
  `YSN_ANTHROPIC_API_KEY` and writes prompt/response artifacts when `--out` is
  provided.

- `npm run anthropic -- html ...` now defaults to a higher HTML-sized token
  budget so full-slide documents are less likely to truncate; still override
  `--max-output-tokens` when a prompt is especially dense.

- `html:screenshot` is local-only and uses Playwright to turn any saved HTML
  artifact into a PNG preview for side-by-side review.

- `slide:fine-tune:prep` is the fast local prep path for Designer slide polish.
  It resolves the official slide from `deck-spec.json`, reads the slide
  manifest, clones a draft version bundle when needed, refreshes the draft
  `gemini-html/preview.png` only when it is missing or stale, and writes a starter
  `slide-notes/<slide>/fine-tune-request.md` file without running Gemini, GPT,
  or Claude.

- `figures:images` writes its artifacts under
  `output/figures/image-requests/<slug>/` unless `--out` is provided.

- The stock-image system writes these review artifacts:
  - `assets.json`
  - `asset-selection.json`
  - `render-assets.json`
  - `asset-board.html`
  - `asset-board.png`

- Global cached downloads live under `output/figures/.asset-cache/`; per-run
  manifests point at those cached assets instead of copying every image into
  each request directory.

- `figures:export` and `figures:review` attempt the asset-search pass
  automatically when `PEXELS_API_KEY` is available. Pass `--no-images` to
  disable that layer explicitly.

- Use `media.strategy`, `media.slots`, and
  `media.slots[].selectedAssetRef` when a photo or hybrid figure needs a
  specific chosen stock candidate in the final render.

- If markdown gates start failing due to vendored project files under
  `projects/**/.venv/`, tighten `lint:md` globs rather than editing vendored
  license files.
