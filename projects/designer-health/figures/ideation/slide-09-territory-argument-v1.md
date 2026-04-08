# Slide 9 Ideation

- `slug`: `slide-09-territory-argument-v1`
- `slide`: `9`
- `deck`: `designer-health`
- `status`: `provider-compare`

## Inputs

- packet path:
  - [slide-09-care-journey-gap.md](../../slide-packets/slide-09-care-journey-gap.md)
- brief path:
  - [slide-09-territory-argument-v1.md](../briefs/slide-09-territory-argument-v1.md)
- composition path:
  - [slide-09-territory-argument-v1.md](../compositions/slide-09-territory-argument-v1.md)
- render brief path:
  - [slide-09-territory-argument-v1.md](../render-briefs/slide-09-territory-argument-v1.md)

## Codex read on the concept

- this is a real concept shift, not a micro-pass on the density-panels family
- the slide now tries to read as:
  headline, then two market claims, then images as evidence
- replacing chip rows with tiny density markers is the key conceptual change

## Locked inputs for this round

- left:
  `/Users/kabeer/Desktop/4FAA88B9-3C54-4321-B182-C8DB4ED0A963.png`
- right:
  `/Users/kabeer/Desktop/757B1C3E-6121-4432-8524-C7BDE4EE6722.png`
- note:
  these were user-supplied desktop files and do not hash-match the earlier repo
  copies, so this round treats them as the exact locked sources

## Materialized compare set

- `version-000141`
  `territory-argument-gemini-image`
- `version-000142`
  `territory-argument-openai-image`
- `version-000143`
  `territory-argument-anthropic-opus-html`
- `version-000144`
  `territory-argument-openai-html`
- `version-000145`
  `territory-argument-gemini-html`

## What the models taught us

### OpenAI image

- strongest overall concept expression
- strengths:
  - best claim-first hierarchy
  - images feel subordinate but still credible
  - density markers read clearly without turning back into chip rows
- main weakness:
  - still slightly too clean and polite for a fully decisive market slide

### OpenAI HTML

- strongest editable structure
- strengths:
  - clearly reads as headline plus two claims
  - images are appropriately demoted into evidence
  - the page avoids the heavy-card feel from the prior rounds
- main weakness:
  - the density markers can feel too abstract or too far from the captions

### Gemini HTML

- useful secondary HTML idea branch
- strengths:
  - preserves the claim-first hierarchy
  - keeps the slide light and clean
- main weakness:
  - the evidence images and density markers become almost too small, so the
    slide can feel airy rather than strong

### Gemini image

- useful taste probe only
- strengths:
  - broadly respects the claim-first concept
- main weakness:
  - drifts back toward a more ordinary split-panel layout

### Anthropic Opus HTML

- usable after resizing inputs to meet the 5 MB API limit
- strengths:
  - restrained editorial layout
  - decent claim-first structure
- main weakness:
  - typography and contrast get too soft, so the slide loses force

## Recommendation

- current concept lead:
  `version-000142`
  `territory-argument-openai-image`
- strongest editable challenger:
  `version-000144`
  `territory-argument-openai-html`
- useful secondary reference:
  `version-000145`
  `territory-argument-gemini-html`

## Judgment

- this concept is stronger than the recent density-panels rounds
- it improves the slide because it finally makes the words lead and the images
  support
- the remaining problem is not concept search anymore; it is turning the
  strongest territory-argument branch into a sharper final composition
