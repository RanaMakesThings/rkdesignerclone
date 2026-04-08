# Operator policy

Global behavior rules for Codex operators in this repo.

## Single-source behavior rule

- Any normative agent behavior instruction must live in exactly one canonical
  policy file.
- Other files may reference that canonical file, but must not restate, modify, or
  partially duplicate the instruction.
- If duplicates or conflicts are found, keep the canonical source and remove the
  others.
- Behavior changes must be made in the canonical file only.

## Canonical locations

- Markdown formatting rules:
  - `docs/markdown/formatting.md`

## Secrets and env injection

- If a root npm script requires secrets, prefer wrapping it with
  `node scripts/doppler/run.mjs -- <command> [args...]` so secrets are loaded
  from Doppler by default.

## Commit checkpoints

- When a turn produces a meaty repo change set, create a new git commit instead
  of letting the work accumulate indefinitely in the working tree.
- Treat changes as meaty when they materially alter project structure, workflow,
  tooling, rendering behavior, or a slide/figure source of truth.
- Before committing, make sure any required docs are updated and run the
  relevant local gates.
