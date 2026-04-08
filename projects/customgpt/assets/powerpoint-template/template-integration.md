# SAEM PowerPoint Template Integration

Operational notes for the checked-in SAEM conference template:

- template file:
  `projects/customgpt/assets/powerpoint-template/saem-annual-meeting-powerpoint-template.pptx`
- source file metadata:
  creator `Holly Byrd-Duncan`
- slide size:
  `12192000 x 6858000 EMU` = `13.333 x 7.5 in` = widescreen `16:9`

## Structural findings

- the template contains `3` slide masters
- it contains `33` slide layouts total
- each master carries the same layout family with small stylistic variation
- layouts consistently include footer placeholders:
  - date placeholder `dt` index `10`
  - footer placeholder `ftr` index `11`
  - slide number placeholder `sldNum` index `12`

## Theme findings

- major font:
  `Aptos Display`
- body font:
  `Aptos`
- key theme colors:
  - dark accent: `#0E2841`
  - light neutral: `#E8E8E8`
  - accent 1: `#156082`
  - accent 2: `#E97132`

## Layout families present

The template repeats a standard layout set across all three masters:

- centered title + subtitle
- title + single body
- title + two bodies
- title + four bodies / comparison grid
- title only
- blank
- title + picture + body

Because the layout XML does not carry friendly names, use PowerPoint's visual
layout picker when selecting among the three master variants.

## Working rules for this repo

- build SAEM slide content at widescreen `16:9`
- treat the `.pptx` as the final conference shell, not just a loose reference
- keep canonical visual source artifacts in `slide-figures/`
- use the template when assembling the final `.pptx` for submission or delivery
- preserve the conference footer / date / slide-number behavior unless SAEM
  instructions say otherwise

## Practical workflow

1. Develop slide content and figure logic under `projects/customgpt/`.
2. Generate canonical visual artifacts in `slide-figures/`.
3. Assemble the final presentation in a copy of the SAEM template.
4. Apply the closest matching master/layout for each slide.
5. Place exported visuals and copy into the template rather than rebuilding the
   conference styling from scratch.

## Recommendation

For SAEM work in this repo, treat this template as the default output target for
any final deck export or speaker-ready PowerPoint packaging.
