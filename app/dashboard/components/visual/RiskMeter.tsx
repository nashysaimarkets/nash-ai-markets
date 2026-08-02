/**
 * Segmented risk meter driven by existing permission/risk tone — not a fabricated score.
 */
export function RiskMeter({
  label,
  tone,
}: {
  label: string;
  tone: "open" | "caution" | "blocked" | "neutral" | string;
}) {
  const level =
    tone === "blocked" || tone === "risk" ? 3 : tone === "caution" || tone === "warning" ? 2 : tone === "open" || tone === "positive" ? 1 : 0;
  const segments = ["Contained", "Watch", "Elevated"];
  const activeIndex = level === 0 ? -1 : level - 1;

  return (
    <div
      className={`dashRiskMeter is-${tone}`}
      role="meter"
      aria-label={`Risk: ${label}`}
      aria-valuetext={label}
      aria-valuemin={0}
      aria-valuemax={3}
      aria-valuenow={level}
    >
      <span className="dashRiskMeterLabel">Risk</span>
      <strong>{label}</strong>
      <div className="dashRiskMeterTrack" aria-hidden="true">
        {segments.map((name, index) => (
          <i key={name} className={index <= activeIndex ? "is-on" : undefined} title={name} />
        ))}
      </div>
      <small>{level === 0 ? "Awaiting verified risk framing" : segments[activeIndex]}</small>
    </div>
  );
}
