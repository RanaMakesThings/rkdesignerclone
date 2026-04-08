# Slide 5

Current stamped assets for the reopened wedge / intervention slide.

## Current state

- locked current winner is `version-000024`
- older canonical native `v1` still exists as a historical option
- this slide now sits immediately after slide `3`
- keep the visual job sparse:
  quote the slide-3 wedge, peel it out, and attach the grouped reasons
- Gemini comparison lanes still exist inside historical versions

## Source of truth

- slide packet:
  `slide-packets/slide-05-history-wedge.md`
- locked current branch:
  `slide-figures/slide-05/versions/version-000024--slide-05-20260329t214800z-attempt-01/generated.html`
- older native spec:
  `figures/specs/slide-05-history-wedge-v1.json`

## Current best references

- slide-3 stamped anchor:
  `../slide-03/slide-03--version-000050.png`
- shelved merged 4/5 Gemini image:
  `../slide-04-05/gemini-image/image-01.jpg`
- locked current asset:
  - `../slide-figures/slide-05/versions/version-000024--slide-05-20260329t214800z-attempt-01/generated.html`
  - `../slide-figures/slide-05/versions/version-000024--slide-05-20260329t214800z-attempt-01/preview.png`
- historical native asset:
  - `slide-05--version-000024.png`
  - `slide-05--version-000024.html`
- slide report:
  - `slide-reports/slide-05.html`

## Working rule

- do not let mechanism detail leak onto this slide
- the goal here is simply:
  `this is the wedge to pull`
- connector preference:
  one simple arced arrow, not a squiggly or decorative connector

## Current read

- the locked current winner is `version-000024`, the Gemini HTML top-beat
  branch derived from the shelved merged reference, with the lower explanatory
  beat removed
- current strengths:
  - simpler standalone composition
  - visible arrowhead with one clean broad arc
  - lower figure cluster that fills the page better without the bottom panel
- the older native `v1` remains useful historical reference, but it is no
  longer the selected slide-5 direction

## Theme note

- the repo's Montserrat-backed theme is `pd-template-1`
- the first attempt to apply that theme through `gemini:html:tune` was
  correctly stopped for human review because Gemini collapsed the structure
- current working state uses the good original structure plus a direct
  Montserrat/theme-style patch on top of the dedicated slide-5 Gemini HTML
