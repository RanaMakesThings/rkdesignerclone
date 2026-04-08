import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const LARGE_INLINE_FIELDS = new Set(["b64_json", "data", "result", "imageBase64"]);

const sanitizeRawValue = (value, parentKey = "") => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeRawValue(item, parentKey));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, sanitizeRawValue(nestedValue, key)])
    );
  }

  if (
    typeof value === "string" &&
    LARGE_INLINE_FIELDS.has(parentKey) &&
    value.length >= 4096
  ) {
    return `[stripped ${parentKey} payload: ${value.length} chars]`;
  }

  return value;
};

export const buildRequestDoc = (fields) => ({
  ...fields,
});

export const buildResultDoc = (fields) => ({
  ...fields,
});

export const getOutputsDir = (outputDir) => resolve(outputDir, "outputs");

export const writeJsonDoc = async (filePath, value) => {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

export const writeOptionalRawResponse = async ({
  outputDir,
  payload,
  saveRaw = false,
}) => {
  if (!saveRaw) {
    return null;
  }

  const debugDir = resolve(outputDir, "debug");
  await mkdir(debugDir, { recursive: true });
  const rawPath = resolve(debugDir, "response.json");
  await writeJsonDoc(rawPath, sanitizeRawValue(payload));
  return rawPath;
};
