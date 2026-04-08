#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { createRequire } from "node:module";

import {
  DEFAULT_GEMINI_TEXT_MODEL,
  generateGeminiText,
} from "./gemini-text-client.mjs";
import {
  buildRequestDoc,
  buildResultDoc,
  writeJsonDoc,
  writeOptionalRawResponse,
} from "./artifact-contract.mjs";
import {
  createArtifactRunSlug,
  getDesignerDataPaths,
} from "../../lib/repo/index.mjs";

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

const slugify = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "gemini-review";

const readStdinText = async () => {
  if (process.stdin.isTTY) {
    return "";
  }

  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  return Buffer.concat(chunks).toString("utf8");
};

const resolvePrompt = async (argv) => {
  if (argv.prompt && argv.promptFile) {
    throw new Error("Use only one of --prompt or --prompt-file.");
  }

  if (argv.prompt) {
    return String(argv.prompt).trim();
  }

  if (argv.promptFile) {
    return (await readFile(resolve(argv.promptFile), "utf8")).trim();
  }

  const stdinText = await readStdinText();
  if (stdinText.trim()) {
    return stdinText.trim();
  }

  throw new Error("Provide a prompt via --prompt, --prompt-file, or stdin.");
};

const main = async () => {
  await yargs(hideBin(process.argv))
    .scriptName("gemini:review")
    .usage("Usage: npm run gemini:review -- [options]")
    .option("prompt", {
      type: "string",
      describe: "Inline review prompt",
    })
    .option("prompt-file", {
      type: "string",
      describe: "Read the review prompt from a file",
    })
    .option("image", {
      type: "string",
      demandOption: true,
      describe: "Path to the image being reviewed",
    })
    .option("model", {
      type: "string",
      default: DEFAULT_GEMINI_TEXT_MODEL,
      describe: "Gemini text model ID",
    })
    .option("temperature", {
      type: "number",
      default: 0.2,
      describe: "Sampling temperature",
    })
    .option("slug", {
      type: "string",
      describe: "Output slug; defaults to a prompt-derived slug",
    })
    .option("out", {
      type: "string",
      describe: "Explicit output directory",
    })
    .option("json", {
      type: "boolean",
      default: false,
      describe: "Print artifact metadata as JSON",
    })
    .option("save-raw", {
      type: "boolean",
      default: false,
      describe: "Persist a sanitized raw provider response under debug/response.json",
    })
    .strict()
    .help()
    .parseAsync()
    .then(async (argv) => {
      const prompt = await resolvePrompt(argv);
      const imagePath = resolve(String(argv.image));
      const slug = argv.slug ? slugify(argv.slug) : slugify(prompt);
      const designerDataPaths = getDesignerDataPaths({
        cwd: process.cwd(),
        env: process.env,
      });
      const outputDir = argv.out
        ? resolve(String(argv.out))
        : resolve(
            designerDataPaths.runsRoot,
            "adhoc",
            createArtifactRunSlug({ slug: `${slug}-review` })
          );

      const startedAt = Date.now();
      const result = await generateGeminiText({
        prompt,
        imagePaths: [imagePath],
        model: String(argv.model),
        temperature: Number(argv.temperature),
      });
      const elapsedMs = Date.now() - startedAt;

      await mkdir(outputDir, { recursive: true });
      await writeFile(resolve(outputDir, "prompt.txt"), `${prompt}\n`, "utf8");
      await writeJsonDoc(
        resolve(outputDir, "request.json"),
        buildRequestDoc({
          provider: "gemini",
          model: String(argv.model),
          temperature: Number(argv.temperature),
          referenceImages: [imagePath],
        })
      );
      await writeJsonDoc(
        resolve(outputDir, "result.json"),
        buildResultDoc({
          provider: "gemini",
          model: String(argv.model),
          created_at: new Date().toISOString(),
          outputs: ["response.txt"],
          variant_id: null,
          variant_label: null,
          width: null,
          height: null,
          elapsed_ms: elapsedMs,
          text: result.text,
        })
      );
      await writeOptionalRawResponse({
        outputDir,
        payload: result.raw,
        saveRaw: Boolean(argv.saveRaw),
      });
      await writeFile(resolve(outputDir, "response.txt"), `${result.text}\n`, "utf8");

      const payload = {
        ok: true,
        dir: outputDir,
        response: resolve(outputDir, "response.txt"),
        model: String(argv.model),
        image: imagePath,
      };

      if (argv.json) {
        process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
        return;
      }

      process.stdout.write(`Generated Gemini review artifacts\n${outputDir}\n`);
      process.stdout.write(`${resolve(outputDir, "response.txt")}\n`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
};

await main();
