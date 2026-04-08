# Slide 2 Ideation

- `slug`: `slide-02-proof-tiles-pd-template-1`
- `slide`: `2`
- `deck`: `pd-template-1`
- `status`: `ideating`

## Source Artifacts

- brief path:
  - [slide-02-proof-tiles-pd-template-1.md](../briefs/slide-02-proof-tiles-pd-template-1.md)
- model ideation artifact path:
  - [ideas.json](../../../output/figures/ideation/slide-02-proof-tiles-pd-template-1/ideas.json)
- image-board artifact paths:
  - [front desk scheduling](../../../output/figures/image-requests/slide-02-front-desk-scheduling/asset-board.png)
  - [calendar / desk](../../../output/figures/image-requests/slide-02-calendar-desk-clinic/asset-board.png)
  - [smartphone scheduling](../../../output/figures/image-requests/slide-02-smartphone-scheduling/asset-board.png)
  - [busy waiting room](../../../output/figures/image-requests/slide-02-busy-waiting-room/asset-board.png)
- composition artifact path:
  - [slide-02-proof-tiles-pd-template-1.md](../compositions/slide-02-proof-tiles-pd-template-1.md)
- synthesis note:
  - this file is now the concept-stage ideation set only; the next pass should
    be a separate visual-composition layer before any new rendering happens

## Figure Job

- Make constrained clinical access feel concrete and systemic, not abstract,
  while keeping the slide premium and restrained.

## Workflow Note

- These 10 directions are concept directions only.
- The rendered attempts after this stage exposed a missing step:
  - concept -> visual composition -> rendered figure
- The next pass should describe the actual graphic treatment for each strong
  direction before generating more variants.

## Fixed Inputs

- Header / subheader:
  - `Demand is outpacing clinical capacity.`
- Must-keep facts:
  - `~1 month` average wait for a new doctor appointment
  - `Up 19% in three years`
  - `10.6%` of adults delayed or did not get care because no appointment was
    available when needed
- Tone / design constraints:
  - white background
  - black text
  - restrained / premium / clinical
  - figure only, not full-slide redesign
- Forbidden directions:
  - decorative filler
  - empty placeholder boxes
  - bright infographic styling
  - purple accent treatment

## Candidate Directions

- `Booked-Out Month View`
  - composition: month-style booking grid with near-term days full and the first
    opening landing in week 4
  - placement: centered scheduling object above the two proof tiles
  - `assetMode`: `native`
  - `imageQueries`: none
  - why it works: turns the wait statistic into a literal scheduling surface
  - main risk: can feel too busy if the grid is over-detailed

- `Schedule Columns`
  - composition: five clinician columns with dense booked slots and one late
    opening
  - placement: full-width scheduling band above the two proof tiles
  - `assetMode`: `native`
  - `imageQueries`: none
  - why it works: operational and clearly systemic
  - main risk: can drift toward dashboard aesthetics if over-labeled

- `Next Available Slot`
  - composition: four weekly appointment cards showing the next opening only in
    week 4
  - placement: centered progression object above the proof tiles
  - `assetMode`: `native`
  - `imageQueries`: none
  - why it works: simple and instantly legible
  - main risk: can feel too sparse if the progression is under-scaled

- `Search to Slot to Care Path`
  - composition: care need -> search for opening -> week 4 slot or no slot
    available
  - placement: centered left-to-right path above the proof tiles
  - `assetMode`: `native`
  - `imageQueries`: none
  - why it works: unifies the two stats into one causal path
  - main risk: can become too explanatory if the labels are verbose

- `Demand Queue Visualization`
  - composition: queued visit requests compressing against a small stack of
    available appointments
  - placement: centered queue/bottleneck object above the proof tiles
  - `assetMode`: `native`
  - `imageQueries`: none
  - why it works: makes the supply-demand mismatch explicit
  - main risk: can look like a generic funnel if the tickets are not specific

- `Appointment Card Sequence`
  - composition: a series of dated appointment-request cards pushed further out
    in time
  - placement: centered sequence above the proof tiles
  - `assetMode`: `native`
  - `imageQueries`: none
  - why it works: feels concrete without needing a chart
  - main risk: can look repetitive if the card content is too uniform

- `Reception Window Photo`
  - composition: one restrained monochrome reception/scheduling image as a
    full-width substrate
  - placement: wide image band above the proof tiles
  - `assetMode`: `photo`
  - `imageQueries`:
    - `clinic front desk scheduling appointment healthcare`
    - `clinic reception appointment book healthcare`
  - why it works: adds realism without changing the slide into a photo slide
  - main risk: stock photography can feel generic if the crop is too obvious

- `Appointment Book Photo Card`
  - composition: one centered photo card where the appointment artifact is
    visible
  - placement: centered above the proof tiles
  - `assetMode`: `photo`
  - `imageQueries`:
    - `medical appointment calendar desk clinic schedule`
    - `clinic reception appointment book healthcare`
  - why it works: ties the slide to a real scheduling artifact
  - main risk: many search results are only tangentially about scheduling

- `Phone and Calendar Diptych`
  - composition: paired phone-side and calendar-side images with matching
    treatment
  - placement: two photo frames above the proof tiles
  - `assetMode`: `hybrid`
  - `imageQueries`:
    - `smartphone medical app scheduling`
    - `medical appointment calendar desk clinic schedule`
  - why it works: shows both the patient-facing and scheduling-surface side of
    access friction
  - main risk: can feel editorial rather than systemic if the images mismatch

- `Phone Scheduling Screen`
  - composition: one centered phone-screen object built from a real phone image
  - placement: centered device object above the proof tiles
  - `assetMode`: `hybrid`
  - `imageQueries`:
    - `smartphone medical app scheduling`
  - why it works: more contemporary and relatable than a generic healthcare
    image
  - main risk: can tilt too product-marketing if the phone treatment gets slick

## Shortlist

- `Schedule Columns`
- `Next Available Slot`
- `Reception Window Photo`
  - image-board path:
    - [front desk scheduling](../../../output/figures/image-requests/slide-02-front-desk-scheduling/asset-board.png)
  - verdict:
    - keep
  - best candidate note:
    - the receptionist-with-notebook and appointment-book desk shots are quiet
      enough to use as substrates
- `Phone and Calendar Diptych`
  - image-board path:
    - [smartphone scheduling](../../../output/figures/image-requests/slide-02-smartphone-scheduling/asset-board.png)
    - [calendar / desk](../../../output/figures/image-requests/slide-02-calendar-desk-clinic/asset-board.png)
  - verdict:
    - keep
  - best candidate note:
    - the phone-plus-planner shot and the desk-calendar shot are usable as a
      matched pair after monochrome treatment
- `Busy waiting room photo pass`
  - image-board path:
    - [busy waiting room](../../../output/figures/image-requests/slide-02-busy-waiting-room/asset-board.png)
  - verdict:
    - discard
  - best candidate note:
    - the search results skew toward empty rooms and generic corridors, not the
      scheduling problem

## Selected Direction

- Name: `Schedule Columns`
- Why selected:
  - it still makes the slide’s argument most directly and does not depend on a
    stock image behaving well
- Asset strategy:
  - `native`
- If `photo` or `hybrid`, proposed `media.slots` queries:
  - none
- Why this beat the other shortlisted options:
  - it feels systemic rather than anecdotal, reads fast, and fits the deck’s
    current tone best
- What still needs to be solved in the composition pass:
  - what exact scheduling object should be rendered, at what scale, and how the
    two stat tiles should attach to it without overlapping or repeating the
    same information

## Spec Notes

- Chosen family:
  - `proof_tiles`
- Focal point:
  - one central scheduling object, then the two metrics
- Layout:
  - header top left, one figure band centered above the proof tiles
- Big:
  - the central figure object
  - the two proof metrics
- Quiet:
  - eyebrows
  - support lines
  - footnote
- Accent use:
  - none
- Failure mode:
  - any version that reads as placeholder geometry or generic stock filler
