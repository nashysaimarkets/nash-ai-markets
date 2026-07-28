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
    .replaceAll("CRITICAL_INPUT_MISSING", "Awaiting full confirmation from verified inputs")
    .replaceAll("Required market inputs are incomplete", "Awaiting full confirmation from verified inputs")
    .replaceAll("required market inputs are incomplete", "Awaiting full confirmation from verified inputs")
    .replaceAll("Stand aside", "Stand Aside")
    .replaceAll("stand aside", "Stand Aside")
    .replace(/\bmedium\b/g, "Medium")
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
          <h2 id="mcc-outlook-title">Bullish, Bearish &amp; Stand-Aside Scenarios</h2>
          <p>Scenario paths from verified engine outputs — never invented prices or guarantees.</p>
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
          <span>Neutral / Stand Aside</span>
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
