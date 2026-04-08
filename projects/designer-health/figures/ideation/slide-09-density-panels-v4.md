# Slide 9 Ideation

- `slug`: `slide-09-density-panels-v4`
- `slide`: `9`
- `deck`: `designer-health`
- `status`: `provider-compare`

## Inputs

- packet path:
  - [slide-09-care-journey-gap.md](../../slide-packets/slide-09-care-journey-gap.md)
- brief path:
  - [slide-09-density-panels-v4.md](../briefs/slide-09-density-panels-v4.md)
- composition path:
  - [slide-09-density-panels-v4.md](../compositions/slide-09-density-panels-v4.md)
- render brief path:
  - [slide-09-density-panels-asymmetric-v1.md](../render-briefs/slide-09-density-panels-asymmetric-v1.md)

## Codex read on the change request

- the concept was already right
- the weakness was compositional:
  too even, too polite, too much like balanced product cards
- the next round needed sharper asymmetry, taller images, stronger support
  lines, and chip fields that read as argument instead of decoration

## Materialized compare set

- `version-000136`
  `density-panels-asymmetric-gemini-image`
- `version-000137`
  `density-panels-asymmetric-gemini-html`
- `version-000138`
  `density-panels-asymmetric-openai-image`
- `version-000139`
  `density-panels-asymmetric-openai-html`
- `version-000140`
  `density-panels-asymmetric-anthropic-opus-html`

## What the models taught us

### OpenAI HTML

- current strongest structural lane
- strengths:
  - strongest copy fidelity
  - best support-line prominence
  - clearest explicit `More crowded` / `Still thin` argument
  - right-side thin field feels intentional
- remaining weakness:
  - the card pair is still more balanced than the brief ideally wants

### Gemini HTML

- strongest asymmetry push in HTML
- strengths:
  - the right panel feels more spacious
  - the images occupy more of the card bodies
  - overall energy is less polite than the prior round
- remaining weakness:
  - the card chrome and spacing get looser, so it feels less premium than the
    OpenAI HTML lane

### Anthropic Opus HTML

- usable challenge lane, no longer broken
- strengths:
  - clean restrained card framing
  - deliberate sparse right chip field
- remaining weakness:
  - support lines stay visually quieter than the brief wants
  - overall hierarchy remains gentler than the OpenAI and Gemini passes

### OpenAI image

- strongest pure taste/image lane
- strengths:
  - cleanest overall image-lane polish
  - labels and chip logic are mostly preserved
- remaining weakness:
  - the right panel still does not claim enough extra importance

### Gemini image

- useful only as a taste challenge branch
- strengths:
  - pushes the crowded-vs-thin contrast hard
- remaining weakness:
  - copy and chip fidelity drift too far to treat it as a serious candidate

## Recommendation

- current lead:
  `version-000139`
  `density-panels-asymmetric-openai-html`
- strongest challenger:
  `version-000138`
  `density-panels-asymmetric-openai-image`
- useful secondary reference:
  `version-000137`
  `density-panels-asymmetric-gemini-html`

## Lock note

- all HTML lanes continue to use full-frame `contain`-style image treatment
- the two locked graphics remain the required left/right anchors for this
  family
