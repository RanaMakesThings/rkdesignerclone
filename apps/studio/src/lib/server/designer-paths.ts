import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";

const DEFAULT_DATA_ROOT_NAME = "designer-data";

const isWithinRoot = (rootPath: string, candidatePath: string) => {
  const normalizedRoot = resolve(rootPath);
  const normalizedCandidate = resolve(candidatePath);
  return (
    normalizedCandidate === normalizedRoot ||
    normalizedCandidate.startsWith(`${normalizedRoot}/`)
  );
};

export const getStudioDesignerDataPaths = () => {
  const dataRoot = resolveStudioDesignerDataRoot();
  const cacheRoot = resolve(dataRoot, "cache");
  const thumbsRoot = resolve(cacheRoot, "thumbs");
  const parsedRoot = resolve(cacheRoot, "parsed");
  const runsRoot = resolve(dataRoot, "runs");
  const exportsRoot = resolve(dataRoot, "exports");
  const archiveRoot = resolve(dataRoot, "archive");
  const logsRoot = resolve(dataRoot, "logs");
  const sqliteRoot = resolve(dataRoot, "sqlite");
  return {
    dataRoot,
    cacheRoot,
    thumbsRoot,
    parsedRoot,
    runsRoot,
    exportsRoot,
    archiveRoot,
    logsRoot,
    sqliteRoot,
    sqlitePath: resolve(sqliteRoot, "studio-index.db"),
  };
};

export const resolveStudioDesignerDataRoot = () => {
  const configured = String(process.env.DESIGNER_DATA_DIR ?? "").trim();
  return configured ? resolve(configured) : resolve(homedir(), DEFAULT_DATA_ROOT_NAME);
};

export const resolveStudioDesignerDataPath = (pathLike: string) => {
  const raw = String(pathLike ?? "").trim();
  if (!raw) {
    return null;
  }
  const dataRoot = resolveStudioDesignerDataRoot();
  const absolutePath = isAbsolute(raw) ? resolve(raw) : resolve(dataRoot, raw);
  return isWithinRoot(dataRoot, absolutePath) ? absolutePath : null;
};

export const toStudioDesignerDataRelativePath = (absolutePath: string) => {
  const dataRoot = resolveStudioDesignerDataRoot();
  const resolvedPath = resolve(absolutePath);
  if (!isWithinRoot(dataRoot, resolvedPath)) {
    return null;
  }
  return resolvedPath.slice(resolve(dataRoot).length + 1).replaceAll("\\", "/") || ".";
};
