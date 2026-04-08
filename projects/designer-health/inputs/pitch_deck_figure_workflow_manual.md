# Pitch Deck Figure Process

## Purpose

This is the official process for turning a slide spec into a pitch-deck figure.

The process is intentionally thorough. Its job is to separate strategy,
concept, execution, critique, and revision so the figure gets sharper instead
of drifting.

This process applies whether the work is done by an operator, a model, a
designer, or a mixed workflow.

## Default input

The default input is one slide spec plus the deck context around it.

Required inputs:

- slide title, subtitle, and current takeaway
- slide spec or packet
- adjacent slides and deck role
- locked copy, citations, or must-keep claims
- existing figure, draft, or screenshot if one exists
- known constraints, dislikes, or visual rules

If deck context is stale or missing, refresh deck calibration before doing
slide-level work.

## Core principle

Decide what the figure must do before deciding what it should look like.

Do not combine interpretation, ideation, rendering, and critique into one
step.

## Non-negotiable distinctions

Keep these distinctions explicit throughout the process:

- slide message vs figure message
- readable vs felt vs implied
- deck logic vs slide logic

If those distinctions blur, the work usually becomes over-literal, visually
weak, or both.

## Entry points

Use the highest valid entry point. The process should be thorough, but settled
work does not need to be re-invented.

### Entry point 1: Full concept pass

Use this when the input is a slide spec, outline, unstable slide, or an early
draft that does not yet have a trusted concept.

Run phases 0 through 9.

### Entry point 2: Concept rescue pass

Use this when the slide purpose is clear but the current figure family is weak,
unclear, or strategically wrong.

Run phases 2 through 9.

### Entry point 3: Execution pass

Use this when the concept and build packet are already sound, but the prototype
quality, hierarchy, or tone is weak.

Run phases 6 through 9.

### Entry point 4: Critique pass

Use this when an external draft arrives and needs diagnosis before more work.

Run phases 8 through 9, then move backward only if the critique exposes a
structural problem.

### Entry point rules

- earlier phases may be skipped only if their artifacts already exist and are
  still valid
- if the concept family changes, reopen concept search and direction selection
- no figure is final without a current build packet and at least one explicit
  critique pass

## Phase 0: Deck calibration

### Goal

Build a deck-wide map before attempting individual figure design.

### Checklist

- list slides in order
- write a one-sentence job for each slide
- assign a proof type for each slide
- mark each slide as figure-essential, figure-helpful, or figure-optional
- group slides into visual sibling families
- note what each slide sets up and what it follows

### Output

Deck Matrix

### Exit criteria

By the end of this phase, the operator should be able to explain:

- why each slide exists
- what each slide must prove
- whether the figure is carrying the argument or only supporting it
- which slides should feel related

## Phase 1: Slide intake

### Goal

Create a reliable input block before doing any figure thinking.

### Checklist

- capture the current title, subtitle, and takeaway
- note the slide role in the deck
- capture surrounding slides
- list must-keep copy, evidence, and constraints
- attach the current figure or draft if one exists
- record known failure modes or stakeholder dislikes
- confirm the correct entry point

### Output

Slide input block inside the slide packet

### Exit criteria

The slide can be restated without hunting through multiple source documents.

## Phase 2: Slide purpose brief

### Goal

Strip away the current figure and restate what the slide is actually trying to
do.

### Checklist

- ignore the current figure at first
- restate the slide purpose in plain language
- identify the core claim
- define the 3-second read
- define the 15-second read
- define the emotional job
- define the logical job
- state what the slide is not trying to say
- decide what belongs in title and subtitle instead of the figure
- state what burden the figure must carry

### Output

Slide Purpose Brief

### Exit criteria

The slide purpose is clear enough that a different person could ideate without
seeing the old figure.

## Phase 3: Figure job brief

### Goal

Define exactly what the figure itself must communicate.

### Checklist

- write one sentence for the figure message
- separate slide message from figure message
- define the relationship or mechanism that must become obvious
- define what must be readable
- define what should be felt without reading
- define what can remain implied
- decide whether the current figure family is worth keeping

### Warning signs

- if the figure job reads like a paragraph, it is too broad
- if the figure job reads like a process manual, it is too literal

### Output

Figure Job Brief

### Exit criteria

The figure has one clear job, not several competing jobs.

## Phase 4: Concept search

### Goal

Explore materially different figure families before committing to one.

### Checklist

- generate at least three concept directions for full concept work
- make the directions differ by logic, not just by styling
- describe what each concept literally shows
- explain why each concept could work
- explain how each concept could fail
- compare them and reject the weaker options explicitly

### Good differences

- proof tiles vs spatial metaphor
- mechanism figure vs comparison figure
- system map vs focal hero object
- transformation figure vs status-state figure

### Bad differences

- the same chart with new colors
- the same layout with minor ornament changes
- the same concept with different wording only

### Output

Concept Search Sheet

### Exit criteria

There is a deliberate concept choice and a clear reason the rejected options
lost.

## Phase 5: Direction selection

### Goal

Lock the concept before rendering.

### Checklist

- choose the strongest concept
- state why it is strongest strategically, not just visually
- state what the viewer should feel immediately
- state what the figure must make obvious
- list the core risks that must be watched during execution

### Output

Selected direction section inside the slide packet

### Exit criteria

The concept can be summarized in a few sentences and defended against the other
options.

## Phase 6: Build packet

### Goal

Convert the selected concept into a build-ready specification.

### Required sections

- core idea
- overall composition
- region logic
- text inventory
- object inventory
- visual emphasis rules
- what to avoid
- concise prose spec
- YAML spec
- image-generation prompt
- SVG or HTML-generation prompt

### Checklist

- define what goes where
- define what is primary, secondary, and quiet
- define exact figure text
- define what should be excluded
- define the intended hierarchy and accent usage
- make the packet specific enough that another builder could execute it

### Output

Build Packet

### Exit criteria

The figure can be built without inventing new strategy during rendering.

## Phase 7: Prototype generation

### Goal

Test whether the chosen concept survives contact with an actual rendering.

### Allowed outputs

- rough HTML mock
- SVG draft
- AI image draft
- schematic visual draft

### Checklist

- generate from the build packet only
- treat the prototype as an execution test, not a new ideation pass
- keep versions explicit
- note output type and packet version in the log

### Output

Prototype file or files plus Prototype Log

### Exit criteria

There is a concrete draft that can be critiqued against the slide job.

## Phase 8: Critique

### Goal

Diagnose the result in a way that improves the concept or spec instead of
asking for vague polish.

### Checklist

- critique against the slide purpose and figure job
- separate visual success from semantic success
- identify the tradeoff that failed
- decide whether the concept family is still correct
- decide whether the next move is execution tweak, spec rewrite, or concept
  replacement

### Useful critique language

- visually elegant, semantically empty
- semantically better, but visually dead
- strong composition, wrong emphasis hierarchy
- right concept, wrong geometry
- right geometry, wrong density
- too much traceability in the hero object

### Output

Prototype Critique

### Exit criteria

The failure mode is named clearly enough that the next revision is obvious.

## Phase 9: Revision and promotion

### Goal

Feed the critique back into the packet, regenerate deliberately, and promote
the result only when the structural issues are closed.

### Checklist

- update the build packet instead of starting from scratch
- preserve what still works
- change only the sections invalidated by critique
- version the packet and revision notes
- generate the next prototype
- promote the figure to a canonical spec only after critique is surfacing
  polish issues, not structural ones

### Outputs

- Revised Build Packet
- Revision Delta
- promoted canonical spec or render brief when ready

### Exit criteria

The reasoning trail is visible and the promoted figure reflects the latest
packet, not an undocumented branch of the process.

## Artifact set

The standard artifact set for a fully worked slide is:

- Deck Matrix
- Slide Packet
- Build Packet
- Prototype Log
- Prototype Critique
- Revision Delta
- promoted canonical spec or render brief

Not every slide needs the full artifact stack from scratch. Every promoted
figure still needs a current packet, a prototype, and a critique trail.

## Execution rules

These rules are mandatory:

- do not start with rendering unless a lower entry point is clearly valid
- treat the existing figure as input, not as truth
- separate concept choice from render choice
- critique against the slide job, not prompt compliance
- use title and subtitle to carry some meaning
- do not force the figure to explain everything
- version specs, not just images
- if critique reveals a structural issue, move backward in the process

## Density guidance

Different slide types want different density:

- proof slides can tolerate more labels and numbers
- mechanism slides should usually favor the "aha" over full traceability
- product tangibility slides need concrete structure, but should not drift into
  fake UI unless the artifact itself is the point
- strategy and market slides need strong selection logic and restrained wording

Default density rule for mechanism slides:

- 70 percent visual idea
- 30 percent semantic anchoring

## Completion criteria

A slide is done when:

- its job is clear
- the figure family is the right family
- the figure reads quickly
- title and figure work together
- the figure has one clear hero idea
- the figure is not over-literalized
- the figure fits the deck visual system
- critique is surfacing polish issues, not structural ones

If critique is still uncovering structural problems, the slide is not done.

## Operating rhythm

Use this rhythm when working across a deck:

- do deck calibration first
- work slide by slide through concept lock
- do not mass-render unstable slides
- finish concept selection and build packets before heavy prototype volume
- move faster to execution only when concept is genuinely settled

## Templates

### Deck Matrix

```md
# Deck Matrix

| Slide | Working Title | Narrative Role | One-Sentence Takeaway | Proof Type | Figure Importance | Visual Family | Visual Siblings | Sets Up / Follows |
|---|---|---|---|---|---|---|---|---|
| 1 |  |  |  |  |  |  |  |  |
```

### Slide Packet

```md
# Slide Packet

## 0. Inputs
- Slide number:
- Current title:
- Current subtitle:
- Current takeaway:
- Existing figure or screenshot:
- Surrounding slides:
- Must-keep content:
- Known constraints:
- Known dislikes or failure modes:
- Selected entry point:

## 1. Slide purpose brief
- Why this slide exists:
- One-sentence takeaway:
- 3-second read:
- 15-second read:
- Emotional job:
- Logical job:
- What the slide is not trying to say:
- What belongs in title and subtitle vs figure:
- What burden the figure must carry:

## 2. Figure job brief
- Figure message:
- Relationship or mechanism to show:
- What must be readable:
- What should be felt:
- What may remain implicit:
- Current figure family worth keeping? Why or why not:

## 3. Concept search
### Concept A
- Name:
- Core idea:
- What it literally shows:
- Why it could work:
- Main risk:

### Concept B
- Name:
- Core idea:
- What it literally shows:
- Why it could work:
- Main risk:

### Concept C
- Name:
- Core idea:
- What it literally shows:
- Why it could work:
- Main risk:

## 4. Direction selection
- Chosen concept:
- Why this is strongest:
- Why the others were rejected:
- What the viewer should feel immediately:
- What the figure should make obvious:
- Execution risks to watch:
```

### Build Packet

````md
# Build Packet

## Core idea

## Overall composition

## Region logic
- Region 1:
- Region 2:
- Region 3:

## Text inventory
- Header:
- Subheader:
- Figure labels:
- Figure body text:
- Callouts:

## Object inventory
-
-
-

## Visual emphasis rules
- Primary:
- Secondary:
- Quiet:
- Accent usage:

## What to avoid
-
-
-

## Concise prose spec

## YAML spec
```yaml
figure:
  id:
  canvas:
    width:
    height:
```

## Image-generation prompt

## SVG or HTML-generation prompt
````

### Prototype Critique

```md
## Prototype Critique
- What it got right:
- What it got wrong:
- What is visually strong:
- What is semantically strong:
- What tradeoff failed:
- Is the concept family still correct?
- Keep:
- Lose:
- Add:
- Core diagnosis:
- Recommended next move:
```

### Revision Delta

```md
## Revision Delta
- Version from:
- Version to:
- What changed:
- Why it changed:
- What stayed the same:
- New rendering instructions:
```
