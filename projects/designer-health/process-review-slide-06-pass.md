# Slide 6 Process Review

Review of the full native + Gemini run for slide 6, including the reopened loop
that produced the promoted `v3` native winner.

## What worked

- project-first organization is materially better than the old split layout
- the new `workflow_strip` family was the right move; slide 6 now has a
  repeatable native source of truth instead of ad hoc HTML
- exporting native artifacts directly into
  `slide-figures/slide-06/` removed a whole manual stamping step
- Gemini image is useful as a taste check even when it misses on exact copy
- Gemini HTML is useful as an editable structural branch when paired with a PNG
  preview
- the new `html:screenshot` command closes a real workflow gap

## What was weak

- the raw `figures:ideate` run was opaque and felt hung for a while even though
  it eventually wrote artifacts correctly
- Gemini image drifted on exact wording and invented awkward copy
- Gemini HTML returned a smaller framed composition than we want for a final
  slide, which means the prompt needs stronger constraints around full-slide
  scale and zero outer frame
- the first native pass kept the workflow calm, but it did not fully satisfy
  the brief because the handoff artifact between `Structure` and `Verify` was
  still implicit
- the second native pass over-corrected by adding a bridge object that covers
  underlying content and makes the brief feel duplicated
- the repair round itself was previously underformalized until we split review
  from repair consultation and added the repair wrapper

## Recommended process updates

1. Treat the slide packet plus four figure docs as standard:
   brief, ideation, composition, render brief.
2. Always run native first so the deck has one deterministic branch before
   taste exploration.
3. Always send native export directly to `slide-figures/slide-XX/` using
   `--out`.
4. Always keep Gemini branches inside that same slide folder:
   `gemini-image/` and `gemini-html/`.
5. Always run `html:screenshot` after `gemini:html` so the HTML branch is
   reviewable without opening files manually.
6. Tighten Gemini HTML prompts with these rules:
   no outer card, no browser-like margin, full 1920x1080 slide, and no extra
   background frame.

## Decision after this pass

- keep the workflow concept
- treat `v1` as a structurally incomplete first pass
- treat `v2` as a failed over-correction
- promote `v3` as the current native winner
- keep using Gemini as a comparison layer, not as the canonical source of truth
- treat any future slide-6 work as polish-only unless the slide thesis changes
