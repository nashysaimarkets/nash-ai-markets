import { positionPercent, type RangeLaneMarkers } from "./mini-visual-data.ts";

const format = (value: number) => value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Marker = { key: string; label: string; value: number; tone: "current" | "bound" | "ref" | "ema" };

type Props = {
  markers: RangeLaneMarkers | null | undefined;
  title?: string;
};

export function RangePositionLane({ markers, title = "Price within verified rolling 24h range" }: Props) {
  if (!markers) return null;
  const items: Marker[] = [
    { key: "low", label: "24H low", value: markers.low, tone: "bound" },
    { key: "high", label: "24H high", value: markers.high, tone: "bound" },
    { key: "current", label: "Current", value: markers.current, tone: "current" },
  ];
  if (markers.firstClose != null) items.push({ key: "first", label: "First close", value: markers.firstClose, tone: "ref" });
  if (markers.ema20 != null) items.push({ key: "ema20", label: "EMA 20", value: markers.ema20, tone: "ema" });
  if (markers.ema50 != null) items.push({ key: "ema50", label: "EMA 50", value: markers.ema50, tone: "ema" });

  return (
    <div className="miniRangeLane" role="img" aria-label={title}>
      <div className="miniRangeTrack" aria-hidden="true">
        <i className="miniRangeFill" style={{ width: `${positionPercent(markers.current, markers.low, markers.high)}%` }} />
        {items.map((item) => (
          <span
            key={item.key}
            className={`miniRangeMark is-${item.tone}`}
            style={{ left: `${positionPercent(item.value, markers.low, markers.high)}%` }}
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
