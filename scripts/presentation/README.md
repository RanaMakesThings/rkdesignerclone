# Illustrator handoff export

CLI-first export pipeline for the current selected Designer deck.

V1 is Illustrator-first, not presentation-first. The primary deliverables are:

- a reusable packet with normalized sources and browser-rendered references
- per-slide PDFs plus a bundled `deck.pdf`
- trusted pass-through `editable.svg` files only when a slide already has a
  verified full-slide SVG surface

`slides:export:pptx` still exists as a legacy adapter, but it is not the
primary workflow for this cycle.

## Commands

- Build a reusable packet:
  `npm run slides:export:packet -- --project designer-health --out`
  `output/design-export/designer-packet`
- Build per-slide PDFs plus a bundled deck PDF:
  `npm run slides:export:pdf -- --project designer-health --out`
  `output/design-export/pdf`
- Rebuild PDFs from an existing packet:
  `npm run slides:export:pdf -- --packet output/design-export/designer-packet`
  `--out output/design-export/pdf`
- Export trusted pass-through SVG handoffs:
  `npm run slides:export:svg -- --packet output/design-export/designer-packet`
  `--out output/design-export/svg`
- Run handoff QA against an existing packet:
  `npm run slides:export:qa -- --packet output/design-export/designer-packet`
- Run the export test suite:
  `npm run slides:export:test`

## Packet contract

Top-level packet outputs:

- `manifest.json`
- `slides/<NN>-<slug>/...`

Top-level manifest fields include:

- `packetVersion`
- `projectId`
- `generatedAt`
- `slideCount`
- `paths.deckPdf`
- `paths.qaReport`

Per-slide manifest fields include:

- `repoSlideId`
- `displayNumber`
- `title`
- `canonicalParam`
- `currentVersionId`
- `sourceClass`
- `wrapperAssetKind`
- `mode`
- `viewport`
- `warnings`
- `dependencyFreezeStatus`
- `illustratorReadiness`
- `qa`

Per-slide packet outputs:

- `source-preview.*` when a current preview exists
- `source.html` when a current HTML surface exists
- `source.svg` when a current SVG surface exists
- `visual.svg` when a trusted pass-through SVG surface exists
- `normalized.html` for HTML-backed slides
- `flattened.png`
- `preview.png`
- `background.png`
- `text-layers.json`
- `dependencies.json`
- `qa.json`
- `qa-surrogate.png`
- `qa-diff.png`

Local relative assets referenced by HTML are copied into `assets/`.
Remote CSS/font/CDN references are recorded in `dependencies.json`.

## Source classes and modes

Packet source classes:

- `html_dom`
- `html_wrapper_asset`
- `html_asset_heavy`
- `preview_only`

Export modes:

- `pdf_primary`
  DOM-backed slide; PDF is the primary Illustrator handoff
- `wrapper_svg_passthrough`
  packet carries a trusted full-slide `visual.svg` and `slides:export:svg`
  copies it through as `editable.svg`
- `raster_fallback`
  preview-backed slide; PDF falls back to a raster-backed page and no editable
  SVG is emitted

## Current behavior

- Public deck numbering is canonical.
- Packet export resolves the currently selected Designer slides through
  `deck-spec.json`.
- PDF export is the default handoff for HTML-backed slides.
- SVG export is intentionally narrow in v1:
  it only passes through trusted full-slide SVG assets and does not attempt a
  general HTML-to-SVG compiler.
- QA renders exported PDF and SVG handoffs back to PNG and compares them
  against `flattened.png`.

## Known limits

- The packet is not guaranteed to be fully offline or font-embedded.
- Remote CSS/font/CDN dependencies are recorded, but not fully snapshotted in
  v1.
- Existing `foreignObject` SVG assets are not treated as editable SVG
  handoffs.
- PPTX export is legacy and compatibility-first:
  complex visuals still bake into `background.png`.
