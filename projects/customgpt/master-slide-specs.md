# CustomGPT Creation — Master Slide Specs

Human-readable companion to `deck-spec.json`.

Use this file for quick deck reading and copy review. Use `deck-spec.json` as
the canonical current deck backbone for active versus deprecated status,
numbering policy, and report rendering.

## Working precedence

- current active / deprecated backbone:
  `deck-spec.json`
- visual direction defaults to:
  `inputs/VISUAL_SOURCE_DOC.md`
- header / subheader / citation language defaults to:
  `inputs/COPY_SOURCE_DOC.md`
- process and artifact structure default to:
  `workflow.md`

## Current note

- active sequence:
  `1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33`
- deprecated:
  none yet
- current direction:
  expanded workshop master deck with Connor's original material reorganized into a clearer teaching flow

## Deck spine

1. The residency-admin policy problem is real and repetitive.
2. A custom GPT can solve a narrow version of it if designed carefully.
3. The audience should understand the build sequence before the UI arrives.
4. Governance and maintenance belong in the main story, not the appendix.

## Active Slide Specs

## Slide 1 — Workshop Title and Promise

- Purpose: Open the workshop with a clear thesis and a visually strong product promise.
- Header: `From PDF to Policy Assistant`
- Subheader: `Designing a practical custom GPT for residency administration support`
- Takeaway: This workshop will show what the tool is, why it works, and how to build one.
- Figure role: Use a strong SAEM opener with a clear promise panel and a custom hero graphic rather than speaker portraits.
- Imported source slides: 1, 3

## Slide 2 — Who We Are

- Purpose: Introduce the presenters once, explain why this group is teaching this workshop, and set expectations for the session.
- Header: `Who we are and what we are building together`
- Subheader: `This is a practical workshop from people who live the residency workflow problem, teach within it, and build within current product constraints.`
- Takeaway: The session is operational, grounded, and intentionally narrow.
- Figure role: Use presenter portraits only here, paired with a compact session roadmap and practical framing.
- Imported source slides: 2

## Slide 3 — Why This Matters

- Purpose: Show the administrative pain point and why the audience should care immediately.
- Header: `Policy questions keep landing on the same people.`
- Subheader: `Residency leaders and chiefs repeatedly search static documents for operational answers that should be fast, consistent, and source-bounded.`
- Takeaway: This is a repeated workflow problem that creates delay, inconsistency, and interruption.
- Figure role: Make the workflow burden visible with role cards, repeated question loops, and an operational payoff.
- Imported source slides: 4, 6, 47

## Slide 4 — What This Tool Is

- Purpose: Define the product object plainly before any theory or build mechanics.
- Header: `A custom GPT can act like a residency policy assistant.`
- Subheader: `It answers with uploaded policies and explicit instructions inside ChatGPT, returning a cited answer or a bounded refusal.`
- Takeaway: Understand the object before hearing how it is built.
- Figure role: Show a realistic question, grounded answer, and the design ingredients that make the object useful.
- Imported source slides: 7

## Slide 5 — What Good Looks Like

- Purpose: Set the answer-quality bar before the audience sees the build.
- Header: `A good answer is specific, sourced, and bounded`
- Subheader: `The assistant should answer from the documents, cite the source, and say when it does not know`
- Takeaway: This is the quality bar we will hold the live demo to.
- Figure role: Use three quality pillars instead of abstract prompting advice.
- Imported source slides: 31, 35

## Slide 6 — Good Answer Versus Bad Answer

- Purpose: Turn the quality bar into a side-by-side comparison the audience can judge quickly.
- Header: `Teach the audience to evaluate the answer, not just admire the build`
- Subheader: `A grounded answer looks very different from a vague or overconfident answer even when both sound polished`
- Takeaway: This workshop is really about quality control.
- Figure role: Show a good answer and a risky answer side by side.
- Imported source slides: 31, 35, 40, 46

## Slide 7 — Why It Works

- Purpose: Explain the mechanism in plain language without turning this into a theory lecture.
- Header: `Good policy assistants are configured, grounded workflows`
- Subheader: `Instructions shape behavior, knowledge files provide source material, and selected capabilities extend what the GPT can do`
- Takeaway: This is configuration work more than deep engineering.
- Figure role: Use a simple three-part system map rather than dense architecture.
- Imported source slides: 10, 11, 12, 13, 14, 15

## Slide 8 — Limits and Failure Modes

- Purpose: Make the boundaries explicit before the live build creates false confidence.
- Header: `Grounded systems still fail when the inputs or expectations are wrong`
- Subheader: `Outdated files, conflicting policies, or ambiguous questions can still produce weak answers even with good instructions`
- Takeaway: A grounded assistant is useful, but it still needs judgement and upkeep.
- Figure role: Show the main failure modes as bounded risks.
- Imported source slides: 15

## Slide 9 — Our Solution at a Glance

- Purpose: Translate Connor's solution slide into a clear product-shaped promise.
- Header: `A custom GPT can become a grounded residency policy assistant`
- Subheader: `Ask a plain-language question, retrieve relevant guidance from approved files, and return a cited answer or a refusal`
- Takeaway: The workshop is about building a narrow, grounded assistant, not a general chatbot.
- Figure role: Show the assistant as a practical input-output workflow.
- Imported source slides: 7

## Slide 10 — Where This Fits in Program Operations

- Purpose: Show who benefits from the tool and where it belongs in day-to-day work.
- Header: `This assistant supports the people already answering these questions`
- Subheader: `Residents, chiefs, coordinators, and program leaders all gain from faster, more standardized access to the same operational guidance`
- Takeaway: The right mental model is team support, not AI replacement.
- Figure role: Map the assistant to the real roles in the residency workflow.
- Imported source slides: 2, 4, 7

## Slide 11 — Residency Policy Work Is Repetitive

- Purpose: Make the repeated lookup work concrete before we talk about product mechanics.
- Header: `The same policy questions keep getting answered from scratch`
- Subheader: `Leave, scheduling, conference, evaluation, and remediation questions keep cycling through the same small set of people`
- Takeaway: The pain point is repetitive operational lookup work, not lack of effort.
- Figure role: Show a repeated question loop hitting the same program roles.
- Imported source slides: 4

## Slide 12 — Administrative Burden Shows Up in Burnout and Friction

- Purpose: Connect the policy-lookup problem to resident stress and administrative drag.
- Header: `Administrative confusion is not a small annoyance`
- Subheader: `Connor's original deck linked administrative load, schedule stress, and support bottlenecks to the lived experience of residency operations`
- Takeaway: Reducing answer-friction is a meaningful workflow improvement.
- Figure role: Use evidence-backed burden cards instead of a wall of text.
- Imported source slides: 6, 47

## Slide 13 — Retrieval in Plain Language

- Purpose: Give the audience one simple retrieval explanation they can repeat later.
- Header: `The GPT does not magically know your residency handbook`
- Subheader: `It has to find relevant passages, bring them into context, and then answer from that evidence`
- Takeaway: Retrieval is the bridge between the question and the source files.
- Figure role: Break retrieval into a few memorable steps.
- Imported source slides: 11, 12

## Slide 14 — Benefits of Grounding

- Purpose: Land the upside of grounded answers without overselling the tool.
- Header: `Grounding makes the assistant more useful and more governable`
- Subheader: `The payoff is not magic. It is better source control, better citations, and more consistent answers.`
- Takeaway: Grounding is why this feels operationally trustworthy.
- Figure role: Use a benefit grid with clear operational payoffs.
- Imported source slides: 13, 14

## Slide 15 — Source Prep

- Purpose: Show the preparation work that determines whether the assistant is any good.
- Header: `The files matter as much as the model`
- Subheader: `Start with current, resident-facing, text-forward operational documents before you expand into everything else`
- Takeaway: The hidden implementation work is knowledge hygiene.
- Figure role: Turn source prep into a clean checklist the audience can copy later.
- Imported source slides: 20

## Slide 16 — What to Upload

- Purpose: Make the first knowledge-base contents concrete for the audience.
- Header: `Start with the documents people already trust`
- Subheader: `A resident handbook alone is rarely enough. Combine program, institutional, and requirement-level guidance thoughtfully.`
- Takeaway: Choose a small, high-value document set for the first version.
- Figure role: Show the starter document stack clearly.
- Imported source slides: 21

## Slide 17 — File Hygiene and Versioning

- Purpose: Carry Connor's document-prep advice into a maintainable operating habit.
- Header: `Name files clearly and keep the source set clean`
- Subheader: `Deduplicate overlapping documents, use obvious names, and replace outdated files quickly so the GPT does not drift into stale guidance`
- Takeaway: Versioning is part of the product, not an afterthought.
- Figure role: Show the difference between messy and maintainable document practices.
- Imported source slides: 20, 21, 39

## Slide 18 — Garbage In, Garbage Out

- Purpose: Keep Connor's GIGO point as a memorable quality-control warning.
- Header: `The assistant can only be as good as the policy set you feed it`
- Subheader: `Messy, conflicting, or outdated inputs create brittle outputs even when the interface looks polished`
- Takeaway: Bad inputs are a product risk, not just a content issue.
- Figure role: Use a stark compare that makes the warning memorable.
- Imported source slides: 22

## Slide 19 — Privacy and Security Boundaries

- Purpose: Make privacy, access, and security boundaries explicit before the audience leaves with an overly casual mental model.
- Header: `Privacy and security boundaries matter more than novelty`
- Subheader: `A useful custom GPT stays narrow, uses approved documents, avoids sensitive data, and is shared only with the right audience`
- Takeaway: Sharing and source selection are governance decisions, not convenience features.
- Figure role: Use a strong boundary graphic that makes the allowed-vs-not-allowed distinction unmistakable.
- Imported source slides: 40, 41, 44

## Slide 20 — The Five-Step Build Workflow

- Purpose: Preserve Connor's five-step build map as the main workshop sequence.
- Header: `The workshop build follows five practical steps`
- Subheader: `Prepare the files, start the GPT, configure it carefully, test in preview, then deploy with an owner and clear rules`
- Takeaway: The build flow is straightforward once the sequence is visible.
- Figure role: Use the five-step map as the workshop backbone.
- Imported source slides: 19

## Slide 21 — Live Walkthrough Setup

- Purpose: Tell the audience what to watch for during the live build.
- Header: `We are about to build the assistant live`
- Subheader: `Watch how scope, files, and testing decisions shape the result more than any single prompt flourish`
- Takeaway: The live demo is a lesson in judgment, not just button-clicking.
- Figure role: Frame the walkthrough with a few watch-fors.
- Imported source slides: 19

## Slide 22 — Start a Custom GPT

- Purpose: Modernize Connor's start-here instructions into a clean visual checkpoint.
- Header: `Start in the GPTs area of ChatGPT`
- Subheader: `From there you create a new GPT, give it a narrow job, and move into the configuration surface`
- Takeaway: The product entry point is concrete and accessible.
- Figure role: Show the start surface clearly without drowning the slide in tiny UI text.
- Imported source slides: 23

## Slide 23 — Create Versus Configure

- Purpose: Keep Connor's create-versus-configure distinction because it is genuinely helpful to learners.
- Header: `The friendly builder helps, but the Configure view is where control really lives`
- Subheader: `Create can get you started. Configure is where you lock the role, files, capabilities, and sharing behavior.`
- Takeaway: Teach the audience where the durable controls actually are.
- Figure role: Compare the two surfaces while making Configure feel primary.
- Imported source slides: 26, 28

## Slide 24 — Instructions: Role and Scope

- Purpose: Turn Connor's role-and-scope guidance into a dedicated builder step.
- Header: `Tell the GPT exactly what job it has and what job it does not have`
- Subheader: `A strong role statement narrows the assistant to uploaded policy support and defines what it should do when the answer is missing`
- Takeaway: A good scope statement prevents both drift and overconfidence.
- Figure role: Show the role and scope instructions as the core guardrail.
- Imported source slides: 31

## Slide 25 — Knowledge and Capabilities

- Purpose: Separate files and capabilities into their own build decision slide.
- Header: `Knowledge files and capabilities should both be chosen intentionally`
- Subheader: `Upload only what helps the job, and enable only the capabilities that support the workflow you actually want`
- Takeaway: More tools do not automatically make a better assistant.
- Figure role: Make the file and capability choices feel concrete and governable.
- Imported source slides: 28, 31

## Slide 26 — Guardrails: Citations, Refusals, Tone

- Purpose: Preserve Connor's strong instruction guardrails as a dedicated design checkpoint.
- Header: `Citations, refusal language, and tone are product features`
- Subheader: `The assistant should cite the source, refuse unsupported claims, and stay concise, neutral, and action-oriented`
- Takeaway: Guardrails are what make the assistant safe to trust operationally.
- Figure role: Show the instruction guardrails as visible build choices.
- Imported source slides: 31, 35, 40

## Slide 27 — Test in Preview

- Purpose: Keep preview testing central instead of treating it as a final polish step.
- Header: `Preview is where you learn whether the build is actually working`
- Subheader: `Test known-answer questions, unsupported questions, and ambiguity before you ever think about sharing the tool`
- Takeaway: The build is not real until it survives preview testing.
- Figure role: Turn testing into a concrete checklist of scenarios.
- Imported source slides: 35

## Slide 28 — Push on Unknowns and Conflicts

- Purpose: Make edge-case testing explicit so the audience sees what safe behavior looks like.
- Header: `A strong GPT should handle missing answers and conflicting files gracefully`
- Subheader: `The goal is not just one good answer. It is reliable behavior when the evidence is thin, absent, or inconsistent.`
- Takeaway: Good refusals and conflict flags are signs of quality, not weakness.
- Figure role: Compare the behavior we want under uncertainty with the behavior we do not want.
- Imported source slides: 31, 35

## Slide 29 — Deploy and Share

- Purpose: Preserve Connor's deployment step while keeping the audience focused on readiness.
- Header: `Share only after the tool has earned it`
- Subheader: `Once the build is tested, choose the right sharing mode, explain the expectations, and keep the audience aware of access or capacity limits`
- Takeaway: Deployment is a product decision, not a finish button.
- Figure role: Show deployment as a final gate rather than a casual click.
- Imported source slides: 36

## Slide 30 — Governance and Maintenance

- Purpose: Carry Connor's maintenance slide into the operational close of the talk.
- Header: `The tool needs an owner, an update habit, and a source-of-truth policy set`
- Subheader: `Governance means someone knows what files belong in the GPT, when they get updated, and how the tool gets re-tested`
- Takeaway: A useful GPT is maintained like a real program asset.
- Figure role: Use an operational governance grid, not a compliance wall of text.
- Imported source slides: 39

## Slide 31 — Best Practices

- Purpose: Consolidate Connor's repeated best-practice slides into one stronger board.
- Header: `A few best practices do most of the safety work`
- Subheader: `No PHI, strong prompt guardrails, visible citations, and a clear source-of-truth disclaimer will carry you far`
- Takeaway: A compact best-practice board is more useful than six nearly duplicated slides.
- Figure role: Turn the repeated best-practice content into one memorable grid.
- Imported source slides: 40, 41, 42, 43, 44, 45, 46

## Slide 32 — Future Opportunities

- Purpose: Keep Connor's future-opportunities slide as the optimistic near-close.
- Header: `The same design pattern can support other educational and operational jobs`
- Subheader: `Once the team understands scope, grounding, and governance, the pattern can extend into onboarding, teaching, and study workflows`
- Takeaway: A well-governed policy assistant can be the starting point, not the endpoint.
- Figure role: Show adjacent opportunities without making the current talk feel unfocused.
- Imported source slides: 48

## Slide 33 — Takeaways and Q&A

- Purpose: Close the workshop cleanly with practical next steps and room for discussion.
- Header: `Build small, ground it well, test it hard, and govern it like it matters`
- Subheader: `That is how a custom GPT becomes a useful policy-support tool instead of an impressive but fragile demo`
- Takeaway: The audience should leave with a practical first move and a realistic quality bar.
- Figure role: Use a crisp closing summary with optional contact or QR space.
- Imported source slides: 49, 51

