/** Designed empty state when a verified historical series is not available. */
export function UnavailableHistory({
  label,
  reason = "No verified historical series is available for this input.",
}: {
  label: string;
  reason?: string;
}) {
  return (
    <div className="miniHistoryUnavailable" role="img" aria-label={`${label}: historical series unavailable`}>
      <svg viewBox="0 0 160 36" width="160" height="36" aria-hidden="true">
        <path d="M4 28 C28 28 36 12 56 18 S92 30 112 14 S140 8 156 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 4" opacity=".55" />
        <circle cx="56" cy="18" r="2.5" fill="currentColor" opacity=".35" />
        <circle cx="112" cy="14" r="2.5" fill="currentColor" opacity=".35" />
      </svg>
      <span>Historical series unavailable</span>
      <small>{reason}</small>
    </div>
  );
}
