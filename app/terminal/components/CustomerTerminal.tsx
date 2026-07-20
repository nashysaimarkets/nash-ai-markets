import type { MarketIntelligence } from "../../lib/market-intelligence-engine.ts";
import type { MarketSnapshot } from "../../lib/market-data.ts";
import type { TradePlan } from "../../lib/structured-trade-planner.ts";
import type { TradingDecision } from "../../lib/trading-decision-engine.ts";
import { TerminalBadge } from "./TerminalBadge";
import { createCustomerSignals, instrumentInterpretation } from "../lib/customer-terminal";

const pretty = (value: string) => value.replaceAll("_", " ").replaceAll("-", " ");
const instrumentLabels = ["ES futures", "VIX", "US 2-year", "US 10-year", "US Dollar Index"];
const symbols = ["ES", "VIX", "US2Y", "US10Y", "DXY"];

function confidenceCopy(score: number) {
  if (score >= 70) return "Higher alignment";
  if (score >= 45) return "Mixed alignment";
  return "Limited alignment";
}

export function MarketCommandHeader({ snapshot, state, timestamp }: { snapshot: MarketSnapshot; state: string; timestamp: string }) {
  const verified = snapshot.status === "LIVE" || snapshot.status === "DELAYED";
  return <section className="ctHero" aria-labelledby="terminal-title">
    <div>
      <span className="ctEyebrow">NASH AI MARKETS · ELITE INTELLIGENCE</span>
      <h1 id="terminal-title">Market Command</h1>
      <p>A focused view of today&apos;s verified cross-asset conditions, decision constraints and scenario readiness.</p>
    </div>
    <dl className="ctHeroMeta">
      <div><dt>Market data</dt><dd><TerminalBadge label={state} tone={state === "Live" ? "positive" : state === "Delayed" ? "warning" : "danger"} pulse={state === "Live"} /></dd></div>
      <div><dt>Last verified</dt><dd>{verified ? `${timestamp} UK` : "Awaiting first verified update"}</dd></div>
      <div><dt>Source</dt><dd>{verified ? snapshot.source : "Verified feed unavailable"}</dd></div>
    </dl>
  </section>;
}

export function TodaysMarketPlan({ snapshot, decision, plan }: { snapshot: MarketSnapshot; decision: TradingDecision; plan: TradePlan }) {
  const verified = snapshot.status === "LIVE" || snapshot.status === "DELAYED";
  const tone = decision.tradePermission === "actionable" ? "positive" : decision.tradePermission === "caution" ? "warning" : "danger";
  return <section className="ctPlan ctPanel" aria-labelledby="market-plan-title">
    <header><div><span>Today&apos;s market plan</span><h2 id="market-plan-title">{verified ? pretty(plan.directionalPosture) : "Stand aside until data is verified"}</h2></div><TerminalBadge label={pretty(decision.tradePermission)} tone={tone} /></header>
    <div className="ctPlanGrid">
      <div className="ctPrimaryMetric"><span>Decision confidence</span><strong>{verified ? `${decision.confidenceScore}%` : "Unavailable"}</strong><small>{verified ? confidenceCopy(decision.confidenceScore) : "No score is presented without verified inputs."}</small></div>
      <dl>
        <div><dt>Market bias</dt><dd>{verified ? pretty(decision.marketBias) : "Unavailable"}</dd></div>
        <div><dt>Risk level</dt><dd>{verified ? pretty(decision.riskRating) : "Unavailable"}</dd></div>
        <div><dt>Preferred approach</dt><dd>{verified ? pretty(plan.preferredSetupType) : "Wait for verification"}</dd></div>
        <div><dt>Participation</dt><dd>{verified ? pretty(plan.participationLevel) : "None"}</dd></div>
      </dl>
    </div>
    <p className="ctCaution">{verified ? "This is deterministic educational analysis. Confirm conditions independently before acting." : "The decision engine is fail-closed. It will not infer a plan from missing, stale or fallback observations."}</p>
  </section>;
}

export function CrossAssetBoard({ snapshot }: { snapshot: MarketSnapshot }) {
  const verified = snapshot.status === "LIVE" || snapshot.status === "DELAYED";
  return <section className="ctPanel" aria-labelledby="cross-asset-title">
    <header><div><span>Cross-asset board</span><h2 id="cross-asset-title">What the major inputs are saying</h2></div><small>Observed data</small></header>
    <div className="ctAssetGrid">{symbols.map((symbol, index) => {
      const quote = verified ? snapshot.quotes.find((item) => item.symbol === symbol) : undefined;
      return <article key={symbol}>
        <div><span>{instrumentLabels[index]}</span><small>{symbol}</small></div>
        <strong>{quote?.value ?? "Unavailable"}</strong>
        <span className={`ctMove is-${quote?.direction ?? "missing"}`}>{quote?.change ?? "Awaiting verified data"}</span>
        <p>{instrumentInterpretation(quote)}</p>
      </article>;
    })}</div>
  </section>;
}

export function MarketPressureMap({ snapshot, intelligence }: { snapshot: MarketSnapshot; intelligence: MarketIntelligence }) {
  const signals = createCustomerSignals(snapshot, intelligence);
  return <section className="ctPanel" aria-labelledby="pressure-map-title">
    <header><div><span>Market pressure map</span><h2 id="pressure-map-title">Support versus constraint</h2></div><small>Derived analysis</small></header>
    <div className="ctSignalList">{signals.map((signal) => <article key={signal.label}>
      <div><strong>{signal.label}</strong><span className={`ctStance is-${signal.stance}`}>{signal.stance}</span></div>
      <div className="ctSignalTrack" role="meter" aria-label={`${signal.label}: ${signal.stance}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={signal.stance === "unavailable" ? undefined : signal.score}><i style={{ width: `${signal.score}%` }} /></div>
      <p>{signal.stance === "unavailable" ? "Verified input unavailable; no directional conclusion is shown." : signal.explanation}</p>
    </article>)}</div>
  </section>;
}

export function DecisionEnginePanel({ snapshot, decision, plan }: { snapshot: MarketSnapshot; decision: TradingDecision; plan: TradePlan }) {
  const verified = snapshot.status === "LIVE" || snapshot.status === "DELAYED";
  const supporting = decision.topSupportingDrivers.slice(0, 3);
  const conflicts = decision.conflictingDrivers.slice(0, 3);
  return <section className="ctPanel" aria-labelledby="decision-engine-title">
    <header><div><span>Decision engine</span><h2 id="decision-engine-title">Evidence, conflict and invalidation</h2></div><small>Derived analysis</small></header>
    {verified ? <><div className="ctDecisionColumns">
      <div><h3>Supporting factors</h3>{supporting.length ? <ul>{supporting.map((item) => <li key={item.factor}>{pretty(item.factor)} <span>{item.score}/100</span></li>)}</ul> : <p>No material supporting factor is dominant.</p>}</div>
      <div><h3>Conflicting factors</h3>{conflicts.length ? <ul>{conflicts.map((item) => <li key={item.factor}>{pretty(item.factor)} <span>{item.score}/100</span></li>)}</ul> : <p>No material conflict identified in current inputs.</p>}</div>
      <div><h3>Required confirmation</h3>{plan.requiredConfirmations.length ? <ul>{plan.requiredConfirmations.slice(0, 4).map((item) => <li key={item}>{pretty(item)}</li>)}</ul> : <p>Recalculate after the next verified provider update.</p>}</div>
    </div>{decision.noTradeReasons.length || decision.dataQualityWarnings.length || plan.eventRiskWarnings.length ? <div className="ctConstraints"><strong>Conditions limiting participation</strong><ul>{[...decision.noTradeReasons, ...decision.dataQualityWarnings.map((warning) => `${warning.code}: ${warning.field}`), ...plan.eventRiskWarnings.map((warning) => warning.code)].map((item) => <li key={item}>{pretty(item)}</li>)}</ul></div> : null}</> : <div className="ctHonestEmpty"><strong>Decision evidence is unavailable</strong><p>Once every critical input is verified and current, Bullseye will show supporting factors, conflicts and confirmation conditions here.</p></div>}
  </section>;
}

export function WhatChanged() {
  return <section className="ctPanel ctCompactPanel" aria-labelledby="what-changed-title"><header><div><span>What changed</span><h2 id="what-changed-title">Previous comparison unavailable</h2></div></header><p>Bullseye has not retained a verified prior snapshot for this session. No change narrative has been inferred.</p></section>;
}
