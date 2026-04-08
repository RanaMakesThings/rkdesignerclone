import { notFound } from "next/navigation";

import { getProjectManifestById } from "@/lib/server/studio-data";

export const dynamic = "force-dynamic";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  try {
    await getProjectManifestById(projectId);
  } catch {
    notFound();
  }

  return <>{children}</>;
}
