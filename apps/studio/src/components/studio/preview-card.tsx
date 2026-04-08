import type { RefLike } from "@/lib/presentation/studio-types";

import { FileChip } from "./file-chip";
import { StatusPill } from "./status-pill";
import { StudioPreviewLightbox } from "./studio-preview-lightbox";

export function PreviewCard({
  projectId,
  title,
  description,
  preview,
  tone = "muted",
  files = [],
}: {
  projectId: string;
  title: string;
  description: string;
  preview?: RefLike | null;
  tone?: "muted" | "accent" | "warning";
  files?: Array<{ label: string; refLike?: RefLike | null }>;
}) {
  return (
    <article className={`preview-card preview-card-${tone}`}>
      <div className="preview-card-head">
        <div>
          <p className="eyebrow">{title}</p>
          <p className="preview-copy">{description}</p>
        </div>
        <StatusPill tone={tone === "accent" ? "accent" : tone === "warning" ? "warning" : "muted"}>
          {preview?.exists ? "Preview Ready" : "No Preview"}
        </StatusPill>
      </div>
      <div className="preview-frame">
        {preview?.path && preview.exists ? (
          <StudioPreviewLightbox
            projectId={projectId}
            preview={preview}
            candidateFiles={files.map((entry) => entry.refLike)}
            previewWidth={720}
            alt={title}
          />
        ) : (
          <div className="empty-preview">
            <span>No image is available on disk for this surface.</span>
          </div>
        )}
      </div>
      {files.length > 0 ? (
        <div className="chip-row">
          {files.map((entry) => (
            <FileChip
              key={`${entry.label}-${entry.refLike?.path ?? "missing"}`}
              projectId={projectId}
              refLike={entry.refLike}
              label={entry.label}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}
