import { parsePriceLevel } from "./mini-visual-data.ts";

type Props = {
  twoYear: string | null | undefined;
  tenYear: string | null | undefined;
  ready: boolean;
  compact?: boolean;
};

/** Yield curve from verified quote scalars only (10Y − 2Y). */
export function YieldSpreadVisual({ twoYear, tenYear, ready, compact = false }: Props) {
  const two = parsePriceLevel(twoYear);
  const ten = parsePriceLevel(tenYear);
  if (!ready || two == null || ten == null) {
    return (
      <div className={`yieldSpread is-empty${compact ? " is-compact" : ""}`} aria-label="Yield spread unavailable">
        <span>Rates curve</span>
        <strong>Unavailable</strong>
        <small>Needs verified 2Y and 10Y</small>
      </div>
    );
  }
  const spread = ten - two;
  const tone = spread > 0.35 ? "steep" : spread < 0 ? "inverted" : "flat";
  const y2 = 52 - Math.min(36, Math.max(8, two * 4));
  const y10 = 52 - Math.min(36, Math.max(8, ten * 4));
  return (
    <div className={`yieldSpread is-${tone}${compact ? " is-compact" : ""}`} aria-label={`Yield spread ${spread.toFixed(2)} percentage points`}>
      <span>10Y − 2Y · {tone}</span>
      <strong>{spread >= 0 ? "+" : ""}{spread.toFixed(2)} pp</strong>
      <svg className="yieldCurve" viewBox="0 0 140 64" width="140" height="64" aria-hidden="true">
        <line x1="16" y1="56" x2="124" y2="56" stroke="#2a3a34" strokeWidth="1" />
        <circle cx="36" cy={y2} r="4" fill="#68d7b4" />
        <circle cx="104" cy={y10} r="4" fill="#76cfd8" />
        <path d={`M36 ${y2} L104 ${y10}`} fill="none" stroke={tone === "inverted" ? "#ef7777" : "#68d7b4"} strokeWidth="2" />
        <text x="36" y="62" textAnchor="middle" fill="#7f8d93" fontSize="9">2Y</text>
        <text x="104" y="62" textAnchor="middle" fill="#7f8d93" fontSize="9">10Y</text>
      </svg>
      <small>{two.toFixed(2)}% → {ten.toFixed(2)}%</small>
    </div>
  );
}
