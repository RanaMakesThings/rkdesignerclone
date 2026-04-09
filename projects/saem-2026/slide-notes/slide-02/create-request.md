# slide-02 Create Request

Official slide context:

- title: Why This Matters in the ED
- lane: html
- lane reason: Why This Matters in the ED defaults to the template-seeded HTML lane in v1.
- draft version id: version-000001
- draft version dir: /Users/rkhome/code/rkdesignerclone/projects/saem-2026/slide-figures/slide-02/versions/version-000001--slide-02-create-draft
- template id: saem-annual-meeting-template-v1
- adjacent slides: (none)
- packet path: /Users/rkhome/code/rkdesignerclone/projects/saem-2026/slide-packets/slide-02-why-this-matters.md
- note readme path: (none)
- reference images: (none)
- reference files: (none)

## Approved regions

```json
[
  {
    "id": "saem-footer-brand",
    "label": "SAEM Footer Brand",
    "x": 0,
    "y": 790,
    "width": 1920,
    "height": 290,
    "freezeLevel": "pixel-strict",
    "note": "Preserve the official SAEM26 footer treatment, including the logo block, geometric ribbon, date line, and Atlanta skyline."
  },
  {
    "id": "saem-logo-block",
    "label": "SAEM Logo Block",
    "x": 0,
    "y": 835,
    "width": 530,
    "height": 220,
    "freezeLevel": "semantic-stable",
    "note": "Do not obscure or redraw the SAEM26 logo/date block in the lower left."
  }
]
```

## Requested change

Create a finished SAEM conference slide from the seeded blank template.

Slide id: slide-02
Lane: html
Slide title: Why This Matters in the ED
Locked header: The ED creates a learning-design problem.
Locked subheader: Emergency medicine is built around interruption, uncertainty, and time scarcity.
Audience should leave believing: The challenge is structural: the learning format has to fit the work.
Core claim: The challenge is structural: the learning format has to fit the work.
Slide job: make the audience feel that emergency medicine's environment naturally favors microlearning
Figure burden: Show the fractured rhythm of emergency medicine and the mismatch between long-form teaching and point-of-care questions.
Figure logic: No selected visual yet. Aim for a timeline or interruption map that makes fragmented learning windows instantly legible.
Build status: starter packet drafted; first concept slide candidate

Slide packet excerpt:
# Slide 2 — Why This Matters in the ED

## Status

- current deck numbering: slide 2
- legacy source mapping: same as current
- decision state: OPEN

## Why this slide exists

- establish the environment problem
- show why emergency medicine is especially suited to microlearning
- frame the rest of the deck as a response to workflow reality

## Locked slide thesis

Emergency medicine naturally favors microlearning because clinical work is
fragmented, time-constrained, and full of just-in-time information needs.

## Slide purpose brief

- top claim:
  the ED creates a learning-design problem
- support claim:
  long-form education often arrives out of sync with clinical need
- non-goals:
  - do not define microlearning in detail yet
  - do not introduce FOAMed yet

## Figure job

- show interruption and fragmentation visually
- make the mismatch between work rhythm and traditional education obvious
- avoid a boring process diagram

## Locked copy

- header:
  `The ED creates a learning-design problem.`
- subheader:
  `Emergency medicine is built around interruption, uncertainty, and time scarcity.`
- figure labels:
  - `interruptions`
  - `micro-windows`

## Visual rules

- use a strong time-based structure
- make the rhythm legible in one glance
- do not turn it into a dashboard

## Existing useful source assets

- `inputs/microlearning_emergency_medicine_review.md`
- `inputs/saem_microlearning_talk_outline.md`

## Immediate next refinement

- generate a first interruption-map concept
- test whether a fractured shift timeline is clearer than a workflow loop

Must not become:
- a browser page, generic app UI, or component gallery unless the brief explicitly requires it
- a placeholder shell with the figure stub still visible
- a slide that weakens or changes the locked claim

## Success checks

- The slide is fully resolved and presentation-ready.
- No template placeholders remain.
- The header reads: The ED creates a learning-design problem.
- The subheader reads: Emergency medicine is built around interruption, uncertainty, and time scarcity.
- The figure visibly carries the specified burden.
- The slide stays inside the locked SAEM shell contract.
- The footer rule and footer logo remain aligned with the shell.
- The slide feels in-family with the adjacent official slides.

## Guardrails

- preserve the official SAEM shell
- preserve the footer rule and footer logo
- do not leave the figure stub or placeholder copy visible
- do not turn the slide into a browser page, app UI, or card grid unless the brief explicitly requires it
- do not weaken the locked slide claim

## Reference intent

- Adjacent slide previews are for deck continuity only.
- Optional reference images are for style or composition cues, not for literal copying unless explicitly stated.
- Supplemental reference files are summarized above and may clarify slide intent.

## Stop if

- the request actually needs a new slide concept rather than execution
- the brief is missing core copy needed to build the slide
- the best candidate still conflicts with the locked slide job after repeated rounds
