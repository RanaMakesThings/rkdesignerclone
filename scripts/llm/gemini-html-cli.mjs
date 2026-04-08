#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { createRequire } from "node:module";

import {
  DEFAULT_GEMINI_HTML_MODEL,
  DEFAULT_GEMINI_HTML_TEMPERATURE,
  DEFAULT_GEMINI_THINKING_LEVEL,
  generateGeminiHtml,
  writeGeminiHtmlOutputArtifacts,
} from "./gemini-html-lib.mjs";
import {
  createArtifactRunSlug,
  getDesignerDataPaths,
} from "../../lib/repo/index.mjs";
import { resolveVersionedOutputDir } from "../figures/lib/slide-versioning.mjs";

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
    .slice(0, 72) || "gemini-html";

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
    .scriptName("gemini:html")
    .usage("Usage: npm run gemini:html -- [options]")
    .option("prompt", {
      type: "string",
      describe: "Inline HTML-generation prompt",
    })
    .option("prompt-file", {
      type: "string",
      describe: "Read the prompt from a file",
    })
    .option("model", {
      type: "string",
      default: DEFAULT_GEMINI_HTML_MODEL,
      describe: "Gemini text model ID",
    })
    .option("temperature", {
      type: "number",
      default: DEFAULT_GEMINI_HTML_TEMPERATURE,
      describe: "Sampling temperature",
    })
    .option("thinking-level", {
      type: "string",
      default: DEFAULT_GEMINI_THINKING_LEVEL,
      describe: "Gemini thinking level (minimal|low|medium|high)",
    })
    .option("image", {
      type: "array",
      string: true,
      default: [],
      describe: "One or more local reference images to send with the prompt",
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
      const designerDataPaths = getDesignerDataPaths({
        cwd: process.cwd(),
        env: process.env,
      });
      const outputDir = await resolveOutputDir({
        argv,
        fallbackDir: argv.out
          ? resolve(String(argv.out))
          : resolve(
              designerDataPaths.runsRoot,
              "adhoc",
              createArtifactRunSlug({ slug })
            ),
        branch: "gemini-html",
      });

      const startedAt = Date.now();
      const resolvedImagePaths = Array.isArray(argv.image)
        ? argv.image.map((value) => resolve(String(value)))
        : [];
      const result = await generateGeminiHtml({
        prompt,
        imagePaths: resolvedImagePaths,
        model: String(argv.model),
        temperature: Number(argv.temperature),
        thinkingLevel: String(argv.thinkingLevel),
      });
      const elapsedMs = Date.now() - startedAt;

      const artifacts = await writeGeminiHtmlOutputArtifacts({
        dir: outputDir,
        prompt,
        model: String(argv.model),
        temperature: Number(argv.temperature),
        thinkingLevel: String(argv.thinkingLevel),
        imagePaths: resolvedImagePaths,
        result,
        saveRaw: Boolean(argv.saveRaw),
        elapsedMs,
      });

      const payload = {
        ok: true,
        dir: artifacts.dir,
        html: artifacts.htmlPath,
        response: artifacts.responsePath,
        model: String(argv.model),
        temperature: Number(argv.temperature),
        thinkingLevel: String(argv.thinkingLevel),
      };

      if (argv.json) {
        process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
        return;
      }

      process.stdout.write(`Generated Gemini HTML artifacts\n${artifacts.dir}\n`);
      process.stdout.write(`${artifacts.htmlPath}\n`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
};

await main();
