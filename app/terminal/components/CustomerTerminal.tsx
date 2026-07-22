import type { MarketIntelligence } from "../../lib/market-intelligence-engine.ts";
import { formatSnapshotAge, hasDisplayableQuotes, isDecisionReadySnapshot, type MarketSnapshot } from "../../lib/market-data.ts";
import type { MarketDeskSignals } from "../../lib/market-desk-signals.ts";
import type { MarketDirectionalGauges, InstrumentDirectionalGauge } from "../../lib/market-directional-gauges.ts";
import type { MarketStructureLevels, InstrumentStructureLevels } from "../../lib/market-structure-levels.ts";
import { MARKET_BOARD_LABELS, MARKET_BOARD_SYMBOLS, type MarketBoardSymbol } from "../../lib/market-board-instruments.ts";
import type { TradePlan } from "../../lib/structured-trade-planner.ts";
import type { TradingDecision } from "../../lib/trading-decision-engine.ts";
import { formatScoreDisplay } from "../../dashboard/lib/score-display.ts";
import { Sparkline } from "../../components/mini-visuals/Sparkline.tsx";
import { UnavailableHistory } from "../../components/mini-visuals/UnavailableHistory.tsx";
import { RangePositionLane } from "../../components/mini-visuals/RangePositionLane.tsx";
import { ScenarioPositionLane } from "../../components/mini-visuals/ScenarioPositionLane.tsx";
import { EvidenceMeter } from "../../components/mini-visuals/EvidenceMeter.tsx";
import { BullseyeGauge } from "../../components/mini-visuals/BullseyeGauge.tsx";
import { VolatilityGauge } from "../../components/mini-visuals/VolatilityGauge.tsx";
import { YieldSpreadVisual } from "../../components/mini-visuals/YieldSpreadVisual.tsx";
import { DxyPressureVisual } from "../../components/mini-visuals/DxyPressureVisual.tsx";
import type { RangeLaneMarkers, ScenarioLaneMarkers } from "../../components/mini-visuals/mini-visual-data.ts";
import { TerminalBadge } from "./TerminalBadge";
import { createCustomerSignals, instrumentInterpretation } from "../lib/customer-terminal";

const pretty = (value: string) => value.replaceAll("_", " ").replaceAll("-", " ");
const symbols = MARKET_BOARD_SYMBOLS;
const instrumentLabels = MARKET_BOARD_SYMBOLS.map((symbol) => MARKET_BOARD_LABELS[symbol]);

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
  const delayed = snapshot.status === "DELAYED" || (!decisionReady && observable);
  return <section className="ctHero" aria-labelledby="terminal-title">
    <img className="ctHeroWatermark" src="/brand/logo-mark.svg" alt="" aria-hidden="true" />
    <div className="ctHeroIntro">
      <span className="ctEyebrow">NASH AI MARKETS · TERMINAL</span>
      <h1 id="terminal-title">Terminal</h1>
      <p>Verified cross-asset conditions, decision constraints and scenario readiness.</p>
    </div>
    <div className="ctHeroSummary">
      <BullseyeGauge score={bullseyeScore} ready={decisionReady} posture={posture} delayed={delayed} compact />
      <dl className="ctHeroStats">
        <div>
          <dt>Market data</dt>
          <dd><TerminalBadge label={observable && !decisionReady ? "Previous session" : state} tone={state === "Live" ? "positive" : state === "Delayed" || (observable && !decisionReady) ? "warning" : "danger"} pulse={state === "Live"} /></dd>
        </div>
        <div>
          <dt>Last verified</dt>
          <dd className="ctHeroTimestamp">{observable ? <><span>{timestamp} UK</span><span>{formatSnapshotAge(snapshot.asOf)}</span></> : "Awaiting first verified update"}</dd>
        </div>
        <div>
          <dt>Posture</dt>
          <dd className="ctHeroPosture">{decisionReady && posture ? pretty(posture) : "Stand aside"}</dd>
        </div>
      </dl>
    </div>
  </section>;
}

export function TodaysMarketPlan({ snapshot, decision, plan }: { snapshot: MarketSnapshot; decision: TradingDecision; plan: TradePlan }) {
  const decisionReady = isDecisionReadySnapshot(snapshot);
  const delayed = snapshot.status === "DELAYED" || (!decisionReady && hasDisplayableQuotes(snapshot));
  const tone = decision.tradePermission === "actionable" ? "positive" : decision.tradePermission === "caution" ? "warning" : "danger";
  const biasLabel = (() => {
    if (!decisionReady) return "Not inferred";
    if (decision.marketBias === "neutral" && decision.conflictingDrivers.length > 0) return "Mixed";
    return pretty(decision.marketBias);
  })();
  const standAside = !decisionReady || decision.tradePermission === "no-trade";
  return <section className={`ctPlan ctPanel${standAside ? " is-standAside" : ""}`} aria-labelledby="market-plan-title">
    <header>
      <div>
        <span>Today&apos;s market plan</span>
        <h2 id="market-plan-title">{decisionReady ? pretty(plan.directionalPosture) : "Stand aside until data is current"}</h2>
      </div>
      <TerminalBadge label={pretty(decision.tradePermission)} tone={tone} />
    </header>
    <div className="ctPlanGrid ctPlanGridVisual">
      <div className="ctPrimaryMetric">
        <BullseyeGauge
          score={decision.confidenceScore}
          ready={decisionReady}
          posture={plan.directionalPosture}
          delayed={delayed}
        />
        {standAside ? <div className="ctShield" aria-label="Capital protection"><strong>Capital protection</strong><span>Stand-aside posture keeps directional participation closed until verified conditions improve.</span></div> : null}
      </div>
      <dl>
        <div><dt>Market bias</dt><dd>{biasLabel}</dd></div>
        <div><dt>Risk level</dt><dd>{decisionReady ? pretty(decision.riskRating) : "Unrated"}</dd></div>
        <div><dt>Volatility</dt><dd>{decisionReady ? pretty(decision.volatilityRegime) : "Unrated"}</dd></div>
        <div><dt>Execution readiness</dt><dd>{decisionReady ? pretty(plan.executionReadiness) : "Not ready"}</dd></div>
        <div><dt>Preferred approach</dt><dd>{decisionReady ? pretty(plan.preferredSetupType) : "Wait for a current update"}</dd></div>
        <div><dt>Participation</dt><dd>{decisionReady ? pretty(plan.participationLevel) : "None"}</dd></div>
        <div><dt>Data age</dt><dd>{formatSnapshotAge(snapshot.asOf)}</dd></div>
        <div><dt>Confidence</dt><dd>{decisionReady ? formatScoreDisplay(decision.confidenceScore, true) : "Not calculated"}</dd></div>
      </dl>
    </div>
    <p className="ctCaution">{decisionReady ? "This is deterministic educational analysis. Confirm conditions independently before acting." : `Last verified observation: ${formatSnapshotAge(snapshot.asOf)}. Directional planning stays closed until data is inside the current decision window.`}</p>
  </section>;
}

export function CrossAssetBoard({
  snapshot,
  sparklines,
  volatilityRegime = null,
  compact = false,
}: {
  snapshot: MarketSnapshot;
  sparklines?: Partial<Record<MarketBoardSymbol, number[] | null>>;
  volatilityRegime?: string | null;
  compact?: boolean;
}) {
  if (!hasDisplayableQuotes(snapshot)) {
    return <section className="ctPanel" aria-labelledby="cross-asset-title">
      <header><div><span>Cross-asset board</span><h2 id="cross-asset-title">What the major inputs are saying</h2></div></header>
      <div className="ctHonestEmpty">
        <strong>Verified cross-asset readings unavailable</strong>
        <p>ES futures, VIX, Treasuries, the dollar, oil, QQQ and Nasdaq stay hidden until the provider returns a verified observation. Missing readings are never shown as zero.</p>
      </div>
    </section>;
  }
  const decisionReady = isDecisionReadySnapshot(snapshot);
  const age = formatSnapshotAge(snapshot.asOf);
  const statusLabel = decisionReady ? "Verified" : "Previous session";
  const find = (symbol: MarketBoardSymbol) => snapshot.quotes.find((item) => item.symbol === symbol);
  const vix = find("VIX");
  const two = find("US2Y");
  const ten = find("US10Y");
  const dxy = find("DXY");
  return <section className={`ctPanel ctInstrumentBoard${compact ? " is-compact" : ""}`} aria-labelledby="cross-asset-title">
    <header>
      <div><span>Cross-asset board</span><h2 id="cross-asset-title">What the major inputs are saying</h2></div>
      <small>{statusLabel} · {age}</small>
    </header>
    <div className="ctAssetGrid">
      {symbols.map((symbol, index) => {
        const quote = find(symbol);
        const series = sparklines?.[symbol] ?? null;
        const isRatesPair = symbol === "US2Y" || symbol === "US10Y";
        return <article key={symbol} className={`ctInstrumentCard is-${symbol.toLowerCase()}`}>
          <div className="ctInstrumentHead">
            <span>{instrumentLabels[index]}</span>
            <small>{symbol}</small>
          </div>
          <strong>{quote?.value ?? "Unavailable"}</strong>
          <div className="ctInstrumentMeta">
            <span className={`ctMove is-${quote?.direction ?? "missing"}`}>{quote?.change ?? "No verified reading"}</span>
            <span className={`ctInstrumentAge is-${decisionReady ? "ready" : "aged"}`}>{statusLabel} · {age}</span>
          </div>
          {series
            ? <Sparkline values={series} tone={quote?.direction ?? "neutral"} filled label={`${instrumentLabels[index]} verified recent closes`} height={compact ? 28 : 36} width={160} />
            : (
              <UnavailableHistory
                label={instrumentLabels[index]!}
                reason={isRatesPair
                  ? "Treasury yields arrive as verified scalars. OHLC candles are not available for this feed."
                  : "Verified scalar only until OHLCV history is available"}
              />
            )}
          {symbol === "VIX" ? <VolatilityGauge regime={volatilityRegime} ready={decisionReady} vixValue={vix?.value ?? null} compact /> : null}
          {symbol === "US10Y" ? <YieldSpreadVisual twoYear={two?.value} tenYear={ten?.value} ready={Boolean(two && ten)} compact /> : null}
          {symbol === "DXY" ? <DxyPressureVisual direction={dxy?.direction} change={dxy?.change} ready={Boolean(dxy)} compact /> : null}
          {!compact ? (
            <details className="ctInstrumentNote">
              <summary>Reading note</summary>
              <p>{quote ? instrumentInterpretation(quote) : `${instrumentLabels[index]} had no verified reading in the latest update.`}</p>
            </details>
          ) : null}
        </article>;
      })}
    </div>
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

function deskLeanLabel(lean: MarketDeskSignals["overallLean"]) {
  if (lean === "buying") return "Buying lean";
  if (lean === "selling") return "Selling lean";
  if (lean === "mixed") return "Mixed lean";
  if (lean === "neutral") return "Neutral";
  return "Insufficient data";
}

function deskLeanTone(lean: MarketDeskSignals["overallLean"]): "positive" | "warning" | "danger" | "info" {
  if (lean === "buying") return "positive";
  if (lean === "selling") return "danger";
  if (lean === "mixed") return "warning";
  if (lean === "neutral") return "info";
  return "warning";
}

export function MarketDeskSignalsPanel({
  signals,
  snapshotAge,
}: {
  signals: MarketDeskSignals;
  snapshotAge: string;
}) {
  const cards = [signals.buying, signals.selling];
  return <section className="ctPanel ctDeskSignals" aria-labelledby="desk-signals-title">
    <header>
      <div>
        <span>Market buying &amp; selling signals</span>
        <h2 id="desk-signals-title">Interpretive desk leans from verified inputs</h2>
      </div>
      <div className="ctDeskSignalsMeta">
        <TerminalBadge label={deskLeanLabel(signals.overallLean)} tone={deskLeanTone(signals.overallLean)} />
        <small>Educational · {snapshotAge}</small>
      </div>
    </header>
    <div className="ctDeskSignalPair">
      {cards.map((card) => (
        <article key={card.side} className={`ctDeskSignalCard is-${card.side} is-${card.status}${card.strength !== "none" ? ` is-strength-${card.strength}` : ""}`}>
          <div className="ctDeskSignalHead">
            <span>{card.side === "buying" ? "Buying signal" : "Selling signal"}</span>
            <div className="ctDeskSignalTags">
              {card.strength !== "none" ? <em className="ctDeskStrength">{card.strength}</em> : null}
              <em>{card.status}</em>
            </div>
          </div>
          <strong>{card.headline}</strong>
          <p>{card.summary}</p>
          <ul>{card.drivers.map((driver) => <li key={driver}>{driver}</li>)}</ul>
          <p className="ctDeskWatch"><b>Watching</b> {card.watchingFor}</p>
        </article>
      ))}
    </div>
    {signals.contextNotes.length ? (
      <ul className="ctDeskContext">{signals.contextNotes.map((note) => <li key={note}>{note}</li>)}</ul>
    ) : null}
    <p className="ctCaution">{signals.disclosure}</p>
  </section>;
}

function gaugeDirectionLabel(direction: InstrumentDirectionalGauge["direction"]) {
  if (direction === "buy") return "Buy lean";
  if (direction === "sell") return "Sell lean";
  if (direction === "neutral") return "Neutral";
  return "Insufficient";
}

function gaugeTone(direction: InstrumentDirectionalGauge["direction"]): "positive" | "warning" | "danger" | "info" {
  if (direction === "buy") return "positive";
  if (direction === "sell") return "danger";
  if (direction === "neutral") return "info";
  return "warning";
}

export function MarketDirectionalGaugesPanel({
  gauges,
  structure = null,
  snapshotAge,
}: {
  gauges: MarketDirectionalGauges;
  structure?: MarketStructureLevels | null;
  snapshotAge: string;
}) {
  const structureBySymbol = new Map(
    (structure?.instruments ?? []).map((item) => [item.symbol, item] as const),
  );
  return <section className="ctPanel ctDirectionalGauges" aria-labelledby="directional-gauges-title">
    <header>
      <div>
        <span>Market directional confidence</span>
        <h2 id="directional-gauges-title">Per-instrument gauges and desk levels</h2>
      </div>
      <small>Educational · {snapshotAge}</small>
    </header>
    <div className="ctGaugeGrid">
      {gauges.gauges.map((gauge) => {
        const ready = gauge.direction !== "insufficient" && gauge.confidencePct != null;
        const arc = ready ? Math.max(0, Math.min(100, gauge.confidencePct!)) : 0;
        const levels = structureBySymbol.get(gauge.symbol) ?? null;
        return (
          <article key={gauge.symbol} className={`ctDirGauge is-${gauge.direction} is-${gauge.confidenceTier}`}>
            <div className="ctDirGaugeHead">
              <span>{gauge.label}</span>
              <TerminalBadge label={gaugeDirectionLabel(gauge.direction)} tone={gaugeTone(gauge.direction)} />
            </div>
            <div
              className="ctDirGaugeMeter"
              role="meter"
              aria-label={`${gauge.label} directional confidence`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={ready ? arc : undefined}
            >
              <i style={{ width: `${arc}%` }} />
            </div>
            <strong>{ready ? `${arc}% confidence` : "Not calculated"}</strong>
            <p>{gauge.summary}</p>
            {gauge.scalarOnly ? <em className="ctDirGaugeScalar">Scalar feed · limited directional confidence</em> : null}
            <ul>{gauge.drivers.map((driver) => <li key={driver}>{driver}</li>)}</ul>
            <InstrumentStructureBox levels={levels} />
          </article>
        );
      })}
    </div>
    <p className="ctCaution">{gauges.disclosure}</p>
    {structure ? <p className="ctCaution">{structure.disclosure}</p> : null}
  </section>;
}

function InstrumentStructureBox({ levels }: { levels: InstrumentStructureLevels | null }) {
  if (!levels) {
    return (
      <div className="ctSrBox is-insufficient" role="status">
        <span>Support / Resistance</span>
        <strong>Insufficient data</strong>
        <p>Verified candle range unavailable for desk levels.</p>
      </div>
    );
  }
  if (levels.status !== "ready" || !levels.support || !levels.resistance) {
    return (
      <div className={`ctSrBox is-insufficient${levels.scalarOnly ? " is-scalar" : ""}`} role="status">
        <span>Support / Resistance</span>
        <strong>Insufficient data</strong>
        <p>{levels.summary}</p>
      </div>
    );
  }
  return (
    <div className="ctSrBox is-ready" aria-label={`${levels.label} support and resistance`}>
      <span>Support / Resistance</span>
      <dl>
        <div>
          <dt>Support</dt>
          <dd>{levels.support.display}</dd>
        </div>
        <div>
          <dt>Resistance</dt>
          <dd>{levels.resistance.display}</dd>
        </div>
      </dl>
      <p>{levels.summary}</p>
      <ul>
        {levels.references.slice(0, 3).map((ref) => (
          <li key={ref.kind}><b>{ref.label}</b> {ref.display}</li>
        ))}
      </ul>
    </div>
  );
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
    <div className={`ctIntelStrip ctIntelStripAuto${momentum ? " has-momentum" : ""}`}>
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
