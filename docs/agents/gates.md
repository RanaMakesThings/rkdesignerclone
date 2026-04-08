# Gates agent guide

Use this guide for running local checks ("gates") before shipping changes.

## Commands

- Default local gates:
  - `npm run gates`
- Markdown lint:
  - `npm run check`
- Studio app lint + build:
  - `npm run studio:check`

## Notes

- Raw imported source snapshots under `projects/**/inputs/**` are excluded from
  markdown lint. Treat those folders as archival inputs, not as normalized
  repo-authored docs.
- Raw experiment prompt files under `projects/**/experiments/**/prompts/**`
  are excluded from markdown lint. Treat them as operator/model inputs rather
  than handbook-quality prose.
- Version-local create snapshots under
  `projects/**/slide-figures/**/versions/**/create/**` are excluded from
  markdown lint. Treat them as generated workflow records, not hand-edited
  docs.
- The vendored figure ideation spec pack under
  `scripts/figures/ideation-system/**` is also excluded from markdown lint.
  Keep it byte-close to the imported prompt/spec source unless there is a
  deliberate contract edit.
