import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

import { createResponse, hasOpenAIApiKey } from "./openai-client.mjs";
import {
  buildRequestDoc,
  buildResultDoc,
  getOutputsDir,
  writeJsonDoc,
  writeOptionalRawResponse,
} from "./artifact-contract.mjs";

export const DEFAULT_OPENAI_IMAGE_MODEL = "gpt-5.4";
export const DEFAULT_OPENAI_IMAGE_SIZE = "1536x1024";
export const DEFAULT_OPENAI_IMAGE_QUALITY = "high";
export const DEFAULT_OPENAI_IMAGE_BACKGROUND = "opaque";
export const DEFAULT_OPENAI_IMAGE_MAX_OUTPUT_TOKENS = 2000;

const buildImagePrompt = (prompt) =>
  [
    "Create one polished 16:9 investor-deck figure image.",
    "Use any attached reference images only to preserve family continuity and quoted objects.",
    "The result should fill the frame cleanly and feel like a premium presentation slide figure, not a screenshot of a browser page.",
    "",
    String(prompt ?? "").trim(),
  ].join("\n");

const mimeTypeFromPath = (filePath) => {
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
  throw new Error(`Unsupported image type for OpenAI image input: ${filePath}`);
};

const readImageInput = async (imagePath) => {
  const filePath = resolve(String(imagePath));
  const raw = await readFile(filePath);
  return {
    filePath,
    block: {
      type: "input_image",
      image_url: `data:${mimeTypeFromPath(filePath)};base64,${raw.toString("base64")}`,
    },
  };
};

const extractImageBase64 = (payload) => {
  const outputItems = Array.isArray(payload?.output) ? payload.output : [];
  for (const item of outputItems) {
    if (item?.type === "image_generation_call" && typeof item.result === "string") {
      return item.result.trim();
    }
  }
  return "";
};

export const generateOpenAIImage = async ({
  prompt,
  model = DEFAULT_OPENAI_IMAGE_MODEL,
  imagePaths = [],
  size = DEFAULT_OPENAI_IMAGE_SIZE,
  quality = DEFAULT_OPENAI_IMAGE_QUALITY,
  background = DEFAULT_OPENAI_IMAGE_BACKGROUND,
  maxOutputTokens = DEFAULT_OPENAI_IMAGE_MAX_OUTPUT_TOKENS,
}) => {
  const promptText = String(prompt ?? "").trim();
  if (!promptText) {
    throw new Error("Prompt is required.");
  }

  const content = [];
  const resolvedImagePaths = Array.isArray(imagePaths) ? imagePaths : [];
  for (const imagePath of resolvedImagePaths) {
    const imageInput = await readImageInput(imagePath);
    content.push(imageInput.block);
  }
  content.push({
    type: "input_text",
    text: buildImagePrompt(promptText),
  });

  const raw = await createResponse({
    model: String(model),
    input: [
      {
        role: "user",
        content,
      },
    ],
    max_output_tokens: Number(maxOutputTokens),
    tools: [
      {
        type: "image_generation",
        size: String(size),
        quality: String(quality),
        background: String(background),
      },
    ],
  });

  const imageBase64 = extractImageBase64(raw);
  if (!imageBase64) {
    throw new Error("OpenAI returned no image-generation result.");
  }

  return {
    raw,
    imageBase64,
    text: null,
  };
};

export const writeOpenAIImageArtifacts = async ({
  dir,
  prompt,
  model,
  result,
  referenceImages = [],
  size = DEFAULT_OPENAI_IMAGE_SIZE,
  quality = DEFAULT_OPENAI_IMAGE_QUALITY,
  background = DEFAULT_OPENAI_IMAGE_BACKGROUND,
  saveRaw = false,
  variantId = null,
  variantLabel = null,
  elapsedMs = null,
}) => {
  const outputDir = resolve(dir);
  await mkdir(outputDir, { recursive: true });
  const outputsDir = getOutputsDir(outputDir);
  await mkdir(outputsDir, { recursive: true });

  const imagePath = resolve(outputsDir, "image-01.png");
  await writeFile(imagePath, Buffer.from(result.imageBase64, "base64"));
  await writeFile(resolve(outputDir, "prompt.txt"), `${String(prompt ?? "").trim()}\n`, "utf8");
  await writeJsonDoc(
    resolve(outputDir, "request.json"),
    buildRequestDoc({
      provider: "openai",
      model: String(model),
      referenceImages: referenceImages.map((value) => resolve(String(value))),
      size: String(size),
      quality: String(quality),
      background: String(background),
    })
  );
  await writeJsonDoc(
    resolve(outputDir, "result.json"),
    buildResultDoc({
      provider: "openai",
      model: String(model),
      created_at: new Date().toISOString(),
      outputs: ["outputs/image-01.png"],
      variant_id: variantId,
      variant_label: variantLabel,
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

  return {
    dir: outputDir,
    imagePath,
    basename: basename(outputDir),
  };
};

export { hasOpenAIApiKey };
