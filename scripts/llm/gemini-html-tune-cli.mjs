#!/usr/bin/env node

import process from "node:process";
import { resolve } from "node:path";
import { createRequire } from "node:module";

import {
  isTuneLoopError,
  runGeminiHtmlTune,
} from "./gemini-html-tune-lib.mjs";

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
    .scriptName("gemini:html:tune")
    .usage("Usage: npm run gemini:html:tune -- --dir <artifact-dir> --change-file <path> [options]")
    .option("dir", {
      type: "string",
      demandOption: true,
      describe: "Existing Gemini HTML artifact dir containing generated.html, prompt.txt, and request.json",
    })
    .option("change-file", {
      type: "string",
      demandOption: true,
      describe: "Markdown file with ## Requested change and ## Success checks headings",
    })
    .option("image", {
      type: "array",
      string: true,
      default: [],
      describe: "Optional override image list for old artifact dirs whose request.json does not record referenceImages",
    })
    .option("max-retries", {
      type: "number",
      default: 3,
      describe: "Maximum number of automated retry attempts",
    })
    .option("codex-review-file", {
      type: "string",
      describe:
        "Path to a checked-in Codex/operator micro-review note used to finalize a pending tune attempt",
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
      const result = await runGeminiHtmlTune({
        dir: resolve(String(argv.dir)),
        changeFilePath: resolve(String(argv.changeFile)),
        imagePaths: Array.isArray(argv.image)
          ? argv.image.map((value) => resolve(String(value)))
          : [],
        codexReviewFilePath: argv.codexReviewFile
          ? resolve(String(argv.codexReviewFile))
          : null,
        maxRetries: Number(argv.maxRetries),
      });

      if (argv.json) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        return;
      }

      process.stdout.write(
        [
          "Gemini HTML tune succeeded.",
          result.dir,
          `${result.runId}/${result.winningAttempt}`,
        ].join("\n")
      );
      process.stdout.write("\n");
    })
    .catch((error) => {
      if (isTuneLoopError(error)) {
        console.error(error.message);
        if (error.statePath) {
          console.error(error.statePath);
        }
        process.exit(1);
        return;
      }

      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
};

await main();
