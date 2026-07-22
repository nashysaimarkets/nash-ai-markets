import { parsePriceLevel } from "./mini-visual-data.ts";

type Props = {
  twoYear: string | null | undefined;
  tenYear: string | null | undefined;
  ready: boolean;
};

/** Yield spread from verified quote scalars only (10Y − 2Y). */
export function YieldSpreadVisual({ twoYear, tenYear, ready }: Props) {
  const two = parsePriceLevel(twoYear);
  const ten = parsePriceLevel(tenYear);
  if (!ready || two == null || ten == null) {
    return (
      <div className="yieldSpread is-empty" aria-label="Yield spread unavailable">
        <span>10Y − 2Y spread</span>
        <strong>Unavailable</strong>
        <small>Requires verified 2-year and 10-year readings</small>
      </div>
    );
  }
  const spread = ten - two;
  const tone = spread > 0.35 ? "steep" : spread < 0 ? "inverted" : "flat";
  return (
    <div className={`yieldSpread is-${tone}`} aria-label={`Yield spread ${spread.toFixed(2)} percentage points`}>
      <span>10Y − 2Y spread</span>
      <strong>{spread >= 0 ? "+" : ""}{spread.toFixed(2)} pp</strong>
      <div className="yieldSpreadBars" aria-hidden="true">
        <i style={{ height: `${Math.min(100, Math.max(12, Math.abs(two) * 12))}%` }} title="2Y" />
        <i style={{ height: `${Math.min(100, Math.max(12, Math.abs(ten) * 12))}%` }} title="10Y" />
      </div>
      <small>{tone === "inverted" ? "Curve inverted on verified readings" : tone === "steep" ? "Curve steeper on verified readings" : "Curve near flat on verified readings"}</small>
    </div>
  );
}
