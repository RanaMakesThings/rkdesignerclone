# Deck Matrix

Human-readable status companion to `deck-spec.json`.

Use `deck-spec.json` for the canonical current backbone. Use this file for a
quick per-slide execution map.

## Current note

- active sequence:
  `1, 2/3, 4, ...`
- deprecated:
  `2, 3, ...`
- merge rule:
  current slide `2/3` absorbs the old standalone slides `2` and `3`

## Narrative spine

- NARRATIVE STATEMENT 1
- NARRATIVE STATEMENT 2
- NARRATIVE STATEMENT 3

## Visual sibling groups

- Slides 1 to 3:
  FAMILY NOTE
- Slides 4 to 6:
  FAMILY NOTE

## Active Slide Inventory

### Slide 1 — TITLE

- role: ROLE
- figure importance: <optional / helpful / essential>
- family: FAMILY
- current status: STATUS
- next artifact: NEXT ARTIFACT

### Slide 2/3 — MERGED TITLE

- role: ROLE
- figure importance: essential
- family: FAMILY
- current status: STATUS
- next artifact: NEXT ARTIFACT

## Deprecated Slide Inventory

### Slide 2 — OLD TITLE

- status: deprecated
- former role: OLD ROLE
- disposition: merged into current slide `2/3`
- note: keep only for history and rationale tracking
