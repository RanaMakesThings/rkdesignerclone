# Deck Workflow

Project-local workflow for building the SAEM 2026 deck under
`projects/saem-2026/`.

## Core rule

Treat `deck-spec.json` as the canonical current deck backbone.

Treat the checked-in SAEM PowerPoint template as the canonical conference shell
for final deck assembly:

- `projects/saem-2026/assets/powerpoint-template/saem-annual-meeting-powerpoint-template.pptx`

Treat each stamped slide folder as manifest-backed:

- the slide root keeps `manifest.json`, `versions/`, and the version-tagged
  current projected assets
- the current selected version is mirrored into the slide root for fast
  browsing and compatibility
- historical and draft attempts live under `versions/version-*--<slug>/`
- slide-level notes and reports live in sibling `slide-notes/` and
  `slide-reports/` folders

If a slide hardening pass changes:

- slide numbering
- active versus deprecated status
- slide thesis
- header
- subheader
- takeaway
- figure role
- selected direction
- build status

then update the deck-level docs in the same turn:

- `deck-spec.json`
- `master-slide-specs.md`
- `deck-matrix.md`
- `figure-companion.md` when figure-family guidance changed

## Standard per-slide loop

1. Create or update the slide packet.
1. Create figure ideation.
1. Create composition notes when layout is still open.
1. Create a render brief when execution is still open.
1. Use multiple models only while the slide direction is still open.
1. Once a direction is locked, use the default visual execution lane:
   Gemini image, then Gemini HTML.
1. Clone the current selected version into a draft bundle before a micro-pass
   or any other versioned edit.
1. Preview Gemini HTML as PNG.
1. When the next move is a concrete local HTML delta, run
   `gemini:html:tune` before broader assessment or repair. Use it inside the
   draft version bundle for position, spacing, visibility, size, or one
   contained structural tweak. Do not use it for family changes, semantic
   rewrites, or broader layout redesigns. Micro-passes must include:
   - delta check: did the requested change happen?
   - regression check: did anything else break?
   - checked-in Codex/operator micro-review before promotion
1. Use side-model generation branches only when they are justified challenge
   passes or unblock a stuck slide.
1. Run three-tool assessment: Codex / GPT-5.4, Gemini, and Anthropic.
1. Write `assessment-synthesis.md`.
1. Apply the loop gate: if only polish issues remain, promote; if structural
   issues remain, reopen the loop.
1. If the loop reopens, run three-tool repair consultation: Codex / GPT-5.4
   repair, Gemini repair, and Anthropic repair.
1. Write `repair-synthesis.md` and `next-pass.md`.
1. After the Gemini lane is stable, build and stamp the native pass:
   version-bundle `figure.html`, `figure.svg`, and `figure.png`, then project
   them to the slide root as `slide-XX--version-YYYYYY.html`, `.svg`, and `.png`.
1. Generate the slide report.

## Promotion rule

A slide is not promoted until:

- the stamped slide folder exists
- the current selected version is recorded in the slide manifest
- the assessment loop is complete
- the chosen Gemini lane or equivalent execution lane is documented
- the deck-level spec is synced
- the slide report is regenerated

For micro-passes, a candidate is not promoted until:

- both delta judges say the requested change happened
- GPT and Claude regression reviews find no blocker
- the checked-in Codex/operator micro-review clears it
- no single reviewer has raised a concrete visual blocker
- the draft version bundle has been promoted into the root-mirrored selected
  state

## Required artifacts

For a mature slide, expect:

- slide packet
- figure spec
- stamped slide folder
- assessment synthesis
- next-pass note when needed
- slide report

## Required reports

- per-slide:
  - `npm run figures:report -- --project-root projects/saem-2026 --slide <slide-id>`
- whole deck:
  - `npm run figures:deck-report -- --project-root projects/saem-2026`

Use version-aware output targeting when a slide command should land in a draft
bundle rather than the current root mirror.

## Review rule

Do not rely on one review source.

Use all three:

- Codex / GPT-5.4
- Gemini
- Anthropic

Then synthesize them into the actual decision.

## Execution policy

- Gemini image + Gemini HTML are the default execution lane once a slide
  direction is locked.
- `gemini:html:tune` is the default micro-iteration tool when the ask is a
  concrete HTML delta inside an already-correct family.
- any manual edit to `generated.html` invalidates prior micro-pass approval
  until the regression gate runs again.
- Other generation models are optional challenge branches, not routine
  requirements.
- Native HTML/SVG/PNG is still the canonical final artifact set.
- Final PowerPoint packaging for SAEM should inherit the conference template's
  widescreen format, footer behavior, and theme defaults unless the meeting
  instructions explicitly change.
