import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { clearDesignerStudioCache } from "@/lib/server/designer-studio";
import { getRepoRoot, refreshProjectData } from "@/lib/server/studio-data";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const css = typeof body?.css === "string" ? body.css : "";

  if (!css.trim()) {
    return Response.json(
      {
        ok: false,
        error: "css is required.",
      },
      { status: 400 }
    );
  }

  const repoRoot = getRepoRoot();
  const targetPath = resolve(
    repoRoot,
    "projects",
    "designer-health",
    "design-system",
    "vox-shared.css"
  );

  await writeFile(targetPath, css.endsWith("\n") ? css : `${css}\n`, "utf8");
  clearDesignerStudioCache();
  await refreshProjectData("designer-health");

  return Response.json({
    ok: true,
    path: "projects/designer-health/design-system/vox-shared.css",
  });
}
