import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

import { resolveGeminiApiKey } from "./gemini-image-client.mjs";
import {
  buildRequestDoc,
  buildResultDoc,
  writeJsonDoc,
  writeOptionalRawResponse,
} from "./artifact-contract.mjs";

export const DEFAULT_GEMINI_TEXT_MODEL = "gemini-3.1-pro-preview";
export const DEFAULT_GEMINI_TEXT_TEMPERATURE = 0.4;

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const extensionToMimeType = (filePath) => {
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
  if (normalized.endsWith(".svg")) {
    return "image/svg+xml";
  }
  throw new Error(`Unsupported image type for Gemini text input: ${filePath}`);
};

const normalizeModel = (value) =>
  String(value ?? "").trim().replace(/^models\//, "");

const parseJson = async (response) => {
  const rawText = await response.text();
  let rawJson;
  try {
    rawJson = rawText ? JSON.parse(rawText) : null;
  } catch {
    rawJson = rawText;
  }

  if (!response.ok) {
    const errorMessage =
      typeof rawJson === "object" && rawJson && hasOwn(rawJson, "error")
        ? rawJson.error?.message
        : null;
    throw new Error(
      errorMessage ?? `Gemini text request failed with status ${response.status}.`
    );
  }

  return rawJson;
};

const extractTextParts = (payload) => {
  const parts = payload?.candidates?.flatMap((candidate) => candidate?.content?.parts ?? []) ?? [];
  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .filter(Boolean);
};

export const generateGeminiText = async ({
  prompt,
  imagePaths = [],
  model = DEFAULT_GEMINI_TEXT_MODEL,
  temperature = DEFAULT_GEMINI_TEXT_TEMPERATURE,
  thinkingConfig = undefined,
  apiKey = resolveGeminiApiKey(),
}) => {
  const promptText = String(prompt ?? "").trim();
  if (!promptText) {
    throw new Error("Prompt is required.");
  }

  const imageParts = [];
  for (const imagePath of imagePaths) {
    const fileBuffer = await readFile(resolve(String(imagePath)));
    imageParts.push({
      inlineData: {
        mimeType: extensionToMimeType(imagePath),
        data: fileBuffer.toString("base64"),
      },
    });
  }

  const payload = {
    contents: [
      {
        role: "user",
        parts: [...imageParts, { text: promptText }],
      },
    ],
    generationConfig: {
      temperature,
      responseMimeType: "text/plain",
      ...(thinkingConfig && typeof thinkingConfig === "object"
        ? { thinkingConfig }
        : {}),
    },
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    normalizeModel(model)
  )}:generateContent`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  const raw = await parseJson(response);
  const text = extractTextParts(raw).join("\n\n").trim();
  if (!text) {
    throw new Error("Gemini returned no text content.");
  }

  return {
    raw,
    text,
  };
};

const stripCodeFences = (value) =>
  String(value ?? "")
    .trim()
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

export const writeGeminiHtmlArtifacts = async ({
  dir,
  prompt,
  model,
  temperature,
  imagePaths = [],
  result,
  saveRaw = false,
  elapsedMs = null,
  requestExtras = undefined,
}) => {
  const outputDir = resolve(dir);
  await mkdir(outputDir, { recursive: true });

  const html = stripCodeFences(result.text);
  const htmlWithDoctype =
    /^<!doctype html/i.test(html) || /^<html[\s>]/i.test(html)
      ? html
      : `<!doctype html>\n${html}`;

  await writeFile(resolve(outputDir, "prompt.txt"), `${prompt.trim()}\n`, "utf8");
  await writeJsonDoc(
    resolve(outputDir, "request.json"),
    buildRequestDoc({
      provider: "gemini",
      model,
      temperature,
      referenceImages: imagePaths.map((value) => resolve(String(value))),
      ...(requestExtras && typeof requestExtras === "object" ? requestExtras : {}),
    })
  );
  await writeJsonDoc(
    resolve(outputDir, "result.json"),
    buildResultDoc({
      provider: "gemini",
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
    payload: result.raw,
    saveRaw,
  });
  await writeFile(resolve(outputDir, "response.txt"), `${result.text}\n`, "utf8");
  await writeFile(resolve(outputDir, "generated.html"), `${htmlWithDoctype}\n`, "utf8");

  return {
    dir: outputDir,
    htmlPath: resolve(outputDir, "generated.html"),
    responsePath: resolve(outputDir, "response.txt"),
    basename: basename(outputDir),
  };
};
