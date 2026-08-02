/** Compact semantic status chip — colour is never the only cue (label always present). */
export function StatusBadge({
  label,
  tone = "neutral",
  className = "",
}: {
  label: string;
  tone?: "positive" | "info" | "caution" | "warning" | "risk" | "neutral" | "muted";
  className?: string;
}) {
  return <span className={`dashStatusBadge is-${tone} ${className}`.trim()}>{label}</span>;
}
