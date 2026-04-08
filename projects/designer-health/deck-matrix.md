# Deck Matrix

Human-readable status companion to `deck-spec.json`.

## Current numbering contract

The active public deck is sequentially numbered `1` through `12`.

Use `deck-spec.json` to resolve:

- public slide number:
  what users see and what Studio routes use
- repo slide id:
  the canonical logical deck entry
- stamped root:
  the on-disk artifact root when it differs

Key exceptions after the Slide 4/5 merge:

- public `4` -> repo `slide-05`
- public `5` -> repo `slide-06` -> stamped root `slide-06-quality-bar`
- public `6` -> repo `slide-07` -> stamped root `slide-06`
- public `8` -> repo `slide-09`

Old Slide 4 and old Slide 5 history now both belong to the current public
Slide 4 surface. Deprecated `slide-04` and `slide-04-05` remain historical
reference roots only.

## Deck template

- locked template id:
  `designer-deck-template-v1`
- active theme id:
  `designer-v1`
- design source:
  `PD-template-1` FigJam board

## Narrative spine

1. Demand is outpacing clinical capacity.
2. Recovering small numbers of visit minutes can create supply.
3. History is the cleanest wedge to pull first.
4. The hard part is producing a clinician-grade starting point.
5. Vox prepares that starting point before the encounter.
6. The clinician should start from a structured brief, not from zero.
7. If that shift is real, the category, economics, beachhead, and close are
   credible.

## Active Slide Inventory

### Slide 1 — VOX

- role: cover / tone
- current status: opener concepts exist, final minimal lockup still unresolved

### Slide 2 — Demand is outpacing clinical capacity

- role: proof of problem
- current status: locked Gemini HTML chart-led anchor is selected

### Slide 3 — More efficient visits will increase supply

- role: operational lever
- current status: strong stamped anchor exists and remains review-ready

### Slide 4 — History is the cleanest place to reclaim minutes

- role: wedge / intervention argument
- repo slide: `slide-05`
- stamped root: `slide-05`
- current status: locked Gemini HTML top-beat winner is selected
- history note: old Slide 4 mechanism work and old Slide 5 wedge work both now
  belong to this surface

### Slide 5 — The hard part is producing a history clinicians can start from

- role: quality bar
- repo slide: `slide-06`
- stamped root: `slide-06-quality-bar`
- current status: exact user-provided HTML snapshot is the official winner

### Slide 6 — Vox prepares the visit before it starts

- role: workflow explanation
- repo slide: `slide-07`
- stamped root: `slide-06`
- current status: image-led storyboard is the current winner; legacy native
  workflow-strip history remains attached

### Slide 7 — The clinician starts from a structured brief

- role: product tangibility
- repo slide: `slide-08`
- stamped root: `slide-08`
- current status: artifact-callouts native remains the stamped lead

### Slide 8 — Current AI helps around the visit

- role: category gap / market positioning
- repo slide: `slide-09`
- stamped root: `slide-09`
- current status: official starting-point strip remains stamped while active
  compare rounds continue in the same history root

### Slide 9 — Recovered visit time creates real capacity

- role: economics
- repo slide: `slide-10`
- stamped root: `slide-10`
- current status: equation-hero remains the leading editable branch, with newer
  alternatives preserved in version history

### Slide 10 — Start where throughput proof is fastest

- role: beachhead / proof logic
- repo slide: `slide-11`
- stamped root: `slide-11`
- current status: beachhead-profile hero is the stamped lead; proof-column is
  the main challenge branch

### Slide 11 — Built by people who understand the visit

- role: team credibility
- repo slide: `slide-12`
- stamped root: `slide-12`
- figure importance: helpful
- family: clean founder grid
- current status:
  imported Figma founder-grid draft is now the current official baseline for
  repo `slide-12`; next pass is copy tightening, not first-draft generation
- next artifact:
  tighten the founder trust lines and decide whether the imported layout needs
  any structural edits after copy lands

### Slide 12 — This round is about proving trust, capture, and repeatable deployment

- role: raise / milestone close
- repo slide: `slide-13`
- current status: no stamped root yet

## Deprecated References

### Legacy Slide 4

- status: deprecated
- note: keep as mechanism-reference history only; current public Slide 4 lives
  in repo `slide-05`

### Legacy Slide 4/5

- status: deprecated
- note: keep as shelved merged-bridge history only; it is not a live public
  slide
