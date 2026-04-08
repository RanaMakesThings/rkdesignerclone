const DESIGNER_PROJECT_ID = "designer-health";
const DESIGNER_PREFIXES = [
  "projects/designer-health/",
  "projects/designer-health/design-system/",
  "output/figures/presentation-images/",
  "projects/figures/",
];

const normalizeProjectId = (value: string | null) => {
  const normalized = String(value ?? "").trim();
  return normalized || null;
};

const normalizeRepoRelativePath = (value: string) =>
  String(value ?? "")
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "")
    .replace(/\/+/g, "/")
    .trim();

const getTrustedPrefixes = (projectId: string | null) => {
  const normalizedProjectId = normalizeProjectId(projectId);
  if (normalizedProjectId && normalizedProjectId !== DESIGNER_PROJECT_ID) {
    return new Set<string>();
  }

  return new Set(DESIGNER_PREFIXES.map((prefix) => normalizeRepoRelativePath(prefix)));
};

export const isTrustedStudioPath = (
  repoRelativePath: string,
  projectId: string | null = null
) => {
  const normalizedPath = normalizeRepoRelativePath(repoRelativePath);
  const prefixes = getTrustedPrefixes(projectId);

  for (const prefix of prefixes) {
    if (normalizedPath === prefix.slice(0, -1) || normalizedPath.startsWith(prefix)) {
      return true;
    }
  }

  return false;
};

export const clearAllowlistCache = () => {};
