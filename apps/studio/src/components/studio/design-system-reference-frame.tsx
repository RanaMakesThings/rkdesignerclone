"use client";

import { useEffect, useRef, useState } from "react";

type DesignSystemReferenceFrameProps = {
  title: string;
  html?: string;
  src?: string;
  className?: string;
  minHeight?: number;
};

const measureDocumentHeight = (iframe: HTMLIFrameElement | null) => {
  const doc = iframe?.contentDocument;
  if (!doc) {
    return null;
  }

  const root = doc.documentElement;
  const body = doc.body;

  return Math.max(
    root?.scrollHeight ?? 0,
    root?.offsetHeight ?? 0,
    root?.clientHeight ?? 0,
    body?.scrollHeight ?? 0,
    body?.offsetHeight ?? 0,
    body?.clientHeight ?? 0
  );
};

export function DesignSystemReferenceFrame({
  title,
  html,
  src,
  className,
  minHeight = 1600,
}: DesignSystemReferenceFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const timeoutRefs = useRef<number[]>([]);
  const [height, setHeight] = useState(minHeight);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) {
      return;
    }

    const clearScheduled = () => {
      for (const timeoutId of timeoutRefs.current) {
        window.clearTimeout(timeoutId);
      }
      timeoutRefs.current = [];
    };

    const disconnectObserver = () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
    };

    const updateHeight = () => {
      const measuredHeight = measureDocumentHeight(iframe);
      if (!measuredHeight) {
        return;
      }

      setHeight(Math.max(minHeight, measuredHeight));
    };

    const handleLoad = () => {
      disconnectObserver();
      clearScheduled();
      updateHeight();

      const doc = iframe.contentDocument;
      if (!doc) {
        return;
      }

      if ("ResizeObserver" in window) {
        const observer = new ResizeObserver(() => {
          updateHeight();
        });
        resizeObserverRef.current = observer;

        if (doc.documentElement) {
          observer.observe(doc.documentElement);
        }
        if (doc.body) {
          observer.observe(doc.body);
        }
      }

      timeoutRefs.current = [120, 480, 1200].map((delay) =>
        window.setTimeout(() => {
          updateHeight();
        }, delay)
      );
    };

    iframe.addEventListener("load", handleLoad);
    handleLoad();

    return () => {
      iframe.removeEventListener("load", handleLoad);
      disconnectObserver();
      clearScheduled();
    };
  }, [html, minHeight, src]);

  return (
    <iframe
      ref={iframeRef}
      title={title}
      className={className}
      src={src}
      srcDoc={src ? undefined : html}
      style={{ height: `${height}px` }}
    />
  );
}
