import Link from "next/link";

import type { StudioDeckManifest } from "@/lib/presentation/designer-studio-types";
import { studioSlideHref } from "@/lib/presentation/links";
import { RefreshButton } from "./refresh-button";
import styles from "./designer-studio-shell.module.css";

function SlideRailItem({
  slide,
  active,
}: {
  slide: StudioDeckManifest["activeSlides"][number];
  active: boolean;
}) {
  const meta = slide.reviewable
    ? (slide.currentVersion?.label ?? slide.currentVersionId ?? null)
    : (slide.unavailableReason ?? "Spec only");

  return (
    <Link
      href={studioSlideHref(slide.displayNumber, slide.slideId)}
      className={`studio-rail-item${active ? " studio-rail-item-active" : ""}${slide.reviewable ? "" : " studio-rail-item-muted"}`}
    >
      <div className="studio-rail-item-head">
        <span className="studio-rail-number">{slide.displayNumber}</span>
        <span className="studio-rail-title">{slide.title}</span>
      </div>
      {meta ? <span className="studio-rail-meta">{meta}</span> : null}
    </Link>
  );
}

export function DesignerStudioShell({
  deck,
  activeSlideId,
  activeSection = "home",
  children,
}: {
  deck: StudioDeckManifest;
  activeSlideId?: string;
  activeSection?: "home" | "graphics" | "templates" | "html" | "design-system" | "styles";
  children: React.ReactNode;
}) {
  return (
    <div className="studio-shell page-enter">
      <aside className={`studio-rail ${styles.rail}`}>
        <div className={`studio-rail-top ${styles.railTop}`}>
          <p className="eyebrow">Designer Studio</p>
          <h1>{deck.title}</h1>
        </div>

        <div className="studio-rail-actions">
          <Link
            href="/"
            className={`studio-home-link${!activeSlideId && activeSection === "home" ? " studio-home-link-active" : ""}`}
          >
            Home
          </Link>
          <Link
            href="/graphics"
            className={`studio-home-link${activeSection === "graphics" ? " studio-home-link-active" : ""}`}
          >
            Graphics
          </Link>
          <Link
            href="/html"
            className={`studio-home-link${activeSection === "html" ? " studio-home-link-active" : ""}`}
          >
            HTML Lab
          </Link>
          <Link
            href="/design-system"
            className={`studio-home-link${activeSection === "design-system" || activeSection === "styles" ? " studio-home-link-active" : ""}`}
          >
            Design System
          </Link>
          <Link
            href="/templates"
            className={`studio-home-link${activeSection === "templates" ? " studio-home-link-active" : ""}`}
          >
            Templates
          </Link>
          <RefreshButton />
        </div>

        <div className={`studio-rail-list ${styles.railList}`}>
          {deck.activeSlides.map((slide) => (
            <SlideRailItem
              key={slide.slideId}
              slide={slide}
              active={activeSlideId === slide.slideId}
            />
          ))}
        </div>
      </aside>

      <main className="studio-main">{children}</main>
    </div>
  );
}
