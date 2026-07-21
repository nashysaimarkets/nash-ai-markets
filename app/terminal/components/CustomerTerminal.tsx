import type { MarketIntelligence } from "../../lib/market-intelligence-engine.ts";
import { formatSnapshotAge, hasDisplayableQuotes, isDecisionReadySnapshot, type MarketSnapshot } from "../../lib/market-data.ts";
import type { TradePlan } from "../../lib/structured-trade-planner.ts";
import type { TradingDecision } from "../../lib/trading-decision-engine.ts";
import { TerminalBadge } from "./TerminalBadge";
import { createCustomerSignals, instrumentInterpretation } from "../lib/customer-terminal";

const pretty = (value: string) => value.replaceAll("_", " ").replaceAll("-", " ");
const instrumentLabels = ["ES futures", "VIX", "US 2-year", "US 10-year", "US Dollar Index"];
const symbols = ["ES", "VIX", "US2Y", "US10Y", "DXY"] as const;

function confidenceCopy(score: number) {
  if (score >= 70) return "Higher alignment";
  if (score >= 45) return "Mixed alignment";
  return "Limited alignment";
}

function observationLabel(snapshot: MarketSnapshot) {
  if (snapshot.status === "LIVE") return "Live observation";
  if (snapshot.status === "DELAYED") return "Delayed observation";
  if (hasDisplayableQuotes(snapshot)) return "Previous session";
  return "Unavailable";
}

export function MarketCommandHeader({ snapshot, state, timestamp }: { snapshot: MarketSnapshot; state: string; timestamp: string }) {
  const decisionReady = isDecisionReadySnapshot(snapshot);
  const observable = hasDisplayableQuotes(snapshot);
  return <section className="ctHero" aria-labelledby="terminal-title">
    <div>
      <span className="ctEyebrow">NASH AI MARKETS · ELITE INTELLIGENCE</span>
      <h1 id="terminal-title">Market Command</h1>
      <p>A focused view of today&apos;s verified cross-asset conditions, decision constraints and scenario readiness.</p>
    </div>
    <dl className="ctHeroMeta">
      <div><dt>Market data</dt><dd><TerminalBadge label={observable && !decisionReady ? "Previous session" : state} tone={state === "Live" ? "positive" : state === "Delayed" || (observable && !decisionReady) ? "warning" : "danger"} pulse={state === "Live"} /></dd></div>
      <div><dt>Last verified</dt><dd>{observable ? `${timestamp} UK · ${formatSnapshotAge(snapshot.asOf)}` : "Awaiting first verified update"}</dd></div>
      <div><dt>Source</dt><dd>{observable ? observationLabel(snapshot) : "Verified feed unavailable"}</dd></div>
    </dl>
  </section>;
}

export function TodaysMarketPlan({ snapshot, decision, plan }: { snapshot: MarketSnapshot; decision: TradingDecision; plan: TradePlan }) {
  const decisionReady = isDecisionReadySnapshot(snapshot);
  const tone = decision.tradePermission === "actionable" ? "positive" : decision.tradePermission === "caution" ? "warning" : "danger";
  return <section className="ctPlan ctPanel" aria-labelledby="market-plan-title">
    <header><div><span>Today&apos;s market plan</span><h2 id="market-plan-title">{decisionReady ? pretty(plan.directionalPosture) : "Stand aside until data is current"}</h2></div><TerminalBadge label={pretty(decision.tradePermission)} tone={tone} /></header>
    <div className="ctPlanGrid">
      <div className="ctPrimaryMetric"><span>Decision confidence</span><strong>{decisionReady ? `${decision.confidenceScore}%` : "Withheld"}</strong><small>{decisionReady ? confidenceCopy(decision.confidenceScore) : "No score is presented without current verified inputs."}</small></div>
      <dl>
        <div><dt>Market bias</dt><dd>{decisionReady ? pretty(decision.marketBias) : "Not inferred"}</dd></div>
        <div><dt>Risk level</dt><dd>{decisionReady ? pretty(decision.riskRating) : "Unrated"}</dd></div>
        <div><dt>Preferred approach</dt><dd>{decisionReady ? pretty(plan.preferredSetupType) : "Wait for a current update"}</dd></div>
        <div><dt>Participation</dt><dd>{decisionReady ? pretty(plan.participationLevel) : "None"}</dd></div>
      </dl>
    </div>
    <p className="ctCaution">{decisionReady ? "This is deterministic educational analysis. Confirm conditions independently before acting." : `Last verified observation: ${formatSnapshotAge(snapshot.asOf)}. Directional planning stays closed until data is inside the current decision window.`}</p>
  </section>;
}

export function CrossAssetBoard({ snapshot }: { snapshot: MarketSnapshot }) {
  if (!hasDisplayableQuotes(snapshot)) return null;
  const decisionReady = isDecisionReadySnapshot(snapshot);
  return <section className="ctPanel" aria-labelledby="cross-asset-title">
    <header>
      <div><span>Cross-asset board</span><h2 id="cross-asset-title">What the major inputs are saying</h2></div>
      <small>{decisionReady ? "Verified observation" : `Previous session · ${formatSnapshotAge(snapshot.asOf)}`}</small>
    </header>
    <div className="ctAssetGrid">{symbols.map((symbol, index) => {
      const quote = snapshot.quotes.find((item) => item.symbol === symbol);
      return <article key={symbol}>
        <div><span>{instrumentLabels[index]}</span><small>{symbol}</small></div>
        <strong>{quote?.value ?? "Temporarily unavailable"}</strong>
        <span className={`ctMove is-${quote?.direction ?? "missing"}`}>{quote?.change ?? "No verified reading"}</span>
        <p>{quote ? instrumentInterpretation(quote) : "This instrument did not return a verified reading in the latest update."}</p>
      </article>;
    })}</div>
  </section>;
}

export function MarketPressureMap({ snapshot, intelligence }: { snapshot: MarketSnapshot; intelligence: MarketIntelligence }) {
  if (!isDecisionReadySnapshot(snapshot)) return null;
  const signals = createCustomerSignals(snapshot, intelligence);
  if (signals.every((signal) => signal.stance === "unavailable")) return null;
  return <section className="ctPanel" aria-labelledby="pressure-map-title">
    <header><div><span>Market pressure map</span><h2 id="pressure-map-title">Support versus constraint</h2></div><small>Derived from verified inputs · {formatSnapshotAge(snapshot.asOf)}</small></header>
    <div className="ctSignalList">{signals.map((signal) => <article key={signal.label}>
      <div><strong>{signal.label}</strong><span className={`ctStance is-${signal.stance}`}>{signal.stance}</span></div>
      <div className="ctSignalTrack" role="meter" aria-label={`${signal.label}: ${signal.stance}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={signal.stance === "unavailable" ? undefined : signal.score}><i style={{ width: `${signal.score}%` }} /></div>
      <p>{signal.stance === "unavailable" ? "Verified input unavailable; no directional conclusion is shown." : signal.explanation}</p>
    </article>)}</div>
  </section>;
}

export function DecisionEnginePanel({ snapshot, decision, plan }: { snapshot: MarketSnapshot; decision: TradingDecision; plan: TradePlan }) {
  if (!isDecisionReadySnapshot(snapshot)) return null;
  const supporting = decision.topSupportingDrivers.slice(0, 3);
  const conflicts = decision.conflictingDrivers.slice(0, 3);
  return <section className="ctPanel" aria-labelledby="decision-engine-title">
    <header><div><span>Decision engine</span><h2 id="decision-engine-title">Evidence, conflict and invalidation</h2></div><small>Derived analysis · {formatSnapshotAge(snapshot.asOf)}</small></header>
    <div className="ctDecisionColumns">
      <div><h3>Supporting factors</h3>{supporting.length ? <ul>{supporting.map((item) => <li key={item.factor}>{pretty(item.factor)} <span>{item.score}/100</span></li>)}</ul> : <p>No material supporting factor is dominant.</p>}</div>
      <div><h3>Conflicting factors</h3>{conflicts.length ? <ul>{conflicts.map((item) => <li key={item.factor}>{pretty(item.factor)} <span>{item.score}/100</span></li>)}</ul> : <p>No material conflict identified in current inputs.</p>}</div>
      <div><h3>Required confirmation</h3>{plan.requiredConfirmations.length ? <ul>{plan.requiredConfirmations.slice(0, 4).map((item) => <li key={item}>{pretty(item)}</li>)}</ul> : <p>Recalculate after the next verified provider update.</p>}</div>
    </div>
  </section>;
}

export function WhatChanged() {
  // Empty prior-snapshot cards are omitted from the customer terminal to keep the chart dominant.
  return null;
}
