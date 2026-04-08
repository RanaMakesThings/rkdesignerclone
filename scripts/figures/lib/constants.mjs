import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const libDir = dirname(fileURLToPath(import.meta.url));

export const FIGURES_ROOT = resolve(libDir, "..");
export const REPO_ROOT = resolve(FIGURES_ROOT, "..", "..");
export const OUTPUT_ROOT = resolve(REPO_ROOT, "output", "figures");
export const ASSET_CACHE_ROOT = resolve(OUTPUT_ROOT, ".asset-cache");
export const SPEC_ROOT = resolve(REPO_ROOT, "projects", "figures", "specs");
export const DEFAULT_POLICY_PATH = resolve(
  FIGURES_ROOT,
  "workflow-policy.json"
);
export const ASSESSMENT_SCHEMA_PATH = resolve(
  FIGURES_ROOT,
  "schemas",
  "assessment.schema.json"
);
export const RUBRIC_PATH = resolve(
  REPO_ROOT,
  "docs",
  "handbook",
  "figure-assessment-rubric.md"
);
export const IDEATION_SCHEMA_PATH = resolve(
  FIGURES_ROOT,
  "schemas",
  "ideation.schema.json"
);
export const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-6";
export const DEFAULT_CLAUDE_MAX_TOKENS = 1600;
export const DEFAULT_OPENAI_TEXT_MODEL = "gpt-5-mini";
export const DEFAULT_OPENAI_VISION_MODEL = "gpt-4.1-mini";
export const DEFAULT_OPENAI_MAX_TOKENS = 1600;

export const CANVAS = {
  width: 1920,
  height: 1080,
};

export const DEFAULT_ASSET_CANDIDATES = 6;
export const DEFAULT_ASSET_PROVIDER = "pexels";

export const ASSET_PROVIDERS = new Set(["pexels"]);

export const MEDIA_STRATEGIES = new Set(["native", "photo", "hybrid"]);

export const MEDIA_SLOT_ORIENTATIONS = new Set([
  "landscape",
  "portrait",
  "square",
]);

export const MEDIA_SLOT_ROLES = new Set([
  "hero",
  "supporting",
  "background",
  "texture",
  "card",
  "strip",
  "inset",
]);

export const MEDIA_COPY_SAFE_ZONES = new Set([
  "left",
  "right",
  "top",
  "bottom",
  "center",
]);

export const MEDIA_CLUTTER_TARGETS = new Set(["low", "medium", "high"]);

export const MEDIA_DECISION_STATUSES = new Set([
  "discovered",
  "shortlisted",
  "approved",
  "in_use",
  "rejected",
  "archived",
]);

export const FIGURE_FAMILIES = new Set([
  "proof_tiles",
  "trend_breakout_banner",
  "segmented_focus_bar",
  "compound_ribbon_day_view",
  "compound_ribbon_before_after",
  "history_wedge",
  "story_to_structure_triptych",
  "story_to_structure_membrane",
  "workflow_strip",
  "transformation_flow",
  "artifact_with_zoom_callouts",
  "hero_metric_with_scenarios",
]);

export const FAMILY_REQUIREMENTS = {
  proof_tiles: ["body.tiles"],
  trend_breakout_banner: ["body.trend", "body.breakout", "body.banner"],
  segmented_focus_bar: ["body.barLabel", "body.segments", "body.callout"],
  compound_ribbon_day_view: [
    "body.hero",
    "body.transitionLabel",
    "body.dayView",
  ],
  compound_ribbon_before_after: [
    "body.hero",
    "body.beforeRow",
    "body.transitionLabel",
    "body.afterRow",
  ],
  history_wedge: ["body.sourceBar", "body.hero", "body.support"],
  story_to_structure_triptych: ["body.left", "body.middle", "body.right"],
  story_to_structure_membrane: ["body.left", "body.middle", "body.right"],
  workflow_strip: ["body.stages"],
  transformation_flow: ["body.left", "body.middle", "body.right"],
  artifact_with_zoom_callouts: ["body.artifact", "body.callouts"],
  hero_metric_with_scenarios: [
    "body.hero",
    "body.scenarios",
    "body.bottomLine",
  ],
};

export const TRACE_RULE_TYPES = new Set([
  "chrome",
  "body",
  "constraint",
  "copy-policy",
  "layout",
]);

export const ASSESSOR_PROVIDERS = new Set([
  "auto",
  "claude",
  "openai",
  "none",
]);
