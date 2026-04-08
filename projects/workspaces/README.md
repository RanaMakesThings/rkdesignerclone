# Workspaces

Tracked home for optional figure experiments that are not yet worth promoting
into a real project root.

Use a workspace when you are:

- trying multiple prompt families
- comparing model outputs
- collecting notes, references, and decisions
- keeping a figure thread together across several sessions
- not ready to promote the direction into the formal figure workflow yet

Use `projects/<project>/` when the direction is stable enough to record as:

- a brief
- an ideation artifact
- a composition artifact
- a render brief
- or a canonical spec

## Layout

Create one folder per experiment:

- `projects/workspaces/<slug>/README.md`
- `projects/workspaces/<slug>/prompts/`
- optional tracked notes such as `notes.md` or `refs.md`

Generated outputs should still live under `output/`.

Raw imported source docs can live under `projects/workspaces/<slug>/inputs/`.
Those `inputs/` folders are archival snapshots and are excluded from markdown
lint.

Each workspace `README.md` should capture:

- what the project is trying to prove
- the current best direction
- which prompts are active
- which output directories matter
- what should be promoted into `projects/<project>/` if the direction wins

## Promotion rule

When a workspace direction stabilizes:

1. copy the winning prompt language into the right figure artifact
2. add or update the canonical spec under `projects/<project>/figures/specs/`
3. keep the workspace as the design log, not as the final source of truth

## Template

Start from `projects/workspaces/_template/`.
