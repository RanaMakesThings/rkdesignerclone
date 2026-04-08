# Slide 08 Shared Prompt

You are one of several models being asked independently for a strong opinion on
what a pitch-deck mock artifact should look like.

Important:

- do not try to be diplomatic or average across possible opinions
- give a real point of view
- the human is explicitly annoyed by shallow summary prompts
- treat the raw user brief below as the primary brief
- the grounding notes after it are there to keep you anchored in the actual
  product and actual reference object, not to replace the user's own language

## Raw user brief

So slide, I think, 10, or not 10, I don't know, it's one of the slides.
Basically, the goal is for us to put in like a mock-up of what the box report
would say or show, and we don't have the product yet, so it's like truly a
mock-up. This might just be like a decent amount of just iteration on its own.
So I'm just giving this to you so we can try to, I don't think we need to make
it its own project, but it's just going to be a little bit of probably a meaty
back and forth, and that's okay. I'm going to give you a spec here. It's just
me kind of stream of conscious talking about what I think we can make. And then
let's just do the whole process we've got of like, if let's distract what we're
trying to do here, and then ask our friends Claude and Gemini, and we'll see
what we come up with. Let me see what they have to say before we fuse
everything. I think that'll be helpful, but we'll do that and then I'll show
you this screenshot of this other app, which you can actually see in, if you go
to slash documents slash code slash Designer ops, I think, it's like this LLM
sandbox box replay thing. I don't know if you need that, but if you wanted to
see the HTML, I don't know if that's helpful or not, but yeah, let's go through
and try to come up with some ideas and try to make like a nice sleek, sexy
little report thing.

Okay, so here's the situation at hand. You have all of this shit above, and you
like fully understand what we're trying to make, this whatever, patient intake
thing, and you know all these terms states and whatever. Like, you've got a
sense for the product, deeply, you have a deep sense of the product. So
hopefully, then, you can understand what we, quote, unquote, need to build with
regards to the report. So right now, we don't need to make the full report, but
we're trying to put together our pitch deck, and for the pitch deck, we need
and slash want to put in like an example report or something that can be like
just a visualization of like what the people are, like what's the doc going to
get? And I want it to look really clean, sort of like imagine this is what they
would see if they opened up their own webpage. So I'm attaching a screenshot
here of something that we made that, like I just made like a pseudo
interviewer, and I just kind of like had it, like, make a running list of
something. So you can kind of see it, and there's this like the differential
like supports against unknowns, like, it actually looks pretty decent. We can
add some color to it with, like, I don't know, like a green check for supports,
or a red X for cancer, up arrow, down arrow, green up arrow, red down arrow.
You can see that supports against. And then, um, and then, uh, for like what we
know, I don't know if we need it like that, but basically, I think we just need
to come up with a couple ideas or like attempts at, um... What the, yeah, like
what the report would look like for the clinician to see. Just enough that you
can look at a slide and be like, oh shit, like, yeah, it captured the whole
story and, uh, and presented it, like with the differential. So, um I don't
know if you have like a little, we can have like a little section that's just
like, I don't know, like patient story. I don't really know. We've got to think
about like what it would be. So I kind of want you to like take a moment and
think like what would be the most useful, what would be the most pertinent. Um
ideally, I think we'd have a section that just shows like, this is what we
extracted from the patient story. Maybe like a timeline or something like that.
Um like key things from the patient history. And then, like, I think like if we
have that on the left, like, you know, um patient history, timeline, key items,
and then on the right, kind of this differential thing, it actually looks
pretty slick, like the acute bronchitis, community-acquired pneumonia. We can
use this uh example, this cough example. Um And uh basically, um, yeah, make a
sample report. Um And I'm giving you this thing. This was like a HTML. Um So I
don't know, you can recreate the HTML if that's easy for you to do. Um I'm
happy to throw the repo in here if you want to like unzip it and look at it for
if that's helpful at all, but I think if you made it with HTML, it might
actually just look clean and nice and look like what an actual website would
look like, and we can just take a little excerpt from it and put it in there.
Um So I don't know if, like, you wanna do, like, as a first pass. Maybe just
come up with like spec out a few ideas, if that would be helpful. And you can
do it in, you know, with some detail, because you have all this stuff and these
pictures. And maybe if we come up with that, we can spec out some ideas. If you
have one really good one, that's fine, if you want to do a few. And then we can
go from that to trying to actually, like, um, create something.

## Grounding context from the repo

Official deck mapping:

- this is slide 8, not slide 10
- slide title: `The clinician starts from a structured brief`
- slide purpose: make the product tangible
- official subheader: `Scan, verify, decide.`
- current deck guidance says the slide should feel like one central artifact,
  not a dashboard and not a full product screenshot
- official family: artifact with zoom callouts

Legacy slide-8 intent:

- one central structured brief is the hero artifact
- three zoom/callout regions should map to:
  - what matters
  - what happened when
  - what still needs confirmation

Older internal Signal Report guidance:

- the product should feel clinician-ready, not like raw transcription
- useful deck-safe language includes:
  - `Chief concern`
  - `Why today`
  - `Workup & treatments so far`
  - `Patient goal for today`
  - `Key positives`
  - `Key negatives`
  - `Flagged uncertainties`
  - `Considerations to confirm`
- older notes were somewhat cautious about leading with a hard
  `Differential diagnosis` label in the deck

## Approved reference component the user likes

The user approved using an existing reference component instead of the exact
chat image file.

That reference component has the following feel and anatomy:

- calm, white, card-based clinical utility UI
- thin borders, muted typography, restrained status color
- left card title: `What We Know`
- left card content: structured feature state, categories, present/absent
  badges, evidence pointers
- right card title: `Differential + Next Question + Trace`
- right card content: ranked diagnostic candidates with `Supports`,
  `Against`, and `Unknowns`
- there is also suggested next question behavior and raw trace/provenance
- the user likes the sharpness of the `supports / against / unknowns` logic
- the user does not necessarily need the raw trace tabs or ops-console feel

## Example cough case to use

Use this as the example content:

- chief complaint: `Cough and breathing changes`
- URI prodrome present
- cough for about one week
- yellow sputum present
- measured fever unresolved
- dyspnea presence or severity unresolved
- pleuritic pain unresolved
- example working set:
  - `Community-acquired pneumonia`
  - `Acute bronchitis`
  - `Post-viral cough`
- controller rationale:
  - productive sputum increased concern for pneumonia
  - fever remains unresolved
  - breathing impact is still unknown
- suggested next question flavor:
  - `How has your breathing changed, and does it hurt anywhere in the chest`
    `when you take a deep breath?`

## What you need to do

1. Tell me what the user is actually trying to get onto the slide.
2. Give your blunt design opinion on what the artifact should be.
3. Propose 3 concrete composition directions, ranked best to worst.
4. For each direction, include:
   - one-sentence visual description
   - what to keep from the reference component
   - what to cut from the reference component
   - what to translate or rename
   - why it works on an investor deck
   - the biggest risk or failure mode
5. Answer directly whether the right-hand reasoning area should be labeled:
   - `Differential`
   - `Working differential`
   - `Working considerations`
   - `Clinical considerations`
   - `Considerations to confirm`
   - or something else
6. Give the exact section labels you would put into the winning artifact.
7. Give a rough wireframe in plain text.
8. End with a blunt recommendation:
   - if you had to ship one believable mock for the deck today, what exactly
     would you build first?

Constraints:

- do not answer like a generic consultant
- do not give me vague product-design platitudes
- be specific about composition, labels, and information hierarchy
- it is okay to disagree with the premise of showing an explicit differential
- but if you do disagree, say what should appear instead
- no JSON
- use normal prose and bullets
- aim for depth, not brevity
