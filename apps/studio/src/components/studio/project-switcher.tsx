"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function ProjectSwitcher({
  currentProjectId,
  projects,
}: {
  currentProjectId: string;
  projects: Array<{ projectId: string; title: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <label className="jump-shell">
      <span className="jump-label">Project</span>
      <select
        className="jump-select"
        value={currentProjectId}
        onChange={(event) => {
          const nextProjectId = event.target.value;
          const nextParams = new URLSearchParams(searchParams.toString());
          const query = nextParams.toString();
          router.push(`/projects/${nextProjectId}${query ? `?${query}` : ""}`);
        }}
      >
        {projects.map((project) => (
          <option key={project.projectId} value={project.projectId}>
            {project.title}
          </option>
        ))}
      </select>
    </label>
  );
}
