# Designer Style System

Canonical note for how figure "styles" are encoded in this project.

## Contract

- Figure style is selected through `meta.theme` in the figure spec.
- Treat `meta.theme` as the style switch for:
  - typography
  - palette / accent family
  - card treatment
  - connector treatment
  - overall deck grammar
- Keep slide meaning, body copy, and layout logic in the rest of the spec.

## Locked style

- Current locked Designer deck style:
  - `designer-v1`
- Current deck default for `deckId = "vox-pd-v1"`:
  - `designer-v1`

`designer-v1` is the promoted style from the slide-6 style exploration:

- Montserrat for display and body
- refined PD-template page grammar
- green focal accent derived from the earlier Vox direction

## Theme classes

- Stable deck styles:
  - use durable names like `designer-v1`
  - safe to reference from canonical specs and stamped slide assets
- Legacy / archival styles:
  - `vox`
  - `pd-template-1`
- Experiment styles:
  - keep explicit experiment-oriented ids
  - do not point canonical deck specs at them after promotion

## Workflow

1. Explore style changes in `projects/designer-health/experiments/`.
2. Promote the chosen result into a stable theme id under `scripts/figures/themes/`.
3. Update canonical specs to the stable theme id.
4. Re-export stamped slide artifacts.
5. Keep the experiment variants for comparison history.

## Practical rule

If the change is "what visual family should this slide use?", change
`meta.theme`.

If the change is "what should this slide say or show?", change the rest of the
spec.
