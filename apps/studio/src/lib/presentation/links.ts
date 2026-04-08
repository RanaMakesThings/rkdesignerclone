export const studioFileHref = (projectId: string, path: string) =>
  `/api/file?projectId=${encodeURIComponent(projectId)}&path=${encodeURIComponent(path)}`;

export const studioThumbHref = (projectId: string, path: string, width = 720) =>
  `/api/thumb?projectId=${encodeURIComponent(projectId)}&path=${encodeURIComponent(path)}&w=${encodeURIComponent(String(width))}`;

export const studioHtmlHref = (projectId: string, path: string) =>
  `/api/report?projectId=${encodeURIComponent(projectId)}&path=${encodeURIComponent(path)}`;

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
