import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { getStudioDesignerDataPaths } from "./designer-paths.ts";

export const getThumbCacheRoot = () =>
  getStudioDesignerDataPaths().thumbsRoot;

export const buildThumbCacheKey = ({
  repoRelativePath,
  width,
  sourceSizeBytes,
  sourceMtimeMs,
}: {
  repoRelativePath: string;
  width: number;
  sourceSizeBytes: number;
  sourceMtimeMs: number;
}) =>
  createHash("sha1")
    .update(`${repoRelativePath}:${width}:${sourceSizeBytes}:${sourceMtimeMs}`)
    .digest("hex");

export const getThumbCachePath = ({
  repoRoot: _repoRoot,
  thumbKey,
}: {
  repoRoot: string;
  thumbKey: string;
}) => {
  void _repoRoot;
  return resolve(getThumbCacheRoot(), `${thumbKey}.webp`);
};
