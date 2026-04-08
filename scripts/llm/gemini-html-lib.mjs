import { resolve } from "node:path";

import {
  DEFAULT_GEMINI_TEXT_MODEL,
  DEFAULT_GEMINI_TEXT_TEMPERATURE,
  generateGeminiText,
  writeGeminiHtmlArtifacts,
} from "./gemini-text-client.mjs";

export const DEFAULT_GEMINI_HTML_MODEL = DEFAULT_GEMINI_TEXT_MODEL;
export const DEFAULT_GEMINI_HTML_TEMPERATURE = DEFAULT_GEMINI_TEXT_TEMPERATURE;
export const DEFAULT_GEMINI_THINKING_LEVEL = "high";

const buildThinkingConfig = ({ model, thinkingLevel }) => {
  const normalizedModel = String(model ?? "").toLowerCase();
  const normalizedLevel = String(thinkingLevel ?? "").trim().toLowerCase();
  if (!normalizedLevel) {
    return undefined;
  }

  if (normalizedModel.includes("gemini-3")) {
    return {
      thinkingLevel: normalizedLevel,
    };
  }

  const budgetByLevel = {
    minimal: 0,
    low: 1024,
    medium: 8192,
    high: -1,
  };

  return {
    thinkingBudget: budgetByLevel[normalizedLevel] ?? -1,
  };
};

export const buildGeminiHtmlPrompt = (prompt) =>
  [
    "Return one self-contained HTML document for a 1920x1080 investor-deck slide.",
    "Use inline CSS only. Inline SVG is allowed and preferred for lines, rulers, arrows, and geometric shapes.",
    "Do not return markdown, commentary, code fences, or any text outside the HTML.",
    "The result must fill the full slide canvas and read as a finished presentation figure, not a small card floating in a browser page.",
    String(prompt ?? "").trim(),
  ].join("\n");

export const generateGeminiHtml = async ({
  prompt,
  imagePaths = [],
  model = DEFAULT_GEMINI_HTML_MODEL,
  temperature = DEFAULT_GEMINI_HTML_TEMPERATURE,
  thinkingLevel = DEFAULT_GEMINI_THINKING_LEVEL,
}) =>
  generateGeminiText({
    prompt: buildGeminiHtmlPrompt(prompt),
    imagePaths,
    model,
    temperature,
    thinkingConfig: buildThinkingConfig({ model, thinkingLevel }),
  });

export const writeGeminiHtmlOutputArtifacts = async ({
  dir,
  prompt,
  model,
  temperature,
  thinkingLevel = DEFAULT_GEMINI_THINKING_LEVEL,
  imagePaths = [],
  result,
  saveRaw = false,
  elapsedMs = null,
}) =>
  writeGeminiHtmlArtifacts({
    dir: resolve(dir),
    prompt,
    model,
    temperature,
    imagePaths,
    result,
    saveRaw,
    elapsedMs,
    requestExtras: {
      thinkingLevel,
    },
  });
