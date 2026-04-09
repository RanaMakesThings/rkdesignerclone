"use client";

import { useRouter, useSearchParams } from "next/navigation";

import type { SlideManifest } from "@/lib/presentation/studio-types";

export function SlideJump({
  projectId,
  slides,
}: {
  projectId: string;
  slides: SlideManifest[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <label className="jump-shell">
      <span className="jump-label">Jump to Slide</span>
      <select
        className="jump-select"
        defaultValue=""
        onChange={(event) => {
          if (!event.target.value) {
            return;
          }
          const query = searchParams.toString();
          const href = `/projects/${projectId}/slides/${event.target.value}`;
          router.push(`${href}${query ? `?${query}` : ""}`);
        }}
      >
        <option value="">Select</option>
        {slides.map((slide) => (
          <option key={slide.id} value={slide.id}>
            {slide.displayNumber} - {slide.title}
          </option>
        ))}
      </select>
    </label>
  );
}
