"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { StudioProjectReferences } from "@/lib/presentation/designer-studio-types";

import { FileChip } from "./file-chip";
import styles from "./references-panel.module.css";

const splitCsv = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const joinCsv = (value: string[] | null | undefined) =>
  Array.isArray(value) ? value.join(", ") : "";

export function ProjectReferencesPanel({
  projectId,
  references,
}: {
  projectId: string;
  references: StudioProjectReferences;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [editingReferenceId, setEditingReferenceId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [sourceType, setSourceType] = useState("report");
  const [sourceKeys, setSourceKeys] = useState("");
  const [citationText, setCitationText] = useState("");
  const [url, setUrl] = useState("");
  const [summary, setSummary] = useState("");
  const [tags, setTags] = useState("");

  const runningByReferenceId = new Map(
    references.running.map((entry) => [entry.referenceId, entry])
  );

  const resetForm = () => {
    setEditingReferenceId(null);
    setLabel("");
    setSourceType("report");
    setSourceKeys("");
    setCitationText("");
    setUrl("");
    setSummary("");
    setTags("");
  };

  const submitAction = async (action: string, payload: Record<string, unknown>) => {
    setError(null);
    setStatus(null);

    const response = await fetch("/api/references", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId,
        action,
        payload,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.ok === false) {
      throw new Error(result?.error ?? `References action failed with ${response.status}`);
    }

    setStatus(
      action === "regenerate"
        ? "Regenerated running references."
        : action === "archiveReference"
          ? "Archived reference."
          : editingReferenceId
            ? "Updated reference."
            : "Created reference."
    );
    startTransition(() => {
      router.refresh();
    });
    return result;
  };

  const handleSubmit = async () => {
    try {
      if (!label.trim() || !citationText.trim()) {
        throw new Error("Label and citation text are required.");
      }

      const action = editingReferenceId ? "updateReference" : "createReference";
      await submitAction(action, {
        referenceId: editingReferenceId,
        label,
        sourceType,
        sourceKeys: splitCsv(sourceKeys),
        citationText,
        url,
        summary,
        tags: splitCsv(tags),
      });
      resetForm();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "References update failed.");
    }
  };

  return (
    <section className="asset-section">
      <div className="asset-group">
        <div className="asset-group-head">
          <div>
            <p className="eyebrow">References</p>
            <h3>{references.stats.runningCount} running references</h3>
          </div>
          <div className="studio-chip-row">
            <span className="studio-chip">
              <span>Library</span>
              <strong>{references.stats.libraryCount}</strong>
            </span>
            <span className="studio-chip">
              <span>Linked usages</span>
              <strong>{references.stats.currentUsageCount}</strong>
            </span>
          </div>
        </div>

        <div className="studio-chip-row">
          {references.manifest ? (
            <FileChip projectId={projectId} refLike={references.manifest} label="Manifest" />
          ) : null}
          {references.template ? (
            <FileChip projectId={projectId} refLike={references.template} label="Template" />
          ) : null}
          {references.generated.json ? (
            <FileChip projectId={projectId} refLike={references.generated.json} label="JSON" />
          ) : null}
          {references.generated.markdown ? (
            <FileChip
              projectId={projectId}
              refLike={references.generated.markdown}
              label="Markdown"
            />
          ) : null}
          {references.generated.appendixHtml ? (
            <FileChip
              projectId={projectId}
              refLike={references.generated.appendixHtml}
              label="Appendix HTML"
            />
          ) : null}
        </div>

        {references.warnings.length > 0 ? (
          <div className="inline-note">
            {references.warnings.length} reference warnings remain. The compiler is flagging
            missing slide links, proof-marker mismatches, or orphaned usages.
          </div>
        ) : null}

        <div className={styles.stack}>
          <div className={styles.form}>
            <div>
              <p className="eyebrow">{editingReferenceId ? "Edit Reference" : "New Reference"}</p>
              <p className={styles.helper}>
                Keep the citation text as the human-readable appendix line. Running numbers are
                assigned automatically from deck order.
              </p>
            </div>

            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Label</span>
                <input
                  className={styles.input}
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Source Type</span>
                <select
                  className={styles.select}
                  value={sourceType}
                  onChange={(event) => setSourceType(event.target.value)}
                >
                  <option value="report">report</option>
                  <option value="paper">paper</option>
                  <option value="article">article</option>
                  <option value="regulatory">regulatory</option>
                  <option value="dataset">dataset</option>
                  <option value="other">other</option>
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Source Keys</span>
                <input
                  className={styles.input}
                  value={sourceKeys}
                  onChange={(event) => setSourceKeys(event.target.value)}
                  placeholder="1, 2"
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Tags</span>
                <input
                  className={styles.input}
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="capacity, economics"
                />
              </label>
              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span className={styles.fieldLabel}>Citation Text</span>
                <textarea
                  className={styles.textarea}
                  value={citationText}
                  onChange={(event) => setCitationText(event.target.value)}
                />
              </label>
              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span className={styles.fieldLabel}>URL</span>
                <input
                  className={styles.input}
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://..."
                />
              </label>
              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span className={styles.fieldLabel}>Summary</span>
                <textarea
                  className={styles.textarea}
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                />
              </label>
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className="primary-link"
                onClick={() => void handleSubmit()}
                disabled={isPending}
              >
                {editingReferenceId ? "Save Reference" : "Add Reference"}
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={resetForm}
                disabled={isPending}
              >
                Clear
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() =>
                  void submitAction("regenerate", {}).catch((nextError) =>
                    setError(nextError instanceof Error ? nextError.message : "Regeneration failed.")
                  )
                }
                disabled={isPending}
              >
                Regenerate Appendix
              </button>
              {status ? <span className={styles.status}>{status}</span> : null}
            </div>
            {error ? <p className="micro-copy micro-copy-danger">{error}</p> : null}
          </div>

          <div className={styles.list}>
            {references.library.map((reference) => {
              const runningEntry = runningByReferenceId.get(reference.id);
              return (
                <article key={reference.id} className={styles.row}>
                  <div className={styles.rowHead}>
                    <div>
                      <p className="eyebrow">
                        {runningEntry ? `Appendix ${runningEntry.appendixNumber}` : "Library Only"}
                      </p>
                      <h3>{reference.label}</h3>
                    </div>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => {
                          setEditingReferenceId(reference.id);
                          setLabel(reference.label);
                          setSourceType(reference.sourceType ?? "report");
                          setSourceKeys(joinCsv(reference.sourceKeys));
                          setCitationText(reference.citationText);
                          setUrl(reference.url ?? "");
                          setSummary(reference.summary ?? "");
                          setTags(joinCsv(reference.tags));
                          setError(null);
                          setStatus(null);
                        }}
                      >
                        Edit
                      </button>
                      {reference.status !== "archived" ? (
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() =>
                            void submitAction("archiveReference", {
                              referenceId: reference.id,
                            }).catch((nextError) =>
                              setError(
                                nextError instanceof Error
                                  ? nextError.message
                                  : "Archive failed."
                              )
                            )
                          }
                          disabled={isPending}
                        >
                          Archive
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className={styles.rowMeta}>
                    {reference.sourceType ? <span className="studio-chip">{reference.sourceType}</span> : null}
                    <span className="studio-chip">{reference.status ?? "active"}</span>
                    {reference.sourceKeys.map((key) => (
                      <span key={key} className="studio-chip">
                        [{key}]
                      </span>
                    ))}
                  </div>

                  {runningEntry ? (
                    <div className={styles.slideBadgeRow}>
                      {runningEntry.displayNumbers.map((displayNumber) => (
                        <span key={`${reference.id}-${displayNumber}`} className={styles.slideBadge}>
                          Slide {displayNumber}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.helper}>Not currently linked into the running deck.</p>
                  )}

                  <p className={styles.citation}>{reference.citationText}</p>
                  {reference.summary ? <p className={styles.helper}>{reference.summary}</p> : null}
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
