import { positionPercent, type RangeLaneMarkers } from "./mini-visual-data.ts";

const format = (value: number) => value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Marker = { key: string; label: string; value: number; tone: "current" | "bound" | "ref" | "ema" };

type Props = {
  markers: RangeLaneMarkers | null | undefined;
  title?: string;
};

export function RangePositionLane({ markers, title = "Price within verified rolling 24h range" }: Props) {
  if (!markers) return null;
  const pct = positionPercent(markers.current, markers.low, markers.high);
  const toHigh = markers.high - markers.current;
  const toLow = markers.current - markers.low;
  const items: Marker[] = [
    { key: "low", label: "24H low", value: markers.low, tone: "bound" },
    { key: "high", label: "24H high", value: markers.high, tone: "bound" },
    { key: "current", label: "Current", value: markers.current, tone: "current" },
  ];
  if (markers.firstClose != null) items.push({ key: "first", label: "First close", value: markers.firstClose, tone: "ref" });
  if (markers.ema20 != null) items.push({ key: "ema20", label: "EMA 20", value: markers.ema20, tone: "ema" });
  if (markers.ema50 != null) items.push({ key: "ema50", label: "EMA 50", value: markers.ema50, tone: "ema" });

  // Nudge overlapping markers so labels stay readable without inventing price levels.
  const placed = items
    .map((item) => ({ ...item, pct: positionPercent(item.value, markers.low, markers.high) }))
    .sort((a, b) => a.pct - b.pct);
  for (let i = 1; i < placed.length; i += 1) {
    const prev = placed[i - 1]!;
    const curr = placed[i]!;
    if (curr.pct - prev.pct < 3.5) curr.pct = Math.min(100, prev.pct + 3.5);
  }

  return (
    <div className="miniRangeLane" role="img" aria-label={title}>
      <div className="miniRangeStats">
        <div><span>Range position</span><strong>{pct.toFixed(0)}%</strong></div>
        <div><span>Distance to high</span><strong>{format(toHigh)}</strong></div>
        <div><span>Distance to low</span><strong>{format(toLow)}</strong></div>
      </div>
      <div className="miniRangeTrack" aria-hidden="true">
        <i className="miniRangeFill" style={{ width: `${pct}%` }} />
        {placed.map((item) => (
          <span
            key={item.key}
            className={`miniRangeMark is-${item.tone}`}
            style={{ left: `${item.pct}%` }}
            title={`${item.label} ${format(item.value)}`}
          />
        ))}
      </div>
      <ul className="miniRangeLegend">
        {items.map((item) => (
          <li key={item.key} className={`is-${item.tone}`}>
            <span>{item.label}</span>
            <strong>{format(item.value)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
