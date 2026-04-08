# Slide 4/5

Historical branch folder for the shelved merged history-bridge concept.

## Current state

- this is no longer an active slide target
- keep this folder as historical/reference context only
- current branch set now includes:
  - `gemini-image/`
  - `gemini-html/`
  - `openai-html/`
  - `anthropic-html-sonnet/`
  - `anthropic-html-opus/`
- archived / non-primary branches now include:
  - `openai-image/`
  - `anthropic-html/`
  - `anthropic-html-v2/`
  - `anthropic-html-v3/`

## Comparison summary

- strongest composition / taste branch:
  `slide-figures/slide-04-05/gemini-image/image-01.jpg`
- strongest editable machine-generated branch:
  `slide-figures/slide-04-05/openai-html/generated.html`
- strongest machine-generated lower explanatory beat:
  `slide-figures/slide-04-05/gemini-html/generated.html`
- cleanest Anthropic branch:
  `slide-figures/slide-04-05/anthropic-html-sonnet/generated.html`
- bolder secondary Anthropic branch:
  `slide-figures/slide-04-05/anthropic-html-opus/generated.html`

## Gemini image assessment

- artifact:
  `slide-figures/slide-04-05/gemini-image/image-01.jpg`
- source prompt:
  `prompts/slide-04-history-bridge-gemini.txt`
- reference image used:
  `slide-figures/slide-03/figure.png`
- what worked:
  - quoted the slide-3 source bar convincingly
  - preserved the two-beat composition
  - hero feels more band-like than older attempts
  - support block placement is close to the intended merged concept
- what failed:
  - lower explanatory panel degenerates into unusable image-model text
  - useful as composition reference, not as a final slide asset

## Gemini HTML assessment

- artifact:
  `slide-figures/slide-04-05/gemini-html/generated.html`
- preview:
  `slide-figures/slide-04-05/gemini-html/preview.png`
- source prompt:
  `prompts/slide-04-history-bridge-gemini.txt`
- reference image used:
  `slide-figures/slide-03/figure.png`
- what worked:
  - preserved the quoted slide-3 source bar and the two-beat structure
  - produced a genuinely editable HTML branch
  - lower explanatory beat is clearer than the Gemini image pass
- what failed:
  - overall styling is flatter than the stronger image branch
  - lower panel is still generic rather than premium

## OpenAI HTML assessment

- artifact:
  `slide-figures/slide-04-05/openai-html/generated.html`
- preview:
  `slide-figures/slide-04-05/openai-html/preview.png`
- source prompt:
  `prompts/slide-04-history-bridge-gemini.txt`
- reference image used:
  `slide-figures/slide-03/figure.png`
- what worked:
  - strong copy fidelity on the top and middle beat
  - editable HTML branch with a complete slide-level composition
  - cleaner hierarchy than Gemini HTML
- what failed:
  - lower explanatory panel is more placeholder-like than the Gemini HTML pass
  - overall feel is more schematic than the Gemini image branch

## OpenAI image assessment

- artifact:
  `slide-figures/slide-04-05/openai-image/image-01.png`
- source prompt:
  `prompts/slide-04-history-bridge-gemini.txt`
- reference image used:
  `slide-figures/slide-03/figure.png`
- what worked:
  - preserved the basic two-beat cascade
  - kept the quoted slide-3 bar and extracted hero relationship
- what failed:
  - typography and framing are less controlled than Gemini image
  - support-block text contains image-model corruption
  - weaker as a taste branch than Gemini image

## Anthropic HTML Sonnet assessment

- artifact:
  `slide-figures/slide-04-05/anthropic-html-sonnet/generated.html`
- preview:
  `slide-figures/slide-04-05/anthropic-html-sonnet/preview.png`
- source prompt:
  `prompts/slide-04-history-bridge-gemini.txt`
- reference image used:
  `slide-figures/slide-03/figure.png`
- what worked:
  - cleanest Anthropic branch so far
  - complete slide-level composition with good family continuity
  - lower explanatory panel is clearer and more structured than the earlier
    Anthropic runs
- what failed:
  - support block still feels a little too faint and underweighted
  - more restrained than OpenAI HTML, but also less decisive

## Anthropic HTML Opus assessment

- artifact:
  `slide-figures/slide-04-05/anthropic-html-opus/generated.html`
- preview:
  `slide-figures/slide-04-05/anthropic-html-opus/preview.png`
- source prompt:
  `prompts/slide-04-history-bridge-gemini.txt`
- reference image used:
  `slide-figures/slide-03/figure.png`
- what worked:
  - bold, readable top beat
  - support block is more obvious than the Sonnet branch
  - complete and usable HTML branch
- what failed:
  - lower explanatory panel is more generic than Sonnet and Gemini HTML
  - overall feel is less editorial and more template-like than the best branches

## Important workflow note

The first Anthropic HTML branches were not a fair model read. They were
truncated because the HTML command was still using the generic low token
default. The current valid Anthropic comparison branches are
`anthropic-html-sonnet/` and `anthropic-html-opus/`.

## Current verdict

Keep the branch roles split:

- use Gemini image as the strongest composition / taste reference
- use OpenAI HTML as the strongest editable machine-generated branch
- use Gemini HTML as a secondary editable reference, especially for the lower
  explanatory beat
- keep Anthropic Sonnet HTML as the cleanest Anthropic comparison branch
- keep Anthropic Opus HTML as a bolder secondary Anthropic comparison branch
- keep OpenAI image only as an archived low-value branch

Do not promote any of these directly as the selected winner. This folder now
serves only as historical context after the deck reopened separate active
slides `5` and `4`.

The active next moves now live elsewhere:

- slide `5` should inherit the sparse wedge/intervention logic from the top
  beat of this concept
- slide `4` should inherit the story-to-structure mechanism logic from the old
  standalone transformation-flow family
