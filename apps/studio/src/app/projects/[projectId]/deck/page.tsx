import Link from "next/link";

import { FileChip } from "@/components/studio/file-chip";
import { ProjectShell } from "@/components/studio/project-shell";
import { PromoteButton } from "@/components/studio/promote-button";
import { StatusPill } from "@/components/studio/status-pill";
import { StudioPreviewLightbox } from "@/components/studio/studio-preview-lightbox";
import {
  matchesSearchQuery,
  matchesStudioFocus,
  parseQuery,
  parseStudioFocus,
} from "@/lib/presentation/filters";
import type {
  CanonicalVariantRef,
  PromotionCandidate,
  RefLike,
  SlideManifest,
} from "@/lib/presentation/studio-types";
import {
  getProjectManifestById,
  getVisibleProjectManifests,
  groupPrimaryProjectDocs,
  toVisibleProjectOptions,
} from "@/lib/server/studio-data";

export const dynamic = "force-dynamic";

const asCandidateFiles = (
  files: Array<{
    ref?: RefLike | null;
  }> = []
) => files.map((entry) => entry.ref).filter((entry): entry is RefLike => Boolean(entry?.path));

type DeckCandidate = {
  key: string;
  label: string;
  summary?: string | null;
  preview?: RefLike | null;
  files: RefLike[];
  source: "canonical-variant" | "discovered-branch";
  candidateId: string;
  selected: boolean;
  tone: "accent" | "warning" | "muted";
  badge: string;
};

const buildDeckCandidates = (slide: SlideManifest): DeckCandidate[] => {
  const selectedVariantId = slide.canonical.selectedVariantId ?? null;
  const canonicalPreviewPaths = new Set(
    slide.canonical.variants
      .map((variant: CanonicalVariantRef) => variant.preview?.path ?? null)
      .filter((path): path is string => Boolean(path))
  );
  const canonical = slide.canonical.variants.map((variant: CanonicalVariantRef) => ({
    key: `canonical:${variant.id ?? variant.label ?? "variant"}`,
    label: variant.label ?? variant.id ?? "Canonical variant",
    summary: variant.summary,
    preview: variant.preview,
    files: asCandidateFiles(variant.files),
    source: "canonical-variant" as const,
    candidateId: variant.id ?? "",
    selected: variant.id === selectedVariantId,
    tone: variant.id === selectedVariantId ? ("accent" as const) : ("muted" as const),
    badge: variant.id === selectedVariantId ? "Selected" : "Canonical",
  }));

  const discovered = slide.promotionCandidates
    .filter((candidate: PromotionCandidate) => candidate.source === "discovered-branch")
    .filter((candidate: PromotionCandidate) => {
      const label = String(candidate.label ?? "").trim().toLowerCase();
      const candidateId = String(candidate.id ?? "").trim().toLowerCase();
      if (label === "versions" || candidateId.endsWith("/versions")) {
        return false;
      }
      const previewPath = candidate.preview?.path ?? null;
      return !previewPath || !canonicalPreviewPaths.has(previewPath);
    })
    .map((candidate: PromotionCandidate) => ({
      key: `discovered:${candidate.id}`,
      label: candidate.label,
      summary: candidate.summary,
      preview: candidate.preview,
      files: asCandidateFiles(candidate.files),
      source: "discovered-branch" as const,
      candidateId: candidate.id,
      selected: candidate.derivedVariantId === selectedVariantId,
      tone:
        candidate.derivedVariantId === selectedVariantId
          ? ("accent" as const)
          : ("warning" as const),
      badge: candidate.derivedVariantId === selectedVariantId ? "Selected" : "Discovered",
    }));

  return [...canonical.filter((candidate) => candidate.candidateId), ...discovered];
};

function VariantTile({
  projectId,
  slideId,
  candidate,
  cacheKey,
}: {
  projectId: string;
  slideId: string;
  candidate: DeckCandidate;
  cacheKey: string;
}) {
  return (
    <article className={`deck-variant-tile${candidate.selected ? " deck-variant-tile-selected" : ""}`}>
      <div className="deck-variant-preview">
        {candidate.preview?.path ? (
          <StudioPreviewLightbox
            projectId={projectId}
            cacheKey={cacheKey}
            preview={candidate.preview}
            candidateFiles={candidate.files}
            previewWidth={420}
            alt={`${candidate.label} preview`}
            title={candidate.label}
            meta={slideId}
          />
        ) : (
          <div className="studio-empty-preview compact-empty">
            <div className="studio-empty-preview-copy">
              <span className="studio-empty-preview-kicker">No preview</span>
              <strong>{candidate.label}</strong>
            </div>
          </div>
        )}
      </div>

      <div className="deck-variant-copy">
        <div className="studio-chip-row">
          <StatusPill tone={candidate.tone}>{candidate.badge}</StatusPill>
        </div>
        <strong className="deck-variant-title">{candidate.label}</strong>
        <p className="micro-copy">{candidate.summary || "No summary yet."}</p>
        <div className="deck-variant-footer">
          <PromoteButton
            projectId={projectId}
            slideId={slideId}
            candidateSource={candidate.source}
            candidateId={candidate.candidateId}
            disabled={candidate.selected}
            label={candidate.selected ? "Selected" : "Make Official"}
          />
        </div>
      </div>
    </article>
  );
}

function DeckSlideCard({
  projectId,
  slide,
  cacheKey,
}: {
  projectId: string;
  slide: SlideManifest;
  cacheKey: string;
}) {
  const selectedVariantId = slide.canonical.selectedVariantId ?? null;
  const selectedVariant =
    slide.canonical.variants.find((variant) => variant.id === selectedVariantId) ?? null;
  const selectedFiles = selectedVariant ? asCandidateFiles(selectedVariant.files) : [];
  const deckCandidates = buildDeckCandidates(slide);
  const preferredPreview =
    slide.previews.selected ??
    slide.previews.stampedNative ??
    slide.previews.bestDiscovered ??
    null;
  const hasPreview = Boolean(preferredPreview?.path);

  return (
    <article
      className={`deck-slide-card${hasPreview ? "" : " deck-slide-card-pending"}`}
      id={slide.id}
    >
      <div className="deck-slide-card-head">
        <div>
          <div className="slide-wall-identity">
            <span className="studio-step-label">Slide {slide.displayNumber}</span>
            <span className="studio-id-pill studio-id-pill-muted">{slide.id}</span>
          </div>
          <h3>{slide.title}</h3>
        </div>
        <div className="studio-chip-row">
          <StatusPill tone={hasPreview ? "accent" : "muted"}>
            {hasPreview ? "Mockup ready" : "Visual pending"}
          </StatusPill>
          <StatusPill tone={slide.derived.warnings.length > 0 ? "warning" : "muted"}>
            {slide.derived.warnings.length} Warnings
          </StatusPill>
        </div>
      </div>

      <div className="deck-slide-card-content">
        <div className="deck-slide-card-copy">
          <p className="studio-body-copy">
            {slide.selectedDirection || slide.buildStatus || "No selected direction yet."}
          </p>

          <div className="studio-chip-row">
            {selectedVariantId ? (
              <StatusPill tone="accent">
                Selected: {selectedVariant?.label ?? selectedVariantId}
              </StatusPill>
            ) : (
              <StatusPill tone="muted">No selected variant</StatusPill>
            )}
            <StatusPill tone="muted">{deckCandidates.length} Variant entries</StatusPill>
            <StatusPill tone="muted">{slide.canonical.slideAssets.length} Slide assets</StatusPill>
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

          <div className="deck-slide-card-meta">
            <div className="studio-chip-row">
              {slide.canonical.packet ? (
                <FileChip projectId={projectId} refLike={slide.canonical.packet} label="Packet" />
              ) : null}
              {selectedFiles.slice(0, 2).map((ref) => (
                <FileChip key={ref.path} projectId={projectId} refLike={ref} />
              ))}
            </div>

            <div className="deck-slide-actions">
              <Link href={`/projects/${projectId}/slides/${slide.id}`} className="primary-link">
                Open Workbench
              </Link>
              <Link href={`/projects/${projectId}/slides/${slide.id}`} className="ghost-button">
                Edit Slide
              </Link>
            </div>
          </div>
        </div>

        <div className="deck-slide-card-visuals">
          <div className="deck-slide-preview">
            {preferredPreview?.path ? (
              <StudioPreviewLightbox
                projectId={projectId}
                cacheKey={cacheKey}
                preview={preferredPreview}
                candidateFiles={selectedFiles}
                previewWidth={720}
                alt={`${slide.title} selected mockup`}
                title={slide.title}
                meta={`Slide ${slide.displayNumber}`}
              />
            ) : (
              <div className="studio-empty-preview studio-empty-preview-placeholder">
                <div className="studio-empty-preview-copy">
                  <span className="studio-empty-preview-kicker">Slide {slide.displayNumber}</span>
                  <strong>{slide.title}</strong>
                  <p>{slide.buildStatus || "No visual selected yet"}</p>
                </div>
              </div>
            )}
          </div>

          <div className="deck-variant-strip">
            {deckCandidates.length > 0 ? (
              deckCandidates.map((candidate) => (
                <VariantTile
                  key={candidate.key}
                  projectId={projectId}
                  slideId={slide.id}
                  cacheKey={cacheKey}
                  candidate={candidate}
                />
              ))
            ) : (
              <div className="empty-block deck-card-empty">
                {hasPreview
                  ? "A draft preview exists, but no canonical variant has been promoted yet. Open the slide workbench to review or make it official."
                  : "This slide does not have saved mockups yet. Start in the slide workbench, generate a version, and it will appear here."}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export default async function ProjectDeckPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{
    q?: string | string[];
    focus?: string | string[];
  }>;
}) {
  const { projectId } = await params;
  const resolvedSearchParams = await searchParams;
  const [project, manifests] = await Promise.all([
    getProjectManifestById(projectId),
    getVisibleProjectManifests(),
  ]);
  const projects = toVisibleProjectOptions(manifests);
  const primaryDocs = groupPrimaryProjectDocs(project).slice(0, 6);
  const activeSlides = project.slides.filter((slide) => slide.status === "active");
  const query = parseQuery(resolvedSearchParams.q);
  const focus = parseStudioFocus(resolvedSearchParams.focus);
  const filteredSlides = activeSlides.filter(
    (slide) => matchesSearchQuery(slide.searchText, query) && matchesStudioFocus(slide, focus)
  );
  const previewCacheKey = `${project.generatedAt}:${project.sourceFingerprint.deckSpecMtimeMs}`;
  const readySlides = activeSlides.filter(
    (slide) =>
      slide.previews.selected?.exists ||
      slide.previews.stampedNative?.exists ||
      slide.previews.bestDiscovered?.exists
  ).length;
  const pendingSlides = activeSlides.length - readySlides;
  const promotionEntryCount = activeSlides.reduce(
    (sum, slide) => sum + buildDeckCandidates(slide).length,
    0
  );

  return (
    <ProjectShell project={project} projects={projects}>
      <div className="studio-canvas">
        <section className="studio-intro deck-workbench-hero">
          <div>
            <p className="eyebrow">Master Deck</p>
            <h2>{project.title}</h2>
            <p className="studio-body-copy">
              Preview the whole talk as a working deck, inspect generated mockups slide-by-slide,
              and open any slide to edit its spec or promote a different variant.
            </p>
            <div className="studio-chip-row">
              <StatusPill tone="accent">{filteredSlides.length} Showing</StatusPill>
              <StatusPill tone="muted">Focus: {focus.replace(/-/g, " ")}</StatusPill>
              {query ? <StatusPill tone="warning">Search: {query}</StatusPill> : null}
            </div>
          </div>
          <div className="studio-intro-stats">
            <div>
              <span className="studio-hero-metric">{activeSlides.length}</span>
              <span className="studio-hero-label">Slides</span>
            </div>
            <div>
              <span className="studio-hero-metric">{readySlides}</span>
              <span className="studio-hero-label">With mockups</span>
            </div>
            <div>
              <span className="studio-hero-metric">{pendingSlides}</span>
              <span className="studio-hero-label">Pending visuals</span>
            </div>
            <div>
              <span className="studio-hero-metric">
                {promotionEntryCount}
              </span>
              <span className="studio-hero-label">Promotion entries</span>
            </div>
          </div>
        </section>

        <section className="asset-section">
          <div className="asset-group">
            <div className="asset-group-head">
              <div>
                <p className="eyebrow">Workspace Files</p>
                <h3>Key docs for the deck and slide generation workflow</h3>
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

        {filteredSlides.length > 0 ? (
          <section className="deck-board-grid">
            {filteredSlides.map((slide) => (
              <DeckSlideCard
                key={slide.id}
                projectId={project.projectId}
                slide={slide}
                cacheKey={previewCacheKey}
              />
            ))}
          </section>
        ) : (
          <section className="archive-section">
            <div className="empty-block deck-board-empty">
              No slides match the current search or focus filter. Clear the filter or switch the
              focus menu in the top bar.
            </div>
          </section>
        )}
      </div>
    </ProjectShell>
  );
}
