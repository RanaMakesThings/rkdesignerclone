# Designer Figure Ideation Spec v1.1

This package is the updated implementation-facing packet for the Designer / Vox slide figure ideation system.

## Runtime truth

The current v1 runtime is deterministic-first.

- Deterministic stages:
  - normalized brief derivation
  - figure brief derivation
  - merge / dedupe / cluster
  - shortlist scoring
  - figure family selection
  - packaging and run-manifest emission
- Model-backed stages:
  - figure move search
  - spatialization
  - thumbnail prompt building
  - thumbnail generation
  - multi-critic review
- Deferred from the public spec in the current runtime:
  - `delta-spec`
  - optional HTML / SVG structural thumbnail generation as a first-class worker

The checked-in config template reflects that truth with explicit `mode:
deterministic` markers for deterministic stages plus stage-owned routing and
fallbacks for model-backed stages.

## What is included

### Main spec
- `designer-figure-ideation-system-spec-v1.1.md`

### Prompt pack
- `prompts/llm-role-prompts-v1.1.md`

### Schemas
- `schemas/figure-ideation-input.schema.json`
- `schemas/build-spec-output.schema.json`
- `schemas/normalized-brief-output.schema.json`
- `schemas/figure-move-candidate-pool.schema.json`
- `schemas/candidate-shortlist.schema.json`
- `schemas/spatial-spec.schema.json`
- `schemas/thumbnail-manifest.schema.json`
- `schemas/critique-report.schema.json`
- `schemas/run-manifest.schema.json`

### Example input
- `examples/slide-09-figure-ideation-input-v0.2.yaml`

### Config template
- `templates/figure-ideation-run-config-v1.1.yaml`

## Biggest additions from v1.0
- model assignment by stage
- deterministic-first stage modes
- state machine / transitions
- thresholds and arbitration
- intermediate artifact contracts
- thumbnail generation contract
- retry and fallback rules
- human-review gates
- run manifest and lineage
- provider fallback chains and critique quorum
- acceptance tests

## Suggested first engineering target
Implement these in order:
1. input validation
2. normalized brief + figure brief
3. multi-LLM move search
4. merge/dedupe/shortlist
5. family selection + spatial spec
6. thumbnail generation contract
7. multi-critic aggregation
8. packaging + run manifest

## Suggested filenames for emitted artifacts
- `slide-XX-build-spec-v0.x.md`
- `slide-XX-figure-critique-v0.x.json`
- `slide-XX-thumbnails-v0.x.json`
- `slide-XX-run-manifest-v0.x.json`
