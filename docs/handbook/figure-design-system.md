# Figure Design System

This is the thin design-system layer for the HTML figure pipeline.

It is intentionally not a product UI system. Its job is simpler:

1. Keep pitch-deck figures visually consistent.
2. Give Codex one stable house style when turning briefs into figures.
3. Make future tuning happen in one place instead of inside every renderer.

## Source of truth

- Theme resolver:
  [`scripts/figures/themes/index.mjs`](../../scripts/figures/themes/index.mjs)
- Current Vox theme:
  [`scripts/figures/themes/vox.mjs`](../../scripts/figures/themes/vox.mjs)
- Shared HTML shell:
  [`scripts/figures/lib/template.mjs`](../../scripts/figures/lib/template.mjs)
- Family renderers:
  [`scripts/figures/lib/renderers.mjs`](../../scripts/figures/lib/renderers.mjs)
- Designer shared CSS:
  [`projects/designer-health/design-system/vox-shared.css`](../../projects/designer-health/design-system/vox-shared.css)
- Designer style preview shell:
  [`projects/designer-health/design-system/style-preview.html`](../../projects/designer-health/design-system/style-preview.html)
- Raw seeded preview source:
  [`projects/designer-health/design-system/style-preview.source-locked.html`](../../projects/designer-health/design-system/style-preview.source-locked.html)

## What belongs in a theme

Themes should own:

- typography
- color tokens
- spacing and chrome padding
- radii
- shared card / chip / callout treatments
- deck-stage and slide-shell backgrounds

Themes should not own:

- figure-family structure
- copy rules
- prompt parsing
- coverage logic

Those belong to the spec, renderer family, and checker layers.

## Current approach

V1 uses a single explicit theme, `vox`.

Designer also now has a project-scoped shared CSS workflow for imported and
normalized slide HTML:

- raw baked HTML is preserved as `source-locked.html`
- working HTML links the shared stylesheet as `generated.html`
- exported slide HTML is rewritten back to standalone by inlining the shared CSS
- Studio `/styles` is the live edit and upload surface for the master CSS file

Specs can set:

- `meta.theme`

If omitted, the resolver falls back from `deckId` to the default `vox` theme.

## How to change the house style

If figures feel off, change the theme first before touching family renderers.

Good theme-level changes:

- display font
- accent color
- slide shell background
- shared chip or callout style
- padding rhythm

Only change a renderer when the issue is specific to one family’s layout.

## Shared-CSS workflow

Use this path when the slide HTML already exists and the goal is to separate
the reusable design system from slide-local CSS.

1. Update the checked-in master stylesheet in Studio `/styles` or directly in
   `projects/designer-health/design-system/vox-shared.css`.
2. Seed or revise `style-preview.html` so the shared system has one stable
   review surface.
3. Import external HTML with `slide:versions import-html`, or convert an
   existing bundle with `slide:versions normalize-css`.
4. Keep any ambiguous slide-specific CSS inline in the version-local
   `generated.html` until it is clearly safe to promote into the shared file.

## If we add another deck later

Add one new theme module and keep the same family renderer set when possible.

That keeps the system small:

- same spec contract
- same families
- different deck grammar
