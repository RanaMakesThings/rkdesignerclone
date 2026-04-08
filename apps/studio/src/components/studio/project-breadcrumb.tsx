"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";

const prettySegment = (segment: string) =>
  segment
    .replace(/\[|\]/g, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());

export function ProjectBreadcrumb() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  if (!mounted) {
    return (
      <nav className="breadcrumb-row" aria-label="Breadcrumb">
        <Link href="/" className="breadcrumb-link">
          Studio
        </Link>
      </nav>
    );
  }

  const segments = pathname.split("/").filter(Boolean);
  const query = searchParams.toString();

  const crumbs = [];
  let current = "";
  for (const segment of segments) {
    current += `/${segment}`;
    if (segment === "projects" || segment === "slides") {
      continue;
    }
    crumbs.push({
      href: `${current}${query ? `?${query}` : ""}`,
      label: prettySegment(segment),
    });
  }

  return (
    <nav className="breadcrumb-row" aria-label="Breadcrumb">
      <Link href="/" className="breadcrumb-link">
        Studio
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.href} className="breadcrumb-item">
          <span className="breadcrumb-separator">/</span>
          <Link href={crumb.href} className="breadcrumb-link">
            {crumb.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}
