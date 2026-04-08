"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

import {
  HISTORY_FOCUS_VALUES,
  STUDIO_FOCUS_VALUES,
} from "@/lib/presentation/filters";

export function ProjectSearchForm() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isHistoryRoute = pathname.includes("/history");
  const focusOptions = isHistoryRoute ? HISTORY_FOCUS_VALUES : STUDIO_FOCUS_VALUES;

  const applyQuery = (formData: FormData) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    const value = String(formData.get("q") ?? "").trim();
    const focus = String(formData.get("focus") ?? "all").trim();
    if (value) {
      nextParams.set("q", value);
    } else {
      nextParams.delete("q");
    }
    if (focus && focus !== "all") {
      nextParams.set("focus", focus);
    } else {
      nextParams.delete("focus");
    }
    const query = nextParams.toString();
    router.push(`${pathname}${query ? `?${query}` : ""}`);
  };

  return (
    <form
      key={searchParams.toString()}
      className="toolbar-search"
      onSubmit={(event) => {
        event.preventDefault();
        applyQuery(new FormData(event.currentTarget));
      }}
    >
      <input
        name="q"
        className="toolbar-search-input"
        type="search"
        placeholder="Search slides, variants, paths"
        defaultValue={searchParams.get("q") ?? ""}
      />
      <select
        name="focus"
        className="toolbar-select"
        defaultValue={searchParams.get("focus") ?? "all"}
      >
        {focusOptions.map((option) => (
          <option key={option} value={option}>
            {option.replace(/-/g, " ")}
          </option>
        ))}
      </select>
      <button type="submit" className="ghost-button">
        Find
      </button>
    </form>
  );
}
