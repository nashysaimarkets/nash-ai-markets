import { positionPercent, type ScenarioLaneMarkers } from "./mini-visual-data.ts";

const format = (value: number) => value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Props = {
  markers: ScenarioLaneMarkers | null | undefined;
  tone: "bullish" | "bearish";
  label?: string;
};

export function ScenarioPositionLane({ markers, tone, label }: Props) {
  if (!markers) return null;
  const marks = [
    { key: "lower", label: "Lower ref", value: markers.lower, className: "is-bound" },
    { key: "upper", label: "Upper ref", value: markers.upper, className: "is-bound" },
    { key: "current", label: "Current", value: markers.current, className: "is-current" },
  ];
  if (markers.confirmation != null) marks.push({ key: "confirm", label: "Confirm", value: markers.confirmation, className: "is-confirm" });
  if (markers.invalidation != null) marks.push({ key: "invalidate", label: "Invalidate", value: markers.invalidation, className: "is-invalidate" });

  return (
    <div className={`miniScenarioLane is-${tone}`} role="img" aria-label={label ?? `${tone} scenario price position`}>
      <div className="miniScenarioTrack" aria-hidden="true">
        <i className="miniScenarioFill" style={{ width: `${positionPercent(markers.current, markers.lower, markers.upper)}%` }} />
        {marks.map((mark) => (
          <span
            key={mark.key}
            className={`miniScenarioMark ${mark.className}`}
            style={{ left: `${positionPercent(mark.value, markers.lower, markers.upper)}%` }}
            title={`${mark.label} ${format(mark.value)}`}
          />
        ))}
      </div>
      <ul className="miniScenarioLegend">
        {marks.map((mark) => (
          <li key={mark.key} className={mark.className}>
            <span>{mark.label}</span>
            <strong>{format(mark.value)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
