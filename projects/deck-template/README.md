# Deck Project Template

Starter kit for a new pitch-deck project under `projects/<project>/`.

This template captures the reusable process that came out of the Designer deck:

- canonical deck backbone in `deck-spec.json`
- stable active versus deprecated slide numbering
- slide packets as the narrative / visual decision layer
- project-local workflow with loop gates
- stamped per-slide figure folders with manifest-backed version history
- slide-level reports and a deck-level HTML report
- selected figure directions plus prior options

## What to copy

Copy this folder to:

- `projects/<new-project>/`

Then rename these files:

- `deck-spec.template.json` -> `deck-spec.json`
- `master-slide-specs.template.md` -> `master-slide-specs.md`
- `deck-matrix.template.md` -> `deck-matrix.md`
- `workflow.template.md` -> `workflow.md`

## Project structure

- `inputs/`
  - imported deck source docs
- `figures/`
  - project-local briefs, ideation, compositions, render briefs, specs
- `prompts/`
  - reusable Gemini / Anthropic / review prompts
- `references/`
  - source images, pasted HTML, screenshots, and external references
- `slide-packets/`
  - one working packet per slide
- `slide-figures/`
- stamped slide outputs, reports, and version bundles

## Starter checklist

- Copy the imported source docs into `inputs/`.
- Fill in `deck-spec.json` first.
- Sync `master-slide-specs.md` and `deck-matrix.md` to match the deck spec.
- Create the first slide packet before building any figure.
- Build a native pass first.
- Stamp `HTML + SVG + PNG` into the selected version bundle and mirror the
  promoted result into `slide-figures/slide-XX/`.
- Use `slide:versions` to create, promote, or migrate slide version bundles.
- Run the three-tool assessment:
  - Codex / GPT-5.4
  - Gemini
  - Anthropic
- If the pass fails, run the three-tool repair consultation.
- Generate the slide report.
- Regenerate the deck report whenever the running deck spec changes.

## Required reports

- one slide report per mature slide pass
- one deck report for the whole current backbone

See:

- `workflow.template.md`
- `reporting-contract.md`

## Existing reusable templates

Use the shared figure templates in:

- `projects/figures/README.md`

Those cover:

- ideation
- composition
- render brief

This starter kit covers the deck-level project structure around them.
