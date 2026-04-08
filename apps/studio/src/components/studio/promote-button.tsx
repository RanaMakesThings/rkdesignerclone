"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

export function PromoteButton({
  projectId,
  slideId,
  candidateSource,
  candidateId,
  disabled = false,
  label = "Make Official",
}: {
  projectId: string;
  slideId: string;
  candidateSource: "canonical-variant" | "discovered-branch";
  candidateId: string;
  disabled?: boolean;
  label?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="promote-action">
      <button
        type="button"
        className="ghost-button"
        disabled={disabled || pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          try {
            const response = await fetch("/api/official/promote", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                projectId,
                slideId,
                candidateSource,
                candidateId,
              }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || payload?.ok === false) {
              throw new Error(payload?.error ?? `Promotion failed with ${response.status}`);
            }
            startTransition(() => {
              router.refresh();
            });
          } catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : "Promotion failed.");
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Promoting..." : label}
      </button>
      {error ? <p className="micro-copy micro-copy-danger">{error}</p> : null}
    </div>
  );
}
