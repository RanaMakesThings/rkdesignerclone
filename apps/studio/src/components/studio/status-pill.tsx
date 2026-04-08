export function StatusPill({
  tone = "muted",
  children,
}: {
  tone?: "muted" | "accent" | "warning" | "danger";
  children: React.ReactNode;
}) {
  return <span className={`status-pill status-pill-${tone}`}>{children}</span>;
}
