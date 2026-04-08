# Slide 08 Signal Report Ideation

This packet is a user-directed multi-model ideation pass for Designer slide 8:
`The clinician starts from a structured brief.`

Why this exists:

- the first pass was too thin and over-synthesized the user's brief
- this pass uses the user's original request nearly verbatim
- the models are also grounded in the approved reference component, the cough
  example state, and the deck-safe slide-8 constraints
- raw prompt and raw responses are saved so the user can inspect each model
  directly instead of relying on paraphrase

Files:

- `shared-prompt.md`
- `compare.html`
- `anthropic-opus-4-6/response.txt`
- `gemini-3.1-pro-preview/response.txt`
- `gpt-5.4-high/response.txt`
- `gpt-5.4-high/response.incomplete-high.json`

Grounding used:

- official deck context from
  `projects/designer-health/deck-spec.json`
- legacy slide-8 spec from
  `projects/designer-health/figures/specs/slide-08-artifact-callouts.json`
- reference component from
  `/Users/kabeer/Documents/code/designer-lab/apps/app/app/(authenticated)/components/llm-sandbox/vox-replay-panel.tsx`
- cough example state from
  `/Users/kabeer/Documents/code/designer-lab/packages/turnstate-examples/data/examples/cough/snapshots/T04.json`
- diagnosis labels from
  `/Users/kabeer/Documents/code/designer-lab/packages/turnstate-examples/data/examples/cough/support/diagnoses.json`

Note:

- the exact chat attachment image was not available as a local file path from
  this environment, so the models were grounded in the approved source
  component and the actual case data instead
- Anthropic and Gemini returned clean text responses.
- GPT-5.4 high reasoning also produced a completed answer, but the first local
  text extraction missed it.
- the preserved file `gpt-5.4-high/response.incomplete-high.json` contains that
  original high-reasoning payload, and `gpt-5.4-high/response.txt` now holds
  the recovered readable text extracted from it
