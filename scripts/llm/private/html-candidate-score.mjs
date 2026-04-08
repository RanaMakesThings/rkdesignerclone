const normalizeJudgeStatus = (judge) =>
  String(judge?.status ?? "").trim().toLowerCase();

const normalizeRegressionVerdict = (judge) =>
  String(judge?.verdict ?? "").trim().toLowerCase();

const collectBlockers = ({
  prefilter,
  gptRegression,
  claudeRegression,
}) => [
  ...(prefilter?.blockers ?? []),
  ...(Array.isArray(gptRegression?.blockers) ? gptRegression.blockers : []),
  ...(Array.isArray(claudeRegression?.blockers) ? claudeRegression.blockers : []),
];

export const scoreHtmlCandidate = ({
  prefilter,
  gptDelta,
  claudeDelta,
  gptRegression,
  claudeRegression,
}) => {
  if (!prefilter?.ok) {
    return {
      class: "blocked",
      numeric: 0,
      status: "prefilter_failed",
      outcome: "block",
      reason: prefilter?.summary || "Prefilter failed.",
      blockers: prefilter?.blockers ?? [],
      warnings: prefilter?.warnings ?? [],
    };
  }

  const gptStatus = normalizeJudgeStatus(gptDelta);
  const claudeStatus = normalizeJudgeStatus(claudeDelta);
  const gptRegressionVerdict = normalizeRegressionVerdict(gptRegression);
  const claudeRegressionVerdict = normalizeRegressionVerdict(claudeRegression);
  const blockers = collectBlockers({
    prefilter,
    gptRegression,
    claudeRegression,
  });
  const warnings = [...(prefilter?.warnings ?? [])];

  if (gptRegressionVerdict === "blocker" || claudeRegressionVerdict === "blocker") {
    return {
      class: "blocked",
      numeric: 0.05,
      status: "blocked",
      outcome: "block",
      reason: "Regression review found a concrete blocker.",
      blockers,
      warnings,
    };
  }

  if (
    gptDelta?.needsHuman ||
    claudeDelta?.needsHuman ||
    ["ambiguous", "out_of_scope"].includes(gptStatus) ||
    ["ambiguous", "out_of_scope"].includes(claudeStatus) ||
    (gptStatus === "applied" && claudeStatus === "not_applied") ||
    (claudeStatus === "applied" && gptStatus === "not_applied")
  ) {
    return {
      class: "escalated",
      numeric: 0.2,
      status: "escalated",
      outcome: "escalate",
      reason: "Delta judges disagreed or escalated the candidate.",
      blockers,
      warnings,
    };
  }

  if (gptStatus === "applied" && claudeStatus === "applied") {
    if (warnings.length > 0) {
      return {
        class: "escalated",
        numeric: 0.8,
        status: "escalated",
        outcome: "escalate",
        reason: "Requested change applied, but locked-region warnings still need review.",
        blockers,
        warnings,
      };
    }
    return {
      class: "pass",
      numeric: 1,
      status: "judged_pass",
      outcome: "pass",
      reason: "Both delta judges applied the requested change and no blockers remain.",
      blockers,
      warnings,
    };
  }

  if (
    ["partial", "not_applied"].includes(gptStatus) ||
    ["partial", "not_applied"].includes(claudeStatus)
  ) {
    return {
      class: "retry",
      numeric: gptStatus === "partial" || claudeStatus === "partial" ? 0.55 : 0.25,
      status: "judged_retry",
      outcome: "retry",
      reason: "At least one delta judge still sees a concrete miss.",
      blockers,
      warnings,
    };
  }

  return {
    class: "escalated",
    numeric: 0.15,
    status: "escalated",
    outcome: "escalate",
    reason: "Unexpected judge combination.",
    blockers,
    warnings,
  };
};

export const selectPassingCandidates = ({ slotResults = [], targetPassCount = 1 }) =>
  [...slotResults]
    .filter((slot) => slot?.score?.class === "pass")
    .sort((left, right) => (right?.score?.numeric ?? 0) - (left?.score?.numeric ?? 0))
    .slice(0, Math.max(1, Number(targetPassCount) || 1));
