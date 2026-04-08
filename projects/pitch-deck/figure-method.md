# Pitch Deck Figure Method

This is a repeatable method for turning a slide outline into an actual figure.

The goal is not "make a nice graphic."
The goal is:

1. Make the slide's argument legible in 3 to 5 seconds.
2. Use one visual idea per slide.
3. Keep the deck visually coherent across slides.
4. Avoid consulting-slop, fake precision, and UI noise.

## Core Principle

Each figure should answer one question only.

Examples:

- Slide 2: Is there real proof that access is constrained?
- Slide 3: Where is the safest place to recover visit time?
- Slide 4: What work is actually consuming time in the visit?
- Slide 8: What does the clinician actually get?

If a figure tries to answer two questions, split it or simplify it.

## The Figure Pipeline

Use this pipeline for every slide.

### Step 1: Define the figure job

Write one sentence:

- "This figure needs to prove X."
- "This figure needs to explain Y."
- "This figure needs to make Z tangible."

If that sentence is fuzzy, the figure will be fuzzy.

### Step 2: Pick a figure archetype

Do not invent from scratch every time. Pick the closest archetype.

Use one of these:

1. Proof tiles
   For evidence, stats, or market proof.
   Example: access delays, deferred care.

2. Highlighted segment
   For showing where the leverage lives inside a larger system.
   Example: history inside the visit.

3. Transformation
   For "input -> process -> output".
   Example: patient story -> structure.

4. Zoom-in object
   For taking one part of a prior slide and unpacking why it matters.
   Example: history reconstruction as the reclaimable unit.

5. Standard / qualification card
   For showing the bar that must be met.
   Example: clinician-grade history and its required properties.

6. Workflow strip
   For showing concrete operational sequence.
   Example: Invite -> Interview -> Structure -> Verify.

7. Artifact + callouts
   For making product output tangible without showing full UI.
   Example: structured brief / Signal Report.

8. Gap map / journey strip
   For showing what is covered today versus what is still open.
   Example: before visit / start of visit / during-after.

9. Hero economics block
   For showing operating leverage without a spreadsheet.
   Example: +1 visit/day capacity math.

10. Filter-to-beachhead
   For showing why the first market is chosen.

11. People grid
   For team / credibility.

12. Milestone cards
   For raise / roadmap / proof points.

If a slide does not clearly match one archetype, the slide idea is not ready.

### Step 3: Write the visual contract

Before building, define these six things:

1. Focal point
   What should the eye land on first?

2. Layout
   What is the spatial arrangement?
   Example: "header top, one long bar centered, callout upper-right."

3. Big vs quiet
   What should be visually dominant?
   What should be quiet?

4. Accent use
   Where is the accent color allowed?
   Usually one object only.

5. Literal text
   Exact labels, chips, bullets, and numbers.

6. Failure mode
   What should the figure avoid?
   Example: too many labels, fake precision, generic workflow icons.

This is the real design brief.

### Step 4: Choose the asset strategy

Decide explicitly whether the figure should be:

1. Native
   Drawn directly in HTML/SVG.

2. Photo
   Built around sourced imagery.

3. Hybrid
   Sourced imagery plus overlays, callouts, or structured proof copy.

Do not treat photography as decoration. Use it only when it makes the argument
feel more real, specific, or immediate than a drawn object would.

If `photo` or `hybrid` is plausible, run a stock-image pass during ideation and
judge the candidates before selecting the final direction.

## The Build Format

Use this brief format for each figure:

```md
## Slide N

Figure job
- One-sentence purpose

Archetype
- One from the approved list

Focal point
- What gets the attention first

Layout
- Exact placement language

Big
- 2 to 4 things

Quiet
- 2 to 4 things

Accent use
- Where accent is allowed

Copy
- Exact labels / bullets / numbers

Failure mode
- What not to do
```

If this brief is complete, the figure is buildable.

## The Production Workflow

Once the brief exists, make the figure in three passes.

### Pass 1: Wireframe

Goal: composition only.

Rules:

- Black / gray boxes are fine.
- No polishing.
- Get proportions, placement, and hierarchy right.
- Confirm the figure reads in thumbnail size.

Deliverable:

- HTML mock or PowerPoint stub.

### Pass 2: Styled figure

Goal: match the deck's visual language.

Rules:

- Wireframe geometry must be replaced with semantic objects.
- No anonymous gray boxes, circles, or bars in a final proof visual.
- Repeated marks should correspond to named domain objects such as appointment
  slots, dates, clinicians, patients, or artifacts.
- Bring in deck typography and spacing.
- Use accent in one place only.
- Use rounded geometry consistently.
- Keep supporting labels quieter than the main idea.

Deliverable:

- Slide-level visual that fits the deck.

### Pass 3: Deck integration

Goal: make sure the slide works in sequence.

Rules:

- The figure must make sense after the previous slide.
- The next slide should feel like a natural follow-on.
- Remove anything the speaker will already say out loud.
- Tighten until the slide reads fast.

Deliverable:

- Final figure inside the deck.

## Review Checklist

Use this before calling a figure done.

### Narrative

- Can I state the slide's point in one sentence?
- Does the figure make that point without narration?
- Is this the right archetype for the job?

### Visual hierarchy

- Is there one obvious focal point?
- Are there too many labels?
- Is anything quiet that should be loud?
- Is anything loud that should be quiet?

### Precision discipline

- Does the figure imply fake accuracy?
- Would a skeptical viewer argue with the proportions instead of the point?
- Can any number or label be removed?

### Deck fit

- Does the typography match the rest of the deck?
- Does the accent color appear in the right place only?
- Does the slide feel like the same deck, not a different design system?

## Recommended Working Rhythm

For this deck, use this sequence:

1. Lock the brief.
2. Build rough HTML or PowerPoint wireframe.
3. Review together for argument and composition only.
4. Build final figure.
5. Move to next slide.

Do not try to finish all figures in one pass.

## Best Order For This Deck

Build in this order:

1. Slide 3
   Anchor figure. Sets the visual logic for "history as leverage."

2. Slide 4
   Core conceptual figure. Defines "story -> structure."

3. Slide 8
   Tangibility anchor. Makes the product output real.

4. Slide 10
   Economics anchor. Makes value legible.

5. Slide 5
   Zoom-in logic from slide 3.

6. Slide 6
   Standard / bar to clear.

7. Slide 9
   Category gap framing.

8. Slide 11
   Beachhead selection logic.

Then fill in the simpler slides:

- Slide 2
- Slide 7
- Slide 12
- Slide 13

## Practical Rule For Us

For each slide, we should not jump straight from outline text to final deck art.

We should go:

1. Outline brief
2. Figure brief
3. Wireframe
4. Final slide

That is the method.
