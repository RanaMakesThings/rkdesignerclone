import type { RefLike } from "@/lib/presentation/studio-types";
import {
  studioFileHref,
  studioHtmlHref,
  studioThumbHref,
} from "@/lib/presentation/links";

import { LightboxImage, type LightboxImageProps } from "./lightbox-image";

type CandidateRef = (RefLike & { kind?: string | null }) | null | undefined;

type CandidateFileEntry =
  | CandidateRef
  | {
      ref?: CandidateRef;
    };

const inferRefKind = (ref: CandidateRef) => {
  const explicitKind = String(ref?.kind ?? "").trim().toLowerCase();
  if (explicitKind) {
    return explicitKind;
  }

  const lowerPath = String(ref?.path ?? "").trim().toLowerCase();
  if (lowerPath.endsWith(".html")) {
    return "html";
  }
  if (lowerPath.endsWith(".svg")) {
    return "svg";
  }
  if (
    lowerPath.endsWith(".png") ||
    lowerPath.endsWith(".jpg") ||
    lowerPath.endsWith(".jpeg") ||
    lowerPath.endsWith(".webp") ||
    lowerPath.endsWith(".gif")
  ) {
    return "image";
  }
  return "other";
};

const toCandidateRef = (entry: CandidateFileEntry): CandidateRef => {
  if (!entry) {
    return null;
  }
  if ("path" in entry) {
    return entry;
  }
  return entry.ref ?? null;
};

const pickFirstByKind = (candidates: CandidateRef[], kind: string) =>
  candidates.find((candidate) => candidate?.path && inferRefKind(candidate) === kind) ?? null;

type StudioPreviewLightboxProps = Omit<
  LightboxImageProps,
  "src" | "previewSrc" | "modalType"
> & {
  projectId: string;
  cacheKey?: string | number | null;
  preview?: CandidateRef;
  html?: CandidateRef;
  svg?: CandidateRef;
  candidateFiles?: CandidateFileEntry[];
  previewWidth?: number;
};

export function StudioPreviewLightbox({
  projectId,
  cacheKey = null,
  preview = null,
  html = null,
  svg = null,
  candidateFiles = [],
  previewWidth = 840,
  ...lightboxProps
}: StudioPreviewLightboxProps) {
  const candidateRefs = [html, svg, ...candidateFiles.map(toCandidateRef)].filter(
    (candidate): candidate is NonNullable<CandidateRef> => Boolean(candidate?.path)
  );
  const htmlRef = html?.path ? html : pickFirstByKind(candidateRefs, "html");
  const svgRef = svg?.path ? svg : pickFirstByKind(candidateRefs, "svg");
  const imageRef =
    preview?.path
      ? preview
      : pickFirstByKind(candidateRefs, "image") ?? svgRef ?? null;

  if (!imageRef?.path) {
    return null;
  }

  const modalTarget = htmlRef?.path
    ? {
        src: studioHtmlHref(projectId, htmlRef.path, cacheKey),
        modalType: "iframe" as const,
      }
    : svgRef?.path
      ? {
        src: studioFileHref(projectId, svgRef.path, cacheKey),
          modalType: "image" as const,
        }
      : {
          src: studioFileHref(projectId, imageRef.path, cacheKey),
          modalType: "image" as const,
        };

  return (
    <LightboxImage
      src={modalTarget.src}
      modalType={modalTarget.modalType}
      previewSrc={studioThumbHref(projectId, imageRef.path, previewWidth, cacheKey)}
      {...lightboxProps}
    />
  );
}
