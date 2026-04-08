# Round 2 Operator Synthesis

This note summarizes where the second-round detailed specs agree and where they
diverge.

## Shared ground

All three model lanes agree on the important part:

- the screenshot already has the right raw ingredients
- the artifact should still feel like one central clinician-facing brief
- the left side should keep row-level extracted facts
- evidence pointers should remain visible
- the right side should preserve `Supports`, `Against`, and `Unknowns`
- the raw trace / debug-console vibe should be removed
- the deck artifact should feel calmer and more document-like than the source
  component

They also agree on density guardrails:

- 8 to 12 left-side rows is enough
- 3 candidate blocks on the right is enough
- 1 next-question / clarification block is enough

## Where they disagree

### 1. Overall frame

`Anthropic`

- collapses the screenshot into a full vertical document
- top-to-bottom reading order
- reasoning lives in the lower band, not as a side rail

`Gemini`

- keeps the two-column architecture
- one shared frame, but still clearly left reality / right synthesis
- 40 / 60 split

`GPT`

- keeps a dominant left column plus restrained right rail
- insists on a full-width bottom timeline strip
- effectively a hybrid between Anthropic and Gemini

### 2. Movement chips

`Anthropic`

- keep movement concept, but rewrite it into something cleaner than `SAME 1→1`

`Gemini`

- delete movement chips entirely

`GPT`

- keep movement, but simplify it to compact notation like `— 1→1` / `↑ 2→1`

### 3. State pills on the left

`Anthropic`

- keep pills
- differentiate `present` and `absent`
- keep overall palette mostly monochrome and low-saturation

`Gemini`

- semantic pills:
  - present = soft blue
  - absent = soft red
- no icon inside the pill

`GPT`

- more editorial / document-like:
  - present = strongest neutral pill
  - absent = lighter gray pill
  - unresolved = warm gray / pale amber pill
- explicitly says not to use green for `present`

### 4. Reasoning glyphs on the right

`Anthropic`

- wants the `Supports / Against / Unknowns` structure
- likely more restrained than explicit iconography
- emphasis is on shortening copy and reducing noise

`Gemini`

- clearest glyph system:
  - `↑` muted green for supports
  - `↓` muted red for against
  - `○` or `?` amber for unknowns
- only on the right side, not the left

`GPT`

- also supports restrained right-side glyphs
- explicitly says not to bring arrows into left-side fact rows
- prefers left side to read like charted facts, not argumentation

## My read on the strongest hybrid

If we build one HTML comp next, the strongest hybrid is:

- overall frame from `GPT`
  - one shared white sheet
  - dominant left brief
  - narrower right reasoning rail
  - full-width bottom timeline strip

- left-side row treatment from `Anthropic`
  - keep evidence visible
  - soften bordered boxes into a ledger/list feel
  - preserve categorical groups

- right-side glyph language from `Gemini`
  - small typographic `↑ / ↓ / ○`
  - muted emerald / rose / amber
  - no heavy SVG icons

- state-pill semantics from `GPT`
  - `present` = strongest neutral
  - `absent` = quieter gray
  - `unresolved` = warm gray / pale amber

- movement-chip decision:
  - probably drop them for the deck comp
  - if we keep them, use the simplified GPT form, not `SAME 1→1`

## Practical takeaway

The design question is no longer "what should this artifact be?"

That is basically settled.

The remaining choices are:

1. document-first vertical sheet vs hybrid left/right sheet
2. whether movement chips belong at all
3. whether left-side pills are monochrome/editorial or slightly semantic
4. exactly how much arrow language the right rail can handle before it starts
   looking like a trading terminal

If we want the cleanest next move, we should build:

- one HTML comp using the GPT frame
- one optional variant with the slightly stronger Gemini color semantics
