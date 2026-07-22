import type { MarketIntelligence } from "../../lib/market-intelligence-engine.ts";
import { formatSnapshotAge, hasDisplayableQuotes, isDecisionReadySnapshot, type MarketSnapshot } from "../../lib/market-data.ts";
import type { TradePlan } from "../../lib/structured-trade-planner.ts";
import type { TradingDecision } from "../../lib/trading-decision-engine.ts";
import { formatScoreDisplay, scoreIsDisplayable } from "../../dashboard/lib/score-display.ts";
import { Sparkline } from "../../components/mini-visuals/Sparkline.tsx";
import { RangePositionLane } from "../../components/mini-visuals/RangePositionLane.tsx";
import { ScenarioPositionLane } from "../../components/mini-visuals/ScenarioPositionLane.tsx";
import { EvidenceMeter } from "../../components/mini-visuals/EvidenceMeter.tsx";
import type { RangeLaneMarkers, ScenarioLaneMarkers } from "../../components/mini-visuals/mini-visual-data.ts";
import { TerminalBadge } from "./TerminalBadge";
import { createCustomerSignals, instrumentInterpretation } from "../lib/customer-terminal";

const pretty = (value: string) => value.replaceAll("_", " ").replaceAll("-", " ");
const instrumentLabels = ["ES futures", "VIX", "US 2-year", "US 10-year", "US Dollar Index"];
const symbols = ["ES", "VIX", "US2Y", "US10Y", "DXY"] as const;

function confidenceCopy(score: number) {
  if (score >= 70) return "Higher evidence agreement";
  if (score >= 45) return "Mixed evidence agreement";
  return "Limited evidence agreement";
}

export function MarketCommandHeader({
  snapshot,
  state,
  timestamp,
  bullseyeScore,
  posture,
}: {
  snapshot: MarketSnapshot;
  state: string;
  timestamp: string;
  bullseyeScore: number | null;
  posture: string | null;
}) {
  const decisionReady = isDecisionReadySnapshot(snapshot);
  const observable = hasDisplayableQuotes(snapshot);
  return <section className="ctHero" aria-labelledby="terminal-title">
    <div>
      <span className="ctEyebrow">NASH AI MARKETS · TERMINAL</span>
      <h1 id="terminal-title">Terminal</h1>
      <p>Verified cross-asset conditions, decision constraints and scenario readiness.</p>
    </div>
    <dl className="ctHeroMeta">
      <div><dt>Market data</dt><dd><TerminalBadge label={observable && !decisionReady ? "Previous session" : state} tone={state === "Live" ? "positive" : state === "Delayed" || (observable && !decisionReady) ? "warning" : "danger"} pulse={state === "Live"} /></dd></div>
      <div><dt>Last verified</dt><dd>{observable ? `${timestamp} UK · ${formatSnapshotAge(snapshot.asOf)}` : "Awaiting first verified update"}</dd></div>
      <div><dt>Bullseye Score</dt><dd>{formatScoreDisplay(bullseyeScore, decisionReady && scoreIsDisplayable(bullseyeScore, decisionReady))}</dd></div>
      <div><dt>Posture</dt><dd>{decisionReady && posture ? pretty(posture) : "Stand aside"}</dd></div>
    </dl>
  </section>;
}

export function TodaysMarketPlan({ snapshot, decision, plan }: { snapshot: MarketSnapshot; decision: TradingDecision; plan: TradePlan }) {
  const decisionReady = isDecisionReadySnapshot(snapshot);
  const tone = decision.tradePermission === "actionable" ? "positive" : decision.tradePermission === "caution" ? "warning" : "danger";
  const biasLabel = (() => {
    if (!decisionReady) return "Not inferred";
    if (decision.marketBias === "neutral" && decision.conflictingDrivers.length > 0) return "Mixed";
    return pretty(decision.marketBias);
  })();
  return <section className="ctPlan ctPanel" aria-labelledby="market-plan-title">
    <header><div><span>Today&apos;s market plan</span><h2 id="market-plan-title">{decisionReady ? pretty(plan.directionalPosture) : "Stand aside until data is current"}</h2></div><TerminalBadge label={pretty(decision.tradePermission)} tone={tone} /></header>
    <div className="ctPlanGrid">
      <div className="ctPrimaryMetric">
        <span>Bullseye Score</span>
        <strong>{formatScoreDisplay(decision.confidenceScore, decisionReady)}</strong>
        <EvidenceMeter label="Evidence" value={decision.confidenceScore} ready={decisionReady} />
        <small>{decisionReady ? confidenceCopy(decision.confidenceScore) : "No score is presented without current verified inputs. A missing score is not a bearish signal."}</small>
      </div>
      <dl>
        <div><dt>Market bias</dt><dd>{biasLabel}</dd></div>
        <div><dt>Risk level</dt><dd>{decisionReady ? pretty(decision.riskRating) : "Unrated"}</dd></div>
        <div><dt>Volatility</dt><dd>{decisionReady ? pretty(decision.volatilityRegime) : "Unrated"}</dd></div>
        <div><dt>Execution readiness</dt><dd>{decisionReady ? pretty(plan.executionReadiness) : "Not ready"}</dd></div>
        <div><dt>Preferred approach</dt><dd>{decisionReady ? pretty(plan.preferredSetupType) : "Wait for a current update"}</dd></div>
        <div><dt>Participation</dt><dd>{decisionReady ? pretty(plan.participationLevel) : "None"}</dd></div>
      </dl>
    </div>
    <p className="ctCaution">{decisionReady ? "This is deterministic educational analysis. Confirm conditions independently before acting." : `Last verified observation: ${formatSnapshotAge(snapshot.asOf)}. Directional planning stays closed until data is inside the current decision window.`}</p>
  </section>;
}

export function CrossAssetBoard({
  snapshot,
  sparklines,
}: {
  snapshot: MarketSnapshot;
  sparklines?: Partial<Record<(typeof symbols)[number], number[] | null>>;
}) {
  if (!hasDisplayableQuotes(snapshot)) {
    return <section className="ctPanel" aria-labelledby="cross-asset-title">
      <header><div><span>Cross-asset board</span><h2 id="cross-asset-title">What the major inputs are saying</h2></div></header>
      <div className="ctHonestEmpty">
        <strong>Verified cross-asset readings unavailable</strong>
        <p>ES futures, VIX, Treasury yields and the US dollar index stay hidden until the provider returns a verified observation. Missing readings are never shown as zero.</p>
      </div>
    </section>;
  }
  const decisionReady = isDecisionReadySnapshot(snapshot);
  return <section className="ctPanel" aria-labelledby="cross-asset-title">
    <header>
      <div><span>Cross-asset board</span><h2 id="cross-asset-title">What the major inputs are saying</h2></div>
      <small>{decisionReady ? "Verified observation" : `Previous session · ${formatSnapshotAge(snapshot.asOf)}`}</small>
    </header>
    <div className="ctAssetGrid">{symbols.map((symbol, index) => {
      const quote = snapshot.quotes.find((item) => item.symbol === symbol);
      const series = sparklines?.[symbol] ?? null;
      return <article key={symbol}>
        <div><span>{instrumentLabels[index]}</span><small>{symbol}</small></div>
        <strong>{quote?.value ?? "Unavailable"}</strong>
        <span className={`ctMove is-${quote?.direction ?? "missing"}`}>{quote?.change ?? "No verified reading"}</span>
        <Sparkline values={series} tone={quote?.direction ?? "neutral"} label={`${instrumentLabels[index]} verified recent closes`} />
        <p>{quote ? instrumentInterpretation(quote) : `${instrumentLabels[index]} had no verified reading in the latest update. The value is withheld rather than guessed.`}</p>
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
      <div><h3>Required confirmation</h3>{plan.requiredConfirmations.length ? <ul>{plan.requiredConfirmations.slice(0, 4).map((item) => <li key={item}>{pretty(item)}</li>)}</ul> : <p>Wait for the next verified market update before acting.</p>}</div>
    </div>
  </section>;
}

function trendCopy(score: number) {
  if (score >= 60) return { label: "Constructive", detail: "Trend evidence leans higher across the current verified inputs." };
  if (score <= 40) return { label: "Pressured", detail: "Trend evidence leans lower across the current verified inputs." };
  return { label: "Balanced", detail: "Trend evidence is not strongly directional in the current verified inputs." };
}

function momentumCopy(score: number | null) {
  if (score === null) return null;
  if (score >= 60) return { label: "Expanding", detail: "Momentum evidence is supportive in the latest verified reading." };
  if (score <= 40) return { label: "Fading", detail: "Momentum evidence is restrictive in the latest verified reading." };
  return { label: "Steady", detail: "Momentum evidence is balanced in the latest verified reading." };
}

function scenarioCondition(kind: string, level: string | null) {
  const action = pretty(kind);
  return level ? `${action} near ${level}` : action;
}

export function DecisionIntelligencePanel({
  snapshot,
  intelligence,
  decision,
  bullishLane,
  bearishLane,
}: {
  snapshot: MarketSnapshot;
  intelligence: MarketIntelligence;
  decision: TradingDecision;
  bullishLane?: ScenarioLaneMarkers | null;
  bearishLane?: ScenarioLaneMarkers | null;
}) {
  if (!isDecisionReadySnapshot(snapshot)) return null;
  const trend = trendCopy(intelligence.scores.trend);
  const momentumRaw = typeof snapshot.evidence.momentum === "number" && Number.isFinite(snapshot.evidence.momentum)
    ? snapshot.evidence.momentum
    : null;
  const momentum = momentumCopy(momentumRaw);
  const bullish = intelligence.scenarios.find((scenario) => scenario.type === "BULLISH");
  const bearish = intelligence.scenarios.find((scenario) => scenario.type === "BEARISH");
  return <section className="ctPanel ctIntelligence" aria-labelledby="decision-intelligence-title">
    <header>
      <div><span>Decision intelligence</span><h2 id="decision-intelligence-title">Why the current stance was reached</h2></div>
      <small>Evidence-based · {formatSnapshotAge(snapshot.asOf)}</small>
    </header>
    <div className="ctIntelStrip">
      <article>
        <span>Trend</span>
        <strong>{trend.label}</strong>
        <EvidenceMeter label="Trend evidence" value={intelligence.scores.trend} ready />
        <p>{trend.detail}</p>
      </article>
      {momentum ? <article>
        <span>Momentum</span>
        <strong>{momentum.label}</strong>
        <EvidenceMeter label="Momentum evidence" value={momentumRaw} ready />
        <p>{momentum.detail}</p>
      </article> : null}
      <article>
        <span>Volatility regime</span>
        <strong>{pretty(decision.volatilityRegime)}</strong>
        <EvidenceMeter label="Volatility evidence" value={intelligence.scores.volatility} ready />
        <p>Derived from verified volatility inputs and held closed when those inputs are incomplete.</p>
      </article>
      <article>
        <span>Risk rating</span>
        <strong>{pretty(decision.riskRating)}</strong>
        <EvidenceMeter label="Risk appetite" value={intelligence.scores.riskOnRiskOff} ready />
        <p>Overall participation risk from the current verified cross-asset set.</p>
      </article>
    </div>
    <div className="ctScenarioPair">
      {bullish ? <article>
        <span>Bullish scenario</span>
        <strong>Confirmation path</strong>
        <ScenarioPositionLane markers={bullishLane} tone="bullish" />
        <p><b>Confirmation</b> {scenarioCondition(bullish.trigger.kind, bullish.trigger.level)}</p>
        <p><b>Invalidation</b> {scenarioCondition(bullish.invalidation.kind, bullish.invalidation.level)}</p>
      </article> : null}
      {bearish ? <article>
        <span>Bearish scenario</span>
        <strong>Confirmation path</strong>
        <ScenarioPositionLane markers={bearishLane} tone="bearish" />
        <p><b>Confirmation</b> {scenarioCondition(bearish.trigger.kind, bearish.trigger.level)}</p>
        <p><b>Invalidation</b> {scenarioCondition(bearish.invalidation.kind, bearish.invalidation.level)}</p>
      </article> : null}
    </div>
  </section>;
}

export function StructureLevelsPanel({
  levels,
  recentRange,
  rangeLane,
}: {
  levels: Array<{ label: string; value: number; source: string }>;
  recentRange: number | null;
  rangeLane?: RangeLaneMarkers | null;
}) {
  if (!levels.length && recentRange === null && !rangeLane) return null;
  return <section className="ctPanel ctStructure" aria-labelledby="structure-levels-title">
    <header>
      <div><span>Verified rolling range</span><h2 id="structure-levels-title">Verified rolling range and reference levels</h2></div>
      <small>Rolling 24-hour candle observations · not labelled exchange support/resistance</small>
    </header>
    <RangePositionLane markers={rangeLane} />
    {levels.length ? <div className="ctLevelGrid">{levels.map((level) => <article key={level.label}>
      <span>{level.label}</span>
      <strong>{level.value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
      <p>{level.source}</p>
    </article>)}</div> : null}
    {recentRange !== null ? <p className="ctRangeNote"><strong>Recent verified candle range</strong> Average high-to-low across the latest verified candles: {recentRange.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. This describes observed movement only; it is not an expected-move forecast.</p> : null}
  </section>;
}

export function WhatChanged() {
  // Empty prior-snapshot cards are omitted from the customer terminal to keep the chart dominant.
  return null;
}
