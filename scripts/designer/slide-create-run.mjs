#!/usr/bin/env node

import process from "node:process";
import { resolve } from "node:path";
import { createRequire } from "node:module";

import { DEFAULT_DESIGNER_PROJECT_ROOT } from "./slide-create-prep-lib.mjs";
import { runDesignerSlideCreate } from "./slide-create-run-lib.mjs";

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
    .scriptName("slide:create:run")
    .usage("Usage: npm run slide:create:run -- --slide <slide-XX|N> [options]")
    .option("slide", {
      type: "string",
      demandOption: true,
      describe:
        "Designer slide id or current public display number, e.g. slide-12, slide-4, or 4",
    })
    .option("project-root", {
      type: "string",
      default: DEFAULT_DESIGNER_PROJECT_ROOT,
      describe: "Designer project root",
    })
    .option("version-id", {
      type: "string",
      describe: "Reuse an existing create draft version",
    })
    .option("lane", {
      type: "string",
      default: "auto",
      describe: "Bootstrap lane (auto|html|native|hybrid)",
    })
    .option("label", {
      type: "string",
      default: "",
      describe: "Optional draft version label override used if prep allocates a new version",
    })
    .option("template-id", {
      type: "string",
      default: "designer-deck-template-v1",
      describe: "Template shell id under projects/designer-health/templates/",
    })
    .option("request-file", {
      type: "string",
      describe: "Optional alternate create request markdown file",
    })
    .option("reference-image", {
      type: "array",
      string: true,
      default: [],
      describe: "Optional reference image(s) to snapshot into the create bundle",
    })
    .option("reference-file", {
      type: "array",
      string: true,
      default: [],
      describe: "Optional reference file(s) to snapshot into the create bundle",
    })
    .option("mode", {
      type: "string",
      default: "create",
      describe: "Create run mode (create|explore)",
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
    .option("codex-review-file", {
      type: "string",
      describe: "Optional checked-in Codex/operator review file if you explicitly want to resume a gated run",
    })
    .option("force", {
      type: "boolean",
      default: false,
      describe: "Reseed the version root and overwrite the checked-in create request",
    })
    .option("json", {
      type: "boolean",
      default: false,
      describe: "Print result metadata as JSON",
    })
    .strict()
    .help()
    .parseAsync()
    .then(async (argv) => {
      const result = await runDesignerSlideCreate({
        slide: argv.slide,
        projectRoot: resolve(String(argv.projectRoot)),
        versionId: argv.versionId ? String(argv.versionId) : null,
        lane: String(argv.lane),
        label: String(argv.label || ""),
        templateId: String(argv.templateId),
        requestFilePath: argv.requestFile ? resolve(String(argv.requestFile)) : null,
        referenceImagePaths: Array.isArray(argv.referenceImage)
          ? argv.referenceImage.map((entry) => resolve(String(entry)))
          : [],
        referenceFilePaths: Array.isArray(argv.referenceFile)
          ? argv.referenceFile.map((entry) => resolve(String(entry)))
          : [],
        mode: String(argv.mode),
        providers: String(argv.providers),
        slotsPerProvider: Number(argv.slotsPerProvider),
        targetPassCount: Number(argv.targetPassCount),
        maxRounds: Number(argv.maxRounds),
        maxSlotAttempts: Number(argv.maxSlotAttempts),
        codexReviewFilePath: argv.codexReviewFile
          ? resolve(String(argv.codexReviewFile))
          : null,
        force: Boolean(argv.force),
      });

      if (argv.json) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        return;
      }

      if (result.status === "native-handoff") {
        process.stdout.write(
          [
            `${result.slideId} native handoff ready.`,
            result.message,
            `Request: ${result.requestFilePath}`,
            `Draft version: ${result.versionId}`,
            `Draft version dir: ${result.versionDir}`,
            result.specPaths?.length > 0
              ? `Specs: ${result.specPaths.join(", ")}`
              : "Specs: (none recorded)",
            `Promote later with: ${result.promoteCommand}`,
          ].join("\n") + "\n"
        );
        return;
      }

      const lines = [
        `${result.slideId} create run ${result.ok ? "finished" : "stopped"}.`,
        `Lane: ${result.lane}`,
        `Draft version: ${result.versionId}`,
        `Draft version dir: ${result.versionDir}`,
        `Run dir: ${result.runDir}`,
        `Status: ${result.status}`,
      ];
      if (result.ok) {
        lines.push(`Promote with: ${result.promoteCommand}`);
      }
      process.stdout.write(`${lines.join("\n")}\n`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
};

await main();
