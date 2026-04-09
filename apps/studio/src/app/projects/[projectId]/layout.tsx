import { notFound, redirect } from "next/navigation";

import {
  getProjectManifestById,
  isLegacyStudioProject,
} from "@/lib/server/studio-data";

export const dynamic = "force-dynamic";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  if (isLegacyStudioProject(projectId)) {
    redirect("/");
  }

  try {
    await getProjectManifestById(projectId);
  } catch {
    notFound();
  }

  return <>{children}</>;
}
