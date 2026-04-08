# SAEM 2026

Working project for a Society for Academic Emergency Medicine annual meeting
deck under `projects/saem-2026/`.

This folder is the project home for:

- deck backbone and slide inventory in `deck-spec.json`
- narrative and copy review in `master-slide-specs.md`
- execution tracking in `deck-matrix.md`
- project-local workflow in `workflow.md`
- source inputs in `inputs/`
- per-slide packets in `slide-packets/`
- figure specs and briefs in `figures/`
- stamped outputs in `slide-figures/`

## Starter checklist

- Drop source material into `inputs/`.
- Replace the placeholder talk metadata in `deck-spec.json`.
- Sync `master-slide-specs.md` and `deck-matrix.md` to match the deck spec.
- Start one packet per active slide in `slide-packets/`.
- Add reusable deck assets in `assets/manifest.json`.
- Add slide-local assets in `slide-assets/slide-XX/manifest.json`.
- Generate slide reports into `slide-reports/`.
- Regenerate the deck report whenever the active backbone changes.

## Suggested source docs

- `inputs/COPY_SOURCE_DOC.md`
- `inputs/VISUAL_SOURCE_DOC.md`
- `inputs/CITATION_SOURCE_DOC.md`
- `inputs/PROGRAM_NOTES.md`

## Conference template

- the canonical SAEM PowerPoint shell lives at
  `assets/powerpoint-template/saem-annual-meeting-powerpoint-template.pptx`
- template notes and integration guidance live at
  `assets/powerpoint-template/template-integration.md`

## Notes

- Keep project-specific content in this folder.
- Keep reusable tooling and shared prompt infrastructure at the repo level.
- Use `projects/figures/README.md` for shared ideation, composition, and
  render-brief patterns.
