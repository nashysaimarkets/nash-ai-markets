import type { MarketSnapshot } from "../../lib/market-data.ts";
import { formatSnapshotAge, hasDisplayableQuotes, isDecisionReadySnapshot } from "../../lib/market-data.ts";
import type { MarketDirectionalGauges, InstrumentDirectionalGauge } from "../../lib/market-directional-gauges.ts";
import type { MarketStructureLevels, InstrumentStructureLevels } from "../../lib/market-structure-levels.ts";
import { MARKET_BOARD_LABELS, MARKET_BOARD_SYMBOLS, type MarketBoardSymbol } from "../../lib/market-board-instruments.ts";
import type { TradePlan } from "../../lib/structured-trade-planner.ts";
import type { TradingDecision } from "../../lib/trading-decision-engine.ts";
import { formatScoreDisplay } from "../../dashboard/lib/score-display.ts";
import { Sparkline } from "../../components/mini-visuals/Sparkline.tsx";
import { UnavailableHistory } from "../../components/mini-visuals/UnavailableHistory.tsx";
import { VolatilityGauge } from "../../components/mini-visuals/VolatilityGauge.tsx";
import { YieldSpreadVisual } from "../../components/mini-visuals/YieldSpreadVisual.tsx";
import { DxyPressureVisual } from "../../components/mini-visuals/DxyPressureVisual.tsx";
import { TerminalBadge } from "./TerminalBadge";
import { instrumentInterpretation } from "../lib/customer-terminal";

const pretty = (value: string) => value.replaceAll("_", " ").replaceAll("-", " ");
const symbols = MARKET_BOARD_SYMBOLS;
const instrumentLabels = MARKET_BOARD_SYMBOLS.map((symbol) => MARKET_BOARD_LABELS[symbol]);

export function MarketCommandHeader({
  snapshot,
  state,
  timestamp,
}: {
  snapshot: MarketSnapshot;
  state: string;
  timestamp: string;
  bullseyeScore?: number | null;
  posture?: string | null;
}) {
  const decisionReady = isDecisionReadySnapshot(snapshot);
  const observable = hasDisplayableQuotes(snapshot);
  return <section className="ctHero" aria-labelledby="terminal-title">
    <img className="ctHeroWatermark" src="/brand/logo-mark.svg" alt="" aria-hidden="true" />
    <div className="ctHeroIntro">
      <span className="ctEyebrow">NASH AI MARKETS · TERMINAL</span>
      <h1 id="terminal-title">Terminal</h1>
      <p>Verified cross-asset conditions, decision constraints and scenario readiness.</p>
    </div>
    <div className="ctHeroSummary is-statsOnly">
      <dl className="ctHeroStats">
        <div>
          <dt>Market data</dt>
          <dd><TerminalBadge label={observable && !decisionReady ? "Previous session" : state} tone={state === "Live" ? "positive" : state === "Delayed" || (observable && !decisionReady) ? "warning" : "danger"} pulse={state === "Live"} /></dd>
        </div>
        <div>
          <dt>Last verified</dt>
          <dd className="ctHeroTimestamp">{observable ? <><span>{timestamp} UK</span><span>{formatSnapshotAge(snapshot.asOf)}</span></> : "Awaiting first verified update"}</dd>
        </div>
      </dl>
    </div>
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
    <header>
      <div>
        <span>Today&apos;s market plan</span>
        <h2 id="market-plan-title">{decisionReady ? pretty(plan.directionalPosture) : "Awaiting current data"}</h2>
      </div>
      <TerminalBadge label={pretty(decision.tradePermission)} tone={tone} />
    </header>
    <div className="ctPlanGrid ctPlanGridCompact">
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
    <p className="ctCaution">{decisionReady ? "Educational analysis only. Confirm conditions independently before acting." : `Last verified observation: ${formatSnapshotAge(snapshot.asOf)}. Directional planning stays closed until data is inside the current decision window.`}</p>
  </section>;
}

export function CrossAssetBoard({
  snapshot,
  sparklines,
  volatilityRegime = null,
  compact = true,
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
  return <section className={`ctPanel ctInstrumentBoard is-compact${compact ? "" : " is-expanded"}`} aria-labelledby="cross-asset-title">
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
            ? <Sparkline values={series} tone={quote?.direction ?? "neutral"} filled label={`${instrumentLabels[index]} verified recent closes`} height={compact ? 22 : 36} width={140} />
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
        <span>Desk support &amp; resistance</span>
        <h2 id="directional-gauges-title">Verified candle range levels by instrument</h2>
      </div>
      <small>Educational · {snapshotAge}</small>
    </header>
    <div className="ctGaugeGrid">
      {gauges.gauges.map((gauge) => {
        const ready = gauge.direction !== "insufficient" && gauge.confidencePct != null;
        const arc = ready ? Math.max(0, Math.min(100, gauge.confidencePct!)) : 0;
        const levels = structureBySymbol.get(gauge.symbol) ?? null;
        return (
          <article key={gauge.symbol} className={`ctDirGauge is-compact is-${gauge.direction} is-${gauge.confidenceTier}`}>
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
            <strong>{ready ? `${arc}%` : "—"}</strong>
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
      <div className="ctSrBox is-compact is-insufficient" role="status">
        <span>S / R</span>
        <strong>Insufficient data</strong>
      </div>
    );
  }
  if (levels.status !== "ready" || !levels.support || !levels.resistance) {
    return (
      <div className={`ctSrBox is-compact is-insufficient${levels.scalarOnly ? " is-scalar" : ""}`} role="status">
        <span>S / R</span>
        <strong>Insufficient data</strong>
      </div>
    );
  }
  return (
    <div className="ctSrBox is-compact is-ready" aria-label={`${levels.label} support and resistance`}>
      <span>S / R</span>
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
      <ul>
        {levels.references.slice(0, 2).map((ref) => (
          <li key={ref.kind}><b>{ref.label}</b> {ref.display}</li>
        ))}
      </ul>
    </div>
  );
}

export function WhatChanged() {
  // Empty prior-snapshot cards are omitted from the customer terminal to keep the chart dominant.
  return null;
}
