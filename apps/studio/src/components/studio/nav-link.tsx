"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function NavLink({
  href,
  label,
  match = "prefix",
}: {
  href: string;
  label: string;
  match?: "exact" | "prefix";
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active =
    match === "exact"
      ? pathname === href
      : pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
  const query = searchParams.toString();

  return (
    <Link
      href={`${href}${query ? `?${query}` : ""}`}
      className={active ? "nav-link nav-link-active" : "nav-link"}
    >
      {label}
    </Link>
  );
}
