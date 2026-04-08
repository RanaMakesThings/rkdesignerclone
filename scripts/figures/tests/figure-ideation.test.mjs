import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import test from "node:test";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";

import {
  aggregateCritiqueReports,
  computeCandidateWeightedTotal,
  getDefaultFigureIdeationConfigPath,
  runFigureIdeationFromPacket,
  validateFigureIdeationPacket,
  parseStructuredJson,
} from "../lib/figure-ideation.mjs";

const testDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
const repoRoot = resolve(testDir, "..", "..", "..");
const fixtureDir = resolve(testDir, "fixtures", "figure-ideation");
const slide09FixturePath = resolve(
  repoRoot,
  "scripts",
  "figures",
  "ideation-system",
  "v1.1",
  "examples",
  "slide-09-figure-ideation-input-v0.2.yaml"
);

const makeTempDir = async () => mkdtemp(join(tmpdir(), "ysn-figure-ideation-"));

const loadYaml = async (filePath) => yaml.load(await readFile(filePath, "utf8"));
const loadConfig = async () => yaml.load(await readFile(getDefaultFigureIdeationConfigPath(), "utf8"));
const loadRunManifest = async (result) => JSON.parse(await readFile(result.runManifestPath, "utf8"));

const slideFixtures = {
  "04": resolve(fixtureDir, "slide-04-fixture.yaml"),
  "05": resolve(fixtureDir, "slide-05-fixture.yaml"),
  "06": resolve(fixtureDir, "slide-06-fixture.yaml"),
  "09": slide09FixturePath,
};

const fixtureSlides = {
  "04": {
    heroId: "wedge-proof-split",
    prompts: [
      "Highlight the opening wedge with one disciplined focal zone and sparse support framing.",
      "Shift the wedge to a central territory cut with one restrained supporting field.",
      "Protect the headline while isolating the under-served wedge against quieter territory.",
      "Use a sparse wedge compare layout with one clear entry point marker."
    ],
  },
  "05": {
    heroId: "fragment-reconstruction-surface",
    prompts: [
      "Show fragmented evidence converging toward a clinician reasoning surface without cleanup metaphors.",
      "Place the evidence fragments on the left and the reconstruction surface in the middle.",
      "Keep the field sparse but make the reconstruction load explicit.",
      "Emphasize the reasoning surface as the first read."
    ],
  },
  "06": {
    heroId: "clinician-ready-brief-surface",
    prompts: [
      "Frame Vox as a disciplined clinician-ready brief surface, not a workflow strip.",
      "Use one compact product-real brief area with quiet supporting inputs.",
      "Protect whitespace and emphasize starting-point readiness.",
      "Keep the structure editorial and clinically grounded."
    ],
  },
  "09": {
    heroId: "territory-density-split",
    prompts: [
      "Compare dense after-visit territory against open encounter-start territory with one Vox anchor.",
      "Keep the right side intentionally open and defend category territory without a matrix.",
      "Make the encounter-start zone the clear point of whitespace opportunity.",
      "Use sparse territory comparison rather than lifecycle framing."
    ],
  },
};

const detectStage = (stageDir) => {
  const normalized = String(stageDir).replaceAll("\\", "/");
  const segments = normalized.split("/stages/");
  return segments.length > 1 ? segments[1].split("/")[0] : normalized;
};

const makeMockServices = ({
  slideNumber,
  forceTextFallback = false,
  disagreement = false,
  availability = {},
  failurePlan = {},
  imageFailurePlan = {},
  winnerThumbnailIndex = 0,
  successfulCritics = ["openai", "anthropic", "google"],
  includeSecondSpatialSpec = false,
  unresolvedLineage = false,
  genericGeneratorTargets = false,
}) => {
  const fixture = fixtureSlides[slideNumber];
  const criticThumbnailIds = forceTextFallback
    ? ["thumbnail-text-01", "thumbnail-text-02", "thumbnail-text-03"]
    : ["thumbnail-01", "thumbnail-02", "thumbnail-03", "thumbnail-04"];
  const effectiveAvailability = {
    openai: true,
    anthropic: true,
    google: true,
    ...availability,
  };
  const failureState = new Map(
    Object.entries(failurePlan).map(([key, value]) => [key, Number(value)])
  );
  const imageFailureState = new Map(
    Object.entries(imageFailurePlan).map(([key, value]) => [key, Number(value)])
  );
  const shouldFail = (stageName, providerFamily) => {
    const keys = [`${stageName}:${providerFamily}`, stageName];
    for (const key of keys) {
      const remaining = failureState.get(key);
      if ((remaining ?? 0) > 0) {
        failureState.set(key, remaining - 1);
        return true;
      }
    }
    return false;
  };
  const shouldFailImage = (providerFamily) => {
    const remaining = imageFailureState.get(providerFamily);
    if ((remaining ?? 0) > 0) {
      imageFailureState.set(providerFamily, remaining - 1);
      return true;
    }
    return false;
  };
  const primaryLineageCandidateId = effectiveAvailability.anthropic
    ? `${fixture.heroId}-anthropic`
    : effectiveAvailability.openai
      ? fixture.heroId
      : `${fixture.heroId}-google`;
  const altCandidateId = effectiveAvailability.anthropic
    ? `${fixture.heroId}-anthropic-challenge`
    : `${fixture.heroId}-alt`;

  const makeIdeationSet = (providerFamily) => {
    const variants = {
      openai: [
        {
          candidate_id: fixture.heroId,
          move_name: fixture.heroId.replace(/-/g, " "),
          one_sentence_logic: fixture.prompts[0],
          what_makes_it_smart: "It turns the slide job into a single visual decision.",
          viewer_sees_first: "The primary strategic zone.",
          fits_slide_because: "It carries the required burden without adding decorative clutter.",
          failure_mode: "Could feel too abstract if the territory label is weak.",
          predicted_scores: {
            job_fidelity: 9,
            clarity: 8.8,
            distinctness: 8.4,
            collapse_resistance: 8.8,
            buildability: 8.3
          }
        },
        {
          candidate_id: `${fixture.heroId}-alt`,
          move_name: "supporting field contrast",
          one_sentence_logic: fixture.prompts[1],
          what_makes_it_smart: "It keeps the same strategic logic but varies the balance.",
          viewer_sees_first: "The contrast edge.",
          fits_slide_because: "It keeps the proof concentrated and readable.",
          failure_mode: "Could downplay the protagonist if over-balanced.",
          predicted_scores: {
            job_fidelity: 8.3,
            clarity: 8,
            distinctness: 7.9,
            collapse_resistance: 8.1,
            buildability: 8.2
          }
        }
      ],
      anthropic: [
        {
          candidate_id: `${fixture.heroId}-anthropic`,
          move_name: "editorial territory compare",
          one_sentence_logic: fixture.prompts[2],
          what_makes_it_smart: "It sharpens the slide claim while preserving restraint.",
          viewer_sees_first: "The protected open zone.",
          fits_slide_because: "It makes the strategic territory legible in one glance.",
          failure_mode: "Could feel too quiet if the lead object is undersized.",
          predicted_scores: {
            job_fidelity: 8.7,
            clarity: 8.4,
            distinctness: 8,
            collapse_resistance: 8.5,
            buildability: 7.9
          }
        },
        {
          candidate_id: `${fixture.heroId}-anthropic-challenge`,
          move_name: "restrained protagonist compare",
          one_sentence_logic: fixture.prompts[3],
          what_makes_it_smart: "It keeps the compare logic but shifts the protagonist hierarchy.",
          viewer_sees_first: "The protagonist anchor.",
          fits_slide_because: "It gives the winning side a stronger starting signal.",
          failure_mode: "Could feel slightly too object-led.",
          predicted_scores: {
            job_fidelity: 8.1,
            clarity: 7.8,
            distinctness: 8.2,
            collapse_resistance: 8,
            buildability: 7.8
          }
        }
      ],
      google: [
        {
          candidate_id: `${fixture.heroId}-google`,
          move_name: "structural challenger",
          one_sentence_logic: fixture.prompts[1],
          what_makes_it_smart: "It pushes the balance while preserving the same truth.",
          viewer_sees_first: "The central anchor.",
          fits_slide_because: "It stays strategically aligned without becoming decorative.",
          failure_mode: "Could converge too closely with the safe option.",
          predicted_scores: {
            job_fidelity: 7.9,
            clarity: 7.8,
            distinctness: 7.6,
            collapse_resistance: 7.9,
            buildability: 7.7
          }
        }
      ]
    };
    return variants[providerFamily] ?? variants.openai;
  };

  return {
    availability: effectiveAvailability,
    async runStageModel({ providerFamily, stageDir }) {
      await mkdir(stageDir, { recursive: true });
      const stageName = detectStage(stageDir);
      if (!effectiveAvailability[providerFamily]) {
        throw new Error(`${providerFamily} unavailable`);
      }
      if (shouldFail(stageName, providerFamily)) {
        throw new Error(`forced failure for ${stageName}:${providerFamily}`);
      }
      if (stageName === "04-ideation") {
        const data = makeIdeationSet(providerFamily);
        await writeFile(resolve(stageDir, "mock.json"), JSON.stringify(data, null, 2));
        return { data, model: `${providerFamily}-mock`, providerFamily };
      }
      if (stageName === "08-spatialization") {
        const data = {
          spatial_specs: [{
            spatial_spec_id: "spatial-01",
            source_candidate_id: primaryLineageCandidateId,
            selected_family: slideNumber === "09" ? "density vs whitespace" : "hero object with supporting field",
            visual_anchor: "primary strategic zone",
            viewer_order: ["headline", "anchor", "supporting field"],
            regions: {
              top: ["headline"],
              left: ["support field"],
              center: ["anchor"],
              right: ["quiet contrast field"],
              bottom: ["notes"],
              protected_whitespace: ["upper-right", "outer margin"]
            },
            density_map: {
              left: "medium",
              center: "high",
              right: "low"
            },
            accent_usage: {
              primary: "one accent object",
              secondary: "minimal"
            },
            text_load: ["headline", "one support line"],
            figure_load: ["anchor", "context field"],
            literal_vs_abstract_guidance: "moderate abstraction",
            element_inventory: ["headline", "anchor", "support field"],
            keep_remove: {
              keep: ["restraint", "one protagonist"],
              remove: ["extra clutter"]
            },
            buildability_risk: "low"
          }]
        };
        if (includeSecondSpatialSpec) {
          data.spatial_specs.push({
            spatial_spec_id: unresolvedLineage ? "spatial-missing" : "spatial-02",
            source_candidate_id: unresolvedLineage ? "missing-candidate" : altCandidateId,
            selected_family: "territory comparison",
            visual_anchor: "secondary strategic zone",
            viewer_order: ["headline", "contrast edge", "quiet support"],
            regions: {
              top: ["headline"],
              left: ["contrast edge"],
              center: ["secondary anchor"],
              right: ["quiet support"],
              bottom: ["notes"],
              protected_whitespace: ["upper-left"]
            },
            density_map: {
              left: "high",
              center: "medium",
              right: "low"
            },
            accent_usage: {
              primary: "one secondary accent object",
              secondary: "minimal"
            },
            text_load: ["headline"],
            figure_load: ["secondary anchor"],
            literal_vs_abstract_guidance: "moderate abstraction",
            element_inventory: ["headline", "secondary anchor", "quiet support"],
            keep_remove: {
              keep: ["restraint"],
              remove: ["clutter"]
            },
            buildability_risk: "low"
          });
        }
        return { data, model: `${providerFamily}-mock`, providerFamily };
      }
      if (stageName === "09-thumbnail-prompts") {
        const data = {
          thumbnail_prompts: fixture.prompts.map((promptText, index) => ({
            thumbnail_prompt_id: `thumbnail-prompt-${String(index + 1).padStart(2, "0")}`,
            source_spatial_spec_id:
              includeSecondSpatialSpec && index === 1
                ? unresolvedLineage
                  ? "spatial-does-not-exist"
                  : "spatial-02"
                : "spatial-01",
            source_candidate_id:
              includeSecondSpatialSpec && index === 1
                ? unresolvedLineage
                  ? "missing-candidate"
                  : altCandidateId
                : primaryLineageCandidateId,
            generator_target: genericGeneratorTargets
              ? "image_generator"
              : index % 2 === 0
                ? "openai"
                : "google",
            prompt_text: promptText,
            expected_variation_dimension: ["anchor placement", "dense zone placement", "contrast mechanism", "label placement"][index],
            whether_copy_is_real_or_placeholder: "placeholder",
            whether_images_are_literal_or_abstract: "abstract",
            likely_risk: "may become too balanced"
          }))
        };
        return { data, model: `${providerFamily}-mock`, providerFamily };
      }
      if (stageName === "10-thumbnails" && stageDir.includes("fallback-text")) {
        const data = [
          {
            thumbnail_id: "thumbnail-text-01",
            linked_candidate_id: primaryLineageCandidateId,
            one_sentence_description: "Text-only fallback one.",
            rough_layout_summary: "anchor placement",
            what_the_viewer_sees_first: "The protagonist anchor.",
            why_it_might_work: "Keeps the slide logic intact.",
            likely_failure_mode: "Too textual."
          },
          {
            thumbnail_id: "thumbnail-text-02",
            linked_candidate_id: primaryLineageCandidateId,
            one_sentence_description: "Text-only fallback two.",
            rough_layout_summary: "dense zone placement",
            what_the_viewer_sees_first: "The contrast field.",
            why_it_might_work: "Preserves the strategic compare.",
            likely_failure_mode: "Can feel flat."
          },
          {
            thumbnail_id: "thumbnail-text-03",
            linked_candidate_id: primaryLineageCandidateId,
            one_sentence_description: "Text-only fallback three.",
            rough_layout_summary: "label placement",
            what_the_viewer_sees_first: "The headline relation.",
            why_it_might_work: "Still supports critique.",
            likely_failure_mode: "Lower taste confidence."
          }
        ];
        return { data, model: `${providerFamily}-mock`, providerFamily };
      }
      if (stageName === "11-critique") {
        if (!successfulCritics.includes(providerFamily)) {
          throw new Error(`forced critique miss for ${providerFamily}`);
        }
        const targetWinnerIndex =
          disagreement && providerFamily === "anthropic" ? 1 : winnerThumbnailIndex;
        const topWinner = criticThumbnailIds[targetWinnerIndex];
        const data = {
          thumbnail_reports: criticThumbnailIds.map((thumbnailId, index) => ({
            thumbnail_id: thumbnailId,
            scores: {
              two_second_clarity: 8.5 - index * 0.3,
              strategic_fidelity: 8.8 - index * 0.3,
              figure_burden_fit: 8.6 - index * 0.3,
              adjacent_slide_distinctness: 8.1 - index * 0.2,
              collapse_resistance: 8.7 - index * 0.2,
              elegance_restraint: 8.2 - index * 0.2,
              visual_balance: 8.1 - index * 0.3,
              build_feasibility: 8.3 - index * 0.2,
              investor_readability: 8.4 - index * 0.2
            },
            overall_score:
              disagreement && providerFamily === "anthropic"
                ? (index === 1 ? 8.9 : 8.0 - index * 0.1)
                : (index === targetWinnerIndex ? 9.1 : 8.7 - index * 0.25),
            top_strength: "Strategic read is immediate.",
            top_weakness: index === 0 ? "Minor spacing risk." : "Hierarchy weakens.",
            keep: ["primary anchor"],
            remove: ["extra filler"],
            exact_revision: "Tighten the support field.",
            confidence: 0.8
          })),
          ranked_list: criticThumbnailIds,
          winner: topWinner,
          why_winner_wins: "Strongest strategic and visual balance.",
          whether_upstream_truth_should_be_reopened: false,
          whether_human_review_is_recommended: Boolean(disagreement),
          next_action: disagreement ? "human review" : "package"
        };
        return { data, model: `${providerFamily}-mock`, providerFamily };
      }
      throw new Error(`Unhandled mock stage: ${stageDir}`);
    },
    async generateImage({ outDir, providerFamily }) {
      if (!effectiveAvailability[providerFamily] || forceTextFallback || shouldFailImage(providerFamily)) {
        throw new Error("forced image failure");
      }
      await mkdir(outDir, { recursive: true });
      const filePath = resolve(outDir, `${providerFamily}-mock.png`);
      await writeFile(filePath, providerFamily, "utf8");
      return {
        providerFamily,
        model: `${providerFamily}-image-mock`,
        filePath
      };
    }
  };
};

const runMockFigureIdeation = async ({
  slideNumber,
  configMutator = null,
  profileData = {
    project_id: "designer-health",
    acceptance_tests: {},
    guardrails: []
  },
  servicesOptions = {},
}) => {
  const packet = await loadYaml(slideFixtures[slideNumber]);
  packet.orchestration_overrides = {
    ...(packet.orchestration_overrides ?? {}),
    auto_promote_allowed: true,
    human_review_required: false,
  };
  const config = await loadConfig();
  config.run_defaults.auto_promote_allowed = true;
  config.run_defaults.human_review_required_by_default = false;
  if (typeof configMutator === "function") {
    configMutator(config, packet);
  }
  const runDir = await makeTempDir();
  try {
    const result = await runFigureIdeationFromPacket({
      packet,
      config,
      profileId: "designer",
      profileData,
      runDir,
      services: makeMockServices({ slideNumber, ...servicesOptions })
    });
    return {
      result,
      runDir,
      packet,
      config,
      runManifest: await loadRunManifest(result),
    };
  } catch (error) {
    await rm(runDir, { recursive: true, force: true });
    throw error;
  }
};

test("parseStructuredJson accepts fenced array payloads", () => {
  const parsed = parseStructuredJson("```json\n[{\"ok\":true}]\n```", "fenced array");
  assert.deepEqual(parsed, [{ ok: true }]);
});

test("validateFigureIdeationPacket distinguishes hard errors and soft warnings", async () => {
  const packet = await loadYaml(slideFixtures["04"]);
  packet.figure_requirements.must_not_become = [];
  packet.assets = {};
  const config = await loadConfig();
  const validation = await validateFigureIdeationPacket({ packet, config });
  assert.equal(validation.valid, false);
  assert.ok(validation.hard_errors.some((entry) => entry.includes("must_not_become")));
  assert.ok(validation.soft_warnings.some((entry) => entry.includes("template_file")));
});

test("computeCandidateWeightedTotal uses configured weights", () => {
  const total = computeCandidateWeightedTotal({
    weights: {
      job_fidelity: 0.2,
      audience_belief_fidelity: 0.1,
      figure_burden_fit: 0.18,
      two_second_clarity: 0.18,
      distinctness: 0.1,
      collapse_resistance: 0.14,
      elegance_restraint: 0.05,
      buildability: 0.05
    },
    scores: {
      job_fidelity: 9,
      audience_belief_fidelity: 8,
      figure_burden_fit: 9,
      two_second_clarity: 8,
      distinctness: 7,
      collapse_resistance: 9,
      elegance_restraint: 8,
      buildability: 8
    }
  });
  assert.equal(total, 8.42);
});

test("aggregateCritiqueReports flags human review when disagreement is high", () => {
  const aggregate = aggregateCritiqueReports({
    thumbnails: [{ thumbnail_id: "t1" }, { thumbnail_id: "t2" }],
    config: {
      thresholds: {
        disagreement: {
          high: 3
        }
      }
    },
    acceptanceFlags: [],
    criticReports: [
      {
        winner: "t1",
        thumbnail_reports: [
          {
            thumbnail_id: "t1",
            scores: {
              two_second_clarity: 9,
              strategic_fidelity: 9,
              figure_burden_fit: 9,
              adjacent_slide_distinctness: 8,
              collapse_resistance: 9,
              elegance_restraint: 8,
              visual_balance: 8,
              build_feasibility: 8,
              investor_readability: 8
            },
            overall_score: 9
          },
          {
            thumbnail_id: "t2",
            scores: {
              two_second_clarity: 7,
              strategic_fidelity: 7,
              figure_burden_fit: 7,
              adjacent_slide_distinctness: 7,
              collapse_resistance: 7,
              elegance_restraint: 7,
              visual_balance: 7,
              build_feasibility: 7,
              investor_readability: 7
            },
              overall_score: 1
          }
        ]
      },
      {
        winner: "t2",
        thumbnail_reports: [
          {
            thumbnail_id: "t1",
            scores: {
              two_second_clarity: 4,
              strategic_fidelity: 4,
              figure_burden_fit: 4,
              adjacent_slide_distinctness: 4,
              collapse_resistance: 4,
              elegance_restraint: 4,
              visual_balance: 4,
              build_feasibility: 4,
              investor_readability: 4
            },
              overall_score: 2
          },
          {
            thumbnail_id: "t2",
            scores: {
              two_second_clarity: 8,
              strategic_fidelity: 8,
              figure_burden_fit: 8,
              adjacent_slide_distinctness: 8,
              collapse_resistance: 8,
              elegance_restraint: 8,
              visual_balance: 8,
              build_feasibility: 8,
              investor_readability: 8
            },
              overall_score: 6
          }
        ]
      }
    ]
  });
  assert.equal(aggregate.human_review_required, true);
});

test("runFigureIdeationFromPacket packages mocked Designer fixtures for slides 4, 5, 6, and 9", async () => {
  const config = await loadConfig();
  config.run_defaults.auto_promote_allowed = true;
  config.run_defaults.human_review_required_by_default = false;
  for (const slideNumber of ["04", "05", "06", "09"]) {
    const runDir = await makeTempDir();
    try {
      const packet = await loadYaml(slideFixtures[slideNumber]);
      packet.orchestration_overrides = {
        ...(packet.orchestration_overrides ?? {}),
        auto_promote_allowed: true,
        human_review_required: false,
      };
      const result = await runFigureIdeationFromPacket({
        packet,
        config,
        profileId: "designer",
        profileData: {
          project_id: "designer-health",
          acceptance_tests: {},
          guardrails: []
        },
        runDir,
        services: makeMockServices({ slideNumber })
      });
      assert.equal(result.ok, true);
      assert.equal(result.exitState, "packaged");
      const manifest = JSON.parse(await readFile(result.runManifestPath, "utf8"));
      assert.equal(manifest.exit_state, "packaged");
      assert.ok(manifest.state_transitions.includes("thumbnailed"));
      assert.ok(manifest.selected_candidate_id);
      const buildSpec = await readFile(result.buildSpecPath, "utf8");
      assert.match(buildSpec, /# Slide/);
    } finally {
      await rm(runDir, { recursive: true, force: true });
    }
  }
});

test("runFigureIdeationFromPacket falls back to textual thumbnails when generators fail", async () => {
  const config = await loadConfig();
  config.run_defaults.auto_promote_allowed = true;
  config.run_defaults.human_review_required_by_default = false;
  const runDir = await makeTempDir();
  try {
    const packet = await loadYaml(slideFixtures["06"]);
    const result = await runFigureIdeationFromPacket({
      packet,
      config,
      profileId: "designer",
      profileData: {
        project_id: "designer-health",
        acceptance_tests: {},
        guardrails: []
      },
      runDir,
      services: makeMockServices({ slideNumber: "06", forceTextFallback: true })
    });
    assert.equal(result.ok, true);
    const thumbnailManifest = JSON.parse(await readFile(result.thumbnailManifestPath, "utf8"));
    assert.ok(
      thumbnailManifest.thumbnails.every((entry) => entry.generator_target === "text_fallback")
    );
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});

test("runFigureIdeationFromPacket falls back cleanly when OpenAI is unavailable for thumbnail prompts", async () => {
  const { result, runDir, runManifest } = await runMockFigureIdeation({
    slideNumber: "09",
    configMutator: (_config, packet) => {
      packet.provider_preferences.text_ideators = [];
    },
    servicesOptions: {
      availability: {
        openai: false,
      },
    },
  });
  try {
    assert.equal(result.ok, true);
    assert.equal(result.exitState, "packaged");
    const thumbnailPromptAttempts = runManifest.stage_attempts.filter(
      (entry) => entry.stage === "thumbnail_prompt_builder"
    );
    assert.ok(
      thumbnailPromptAttempts.some(
        (entry) =>
          entry.provider_family === "google" && entry.outcome === "success"
      )
    );
    assert.ok(
      thumbnailPromptAttempts.every((entry) => entry.provider_family !== "openai")
    );
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});

test("runFigureIdeationFromPacket falls back for spatialization when the primary provider fails", async () => {
  const { result, runDir, runManifest } = await runMockFigureIdeation({
    slideNumber: "05",
    configMutator: (config) => {
      config.retry_policy.max_provider_retries = 1;
    },
    servicesOptions: {
      failurePlan: {
        "08-spatialization:google": 2,
      },
    },
  });
  try {
    assert.equal(result.ok, true);
    assert.equal(result.exitState, "packaged");
    const spatializationAttempts = runManifest.stage_attempts.filter(
      (entry) => entry.stage === "spatialization"
    );
    assert.ok(
      spatializationAttempts.some(
        (entry) =>
          entry.provider_family === "google" && entry.outcome === "retryable_failure"
      )
    );
    assert.ok(
      spatializationAttempts.some(
        (entry) =>
          entry.provider_family === "anthropic" && entry.outcome === "success"
      )
    );
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});

test("runFigureIdeationFromPacket enforces provider, stage, and full-run retry budgets", async () => {
  const { result, runDir, runManifest } = await runMockFigureIdeation({
    slideNumber: "04",
    configMutator: (config) => {
      config.retry_policy.max_provider_retries = 1;
      config.retry_policy.max_stage_reruns = 1;
      config.retry_policy.max_full_run_retries = 1;
      config.thresholds.min_candidate_diversity = 1.1;
    },
    servicesOptions: {
      failurePlan: {
        "04-ideation:anthropic": 2,
      },
    },
  });
  try {
    assert.equal(result.ok, true);
    assert.equal(result.exitState, "retry_ideation");
    assert.deepEqual(
      [...new Set(runManifest.stage_attempts.map((entry) => entry.full_run_attempt))],
      [1, 2]
    );
    assert.equal(runManifest.retry_counts.providers.anthropic, 2);
    assert.equal(runManifest.retry_counts.ideation, 2);
    assert.equal(runManifest.retry_counts.full_runs, 1);
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});

test("default config now prefers human review over auto-packaging", async () => {
  const config = await loadConfig();
  const runDir = await makeTempDir();
  try {
    const packet = await loadYaml(slideFixtures["09"]);
    const result = await runFigureIdeationFromPacket({
      packet,
      config,
      profileId: "designer",
      profileData: {
        project_id: "designer-health",
        acceptance_tests: {},
        guardrails: []
      },
      runDir,
      services: makeMockServices({ slideNumber: "09" })
    });
    assert.equal(result.ok, true);
    assert.equal(result.exitState, "human_review_required");
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});

test("figure ideation normalizes 0-1 predicted scores to the 10-point scale", async () => {
  const { runDir } = await runMockFigureIdeation({
    slideNumber: "09",
  });
  try {
    const shortlistPath = resolve(runDir, "stages", "06-shortlist", "shortlist.json");
    const shortlist = JSON.parse(await readFile(shortlistPath, "utf8"));
    const googleCandidate = shortlist.scored_candidates.find(
      (entry) => entry.candidate_id === "territory-density-split-google"
    );
    assert.ok(googleCandidate);
    assert.equal(googleCandidate.scores.job_fidelity, 7.9);
    assert.ok(googleCandidate.weighted_total > 7);
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});

test("generic thumbnail generator targets round-robin across configured generators", async () => {
  const { result, runDir } = await runMockFigureIdeation({
    slideNumber: "09",
    servicesOptions: {
      genericGeneratorTargets: true,
    },
  });
  try {
    assert.equal(result.ok, true);
    const thumbnailManifest = JSON.parse(await readFile(result.thumbnailManifestPath, "utf8"));
    assert.ok(
      thumbnailManifest.thumbnails.some((entry) => entry.generator_target === "google")
    );
    assert.ok(
      thumbnailManifest.thumbnails.some((entry) => entry.generator_target === "openai")
    );
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});

test("build spec preserves explicit figure copy labels from the packet", async () => {
  const { result, runDir } = await runMockFigureIdeation({
    slideNumber: "09",
    configMutator: (_config, packet) => {
      packet.figure_copy = {
        panel_labels: ["DOCUMENTATION", "CHANGING THE VISIT"],
        figure_labels: [
          "Ambient scribe",
          "Note generation",
          "Documentation support",
          "Clerical relief",
          "VOX"
        ],
      };
    },
  });
  try {
    assert.equal(result.ok, true);
    assert.deepEqual(result.buildSpec.copy_recommendation.panel_labels, [
      "DOCUMENTATION",
      "CHANGING THE VISIT",
    ]);
    assert.ok(
      result.buildSpec.copy_recommendation.figure_labels.includes("Ambient scribe")
    );
    assert.ok(
      result.buildSpec.builder_handoff_notes.includes("Use real locked copy for named figure elements.")
    );
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});

test("runFigureIdeationFromPacket marks quorum degradation as human review required", async () => {
  const { result, runDir, runManifest } = await runMockFigureIdeation({
    slideNumber: "06",
    configMutator: (config) => {
      config.model_assignment.critique.quorum = 2;
    },
    servicesOptions: {
      successfulCritics: ["openai"],
    },
  });
  try {
    assert.equal(result.ok, true);
    assert.equal(result.exitState, "human_review_required");
    assert.equal(result.critiqueReport.critics_completed, 1);
    assert.ok(
      runManifest.notes.some((entry) => entry.includes("Critique quorum unmet: 1/2"))
    );
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});

test("runFigureIdeationFromPacket packages the actual winning candidate and spatial lineage", async () => {
  const { result, runDir, runManifest } = await runMockFigureIdeation({
    slideNumber: "09",
    servicesOptions: {
      includeSecondSpatialSpec: true,
      winnerThumbnailIndex: 1,
    },
  });
  try {
    assert.equal(result.ok, true);
    assert.equal(result.exitState, "packaged");
    assert.equal(
      result.buildSpec.selected_candidate_id,
      "territory-density-split-anthropic-challenge"
    );
    assert.equal(result.buildSpec.selected_spatial_spec_id, "spatial-02");
    assert.equal(
      runManifest.winner_lineage.candidate_id,
      "territory-density-split-anthropic-challenge"
    );
    assert.equal(runManifest.winner_lineage.spatial_spec_id, "spatial-02");
    assert.equal(runManifest.selected_thumbnail_id, "thumbnail-02");
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});

test("runFigureIdeationFromPacket hard-fails when winning thumbnail lineage cannot be resolved", async () => {
  const { result, runDir, runManifest } = await runMockFigureIdeation({
    slideNumber: "09",
    servicesOptions: {
      includeSecondSpatialSpec: true,
      unresolvedLineage: true,
      winnerThumbnailIndex: 1,
    },
  });
  try {
    assert.equal(result.ok, false);
    assert.equal(result.exitState, "failed");
    assert.ok(
      runManifest.notes.some((entry) => entry.includes("Unable to resolve"))
    );
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});

test("runFigureIdeationFromPacket preserves legacy config compatibility and reports deprecations", async () => {
  const { result, runDir, runManifest } = await runMockFigureIdeation({
    slideNumber: "05",
    configMutator: (config) => {
      config.model_assignment.interpretation.primary = "openai";
      config.model_assignment.shortlist_selection.primary = "anthropic";
      config.model_assignment.packaging.primary = "openai";
      config.model_assignment.merge_and_cluster.fallback_model = "gpt-5.4";
      config.model_assignment.thumbnail_generation.optional_workers = [
        {
          alias: "local-html-legacy",
          provider_family: "google",
          task: "html_structural",
        },
      ];
    },
  });
  try {
    assert.equal(result.ok, true);
    assert.ok(
      runManifest.deprecation_notes.some((entry) =>
        entry.includes("interpretation provider routing is deprecated")
      )
    );
    assert.ok(
      runManifest.deprecation_notes.some((entry) =>
        entry.includes("shortlist_selection provider routing is deprecated")
      )
    );
    assert.ok(
      runManifest.deprecation_notes.some((entry) =>
        entry.includes("packaging provider routing is deprecated")
      )
    );
    assert.ok(
      runManifest.deprecation_notes.some((entry) =>
        entry.includes("merge_and_cluster.fallback_model is deprecated")
      )
    );
    assert.ok(
      runManifest.deprecation_notes.some((entry) =>
        entry.includes("thumbnail_generation.optional_workers is deprecated")
      )
    );
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});
