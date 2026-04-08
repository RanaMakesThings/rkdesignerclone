# Designer Studio

Designer Studio is a read-first Next.js workspace for browsing canonical deck
state, discovered figure work, curated slide/deck assets, slide reports, and
companion documentation from the repo itself.

## Commands

Run the development server from the repo root:

```bash
npm run studio:dev
```

Run the app directly from `apps/studio` if needed:

```bash
npm run dev
```

The dev script uses webpack mode intentionally because it hot-reloads reliably
in local worktrees.

Build and lint the app:

```bash
npm run studio:check
npm --prefix apps/studio run build
```

## Routes

- `/`
- `/templates`
- `/slides/[slideId]`
- `/projects/designer-health`
- `/projects/designer-health/deck`
- `/projects/designer-health/history`
- `/projects/designer-health/templates`
- `/projects/designer-health/slides/[slideId]`

## Notes

- Canonical source of truth stays in project `deck-spec.json` and checked-in
  docs.
- Canonical curated assets live in checked-in asset manifests:
  `projects/<project>/assets/manifest.json` and
  `projects/<project>/slide-assets/<slide-id>/manifest.json`.
- Asset records keep both a semantic `id` and a global numbered `assetId`.
- The app builds project manifests in memory and does not use a database.
- Safe file and report routes only serve repo-allowlisted paths.

## Reference

Read [README.md](/Users/kabeer/Code/rkdesignerclone/README.md) at
the repo root for the broader workflow and command surface.
