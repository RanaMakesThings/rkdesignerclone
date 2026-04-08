# Slide Assets

Canonical slide-local assets live here.

- one folder per active slide:
  `slide-01/`, `slide-02/`, ...
- each slide folder owns a checked-in `manifest.json`
- canonical copied asset files live under subfolders inside that slide folder

These manifests are referenced from
[deck-spec.json](/Users/kabeer/Code/rkdesignerclone/projects/designer-health/deck-spec.json)
via `paths.assetsManifest`.

Use `npm run slide:assets -- add ...` to promote a generated image or source run
into a slide-local canonical asset.

Each asset record keeps:

- `id`: semantic slug for linkage inside manifests
- `assetId`: global numbered handle such as `asset-000002` for precise
  cross-slide reference
