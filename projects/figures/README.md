# Figures

Deck-first figure workflow docs and reusable templates for the HTML figure
pipeline.

Project-specific artifacts should live under `projects/<project>/figures/`.

If you are starting a new deck project from scratch, begin with:

- `projects/deck-template/`

Use `projects/figures/` for:

- reusable workflow docs
- reusable artifact templates
- cross-project figure conventions

If a direction is still exploratory and not yet tied to a project root, keep it
under `projects/workspaces/<slug>/` first.

## Workflow

1. Create an ideation artifact first.
   - Save it under `projects/<project>/figures/ideation/<slug>.md`.
   - Use [`ideation/_template.md`](ideation/_template.md).
   - This is required before drafting the spec.
   - Generate a parallel model candidate set first:
     `npm run figures:ideate -- --brief <path>`
   - When the ideation job needs strict packet validation, multi-provider
     synthesis, thumbnails, critique, and a packaged handoff bundle, use the
     separate v1 orchestrator lane instead:
     `npm run figures:ideation:run -- --input <packet.{yaml,json}> [--profile designer]`
   - The v1 orchestrator loads its canonical prompts, schemas, profiles, and
     config template from `scripts/figures/ideation-system/v1.1/`.
   - Its default output root is
     `DESIGNER_DATA_DIR/runs/<project>/figure-ideation/`, and v1 auto-selects
     winners only inside the run bundle. It does not promote or rewrite
     `projects/<project>/deck-spec.json`.
   - The raw provider artifact lands under `output/figures/ideation/<slug>/`.
   - The checked-in ideation doc should synthesize:
     - Codex's own candidate set
     - the model candidate set
     - the final curated shortlist and selected direction
   - For shortlisted `photo` or `hybrid` directions, require:
     - `imageIntent`
     - `styleIntent`
   - Stock imagery must be considered during ideation, not after layout is
     already chosen.
   - For any brief where `photo` or `hybrid` directions are plausible:
     - include at least one serious photo/hybrid candidate in the synthesis
     - include concrete Pexels query strings for those candidates
     - run `npm run figures:images -- --purpose "<query>"` for shortlisted
       photo/hybrid directions before selecting the final direction
     - record the resulting asset-board paths and a quick keep/discard verdict
   - The artifact should contain 6 to 12 concrete directions, a shortlist, and
     the selected direction.
2. Create a visual-composition artifact for the shortlisted direction.
   - Save it under `projects/<project>/figures/compositions/<slug>.md`.
   - Use [`compositions/_template.md`](compositions/_template.md).
   - This step is required before drafting or revising a spec when the figure
     still needs layout or object-definition work.
   - Treat this as the graphic-designer pass:
     - decide the visual protagonist
     - decide what actual object(s) appear
     - decide exact placement and attachment of text
     - decide whether stock is substrate, inset, or hero object
     - identify the failure mode before rendering
3. Create a render-brief artifact for the finalist directions.
   - Save it under `projects/<project>/figures/render-briefs/<slug>.md`.
   - Use [`render-briefs/_template.md`](render-briefs/_template.md).
   - This step is required when a direction still has unresolved execution
     questions after composition.
   - Treat this as the final visual lock before spec:
     - define the spatial map
     - define the exact object count and content
     - define what copy sits where
     - define the image crop/treatment when using stock
     - define the anti-patterns to reject during render
4. Draft a normalized JSON spec in Codex chat from the render brief.
5. Save it under `projects/<project>/figures/specs/` or another local path.
6. Render and export:
   - `npm run figures:images -- --purpose "clinic waiting room scheduling pressure"`
     `--style documentary --copy-safe right`
   - `npm run figures:assets -- --spec <path>`
   - `npm run figures:images:select -- --dir output/figures/<slug>`
     `--slot <slotId> --candidate <candidateId>`
   - `npm run figures:images:apply -- --spec <path>`
   - `npm run figures:render -- --spec <path>`
   - `npm run figures:export -- --spec <path>`
   - `npm run figures:export -- --spec <path> --no-images`
   - `npm run figures:check -- --spec <path>`
7. Run the named review loop when you want model feedback:
   - `npm run figures:review -- --spec <path>`
   - `npm run figures:review -- --spec <path> --no-images`

Artifacts land under `output/figures/<slug>/`.

Core render artifacts now include:

- `figure.html`
- `figure.svg`
- `figure.png` after `figures:export`

The figure workflow is now:

`brief -> ideation artifact -> composition artifact -> render brief -> spec`

`-> render -> export -> check -> optional review`

More explicitly:

`brief -> Codex ideas + model ideas -> synthesis artifact -> composition`

`-> render brief -> spec`

When a slide could benefit from sourced imagery, the practical loop is:

`brief -> ideation -> shortlisted photo/hybrid queries -> image boards ->`

`selection -> composition -> render brief -> spec -> render`

## V1 families

- `proof_tiles`
- `trend_breakout_banner`
- `segmented_focus_bar`
- `compound_ribbon_day_view`
- `compound_ribbon_before_after`
- `story_to_structure_triptych`
- `story_to_structure_membrane`
- `transformation_flow`
- `artifact_with_zoom_callouts`
- `hero_metric_with_scenarios`

## Spec shape

Each spec uses the normalized contract:

- `meta`
- `chrome`
- `constraints`
- `copyPolicy`
- `media` (optional)
- `body`
- `trace`

`meta.theme` is optional but recommended. The current examples all use `vox`.

See the project-local canonical examples under `projects/<project>/figures/specs/`.

When a figure needs real imagery in the final render, use:

- `media.strategy`
- `media.provider`
- `media.slots`
- `media.slots[].selectedAssetRef`

Legacy `media.selection` still resolves, but the preferred contract is
slot-first selection with `selectedAssetRef`.

Useful fields:

- `placement`
  - placement hook consumed by the renderer such as `background`, `left`,
    `right`, `motif`, or `device`
- `treatment`
  - image treatment such as `mono`, `soft`, or `ink`
- `objectPosition`
  - CSS `object-position` string for crop control
- `opacity`
  - optional opacity override between `0` and `1`

`figures:render` and `figures:export` now resolve `render-assets.json` and
cached approved assets after the asset-selection pass, so photo and hybrid
concepts can render with chosen candidates instead of stopping at the asset
board.

## Media slots

Stock-image discovery prefers explicit `media.slots`, but can auto-suggest
queries from the figure brief when slots are absent.

Each slot declares:

- `id`
- `label`
- `role` (`hero`, `supporting`, `background`, `texture`, `card`, `strip`, or
  `inset`)
- `required` (optional)
- `query`
- `styleTracks` (optional)
- `orientation` (`landscape`, `portrait`, or `square`; optional)
- `color` (optional)
- `moodTags` (optional)
- `styleTags` (optional)
- `subjectTags` (optional)
- `avoidTags` (optional)
- `copySafeZones` (optional)
- `desiredShotType` (optional)
- `desiredPeopleCount` (optional)
- `clutterTarget` (`low`, `medium`, `high`; optional)
- `excludeTerms` (optional; raw negative matches)
- `placement` (optional crop/role hints)
- `treatmentDefaults` (optional image-treatment defaults)
- `selectedAssetRef` (optional applied selection)
- `maxCandidates` (optional, defaults to `6`)
- `placementNote` (optional)

When a spec includes media slots, `figures:assets` writes:

- `assets.json`
- `asset-selection.json`
- `render-assets.json`
- `asset-board.html`
- `asset-board.png`
- cached downloads under `output/figures/.asset-cache/<provider>/<assetId>/`

If a spec does not declare `media.slots`, `figures:assets` auto-suggests a
small candidate set from the figure brief so imagery is still considered during
the generation loop.

If `PEXELS_API_KEY` is available, `figures:export` and `figures:review` also
attempt this asset-search pass automatically as a best-effort step. Pass
`--no-images` when you want to skip that layer.

## Standalone image requests

Use the standalone request flow when you want image candidates without authoring
a figure spec first:

- `npm run figures:images -- --purpose "clinic waiting room scheduling pressure"`
- Optional filters:
  - `--orientation landscape|portrait|square`
  - `--color <value>`
  - `--style <text>`
  - `--mood <text>`
  - `--shot <text>`
  - `--people <text>`
  - `--copy-safe left|right|top|bottom|center`
  - `--provider pexels`
  - `--approved-only`
  - `--reuse-from <deck-or-slug>`
  - `--count <n>`
  - `--slug <slug>`
  - `--out <dir>`
  - `--no-download`

The command writes:

- `assets.json`
- `asset-selection.json`
- `render-assets.json`
- `asset-board.html`
- `asset-board.png`
- cached top candidates under `output/figures/.asset-cache/` when downloads
  are enabled

Lifecycle commands:

- `npm run figures:images:select -- --dir <outputDir> --slot <slotId>`
  `--candidate <candidateId>`
- `npm run figures:images:apply -- --spec <path> [--out <dir>]`
- `npm run figures:images:refine -- --dir <outputDir> [--style <text>]`
  `[--mood <text>] ...`
- `npm run figures:images:report -- --dir <outputDir>`

Default output goes to `output/figures/image-requests/<slug>/`.

## Asset strategy

Every ideation artifact should name one asset strategy for the selected
direction:

- `native`
  - Draw the figure directly in HTML/SVG.
  - Best for calendars, timelines, schedule bars, callouts, and conceptual
    system graphics.
- `photo`
  - Use sourced imagery as the main visual object.
  - Best for reception, scheduling, or clinical-environment photography when
    realism matters more than exact structure.
- `hybrid`
  - Use sourced imagery as substrate and add HTML/SVG overlays.
  - Best when a real photo helps, but the figure still needs explicit framing
    or annotation.

Default to `native` unless the direction clearly benefits from photography.

Photography is worth testing when it adds realism, atmosphere, or emotional
immediacy that a drawn object would struggle to carry. Reject stock directions
that feel generic, staged, or unrelated to the actual system constraint.

The stock-image system is curated-first:

- discovery produces candidates
- selection approves or rejects them
- apply writes the approved refs into the spec
- render/export consume cached approved assets

Do not auto-insert a discovered image into the final figure unless it has been
approved.

## Design system

The current house style is defined in:

- [`scripts/figures/themes/vox.mjs`](../../scripts/figures/themes/vox.mjs)

Treat the theme as a starting point, not a hard visual prison.

- Use the house style by default for consistency.
- In ideation, composition, or render-brief stages, it is acceptable to propose
  slide-level visual deviations when the concept would clearly benefit.
- Typical allowable deviations:
  - one accent color
  - stronger contrast treatment
  - alternate line/card treatment
  - more editorial photo treatment
- Any deviation should still be explicit in the artifact chain:
  - why the baseline theme is insufficient
  - what visual move is being introduced
  - where the accent or alternate treatment is allowed
  - what the failure mode is if the variation goes too far

Overview notes live in:

- [`docs/handbook/figure-design-system.md`](../../docs/handbook/figure-design-system.md)
