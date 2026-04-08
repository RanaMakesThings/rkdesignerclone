# Deck Workflow

Project-local workflow for building the SAEM workshop deck under
`projects/customgpt/`.

## Core rule

Treat `deck-spec.json` as the canonical current deck backbone.

Treat the checked-in SAEM PowerPoint template as the canonical conference shell
for final deck assembly:

- `projects/customgpt/assets/powerpoint-template/saem-annual-meeting-powerpoint-template.pptx`

Use this project to rebuild the workshop around a clearer sequence:

- what it is
- why it works
- what good looks like
- live build
- governance

## Standard per-slide loop

1. Audit the current source deck and identify what to cut, compress, or demo.
1. Lock the workshop timing before building visuals.
1. Create or update the slide packet for each rebuilt slide.
1. Draft the first three slides around audience orientation.
1. Use figure ideation only where the slide needs a new visual concept.
1. Prefer direct screenshot-based or interface-based visuals for builder
   walkthrough slides.
1. Treat the live walkthrough as a separate narrative block, not an appendix.
1. Use the SAEM PowerPoint shell for final assembly and delivery.
1. Generate slide reports only after the rebuilt sequence is stable enough to
   review as a speaker-ready deck.

## Required reports

- per-slide:
  - `npm run figures:report -- --project-root projects/customgpt --slide <slide-id>`
- whole deck:
  - `npm run figures:deck-report -- --project-root projects/customgpt`

## Execution policy

- blank-sheet concept slides can use Designer figure tooling
- builder walkthrough slides should lean on annotated screenshots and concrete
  product surfaces
- final PowerPoint packaging for SAEM should inherit the conference template's
  widescreen format, footer behavior, and theme defaults unless the meeting
  instructions explicitly change
