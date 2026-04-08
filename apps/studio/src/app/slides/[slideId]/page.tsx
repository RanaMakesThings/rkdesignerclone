import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { FileChip } from "@/components/studio/file-chip";
import { DesignerStudioShell } from "@/components/studio/designer-studio-shell";
import { NormalizeVersionButton } from "@/components/studio/normalize-version-button";
import { PromoteVersionButton } from "@/components/studio/promote-version-button";
import { SlideCompare } from "@/components/studio/slide-compare";
import { SlideReferencesPanel } from "@/components/studio/slide-references-panel";
import { SlideSpecPanel } from "@/components/studio/slide-spec-panel";
import { StudioAssetCard } from "@/components/studio/studio-asset-card";
import { StudioPreviewLightbox } from "@/components/studio/studio-preview-lightbox";
import { getDesignerStudioSlideRunSummaries } from "@/lib/server/html-edit-runs";
import {
  getDesignerStudioSlide,
  DESIGNER_STUDIO_PROJECT_ID,
} from "@/lib/server/designer-studio";
import { studioSlideHref, studioSlideRunHref } from "@/lib/presentation/links";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const formatDate = (value: string | null) => {
  if (!value) {
    return "Unknown";
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? value : dateFormatter.format(parsed);
};

export default async function SlidePage({
  params,
}: {
  params: Promise<{ slideId: string }>;
}) {
  const { slideId } = await params;
  const { deck, slide, canonicalParam } = await getDesignerStudioSlide(slideId);

  if (slide && canonicalParam && canonicalParam !== slideId) {
    redirect(studioSlideHref(slide.displayNumber, slide.slideId));
  }

  const htmlEditRuns = await getDesignerStudioSlideRunSummaries(slideId);

  if (!slide) {
    notFound();
  }

  const previewableVersions = slide.versions
    .filter((version) => version.preview?.path)
    .map((version) => ({
      id: version.id,
      label: version.label,
      status: version.status,
      previewPath: version.preview?.path ?? "",
      isCurrent: version.isCurrent,
    }));
  return (
    <DesignerStudioShell deck={deck} activeSlideId={slide.slideId}>
      <div className="studio-canvas">
        <section className="slide-detail-hero">
          <div className="slide-detail-copy">
            <div className="slide-detail-topbar">
              <div className="slide-wall-identity">
                <span className="studio-step-label">Slide {slide.displayNumber}</span>
                {slide.currentVersion ? (
                  <span className="studio-id-pill studio-id-pill-accent">
                    {slide.currentVersion.id}
                  </span>
                ) : (
                  <span className="studio-id-pill studio-id-pill-muted">Pending</span>
                )}
              </div>

              {previewableVersions.length > 0 ? (
                <SlideCompare
                  projectId={DESIGNER_STUDIO_PROJECT_ID}
                  slideId={slide.slideId}
                  slideTitle={slide.title}
                  versions={previewableVersions}
                />
              ) : null}
            </div>
            <h2>{slide.title}</h2>
            <p className="studio-body-copy">
              {slide.selectedDirection ||
                slide.buildStatus ||
                slide.unavailableReason ||
                "Current stamped version is the primary review surface for this slide."}
            </p>

            <div className="slide-facts-grid">
              <div className="slide-fact">
                <span className="slide-fact-label">Status</span>
                <strong>{slide.currentVersion?.status ?? slide.unavailableReason ?? "pending"}</strong>
              </div>
              <div className="slide-fact">
                <span className="slide-fact-label">Repo Slide</span>
                <strong>{slide.slideId}</strong>
              </div>
              <div className="slide-fact">
                <span className="slide-fact-label">Stamped Root</span>
                <strong>{slide.stampedRootId ?? "None"}</strong>
              </div>
              <div className="slide-fact">
                <span className="slide-fact-label">Created</span>
                <strong>
                  {slide.currentVersion ? formatDate(slide.currentVersion.createdAt) : "Unknown"}
                </strong>
              </div>
              <div className="slide-fact">
                <span className="slide-fact-label">Assets</span>
                <strong>{slide.assetCount}</strong>
              </div>
            </div>

            <div className="studio-chip-row">
              {slide.stampedDir ? (
                <FileChip
                  projectId={DESIGNER_STUDIO_PROJECT_ID}
                  refLike={slide.stampedDir}
                  label="Stamped Root"
                />
              ) : null}
              {slide.currentHtml ? (
                <FileChip
                  projectId={DESIGNER_STUDIO_PROJECT_ID}
                  refLike={slide.currentHtml}
                  label="Current HTML"
                />
              ) : null}
              {slide.currentSvg ? (
                <FileChip
                  projectId={DESIGNER_STUDIO_PROJECT_ID}
                  refLike={slide.currentSvg}
                  label="Current SVG"
                />
              ) : null}
            </div>
          </div>

          <div className="slide-detail-visual">
            {slide.currentPreview ? (
              <StudioPreviewLightbox
                projectId={DESIGNER_STUDIO_PROJECT_ID}
                preview={slide.currentPreview}
                html={slide.currentHtml}
                svg={slide.currentSvg}
                previewLoading="eager"
                alt={`${slide.title} current version`}
                title={slide.title}
                meta={`Slide ${slide.displayNumber} · ${slide.currentVersionId ?? "pending"}`}
              />
            ) : (
              <div className="studio-empty-preview studio-empty-preview-placeholder">
                <div className="studio-empty-preview-copy">
                  <span className="studio-empty-preview-kicker">Slide {slide.displayNumber}</span>
                  <strong>{slide.title}</strong>
                  <p>{slide.unavailableReason ?? "No current preview yet"}</p>
                </div>
              </div>
            )}
          </div>
        </section>

        <SlideSpecPanel
          projectId={DESIGNER_STUDIO_PROJECT_ID}
          slideId={slide.slideId}
          slideTitle={slide.title}
          specText={slide.specText}
        />

        <SlideReferencesPanel
          projectId={DESIGNER_STUDIO_PROJECT_ID}
          slideId={slide.slideId}
          references={slide.references}
          library={deck.references.library}
        />

        {htmlEditRuns.length > 0 ? (
          <section className="asset-section">
            <div className="asset-group">
              <div className="asset-group-head">
                <div>
                  <p className="eyebrow">HTML Edit Runs</p>
                  <h3>{htmlEditRuns.length} recorded runs</h3>
                </div>
              </div>
              <div className="slide-facts-grid">
                {htmlEditRuns.slice(0, 8).map((run) => (
                  <Link
                    key={run.runId}
                    href={studioSlideRunHref(slide.displayNumber, slide.slideId, run.runId)}
                    className="detail-nav-link"
                  >
                    <span className="detail-nav-label">
                      {run.surface ?? "html-edit"} · {run.status}
                    </span>
                    <strong>{run.runId}</strong>
                    <span className="studio-rail-meta">
                      {run.winner?.slotId
                        ? `Winner ${run.winner.slotId}`
                        : run.needsCodexReview
                          ? "Waiting on Codex review"
                          : run.schema === "legacy-gemini-tune"
                            ? `${run.legacyAttemptCount} attempts`
                            : `${run.roundsCount} rounds · ${run.slotCount} slots`}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {(slide.slideAssets.length > 0 || slide.deckAssets.length > 0) ? (
          <details className="asset-section">
            <summary className="asset-section-summary">
              <div>
                <p className="eyebrow">Assets</p>
                <h3>{slide.slideAssets.length + slide.deckAssets.length} curated assets</h3>
              </div>
              <span className="asset-section-chevron" aria-hidden="true">▾</span>
            </summary>

            {slide.slideAssets.length > 0 ? (
              <div className="asset-group">
                {slide.deckAssets.length > 0 ? (
                  <div className="asset-group-head">
                    <p className="eyebrow">Slide Assets</p>
                  </div>
                ) : null}
                <div className="asset-grid">
                  {slide.slideAssets.map((asset) => (
                    <StudioAssetCard
                      key={asset.id}
                      projectId={DESIGNER_STUDIO_PROJECT_ID}
                      asset={asset}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {slide.deckAssets.length > 0 ? (
              <div className="asset-group">
                {slide.slideAssets.length > 0 ? (
                  <div className="asset-group-head">
                    <p className="eyebrow">Deck Assets</p>
                  </div>
                ) : null}
                <div className="asset-grid">
                  {slide.deckAssets.map((asset) => (
                    <StudioAssetCard
                      key={asset.id}
                      projectId={DESIGNER_STUDIO_PROJECT_ID}
                      asset={asset}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </details>
        ) : null}

        <section className="archive-section">
          <div className="archive-head">
            <div>
              <p className="eyebrow">Version Archive</p>
              <h3>{slide.versions.length} versions on disk</h3>
            </div>
            <Link href="/" className="ghost-link">
              Back Home
            </Link>
          </div>

          {slide.versions.length > 0 ? (
            <div className="version-list">
              {slide.versions.map((version) => (
                <article
                  key={version.id}
                  className={`version-row${version.isCurrent ? " version-row-current" : ""}`}
                >
                  <div className="version-row-preview">
                    {version.preview ? (
                      <StudioPreviewLightbox
                        projectId={DESIGNER_STUDIO_PROJECT_ID}
                        preview={version.preview}
                        html={version.html}
                        svg={version.svg}
                        previewWidth={840}
                        alt={`${slide.title} ${version.id}`}
                        title={slide.title}
                        meta={`Slide ${slide.displayNumber} · ${version.id}`}
                      />
                    ) : (
                      <div className="studio-empty-preview">No preview</div>
                    )}
                  </div>

                  <div className="version-row-copy">
                    <div className="version-row-head">
                      <div>
                        <p className="eyebrow">
                          {version.isCurrent ? "Current" : "Archived"}
                        </p>
                        <h3>{version.label}</h3>
                      </div>
                      <span className="studio-id-pill">{version.id}</span>
                    </div>

                    <p className="version-row-meta">
                      {version.sourceKind} · {formatDate(version.createdAt)}
                    </p>
                    {version.sourceSlideId && version.sourceSlideId !== slide.slideId ? (
                      <p className="version-row-meta">
                        Legacy source: public Slide {version.sourceDisplayNumber} ·{" "}
                        {version.sourceSlideId}
                      </p>
                    ) : null}

                    <div className="version-row-footer">
                      <FileChip
                        projectId={DESIGNER_STUDIO_PROJECT_ID}
                        refLike={version.dir}
                        label="Version Dir"
                      />
                      {version.html ? (
                        <FileChip
                          projectId={DESIGNER_STUDIO_PROJECT_ID}
                          refLike={version.html}
                          label="HTML"
                        />
                      ) : null}
                      {version.sourceHtml ? (
                        <FileChip
                          projectId={DESIGNER_STUDIO_PROJECT_ID}
                          refLike={version.sourceHtml}
                          label="Source HTML"
                        />
                      ) : null}
                      {version.sharedCss ? (
                        <FileChip
                          projectId={DESIGNER_STUDIO_PROJECT_ID}
                          refLike={version.sharedCss}
                          label="Shared CSS"
                        />
                      ) : null}
                      {version.svg ? (
                        <FileChip
                          projectId={DESIGNER_STUDIO_PROJECT_ID}
                          refLike={version.svg}
                          label="SVG"
                        />
                      ) : null}
                      {version.html && version.mode !== "shared-css" ? (
                        <NormalizeVersionButton
                          projectId={DESIGNER_STUDIO_PROJECT_ID}
                          slideId={slide.slideId}
                          versionId={version.id}
                        />
                      ) : null}
                      {version.promotable ? (
                        <PromoteVersionButton
                          projectId={DESIGNER_STUDIO_PROJECT_ID}
                          slideId={slide.slideId}
                          versionId={version.id}
                        />
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="studio-empty-preview studio-empty-preview-placeholder">
              <div className="studio-empty-preview-copy">
                <span className="studio-empty-preview-kicker">No versions yet</span>
                <strong>This slide does not have stamped versions on disk yet.</strong>
                <p>The spec and asset manifests can still be reviewed here before the first render lands.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </DesignerStudioShell>
  );
}
