# Designer Health Deck — Figure Companion

Execution companion for the current Designer figures.

## Numbering contract

The active public deck is sequentially numbered `1` through `12`.

Three identities matter:

- public slide number:
  the user-facing deck position
- repo slide id:
  the canonical logical entry from `deck-spec.json`
- stamped root:
  the legacy on-disk artifact root when it differs

Important active mappings:

- public `4` -> repo `slide-05`
- public `5` -> repo `slide-06` -> stamped root `slide-06-quality-bar`
- public `6` -> repo `slide-07` -> stamped root `slide-06`
- public `7` -> repo `slide-08`
- public `8` -> repo `slide-09`

Old Slide 4 and old Slide 5 references now both belong to the current public
Slide 4 surface. Deprecated `slide-04` and `slide-04-05` remain archive-only.

## Iteration loop

For figure-heavy slides:

1. resolve the public slide through `deck-spec.json`
2. read the selected direction, packet, specs, and stamped root
3. work inside the official stamped history root unless the user is creating a
   brand-new slide
4. use Gemini/OpenAI/Anthropic branches as challenge lanes, not as competing
   sources of truth once a region is locked
5. promote only after review, then refresh the reports and notes that current
   Studio/tools consume

## Current family anchors

### Slide 4 — History wedge

- repo slide: `slide-05`
- stamped root: `slide-05`
- family: quoted slide-3 source bar + peeled-out history wedge + grouped reasons
- current read: sparse wedge/intervention argument with absorbed legacy Slide 4
  and Slide 5 history behind it

### Slide 5 — Quality bar

- repo slide: `slide-06`
- stamped root: `slide-06-quality-bar`
- family: clinician-grade success-state qualification card
- current read: exact user HTML snapshot is the official winner

### Slide 6 — Workflow / handoff

- repo slide: `slide-07`
- stamped root: `slide-06`
- family: four-beat workflow storyboard
- current read: image-led storyboard is the current selected direction

### Slide 7 — Structured brief

- repo slide: `slide-08`
- stamped root: `slide-08`
- family: artifact with zoom callouts
- current read: artifact-callouts native remains the stamped lead

### Slide 8 — Category positioning

- repo slide: `slide-09`
- stamped root: `slide-09`
- family: starting-point strip plus active compare rounds
- current read: official strip remains stamped; newer compare banks stay in the
  same history root

### Slide 9 — Economics

- repo slide: `slide-10`
- stamped root: `slide-10`
- family: hero economics block + scenario/range checks

### Slide 10 — Beachhead proof

- repo slide: `slide-11`
- stamped root: `slide-11`
- family: highlighted beachhead profile + proof scorecard

### Slides 11–12 — Team and close

- public Slide 11 -> repo `slide-12`
- public Slide 12 -> repo `slide-13`
- current read: still early / unstamped

## Missing or lightly defined targets

- Slide 1: final cover lockup
- Slide 11: team/founder credibility figure
- Slide 12: raise / milestone close
