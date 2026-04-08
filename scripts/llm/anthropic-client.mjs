import process from "node:process";

export const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";
export const DEFAULT_ANTHROPIC_VERSION = "2023-06-01";
export const DEFAULT_ANTHROPIC_MODEL =
  process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-6";
export const DEFAULT_ANTHROPIC_MAX_TOKENS = 1600;

const ANTHROPIC_API_KEY_ENV_CANDIDATES = [
  "ANTHROPIC_API_KEY",
  "YSN_ANTHROPIC_API_KEY",
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
    process.env.ANTHROPIC_BASE_URL || DEFAULT_ANTHROPIC_BASE_URL
  );
  const url = new URL(
    isAbsoluteUrl(pathOrUrl)
      ? String(pathOrUrl)
      : `${baseUrl}/${String(pathOrUrl).replace(/^\/+/, "")}`
  );

  if (!query) {
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

export class AnthropicRequestError extends Error {
  constructor(message, { status, statusText, method, url, payload } = {}) {
    super(message);
    this.name = "AnthropicRequestError";
    this.status = status;
    this.statusText = statusText;
    this.method = method;
    this.url = url;
    this.payload = payload;
  }
}

export const hasAnthropicApiKey = () =>
  ANTHROPIC_API_KEY_ENV_CANDIDATES.some((keyName) => {
    const value = process.env[keyName];
    return typeof value === "string" && value.trim().length > 0;
  });

export const resolveAnthropicApiKey = () => {
  for (const keyName of ANTHROPIC_API_KEY_ENV_CANDIDATES) {
    const value = process.env[keyName];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  throw new Error(
    [
      "Missing Anthropic API key.",
      "Set ANTHROPIC_API_KEY (or YSN_ANTHROPIC_API_KEY),",
      "or run this command through `npm run doppler:run -- ...`.",
    ].join(" ")
  );
};

export const callAnthropic = async ({
  method = "POST",
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
  const normalizedMethod = String(method || "POST").toUpperCase();
  const requestHeaders = new Headers(headers || {});
  requestHeaders.set("x-api-key", resolveAnthropicApiKey());
  requestHeaders.set(
    "anthropic-version",
    process.env.ANTHROPIC_VERSION || DEFAULT_ANTHROPIC_VERSION
  );

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
  throw new AnthropicRequestError(
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

export const createMessage = async ({
  model = DEFAULT_ANTHROPIC_MODEL,
  system,
  messages,
  maxTokens = DEFAULT_ANTHROPIC_MAX_TOKENS,
  temperature,
  metadata,
  tools,
} = {}) => {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("Anthropic messages require at least one message.");
  }

  const payload = {
    model,
    max_tokens: Number(maxTokens),
    messages,
  };

  if (typeof system === "string" && system.trim()) {
    payload.system = system;
  }
  if (temperature !== undefined) {
    payload.temperature = Number(temperature);
  }
  if (metadata && typeof metadata === "object") {
    payload.metadata = metadata;
  }
  if (Array.isArray(tools) && tools.length > 0) {
    payload.tools = tools;
  }

  return callAnthropic({
    method: "POST",
    path: "/messages",
    json: payload,
  });
};

export const extractMessageText = (payload) => {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const blocks = Array.isArray(payload.content) ? payload.content : [];
  const parts = [];

  for (const block of blocks) {
    if (block?.type === "text" && typeof block.text === "string" && block.text.trim()) {
      parts.push(block.text.trim());
    }
  }

  return parts.join("\n\n").trim();
};
