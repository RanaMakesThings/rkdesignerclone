# Designer Slide Fine-Tuning Mode

Use this guide when the user wants to open a fresh Codex chat and work on one
specific Designer deck slide, for example:

- `Let's do some fine tuning on slide 3.`
- `Polish slide 9.`
- `Make a few small tweaks to the official slide 5.`

The goal is to make a new chat slide-local quickly without reloading the full
deck history. The official slide root is manifest-backed: the current selected
version is recorded in `manifest.json`, mirrored into the slide root for
compatibility, and all historical candidates live under
`versions/version-*--<slug>/`. Slide-level notes live under
`slide-notes/<slide-dir>/`, and the detailed one-slide report lives under
`slide-reports/<slide-dir>.html`.

## Fast prep command

When you want the current official slide surface immediately, run:

`npm run slide:fine-tune:prep -- --slide 3`

That command:

1. resolves the official stamped slide from `deck-spec.json`
2. reads the slide manifest to find the current selected version
3. clones the current selected version into a fresh draft bundle when needed
4. refreshes `gemini-html/preview.png` in the draft bundle when the Gemini HTML
   branch exists
5. writes `slide-notes/slide-XX/fine-tune-request.md`
6. prints the key paths you usually want first:
   - official stamped current PNG
   - Gemini HTML preview
   - Gemini HTML source
   - slide report
   - starter change file

Use this when you want the picture and the change scaffold quickly, without
running the full `gemini:html:tune` loop yet.

This guide is a backing contract for the repo. The user should not have to cite
it explicitly. A fresh chat that hears `fine tune slide 3` should enter this
mode automatically.

## What counts as fine-tuning

Use this mode when the requested change is a small delta to an already stamped
slide, such as:

- spacing
- font size
- copy tightening
- color / weight polish
- object size or position
- visibility of one label, line, or callout
- one contained HTML / CSS tweak

Do not use this mode when the request is really:

- a new concept family
- a different figure structure
- a semantic change to the slide thesis
- a change that makes the current selected direction wrong

If the request crosses into those, reopen the normal slide workflow from
`workflow.md`.

## Source of truth order

When a fresh chat starts, use this order:

1. `deck-spec.json`
   This is the canonical resolver for the current official slide.
2. `slide-figures/slide-XX/manifest.json`
   This identifies the current selected version and historical version list.
3. `deck-report.html`
   This is the fastest deck-level view of the current stamped state.
4. `slide-reports/slide-XX.html`
   This is the one-slide detailed report.
5. `slide-notes/slide-XX/README.md`
   This says what won and what is still provisional.
6. `slide-figures/slide-XX/slide-XX--version-YYYYYY.png`
   This is the current official visual mirrored at the slide root.
7. `slide-figures/slide-XX/slide-XX--version-YYYYYY.html` and
   `slide-XX--version-YYYYYY.svg`
   These are the current official mirrored stamped assets.
8. `slide-packets/`, `figures/specs/`, and other checked-in docs
   Use these only after the official stamped layer is understood.

## How to resolve the official slide

For slide `N`:

1. Open the slide entry in `deck-spec.json`.
2. Read:
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
3. Read `manifest.json` inside `paths.stampedDir` to get `currentVersionId`.
4. Treat the selected version bundle under `versions/version-*--<slug>/` as the
   working folder for the next candidate.
5. Do not start from old exploration folders unless the slide note or
   `selectedDirection` explicitly says the selected winner still lives there.

Example:

- if `paths.stampedDir` is `projects/designer-health/slide-figures/slide-09`,
  that folder is the official current slide-09 working surface
- if the current selected version bundle contains `gemini-html/`, that is the
  editable branch inside the official slide history, not a separate winner by
  default

## First reads in a new chat

When the user says `fine tune slide 3`, the first local reads should be:

1. `projects/designer-health/slide-fine-tuning.md`
2. the `slide-03` entry in `projects/designer-health/deck-spec.json`
3. `projects/designer-health/deck-report.html`
4. `projects/designer-health/slide-reports/slide-03.html`
5. `projects/designer-health/slide-notes/slide-03/README.md`
6. `projects/designer-health/slide-figures/slide-03/manifest.json`
7. `projects/designer-health/slide-figures/slide-03/slide-03--version-YYYYYY.png`
8. `projects/designer-health/slide-figures/slide-03/slide-03--version-YYYYYY.html`
   and `slide-03--version-YYYYYY.svg`

After that, state back to the user:

- what the slide is trying to say
- which files are official
- whether the requested tweak is a small delta or a workflow reset

## Lock approved regions

Fine-tuning is not only about the current requested delta. It is also about
not regressing what the user already likes.

Once the user approves a region, treat that region as locked for later passes.

Examples:

- `Top section looks right; only change the bottom half.`
- `Keep the title block and anatomy bar exactly as-is.`
- `Don't touch the right-side payoff; only fix the left callout.`

When that happens:

1. record the approved region in
   `slide-notes/slide-XX/fine-tune-request.md`
2. treat the official stamped current PNG as the regression baseline for that
   region
3. compare the candidate against the official slide before showing it
4. if the approved region drifted, block the pass and fix that before asking
   the user to react to the new version

Do not rely on memory alone. Approved-region locks should be written down in
the fine-tune request file for the current slide.

## Which file to edit

There are two valid fine-tuning surfaces.

### 1. Stamped HTML micro-pass

Use this when:

- the change is a contained visual tweak
- the current selected version bundle contains `gemini-html/generated.html`
- the current official figure is clearly aligned with that HTML branch

Default loop:

1. clone the current selected version into a fresh draft version bundle when the
   change needs a new attempt id
2. edit
   `slide-figures/slide-XX/versions/version-000123--<slug>/gemini-html/generated.html`
3. regenerate
   `slide-figures/slide-XX/versions/version-000123--<slug>/gemini-html/preview.png`
4. inspect the preview, including any locked approved regions
5. if accepted, promote the draft version so the selected bundle becomes the
   current mirrored root state
6. refresh:
   - `slide-reports/slide-XX.html`
   - `deck-report.html` if the visible official state changed

Use `gemini:html:tune` when the change is one concrete HTML delta and the
branch is still an active editable surface.

### Quick in-place HTML loop

Use this instead of creating a new version bundle when:

- the user is already iterating inside a chosen draft version bundle
- the request is a quick HTML/CSS tweak
- the user wants a fast overwrite-and-preview loop rather than archival history

Default loop:

1. edit the existing draft bundle's `generated.html` in place
2. rerender that same bundle's `preview.png`
3. show the updated preview to the user
4. do not allocate a new version id, promote, or refresh deck-wide reports
   unless the user explicitly asks for that workflow step

Execution rule:

- if the user names the exact working draft version and pastes replacement HTML,
  do not spend time re-resolving the slide, re-reading the file, or checking
  surrounding metadata first
- go straight to overwriting the target `generated.html`
- rerender the matching `preview.png`
- return the updated preview
- only do extra validation when the target path is missing or the render fails

Example:

- if the user says `just update version-000270 with this HTML`, overwrite
  `slide-figures/slide-XX/versions/version-000270--<slug>/generated.html`
  and regenerate `preview.png`
- do not stamp `version-000271` unless the user explicitly asks for a new
  candidate

When this mode is active, optimize for turnaround time over ceremony. Keep the
scope to the working draft, and only re-enter the heavier version/promotion
flow when the user asks for a new archived attempt or official selection.

### 2. Native spec rerender

Use this when:

- the official slide is spec-driven
- the change is structural enough that the stamped HTML is no longer the right
  source
- the figure should stay aligned with a canonical JSON spec

Default loop:

1. edit `figures/specs/<spec>.json`
2. run `figures:render`
3. run `figures:export` with version-aware output targeting when you want the
   new render to land in a draft bundle instead of the current root mirror
4. inspect the promoted version bundle and the mirrored
   `slide-figures/slide-XX/slide-XX--version-YYYYYY.png`, including any locked approved
   regions
5. refresh `slide-reports/slide-XX.html`
6. refresh `deck-report.html` if needed

## Minimal fine-tune checklist

For one official slide micro-pass:

1. resolve the official slide from `deck-spec.json`
2. open the stamped slide report, manifest, and current stamped PNG
3. confirm the requested change is a fine-tune, not a concept reset
4. record any user-approved regions in `fine-tune-request.md`
5. choose the right edit surface:
   - stamped HTML micro-pass
   - native spec rerender
6. make the smallest change that solves the request
7. regenerate the preview or export in the draft version bundle
8. inspect for regressions, especially in any locked approved regions
9. promote the draft version when accepted
10. regenerate `slide-reports/slide-XX.html`
11. regenerate `deck-report.html` if the deck-visible state changed
12. commit the tuning pass if it is a real repo change set

## Common failure mode

One easy way to leave fine-tuning mode accidentally is to keep iterating on an
exploration branch after the user has already approved part of the official
slide.

Do not do this.

If the user says to keep one region and change another:

- go back to the official stamped slide
- freeze the approved region
- make the new pass underneath that lock

Do not keep polishing a drifting exploration variant and assume the approved
region stayed the same.

## What must stay in sync

If the tweak changes only polish, you usually do not need to rewrite
`deck-spec.json`.

You must update `deck-spec.json`, `master-slide-specs.md`, `deck-matrix.md`,
and `figure-companion.md` when the fine-tune changes:

- the header
- the subheader
- the takeaway
- the selected direction
- the family
- the build status
- the selected variant

If none of those changed, keep the deck docs stable and just refresh the
stamped slide assets and reports.

## Natural fresh chat prompt

This should work without any extra scaffolding:

```text
Let's fine tune slide 03.
```

If the user wants the assistant to be more explicit up front, this is still a
good opener:

```text
Let's do fine tuning on Designer slide 03.
Start from the official stamped slide, not old exploration branches.
First tell me what the slide is trying to say, which files are official, and
whether this looks like a micro-pass or a bigger reset.
```

## Operator note

The default assumption in this mode is:

- work from the stamped official slide
- make one small change at a time
- keep the deck backbone stable unless the slide meaning actually changed

This mode is about fast, local polish with enough context to stay accurate.
