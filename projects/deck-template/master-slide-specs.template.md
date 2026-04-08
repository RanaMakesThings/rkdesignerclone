# DECK TITLE — Master Slide Specs

Human-readable companion to `deck-spec.json`.

Use this file for quick deck reading and copy review. Use `deck-spec.json` as
the canonical current deck backbone for active versus deprecated status,
numbering policy, and report rendering.

## Working precedence

- current active / deprecated backbone:
  `deck-spec.json`
- visual direction defaults to:
  `inputs/VISUAL_SOURCE_DOC.md`
- header / subheader / citation language defaults to:
  `inputs/COPY_SOURCE_DOC.md`
- process and artifact structure default to:
  `workflow.md`

## Current note

- active sequence:
  `1, 2/3, 4, ...`
- deprecated:
  `2, 3, ...`
- merge rule:
  active slide `2/3` absorbs the old standalone slides `2` and `3`

## Deck spine

1. NARRATIVE STATEMENT 1
2. NARRATIVE STATEMENT 2
3. NARRATIVE STATEMENT 3

## Active Slide Specs

## Slide 1 — TITLE

- Purpose: PURPOSE
- Header: `HEADER`
- Subheader: `SUBHEADER`
- Takeaway: TAKEAWAY
- Figure role: FIGURE ROLE
- Proof / citation: NEEDED OR NONE

## Slide 2/3 — MERGED TITLE

- Purpose: PURPOSE
- Header: `HEADER`
- Subheader: `SUBHEADER OR NONE`
- Takeaway: TAKEAWAY
- Figure role:
  - CLAIM 1
  - CLAIM 2
- Proof / citation: none needed

## Deprecated Slides

## Slide 2 — OLD TITLE

- Status: deprecated after merge into slide `2/3`
- Former purpose: OLD PURPOSE
- Former header: `OLD HEADER`
- Disposition:
  the logic now lives inside current slide `2/3`
