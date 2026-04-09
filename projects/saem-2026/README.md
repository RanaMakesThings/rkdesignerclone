# SAEM Microlearning

Project-local deck workspace for the SAEM talk on microlearning in emergency
medicine.

## Intent

This project should use `designer` as a reusable slide engine without changing
the repo's core assumptions or the existing `machina-health` project.

The isolation rule is:

- keep all SAEM work under `projects/saem-2026/`
- keep changes scoped to this project unless a shared tooling bug blocks the deck
- treat Designer Studio as stable tooling, not as a one-off deck folder

## Source docs

- [inputs/microlearning_emergency_medicine_review.md](./inputs/microlearning_emergency_medicine_review.md)
- [inputs/saem_microlearning_talk_outline.md](./inputs/saem_microlearning_talk_outline.md)
- [inputs/COPY_SOURCE_DOC.md](./inputs/COPY_SOURCE_DOC.md)
- [inputs/VISUAL_SOURCE_DOC.md](./inputs/VISUAL_SOURCE_DOC.md)

## Template

The official SAEM annual meeting template is stored at:

- [templates/saem-annual-meeting-template-v1/saem_annual_meeting_template.pptx](./templates/saem-annual-meeting-template-v1/saem_annual_meeting_template.pptx)

Designer should be used for concept generation, mockup previews, and iterative
visual refinement. The SAEM PowerPoint template is the final packaging layer.

## First practical next step

Once `GEMINI_API_KEY` is available in the `designer` environment, start with
one concept-heavy slide rather than the whole deck at once:

- slide 2: the ED learning-design problem
- or slide 4: the learning-science framework

Those are good tests of whether the project brief and template constraints are
working.
