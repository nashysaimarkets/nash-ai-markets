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
          <h2 id="mcc-decision-desk-title">Today&apos;s Decision Desk</h2>
          <p>Verified Bullseye engines only — educational preparation, never invented prices.</p>
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
          <p>{desk.trend.detail}</p>
        </article>
        <article className="mccDecisionMetric">
          <span>Volatility</span>
          <strong>{desk.volatility.label}</strong>
          <p>{desk.volatility.detail}</p>
        </article>
        <article className="mccDecisionMetric">
          <span>Market Structure</span>
          <strong>{desk.marketStructure.label}</strong>
          <p>{desk.marketStructure.detail}</p>
        </article>
        <article className="mccDecisionMetric">
          <span>Session Status</span>
          <strong>{desk.sessionStatus.label}</strong>
          <p>{desk.sessionStatus.detail}</p>
        </article>
        <article className="mccDecisionMetric">
          <span>Expected Move</span>
          <strong>{desk.expectedMove.label}</strong>
          <p>{desk.expectedMove.detail}</p>
        </article>
      </div>

      <div className="mccDecisionPanels">
        <article className="mccDecisionThesis">
          <span className="mccEyebrow">TRADE THESIS</span>
          <h3>Market summary</h3>
          <p>{desk.tradeThesis}</p>
        </article>

        <article className={`mccDecisionOpportunity ${desk.opportunity.available ? "is-open" : "is-closed"}`}>
          <span className="mccEyebrow">BEST OPPORTUNITY</span>
          <h3>{desk.opportunity.available ? "Highest Probability Setup" : "Setup status"}</h3>
          <p className="mccOpportunityHeadline">{desk.opportunity.headline}</p>
          <dl className="mccOpportunityGrid">
            <div>
              <dt>Preferred Direction</dt>
              <dd>{desk.opportunity.preferredDirection}</dd>
            </div>
            <div>
              <dt>Entry Zone</dt>
              <dd>{desk.opportunity.entryZone}</dd>
            </div>
            <div>
              <dt>Invalidation</dt>
              <dd>{desk.opportunity.invalidation}</dd>
            </div>
            <div>
              <dt>Target Area</dt>
              <dd>{desk.opportunity.targetArea}</dd>
            </div>
            <div>
              <dt>Risk Level</dt>
              <dd>{desk.opportunity.riskLevel}</dd>
            </div>
          </dl>
        </article>

        <article className={`mccDecisionConfidence ${meterTone}`}>
          <header>
            <div>
              <span className="mccEyebrow">CONFIDENCE</span>
              <h3>
                <MeterIcon />
                {desk.confidence.band === "Awaiting inputs"
                  ? "Confidence awaiting verified inputs"
                  : `${desk.confidence.band} Confidence`}
              </h3>
            </div>
            {desk.confidence.score != null ? (
              <small aria-hidden="true">{desk.confidence.score}</small>
            ) : null}
          </header>
          <div className="mccConfidenceMeter" role="img" aria-label={`Confidence meter at ${meterWidth} percent`}>
            <span style={{ width: `${meterWidth}%` }} />
          </div>
          <p className="mccConfidenceWhy">{desk.confidence.why}</p>
          <ul className="mccConfidenceFactors">
            {desk.confidence.factors.map((factor) => (
              <li key={factor.label}>
                <strong>{factor.label}</strong>
                <span>{factor.detail}</span>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
