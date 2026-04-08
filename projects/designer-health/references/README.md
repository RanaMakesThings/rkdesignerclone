# Designer References

This directory is the canonical factual-reference store for the Designer
deck.

## Source of truth

- `manifest.json`
  - normalized reference library
  - slide-level usage links
- `generated/running-references.json`
  - machine-readable running appendix output
- `generated/running-references.md`
  - human-readable by-slide rollup
- `generated/references-appendix.html`
  - generated appendix slide artifact

## Workflow

1. Edit or add references in `manifest.json`.
2. Link references to logical slides through `usages[]`.
3. Regenerate outputs with:
   `npm run references:sync -- --project-root projects/designer-health`
4. Review the appendix HTML and the running markdown rollup.

## Notes

- `citationText` is the human-readable appendix line. Running numbers are
  assigned at compile time from active deck order.
- `sourceKeys` preserve the current bracket-marker mapping in
  `deck-spec.json` proof text while the deck still uses imported numeric
  citations like `[1]`.
- `slideId` in `usages[]` should always point to the logical slide id from
  `deck-spec.json`, not a stamped-root alias.
