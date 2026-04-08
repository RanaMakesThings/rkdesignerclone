import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  mkdtemp,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import test from "node:test";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  buildRepairPrompt,
  parseChangeRequestText,
  runGeminiHtmlTune,
} from "../../llm/gemini-html-tune-lib.mjs";
import { readJson, writeJson } from "../lib/io.mjs";
import {
  createSlideVersion,
  getProjectedRootArtifactPaths,
  promoteSlideVersion,
  readSlideManifest,
} from "../lib/slide-versioning.mjs";

const makeTempDir = async () => mkdtemp(join(tmpdir(), "ysn-gemini-tune-"));

const createChangeFile = async (dir, body = {}) => {
  const filePath = resolve(dir, "change-request.md");
  const text = [
    "## Requested change",
    body.requestedChange ?? "Move the hero box slightly right.",
    "",
    "## Success checks",
    body.successChecks ?? "The hero box is visibly farther right than before.",
    "",
    "## Guardrails",
    body.guardrails ?? "Do not change copy.",
    "",
  ].join("\n");
  await writeFile(filePath, text, "utf8");
  return filePath;
};

const seedArtifactDir = async (dir, meta = {}) => {
  await mkdir(dir, { recursive: true });
  await writeFile(
    resolve(dir, "generated.html"),
    "<!doctype html><html><body>baseline</body></html>\n",
    "utf8"
  );
  await writeFile(resolve(dir, "prompt.txt"), "Original prompt\n", "utf8");
  await writeJson(resolve(dir, "request.json"), {
    model: "gemini-3.1-pro-preview",
    temperature: 0.4,
    ...meta,
  });
};

const seedVersionedArtifactDir = async (projectRoot, slideId) => {
  const slideDir = resolve(projectRoot, "slide-figures", slideId);
  await mkdir(slideDir, { recursive: true });

  const created = await createSlideVersion({
    projectRoot,
    slideId,
    slideDir,
    label: `${slideId}-tune-base`,
    sourceKind: "legacy-import",
  });

  const artifactDir = resolve(created.versionDir, "gemini-html");
  await seedArtifactDir(artifactDir);
  await promoteSlideVersion({
    projectRoot,
    slideId,
    slideDir,
    versionId: created.versionId,
  });

  return {
    slideDir,
    versionId: created.versionId,
    versionDir: created.versionDir,
    artifactDir,
  };
};

const makeFakeScreenshot = () => async ({ inputPath, outputPath }) => {
  await writeFile(outputPath, `preview:${inputPath}`, "utf8");
};

const makeFakeGenerator = (htmlOutputs, calls) => async (args) => {
  calls.push(args);
  const next = htmlOutputs.shift() ?? "<html><body>fallback</body></html>";
  return {
    text: next,
    raw: { html: next },
  };
};

const makeFakeJudge = (provider, outputs, calls) => async (args) => {
  calls.push({ provider, ...args });
  const normalized = outputs.shift();
  return {
    normalized,
    raw: normalized,
    response: { provider },
  };
};

const makeFakeRegressionReview = (provider, outputs, calls) => async (args) => {
  calls.push({ provider, ...args });
  const normalized = outputs.shift();
  return {
    normalized,
    raw: normalized,
    response: { provider },
  };
};

const createCodexReviewFile = async (dir, verdict = "promote") => {
  const filePath = resolve(dir, "codex-micro-review.md");
  const text = [
    "## Verdict",
    verdict,
    "",
    "## What changed",
    "The requested delta was applied.",
    "",
    "## Regressions",
    verdict === "block" ? "- Arrowhead disappeared." : "- None observed.",
    "",
    "## Notes",
    "Quick operator note.",
    "",
  ].join("\n");
  await writeFile(filePath, text, "utf8");
  return filePath;
};

const readSingleRunState = async (artifactDir) => {
  const tuneDir = resolve(artifactDir, "tune");
  const entries = await readdir(tuneDir);
  assert.equal(entries.length, 1);
  return readJson(resolve(tuneDir, entries[0], "state.json"));
};

test("parseChangeRequestText enforces required headings", () => {
  const parsed = parseChangeRequestText(
    [
      "## Requested change",
      "Shift the badge down.",
      "",
      "## Success checks",
      "The badge sits below the title.",
      "",
      "## Guardrails",
      "Keep the title unchanged.",
    ].join("\n")
  );
  assert.equal(parsed.requestedChange, "Shift the badge down.");
  assert.equal(parsed.successChecks, "The badge sits below the title.");
  assert.equal(parsed.guardrails, "Keep the title unchanged.");

  assert.throws(
    () => parseChangeRequestText("## Requested change\nOnly one section."),
    /must include `## Requested change` and `## Success checks`/
  );
});

test("buildRepairPrompt includes previous miss summary when present", () => {
  const prompt = buildRepairPrompt({
    originalPrompt: "Make a clean deck graphic.",
    requestedChange: "Move the card right.",
    successChecks: "The card is right of the divider.",
    guardrails: "Do not change copy.",
    previousMissSummary: "GPT judge: the card is still centered.",
  });
  assert.match(prompt, /## What the previous attempt still missed/);
  assert.match(prompt, /the card is still centered/);
});

test("runGeminiHtmlTune backfills images and promotes a first-attempt success", async () => {
  const dir = await makeTempDir();
  const artifactDir = resolve(dir, "artifact");
  const referenceImage = resolve(dir, "ref.png");
  const codexReviewFile = resolve(dir, "codex-micro-review.md");
  const generatorCalls = [];
  const gptCalls = [];
  const claudeCalls = [];
  const gptRegressionCalls = [];
  const claudeRegressionCalls = [];

  try {
    await seedArtifactDir(artifactDir);
    await writeFile(referenceImage, "ref", "utf8");
    await createCodexReviewFile(dir, "promote");
    const changeFilePath = await createChangeFile(dir);

    const result = await runGeminiHtmlTune({
      dir: artifactDir,
      changeFilePath,
      imagePaths: [referenceImage],
      codexReviewFilePath: codexReviewFile,
      deps: {
        captureHtmlScreenshotImpl: makeFakeScreenshot(),
        generateGeminiTextImpl: makeFakeGenerator(
          ["<html><body>attempt-one</body></html>"],
          generatorCalls
        ),
        runOpenAIJudgeImpl: makeFakeJudge(
          "gpt",
          [
            {
              status: "applied",
              summary: "done",
              evidence: ["moved right"],
              nextPrompt: "",
              needsHuman: false,
            },
          ],
          gptCalls
        ),
        runClaudeJudgeImpl: makeFakeJudge(
          "claude",
          [
            {
              status: "applied",
              summary: "done",
              evidence: ["moved right"],
              nextPrompt: "",
              needsHuman: false,
            },
          ],
          claudeCalls
        ),
        runOpenAIRegressionReviewImpl: makeFakeRegressionReview(
          "gpt-regression",
          [
            {
              verdict: "ok",
              rationale: "No regressions.",
              blockers: [],
              nextMove: "",
            },
          ],
          gptRegressionCalls
        ),
        runClaudeRegressionReviewImpl: makeFakeRegressionReview(
          "claude-regression",
          [
            {
              verdict: "ok",
              rationale: "No regressions.",
              blockers: [],
              nextMove: "",
            },
          ],
          claudeRegressionCalls
        ),
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.winningAttempt, "attempt-01");
    assert.equal(generatorCalls.length, 1);
    assert.deepEqual(generatorCalls[0].imagePaths, [
      resolve(artifactDir, "preview.png"),
      referenceImage,
    ]);

    const topLevelMeta = await readJson(resolve(artifactDir, "request.json"));
    assert.deepEqual(topLevelMeta.referenceImages, [referenceImage]);
    assert.equal(topLevelMeta.tune.latestRunId, result.runId);
    assert.equal(topLevelMeta.tune.winningAttempt, "attempt-01");

    const topLevelPrompt = await readFile(resolve(artifactDir, "prompt.txt"), "utf8");
    assert.match(topLevelPrompt, /Move the hero box slightly right/);
    const promotedHtml = await readFile(resolve(artifactDir, "generated.html"), "utf8");
    assert.match(promotedHtml, /attempt-one/);
    assert.ok(existsSync(resolve(artifactDir, "preview.png")));
    assert.ok(existsSync(resolve(artifactDir, "tune", result.runId, "attempt-01")));
    assert.equal(gptCalls.length, 1);
    assert.equal(claudeCalls.length, 1);
    assert.equal(gptRegressionCalls.length, 1);
    assert.equal(claudeRegressionCalls.length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("runGeminiHtmlTune promotes a version-backed artifact dir back to the slide root", async () => {
  const dir = await makeTempDir();
  const projectRoot = resolve(dir, "projects", "designer-health");
  const { slideDir, versionId, versionDir, artifactDir } =
    await seedVersionedArtifactDir(projectRoot, "slide-11");
  const codexReviewFile = resolve(dir, "codex-micro-review.md");
  const generatorCalls = [];

  try {
    await createCodexReviewFile(dir, "promote");
    const changeFilePath = await createChangeFile(dir);

    const result = await runGeminiHtmlTune({
      dir: artifactDir,
      changeFilePath,
      codexReviewFilePath: codexReviewFile,
      deps: {
        captureHtmlScreenshotImpl: makeFakeScreenshot(),
        generateGeminiTextImpl: makeFakeGenerator(
          ["<html><body>version-backed</body></html>"],
          generatorCalls
        ),
        runOpenAIJudgeImpl: makeFakeJudge(
          "gpt",
          [
            {
              status: "applied",
              summary: "done",
              evidence: ["moved right"],
              nextPrompt: "",
              needsHuman: false,
            },
          ],
          []
        ),
        runClaudeJudgeImpl: makeFakeJudge(
          "claude",
          [
            {
              status: "applied",
              summary: "done",
              evidence: ["moved right"],
              nextPrompt: "",
              needsHuman: false,
            },
          ],
          []
        ),
        runOpenAIRegressionReviewImpl: makeFakeRegressionReview(
          "gpt-regression",
          [
            {
              verdict: "ok",
              rationale: "No regressions.",
              blockers: [],
              nextMove: "",
            },
          ],
          []
        ),
        runClaudeRegressionReviewImpl: makeFakeRegressionReview(
          "claude-regression",
          [
            {
              verdict: "ok",
              rationale: "No regressions.",
              blockers: [],
              nextMove: "",
            },
          ],
          []
        ),
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.winningAttempt, "attempt-01");
    assert.equal(generatorCalls.length, 1);

    const slideVersionHtml = await readFile(
      getProjectedRootArtifactPaths({
        slideDir,
        slideDirName: "slide-11",
        versionId,
      }).htmlPath,
      "utf8"
    );
    assert.match(slideVersionHtml, /version-backed/);
    const versionedHtml = await readFile(
      resolve(versionDir, "gemini-html", "generated.html"),
      "utf8"
    );
    assert.match(versionedHtml, /version-backed/);

    const manifest = await readSlideManifest({
      projectRoot,
      slideId: "slide-11",
      slideDir,
    });
    assert.equal(manifest.currentVersionId, versionId);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("runGeminiHtmlTune retries once before succeeding", async () => {
  const dir = await makeTempDir();
  const artifactDir = resolve(dir, "artifact");
  const generatorCalls = [];
  const codexReviewFile = resolve(dir, "codex-micro-review.md");

  try {
    await seedArtifactDir(artifactDir, {
      referenceImages: [resolve(dir, "existing-ref.png")],
    });
    await writeFile(resolve(dir, "existing-ref.png"), "ref", "utf8");
    await createCodexReviewFile(dir, "promote");
    const changeFilePath = await createChangeFile(dir);

    const result = await runGeminiHtmlTune({
      dir: artifactDir,
      changeFilePath,
      codexReviewFilePath: codexReviewFile,
      deps: {
        captureHtmlScreenshotImpl: makeFakeScreenshot(),
        generateGeminiTextImpl: makeFakeGenerator(
          [
            "<html><body>attempt-one</body></html>",
            "<html><body>attempt-two</body></html>",
          ],
          generatorCalls
        ),
        runOpenAIJudgeImpl: makeFakeJudge(
          "gpt",
          [
            {
              status: "partial",
              summary: "The box moved, but not enough.",
              evidence: ["still near center"],
              nextPrompt: "Push the box farther right.",
              needsHuman: false,
            },
            {
              status: "applied",
              summary: "done",
              evidence: ["clear move"],
              nextPrompt: "",
              needsHuman: false,
            },
          ],
          []
        ),
        runClaudeJudgeImpl: makeFakeJudge(
          "claude",
          [
            {
              status: "not_applied",
              summary: "The box is still too close to the divider.",
              evidence: ["edge remains aligned"],
              nextPrompt: "Shift the box right of the divider.",
              needsHuman: false,
            },
            {
              status: "applied",
              summary: "done",
              evidence: ["clear move"],
              nextPrompt: "",
              needsHuman: false,
            },
          ],
          []
        ),
        runOpenAIRegressionReviewImpl: makeFakeRegressionReview(
          "gpt-regression",
          [
            {
              verdict: "ok",
              rationale: "No regressions.",
              blockers: [],
              nextMove: "",
            },
            {
              verdict: "ok",
              rationale: "No regressions.",
              blockers: [],
              nextMove: "",
            },
          ],
          []
        ),
        runClaudeRegressionReviewImpl: makeFakeRegressionReview(
          "claude-regression",
          [
            {
              verdict: "ok",
              rationale: "No regressions.",
              blockers: [],
              nextMove: "",
            },
            {
              verdict: "ok",
              rationale: "No regressions.",
              blockers: [],
              nextMove: "",
            },
          ],
          []
        ),
      },
    });

    assert.equal(result.winningAttempt, "attempt-02");
    assert.equal(generatorCalls.length, 2);
    const attemptTwoPrompt = await readFile(
      resolve(artifactDir, "tune", result.runId, "attempt-02", "repair-prompt.txt"),
      "utf8"
    );
    assert.match(attemptTwoPrompt, /What the previous attempt still missed/);
    assert.match(attemptTwoPrompt, /still near center/);
    assert.match(attemptTwoPrompt, /too close to the divider/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("runGeminiHtmlTune escalates on judge contradiction", async () => {
  const dir = await makeTempDir();
  const artifactDir = resolve(dir, "artifact");

  try {
    await seedArtifactDir(artifactDir);
    const changeFilePath = await createChangeFile(dir);

    await assert.rejects(
      () =>
        runGeminiHtmlTune({
          dir: artifactDir,
          changeFilePath,
          deps: {
            captureHtmlScreenshotImpl: makeFakeScreenshot(),
            generateGeminiTextImpl: makeFakeGenerator(
              ["<html><body>attempt-one</body></html>"],
              []
            ),
            runOpenAIJudgeImpl: makeFakeJudge(
              "gpt",
              [
                {
                  status: "applied",
                  summary: "done",
                  evidence: [],
                  nextPrompt: "",
                  needsHuman: false,
                },
              ],
              []
            ),
            runClaudeJudgeImpl: makeFakeJudge(
              "claude",
              [
                {
                  status: "not_applied",
                  summary: "not done",
                  evidence: [],
                  nextPrompt: "",
                  needsHuman: false,
                },
              ],
              []
            ),
            runOpenAIRegressionReviewImpl: makeFakeRegressionReview(
              "gpt-regression",
              [
                {
                  verdict: "ok",
                  rationale: "No regressions.",
                  blockers: [],
                  nextMove: "",
                },
              ],
              []
            ),
            runClaudeRegressionReviewImpl: makeFakeRegressionReview(
              "claude-regression",
              [
                {
                  verdict: "ok",
                  rationale: "No regressions.",
                  blockers: [],
                  nextMove: "",
                },
              ],
              []
            ),
          },
        }),
      /human review/
    );

    const state = await readSingleRunState(artifactDir);
    assert.equal(state.status, "needs-human");
    assert.equal(state.attempts.length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("runGeminiHtmlTune escalates on ambiguous or out_of_scope verdicts", async () => {
  const dir = await makeTempDir();
  const artifactDir = resolve(dir, "artifact");

  try {
    await seedArtifactDir(artifactDir);
    const changeFilePath = await createChangeFile(dir);

    await assert.rejects(
      () =>
        runGeminiHtmlTune({
          dir: artifactDir,
          changeFilePath,
          deps: {
            captureHtmlScreenshotImpl: makeFakeScreenshot(),
            generateGeminiTextImpl: makeFakeGenerator(
              ["<html><body>attempt-one</body></html>"],
              []
            ),
            runOpenAIJudgeImpl: makeFakeJudge(
              "gpt",
              [
                {
                  status: "ambiguous",
                  summary: "cannot tell",
                  evidence: [],
                  nextPrompt: "",
                  needsHuman: false,
                },
              ],
              []
            ),
            runClaudeJudgeImpl: makeFakeJudge(
              "claude",
              [
                {
                  status: "out_of_scope",
                  summary: "needs redesign",
                  evidence: [],
                  nextPrompt: "",
                  needsHuman: false,
                },
              ],
              []
            ),
            runOpenAIRegressionReviewImpl: makeFakeRegressionReview(
              "gpt-regression",
              [
                {
                  verdict: "ok",
                  rationale: "No regressions.",
                  blockers: [],
                  nextMove: "",
                },
              ],
              []
            ),
            runClaudeRegressionReviewImpl: makeFakeRegressionReview(
              "claude-regression",
              [
                {
                  verdict: "ok",
                  rationale: "No regressions.",
                  blockers: [],
                  nextMove: "",
                },
              ],
              []
            ),
          },
        }),
      /human review/
    );

    const state = await readSingleRunState(artifactDir);
    assert.equal(state.status, "needs-human");
    assert.equal(state.attempts.length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("runGeminiHtmlTune stops after max retries and preserves tune history", async () => {
  const dir = await makeTempDir();
  const artifactDir = resolve(dir, "artifact");

  try {
    await seedArtifactDir(artifactDir);
    const changeFilePath = await createChangeFile(dir);

    await assert.rejects(
      () =>
        runGeminiHtmlTune({
          dir: artifactDir,
          changeFilePath,
          maxRetries: 3,
          deps: {
            captureHtmlScreenshotImpl: makeFakeScreenshot(),
            generateGeminiTextImpl: makeFakeGenerator(
              [
                "<html><body>attempt-one</body></html>",
                "<html><body>attempt-two</body></html>",
                "<html><body>attempt-three</body></html>",
              ],
              []
            ),
            runOpenAIJudgeImpl: makeFakeJudge(
              "gpt",
              [
                {
                  status: "partial",
                  summary: "still partial",
                  evidence: [],
                  nextPrompt: "",
                  needsHuman: false,
                },
                {
                  status: "partial",
                  summary: "still partial",
                  evidence: [],
                  nextPrompt: "",
                  needsHuman: false,
                },
                {
                  status: "partial",
                  summary: "still partial",
                  evidence: [],
                  nextPrompt: "",
                  needsHuman: false,
                },
              ],
              []
            ),
            runClaudeJudgeImpl: makeFakeJudge(
              "claude",
              [
                {
                  status: "not_applied",
                  summary: "still not applied",
                  evidence: [],
                  nextPrompt: "",
                  needsHuman: false,
                },
                {
                  status: "not_applied",
                  summary: "still not applied",
                  evidence: [],
                  nextPrompt: "",
                  needsHuman: false,
                },
                {
                  status: "not_applied",
                  summary: "still not applied",
                  evidence: [],
                  nextPrompt: "",
                  needsHuman: false,
                },
              ],
              []
            ),
            runOpenAIRegressionReviewImpl: makeFakeRegressionReview(
              "gpt-regression",
              [
                {
                  verdict: "ok",
                  rationale: "No regressions.",
                  blockers: [],
                  nextMove: "",
                },
                {
                  verdict: "ok",
                  rationale: "No regressions.",
                  blockers: [],
                  nextMove: "",
                },
                {
                  verdict: "ok",
                  rationale: "No regressions.",
                  blockers: [],
                  nextMove: "",
                },
              ],
              []
            ),
            runClaudeRegressionReviewImpl: makeFakeRegressionReview(
              "claude-regression",
              [
                {
                  verdict: "ok",
                  rationale: "No regressions.",
                  blockers: [],
                  nextMove: "",
                },
                {
                  verdict: "ok",
                  rationale: "No regressions.",
                  blockers: [],
                  nextMove: "",
                },
                {
                  verdict: "ok",
                  rationale: "No regressions.",
                  blockers: [],
                  nextMove: "",
                },
              ],
              []
            ),
          },
        }),
      /max retries/
    );

    const state = await readSingleRunState(artifactDir);
    assert.equal(state.status, "failed");
    assert.equal(state.attempts.length, 3);
    assert.ok(
      existsSync(resolve(artifactDir, "tune", state.runId, "attempt-03", "decision.json"))
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("runGeminiHtmlTune requires a codex micro-review note before promoting", async () => {
  const dir = await makeTempDir();
  const artifactDir = resolve(dir, "artifact");

  try {
    await seedArtifactDir(artifactDir);
    const changeFilePath = await createChangeFile(dir);

    await assert.rejects(
      () =>
        runGeminiHtmlTune({
          dir: artifactDir,
          changeFilePath,
          deps: {
            captureHtmlScreenshotImpl: makeFakeScreenshot(),
            generateGeminiTextImpl: makeFakeGenerator(
              ["<html><body>attempt-one</body></html>"],
              []
            ),
            runOpenAIJudgeImpl: makeFakeJudge(
              "gpt",
              [
                {
                  status: "applied",
                  summary: "done",
                  evidence: ["moved right"],
                  nextPrompt: "",
                  needsHuman: false,
                },
              ],
              []
            ),
            runClaudeJudgeImpl: makeFakeJudge(
              "claude",
              [
                {
                  status: "applied",
                  summary: "done",
                  evidence: ["moved right"],
                  nextPrompt: "",
                  needsHuman: false,
                },
              ],
              []
            ),
            runOpenAIRegressionReviewImpl: makeFakeRegressionReview(
              "gpt-regression",
              [
                {
                  verdict: "ok",
                  rationale: "No regressions.",
                  blockers: [],
                  nextMove: "",
                },
              ],
              []
            ),
            runClaudeRegressionReviewImpl: makeFakeRegressionReview(
              "claude-regression",
              [
                {
                  verdict: "ok",
                  rationale: "No regressions.",
                  blockers: [],
                  nextMove: "",
                },
              ],
              []
            ),
          },
        }),
      /Codex\/operator micro-review/
    );

    const state = await readSingleRunState(artifactDir);
    assert.equal(state.status, "needs-codex-review");
    assert.ok(state.pendingCodexReview?.codexReviewPath);
    assert.ok(existsSync(state.pendingCodexReview.codexReviewPath));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("runGeminiHtmlTune blocks promotion on a single regression reviewer blocker", async () => {
  const dir = await makeTempDir();
  const artifactDir = resolve(dir, "artifact");

  try {
    await seedArtifactDir(artifactDir);
    const changeFilePath = await createChangeFile(dir);

    await assert.rejects(
      () =>
        runGeminiHtmlTune({
          dir: artifactDir,
          changeFilePath,
          deps: {
            captureHtmlScreenshotImpl: makeFakeScreenshot(),
            generateGeminiTextImpl: makeFakeGenerator(
              ["<html><body>attempt-one</body></html>"],
              []
            ),
            runOpenAIJudgeImpl: makeFakeJudge(
              "gpt",
              [
                {
                  status: "applied",
                  summary: "done",
                  evidence: ["moved right"],
                  nextPrompt: "",
                  needsHuman: false,
                },
              ],
              []
            ),
            runClaudeJudgeImpl: makeFakeJudge(
              "claude",
              [
                {
                  status: "applied",
                  summary: "done",
                  evidence: ["moved right"],
                  nextPrompt: "",
                  needsHuman: false,
                },
              ],
              []
            ),
            runOpenAIRegressionReviewImpl: makeFakeRegressionReview(
              "gpt-regression",
              [
                {
                  verdict: "ok",
                  rationale: "No regressions.",
                  blockers: [],
                  nextMove: "",
                },
              ],
              []
            ),
            runClaudeRegressionReviewImpl: makeFakeRegressionReview(
              "claude-regression",
              [
                {
                  verdict: "blocker",
                  rationale: "Arrowhead disappeared.",
                  blockers: ["Arrowhead is missing or ambiguous."],
                  nextMove: "Restore a visible arrowhead.",
                },
              ],
              []
            ),
          },
        }),
      /concrete visual break/
    );

    const state = await readSingleRunState(artifactDir);
    assert.equal(state.status, "needs-human");
    assert.match(state.failureReason, /concrete visual break/i);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("runGeminiHtmlTune blocks before image review on static sanity issues", async () => {
  const dir = await makeTempDir();
  const artifactDir = resolve(dir, "artifact");

  try {
    await seedArtifactDir(artifactDir);
    const changeFilePath = await createChangeFile(dir);

    await assert.rejects(
      () =>
        runGeminiHtmlTune({
          dir: artifactDir,
          changeFilePath,
          deps: {
            captureHtmlScreenshotImpl: makeFakeScreenshot(),
            generateGeminiTextImpl: makeFakeGenerator(
              ["xml\n<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>"],
              []
            ),
          },
        }),
      /Static sanity check/
    );

    const state = await readSingleRunState(artifactDir);
    assert.equal(state.status, "needs-human");
    assert.match(state.failureReason, /preamble text/i);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
