import { createHash } from "node:crypto";
import { stat } from "node:fs/promises";

import { NextRequest } from "next/server";

import {
  getContentTypeForFile,
  readAllowlistedFile,
  resolveAllowlistedFile,
  SafeFileAccessError,
} from "@/lib/server/file-access";

export const runtime = "nodejs";

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

const buildEtag = ({
  path,
  size,
  modifiedAt,
}: {
  path: string;
  size: number;
  modifiedAt: number;
}) =>
  `W/"${createHash("sha1")
    .update(`${path}:${size}:${modifiedAt}`)
    .digest("base64url")}"`;

export async function GET(request: NextRequest) {
  const pathLike = request.nextUrl.searchParams.get("path");
  const projectId = request.nextUrl.searchParams.get("projectId");

  try {
    const file = await resolveAllowlistedFile({
      pathLike,
      projectId,
      kind: "file",
    });
    const fileStats = await stat(file.absolutePath);
    const etag = buildEtag({
      path: file.repoRelativePath,
      size: fileStats.size,
      modifiedAt: fileStats.mtimeMs,
    });
    const contentType = getContentTypeForFile(file, "file");
    const cacheHeaders = {
      ETag: etag,
      "Cache-Control": "private, max-age=3600, must-revalidate",
      "Last-Modified": fileStats.mtime.toUTCString(),
      Vary: "Accept",
      "X-Content-Type-Options": "nosniff",
    };

    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, {
        status: 304,
        headers: cacheHeaders,
      });
    }

    const body = await readAllowlistedFile(file);
    return new Response(body, {
      status: 200,
      headers: {
        ...cacheHeaders,
        "Content-Type": contentType,
        "Content-Length": String(body.byteLength),
      },
    });
  } catch (error) {
    if (error instanceof SafeFileAccessError) {
      return jsonError(error.status, error.code, error.message);
    }
    console.error("[studio:file-route] unexpected error", error);
    return jsonError(500, "internal_error", "Failed to serve allowlisted file.");
  }
}
