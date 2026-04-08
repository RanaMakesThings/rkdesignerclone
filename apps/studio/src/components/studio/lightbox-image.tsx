"use client";

import { useEffect } from "react";
import { useRef } from "react";
import { useState } from "react";
import { createPortal } from "react-dom";
import styles from "./lightbox-image.module.css";

const DEFAULT_IFRAME_WIDTH = 1600;
const DEFAULT_IFRAME_HEIGHT = 900;

export type LightboxImageProps = {
  src: string;
  previewSrc?: string;
  modalType?: "image" | "iframe";
  alt: string;
  className?: string;
  title?: string;
  meta?: string;
  description?: string;
  details?: Array<{
    label: string;
    value: string;
  }>;
  actions?: Array<{
    href: string;
    label: string;
  }>;
  previewLoading?: "eager" | "lazy";
};

export function LightboxImage({
  src,
  previewSrc,
  modalType = "image",
  alt,
  className = "",
  title,
  meta,
  description,
  details = [],
  actions = [],
  previewLoading = "lazy",
}: LightboxImageProps) {
  const [open, setOpen] = useState(false);
  const [iframeShellSize, setIframeShellSize] = useState({ width: 0, height: 0 });
  const [iframeContentSize, setIframeContentSize] = useState({
    width: DEFAULT_IFRAME_WIDTH,
    height: DEFAULT_IFRAME_HEIGHT,
  });
  const portalTarget = typeof document !== "undefined" ? document.body : null;
  const iframeShellRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const inlineSrc = previewSrc ?? src;
  const iframeContentWidth = iframeContentSize.width || DEFAULT_IFRAME_WIDTH;
  const iframeContentHeight = iframeContentSize.height || DEFAULT_IFRAME_HEIGHT;
  const iframeScale =
    modalType === "iframe" && iframeShellSize.width > 0 && iframeShellSize.height > 0
      ? Math.min(
          1,
          Math.max(0, iframeShellSize.width - 32) / iframeContentWidth,
          Math.max(0, iframeShellSize.height - 32) / iframeContentHeight
        )
      : 1;

  const measureIframeContent = () => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    const win = iframe?.contentWindow;
    if (!iframe || !doc || !win) {
      return;
    }

    try {
      win.scrollTo(0, 0);
    } catch {}

    const root = doc.documentElement;
    const body = doc.body;
    const width = Math.max(
      root?.scrollWidth ?? 0,
      root?.offsetWidth ?? 0,
      root?.clientWidth ?? 0,
      body?.scrollWidth ?? 0,
      body?.offsetWidth ?? 0,
      body?.clientWidth ?? 0,
      DEFAULT_IFRAME_WIDTH
    );
    const height = Math.max(
      root?.scrollHeight ?? 0,
      root?.offsetHeight ?? 0,
      root?.clientHeight ?? 0,
      body?.scrollHeight ?? 0,
      body?.offsetHeight ?? 0,
      body?.clientHeight ?? 0,
      DEFAULT_IFRAME_HEIGHT
    );

    setIframeContentSize((current) =>
      current.width === width && current.height === height
        ? current
        : { width, height }
    );
  };

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

  useEffect(() => {
    if (!open || modalType !== "iframe") {
      return;
    }

    const node = iframeShellRef.current;
    if (!node || typeof ResizeObserver === "undefined") {
      return;
    }

    const updateSize = () => {
      setIframeShellSize({
        width: node.clientWidth,
        height: node.clientHeight,
      });
    };

    updateSize();
    const observer = new ResizeObserver(() => {
      updateSize();
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [open, modalType]);

  const lightbox =
    open && portalTarget
      ? createPortal(
          <div
            className="lightbox-shell"
            role="dialog"
            aria-modal="true"
            aria-label={alt}
            onClick={() => setOpen(false)}
          >
            <button type="button" className="lightbox-close" onClick={() => setOpen(false)}>
              Close
            </button>
            <div
              className="lightbox-frame"
              data-modal-type={modalType}
              onClick={(event) => event.stopPropagation()}
            >
              {(meta || title || description || details.length > 0 || actions.length > 0) && (
                <div className="lightbox-caption">
                  {meta ? <p className="lightbox-meta">{meta}</p> : null}
                  {title ? <h3>{title}</h3> : null}
                  {description ? (
                    <p className={styles.description}>{description}</p>
                  ) : null}
                  {details.length > 0 ? (
                    <dl className={styles.detailGrid}>
                      {details.map((detail) => (
                        <div key={`${detail.label}-${detail.value}`} className={styles.detail}>
                          <dt>{detail.label}</dt>
                          <dd>{detail.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  {actions.length > 0 ? (
                    <div className={styles.actionRow}>
                      {actions.map((action) => (
                        <a
                          key={`${action.label}-${action.href}`}
                          className={styles.action}
                          href={action.href}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {action.label}
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
              {modalType === "iframe" ? (
                <div ref={iframeShellRef} className={styles.iframeShell}>
                  <div
                    className={styles.iframeViewport}
                    style={{
                      width: `${iframeContentWidth * iframeScale}px`,
                      height: `${iframeContentHeight * iframeScale}px`,
                    }}
                  >
                    <iframe
                      ref={iframeRef}
                      src={src}
                      title={title ?? alt}
                      className={styles.iframe}
                      loading="eager"
                      referrerPolicy="no-referrer"
                      onLoad={() => {
                        measureIframeContent();
                        window.setTimeout(measureIframeContent, 0);
                        window.setTimeout(measureIframeContent, 200);
                      }}
                      style={{
                        width: `${iframeContentWidth}px`,
                        height: `${iframeContentHeight}px`,
                        transform: `scale(${iframeScale})`,
                      }}
                    />
                  </div>
                </div>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={src} alt={alt} decoding="async" className={styles.modalImage} />
              )}
            </div>
          </div>,
          portalTarget
        )
      : null;

  return (
    <>
      <button
        type="button"
        className={`lightbox-trigger ${className}`.trim()}
        onClick={() => {
          if (modalType === "iframe") {
            setIframeContentSize({
              width: DEFAULT_IFRAME_WIDTH,
              height: DEFAULT_IFRAME_HEIGHT,
            });
          }
          setOpen(true);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={inlineSrc} alt={alt} loading={previewLoading} decoding="async" />
      </button>
      {lightbox}
    </>
  );
}
