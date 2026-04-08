import assert from "node:assert/strict";
import test from "node:test";

import {
  synthesizeGlobalRetryBrief,
  synthesizeSlotRetryBrief,
} from "../../llm/private/html-prompt-synthesis.mjs";

test("synthesizeSlotRetryBrief produces the expected preserve/still_missing/avoid/next_move sections", () => {
  const synthesis = synthesizeSlotRetryBrief({
    slotId: "openai-a",
    requestedChange: "Move the CTA button lower.",
    guardrails: "Do not change the headline.",
    prefilter: {
      blockers: [],
      warnings: ["Title block drifted beyond semantic-stable threshold."],
    },
    gptDelta: {
      summary: "The CTA moved only slightly.",
      evidence: ["It still overlaps the divider."],
      nextPrompt: "Push the CTA clearly below the divider.",
    },
    claudeDelta: {
      summary: "The requested delta is only partial.",
      evidence: ["The CTA remains too close to the top rule."],
      nextPrompt: "",
    },
    gptRegression: {
      rationale: "No major regression.",
      blockers: [],
      nextMove: "Keep the headline fixed while moving the CTA.",
    },
    claudeRegression: {
      rationale: "The rest of the family still looks stable.",
      blockers: [],
      nextMove: "",
    },
  });

  assert.equal(synthesis.slotId, "openai-a");
  assert.ok(synthesis.preserve.some((entry) => entry.includes("headline")));
  assert.ok(synthesis.stillMissing.some((entry) => entry.includes("CTA")));
  assert.ok(synthesis.avoid.some((entry) => entry.includes("Title block")));
  assert.ok(synthesis.nextMove.some((entry) => entry.includes("below the divider")));
  assert.match(synthesis.markdown, /## preserve/);
  assert.match(synthesis.markdown, /## still_missing/);
  assert.match(synthesis.markdown, /## avoid/);
  assert.match(synthesis.markdown, /## next_move/);
});

test("synthesizeGlobalRetryBrief merges slot syntheses into a compact round summary", () => {
  const synthesis = synthesizeGlobalRetryBrief({
    roundNumber: 2,
    slotSyntheses: [
      {
        preserve: ["Do not touch the logo."],
        stillMissing: ["The CTA is still too high."],
        avoid: ["Do not clip the subtitle."],
        nextMove: ["Move the CTA clearly below the divider."],
      },
      {
        preserve: ["Do not touch the logo."],
        stillMissing: ["The accent line still reads as centered."],
        avoid: ["Avoid new spacing drift."],
        nextMove: ["Push the accent line farther right."],
      },
    ],
  });

  assert.ok(synthesis.preserve.includes("Do not touch the logo."));
  assert.ok(synthesis.stillMissing.some((entry) => entry.includes("CTA")));
  assert.ok(synthesis.avoid.some((entry) => entry.includes("subtitle")));
  assert.ok(synthesis.nextMove.length >= 1);
  assert.match(synthesis.markdown, /Round 02 retry synthesis/);
});
