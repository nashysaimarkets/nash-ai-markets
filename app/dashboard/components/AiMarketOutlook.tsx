type OutlookProps = {
  verified: boolean;
  bullish: string;
  bearish: string;
  neutral: string;
  expectedMove: string;
  keySupport: string;
  keyResistance: string;
  riskRating: string;
  aiConfidence: string;
  disclaimer: string;
};

function friendly(value: string): string {
  if (!value || value === "Unavailable" || value === "NULL" || value === "Undefined") {
    return "Not yet confirmed from verified feeds";
  }
  return value
    .replaceAll("CRITICAL_INPUT_MISSING", "required market inputs are incomplete")
    .replace(/\bUnavailable\b/g, "not yet confirmed from verified feeds");
}

export function AiMarketOutlook({
  verified,
  bullish,
  bearish,
  neutral,
  expectedMove,
  keySupport,
  keyResistance,
  riskRating,
  aiConfidence,
  disclaimer,
}: OutlookProps) {
  return (
    <section className="mccOutlook" aria-labelledby="mcc-outlook-title">
      <header>
        <div>
          <span className="mccEyebrow">AI MARKET OUTLOOK</span>
          <h2 id="mcc-outlook-title">Deterministic desk scenarios</h2>
          <p>Built from verified engine outputs only — never invented prices or guarantees.</p>
        </div>
        <div className={`mccOutlookState ${verified ? "is-verified" : "is-closed"}`}>
          <i aria-hidden="true" />
          <strong>{verified ? "Verified inputs" : "Awaiting inputs"}</strong>
        </div>
      </header>

      <div className="mccOutlookGrid">
        <article className="is-bull">
          <span>Bullish Scenario</span>
          <p>{friendly(bullish)}</p>
        </article>
        <article className="is-bear">
          <span>Bearish Scenario</span>
          <p>{friendly(bearish)}</p>
        </article>
        <article className="is-neutral">
          <span>Neutral / No Trade</span>
          <p>{friendly(neutral)}</p>
        </article>
        <article>
          <span>Expected Move</span>
          <strong>{friendly(expectedMove)}</strong>
        </article>
        <article>
          <span>Key Support</span>
          <strong>{friendly(keySupport)}</strong>
        </article>
        <article>
          <span>Key Resistance</span>
          <strong>{friendly(keyResistance)}</strong>
        </article>
        <article>
          <span>Risk Rating</span>
          <strong>{friendly(riskRating)}</strong>
        </article>
        <article>
          <span>AI Confidence</span>
          <strong>{friendly(aiConfidence)}</strong>
        </article>
      </div>

      <footer>{disclaimer}</footer>
    </section>
  );
}
