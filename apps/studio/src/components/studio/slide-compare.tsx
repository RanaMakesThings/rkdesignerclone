"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { studioFileHref } from "@/lib/presentation/links";

type CompareVersion = {
  id: string;
  label: string;
  status: string;
  previewPath: string;
  isCurrent: boolean;
};

export function SlideCompare({
  projectId,
  slideId,
  slideTitle,
  versions,
}: {
  projectId: string;
  slideId: string;
  slideTitle: string;
  versions: CompareVersion[];
}) {
  const comparableVersions = versions.filter((version) => version.previewPath);
  const defaultLeftVersion =
    comparableVersions.find((version) => version.isCurrent) ?? comparableVersions[0];
  const defaultRightVersion =
    comparableVersions.find((version) => !version.isCurrent) ??
    comparableVersions[1] ??
    comparableVersions[0];

  const [open, setOpen] = useState(false);
  const [leftVersionId, setLeftVersionId] = useState(defaultLeftVersion.id);
  const [rightVersionId, setRightVersionId] = useState(defaultRightVersion.id);
  const portalTarget = typeof document !== "undefined" ? document.body : null;

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  const leftVersion =
    comparableVersions.find((version) => version.id === leftVersionId) ?? defaultLeftVersion;
  const rightVersion =
    comparableVersions.find((version) => version.id === rightVersionId) ?? defaultRightVersion;

  if (!defaultLeftVersion || !defaultRightVersion || comparableVersions.length < 2) {
    return null;
  }

  const compareLightbox =
    open && portalTarget
      ? createPortal(
          <div
            className="compare-lightbox-shell"
            role="dialog"
            aria-modal="true"
            aria-label={`${slideTitle} compare versions`}
            onClick={() => setOpen(false)}
          >
            <button
              type="button"
              className="lightbox-close compare-lightbox-close"
              onClick={() => setOpen(false)}
            >
              Close
            </button>

            <div
              className="compare-lightbox-frame"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="compare-lightbox-head">
                <div>
                  <p className="lightbox-meta">{slideId}</p>
                  <h3>{slideTitle}</h3>
                </div>
                <p className="compare-lightbox-note">
                  Side-by-side version review
                </p>
              </div>

              <div className="compare-toolbar">
                <div className="compare-picker">
                  <label htmlFor="compare-left-version">Left version</label>
                  <select
                    id="compare-left-version"
                    value={leftVersion.id}
                    onChange={(event) => setLeftVersionId(event.target.value)}
                  >
                    {comparableVersions.map((version) => (
                      <option key={version.id} value={version.id}>
                        {version.id} · {version.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="compare-picker">
                  <label htmlFor="compare-right-version">Right version</label>
                  <select
                    id="compare-right-version"
                    value={rightVersion.id}
                    onChange={(event) => setRightVersionId(event.target.value)}
                  >
                    {comparableVersions.map((version) => (
                      <option key={version.id} value={version.id}>
                        {version.id} · {version.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="compare-grid">
                {[leftVersion, rightVersion].map((version) => (
                  <section key={version.id} className="compare-panel">
                    <div className="compare-panel-head">
                      <div>
                        <p className="lightbox-meta">{version.id}</p>
                        <h3>{version.label}</h3>
                      </div>
                      <span className="studio-id-pill">{version.status}</span>
                    </div>

                    <div className="compare-panel-media">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={studioFileHref(projectId, version.previewPath)}
                        alt={`${slideTitle} ${version.id}`}
                      />
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </div>,
          portalTarget
        )
      : null;

  return (
    <>
      <button
        type="button"
        className="studio-compare-button"
        onClick={() => setOpen(true)}
      >
        Compare
      </button>
      {compareLightbox}
    </>
  );
}
