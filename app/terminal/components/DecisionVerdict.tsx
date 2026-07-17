type DecisionVerdictProps = {
  overallBias: string;
  confidenceScore: number;
  tradeRating: string;
  riskLevel: string;
  suggestedDirection: string;
  entryZone: string;
  stopZone: string;
  profitTarget1: string;
  profitTarget2: string;
  noTradeWarning?: string;
};

export function DecisionVerdict({
  overallBias,
  confidenceScore,
  tradeRating,
  riskLevel,
  suggestedDirection,
  entryZone,
  stopZone,
  profitTarget1,
  profitTarget2,
  noTradeWarning,
}: DecisionVerdictProps) {
  const isNoTrade = Boolean(noTradeWarning);

  return (
    <section className={`decisionVerdict ${isNoTrade ? "decisionVerdict-noTrade" : ""}`}>
      <div className="decisionVerdictHeader">
        <div>
          <span className="terminalPanelEyebrow">MARKET VERDICT</span>
          <h2>{overallBias}</h2>
        </div>
        <div className="decisionBadge">
          <strong>{tradeRating}</strong>
          <span>{confidenceScore}% confidence</span>
        </div>
      </div>

      <div className="decisionVerdictGrid">
        <article>
          <span>Risk level</span>
          <strong>{riskLevel}</strong>
        </article>
        <article>
          <span>Suggested direction</span>
          <strong>{suggestedDirection}</strong>
        </article>
        <article>
          <span>Entry zone</span>
          <strong>{entryZone}</strong>
        </article>
        <article>
          <span>Stop zone</span>
          <strong>{stopZone}</strong>
        </article>
        <article>
          <span>Profit target 1</span>
          <strong>{profitTarget1}</strong>
        </article>
        <article>
          <span>Profit target 2</span>
          <strong>{profitTarget2}</strong>
        </article>
      </div>

      {noTradeWarning ? <p className="decisionWarning">{noTradeWarning}</p> : null}
    </section>
  );
}
