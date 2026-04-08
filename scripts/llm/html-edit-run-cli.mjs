#!/usr/bin/env node

import process from "node:process";
import { resolve } from "node:path";
import { createRequire } from "node:module";

import { runHtmlEditRun } from "./html-edit-run-lib.mjs";

const require = createRequire(import.meta.url);

const requireDep = (name, hint) => {
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    return require(name);
  } catch (_error) {
    console.error(`\nMissing dependency: ${name}`);
    if (hint) {
      console.error(hint);
    }
    console.error("Run: npm install\n");
    process.exit(1);
  }
};

const yargs = requireDep("yargs/yargs", "Needed for CLI argument parsing.");
const { hideBin } = requireDep("yargs/helpers", "Needed for CLI argument parsing.");

const main = async () => {
  await yargs(hideBin(process.argv))
    .scriptName("html:edit:run")
    .usage("Usage: npm run html:edit:run -- [options]")
    .option("artifact-dir", {
      type: "string",
      describe: "Existing HTML artifact directory to edit in place",
    })
    .option("project-root", {
      type: "string",
      describe: "Project root for manifest-backed slide targeting",
    })
    .option("slide", {
      type: "string",
      describe:
        "Slide id or current public display number for manifest-backed targeting",
    })
    .option("version-id", {
      type: "string",
      describe: "Optional version id; defaults to the current version",
    })
    .option("surface", {
      type: "string",
      default: "gemini-html",
      describe: "HTML surface to edit (gemini-html|openai-html|current-html)",
    })
    .option("change-file", {
      type: "string",
      describe: "Markdown change request with requested change and success checks",
    })
    .option("approved-regions-file", {
      type: "string",
      describe: "Optional structured approved-regions JSON file",
    })
    .option("image", {
      type: "array",
      string: true,
      default: [],
      describe: "Optional reference image(s)",
    })
    .option("mode", {
      type: "string",
      default: "repair",
      describe: "Run mode (repair|explore)",
    })
    .option("providers", {
      type: "string",
      default: "openai,gemini",
      describe: "Comma-separated generation providers",
    })
    .option("slots-per-provider", {
      type: "number",
      default: 2,
      describe: "Number of slots per provider",
    })
    .option("target-pass-count", {
      type: "number",
      default: 1,
      describe: "How many clean passes are required before stopping",
    })
    .option("max-rounds", {
      type: "number",
      default: 4,
      describe: "Maximum rounds",
    })
    .option("max-slot-attempts", {
      type: "number",
      default: 3,
      describe: "Maximum attempts per slot",
    })
    .option("render-concurrency", {
      type: "number",
      default: 2,
      describe: "Bounded render concurrency",
    })
    .option("judge-concurrency", {
      type: "number",
      default: 6,
      describe: "Bounded judge concurrency",
    })
    .option("generation-concurrency", {
      type: "number",
      default: 4,
      describe: "Bounded generation concurrency",
    })
    .option("save-raw", {
      type: "boolean",
      default: false,
      describe: "Persist sanitized raw provider responses under debug/response.json",
    })
    .option("json", {
      type: "boolean",
      default: false,
      describe: "Print result metadata as JSON",
    })
    .option("resume", {
      type: "string",
      describe: "Resume an existing run directory",
    })
    .option("report", {
      type: "boolean",
      default: true,
      describe: "Write report.html beside state.json",
    })
    .option("promote-on-pass", {
      type: "boolean",
      default: false,
      describe: "Promote a winner after a passing run and Codex review gate",
    })
    .option("codex-review-file", {
      type: "string",
      describe: "Checked-in Codex/operator micro-review note used to clear promotion",
    })
    .option("openai-model", {
      type: "string",
      default: "gpt-5.4",
      describe: "OpenAI generation model",
    })
    .option("openai-temperature", {
      type: "number",
      describe: "OpenAI generation temperature",
    })
    .option("openai-reasoning", {
      type: "string",
      default: "high",
      describe: "OpenAI reasoning effort or JSON object",
    })
    .option("gemini-model", {
      type: "string",
      default: "gemini-3.1-pro-preview",
      describe: "Gemini generation model",
    })
    .option("gemini-temperature", {
      type: "number",
      default: 0.7,
      describe: "Gemini generation temperature",
    })
    .option("gemini-thinking-level", {
      type: "string",
      default: "high",
      describe: "Gemini thinking level",
    })
    .option("gpt-judge-model", {
      type: "string",
      default: "gpt-5.4",
      describe: "OpenAI model used for delta/regression judging",
    })
    .option("claude-judge-model", {
      type: "string",
      describe: "Anthropic model used for delta/regression judging",
    })
    .check((argv) => {
      if (!argv.resume && !argv.changeFile) {
        throw new Error("--change-file is required unless --resume is used.");
      }
      if (!argv.resume && !argv.artifactDir && !(argv.projectRoot && argv.slide)) {
        throw new Error("Provide either --artifact-dir or --project-root with --slide.");
      }
      return true;
    })
    .strict()
    .help()
    .parseAsync()
    .then(async (argv) => {
      const result = await runHtmlEditRun({
        artifactDir: argv.artifactDir ? resolve(String(argv.artifactDir)) : null,
        projectRoot: argv.projectRoot ? resolve(String(argv.projectRoot)) : null,
        slide: argv.slide ? String(argv.slide) : null,
        versionId: argv.versionId ? String(argv.versionId) : null,
        surface: String(argv.surface),
        changeFilePath: argv.changeFile ? resolve(String(argv.changeFile)) : null,
        approvedRegionsFilePath: argv.approvedRegionsFile
          ? resolve(String(argv.approvedRegionsFile))
          : null,
        imagePaths: Array.isArray(argv.image)
          ? argv.image.map((value) => resolve(String(value)))
          : [],
        mode: String(argv.mode),
        providers: String(argv.providers),
        slotsPerProvider: Number(argv.slotsPerProvider),
        targetPassCount: Number(argv.targetPassCount),
        maxRounds: Number(argv.maxRounds),
        maxSlotAttempts: Number(argv.maxSlotAttempts),
        renderConcurrency: Number(argv.renderConcurrency),
        judgeConcurrency: Number(argv.judgeConcurrency),
        generationConcurrency: Number(argv.generationConcurrency),
        saveRaw: Boolean(argv.saveRaw),
        report: Boolean(argv.report),
        promoteOnPass: Boolean(argv.promoteOnPass),
        codexReviewFilePath: argv.codexReviewFile
          ? resolve(String(argv.codexReviewFile))
          : null,
        resume: argv.resume ? resolve(String(argv.resume)) : null,
        openaiModel: String(argv.openaiModel),
        openaiTemperature:
          argv.openaiTemperature !== undefined
            ? Number(argv.openaiTemperature)
            : undefined,
        openaiReasoning: argv.openaiReasoning
          ? String(argv.openaiReasoning)
          : undefined,
        geminiModel: String(argv.geminiModel),
        geminiTemperature: Number(argv.geminiTemperature),
        geminiThinkingLevel: String(argv.geminiThinkingLevel),
        gptJudgeModel: String(argv.gptJudgeModel),
        claudeJudgeModel: argv.claudeJudgeModel
          ? String(argv.claudeJudgeModel)
          : undefined,
      });

      const payload = {
        ok: result.ok,
        status: result.status,
        runDir: result.runDir,
        runId: result.state?.runId ?? null,
        winner: result.state?.winner ?? null,
      };

      if (argv.json) {
        process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
        return;
      }

      process.stdout.write(
        [
          result.ok ? "HTML edit run succeeded." : "HTML edit run finished without a clean winner.",
          payload.runDir,
          payload.status,
          payload.winner?.slotId ? `winner=${payload.winner.slotId}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      );
      process.stdout.write("\n");
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
};

await main();
