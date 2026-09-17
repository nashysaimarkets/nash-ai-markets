"use client";

import OrbitalInstrument from "./OrbitalInstrument";
import TimeframeComparison from "./TimeframeComparison";

import { useState } from "react";
import type { Analysis } from "./analysis-types";
import type { UploadedChart } from "./chart-session";
import { evaluateTradePlan, type TradePlanEvaluation, type TradeSide } from "./trade-plan-evaluator";

export type ScanPerformance = { elapsedMs: number; outcome: "cached" | "completed" | "failed"; chartCount: number };


export function factorScore(value: number) {
  return Math.max(0, Math.min(10, Math.round(value)));
}

export default function BullseyeDecisionEngine({ analysis, charts, performance, activeId = "image", onSelectChart = () => {}, switchingDisabled = false }: {
  analysis: Analysis;
  charts: UploadedChart[];
  performance: ScanPerformance | null;
  activeId?: string; onSelectChart?: (id: string) => void; switchingDisabled?: boolean;
}) {
  const [side, setSide] = useState<TradeSide>(analysis.direction === "BEARISH" ? "SHORT" : "LONG");
  const [entry, setEntry] = useState(analysis.currentPrice && /^\s*[£$€¥]?[\d\s,'’.]+\s*$/.test(analysis.currentPrice) ? analysis.currentPrice : "");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const [submittedPlan, setSubmittedPlan] = useState<{ side: TradeSide; entry: string; stop: string; target: string } | null>(null);
  // Recompute against refreshed evidence, preserving the user’s submitted prices.
  const tradeReview: TradePlanEvaluation | null = submittedPlan ? evaluateTradePlan(submittedPlan, analysis) : null;

  const factors = [
    { label: "STRUCTURE", score: factorScore(analysis.setupScore.structure), detail: analysis.marketStructure },
    { label: "LOCATION", score: factorScore(analysis.setupScore.location), detail: analysis.levelStory },
    { label: "CONFIRMATION", score: factorScore(analysis.setupScore.confirmation), detail: analysis.nextSequence.confirmation },
    { label: "RISK CLARITY", score: factorScore(analysis.setupScore.riskClarity), detail: analysis.invalidation },
  ];

  const analyseTrade = () => setSubmittedPlan({ side, entry, stop, target });

  return <section className="psDecisionEngine" aria-labelledby="bullseye-decision-engine-title">
    <header className="psInstrumentHeader"><OrbitalInstrument kind="target" />
      <div><span>Decision conditions</span><h2 id="bullseye-decision-engine-title">What changes this read?</h2></div>
      <b data-verdict={analysis.verdict}>{analysis.verdict.replaceAll("_", " ")}</b>
    </header>

    <section className="psMindChange">
      <header><span>{analysis.direction === "NEUTRAL" ? "No directional read established" : `${analysis.direction === "BEARISH" ? "Bearish" : "Bullish"} interpretation`}</span><b>Screenshot conditions</b></header>
      <div>
        <article data-tone={analysis.direction === "BEARISH" ? "bear" : analysis.direction === "BULLISH" ? "bull" : "wait"}><small>{analysis.direction === "NEUTRAL" ? "CONFIRMATION TO LOOK FOR" : "STRENGTHENS THIS READ"}</small><strong>{analysis.nextSequence.confirmation}</strong></article>
        <article data-tone="wait"><small>STAY PATIENT WHILE</small><strong>{analysis.nextSequence.patience || analysis.noTradeCondition}</strong></article>
        <article data-tone="wait"><small>WEAKENS THIS SETUP</small><strong>{analysis.nextSequence.failure}</strong></article>
      </div>
    </section>

    <details className="pbReportFold pbAssessment"><summary>Why this setup grade?<span>AI assessment</span></summary>
      <p>The grade summarises the model’s interpretation. It is not a measured win rate or probability. Event risk is checked separately in the calendar.</p>
      <div className="psDecisionFactors">{factors.map((factor) => <article key={factor.label}><span>{factor.label}</span><strong>{factor.score}/10</strong><i><b style={{ width: `${factor.score * 10}%` }} /></i><p>{factor.detail}</p></article>)}</div>
    </details>

    <TimeframeComparison charts={charts} analysis={analysis} activeId={activeId} onSelect={onSelectChart} disabled={switchingDisabled} />

    <details className="psTradeReview">
      <summary><span>🎯 ANALYSE MY TRADE</span><strong>ENTRY · STOP · TARGET</strong><b>＋</b></summary>
      <div>
        <nav aria-label="Trade direction"><button type="button" data-active={side === "LONG"} aria-pressed={side === "LONG"} onClick={() => { setSide("LONG"); setSubmittedPlan(null); }}>LONG</button><button type="button" data-active={side === "SHORT"} aria-pressed={side === "SHORT"} onClick={() => { setSide("SHORT"); setSubmittedPlan(null); }}>SHORT</button></nav>
        <form onSubmit={(event) => { event.preventDefault(); analyseTrade(); }}>
          <label><span>ENTRY</span><input inputMode="decimal" value={entry} onChange={(event) => { setEntry(event.target.value); setSubmittedPlan(null); }} placeholder="Exact price" /></label>
          <label><span>STOP</span><input inputMode="decimal" value={stop} onChange={(event) => { setStop(event.target.value); setSubmittedPlan(null); }} placeholder="Exact price" /></label>
          <label><span>TARGET</span><input inputMode="decimal" value={target} onChange={(event) => { setTarget(event.target.value); setSubmittedPlan(null); }} placeholder="Exact price" /></label>
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
      <b>Check the source chart before acting</b>
    </footer>
  </section>;
}
