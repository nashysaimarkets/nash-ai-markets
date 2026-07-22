/** Compact unavailable-history visual — never invents a series. */
export function UnavailableHistory({
  label,
  reason = "Verified scalar only",
}: {
  label: string;
  reason?: string;
}) {
  return (
    <div className="miniHistoryUnavailable" role="img" aria-label={`${label}: historical series unavailable`} title={reason}>
      <svg viewBox="0 0 160 48" width="160" height="48" aria-hidden="true">
        <rect x="4" y="8" width="152" height="32" rx="6" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 4" opacity=".4" />
        <path d="M18 30 C36 30 42 16 58 20 S90 34 108 18 S132 14 146 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 4" opacity=".55" />
      </svg>
      <span>History unavailable</span>
      <small>Verified scalar only</small>
    </div>
  );
}
