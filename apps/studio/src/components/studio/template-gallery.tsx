import Link from "next/link";

import type { StudioDeckManifest } from "@/lib/presentation/designer-studio-types";

import { FileChip } from "./file-chip";
import { StudioPreviewLightbox } from "./studio-preview-lightbox";
import styles from "./template-gallery.module.css";

export function TemplateGallery({
  deck,
  projectId,
  title = "Locked deck shell and contract",
  description,
  ctaHref,
  ctaLabel,
}: {
  deck: StudioDeckManifest;
  projectId: string;
  title?: string;
  description: React.ReactNode;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  if (deck.templates.length === 0) {
    return null;
  }

  return (
    <section className={styles.templateSection}>
      <div className={styles.templateSectionHeader}>
        <div className={styles.templateHeaderCopy}>
          <div>
            <p className="eyebrow">Templates</p>
            <h2>{title}</h2>
          </div>
          {description ? <div className="studio-body-copy">{description}</div> : null}
          {ctaHref && ctaLabel ? (
            <div className={styles.templateHeaderActions}>
              <Link href={ctaHref} className="primary-link">
                {ctaLabel}
              </Link>
            </div>
          ) : null}
        </div>
        <div className={styles.templateHeaderChips}>
          <span className="studio-chip">
            <span>Locked templates</span>
            <strong>{deck.templates.length}</strong>
          </span>
        </div>
      </div>

      <div className={styles.templateList}>
        {deck.templates.map((template) => (
          <article key={template.id} className={`slide-wall-row ${styles.templateRow}`}>
            <div className={`slide-wall-copy ${styles.templateCopy}`}>
              <div className="slide-wall-identity">
                <span className="studio-id-pill">{template.id}</span>
                {template.status ? (
                  <span className="studio-id-pill studio-id-pill-accent">{template.status}</span>
                ) : null}
              </div>
              <h3>{template.summary ?? template.id}</h3>
              {template.summary ? (
                <p className="studio-body-copy">{template.summary}</p>
              ) : null}

              <div className="studio-link-row">
                {template.sourceBoard ? (
                  <a
                    href={template.sourceBoard}
                    target="_blank"
                    rel="noreferrer"
                    className="ghost-link"
                  >
                    Open FigJam
                  </a>
                ) : null}
                {template.contract ? (
                  <FileChip projectId={projectId} refLike={template.contract} label="Contract" />
                ) : null}
                {template.html ? (
                  <FileChip projectId={projectId} refLike={template.html} label="Template HTML" />
                ) : null}
                {template.readme ? (
                  <FileChip
                    projectId={projectId}
                    refLike={template.readme}
                    label="Template README"
                  />
                ) : null}
                {template.dir ? (
                  <FileChip projectId={projectId} refLike={template.dir} label="Template Dir" />
                ) : null}
              </div>

              {template.rules.length > 0 ? (
                <section className={`studio-spec-block ${styles.templateBlock}`}>
                  <p className="studio-spec-kicker">Locked Rules</p>
                  <ul className={styles.templateListItems}>
                    {template.rules.map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {template.notes.length > 0 ? (
                <section className={`studio-spec-block studio-spec-block-compact ${styles.templateBlock}`}>
                  <p className="studio-spec-kicker">Notes</p>
                  <ul className={styles.templateListItems}>
                    {template.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>

            <div className={`slide-wall-media ${styles.templateMedia}`}>
              {template.preview ? (
                <StudioPreviewLightbox
                  projectId={projectId}
                  preview={template.preview}
                  html={template.html}
                  previewWidth={840}
                  alt={`${template.id} preview`}
                  title={template.id}
                  meta={
                    template.themeId
                      ? `${template.themeId} · ${template.status ?? "status unknown"}`
                      : template.status ?? "Template preview"
                  }
                />
              ) : (
                <div className="studio-empty-preview studio-empty-preview-placeholder">
                  <div className="studio-empty-preview-copy">
                    <span className="studio-empty-preview-kicker">Template</span>
                    <strong>{template.id}</strong>
                    <p>No preview image is available on disk.</p>
                  </div>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
