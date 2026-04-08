# Slide 2 Render Brief

- `slug`: `slide-02-proof-tiles-pd-template-1`
- `slide`: `2`
- `deck`: `pd-template-1`
- `status`: `ready-for-spec`

## Inputs

- ideation artifact path:
  - [slide-02-proof-tiles-pd-template-1.md](../ideation/slide-02-proof-tiles-pd-template-1.md)
- composition artifact path:
  - [slide-02-proof-tiles-pd-template-1.md](../compositions/slide-02-proof-tiles-pd-template-1.md)
- brief path:
  - [slide-02-proof-tiles-pd-template-1.md](../briefs/slide-02-proof-tiles-pd-template-1.md)
- image-board paths:
  - [front desk scheduling](../../../output/figures/image-requests/slide-02-front-desk-scheduling/asset-board.png)
  - [calendar / desk](../../../output/figures/image-requests/slide-02-calendar-desk-clinic/asset-board.png)
  - [smartphone scheduling](../../../output/figures/image-requests/slide-02-smartphone-scheduling/asset-board.png)
- quality-screen path:
  - [slide-02-proof-tiles-pd-template-1-quality-screen.md](slide-02-proof-tiles-pd-template-1-quality-screen.md)

## Figure Job

- Make the reader feel the scheduling bottleneck in two seconds, then use the
  two proof stats as the explicit evidence layer.

## Finalists

### Schedule Columns

- `name`:
  - `Schedule Columns`
- one-sentence promise:
  - Show capacity pressure as a real clinic schedule, not as abstract demand.
- asset strategy:
  - `native`
- design stance:
  - `restrained variation`
- visual protagonist:
  - one wide scheduling band with five narrow provider columns and only one
    clearly open late slot
- spatial map:
  - top:
    - header lives outside this artifact in the slide chrome
  - middle:
    - scheduling band occupies roughly 68% to 72% of the figure width and sits
      slightly above center
  - bottom:
    - two proof modules align below the band in a stable two-column row
- object inventory:
  - five provider/day columns
  - seven to eight slots per column
  - one open slot in column 5
  - two proof modules
- object count / rhythm:
  - 5 columns is enough to feel systemic without becoming dashboard-like
  - 36 to 40 total slots should be shown
  - 1 slot should read as open
- copy map:
  - inside objects:
    - short provider initials or day labels
    - 2 to 3 visible time stamps total
    - `open` appears once if needed
  - outside objects:
    - `Access`, `~1 month`, `Average wait for a new doctor appointment`, `Up
      19% in three years`
    - `Deferred care`, `10.6%`, `Adults delayed or did not get care because no
      appointment was available when needed`
  - omitted / implied:
    - avoid labels like `fully booked`, `high demand`, or `capacity crisis`
- stat attachment:
  - the left proof module sits under the first 60% of the schedule band
  - the right proof module sits under the late-slot side, with a tiny missed
    appointment cue only if it adds meaning
- hierarchy:
  - dominates first:
    - schedule band
  - reads second:
    - `~1 month` and `10.6%`
  - stays quiet:
    - provider labels, times, slot borders, eyebrows
- palette / style options:
  - base option:
    - black, white, and warm gray only
  - more novel option:
    - muted plum accent used only on the lone late opening and one tiny rule in
      the left proof module
  - where accent is allowed:
    - one open slot, one short rule, nowhere else
- image decision:
  - `none`
- styling specifics:
  - booked slots use soft gray fills, not heavy black blocks
  - open slot uses white fill with a dark hairline border
  - no shadows
  - column lines should be lighter than text
  - provider headers should feel like printed schedule labels, not UI tabs
- anti-patterns:
  - a hospital dashboard look with dense row labels
  - repeating `full` text in every slot
  - large blocks that look like generic rectangles instead of appointments
  - proof text drifting upward into the slot grid
- renderer notes:
  - this should likely be a dedicated `proof_tiles` motif rather than a generic
    card layout
  - renderer should support sparse schedule labels and one explicit open slot

### Next Available Slot

- `name`:
  - `Next Available Slot`
- one-sentence promise:
  - Make the one-month wait visible as a simple weekly progression.
- asset strategy:
  - `native`
- design stance:
  - `restrained variation`
- visual protagonist:
  - four weekly appointment cards connected in sequence, with the first open
    slot appearing only in week 4
- spatial map:
  - top:
    - slide header remains outside the figure
  - middle:
    - four cards span about 62% to 66% of the width, centered and slightly
      above midline
  - bottom:
    - two proof modules below, aligned to the card group width
- object inventory:
  - four week cards
  - one subtle connector line
  - one actual appointment time in week 4
  - two proof modules
- object count / rhythm:
  - exactly 4 cards
  - 1 connector line behind them
  - 1 visible open time slot
- copy map:
  - inside objects:
    - `Week 1`, `Week 2`, `Week 3`, `Week 4`
    - one short date range per card
    - `full` on weeks 1 to 3 if needed
    - one real time on week 4
  - outside objects:
    - both proof modules in full
  - omitted / implied:
    - do not spell out `this equals one month`
    - do not repeat date ranges in the proof copy
- stat attachment:
  - `~1 month` sits directly below the card group as the plain-language readout
  - `10.6%` sits to the right beneath the final card as the downstream system
    consequence
- hierarchy:
  - dominates first:
    - the four-card sequence
  - reads second:
    - `~1 month`
  - stays quiet:
    - date ranges, connector line, card borders
- palette / style options:
  - base option:
    - black and grayscale with week-4 card slightly brighter by contrast only
  - more novel option:
    - soft plum wash or outline only on the week-4 card and its time slot
  - where accent is allowed:
    - week-4 card only
- image decision:
  - `none`
- styling specifics:
  - cards should look like appointment artifacts, not software widgets
  - use subtle linework and a little internal spacing
  - no drop shadows
  - cards should have enough internal detail to feel real at a glance
- anti-patterns:
  - empty gray boxes with labels only
  - cards so sparse they feel unfinished
  - a giant arrow with explanatory copy
  - over-designed ticket styling
- renderer notes:
  - renderer needs a small appointment-card primitive with status and time
  - keep support copy on one line even if the card group gets slightly smaller

### Appointment Card Sequence

- `name`:
  - `Appointment Card Sequence`
- one-sentence promise:
  - Make the wait feel tangible through a sequence of dated appointment
    artifacts.
- asset strategy:
  - `native`
- design stance:
  - `bold variation`
- visual protagonist:
  - five appointment cards stepping forward in time, with the final one
    confirmed and one nearby unavailable card as a secondary cue
- spatial map:
  - top:
    - slide header stays outside the figure
  - middle:
    - appointment-card sequence runs across the center at about 60% width, with
      a slight stagger or cascade
  - bottom:
    - proof modules beneath the sequence in two columns
- object inventory:
  - four delayed-date cards
  - one confirmed appointment card
  - one small unavailable card
  - two proof modules
- object count / rhythm:
  - 6 cards total
  - delayed cards should advance by roughly one week each
  - unavailable card stays secondary and off to the right
- copy map:
  - inside objects:
    - date
    - short clinician or clinic line
    - one `confirmed` state on the final card
    - one `no slot` or unavailable cue on the secondary card
  - outside objects:
    - both proof modules
  - omitted / implied:
    - no arrows or `pushed back again` language
- stat attachment:
  - `~1 month` sits under the delayed progression
  - `10.6%` sits beneath or near the unavailable card cue
- hierarchy:
  - dominates first:
    - the card sequence
  - reads second:
    - the metrics
  - stays quiet:
    - card metadata, borders, unavailable state
- palette / style options:
  - base option:
    - grayscale only with slightly varied paper tones
  - more novel option:
    - muted plum used as a date-stamp or confirmation mark on the final card
  - where accent is allowed:
    - one confirmation stamp and one hairline divider at most
- image decision:
  - `none`
- styling specifics:
  - cards should have light borders and small internal dividers
  - each card needs slightly different microcontent so it does not look cloned
  - no heavy shadow or skeuomorphic paper styling
  - allow a faint tactile quality, but stop before it looks like props
- anti-patterns:
  - identical repeated cards
  - cards stacked so tightly the dates cannot be read
  - an unavailable card that becomes the protagonist by accident
  - proof text sitting on the card edges
- renderer notes:
  - likely highest leverage if we add a reusable appointment-card component
  - needs date progression logic in the body payload

### Demand Queue Visualization

- `name`:
  - `Demand Queue Visualization`
- one-sentence promise:
  - Make the supply-demand mismatch visible without turning it into a generic
    funnel.
- asset strategy:
  - `native`
- design stance:
  - `bold variation`
- visual protagonist:
  - a compressed queue of appointment requests pressing into a narrow capacity
    gate, with one dropped request as the deferred-care cue
- spatial map:
  - top:
    - header remains outside the figure
  - middle:
    - queue object spans about 66% to 70% width and sits dead center
  - bottom:
    - left proof module sits under the backlog; right proof module sits under
      the dropped-request side
- object inventory:
  - seven to nine request cards
  - one narrow capacity gate
  - three or four completed appointment cards
  - one dropped request card
  - two proof modules
- object count / rhythm:
  - 8 to 10 total request artifacts visible
  - backlog should feel denser on the left than on the right
- copy map:
  - inside objects:
    - short request dates or initials only
  - outside objects:
    - both proof modules in full
  - omitted / implied:
    - no labels like `demand` or `capacity gate`
- stat attachment:
  - `~1 month` belongs under the compressed queue
  - `10.6%` belongs under the dropped-request side
- hierarchy:
  - dominates first:
    - the pressure of the queue object
  - reads second:
    - the two metrics
  - stays quiet:
    - request labels, gate, completed stack
- palette / style options:
  - base option:
    - black and gray only
  - more novel option:
    - muted plum on the single dropped request or the gate edge only
  - where accent is allowed:
    - dropped request or gate, not both
- image decision:
  - `none`
- styling specifics:
  - request cards should feel appointment-specific, not like tickets
  - overlap should create compression without obscuring everything
  - no cartoon arrows or speed lines
- anti-patterns:
  - a generic sales-funnel look
  - blobs, circles, or stick-figure queue icons
  - a dropped request that looks melodramatic
  - too many labels explaining the metaphor
- renderer notes:
  - renderer needs overlapping request-card support and a center bottleneck
    object
  - this is the most concept-driven native option and needs discipline

### Reception Window Photo

- `name`:
  - `Reception Window Photo`
- one-sentence promise:
  - Use one restrained scheduling-context image to make the access problem feel
    real without turning the slide into a photo spread.
- asset strategy:
  - `photo`
- design stance:
  - `restrained variation`
- visual protagonist:
  - one wide monochrome photo band showing front-desk scheduling or appointment
    handling
- spatial map:
  - top:
    - header remains outside the figure
  - middle:
    - photo band spans about 72% width and 24% to 28% of figure height
  - bottom:
    - two proof modules sit on white below the band, not on the image
- object inventory:
  - one wide image band
  - two proof modules
- object count / rhythm:
  - 1 image only
  - 2 proof modules
- copy map:
  - inside objects:
    - none
  - outside objects:
    - all proof text
  - omitted / implied:
    - no caption on the image
- stat attachment:
  - both proof modules become the analytic interpretation beneath the photo
  - the image should not try to carry one stat on the left and one on the
    right; it is context, not a split comparison
- hierarchy:
  - dominates first:
    - photo band
  - reads second:
    - the two metrics
  - stays quiet:
    - eyebrows, any photo frame, any micro-caption
- palette / style options:
  - base option:
    - grayscale only
  - more novel option:
    - grayscale photo with a restrained plum underline or chip treatment in the
      proof modules
  - where accent is allowed:
    - proof-module micro treatment only, never on the photo
- image decision:
  - `substrate`
  - choose the calmest front-desk or appointment-book candidate with clear desk
    geometry and low facial emphasis
  - crop to hands, desk surface, phone, notebook, appointment sheet
  - flatten to grayscale with reduced contrast so the photo does not overpower
    the metrics
- styling specifics:
  - no visible drop shadow on the image
  - very light frame line only if needed
  - avoid dramatic vignettes or grain
- anti-patterns:
  - text overlay on the image
  - smiling stock-photo faces as the focal point
  - photo crop that looks like lifestyle marketing
  - image so dark it competes with the numbers
- renderer notes:
  - renderer should support a wide `strip` media role with quiet grayscale
    treatment
  - keep proof modules text-first and do not wrap them around the image

### Phone and Calendar Diptych

- `name`:
  - `Phone and Calendar Diptych`
- one-sentence promise:
  - Show both sides of access friction with a matched two-panel photo system.
- asset strategy:
  - `hybrid`
- design stance:
  - `bold variation`
- visual protagonist:
  - two matched image panels, one calendar/schedule-side and one phone/search
    side
- spatial map:
  - top:
    - header stays outside the figure
  - middle:
    - two equal image panels span 68% to 72% width with a quiet gutter between
      them
  - bottom:
    - one proof module sits directly below each panel
- object inventory:
  - one schedule/calendar image panel
  - one phone/search image panel
  - two proof modules
- object count / rhythm:
  - exactly 2 panels
  - gutter should be narrow but visible
  - no extra insets or badges
- copy map:
  - inside objects:
    - none
  - outside objects:
    - left panel gets `Access` module
    - right panel gets `Deferred care` module
  - omitted / implied:
    - no top-level comparison label is needed
- stat attachment:
  - `~1 month` belongs under the scheduling-surface panel
  - `10.6%` belongs under the phone-side failed-search panel
- hierarchy:
  - dominates first:
    - the panel pair as one unit
  - reads second:
    - the two metrics
  - stays quiet:
    - panel frames, gutter, eyebrows
- palette / style options:
  - base option:
    - matched grayscale panels with black type below
  - more novel option:
    - matched grayscale panels with a muted plum gutter rule or panel keyline
  - where accent is allowed:
    - one gutter rule, one panel keyline, or one chip; never all of them
- image decision:
  - `hero`
  - choose a desk-calendar or booking-surface image for the left
  - choose the least glossy smartphone scheduling image for the right
  - match crop depth, grayscale, and contrast so the pair feels designed, not
    assembled
- styling specifics:
  - panels should share identical dimensions and frame treatment
  - grayscale should be consistent across both
  - avoid device-mockup chrome around the phone image unless absolutely needed
- anti-patterns:
  - mismatched panels where one is much darker or more editorial
  - proof text over the images
  - a split-screen ad look
  - one image being so literal it turns into product marketing
- renderer notes:
  - renderer needs equal-width paired media support and tight alignment for the
    proof modules below

## Recommended Order

- strongest direction:
  - `Schedule Columns`
- strongest backup:
  - `Next Available Slot`
- risky but high-upside direction:
  - `Phone and Calendar Diptych`
- strongest additional stretch:
  - `Demand Queue Visualization`

## Spec Handoff

- which direction should become the next spec:
  - `Schedule Columns`
- what the spec must lock:
  - exact slot count
  - exact width and placement of the schedule band
  - exact placement of the two proof modules
  - how visible the lone open slot is
- what can remain flexible at spec time:
  - specific provider initials
  - exact time labels
  - whether the deferred-care side gets a tiny secondary cue
