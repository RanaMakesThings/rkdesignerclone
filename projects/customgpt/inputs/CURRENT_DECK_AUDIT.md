# Current Deck Audit

Audit of Connor's original slide deck:
`references/source-deck/connor-original-deck.pptx`

## High-level read

The current deck has strong intent and useful content, but it is overbuilt for
the workshop job it needs to do now.

The main problem is sequencing:

- the talk spends too long in theory before the audience really understands the
  product object
- the GPT builder and test workflow arrive too late
- several best-practice slides repeat ideas that should be consolidated

## Structural findings

- total slides:
  `51`
- useful front matter:
  title, speakers, disclosure, problem framing
- overlong conceptual block:
  slides `9` to `18`
- build walkthrough starts meaningfully around:
  slide `19`
- repeated best-practice block:
  slides `40` to `46`

## Specific issues

### 1. Theory arrives before product understanding

The audience reaches transformer and RAG explanation slides before they have a
sharp mental model of:

- what this tool is
- what kinds of answers it gives
- what "good" versus "bad" looks like

### 2. The current theory level is mismatched to the audience

For a mixed audience of chiefs, program leaders, and faculty, long GPT or RAG
theory is more likely to create drift than confidence.

The workshop likely needs:

- one plain-language `why it works` slide
- one `what good looks like` slide

not a mini-lecture on model architecture.

### 3. The build steps are too fragmented

The step sequence exists, but it is broken across many slides and screenshot
moments without a clear `watch for these things` frame.

### 4. The best-practice section is duplicated

The best-practice content is good, but the current sequence expands it into too
many slides with too little visual payoff.

### 5. The talk still reflects older product assumptions

The original deck assumes an older ChatGPT product surface and older model
framing. The rebuild should avoid model-version dependence and instead teach:

- where GPTs live now
- how to configure one
- how to select capabilities
- how to test it safely

## Keep

- the core residency-admin pain point
- the idea of a grounded policy assistant
- document prep guidance
- testing guidance
- governance and maintenance

## Compress

- GPT / transformer theory
- dense RAG exposition
- repeated best-practice slides

## Expand or move earlier

- what the assistant actually is
- what a good answer looks like
- live testing and refusal behavior
- current ChatGPT builder flow
