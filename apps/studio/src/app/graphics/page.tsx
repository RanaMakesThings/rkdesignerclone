import Link from "next/link";

import { FileChip } from "@/components/studio/file-chip";
import { LightboxImage } from "@/components/studio/lightbox-image";
import { DesignerStudioShell } from "@/components/studio/designer-studio-shell";
import { StudioAssetCard } from "@/components/studio/studio-asset-card";
import { StudioPreviewLightbox } from "@/components/studio/studio-preview-lightbox";
import type { StudioGeneratedGraphic } from "@/lib/presentation/designer-studio-types";
import {
  getDesignerStudioDeck,
  getDesignerStudioGraphics,
  DESIGNER_STUDIO_PROJECT_ID,
} from "@/lib/server/designer-studio";
import {
  studioFileHref,
  studioSlideHref,
  studioThumbHref,
} from "@/lib/presentation/links";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const parseNumericId = (value: string | null | undefined, prefix: string) => {
  const match = String(value ?? "").match(new RegExp(`^${prefix}-(\\d+)$`, "i"));
  return match ? Number(match[1]) : 0;
};

const formatDate = (value: string | null) => {
  if (!value) {
    return "Unknown";
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? value : dateFormatter.format(parsed);
};

const buildGraphicModalDetails = (graphic: StudioGeneratedGraphic) => {
  const versionValue = graphic.variantLabel
    ? `${graphic.versionLabel} · ${graphic.variantLabel}`
    : graphic.versionLabel;

  return [
    {
      label: "Created",
      value: formatDate(graphic.batchGeneratedAt),
    },
    {
      label: "Version",
      value: versionValue,
    },
    {
      label: "Provider",
      value: graphic.providerLabel,
    },
    {
      label: "Batch",
      value: graphic.batchSlug,
    },
    {
      label: "IDs",
      value: `${graphic.versionId} · ${graphic.batchId}`,
    },
  ];
};

const buildGraphicModalActions = (graphic: StudioGeneratedGraphic) =>
  [
    graphic.batchManifest
      ? {
          label: "Batch Manifest",
          href: studioFileHref(DESIGNER_STUDIO_PROJECT_ID, graphic.batchManifest.path),
        }
      : null,
    graphic.prompt
      ? {
          label: "Prompt",
          href: studioFileHref(DESIGNER_STUDIO_PROJECT_ID, graphic.prompt.path),
        }
      : null,
  ].filter((action): action is { label: string; href: string } => Boolean(action));

export default async function GraphicsPage() {
  const [deck, generatedGraphics] = await Promise.all([
    getDesignerStudioDeck({ includeGeneratedGraphics: false }),
    getDesignerStudioGraphics(),
  ]);

  const versionEntries = deck.activeSlides
    .flatMap((slide) =>
      slide.versions
        .filter((version) => version.preview?.path)
        .map((version) => ({
          slide,
          version,
        }))
    )
    .sort((left, right) => {
      const versionDelta =
        parseNumericId(right.version.id, "version") - parseNumericId(left.version.id, "version");
      if (versionDelta !== 0) {
        return versionDelta;
      }
      const leftTime = left.version.createdAt ? Date.parse(left.version.createdAt) : 0;
      const rightTime = right.version.createdAt ? Date.parse(right.version.createdAt) : 0;
      return rightTime - leftTime;
    });

  const slideAssetEntries = deck.activeSlides
    .flatMap((slide) =>
      slide.slideAssets
        .filter((asset) => asset.preview?.path)
        .map((asset) => ({
          slide,
          asset,
        }))
    )
    .sort(
      (left, right) =>
        parseNumericId(right.asset.assetId, "asset") - parseNumericId(left.asset.assetId, "asset")
    );

  const deckAssetEntries = Array.from(
    deck.activeSlides.reduce((entries, slide) => {
      for (const asset of slide.deckAssets) {
        const dedupeKey = asset.assetId ?? asset.id;
        if (!entries.has(dedupeKey)) {
          entries.set(dedupeKey, asset);
        }
      }
      return entries;
    }, new Map<string, (typeof deck.activeSlides)[number]["deckAssets"][number]>()).values()
  ).sort(
    (left, right) =>
      parseNumericId(right.assetId, "asset") - parseNumericId(left.assetId, "asset")
  );

  return (
    <DesignerStudioShell deck={deck} activeSection="graphics">
      <div className="studio-canvas">
        <section className="studio-intro">
          <div>
            <p className="eyebrow">Graphics Archive</p>
            <h2>Every saved Designer figure in one place.</h2>
          </div>
          <div className="studio-intro-stats">
            <div>
              <span className="studio-hero-metric">{versionEntries.length}</span>
              <span className="studio-hero-label">Saved versions</span>
            </div>
            <div>
              <span className="studio-hero-metric">{generatedGraphics.length}</span>
              <span className="studio-hero-label">Generated graphics</span>
            </div>
            <div>
              <span className="studio-hero-metric">{slideAssetEntries.length + deckAssetEntries.length}</span>
              <span className="studio-hero-label">Curated assets</span>
            </div>
          </div>
        </section>

        <section className={styles.graphicsSection}>
          <div className="archive-head">
            <div>
              <p className="eyebrow">Generated Graphics</p>
              <h3>{generatedGraphics.length} raw presentation-image outputs</h3>
            </div>
          </div>

          {generatedGraphics.length > 0 ? (
            <div className={styles.graphicsCardGrid}>
              {generatedGraphics.map((graphic) => {
                const createdAt = formatDate(graphic.batchGeneratedAt);

                return (
                  <article
                    key={graphic.graphicId}
                    className={`${styles.graphicsCard} ${styles.graphicsGraphicCard}`}
                  >
                    <div className={styles.graphicsCardPreview}>
                      <LightboxImage
                        src={studioFileHref(
                          DESIGNER_STUDIO_PROJECT_ID,
                          graphic.preview?.path ?? ""
                        )}
                        previewSrc={
                          graphic.preview?.path
                            ? studioThumbHref(
                                DESIGNER_STUDIO_PROJECT_ID,
                                graphic.preview.path,
                                900
                              )
                            : undefined
                        }
                        alt={`${graphic.batchSlug} ${graphic.versionId}`}
                        title={graphic.graphicId}
                        meta="Graphic Generator"
                        description={graphic.summary ?? undefined}
                        details={buildGraphicModalDetails(graphic)}
                        actions={buildGraphicModalActions(graphic)}
                      />
                    </div>

                    <div className={styles.graphicsGraphicCardFooter}>
                      <div className={styles.graphicsGraphicCardMeta}>
                        <div>
                          <p className="eyebrow">Graphic</p>
                          <h3>{graphic.graphicId}</h3>
                        </div>
                        <div className={styles.graphicsGraphicCardCreated}>
                          <span className={styles.graphicsMetaLabel}>Created</span>
                          <strong>{createdAt}</strong>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="studio-empty-preview">
              <div className="studio-empty-preview-copy">
                <span className="studio-empty-preview-kicker">No generator outputs yet</span>
                <strong>Run the presentation-image batch to populate raw generated graphics.</strong>
              </div>
            </div>
          )}
        </section>

        <section className={styles.graphicsSection}>
          <div className="archive-head">
            <div>
              <p className="eyebrow">Version History</p>
              <h3>{versionEntries.length} previewable figure versions</h3>
            </div>
          </div>

          <div className={styles.graphicsCardGrid}>
            {versionEntries.map(({ slide, version }) => (
              <article
                key={`${slide.slideId}-${version.id}`}
                className={`${styles.graphicsCard}${version.isCurrent ? ` ${styles.graphicsCardCurrent}` : ""}`}
              >
                <div className={styles.graphicsCardPreview}>
                  <StudioPreviewLightbox
                    projectId={DESIGNER_STUDIO_PROJECT_ID}
                    preview={version.preview}
                    html={version.html}
                    svg={version.svg}
                    previewWidth={720}
                    alt={`${slide.title} ${version.id}`}
                    title={version.label}
                    meta={`Slide ${slide.displayNumber} · ${version.id}`}
                  />
                </div>

                <div className={styles.graphicsCardCopy}>
                  <div className={styles.graphicsCardHead}>
                    <div>
                      <p className="eyebrow">Slide {slide.displayNumber}</p>
                      <h3>{version.label}</h3>
                    </div>
                    <div className="studio-chip-row">
                      <span className="studio-id-pill">{version.id}</span>
                      {version.isCurrent ? (
                        <span className="studio-id-pill studio-id-pill-accent">Current</span>
                      ) : null}
                    </div>
                  </div>

                  <p className="studio-body-copy">{slide.title}</p>
                  <p className="studio-body-copy">
                    Repo slide: {slide.slideId}
                    {slide.stampedRootId ? ` · Stamped root: ${slide.stampedRootId}` : ""}
                    {version.sourceSlideId && version.sourceSlideId !== slide.slideId
                      ? ` · Legacy source: public Slide ${version.sourceDisplayNumber} (${version.sourceSlideId})`
                      : ""}
                  </p>

                  <div className="studio-link-row">
                    <Link
                      href={studioSlideHref(slide.displayNumber, slide.slideId)}
                      className="ghost-link"
                    >
                      Open Slide
                    </Link>
                    {version.html ? (
                      <FileChip
                        projectId={DESIGNER_STUDIO_PROJECT_ID}
                        refLike={version.html}
                        label="HTML"
                      />
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="asset-section">
          <div className="asset-group">
            <div className="asset-group-head">
              <div>
                <p className="eyebrow">Curated Slide Assets</p>
                <h3>{slideAssetEntries.length} reusable slide-local graphics</h3>
              </div>
            </div>
            {slideAssetEntries.length > 0 ? (
              <div className="asset-grid">
                {slideAssetEntries.map(({ slide, asset }) => (
                  <div key={`${slide.slideId}-${asset.id}`} className={styles.graphicsAssetStack}>
                    <div className={styles.graphicsAssetContext}>
                      <span className="studio-step-label">Slide {slide.displayNumber}</span>
                      <strong>{slide.title}</strong>
                    </div>
                    <StudioAssetCard
                      projectId={DESIGNER_STUDIO_PROJECT_ID}
                      asset={asset}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="studio-empty-preview">
                <div className="studio-empty-preview-copy">
                  <span className="studio-empty-preview-kicker">No slide assets yet</span>
                  <strong>Add canonical slide assets to keep references from getting lost.</strong>
                </div>
              </div>
            )}
          </div>

          <div className="asset-group">
            <div className="asset-group-head">
              <div>
                <p className="eyebrow">Shared Deck Assets</p>
                <h3>{deckAssetEntries.length} deck-level reusable graphics</h3>
              </div>
            </div>
            {deckAssetEntries.length > 0 ? (
              <div className="asset-grid">
                {deckAssetEntries.map((asset) => (
                  <StudioAssetCard
                    key={asset.assetId ?? asset.id}
                    projectId={DESIGNER_STUDIO_PROJECT_ID}
                    asset={asset}
                  />
                ))}
              </div>
            ) : (
              <div className="studio-empty-preview">
                <div className="studio-empty-preview-copy">
                  <span className="studio-empty-preview-kicker">No deck assets yet</span>
                  <strong>Shared brand and reusable deck assets will appear here.</strong>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </DesignerStudioShell>
  );
}
