"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type {
  StudioReference,
  StudioReferenceUsage,
} from "@/lib/presentation/designer-studio-types";

import styles from "./references-panel.module.css";

const placementOptions = ["proof", "footer", "speaker-notes", "appendix-only"];

const sortLibrary = (library: StudioReference[]) =>
  [...library].sort((left, right) => left.label.localeCompare(right.label));

function UsageEditor({
  projectId,
  usage,
}: {
  projectId: string;
  usage: StudioReferenceUsage;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [claim, setClaim] = useState(usage.claim);
  const [placement, setPlacement] = useState(usage.placement ?? "proof");
  const [sortKey, setSortKey] = useState(String(usage.sortKey ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

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
      throw new Error(result?.error ?? `Reference update failed with ${response.status}`);
    }
    setStatus(action === "deleteUsage" ? "Unlinked." : "Saved.");
    startTransition(() => {
      router.refresh();
    });
  };

  const parsedSortKey = sortKey.trim() ? Number(sortKey) : null;

  return (
    <article className={styles.row}>
      <div className={styles.rowHead}>
        <div>
          <p className="eyebrow">
            {usage.appendixNumber ? `Appendix ${usage.appendixNumber}` : "Linked Reference"}
          </p>
          <h3>{usage.reference?.label ?? usage.referenceId}</h3>
        </div>
        <div className={styles.rowMeta}>
          <span className="studio-chip">{usage.placement ?? "proof"}</span>
        </div>
      </div>

      <p className={styles.citation}>{usage.reference?.citationText ?? "Missing reference"}</p>

      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Placement</span>
          <select
            className={styles.select}
            value={placement}
            onChange={(event) => setPlacement(event.target.value)}
          >
            {placementOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Sort Key</span>
          <input
            className={styles.input}
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value)}
          />
        </label>
        <label className={`${styles.field} ${styles.fieldWide}`}>
          <span className={styles.fieldLabel}>Claim</span>
          <textarea
            className={styles.textarea}
            value={claim}
            onChange={(event) => setClaim(event.target.value)}
          />
        </label>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className="ghost-button"
          onClick={() =>
            void submitAction("updateUsage", {
              usageId: usage.id,
              claim,
              placement,
              sortKey: parsedSortKey,
            }).catch((nextError) =>
              setError(nextError instanceof Error ? nextError.message : "Save failed.")
            )
          }
          disabled={isPending}
        >
          Save
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={() =>
            void submitAction("deleteUsage", {
              usageId: usage.id,
            }).catch((nextError) =>
              setError(nextError instanceof Error ? nextError.message : "Unlink failed.")
            )
          }
          disabled={isPending}
        >
          Unlink
        </button>
        {status ? <span className={styles.status}>{status}</span> : null}
      </div>
      {error ? <p className="micro-copy micro-copy-danger">{error}</p> : null}
    </article>
  );
}

export function SlideReferencesPanel({
  projectId,
  slideId,
  references,
  library,
}: {
  projectId: string;
  slideId: string;
  references: {
    proofCitationKeys: string[];
    missingCitationKeys: string[];
    current: StudioReferenceUsage[];
    archived: StudioReferenceUsage[];
  };
  library: StudioReference[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [referenceId, setReferenceId] = useState("");
  const [claim, setClaim] = useState("");
  const [placement, setPlacement] = useState("proof");

  const currentReferenceIds = new Set(references.current.map((usage) => usage.referenceId));
  const availableLibrary = sortLibrary(
    library.filter((reference) => reference.status !== "archived" && !currentReferenceIds.has(reference.id))
  );

  const createUsage = async () => {
    setError(null);
    setStatus(null);

    const response = await fetch("/api/references", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId,
        action: "createUsage",
        payload: {
          slideId,
          referenceId,
          claim,
          placement,
        },
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.ok === false) {
      throw new Error(result?.error ?? `Reference link failed with ${response.status}`);
    }

    setReferenceId("");
    setClaim("");
    setPlacement("proof");
    setStatus("Linked reference.");
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <section className="asset-section">
      <div className="asset-group">
        <div className="asset-group-head">
          <div>
            <p className="eyebrow">Slide References</p>
            <h3>{references.current.length} current linked references</h3>
          </div>
          <div className="studio-chip-row">
            {references.proofCitationKeys.map((key) => (
              <span key={key} className="studio-chip">
                [{key}]
              </span>
            ))}
          </div>
        </div>

        {references.missingCitationKeys.length > 0 ? (
          <div className="inline-note">
            Proof markers still missing linked references:{" "}
            {references.missingCitationKeys.map((key) => `[${key}]`).join(", ")}.
          </div>
        ) : null}

        <div className={styles.stack}>
          <div className={styles.form}>
            <div>
              <p className="eyebrow">Link Existing Reference</p>
              <p className={styles.helper}>
                Pick a library record, then describe the claim it supports on this slide.
              </p>
            </div>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Reference</span>
                <select
                  className={styles.select}
                  value={referenceId}
                  onChange={(event) => setReferenceId(event.target.value)}
                >
                  <option value="">Select a reference</option>
                  {availableLibrary.map((reference) => (
                    <option key={reference.id} value={reference.id}>
                      {reference.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Placement</span>
                <select
                  className={styles.select}
                  value={placement}
                  onChange={(event) => setPlacement(event.target.value)}
                >
                  {placementOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span className={styles.fieldLabel}>Claim</span>
                <textarea
                  className={styles.textarea}
                  value={claim}
                  onChange={(event) => setClaim(event.target.value)}
                />
              </label>
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className="primary-link"
                onClick={() =>
                  void createUsage().catch((nextError) =>
                    setError(nextError instanceof Error ? nextError.message : "Link failed.")
                  )
                }
                disabled={isPending || !referenceId}
              >
                Link Reference
              </button>
              {status ? <span className={styles.status}>{status}</span> : null}
            </div>
            {error ? <p className="micro-copy micro-copy-danger">{error}</p> : null}
          </div>

          <div className={styles.list}>
            {references.current.length === 0 ? (
              <div className="empty-block">
                No current references are linked to this slide yet.
              </div>
            ) : (
              references.current.map((usage) => (
                <UsageEditor key={usage.id} projectId={projectId} usage={usage} />
              ))
            )}
          </div>

          {references.archived.length > 0 ? (
            <details className="asset-section">
              <summary className="asset-section-summary">
                <div>
                  <p className="eyebrow">Archived Usage</p>
                  <h3>{references.archived.length} archived links</h3>
                </div>
                <span className="asset-section-chevron" aria-hidden="true">
                  ▾
                </span>
              </summary>
              <div className={`${styles.list} ${styles.divider}`}>
                {references.archived.map((usage) => (
                  <article key={usage.id} className={styles.row}>
                    <div className={styles.rowHead}>
                      <div>
                        <p className="eyebrow">Archived</p>
                        <h3>{usage.reference?.label ?? usage.referenceId}</h3>
                      </div>
                    </div>
                    <p className={styles.citation}>{usage.reference?.citationText ?? "Missing reference"}</p>
                    {usage.claim ? <p className={styles.helper}>{usage.claim}</p> : null}
                  </article>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </section>
  );
}
