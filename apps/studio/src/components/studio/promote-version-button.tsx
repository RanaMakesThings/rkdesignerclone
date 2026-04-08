"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

export function PromoteVersionButton({
  projectId,
  slideId,
  versionId,
  disabled = false,
  label = "Make Current",
}: {
  projectId: string;
  slideId: string;
  versionId: string;
  disabled?: boolean;
  label?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "pending" | "success">("idle");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="promote-action">
      <button
        type="button"
        className="ghost-button"
        disabled={disabled || status !== "idle"}
        onClick={async () => {
          setStatus("pending");
          setError(null);
          try {
            const response = await fetch("/api/versions/promote", {
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
              throw new Error(payload?.error ?? `Promotion failed with ${response.status}`);
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
            setError(nextError instanceof Error ? nextError.message : "Promotion failed.");
          }
        }}
      >
        {status === "pending"
          ? "Promoting..."
          : status === "success"
            ? "Refreshing..."
            : label}
      </button>
      {status === "pending" ? (
        <p className="micro-copy" role="status" aria-live="polite">
          Updating the current stamped version…
        </p>
      ) : null}
      {status === "success" ? (
        <p className="micro-copy micro-copy-success" role="status" aria-live="polite">
          Current version updated. Refreshing the slide view…
        </p>
      ) : null}
      {error ? <p className="micro-copy micro-copy-danger">{error}</p> : null}
    </div>
  );
}
