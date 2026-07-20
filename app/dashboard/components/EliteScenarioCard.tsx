type EliteScenarioCardProps = {
  tone: "bullish" | "bearish";
  verified: boolean;
  probability: number;
  trigger: string;
  level: string;
  invalidation: string;
};

const scenarioCopy = {
  bullish: {
    eyebrow: "BULLISH CASE",
    title: "Upside scenario",
    marker: "B",
    context: "Conditional upside path",
  },
  bearish: {
    eyebrow: "BEARISH CASE",
    title: "Downside scenario",
    marker: "S",
    context: "Conditional downside path",
  },
} as const;

export function EliteScenarioCard({
  tone,
  verified,
  probability,
  trigger,
  level,
  invalidation,
}: EliteScenarioCardProps) {
  const copy = scenarioCopy[tone];

  return (
    <article className={`eliteScenario is${tone === "bullish" ? "Bullish" : "Bearish"} ${verified ? "isResolved" : "isPending"}`}>
      <header>
        <div className="eliteScenarioIdentity">
          <i aria-hidden="true">{copy.marker}</i>
          <div><span>{copy.eyebrow}</span><h2>{copy.title}</h2><small>{copy.context} · not a prediction</small></div>
        </div>
        <div className="eliteScenarioProbability">
          <span>{verified ? "ENGINE WEIGHT" : "STATUS"}</span>
          <strong>{verified ? `${probability}%` : "PENDING"}</strong>
        </div>
      </header>
      <div className="eliteScenarioMeter" aria-hidden="true"><i style={{ width: `${verified ? probability : 0}%` }} /></div>
      {verified ? (
        <dl>
          <div><dt><b aria-hidden="true">01</b> Confirmation</dt><dd>{trigger}</dd></div>
          <div><dt><b aria-hidden="true">02</b> Reference level</dt><dd>{level}</dd></div>
          <div><dt><b aria-hidden="true">03</b> Invalidation</dt><dd>{invalidation}</dd></div>
        </dl>
      ) : (
        <div className="eliteScenarioPending" role="status">
          <strong>Scenario held until evidence verifies</strong>
          <p>No directional probability, trigger or level is published from incomplete inputs.</p>
          <ol aria-label="Scenario verification workflow">
            <li><span>01</span>Observe provider state</li>
            <li><span>02</span>Verify required inputs</li>
            <li><span>03</span>Reassess the plan</li>
          </ol>
        </div>
      )}
      <footer><span>Derived analysis</span><strong>{verified ? "Review confirmation and invalidation together" : "Fail-closed safety active"}</strong></footer>
    </article>
  );
}
