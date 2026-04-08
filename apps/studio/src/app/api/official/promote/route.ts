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
  const candidateSource =
    body?.candidateSource === "canonical-variant" ||
    body?.candidateSource === "discovered-branch"
      ? body.candidateSource
      : null;
  const candidateId =
    typeof body?.candidateId === "string" && body.candidateId.trim()
      ? body.candidateId.trim()
      : null;

  if (!projectId || !slideId || !candidateSource || !candidateId) {
    return Response.json(
      {
        ok: false,
        error: "projectId, slideId, candidateSource, and candidateId are required.",
      },
      { status: 400 }
    );
  }

  try {
    const repo = await loadRepoContract();
    const result = await repo.promoteOfficialVariant({
      repoRoot: getRepoRoot(),
      projectId,
      slideId,
      candidateSource,
      candidateId,
    });
    clearDesignerStudioCache();
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Promotion failed.",
      },
      { status: 400 }
    );
  }
}
