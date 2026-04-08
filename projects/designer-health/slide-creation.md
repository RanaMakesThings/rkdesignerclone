# Designer Slide Creation Mode

Use this guide when the user opens a fresh Codex chat and wants a brand-new
Designer slide draft from the locked deck shell, for example:

- `Draft slide 12.`
- `Start the first pass for slide 11.`
- `Create a new shell-based draft for slide 9.`

The goal is to make a new chat slide-local quickly without replaying the full
deck history, while still preserving the locked shell contract and the checked-
in create request.

## When creation mode applies

Use this mode when:

- the next move is a blank-sheet first draft from the locked Designer shell
- no existing HTML surface is the right starting point for the next pass
- the user wants one slide-local first pass, not a deck-wide workflow reset

Do not use this mode when:

- the user is polishing an existing official slide:
  use `slide-fine-tuning.md`
- the user wants one contained HTML delta on an existing branch:
  use `gemini:html:tune`
- the user wants a broader multi-provider search on an existing HTML surface:
  use `html:edit:run`
- the request is really a bigger process reset:
  reopen `workflow.md`

## Fast prep command

When you want the create scaffold immediately, run:

`npm run slide:create:prep -- --slide 12`

That command:

1. resolves the slide entry in `deck-spec.json`
2. chooses a create lane: `html`, `hybrid`, or `native`
3. allocates or reuses a draft `create-draft` version bundle under
   `slide-figures/slide-XX/versions/`
4. seeds that draft root from
   `templates/designer-deck-template-v1/template.html`
5. writes the checked-in `slide-notes/slide-XX/create-request.md`
6. snapshots that request into
   `versions/version-*--<slug>/create/create-request.snapshot.md`
7. writes `versions/version-*--<slug>/create/context.json`
8. seeds the draft root with `generated.html` and `preview.png`
9. prints:
   - the chosen lane and lane reason
   - the draft version id and dir
   - the seeded HTML and preview paths
   - the checked-in request path and version-local context snapshot
   - the recommended `slide:create:run` command

Use this when you want the working draft, request scaffold, and shell seed
before the multi-provider create run starts.

## Source of truth order

When a fresh chat starts, use this order:

1. `projects/designer-health/slide-creation.md`
2. the slide entry in `projects/designer-health/deck-spec.json`
3. `projects/designer-health/designer-deck-template.md`
4. `projects/designer-health/workflow.md`
5. the slide packet and any recorded spec paths from `deck-spec.json`
6. `projects/designer-health/slide-notes/slide-XX/README.md` when the slide
   already has prior context

`slide:create:prep` also snapshots adjacent official previews plus optional
reference images/files into the create context. Treat that generated context as
supporting runtime material, not a replacement for the checked-in source files.

## How to resolve the slide

For slide `N`:

1. open the slide entry in `deck-spec.json`
2. read:
   - `header`
   - `subheader`
   - `takeaway`
   - `family`
   - `buildStatus`
   - `selectedDirection`
   - `selectedVariantId`
   - `paths.packet`
   - `paths.specs`
   - `paths.stampedDir`
3. read the slide packet and first spec path when they exist
4. read `designer-deck-template.md`, `template.html`, and `shell-regions.json`
5. treat the prepared draft version bundle as the working folder for the next
   candidate

Do not start from an unrelated scratch folder. In create mode, the prepared
draft bundle under `slide-figures/slide-XX/versions/version-*--<slug>/` is the
official working surface.

## First reads in a new chat

When the user says `draft slide 12`, the first local reads should be:

1. `projects/designer-health/slide-creation.md`
2. the `slide-12` entry in `projects/designer-health/deck-spec.json`
3. `projects/designer-health/designer-deck-template.md`
4. `projects/designer-health/workflow.md`
5. the slide packet and any existing spec paths
6. `projects/designer-health/slide-notes/slide-12/README.md` when it exists

After that, state back to the user:

- what the slide is trying to say
- whether this is truly a first draft or actually a polish request
- which files are about to become the working surface

## Lane choices

`slide:create:prep` and `slide:create:run` use these v1 lanes:

- `html`
  - default first-draft path from the locked shell
- `hybrid`
  - same HTML bootstrap plus extra reference images/files carried into the
    create bundle
- `native`
  - scaffold-only handoff to the current native/spec workflow; v1 does not
    generate a native figure automatically

Use `native` only when the HTML bootstrap is not the right surface for the
slide. Otherwise keep the default `html` lane or use `hybrid` when the user
provides locked references that should shape the first draft.

## Run command

When the scaffold is ready, run:

`npm run slide:create:run -- --slide 12`

That command:

1. reuses the prepared draft or runs prep first
2. snapshots the checked-in create request into the draft bundle
3. for `html` and `hybrid`, runs the create search against the seeded shell
4. carries shell regions forward as approved regions during the create run
5. materializes the winning HTML result into the draft version root
6. writes the create-run ledger and prints the draft version, run dir, status,
   and promote command
7. for `native`, stops after scaffolding and prints the native handoff message
   plus any resolved spec paths

Use `--request-file` only when you intentionally want to override the checked-
in `create-request.md` for this run.

## What gets written

The checked-in request and version-local create artifacts are part of the
contract:

- checked-in request:
  - `slide-notes/slide-XX/create-request.md`
- version-local create artifacts:
  - `versions/version-*--<slug>/create/create-request.snapshot.md`
  - `versions/version-*--<slug>/create/context.json`
- seeded draft surface:
  - `versions/version-*--<slug>/generated.html`
  - `versions/version-*--<slug>/preview.png`
- create-run ledger and winner materialization:
  - `tune/run-*/...`
  - winner HTML/preview materialized at the draft version root

Treat the checked-in request as the durable operator-facing note and the
version-local snapshot/context files as the immutable record of what the draft
actually ran with.

## Promotion boundary

`slide:create:prep` and `slide:create:run` do not make the draft official.

The result stays in `draft` state until there is an explicit promotion with
`slide:versions -- promote`.

Use this boundary:

1. prep the draft
2. run the create search
3. inspect the winning draft version bundle
4. promote only after a human explicitly chooses that draft as the new current
   version

Do not treat Studio “Make Official” as the fast promotion path for this step.
The create workflow produces a draft bundle first; promotion is a separate
explicit action.

## Minimal create checklist

For one new slide first pass:

1. resolve the slide through `deck-spec.json`
2. confirm the request is a first draft, not polish on an existing official
   slide
3. run `slide:create:prep`
4. inspect `create-request.md`, `create/context.json`, and the seeded preview
5. run `slide:create:run`
6. inspect the draft bundle and create-run ledger
7. leave the draft in `draft` state until a human explicitly promotes it
