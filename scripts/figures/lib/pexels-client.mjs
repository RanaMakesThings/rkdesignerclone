const PEXELS_API_KEY_ENV = "PEXELS_API_KEY";
const PEXELS_BASE_URL = "https://api.pexels.com/v1";

const ensureFetchAvailable = (fetchImpl) => {
  if (typeof fetchImpl !== "function") {
    throw new Error("This script requires Node.js v18+ (global fetch is missing).");
  }
};

const buildSearchUrl = ({ query, orientation, color, perPage }) => {
  const url = new URL(`${PEXELS_BASE_URL}/search`);
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", String(perPage));
  if (orientation) {
    url.searchParams.set("orientation", orientation);
  }
  if (color) {
    url.searchParams.set("color", color);
  }
  return url.toString();
};

export const resolvePexelsApiKey = () => {
  const value = process.env[PEXELS_API_KEY_ENV];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  throw new Error(
    [
      `Missing ${PEXELS_API_KEY_ENV}.`,
      "Remediation:",
      `1) Upload the raw token to Doppler as ${PEXELS_API_KEY_ENV}.`,
      `2) Verify it with \`npm run doppler:verify -- --require-value ${PEXELS_API_KEY_ENV}\`.`,
      "3) Run the asset command through Doppler.",
    ].join("\n")
  );
};

export const searchPexelsPhotos = async ({
  query,
  orientation = "",
  color = "",
  perPage = 18,
  apiKey = resolvePexelsApiKey(),
  fetchImpl = globalThis.fetch,
} = {}) => {
  ensureFetchAvailable(fetchImpl);

  const response = await fetchImpl(
    buildSearchUrl({
      query,
      orientation,
      color,
      perPage,
    }),
    {
      headers: {
        Authorization: apiKey,
      },
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Pexels search failed (${response.status}): ${detail.trim() || response.statusText}`
    );
  }

  const payload = await response.json();
  return Array.isArray(payload?.photos) ? payload.photos : [];
};
