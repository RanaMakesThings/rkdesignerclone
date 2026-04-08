# AGENTS

## Scope

This repo is the home for pitch-deck figure tooling, deck prototypes, and
design-system experiments.

## Docs

For documentation edits and new docs, follow: `docs/agents/docs.md`.

## Gates

For local checks before shipping, follow: `docs/agents/gates.md`.

## Operator policy

For global operator behavior rules, follow: `docs/agents/operator-policy.md`.
That includes the commit-checkpoint rule: make a new git commit whenever a
turn produces a meaty repo change set.

## Tooling

For local tooling workflows (Doppler, Anthropic, figures, and image search),
follow: `docs/agents/tooling.md`.

## Workflow routing

Workflow selection is canonical in `docs/agents/tooling.md`.

Use that file first for these entrypoints:

- new Designer slide draft:
  `slide:create:*` plus `projects/designer-health/slide-creation.md`
- existing official Designer slide polish:
  `slide:fine-tune:prep` plus `projects/designer-health/slide-fine-tuning.md`
- HTML edit search on an existing surface:
  `html:edit:run` plus `scripts/llm/README.md`
- fast stamped version switch:
  `slide:versions -- promote`
- figure ideation routing:
  `figures:ideate` vs `figures:ideation:run`

## Ops core

For shared `ops-core` submodule wiring and scripts, follow:
`docs/agents/ops-core.md`.

## Change hygiene

If you change tooling/scripts/configs that alter workflows, update the relevant
`docs/agents/*.md` and run `npm run gates`.
