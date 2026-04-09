# Repo Ops Tooling

This trimmed checkout does not vendor the historical `ops-core/` submodule.

## Available local commands

- `doppler:init`: `node scripts/doppler/init.mjs`
- `doppler:verify`: `node scripts/doppler/verify.mjs`
- `doppler:upload`: `node scripts/doppler/upload-env.mjs`
- `doppler:set-admin-token`: `node scripts/doppler/set-admin-token.mjs`
- `ops-core:init`: no-op message; there is no submodule to initialize in this checkout

## Unavailable shared commands

- `zip:repo`
- `pr:from-zip`
- `gh:pr`

These currently return a clear message explaining that the shared `ops-core`
scripts are not vendored here.
