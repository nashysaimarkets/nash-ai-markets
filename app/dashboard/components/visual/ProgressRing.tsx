/** Circular completion ring for checklist-style progress (0–total verified counts only). */
export function ProgressRing({
  completed,
  total,
  label = "Progress",
}: {
  completed: number;
  total: number;
  label?: string;
}) {
  const safeTotal = Math.max(0, total);
  const safeDone = Math.max(0, Math.min(completed, safeTotal));
  const pct = safeTotal > 0 ? (safeDone / safeTotal) * 100 : 0;
  const radius = 18;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ;

  return (
    <div
      className="dashProgressRing"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeTotal}
      aria-valuenow={safeDone}
    >
      <svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">
        <circle cx="22" cy="22" r={radius} className="dashProgressRingTrack" />
        <circle
          cx="22"
          cy="22"
          r={radius}
          className="dashProgressRingFill"
          style={{ strokeDasharray: `${circ}`, strokeDashoffset: `${offset}` }}
        />
      </svg>
      <strong>
        {safeDone}/{safeTotal}
      </strong>
    </div>
  );
}
