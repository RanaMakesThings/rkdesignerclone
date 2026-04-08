import { mkdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

import { createResponse, extractResponseText } from "./openai-client.mjs";
import {
  buildRequestDoc,
  buildResultDoc,
  writeJsonDoc,
  writeOptionalRawResponse,
} from "./artifact-contract.mjs";

export const DEFAULT_OPENAI_HTML_MODEL = "gpt-5.4";
export const DEFAULT_OPENAI_HTML_MAX_OUTPUT_TOKENS = 6000;

const stripCodeFences = (value) =>
  String(value ?? "")
    .trim()
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

const normalizeReasoning = (value) => {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    if (trimmed.startsWith("{")) {
      return JSON.parse(trimmed);
    }
    return { effort: trimmed };
  }

  if (typeof value === "object") {
    return value;
  }

  return undefined;
};

const readImageInput = async (imagePath) => {
  const filePath = resolve(String(imagePath));
  const raw = await import("node:fs/promises").then((fs) => fs.readFile(filePath));
  const mimeType = filePath.toLowerCase().endsWith(".png")
    ? "image/png"
    : filePath.toLowerCase().match(/\.(jpe?g)$/)
      ? "image/jpeg"
      : filePath.toLowerCase().endsWith(".webp")
        ? "image/webp"
        : filePath.toLowerCase().endsWith(".gif")
          ? "image/gif"
          : filePath.toLowerCase().endsWith(".svg")
            ? "image/svg+xml"
            : null;

  if (!mimeType) {
    throw new Error(`Unsupported image type for OpenAI HTML input: ${filePath}`);
  }

  return {
    type: "input_image",
    image_url: `data:${mimeType};base64,${raw.toString("base64")}`,
  };
};

export const buildOpenAIHtmlPrompt = (prompt) =>
  [
    "Return one self-contained HTML document for a 1920x1080 investor-deck slide.",
    "Use inline CSS only. Inline SVG is allowed and preferred for lines, rulers, arrows, and geometric shapes.",
    "Do not return markdown, commentary, code fences, or any text outside the HTML.",
    "The result must fill the full slide canvas and read as a finished presentation figure, not a small card floating in a browser page.",
    String(prompt ?? "").trim(),
  ].join("\n");

export const generateOpenAIHtml = async ({
  prompt,
  imagePaths = [],
  model = DEFAULT_OPENAI_HTML_MODEL,
  temperature = undefined,
  reasoning = undefined,
  maxOutputTokens = DEFAULT_OPENAI_HTML_MAX_OUTPUT_TOKENS,
}) => {
  const content = [];
  for (const imagePath of imagePaths) {
    content.push(await readImageInput(imagePath));
  }
  content.push({
    type: "input_text",
    text: buildOpenAIHtmlPrompt(prompt),
  });

  const payload = {
    model,
    input: [
      {
        role: "user",
        content,
      },
    ],
    max_output_tokens: Number(maxOutputTokens),
  };

  if (temperature !== undefined) {
    payload.temperature = Number(temperature);
  }
  const normalizedReasoning = normalizeReasoning(reasoning);
  if (normalizedReasoning) {
    payload.reasoning = normalizedReasoning;
  }

  const response = await createResponse(payload);
  const outputText = extractResponseText(response);
  if (!outputText) {
    throw new Error("OpenAI returned no HTML text.");
  }

  const html = stripCodeFences(outputText);
  const htmlWithDoctype =
    /^<!doctype html/i.test(html) || /^<html[\s>]/i.test(html)
      ? html
      : `<!doctype html>\n${html}`;

  return {
    response,
    text: outputText,
    html: htmlWithDoctype,
  };
};

export const writeOpenAIHtmlArtifacts = async ({
  dir,
  prompt,
  model,
  imagePaths = [],
  temperature = undefined,
  reasoning = undefined,
  maxOutputTokens = DEFAULT_OPENAI_HTML_MAX_OUTPUT_TOKENS,
  result,
  saveRaw = false,
  elapsedMs = null,
}) => {
  const outputDir = resolve(dir);
  await mkdir(outputDir, { recursive: true });

  await writeFile(resolve(outputDir, "prompt.txt"), `${String(prompt ?? "").trim()}\n`, "utf8");
  await writeJsonDoc(
    resolve(outputDir, "request.json"),
    buildRequestDoc({
      provider: "openai",
      model,
      referenceImages: imagePaths.map((value) => resolve(String(value))),
      maxOutputTokens: Number(maxOutputTokens),
      temperature: temperature !== undefined ? Number(temperature) : undefined,
      reasoning: normalizeReasoning(reasoning),
    })
  );
  await writeJsonDoc(
    resolve(outputDir, "result.json"),
    buildResultDoc({
      provider: "openai",
      model,
      created_at: new Date().toISOString(),
      outputs: ["generated.html", "response.txt"],
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
    payload: result.response,
    saveRaw,
  });
  await writeFile(resolve(outputDir, "response.txt"), `${result.text}\n`, "utf8");
  await writeFile(resolve(outputDir, "generated.html"), `${result.html}\n`, "utf8");

  return {
    dir: outputDir,
    htmlPath: resolve(outputDir, "generated.html"),
    responsePath: resolve(outputDir, "response.txt"),
    basename: basename(outputDir),
  };
};
