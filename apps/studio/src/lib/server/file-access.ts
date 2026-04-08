import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { basename, extname } from "node:path";

import { isTrustedStudioPath } from "./path-allowlist";
import {
  resolveStudioDesignerDataPath,
  toStudioDesignerDataRelativePath,
} from "./designer-paths.ts";
import { getStudioRepoRoots } from "./repo-roots.ts";
import { loadRepoContract, resolveRepoRoot } from "./repo-contract";

type AllowedFileKind = "file" | "report";

type AllowedFile = {
  repoRoot: string;
  repoRelativePath: string;
  absolutePath: string;
  extension: string;
  sourceRoot: "repo" | "designer-data";
};

export class SafeFileAccessError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const IMAGE_MIME_TYPES = new Map<string, string>([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".gif", "image/gif"],
]);

const TEXT_MIME_TYPES = new Map<string, string>([
  [".css", "text/css; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
]);

const JSON_MIME_TYPES = new Map<string, string>([
  [".json", "application/json; charset=utf-8"],
]);

const FILE_ALLOWED_EXTENSIONS = new Set([
  ...IMAGE_MIME_TYPES.keys(),
  ...TEXT_MIME_TYPES.keys(),
  ...JSON_MIME_TYPES.keys(),
]);

const DESIGNER_DATA_ALLOWED_PREFIXES = [
  "runs/designer-health/",
  "runs/adhoc/",
  "exports/",
  "cache/thumbs/",
];

const normalizeProjectId = (value: string | null) => {
  if (!value) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const isTrustedDesignerDataPath = (
  dataRelativePath: string,
  projectId: string | null
) => {
  const normalized = String(dataRelativePath ?? "").replaceAll("\\", "/").trim();
  if (!normalized) {
    return false;
  }
  if (projectId && projectId !== "designer-health") {
    return false;
  }
  return DESIGNER_DATA_ALLOWED_PREFIXES.some(
    (prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix)
  );
};

const mimeTypeForExtension = (extension: string, kind: AllowedFileKind) => {
  if (kind === "report") {
    return "text/html; charset=utf-8";
  }
  return (
    IMAGE_MIME_TYPES.get(extension) ||
    TEXT_MIME_TYPES.get(extension) ||
    JSON_MIME_TYPES.get(extension) ||
    "application/octet-stream"
  );
};

const assertAllowedExtension = (
  extension: string,
  _fileName: string,
  kind: AllowedFileKind
) => {
  if (kind === "report") {
    if (extension !== ".html") {
      throw new SafeFileAccessError(
        415,
        "unsupported_report_type",
        "Only checked-in HTML files are supported in report route."
      );
    }
    return;
  }

  if (!FILE_ALLOWED_EXTENSIONS.has(extension)) {
    throw new SafeFileAccessError(
      415,
      "unsupported_file_type",
      `File extension "${extension}" is not allowed for file route.`
    );
  }
};

export const resolveAllowlistedFile = async ({
  pathLike,
  projectId,
  kind,
}: {
  pathLike: string | null;
  projectId: string | null;
  kind: AllowedFileKind;
}): Promise<AllowedFile> => {
  if (!pathLike || pathLike.trim().length === 0) {
    throw new SafeFileAccessError(400, "missing_path", "Query parameter `path` is required.");
  }

  const normalizedProjectId = normalizeProjectId(projectId);
  const repoRoot = await resolveRepoRoot();
  const repoRoots = getStudioRepoRoots(repoRoot);
  const contract = await loadRepoContract();

  let repoRelativePath: string | null = null;
  let absolutePath: string | null = null;
  let sourceRoot: "repo" | "designer-data" = "repo";

  for (const candidateRepoRoot of repoRoots) {
    const classified = contract.classifyPathReference(candidateRepoRoot, pathLike);
    if (
      classified.kind !== "repo-relative" ||
      !classified.repoRelativePath ||
      !classified.absolutePath
    ) {
      continue;
    }

    const candidatePath = contract.normalizeRepoRelativePath(classified.repoRelativePath);
    if (!isTrustedStudioPath(candidatePath, normalizedProjectId)) {
      continue;
    }
    if (!existsSync(classified.absolutePath)) {
      continue;
    }

    repoRelativePath = candidatePath;
    absolutePath = classified.absolutePath;
    sourceRoot = "repo";
    break;
  }

  if (!repoRelativePath || !absolutePath) {
    const designerDataAbsolutePath = await resolveStudioDesignerDataPath(pathLike);
    const designerDataRelativePath = designerDataAbsolutePath
      ? await toStudioDesignerDataRelativePath(designerDataAbsolutePath)
      : null;

    if (
      designerDataAbsolutePath &&
      designerDataRelativePath &&
      isTrustedDesignerDataPath(designerDataRelativePath, normalizedProjectId)
    ) {
      repoRelativePath = designerDataRelativePath;
      absolutePath = designerDataAbsolutePath;
      sourceRoot = "designer-data";
    }
  }

  if (!repoRelativePath || !absolutePath) {
    throw new SafeFileAccessError(
      403,
      "path_not_allowlisted",
      "Requested path is outside the trusted Studio roots."
    );
  }

  let fileStats;
  try {
    fileStats = await stat(absolutePath);
  } catch {
    throw new SafeFileAccessError(404, "missing_file", "Requested file does not exist.");
  }

  if (!fileStats.isFile()) {
    throw new SafeFileAccessError(400, "path_is_not_file", "Requested path does not point to a file.");
  }

  const extension = extname(repoRelativePath).toLowerCase();
  const fileName = basename(repoRelativePath);
  assertAllowedExtension(extension, fileName, kind);

  return {
    repoRoot,
    repoRelativePath,
    absolutePath,
    extension,
    sourceRoot,
  };
};

export const readAllowlistedFile = async (file: AllowedFile) =>
  readFile(file.absolutePath);

export const getContentTypeForFile = (file: AllowedFile, kind: AllowedFileKind) =>
  mimeTypeForExtension(file.extension, kind);
