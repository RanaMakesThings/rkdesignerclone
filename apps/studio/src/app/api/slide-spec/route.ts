import { clearDesignerStudioCache } from "@/lib/server/designer-studio";
import { loadRepoContract } from "@/lib/server/repo-contract";
import { getRepoRoot } from "@/lib/server/studio-data";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const projectId =
    typeof body?.projectId === "string" && body.projectId.trim()
      ? body.projectId.trim()
      : null;
  const slideId =
    typeof body?.slideId === "string" && body.slideId.trim() ? body.slideId.trim() : null;
  const specText = typeof body?.specText === "string" ? body.specText : "";

  if (!projectId || !slideId) {
    return Response.json(
      {
        ok: false,
        error: "projectId and slideId are required.",
      },
      { status: 400 }
    );
  }

  try {
    const repo = await loadRepoContract();
    const result = await repo.updateSlideSpecText({
      repoRoot: getRepoRoot(),
      projectId,
      slideId,
      specText,
    });
    clearDesignerStudioCache();
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Slide spec update failed.",
      },
      { status: 400 }
    );
  }
}
