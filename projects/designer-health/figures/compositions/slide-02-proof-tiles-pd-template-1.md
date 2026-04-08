# Slide 2 Composition Study

- `slug`: `slide-02-proof-tiles-pd-template-1`
- `slide`: `2`
- `deck`: `pd-template-1`
- `status`: `composing`

## Inputs

- ideation artifact path:
  - [slide-02-proof-tiles-pd-template-1.md](../ideation/slide-02-proof-tiles-pd-template-1.md)
- brief path:
  - [slide-02-proof-tiles-pd-template-1.md](../briefs/slide-02-proof-tiles-pd-template-1.md)
- supporting image-board paths:
  - [front desk scheduling](../../../output/figures/image-requests/slide-02-front-desk-scheduling/asset-board.png)
  - [calendar / desk](../../../output/figures/image-requests/slide-02-calendar-desk-clinic/asset-board.png)
  - [smartphone scheduling](../../../output/figures/image-requests/slide-02-smartphone-scheduling/asset-board.png)
  - [busy waiting room](../../../output/figures/image-requests/slide-02-busy-waiting-room/asset-board.png)
- render-brief artifact path:
  - [slide-02-proof-tiles-pd-template-1.md](../render-briefs/slide-02-proof-tiles-pd-template-1.md)
- synthesis note:
  - this file adds the composition layer that was missing between concept and
    render
  - each direction below defines the visual protagonist, object logic, text
    attachment, and failure mode before any new spec is drafted

## Figure Job

- Make constrained clinical access feel concrete and systemic, then let the two
  proof stats read as evidence rather than decoration.

## Direction 1: Booked-Out Month View

- visual protagonist:
  - one oversized month-view calendar rendered as a clean scheduling artifact,
    cropped to occupy the upper half of the figure area
- secondary elements:
  - two proof modules beneath the calendar
  - one small `next available` marker on the lone open date in week 4
- figure family:
  - `proof_tiles`
- asset strategy:
  - `native`
- overall layout:
  - calendar spans most of the width above
  - the two stat modules sit beneath it in a stable two-column grid
- what sits where:
  - weekday headers and date cells stay inside the calendar
  - only one date cell is visibly open, and it lands in the last visible week
  - the proof text lives entirely below the calendar, not inside it
- how the proof/stat text attaches:
  - the `~1 month` stat sits under the left half as the interpretation of the
    calendar object
  - the `10.6%` stat sits under the right half as the system consequence
- what is big:
  - the calendar object
  - the two headline metrics
- what stays quiet:
  - weekday labels
  - date numerals
  - the `next available` tag
- accent use:
  - none
- image role:
  - `none`
- object definitions:
  - `month grid`
    - role: scheduling artifact
    - shape / form: seven-column calendar with four visible weeks
    - content inside it: day labels, date numerals, dense booked marks, one
      outlined open date
    - scale: dominant
    - placement: top-center
    - styling note: looks like an abstraction of a real clinic calendar, not a
      software screenshot
  - `proof modules`
    - role: evidence captions
    - shape / form: text-only modules
    - content inside it: eyebrow, metric, support line, kicker
    - scale: medium-large
    - placement: lower left and lower right
    - styling note: keep the modules crisp and typographic
- attachment rules:
  - what text belongs inside objects:
    - day labels, date numbers, one `next available` tag
  - what text belongs outside objects:
    - both metrics and all supporting proof copy
  - what must never overlap:
    - proof text must not sit on top of date cells
    - `next available` must not collide with the month grid lines
  - what can be implied instead of written:
    - the calendar can imply fullness through repeated booked marks rather than
      explicit `full` labels in every cell
- failure mode:
  - one bad version to avoid:
    - a literal app-calendar screenshot with tiny unreadable details
  - why it would fail:
    - it would look busy, derivative, and unreadable at deck scale

## Direction 2: Schedule Columns

- visual protagonist:
  - a dense strip of clinician schedule columns with stacked appointment slots
- secondary elements:
  - one late open slot
  - two proof modules beneath the scheduling band
- figure family:
  - `proof_tiles`
- asset strategy:
  - `native`
- overall layout:
  - a wide horizontal scheduling band across the upper-middle
  - two metrics below in balanced columns
- what sits where:
  - each schedule column gets a simple provider/day label at the top
  - booked slots fill most of the columns
  - the lone opening appears late and slightly isolated
- how the proof/stat text attaches:
  - the left proof module sits directly beneath the scheduling band and reads as
    the summary of the whole strip
  - the right proof module sits beside it with a small quiet `missed visit`
    cue if needed
- what is big:
  - the scheduling strip
  - the metrics
- what stays quiet:
  - provider labels
  - times
  - any mini cue under the deferred-care stat
- accent use:
  - none
- image role:
  - `none`
- object definitions:
  - `schedule strip`
    - role: system-capacity object
    - shape / form: four or five narrow columns with stacked time cells
    - content inside it: provider initials, time labels, full vs open slot
      states
    - scale: dominant
    - placement: upper center
    - styling note: not a dashboard; labels should be sparse and elegant
  - `late opening`
    - role: reveal
    - shape / form: one outlined or unfilled slot near the far side of the
      strip
    - content inside it: time only
    - scale: small
    - placement: inside the last third of the schedule strip
    - styling note: make it readable without making it flashy
  - `proof modules`
    - role: evidence captions
    - shape / form: text-only modules
    - content inside it: eyebrow, metric, support line, kicker
    - scale: medium-large
    - placement: bottom row
    - styling note: typography should do the work
- attachment rules:
  - what text belongs inside objects:
    - short provider/day labels, a few times, slot states
  - what text belongs outside objects:
    - both large metrics and all supporting text
  - what must never overlap:
    - proof copy should never sit over the slot grid
    - provider labels should not compete with the headline numbers
  - what can be implied instead of written:
    - slot saturation can imply demand pressure without explicit arrows or
      explanatory labels
- failure mode:
  - one bad version to avoid:
    - a BI dashboard look with too many columns, time rows, and legends
  - why it would fail:
    - it would feel operationally noisy instead of premium and legible

## Direction 3: Next Available Slot

- visual protagonist:
  - a four-card weekly progression where the first three weeks are unavailable
    and the fourth contains the next opening
- secondary elements:
  - two proof modules beneath the weekly sequence
  - a faint connector line joining the weeks
- figure family:
  - `proof_tiles`
- asset strategy:
  - `native`
- overall layout:
  - the four weekly cards form one central horizontal object
  - metrics sit below, aligned to the same grid
- what sits where:
  - each week card contains only the minimum: week label, date range, status
  - the open week is the only card with an actual time slot
- how the proof/stat text attaches:
  - the `~1 month` stat anchors under the weekly sequence as its plain-language
    readout
  - the `10.6%` stat anchors beside it as the downstream effect when no slot is
    available when needed
- what is big:
  - the four-card sequence
  - the headline metrics
- what stays quiet:
  - date ranges
  - connector line
  - status labels
- accent use:
  - none
- image role:
  - `none`
- object definitions:
  - `week cards`
    - role: temporal scheduling object
    - shape / form: four aligned cards or panels
    - content inside it: week label, short date range, `full` or `open`, one
      visible appointment time in week 4
    - scale: dominant
    - placement: upper center
    - styling note: the cards should feel like appointment artifacts, not app
      tiles
  - `proof modules`
    - role: evidence captions
    - shape / form: text-only modules
    - content inside it: eyebrow, metric, support line, kicker
    - scale: medium-large
    - placement: lower row
    - styling note: keep the support copy one line only
- attachment rules:
  - what text belongs inside objects:
    - week labels, date ranges, `full/open`, one appointment time
  - what text belongs outside objects:
    - both proof stats
  - what must never overlap:
    - metric copy must not sit on the cards
    - date ranges must not be repeated in the proof modules
  - what can be implied instead of written:
    - the progression itself can imply delay; no arrow labels are needed
- failure mode:
  - one bad version to avoid:
    - a sparse row of anonymous rectangles with no appointment content
  - why it would fail:
    - it would read as placeholder UI rather than a meaningful scheduling
      object

## Direction 4: Search to Slot to Care Path

- visual protagonist:
  - a single left-to-right care-access path with a search stage in the middle
    and two outcomes
- secondary elements:
  - the two proof stats become endpoint captions
  - a subtle branch from `late slot` to `no slot available`
- figure family:
  - `proof_tiles`
- asset strategy:
  - `native`
- overall layout:
  - one central path object occupies the upper-middle
  - proof copy sits under or beside the relevant endpoints instead of in
    disconnected tiles
- what sits where:
  - left node is `need care`
  - middle node is `search / availability`
  - right side branches into `week 4 appointment` and `care delayed`
- how the proof/stat text attaches:
  - `~1 month` attaches to the late-appointment branch
  - `10.6%` attaches to the delayed-care branch
- what is big:
  - the path
  - the two large metrics at the endpoints
- what stays quiet:
  - node labels
  - connector lines
  - branch captions
- accent use:
  - none
- image role:
  - `none`
- object definitions:
  - `care path`
    - role: causal mechanism object
    - shape / form: restrained process line with three nodes and one branch
    - content inside it: minimal verbs and one late-slot artifact
    - scale: dominant
    - placement: center
    - styling note: more editorial than flowchart
  - `endpoint metrics`
    - role: evidence anchors
    - shape / form: typographic callouts
    - content inside it: the two metrics plus one-line support
    - scale: medium-large
    - placement: lower right and lower far right
    - styling note: keep them physically attached to endpoints, not floating
- attachment rules:
  - what text belongs inside objects:
    - only the node verbs and one or two short status words
  - what text belongs outside objects:
    - all large proof copy
  - what must never overlap:
    - the two endpoint stats must not sit on top of the path line
    - branch labels must not stack on the metrics
  - what can be implied instead of written:
    - the branch implies two outcomes; we do not need explanatory sentences in
      the middle of the path
- failure mode:
  - one bad version to avoid:
    - a verbose consulting-style flowchart
  - why it would fail:
    - too much copy would kill the immediacy of the slide

## Direction 5: Demand Queue Visualization

- visual protagonist:
  - a queue of appointment requests pressing into a narrow appointment-capacity
    gate
- secondary elements:
  - a small stack of accepted appointments on one side
  - one peeled-away request to cue delayed care
- figure family:
  - `proof_tiles`
- asset strategy:
  - `native`
- overall layout:
  - the queue object spans the upper-middle from left to right
  - the proof modules sit beneath the queue and the peeled-away request
- what sits where:
  - request cards collect on the left
  - a narrow gate or bottleneck sits in the center
  - a much smaller completed stack sits on the right
  - one request card drops out below the gate
- how the proof/stat text attaches:
  - `~1 month` sits beneath the backed-up queue
  - `10.6%` sits beneath the dropped request
- what is big:
  - the queue object
  - the metrics
- what stays quiet:
  - request-card labels
  - the completed stack
  - any gate label
- accent use:
  - none
- image role:
  - `none`
- object definitions:
  - `request queue`
    - role: demand object
    - shape / form: overlapping appointment request cards
    - content inside it: dates, initials, or short request labels
    - scale: dominant
    - placement: left-center
    - styling note: make the cards feel specific, not abstract tickets
  - `capacity gate`
    - role: bottleneck
    - shape / form: narrow channel or simple divider
    - content inside it: no text required
    - scale: medium
    - placement: center
    - styling note: should read structurally, not metaphorically cute
  - `dropped request`
    - role: deferred-care cue
    - shape / form: one request card offset from the path
    - content inside it: minimal status mark
    - scale: small-medium
    - placement: lower right of the queue
    - styling note: enough separation to read, not theatrical
- attachment rules:
  - what text belongs inside objects:
    - short request labels only
  - what text belongs outside objects:
    - both proof modules
  - what must never overlap:
    - the metrics should not sit over the overlapping cards
    - the dropped request must not collide with the right-side proof block
  - what can be implied instead of written:
    - backlog can be implied by density and compression rather than arrows
- failure mode:
  - one bad version to avoid:
    - a generic funnel with circles or blobs
  - why it would fail:
    - it would lose the concrete appointment-scheduling feel

## Direction 6: Appointment Card Sequence

- visual protagonist:
  - a row or slight cascade of dated appointment cards marching forward in time
- secondary elements:
  - one final confirmed appointment card
  - one faint rejected or unavailable card to cue missed care
- figure family:
  - `proof_tiles`
- asset strategy:
  - `native`
- overall layout:
  - appointment cards occupy the upper-middle as one tactile object sequence
  - proof modules sit beneath them
- what sits where:
  - the first three or four cards are progressively later dates
  - the final card is the actual appointment
  - the unavailable card sits slightly off-grid near the deferred-care proof
- how the proof/stat text attaches:
  - `~1 month` sits beneath the delayed card progression
  - `10.6%` sits beneath the unavailable card cue
- what is big:
  - the appointment-card sequence
  - the metrics
- what stays quiet:
  - card metadata
  - card borders
  - any unavailable marker
- accent use:
  - none
- image role:
  - `none`
- object definitions:
  - `appointment cards`
    - role: scheduling artifact
    - shape / form: paper-like appointment cards with date and time fields
    - content inside it: date, short clinician name, `confirmed` on the final
      card
    - scale: dominant
    - placement: upper center
    - styling note: vary the dates and microcopy enough to avoid repetition
  - `unavailable card`
    - role: deferred-care cue
    - shape / form: one stripped-down card with an unavailable state
    - content inside it: `no slot available` or a simple strike-through cue
    - scale: small-medium
    - placement: lower-right edge of the sequence
    - styling note: subordinate to the main progression
- attachment rules:
  - what text belongs inside objects:
    - dates, clinician, appointment status
  - what text belongs outside objects:
    - both proof modules
  - what must never overlap:
    - proof text cannot sit on the cards
    - the unavailable card must not interrupt the date progression
  - what can be implied instead of written:
    - the march of dates already implies waiting; avoid extra arrow captions
- failure mode:
  - one bad version to avoid:
    - a row of identical generic index cards
  - why it would fail:
    - it would read as repetitive filler instead of real scheduling friction

## Direction 7: Reception Window Photo

- visual protagonist:
  - one wide monochrome reception or scheduling-desk photograph used as a quiet
    substrate
- secondary elements:
  - the two proof modules beneath the image band
- figure family:
  - `proof_tiles`
- asset strategy:
  - `photo`
- overall layout:
  - the photo runs as a wide band across the upper half
  - the metrics sit on white below it
- what sits where:
  - the photo should contain a desk, calendar, notebook, or receptionist action
    with usable negative space
  - the proof modules stay entirely outside the image area
- how the proof/stat text attaches:
  - the image sets the environment
  - the two proof modules do the explanatory work beneath it
- what is big:
  - the photo band
  - the metrics
- what stays quiet:
  - any eyebrow labels
  - photo details
- accent use:
  - none
- image role:
  - `substrate`
- if using stock:
  - chosen candidate(s):
    - use the front-desk and appointment-book candidates with the cleanest desk
      geometry and least performative expressions
  - crop / treatment note:
    - monochrome, slightly flattened contrast, crop for hands/desk artifacts
      rather than faces
- object definitions:
  - `photo band`
    - role: realism layer
    - shape / form: wide horizontal crop
    - content inside it: receptionist desk, scheduling notebook, keyboard,
      phone, or appointment artifact
    - scale: dominant
    - placement: upper center
    - styling note: use it as atmosphere, not as a place to put copy
  - `proof modules`
    - role: evidence captions
    - shape / form: text-only modules
    - content inside it: eyebrow, metric, support line, kicker
    - scale: medium-large
    - placement: bottom row
    - styling note: let the white space below the image reset the slide
- attachment rules:
  - what text belongs inside objects:
    - none
  - what text belongs outside objects:
    - all proof copy
  - what must never overlap:
    - no large metric or support copy should sit on top of the photo
    - avoid covering faces or hands with labels
  - what can be implied instead of written:
    - the photo can imply the operational context; no caption is needed
- failure mode:
  - one bad version to avoid:
    - a stock-banner layout with text laid over the image
  - why it would fail:
    - it would look generic and immediately weaken the deck

## Direction 8: Appointment Book Photo Card

- visual protagonist:
  - one centered photo card featuring a visible scheduling artifact such as a
    planner, appointment book, or desk calendar
- secondary elements:
  - the two proof modules beneath or lightly flanking the card
- figure family:
  - `proof_tiles`
- asset strategy:
  - `photo`
- overall layout:
  - one hero photo object centered above the proof row
  - the metrics remain typographic and separate
- what sits where:
  - the photo card sits in the upper-middle with generous white margins
  - proof modules align beneath it in two columns
- how the proof/stat text attaches:
  - the card is the tangible scheduling artifact
  - the proof modules explain what the artifact represents at the system level
- what is big:
  - the photo card
  - the metrics
- what stays quiet:
  - card frame
  - any photo caption
- accent use:
  - none
- image role:
  - `hero`
- if using stock:
  - chosen candidate(s):
    - use only desk-calendar or appointment-book shots with clean surfaces and
      no bright office clutter
  - crop / treatment note:
    - crop tightly around the artifact, desaturate to grayscale, and avoid
      lifestyle framing
- object definitions:
  - `photo card`
    - role: tangible scheduling artifact
    - shape / form: single framed image card
    - content inside it: planner, datebook, or open appointment artifact
    - scale: dominant
    - placement: upper center
    - styling note: the card should feel documentary, not mood-board
  - `proof modules`
    - role: evidence captions
    - shape / form: text-only modules
    - content inside it: eyebrow, metric, support line, kicker
    - scale: medium-large
    - placement: lower left and lower right
    - styling note: keep the proof copy disciplined so the photo stays quiet
- attachment rules:
  - what text belongs inside objects:
    - none
  - what text belongs outside objects:
    - all proof text
  - what must never overlap:
    - the proof modules should not overlap the photo card
    - avoid caption text pinned to the image border
  - what can be implied instead of written:
    - the photo artifact already implies scheduling; do not add labels on top
- failure mode:
  - one bad version to avoid:
    - a generic notebook shot that is only vaguely related to appointments
  - why it would fail:
    - it would feel arbitrary rather than clinically relevant

## Direction 9: Phone and Calendar Diptych

- visual protagonist:
  - a matched pair of image frames, one showing patient-side scheduling and one
    showing a scheduling surface
- secondary elements:
  - the two proof modules directly beneath the corresponding frame
- figure family:
  - `proof_tiles`
- asset strategy:
  - `hybrid`
- overall layout:
  - two balanced image panels across the upper half
  - one proof module under each panel
- what sits where:
  - the calendar-side image should sit under the `Access` proof
  - the phone-side image should sit under the `Deferred care` proof if it
    clearly conveys failed scheduling effort
- how the proof/stat text attaches:
  - each proof module becomes the caption for its own panel rather than a
    disconnected tile pair
- what is big:
  - the two image frames
  - the metrics
- what stays quiet:
  - any frame divider
  - photo detail
  - eyebrows
- accent use:
  - none
- image role:
  - `hero`
- if using stock:
  - chosen candidate(s):
    - use the desk-calendar candidate for wait time
    - use the least promotional smartphone scheduling image for failed access
  - crop / treatment note:
    - match both crops in contrast and scale, and flatten them into the same
      grayscale treatment
- object definitions:
  - `calendar frame`
    - role: wait-time side
    - shape / form: image panel
    - content inside it: scheduling surface or calendar artifact
    - scale: large
    - placement: upper left
    - styling note: keep the image quiet enough for the metric beneath to lead
  - `phone frame`
    - role: failed-access side
    - shape / form: image panel
    - content inside it: phone scheduling attempt or appointment search
    - scale: large
    - placement: upper right
    - styling note: avoid any image that reads like a polished product ad
  - `proof modules`
    - role: panel captions
    - shape / form: text-only modules
    - content inside it: eyebrow, metric, support line, kicker
    - scale: medium-large
    - placement: below each image panel
    - styling note: align them tightly to the panel edges
- attachment rules:
  - what text belongs inside objects:
    - none
  - what text belongs outside objects:
    - all proof text
  - what must never overlap:
    - do not place proof text on the photos
    - do not let mismatched crops make one panel feel heavier than the other
  - what can be implied instead of written:
    - the two-panel comparison can imply two sides of the same problem without a
      top-level explanatory caption
- failure mode:
  - one bad version to avoid:
    - an editorial magazine spread with unrelated photos
  - why it would fail:
    - it would feel aestheticized rather than analytically useful

## Direction 10: Phone Scheduling Screen

- visual protagonist:
  - one centered phone object showing a real scheduling screen or appointment
    search state
- secondary elements:
  - two proof modules below or lightly flanking the device
- figure family:
  - `proof_tiles`
- asset strategy:
  - `hybrid`
- overall layout:
  - the phone object sits centered in the upper-middle with plenty of white
    space
  - proof modules stay below it as the readable evidence layer
- what sits where:
  - the device is isolated enough to feel intentional
  - the proof modules align below left and right, not on the screen
- how the proof/stat text attaches:
  - the device supplies a contemporary scheduling object
  - the proof modules explain the broader system-level facts
- what is big:
  - the phone object
  - the two headline metrics
- what stays quiet:
  - device chrome
  - any tiny UI details in the image
- accent use:
  - none
- image role:
  - `hero`
- if using stock:
  - chosen candidate(s):
    - use only smartphone scheduling images with plain UI and minimal branding
  - crop / treatment note:
    - grayscale the image, simplify the device frame, and avoid glossy product
      marketing lighting
- object definitions:
  - `phone object`
    - role: contemporary access artifact
    - shape / form: tall centered device frame
    - content inside it: real appointment-search or scheduling image
    - scale: dominant
    - placement: upper center
    - styling note: the object should feel documentary, not product-demo
  - `proof modules`
    - role: evidence captions
    - shape / form: text-only modules
    - content inside it: eyebrow, metric, support line, kicker
    - scale: medium-large
    - placement: lower left and lower right
    - styling note: keep enough whitespace around the phone to avoid crowding
- attachment rules:
  - what text belongs inside objects:
    - none beyond the source image itself
  - what text belongs outside objects:
    - all proof copy
  - what must never overlap:
    - the proof modules should never touch the device frame
    - do not print any marketing-style labels on the screen
  - what can be implied instead of written:
    - the phone already implies searching for access; avoid extra callouts
- failure mode:
  - one bad version to avoid:
    - a slick app-marketing hero phone with polished UI text and shadows
  - why it would fail:
    - it would make the slide feel like a product ad instead of a systems proof

## Working Read

- strongest native directions after composition:
  - `Schedule Columns`
  - `Next Available Slot`
  - `Appointment Card Sequence`
- strongest photo / hybrid directions after composition:
  - `Reception Window Photo`
  - `Phone and Calendar Diptych`
- weakest directions unless the source image quality is unusually strong:
  - `Appointment Book Photo Card`
  - `Phone Scheduling Screen`
