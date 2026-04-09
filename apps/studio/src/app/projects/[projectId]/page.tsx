import Link from "next/link";

import { FileChip } from "@/components/studio/file-chip";
import { ProjectShell } from "@/components/studio/project-shell";
import { StudioPreviewLightbox } from "@/components/studio/studio-preview-lightbox";
import {
  getProjectManifestById,
  getVisibleProjectManifests,
  groupPrimaryProjectDocs,
  toVisibleProjectOptions,
} from "@/lib/server/studio-data";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [project, manifests] = await Promise.all([
    getProjectManifestById(projectId),
    getVisibleProjectManifests(),
  ]);
  const projects = toVisibleProjectOptions(manifests);
  const isCustomGpt = project.projectId === "customgpt";
  const primaryDocs = groupPrimaryProjectDocs(project);
  const activeSlides = project.slides.filter((slide) => slide.status === "active");
  const previewCacheKey = `${project.generatedAt}:${project.sourceFingerprint.deckSpecMtimeMs}`;

  return (
    <ProjectShell project={project} projects={projects}>
      <div className="studio-canvas">
        <section className="studio-intro">
          <div>
            <p className="eyebrow">Project Overview</p>
            <h2>{project.title}</h2>
            <p className="studio-body-copy">
              {isCustomGpt
                ? "Project summary and source material for the talk. Use the deck board for the full slide-by-slide creation view."
                : "Repo-native project workspace for deck docs, packets, assets, and slide-level iteration."}
            </p>
            {isCustomGpt ? (
              <div className="studio-link-row">
                <Link href={`/projects/${project.projectId}/deck`} className="primary-link">
                  Open Master Deck
                </Link>
                <Link
                  href={`/projects/${project.projectId}/slides/slide-01`}
                  className="ghost-button"
                >
                  Open Slide Workbench
                </Link>
              </div>
            ) : null}
          </div>
          <div className="studio-intro-stats">
            <div>
              <span className="studio-hero-metric">{project.counts.activeSlides}</span>
              <span className="studio-hero-label">Active slides</span>
            </div>
            <div>
              <span className="studio-hero-metric">{project.counts.withPacket}</span>
              <span className="studio-hero-label">With packet</span>
            </div>
            <div>
              <span className="studio-hero-metric">{project.counts.withSelectedPreview}</span>
              <span className="studio-hero-label">With preview</span>
            </div>
            <div>
              <span className="studio-hero-metric">{project.counts.withWarnings}</span>
              <span className="studio-hero-label">Warnings</span>
            </div>
          </div>
        </section>

        <section className="asset-section">
          <div className="asset-group">
            <div className="asset-group-head">
              <div>
                <p className="eyebrow">Project Docs</p>
                <h3>Canonical source files</h3>
              </div>
            </div>
            <div className="studio-chip-row">
              {primaryDocs.map((doc) => (
                <FileChip
                  key={doc.path}
                  projectId={project.projectId}
                  refLike={doc}
                  label={doc.label ?? doc.path}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="slide-wall">
          {activeSlides.map((slide) => (
            <article
              key={slide.id}
              className={`slide-wall-row${slide.previews.selected ? "" : " slide-wall-row-unavailable"}`}
            >
              <div className="slide-wall-copy">
                <div className="slide-wall-identity">
                  <span className="studio-step-label">Slide {slide.displayNumber}</span>
                  <span className="studio-id-pill studio-id-pill-muted">{slide.id}</span>
                </div>
                <h3>{slide.title}</h3>
                <p className="studio-body-copy">
                  {slide.selectedDirection || slide.buildStatus || "No selected direction yet."}
                </p>
                <div className="studio-chip-row">
                  <span className="studio-chip">
                    <span>Status</span>
                    <strong>{slide.buildStatus ?? "pending"}</strong>
                  </span>
                  <span className="studio-chip">
                    <span>Assets</span>
                    <strong>{slide.canonical.slideAssets.length}</strong>
                  </span>
                </div>
                <div className="studio-link-row">
                  <Link
                    href={`/projects/${project.projectId}/slides/${slide.id}`}
                    className="primary-link"
                  >
                    Open Slide
                  </Link>
                  {slide.canonical.packet ? (
                    <FileChip
                      projectId={project.projectId}
                      refLike={slide.canonical.packet}
                      label="Packet"
                    />
                  ) : null}
                </div>
              </div>
              <div className="slide-wall-media">
                {slide.previews.selected ? (
                  <StudioPreviewLightbox
                    projectId={project.projectId}
                    cacheKey={previewCacheKey}
                    preview={slide.previews.selected}
                    previewWidth={900}
                    alt={`${slide.title} preview`}
                    title={slide.title}
                    meta={`Slide ${slide.displayNumber}`}
                  />
                ) : (
                  <div className="studio-empty-preview studio-empty-preview-placeholder">
                    <div className="studio-empty-preview-copy">
                      <span className="studio-empty-preview-kicker">
                        Slide {slide.displayNumber}
                      </span>
                      <strong>{slide.title}</strong>
                      <p>No selected preview yet</p>
                    </div>
                  </div>
                )}
              </div>
            </article>
          ))}
        </section>
      </div>
    </ProjectShell>
  );
}
