"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

export function NormalizeVersionButton({
  projectId,
  slideId,
  versionId,
}: {
  projectId: string;
  slideId: string;
  versionId: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "pending" | "success">("idle");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="promote-action">
      <button
        type="button"
        className="ghost-button"
        disabled={status !== "idle"}
        onClick={async () => {
          setStatus("pending");
          setError(null);
          try {
            const response = await fetch("/api/versions/normalize-css", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                projectId,
                slideId,
                versionId,
              }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || payload?.ok === false) {
              throw new Error(payload?.error ?? `Normalize failed with ${response.status}`);
            }
            setStatus("success");
            await new Promise((resolve) => {
              window.setTimeout(resolve, 250);
            });
            startTransition(() => {
              router.refresh();
            });
          } catch (nextError) {
            setStatus("idle");
            setError(nextError instanceof Error ? nextError.message : "Normalize failed.");
          }
        }}
      >
        {status === "pending"
          ? "Normalizing..."
          : status === "success"
            ? "Refreshing..."
            : "Normalize CSS"}
      </button>
      {status === "pending" ? (
        <p className="micro-copy" role="status" aria-live="polite">
          Creating a shared-CSS draft from this version…
        </p>
      ) : null}
      {status === "success" ? (
        <p className="micro-copy micro-copy-success" role="status" aria-live="polite">
          Shared-CSS draft created. Refreshing the slide view…
        </p>
      ) : null}
      {error ? <p className="micro-copy micro-copy-danger">{error}</p> : null}
    </div>
  );
}
