# Slide 2 Exploration Review

## Goal

Pressure-test the current native slide-2 anchor with explicit Gemini challenge
branches instead of continuing small polish-only moves.

## Inputs

- official native anchor:
  `figure.png`
- Claude critique:
  `anthropic-review-panorama/response.txt`
- Gemini panorama prompts:
  `../../prompts/slide-02-capacity-editorial-panorama-gemini-image-v1.txt`
  `../../prompts/slide-02-capacity-editorial-panorama-gemini-html-v1.txt`
- Gemini diptych prompts:
  `../../prompts/slide-02-capacity-diptych-gemini-image-v2.txt`
  `../../prompts/slide-02-capacity-diptych-gemini-html-v2.txt`
  `../../prompts/slide-02-capacity-diptych-gemini-html-v3.txt`

## Result

- `gemini-image/image-01.jpg`
  Useful as a control. It mostly replays the current native layout and drifts on
  some numeric labels, so it is not a promotion candidate.
- `gemini-html/preview.png`
  Cleaner than the image control and slightly calmer than the current native
  anchor, but still fundamentally the same chart-plus-breakout-plus-banner
  family.
- `gemini-image-diptych/image-01.jpg`
  The best conceptual provocation from this pass. It is too rough to use
  directly, but the two-column split makes the slide read faster by elevating
  `31 days` and `1 in 4+` to co-equal proof points.
- `gemini-html-diptych/preview.png`
  The first clean HTML expression of the diptych idea. It clarifies hierarchy
  substantially, but the left column is still a little too airy and the
  specialty proof remains underpowered.
- `gemini-html-diptych-v3/preview.png`
  The strongest generated branch from this pass. It keeps the editorial split,
  sharpens the typography, and makes the challenge-branch argument legible in a
  way the current native slide does not.

## Codex take

- Claude was right that the current slide still behaves like three adjacent
  widgets more than one composed argument.
- The most useful new idea is not a styling change; it is a hierarchy change.
- Claude's direct review of `gemini-html-diptych-v3/preview.png` called the
  candidate stronger than the current native slide because the diptych gives the
  slide a cleaner two-beat argument and lets `1 in 4+` operate as a real anchor.
- The next serious reset, if we choose to do it, should likely be a native
  spec-driven diptych that:
  - strips the left chart further
  - preserves the shortage ratio at headline scale
  - restores a bit more specialty breadth than the single-bar generated branch
  - promotes the sub-50%-need-met proof above body-text weight
  - keeps citations in a separate hairline footer

## Operational note

- Claude review artifacts for the current native and the strongest diptych
  candidate live in:
  - `anthropic-review-panorama/response.txt`
  - `anthropic-review-diptych-candidate/response.txt`
