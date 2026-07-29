type Props = {
  regime: string | null;
  ready: boolean;
  vixValue?: string | null;
  compact?: boolean;
};

/** Semicircular VIX regime gauge from verified decision engine — not a forecast. */
export function VolatilityGauge({ regime, ready, vixValue = null, compact = false }: Props) {
  if (!ready || !regime) {
    return (
      <div className={`volGauge is-empty${compact ? " is-compact" : ""}`} aria-label="Volatility regime not calculated">
        <span>Volatility regime</span>
        <strong>Not rated</strong>
        <small>Awaiting verified inputs</small>
      </div>
    );
  }
  const order = ["compressed", "normal", "elevated", "extreme"] as const;
  const index = Math.max(0, order.indexOf(regime as (typeof order)[number]));
  const sweep = 20 + index * 50;
  return (
    <div className={`volGauge is-${regime}${compact ? " is-compact" : ""}`} aria-label={`Volatility regime ${regime}`}>
      <span>Volatility regime</span>
      <div className="volGaugeDial" aria-hidden="true">
        <svg viewBox="0 0 120 70" width="120" height="70">
          <path d="M14 58 A46 46 0 0 1 106 58" fill="none" stroke="#223039" strokeWidth="10" strokeLinecap="round" />
          <path d="M14 58 A46 46 0 0 1 106 58" fill="none" stroke="#68d7b4" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${sweep} 200`} opacity=".9" />
          <circle cx="60" cy="58" r="3.5" fill="#d9ab52" />
        </svg>
      </div>
      <strong>{regime.replaceAll("_", " ")}</strong>
      {vixValue ? <em>VIX {vixValue}</em> : null}
    </div>
  );
}
