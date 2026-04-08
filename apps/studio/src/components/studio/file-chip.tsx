import type { RefLike } from "@/lib/presentation/studio-types";
import { studioFileHref, studioHtmlHref } from "@/lib/presentation/links";

export function FileChip({
  projectId,
  refLike,
  label,
}: {
  projectId: string;
  refLike?: RefLike | null;
  label?: string;
}) {
  if (!refLike?.path) {
    return null;
  }

  const looksLikeFile = /\/[^/]+\.[^/]+$/i.test(refLike.path);
  if (!looksLikeFile) {
    return (
      <span className="studio-chip" title={refLike.path}>
        <span>{label ?? refLike.label ?? refLike.path.split("/").at(-1)}</span>
      </span>
    );
  }

  const isHtml = refLike.path.endsWith(".html");
  const href = isHtml
    ? studioHtmlHref(projectId, refLike.path)
    : studioFileHref(projectId, refLike.path);

  return (
    <a
      className="studio-chip"
      href={href}
      target="_blank"
      rel="noreferrer"
      title={refLike.path}
    >
      <span>{label ?? refLike.label ?? refLike.path.split("/").at(-1)}</span>
    </a>
  );
}
