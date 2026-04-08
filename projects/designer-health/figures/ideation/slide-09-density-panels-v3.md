# Slide 9 Ideation

- `slug`: `slide-09-density-panels-v3`
- `slide`: `9`
- `deck`: `designer-health`
- `status`: `draft-set`

## Inputs

- packet path:
  - [slide-09-care-journey-gap.md](../../slide-packets/slide-09-care-journey-gap.md)
- brief path:
  - [slide-09-density-panels-v3.md](../briefs/slide-09-density-panels-v3.md)
- composition path:
  - [slide-09-density-panels-v3.md](../compositions/slide-09-density-panels-v3.md)
- locked left asset:
  - `graphic-000051`
  - `asset-000018`
- locked right asset:
  - `graphic-000062`
  - `asset-000019`

## Codex read on the figure problem

- the current official strip winner is too diagrammatic for the new brief
- the revised slide should not explain the workflow; it should show market
  density through image-led comparison
- the slide succeeds when the audience reads:
  - AI adoption is already real after the visit
  - the live encounter is still comparatively open
- the extra layer should be chips, not more prose

## Wrapper note

- `figures:ideate` was attempted first against the new brief
- the provider-backed wrapper failed on strict JSON parsing from Claude
- instead of blocking the pass there, the run moved directly to multi-provider
  HTML generation using the locked left and right images
- provider image generation was not used as the lead exploration surface once
  the exact image pair was locked, because the user constraint is to show those
  graphics full-frame and uncropped rather than reinterpret them

## Direct draft set reviewed

- OpenAI HTML:
  - `openai-html-balanced`
  - `openai-html-open-right`
- Gemini HTML:
  - `gemini-html-balanced`
  - `gemini-html-open-right`
- Anthropic HTML:
  - `anthropic-html-balanced`
  - `anthropic-html-open-right`

## What the models taught us

### OpenAI

- strongest branch:
  - `openai-html-open-right`
- why:
  - keeps the two cards equal
  - gives the right card visibly more whitespace
  - keeps the sparse right field from feeling over-labeled
- secondary branch:
  - `openai-html-balanced`
- issue:
  - the faint right-side outline chip starts to read like extra commentary

### Gemini

- strongest branch:
  - `gemini-html-balanced`
- why:
  - very clean card framing
  - restrained chrome
  - good left/right density contrast
- secondary branch:
  - `gemini-html-open-right`
- issue:
  - Gemini tends to label the faint right-side outline chip too explicitly
    (`untapped space`, `legacy tools`) which over-explains the point

### Anthropic

- useful output:
  - good evidence that the prompt can collapse if card pairing is not specified
    tightly enough
- actual result:
  - one branch rendered blank
  - the other collapsed into a single oversized card
- judgment:
  - keep Claude as a critique branch for later passes, not as the lead render
    lane for this family

## Recommendation

Lead with:

- `openai-html-open-right`

Keep as challenge branches:

- `gemini-html-balanced`
- `openai-html-balanced`

Do not advance without repair:

- `anthropic-html-balanced`
- `anthropic-html-open-right`

## Lock note

- all ranked branches were rechecked after swapping image treatment from
  `cover` to `contain`
- the approved reading is now based on full-frame image placement with no crop,
  no clip, and no zoom-in reframing of the selected graphics
