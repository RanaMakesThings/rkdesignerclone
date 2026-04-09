import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { FileChip } from "@/components/studio/file-chip";
import { ProjectShell } from "@/components/studio/project-shell";
import { PromoteButton } from "@/components/studio/promote-button";
import { SlideReferencesPanel } from "@/components/studio/slide-references-panel";
import { SlideSpecPanel } from "@/components/studio/slide-spec-panel";
import { StudioPreviewLightbox } from "@/components/studio/studio-preview-lightbox";
import type {
  StudioReference,
  StudioReferenceUsage,
} from "@/lib/presentation/designer-studio-types";
import type {
  CanonicalVariantRef,
  PromotionCandidate,
  RefLike,
} from "@/lib/presentation/studio-types";
import {
  getVisibleProjectManifests,
  getSlideManifestById,
  groupSlideDocs,
  toVisibleProjectOptions,
} from "@/lib/server/studio-data";

export const dynamic = "force-dynamic";

const asCandidateFiles = (
  files: Array<{
    ref?: RefLike | null;
  }> = []
) => files.map((entry) => entry.ref).filter((entry): entry is RefLike => Boolean(entry?.path));

function CandidateArchiveRow({
  projectId,
  slideId,
  label,
  summary,
  preview,
  candidateFiles = [],
  cacheKey,
  current = false,
  metadata = null,
  footer = null,
}: {
  projectId: string;
  slideId: string;
  label: string;
  summary?: string | null;
  preview?: RefLike | null;
  candidateFiles?: RefLike[];
  cacheKey: string;
  current?: boolean;
  metadata?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <article className={`version-row${current ? " version-row-current" : ""}`}>
      <div className="version-row-preview">
        {preview?.path ? (
          <StudioPreviewLightbox
            projectId={projectId}
            cacheKey={cacheKey}
            preview={preview}
            candidateFiles={candidateFiles}
            previewWidth={840}
            alt={`${label} preview`}
            title={label}
            meta={slideId}
          />
        ) : (
          <div className="studio-empty-preview">No preview</div>
        )}
      </div>

      <div className="version-row-copy">
        <div className="version-row-head">
          <div>
            <p className="eyebrow">{current ? "Selected" : "Candidate"}</p>
            <h3>{label}</h3>
          </div>
        </div>

        <p className="version-row-meta">{summary || "No summary yet."}</p>
        {metadata}

        <div className="version-row-footer">
          {footer}
          {candidateFiles.map((ref) => (
            <FileChip key={ref.path} projectId={projectId} refLike={ref} />
          ))}
        </div>
      </div>
    </article>
  );
}

function CanonicalVariantRow({
  projectId,
  slideId,
  variant,
  selectedVariantId,
  cacheKey,
}: {
  projectId: string;
  slideId: string;
  variant: CanonicalVariantRef;
  selectedVariantId?: string | null;
  cacheKey: string;
}) {
  const candidateFiles = asCandidateFiles(variant.files);
  const isSelected = variant.id === selectedVariantId;

  return (
    <CandidateArchiveRow
      projectId={projectId}
      slideId={slideId}
      label={variant.label ?? variant.id ?? "Canonical variant"}
      summary={variant.summary}
      preview={variant.preview}
      candidateFiles={candidateFiles}
      cacheKey={cacheKey}
      current={isSelected}
      metadata={
        <p className="version-row-meta">
          Canonical variant{variant.status ? ` · ${variant.status}` : ""}
        </p>
      }
      footer={
        variant.id ? (
          <PromoteButton
            projectId={projectId}
            slideId={slideId}
            candidateSource="canonical-variant"
            candidateId={variant.id}
            disabled={isSelected}
            label={isSelected ? "Selected" : "Make Official"}
          />
        ) : null
      }
    />
  );
}

function PromotionCandidateRow({
  projectId,
  slideId,
  candidate,
  selectedVariantId,
  cacheKey,
}: {
  projectId: string;
  slideId: string;
  candidate: PromotionCandidate;
  selectedVariantId?: string | null;
  cacheKey: string;
}) {
  const candidateFiles = asCandidateFiles(candidate.files);
  const isSelected = candidate.derivedVariantId === selectedVariantId;

  return (
    <CandidateArchiveRow
      projectId={projectId}
      slideId={slideId}
      label={candidate.label}
      summary={candidate.summary}
      preview={candidate.preview}
      candidateFiles={candidateFiles}
      cacheKey={cacheKey}
      current={isSelected}
      metadata={
        <p className="version-row-meta">
          {candidate.source === "discovered-branch" ? "Discovered branch" : "Canonical variant"}
          {candidate.bucket ? ` · ${candidate.bucket}` : ""}
        </p>
      }
      footer={
        <PromoteButton
          projectId={projectId}
          slideId={slideId}
          candidateSource={candidate.source}
          candidateId={candidate.id}
          disabled={isSelected}
          label={isSelected ? "Selected" : "Make Official"}
        />
      }
    />
  );
}

export default async function ProjectSlidePage({
  params,
}: {
  params: Promise<{ projectId: string; slideId: string }>;
}) {
  const { projectId, slideId } = await params;

  const [{ project, slide }, manifests] = await Promise.all([
    getSlideManifestById(projectId, slideId),
    getVisibleProjectManifests(),
  ]);
  const projects = toVisibleProjectOptions(manifests);
  const slideDocs = groupSlideDocs(projectId, slide);
  const previewCacheKey = `${project.generatedAt}:${project.sourceFingerprint.deckSpecMtimeMs}`;

  const selectedVariantId = slide.canonical.selectedVariantId ?? null;
  const selectedVariant =
    slide.canonical.variants.find((variant) => variant.id === selectedVariantId) ?? null;
  const canonicalCandidates = slide.canonical.variants;
  const discoveredCandidates = slide.promotionCandidates.filter(
    (candidate) => candidate.source === "discovered-branch"
  );
  const referencePanelData = slide.references as unknown as {
    proofCitationKeys: string[];
    missingCitationKeys: string[];
    current: StudioReferenceUsage[];
    archived: StudioReferenceUsage[];
  };
  const referenceLibrary = project.references.library as unknown as StudioReference[];

  return (
    <ProjectShell project={project} projects={projects}>
      <div className="studio-canvas">
        <section className="slide-detail-hero">
          <div className="slide-detail-copy">
            <div className="slide-detail-topbar">
              <div className="slide-wall-identity">
                <span className="studio-step-label">Slide {slide.displayNumber}</span>
                {selectedVariantId ? (
                  <span className="studio-id-pill studio-id-pill-accent">{selectedVariantId}</span>
                ) : (
                  <span className="studio-id-pill studio-id-pill-muted">No official variant</span>
                )}
              </div>
            </div>
            <h2>{slide.title}</h2>
            <p className="studio-body-copy">
              {slide.selectedDirection || slide.buildStatus || "No selected direction yet."}
            </p>

            <div className="slide-facts-grid">
              <div className="slide-fact">
                <span className="slide-fact-label">Status</span>
                <strong>{slide.buildStatus ?? "pending"}</strong>
              </div>
              <div className="slide-fact">
                <span className="slide-fact-label">Selected</span>
                <strong>{selectedVariant?.label ?? selectedVariantId ?? "None"}</strong>
              </div>
              <div className="slide-fact">
                <span className="slide-fact-label">Variants</span>
                <strong>{canonicalCandidates.length}</strong>
              </div>
              <div className="slide-fact">
                <span className="slide-fact-label">Candidates</span>
                <strong>{slide.promotionCandidates.length}</strong>
              </div>
              <div className="slide-fact">
                <span className="slide-fact-label">Warnings</span>
                <strong>{slide.derived.warnings.length}</strong>
              </div>
            </div>

            <div className="studio-chip-row">
              {slide.canonical.packet ? (
                <FileChip projectId={project.projectId} refLike={slide.canonical.packet} label="Packet" />
              ) : null}
              {slide.canonical.assetsManifest ? (
                <FileChip
                  projectId={project.projectId}
                  refLike={slide.canonical.assetsManifest}
                  label="Slide Assets"
                />
              ) : null}
              {slide.canonical.deckAssetsManifest ? (
                <FileChip
                  projectId={project.projectId}
                  refLike={slide.canonical.deckAssetsManifest}
                  label="Deck Assets"
                />
              ) : null}
            </div>
          </div>

          <div className="slide-detail-visual">
            {slide.previews.selected?.path ? (
              <StudioPreviewLightbox
                projectId={project.projectId}
                cacheKey={previewCacheKey}
                preview={slide.previews.selected}
                candidateFiles={selectedVariant ? asCandidateFiles(selectedVariant.files) : []}
                previewLoading="eager"
                alt={`${slide.title} selected mockup`}
                title={slide.title}
                meta={`Slide ${slide.displayNumber} · ${selectedVariantId ?? "official preview"}`}
              />
            ) : (
              <div className="studio-empty-preview studio-empty-preview-placeholder">
                <div className="studio-empty-preview-copy">
                  <span className="studio-empty-preview-kicker">Slide {slide.displayNumber}</span>
                  <strong>{slide.title}</strong>
                  <p>No selected preview yet</p>
                </div>
              </div>
            )}
          </div>
        </section>

        <SlideSpecPanel
          projectId={project.projectId}
          slideId={slide.id}
          slideTitle={slide.title}
          specText={slide.specText ?? ""}
        />

        <SlideReferencesPanel
          projectId={project.projectId}
          slideId={slide.id}
          references={referencePanelData}
          library={referenceLibrary}
        />

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

        <section className="archive-section">
          <div className="archive-head">
            <div>
              <p className="eyebrow">Variant Archive</p>
              <h3>{canonicalCandidates.length} canonical variants</h3>
            </div>
          </div>

          {canonicalCandidates.length > 0 ? (
            <div className="version-list">
              {canonicalCandidates.map((variant) => (
                <CanonicalVariantRow
                  key={variant.id ?? variant.label ?? "variant"}
                  projectId={project.projectId}
                  slideId={slide.id}
                  variant={variant}
                  selectedVariantId={selectedVariantId}
                  cacheKey={previewCacheKey}
                />
              ))}
            </div>
          ) : (
            <div className="studio-empty-preview studio-empty-preview-placeholder">
              <div className="studio-empty-preview-copy">
                <span className="studio-empty-preview-kicker">No variants yet</span>
                <strong>This slide does not have any saved mockups on disk yet.</strong>
                <p>Once a preview lands, this page will show the mockup, files, and promotion actions here.</p>
              </div>
            </div>
          )}
        </section>

        {discoveredCandidates.length > 0 ? (
          <section className="archive-section">
            <div className="archive-head">
              <div>
                <p className="eyebrow">Discovered Work</p>
                <h3>{discoveredCandidates.length} additional promotion candidates</h3>
              </div>
            </div>

            <div className="version-list">
              {discoveredCandidates.map((candidate) => (
                <PromotionCandidateRow
                  key={`${candidate.source}:${candidate.id}`}
                  projectId={project.projectId}
                  slideId={slide.id}
                  candidate={candidate}
                  selectedVariantId={selectedVariantId}
                  cacheKey={previewCacheKey}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </ProjectShell>
  );
}
