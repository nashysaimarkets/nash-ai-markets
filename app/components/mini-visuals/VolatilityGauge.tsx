type Props = {
  regime: string | null;
  ready: boolean;
  vixValue?: string | null;
};

/** Compact VIX regime meter from the verified decision engine — not a forecast. */
export function VolatilityGauge({ regime, ready, vixValue = null }: Props) {
  if (!ready || !regime) {
    return (
      <div className="volGauge is-empty" aria-label="Volatility regime not calculated">
        <span>Volatility regime</span>
        <strong>Not rated</strong>
        <small>Awaiting verified volatility inputs</small>
      </div>
    );
  }
  const order = ["compressed", "normal", "elevated", "extreme"] as const;
  const index = Math.max(0, order.indexOf(regime as (typeof order)[number]));
  return (
    <div className={`volGauge is-${regime}`} aria-label={`Volatility regime ${regime}`}>
      <span>Volatility regime</span>
      <strong>{regime.replaceAll("_", " ")}</strong>
      {vixValue ? <em>VIX {vixValue}</em> : null}
      <div className="volGaugeTrack" aria-hidden="true">
        {order.map((item, i) => <i key={item} className={i <= index ? "is-on" : undefined} />)}
      </div>
    </div>
  );
}
