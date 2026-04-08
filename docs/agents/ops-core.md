# ops-core integration

<!-- managed-by: ops-core-bootstrap-host -->

This repo vendors `ops-core` at `ops-core/` as a git submodule.

## Bootstrap

- Initialize/refresh submodule checkout:
  - `npm run ops-core:init`

## Shared npm script wiring

- `ops-core:init`: `git submodule update --init --recursive ops-core`
- `doppler:init`: `node ops-core/scripts/doppler/init.mjs`
- `doppler:verify`: `node ops-core/scripts/doppler/verify.mjs`
- `doppler:upload`: `node ops-core/scripts/doppler/upload-env.mjs`
- `doppler:set-admin-token`: `node ops-core/scripts/doppler/set-admin-token.mjs`
- `zip:repo`: `node ops-core/scripts/repo/repo-zip.mjs`
- `pr:from-zip`: `node ops-core/scripts/repo/zip-pr.mjs`
- `gh:pr`: `node ops-core/scripts/github/gh-pr.mjs`

## Notes

- Run shared ops commands from the host repo root.
- Keep repo-specific domain tooling local to the host repo.
- If this repo has an `AGENTS.md` or docs index, link this file from there.
