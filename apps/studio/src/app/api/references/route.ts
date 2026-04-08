import { clearDesignerStudioCache } from "@/lib/server/designer-studio";
import { loadRepoContract } from "@/lib/server/repo-contract";
import { getRepoRoot } from "@/lib/server/studio-data";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const projectId =
    typeof body?.projectId === "string" && body.projectId.trim()
      ? body.projectId.trim()
      : "designer-health";
  const action =
    typeof body?.action === "string" && body.action.trim() ? body.action.trim() : null;
  const payload =
    body?.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
      ? body.payload
      : {};

  if (!action) {
    return Response.json(
      {
        ok: false,
        error: "action is required.",
      },
      { status: 400 }
    );
  }

  try {
    const repo = await loadRepoContract();
    const result = await repo.updateProjectReferences({
      repoRoot: getRepoRoot(),
      projectId,
      action,
      payload,
    });
    clearDesignerStudioCache();
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "References update failed.",
      },
      { status: 400 }
    );
  }
}
