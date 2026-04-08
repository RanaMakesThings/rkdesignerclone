# Slide 12 — The Ask

## Reviewed assets
- Project sources manifest: yes — `workflow/project-sources-manifest-v1.0.md`
- Master spec: yes — `designer_vox_deck_master_spec_v_1_2.md`, Slide 12 section
- Current slide PNG: no — no Slide 12 PNG present in `selected-slide-images.zip`
- Editable/source file: no — no Slide 12 editable present in `selected-slide-editables.zip`
- Template/shell: yes — `template.html`
- Slide-local notes: yes — `Pre-seed Raise Budget.txt`
- Neighbor reference visuals: yes — `selected-slide-images/slide-10.png`, `selected-slide-images/slide-11.png`

## Current-state snapshot
### What is working in the current version
- the ask amount, financing structure, and round objective are already locked strongly enough to design from
- the slide role is clear: this is a disciplined proof-stage close, not a generic fundraising slide
- the late-deck system already supports a dominant card plus a lighter supporting panel/ribbon treatment

### What is weak in the current version
- there is no live Slide 12 PNG to refine, so this is a first-build execution loop
- there is no editable/source file yet for Slide 12, so layout decisions need to be made from the shell and the concept spec
- the milestone language needed one final pass to become outcome-first rather than partly activity-first

### Main problem type
layout / figure logic

## Upstream artifacts
- Truth-lock: `slide-12-truth-lock-v0.1.md`
- Concept spec: `slide-12-concept-spec-v0.1.md`

## Build objective
Produce the first live ask slide for the deck. The slide should surface the ask in the first scan, make the round feel finite and milestone-based, and visually close the deck with more conviction than a generic pre-seed ask page. It should feel like a clean conversion slide: thesis translated into financing logic.

## Final on-slide copy
**Eyebrow**  
The Ask

**Header**  
Raising $1.25M to launch pilots, prove value, and establish repeatable deployment

**Subheader**  
Post-money SAFE • ~18–20 months of runway

**Hero block**  
$1.25M  
Pre-Seed SAFE

**Support stats**  
2 core hires  
3 pilot sites  
18–20 months

**Milestone cards**

**Build**  
Founding engineer hired  
Clinician-grade product loop live

**Deploy**  
Implementation lead hired  
3 pilot sites live

**Validate**  
Measurable pilot outcomes  
Repeatable go-live playbook

**Bottom ribbon**  
Use of funds: Product & engineering • Pilot implementation & ops • Infra, security, compliance, measurement

## Figure composition
### Preferred layout
One integrated master card fills most of the figure area.

- **Left hero column (about 40–42%)**: dominant ask block. Large amount first, instrument second, support stats third.
- **Right milestone column (about 58–60%)**: three stacked milestone cards of equal height.
- **Bottom ribbon**: one low-contrast use-of-funds band running across the full width of the master card.
- **Internal logic**: the left side answers “what are you raising”; the right side answers “what does it unlock”; the bottom ribbon quietly answers “where does it go.”

This is the recommended build. It best preserves the current late-deck rhythm while giving the ask slide its own stronger closing weight.

### Fallback layout
If the stacked milestone column feels too tall or text-heavy, switch to:

- left hero block
- right horizontal strip of three milestone cards across the upper right
- narrower bottom ribbon beneath them

Use the fallback only if the preferred layout creates crowding or weak card proportions.

## Layout zones
- **Top shell**: eyebrow, header, subheader in the standard deck header area
- **Figure area**: one large rounded master card inside the existing figure footprint
- **Left / hero**: amount, SAFE line, three support stats
- **Right / milestones**: Build, Deploy, Validate cards
- **Bottom**: restrained use-of-funds ribbon integrated into the master card, not separated into a new section

## Visual hierarchy
- **Primary**: header and `$1.25M`
- **Secondary**: milestone labels and support stats
- **Tertiary**: subheader, SAFE line, and use-of-funds ribbon

## Style and shell guidance
- Use the current late-deck language of soft-gray field + white card surfaces + restrained shadow
- Keep corners rounded and the card system calm, not glossy
- Use one accent family only; default to muted blue for rules, bars, and emphasis markers
- Keep the amount dark and dominant; do not turn the slide into a green “money” slide
- Maintain generous whitespace; this slide should feel conclusive, not busy
- Preserve the deck’s premium, clinically serious tone

## Elements to include
- a small eyebrow above the headline
- one dominant ask amount
- a concise SAFE label directly under the amount
- one compact support-stat treatment for `2 core hires / 3 pilot sites / 18–20 months`
- three milestone cards with short outcome-first lines
- one restrained use-of-funds ribbon
- subtle divider logic, if needed, between the hero block and milestone block

## Elements to remove from current draft
- any line-item budget or salary table
- any per-role compensation detail
- any extra explanatory paragraph beyond the subheader
- any founder/team content that belongs to Slide 11
- any icon set or illustration that makes the slide feel decorative

## Must not become
- a spreadsheet
- a payroll memo
- a generic “build / scale / go to market” close
- a slide where the use-of-funds detail is louder than the proof-stage milestones

## Keep from current version
- locked headline
- SAFE + runway framing
- three-bucket logic of Build / Deploy / Validate
- support scope markers: hires, pilot sites, runway

## Change from current version
- turn the milestone lines into sharper outcomes
- choose one preferred composition instead of leaving stacked vs horizontal unresolved
- subordinate use-of-funds beneath milestone logic
- translate the concept into a buildable late-deck surface

## Lock decision
Concept locked, execution live

---

## Version status
- Version: v1.0
- Status: Concept locked, execution live

## Changes from previous version
- first build-spec artifact for Slide 12
- selected a preferred left-hero / right-stacked-milestone composition
- tightened milestone wording into outcome-first cards
- added a fallback layout only if execution pressure forces it
- added explicit shell and style guidance for late-deck consistency

## Still unresolved
- exact font sizes inside the final shell
- whether support stats should appear as pills, separators, or a mini row
- whether the milestone cards need a faint tint or should remain white with accent bars only

## Next action
- Build the first visual pass of Slide 12 in the deck/template and review it against Slides 10–11 for end-of-deck consistency
