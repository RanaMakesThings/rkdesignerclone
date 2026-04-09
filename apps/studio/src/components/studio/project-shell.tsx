import type { ProjectManifest } from "@/lib/presentation/studio-types";

import { NavLink } from "./nav-link";
import { ProjectBreadcrumb } from "./project-breadcrumb";
import { ProjectSearchForm } from "./project-search-form";
import { ProjectSwitcher } from "./project-switcher";
import { RefreshButton } from "./refresh-button";
import { SlideJump } from "./slide-jump";
import { StatusPill } from "./status-pill";

export function ProjectShell({
  project,
  projects,
  children,
}: {
  project: ProjectManifest;
  projects: Array<{ projectId: string; title: string }>;
  children: React.ReactNode;
}) {
  const isCustomGpt = project.projectId === "customgpt";
  const studioTheme = project.studioTheme?.trim() || null;
  const usesNightmodeShell = studioTheme === "nightmode" || project.projectId === "customgpt";
  const activeSlides = project.slides.filter((slide) => slide.status === "active");
  const deprecatedSlides = project.slides.filter((slide) => slide.status === "deprecated");

  return (
    <div
      className={`app-shell page-enter${
        usesNightmodeShell ? " project-shell-nightmode project-shell-customgpt" : ""
      }`}
    >
      <aside className="shell-sidebar">
        <div className="brand-block">
          <p className="eyebrow">Designer Studio</p>
          <h1>{project.title}</h1>
          <p className="sidebar-copy">
            {isCustomGpt
              ? "Master deck workspace for the talk, its mockups, promoted variants, and source files."
              : "Local-first deck explorer for canonical truth, discovered work, and the current deck backbone."}
          </p>
        </div>

        <div className="sidebar-section">
          <ProjectSwitcher currentProjectId={project.projectId} projects={projects} />
        </div>

        <div className="sidebar-section">
          <StatusPill tone="accent">{project.status}</StatusPill>
          <StatusPill>{project.version}</StatusPill>
          <StatusPill tone={deprecatedSlides.length > 0 ? "warning" : "muted"}>
            {deprecatedSlides.length} Deprecated
          </StatusPill>
        </div>

        <div className="sidebar-section">
          <NavLink href={`/projects/${project.projectId}`} label="Overview" match="exact" />
          <NavLink href={`/projects/${project.projectId}/deck`} label="Deck" match="exact" />
          <NavLink href={`/projects/${project.projectId}/history`} label="History" match="exact" />
        </div>

        <div className="sidebar-section">
          <SlideJump projectId={project.projectId} slides={activeSlides} />
        </div>

        <div className="sidebar-section">
          <p className="sidebar-label">Active Deck</p>
          <div className="slide-link-list">
            {activeSlides.map((slide) => (
              <NavLink
                key={slide.id}
                href={`/projects/${project.projectId}/slides/${slide.id}`}
                label={`${slide.displayNumber} ${slide.title}`}
                match="exact"
              />
            ))}
          </div>
        </div>

        {deprecatedSlides.length > 0 ? (
          <div className="sidebar-section">
            <p className="sidebar-label">Deprecated</p>
            <div className="slide-link-list">
              {deprecatedSlides.map((slide) => (
                <NavLink
                  key={slide.id}
                  href={`/projects/${project.projectId}/slides/${slide.id}`}
                  label={`${slide.displayNumber} ${slide.title}`}
                  match="exact"
                />
              ))}
            </div>
          </div>
        ) : null}
      </aside>

      <div className="shell-main">
        <header className="shell-topbar">
          <div className="topbar-stack">
            <ProjectBreadcrumb />
            <div>
              <p className="eyebrow">Project</p>
              <h2>{project.title}</h2>
            </div>
          </div>
          <div className="topbar-tools">
            <ProjectSearchForm />
            <SlideJump projectId={project.projectId} slides={activeSlides} />
            <RefreshButton projectId={project.projectId} />
            <div className="chip-row">
              <StatusPill>{project.counts.activeSlides} Active</StatusPill>
              <StatusPill tone={project.counts.withWarnings > 0 ? "warning" : "muted"}>
                {project.counts.withWarnings} Warnings
              </StatusPill>
              <StatusPill
                tone={
                  project.counts.withDiscoveredUnlinkedArtifacts > 0 ? "warning" : "muted"
                }
              >
                {project.counts.withDiscoveredUnlinkedArtifacts} Unlinked
              </StatusPill>
            </div>
          </div>
        </header>
        <main className="shell-content">{children}</main>
      </div>
    </div>
  );
}
