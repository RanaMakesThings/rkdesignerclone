import { notFound, redirect } from "next/navigation";

import { FileChip } from "@/components/studio/file-chip";
import { ProjectShell } from "@/components/studio/project-shell";
import { StudioPreviewLightbox } from "@/components/studio/studio-preview-lightbox";
import { studioSlideHref } from "@/lib/presentation/links";
import { getDesignerStudioSlide } from "@/lib/server/designer-studio";
import {
  getProjectManifests,
  getSlideManifestById,
  groupSlideDocs,
} from "@/lib/server/studio-data";

export const dynamic = "force-dynamic";

export default async function ProjectSlidePage({
  params,
}: {
  params: Promise<{ projectId: string; slideId: string }>;
}) {
  const { projectId, slideId } = await params;

  if (projectId === "designer-health") {
    const { slide } = await getDesignerStudioSlide(slideId);
    if (!slide) {
      notFound();
    }
    redirect(studioSlideHref(slide.displayNumber, slide.slideId));
  }

  const [{ project, slide }, manifests] = await Promise.all([
    getSlideManifestById(projectId, slideId),
    getProjectManifests(),
  ]);
  const projects = manifests.map((entry) => ({
    projectId: entry.projectId,
    title: entry.title,
  }));
  const slideDocs = groupSlideDocs(projectId, slide);

  return (
    <ProjectShell project={project} projects={projects}>
      <div className="studio-canvas">
        <section className="studio-intro">
          <div>
            <p className="eyebrow">Slide Detail</p>
            <h2>
              Slide {slide.displayNumber}: {slide.title}
            </h2>
            <p className="studio-body-copy">
              {slide.selectedDirection || slide.buildStatus || "No selected direction yet."}
            </p>
          </div>
          <div className="studio-intro-stats">
            <div>
              <span className="studio-hero-metric">{slide.canonical.specs.length}</span>
              <span className="studio-hero-label">Specs</span>
            </div>
            <div>
              <span className="studio-hero-metric">{slide.canonical.slideAssets.length}</span>
              <span className="studio-hero-label">Slide assets</span>
            </div>
            <div>
              <span className="studio-hero-metric">{slide.reports.discoveredReports.length}</span>
              <span className="studio-hero-label">Reports</span>
            </div>
            <div>
              <span className="studio-hero-metric">{slide.derived.warnings.length}</span>
              <span className="studio-hero-label">Warnings</span>
            </div>
          </div>
        </section>

        <section className="asset-section">
          <div className="asset-group">
            <div className="asset-group-head">
              <div>
                <p className="eyebrow">Slide Docs</p>
                <h3>Canonical files and discovered companions</h3>
              </div>
            </div>
            <div className="studio-chip-row">
              {slideDocs.map((doc) => (
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
          <article className="slide-wall-row">
            <div className="slide-wall-copy">
              <div className="studio-chip-row">
                <span className="studio-chip">
                  <span>Slide ID</span>
                  <strong>{slide.id}</strong>
                </span>
                <span className="studio-chip">
                  <span>Family</span>
                  <strong>{slide.family ?? "unset"}</strong>
                </span>
                <span className="studio-chip">
                  <span>Status</span>
                  <strong>{slide.buildStatus ?? "pending"}</strong>
                </span>
              </div>
              {slide.purpose ? (
                <section className="studio-spec-block studio-spec-block-compact">
                  <p className="studio-spec-kicker">Purpose</p>
                  <p className="studio-spec-copy">{slide.purpose}</p>
                </section>
              ) : null}
              {slide.takeaway ? (
                <section className="studio-spec-block studio-spec-block-compact">
                  <p className="studio-spec-kicker">Takeaway</p>
                  <p className="studio-spec-copy">{slide.takeaway}</p>
                </section>
              ) : null}
            </div>
            <div className="slide-wall-media">
              {slide.previews.selected ? (
                <StudioPreviewLightbox
                  projectId={project.projectId}
                  preview={slide.previews.selected}
                  previewWidth={1100}
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
        </section>
      </div>
    </ProjectShell>
  );
}
