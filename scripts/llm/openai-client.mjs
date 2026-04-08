import process from "node:process";

export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

const OPENAI_API_KEY_ENV_CANDIDATES = [
  "OPENAI_API_KEY",
  "YSN_OPENAI_API_KEY",
];

const trimTrailingSlashes = (value) => String(value).replace(/\/+$/, "");
const isAbsoluteUrl = (value) => /^https?:\/\//i.test(String(value));

const maybeJsonParse = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const toErrorString = (payload) => {
  if (typeof payload === "string") {
    const text = payload.trim();
    return text || null;
  }

  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (typeof payload.error?.message === "string") {
    return payload.error.message;
  }

  if (typeof payload.message === "string") {
    return payload.message;
  }

  return null;
};

const buildUrl = (pathOrUrl, query) => {
  const baseUrl = trimTrailingSlashes(
    process.env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL
  );
  const url = new URL(
    isAbsoluteUrl(pathOrUrl)
      ? String(pathOrUrl)
      : `${baseUrl}/${String(pathOrUrl).replace(/^\/+/, "")}`
  );

  if (!query) {
    return url.toString();
  }

  if (query instanceof URLSearchParams) {
    for (const [key, value] of query.entries()) {
      url.searchParams.append(key, value);
    }
    return url.toString();
  }

  const queryPairs = Array.isArray(query) ? query : Object.entries(query);
  for (const [key, value] of queryPairs) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined || item === null) {
          continue;
        }
        url.searchParams.append(String(key), String(item));
      }
      continue;
    }

    url.searchParams.append(String(key), String(value));
  }

  return url.toString();
};

const parseResponsePayload = async (response) => {
  const raw = await response.text();
  if (!raw) {
    return null;
  }

  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  const parsed = maybeJsonParse(raw);

  if (contentType.includes("application/json")) {
    return parsed ?? raw;
  }

  return parsed ?? raw;
};

export class OpenAIRequestError extends Error {
  constructor(message, { status, statusText, method, url, payload } = {}) {
    super(message);
    this.name = "OpenAIRequestError";
    this.status = status;
    this.statusText = statusText;
    this.method = method;
    this.url = url;
    this.payload = payload;
  }
}

export const hasOpenAIApiKey = () =>
  OPENAI_API_KEY_ENV_CANDIDATES.some((keyName) => {
    const value = process.env[keyName];
    return typeof value === "string" && value.trim().length > 0;
  });

export const resolveOpenAIApiKey = () => {
  for (const keyName of OPENAI_API_KEY_ENV_CANDIDATES) {
    const value = process.env[keyName];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  throw new Error(
    "Missing OpenAI API key. Set OPENAI_API_KEY (or YSN_OPENAI_API_KEY)."
  );
};

export const callOpenAI = async ({
  method = "GET",
  path,
  query = null,
  headers = {},
  json,
  body,
} = {}) => {
  if (typeof fetch !== "function") {
    throw new Error("This script requires Node.js v18+ (global fetch is missing).");
  }

  if (!path) {
    throw new Error("Missing API path.");
  }

  if (json !== undefined && body !== undefined) {
    throw new Error("Specify either `json` or `body`, not both.");
  }

  const url = buildUrl(path, query);
  const normalizedMethod = String(method || "GET").toUpperCase();
  const requestHeaders = new Headers(headers || {});
  requestHeaders.set("Authorization", `Bearer ${resolveOpenAIApiKey()}`);

  let requestBody = body;
  if (json !== undefined) {
    if (!requestHeaders.has("Content-Type")) {
      requestHeaders.set("Content-Type", "application/json");
    }
    requestBody = JSON.stringify(json);
  }

  const response = await fetch(url, {
    method: normalizedMethod,
    headers: requestHeaders,
    body: requestBody,
  });

  const payload = await parseResponsePayload(response);
  if (response.ok) {
    return payload;
  }

  const reason =
    toErrorString(payload) || `${response.status} ${response.statusText}`;
  throw new OpenAIRequestError(
    `${normalizedMethod} ${path} failed (${response.status}): ${reason}`,
    {
      status: response.status,
      statusText: response.statusText,
      method: normalizedMethod,
      url,
      payload,
    }
  );
};

export const createResponse = async (payload) =>
  callOpenAI({
    method: "POST",
    path: "/responses",
    json: payload,
  });

export const extractResponseText = (payload) => {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const outputChunks = [];
  const outputItems = Array.isArray(payload.output) ? payload.output : [];

  for (const item of outputItems) {
    const contents = Array.isArray(item?.content) ? item.content : [];
    for (const block of contents) {
      if (typeof block?.text === "string" && block.text.trim()) {
        outputChunks.push(block.text.trim());
      } else if (
        typeof block?.output_text === "string" &&
        block.output_text.trim()
      ) {
        outputChunks.push(block.output_text.trim());
      }
    }
  }

  return outputChunks.join("\n").trim();
};
