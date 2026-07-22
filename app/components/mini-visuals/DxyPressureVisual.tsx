type Props = {
  direction: "up" | "down" | "flat" | undefined;
  change: string | null | undefined;
  ready: boolean;
};

/** DXY pressure cue from verified quote direction only. */
export function DxyPressureVisual({ direction, change, ready }: Props) {
  if (!ready || !direction) {
    return (
      <div className="dxyPressure is-empty" aria-label="Dollar pressure unavailable">
        <span>Dollar pressure</span>
        <strong>Unavailable</strong>
        <small>Awaiting a verified DXY reading</small>
      </div>
    );
  }
  const label = direction === "up" ? "Firmer dollar" : direction === "down" ? "Softer dollar" : "Steady dollar";
  return (
    <div className={`dxyPressure is-${direction}`} aria-label={`Dollar pressure ${label}`}>
      <span>Dollar pressure</span>
      <strong>{label}</strong>
      <div className="dxyPressureMeter" aria-hidden="true"><i /></div>
      <small>{change ?? "Change unavailable"} · conditional context only</small>
    </div>
  );
}
