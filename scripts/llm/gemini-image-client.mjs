import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";

import {
  buildRequestDoc,
  buildResultDoc,
  getOutputsDir,
  writeJsonDoc,
  writeOptionalRawResponse,
} from "./artifact-contract.mjs";

export const DEFAULT_GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview";
export const DEFAULT_GEMINI_IMAGE_ASPECT_RATIO = "16:9";
export const DEFAULT_GEMINI_IMAGE_SIZE = "2K";

const GEMINI_RESPONSE_MODALITIES = ["IMAGE"];
const INLINE_DATA_KEYS = ["inlineData", "inline_data"];

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

export const hasGeminiApiKey = () =>
  Boolean(String(process.env.GEMINI_API_KEY ?? "").trim());

export const resolveGeminiApiKey = () => {
  const value = String(process.env.GEMINI_API_KEY ?? "").trim();
  if (value) {
    return value;
  }

  throw new Error(
    [
      "Missing GEMINI_API_KEY.",
      "Remediation:",
      "1) Verify this repo is initialized against Doppler (`npm run doppler:init`).",
      "2) Verify the key exists in scope (`npm run doppler:verify -- --require-value GEMINI_API_KEY`).",
      "3) Re-run the Gemini command through Doppler (`npm run gemini:image -- ...`).",
    ].join("\n")
  );
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
      errorMessage ?? `Gemini image request failed with status ${response.status}.`
    );
  }

  return rawJson;
};

const extractInlineDataParts = (payload) => {
  const parts = payload?.candidates?.flatMap((candidate) => candidate?.content?.parts ?? []) ?? [];
  return parts
    .map((part) => {
      for (const key of INLINE_DATA_KEYS) {
        const blob = part?.[key];
        if (blob?.data && blob?.mimeType) {
          return { mimeType: blob.mimeType, data: blob.data };
        }
      }
      return null;
    })
    .filter(Boolean);
};

const extractTextParts = (payload) => {
  const parts = payload?.candidates?.flatMap((candidate) => candidate?.content?.parts ?? []) ?? [];
  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .filter(Boolean);
};

const extensionFromMimeType = (mimeType) => {
  const normalized = String(mimeType ?? "").toLowerCase();
  if (normalized.includes("png")) {
    return "png";
  }
  if (normalized.includes("jpeg") || normalized.includes("jpg")) {
    return "jpg";
  }
  if (normalized.includes("webp")) {
    return "webp";
  }
  return "bin";
};

const mimeTypeFromPath = (filePath) => {
  const ext = extname(String(filePath ?? "")).toLowerCase();
  if (ext === ".png") {
    return "image/png";
  }
  if (ext === ".jpg" || ext === ".jpeg") {
    return "image/jpeg";
  }
  if (ext === ".webp") {
    return "image/webp";
  }
  return "application/octet-stream";
};

const resolveImageParts = async (images) => {
  const imagePaths = Array.isArray(images) ? images : [];
  const parts = [];
  for (const imagePath of imagePaths) {
    const normalizedPath = resolve(String(imagePath));
    const buffer = await readFile(normalizedPath);
    parts.push({
      inlineData: {
        mimeType: mimeTypeFromPath(normalizedPath),
        data: buffer.toString("base64"),
      },
    });
  }
  return parts;
};

export const generateGeminiImages = async ({
  prompt,
  model = DEFAULT_GEMINI_IMAGE_MODEL,
  aspectRatio = DEFAULT_GEMINI_IMAGE_ASPECT_RATIO,
  imageSize = DEFAULT_GEMINI_IMAGE_SIZE,
  images: inputImages = [],
  apiKey = resolveGeminiApiKey(),
}) => {
  const promptText = String(prompt ?? "").trim();
  if (!promptText) {
    throw new Error("Prompt is required.");
  }

  const imageParts = await resolveImageParts(inputImages);
  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: promptText }, ...imageParts],
      },
    ],
    generationConfig: {
      responseModalities: GEMINI_RESPONSE_MODALITIES,
      imageConfig: {
        aspectRatio,
        ...(imageSize ? { imageSize } : {}),
      },
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
  const images = extractInlineDataParts(raw);
  const textParts = extractTextParts(raw);

  if (images.length === 0) {
    throw new Error(
      `Gemini returned no image parts.${textParts.length > 0 ? ` Text response: ${textParts.join(" ")}` : ""}`
    );
  }

  return {
    raw,
    images,
    text: textParts.join("\n\n").trim(),
  };
};

export const writeGeminiImageArtifacts = async ({
  dir,
  prompt,
  model,
  aspectRatio,
  imageSize,
  result,
  referenceImages = [],
  saveRaw = false,
  variantId = null,
  variantLabel = null,
  elapsedMs = null,
}) => {
  const outputDir = resolve(dir);
  await mkdir(outputDir, { recursive: true });
  const outputsDir = getOutputsDir(outputDir);
  await mkdir(outputsDir, { recursive: true });

  await writeFile(resolve(outputDir, "prompt.txt"), `${prompt.trim()}\n`, "utf8");
  await writeJsonDoc(
    resolve(outputDir, "request.json"),
    buildRequestDoc({
      provider: "gemini",
      model,
      aspectRatio,
      imageSize,
      referenceImages,
    })
  );

  if (result.text) {
    await writeFile(resolve(outputDir, "response.txt"), `${result.text}\n`, "utf8");
  }

  const paths = [];
  const outputs = [];
  for (const [index, image] of result.images.entries()) {
    const ext = extensionFromMimeType(image.mimeType);
    const filename = `image-${String(index + 1).padStart(2, "0")}.${ext}`;
    const filePath = resolve(outputsDir, filename);
    await writeFile(filePath, Buffer.from(image.data, "base64"));
    paths.push(filePath);
    outputs.push(`outputs/${filename}`);
  }

  await writeJsonDoc(
    resolve(outputDir, "result.json"),
    buildResultDoc({
      provider: "gemini",
      model,
      created_at: new Date().toISOString(),
      outputs,
      variant_id: variantId,
      variant_label: variantLabel,
      width: null,
      height: null,
      elapsed_ms: elapsedMs,
      text: result.text || null,
    })
  );
  await writeOptionalRawResponse({
    outputDir,
    payload: result.raw,
    saveRaw,
  });

  return {
    dir: outputDir,
    paths,
    primary: paths[0] ?? null,
    basename: basename(outputDir),
  };
};
