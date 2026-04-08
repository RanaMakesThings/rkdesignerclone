# Slide 2 — Wait Times + Shortage Anchor

## Status

- current deck numbering: slide 2
- decision state: locked Gemini HTML chart-led winner selected; older native
  spec retained as historical coverage

## Why this packet exists

- replace the older two-proof-tile concept with a stronger three-part evidence
  read
- make the slide feel structural, not anecdotal
- preserve the sourced numbers and the intended composition in one canonical
  place

## Locked figure read

- left:
  benchmark wait-time trend across AMN survey years, ending at `31 days` in
  `2025`
- right:
  `2025` specialty breakout showing several categories already at `5` to `6`
  weeks
- bottom:
  full-width primary-care shortage banner built from HRSA designated shortage
  data, led by the `more than 1 in 4` ratio instead of the raw population count

## Current canonical asset

- locked current branch:
  `slide-figures/slide-02/gemini-html/generated.html`
- older native spec:
  `figures/specs/slide-02-wait-times-shortage-banner.json`

## Source frame

- wait-time trend and specialty breakout:
  `AMN Healthcare 2025 Survey of Physician Appointment Wait Times`
  `and Medicare and Medicaid Acceptance Rates`
- shortage designation:
  `HRSA primary care HPSA quarterly report as of December 31, 2025`
- population denominator for `more than 1 in 4`:
  `U.S. Census Bureau July 1, 2025 resident population estimate`

## Why this variant matters

- it shows the problem worsening over time instead of freezing the slide on one
  static wait-time number
- it keeps the numbers editorial and legible rather than turning the slide into
  a dashboard
- it grounds the access problem in a formal federal shortage designation rather
  than a softer inconvenience narrative

## Next use

- use `slide-figures/slide-02/gemini-html/generated.html` as the active
  fine-tune surface for contained slide-2 polish
- if slide 2 changes again structurally, branch from this packet and the locked
  HTML winner instead of reopening the older proof-tile family
