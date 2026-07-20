const metrics = [
  { value: "3", label: "Scenario paths", copy: "Bullish, bearish and stand-aside conditions" },
  { value: "4", label: "Decision stages", copy: "Verify, assess, plan and decide" },
  { value: "100", label: "Point confidence scale", copy: "Shown only when required evidence verifies" },
  { value: "0", label: "Guaranteed outcomes", copy: "Uncertainty and risk remain visible" },
] as const;

export function ConversionMetrics() {
  return (
    <section className="mcMetrics" aria-labelledby="metrics-title">
      <header><p className="mcEyebrow">Measured by process, not promises</p><h2 id="metrics-title">A decision framework you can inspect.</h2><p>These are product-structure metrics—not returns, win rates or performance claims.</p></header>
      <div>
        {metrics.map((metric) => <article key={metric.label}>
          <strong>{metric.value}</strong>
          <h3>{metric.label}</h3>
          <p>{metric.copy}</p>
        </article>)}
      </div>
    </section>
  );
}
