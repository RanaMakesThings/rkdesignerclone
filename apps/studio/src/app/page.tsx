import Link from "next/link";

import { FileChip } from "@/components/studio/file-chip";
import { RefreshButton } from "@/components/studio/refresh-button";
import { StatusPill } from "@/components/studio/status-pill";
import { StudioPreviewLightbox } from "@/components/studio/studio-preview-lightbox";
import {
  getVisibleProjectManifests,
  groupPrimaryProjectDocs,
} from "@/lib/server/studio-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const projects = await getVisibleProjectManifests();
  const activeProjectCount = projects.filter((project) => project.status === "active").length;
  const totalActiveSlides = projects.reduce(
    (sum, project) => sum + project.counts.activeSlides,
    0
  );
  const totalMockups = projects.reduce(
    (sum, project) => sum + project.counts.withSelectedPreview,
    0
  );

  return (
    <div className="landing-shell">
      <section className="landing-hero landing-hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">Studio Canvas</p>
          <h1>Project-first slide creation.</h1>
          <p className="hero-text">
            Designer Studio is the shared workspace for whichever deck we are building next. The
            live surface starts from active project workspaces instead of archived legacy deck
            artifacts.
          </p>
          <div className="chip-row">
            <StatusPill tone="accent">{projects.length} Projects</StatusPill>
            <StatusPill>{activeProjectCount} Active</StatusPill>
            <StatusPill>{totalActiveSlides} Slides</StatusPill>
            <StatusPill tone={totalMockups > 0 ? "accent" : "muted"}>
              {totalMockups} Selected Mockups
            </StatusPill>
          </div>
        </div>

        <div className="landing-sideband">
          <p className="eyebrow">How To Use Studio</p>
          <ol className="ordered-spine">
            <li>Choose a project workspace.</li>
            <li>Open the master deck to review slide coverage and selected mockups.</li>
            <li>Drop into a slide workbench to edit specs, review variants, and promote winners.</li>
          </ol>
          <div className="studio-link-row">
            {projects[0] ? (
              <Link href={`/projects/${projects[0].projectId}/deck`} className="primary-link">
                Open First Workspace
              </Link>
            ) : null}
            <RefreshButton />
          </div>
        </div>
      </section>

      <div className="landing-stack">
        {projects.length > 0 ? (
          projects.map((project) => {
            const previewCacheKey = `${project.generatedAt}:${project.sourceFingerprint.deckSpecMtimeMs}`;
            const activeSlides = project.slides.filter((slide) => slide.status === "active");
            const firstSlide = activeSlides[0] ?? null;
            const previewSlide =
              activeSlides.find((slide) => slide.previews.selected?.path) ?? firstSlide;
            const docs = groupPrimaryProjectDocs(project).slice(0, 4);

            return (
              <section key={project.projectId} className="project-card">
                <div className="project-row">
                  <div className="project-row-copy">
                    <div className="project-card-head">
                      <div>
                        <p className="eyebrow">Project Workspace</p>
                        <h2>{project.title}</h2>
                      </div>
                      <div className="chip-row">
                        <StatusPill tone={project.status === "active" ? "accent" : "muted"}>
                          {project.status}
                        </StatusPill>
                        <StatusPill>{project.version}</StatusPill>
                      </div>
                    </div>

                    <p className="page-copy">
                      {project.narrativeSpine[0] ||
                        "Project workspace for slide specs, packets, assets, references, and mockup review."}
                    </p>

                    <div className="metric-grid">
                      <div>
                        <span className="metric-value">{project.counts.activeSlides}</span>
                        <span className="metric-label">Active slides</span>
                      </div>
                      <div>
                        <span className="metric-value">{project.counts.withPacket}</span>
                        <span className="metric-label">With packet</span>
                      </div>
                      <div>
                        <span className="metric-value">{project.counts.withSelectedPreview}</span>
                        <span className="metric-label">With preview</span>
                      </div>
                      <div>
                        <span className="metric-value">{project.counts.withWarnings}</span>
                        <span className="metric-label">Warnings</span>
                      </div>
                    </div>

                    <div className="studio-link-row">
                      <Link href={`/projects/${project.projectId}/deck`} className="primary-link">
                        Open Deck
                      </Link>
                      <Link href={`/projects/${project.projectId}`} className="ghost-button">
                        Open Overview
                      </Link>
                      {firstSlide ? (
                        <Link
                          href={`/projects/${project.projectId}/slides/${firstSlide.id}`}
                          className="ghost-button"
                        >
                          Open First Slide
                        </Link>
                      ) : null}
                    </div>

                    {docs.length > 0 ? (
                      <div className="chip-row">
                        {docs.map((doc) => (
                          <FileChip
                            key={`${project.projectId}:${doc.path}`}
                            projectId={project.projectId}
                            refLike={doc}
                            label={doc.label ?? doc.path}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="project-row-preview">
                    <div className="preview-card">
                      <div className="preview-card-head">
                        <div>
                          <p className="eyebrow">Current Deck View</p>
                          <h3>{previewSlide?.title ?? "No active slides yet"}</h3>
                        </div>
                        {previewSlide ? (
                          <StatusPill tone={previewSlide.previews.selected?.path ? "accent" : "muted"}>
                            {previewSlide.previews.selected?.path ? "Selected mockup" : "Visual pending"}
                          </StatusPill>
                        ) : null}
                      </div>

                      <div className="preview-frame">
                        {previewSlide?.previews.selected?.path ? (
                          <StudioPreviewLightbox
                            projectId={project.projectId}
                            cacheKey={previewCacheKey}
                            preview={previewSlide.previews.selected}
                            previewWidth={960}
                            alt={`${project.title} preview`}
                            title={previewSlide.title}
                            meta={`Slide ${previewSlide.displayNumber}`}
                          />
                        ) : (
                          <div className="studio-empty-preview studio-empty-preview-placeholder">
                            <div className="studio-empty-preview-copy">
                              <span className="studio-empty-preview-kicker">
                                {firstSlide ? `Slide ${firstSlide.displayNumber}` : "Workspace"}
                              </span>
                              <strong>{previewSlide?.title ?? project.title}</strong>
                              <p>
                                {firstSlide
                                  ? firstSlide.buildStatus || "No selected preview yet."
                                  : "No active slides are available in this workspace yet."}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            );
          })
        ) : (
          <section className="page-panel">
            <p className="eyebrow">No Workspaces</p>
            <h2>No visible Studio projects are available yet.</h2>
            <p className="page-copy">
              Add a project with a deck spec and it will appear here as a workspace card.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
