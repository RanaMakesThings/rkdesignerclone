# Designer Deck Workflow

Current working methodology for building Designer slide figures inside this
repo.

This is the project-local source of truth for how we actually run the process.
The imported manual at `inputs/pitch_deck_figure_workflow_manual.md` remains the
upstream reference, but this file reflects the hardened process after real deck
passes in this repo.

## Purpose

Use a repeatable loop that keeps strategy, figure decisions, model comparison,
and review artifacts organized under one project root.

The goal is not just to make a figure. The goal is to preserve:

- why the slide exists
- what the figure is trying to prove
- what was tried
- what won
- how to understand the full pass later without reconstructing context

Current execution policy:

- use multiple models for high-level idea generation, critique, and occasional
  challenge branches
- once a visual direction is locked, the main execution lane becomes:
  `Gemini image + Gemini HTML`
- use other model-generation branches only when:
  - the Gemini lane is stuck
  - we need a deliberate challenge branch
  - we want a one-off sanity check on a hard slide
- after the Gemini lane is stable, promote the winner into the canonical native
  HTML/SVG/PNG artifact set

## Project-first rule

All active deck work should live under `projects/designer-health/`.

The key folders are:

- `deck-spec.json`
- `master-slide-specs.md`
- `figure-companion.md`
- `slide-packets/`
- `figures/briefs/`
- `figures/ideation/`
- `figures/compositions/`
- `figures/render-briefs/`
- `figures/specs/`
- `prompts/`
- `slide-figures/`

Generated runtime artifacts may still land in `output/`, but stamped
slide-review artifacts should resolve through the manifest-backed
`slide-figures/slide-XX/` tree.

Each stamped slide directory is manifest-backed. The root stays intentionally
clean and keeps only the current selected figure projection plus version
history:

- `manifest.json`
- `versions/`
- `slide-XX--version-YYYYYY.html`
- `slide-XX--version-YYYYYY.svg`
- `slide-XX--version-YYYYYY.png`
- optional alternate raster like `slide-XX--version-YYYYYY.jpg` or `.webp`

The current selected version is projected into the slide root for compatibility
and fast browsing. Historical and draft candidates live under
`versions/version-*--<slug>/`. Slide-level notes and change requests live under
`slide-notes/<slide-dir>/`, and one-slide HTML reports live under
`slide-reports/<slide-dir>.html`.

Use canonical stamped review directories inside the current selected version
bundle:

- `gemini-review/`
- `anthropic-review/`
- `gemini-repair/`
- `anthropic-repair/`

When re-running a review or repair consult for the same current pass, overwrite
the canonical directory instead of inventing a new suffixed folder name.

## Standard artifact chain per slide

Every fully worked slide should have:

1. slide packet
2. figure brief
3. ideation note
4. composition note
5. render brief
6. Gemini image branch for active visual iteration
7. Gemini HTML branch for active editable iteration
8. optional side branches from other providers only when justified
9. three-review assessment set
10. assessment synthesis
11. repair consultation set when the pass fails
12. repair synthesis and next-pass plan when the pass fails
13. final native figure spec
14. stamped native export
15. final HTML slide report

## Slide fine-tuning mode

After a slide is stamped, later chats may enter a slide-local fine-tuning mode
instead of replaying the full concept workflow.

Use this mode only when the requested change is polish-level and the current
selected direction is still valid.

The handoff contract for that mode lives in:

- `projects/designer-health/slide-fine-tuning.md`

In fine-tuning mode:

1. resolve the official slide through `deck-spec.json`
2. read `manifest.json` inside `paths.stampedDir` to find the current selected
   version
3. inspect `deck-report.html`, the stamped slide report in
   `slide-reports/<slide-dir>.html`, and the stamped slide note in
   `slide-notes/<slide-dir>/README.md`
4. make the smallest possible change on the correct edit surface:
   - a draft `versions/version-*--<slug>/gemini-html/generated.html` branch for
     a contained HTML delta
   - canonical `figures/specs/*.json` when the slide is spec-driven
5. refresh the draft bundle's preview and the mirrored `figure.*` assets if the
   draft is promoted
6. regenerate the slide report
7. regenerate the deck report if the visible official state changed

Do not reopen ideation, packet writing, or direction selection unless the
requested change exposes a structural problem.

## Slide creation bootstrap

When a slide needs a new first draft from the locked Designer shell rather than
polish on an existing HTML surface, use the create bootstrap instead of
`html:edit:run` or `gemini:html:tune`.

The handoff contract for that mode lives in:

- `projects/designer-health/slide-creation.md`

In create mode:

1. resolve the slide through `deck-spec.json`
2. allocate a draft `create-draft` version bundle under `versions/`
3. seed the version root from
   `templates/designer-deck-template-v1/template.html`
4. write `slide-notes/<slide>/create-request.md` plus a version-local snapshot
   under `versions/version-*/create/`
5. run `slide:create:run` to fan out the first-pass multimodal HTML search
   against the seeded shell
6. leave the winning draft in `draft` state until a human explicitly promotes
   it with `slide:versions promote`

Lane policy in v1:

- `html`: default first-draft path
- `hybrid`: same HTML bootstrap plus extra reference images/files
- `native`: scaffold-only handoff to the existing native/spec workflow

## Standard loop

1. Confirm slide context.
   Pull the current slide, the lead-in slide, and the next slide from
   `deck-spec.json` and sanity-check the human copy in `master-slide-specs.md`.
2. Make or update the slide packet.
   Lock the slide thesis, non-goals, figure job, and figure-specific copy.
3. Write the figure brief.
   Keep this short and execution-facing.
4. Run model-backed ideation.
   Start with `figures:ideate` against the checked-in brief.
   For essential slides or when the wrapper is brittle, also gather direct
   concept sets from GPT-5.4, Claude, and Gemini.
5. Synthesize ideation into a checked-in ideation note.
   Do not leave the raw model artifact as the only record.
   The ideation note should make the distinct concept families obvious and name
   the current lead direction.
6. Write the composition note.
   Compare materially different visual families and choose one.
7. Write the render brief.
   Lock the chosen direction before native rendering.
8. Build the Gemini image branch.
   Use it as the main taste / composition iteration lane.
9. Build the Gemini HTML branch.
   Use it as the main editable / structural iteration lane.
10. Preview Gemini HTML with a PNG.
    Run `html:screenshot` on `gemini-html/generated.html`.
11. If the next move is one concrete local HTML delta, run `gemini:html:tune`
    before broader review or repair.
    Use it for moves like spacing, position, visibility, size, or one
    contained structural tweak. Every micro-pass now has two checks:
    - delta check: did the requested change happen?
    - regression check: did anything else break?
    Do not use it for family changes, semantic rewrites, or broader layout
    redesigns.
    The micro-pass draft should live in
    `slide-figures/slide-XX/versions/version-*--<slug>/`.
12. Run side-branch generations only when justified.
    OpenAI or Anthropic generation branches are no longer default per-slide
    requirements. Use them only for high-level ideas, challenge passes, or
    blocked Gemini cases.
13. Run the three-review assessment set.
    Ask for:
    - Codex visual assessment
    - Gemini visual assessment
    - Anthropic visual assessment
    Save those under the current selected version bundle.
14. Write the assessment synthesis.
    Summarize:
    - what happened
    - what was made
    - what each reviewer said
    - the consensus
    - the final operator decision
15. Run the loop gate.
    Decide whether the current winner has only polish issues or still has a
    structural problem. If the issue is structural, reopen the loop and do a
    deliberate revision pass before promotion.
16. If the pass failed, run the three-tool repair consultation.
    Ask Codex, Gemini, and Anthropic what to do next now that the failure class
    is known.
17. Write the next-pass plan.
    Classify the failure and state the exact next move before touching the next
    revision.
18. Build and stamp the final native branch after the Gemini lane is stable.
    Native remains the canonical editable asset set:
    `figure.html`, `figure.svg`, and `figure.png`.
    Those artifacts stay inside the selected version bundle and are projected to
    the slide root as `slide-XX--version-YYYYYY.html`, `.svg`, and `.png` when
    the version is promoted.
19. Sync the deck-level source docs if the slide understanding changed.
    If the pass changed the slide thesis, header, subheader, takeaway, figure
    role, family recommendation, numbering status, or current build status,
    update `deck-spec.json`, `master-slide-specs.md`, `deck-matrix.md`, and
    `figure-companion.md` in the same turn.
20. Generate the final slide report.
    Write a clean HTML report into `slide-reports/slide-XX.html` so the whole
    pass is reviewable in one click.

## Required decisions during the loop

- packet first, not prompt-first wandering
- slide packet before prompt iteration
- one stamped slide folder per slide
- Gemini image + Gemini HTML are now the default active execution lane once a
  direction is locked
- `gemini:html:tune` is now the default micro-loop for one concrete Gemini HTML
  delta before the pass goes back through broader review
- a micro-pass can promote only when:
  - both delta judges say the requested change was applied
  - GPT and Claude regression reviews both clear it
  - a checked-in Codex/operator micro-review note clears it
- any single reviewer can block promotion if they identify a concrete visual
  break
- any manual edit to `generated.html` invalidates prior micro-pass approval
  until the regression gate runs again
- native is still the canonical final asset, but it is promoted after the
  Gemini lane is stable
- non-Gemini generation branches are optional challenge branches, not routine
  defaults
- every mature pass gets three visual reviews:
  Codex, Gemini, and Anthropic
- every mature pass gets an explicit assessment synthesis
- every pass must go through a loop gate before promotion
- deck-level docs must be updated when a hardened pass changes the slide
  understanding
- report generation at the end of the pass

## Loop gate

Ask this after the first comparison pass:

- is the winner missing a required object or relationship?
- is the figure still unclear in its 3-second read?
- is the hierarchy still wrong?
- does the winner still disagree with the slide job in a meaningful way?
- did the pass change the slide meaning or family enough that the deck docs are
  now stale?

If the answer is yes to any of those, loop again.

If the answer is no and the remaining issues are polish only, promote.

For figure-essential slides, prefer at least one critique and one deliberate
revision unless the first pass is already clearly stable.

Also run this visual sanity check before promotion:

- no new object should cover key copy or structure underneath it
- no semantic object should appear twice unless duplication is intentional and
  visibly justified
- no directional marker or arrowhead should disappear or become visually
  ambiguous
- no text should be clipped, cropped, or partially missing
- no stray rendering artifact should be visible, including leaked text like
  `xml`
- if a section was removed, the slide must still read as a resolved standalone
  composition rather than a cropped fragment

Also ask:

- is a side-model generation branch actually helping, or is it just creating
  noise?
- is this a concrete HTML delta that should go through `gemini:html:tune`
  first, or has it crossed into a broader layout / family / semantic problem?

If a branch is not meaningfully helping, archive it out of the primary
comparison set.

## Formal assessment method

Use this exact order:

1. Codex visual assessment
   Write a blunt local assessment based on the actual rendered image.
2. Gemini visual assessment
   Use `gemini:review` with the stamped image and the checked-in critique
   prompt.
3. Anthropic visual assessment
   Use `anthropic review` with the same stamped image and prompt.
4. Assessment synthesis
   Write one checked-in synthesis note that captures:
   - what happened
   - what was made
   - each reviewer verdict
   - unique blocker findings
   - the consensus
   - the final operator decision

The operator decision is not a vote count. It is a synthesis. But the point of
the three-review set is to make weak self-approval much harder.

Unique blocker findings must be preserved even when only one reviewer catches
them. Do not omit a concrete severe finding just because the other reviewers
missed it.

## Formal next-step method when a pass fails

When the slide does not clear the loop gate, classify the failure before
revising:

- `polish`
  Small spacing, sizing, or emphasis issues. Same concept, same family.
- `layout`
  The right ingredients exist, but their arrangement or hierarchy is wrong.
- `semantic`
  The slide is readable but the figure is proving the wrong thing or duplicating
  meaning badly.
- `family`
  The chosen visual family is wrong for the slide job.

Then run a separate repair consultation.

This is not the same thing as the review prompt.

The review prompt asks:

- what is wrong
- whether it is working

The repair prompt asks:

- what to do next
- whether to stay in the same family
- whether to do one targeted fix or reopen composition
- which exact change should happen before the next render

Then choose the next move:

- if the request is one contained HTML delta inside the current family:
  run `gemini:html:tune` first and only reopen the broader loop if that fails
- if all three reviewers agree on one concrete fix:
  do one targeted revision pass
- if all three agree the slide is broken, but disagree on the fix:
  write 2 to 3 concrete revision options in the composition note and choose one
- if the reviews expose slide-strategy confusion:
  update the slide packet before rendering again
- if the reviews show the family is wrong:
  stop iterating inside the same family and reopen composition

Do not jump straight from “broken” to “new render” without writing the next
move down.

## How the repair consultation becomes a decision

Do not synthesize the repair round loosely. Compare the three repair responses
across the same four axes:

- failure class
- family decision:
  stay in the current family or reopen composition
- fix scope:
  targeted revision or broader redesign
- exact next render change

Then apply this rule:

- if 3 of 3 agree on family and fix scope:
  take the shared path and write it into `next-pass.md`
- if 2 of 3 agree on family and fix scope, and the third is a narrower variant
  of the same move:
  take the majority path and note the dissent in `repair-synthesis.md`
- if the tools split on family choice:
  do not render yet; reopen composition
- if the tools split because the slide thesis itself is unclear:
  update the slide packet before choosing a figure move

The operator decision is still a synthesis, not a vote count. But the synthesis
must be traceable to those four axes.

## Commands

- native ideation:
  - `npm run figures:ideate -- --brief`
    `projects/designer-health/figures/briefs/<brief>.md`
- native render:
  - `npm run figures:render -- --spec`
    `projects/designer-health/figures/specs/<spec>.json`
- native export direct to stamped slide folder:
  - `npm run figures:export -- --spec`
    `projects/designer-health/figures/specs/<spec>.json --project-root`
    `projects/designer-health --slide slide-XX --version-id version-000123 --no-images`
- versioned slide management:
  - `npm run slide:versions -- create`
  - `npm run slide:versions -- promote`
  - `npm run slide:versions -- migrate`
- Gemini image:
  - `npm run gemini:image -- --prompt-file`
    `projects/designer-health/prompts/<prompt>.txt --out`
    `projects/designer-health/slide-figures/slide-XX/versions/version-*--<slug>/gemini-image`
- Gemini HTML:
  - `npm run gemini:html -- --prompt-file`
    `projects/designer-health/prompts/<prompt>.txt --out`
    `projects/designer-health/slide-figures/slide-XX/versions/version-*--<slug>/gemini-html`
- Gemini HTML preview:
  - `npm run html:screenshot -- --input`
    `projects/designer-health/slide-figures/slide-XX/versions/version-*--<slug>/gemini-html/generated.html`
    `--output`
    `projects/designer-health/slide-figures/slide-XX/versions/version-*--<slug>/gemini-html/preview.png`
- finalize a pending micro-pass after writing the Codex/operator note:
  - `npm run gemini:html:tune -- --dir`
    `projects/designer-health/slide-figures/slide-XX/versions/version-*--<slug>/gemini-html`
    `--change-file`
    `projects/designer-health/slide-notes/slide-XX/fine-tune-request.md`
    `--codex-review-file`
    `projects/designer-health/slide-figures/slide-XX/versions/version-*--<slug>/gemini-html/tune/<run-id>/<attempt>/codex-micro-review.md`
- final slide report:
  - `npm run figures:report -- --project-root projects/designer-health --slide slide-XX`
- repair loop wrapper:
  - `npm run figures:repair-loop -- --project-root projects/designer-health`
    `--slide slide-XX`
  - notes:
    requires the checked-in `codex-repair.md` as the Codex / GPT-5.4 input and
    writes `repair-synthesis.generated.md` as a scaffold

## Review rules

- title and figure should work together, not duplicate badly
- the native branch should always exist before comparison branches
- keep the winner as a canonical spec, not just a stamped image
- do not stop after one pass just because artifacts exist; stop only after the
  loop gate says the remaining issues are polish-level
- if the slide-level pass changes deck-level truth, sync the deck docs before
  considering the pass complete
- if a process improvement appears during a slide pass, update this workflow doc
  and the relevant tooling docs before moving on

## Current known improvements after slide 6

- direct export into the current selected version bundle or a draft
  `versions/version-*` bundle is better than copying later
- Gemini HTML should be constrained harder:
  no outer frame, no browser-like margins, full-slide scale
- final reports should be part of the default loop, not an optional afterthought
- if the brief names a required object or relationship, do not intentionally
  defer it just to keep the first pass cleaner; that should trigger a reopened
  loop, not a promotion
