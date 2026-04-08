import Link from "next/link";

import { FileChip } from "@/components/studio/file-chip";
import { DesignerStudioShell } from "@/components/studio/designer-studio-shell";
import { ProjectReferencesPanel } from "@/components/studio/project-references-panel";
import { StudioPreviewLightbox } from "@/components/studio/studio-preview-lightbox";
import { TemplateGallery } from "@/components/studio/template-gallery";
import {
  getDesignerStudioDeck,
  DESIGNER_STUDIO_PROJECT_ID,
} from "@/lib/server/designer-studio";
import { studioSlideHref } from "@/lib/presentation/links";

export const dynamic = "force-dynamic";

export default async function Home() {
  const deck = await getDesignerStudioDeck({ includeGeneratedGraphics: false });

  return (
    <DesignerStudioShell deck={deck} activeSection="home">
      <div className="studio-canvas">
        <section className="studio-intro">
          <div>
            <p className="eyebrow">Selected Slides</p>
            <h2>Review the live Designer slide set in order.</h2>
            <p className="studio-body-copy">
              Every active slide stays in the wall. Missing slides hold a blank placeholder so the
              open slots remain visible while current stamped versions stay reviewable inline.
            </p>
            <div className="studio-link-row">
              <a href="/api/export/slides" className="primary-link">
                Download Slide Export
              </a>
            </div>
          </div>
          <div className="studio-intro-stats">
            <div>
              <span className="studio-hero-metric">{deck.activeSlides.length}</span>
              <span className="studio-hero-label">Selected slides</span>
            </div>
            <div>
              <span className="studio-hero-metric">{deck.reviewableSlides.length}</span>
              <span className="studio-hero-label">Ready now</span>
            </div>
            <div>
              <span className="studio-hero-metric">{deck.unavailableSlides.length}</span>
              <span className="studio-hero-label">Blank slots</span>
            </div>
            <div>
              <span className="studio-hero-metric">{deck.slidesWithAssets}</span>
              <span className="studio-hero-label">With assets</span>
            </div>
          </div>
        </section>

        <TemplateGallery
          deck={deck}
          projectId={DESIGNER_STUDIO_PROJECT_ID}
          description={
            <>
              Templates live at the deck level in <code>deck-spec.json</code>. They are
              checked-in shell assets and contracts, not manifest-backed stamped slide roots.
            </>
          }
          ctaHref="/templates"
          ctaLabel="Open Templates"
        />

        <ProjectReferencesPanel
          projectId={DESIGNER_STUDIO_PROJECT_ID}
          references={deck.references}
        />

        <section className="slide-wall">
          {deck.activeSlides.map((slide) => (
            <article
              key={slide.slideId}
              className={`slide-wall-row${slide.reviewable ? "" : " slide-wall-row-unavailable"}`}
            >
              <div className="slide-wall-copy">
                <div className="slide-wall-identity">
                  <span className="studio-step-label">Slide {slide.displayNumber}</span>
                  {slide.currentVersionId ? (
                    <span className="studio-id-pill studio-id-pill-accent">
                      {slide.currentVersionId}
                    </span>
                  ) : (
                    <span className="studio-id-pill studio-id-pill-muted">Pending</span>
                  )}
                </div>
                <h3>{slide.title}</h3>
                <p className="studio-body-copy">
                  {slide.reviewable
                    ? slide.selectedDirection ||
                      slide.buildStatus ||
                      "Current stamped version is ready for review."
                    : slide.unavailableReason
                      ? `${slide.unavailableReason}. Leave this slot open until the first stamped version lands.`
                      : "No current materials yet. Leave this slot open until the first stamped version lands."}
                </p>
                {slide.specText ? (
                  <section className="studio-spec-block studio-spec-block-compact">
                    <p className="studio-spec-kicker">Slide Spec</p>
                    <p className="studio-spec-copy">{slide.specText}</p>
                  </section>
                ) : null}
                <div className="studio-chip-row">
                  <span className="studio-chip">
                    <span>Repo Slide</span>
                    <strong>{slide.slideId}</strong>
                  </span>
                  {slide.stampedRootId ? (
                    <span className="studio-chip">
                      <span>Stamped Root</span>
                      <strong>{slide.stampedRootId}</strong>
                    </span>
                  ) : null}
                  <span className="studio-chip">
                    <span>Status</span>
                    <strong>{slide.currentVersion?.status ?? slide.unavailableReason ?? "pending"}</strong>
                  </span>
                  <span className="studio-chip">
                    <span>Assets</span>
                    <strong>{slide.assetCount}</strong>
                  </span>
                </div>
                <div className="studio-link-row">
                  <Link
                    href={studioSlideHref(slide.displayNumber, slide.slideId)}
                    className={slide.reviewable ? "primary-link" : "ghost-link"}
                  >
                    {slide.reviewable ? "Open Slide" : "Open Slide Spec"}
                  </Link>
                  {slide.currentHtml ? (
                    <FileChip
                      projectId={DESIGNER_STUDIO_PROJECT_ID}
                      refLike={slide.currentHtml}
                      label="Current HTML"
                    />
                  ) : null}
                </div>
              </div>

              <div className="slide-wall-media">
                {slide.currentPreview ? (
                  <StudioPreviewLightbox
                    projectId={DESIGNER_STUDIO_PROJECT_ID}
                    preview={slide.currentPreview}
                    html={slide.currentHtml}
                    svg={slide.currentSvg}
                    previewWidth={900}
                    alt={`${slide.title} current preview`}
                    title={slide.title}
                    meta={`Slide ${slide.displayNumber} · ${slide.currentVersionId}`}
                  />
                ) : (
                  <div className="studio-empty-preview studio-empty-preview-placeholder">
                    <div className="studio-empty-preview-copy">
                      <span className="studio-empty-preview-kicker">Slide {slide.displayNumber}</span>
                      <strong>{slide.title}</strong>
                      <p>{slide.unavailableReason ?? "No current version yet"}</p>
                    </div>
                  </div>
                )}
              </div>
            </article>
          ))}
        </section>
      </div>
    </DesignerStudioShell>
  );
}
