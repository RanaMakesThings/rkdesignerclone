"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { studioFileHref } from "@/lib/presentation/links";

import styles from "./styles-lab.module.css";

const CSS_FILE_RE = /\.css$/i;
const PREVIEW_CANVAS_WIDTH = 1920;
const PREVIEW_CANVAS_HEIGHT = 1080;

const replaceSharedCssLink = (html: string, css: string) =>
  html.replace(
    /<link\b[^>]*data-designer-shared-css=(?:"true"|'true')[^>]*>\s*/i,
    `<style data-designer-shared-css="true">\n${css}\n</style>\n`
  );

const replacePreviewAssets = (html: string, projectId: string) =>
  html.replace(
    /\.\.\/assets\/logo\/designer-health-logo-black\.svg/g,
    studioFileHref(projectId, "projects/designer-health/assets/logo/designer-health-logo-black.svg")
  );

const buildPreviewDocument = ({
  templateHtml,
  css,
  projectId,
}: {
  templateHtml: string;
  css: string;
  projectId: string;
}) => replacePreviewAssets(replaceSharedCssLink(templateHtml, css), projectId);

export function StylesLab({
  projectId,
  initialCss,
  previewTemplateHtml,
}: {
  projectId: string;
  initialCss: string;
  previewTemplateHtml: string;
}) {
  const router = useRouter();
  const [draftCss, setDraftCss] = useState(initialCss);
  const [dragActive, setDragActive] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [previewShellSize, setPreviewShellSize] = useState({ width: 0, height: 0 });
  const deferredCss = useDeferredValue(draftCss);
  const previewShellRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fitScale =
    previewShellSize.width > 0 && previewShellSize.height > 0
      ? Math.min(
          1,
          (previewShellSize.width - 48) / PREVIEW_CANVAS_WIDTH,
          (previewShellSize.height - 48) / PREVIEW_CANVAS_HEIGHT
        )
      : 1;
  const previewDocument = buildPreviewDocument({
    templateHtml: previewTemplateHtml,
    css: deferredCss,
    projectId,
  });

  useEffect(() => {
    const node = previewShellRef.current;
    if (!node) {
      return;
    }

    const updateSize = () => {
      setPreviewShellSize({
        width: node.clientWidth,
        height: node.clientHeight,
      });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const loadCssFile = async (file: File) => {
    if (!CSS_FILE_RE.test(file.name) && file.type !== "text/css") {
      setError("Drop a .css file.");
      return;
    }

    const text = await file.text();
    setDraftCss(text);
    setStatus("idle");
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className={styles.labStack}>
      <section className={styles.surface}>
        <div className={styles.surfaceHead}>
          <div>
            <p className="eyebrow">Master CSS</p>
            <h3>Edit and upload the shared deck stylesheet.</h3>
          </div>
          <div className={styles.editorMeta}>
            <span>{draftCss.split(/\r?\n/).length} lines</span>
            <span>{draftCss.length.toLocaleString()} chars</span>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setDraftCss(initialCss);
                setStatus("idle");
                setError(null);
              }}
            >
              Reset To Disk
            </button>
            <button
              type="button"
              className="ghost-button"
              disabled={status === "saving" || draftCss.trim().length === 0}
              onClick={async () => {
                setStatus("saving");
                setError(null);
                try {
                  const response = await fetch("/api/design-system/css", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      css: draftCss,
                    }),
                  });
                  const payload = await response.json().catch(() => ({}));
                  if (!response.ok || payload?.ok === false) {
                    throw new Error(payload?.error ?? `Save failed with ${response.status}`);
                  }
                  setStatus("saved");
                  router.refresh();
                } catch (nextError) {
                  setStatus("idle");
                  setError(nextError instanceof Error ? nextError.message : "Save failed.");
                }
              }}
            >
              {status === "saving" ? "Saving..." : "Save CSS To Repo"}
            </button>
          </div>
        </div>

        <div
          className={`${styles.dropZone}${dragActive ? ` ${styles.dropZoneActive}` : ""}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragActive(false);
          }}
          onDrop={async (event) => {
            event.preventDefault();
            setDragActive(false);
            const file = event.dataTransfer.files?.[0];
            if (file) {
              await loadCssFile(file);
            }
          }}
        >
          <div>
            <p className="eyebrow">Upload CSS</p>
            <h3>Drop a replacement stylesheet here.</h3>
            <p className={styles.dropZoneCopy}>
              The live preview updates immediately. Saving writes to the checked-in Designer design
              system file.
            </p>
          </div>
          <button type="button" className="ghost-button" onClick={() => fileInputRef.current?.click()}>
            Choose CSS File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".css,text/css"
            className={styles.fileInput}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) {
                await loadCssFile(file);
              }
            }}
          />
        </div>

        {status === "saved" ? (
          <p className="micro-copy micro-copy-success" role="status" aria-live="polite">
            Shared CSS saved. Refresh the preview links if you want the server-rendered files again.
          </p>
        ) : null}
        {error ? <p className="micro-copy micro-copy-danger">{error}</p> : null}

        <textarea
          className={styles.editor}
          spellCheck={false}
          value={draftCss}
          onChange={(event) => {
            setDraftCss(event.target.value);
            setStatus("idle");
            setError(null);
          }}
          aria-label="Shared CSS editor"
        />
      </section>

      <section className={styles.surface}>
        <div className={styles.surfaceHead}>
          <div>
            <p className="eyebrow">Design System Preview</p>
            <h3>Live preview against the checked-in style preview HTML.</h3>
          </div>
          <div className={styles.previewMeta}>
            <span>{Math.round(fitScale * 100)}%</span>
            <span>1920×1080 canvas</span>
          </div>
        </div>

        <div ref={previewShellRef} className={styles.previewFrameShell}>
          <div
            className={styles.previewViewport}
            style={{
              width: `${PREVIEW_CANVAS_WIDTH * fitScale}px`,
              height: `${PREVIEW_CANVAS_HEIGHT * fitScale}px`,
            }}
          >
            <iframe
              title="Design system preview"
              className={styles.previewFrame}
              sandbox="allow-scripts"
              referrerPolicy="no-referrer"
              srcDoc={previewDocument}
              style={{
                width: `${PREVIEW_CANVAS_WIDTH}px`,
                height: `${PREVIEW_CANVAS_HEIGHT}px`,
                transform: `scale(${fitScale})`,
              }}
            />
          </div>
        </div>

        <p className={styles.previewNote}>
          This preview uses the saved preview HTML shell and swaps in the in-editor stylesheet so
          you can test CSS changes before writing them to disk.
        </p>
      </section>
    </div>
  );
}
