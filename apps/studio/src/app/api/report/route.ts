import { NextRequest } from "next/server";

import {
  readAllowlistedFile,
  resolveAllowlistedFile,
  SafeFileAccessError,
} from "@/lib/server/file-access";
import { isTrustedStudioPath } from "@/lib/server/path-allowlist";
import { sanitizeReportHtml } from "@/lib/server/report-sanitize";

export const runtime = "nodejs";

const REPORT_CSP =
  "default-src 'none'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";

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

export async function GET(request: NextRequest) {
  const pathLike = request.nextUrl.searchParams.get("path");
  const projectId = request.nextUrl.searchParams.get("projectId");

  try {
    const report = await resolveAllowlistedFile({
      pathLike,
      projectId,
      kind: "report",
    });
    const rawHtml = (await readAllowlistedFile(report)).toString("utf8");
    const sanitized = sanitizeReportHtml(rawHtml, {
      repoRoot: report.repoRoot,
      reportAbsolutePath: report.absolutePath,
      isAllowedPath: (repoRelativePath) => isTrustedStudioPath(repoRelativePath, projectId),
      projectId,
    });

    return new Response(sanitized, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy": REPORT_CSP,
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
      },
    });
  } catch (error) {
    if (error instanceof SafeFileAccessError) {
      return jsonError(error.status, error.code, error.message);
    }
    console.error("[studio:report-route] unexpected error", error);
    return jsonError(500, "internal_error", "Failed to render report HTML.");
  }
}
