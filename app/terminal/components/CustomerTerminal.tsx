import type { MarketSnapshot } from "../../lib/market-data.ts";
import { formatSnapshotAge, hasDisplayableQuotes, isDecisionReadySnapshot } from "../../lib/market-data.ts";
import type { MarketDirectionalGauges, InstrumentDirectionalGauge } from "../../lib/market-directional-gauges.ts";
import type { MarketStructureLevels, InstrumentStructureLevels } from "../../lib/market-structure-levels.ts";
import { TerminalBadge } from "./TerminalBadge";

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
    {/* Decorative local SVG sized entirely by CSS; next/image would add no
        optimisation for SVG and would fight the watermark layout. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
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
