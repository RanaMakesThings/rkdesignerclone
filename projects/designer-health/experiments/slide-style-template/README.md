# Slide Style Exploration Handoff

Use this as the starting point for a new chat or worktree focused on deck style
exploration rather than slide-strategy changes.

## Goal

Explore alternate visual styles for the Designer deck using current slide 6 as a
template anchor.

This exploration is about:

- typography
- display / body font pairing
- connector treatment
- card treatment
- palette feel
- deck-family polish

This exploration is not about changing the slide thesis or workflow logic.

## Recommended starting point

Start from the current promoted slide-6 native winner:

- canonical spec:
  - `projects/designer-health/figures/specs/slide-06-workflow-strip-v3.json`
- stamped assets:
  - `projects/designer-health/slide-figures/slide-06/figure.html`
  - `projects/designer-health/slide-figures/slide-06/figure.svg`
  - `projects/designer-health/slide-figures/slide-06/figure.png`
- current full report:
  - `projects/designer-health/slide-reports/slide-06.html`

Use slide 6 because:

- the figure family is now stable
- the content is concrete enough to test typography and hierarchy well
- the open questions are polish-level, not structural

## Current state to remember

- slide 6 is promoted at `v3`
- the structural bug from `v2` was the floating handoff brief
- do not reintroduce a fifth object between `Structure` and `Verify`
- the current remaining issues are polish only:
  - connector visibility
  - trust-tag integration
  - slight balance on `Verify`

## What to vary

- display font vs body font pairing
- whether the deck should keep `Space Grotesk + Manrope` or move elsewhere
- title scale / subtitle tone
- stage-card border / fill / shadow restraint
- connector contrast and geometry
- treatment of trust tags:
  integrate, soften, or remove
- overall deck family feel:
  more editorial, more clinical, or more premium-minimal

## What not to vary

- slide meaning
- header / subheader copy
- four-step sequence:
  `Invite → Interview → Structure → Verify`
- `Structure` as the visual star
- no fake UI
- no floating handoff brief
- no second rail

## Suggested experiment workflow

1. fork a new worktree from the current repo state
2. duplicate slide-6 `v3` into a style-experiment variant
3. keep content fixed and vary only style decisions
4. make 2 to 4 materially different directions, not tiny near-duplicates
5. stamp each variant into its own experiment folder
6. compare them side by side before deciding whether to update the main family

## Good variant directions to try

- Direction A:
  premium editorial
  stronger display typography, slightly more contrast, cleaner tags
- Direction B:
  clinical minimal
  quieter display, stronger grid discipline, near-zero decorative softness
- Direction C:
  systems-clean
  sharper connectors, tighter card rhythm, more explicit flow energy without
  becoming enterprise UI
- Direction D:
  deck-brand typography test
  same layout, but multiple font pairings only

## Deliverables

Aim to produce:

- one short note on the style hypothesis for each variant
- one stamped PNG / SVG / HTML for each variant
- one recommendation on whether any direction should replace the current
  slide-6 family baseline

## Decision rule

Do not promote a style variant just because it looks cooler.

Promote only if it improves at least one of these without hurting the others:

- 3-second readability
- deck-family consistency
- premium feel
- clarity of the `Structure → Verify` handoff

## Note for the next chat

The unresolved typography question is still open.

`Montserrat` was never actually locked into the project. The current native
slide system is using `Space Grotesk` for display and `Manrope` for body on the
promoted slide-6 artifact.
