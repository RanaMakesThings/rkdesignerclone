# Slide Figures

Stamp one folder per slide here.

Each slide directory is manifest-backed:

- the slide root keeps `manifest.json`, `versions/`, and the version-tagged
  current projected assets
- the current selected version is mirrored into the slide root for fast
  browsing and compatibility
- historical and draft attempts live under `versions/version-*--<slug>/`
- slide-level notes and reports belong in sibling `slide-notes/` and
  `slide-reports/` folders, not in the slide root

Example:

- `slide-03/`
  - `slide-03--version-000123.html`
  - `slide-03--version-000123.svg`
  - `slide-03--version-000123.png`
  - `versions/version-000123--draft/`

If the canonical slide number differs from a legacy artifact directory, record
that mismatch in the deck spec and deck matrix. Use `slide:versions` to create,
promote, or migrate the version history when the slide contract changes.
