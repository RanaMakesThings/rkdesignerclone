# Slide Assets

Canonical slide-local assets live here.

- one folder per active slide:
  `slide-01/`, `slide-02/`, ...
- each slide folder owns a checked-in `manifest.json`
- canonical copied asset files live under subfolders inside that slide folder

Use `npm run slide:assets -- add ...` when you want to promote a generated
image or source run into a slide-local canonical asset.
