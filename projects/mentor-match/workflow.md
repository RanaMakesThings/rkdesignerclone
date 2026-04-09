# Deck Workflow

Project-local workflow for building the Mentor Match deck under
`projects/mentor-match/`.

## Core rule

Treat `deck-spec.json` as the canonical current deck backbone.

Treat this project as a first-pass story scaffold until real Mentor Match
source material is added.

If a change affects:

- slide numbering
- slide thesis
- header
- subheader
- takeaway
- figure role
- build status
- pilot goals or assumptions

then update these files in the same turn:

- `deck-spec.json`
- `master-slide-specs.md`
- `deck-matrix.md`
- the affected slide packet
- the relevant file in `inputs/`

## Timing rule

The default target is a seven-minute spoken overview.

Aim for:

- roughly 45 to 60 seconds per slide
- one primary idea per slide
- no dense evidence slide until real sources exist

## Standard per-slide loop

1. Confirm whether the slide is still assumption-based or grounded in real
   source material.
2. Update the slide packet before building any visual.
3. Keep the copy plain-language and product-shaped.
4. Choose one visual family that can be understood in a single glance.
5. Use figure ideation only when the slide needs a new visual concept rather
   than a copy-only revision.
6. Keep stakeholder claims directional until user interviews, pilot data, or
   sourced evidence exists.
7. Once a visual direction is locked, use the normal Designer execution lanes
   for draft generation and refinement.
8. Sync the deck-level docs before moving on to the next slide.

## Execution policy

- Start with slides 1 to 3 because they determine the story shape for the rest
  of the deck.
- Treat slide 4 as the key workflow diagram once the product mechanics are
  confirmed.
- Slides 5 to 7 can stay packet-first until pilot details and evidence are
  clearer.
- Do not imply validated impact metrics until the project has real source
  documents or measured results.

## Recommended next build sequence

1. Replace assumptions in `inputs/PROGRAM_NOTES.md`.
2. Revise slides 1 to 4 from confirmed product language.
3. Generate the first visual pass for slides 1 to 3.
4. Lock the workflow diagram for slide 4.
5. Add real pilot goals and success metrics to slide 6.
6. Tighten the talk track so the deck fits the seven-minute window.

## Required reports

- per-slide:
  `npm run figures:report -- --project-root projects/mentor-match --slide <slide-id>`
- whole deck:
  `npm run figures:deck-report -- --project-root projects/mentor-match`
