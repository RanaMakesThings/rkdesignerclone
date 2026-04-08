# LLM CLIs

Reusable direct API tooling for this repo.

## Command

- `npm run anthropic -- <messages|api> [options]`
- `npm run anthropic -- review --image <path> [options]`
- `npm run anthropic -- html [options]`
- `npm run gemini:image -- [options]`
- `npm run gemini:html -- [options]`
- `npm run gemini:html:tune -- --dir <path> --change-file <path> [options]`
- `npm run gemini:review -- --image <path> [options]`
- `npm run html:edit:run -- --artifact-dir <path> --change-file <path> [options]`
- `npm run openai:image -- [options]`
- `npm run openai:html -- [options]`
- `npm run presentation:images -- [options]`

Default artifact root for new LLM runs:

- `DESIGNER_DATA_DIR`, defaulting to `~/designer-data`
- unless `--out` is provided, new image, HTML, review, and presentation
  artifacts write under `~/designer-data/runs/...`
- raw provider payloads are not written by default; use `--save-raw` only when
  you explicitly need a sanitized `debug/response.json`

## Required secret

Resolved in this order:

1. `ANTHROPIC_API_KEY`
2. `YSN_ANTHROPIC_API_KEY`

`npm run anthropic -- ...` is Doppler-wrapped by default.

Gemini image generation uses:

1. `GEMINI_API_KEY`

`npm run gemini:image -- ...` is also Doppler-wrapped by default.
`npm run gemini:html -- ...` is also Doppler-wrapped by default.
`npm run gemini:html:tune -- ...` is also Doppler-wrapped by default.

OpenAI tooling uses:

1. `OPENAI_API_KEY`

`npm run openai:image -- ...` is also Doppler-wrapped by default.
`npm run openai:html -- ...` is also Doppler-wrapped by default.
`npm run html:edit:run -- ...` is also Doppler-wrapped by default and expects
the same provider keys as the providers it invokes.

## Examples

- Create a message:
  - `npm run anthropic -- messages --model claude-sonnet-4-6`
    `--input "Summarize this note"`
  - `cat note.txt | npm run anthropic -- messages --model claude-sonnet-4-6`

- Review a local image:
  - `npm run anthropic -- review --image`
    `projects/designer-health/slide-figures/slide-06/slide-06--version-000028.png`
    `--prompt-file`
    `projects/designer-health/prompts/slide-06-workflow-strip-critique.txt`
    `--out projects/designer-health/slide-figures/slide-06/versions/version-000028--slide-07/anthropic-review`

- Raw API call:
  - `npm run anthropic -- api --method POST --path /messages --body '{"model":"claude-sonnet-4-6","max_tokens":128,"messages":[{"role":"user","content":"Hello"}]}'`

- Generate self-contained HTML from a prompt and reference image:
  - `npm run anthropic -- html --prompt-file prompts/figure-html.txt`
    `--image projects/designer-health/slide-figures/slide-03/slide-03--version-000050.png`
    `--out ~/designer-data/runs/adhoc/example`
  - Note: the HTML command defaults to a higher token budget than plain
    messages because full-slide documents are easy to truncate at low limits.

## Gemini image examples

- Prompt inline:
  - `npm run gemini:image -- --prompt "Clean 16:9 editorial pitch-deck`
    `figure about clinic scheduling pressure"`

- Prompt from file:
  - `npm run gemini:image -- --prompt-file prompts/figure.txt`
    `--aspect-ratio 16:9 --image-size 2K`

- Prompt from file with a reference image:
  - `npm run gemini:image -- --prompt-file prompts/figure.txt`
    `--image projects/designer-health/slide-figures/slide-03/slide-03--version-000050.png`

## Gemini HTML examples

- Prompt inline:
  - `npm run gemini:html -- --prompt "Generate a self-contained HTML`
    `pitch-deck figure with inline SVG only"`

- Prompt from file:
  - `npm run gemini:html -- --prompt-file prompts/figure-html.txt`
    `--model gemini-3.1-pro-preview`

- Prompt from file with a reference image:
  - `npm run gemini:html -- --prompt-file prompts/figure-html.txt`
    `--image projects/designer-health/slide-figures/slide-03/slide-03--version-000050.png`

- Tune an existing Gemini HTML artifact dir with a concrete change request:
  - `npm run gemini:html:tune -- --dir`
    `projects/designer-health/slide-figures/slide-06/versions/version-000028--slide-07/gemini-html`
    `--change-file projects/workspaces/example-html-delta.md`
  - finalize a pending micro-pass after writing the operator note:
    `npm run gemini:html:tune -- --dir`
    `projects/designer-health/slide-figures/slide-06/versions/version-000028--slide-07/gemini-html`
    `--change-file projects/workspaces/example-html-delta.md`
    `--codex-review-file`
    `projects/designer-health/slide-figures/slide-06/versions/version-000028--slide-07/gemini-html/tune/<run-id>/<attempt>/codex-micro-review.md`

- Notes:
  - `gemini:html` now records reference image paths under
    `request.json.referenceImages`.
  - Tune change files must include `## Requested change` and
    `## Success checks`; `## Guardrails` is optional.
  - `gemini:html:tune` expects an existing dir with `generated.html`,
    `prompt.txt`, and `request.json`, refreshes `preview.png`, and writes retry
    history under `tune/<run-id>/`.
  - The tune loop is intentionally narrow: Gemini generates the HTML, GPT and
    Claude judge whether the requested delta happened, GPT and Claude also run
    regression review, and any single concrete blocker prevents promotion.
  - A candidate only promotes after a checked-in Codex/operator micro-review
    note clears it.

## Gemini review examples

- Review a local image:
  - `npm run gemini:review -- --image`
    `projects/designer-health/slide-figures/slide-06/slide-06--version-000028.png`
    `--prompt-file`
    `projects/designer-health/prompts/slide-06-workflow-strip-critique.txt`
    `--out projects/designer-health/slide-figures/slide-06/versions/version-000028--slide-07/gemini-review`

## OpenAI image examples

- Prompt inline:
  - `npm run openai:image -- --prompt "Premium 16:9 investor-deck mechanism figure"`

- Prompt from file with a reference image:
  - `npm run openai:image -- --prompt-file prompts/figure.txt`
    `--image projects/designer-health/slide-figures/slide-03/slide-03--version-000050.png`

## OpenAI HTML examples

- Prompt inline:
  - `npm run openai:html -- --prompt "Generate one self-contained 1920x1080`
    `HTML slide figure with inline SVG only"`

- Prompt from file with a reference image:
  - `npm run openai:html -- --prompt-file prompts/figure-html.txt`
    `--image projects/designer-health/slide-figures/slide-03/slide-03--version-000050.png`

## HTML edit run examples

Use this when an HTML slide surface already exists and you want a
multi-provider edit search with judges, retry state, and a version-local run
ledger. Do not use it for blank-sheet generation; use `slide:create:*`
instead.

- Run against an existing artifact dir:
  - `npm run html:edit:run -- --artifact-dir`
    `projects/designer-health/slide-figures/slide-06/versions/version-000028--slide-07/gemini-html`
    `--change-file projects/workspaces/example-html-delta.md`

- Run through a manifest-resolved slide surface:
  - `npm run html:edit:run -- --project-root projects/designer-health`
    `--slide slide-06 --surface gemini-html`
    `--change-file projects/workspaces/example-html-delta.md`

- Notes:
  - writes a `tune/run-YYYYMMDD-HHMMSS-html-edit/` ledger under the chosen
    artifact dir
  - records `state.json`, `report.html`, per-round synthesis, and per-slot
    judge artifacts
  - can stop after one clean winner by default

## Presentation image batch

Use this when you want a fast spec-to-images pass for presentation or pitch-deck
graphics across both providers.

- Template:
  - `scripts/llm/presentation-image-spec-template.md`

- Prompt from file:
  - `npm run presentation:images -- --spec-file`
    `scripts/llm/presentation-image-spec-template.md`
    `--slug clinic-history-graphic`

- Prompt inline:
  - `npm run presentation:images -- --spec "Graphic for a pitch deck. Show a`
    `clinician reconstructing patient history from fragmented notes. Clean`
    `editorial composition, no on-image text."`

- Prompt with a locked reference image:
  - `npm run presentation:images -- --spec-file spec.md`
    `--image projects/designer-health/slide-figures/slide-06/versions/version-000113--slide-07-v108-native-2k-gemini-v2/image-01.jpg`

- OpenAI-only:
  - `npm run presentation:images -- --spec-file spec.md --provider openai`

- More variants:
  - `npm run presentation:images -- --spec-file spec.md`
    `--count-per-provider 4`

- Notes:
  - default is `3` variants per provider, so `6` total images when
    `--provider both`
  - the batch assigns one talkable version sequence across the returned set
    (`version-01`, `version-02`, ...), and mirrors that numbering in
    `summary.md`, `manifest.json`, console output, and provider artifact dir
    names such as `openai/version-04--editorial-baseline/`
  - each generated result also gets a global raw-graphic ID like
    `graphic-000013`, plus a batch ID like `graphic-batch-000003`; those are
    separate from slide `version-0000xx` history and canonical `asset-000xxx`
    records
  - writes `spec.txt`, `manifest.json`, `summary.md`, and provider-specific
    artifact dirs under `~/designer-data/runs/designer-health/<timestamp>-<slug>/`
    by default
  - uses a presentation-image scaffold automatically, so the input can stay
    closer to a design spec than a fully-written model prompt
  - `--image <path> ...` passes one or more local reference images through to
    each provider run while still producing a normal dashboard-visible batch
