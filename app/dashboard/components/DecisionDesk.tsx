import type { DecisionDeskModel } from "../lib/decision-desk.ts";

type DecisionDeskProps = {
  desk: DecisionDeskModel;
};

function BiasIcon({ tone }: { tone: DecisionDeskModel["marketBias"]["tone"] }) {
  if (tone === "bull") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="mccDeskIcon">
        <path d="M5 16 L12 7 L19 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (tone === "bear") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="mccDeskIcon">
        <path d="M5 8 L12 17 L19 8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="mccDeskIcon">
      <path d="M5 12 H19" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function MeterIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="mccDeskIcon">
      <path d="M4 16a8 8 0 0 1 16 0" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 16 L17 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1.6" fill="currentColor" />
    </svg>
  );
}

export function DecisionDesk({ desk }: DecisionDeskProps) {
  const meterWidth = desk.confidence.score == null ? 8 : Math.max(8, Math.min(100, desk.confidence.score));
  const meterTone = desk.confidence.band === "Strong" || desk.confidence.band === "High"
    ? "is-high"
    : desk.confidence.band === "Moderate"
      ? "is-mid"
      : desk.confidence.band === "Low"
        ? "is-low"
        : "is-pending";

  return (
    <section className="mccDecisionDesk" aria-labelledby="mcc-decision-desk-title">
      <header className="mccDecisionDeskHeader">
        <div>
          <span className="mccEyebrow">DECISION DESK™</span>
          <h2 id="mcc-decision-desk-title">Market diagnosis</h2>
          <p>Bias, structure and thesis from verified Bullseye engines.</p>
        </div>
        <div className={`mccOutlookState ${desk.verified ? "is-verified" : "is-closed"}`}>
          <i aria-hidden="true" />
          <strong>{desk.verified ? "Verified window" : "Awaiting inputs"}</strong>
        </div>
      </header>

      <div className="mccDecisionMetrics">
        <article className={`mccDecisionMetric is-${desk.marketBias.tone}`}>
          <span>Market Bias</span>
          <strong>
            <BiasIcon tone={desk.marketBias.tone} />
            {desk.marketBias.label}
          </strong>
        </article>
        <article className="mccDecisionMetric">
          <span>Trend</span>
          <strong>{desk.trend.label}</strong>
        </article>
        <article className="mccDecisionMetric">
          <span>Volatility</span>
          <strong>{desk.volatility.label}</strong>
        </article>
        <article className="mccDecisionMetric">
          <span>Market Structure</span>
          <strong>{desk.marketStructure.label}</strong>
        </article>
        <article className="mccDecisionMetric">
          <span>Session</span>
          <strong>{desk.sessionStatus.label}</strong>
        </article>
        <article className="mccDecisionMetric">
          <span>Expected Move</span>
          <strong>{desk.expectedMove.label}</strong>
        </article>
      </div>

      <div className="mccDecisionPanels mccDecisionPanelsCompact">
        <article className="mccDecisionThesis">
          <span className="mccEyebrow">TRADE THESIS</span>
          <h3>Market summary</h3>
          <p>{desk.tradeThesis}</p>
        </article>

        <article className={`mccDecisionConfidence ${meterTone}`}>
          <header>
            <div>
              <span className="mccEyebrow">CONFIDENCE</span>
              <h3>
                <MeterIcon />
                {desk.confidence.band === "Awaiting inputs"
                  ? "Awaiting verified inputs"
                  : `${desk.confidence.band} Confidence`}
              </h3>
            </div>
          </header>
          <div className="mccConfidenceMeter" role="img" aria-label={`Confidence meter at ${meterWidth} percent`}>
            <span style={{ width: `${meterWidth}%` }} />
          </div>
          <p className="mccConfidenceWhy">{desk.confidence.why}</p>
        </article>
      </div>
    </section>
  );
}
