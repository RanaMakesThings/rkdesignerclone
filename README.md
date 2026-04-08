# rkdesignerclone

Standalone repo for pitch-deck figure generation, stock-image ideation, and
deck prototype tooling.

The repo is intentionally narrow:

- `projects/<project>/` is the project-first home for deck work, prompts,
  source docs, figure specs, and stamped exports.
- `projects/deck-template/` is the reusable starter for a new deck project.
- `projects/figures/` holds reusable figure workflow docs and templates.
- `projects/workspaces/` is optional scratch space for cross-project or
  throwaway prompt experiments.
- `scripts/figures/` holds the HTML/PNG figure pipeline.
- `projects/pitch-deck/` holds deck-specific prototype files.
- `ops-core/` is vendored as a submodule for shared host-repo ops commands.

## Quick start

- `npm install`
- `npm run studio:install`
- `npm run ops-core:init`
- `npm run doppler:init`
- `npm run help`
- `npm run doppler:verify -- --require-value OPENAI_API_KEY`
- `npm run doppler:verify -- --require-value PEXELS_API_KEY`
- `npm run figures:test`
- `npm run gates`

## Choose the Right Workflow

- Canonical workflow routing for operators lives in `docs/agents/tooling.md`.
- New first-draft Designer slide from the locked shell:
  start with `npm run slide:create:prep -- --slide 12`, then use
  `projects/designer-health/slide-creation.md`.
- Existing official Designer slide polish:
  start with `npm run slide:fine-tune:prep -- --slide 3`, then use
  `projects/designer-health/slide-fine-tuning.md`.
- One contained HTML delta on an existing Gemini HTML branch:
  use `npm run gemini:html:tune -- --dir <path> --change-file <path>`.
- Multi-provider HTML edit search on an existing surface:
  use `npm run html:edit:run -- --artifact-dir <dir> --change-file <path>`.
- Fast stamped/current version swap for one slide:
  use `npm run slide:versions -- promote --slide <slide-XX> --version-id <version-YYYYYY>`.
- Studio “Make Official” is a different action:
  it changes selected variant metadata and is not the fast stamped-version
  swap.
- Lightweight figure ideation from a brief:
  use `npm run figures:ideate -- --brief <path>`.
- Strict packet-driven ideation orchestration:
  use `npm run figures:ideation:run -- --input <packet.{yaml,json}> [--profile designer]`.

## Core figure workflow

- Ideation from a brief:
  - `npm run figures:ideate -- --brief projects/<project>/figures/briefs/<brief>.md`
- Packet-driven ideation orchestration:
  - `npm run figures:ideation:run -- --input`
    `scripts/figures/ideation-system/v1.1/examples/slide-09-figure-ideation-input-v0.2.yaml`
    `--profile designer`
- Stock-image search:
  - `npm run figures:images -- --purpose "clinic waiting room scheduling`
    `pressure" --style documentary --copy-safe right`
- Render HTML + SVG + metadata:
  - `npm run figures:render -- --spec projects/<project>/figures/specs/<spec>.json`
- Export a 1920x1080 PNG:
  - `npm run figures:export -- --spec projects/<project>/figures/specs/<spec>.json`
- Run the full review loop:
  - `npm run figures:review -- --spec projects/<project>/figures/specs/<spec>.json`

`figures:ideate` and the default `figures:review` policy auto-select an
available model provider: Anthropic when `ANTHROPIC_API_KEY` is present,
otherwise OpenAI when `OPENAI_API_KEY` is present.

`figures:ideation:run` is the separate v1 orchestration lane. It consumes a
strict YAML/JSON packet, loads canonical prompts and schemas from
`scripts/figures/ideation-system/v1.1/`, writes a durable run bundle under
`DESIGNER_DATA_DIR/runs/<project>/figure-ideation/` by default, and does not
mutate canonical deck state.

## Anthropic tooling

- `npm run anthropic -- messages --model claude-sonnet-4-20250514`
  `--input "List 5 concepts"`

`anthropic` resolves `ANTHROPIC_API_KEY` or `YSN_ANTHROPIC_API_KEY` from the
current environment and is Doppler-wrapped by default.

## Pitch-deck prototype tooling

- Figure workflow docs live in `projects/figures/README.md`.
- New deck projects should start from `projects/deck-template/`.
- Current Designer deck work lives in `projects/designer-health/`.
- Designer Studio local app lives in `apps/studio/`.
- Optional scratch workspaces live in `projects/workspaces/`.
- Deck prototype files live in `projects/pitch-deck/`.
- The PowerPoint outline builder is parameterized:
  - `python3 projects/pitch-deck/rebuild_vox_pitch_deck_outline.py --help`

## Designer Studio

- Install app dependencies:
  - `npm run studio:install`
- Start the local app:
  - `npm run studio:dev`
  - webpack dev mode is used intentionally so file watching stays reliable in worktrees
- Build the app:
  - `npm run studio:build`
- Start the production server:
  - `npm run studio:start`
- Run app lint + build checks:
  - `npm run studio:check`
- Studio is repo-native and read-first:
  - `projects/<project>/deck-spec.json` remains the source of truth
  - the app builds an in-memory manifest from checked-in repo files
  - there is no SQL database or separate official-state registry
- Current first-class routes:
  - `/`
  - `/templates`
  - `/slides/<slideId>`
- Legacy Designer routes redirect into the current slide-browser routes:
  - `/projects/designer-health`
  - `/projects/designer-health/deck`
  - `/projects/designer-health/history`
  - `/projects/designer-health/templates`
  - `/projects/designer-health/slides/<slideId>`
- Current write surface:
  - “Make Official” promotes either a canonical variant or a surfaced discovered
    branch by editing only `deck-spec.json`
  - promotion updates `selectedVariantId` and canonical variant statuses
  - promotion does not rewrite `paths.stampedDir` or move/copy artifacts
  - `npm run slide:versions -- promote --slide slide-06 --version-id version-000028`
    is the fast path for swapping the stamped current version only
  - use “Make Official” when you want the selected variant metadata in
    `deck-spec.json` to change

## Repo layout

- `apps/studio/` — local deck explorer UI
- `docs/` — repo docs and handbook notes
- `projects/` — project roots, figure templates, and pitch-deck prototype assets
- `projects/deck-template/` — reusable starter structure for a new deck
- `projects/designer-health/` — current deck source of truth and stamped slide assets
- `projects/workspaces/` — optional scratch folders for non-project-specific iteration
- `scripts/` — figure pipeline, LLM helpers, and local wrappers
- `ops-core/` — shared ops-core submodule
- `output/` — generated artifacts (gitignored)
