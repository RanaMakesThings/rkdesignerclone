#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import process from "node:process";
import { createRequire } from "node:module";

import {
  DEFAULT_OPENAI_IMAGE_BACKGROUND,
  DEFAULT_OPENAI_IMAGE_MAX_OUTPUT_TOKENS,
  DEFAULT_OPENAI_IMAGE_MODEL,
  DEFAULT_OPENAI_IMAGE_QUALITY,
  DEFAULT_OPENAI_IMAGE_SIZE,
  generateOpenAIImage,
  writeOpenAIImageArtifacts,
} from "./openai-image-lib.mjs";
import { resolveVersionedOutputDir } from "../figures/lib/slide-versioning.mjs";
import { createArtifactRunSlug, getDesignerDataPaths } from "../../lib/repo/designer-data.mjs";

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
    .slice(0, 72) || "openai-image";

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

const resolveOutputDir = async ({ argv, fallbackDir, branch }) => {
  if (argv.out && argv.slide) {
    throw new Error("Use either --out or --slide/--project-root/--version-id, not both.");
  }
  if (argv.slide) {
    if (!argv.projectRoot) {
      throw new Error("--project-root is required when using --slide.");
    }
    return resolveVersionedOutputDir({
      projectRoot: resolve(String(argv.projectRoot)),
      slideId: String(argv.slide),
      versionId: argv.versionId ? String(argv.versionId) : null,
      branch,
    });
  }
  return fallbackDir;
};

const main = async () => {
  await yargs(hideBin(process.argv))
    .scriptName("openai:image")
    .usage("Usage: npm run openai:image -- [options]")
    .option("prompt", {
      type: "string",
      describe: "Inline image-generation prompt",
    })
    .option("prompt-file", {
      type: "string",
      describe: "Read the prompt from a file",
    })
    .option("model", {
      type: "string",
      default: DEFAULT_OPENAI_IMAGE_MODEL,
      describe: "OpenAI text-capable model for Responses image generation",
    })
    .option("image", {
      type: "array",
      string: true,
      default: [],
      describe: "One or more local reference images to send with the prompt",
    })
    .option("size", {
      type: "string",
      default: DEFAULT_OPENAI_IMAGE_SIZE,
      describe: "Requested image size for the hosted image generation tool",
    })
    .option("quality", {
      type: "string",
      default: DEFAULT_OPENAI_IMAGE_QUALITY,
      describe: "Requested render quality",
    })
    .option("background", {
      type: "string",
      default: DEFAULT_OPENAI_IMAGE_BACKGROUND,
      describe: "Background mode",
    })
    .option("slug", {
      type: "string",
      describe: "Output slug; defaults to a prompt-derived slug",
    })
    .option("out", {
      type: "string",
      describe: "Explicit output directory",
    })
    .option("project-root", {
      type: "string",
      describe: "Project root when targeting a manifest-backed slide version",
    })
    .option("slide", {
      type: "string",
      describe: "Logical slide id when targeting a manifest-backed slide version",
    })
    .option("version-id", {
      type: "string",
      describe: "Optional version id; defaults to the slide current version",
    })
    .option("max-output-tokens", {
      type: "number",
      default: DEFAULT_OPENAI_IMAGE_MAX_OUTPUT_TOKENS,
      describe: "Max output tokens for the text-capable model",
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
      const slug = argv.slug ? slugify(argv.slug) : slugify(prompt);
      const designerDataPaths = getDesignerDataPaths({ cwd: process.cwd() });
      const outputDir = await resolveOutputDir({
        argv,
        fallbackDir: argv.out
          ? resolve(String(argv.out))
          : resolve(
              designerDataPaths.runsRoot,
              "adhoc",
              createArtifactRunSlug({ slug })
            ),
        branch: "openai-image",
      });

      const imagePaths = Array.isArray(argv.image) ? argv.image : [];
      const startedAt = Date.now();
      const result = await generateOpenAIImage({
        prompt,
        model: String(argv.model),
        imagePaths,
        size: String(argv.size),
        quality: String(argv.quality),
        background: String(argv.background),
        maxOutputTokens: Number(argv.maxOutputTokens),
      });
      const elapsedMs = Date.now() - startedAt;
      const artifacts = await writeOpenAIImageArtifacts({
        dir: outputDir,
        prompt,
        model: String(argv.model),
        result,
        referenceImages: imagePaths,
        size: String(argv.size),
        quality: String(argv.quality),
        background: String(argv.background),
        saveRaw: Boolean(argv.saveRaw),
        elapsedMs,
      });

      const payload = {
        ok: true,
        dir: artifacts.dir,
        image: artifacts.imagePath,
        model: String(argv.model),
      };

      if (argv.json) {
        process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
        return;
      }

      process.stdout.write(`Generated OpenAI image artifacts\n${outputDir}\n`);
      process.stdout.write(`${artifacts.imagePath}\n`);
      process.stdout.write(`${basename(artifacts.dir)}\n`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
};

await main();
