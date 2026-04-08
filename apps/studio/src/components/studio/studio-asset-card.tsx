import styles from "./studio-asset-card.module.css";
import { FileChip } from "@/components/studio/file-chip";
import { StatusPill } from "@/components/studio/status-pill";
import { StudioPreviewLightbox } from "@/components/studio/studio-preview-lightbox";
import type { StudioCanonicalAsset } from "@/lib/presentation/designer-studio-types";

const toneByStatus = (
  status: string | null
): "muted" | "accent" | "warning" | "danger" => {
  const normalized = String(status ?? "").toLowerCase();
  if (normalized === "selected" || normalized === "approved") {
    return "accent";
  }
  if (normalized === "reference" || normalized === "candidate") {
    return "warning";
  }
  if (normalized === "rejected" || normalized === "deprecated") {
    return "danger";
  }
  return "muted";
};

export function StudioAssetCard({
  projectId,
  asset,
}: {
  projectId: string;
  asset: StudioCanonicalAsset;
}) {
  const allFiles = [...asset.files, ...asset.sourceFiles];

  return (
    <article className={`studio-asset-card ${styles.card}`}>
      <div className={`studio-asset-preview ${styles.preview}`}>
        {asset.preview?.path ? (
          <StudioPreviewLightbox
            projectId={projectId}
            preview={asset.preview}
            candidateFiles={allFiles}
            previewWidth={640}
            alt={asset.label}
            title={asset.label}
            meta={asset.role ?? asset.kind ?? "asset"}
          />
        ) : (
          <div className="studio-empty-preview">
            <div className="studio-empty-preview-copy">
              <span className="studio-empty-preview-kicker">No preview</span>
              <strong>{asset.label}</strong>
            </div>
          </div>
        )}
      </div>

      <div className="studio-asset-copy">
        <div className="studio-asset-head">
          <StatusPill tone={toneByStatus(asset.status)}>
            {asset.status ?? "asset"}
          </StatusPill>
          {asset.role ? <span className="studio-chip">{asset.role}</span> : null}
          {asset.kind ? <span className="studio-chip">{asset.kind}</span> : null}
        </div>

        <div className="studio-asset-body">
          <h3>{asset.label}</h3>
          {asset.summary ? <p className="studio-body-copy">{asset.summary}</p> : null}
        </div>

        {asset.tags.length > 0 ? (
          <div className="studio-chip-row">
            {asset.tags.map((tag) => (
              <span key={tag} className="studio-chip">
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {allFiles.length > 0 ? (
          <div className="studio-chip-row">
            {allFiles.map((file) => (
              <FileChip
                key={`${asset.id}-${file.ref?.path ?? file.label ?? "file"}`}
                projectId={projectId}
                refLike={file.ref}
                label={file.label ?? undefined}
              />
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
