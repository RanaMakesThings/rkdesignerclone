"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RefreshButton({ projectId }: { projectId?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const onRefresh = async () => {
    setPending(true);
    try {
      const response = await fetch("/api/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(projectId ? { projectId } : {}),
      });
      if (!response.ok) {
        throw new Error(`Refresh endpoint returned ${response.status}`);
      }
    } catch {
      // Keep the button useful while cache invalidation is being wired.
      router.refresh();
    } finally {
      router.refresh();
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      className="ghost-button"
      disabled={pending}
      onClick={onRefresh}
    >
      {pending ? "Refreshing..." : "Refresh From Disk"}
    </button>
  );
}
