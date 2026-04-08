import { execFile } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";
import { promisify } from "node:util";

import { clearDesignerStudioCache } from "@/lib/server/designer-studio";
import { getRepoRoot, refreshProjectData } from "@/lib/server/studio-data";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

const normalizeSlideVersionCssViaCli = async ({
  projectId,
  slideId,
  versionId,
}: {
  projectId: string;
  slideId: string;
  versionId: string;
}) => {
  const repoRoot = getRepoRoot();
  const scriptPath = resolve(repoRoot, "scripts", "figures", "slide-versions.mjs");
  const projectRoot = resolve(repoRoot, "projects", projectId);
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      scriptPath,
      "normalize-css",
      "--project-root",
      projectRoot,
      "--slide",
      slideId,
      "--version-id",
      versionId,
      "--json",
    ],
    {
      cwd: repoRoot,
      maxBuffer: 8 * 1024 * 1024,
    }
  );
  const payload = JSON.parse(stdout) as {
    ok?: boolean;
    slideId?: string;
    sourceVersionId?: string;
    versionId?: string;
    versionDir?: string;
    generatedHtmlPath?: string;
    sourceHtmlPath?: string;
    previewPath?: string;
  };
  if (
    !payload?.ok ||
    !payload.slideId ||
    !payload.versionId ||
    !payload.versionDir ||
    !payload.generatedHtmlPath ||
    !payload.sourceHtmlPath ||
    !payload.previewPath
  ) {
    throw new Error("CSS normalization returned an invalid response.");
  }
  return payload;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null) {
    const stderr =
      "stderr" in error && typeof error.stderr === "string" ? error.stderr.trim() : "";
    const stdout =
      "stdout" in error && typeof error.stdout === "string" ? error.stdout.trim() : "";
    if (stderr) {
      return stderr;
    }
    if (stdout) {
      return stdout;
    }
  }
  return "CSS normalization failed.";
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const projectId =
    typeof body?.projectId === "string" && body.projectId.trim()
      ? body.projectId.trim()
      : null;
  const slideId =
    typeof body?.slideId === "string" && body.slideId.trim() ? body.slideId.trim() : null;
  const versionId =
    typeof body?.versionId === "string" && body.versionId.trim() ? body.versionId.trim() : null;

  if (!projectId || !slideId || !versionId) {
    return Response.json(
      {
        ok: false,
        error: "projectId, slideId, and versionId are required.",
      },
      { status: 400 }
    );
  }

  try {
    const normalized = await normalizeSlideVersionCssViaCli({
      projectId,
      slideId,
      versionId,
    });
    clearDesignerStudioCache();
    await refreshProjectData(projectId);
    return Response.json({
      ok: true,
      projectId,
      slideId: normalized.slideId,
      sourceVersionId: normalized.sourceVersionId,
      versionId: normalized.versionId,
      versionDir: normalized.versionDir,
      generatedHtmlPath: normalized.generatedHtmlPath,
      sourceHtmlPath: normalized.sourceHtmlPath,
      previewPath: normalized.previewPath,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: getErrorMessage(error),
      },
      { status: 400 }
    );
  }
}
