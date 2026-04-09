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
  if (!normalizedProjectId) {
    return new Set(DESIGNER_PREFIXES.map((prefix) => normalizeRepoRelativePath(prefix)));
  }

  const prefixes = new Set<string>();

  prefixes.add(normalizeRepoRelativePath(`projects/${normalizedProjectId}/`));

  if (normalizedProjectId === DESIGNER_PROJECT_ID) {
    for (const prefix of DESIGNER_PREFIXES) {
      prefixes.add(normalizeRepoRelativePath(prefix));
    }
  }

  return prefixes;
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
