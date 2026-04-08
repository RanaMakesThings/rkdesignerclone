const compact = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const uniqueLines = (items) => [...new Set(items.map((item) => compact(item)).filter(Boolean))];

const takeFirst = (items, count = 3) => uniqueLines(items).slice(0, count);

const pullJudgeMisses = (judge) => {
  if (!judge) {
    return [];
  }
  return [
    judge.summary,
    ...(Array.isArray(judge.evidence) ? judge.evidence : []),
    judge.nextPrompt,
  ];
};

const pullRegressionWarnings = (review) => {
  if (!review) {
    return [];
  }
  return [
    review.rationale,
    ...(Array.isArray(review.blockers) ? review.blockers : []),
    review.nextMove,
  ];
};

export const synthesizeSlotRetryBrief = ({
  slotId,
  requestedChange,
  guardrails = "",
  prefilter,
  gptDelta,
  claudeDelta,
  gptRegression,
  claudeRegression,
}) => {
  const preserve = takeFirst([
    guardrails,
    "Keep the current slide family and composition stable outside the requested delta.",
  ]);
  const stillMissing = takeFirst([
    requestedChange,
    ...pullJudgeMisses(gptDelta),
    ...pullJudgeMisses(claudeDelta),
  ]);
  const avoid = takeFirst([
    ...(prefilter?.blockers ?? []),
    ...(prefilter?.warnings ?? []),
    ...pullRegressionWarnings(gptRegression),
    ...pullRegressionWarnings(claudeRegression),
  ]);
  const nextMove = takeFirst(
    [
      gptDelta?.nextPrompt,
      claudeDelta?.nextPrompt,
      gptRegression?.nextMove,
      claudeRegression?.nextMove,
    ],
    1
  );

  return {
    slotId,
    preserve,
    stillMissing,
    avoid,
    nextMove,
    markdown: [
      `# Retry synthesis for ${slotId}`,
      "",
      "## preserve",
      ...(preserve.length > 0 ? preserve.map((entry) => `- ${entry}`) : ["- Preserve the current family."]),
      "",
      "## still_missing",
      ...(stillMissing.length > 0 ? stillMissing.map((entry) => `- ${entry}`) : ["- Re-state the requested change more concretely."]),
      "",
      "## avoid",
      ...(avoid.length > 0 ? avoid.map((entry) => `- ${entry}`) : ["- Do not introduce new unrelated drift."]),
      "",
      "## next_move",
      ...(nextMove.length > 0 ? nextMove.map((entry) => `- ${entry}`) : ["- Make the requested delta more explicit while preserving the rest."]),
      "",
    ].join("\n"),
  };
};

export const synthesizeGlobalRetryBrief = ({ roundNumber, slotSyntheses = [] }) => {
  const preserve = takeFirst(slotSyntheses.flatMap((entry) => entry.preserve));
  const stillMissing = takeFirst(slotSyntheses.flatMap((entry) => entry.stillMissing));
  const avoid = takeFirst(slotSyntheses.flatMap((entry) => entry.avoid));
  const nextMove = takeFirst(slotSyntheses.flatMap((entry) => entry.nextMove), 2);

  return {
    preserve,
    stillMissing,
    avoid,
    nextMove,
    markdown: [
      `# Round ${String(roundNumber).padStart(2, "0")} retry synthesis`,
      "",
      "## preserve",
      ...(preserve.length > 0 ? preserve.map((entry) => `- ${entry}`) : ["- Preserve stable parts of the current slide family."]),
      "",
      "## still_missing",
      ...(stillMissing.length > 0 ? stillMissing.map((entry) => `- ${entry}`) : ["- Keep pushing the requested change."]),
      "",
      "## avoid",
      ...(avoid.length > 0 ? avoid.map((entry) => `- ${entry}`) : ["- Avoid unrelated regressions."]),
      "",
      "## next_move",
      ...(nextMove.length > 0 ? nextMove.map((entry) => `- ${entry}`) : ["- Make the delta clearer in the next round."]),
      "",
    ].join("\n"),
  };
};
