# Deck Workflow

Project-local workflow for building the SAEM microlearning deck under
`projects/saem-2026/`.

## Core rule

Treat `deck-spec.json` as the canonical current deck backbone.

Treat `designer` as the deck engine and keep all SAEM-specific work local to
this project folder.

Treat the official SAEM PowerPoint template as the final packaging layer, not
the first-draft design surface.

## Practical execution order

1. Lock slide-level copy and thesis in `deck-spec.json` and slide packets.
2. Generate first-pass slide concepts in designer.
3. Review mockups as rendered images, not raw HTML only.
4. Refine one slide family at a time.
5. Export only after the visual family is stable.
6. Apply the final approved deck into the SAEM template.

## Default visual lane

For this project, the default first-pass lane should be:

1. `slide:create:prep`
2. `slide:create:run -- --providers openai,gemini`
3. preview image review
4. `gemini:html:tune` for contained deltas
5. slide report
6. template packaging

## Scope guardrail

Do not modify:

- `projects/machina-health/`
- repo-wide designer workflows
- shared scripts unless a tooling bug blocks SAEM work

If a tooling change becomes necessary, separate it clearly from deck-local
content changes.

## Early project target

Start with one concept-heavy slide before scaling to the full deck:

- preferred first target: `slide-04`
- alternate first target: `slide-02`

Those slides are the best signal for whether the visual language is working.

