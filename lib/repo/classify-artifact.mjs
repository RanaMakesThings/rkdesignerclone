const REVIEW_RE = /(review|assess)/i;
const REPAIR_RE = /(repair|next-pass|synthesis)/i;
const MODEL_LANE_RE = /^(gemini|anthropic|openai)(-|$)/i;
const TUNE_RE = /(^|[-_/])tune([-/]|$)/i;

export const classifyArtifactBucket = (dirName) => {
  const normalized = String(dirName ?? "").toLowerCase();
  if (!normalized) {
    return "unknown";
  }
  if (normalized === "variants") {
    return "variant-tree";
  }
  if (TUNE_RE.test(normalized)) {
    return "tune";
  }
  if (REPAIR_RE.test(normalized)) {
    return "repair";
  }
  if (REVIEW_RE.test(normalized)) {
    return "review";
  }
  if (MODEL_LANE_RE.test(normalized)) {
    return "model-lane";
  }
  return "branch";
};

export const classifyArtifactStatus = ({
  status,
  hasPacket,
  hasSpec,
  hasSelectedPreview,
  hasStampedNative,
  selectedDiffersFromStamped,
}) => {
  if (status === "deprecated") {
    return "deprecated";
  }
  if (selectedDiffersFromStamped) {
    return "selected-branch-differs-from-stamped-native";
  }
  if (hasStampedNative) {
    return "stamped-native";
  }
  if (hasSelectedPreview && !hasStampedNative) {
    return "selected-preview-no-stamped-native";
  }
  if (hasSelectedPreview) {
    return "selected-branch-no-preview";
  }
  if (hasPacket && hasSpec) {
    return "packet-plus-spec";
  }
  if (hasPacket) {
    return "packet-only";
  }
  return "missing";
};
