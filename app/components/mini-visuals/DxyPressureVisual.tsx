type Props = {
  direction: "up" | "down" | "flat" | undefined;
  change: string | null | undefined;
  ready: boolean;
  compact?: boolean;
};

/** DXY pressure scale from verified quote direction only. */
export function DxyPressureVisual({ direction, change, ready, compact = false }: Props) {
  if (!ready || !direction) {
    return (
      <div className={`dxyPressure is-empty${compact ? " is-compact" : ""}`} aria-label="Dollar pressure unavailable">
        <span>Dollar pressure</span>
        <strong>Unavailable</strong>
        <small>Awaiting verified DXY</small>
      </div>
    );
  }
  const label = direction === "up" ? "Stronger" : direction === "down" ? "Softer" : "Neutral";
  const position = direction === "up" ? 82 : direction === "down" ? 18 : 50;
  return (
    <div className={`dxyPressure is-${direction}${compact ? " is-compact" : ""}`} aria-label={`Dollar pressure ${label}`}>
      <span>Dollar pressure</span>
      <strong>{label}</strong>
      <div className="dxyPressureScale" aria-hidden="true">
        <i className="dxyPressureTrack" />
        <i className="dxyPressureMarker" style={{ left: `${position}%` }} />
        <span>Softer</span>
        <span>Neutral</span>
        <span>Stronger</span>
      </div>
      <small>{change ?? "Change unavailable"}</small>
    </div>
  );
}
