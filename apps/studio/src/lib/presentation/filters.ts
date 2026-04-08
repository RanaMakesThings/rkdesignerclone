import type { ProjectManifest, SlideManifest } from "./studio-types";

export const STUDIO_FOCUS_VALUES = [
  "all",
  "warnings",
  "discovered",
  "selected-differs",
  "history",
] as const;

export const HISTORY_FOCUS_VALUES = [
  "all",
  "deprecated",
  "legacy",
  "orphan",
  "variant",
] as const;

export type StudioFocus = (typeof STUDIO_FOCUS_VALUES)[number];
export type HistoryFocus = (typeof HISTORY_FOCUS_VALUES)[number];

export const parseQuery = (value: string | string[] | undefined) =>
  typeof value === "string" ? value.trim() : "";

export const parseStudioFocus = (value: string | string[] | undefined): StudioFocus =>
  STUDIO_FOCUS_VALUES.includes(value as StudioFocus) ? (value as StudioFocus) : "all";

export const parseHistoryFocus = (value: string | string[] | undefined): HistoryFocus =>
  HISTORY_FOCUS_VALUES.includes(value as HistoryFocus) ? (value as HistoryFocus) : "all";

export const matchesSearchQuery = (searchText: string, query: string) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return searchText.includes(normalized);
};

export const matchesStudioFocus = (slide: SlideManifest, focus: StudioFocus) => {
  switch (focus) {
    case "warnings":
      return slide.derived.warnings.length > 0;
    case "discovered":
      return (
        slide.derived.lineageStatus.includes("discovered-unlinked-artifacts") ||
        slide.discovered.branchGroups.length > 0 ||
        (slide.discovered.variantTrees?.length ?? 0) > 0 ||
        slide.historyGroups.variantBranches.length > 0
      );
    case "selected-differs":
      return slide.derived.lineageStatus.includes(
        "selected-branch-differs-from-stamped-native"
      );
    case "history":
      return (
        slide.status === "deprecated" ||
        slide.historyGroups.canonicalVariants.length > 0 ||
        slide.historyGroups.legacyDirectories.length > 0 ||
        slide.historyGroups.reviewGroups.length > 0 ||
        slide.historyGroups.tuneRuns.length > 0 ||
        slide.historyGroups.historicalBranches.length > 0 ||
        slide.historyGroups.variantTrees.length > 0 ||
        slide.historyGroups.variantBranches.length > 0
      );
    default:
      return true;
  }
};

export const matchesHistoryFocus = (
  slide: SlideManifest,
  focus: HistoryFocus,
  project?: ProjectManifest
) => {
  switch (focus) {
    case "deprecated":
      return slide.status === "deprecated";
    case "legacy":
      return (
        slide.historyGroups.legacyDirectories.length > 0 ||
        slide.derived.lineageStatus.includes("legacy-path-mismatch")
      );
    case "orphan":
      return (
        (project?.orphanArtifacts.length ?? 0) > 0 ||
        slide.historyGroups.historicalBranches.length > 0
      );
    case "variant":
      return (
        slide.historyGroups.canonicalVariants.length > 0 ||
        slide.historyGroups.reviewGroups.length > 0 ||
        slide.historyGroups.tuneRuns.length > 0 ||
        slide.historyGroups.variantTrees.length > 0 ||
        slide.historyGroups.variantBranches.length > 0
      );
    default:
      return true;
  }
};
