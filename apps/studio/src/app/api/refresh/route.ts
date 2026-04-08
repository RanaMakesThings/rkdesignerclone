import { clearDesignerStudioCache } from "@/lib/server/designer-studio";
import { refreshProjectData } from "@/lib/server/studio-data";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const projectId =
    typeof body?.projectId === "string" && body.projectId.trim().length > 0
      ? body.projectId.trim()
      : undefined;

  clearDesignerStudioCache();
  await refreshProjectData(projectId);

  return Response.json({
    ok: true,
    refreshed: projectId ?? "all",
  });
}
