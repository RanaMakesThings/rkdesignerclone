# Assessment

## Source roles

- workflow manual:
  `inputs/pitch_deck_figure_workflow_manual.md`
  remains the process source of truth
- clean spec pack:
  `inputs/vox_deck_slide_specs_clean_pack.md`
  remains the primary visual-strategy source
- full slide map:
  `inputs/vox-full-slide-map-copy.md`
  remains the copy/evidence companion

## Numbering / ownership decision

The public deck is now sequentially numbered `1` through `12`.

After the Slide 4/5 merge:

- public Slide 4 resolves to repo `slide-05`
- old Slide 4 mechanism history and old Slide 5 wedge history both belong to
  that public Slide 4 conversation
- public Slide 5 resolves to repo `slide-06`
- public Slide 6 resolves to repo `slide-07`, but its stamped root still lives
  under legacy `slide-06`

The old merged bridge packet at
`slide-packets/slide-04-history-bridge.md` remains historical context only.

## Strong current coverage

- Slide 2: chart-led proof anchor
- Slide 3: throughput / visit-efficiency anchor
- Slide 4: wedge/intervention winner plus legacy absorbed history
- Slide 5: clinician-grade quality-bar winner
- Slide 6: workflow storyboard
- Slide 7: structured brief figure
- Slide 8: category-positioning strip plus compare history
- Slide 9: economics comparison bank
- Slide 10: beachhead/profile comparison bank

## Missing or underdeveloped areas

- Slide 1: final cover lock
- Slide 11: team credibility
- Slide 12: milestone / raise close

## Practical recommendation

Keep path names stable and let `deck-spec.json` resolve public numbering.
Wherever a surface is user-facing, show:

1. public slide number first
2. repo slide id second
3. stamped root only when it differs
