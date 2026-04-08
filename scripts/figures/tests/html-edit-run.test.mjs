import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import test from "node:test";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { runHtmlEditRun } from "../../llm/html-edit-run-lib.mjs";

const makeTempDir = async () => mkdtemp(join(tmpdir(), "ysn-html-edit-run-"));

const seedArtifactDir = async (dir) => {
  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, "generated.html"), "<!doctype html><html><body>baseline</body></html>\n", "utf8");
  await writeFile(resolve(dir, "preview.png"), "baseline-preview", "utf8");
};

const createChangeFile = async (dir) => {
  const filePath = resolve(dir, "change.md");
  await writeFile(
    filePath,
    [
      "## Requested change",
      "Move the CTA button lower.",
      "",
      "## Success checks",
      "The CTA is visibly farther below the divider.",
      "",
      "## Guardrails",
      "Keep the headline stable.",
      "",
    ].join("\n"),
    "utf8"
  );
  return filePath;
};

const makeScreenshotPool = () => ({
  capture: async ({ outputPath }) => {
    await writeFile(outputPath, "preview", "utf8");
    return outputPath;
  },
  close: async () => {},
});

const makeGenerator = (provider, plannedOutcomes) => async ({ outputDir }) => {
  const next = plannedOutcomes.shift() ?? "<!doctype html><html><body>fallback</body></html>";
  await mkdir(outputDir, { recursive: true });
  await writeFile(resolve(outputDir, "prompt.txt"), `${provider} prompt\n`, "utf8");
  await writeFile(resolve(outputDir, "generated.html"), `${next}\n`, "utf8");
  await writeFile(resolve(outputDir, "response.txt"), `${provider} response\n`, "utf8");
  await writeFile(
    resolve(outputDir, "request.json"),
    JSON.stringify({ provider, model: `${provider}-model` }, null, 2),
    "utf8"
  );
  await writeFile(
    resolve(outputDir, "result.json"),
    JSON.stringify({ provider, outputs: ["generated.html", "response.txt"] }, null, 2),
    "utf8"
  );
  return {
    provider,
    model: `${provider}-model`,
    temperature: 0.8,
    reasoning: provider === "openai" ? { effort: "high" } : undefined,
    thinkingLevel: provider === "gemini" ? "high" : undefined,
    prompt: `${provider} prompt`,
    elapsedMs: 12,
    imagePaths: [],
    result: {
      text: next,
      html: next,
      response: { provider },
      raw: { provider },
    },
    artifacts: {
      dir: outputDir,
      htmlPath: resolve(outputDir, "generated.html"),
      responsePath: resolve(outputDir, "response.txt"),
    },
  };
};

const appliedJudge = {
  status: "applied",
  summary: "The requested change happened.",
  evidence: ["The CTA moved lower."],
  nextPrompt: "",
  needsHuman: false,
};

const partialJudge = {
  status: "partial",
  summary: "The requested change is only partial.",
  evidence: ["The CTA is still too high."],
  nextPrompt: "Push the CTA lower and preserve the title.",
  needsHuman: false,
};

const okRegression = {
  verdict: "ok",
  rationale: "No visible regressions.",
  blockers: [],
  nextMove: "",
};

const judgeQueue = (...entries) => {
  const queue = [...entries];
  return async () => ({
    normalized: queue.shift() ?? appliedJudge,
    raw: {},
    response: {},
  });
};

test("runHtmlEditRun can succeed on the first round with one clean winner", async () => {
  const dir = await makeTempDir();
  try {
    const artifactDir = resolve(dir, "artifact");
    const changeFilePath = await createChangeFile(dir);
    await seedArtifactDir(artifactDir);

    const result = await runHtmlEditRun({
      artifactDir,
      changeFilePath,
      deps: {
        createHtmlScreenshotPoolImpl: async () => makeScreenshotPool(),
        generateOpenAICandidateImpl: makeGenerator("openai", [
          "<!doctype html><html><body>openai-a</body></html>",
          "<!doctype html><html><body>openai-b</body></html>",
        ]),
        generateGeminiCandidateImpl: makeGenerator("gemini", [
          "<!doctype html><html><body>gemini-a</body></html>",
          "<!doctype html><html><body>gemini-b</body></html>",
        ]),
        runOpenAIDeltaJudgeImpl: judgeQueue(appliedJudge, partialJudge, partialJudge, partialJudge),
        runClaudeDeltaJudgeImpl: judgeQueue(appliedJudge, partialJudge, partialJudge, partialJudge),
        runOpenAIRegressionImpl: judgeQueue(okRegression, okRegression, okRegression, okRegression),
        runClaudeRegressionImpl: judgeQueue(okRegression, okRegression, okRegression, okRegression),
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.state.status, "succeeded");
    assert.equal(result.state.rounds.length, 1);
    assert.ok(result.state.winner);
    assert.ok(result.state.winner.slotId);
    const reportHtml = await readFile(resolve(result.runDir, "report.html"), "utf8");
    assert.match(reportHtml, /HTML edit run report/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("runHtmlEditRun can stop for codex review then resume to promote", async () => {
  const dir = await makeTempDir();
  try {
    const artifactDir = resolve(dir, "artifact");
    const changeFilePath = await createChangeFile(dir);
    const reviewFile = resolve(dir, "codex-review.md");
    await seedArtifactDir(artifactDir);

    const first = await runHtmlEditRun({
      artifactDir,
      changeFilePath,
      promoteOnPass: true,
      deps: {
        createHtmlScreenshotPoolImpl: async () => makeScreenshotPool(),
        generateOpenAICandidateImpl: makeGenerator("openai", [
          "<!doctype html><html><body>openai-a</body></html>",
          "<!doctype html><html><body>openai-b</body></html>",
        ]),
        generateGeminiCandidateImpl: makeGenerator("gemini", [
          "<!doctype html><html><body>gemini-a</body></html>",
          "<!doctype html><html><body>gemini-b</body></html>",
        ]),
        runOpenAIDeltaJudgeImpl: judgeQueue(appliedJudge, partialJudge, partialJudge, partialJudge),
        runClaudeDeltaJudgeImpl: judgeQueue(appliedJudge, partialJudge, partialJudge, partialJudge),
        runOpenAIRegressionImpl: judgeQueue(okRegression, okRegression, okRegression, okRegression),
        runClaudeRegressionImpl: judgeQueue(okRegression, okRegression, okRegression, okRegression),
      },
    });

    assert.equal(first.ok, false);
    assert.equal(first.state.status, "needs-codex-review");
    assert.ok(first.state.pendingCodexReview);

    await writeFile(
      reviewFile,
      [
        "## Verdict",
        "promote",
        "",
        "## What changed",
        "The CTA moved lower.",
        "",
        "## Regressions",
        "- None observed.",
        "",
        "## Notes",
        "Looks safe to promote.",
        "",
      ].join("\n"),
      "utf8"
    );

    const resumed = await runHtmlEditRun({
      resume: first.runDir,
      codexReviewFilePath: reviewFile,
    });

    assert.equal(resumed.ok, true);
    assert.equal(resumed.state.status, "succeeded");
    assert.match(resumed.state.winner?.slotId ?? "", /^openai-/);
    assert.match(
      await readFile(resolve(artifactDir, "generated.html"), "utf8"),
      /^<!doctype html><html><body>openai-[ab]<\/body><\/html>\n$/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("runHtmlEditRun create mode can materialize the winner back to the artifact root", async () => {
  const dir = await makeTempDir();
  try {
    const artifactDir = resolve(dir, "artifact");
    const templateHtmlPath = resolve(dir, "template.html");
    const templatePreviewPath = resolve(dir, "template.png");
    const changeFilePath = await createChangeFile(dir);
    await seedArtifactDir(artifactDir);
    await writeFile(
      templateHtmlPath,
      "<!doctype html><html><body><div class=\"figure-stub\">Graphic / Figure</div><h1>Header</h1><p>Subheader</p></body></html>\n",
      "utf8"
    );
    await writeFile(templatePreviewPath, "template-preview", "utf8");

    const createAwareJudge = async (args) => {
      assert.equal(args.runType, "create");
      assert.equal(Array.isArray(args.referenceImagePaths), true);
      assert.equal(args.referenceImagePaths.length, 2);
      return {
        normalized: String(args.afterImagePath).includes("slot-openai-a")
          ? appliedJudge
          : partialJudge,
        raw: {},
        response: {},
      };
    };

    const createAwareRegression = async (args) => {
      assert.equal(args.runType, "create");
      return {
        normalized: okRegression,
        raw: {},
        response: {},
      };
    };

    const result = await runHtmlEditRun({
      artifactDir,
      runType: "create",
      mode: "create",
      changeFilePath,
      imagePaths: [resolve(dir, "adjacent-a.png"), resolve(dir, "adjacent-b.png")],
      baselineOverride: {
        officialPreviewPath: templatePreviewPath,
        officialHtmlPath: templateHtmlPath,
        parentPreviewPath: resolve(artifactDir, "preview.png"),
        parentHtmlPath: resolve(artifactDir, "generated.html"),
      },
      materializeWinnerToArtifactRoot: true,
      deps: {
        createHtmlScreenshotPoolImpl: async () => makeScreenshotPool(),
        generateOpenAICandidateImpl: makeGenerator("openai", [
          "<!doctype html><html><body><h1>Resolved slide</h1><p>Ship it.</p></body></html>",
          "<!doctype html><html><body>openai-b</body></html>",
        ]),
        generateGeminiCandidateImpl: makeGenerator("gemini", [
          "<!doctype html><html><body>gemini-a</body></html>",
          "<!doctype html><html><body>gemini-b</body></html>",
        ]),
        runOpenAIDeltaJudgeImpl: createAwareJudge,
        runClaudeDeltaJudgeImpl: createAwareJudge,
        runOpenAIRegressionImpl: createAwareRegression,
        runClaudeRegressionImpl: createAwareRegression,
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.state.runType, "create");
    assert.equal(result.state.status, "succeeded");
    assert.ok(result.state.baseline.officialHtmlPath);
    assert.match(
      await readFile(resolve(artifactDir, "generated.html"), "utf8"),
      /Resolved slide/
    );
    assert.equal(existsSync(resolve(artifactDir, "prompt.txt")), false);
    assert.equal(existsSync(resolve(result.runDir, "winner.json")), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
