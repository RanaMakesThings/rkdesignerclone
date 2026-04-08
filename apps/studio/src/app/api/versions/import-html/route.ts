import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import { tmpdir } from "node:os";
import process from "node:process";
import { promisify } from "node:util";

import { clearDesignerStudioCache } from "@/lib/server/designer-studio";
import { getRepoRoot, refreshProjectData } from "@/lib/server/studio-data";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

const DEFAULT_SOURCE_NAME = "studio-html-lab.html";

const normalizeSourceName = (sourceName: string | null) => {
  const rawName = basename(sourceName?.trim() || DEFAULT_SOURCE_NAME);
  const safeName = rawName.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  const fallbackName = safeName || DEFAULT_SOURCE_NAME;
  const extension = extname(fallbackName).toLowerCase();
  if (extension === ".html" || extension === ".htm") {
    return fallbackName;
  }
  return `${fallbackName}.html`;
};

const importSlideVersionViaCli = async ({
  projectId,
  slideId,
  html,
  sourceName,
}: {
  projectId: string;
  slideId: string;
  html: string;
  sourceName: string | null;
}) => {
  const repoRoot = getRepoRoot();
  const scriptPath = resolve(repoRoot, "scripts", "figures", "slide-versions.mjs");
  const projectRoot = resolve(repoRoot, "projects", projectId);
  const tempDir = await mkdtemp(resolve(tmpdir(), "studio-import-html-"));
  const tempHtmlPath = resolve(tempDir, normalizeSourceName(sourceName));

  try {
    await writeFile(tempHtmlPath, html, "utf8");
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        scriptPath,
        "import-html",
        "--project-root",
        projectRoot,
        "--slide",
        slideId,
        "--html-file",
        tempHtmlPath,
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
      versionId?: string;
      versionDir?: string;
      generatedHtmlPath?: string;
      previewPath?: string;
    };
    if (
      !payload?.ok ||
      !payload.slideId ||
      !payload.versionId ||
      !payload.versionDir ||
      !payload.generatedHtmlPath ||
      !payload.previewPath
    ) {
      throw new Error("HTML import returned an invalid response.");
    }
    return payload;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
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
  return "HTML import failed.";
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const projectId =
    typeof body?.projectId === "string" && body.projectId.trim()
      ? body.projectId.trim()
      : null;
  const slideId =
    typeof body?.slideId === "string" && body.slideId.trim() ? body.slideId.trim() : null;
  const html = typeof body?.html === "string" ? body.html : "";
  const sourceName =
    typeof body?.sourceName === "string" && body.sourceName.trim()
      ? body.sourceName.trim()
      : null;

  if (!projectId || !slideId || !html.trim()) {
    return Response.json(
      {
        ok: false,
        error: "projectId, slideId, and html are required.",
      },
      { status: 400 }
    );
  }

  try {
    const imported = await importSlideVersionViaCli({
      projectId,
      slideId,
      html,
      sourceName,
    });
    clearDesignerStudioCache();
    await refreshProjectData(projectId);
    return Response.json({
      ok: true,
      projectId,
      slideId: imported.slideId,
      versionId: imported.versionId,
      versionDir: imported.versionDir,
      generatedHtmlPath: imported.generatedHtmlPath,
      previewPath: imported.previewPath,
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
