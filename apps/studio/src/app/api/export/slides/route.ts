import { buildDesignerSlidesExportZip } from "@/lib/server/designer-slide-export";

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

export async function GET() {
  try {
    const body = await buildDesignerSlidesExportZip();
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="designer-slides-export.zip"',
        "Cache-Control": "no-store",
        "Content-Length": String(body.byteLength),
      },
    });
  } catch (error) {
    console.error("[studio:export-slides-route] unexpected error", error);
    return jsonError(500, "internal_error", "Failed to export current Designer slides.");
  }
}
