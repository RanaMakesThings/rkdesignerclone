# Slide 9 Render Brief

- `slug`: `slide-09-density-panels-asymmetric-v1`
- `slide`: `9`
- `deck`: `designer-health`
- `status`: `ready-for-provider-compare`

## Inputs

- slide packet path:
  - [slide-09-care-journey-gap.md](../../slide-packets/slide-09-care-journey-gap.md)
- brief path:
  - [slide-09-density-panels-v4.md](../briefs/slide-09-density-panels-v4.md)
- composition path:
  - [slide-09-density-panels-v4.md](../compositions/slide-09-density-panels-v4.md)

## Compare set

- primary lane:
  - Gemini image
  - Gemini HTML
- challenge lanes:
  - OpenAI image
  - OpenAI HTML
  - Anthropic Opus HTML

## Shared rules

- use the two locked source images as the required left and right scene inputs
- preserve the source-image framing as much as the lane allows
- keep the headline unchanged
- make the right panel slightly larger and more important
- make both images taller and more dominant
- shorten and strengthen the support lines
- add the tiny density labels:
  - `More crowded`
  - `Still thin`
- make the right field deliberately thin, not unfinished

## Acceptance test

- every lane lands as its own real slide version
- every lane is previewable in Design Studio
- the new round feels sharper and more asymmetric than the prior compare set
