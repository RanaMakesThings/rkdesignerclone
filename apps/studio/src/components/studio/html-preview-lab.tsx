"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useRef, useState } from "react";

import { studioSlideHref } from "@/lib/presentation/links";

import styles from "./html-preview-lab.module.css";

const EMPTY_PREVIEW = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        color-scheme: light;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 32px;
        font-family: "Manrope", system-ui, sans-serif;
        background:
          radial-gradient(circle at top, rgba(29, 118, 108, 0.16), transparent 34%),
          linear-gradient(180deg, #f6f8f4 0%, #edf1eb 100%);
        color: #17322d;
      }

      main {
        width: min(560px, 100%);
        padding: 28px;
        border-radius: 24px;
        border: 1px solid rgba(23, 50, 45, 0.12);
        background: rgba(255, 255, 255, 0.84);
        box-shadow: 0 24px 60px rgba(17, 32, 29, 0.08);
      }

      p {
        margin: 0;
        line-height: 1.55;
        color: rgba(23, 50, 45, 0.72);
      }

      strong {
        display: block;
        margin-bottom: 10px;
        font-size: 1.05rem;
      }
    </style>
  </head>
  <body>
    <main>
      <strong>Paste HTML to render it here.</strong>
      <p>
        Full documents render as-is. Fragments are wrapped in a basic document shell so you can
        quickly inspect layout and styling.
      </p>
    </main>
  </body>
</html>`;

const FULL_DOCUMENT_RE = /<(?:!doctype|html|head|body)\b/i;
const HTML_FILE_RE = /\.html?$/i;
const PREVIEW_CANVAS_WIDTH = 1600;
const PREVIEW_CANVAS_HEIGHT = 900;

type ZoomPreset = "fit" | 0.75 | 1;

const ZOOM_PRESETS: Array<{ label: string; value: ZoomPreset }> = [
  { label: "Fit", value: "fit" },
  { label: "75%", value: 0.75 },
  { label: "100%", value: 1 },
];

type HtmlPreviewLabSlide = {
  slideId: string;
  displayNumber: string;
  title: string;
};

function buildPreviewDocument(source: string) {
  const trimmed = source.trim();

  if (!trimmed) {
    return EMPTY_PREVIEW;
  }

  if (FULL_DOCUMENT_RE.test(trimmed)) {
    return trimmed;
  }

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html {
        background: #f6f8f4;
      }

      body {
        margin: 0;
        padding: 24px;
      }
    </style>
  </head>
  <body>${trimmed}</body>
</html>`;
}

export function HtmlPreviewLab({
  projectId,
  slides,
}: {
  projectId: string;
  slides: HtmlPreviewLabSlide[];
}) {
  const router = useRouter();
  const [markup, setMarkup] = useState("");
  const [activeFileName, setActiveFileName] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedSlideId, setSelectedSlideId] = useState("");
  const [importStatus, setImportStatus] = useState<"idle" | "pending" | "success">("idle");
  const [importError, setImportError] = useState<string | null>(null);
  const [importedVersion, setImportedVersion] = useState<{
    slideId: string;
    displayNumber: string;
    versionId: string;
  } | null>(null);
  const [zoomPreset, setZoomPreset] = useState<ZoomPreset>("fit");
  const [previewShellSize, setPreviewShellSize] = useState({ width: 0, height: 0 });
  const deferredMarkup = useDeferredValue(markup);
  const trimmedMarkup = markup.trim();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewShellRef = useRef<HTMLDivElement | null>(null);

  const lineCount = markup ? markup.split(/\r?\n/).length : 0;
  const charCount = markup.length;
  const previewDocument = buildPreviewDocument(deferredMarkup);
  const documentMode = trimmedMarkup
    ? FULL_DOCUMENT_RE.test(trimmedMarkup)
      ? "Full document"
      : "Fragment wrapper"
    : "Empty preview";
  const fitScale =
    previewShellSize.width > 0 && previewShellSize.height > 0
      ? Math.min(
          1,
          (previewShellSize.width - 48) / PREVIEW_CANVAS_WIDTH,
          (previewShellSize.height - 48) / PREVIEW_CANVAS_HEIGHT
        )
      : 1;
  const effectiveScale = zoomPreset === "fit" ? fitScale : zoomPreset;
  const scaledWidth = PREVIEW_CANVAS_WIDTH * effectiveScale;
  const scaledHeight = PREVIEW_CANVAS_HEIGHT * effectiveScale;
  const zoomLabel = `${Math.round(effectiveScale * 100)}%`;
  const importDisabled = importStatus === "pending" || !selectedSlideId || !trimmedMarkup;

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

    const observer = new ResizeObserver(() => {
      updateSize();
    });
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const updateMarkupFromEditor = (value: string) => {
    setMarkup(value);
    setActiveFileName(null);
    setErrorMessage(null);
    setImportStatus("idle");
    setImportError(null);
    setImportedVersion(null);
  };

  const clearMarkup = () => {
    setMarkup("");
    setActiveFileName(null);
    setErrorMessage(null);
    setImportStatus("idle");
    setImportError(null);
    setImportedVersion(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const loadFile = async (file: File) => {
    if (!HTML_FILE_RE.test(file.name) && file.type !== "text/html") {
      setErrorMessage("Drop an .html or .htm file.");
      return;
    }

    const text = await file.text();
    setMarkup(text);
    setActiveFileName(file.name);
    setErrorMessage(null);
    setImportStatus("idle");
    setImportError(null);
    setImportedVersion(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileSelection = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) {
      return;
    }

    await loadFile(file);
  };

  return (
    <div className={styles.labStack}>
      <section className={styles.surface}>
        <div className={styles.surfaceHead}>
          <div>
            <p className="eyebrow">Paste HTML</p>
            <h3>Drop in any snippet or full document.</h3>
          </div>
          <div className={styles.editorMeta}>
            {activeFileName ? <span className={styles.fileNamePill}>{activeFileName}</span> : null}
            <span>{lineCount} lines</span>
            <span>{charCount.toLocaleString()} chars</span>
            <button type="button" className="ghost-button" onClick={clearMarkup}>
              Clear
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
            await handleFileSelection(event.dataTransfer.files);
          }}
        >
          <div>
            <p className="eyebrow">HTML File</p>
            <h3>Drag an HTML file here.</h3>
            <p className={styles.dropZoneCopy}>
              Drop a local `.html` file to load it into the editor, or choose one manually.
            </p>
          </div>
          <button type="button" className="ghost-button" onClick={openFilePicker}>
            Choose File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".html,.htm,text/html"
            className={styles.fileInput}
            onChange={async (event) => {
              await handleFileSelection(event.target.files);
            }}
          />
        </div>

        {errorMessage ? <p className={styles.errorMessage}>{errorMessage}</p> : null}

        <div className={styles.importPanel}>
          <div className={styles.importCopy}>
            <p className="eyebrow">Versioned Slide</p>
            <h3>Turn this preview into a saved slide version.</h3>
            <p className={styles.importNote}>
              This uses the existing `slide:versions import-html` workflow. It creates a new
              version bundle for the selected slide and leaves current promotion unchanged.
            </p>
          </div>
          <div className={styles.importControls}>
            <label className={styles.selectField}>
              <span className={styles.selectLabel}>Target slide</span>
              <select
                className="toolbar-select"
                value={selectedSlideId}
                onChange={(event) => {
                  setSelectedSlideId(event.target.value);
                  setImportStatus("idle");
                  setImportError(null);
                  setImportedVersion(null);
                }}
              >
                <option value="">Select a slide…</option>
                {slides.map((slide) => (
                  <option key={slide.slideId} value={slide.slideId}>
                    Slide {slide.displayNumber} · {slide.title}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="ghost-button"
              disabled={importDisabled}
              onClick={async () => {
                setImportStatus("pending");
                setImportError(null);
                setImportedVersion(null);
                try {
                  const response = await fetch("/api/versions/import-html", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      projectId,
                      slideId: selectedSlideId,
                      html: markup,
                      sourceName: activeFileName ?? "studio-html-lab.html",
                    }),
                  });
                  const payload = await response.json().catch(() => ({}));
                  if (!response.ok || payload?.ok === false) {
                    throw new Error(payload?.error ?? `Import failed with ${response.status}`);
                  }
                  const importedSlideId = String(payload.slideId);
                  const importedSlide = slides.find((slide) => slide.slideId === importedSlideId);
                  setImportStatus("success");
                  setImportedVersion({
                    slideId: importedSlideId,
                    displayNumber: importedSlide?.displayNumber ?? importedSlideId,
                    versionId: String(payload.versionId),
                  });
                  router.refresh();
                } catch (nextError) {
                  setImportStatus("idle");
                  setImportError(
                    nextError instanceof Error ? nextError.message : "Import failed."
                  );
                }
              }}
            >
              {importStatus === "pending" ? "Creating Version..." : "Create Versioned Slide"}
            </button>
          </div>
          {importStatus === "pending" ? (
            <p className="micro-copy" role="status" aria-live="polite">
              Rendering a preview and registering a new slide version…
            </p>
          ) : null}
          {importedVersion ? (
            <p className="micro-copy micro-copy-success" role="status" aria-live="polite">
              Created {importedVersion.versionId} for {importedVersion.slideId}.{" "}
              <Link
                href={studioSlideHref(importedVersion.displayNumber, importedVersion.slideId)}
                className="inline-link"
              >
                Review the slide versions
              </Link>
              .
            </p>
          ) : null}
          {importError ? <p className="micro-copy micro-copy-danger">{importError}</p> : null}
        </div>

        <textarea
          className={styles.editor}
          spellCheck={false}
          value={markup}
          onChange={(event) => updateMarkupFromEditor(event.target.value)}
          placeholder="Paste HTML here, or drop an HTML file above. Full documents and fragments both work."
          aria-label="HTML input"
        />
      </section>

      <section className={styles.surface}>
        <div className={styles.surfaceHead}>
          <div>
            <p className="eyebrow">Render Preview</p>
            <h3>Sandboxed live output</h3>
          </div>
          <div className={styles.previewMeta}>
            <span className={styles.modePill}>{documentMode}</span>
            <div className={styles.zoomGroup}>
              {ZOOM_PRESETS.map((preset) => {
                const active = zoomPreset === preset.value;

                return (
                  <button
                    key={preset.label}
                    type="button"
                    className={`${styles.zoomButton}${active ? ` ${styles.zoomButtonActive}` : ""}`}
                    onClick={() => setZoomPreset(preset.value)}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <span className={styles.zoomReadout}>{zoomLabel}</span>
            <span>Updates as you type</span>
          </div>
        </div>

        <div ref={previewShellRef} className={styles.previewFrameShell}>
          <div
            className={styles.previewViewport}
            style={{
              width: `${scaledWidth}px`,
              height: `${scaledHeight}px`,
            }}
          >
            <iframe
              title="Rendered HTML preview"
              className={styles.previewFrame}
              sandbox="allow-forms allow-modals allow-scripts"
              referrerPolicy="no-referrer"
              srcDoc={previewDocument}
              style={{
                width: `${PREVIEW_CANVAS_WIDTH}px`,
                height: `${PREVIEW_CANVAS_HEIGHT}px`,
                transform: `scale(${effectiveScale})`,
              }}
            />
          </div>
        </div>

        <p className={styles.previewNote}>
          Fit targets the deck&apos;s 1600×900 slide canvas. Scripts and forms can run inside the
          preview frame, but the sandbox keeps that content isolated from the studio shell.
        </p>
      </section>
    </div>
  );
}
