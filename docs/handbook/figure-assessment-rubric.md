# Figure Assessment Rubric

This is the canonical review rubric for pitch-deck body visuals in this repo.

Use it for:

- HTML figure exports
- PNG review loops
- Claude-assisted figure critiques

Review figures in this order:

1. Brief fidelity
2. Focal hierarchy
3. Conceptual clarity
4. Deck consistency
5. Restraint and polish
6. Readability at slide scale

Scores matter less than the sequence. A polished figure that misses the brief
still fails.

## Assessment priorities

### 1. Brief fidelity

Ask first:

- Did the figure honor the stated figure job?
- Did it include the required objects, labels, and callouts?
- Did it preserve the must-have copy?
- Did it avoid forbidden patterns from the brief?

This is the highest priority category. If the figure violates the brief, call
that out before styling commentary.

### 2. Focal hierarchy

Ask:

- Is the main point obvious in 2 seconds?
- Does one object clearly lead the composition?
- Did accent, size, and placement reinforce the intended focal point?

Common failures:

- eye lands on the wrong object
- callout dominates instead of the main figure
- too many equally loud elements

### 3. Conceptual clarity

Ask:

- Does the figure communicate one idea quickly?
- Is it conceptual in the right places?
- Did it avoid over-annotation, fake precision, or consultant-chart energy?

Common failures:

- too many labels
- too many numbers for a conceptual slide
- unexplained visual complexity

### 4. Deck consistency

Ask:

- Does it feel like the same deck system as the other figures?
- Are spacing, radii, line weights, and typography aligned?
- Is accent usage disciplined?

This is about deck coherence, not novelty.

### 5. Restraint and polish

Ask:

- Does it feel premium, calm, and deliberate?
- Is it avoiding decorative noise?
- Are there any obvious visual rough edges or awkward alignments?

Keep non-blocking refinements in `suggestedUpgrades`, not `issues`.

### 6. Readability at slide scale

Ask:

- Can the main idea be read at presentation distance?
- Are the key labels large enough?
- Is the quiet copy still legible without competing?

If a figure only works zoomed in on a laptop, it is not ready.

## Output guidance

- Put the main user-facing problem first in the summary.
- `issues` should be concrete and actionable.
- Use `blocking: true` only for real brief or readability failures.
- Keep `suggestedUpgrades` non-blocking.
- Prefer evidence tied to the figure PNG, spec JSON, or coverage JSON.
