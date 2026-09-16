"use client";

import OrbitalInstrument from "./OrbitalInstrument";
import TimeframeComparison from "./TimeframeComparison";

import { useState, type CSSProperties } from "react";
import type { Analysis } from "./analysis-types";
import type { UploadedChart } from "./chart-session";
import { effectiveLiquidityGeometry, projectLiquidityZones } from "./liquidity-guard";
import { evaluateTradePlan, type TradePlanEvaluation, type TradeSide } from "./trade-plan-evaluator";

export type ScanPerformance = { elapsedMs: number; outcome: "cached" | "completed" | "failed"; chartCount: number };


function evidenceBalance(analysis: Analysis) {
  if (analysis.direction === "NEUTRAL") return { long: 50, short: 50 };
  const strength = Math.max(5, Math.min(28, Math.round((analysis.setupScore.overall - 50) * .32 + (analysis.setupScore.confirmation - 5) * 1.6 + 6)));
  const long = analysis.direction === "BULLISH" ? 50 + strength : 50 - strength;
  return { long, short: 100 - long };
}

export function factorScore(value: number) {
  return Math.max(0, Math.min(10, Math.round(value)));
}

export default function BullseyeDecisionEngine({ analysis, charts, performance, activeId = "image", onSelectChart = () => {}, switchingDisabled = false }: {
  analysis: Analysis;
  charts: UploadedChart[];
  performance: ScanPerformance | null;
  activeId?: string; onSelectChart?: (id: string) => void; switchingDisabled?: boolean;
}) {
  const balance = evidenceBalance(analysis);
  const [side, setSide] = useState<TradeSide>(analysis.direction === "BEARISH" ? "SHORT" : "LONG");
  const [entry, setEntry] = useState(analysis.currentPrice && /^\s*[£$€¥]?[\d\s,'’.]+\s*$/.test(analysis.currentPrice) ? analysis.currentPrice : "");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const [tradeReview, setTradeReview] = useState<TradePlanEvaluation | null>(null);

  const effectiveLiquidity = effectiveLiquidityGeometry(analysis);
  const liquidityZones = projectLiquidityZones(
    effectiveLiquidity.liquidityShield,
    analysis.currentPrice,
    effectiveLiquidity.priceScaleAnchors,
    effectiveLiquidity.plotBounds,
    effectiveLiquidity.evidenceQuality,
  );
  const trapRisk = effectiveLiquidity.liquidityShield?.status === "INSUFFICIENT_EVIDENCE"
    ? "UNVERIFIED"
    : liquidityZones.length >= 2 ? "HIGH" : liquidityZones.length === 1 ? "MODERATE" : analysis.riskFlags.length >= 3 ? "MODERATE" : "LOW";
  const trapRegion = liquidityZones[0]
    ? `${liquidityZones[0].priceLow.toLocaleString("en-GB")}–${liquidityZones[0].priceHigh.toLocaleString("en-GB")}`
    : "NO EXACT REGION VERIFIED";

  const factors = [
    { label: "STRUCTURE", score: factorScore(analysis.setupScore.structure), detail: analysis.marketStructure },
    { label: "LOCATION", score: factorScore(analysis.setupScore.location), detail: analysis.levelStory },
    { label: "CONFIRMATION", score: factorScore(analysis.setupScore.confirmation), detail: analysis.nextSequence.confirmation },
    { label: "RISK CLARITY", score: factorScore(analysis.setupScore.riskClarity), detail: analysis.invalidation },
    { label: "EVENT SAFETY", score: factorScore(analysis.setupScore.eventSafety), detail: "Confirm the live event calendar before acting." },
  ];

  const analyseTrade = () => setTradeReview(evaluateTradePlan({ side, entry, stop, target }, analysis));

  return <section className="psDecisionEngine" aria-labelledby="bullseye-decision-engine-title">
    <header className="psInstrumentHeader"><OrbitalInstrument kind="target" />
      <div><span>◎ BULLSEYE DECISION ENGINE</span><h2 id="bullseye-decision-engine-title">One decision from every verified check</h2></div>
      <b data-verdict={analysis.verdict}>{analysis.verdict.replaceAll("_", " ")}</b>
    </header>

    <div className="psDecisionSnapshot">
      <article className="psDecisionBias" aria-label={`Long evidence ${balance.long} percent, short evidence ${balance.short} percent`}>
        <header><span>EVIDENCE BALANCE</span><small>NOT A PRICE PROBABILITY</small></header>
        <div><b style={{ width: `${balance.long}%` }} /><i style={{ width: `${balance.short}%` }} /></div>
        <footer><strong data-side="long">LONG {balance.long}%</strong><strong data-side="short">SHORT {balance.short}%</strong></footer>
      </article>
      <article className="psSetupQuality" style={{ "--setup-score": `${analysis.setupScore.overall * 3.6}deg` } as CSSProperties}>
        <div><strong>{analysis.setupScore.overall}</strong><small>/100</small></div>
        <span>SETUP QUALITY · GRADE {analysis.setupScore.grade}</span>
      </article>
    </div>

    <div className="psDecisionFactors">{factors.map((factor) => <article key={factor.label} title={factor.detail}><span>{factor.label}</span><strong>{factor.score}/10</strong><i><b style={{ width: `${factor.score * 10}%` }} /></i></article>)}</div>

    <section className="psMindChange">
      <header><span>↳ WHAT CHANGES MY MIND?</span><b>LIVE DECISION RULES</b></header>
      <div>
        <article data-tone="bull"><small>STRENGTHENS THE BULL CASE</small><strong>{analysis.nextSequence.confirmation}</strong></article>
        <article data-tone="wait"><small>STAY PATIENT WHILE</small><strong>{analysis.nextSequence.patience || analysis.noTradeCondition}</strong></article>
        <article data-tone="bear"><small>WEAKENS / FLIPS THE READ</small><strong>{analysis.nextSequence.failure}</strong></article>
      </div>
    </section>

    <div className="psDecisionRiskRow">
      <section className="psTrapRadar" data-risk={trapRisk}>
        <header><span>⌖ TRAP RADAR</span><strong>{trapRisk}</strong></header>
        <b>{trapRegion}</b>
        <p>{effectiveLiquidity.liquidityShield?.summary || analysis.traderTrap}</p>
        <small>{effectiveLiquidity.liquidityShield?.stopGuidance || "Confirm any stop against the original chart and invalidation."}</small>
      </section>
    </div>

    <TimeframeComparison charts={charts} analysis={analysis} activeId={activeId} onSelect={onSelectChart} disabled={switchingDisabled} />

    <details className="psTradeReview">
      <summary><span>🎯 ANALYSE MY TRADE</span><strong>ENTRY · STOP · TARGET</strong><b>＋</b></summary>
      <div>
        <nav aria-label="Trade direction"><button type="button" data-active={side === "LONG"} onClick={() => { setSide("LONG"); setTradeReview(null); }}>LONG</button><button type="button" data-active={side === "SHORT"} onClick={() => { setSide("SHORT"); setTradeReview(null); }}>SHORT</button></nav>
        <form onSubmit={(event) => { event.preventDefault(); analyseTrade(); }}>
          <label><span>ENTRY</span><input inputMode="decimal" value={entry} onChange={(event) => { setEntry(event.target.value); setTradeReview(null); }} placeholder="Exact price" /></label>
          <label><span>STOP</span><input inputMode="decimal" value={stop} onChange={(event) => { setStop(event.target.value); setTradeReview(null); }} placeholder="Exact price" /></label>
          <label><span>TARGET</span><input inputMode="decimal" value={target} onChange={(event) => { setTarget(event.target.value); setTradeReview(null); }} placeholder="Exact price" /></label>
          <button type="submit">ANALYSE MY TRADE</button>
        </form>
        {tradeReview ? <section className="psTradeReviewResult" data-verdict={tradeReview.verdict} aria-live="polite">
          <header><div><small>TRADE QUALITY</small><strong>{tradeReview.quality === null ? "—" : `${tradeReview.quality}/100`}</strong></div><b>{tradeReview.verdict}</b></header>
          <div>{tradeReview.checks.map((check) => <article key={check.label} data-status={check.status}><span>{check.status === "PASS" ? "✓" : check.status === "WARN" ? "!" : "×"}</span><div><strong>{check.label}</strong><p>{check.detail}</p></div></article>)}</div>
          <footer>Uses only your prices and this verified audit. It does not place an order or tell you to trade.</footer>
        </section> : null}
      </div>
    </details>

    <footer>
      <span>{performance ? `${performance.outcome === "cached" ? "PRIVATE CACHE REUSED" : "LATEST AUDIT"} · ${(performance.elapsedMs / 1000).toFixed(1)}s · ${performance.chartCount} CHART${performance.chartCount === 1 ? "" : "S"}` : "TIMING RECORDED AUTOMATICALLY ON LIVE SCANS"}</span>
      <b>VISIBLE EVIDENCE ONLY · NO INVENTED PRICES</b>
    </footer>
  </section>;
}
