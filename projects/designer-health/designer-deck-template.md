# Designer Deck Template

Canonical shell contract for the current Designer deck.

Use this alongside
[deck-spec.json](/Users/kabeer/Code/rkdesignerclone/projects/designer-health/deck-spec.json)
and
[figure-companion.md](/Users/kabeer/Code/rkdesignerclone/projects/designer-health/figure-companion.md).

## Source of truth

- template id:
  `designer-deck-template-v1`
- repo theme id:
  `designer-v1`
- design source:
  [PD-template-1 FigJam board](https://www.figma.com/board/v4gKaR3gn0lLpRb75CRIJq/PD-template-1?node-id=0-1&p=f&t=I1zXkgkEWkhVpJCg-0)
- exported reference:
  `/Users/kabeer/Downloads/PD template 1 (1).pdf`
  and
  `/Users/kabeer/Downloads/PD template 1 (1).pptx`
- official logo package:
  [assets/logo](/Users/kabeer/Code/rkdesignerclone/projects/designer-health/assets/logo)
- blank visual template:
  [templates/designer-deck-template-v1](/Users/kabeer/Code/rkdesignerclone/projects/designer-health/templates/designer-deck-template-v1)
- canonical shared stylesheet:
  [references/vox-design-system.css](/Users/kabeer/Code/rkdesignerclone/projects/designer-health/references/vox-design-system.css)
- design-system reference page:
  [references/vox-design-system-reference.html](/Users/kabeer/Code/rkdesignerclone/projects/designer-health/references/vox-design-system-reference.html)
- theme lineage:
  [designer-v1.mjs](/Users/kabeer/Code/rkdesignerclone/scripts/figures/themes/designer-v1.mjs)
  built from the promoted `pd-template-refined-green` direction
- canonical footer logo:
  [designer-health-logo-black.svg](/Users/kabeer/Code/rkdesignerclone/projects/designer-health/assets/logo/designer-health-logo-black.svg)
  with
  [designer-health-logo-white.svg](/Users/kabeer/Code/rkdesignerclone/projects/designer-health/assets/logo/designer-health-logo-white.svg)
  reserved for dark shells

## Locked shell

- Typography:
  Montserrat for both display and body.
- Canvas:
  white full-slide canvas with no outer dark board, laptop frame, or browser
  chrome.
- Tone:
  restrained editorial black/gray ink with green accent used only where it
  carries meaning.
- Footer shell:
  thin branded divider rule at the bottom plus the compact official Designer
  footer lockup.
- Margins:
  generous editorial whitespace; avoid dense app-card grids unless the slide
  absolutely needs them.

## Operational rule

New slide work should default to this shell unless a slide packet explicitly
argues for a different family.

If a currently selected slide winner does not yet show the full footer shell,
treat that as backlog polish against the locked template, not as permission to
drift the deck style.

## Practical implication

For future slide passes:

- use `designer-v1` as the baseline theme id
- use the FigJam board as the visual shell reference
- use the shared
  [assets/logo](/Users/kabeer/Code/rkdesignerclone/projects/designer-health/assets/logo)
  package for footer/logo work rather than slide-local placeholder assets
- use
  [templates/designer-deck-template-v1/template.html](/Users/kabeer/Code/rkdesignerclone/projects/designer-health/templates/designer-deck-template-v1/template.html)
  as the blank shell when you need a literal starting slide
- use
  [references/vox-design-system.css](/Users/kabeer/Code/rkdesignerclone/projects/designer-health/references/vox-design-system.css)
  as the shared token and primitive source behind the reference page and deck
  template
- use
  [templates/designer-deck-template-v1/shell-regions.json](/Users/kabeer/Code/rkdesignerclone/projects/designer-health/templates/designer-deck-template-v1/shell-regions.json)
  as the locked-region contract for `slide:create:*` bootstrap runs
- preserve the shell while varying only the figure object for each slide
