# Slide 7 Fine-Tune Request

Date: 2026-04-01

## Baseline

- Official stamped working folder:
  `projects/designer-health/slide-figures/slide-06`
- Regression baseline for approved composition:
  `projects/designer-health/slide-figures/slide-06/versions/version-000089--slide-07-storyboard-gemini-image/image-01.jpg`
- Current approved refinement baseline:
  `projects/designer-health/slide-figures/slide-06/versions/version-000107--slide-07-v89-surgical-gemini-v1/image-01.jpg`
- Current frozen art baseline:
  `projects/designer-health/slide-figures/slide-06/versions/version-000108--slide-07-v107-remove-five-days-gemini-v1/image-01.jpg`
- Current selected official variant:
  `projects/designer-health/slide-figures/slide-06/versions/version-000113--slide-07-v108-native-2k-gemini-v2/image-01.jpg`

## Locked Regions

- Keep the overall `version-000089` left-to-right storyboard composition.
- Keep the `version-000107` refinement for beat-2 bubble ownership and the
  cleaner beat-3 object.
- Keep the `version-000108` cleanup that removes the extra self-answer bubble.
- Keep the numbered beat labels:
  `1 Invite sent`, `2 Adaptive interview`, `3 Brief prepared`,
  `4 Clinician starts prepared`.
- Keep the threshold labels:
  `Before visit` and `Visit begins`.
- Keep beat 1 as the secure-link phone invite.
- Keep beat 3 as a tech-forward `VOX` brief object, not a clipboard.
- Keep the overall tone and human styling close to the stronger deck
  reference images.

## Allowed Changes

- Beat 2:
  replace thought-bubble feeling with explicit speech / conversation
  bubbles and a real follow-up question.
- Remove the small `Five days.` reply bubble from the `version-000107`
  refinement.
- Beat 4:
  simplify to one clinician holding and reviewing one tablet only.
- Improve human illustration style match to the approved deck references.
- Treat the figure as a central graphic asset when useful:
  the surrounding slide can carry more of the explanatory text later.
- Numbers can remain inside the figure, but long support copy does not need to
  be baked into the art.
- Prefer a frozen high-resolution raster or HTML hybrid over attempting to
  recreate this illustration natively as SVG.
- If higher resolution is requested, rerun the provider natively at the
  highest supported size before any local resize. Do not treat a local upscale
  as true high-resolution output.
- Treat `version-000113` as the official selected higher-resolution variant
  unless the user explicitly reopens exploration.

## Avoid

- Do not drop the text labels or threshold labels.
- Do not replace the brief with a clipboard metaphor.
- Do not introduce extra devices or busy clinician props in beat 4.

## HTML Hybrid Exploration

- `version-000116` is the strongest page-native test so far:
  keep the official `version-000113` art language, but move
  `Before visit`, `Visit begins`, the `1-4` markers, and the beat labels /
  support copy into live HTML.
- For deterministic extraction, the cleanest art-only strip comes from a
  lower crop of `version-000113` that removes the baked top labels while
  preserving the art panels.
- `version-000117` proves the four-asset rebuild is possible, but the split
  panel crops still feel more fragile than the single-strip hybrid.
- Default recommendation for future refinement:
  prefer the single-strip HTML hybrid unless we explicitly rerun the image
  model for truly isolated per-beat assets.

## Manual Extraction Pass

- `version-000118` is the strongest manual extraction test:
  it uses a direct crop from `version-000113` that preserves the original art,
  baseline, number circles, and threshold line while removing the baked lower
  beat labels.
- This is the cleanest answer to the "just delete the baked labels" request.
- `version-000119` tests the same idea with four manual panel crops, but the
  split-panel reconstruction still feels less natural than the single-strip
  rebuild.
- `version-000120` is the first one-by-one transparent asset proof:
  beat 1 is cropped directly from `version-000113`, then only the
  border-connected white slide background is turned transparent.
  The inner white card stays intact.
- `version-000125` is the better Gemini cleanup rerender for beat 1:
  it keeps much closer to the original panel than `version-000124` and avoids
  the extra invented marker bubble that showed up in the weaker rerender.
- Beat 1 is now locked to `version-000125` as the canonical graphic preview.
- `beat-01-invite-v125-flat-v1/gemini/v01-clean` is the current shadow-free
  cleanup pass for beat 1:
  it starts from `version-000125`, flattens the visible shadow, and preserves
  the phone, secure-link card, baseline, and `1` marker.

## Beat Asset Archive

- Canonical slide-7 beat assets now live in
  `projects/designer-health/slide-assets/slide-07/manifest.json`
  so they surface in Studio Graphics instead of only in per-version folders.
- Accepted asset set:
  - `asset-000014` / `storyboard-beat-01-invite`
    preview locked from `slide-figures/slide-06/versions/version-000125--slide-07-v113-beat1-gemini-clean-v2`
    with transparent cutout from `slide-assets/slide-07/source-runs/beat-01-invite-v125-flat-v1/gemini/v01-clean`
  - `asset-000015` / `storyboard-beat-02-adaptive-interview`
    from `output/figures/presentation-images/slide-07-beat-assets/beat-02-adaptive-interview/gemini/v02-clean`
  - `asset-000016` / `storyboard-beat-03-brief-prepared`
    from `output/figures/presentation-images/slide-07-beat-assets/beat-03-brief-prepared/gemini/v01-clean`
  - `asset-000017` / `storyboard-beat-04-clinician-prepared`
    from `output/figures/presentation-images/slide-07-beat-assets/beat-04-clinician-prepared/gemini/v03-clean`
- Beat 2 `v01` inherited a checkerboard transparency artifact, so `v02` is the
  clean selected branch.
- Beat 4 `v02` solved transparency but drifted into a heavy outlined frame, so
  `v03` is the clean selected branch.
- Beat 1 now treats `version-000125` as the locked source graphic and uses a
  separate Gemini cleanup pass only for the shadow-free derivative files.

## Reconstruction Branch

- `projects/designer-health/slide-assets/slide-07/reconstruction-v1/generated.html`
  is the current page-native rebuild branch:
  canonical beat assets as images, with `Before visit`, `Visit begins`,
  and the beat labels / support copy set as live HTML.
- This is now the best sandbox for deciding how much of slide 7 should remain
  image-led versus moved into native page typography.
- `version-000203` is the first self-contained stamped-slide rebuild branch
  that reuses the cleaned beat assets but redraws the bracket, threshold,
  baseline, markers, and lower copy as native HTML/SVG.
- It is the current best draft for "make this feel more page-native without
  throwing away the approved imagery."
- `version-000205` is the stronger follow-up branch:
  it drops the weaker four-panel reconstruction, rebuilds from the
  `version-000116` cleaned strip, and makes the bottom baseline/marker system
  and top bracket much closer to locked `version-000108`.

## Transparent Cutouts

- Each archived beat asset now also carries a `cutout.png` sibling in its
  canonical slide-asset folder:
  - `storyboard-beat-01-invite/cutout.png`
  - `storyboard-beat-02-adaptive-interview/cutout.png`
  - `storyboard-beat-03-brief-prepared/cutout.png`
  - `storyboard-beat-04-clinician-prepared/cutout.png`
- The selected extraction method is a seeded transparency flood-fill from the
  accepted beat assets. This removes the white panel/background and preserves
  enclosed white shapes like the secure-link card and the speech bubbles.
- Beat 1 now uses `version-000125` as the canonical preview and
  `beat-01-invite-v125-flat-v1/gemini/v01-clean` as the source for the
  transparent cutout, so the locked graphic stays anchored to the named slide
  version while the cutout removes the visible shadow.
- Beat 4 now keeps the full `4` circle and uses a direct transparency
  extraction from `beat-04-clinician-prepared/gemini/v03-clean/image-01.jpg`,
  with only the border-connected white cleared so the line and marker remain
  Gemini-native.
- An earlier flatter Gemini rerender attempt for beat 1 was rejected because it
  hallucinated a checkerboard background instead of simplifying the asset.
