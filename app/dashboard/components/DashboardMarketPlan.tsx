import { formatScoreDisplay, scoreIsDisplayable } from "../lib/score-display.ts";

type Props = {
  decisionReady: boolean;
  posture: string;
  bias: string;
  volatility: string | null;
  readiness: string | null;
  approach: string | null;
  score: number | null;
  rangeHigh: string | null;
  rangeLow: string | null;
  firstClose: string | null;
  bullishConfirm: string;
  bearishConfirm: string;
  invalidation: string;
  noTrade: string[];
  reviewTrigger: string;
  interpretation: string;
};

function pretty(value: string) {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

export function DashboardMarketPlan(props: Props) {
  const scoreReady = props.decisionReady && scoreIsDisplayable(props.score, props.decisionReady);
  return <section className="dashSection dashPlan" aria-labelledby="dash-plan-title">
    <header className="dashSectionHeader">
      <div>
        <span className="eliteEyebrow">TODAY&apos;S MARKET PLAN</span>
        <h2 id="dash-plan-title">{props.decisionReady ? pretty(props.posture) : "Stand aside until data is current"}</h2>
        <p>{props.decisionReady ? props.interpretation : "Directional planning stays closed while verified inputs are incomplete or outside the decision window."}</p>
      </div>
    </header>

    <dl className="dashPlanMeta">
      <div><dt>Market bias</dt><dd>{props.decisionReady ? pretty(props.bias) : "Not inferred"}</dd></div>
      <div><dt>Volatility</dt><dd>{props.decisionReady && props.volatility ? pretty(props.volatility) : "Not rated"}</dd></div>
      <div><dt>Execution readiness</dt><dd>{props.decisionReady && props.readiness ? pretty(props.readiness) : "Not ready"}</dd></div>
      <div><dt>Preferred approach</dt><dd>{props.decisionReady && props.approach ? pretty(props.approach) : "Wait for a current update"}</dd></div>
      <div><dt>Bullseye Score</dt><dd>{formatScoreDisplay(props.score, scoreReady)}</dd></div>
      <div><dt>Review trigger</dt><dd>{props.reviewTrigger}</dd></div>
    </dl>

    <div className="dashReferenceLevels" aria-label="Verified rolling range and reference levels">
      <h3>Verified rolling range and reference levels</h3>
      <p>These are rolling 24-hour candle observations, not labelled exchange support or resistance unless a deterministic structure rule applies.</p>
      <ul>
        <li><span>Verified rolling range high</span><strong>{props.rangeHigh ?? "Unavailable"}</strong></li>
        <li><span>Verified rolling range low</span><strong>{props.rangeLow ?? "Unavailable"}</strong></li>
        <li><span>First available close</span><strong>{props.firstClose ?? "Unavailable"}</strong></li>
      </ul>
    </div>

    <div className="dashPlanColumns">
      <article>
        <h3>Bullish confirmation</h3>
        <p>{props.decisionReady ? props.bullishConfirm : "Withheld until verified inputs support a directional case."}</p>
      </article>
      <article>
        <h3>Bearish confirmation</h3>
        <p>{props.decisionReady ? props.bearishConfirm : "Withheld until verified inputs support a directional case."}</p>
      </article>
      <article>
        <h3>No-trade / stand-aside</h3>
        {props.noTrade.length ? <ul>{props.noTrade.slice(0, 4).map((item) => <li key={item}>{pretty(item)}</li>)}</ul> : <p>No additional no-trade codes beyond the posture above.</p>}
        <p><strong>Invalidation</strong> {props.decisionReady ? props.invalidation : "Any unverified, stale or incomplete input."}</p>
      </article>
    </div>
  </section>;
}
