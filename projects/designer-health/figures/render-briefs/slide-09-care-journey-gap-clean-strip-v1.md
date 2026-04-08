# Slide 9 Render Brief

- `slug`: `slide-09-care-journey-gap-clean-strip-v1`
- `slide`: `9`
- `deck`: `designer-health`
- `status`: `draft-request`

## Inputs

- slide packet path:
  - [slide-09-care-journey-gap.md](../../slide-packets/slide-09-care-journey-gap.md)
- brief path:
  - [slide-09-care-journey-gap-v1.md](../briefs/slide-09-care-journey-gap-v1.md)
- ideation path:
  - [slide-09-care-journey-gap-v1.md](../ideation/slide-09-care-journey-gap-v1.md)
- composition path:
  - [slide-09-care-journey-gap-v1.md](../compositions/slide-09-care-journey-gap-v1.md)

Generate a self-contained HTML document for one premium 16:9 investor pitch
deck slide. Use inline CSS only. Do not use external scripts. If you use SVG,
keep it inline inside the HTML.

Use this exact copy:

Header:
The visit still starts from zero.

Subheader:
Clinicians have shown they will adopt assistive tools. The open problem is
starting the visit with better structure.

Main figure:
Build one centered horizontal care-journey strip across the middle of the slide
with three clear zones:
Before visit
Start of visit
During / after

Design constraints:

- white background
- grayscale base
- one restrained blue accent
- clean sans typography
- rounded geometry
- no fake software UI
- no giant arrows
- no competitor matrix
- no anti-scribe framing
- no dense captions

Zone intent:

- Before visit: lightly supported workflow cues such as reminders and
  scheduling
- Start of visit: visibly unresolved zone with a structured-starting-point gap
- During / after: lightly supported workflow cues such as documentation support
  and note generation

Important:

- the middle `Start of visit` zone must be the visual hero
- outer zones should be quietly filled and credible
- use only a few small support pills in the outer zones
- in the middle zone, imply these cues in restrained microcopy:
  structured starting point, pre-decision signal, recovered decision time
- the result should feel like a calm editorial deck figure, not a product mock

Return HTML only.
