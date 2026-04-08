# Slide 6 Style Exploration

Style-only exploration for the promoted slide 6 workflow strip.

## Baseline

- anchor spec:
  `projects/designer-health/figures/specs/slide-06-workflow-strip-v3.json`
- baseline stamped assets:
  `projects/designer-health/slide-figures/slide-06/`

## Directions

### Editorial Premium

- output:
  `projects/designer-health/experiments/slide-06-style-exploration/editorial/`
- hypothesis:
  push the deck toward a more premium editorial voice through a serif display,
  warmer paper tones, and softer trust-tag integration.
- result:
  strongest premium feel of the set, but the serif headline and softened
  connectors make the workflow read slightly slower at a glance than the other
  directions.

### Clinical Minimal

- output:
  `projects/designer-health/experiments/slide-06-style-exploration/clinical/`
- hypothesis:
  test whether a stripped-down clinical system improves 3-second readability and
  makes the workflow feel more operationally credible.
- result:
  clearest purely functional read, but it loses too much deck personality and
  starts to drift toward generic process-slide energy.

### Systems Clean

- output:
  `projects/designer-health/experiments/slide-06-style-exploration/systems/`
- hypothesis:
  tighten the card rhythm and sharpen the connectors so the
  `Structure → Verify` handoff reads faster without adding enterprise chrome.
- result:
  best balance of readability, premium feel, and deck-family consistency. The
  connector treatment is clearer than baseline, and `Structure` still feels like
  the star without creating a fifth object.

### Montserrat Refresh

- output:
  `projects/designer-health/experiments/slide-06-style-exploration/montserrat/`
- hypothesis:
  keep the current promoted slide-6 style almost intact and test whether the
  earlier Montserrat deck feeling works inside the current native family.
- result:
  it proves the font is available and viable, but it does not beat `systems` on
  handoff clarity. It is closest to the current baseline, just with a more
  conventional deck-typography voice.

### Montserrat Only

- output:
  `projects/designer-health/experiments/slide-06-style-exploration/montserrat-only/`
- hypothesis:
  keep the promoted Vox slide entirely intact and swap only the font family so
  the typography change can be judged without any spacing or polish edits.
- result:
  this is the clean control. It gets much closer to the remembered deck voice,
  but it also shows that the earlier PDF feel was not just Montserrat. The
  baseline layout survives cleanly, and the read is slightly more conventional
  than the Space Grotesk version.

### PD Template Reconstruction

- output:
  `projects/designer-health/experiments/slide-06-style-exploration/pd-template/`
- hypothesis:
  rebuild slide 6 in the older `PD template 1` deck grammar from the supplied
  PDF, not just the font family, so the workflow can be judged inside the
  stricter white-page, black-rule, purple-accent system.
- result:
  this is the closest match to the earlier deck voice. It is much flatter and
  more austere than the promoted Vox family, and it proves that the PDF feel
  came from the full page grammar, not just Montserrat. It is useful as a
  reference direction, but it departs furthest from the current deck baseline.

### PD Template Refined

- output:
  `projects/designer-health/experiments/slide-06-style-exploration/pd-template-refined/`
- hypothesis:
  keep the full PD deck grammar, but tune it toward the lighter editorial
  rhythm of the PDF's content slides rather than the heavier title-slide feel
  of the first reconstruction.
- result:
  this version is calmer and closer to the PDF's interior pages. The headline
  is less forceful, the top rule is removed, and the workflow feels more like a
  content slide than a cover slide while still keeping the old deck voice.

### PD Template Refined Green

- output:
  `projects/designer-health/experiments/slide-06-style-exploration/pd-template-refined-green/`
- hypothesis:
  keep the refined PD page grammar, but swap the muted purple focus treatment
  back to the greener Vox accent family to see whether the slide regains some
  energy without losing the editorial restraint.
- result:
  this keeps the stronger refined layout while restoring a more vivid focal
  stage. It reads closer to the original Vox energy and avoids the slightly
  weak feeling of the purple version.

## Recommendation

Promote `pd-template-refined-green` as the locked Designer deck style and carry
it forward under the stable theme id `designer-v1`.

Why:

- it keeps the refined PD-template page grammar that felt closest to the PDF
- it uses the Montserrat typography the deck reference implied
- it restores enough green intensity that `Structure` does not feel weak
- it preserves the clean four-step workflow read without reintroducing a bridge
  object

Use the other directions as references, not as the deck baseline.

- `systems` remains a useful clarity benchmark for connector rhythm
- `editorial` remains a warm premium typography reference
- `clinical` remains a restraint / readability reference
- `montserrat-only` remains the strict font-isolation control
- `pd-template` and `pd-template-refined` remain intermediate records of the
  promoted direction
