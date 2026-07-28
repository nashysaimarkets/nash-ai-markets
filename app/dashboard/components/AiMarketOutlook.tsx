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
          <strong>{verified ? "Verified inputs" : "Fail-closed"}</strong>
        </div>
      </header>

      <div className="mccOutlookGrid">
        <article className="is-bull">
          <span>Bullish Scenario</span>
          <p>{bullish}</p>
        </article>
        <article className="is-bear">
          <span>Bearish Scenario</span>
          <p>{bearish}</p>
        </article>
        <article className="is-neutral">
          <span>Neutral / No Trade</span>
          <p>{neutral}</p>
        </article>
        <article>
          <span>Expected Move</span>
          <strong>{expectedMove}</strong>
        </article>
        <article>
          <span>Key Support</span>
          <strong>{keySupport}</strong>
        </article>
        <article>
          <span>Key Resistance</span>
          <strong>{keyResistance}</strong>
        </article>
        <article>
          <span>Risk Rating</span>
          <strong>{riskRating}</strong>
        </article>
        <article>
          <span>AI Confidence</span>
          <strong>{aiConfidence}</strong>
        </article>
      </div>

      <footer>{disclaimer}</footer>
    </section>
  );
}
