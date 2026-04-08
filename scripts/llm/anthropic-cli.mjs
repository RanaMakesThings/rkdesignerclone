#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { createRequire } from "node:module";

import {
  AnthropicRequestError,
  callAnthropic,
  createMessage,
  DEFAULT_ANTHROPIC_MAX_TOKENS,
  DEFAULT_ANTHROPIC_MODEL,
  extractMessageText,
} from "./anthropic-client.mjs";
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

const DEFAULT_ANTHROPIC_HTML_MAX_TOKENS = 5000;

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

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const writePayload = (payload) => {
  const output =
    typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  process.stdout.write(output.endsWith("\n") ? output : `${output}\n`);
};

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

const resolveInputText = async (argv) => {
  const inlineInput = argv.input;
  const fileInput = argv.inputFile;
  if (inlineInput && fileInput) {
    throw new Error("Use only one of --input or --input-file.");
  }

  if (typeof inlineInput === "string" && inlineInput.length > 0) {
    return inlineInput;
  }

  if (typeof fileInput === "string" && fileInput.length > 0) {
    return readFile(resolve(fileInput), "utf8");
  }

  const stdinText = await readStdinText();
  if (stdinText.trim()) {
    return stdinText.trimEnd();
  }

  throw new Error(
    "Missing input. Provide --input, --input-file, or pipe text via stdin."
  );
};

const resolvePromptText = async (argv) => {
  const inlineInput = argv.prompt;
  const fileInput = argv.promptFile;
  if (inlineInput && fileInput) {
    throw new Error("Use only one of --prompt or --prompt-file.");
  }

  if (typeof inlineInput === "string" && inlineInput.length > 0) {
    return inlineInput;
  }

  if (typeof fileInput === "string" && fileInput.length > 0) {
    return readFile(resolve(fileInput), "utf8");
  }

  const stdinText = await readStdinText();
  if (stdinText.trim()) {
    return stdinText.trimEnd();
  }

  throw new Error(
    "Missing prompt. Provide --prompt, --prompt-file, or pipe text via stdin."
  );
};

const imageMediaTypeFromPath = (filePath) => {
  const normalized = String(filePath ?? "").toLowerCase();
  if (normalized.endsWith(".png")) {
    return "image/png";
  }
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (normalized.endsWith(".webp")) {
    return "image/webp";
  }
  if (normalized.endsWith(".gif")) {
    return "image/gif";
  }
  throw new Error(`Unsupported image type for Anthropic review: ${filePath}`);
};

const stripCodeFences = (value) =>
  String(value ?? "")
    .trim()
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

const resolveAnthropicArtifactDir = ({ out, slug }) => {
  if (out) {
    return resolve(String(out));
  }
  const designerDataPaths = getDesignerDataPaths({
    cwd: process.cwd(),
    env: process.env,
  });
  return resolve(
    designerDataPaths.runsRoot,
    "adhoc",
    createArtifactRunSlug({ slug })
  );
};

const parseQueryPairs = (pairs = []) => {
  const query = {};
  for (const pair of pairs) {
    const idx = String(pair).indexOf("=");
    if (idx <= 0) {
      throw new Error(`Invalid --query value: ${pair}. Use key=value.`);
    }

    const key = String(pair).slice(0, idx);
    const value = String(pair).slice(idx + 1);

    if (!hasOwn(query, key)) {
      query[key] = value;
    } else if (Array.isArray(query[key])) {
      query[key].push(value);
    } else {
      query[key] = [query[key], value];
    }
  }
  return query;
};

const loadRequestBody = async (argv) => {
  if (argv.body && argv.bodyFile) {
    throw new Error("Use only one of --body or --body-file.");
  }

  if (!argv.body && !argv.bodyFile) {
    return { json: undefined, raw: undefined };
  }

  const rawText = argv.bodyFile
    ? await readFile(resolve(argv.bodyFile), "utf8")
    : String(argv.body);

  if (argv.rawBody) {
    return { json: undefined, raw: rawText };
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error(
      "Request body must be valid JSON. Use --raw-body to bypass JSON parsing."
    );
  }

  return { json: parsed, raw: undefined };
};

const handleMessagesCommand = async (argv) => {
  const input = await resolveInputText(argv);
  const payload = await createMessage({
    model: String(argv.model || DEFAULT_ANTHROPIC_MODEL),
    system: argv.system ? String(argv.system) : undefined,
    maxTokens:
      argv.maxOutputTokens !== undefined
        ? Number(argv.maxOutputTokens)
        : DEFAULT_ANTHROPIC_HTML_MAX_TOKENS,
    temperature:
      argv.temperature !== undefined ? Number(argv.temperature) : undefined,
    messages: [
      {
        role: "user",
        content: input,
      },
    ],
  });

  if (argv.json) {
    writePayload(payload);
    return;
  }

  const outputText = extractMessageText(payload);
  if (outputText) {
    writePayload(outputText);
    return;
  }

  writePayload(payload);
};

const handleApiCommand = async (argv) => {
  const { json, raw } = await loadRequestBody(argv);
  const headers =
    raw !== undefined
      ? { "Content-Type": argv.contentType || "application/json" }
      : undefined;

  const payload = await callAnthropic({
    method: String(argv.method || "GET").toUpperCase(),
    path: String(argv.path),
    query: parseQueryPairs(argv.query),
    headers,
    json,
    body: raw,
  });

  writePayload(payload);
};

const handleReviewCommand = async (argv) => {
  const prompt = await resolvePromptText(argv);
  const imagePath = resolve(String(argv.image));
  const imageBuffer = await readFile(imagePath);

  const startedAt = Date.now();
  const payload = await createMessage({
    model: String(argv.model || DEFAULT_ANTHROPIC_MODEL),
    system: argv.system ? String(argv.system) : undefined,
    maxTokens:
      argv.maxOutputTokens !== undefined
        ? Number(argv.maxOutputTokens)
        : DEFAULT_ANTHROPIC_MAX_TOKENS,
    temperature:
      argv.temperature !== undefined ? Number(argv.temperature) : undefined,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: imageMediaTypeFromPath(imagePath),
              data: imageBuffer.toString("base64"),
            },
          },
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ],
  });
  const elapsedMs = Date.now() - startedAt;

  const outputText = extractMessageText(payload);
  const outputDir = resolveAnthropicArtifactDir({
    out: argv.out,
    slug: argv.slug || "anthropic-review",
  });
  await mkdir(outputDir, { recursive: true });
  await writeFile(resolve(outputDir, "prompt.txt"), `${prompt.trim()}\n`, "utf8");
  await writeJsonDoc(
    resolve(outputDir, "request.json"),
    buildRequestDoc({
      provider: "anthropic",
      model: String(argv.model || DEFAULT_ANTHROPIC_MODEL),
      referenceImages: [imagePath],
      temperature:
        argv.temperature !== undefined ? Number(argv.temperature) : undefined,
      maxOutputTokens:
        argv.maxOutputTokens !== undefined
          ? Number(argv.maxOutputTokens)
          : DEFAULT_ANTHROPIC_MAX_TOKENS,
    })
  );
  await writeJsonDoc(
    resolve(outputDir, "result.json"),
    buildResultDoc({
      provider: "anthropic",
      model: String(argv.model || DEFAULT_ANTHROPIC_MODEL),
      created_at: new Date().toISOString(),
      outputs: ["response.txt"],
      variant_id: null,
      variant_label: null,
      width: null,
      height: null,
      elapsed_ms: elapsedMs,
      text: outputText,
    })
  );
  await writeOptionalRawResponse({
    outputDir,
    payload,
    saveRaw: Boolean(argv.saveRaw),
  });
  await writeFile(resolve(outputDir, "response.txt"), `${outputText}\n`, "utf8");

  if (argv.json) {
    writePayload({
      ok: true,
      dir: outputDir,
      response: resolve(outputDir, "response.txt"),
    });
    return;
  }

  writePayload(
    `Anthropic review artifacts\n${outputDir}\n${resolve(outputDir, "response.txt")}`
  );
};

const handleHtmlCommand = async (argv) => {
  const prompt = await resolvePromptText(argv);
  const imagePaths = Array.isArray(argv.image)
    ? argv.image.map((value) => resolve(String(value)))
    : [];

  const content = [];
  for (const imagePath of imagePaths) {
    const imageBuffer = await readFile(imagePath);
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: imageMediaTypeFromPath(imagePath),
        data: imageBuffer.toString("base64"),
      },
    });
  }
  content.push({
    type: "text",
    text: prompt,
  });

  const startedAt = Date.now();
  const payload = await createMessage({
    model: String(argv.model || DEFAULT_ANTHROPIC_MODEL),
    system: argv.system ? String(argv.system) : undefined,
    maxTokens:
      argv.maxOutputTokens !== undefined
        ? Number(argv.maxOutputTokens)
        : DEFAULT_ANTHROPIC_MAX_TOKENS,
    temperature:
      argv.temperature !== undefined ? Number(argv.temperature) : undefined,
    messages: [
      {
        role: "user",
        content,
      },
    ],
  });
  const elapsedMs = Date.now() - startedAt;

  const outputText = extractMessageText(payload);
  const html = stripCodeFences(outputText);
  const htmlWithDoctype =
    /^<!doctype html/i.test(html) || /^<html[\s>]/i.test(html)
      ? html
      : `<!doctype html>\n${html}`;

  const outputDir = resolveAnthropicArtifactDir({
    out: argv.out,
    slug: argv.slug || "anthropic-html",
  });
  await mkdir(outputDir, { recursive: true });
  await writeFile(resolve(outputDir, "prompt.txt"), `${prompt.trim()}\n`, "utf8");
  await writeJsonDoc(
    resolve(outputDir, "request.json"),
    buildRequestDoc({
      provider: "anthropic",
      model: String(argv.model || DEFAULT_ANTHROPIC_MODEL),
      referenceImages: imagePaths,
      temperature:
        argv.temperature !== undefined ? Number(argv.temperature) : undefined,
      maxOutputTokens:
        argv.maxOutputTokens !== undefined
          ? Number(argv.maxOutputTokens)
          : DEFAULT_ANTHROPIC_MAX_TOKENS,
    })
  );
  await writeJsonDoc(
    resolve(outputDir, "result.json"),
    buildResultDoc({
      provider: "anthropic",
      model: String(argv.model || DEFAULT_ANTHROPIC_MODEL),
      created_at: new Date().toISOString(),
      outputs: ["generated.html", "response.txt"],
      variant_id: null,
      variant_label: null,
      width: null,
      height: null,
      elapsed_ms: elapsedMs,
      text: outputText,
    })
  );
  await writeOptionalRawResponse({
    outputDir,
    payload,
    saveRaw: Boolean(argv.saveRaw),
  });
  await writeFile(resolve(outputDir, "response.txt"), `${outputText}\n`, "utf8");
  await writeFile(resolve(outputDir, "generated.html"), `${htmlWithDoctype}\n`, "utf8");

  if (argv.json) {
    writePayload({
      ok: true,
      dir: outputDir,
      html: resolve(outputDir, "generated.html"),
    });
    return;
  }

  writePayload(
    `Anthropic HTML artifacts\n${outputDir}\n${resolve(outputDir, "generated.html")}`
  );
};

const main = async () => {
  await yargs(hideBin(process.argv))
    .scriptName("anthropic")
    .usage("Usage: npm run anthropic -- <command> [options]")
    .command(
      "messages",
      "Create an Anthropic message and print the text reply",
      (cmd) =>
        cmd
          .option("model", {
            type: "string",
            default: DEFAULT_ANTHROPIC_MODEL,
            describe: "Anthropic model ID",
          })
          .option("input", {
            type: "string",
            describe: "Inline user message",
          })
          .option("input-file", {
            type: "string",
            describe: "Read the user message from a file",
          })
          .option("system", {
            type: "string",
            describe: "Optional system prompt",
          })
          .option("max-output-tokens", {
            type: "number",
            default: DEFAULT_ANTHROPIC_HTML_MAX_TOKENS,
            describe: "Max output tokens",
          })
          .option("temperature", {
            type: "number",
            describe: "Sampling temperature",
          })
          .option("json", {
            type: "boolean",
            default: false,
            describe: "Print raw API JSON payload",
          }),
      handleMessagesCommand
    )
    .command(
      "api",
      "Make a raw Anthropic API call",
      (cmd) =>
        cmd
          .option("method", {
            type: "string",
            default: "GET",
            describe: "HTTP method",
          })
          .option("path", {
            type: "string",
            demandOption: true,
            describe: "API path like /messages",
          })
          .option("query", {
            type: "array",
            default: [],
            describe: "Repeatable key=value query string entries",
          })
          .option("body", {
            type: "string",
            describe: "Inline request body JSON string",
          })
          .option("body-file", {
            type: "string",
            describe: "Read request body from a file",
          })
          .option("raw-body", {
            type: "boolean",
            default: false,
            describe: "Send request body as raw text without JSON parsing",
          })
          .option("content-type", {
            type: "string",
            describe: "Content type for --raw-body requests",
          }),
      handleApiCommand
    )
    .command(
      "review",
      "Review a local image with Anthropic vision and return text feedback",
      (cmd) =>
        cmd
          .option("model", {
            type: "string",
            default: DEFAULT_ANTHROPIC_MODEL,
            describe: "Anthropic model ID",
          })
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
          .option("system", {
            type: "string",
            describe: "Optional system prompt",
          })
          .option("max-output-tokens", {
            type: "number",
            default: DEFAULT_ANTHROPIC_MAX_TOKENS,
            describe: "Max output tokens",
          })
          .option("temperature", {
            type: "number",
            describe: "Sampling temperature",
          })
          .option("out", {
            type: "string",
            describe: "Optional output directory for prompt and response artifacts",
          })
          .option("slug", {
            type: "string",
            describe: "Optional artifact slug; defaults to anthropic-review",
          })
          .option("save-raw", {
            type: "boolean",
            default: false,
            describe: "Persist a sanitized raw provider response under debug/response.json",
          })
          .option("json", {
            type: "boolean",
            default: false,
            describe: "Print raw API JSON payload or artifact metadata",
          }),
      handleReviewCommand
    )
    .command(
      "html",
      "Generate self-contained HTML with Anthropic, optionally using image references",
      (cmd) =>
        cmd
          .option("model", {
            type: "string",
            default: DEFAULT_ANTHROPIC_MODEL,
            describe: "Anthropic model ID",
          })
          .option("prompt", {
            type: "string",
            describe: "Inline HTML-generation prompt",
          })
          .option("prompt-file", {
            type: "string",
            describe: "Read the HTML-generation prompt from a file",
          })
          .option("image", {
            type: "array",
            string: true,
            default: [],
            describe: "One or more local reference images",
          })
          .option("system", {
            type: "string",
            describe: "Optional system prompt",
          })
          .option("max-output-tokens", {
            type: "number",
            default: DEFAULT_ANTHROPIC_MAX_TOKENS,
            describe: "Max output tokens",
          })
          .option("temperature", {
            type: "number",
            describe: "Sampling temperature",
          })
          .option("out", {
            type: "string",
            describe: "Optional output directory for prompt and HTML artifacts",
          })
          .option("slug", {
            type: "string",
            describe: "Optional artifact slug; defaults to anthropic-html",
          })
          .option("save-raw", {
            type: "boolean",
            default: false,
            describe: "Persist a sanitized raw provider response under debug/response.json",
          })
          .option("json", {
            type: "boolean",
            default: false,
            describe: "Print raw API JSON payload or artifact metadata",
          }),
      handleHtmlCommand
    )
    .demandCommand(1, "Choose a command.")
    .strict()
    .help()
    .fail((message, error) => {
      const failure =
        error instanceof AnthropicRequestError
          ? error.message
          : error?.message || message || "Unknown failure";
      console.error(failure);
      process.exit(1);
    })
    .parseAsync();
};

await main();
