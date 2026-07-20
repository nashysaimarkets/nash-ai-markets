import Link from "next/link";

type TodaysEdgeProps = {
  verified: boolean;
  marketCondition: string;
  directionalBias: string;
  keyRisk: string;
  nextAction: string;
  dataLabel: string;
  lastUpdated: string;
  confidence: number | null;
  analysisMode: "AI assisted" | "Deterministic";
};

export function TodaysEdge({
  verified,
  marketCondition,
  directionalBias,
  keyRisk,
  nextAction,
  dataLabel,
  lastUpdated,
  confidence,
  analysisMode,
}: TodaysEdgeProps) {
  return (
    <section className={`todaysEdge ${verified ? "isVerified" : "isUnavailable"}`} aria-labelledby="todays-edge-title">
      <header>
        <div>
          <span className="eliteEyebrow">TODAY&apos;S EDGE · DECISION CONTEXT</span>
          <h2 id="todays-edge-title">{verified ? directionalBias : "Protect the process while data verifies."}</h2>
          <p>{verified ? marketCondition : "Bullseye is withholding directional analysis until the provider inputs required by the engine are complete."}</p>
        </div>
        <span className="todaysEdgeState"><i aria-hidden="true" />{verified ? "Evidence verified" : "Fail-closed"}</span>
      </header>
      <div className="todaysEdgeBody">
        <article><span>WHAT MATTERS</span><strong>{verified ? keyRisk : "Data quality before direction"}</strong><p>{verified ? nextAction : "Review the provider state, verified timestamp and event schedule before using current-session analysis."}</p></article>
        <dl aria-label="Analysis trust indicators">
          <div><dt>Analysis</dt><dd>{analysisMode}</dd><small>Grounded in deterministic engine evidence</small></div>
          <div><dt>Data freshness</dt><dd>{dataLabel}</dd><small>{lastUpdated}</small></div>
          <div><dt>Confidence</dt><dd>{confidence === null ? "Withheld" : `${confidence}/100`}</dd><small>{confidence === null ? "Requires verified inputs" : "Decision-support score, not certainty"}</small></div>
        </dl>
      </div>
      <footer>
        <span>Informational analysis · scenarios remain conditional</span>
        <Link href="/terminal">{verified ? "Inspect the full evidence" : "Open data-safe terminal"} <span aria-hidden="true">→</span></Link>
      </footer>
    </section>
  );
}
