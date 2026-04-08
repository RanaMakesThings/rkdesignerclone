# Slide 10 Ideation — Capacity Economics v1

## Brief read

Slide 10 is the economics bridge.

- slide `9` says the clinician still starts from zero
- slide `10` says fixing that gap has real economic consequence
- slide `11` then says where to start proving that in the market

So this slide should not feel like finance analysis for its own sake.
It should make the business consequence feel immediate and credible.

## Current family read

The current family is still right:

- one dominant base-case economics object
- quieter range-check detail
- quiet assumptions
- one interpretive bottom line

The legacy render proves the family, but not the execution.
It is too soft, too blank, and too much like a KPI card set.

## Table question

A table is not rejected.

But it should not be the primary object unless the hero/tile family fails.

Current judgment:

- full table: reject
- compact one-row sensitivity strip or mini table: valid fallback
- primary slide object: should still be a hero economics story, not a grid

Why:

- the slide needs to land as inevitability before it lands as analysis
- a full table makes the slide feel like a worksheet too early
- the investor should first remember the base case, then sanity-check the range

## Codex directions

### 1. Single Equation Card

- one oversized hero block
- make the economics feel causal, not just numerical
- something like:
  `+1 visit / provider / day`
  `x 220 clinic days`
  `x $125 / visit`
  `x 40% contribution margin`
  `= $11,000 / year`
- quiet break-even line below
- tiny scenario strip beneath or to the side

Why it works:

- the math is the story
- very easy to scan
- makes the hero feel inevitable, not decorative

Main risk:

- can drift toward "business school slide math" if the layout gets too linear

### 2. Hero Base Case + Mini Sensitivity Strip

- large left hero block anchored on:
  `+1 visit / provider / day`
  `$11,000 / year`
  `~$917 / month break-even spend / provider`
- instead of three large scenario tiles, use a compact low/base/high strip
- keep the strip visually subordinate

Why it works:

- preserves the original slide logic
- keeps range-checking without turning the slide into repetitive boxes

Main risk:

- if the strip is too subtle, it may not earn its place

### 3. Break-even First

- lead with the most buyer-relevant number:
  `~$917 / month break-even spend / provider`
- support with the annual contribution beneath it
- assumptions as a quiet chip row

Why it works:

- makes the slide more buyer/pricing relevant

Main risk:

- underplays the actual title logic of "real capacity"

## Model-backed ideation

The model-backed JSON ideation wrapper was attempted first, but the provider
responses were malformed. I repaired the parser to handle fenced JSON with
prose wrappers, then collected direct prose ideation from GPT-5.4, Claude
Sonnet 4.6, and Gemini 3.1 Pro.

### GPT-5.4 themes

Strongest directions:

- hero equation card
- base-case spotlight with mini sensitivity table
- capacity-to-cash staircase

GPT-5.4's final judgment:

- best overall: base-case spotlight with mini sensitivity table
- table idea: fallback

What is useful from that:

- GPT is pushing toward one dominant base case plus a very compressed range
  check
- it is more willing than Codex to keep a mini table if it stays clearly
  secondary

### Claude Sonnet 4.6 themes

Strongest directions:

- single equation card
- capacity clock
- provider economics card stack

Claude's final judgment:

- best overall: single equation card
- table idea: fallback

What is useful from that:

- Claude strongly reinforces that the math itself should be the visual object
- it also reinforces that any table should be reduced to a subordinate strip,
  not a primary slide structure

### Gemini 3.1 Pro themes

Strongest directions:

- value equation
- power-of-one hero card
- break-even threshold

Gemini's final judgment:

- best overall: value equation
- table idea: use only as a subordinate bottom strip

What is useful from that:

- Gemini agrees that the math/proof should be the hero
- it also reinforces that the range-check should be compressed and secondary
- it adds a useful pricing lens:
  the break-even number can be treated as a threshold/punchline, not just a
  support line

## Synthesis

The broad current deck-spec idea is correct, but the expression should tighten.

The best next-step interpretation is:

- keep one dominant hero economics object
- stop thinking in terms of three equally weighted scenario cards
- compress the range check into either:
  - a one-row sensitivity strip, or
  - very small conservative/base/upside chips
- keep assumptions visible but quiet
- keep the bottom line interpretive, not analytical
- make it unmistakable that one added visit can create this much annual value

In other words:

the slide should probably evolve from

- hero block + three medium scenario tiles

toward

- hero equation card + compressed range-check strip

## Recommendation

Lead concept for the next render/composition pass:

### Single Equation Hero with Quiet Range Check

- hero object dominates the slide
- math chain is visually integrated, not presented as a literal spreadsheet
- `$11,000 / year` remains the big anchor
- `~$917 / month break-even spend / provider` lands as the practical
  punchline
- conservative/base/upside live in a tiny subordinate strip, not in three
  competing cards
- if any table survives, it should be borderless and clearly secondary

This keeps the economics legible while making the slide feel more deck-right
than the current legacy card set.
