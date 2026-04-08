import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import test from "node:test";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PNG } from "pngjs";

import { readJson } from "../lib/io.mjs";
import { buildOpenAIHtmlEditPrompt } from "../../llm/private/html-generator-openai.mjs";
import { buildHtmlDeltaJudgePrompt, buildHtmlRegressionPrompt } from "../../llm/private/html-delta-judge.mjs";
import { runHtmlCandidatePrefilter } from "../../llm/private/html-candidate-prefilter.mjs";
import { runDesignerSlideCreate } from "../../designer/slide-create-run-lib.mjs";

const makeTempDir = async () => mkdtemp(join(tmpdir(), "ysn-slide-create-run-"));
const buildTinyPng = () => {
  const png = new PNG({ width: 1, height: 1 });
  png.data[0] = 255;
  png.data[1] = 255;
  png.data[2] = 255;
  png.data[3] = 255;
  return PNG.sync.write(png);
};

const TINY_PNG = buildTinyPng();

const makeCreateProject = async (projectRoot) => {
  const templateDir = resolve(projectRoot, "templates", "designer-deck-template-v1");
  const stampedDir = resolve(projectRoot, "slide-figures", "slide-03");
  const packetPath = resolve(projectRoot, "slide-packets", "slide-03-packet.md");
  const notesDir = resolve(projectRoot, "slide-notes", "slide-03");

  await mkdir(templateDir, { recursive: true });
  await mkdir(stampedDir, { recursive: true });
  await mkdir(resolve(projectRoot, "slide-packets"), { recursive: true });
  await mkdir(notesDir, { recursive: true });

  await writeFile(
    resolve(templateDir, "template.html"),
    "<!doctype html><html><body><div>Header</div><div>Subheader</div><div class=\"figure-stub\">Graphic / Figure</div></body></html>\n",
    "utf8"
  );
  await writeFile(resolve(templateDir, "template.png"), TINY_PNG);
  await writeFile(
    resolve(templateDir, "shell-regions.json"),
    JSON.stringify(
      [
        {
          id: "footer-rule",
          label: "Footer Rule",
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          freezeLevel: "pixel-strict",
        },
      ],
      null,
      2
    ),
    "utf8"
  );
  await writeFile(packetPath, "# Slide packet\nLock the thesis.\n", "utf8");
  await writeFile(resolve(notesDir, "README.md"), "# Slide notes\n", "utf8");
  await writeFile(
    resolve(projectRoot, "deck-spec.json"),
    JSON.stringify(
      {
        template: {
          id: "designer-deck-template-v1",
          paths: {
            contractPath: resolve(projectRoot, "designer-deck-template.md"),
            templateDir,
            previewPath: resolve(templateDir, "template.png"),
            htmlPath: resolve(templateDir, "template.html"),
          },
        },
        slides: [
          {
            id: "slide-03",
            displayNumber: "3",
            title: "Workflow strip",
            header: "Vox prepares the visit before it starts.",
            subheader: "The clinician starts prepared, not from zero.",
            takeaway: "There is a credible pre-visit workflow.",
            purpose: "Make the workflow believable.",
            figureRole: "One calm operational strip.",
            selectedDirection: "Four beat storyboard.",
            buildStatus: "draft",
            paths: {
              packet: packetPath,
              stampedDir,
            },
          },
        ],
      },
      null,
      2
    ),
    "utf8"
  );
};

const makeScreenshotPool = () => ({
  capture: async ({ outputPath }) => {
    await writeFile(outputPath, TINY_PNG);
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
    temperature: 0.7,
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
  summary: "The slide brief is clearly realized.",
  evidence: ["The header and subheader are present and the slide is resolved."],
  nextPrompt: "",
  needsHuman: false,
};

const okRegression = {
  verdict: "ok",
  rationale: "No visible blockers.",
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

test("create-mode prompt and prefilter branches reflect seeded-shell behavior", async () => {
  const prompt = buildOpenAIHtmlEditPrompt({
    runType: "create",
    editableHtml: "<!doctype html><html><body>shell</body></html>",
    parentPreviewPath: "/tmp/parent.png",
    officialPreviewPath: "/tmp/template.png",
    requestedChange: "Create the slide.",
    successChecks: "No placeholders remain.",
    approvedRegions: [],
  });
  assert.match(prompt, /seeded blank shell|seeded shell|fresh self-contained HTML deck slide/i);
  assert.match(prompt, /Do not leave Header, Subheader, or Graphic \/ Figure placeholders behind/);

  const deltaPrompt = buildHtmlDeltaJudgePrompt({
    runType: "create",
    changeRequest: "Create the slide.",
    successChecks: "No placeholders remain.",
    guardrails: "Keep the shell.",
    officialBaselineIncluded: true,
    referenceImageCount: 2,
  });
  assert.match(deltaPrompt, /first-pass HTML slide creation attempt/i);
  assert.match(deltaPrompt, /status=applied/i);

  const regressionPrompt = buildHtmlRegressionPrompt({
    runType: "create",
    changeRequest: "Create the slide.",
    officialBaselineIncluded: true,
    referenceImageCount: 1,
  });
  assert.match(regressionPrompt, /shell violations|blank shell|template placeholders/i);

  const dir = await makeTempDir();
  try {
    const htmlPath = resolve(dir, "generated.html");
    const previewPath = resolve(dir, "preview.png");
    const htmlText =
      "<!doctype html><html><body><div>Header</div><div>Subheader</div><div class=\"figure-stub\">Graphic / Figure</div></body></html>";
    await writeFile(htmlPath, htmlText, "utf8");
    await writeFile(previewPath, "preview", "utf8");

    const prefilter = await runHtmlCandidatePrefilter({
      runType: "create",
      htmlText,
      htmlPath,
      previewPath,
      officialPreviewPath: previewPath,
      officialHtmlText: htmlText,
      requiredTextSnippets: ["Locked header"],
      approvedRegions: [],
    });

    assert.equal(prefilter.ok, false);
    assert.match(prefilter.summary, /placeholder|blank shell/i);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("runDesignerSlideCreate seeds a create draft, writes a run under version-root tune, and materializes the winner without promotion", async () => {
  const dir = await makeTempDir();
  const projectRoot = resolve(dir, "projects", "designer-health");

  try {
    await makeCreateProject(projectRoot);

    const result = await runDesignerSlideCreate({
      slide: "3",
      projectRoot,
      deps: {
        createHtmlScreenshotPoolImpl: async () => makeScreenshotPool(),
        generateOpenAICandidateImpl: makeGenerator("openai", [
          "<!doctype html><html><body><h1>Vox prepares the visit before it starts.</h1><p>The clinician starts prepared, not from zero.</p><div>Resolved create winner</div></body></html>",
          "<!doctype html><html><body>fallback openai</body></html>",
        ]),
        generateGeminiCandidateImpl: makeGenerator("gemini", [
          "<!doctype html><html><body><h1>Vox prepares the visit before it starts.</h1><p>The clinician starts prepared, not from zero.</p><div>Resolved create alternate</div></body></html>",
          "<!doctype html><html><body>fallback gemini</body></html>",
        ]),
        runOpenAIDeltaJudgeImpl: judgeQueue(appliedJudge, appliedJudge, appliedJudge, appliedJudge),
        runClaudeDeltaJudgeImpl: judgeQueue(appliedJudge, appliedJudge, appliedJudge, appliedJudge),
        runOpenAIRegressionImpl: judgeQueue(okRegression, okRegression, okRegression, okRegression),
        runClaudeRegressionImpl: judgeQueue(okRegression, okRegression, okRegression, okRegression),
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.status, "succeeded");
    assert.equal(result.state.runType, "create");
    assert.match(result.runDir, /\/tune\/run-\d{8}-\d{6}-html-edit$/);
    assert.match(result.promoteCommand, /slide:versions -- promote --/);
    assert.ok(existsSync(resolve(result.runDir, "baseline", "official-preview.png")));
    assert.ok(existsSync(resolve(result.runDir, "baseline", "official-html.html")));
    assert.ok(existsSync(resolve(result.runDir, "baseline", "approved-regions.json")));

    const rootHtml = await readFile(resolve(result.versionDir, "generated.html"), "utf8");
    assert.match(rootHtml, /Resolved create (winner|alternate)/);
    const rootPreview = await readFile(resolve(result.versionDir, "preview.png"));
    assert.equal(Buffer.compare(rootPreview, TINY_PNG), 0);

    const versionDoc = await readJson(resolve(result.versionDir, "version.json"));
    assert.equal(versionDoc.status, "draft");
    const manifest = await readJson(resolve(projectRoot, "slide-figures", "slide-03", "manifest.json"));
    assert.equal(manifest.currentVersionId, null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
