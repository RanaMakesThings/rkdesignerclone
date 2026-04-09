const withCacheBust = (href: string, cacheKey?: string | number | null) => {
  if (cacheKey === undefined || cacheKey === null || String(cacheKey).trim() === "") {
    return href;
  }
  const joiner = href.includes("?") ? "&" : "?";
  return `${href}${joiner}v=${encodeURIComponent(String(cacheKey))}`;
};

export const studioFileHref = (
  projectId: string,
  path: string,
  cacheKey?: string | number | null
) =>
  withCacheBust(
    `/api/file?projectId=${encodeURIComponent(projectId)}&path=${encodeURIComponent(path)}`,
    cacheKey
  );

export const studioThumbHref = (
  projectId: string,
  path: string,
  width = 720,
  cacheKey?: string | number | null
) =>
  withCacheBust(
    `/api/thumb?projectId=${encodeURIComponent(projectId)}&path=${encodeURIComponent(path)}&w=${encodeURIComponent(String(width))}`,
    cacheKey
  );

export const studioHtmlHref = (
  projectId: string,
  path: string,
  cacheKey?: string | number | null
) =>
  withCacheBust(
    `/api/report?projectId=${encodeURIComponent(projectId)}&path=${encodeURIComponent(path)}`,
    cacheKey
  );

const normalizeStudioSlideParam = (
  displayNumber: string | number | null | undefined,
  slideId: string
) => {
  const rawDisplay = String(displayNumber ?? "").trim();
  return /^\d+$/.test(rawDisplay) ? String(Number(rawDisplay)) : slideId;
};

export const studioSlideParam = (
  displayNumber: string | number | null | undefined,
  slideId: string
) => normalizeStudioSlideParam(displayNumber, slideId);

export const studioSlideHref = (
  displayNumber: string | number | null | undefined,
  slideId: string
) => `/slides/${encodeURIComponent(normalizeStudioSlideParam(displayNumber, slideId))}`;

export const studioSlideRunHref = (
  displayNumber: string | number | null | undefined,
  slideId: string,
  runId: string
) =>
  `${studioSlideHref(displayNumber, slideId)}/runs/${encodeURIComponent(runId)}`;
