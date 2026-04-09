# Reporting Contract

Use this as the quality bar for reports in a deck project.

## Slide report

Each mature slide pass should have a slide report that makes these things
obvious at the top:

- what happened in this pass
- what was made
- the current selected version id when the slide is manifest-backed
- what the three reviewers said
- what happens next

If the slide used micro-passes, the report should also show:

- the latest requested delta
- before/after previews for the latest micro-pass
- delta verdict
- regression verdict
- unique blocker findings, including one-off blockers caught by only one reviewer
- whether current HTML is stale relative to the last approved micro-pass

Each slide report should also link to:

- the slide packet
- the brief / ideation / composition / render brief when they exist
- the current stamped native output
- the slide manifest and current version bundle when they exist
- Gemini and Anthropic branches when they exist
- assessment synthesis
- repair synthesis when the loop reopened

## Deck report

The deck report should make these things obvious:

- the current active backbone
- deprecated slides
- the numbering policy
- the selected direction for each slide
- the current selected version for each slide when the slide is manifest-backed
- the notable alternate options for each slide
- stamped previews wherever they exist

## Options gallery rule

If a slide has meaningful explored branches, show them in the deck report.

At minimum:

- one clearly marked main selected direction
- zero or more primary alternate options
- version history grouped under the current selected version when the slide has
  manifest-backed history
- archived or dropped side branches only when they are still useful context
- historical options on deprecated slides when they still matter as references

## Execution-lane rule

If a project adopts a default execution lane such as `Gemini image + Gemini
HTML`, make that obvious in the slide report and the deck report.

If other model branches are only challenge passes or sanity checks, label them
that way instead of presenting them as equal-default contenders.

## Merge rule

If slides are merged:

- keep the merged slide in the active backbone with a display number like
  `4/5`
- move the replaced slides into the deprecated section
- keep their historical directions visible when they still help explain the
  current merged slide
