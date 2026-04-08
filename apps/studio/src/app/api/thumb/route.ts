import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { NextRequest } from "next/server";
import sharp from "sharp";

import {
  getContentTypeForFile,
  resolveAllowlistedFile,
  SafeFileAccessError,
} from "@/lib/server/file-access";
import { buildThumbCacheKey, getThumbCachePath } from "@/lib/server/thumb-cache";

export const runtime = "nodejs";

const DEFAULT_WIDTH = 720;
const MIN_WIDTH = 160;
const MAX_WIDTH = 1600;

const jsonError = (status: number, code: string, message: string) =>
  Response.json(
    {
      ok: false,
      error: {
        code,
        message,
      },
    },
    {
      status,
    }
  );

const parseWidth = (value: string | null) => {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_WIDTH;
  }
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, parsed));
};

const buildEtag = ({
  path,
  width,
  size,
  modifiedAt,
}: {
  path: string;
  width: number;
  size: number;
  modifiedAt: number;
}) =>
  `W/"${createHash("sha1")
    .update(`${path}:${width}:${size}:${modifiedAt}`)
    .digest("base64url")}"`;

const inflightThumbs = new Map<string, Promise<Buffer>>();

export async function GET(request: NextRequest) {
  const pathLike = request.nextUrl.searchParams.get("path");
  const projectId = request.nextUrl.searchParams.get("projectId");
  const width = parseWidth(request.nextUrl.searchParams.get("w"));

  try {
    const file = await resolveAllowlistedFile({
      pathLike,
      projectId,
      kind: "file",
    });
    const sourceContentType = getContentTypeForFile(file, "file");
    if (!sourceContentType.startsWith("image/")) {
      throw new SafeFileAccessError(
        415,
        "unsupported_thumbnail_type",
        "Only allowlisted image files can be thumbnailed."
      );
    }

    const fileStats = await stat(file.absolutePath);
    const etag = buildEtag({
      path: file.repoRelativePath,
      width,
      size: fileStats.size,
      modifiedAt: fileStats.mtimeMs,
    });
    const cacheHeaders = {
      ETag: etag,
      "Cache-Control": "private, max-age=3600, must-revalidate",
      Vary: "Accept",
      "Last-Modified": fileStats.mtime.toUTCString(),
      "X-Content-Type-Options": "nosniff",
    };

    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, {
        status: 304,
        headers: cacheHeaders,
      });
    }

    const thumbKey = buildThumbCacheKey({
      repoRelativePath: file.repoRelativePath,
      width,
      sourceSizeBytes: fileStats.size,
      sourceMtimeMs: fileStats.mtimeMs,
    });
    const cachePath = getThumbCachePath({
      repoRoot: file.repoRoot,
      thumbKey,
    });

    let body: Buffer;
    try {
      body = await readFile(cachePath);
    } catch {
      const existingInflight = inflightThumbs.get(cachePath);
      if (existingInflight) {
        body = await existingInflight;
      } else {
        const renderPromise = (async () => {
          await mkdir(dirname(cachePath), { recursive: true });
          const rendered = await sharp(file.absolutePath, {
            animated: false,
          })
            .rotate()
            .resize({
              width,
              fit: "inside",
              withoutEnlargement: true,
            })
            .webp({
              quality: 72,
              effort: 2,
            })
            .toBuffer();
          await writeFile(cachePath, rendered);
          return rendered;
        })();
        inflightThumbs.set(cachePath, renderPromise);
        try {
          body = await renderPromise;
        } finally {
          inflightThumbs.delete(cachePath);
        }
      }
    }

    return new Response(new Uint8Array(body), {
      status: 200,
      headers: {
        ...cacheHeaders,
        "Content-Type": "image/webp",
        "Content-Length": String(body.byteLength),
      },
    });
  } catch (error) {
    if (error instanceof SafeFileAccessError) {
      return jsonError(error.status, error.code, error.message);
    }
    console.error("[studio:thumb-route] unexpected error", error);
    return jsonError(500, "internal_error", "Failed to build thumbnail.");
  }
}
