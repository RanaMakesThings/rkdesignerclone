# Designer Health Deck

Project root for the current Designer / VOX pitch-deck effort.

## Goal

Organize the deck inputs, define a working source of truth, and build each
slide figure through a repeatable loop:

`our native figure pass + Gemini image pass + Gemini HTML/SVG pass +`
`three-tool review + repair consultation when needed`

## Imported inputs

- `inputs/pitch_deck_figure_workflow_manual.md`
- `inputs/vox_deck_slide_specs_clean_pack.md`
- `inputs/vox-full-slide-map-copy.md`

These files were copied in from `Downloads` so the project is now anchored
inside the repo.

## Working contract

- Process source of truth:
  `inputs/pitch_deck_figure_workflow_manual.md`
- Visual / strategic source of truth:
  `inputs/vox_deck_slide_specs_clean_pack.md`
- Copy / citation source of truth:
  `inputs/vox-full-slide-map-copy.md`

When the slide-spec pack and full slide map disagree on visual direction,
prefer the clean pack unless we explicitly decide to revise it.

When the slide map includes stronger locked copy or citation language, fold
that into the slide packet for the relevant slide.

## Current deck note

The active public deck is now sequentially numbered `1` through `12`.

`deck-spec.json` is the canonical resolver for three different identities:

- public slide number:
  what users see and what Studio routes use
- repo slide id:
  the logical deck entry, for example `slide-09`
- stamped root:
  the on-disk artifact root, which may differ for legacy reasons

Important middle-deck mappings:

- public `4` -> repo `slide-05`
- public `5` -> repo `slide-06` -> stamped root `slide-06-quality-bar`
- public `6` -> repo `slide-07` -> stamped root `slide-06`
- public `8` -> repo `slide-09`

Old Slide 4 material and old Slide 5 material are both now treated as part of
the current public Slide 4 conversation. The shelved merged `4/5` concept
remains historical context only.

The HTML deck report is the best human-readable view of the current spec,
including active slides, deprecated slides, selected directions, and stamped
history.

## Locked deck template

The deck template is now explicitly locked.

- canonical template id:
  `designer-deck-template-v1`
- canonical repo theme id:
  `designer-v1`
- source board:
  `https://www.figma.com/board/v4gKaR3gn0lLpRb75CRIJq/PD-template-1?node-id=0-1&p=f&t=I1zXkgkEWkhVpJCg-0`

The shell we are carrying forward is:

- Montserrat for both display and body typography
- white full-slide canvas, no outer dark frame
- restrained black/gray editorial ink with green accent used sparingly
- thin branded footer rule plus small Designer footer lockup
- generous editorial margins and low-chrome composition

See `designer-deck-template.md` for the explicit contract.

The actual blank visual shell lives at:

- `templates/designer-deck-template-v1/template.html`
- `templates/designer-deck-template-v1/template.png`

The stamped slide layer under `slide-figures/` is manifest-backed. Each slide
directory keeps the current selected payload at the root, with historical
versions stored under `versions/version-*--<slug>/`. The slide manifest tracks
the selected version id, and `slide:versions` manages creation, promotion, and
migration.

## Operator modes

- Existing official slide polish:
  use `slide-fine-tuning.md`
- New first draft from the locked shell:
  use `slide-creation.md`
- Bigger resets or deeper process questions:
  use `workflow.md`

Fast first commands:

- `npm run slide:fine-tune:prep -- --slide 3`
- `npm run slide:create:prep -- --slide 12`

## Existing repo coverage

- strong existing work:
  - slide 2
  - slide 3
  - public slide 4 wedge/intervention winner plus legacy slide 4/4-5 history
  - public slide 6 workflow storyboard
  - public slide 7 structured brief figure
  - public slide 9 economics comparison set
- missing or not yet hardened:
  - slide 1
  - public slide 5 quality-bar follow-on polish
  - public slide 8 category positioning lock
  - public slide 10 beachhead lock
  - public slides 11 to 12

See `deck-matrix.md` and `assessment.md`.

## Next artifact layer

- `deck-matrix.md`
  - deck-wide role map and figure-status map
- `deck-spec.json`
  - canonical active / deprecated slide backbone and numbering policy
- `master-slide-specs.md`
  - human-readable companion to the canonical deck spec
- `workflow.md`
  - project-local source of truth for the actual figure-building process
- `figure-companion.md`
  - figure-family map, existing assets, and iteration plan
- `figures/`
  - project-local briefs, ideation, compositions, render briefs, and specs
- `slide-packets/`
  - one working packet per slide
- `prompts/`
  - reusable Gemini and native build prompts once the packet format is stable
- `slide-figures/`
  - stamped per-slide HTML / SVG / PNG exports for fast browsing
  - manifest-backed current versions plus version history bundles
- `slide-fine-tuning.md`
  - fresh-chat handoff for slide-by-slide official-slide polishing
- `slide-creation.md`
  - fresh-chat handoff for new first drafts from the locked shell
