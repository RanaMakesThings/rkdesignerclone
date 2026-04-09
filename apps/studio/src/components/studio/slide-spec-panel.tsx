"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { markdownToHtml } from "@/lib/presentation/markdown";
import styles from "./slide-spec-panel.module.css";

const MARKDOWN_FILE_RE = /\.(md|markdown|txt)$/i;
const MARKDOWN_FILE_TYPES = new Set(["text/markdown", "text/plain"]);
const DEFAULT_COLLAPSED_HELP = "Spec hidden. Expand to read the working markdown or open the editor.";

export function SlideSpecPanel({
  projectId,
  slideId,
  slideTitle,
  specText,
}: {
  projectId: string;
  slideId: string;
  slideTitle: string;
  specText: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [savedSpecText, setSavedSpecText] = useState(specText);
  const [draft, setDraft] = useState(specText);
  const [activeFileName, setActiveFileName] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [isRefreshPending, startRefresh] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const portalTarget = typeof document !== "undefined" ? document.body : null;
  const previewText = editing ? draft : savedSpecText;
  const specHtml = markdownToHtml(previewText, projectId);
  const hasPreview = specHtml.trim().length > 0;
  const isDirty = draft !== savedSpecText;
  const lineCount = draft ? draft.split(/\r?\n/).length : 0;
  const saveDisabled = saveStatus === "saving" || isRefreshPending || !isDirty;
  const contentHidden = collapsed && !editing;

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
    setSavedSpecText(specText);
    setDraft(specText);
    setActiveFileName(null);
    setFileError(null);
    setSaveError(null);
  }, [specText]);

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const updateDraft = (value: string) => {
    setDraft(value);
    setCollapsed(false);
    setActiveFileName(null);
    setFileError(null);
    setSaveError(null);
    setSaveStatus("idle");
  };

  const resetDraft = () => {
    setDraft(savedSpecText);
    setActiveFileName(null);
    setFileError(null);
    setSaveError(null);
    setSaveStatus("idle");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const loadFile = async (file: File) => {
    if (!MARKDOWN_FILE_RE.test(file.name) && !MARKDOWN_FILE_TYPES.has(file.type)) {
      setFileError("Drop a markdown file (`.md`, `.markdown`, or `.txt`).");
      return;
    }

    const text = await file.text();
    setDraft(text);
    setCollapsed(false);
    setActiveFileName(file.name);
    setFileError(null);
    setSaveError(null);
    setSaveStatus("idle");
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

  const saveSpec = async () => {
    setSaveStatus("saving");
    setSaveError(null);

    try {
      const response = await fetch("/api/slide-spec", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          slideId,
          specText: draft,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error ?? `Save failed with ${response.status}`);
      }

      const nextSpecText =
        typeof payload?.specText === "string"
          ? payload.specText
          : String(draft ?? "").replace(/\r\n/g, "\n").trim();
      setSavedSpecText(nextSpecText);
      setDraft(nextSpecText);
      setEditing(false);
      setCollapsed(false);
      setActiveFileName(null);
      setFileError(null);
      setSaveStatus("saved");
      startRefresh(() => {
        router.refresh();
      });
    } catch (error) {
      setSaveStatus("idle");
      setSaveError(error instanceof Error ? error.message : "Save failed.");
    }
  };

  const readPreview = hasPreview ? (
    <div
      className={`${styles.readPreview} studio-spec-copy markdown-body`}
      dangerouslySetInnerHTML={{ __html: specHtml }}
    />
  ) : (
    <p className={styles.emptyState}>
      No slide-local spec is saved yet. Paste markdown or drop a file to start one.
    </p>
  );

  const editorPreview = hasPreview ? (
    <div
      className={`${styles.editorPreview} studio-spec-copy markdown-body`}
      dangerouslySetInnerHTML={{ __html: specHtml }}
    />
  ) : (
    <p className={styles.emptyState}>
      No slide-local spec is saved yet. Paste markdown or drop a file to start one.
    </p>
  );

  const specDialog =
    open && portalTarget
      ? createPortal(
          <div
            className="spec-lightbox-shell"
            role="dialog"
            aria-modal="true"
            aria-label={`${slideTitle} slide spec`}
            onClick={() => setOpen(false)}
          >
            <button
              type="button"
              className="lightbox-close spec-lightbox-close"
              onClick={() => setOpen(false)}
            >
              Close
            </button>

            <div className="spec-lightbox-frame" onClick={(event) => event.stopPropagation()}>
              <div className="spec-lightbox-head">
                <div>
                  <p className="lightbox-meta">{slideId}</p>
                  <h3>{slideTitle}</h3>
                </div>
                <p className="spec-lightbox-note">
                  {editing ? "Live markdown preview" : "Full slide spec"}
                </p>
              </div>
              <div className="spec-lightbox-copy markdown-body">
                {hasPreview ? (
                  <div className={styles.lightboxPreview} dangerouslySetInnerHTML={{ __html: specHtml }} />
                ) : (
                  <p className={styles.emptyState}>
                    No slide-local spec is saved yet. Open the editor to paste or import markdown.
                  </p>
                )}
              </div>
            </div>
          </div>,
          portalTarget
        )
      : null;

  return (
    <>
      <section className={`studio-spec-block studio-spec-panel-surface ${styles.section}`}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionCopy}>
            <p className="studio-spec-kicker">Slide Spec</p>
            <h3 className={styles.sectionTitle}>Working markdown for this slide</h3>
            <p className={`${styles.sectionNote} studio-spec-panel-note`}>
              This is the slide-local spec stored in <code>deck-spec.json</code>. Keep it current
              here, and update <code>master-slide-specs.md</code> when the broader deck narrative
              changes.
            </p>
          </div>

          <div className={styles.actions}>
            {saveStatus === "saved" && !editing ? (
              <span className={`${styles.statePill} ${styles.statePillSaved}`}>Saved</span>
            ) : null}
            {editing && isDirty ? (
              <span className={`${styles.statePill} ${styles.statePillDirty}`}>
                Unsaved changes
              </span>
            ) : null}
            <button
              type="button"
              className="ghost-button"
              onClick={() =>
                setEditing((value) => {
                  const nextValue = !value;
                  if (nextValue) {
                    setCollapsed(false);
                  }
                  return nextValue;
                })
              }
            >
              {editing ? "Hide Editor" : "Edit Spec"}
            </button>
            {!editing ? (
              <button
                type="button"
                className="ghost-button"
                onClick={() => setCollapsed((value) => !value)}
              >
                {collapsed ? "Expand" : "Collapse"}
              </button>
            ) : null}
            <button
              type="button"
              className="studio-spec-expand"
              onClick={() => setOpen(true)}
              aria-label={`Expand slide spec for ${slideTitle}`}
              title="Expand slide spec"
            >
              <span aria-hidden="true">⤢</span>
            </button>
          </div>
        </div>

        {editing ? (
          <div className={styles.editorStack}>
            <div className={styles.toolbar}>
              <div className={`${styles.toolbarMeta} studio-spec-panel-toolbar-meta`}>
                <span>{lineCount} lines</span>
                <span>{draft.length.toLocaleString()} chars</span>
                {activeFileName ? <span className={styles.filePill}>{activeFileName}</span> : null}
              </div>

              <div className={styles.toolbarActions}>
                <button type="button" className="ghost-button" onClick={openFilePicker}>
                  Load Markdown File
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={resetDraft}
                  disabled={!isDirty && !activeFileName}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className={styles.saveButton}
                  onClick={saveSpec}
                  disabled={saveDisabled}
                >
                  {saveStatus === "saving" || isRefreshPending ? "Saving..." : "Save Spec"}
                </button>
              </div>
            </div>

            <div
              className={`studio-spec-panel-dropzone ${styles.dropZone}${dragActive ? ` ${styles.dropZoneActive}` : ""}`}
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
                <p className="eyebrow">Markdown File</p>
                <h3>Drag in a slide spec.</h3>
                <p className={styles.dropZoneCopy}>
                  Drop a `.md`, `.markdown`, or `.txt` file to replace the current draft, or
                  choose one manually.
                </p>
              </div>
              <button type="button" className="ghost-button" onClick={openFilePicker}>
                Choose File
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.markdown,.txt,text/markdown,text/plain"
                className={styles.fileInput}
                onChange={async (event) => {
                  await handleFileSelection(event.target.files);
                }}
              />
            </div>

            {fileError ? <p className="micro-copy micro-copy-danger">{fileError}</p> : null}
            {saveError ? <p className="micro-copy micro-copy-danger">{saveError}</p> : null}
            {saveStatus === "saved" && !saveError ? (
              <p className="micro-copy micro-copy-success" role="status" aria-live="polite">
                Saved the slide-local markdown in <code>deck-spec.json</code>.
              </p>
            ) : null}

            <div className={styles.workbench}>
              <label className={styles.pane}>
                <div className={styles.paneHead}>
                  <p className="eyebrow">Markdown</p>
                  <span>Paste or edit the slide-local spec text for this slide.</span>
                </div>
                <textarea
                  className={`${styles.editor} studio-spec-panel-editor`}
                  spellCheck={false}
                  value={draft}
                  onChange={(event) => updateDraft(event.target.value)}
                  placeholder="Paste slide-spec markdown here, or drop a markdown file above."
                  aria-label={`Slide spec markdown for ${slideTitle}`}
                />
              </label>

              <div className={styles.pane}>
                <div className={styles.paneHead}>
                  <p className="eyebrow">Styled Preview</p>
                  <span>Rendered with the same markdown styling used on the slide page.</span>
                </div>
                <div className={`${styles.preview} studio-spec-panel-preview`}>{editorPreview}</div>
              </div>
            </div>
          </div>
        ) : contentHidden ? (
          <div className={`${styles.collapsedState} studio-spec-panel-collapsed`}>
            <p>{DEFAULT_COLLAPSED_HELP}</p>
          </div>
        ) : (
          <div className={`${styles.readFrame} studio-spec-panel-readframe`}>{readPreview}</div>
        )}
      </section>
      {specDialog}
    </>
  );
}
