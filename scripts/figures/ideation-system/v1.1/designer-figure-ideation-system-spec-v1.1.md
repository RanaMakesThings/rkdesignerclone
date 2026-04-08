# Designer Figure Ideation System Spec v1.1

## Purpose

This document specifies an **end-to-end, implementation-facing system** for turning a **versioned slide concept-spec** into:

- a normalized brief
- a figure brief
- a multi-model figure move search
- a scored and deduped candidate pool
- a selected figure family
- one or more spatial specs
- a rough thumbnail set
- a multi-model critique report
- a versioned build-spec artifact
- a run manifest with lineage and exit state

This spec is designed to be handed directly to an implementation agent or developer.

It assumes the upstream strategic work may happen elsewhere. The system begins once a slide already has enough meaning locked to make visual ideation productive.

---

## What changed in v1.1

This version carries forward the v1.0 workflow, but adds the missing implementation-critical layers:

- explicit **model assignment by stage**
- explicit **parallelism rules**
- explicit **state machine and transition rules**
- explicit **merge / dedupe / arbitration policy**
- explicit **score thresholds**
- explicit **thumbnail generation contract**
- explicit **failure / retry / fallback rules**
- explicit **human-review gates**
- explicit **artifact lineage and run manifest requirements**
- explicit **acceptance tests**
- expanded **schemas** for intermediate artifacts

The goal of v1.1 is to make the system buildable **cold**, without depending on a follow-up chat.

---

## System boundary

## What this system is for

Use this system when:

- a slide already has a defined job in the deck
- a versioned `concept-spec` already exists or can be produced upstream
- the remaining problem is: **what is the figure, how should it be arranged, which candidate should win, and what artifact should be handed to the builder?**

This system is especially useful for:

- wedge-selection slides
- category-defense slides
- mechanism slides
- artifact-reveal slides
- proof-path slides that need a stronger visual argument

## What this system is not for

This system is not primarily for:

- first-principles company positioning
- deck-level strategy resets
- long-form writing
- generic “make this prettier” tasks
- final pixel-polish
- final production rendering
- automatic investor narrative generation from scratch

Those may exist elsewhere in the deck workflow.
This system starts once there is enough strategic clarity to make ideation productive.

---

## Core operating philosophy

### 1. Truth before design
The slide’s strategic meaning must be locked before the system tries to visualize it.

### 2. Cleverness gets its own stage
There is a real difference between:

- knowing what the slide means
- knowing what family of figure it should be
- finding a smart way to show it

The “smart way to show it” step is formalized as **figure move search**.

### 3. Layout is downstream of figure logic
The pipeline must move through:

- concept-spec
- normalized brief
- figure brief
- figure move search
- clustering / scoring / shortlist
- family selection
- spatial spec
- thumbnail generation
- critique
- packaging

### 4. Search, do not hallucinate one answer
The correct behavior is:

- generate multiple candidates
- normalize them into a comparable form
- evaluate them against a rubric
- advance 1–3 winners into rough visualization
- select a winner with explicit reasoning

Not:

- produce one magical figure in a single shot

### 5. One loop must end in a saved artifact
A good conversation is not enough.
Every run must emit a versioned artifact set.

---

## Entry assumption

The default entry point is a saved artifact of type:

- `concept-spec`

A valid concept-spec should already include:

- metadata
- slide number
- working title
- version
- status
- slide job
- audience should leave believing
- core claim
- text-first slide
- compressed slide
- figure burden
- figure logic
- must-not-become list
- keep/change from current version
- unresolved questions
- next action

If upstream clarity is insufficient, the system should stop and emit `insufficient_upstream_clarity`.

---

## High-level architecture

The system has five layers.

### Layer A — Upstream strategic lock
Usually handled elsewhere.
Produces:
- `truth-lock`
- `concept-spec`

### Layer B — Figure ideation
Handled by this system.
Produces:
- normalized brief
- figure brief
- figure move candidates
- ranked shortlist
- selected family
- spatial specs

### Layer C — Visual candidate generation
Handled by this system.
Produces:
- thumbnail prompts
- rough thumbnail renders and/or structured thumbnail plans
- thumbnail manifest

### Layer D — Evaluation
Handled by this system.
Produces:
- critic reports
- aggregate ranking
- winner selection
- reopen / retry / human-review decisions

### Layer E — Packaging
Handled by this system.
Produces:
- build-spec
- critique report
- deferred `delta-spec` placeholder only, not a required runtime artifact in v1
- run manifest
- updated status and next action

---

## Canonical end-to-end pipeline

### Stage 0 — Receive input packet
### Stage 1 — Validate and normalize input
### Stage 2 — Derive normalized brief
### Stage 3 — Derive figure brief
### Stage 4 — Multi-model figure move search
### Stage 5 — Merge, dedupe, and cluster candidates
### Stage 6 — Score, rank, and shortlist
### Stage 7 — Select figure family
### Stage 8 — Write 1–3 spatial specs
### Stage 9 — Build thumbnail prompts and rough candidates
### Stage 10 — Multi-model critique loop
### Stage 11 — Aggregate critics and decide next state
### Stage 12 — Write build-spec and related artifacts
### Stage 13 — Emit run manifest and exit state

---

## Model assignment and orchestration

This is the section that makes the plan executable.

The system must explicitly separate:

- **text ideation**
- **image generation**
- **vision critique**
- **deterministic orchestration**

Exact model IDs should live in config, but the provider families and role assignments should be fixed in the system design.

## Stage-by-stage role assignment

### Stage 0–3: Validation, normalization, interpretation
**Mode:** deterministic  
**Default worker count:** 0 model workers  
**Worker type:** orchestrator / validation code

Purpose:
- validate packet shape
- restate locked meaning
- derive normalized brief
- derive figure brief

Current runtime note:
- these stages are derived programmatically from the packet
- interpretation and brief-derivation prompt sections are reference-only in v1

### Stage 4: Figure move search
**Mode:** multi-LLM parallel  
**Default worker count:** 2 required, 3 optional  
**Worker type:** text ideators

Required provider families:
- one OpenAI text/reasoning ideator
- one Anthropic text ideator

Optional third worker:
- one Google text ideator for broader search

Per-worker output:
- 5–8 candidate figure moves

Important rule:
The figure move search stage is **not** handled by image models.
It is handled by multiple text ideators in parallel.

### Stage 5: Merge / dedupe / cluster
**Mode:** deterministic_first  
**Default worker count:** 0 model workers  
**Worker type:** orchestrator

Purpose:
- canonicalize candidate names
- detect semantic duplicates
- cluster similar moves into families
- produce a deduped candidate pool

Recommended behavior:
- use rule-based normalization first
- do not require a merger model in the default runtime

### Stage 6: Candidate scoring and shortlist
**Mode:** deterministic  
**Default worker count:** 0 model workers  
**Worker type:** scoring engine

Purpose:
- apply rubric weights
- rank candidates
- choose top 2–3 to advance

Current runtime note:
- shortlist advancement is deterministic weighted scoring plus thresholds
- selector-model routing is deprecated in v1

### Stage 7: Figure family selection
**Mode:** deterministic  
**Default worker count:** 0 model workers  
**Worker type:** orchestrator

Purpose:
- assign family labels
- confirm winning family
- explain why runner-up families lose

Current runtime note:
- family selection is derived from the shortlisted candidate set
- selector-model routing is deprecated in v1

### Stage 8: Spatial spec generation
**Mode:** text generation  
**Default worker count:** 1–2  
**Worker type:** spatializer

Purpose:
- translate winning figure move into 1–3 buildable spatial specs

Recommended provider families:
- one OpenAI or Anthropic spatializer
- optional second spatializer in exploratory mode

Runtime requirement:
- use ordered provider fallback (`primary`, then `fallbacks`)
- if the primary spatializer fails, the stage must attempt the configured fallback chain

### Stage 9: Thumbnail generation
**Mode:** multi-generator parallel  
**Default worker count:** 2 required  
**Worker type:** image generators or structured thumbnail planners

Default provider families:
- OpenAI image generator
- Google Gemini image generator

Important rule:
If image generation is enabled, **OpenAI + Gemini** should both be used by default for rough candidate generation.
If image generation is disabled, the system must still produce a thumbnail manifest with 3–6 structural directions.

Current runtime note:
- local HTML / SVG structural generation is deferred in v1
- the supported fallback path is textual thumbnail planning, not a separate structural worker

### Stage 10: Critique loop
**Mode:** multi-critic vision parallel  
**Default worker count:** 3 required  
**Worker type:** vision critics

Default provider families:
- OpenAI vision critic
- Anthropic Claude vision critic
- Google Gemini vision critic

Each critic must score the same rubric.

Important rule:
The critique loop must be multi-critic by default.
Do not collapse critique to a single provider unless the run mode explicitly requires it.

Runtime requirement:
- critique should run with whatever configured critics are actually available
- if completed critics fall below quorum, the run should package as `human_review_required`

### Stage 11–13: Aggregation, packaging, manifest
**Mode:** deterministic  
**Default worker count:** 0 model workers  
**Worker type:** orchestrator

Purpose:
- aggregate critic results
- decide promotion / retry / reopen / human review
- write build-spec
- write run manifest
- version outputs

Current runtime note:
- packaging is resolved from the actual winning thumbnail lineage
- `selected_thumbnail_id`, `selected_spatial_spec_id`, and `selected_candidate_id`
  must agree
- if winner lineage cannot be resolved unambiguously, the run must fail rather
  than package the wrong branch

---

## Run modes

Run modes control cost, exploration, and automation.

### `strict`
Use when:
- the starting hypothesis is strong
- slide family is already mostly known
- you want safer results

Defaults:
- 2 ideators
- 2 thumbnail generators
- 2 critics allowed only if 3rd unavailable
- shortlist_count = 2
- thumbnail_count = 3
- no high-risk figure moves
- stronger adherence to starting hypothesis

### `standard`
Default mode.

Defaults:
- 2 ideators required, 3rd optional
- 2 thumbnail generators required
- 3 critics required
- shortlist_count = 3
- thumbnail_count = 4–6
- moderate exploration

### `exploratory`
Use when:
- the slide is strategically clear but visually unresolved
- the current figure is clearly weak
- a broader search is desired

Defaults:
- 3 ideators
- 2–3 thumbnail generators
- 3 critics
- shortlist_count = 3
- thumbnail_count = 6–8
- allow one high-risk candidate family

### `high_confidence`
Optional additional mode.
Use when:
- automated promotion should only happen with strong agreement

Defaults:
- 3 ideators
- 3 critics mandatory
- higher thresholds
- human-review gates trigger more often

---

## Input packet contract

The system accepts a `figure-ideation-input` packet.

Required inputs:
- concept-spec-derived meaning
- slide metadata
- slide copy snapshot
- figure requirements
- starting hypothesis
- requested outputs

Strongly recommended:
- current slide screenshot
- template file
- adjacent slide references
- current visual context
- design constraints
- provider preferences
- orchestration overrides

Optional:
- reference figures
- editable HTML
- prior critique report
- prior build-spec
- run notes

If the packet includes a proposed figure direction, treat it as a **starting hypothesis**, not a fixed answer.

---

## Intermediate artifact contracts

To make the system end-to-end, every major stage should have a machine-readable artifact.

### Required intermediate artifacts

#### 1. normalized-brief
Produced after interpretation.
Contains:
- normalized meaning
- contradictions
- warnings
- interpretation confidence

#### 2. figure-brief
Produced after figure burden derivation.
Contains:
- figure burden summary
- figure logic
- what viewer sees first
- what must be shown spatially
- sparse vs dense guidance

#### 3. figure-move-candidate-pool
Produced after ideation + merge.
Contains:
- raw candidates
- deduped candidates
- cluster assignments
- family guesses

#### 4. candidate-shortlist
Produced after scoring.
Contains:
- rubric scores
- weighted totals
- shortlist
- reasons for promotion / rejection

#### 5. spatial-spec
Produced after family selection.
Contains:
- 1–3 spatial specs
- element inventory
- region map
- viewer order
- text load vs figure load

#### 6. thumbnail-manifest
Produced after thumbnail generation.
Contains:
- thumbnail ids
- source candidate ids
- generator metadata
- file paths or textual manifest
- prompt hash

#### 7. critique-report
Produced after multi-critic evaluation.
Contains:
- per-critic reports
- aggregate scores
- disagreement analysis
- winner
- next action
- reopen / retry / human-review flags

#### 8. build-spec
Primary handoff artifact.
Contains:
- selected move
- selected family
- selected thumbnail
- spatial spec summary
- copy recommendation
- keep/remove list
- unresolved items
- builder handoff notes

#### 9. run-manifest
Top-level lineage artifact.
Contains:
- run id
- parent artifact ids
- model routing
- thresholds used
- state transitions
- emitted files
- final exit state

---

## Validation rules

The system must validate input before ideation.

### Hard fail conditions
Emit `insufficient_upstream_clarity` if:
- slide_job missing
- core_claim missing
- audience belief missing
- figure burden missing and cannot be reliably inferred
- slide meaning internally contradicts itself
- must-not-become guardrails missing and cannot be inferred
- requested outputs are empty

### Soft warning conditions
Proceed with warnings if:
- compressed slide is weaker than text-first
- starting hypothesis conflicts with current change list
- current visual context missing
- adjacent-slide references missing
- template file missing
- prior build-spec absent

### Validation output
The validator must return:
- valid: boolean
- hard_errors: array
- soft_warnings: array
- inferred_fields: array
- recommended_run_mode

---

## Figure move search

This is the first explicitly creative stage.

### Definition
A **figure move** is the smart visual move that makes the claim feel obvious, memorable, or inevitable.

It is not the final layout.

### Required behavior
Each ideator returns 5–8 candidates.
Across the combined pool, the system must preserve:
- one conservative candidate
- at least two materially different alternatives
- one high-risk candidate only in exploratory mode

### Candidate fields
Each candidate must include:
- candidate_id
- move_name
- one_sentence_logic
- what_makes_it_smart
- viewer_sees_first
- fits_slide_because
- failure_mode
- predicted_scores:
  - job_fidelity
  - clarity
  - distinctness
  - collapse_resistance
  - buildability

### Diversity constraint
If combined candidate diversity is too low, the orchestrator must rerun one ideator with stricter diversity instructions.

### Same-candidate syndrome
If 70% or more of candidates reduce to the same move after clustering, emit `low_diversity_warning` and rerun with broadened search.

---

## Merge, dedupe, and clustering policy

This stage needs explicit arbitration.

### Deterministic normalization
Normalize candidate names by:
- lowercasing
- stripping stylistic wording
- canonicalizing known family labels
- extracting primary contrast pattern

### Semantic dedupe
Two candidates are duplicates if:
- they share the same primary contrast
- they share the same figure family
- and their one-sentence logic differs only stylistically

### Clustering dimensions
Cluster by:
- figure family
- contrast mechanism
- abstraction level
- density pattern
- text reliance
- risk profile

### Tie handling
If two candidates are near-identical but one is clearly more buildable, keep the more buildable one and record the merge.

### Merge artifact requirement
The dedupe stage must emit a machine-readable candidate map:
- raw_candidate_id
- canonical_candidate_id
- merge_reason
- cluster_id

---

## Scoring and shortlist policy

Candidates must be scored against a weighted rubric.

### Candidate scoring dimensions

#### Job fidelity (0–10)
Does this candidate actually do the slide’s job?

#### Audience-belief fidelity (0–10)
Would this candidate help the audience leave with the intended belief?

#### Figure-burden fit (0–10)
Does the move visually carry the required burden?

#### Two-second clarity (0–10)
Can the point be grasped quickly?

#### Distinctness from adjacent slides (0–10)
Does it avoid looking like nearby slides?

#### Category-collapse resistance (0–10)
Does it resist sounding like documentation, intake, summary generation, or generic AI assist?

#### Elegance / restraint (0–10)
Does it fit the deck’s tone?

#### Buildability (0–10)
Can it actually be built cleanly?

### Default weights
- job_fidelity: 0.20
- audience_belief_fidelity: 0.10
- figure_burden_fit: 0.18
- two_second_clarity: 0.18
- distinctness: 0.10
- collapse_resistance: 0.14
- elegance_restraint: 0.05
- buildability: 0.05

These can be overridden by run config.

### Shortlist thresholds
- Auto-reject if job_fidelity < 7
- Auto-reject if figure_burden_fit < 7
- Auto-reject if collapse_resistance < 6
- Shortlist target = top 2–3 candidates

### Auto-win rule
Advance only one candidate if:
- weighted_total >= 8.7
- and runner-up is at least 0.8 lower
- and no critic flag from earlier validation warns against it

Otherwise shortlist 2–3.

---

## Figure family selection policy

The family selector must assign a figure family to the shortlisted candidates.

### Family labels
Canonical family labels:
- pull-out / magnification
- territory comparison
- density vs whitespace
- workbench / reasoning surface
- staged emergence
- hero object with supporting field
- clustered ecosystem vs singular position
- sequence with emphasized zone
- matrix / map-like field
- layered stack

### Selection rules
Choose the family that:
- best matches the figure burden
- best supports the winning move
- most clearly resists must-not-become failures
- is distinct from adjacent slide families
- remains buildable in the deck style

### Family-selection fail condition
If no family can clearly support the shortlisted move, emit `family_selection_failure` and route back to Stage 4 or 6 depending on cause.

---

## Spatial spec policy

The spatializer writes 1–3 spatial specs.

### Required spatial spec fields
- spatial_spec_id
- source_candidate_id
- selected_family
- visual_anchor
- viewer_order
- regions
- density_map
- accent_usage
- text_load
- figure_load
- literal_vs_abstract_guidance
- element_inventory
- keep_remove
- buildability_risk

### Required region fields
Support at least:
- top
- left
- center
- right
- bottom
- protected_whitespace

### Protected whitespace rule
If the slide is tagged sparse, the spatializer must explicitly preserve whitespace zones.

### Multi-spec behavior
If shortlist_count > 1, produce at least one spatial spec per shortlisted candidate unless cost mode forbids it.

---

## Thumbnail generation contract

This stage was under-specified in v1.0 and is now explicit.

### Inputs
- selected spatial specs
- template constraints
- copy snapshot
- design constraints
- asset references
- provider-specific prompt templates

### Outputs
- 3–6 rough thumbnails total
- or 6–8 in exploratory mode
- machine-readable thumbnail manifest
- file outputs or structured textual thumbnails

### Default generator assignment
- OpenAI image generator: 2–3 candidates
- Gemini image generator: 2–3 candidates
- optional HTML / SVG generator: 1–2 candidates in structural mode

### Thumbnail generation rules
- low fidelity first
- respect slide template header area unless explicitly overridden
- preserve the chosen move while varying layout behavior
- vary one meaningful dimension at a time:
  - anchor position
  - dense zone placement
  - contrast mechanism
  - label placement
  - degree of abstraction
  - whitespace protection

### Thumbnail content rules
Each thumbnail should state:
- whether it uses real copy or placeholder copy
- whether text is expected to be legible
- whether images are literal, abstract, or hybrid
- whether real icons / photographs are used

### Minimum thumbnail set
At least one candidate should represent each of:
- safest buildable option
- strongest strategic option
- cleanest sparse option

### Thumbnail fail condition
If all thumbnails are near-cosmetic variations of one layout, emit `thumbnail_diversity_failure` and regenerate.

---

## Critique loop

This stage must be multi-critic by default.

### Inputs
- normalized brief
- figure brief
- shortlisted candidates
- spatial specs
- thumbnails
- current draft if available
- adjacent slide references if available

### Required critics
- OpenAI vision critic
- Claude vision critic
- Gemini vision critic

### Critique rubric
Each critic must score:
- two_second_clarity
- strategic_fidelity
- figure_burden_fit
- adjacent_slide_distinctness
- collapse_resistance
- elegance_restraint
- visual_balance
- build_feasibility
- investor_readability

### Critique outputs per thumbnail
- overall_score
- top_strength
- top_weakness
- keep
- remove
- exact_revision
- confidence

### Aggregate outputs
- ranked_list
- winner
- why_winner_wins
- disagreement_score
- reopen_upstream_truth: boolean
- human_review_required: boolean
- next_action

---

## Critic aggregation and arbitration policy

This is another section that needed to be explicit.

### Aggregate score
Use the mean of per-critic overall scores.

### Disagreement score
Compute disagreement as:
- max(score) - min(score)
- plus qualitative disagreement flags if winner choice differs

### Disagreement thresholds
- disagreement_score < 1.0 = acceptable
- 1.0–1.9 = mild disagreement
- 2.0–2.9 = significant disagreement
- >= 3.0 = high disagreement

### High disagreement behavior
If disagreement >= 3.0:
- set `human_review_required = true`
- do not auto-promote a winner unless one thumbnail still clears the auto-win threshold and at least 2 critics rank it first

### Reopen-upstream trigger
If all thumbnails score below 7.0 on strategic_fidelity or figure_burden_fit, set `reopen_upstream_truth = true`.

### Retry-without-reopen trigger
If strategic fidelity is strong but build feasibility is low, rerun Stage 8–9 rather than reopening upstream truth.

### Thumbnail auto-win threshold
A thumbnail can auto-win if:
- aggregate overall_score >= 8.3
- and no critic gives collapse_resistance below 7
- and disagreement_score < 2.0
- and no human-review gate is triggered

---

## State machine and transition rules

This is the core runtime logic.

### States

#### `received`
Input packet accepted.

#### `validated`
Packet has passed hard validation.

#### `normalized`
Normalized brief and figure brief exist.

#### `ideated`
Candidate pool exists.

#### `shortlisted`
Shortlist exists.

#### `spatialized`
Spatial spec exists.

#### `thumbnailed`
Thumbnail manifest exists.

#### `critiqued`
Critique report exists.

#### `reopen_upstream_truth`
System has determined that upstream truth must be revisited.

#### `retry_ideation`
System has determined that ideation quality/diversity is insufficient.

#### `retry_thumbnails`
System has determined that thumbnail generation should be rerun without changing the winning move.

#### `human_review_required`
System needs a human decision.

#### `packaged`
Build-spec and run manifest written.

#### `failed`
Run terminated due to unrecoverable error.

### Transition rules

`received -> validated`
if hard validation passes

`received -> failed`
if packet unreadable or required fields absent

`validated -> normalized`
always

`normalized -> ideated`
if interpretation confidence >= threshold

`normalized -> failed`
if interpretation confidence too low and fallback interpretation also fails

`ideated -> retry_ideation`
if candidate diversity too low or all candidates fail thresholds

`ideated -> shortlisted`
if 2–3 viable candidates exist

`shortlisted -> spatialized`
always

`spatialized -> thumbnailed`
if spatial specs valid

`thumbnailed -> retry_thumbnails`
if thumbnail diversity too low or outputs malformed

`thumbnailed -> critiqued`
if thumbnail set valid

`critiqued -> reopen_upstream_truth`
if strategic fidelity or figure burden fit are too weak across all options

`critiqued -> retry_thumbnails`
if move is good but thumbnails weak

`critiqued -> human_review_required`
if critic disagreement high or tie unresolved

`critiqued -> packaged`
if winner meets thresholds and no gate blocks auto-promotion

`human_review_required -> packaged`
after human selection recorded

`any -> failed`
if fatal provider / validation / persistence failure exceeds retry budget

---

## Failure handling and retries

### Failure classes
- insufficient_upstream_clarity
- provider_timeout
- malformed_structured_output
- empty_response
- duplicate_candidate_collapse
- thumbnail_generation_failure
- thumbnail_diversity_failure
- critique_incomplete
- persistence_failure
- schema_validation_failure

### Retry policy by failure class

#### provider_timeout
- retry same provider once
- then fallback provider if available
- then partial-complete if stage policy permits

#### malformed_structured_output
- one repair attempt using same model
- one retry with stricter format instructions
- then fallback provider

#### duplicate_candidate_collapse
- rerun one ideator with diversity constraints
- if still failing, escalate to human review or reopen starting hypothesis

#### thumbnail_generation_failure
- rerun generator once
- fallback to alternate generator
- if both fail, emit textual thumbnail manifest and proceed to text-only critique if allowed

#### critique_incomplete
- rerun missing critic once
- if still unavailable, proceed only if at least two critics returned and run mode is not high_confidence

#### persistence_failure
- retry local write
- if still failing, emit in-memory summary and mark run failed

### Retry budget defaults
- max retries per provider call: 2
- max stage reruns: 2
- max full-run retries: 1

These should be configurable.

---

## Human-review gates

A human review should be triggered when any of the following are true:

- critic disagreement_score >= 3.0
- two or more thumbnails tie within 0.2 overall score and critics disagree on winner
- all candidates are strategically plausible but no option is clearly buildable
- selected move conflicts with strong human-provided starting hypothesis in strict mode
- system recommends reopening upstream truth
- run mode explicitly requires approval before packaging
- acceptance test flags a category-collapse risk

When human review is triggered, emit:
- candidate summary
- winner options
- disagreement explanation
- recommended default
- required decision fields

---

## Artifact lineage and run manifest

Every run must emit a `run-manifest`.

### Required run-manifest fields
- run_id
- timestamp_start
- timestamp_end
- source_artifacts
- parent_run_id (optional)
- slide_number
- working_title
- run_mode
- model_routing
- thresholds
- state_transitions
- emitted_artifacts
- selected_candidate_id
- selected_thumbnail_id
- exit_state
- human_review_required
- reopen_upstream_truth
- cost_summary (optional)
- notes

### Lineage rules
- every build-spec must reference the source concept-spec
- every critique report must reference the thumbnail manifest
- every thumbnail must reference the source spatial spec
- every spatial spec must reference the selected candidate id
- every selected candidate must reference its parent cluster / raw ideators

---

## Acceptance tests

This section makes the system testable.

### Generic acceptance criteria
A successful run must:
- validate input
- produce 5–8 move candidates total
- produce a shortlist
- produce at least one spatial spec
- produce at least 3 thumbnail directions
- produce a critique report
- produce a build-spec
- produce a run-manifest
- set an exit state other than failed

### Slide-specific Designer tests

#### Slide 4 test
The system must not produce a figure that:
- turns Slide 4 into Slide 5 mechanism language
- uses generic story-to-structure phrasing
- loses wedge-selection clarity

#### Slide 5 test
The system must not produce:
- blob -> arrow -> neat card transform
- over-polished output artifact
- reasoning reduced to cleanup

#### Slide 6 test
The system must not produce:
- feature cloud
- airy marketing placard
- workflow strip pretending to be product concept

#### Slide 9 test
The system must not produce:
- competitor matrix
- generic before/during/after lifecycle strip
- anti-scribe attack framing
- semantic difference claim without visual proof

### Regression test recommendation
Keep at least one fixture input for slides 4, 5, 6, and 9 and rerun them after prompt or threshold changes.

---

## Builder handoff contract

The system ends by writing a build-spec, but the next tool still needs a contract.

### Build-spec minimum machine-consumable fields
- metadata
- selected_figure_move
- selected_family
- selected_thumbnail_id
- copy recommendation
- spatial spec
- element inventory
- keep/remove list
- builder notes
- unresolved items
- next action

### Builder notes should include
- whether to use real copy vs placeholder
- whether images are literal vs abstract
- whether chips/cards should be rendered
- whether panel split is hard or soft
- whether current slide should be reused or rebuilt

### Builder outputs may include
- HTML mock
- Figma frame
- slide JSON
- human-readable design note

---

## Logging and reproducibility

At minimum, the system should log:
- run_id
- model aliases and resolved model ids
- prompt template versions
- input artifact hashes
- output artifact hashes
- stage durations
- failure classes
- retry counts
- final selected candidate
- final selected thumbnail

Raw provider responses may be stored if safe and useful.
At minimum, the system must preserve structured outputs and summary traces.

---

## Deck-specific Designer guardrails

Carry these into every run unless explicitly overridden.

### 1. Do not let the deck become a documentation story
The product story is strongest when it changes the starting point of the visit, not paperwork after the fact.

### 2. Do not let Slides 4, 5, and 6 do each other’s jobs
Keep:
- Slide 4 = why this wedge?
- Slide 5 = what hidden labor exists there?
- Slide 6 = what is Vox, and what bar must it meet?

### 3. Keep Slide 9 as category defense
It should be territory / workflow-layer defense, not competitor theater.

### 4. Sparse slides should stay sparse
Especially:
- Slide 1
- Slide 3
- Slide 4
- Slide 7
- Slide 9

### 5. Tone should remain
- serious
- clinically literate
- premium
- restrained
- high-signal

Avoid:
- generic AI-startup energy
- over-illustration
- dashboard clutter
- cute metaphors that require decoding

---

## Pseudocode

```text
function runFigureIdeation(inputPacket, config):
    validation = validateInput(inputPacket, config)
    if not validation.valid:
        return emitFailure("insufficient_upstream_clarity", validation)

    normalizedBrief = interpretConceptSpec(inputPacket, config)
    if normalizedBrief.confidence < config.thresholds.min_interpretation_confidence:
        normalizedBrief = fallbackInterpretation(inputPacket, config)
        if normalizedBrief.confidence < config.thresholds.min_interpretation_confidence:
            return emitFailure("interpretation_failure", normalizedBrief)

    figureBrief = deriveFigureBrief(normalizedBrief, config)

    rawCandidates = runParallelIdeators(figureBrief, config)
    candidatePool = mergeAndClusterCandidates(rawCandidates, config)

    if candidatePool.diversity_score < config.thresholds.min_candidate_diversity:
        candidatePool = rerunIdeationForDiversity(figureBrief, candidatePool, config)
        if candidatePool.diversity_score < config.thresholds.min_candidate_diversity:
            return emitState("retry_ideation", candidatePool)

    shortlist = scoreAndShortlist(candidatePool, normalizedBrief, config)
    if shortlist.count == 0:
        return emitState("retry_ideation", shortlist)

    familySelection = selectFigureFamily(shortlist, normalizedBrief, config)
    spatialSpecs = spatializeShortlist(shortlist, familySelection, normalizedBrief, config)

    thumbnails = generateThumbnails(spatialSpecs, inputPacket, config)
    if thumbnails.diversity_score < config.thresholds.min_thumbnail_diversity:
        thumbnails = retryThumbnailGeneration(spatialSpecs, inputPacket, config)
        if thumbnails.diversity_score < config.thresholds.min_thumbnail_diversity:
            return emitState("retry_thumbnails", thumbnails)

    critique = runParallelCritics(thumbnails, normalizedBrief, inputPacket, config)
    aggregate = aggregateCritique(critique, config)

    if aggregate.reopen_upstream_truth:
        return emitState("reopen_upstream_truth", aggregate)

    if aggregate.human_review_required:
        return emitState("human_review_required", aggregate)

    buildSpec = writeBuildSpec(
        normalizedBrief,
        shortlist,
        familySelection,
        thumbnails,
        aggregate,
        config,
    )

    manifest = writeRunManifest(
        inputPacket,
        normalizedBrief,
        candidatePool,
        shortlist,
        familySelection,
        thumbnails,
        aggregate,
        buildSpec,
        config,
    )

    persistArtifacts(buildSpec, aggregate, thumbnails, manifest, config)
    return emitState("packaged", manifest)
```

---

## Minimal implementation checklist

Before shipping v1, the tool should be able to:

- ingest a concept-spec-driven input packet
- validate and normalize it
- run multiple ideators in parallel
- merge and dedupe candidates
- score and shortlist with thresholds
- assign a figure family
- write 1–3 spatial specs
- run at least 2 image generators in parallel for rough candidates
- run at least 3 critics in parallel for evaluation
- aggregate critic disagreement
- decide retry / reopen / human review / promote
- write build-spec, critique report, and run-manifest artifacts

A version-one system does not need:
- perfect image generation
- final slide rendering
- autonomous taste

It does need:
- explicit state transitions
- durable artifacts
- explicit model routing
- deterministic thresholds
- usable handoff outputs

---

## Final operating rule

The system is doing its job when it turns:

- a strategically grounded but visually unresolved slide

into:

- a deduped and ranked candidate pool
- a justified winning figure direction
- a buildable spatial plan
- a rough tested candidate set
- and a saved artifact packet someone can actually act on

That is the bar.
