"use client";

/* Uploaded charts are private data URLs; routing them through next/image would add no optimisation benefit. */
/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { VerifiedMacroContext } from "../lib/macro-data";
import { normalizeLockedDecisions } from "./decision-compatibility";
import { calculateRiskDesk, type RiskDeskInput } from "./pocket-risk-desk";
import { calculateRangePosition, mergeCompatibleChartLevels, rankChartLevels, type NumericChartLevel } from "./pocket-chart-toolkit";
import ChartPreflightPanel from "./ChartPreflightPanel";
import AccuracyFeedbackPanel from "./AccuracyFeedbackPanel";
import LevelProvenancePanel from "./LevelProvenancePanel";
import { numericLevelPrice } from "./level-verification";
import { correctionPatch, type AccuracyFeedback } from "./accuracy-feedback";
import { preflightAllowsAnalysis, type ChartConfirmation, type PreflightStatus } from "./chart-preflight";
import AppleSubscriptionPaywall from "./AppleSubscriptionPaywall";
import { consumeAppleFreeUse, getAppleAccessStatus, isAppleNativeApp, type AppleAccessStatus } from "./apple-storekit";

type Direction = "BULLISH" | "BEARISH" | "NEUTRAL";
type ToolKind = "support" | "resistance" | "trend" | "pivot" | "zone" | "gap";
type Level = { kind: ToolKind; label: string; price: string; x: number; y: number; x2: number; y2: number };
type FibLevel = { ratio: string; price: string; y: number };
type Intention = "LONG" | "SHORT" | "UNSURE";
type SetupScore = { overall: number; grade: "A" | "B" | "C" | "D" | "F"; structure: number; momentum: number; location: number; confirmation: number; riskClarity: number; eventSafety: number };
type Analysis = {
  direction: Direction;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  instrument: string;
  ticker: string;
  timeframe: string;
  evidenceQuality: {
    chartReadability: "CLEAR" | "PARTIAL" | "POOR";
    instrumentConfidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
    timeframeConfidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
    scaleReadable: boolean;
    candlesReadable: boolean;
    limitations: string[];
  };
  observableFacts: string[];
  contradictions: string[];
  higherTimeframe: {
    provided: boolean;
    timeframe: string;
    direction: Direction | "UNKNOWN";
    alignment: "ALIGNED" | "CONFLICTING" | "MIXED" | "NOT_PROVIDED";
    summary: string;
  };
  patterns: { name: string; status: "FORMING" | "CONFIRMED" | "FAILED" | "AMBIGUOUS" | "EXTENDED"; timeframe?: string; confidence?: "LOW" | "MEDIUM" | "HIGH"; evidence: string; confirmation?: string; invalidation: string; geometry?: { points: { x: number; y: number }[]; labelX: number; labelY: number } }[];
  nextSequence: { now: string; confirmation: string; failure: string; patience: string; reassess: string };
  missingInputs: string[];
  contextContribution?: { used: boolean; materialChange: boolean; summary: string; resolvedInputs: string[] };
  summary: string;
  verdict: "WATCH" | "WAIT" | "STAND_ASIDE" | "REVIEW_REQUIRED";
  verdictHeadline: string;
  setupScore: SetupScore;
  whatYouMayBeMissing: string[];
  improvesSetup: string[];
  killsSetup: string[];
  traderTrap: string;
  bullishCase: string;
  bearishCase: string;
  invalidation: string;
  marketStructure: string;
  levelStory: string;
  momentum: string;
  bullConfirmation: string;
  bearConfirmation: string;
  noTradeCondition: string;
  riskFlags: string[];
  indicators: string[];
  checklist: string[];
  relevantEventTypes: string[];
  plotBounds?: { left: number; top: number; right: number; bottom: number };
  priceScaleAnchors?: { price: number; y: number }[];
  currentPrice?: string;
  levels: Level[];
  contextBattlefield?: { currentPrice?: string; levels: Level[]; priceScaleAnchors?: { price: number; y: number }[]; plotBounds?: { left: number; top: number; right: number; bottom: number } } | null;
  fibLevels: FibLevel[];
};
type StockEvent = { id: string; type: "EARNINGS" | "DIVIDEND" | "SPLIT"; date: string; detail: string; source: string };
type LockedDecision = { id: string; createdAt: string; intention: Intention; image: string; analysis: Analysis };
type FollowUpReply = { answer: string; evidence: string[]; caution: string; nextCheck: string };
type ProcessReview = { outcome: "PROFIT" | "LOSS" | "BREAKEVEN" | "UNCLEAR"; processGrade: "A" | "B" | "C" | "D" | "F"; decisionQuality: number; headline: string; outcomeSummary: string; confirmationReview: string; invalidationReview: string; timingReview: string; disciplineReview: string; goodDecisionBadOutcome: boolean; lessons: string[]; behaviourTags: string[] };

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
function clampY(y: number) {
  return Math.max(5, Math.min(95, Number.isFinite(y) ? y : 50));
}

function createPrecisionReadingCrop(dataUrl: string) {
  return new Promise<string | null>((resolve) => {
    const source = new Image();
    source.onload = () => {
      try {
        // Preserve the full plot width (including the right-hand scale), while
        // removing most phone chrome and the chart app's bottom controls.
        const top = Math.round(source.naturalHeight * 0.06);
        const height = Math.round(source.naturalHeight * 0.82);
        const targetWidth = Math.min(1800, Math.max(1400, source.naturalWidth));
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = Math.round(height * targetWidth / source.naturalWidth);
        const context = canvas.getContext("2d");
        if (!context) return resolve(null);
        context.drawImage(source, 0, top, source.naturalWidth, height, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      } catch { resolve(null); }
    };
    source.onerror = () => resolve(null);
    source.src = dataUrl;
  });
}

function numericLevel(value: string | undefined) {
  return numericLevelPrice(value);
}

function evidenceBalance(analysis: Analysis) {
  if (analysis.direction === "NEUTRAL") return { bull: 50, bear: 50 };
  const directionalStrength = Math.max(5, Math.min(28, Math.round((analysis.setupScore.overall - 50) * .32 + (analysis.setupScore.confirmation - 5) * 1.6 + 6)));
  const bull = analysis.direction === "BULLISH" ? 50 + directionalStrength : 50 - directionalStrength;
  return { bull, bear: 100 - bull };
}

function personalDailyMessage(analysis: Analysis, viewerName = "") {
  const lead = viewerName ? `${viewerName}, ` : "";
  if (analysis.verdict === "WATCH") return `${lead}protect the plan today: watch the confirmation, not the excitement.`;
  if (analysis.verdict === "STAND_ASIDE") return `${lead}protecting capital is a strong decision today. You do not need to force this chart.`;
  if (analysis.verdict === "REVIEW_REQUIRED") return `${lead}clarity comes first today. Add the missing evidence before making the decision.`;
  return `${lead}patience is your edge today. No proof, no trade.`;
}

function LockOnReveal({ analysis, onEnter }: { analysis: Analysis; onEnter: () => void }) {
  const [stage, setStage] = useState(0);
  const balance = evidenceBalance(analysis);
  const verifiedLevels = analysis.levels.filter((level) => numericLevel(level.price) !== null && ["support", "resistance", "pivot"].includes(level.kind)).length;
  const stages = [
    ["TARGET ACQUIRED", `${analysis.instrument} · ${analysis.timeframe}`],
    ["PRICE MAP LOCKED", verifiedLevels ? `${verifiedLevels} VERIFIED LEVEL${verifiedLevels === 1 ? "" : "S"}` : "PRECISION HOLD"],
    ["PRESSURE WEIGHED", `BULL ${balance.bull} · BEAR ${balance.bear}`],
    ["RISK CHALLENGED", `${analysis.riskFlags.length} FLAG${analysis.riskFlags.length === 1 ? "" : "S"} TESTED`],
    ["DECISION LOCKED", analysis.verdict.replaceAll("_", " ")],
  ] as const;

  useEffect(() => {
    if (stage >= stages.length - 1) return;
    const timer = window.setTimeout(() => setStage((current) => current + 1), stage === 0 ? 620 : 760);
    return () => window.clearTimeout(timer);
  }, [stage, stages.length]);

  return <section className="psLockOn" data-stage={stage} data-direction={analysis.direction} role="dialog" aria-modal="true" aria-label="Bullseye Lock-On result">
    <div className="psLockAtmosphere" aria-hidden="true"><i/><i/><i/></div>
    <header><span><i/> BULLSEYE LOCK-ON</span><b>{stage < stages.length - 1 ? "ANALYSING LIVE" : "SEQUENCE COMPLETE"}</b></header>
    <div className="psLockArena" aria-hidden="true">
      <div className="psLockRings"><i/><i/><i/><i/><b>◎</b></div>
      <div className="psLockSweep"/>
      <span className="psLockBracket psLockBracketA"/><span className="psLockBracket psLockBracketB"/>
      <div className="psLockPressure"><span data-side="bear" style={{ width: `${balance.bear}%` }}/><span data-side="bull" style={{ width: `${balance.bull}%` }}/></div>
    </div>
    <div className="psLockTelemetry" aria-live="polite">
      {stages.map(([label, value], index) => <div key={label} data-state={index < stage ? "complete" : index === stage ? "active" : "waiting"}><i>{index < stage ? "✓" : index === stage ? "◆" : "·"}</i><span>{label}</span><strong>{value}</strong></div>)}
    </div>
    <div className="psLockVerdict" data-ready={stage === stages.length - 1}>
      <small>{analysis.direction} READ · SETUP {analysis.setupScore.grade}</small>
      <strong>{analysis.verdict.replaceAll("_", " ")}</strong>
      <p>{analysis.verdictHeadline}</p>
      <div><span>STRENGTHENS WHEN</span><b>{analysis.nextSequence.confirmation}</b></div>
    </div>
    <button type="button" disabled={stage < stages.length - 1} onClick={onEnter}>{stage < stages.length - 1 ? "LOCKING THE EVIDENCE…" : "START MY CINEMATIC RESULT"}<b>→</b></button>
    <footer>EVIDENCE BALANCE · NOT PRICE CERTAINTY OR A TRADE INSTRUCTION</footer>
  </section>;
}

type ArenaMode = "command" | "levels" | "battle" | "risk";
function BullseyeCommandArena({ analysis, sourceImage, onOpenReport, onShare }: { analysis: Analysis; sourceImage: string; onOpenReport: () => void; onShare: () => void }) {
  const [mode, setMode] = useState<ArenaMode>("command");
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const balance = evidenceBalance(analysis);
  const verified = analysis.levels.filter((level) => numericLevel(level.price) !== null && ["support", "resistance", "pivot"].includes(level.kind)).slice(0, 4);
  const tone = analysis.direction === "BULLISH" ? "bull" : analysis.direction === "BEARISH" ? "bear" : "wait";
  const modes: Array<{ id: ArenaMode; icon: string; label: string }> = [
    { id: "command", icon: "◎", label: "COMMAND" }, { id: "levels", icon: "⌁", label: "LEVELS" },
    { id: "battle", icon: "⚔", label: "BATTLE" }, { id: "risk", icon: "⚠", label: "RISK" },
  ];
  const move = (event: PointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setTilt({ x: ((event.clientX - bounds.left) / bounds.width - .5) * 8, y: ((event.clientY - bounds.top) / bounds.height - .5) * -7 });
  };
  return <section className="psArena" data-mode={mode} data-tone={tone} onPointerMove={move} onPointerLeave={() => setTilt({ x: 0, y: 0 })}>
    <div className="psArenaWorld" aria-hidden="true"><i/><i/><i/><b/><b/></div>
    <header className="psArenaHud"><div><i/> LIVE DECISION ARENA</div><strong>{analysis.instrument}<small>{analysis.timeframe} · PRIVATE AUDIT</small></strong><span>AI CORE<br/><b>ONLINE</b></span></header>
    <div className="psArenaViewport" style={{ "--tilt-x": `${tilt.x}deg`, "--tilt-y": `${tilt.y}deg` } as CSSProperties}>
      <div className="psArenaChart"><img src={sourceImage} alt="Chart inside Bullseye Command Arena"/><div className="psArenaScan"/><span className="psCorner psCorner1"/><span className="psCorner psCorner2"/><span className="psCorner psCorner3"/><span className="psCorner psCorner4"/></div>
      <div className="psArenaOrb" data-ready="true" aria-hidden="true"><i/><i/><i/><b>◎</b><span>{analysis.setupScore.grade}</span></div>
      <article className="psArenaPanel psArenaCommand">
        <small>MISSION DECISION</small><h1>{analysis.verdict.replaceAll("_", " ")}</h1><p>{analysis.verdictHeadline}</p>
        <div><span>SETUP POWER<strong>{analysis.setupScore.overall}</strong></span><i><b style={{ width: `${analysis.setupScore.overall}%` }}/></i></div>
        <footer><span data-side="bull">BULL {balance.bull}</span><b>VS</b><span data-side="bear">BEAR {balance.bear}</span></footer>
      </article>
      <article className="psArenaPanel psArenaLevels">
        <small>VERIFIED PRICE MATRIX</small><h2>{verified.length ? `${verified.length} LEVELS LOCKED` : "PRECISION HOLD"}</h2>
        <div>{verified.length ? verified.map((level, index) => <span key={`${level.kind}-${level.price}-${index}`} data-kind={level.kind}><i>{level.kind === "support" ? "S" : level.kind === "resistance" ? "R" : "P"}</i><b>{level.price}</b><small>{level.kind.toUpperCase()}</small></span>) : <p>Exact levels need a clearer price scale. Bullseye will not invent them.</p>}</div>
        <footer>CURRENT PRICE <strong>{analysis.currentPrice || "UNVERIFIED"}</strong></footer>
      </article>
      <article className="psArenaPanel psArenaBattle">
        <small>DIRECTIONAL BATTLE</small><h2>TWO CASES. ONE DECISION.</h2>
        <div><section data-side="bull"><b>🐂 {balance.bull}%</b><p>{analysis.bullishCase}</p></section><i>VS</i><section data-side="bear"><b>🐻 {balance.bear}%</b><p>{analysis.bearishCase}</p></section></div>
        <footer><span>ACTIVATES WHEN</span><strong>{analysis.nextSequence.confirmation}</strong></footer>
      </article>
      <article className="psArenaPanel psArenaRisk">
        <small>CAPITAL DEFENCE SYSTEM</small><h2>{analysis.riskFlags.length ? `${analysis.riskFlags.length} THREAT${analysis.riskFlags.length === 1 ? "" : "S"} DETECTED` : "NO VISIBLE THREAT LOCK"}</h2>
        <ul>{analysis.riskFlags.slice(0, 3).map((risk) => <li key={risk}><i>!</i><span>{risk}</span></li>)}</ul>
        <footer><span>MISSION ABORT</span><strong>{analysis.nextSequence.failure || analysis.invalidation}</strong></footer>
      </article>
    </div>
    <nav className="psArenaDock" aria-label="Command Arena views">{modes.map((item) => <button key={item.id} type="button" data-active={mode === item.id} onClick={() => setMode(item.id)}><i>{item.icon}</i><span>{item.label}</span></button>)}</nav>
    <div className="psArenaActions"><button type="button" onClick={onOpenReport}>OPEN FULL INTELLIGENCE <b>→</b></button><button type="button" onClick={onShare} aria-label="Share result">↗</button></div>
    <footer className="psArenaLegal">CONDITIONAL DECISION SUPPORT · VERIFY ON YOUR ORIGINAL CHART</footer>
  </section>;
}

type ChartTool = "levels" | "swings" | "fib" | "rsi";
function BubbleChartLab({ analysis, sourceImage, onOpenReport, onShare }: { analysis: Analysis; sourceImage: string; onOpenReport: () => void; onShare: () => void }) {
  const [tools, setTools] = useState<Record<ChartTool, boolean>>({ levels: true, swings: false, fib: false, rsi: false });
  const toggle = (tool: ChartTool) => setTools((current) => ({ ...current, [tool]: !current[tool] }));
  const structural = analysis.levels.filter((level) => numericLevel(level.price) !== null && ["support", "resistance", "pivot"].includes(level.kind));
  const swingHigh = [...structural].sort((a, b) => clampY(a.y) - clampY(b.y))[0];
  const swingLow = [...structural].sort((a, b) => clampY(b.y) - clampY(a.y))[0];
  const rsiMatch = analysis.momentum.match(/RSI[^0-9]{0,18}(\d{1,3}(?:\.\d+)?)/i);
  const rsi = rsiMatch ? Math.max(0, Math.min(100, Number(rsiMatch[1]))) : null;
  const shortRead = analysis.summary.length > 180 ? `${analysis.summary.slice(0, 177).trim()}…` : analysis.summary;
  return <section className="psBubbleLab" data-direction={analysis.direction}>
    <div className="psBubbleField" aria-hidden="true"><i/><i/><i/><i/><i/></div>
    <header><div><span>◎ LIVE CHART LAB</span><strong>{analysis.instrument}</strong></div><b>{analysis.timeframe}<small>{analysis.direction}</small></b></header>
    <div className="psBubbleStage">
      <div className="psBubbleShell">
        <img src={sourceImage} alt="Uploaded chart with active Bullseye tools"/>
        <div className="psBubbleGlass" aria-hidden="true"/>
        <svg className="psToolOverlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Active chart analysis overlays">
          {tools.levels ? structural.map((level, index) => <g key={`level-${level.kind}-${level.price}-${index}`} data-tool="level" data-kind={level.kind}><line x1="2" x2="98" y1={clampY(level.y)} y2={clampY(level.y)}/><circle cx="8" cy={clampY(level.y)} r="1.3"/></g>) : null}
          {tools.fib ? analysis.fibLevels.map((level, index) => <g key={`fib-${level.ratio}-${index}`} data-tool="fib"><line x1="4" x2="96" y1={clampY(level.y)} y2={clampY(level.y)}/></g>) : null}
          {tools.swings && swingHigh ? <g data-tool="swing" data-side="high"><circle cx={Math.max(8, Math.min(92, swingHigh.x || 50))} cy={clampY(swingHigh.y)} r="3"/><path d={`M ${Math.max(8, Math.min(92, swingHigh.x || 50)) - 4} ${clampY(swingHigh.y) - 5} l 4 4 l 4 -4`}/></g> : null}
          {tools.swings && swingLow ? <g data-tool="swing" data-side="low"><circle cx={Math.max(8, Math.min(92, swingLow.x || 50))} cy={clampY(swingLow.y)} r="3"/><path d={`M ${Math.max(8, Math.min(92, swingLow.x || 50)) - 4} ${clampY(swingLow.y) + 5} l 4 -4 l 4 4`}/></g> : null}
        </svg>
        <div className="psToolLabels" aria-hidden="true">
          {tools.levels ? structural.map((level, index) => <span key={`label-${level.kind}-${level.price}-${index}`} data-kind={level.kind} style={{ top: `${clampY(level.y)}%` }}>{level.kind === "support" ? "S" : level.kind === "resistance" ? "R" : "P"} · {level.price}</span>) : null}
          {tools.fib ? analysis.fibLevels.map((level, index) => <span key={`fib-label-${level.ratio}-${index}`} data-kind="fib" style={{ top: `${clampY(level.y)}%` }}>{level.ratio} · {level.price}</span>) : null}
          {tools.swings && swingHigh ? <b data-swing="high" style={{ top: `${clampY(swingHigh.y)}%` }}>SWING HIGH</b> : null}
          {tools.swings && swingLow ? <b data-swing="low" style={{ top: `${clampY(swingLow.y)}%` }}>SWING LOW</b> : null}
        </div>
        {tools.rsi ? <div className="psRsiBubble" data-state={rsi === null ? "unverified" : rsi >= 70 ? "hot" : rsi <= 30 ? "cold" : "balanced"}><small>RSI</small><strong>{rsi === null ? "—" : Math.round(rsi)}</strong><span>{rsi === null ? "NOT READABLE" : rsi >= 70 ? "OVERBOUGHT AREA" : rsi <= 30 ? "OVERSOLD AREA" : "MID-RANGE"}</span><i><b style={{ width: `${rsi ?? 50}%` }}/></i></div> : null}
      </div>
    </div>
    <nav className="psChartTools" aria-label="Apply analysis tools to uploaded chart">
      <button type="button" data-active={tools.levels} onClick={() => toggle("levels")}><i>═</i><span>S / R</span></button>
      <button type="button" data-active={tools.swings} onClick={() => toggle("swings")}><i>⌃⌄</i><span>SWINGS</span></button>
      <button type="button" data-active={tools.fib} disabled={!analysis.fibLevels.length} onClick={() => toggle("fib")}><i>ϕ</i><span>FIB</span></button>
      <button type="button" data-active={tools.rsi} onClick={() => toggle("rsi")}><i>〽</i><span>RSI</span></button>
    </nav>
    <article className="psFastRead"><div><small>{analysis.setupScore.grade} · {analysis.setupScore.overall}/100</small><strong>{analysis.verdict.replaceAll("_", " ")}</strong></div><p>{shortRead}</p></article>
    <div className="psBubbleActions"><button type="button" onClick={onOpenReport}>MORE DETAIL</button><button type="button" onClick={onShare}>SHARE ↗</button></div>
    <footer>AI CAN MISREAD SCREENSHOTS · CONFIRM EVERY LEVEL ON THE ORIGINAL CHART</footer>
  </section>;
}

function isListedEquityAnalysis(analysis: Analysis | null) {
  if (!analysis || analysis.ticker === "UNKNOWN" || analysis.evidenceQuality.instrumentConfidence !== "HIGH") return false;
  const identity = `${analysis.instrument} ${analysis.ticker}`.toUpperCase();
  return !/(INDEX|DFB|FUTURE|FOREX|FX\b|CRYPTO|BITCOIN|COMMODIT|BOND|YIELD|VIX|ETF)/.test(identity);
}

function DecisionMap({ analysis, sourceImage, expanded = false, scenario = null, onScenario, onReanalyse, reanalysing = false }: { analysis: Analysis; sourceImage?: string | null; expanded?: boolean; scenario?: "bull" | "wait" | "bear" | null; onScenario?: (scenario: "bull" | "wait" | "bear") => void; onReanalyse?: () => void; reanalysing?: boolean }) {
  const verified = analysis.levels.flatMap((level) => {
    const price = numericLevel(level.price);
    return price !== null && ["support", "resistance", "pivot"].includes(level.kind) ? [{ ...level, numericPrice: price }] : [];
  });
  const visualAreas = analysis.levels.filter((level) => ["support", "resistance"].includes(level.kind) && numericLevel(level.price) === null && Number.isFinite(level.y) && level.y >= 0 && level.y <= 100);
  const hasLevelEvidence = verified.length > 0 || visualAreas.length > 0;
  const current = numericLevel(analysis.currentPrice);
  const values = [...verified.map((level) => level.numericPrice), ...(current !== null ? [current] : [])];
  const rawMin = values.length ? Math.min(...values) : 0;
  const rawMax = values.length ? Math.max(...values) : 1;
  const padding = Math.max((rawMax - rawMin) * .16, Math.abs(rawMax || 1) * .0025, 1);
  const min = rawMin - padding;
  const max = rawMax + padding;
  const position = (price: number) => 34 + ((max - price) / (max - min)) * 42;
  const ordered = [...verified].sort((a, b) => b.numericPrice - a.numericPrice);
  const supports = ordered.filter((level) => level.kind === "support" && (current === null || level.numericPrice <= current));
  const resistances = ordered.filter((level) => level.kind === "resistance" && (current === null || level.numericPrice >= current));
  const nearestSupport = supports[0] ?? null;
  const nearestResistance = resistances.at(-1) ?? null;
  const supportDistance = current !== null && nearestSupport ? current - nearestSupport.numericPrice : null;
  const resistanceDistance = current !== null && nearestResistance ? nearestResistance.numericPrice - current : null;
  const formatDistance = (distance: number | null) => distance === null ? "—" : distance.toLocaleString("en-GB", { maximumFractionDigits: 2 });
  const formatPercent = (distance: number | null) => distance === null || current === null || current === 0 ? "" : `${(distance / current * 100).toFixed(2)}%`;
  const proximity = supportDistance !== null && resistanceDistance !== null
    ? "ABOVE SUPPORT · BELOW RESISTANCE"
    : nearestSupport ? "ABOVE SUPPORT" : nearestResistance ? "BELOW RESISTANCE" : "LEVELS UNVERIFIED";
  const currentY = current === null ? 50 : position(current);
  const supportY = nearestSupport ? position(nearestSupport.numericPrice) : Math.min(88, currentY + 18);
  const resistanceY = nearestResistance ? position(nearestResistance.numericPrice) : Math.max(12, currentY - 18);
  const priceDecimals = values.some((value) => Math.abs(value - Math.round(value)) > .001) ? 2 : 0;
  const scaleTicks = Array.from({ length: 7 }, (_, index) => {
    const fraction = index / 6;
    return { price: max - (max - min) * fraction, top: 34 + 42 * fraction };
  });
  const rangeTop = Math.min(resistanceY, supportY);
  const rangeHeight = Math.abs(supportY - resistanceY);
  const locationHeadline = current !== null && nearestSupport && nearestResistance && supportDistance !== null && resistanceDistance !== null
    ? `Price is ${formatDistance(supportDistance)} above support and ${formatDistance(resistanceDistance)} below resistance.`
    : current !== null && nearestSupport && supportDistance !== null
    ? `Price is ${formatDistance(supportDistance)} above verified support.`
    : current !== null && nearestResistance && resistanceDistance !== null
      ? `Price is ${formatDistance(resistanceDistance)} below verified resistance.`
      : "Verified price location needs a clearer scale.";

  return <div className={`psBattlefield psDecisionMap${expanded ? " psBattlefieldExpanded" : ""}${hasLevelEvidence ? "" : " psDecisionMapEmpty"}`} data-scenario={scenario ?? "all"} aria-label="Bullseye Decision Map">
    <header className="psMapIntro"><div><small>YOU ARE HERE</small><strong>{visualAreas.length && !verified.length ? "Visible reaction areas found; exact prices need a clearer scale." : locationHeadline}</strong><p>{visualAreas.length && !verified.length ? "Bullseye preserves the chart geometry without inventing price numbers." : "Nearest verified levels and the conditions that could change this read."}</p></div>{sourceImage ? <figure><img src={sourceImage} alt="Selected source chart thumbnail" /><figcaption>{analysis.timeframe}</figcaption></figure> : null}</header>
    <div className="psBattleGrid" aria-hidden="true" />
    {verified.length ? <div className="psPriceLadder" aria-label="Calibrated Decision Map price ladder">{scaleTicks.map((tick) => <span key={`${tick.price}-${tick.top}`} style={{ top: `${tick.top}%` }}><i /><small>{tick.price.toLocaleString("en-GB", { minimumFractionDigits: priceDecimals, maximumFractionDigits: priceDecimals })}</small></span>)}</div> : null}
    {nearestSupport && nearestResistance ? <div className="psDecisionRange" style={{ top: `${rangeTop}%`, height: `${rangeHeight}%` }} aria-label={`Active decision range from ${nearestSupport.price} to ${nearestResistance.price}`}><span>ACTIVE DECISION RANGE</span><i /><i /><i /></div> : null}
    {current !== null ? <div className="psPressureContours" style={{ top: `${currentY}%` }} aria-hidden="true"><i /><i /><i /></div> : null}
    <div className="psBattleIntel">
      <article data-tone="support"><span>TO SUPPORT</span><strong>{nearestSupport ? formatDistance(supportDistance) : "NOT VERIFIED"}</strong><small>{nearestSupport ? formatPercent(supportDistance) : "CLEARER VIEW NEEDED"}</small></article>
      <article data-tone="location"><span>MARKET LOCATION</span><strong>{proximity}</strong><small>{analysis.timeframe}</small></article>
      <article data-tone="resistance"><span>TO RESISTANCE</span><strong>{nearestResistance ? formatDistance(resistanceDistance) : "NOT VERIFIED"}</strong><small>{nearestResistance ? formatPercent(resistanceDistance) : "CLEARER VIEW NEEDED"}</small></article>
    </div>
    <div className="psBattleScan" aria-hidden="true" />
    <div className="psBattleAxis" aria-hidden="true"><i /><i /><i /></div>
    {current !== null && verified.length ? <svg className="psBattleRoutes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {nearestResistance ? <path data-route="bull" d={`M 50 ${currentY} C 68 ${currentY - 4}, 67 ${resistanceY + 6}, 82 ${resistanceY}`} /> : null}
      {nearestSupport ? <path data-route="bear" d={`M 50 ${currentY} C 32 ${currentY + 4}, 33 ${supportY - 5}, 18 ${Math.min(93, supportY + 7)}`} /> : null}
    </svg> : null}
    {nearestResistance ? <div className="psRouteCue psRouteBull" style={{ top: `${Math.max(16, resistanceY + 4)}%` }}><b>↗</b><span>RECLAIM ROUTE</span></div> : null}
    {nearestSupport ? <div className="psRouteCue psRouteBear" style={{ top: `${Math.min(87, supportY + 7)}%` }}><b>↘</b><span>BREAK ROUTE</span></div> : null}
    {ordered.map((level, index) => <button key={`${level.kind}-${level.numericPrice}-${index}`} type="button" className="psBattleLevel" data-kind={level.kind} style={{ top: `${position(level.numericPrice)}%` }} aria-label={`${level.kind} at ${level.price}`}>
      <span className="psBattleIcon">{level.kind === "support" ? "●" : level.kind === "resistance" ? "●" : "◆"}</span>
      <i /><strong>{level.price}</strong><small>{level.kind === "pivot" ? "SWING REFERENCE" : level.kind.toUpperCase()}</small><em>{current === null ? "" : formatPercent(Math.abs(level.numericPrice - current))}</em>
    </button>)}
    {!verified.length ? visualAreas.map((level, index) => <div key={`${level.kind}-${level.y}-${index}`} className="psBattleLevel psVisualBattleLevel" data-kind={level.kind} style={{ top: `${level.y}%` }} aria-label={`${level.kind} visual reaction area`}><span className="psBattleIcon">●</span><i/><strong>{level.kind.toUpperCase()} AREA</strong><small>VISIBLE · PRICE UNVERIFIED</small></div>) : null}
    {current !== null ? <div className="psBattleCurrent" style={{ top: `${position(current)}%` }}><i /><span><b>◎</b> CURRENT</span><strong>{analysis.currentPrice}</strong></div> : null}
    {verified.length && !nearestSupport ? <button type="button" className="psMissingLevelCue" data-side="support" onClick={() => document.getElementById("psResultSupportInput")?.click()}><span>SUPPORT AREA NOT VERIFIED</span><small>＋ ADD A CLEARER LOWER PRICE-SCALE VIEW</small></button> : null}
    {verified.length && !nearestResistance ? <button type="button" className="psMissingLevelCue" data-side="resistance" onClick={() => document.getElementById("psResultSupportInput")?.click()}><span>RESISTANCE AREA NOT VERIFIED</span><small>＋ ADD A CLEARER UPPER PRICE-SCALE VIEW</small></button> : null}
    {!hasLevelEvidence ? <div className="psBattleEmpty"><b>PRECISION HOLD</b><p>Exact levels could not be verified safely and no defensible reaction area was visible. Add a clearer price-scale view or retry the current images.</p><div><button type="button" onClick={() => document.getElementById("psResultSupportInput")?.click()}>＋ ADD ANOTHER PHOTO</button><button type="button" disabled={reanalysing} onClick={onReanalyse}>{reanalysing ? "REANALYSING…" : "↻ REANALYSE"}</button></div></div> : null}
    <div className="psBattleDirection" data-direction={analysis.direction}><span>BEAR PRESSURE</span><strong>{analysis.direction}</strong><span>BULL PRESSURE</span></div>
    <nav className="psMapActions" aria-label="Explore Decision Map scenarios"><button type="button" data-tone="bull" onClick={() => onScenario?.("bull")}>WHAT IF PRICE RISES?</button><button type="button" data-tone="wait" onClick={() => onScenario?.("wait")}>WHY WAIT?</button><button type="button" data-tone="bear" onClick={() => onScenario?.("bear")}>WHAT IF PRICE FALLS?</button></nav>
  </div>;
}

function SourceChart({ image, expanded = false }: { image: string; expanded?: boolean }) {
  return <div className={expanded ? "psSourceChart psSourceChartExpanded" : "psSourceChart"}>
    <img src={image} alt="Original uploaded trading chart" />
  </div>;
}

type ScenarioKind = "bull" | "wait" | "bear";
function ScenarioTheatre({ analysis }: { analysis: Analysis; sourceImage: string }) {
  const active: ScenarioKind = analysis.direction === "BULLISH" ? "bull" : analysis.direction === "BEARISH" ? "bear" : "wait";
  const [selected, setSelected] = useState<ScenarioKind>(active);
  const levels = analysis.levels.flatMap((level) => { const price = numericLevel(level.price); return price === null ? [] : [{ ...level, priceValue: price }]; });
  const current = numericLevel(analysis.currentPrice);
  const support = levels.filter((level) => level.kind === "support" && (current === null || level.priceValue <= current)).sort((a,b) => b.priceValue-a.priceValue)[0];
  const resistance = levels.filter((level) => level.kind === "resistance" && (current === null || level.priceValue >= current)).sort((a,b) => a.priceValue-b.priceValue)[0];
  const scenarios: Array<{ kind: ScenarioKind; icon: string; title: string; status: string; trigger: string; failure: string }> = [
    { kind: "bull", icon: "↗", title: "BULL CONTINUATION", status: analysis.direction === "BULLISH" ? "ACTIVE READ" : "ALTERNATE PATH", trigger: analysis.bullConfirmation || analysis.nextSequence.confirmation, failure: resistance ? `Failure to hold above ${resistance.price}` : analysis.invalidation },
    { kind: "wait", icon: "↔", title: "PATIENCE / RANGE", status: analysis.direction === "NEUTRAL" ? "ACTIVE READ" : "SAFETY PATH", trigger: analysis.nextSequence.patience || analysis.noTradeCondition, failure: analysis.nextSequence.reassess },
    { kind: "bear", icon: "↘", title: "BEAR BREAKDOWN", status: analysis.direction === "BEARISH" ? "ACTIVE READ" : "ALTERNATE PATH", trigger: analysis.bearConfirmation || analysis.nextSequence.failure, failure: support ? `Recovery and hold above ${support.price}` : analysis.invalidation },
  ];
  const chosen = scenarios.find((scenario) => scenario.kind === selected) ?? scenarios[1];
  return <section className="psScenarioTheatre" data-selected={selected}>
    <header><div><span>◈ IF / THEN DECISION PATHS</span><small>NO FORECAST CANDLES · ONLY CONDITIONS PRICE CAN PROVE</small></div><strong>{active.toUpperCase()}<br/>ACTIVE READ</strong></header>
    <nav className="psConditionChoices" role="group" aria-label="Choose a conditional market path">{scenarios.map((scenario) => <button key={scenario.kind} type="button" data-kind={scenario.kind} data-active={selected === scenario.kind} data-read={active === scenario.kind} aria-pressed={selected === scenario.kind} onClick={() => setSelected(scenario.kind)}><b>{scenario.icon}</b><span>{scenario.title}</span><small>{active === scenario.kind ? "● CURRENT READ" : "○ ALTERNATE"}</small></button>)}</nav>
    <article className="psConditionBoard" data-kind={selected} aria-live="polite"><header><span>{chosen.title}</span><strong>{chosen.status}</strong></header><div><section><small>ACTIVATES ONLY IF</small><p>{chosen.trigger}</p></section><i>→</i><section><small>WEAKENS / FAILS IF</small><p>{chosen.failure}</p></section></div><footer><b>NO PROOF, NO TRADE</b><span>This path stays inactive until the chart confirms it.</span></footer></article>
  </section>;
}

type XRayLayer = "patterns" | "levels" | "swings" | "fib" | "rsi";

function ChartXRay({ analysis, sourceImage, onAddChart, onReanalyse, hasContext, reanalysing }: { analysis: Analysis; sourceImage: string; onAddChart: (event: ChangeEvent<HTMLInputElement>) => void; onReanalyse: () => void; hasContext: boolean; reanalysing: boolean }) {
  const [layer] = useState<XRayLayer>("patterns");
  const drawablePatterns = analysis.patterns.filter((pattern) => (pattern.geometry?.points?.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)).length ?? 0) >= 2);
  const verifiedLevels = analysis.levels.filter((item) => numericLevel(item.price) !== null && ["support", "resistance", "pivot"].includes(item.kind));
  const drawableLevels = analysis.levels.filter((item) => ["support", "resistance"].includes(item.kind));
  const swingLevels = analysis.levels.filter((item) => item.kind === "pivot");
  const numericLevels: NumericChartLevel[] = verifiedLevels.map((item) => ({ kind: item.kind as NumericChartLevel["kind"], label: item.label, price: numericLevel(item.price)! }));
  const contextLevels: NumericChartLevel[] = (analysis.contextBattlefield?.levels ?? []).filter((item) => numericLevel(item.price) !== null && ["support", "resistance", "pivot"].includes(item.kind)).map((item) => ({ kind: item.kind as NumericChartLevel["kind"], label: item.label, price: numericLevel(item.price)! }));
  const current = numericLevel(analysis.currentPrice ?? "");
  const rankedLevels = rankChartLevels(numericLevels, current, contextLevels, analysis.evidenceQuality.scaleReadable);
  const range = calculateRangePosition(current, rankedLevels);
  const rsiMatch = analysis.momentum.match(/RSI[^0-9]{0,18}(\d{1,3}(?:\.\d+)?)/i);
  const rsi = rsiMatch ? Math.max(0, Math.min(100, Number(rsiMatch[1]))) : null;
  const formatPrice = (value: number) => new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(value);
  return <section className="psChartXRay" data-layer={layer}>
    <header><div><span>⌖ BULLSEYE PATTERN X-RAY</span><small>VISIBLE FORMATIONS · DRAWN ON YOUR CHART</small></div><strong>1 FOCUSED TOOL</strong></header>
    <div className="psXRayCanvas"><img src={sourceImage} alt="Customer's uploaded source chart with verified Bullseye X-Ray overlays"/><div className="psXRayShade"/><div className="psXRayScan" aria-hidden="true"/>
      {layer === "patterns" ? <><svg className="psXRayPatterns" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Detected chart pattern overlay">{drawablePatterns.flatMap((pattern, index) => {
        const points = pattern.geometry?.points?.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)) ?? [];
        if (points.length < 2) return [];
        const path = points.map((point) => `${point.x},${point.y}`).join(" ");
        return [<g key={`${pattern.name}-${index}`} data-status={pattern.status} data-confidence={pattern.confidence ?? "LOW"}><polyline points={path} vectorEffect="non-scaling-stroke"/><circle cx={points[0].x} cy={points[0].y} r="1.2" vectorEffect="non-scaling-stroke"/><circle cx={points.at(-1)!.x} cy={points.at(-1)!.y} r="1.2" vectorEffect="non-scaling-stroke"/></g>];
      })}</svg><div className="psXRayPatternLabels">{drawablePatterns.map((pattern, index) => { const points = pattern.geometry!.points; const left = Math.min(72, Math.max(3, pattern.geometry?.labelX ?? points[0].x)); const top = Math.min(88, Math.max(8, pattern.geometry?.labelY ?? points[0].y)); return <span key={`${pattern.name}-label-${index}`} data-status={pattern.status} style={{ left: `${left}%`, top: `${top}%` }}>{pattern.name}<b>{pattern.status}</b></span>; })}</div></> : null}
      {layer === "levels" ? <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Verified chart level overlay">{drawableLevels.map((item, index) => <g key={`${item.kind}-${item.label}-${index}`} data-kind={item.kind}><line x1={item.x} y1={item.y} x2={item.x2} y2={item.y2} vectorEffect="non-scaling-stroke"/><circle cx={item.x} cy={item.y} r="1.15" vectorEffect="non-scaling-stroke"/><text x={Math.min(82, Math.max(3, item.x + 2))} y={Math.min(96, Math.max(5, item.y - 2))}>{numericLevel(item.price) !== null ? item.price : item.label}</text></g>)}</svg> : null}
      {layer === "swings" ? <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Detected swing high and low overlay">{swingLevels.map((item, index) => <g key={`${item.label}-${index}`} data-kind="pivot"><circle cx={item.x} cy={item.y} r="2" vectorEffect="non-scaling-stroke"/><line x1={Math.max(1, item.x - 4)} y1={item.y} x2={Math.min(99, item.x + 4)} y2={item.y} vectorEffect="non-scaling-stroke"/><text x={Math.min(78, Math.max(3, item.x + 3))} y={Math.min(96, Math.max(6, item.y - 3))}>{item.label || "SWING"}</text></g>)}</svg> : null}
      {layer === "fib" ? <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Fibonacci retracement overlay">{analysis.fibLevels.map((item, index) => <g key={`${item.ratio}-${index}`} data-kind="fib"><line x1="5" y1={item.y} x2="95" y2={item.y} vectorEffect="non-scaling-stroke"/><text x="6" y={Math.min(97, Math.max(5, item.y - 1.5))}>{item.ratio} · {item.price}</text></g>)}</svg> : null}
      {layer === "rsi" ? <div className="psXRayRsi" data-state={rsi === null ? "unverified" : rsi >= 70 ? "hot" : rsi <= 30 ? "cold" : "balanced"}><small>VISIBLE RSI</small><strong>{rsi === null ? "—" : Math.round(rsi)}</strong><span>{rsi === null ? "NOT SHOWN ON CHART" : rsi >= 70 ? "OVERBOUGHT AREA" : rsi <= 30 ? "OVERSOLD AREA" : "MID-RANGE"}</span><i><b style={{ width: `${rsi ?? 50}%` }}/></i></div> : null}
      <span className="psXRaySource">● SOURCE CHART</span><span className="psXRayLayerTag">{layer.toUpperCase()} LAYER</span></div>
    <div className="psXRayCounts psPatternOnlyCounts" aria-label="Pattern X-Ray summary"><article data-tone="verified"><strong>{drawablePatterns.filter((item) => item.confidence === "HIGH").length}</strong><span>HIGH-CONFIDENCE</span></article><article data-tone="uncertain"><strong>{drawablePatterns.length}</strong><span>VISIBLE PATTERNS</span></article><article data-tone="missing"><strong>{drawablePatterns.filter((item) => item.status === "FORMING" || item.status === "AMBIGUOUS").length}</strong><span>NEEDS CONFIRMING</span></article></div>
    <article className="psXRayRead" aria-live="polite">
      {layer === "patterns" ? <><small>PATTERN SCAN · VISIBLE GEOMETRY ONLY</small>{drawablePatterns.length ? <div className="psPatternXRayRead">{drawablePatterns.map((pattern) => <section key={`${pattern.name}-${pattern.status}`} data-status={pattern.status}><div><strong>{pattern.name}</strong><b>{pattern.status}</b></div><p>{pattern.evidence}</p><span>CONFIRMS IF · {pattern.confirmation}</span></section>)}</div> : <div className="psToolkitEmpty"><strong>NO CLEAN PATTERN VISIBLE</strong><p>This chart does not contain enough defensible geometry for a gallery pattern.</p><span>Try a wider 30m, 1h or 4h chart showing more candles.</span></div>}</> : null}
      {layer === "levels" ? <><small>SUPPORT + RESISTANCE · VERIFIED PRICE AREAS</small>{rankedLevels.filter((item) => item.kind !== "pivot").length ? <div className="psLevelRanking">{rankedLevels.filter((item) => item.kind !== "pivot").slice(0, 5).map((item, index) => <section key={`${item.kind}-${item.price}`} data-kind={item.kind} data-confidence={item.verification}><i>{index + 1}</i><div><span>{item.kind.toUpperCase()} · {item.verification} VERIFICATION</span><strong>{formatPrice(item.price)}</strong><small>{item.distance === null ? "DISTANCE NEEDS CURRENT PRICE" : `${formatPrice(item.distance)} PTS · ${item.distancePercent!.toFixed(2)}% AWAY`} · {item.reason.replaceAll("_", " ")}</small></div></section>)}</div> : <div className="psToolkitEmpty"><strong>EXACT LEVELS NOT VERIFIED</strong><p>{analysis.levelStory}</p><span>Attach a clearer price-scale chart, then reanalyse.</span></div>}</> : null}
      {layer === "swings" ? <><small>SWING MAP · VISIBLE TURNING POINTS</small>{swingLevels.length ? <ul>{swingLevels.slice(0, 5).map((item) => <li key={`${item.label}-${item.x}-${item.y}`}>{item.label}{item.price ? ` · ${item.price}` : ""}</li>)}</ul> : <div className="psToolkitEmpty"><strong>NO CLEAN SWINGS MARKED</strong><p>The screenshot did not provide a defensible swing point.</p></div>}</> : null}
      {layer === "fib" ? <><small>FIBONACCI · VERIFIED SWING ANCHORS ONLY</small>{analysis.fibLevels.length ? <div className="psFibXRayRead">{analysis.fibLevels.map((item) => <span key={`${item.ratio}-${item.price}`}><b>{item.ratio}</b><strong>{item.price}</strong></span>)}</div> : <div className="psToolkitEmpty"><strong>FIBONACCI NOT AVAILABLE</strong><p>Two reliable priced swing anchors were not visible.</p></div>}</> : null}
      {layer === "rsi" ? <><small>RSI · READ ONLY WHEN THE INDICATOR IS VISIBLE</small><div className="psToolkitScore"><strong>{rsi === null ? "—" : Math.round(rsi)}<small>{rsi === null ? "" : "/100"}</small></strong><span>{rsi === null ? "No readable RSI panel was supplied. Bullseye will not estimate it from price candles." : analysis.momentum}</span></div></> : null}
    </article>
    <div className="psXRayActions"><label><input id="psXRaySupportInput" type="file" accept="image/jpeg,image/png,image/webp" onChange={onAddChart}/><span>＋ ADD TIMEFRAME PHOTO</span></label><button type="button" disabled={!hasContext || reanalysing} onClick={onReanalyse}>{reanalysing ? "ANALYSING…" : "↻ REANALYSE ALL CHARTS"}</button></div>
    <footer><b>PATTERN FIRST</b><span>X-Ray draws only formations visible in the uploaded candles and named in the Pattern Gallery. No clean geometry means no forced pattern.</span></footer>
  </section>;
}

function MarketStory({ analysis, sourceImage, onShare, onOpenReport, viewerName, intention }: { analysis: Analysis; sourceImage: string; onShare: () => void; onOpenReport: (target?: string) => void; viewerName: string; intention: Intention }) {
  const [scene, setScene] = useState(0);
  const [paused, setPaused] = useState(false);
  const sceneNames = ["OPEN", "EVIDENCE", "LEVELS", "BATTLE", "RISK", "DECISION", "BULLSEYE"];
  const verifiedLevels = rankChartLevels(analysis.levels.flatMap((level) => {
    const price = numericLevel(level.price);
    return price !== null && ["support", "resistance", "pivot"].includes(level.kind) ? [{ kind: level.kind as NumericChartLevel["kind"], label: level.label, price }] : [];
  }), numericLevel(analysis.currentPrice), [], analysis.evidenceQuality.scaleReadable);
  const balance = evidenceBalance(analysis);
  const dailyMessage = personalDailyMessage(analysis, viewerName);
  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => setScene((current) => (current + 1) % sceneNames.length), 6000);
    return () => window.clearTimeout(timer);
  }, [scene, paused, sceneNames.length]);
  const previous = () => setScene((current) => (current + sceneNames.length - 1) % sceneNames.length);
  const next = () => setScene((current) => (current + 1) % sceneNames.length);
  const openExplanation = (id: string) => { setPaused(true); onOpenReport(id); };
  return <section className="psMarketStory" data-scene={scene} data-direction={analysis.direction}>
    <header><div><span>◈ {viewerName ? `${viewerName.toUpperCase()}'S` : "YOUR"} BULLSEYE MARKET STORY</span><small>BUILT FROM YOUR CHART · {intention === "UNSURE" ? "OPEN-MINDED READ" : `${intention} IDEA CHALLENGED`}</small></div><button type="button" onClick={() => setPaused((value) => !value)}>{paused ? "▶ PLAY" : "Ⅱ PAUSE"}</button></header>
    <div className="psStoryProgress" aria-label={`Scene ${scene + 1} of ${sceneNames.length}`}>{sceneNames.map((name, index) => <button key={name} type="button" data-complete={index < scene} data-active={index === scene} onClick={() => setScene(index)} aria-label={`Open ${name.toLowerCase()} scene`}><span/><small>{name}</small>{index === scene && !paused ? <i key={`${scene}-${paused}`}/> : null}</button>)}</div>
    <div className="psStoryStage">
      <img src={sourceImage} alt="Customer's uploaded chart forming the animated Bullseye market story"/>
      <div className="psStoryShade"/><div className="psStoryScan" aria-hidden="true"/>
      <div className="psCinemaFx" aria-hidden="true"><i/><i/><i/><b>{String(scene + 1).padStart(2, "0")}</b></div>
      <button type="button" className="psStoryPrevious" onClick={previous} aria-label="Previous story scene">‹</button><button type="button" className="psStoryNext" onClick={next} aria-label="Next story scene">›</button>
      <div className="psStoryScene" key={scene} aria-live="polite">
        {scene === 0 ? <article className="psStorySetup"><small>CHAPTER 01 · {viewerName ? `${viewerName.toUpperCase()}, YOUR ANALYSIS IS READY` : "YOUR ANALYSIS IS READY"}</small><h2>{analysis.instrument}</h2><div><span>{analysis.timeframe}</span><b data-direction={analysis.direction}>{analysis.direction}</b></div><p>Bullseye has challenged the chart, the opposing case and the conditions that could change this read.</p></article> : null}
        {scene === 1 ? <article className="psStoryEvidence"><small>CHAPTER 02 · VERIFIED EVIDENCE</small><h2>Evidence before opinion.</h2><ul>{analysis.observableFacts.slice(0, 2).map((fact) => <li key={fact}>{fact}</li>)}</ul><div><span>IMAGE {analysis.evidenceQuality.chartReadability}</span><span>SCALE {analysis.evidenceQuality.scaleReadable ? "VERIFIED" : "UNVERIFIED"}</span></div><section className="psEvidencePulse"><b>STRUCTURE</b><p>{analysis.marketStructure}</p><b>MOMENTUM</b><p>{analysis.momentum}</p></section><button type="button" onClick={() => openExplanation("bullseye-evidence")}>OPEN VERIFIED EVIDENCE ↓</button></article> : null}
        {scene === 2 ? <article className="psStoryLevels"><small>CHAPTER 03 · THE PRICE BATTLEFIELD</small><h2>{verifiedLevels.length ? `${verifiedLevels.length} level${verifiedLevels.length === 1 ? "" : "s"} survived verification.` : "Exact levels remain unverified."}</h2><div>{analysis.currentPrice ? <span><small>CURRENT</small><b>{analysis.currentPrice}</b></span> : null}{verifiedLevels.slice(0, 3).map((level) => <span key={`${level.kind}-${level.price}`} data-kind={level.kind}><small>{level.kind.toUpperCase()}</small><b>{level.price}</b></span>)}</div><p>{analysis.levelStory}</p><button type="button" onClick={() => openExplanation("bullseye-levels")}>EXPLORE PRICE LEVELS ↓</button></article> : null}
        {scene === 3 ? <article className="psStoryBattle"><small>CHAPTER 04 · BULL VS BEAR</small><h2>Two stories are fighting for control.</h2><div><section data-side="bull"><b>🐂 BULL EVIDENCE</b><p>{analysis.bullishCase}</p></section><i>VS</i><section data-side="bear"><b>🐻 BEAR EVIDENCE</b><p>{analysis.bearishCase}</p></section></div></article> : null}
        {scene === 4 ? <article className="psStoryRisks psStoryRiskPro"><small>CHAPTER 05 · RISK CONTROL</small><h2>What could make this read wrong?</h2><div><section><b>⚡ CONTRADICTIONS</b><ul>{(analysis.contradictions.length ? analysis.contradictions : ["No clear contradiction is visible in this screenshot."]).slice(0, 2).map((item) => <li key={item}>{item}</li>)}</ul></section><section><b>⚠ RISK FLAGS</b><ul>{analysis.riskFlags.slice(0, 2).map((item) => <li key={item}>{item}</li>)}</ul></section></div><div className="psEventSafety"><strong>{analysis.setupScore.eventSafety}<small>/10</small></strong><span>EVENT SAFETY · CONFIRM THE LIVE CALENDAR</span></div><p>TRADER TRAP · {analysis.traderTrap}</p></article> : null}
        {scene === 5 ? <article className="psStoryTrigger psStoryDecisionPro"><small>CHAPTER 06 · DECISION CONDITIONS</small><h2>Do not guess. Let price prove it.</h2><div><section><b>◆ STRENGTHENS WHEN</b><p>{analysis.nextSequence.confirmation}</p></section><section><b>✕ BREAKS WHEN</b><p>{analysis.nextSequence.failure || analysis.invalidation}</p></section></div><p>STAND ASIDE · {analysis.noTradeCondition}</p><section className="psNextCheck"><b>RIGHT NOW</b><span>{analysis.nextSequence.now}</span><b>NEXT CHECK</b><span>{analysis.nextSequence.reassess}</span></section></article> : null}
        {scene === 6 ? <article className="psStoryVerdict psStoryFinale psFinalePage"><small>FINAL CHAPTER · PERSONAL RESULT</small><div className="psFinaleTarget psLaunchTarget" aria-hidden="true"><i/><i/><i/><b>🎯</b><span>LOCKING<br/>EVIDENCE</span></div><div className="psFinaleLogo"><span className="psLogoMark"><i/></span><strong>BULLSEYE</strong></div><h1>{viewerName ? `${viewerName.toUpperCase()}'S` : "YOUR"}<span>EVIDENCE BALANCE</span></h1><div className="psFinaleRatioCards" aria-label={`Bull ${balance.bull} percent, bear ${balance.bear} percent evidence balance`}><section data-side="bull"><i>🐂</i><span>BULL CASE</span><strong>{balance.bull}<small>%</small></strong></section><b>VS</b><section data-side="bear"><i>🐻</i><span>BEAR CASE</span><strong>{balance.bear}<small>%</small></strong></section></div><div className="psFinaleBalanceBar"><i style={{ width: `${balance.bull}%` }}/><b/><span>EVIDENCE BALANCE · NOT PROBABILITY</span></div><div className="psFinaleScore"><strong>{analysis.setupScore.grade}</strong><span>{analysis.setupScore.overall}<small>/100</small></span><b data-direction={analysis.direction}>{analysis.direction} · {analysis.verdict.replaceAll("_", " ")}</b></div><h2>{analysis.verdictHeadline}</h2><p className="psDailyMessage"><span>YOUR MESSAGE FOR TODAY</span>{dailyMessage}</p><div className="psFinaleActions"><button type="button" onClick={() => onOpenReport()}>OPEN FULL WRITTEN REPORT →</button><button type="button" onClick={onShare}>SHARE MY BULLSEYE ↗</button></div></article> : null}
      </div>
    </div>
    <nav className="psStoryLinks" aria-label="Open the solid-state explanation"><button type="button" onClick={() => openExplanation("bullseye-events")}><b>01</b><span>EVENTS</span></button><button type="button" onClick={() => openExplanation("bullseye-levels")}><b>02</b><span>PRICE LEVELS</span></button><button type="button" onClick={() => openExplanation("bullseye-evidence")}><b>03</b><span>EVIDENCE</span></button></nav>
    <footer><b>STORY, NOT CERTAINTY</b><span>Every chapter is conditional decision support built from the uploaded screenshot. It does not predict a future price or instruct a trade.</span></footer>
  </section>;
}

function ClarityLock({ analysis }: { analysis: Analysis }) {
  const metrics = ([
    ["STRUCTURE", analysis.setupScore.structure], ["MOMENTUM", analysis.setupScore.momentum],
    ["LOCATION", analysis.setupScore.location], ["CONFIRM", analysis.setupScore.confirmation],
    ["RISK", analysis.setupScore.riskClarity], ["EVENTS", analysis.setupScore.eventSafety],
  ] as const);
  const aligned = metrics.filter(([, score]) => score >= 7).length;
  return <section className="psClarityLock psClarityClassic" data-direction={analysis.direction}>
    <header><div><span>🎯 BULLSEYE CLARITY LOCK</span><small>DECISION CLARITY · NOT PERMISSION TO TRADE</small></div><strong>{aligned}<small>/6</small><b> ALIGNED</b></strong></header>
    <div className="psClarityBars">{metrics.map(([label, score]) => <article key={label} data-strength={score >= 8 ? "high" : score >= 6 ? "mid" : "low"}><div><span>{label}</span><strong>{score}<small>/10</small></strong></div><i><b style={{ width: `${score * 10}%` }}/></i></article>)}</div>
    <footer><span>CLARITY STATUS</span><strong>{aligned >= 5 ? "STRONG ALIGNMENT" : aligned >= 3 ? "PARTIAL ALIGNMENT" : "EVIDENCE NOT LOCKED"}</strong><p>{analysis.verdictHeadline}</p></footer>
  </section>;
}

function BullseyePlan({ analysis, onResultCard }: { analysis: Analysis; onResultCard: () => void }) {
  return <section className="psBullseyePlan">
    <header><div><span>🧭 YOUR BULLSEYE PLAN</span><small>THE RESULT IN FOUR DECISIONS</small></div><button type="button" onClick={onResultCard}>VIEW RESULT CARD ↗</button></header>
    <div>
      <article data-step="now"><i>01</i><small>RIGHT NOW</small><strong>{analysis.verdict.replaceAll("_", " ")}</strong><p>{analysis.summary}</p></article>
      <article data-step="lock"><i>02</i><small>CLARITY IMPROVES WHEN</small><strong>{analysis.nextSequence.confirmation}</strong></article>
      <article data-step="break"><i>03</i><small>THE READ FAILS WHEN</small><strong>{analysis.nextSequence.failure || analysis.invalidation}</strong></article>
      <article data-step="next"><i>04</i><small>NEXT CHECK</small><strong>{analysis.nextSequence.reassess}</strong></article>
    </div>
  </section>;
}

const PATTERN_GUIDE = [
  { name: "HEAD & SHOULDERS", aliases: ["HEAD AND SHOULDERS", "HEAD & SHOULDERS"], family: "REVERSAL", path: "5,72 18,52 30,67 48,22 65,66 78,50 94,73", look: "Three peaks; the middle peak is highest.", confirms: "A decisive neckline break and hold below.", trap: "Calling it early before the right shoulder and neckline break." },
  { name: "INVERSE H&S", aliases: ["INVERSE H&S", "INVERSE HEAD AND SHOULDERS", "INVERSE HEAD & SHOULDERS"], family: "REVERSAL", path: "5,28 18,48 30,33 48,78 65,34 78,50 94,27", look: "Three troughs; the middle trough is deepest.", confirms: "A decisive neckline break and hold above.", trap: "Treating any three lows as a completed reversal." },
  { name: "RISING WEDGE", aliases: ["RISING WEDGE"], family: "BEARISH RISK", path: "6,77 25,38 40,66 57,30 72,53 94,25", look: "Both boundaries rise while the range contracts.", confirms: "A lower-boundary break with follow-through.", trap: "Assuming bearishness while price is still contained." },
  { name: "FALLING WEDGE", aliases: ["FALLING WEDGE"], family: "BULLISH POTENTIAL", path: "6,24 25,62 40,34 57,69 72,47 94,73", look: "Both boundaries fall while the range contracts.", confirms: "An upper-boundary break with follow-through.", trap: "Buying before price proves the breakout." },
  { name: "BULL FLAG", aliases: ["BULL FLAG", "BULLISH FLAG"], family: "CONTINUATION", path: "5,82 27,20 38,40 50,31 62,50 74,41 94,25", look: "Strong upward pole followed by controlled downward drift.", confirms: "A break above the flag boundary with acceptance.", trap: "Mistaking a deep reversal for a shallow pause." },
  { name: "BEAR FLAG", aliases: ["BEAR FLAG", "BEARISH FLAG"], family: "CONTINUATION", path: "5,18 27,80 38,60 50,69 62,50 74,59 94,75", look: "Strong downward pole followed by controlled upward drift.", confirms: "A break below the flag boundary with acceptance.", trap: "Selling while the recovery structure remains intact." },
  { name: "DOUBLE TOP / BOTTOM", aliases: ["DOUBLE TOP", "DOUBLE BOTTOM"], family: "REVERSAL", path: "5,70 25,25 47,68 70,25 94,72", look: "Two clear tests of a similar extreme with a reaction between.", confirms: "Break of the intervening swing or neckline.", trap: "Treating the second test alone as confirmation." },
  { name: "TRIANGLE", aliases: ["SYMMETRICAL TRIANGLE", "SYMMETRIC TRIANGLE", "TRIANGLE"], family: "COMPRESSION", path: "5,20 22,78 39,32 56,67 73,42 94,55", look: "Lower highs and higher lows compress price toward an apex.", confirms: "A boundary break that holds outside the structure.", trap: "Predicting direction before the market chooses one." },
  { name: "ASCENDING TRIANGLE", aliases: ["ASCENDING TRIANGLE"], family: "BULLISH PRESSURE", path: "5,76 22,30 38,63 54,30 69,51 84,30 95,38", look: "Repeated tests of flat resistance while swing lows rise.", confirms: "A clean break and acceptance above the flat ceiling.", trap: "Buying rising lows before resistance actually gives way." },
  { name: "DESCENDING TRIANGLE", aliases: ["DESCENDING TRIANGLE"], family: "BEARISH PRESSURE", path: "5,24 22,70 38,37 54,70 69,49 84,70 95,62", look: "Repeated tests of flat support while swing highs fall.", confirms: "A clean break and acceptance below the flat floor.", trap: "Selling falling highs before support actually fails." },
  { name: "PENNANT", aliases: ["BULL PENNANT", "BEAR PENNANT", "BULLISH PENNANT", "BEARISH PENNANT", "PENNANT"], family: "CONTINUATION", path: "5,82 25,18 38,36 52,64 64,41 76,58 94,48", look: "A sharp impulse followed by a small converging pause.", confirms: "A break from the pennant in the impulse direction.", trap: "Calling a broad, long consolidation a pennant." },
  { name: "CUP & HANDLE", aliases: ["CUP AND HANDLE", "CUP & HANDLE"], family: "BULLISH BASE", path: "5,28 16,52 28,69 42,76 56,69 68,52 77,28 85,40 94,31", look: "A rounded base returns to resistance, then forms a shallow pullback.", confirms: "A break and hold above the cup rim after the handle.", trap: "Accepting a V-shaped bounce or a handle that retraces too deeply." },
  { name: "RECTANGLE / RANGE", aliases: ["RECTANGLE", "TRADING RANGE", "RANGE"], family: "BALANCE", path: "5,30 18,70 32,30 46,70 60,30 74,70 94,30", look: "Repeated reactions between a clear horizontal ceiling and floor.", confirms: "A close outside the range followed by acceptance or a retest.", trap: "Treating an intrabar poke outside the range as a breakout." },
  { name: "TREND CHANNEL", aliases: ["RISING CHANNEL", "FALLING CHANNEL", "TREND CHANNEL", "CHANNEL"], family: "TREND", path: "5,75 20,51 34,64 49,39 63,51 78,27 94,39", look: "Price oscillates between two roughly parallel sloping boundaries.", confirms: "Repeated reactions validate both rails; a break signals a change.", trap: "Drawing a channel from too few touches or forcing parallel lines." },
  { name: "BREAKOUT & RETEST", aliases: ["BREAKOUT-RETEST", "BREAKOUT AND RETEST", "BREAKOUT & RETEST", "BREAKDOWN-RETEST"], family: "LEVEL TRANSITION", path: "5,72 34,72 46,28 61,28 72,68 82,55 94,35", look: "Price clears a level, revisits it from the other side, then reacts.", confirms: "The old boundary holds on retest and price resumes away from it.", trap: "Calling the first return a successful retest before it reacts." },
] as const;

function PatternWatch({ analysis }: { analysis: Analysis }) {
  const [guideOpen, setGuideOpen] = useState(true);
  const [selectedGuide, setSelectedGuide] = useState<string>(PATTERN_GUIDE[0].name);
  const suppliedFrames = [analysis.timeframe, analysis.higherTimeframe.provided ? analysis.higherTimeframe.timeframe : ""].filter(Boolean);
  const selectGuide = (name: string) => {
    const normalized = name.toUpperCase();
    const match = PATTERN_GUIDE
      .flatMap((item) => item.aliases.map((alias) => ({ item, alias })))
      .filter(({ alias }) => normalized === alias || normalized.includes(alias) || alias.includes(normalized))
      .sort((left, right) => Number(normalized === right.alias) - Number(normalized === left.alias) || right.alias.length - left.alias.length)[0]?.item;
    if (match) setSelectedGuide(match.name);
    setGuideOpen(true);
  };
  const selected = PATTERN_GUIDE.find((item) => item.name === selectedGuide) ?? PATTERN_GUIDE[0];
  return <section className="psPatternWatch">
    <header><div><span>◫ PATTERN WATCH</span><small>30M · 1H · 4H STRUCTURE CHECK</small></div><button type="button" onClick={() => setGuideOpen((open) => !open)}>{guideOpen ? "HIDE GALLERY" : "SHOW GALLERY"}</button></header>
    <div className="psPatternFrames">{["30M","1H","4H"].map((frame) => <span key={frame} data-supplied={suppliedFrames.some((value) => value.toUpperCase().replace("MIN", "M").replace("HOUR", "H").includes(frame))}>{frame}<small>{suppliedFrames.some((value) => value.toUpperCase().replace("MIN", "M").replace("HOUR", "H").includes(frame)) ? "CHART READ" : "NOT SUPPLIED"}</small></span>)}</div>
    {analysis.patterns.length ? <div className="psPatternSignals">{analysis.patterns.map((pattern, index) => <article key={`${pattern.name}-${index}`} data-status={pattern.status} data-confidence={pattern.confidence ?? "LOW"}><header><div><small>{pattern.timeframe || analysis.timeframe} · {pattern.confidence ?? "LOW"} CONFIDENCE</small><strong>{pattern.name}</strong></div><b>{pattern.status}</b></header><p>{pattern.evidence}</p><div><span>CONFIRMS IF</span><strong>{pattern.confirmation || "The visible boundary breaks and holds."}</strong></div><div><span>INVALID IF</span><strong>{pattern.invalidation}</strong></div><button type="button" onClick={() => selectGuide(pattern.name)}>WHAT DOES THIS MEAN? →</button></article>)}</div> : <div className="psPatternNone"><strong>NO SIGNIFICANT PATTERN VERIFIED</strong><p>The chart does not currently show a clean named formation. Bullseye will not force a label onto ordinary price noise.</p></div>}
    {guideOpen ? <div className="psPatternGuide"><nav aria-label="Choose a chart pattern">{PATTERN_GUIDE.map((item) => <button key={item.name} type="button" data-active={selected.name === item.name} onClick={() => setSelectedGuide(item.name)}>{item.name}</button>)}</nav><article><header><div><small>{selected.family}</small><strong>{selected.name}</strong></div><svg viewBox="0 0 100 100" aria-hidden="true"><polyline points={selected.path}/><line x1="5" y1="76" x2="95" y2="76"/></svg></header><dl><div><dt>LOOK FOR</dt><dd>{selected.look}</dd></div><div><dt>CONFIRMATION</dt><dd>{selected.confirms}</dd></div><div><dt>COMMON TRAP</dt><dd>{selected.trap}</dd></div></dl><footer>A shape is not a signal by itself. Wait for the stated boundary or neckline confirmation.</footer></article></div> : null}
  </section>;
}

type CommandDeckMode = "xray" | "patterns" | "scenarios" | "plan" | "risk" | "pulse";
type RiskCurrency = "GBP" | "USD" | "EUR";
type StoredRiskDesk = RiskDeskInput & { currency: RiskCurrency; version: 1 };

const EMPTY_RISK_DESK: RiskDeskInput = { accountValue: "", riskPercent: "0.5", stopDistance: "", valuePerPoint: "" };

function RiskDesk() {
  const [input, setInput] = useState<RiskDeskInput>(EMPTY_RISK_DESK);
  const [currency, setCurrency] = useState<RiskCurrency>("GBP");
  const [status, setStatus] = useState("");
  const calculation = calculateRiskDesk(input);
  const money = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = JSON.parse(localStorage.getItem("pocket-risk-desk-v1") ?? "null") as StoredRiskDesk | null;
        if (!stored || stored.version !== 1) return;
        setInput({ accountValue: stored.accountValue, riskPercent: stored.riskPercent, stopDistance: stored.stopDistance, valuePerPoint: stored.valuePerPoint });
        if (["GBP", "USD", "EUR"].includes(stored.currency)) setCurrency(stored.currency);
      } catch {}
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const update = (key: keyof RiskDeskInput, value: string) => setInput((current) => ({ ...current, [key]: value }));
  const save = () => {
    try {
      const stored: StoredRiskDesk = { ...input, currency, version: 1 };
      localStorage.setItem("pocket-risk-desk-v1", JSON.stringify(stored));
      setStatus("Saved privately on this device.");
    } catch { setStatus("This browser could not save your risk settings."); }
  };

  return <section className="psRiskDesk">
    <header><div><span>🛡 PERSONAL RISK DESK</span><small>YOUR LIMITS · YOUR DEVICE · NO ORDER CONNECTION</small></div><strong>{calculation.riskPercent !== null && calculation.riskPercent > 2 ? "HIGH LIMIT" : "PRIVATE"}</strong></header>
    <div className="psRiskDeskBody">
      <form onSubmit={(event) => { event.preventDefault(); save(); }}>
        <label><span>ACCOUNT VALUE</span><div><select aria-label="Account currency" value={currency} onChange={(event) => setCurrency(event.target.value as RiskCurrency)}><option value="GBP">GBP</option><option value="USD">USD</option><option value="EUR">EUR</option></select><input aria-label="Account value" inputMode="decimal" value={input.accountValue} onChange={(event) => update("accountValue", event.target.value)} placeholder="10,000" /></div></label>
        <label><span>MAX RISK PER IDEA</span><div><input aria-label="Maximum risk percent" inputMode="decimal" value={input.riskPercent} onChange={(event) => update("riskPercent", event.target.value)} placeholder="0.5" /><b>%</b></div></label>
        <label><span>STOP DISTANCE</span><div><input aria-label="Stop distance in points" inputMode="decimal" value={input.stopDistance} onChange={(event) => update("stopDistance", event.target.value)} placeholder="Optional" /><b>PTS</b></div></label>
        <label><span>VALUE PER POINT / UNIT</span><div><input aria-label="Value per point per unit" inputMode="decimal" value={input.valuePerPoint} onChange={(event) => update("valuePerPoint", event.target.value)} placeholder="Check broker" /><b>{currency}</b></div></label>
        <button type="submit">SAVE ON THIS DEVICE</button>
      </form>
      <div className="psRiskReadout" aria-live="polite">
        <article><small>MAX CASH RISK</small><strong>{money(calculation.cashRisk)}</strong><span>{calculation.riskPercent === null ? "Add account value and risk %" : `${calculation.riskPercent}% personal ceiling`}</span></article>
        <article><small>RISK PER UNIT</small><strong>{money(calculation.riskPerUnit)}</strong><span>Stop distance × value per point</span></article>
        <article data-primary><small>ILLUSTRATIVE MAX UNITS</small><strong>{calculation.units ?? "—"}</strong><span>{calculation.units === 0 ? "The stated unit risk exceeds your cash limit" : "Round down only · never up"}</span></article>
      </div>
    </div>
    {status ? <p className="psRiskStatus" role="status">{status}</p> : null}
    <footer><b>VERIFY CONTRACT SPECS</b><span>This calculator uses only the figures you enter. It does not know leverage, fees, slippage, margin or your broker’s contract size, and it does not place or recommend a trade.</span></footer>
  </section>;
}

function SignalPulse({ analysis }: { analysis: Analysis }) {
  const signal = analysis.patterns[0];
  const visibleLevels = analysis.levels.filter((level) => ["support", "resistance", "zone"].includes(level.kind));
  const state = signal ? signal.status : visibleLevels.length >= 2 ? "LEVELS ACTIVE" : "NO CLEAN SIGNAL";
  const tone = signal?.status === "CONFIRMED" ? "strong" : signal?.status === "FAILED" ? "weak" : "watch";
  return <section className="psSignalPulse" data-tone={tone}>
    <header><div><span>◉ SIGNAL PULSE</span><small>WHAT IS DEVELOPING NOW</small></div><b>{state}</b></header>
    <div className="psPulseCore"><i /><i /><i /><strong>{signal?.name ?? "MARKET STRUCTURE"}</strong><span>{signal ? `${signal.timeframe || analysis.timeframe} · ${signal.confidence ?? "LOW"} CONFIDENCE` : `${visibleLevels.length} VISIBLE LEVEL${visibleLevels.length === 1 ? "" : "S"}`}</span></div>
    <div className="psPulseRead"><article><small>FORMING</small><strong>{signal?.evidence ?? "No gallery pattern is clean enough to name yet."}</strong></article><article><small>WAKES UP IF</small><strong>{signal?.confirmation ?? analysis.nextSequence.confirmation}</strong></article><article><small>FAILS IF</small><strong>{signal?.invalidation ?? analysis.nextSequence.failure}</strong></article></div>
    <footer>Signal Pulse reports visible development — it does not turn an unfinished shape into a trade signal.</footer>
  </section>;
}

function PocketCommandDeck({ analysis, sourceImage, onResultCard, onAddChart, onReanalyse, hasContext, reanalysing }: { analysis: Analysis; sourceImage: string; onResultCard: () => void; onAddChart: (event: ChangeEvent<HTMLInputElement>) => void; onReanalyse: () => void; hasContext: boolean; reanalysing: boolean }) {
  const [mode, setMode] = useState<CommandDeckMode>("xray");
  const modes: Array<{ id: CommandDeckMode; number: string; label: string; detail: string }> = [
    { id: "xray", number: "01", label: "CHART X-RAY", detail: "SOURCE AUDIT" },
    { id: "patterns", number: "02", label: "PATTERNS", detail: "FORMING SIGNALS" },
    { id: "scenarios", number: "03", label: "SCENARIOS", detail: "IF / THEN PATHS" },
    { id: "plan", number: "04", label: "PLAN", detail: "CLARITY LOCK" },
    { id: "risk", number: "05", label: "RISK", detail: "PERSONAL LIMITS" },
    { id: "pulse", number: "06", label: "SIGNAL PULSE", detail: "LIVE FORMATION" },
  ];

  return <section id="bullseye-evidence" className="psCommandDeck">
    <header><div><span>◎ POCKET BULLSEYE 2.0</span><strong>SCAN. UNDERSTAND. PLAN. REVIEW.</strong></div><b>COMMAND DECK</b></header>
    <nav aria-label="Pocket Bullseye command deck">{modes.map((item) => <button key={item.id} type="button" data-active={mode === item.id} aria-pressed={mode === item.id} onClick={() => setMode(item.id)}><i>{item.number}</i><span>{item.label}</span><small>{item.detail}</small></button>)}</nav>
    <div className="psCommandStage" data-mode={mode}>
      {mode === "xray" ? <ChartXRay analysis={analysis} sourceImage={sourceImage} onAddChart={onAddChart} onReanalyse={onReanalyse} hasContext={hasContext} reanalysing={reanalysing} /> : null}
      {mode === "patterns" ? <PatternWatch analysis={analysis} /> : null}
      {mode === "scenarios" ? <ScenarioTheatre analysis={analysis} sourceImage={sourceImage} /> : null}
      {mode === "plan" ? <><ClarityLock analysis={analysis} /><BullseyePlan analysis={analysis} onResultCard={onResultCard} /></> : null}
      {mode === "risk" ? <RiskDesk /> : null}
      {mode === "pulse" ? <SignalPulse analysis={analysis} /> : null}
    </div>
    <footer><span>Every mode stays evidence-first. Scenario graphics are conditional illustrations; risk figures come only from your inputs.</span></footer>
  </section>;
}

function ResultCard({ analysis, onClose, onShare }: { analysis: Analysis; onClose: () => void; onShare: () => void }) {
  const verified = analysis.levels.filter((level) => numericLevel(level.price) !== null && ["support", "resistance", "pivot"].includes(level.kind)).slice(0, 3);
  return <section className="psResultCardModal" role="dialog" aria-modal="true" aria-label="Shareable Pocket Bullseye result card">
    <div className="psShareCard">
      <header><span>🎯 POCKET BULLSEYE</span><button type="button" onClick={onClose} aria-label="Close result card">×</button></header>
      <div className="psShareIdentity"><small>PRIVATE DECISION AUDIT</small><strong>{analysis.instrument}</strong><span>{analysis.timeframe}</span></div>
      <div className="psShareScore"><strong>{analysis.setupScore.grade}</strong><div><span>{analysis.setupScore.overall}<small>/100</small></span><b data-direction={analysis.direction}>{analysis.direction}</b><em>{analysis.verdict.replaceAll("_", " ")}</em></div></div>
      <h2>{analysis.verdictHeadline}</h2>
      {verified.length ? <div className="psShareLevels">{verified.map((level, index) => <article key={`${level.kind}-${level.price}-${index}`} data-kind={level.kind}><small>{level.kind.toUpperCase()}</small><strong>{level.price}</strong></article>)}</div> : null}
      <article className="psShareNext"><small>CLARITY IMPROVES WHEN</small><p>{analysis.nextSequence.confirmation}</p></article>
      <footer><span>CONDITIONAL DECISION SUPPORT</span><small>NOT A TRADE INSTRUCTION · VERIFY ON SOURCE PLATFORM</small></footer>
      <div className="psShareActions"><button type="button" onClick={onClose}>BACK TO RESULT</button><button type="button" onClick={onShare}>SAVE / SHARE CARD ↗</button></div>
    </div>
  </section>;
}

function formatEventTime(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London", timeZoneName: "short" }).format(parsed);
}

function londonDay(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(parsed);
}

function londonClock(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false }).format(parsed);
}

function openVault() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("bullseye-decision-vault", 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("decisions")) request.result.createObjectStore("decisions", { keyPath: "id" });
      if (!request.result.objectStoreNames.contains("analyses")) request.result.createObjectStore("analyses", { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const POCKET_ANALYSIS_ENGINE_VERSION = 8 as const;
type CachedAnalysis = { key: string; analysis: Analysis; createdAt: string; version: typeof POCKET_ANALYSIS_ENGINE_VERSION };

function hasVerifiedStructuralLevel(analysis: Analysis) {
  return analysis.levels.some((level) =>
    numericLevel(level.price) !== null && ["support", "resistance", "pivot"].includes(level.kind),
  );
}

async function analysisCacheKey(image: string, contextImage: string | null, intention: Intention, confirmation: ChartConfirmation | null = null, correction: AccuracyFeedback | null = null) {
  const bytes = new TextEncoder().encode(`pocket-analysis-v${POCKET_ANALYSIS_ENGINE_VERSION}\n${intention}\n${JSON.stringify(confirmation)}\n${JSON.stringify(correction)}\n${image}\n${contextImage ?? ""}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function analysisCacheGet(key: string): Promise<Analysis | null> {
  const db = await openVault();
  return new Promise((resolve, reject) => {
    const request = db.transaction("analyses", "readonly").objectStore("analyses").get(key);
    request.onsuccess = () => {
      const cached = request.result as CachedAnalysis | undefined;
      resolve(cached?.version === POCKET_ANALYSIS_ENGINE_VERSION ? cached.analysis : null);
    };
    request.onerror = () => reject(request.error);
  });
}

async function analysisCacheSave(key: string, analysis: Analysis) {
  const db = await openVault();
  return new Promise<void>((resolve, reject) => {
    const value: CachedAnalysis = { key, analysis, createdAt: new Date().toISOString(), version: POCKET_ANALYSIS_ENGINE_VERSION };
    const request = db.transaction("analyses", "readwrite").objectStore("analyses").put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function vaultList(): Promise<LockedDecision[]> {
  const db = await openVault();
  return new Promise((resolve, reject) => {
    const request = db.transaction("decisions", "readonly").objectStore("decisions").getAll();
    request.onsuccess = () => resolve((normalizeLockedDecisions(request.result) as unknown as LockedDecision[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    request.onerror = () => reject(request.error);
  });
}

async function vaultSave(decision: LockedDecision) {
  const db = await openVault();
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction("decisions", "readwrite").objectStore("decisions").put(decision);
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
  });
}

async function prepareImage(file: File): Promise<string> {
  // Preserve every accepted chart byte-for-byte. Dark-mode labels, candles and
  // fine grid detail must never be softened by a browser-side JPEG conversion.
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function FeedbackButton() {
  const problemHref = "mailto:hello@nashaimarkets.com?subject=Pocket%20Bullseye%20%E2%80%94%20problem&body=What%20went%20wrong%3F%0A%0AWhat%20were%20you%20doing%3F%0A%0ADevice%20or%20browser%20(if%20known)%3A%0A";
  const ideaHref = "mailto:hello@nashaimarkets.com?subject=Pocket%20Bullseye%20%E2%80%94%20idea&body=My%20idea%20for%20Pocket%20Bullseye%3A%0A%0AWhy%20it%20would%20help%3A%0A";

  return <details id="pocket-feedback" className="psFeedback">
    <summary aria-label="Send Pocket Bullseye feedback"><span>💬</span><strong>FEEDBACK</strong></summary>
    <div>
      <p>Help us improve Pocket Bullseye.</p>
      <a href={problemHref}><b>⚠</b><span><strong>REPORT A PROBLEM</strong><small>Tell us what went wrong</small></span></a>
      <a href={ideaHref}><b>✦</b><span><strong>SUGGEST AN IDEA</strong><small>Help shape what comes next</small></span></a>
    </div>
  </details>;
}

export default function PocketBullseye({ macroContext }: { macroContext: VerifiedMacroContext }) {
  const [image, setImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [contextImage, setContextImage] = useState<string | null>(null);
  const [contextFileName, setContextFileName] = useState("");
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [preflightStatus, setPreflightStatus] = useState<PreflightStatus>("IDLE");
  const [chartConfirmation, setChartConfirmation] = useState<ChartConfirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [accuracyCorrection, setAccuracyCorrection] = useState<AccuracyFeedback | null>(null);
  const [correctionOriginal, setCorrectionOriginal] = useState<Analysis | null>(null);
  const [immersive, setImmersive] = useState(false);
  const [chartFocus, setChartFocus] = useState(false);
  const [stockEvents, setStockEvents] = useState<StockEvent[]>([]);
  const [stockEventStatus, setStockEventStatus] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
  const [intention, setIntention] = useState<Intention>("UNSURE");
  const [vault, setVault] = useState<LockedDecision[]>([]);
  const [reviewTarget, setReviewTarget] = useState<LockedDecision | null>(null);
  const [review, setReview] = useState<ProcessReview | null>(null);
  const [vaultMessage, setVaultMessage] = useState("");
  const [followUpQuestion, setFollowUpQuestion] = useState("");
  const [followUpReply, setFollowUpReply] = useState<FollowUpReply | null>(null);
  const [followUpBusy, setFollowUpBusy] = useState(false);
  const [followUpError, setFollowUpError] = useState("");
  const [refinementStatus, setRefinementStatus] = useState<"idle" | "attached" | "analysing" | "updated" | "error">("idle");
  const [levelLabImage, setLevelLabImage] = useState<string | null>(null);
  const [levelLabFileName, setLevelLabFileName] = useState("");
  const [levelLabStatus, setLevelLabStatus] = useState<"idle" | "attached" | "scanning" | "updated" | "error">("idle");
  const [levelLabError, setLevelLabError] = useState("");
  const [refinementBefore, setRefinementBefore] = useState<Analysis | null>(null);
  const [showResultReveal, setShowResultReveal] = useState(false);
  const [showResultCard, setShowResultCard] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<"bull" | "wait" | "bear" | null>(null);
  const [battlefieldChart, setBattlefieldChart] = useState<"primary" | "context">("primary");
  const [viewerName, setViewerName] = useState("");
  const [resultView, setResultView] = useState<"cinema" | "report">("cinema");
  const [appleAccess, setAppleAccess] = useState<AppleAccessStatus | null>(null);
  const [showApplePaywall, setShowApplePaywall] = useState(false);
  const analysisRequestActive = useRef(false);
  const followUpRequestActive = useRef(false);
  const levelLabRequestActive = useRef(false);

  useEffect(() => { vaultList().then(setVault).catch(() => setVaultMessage("Decision Vault is unavailable on this device.")); }, []);

  useEffect(() => {
    getAppleAccessStatus().then(setAppleAccess).catch(() => setAppleAccess(null));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { setViewerName(localStorage.getItem("pocket-bullseye-viewer-name") ?? ""); } catch {}
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setStockEvents([]);
      if (!analysis || !isListedEquityAnalysis(analysis)) { setStockEventStatus("idle"); return; }
      setStockEventStatus("loading");
      fetch(`/api/pocket/events?symbol=${encodeURIComponent(analysis.ticker)}`, { signal: controller.signal })
        .then(async (response) => {
          const payload = await response.json() as { events?: StockEvent[] };
          if (!response.ok) throw new Error("unavailable");
          setStockEvents(payload.events ?? []);
          setStockEventStatus("ready");
        })
        .catch((error) => { if (error instanceof Error && error.name !== "AbortError") setStockEventStatus("unavailable"); });
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [analysis]);

  useEffect(() => {
    if (!immersive && !chartFocus && !showResultReveal && !showResultCard) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [immersive, chartFocus, showResultReveal, showResultCard]);

  async function loadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setAnalysis(null);
    setBattlefieldChart("primary");
    if (!file.type.startsWith("image/")) {
      setError("Please choose a JPEG, PNG or WebP chart image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("That image is too large. Please use a chart screenshot under 8 MB.");
      return;
    }
    try {
      const prepared = await prepareImage(file);
      setImage(prepared);
      setFileName(file.name);
    } catch { setError("That image could not be prepared safely."); }
  }

  async function loadContextFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("Please choose a JPEG, PNG or WebP higher-timeframe chart.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("That higher-timeframe image is too large. Please use a screenshot under 8 MB.");
      return;
    }
    try {
      setContextImage(await prepareImage(file));
      setContextFileName(file.name);
    } catch { setError("That higher-timeframe image could not be prepared safely."); }
  }

  async function addResultContextFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const resultScroller = event.currentTarget.closest(".psResults") as HTMLElement | null;
    const savedScrollTop = resultScroller?.scrollTop ?? 0;
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("Please choose a JPEG, PNG or WebP supporting chart.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("That supporting chart is too large. Please use a screenshot under 8 MB.");
      return;
    }
    try {
      const prepared = await prepareImage(file);
      setContextImage(prepared);
      setContextFileName(file.name);
      setRefinementStatus("attached");
      setBattlefieldChart("context");
      requestAnimationFrame(() => { if (resultScroller) resultScroller.scrollTop = savedScrollTop; });
    } catch (caught) {
      setRefinementStatus("error");
      setError(caught instanceof Error ? caught.message : "That supporting chart could not be attached safely.");
    } finally {
      event.currentTarget.value = "";
    }
  }

  async function addLevelLabFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLevelLabError("");
    if (!file.type.startsWith("image/") || file.size > MAX_IMAGE_BYTES) {
      setLevelLabStatus("error");
      setLevelLabError("Please add a JPEG, PNG or WebP chart under 8 MB.");
      event.currentTarget.value = "";
      return;
    }
    try {
      setLevelLabImage(await prepareImage(file));
      setLevelLabFileName(file.name);
      setLevelLabStatus("attached");
    } catch {
      setLevelLabStatus("error");
      setLevelLabError("That chart could not be prepared safely.");
    } finally { event.currentTarget.value = ""; }
  }

  async function rescanLevelsOnly() {
    if (!analysis || !levelLabImage || levelLabRequestActive.current) return;
    levelLabRequestActive.current = true;
    setLevelLabStatus("scanning");
    setLevelLabError("");
    try {
      const precisionImage = await createPrecisionReadingCrop(levelLabImage);
      const response = await fetch("/api/pocket/levels", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image: levelLabImage, precisionImage }) });
      const payload = await response.json() as { levels?: Pick<Analysis, "plotBounds" | "priceScaleAnchors" | "levels" | "currentPrice" | "levelStory">; error?: string };
      if (!response.ok || !payload.levels) throw new Error(payload.error || "The independent level scan could not complete.");
      setAnalysis((current) => current ? {
        ...current,
        plotBounds: payload.levels!.plotBounds,
        priceScaleAnchors: payload.levels!.priceScaleAnchors,
        levels: payload.levels!.levels.map((level) => ({ ...level, y: clampY(level.y) })),
        currentPrice: payload.levels!.currentPrice || current.currentPrice,
        levelStory: payload.levels!.levelStory || current.levelStory,
      } : current);
      setBattlefieldChart("primary");
      setLevelLabStatus("updated");
    } catch (caught) {
      setLevelLabStatus("error");
      setLevelLabError(caught instanceof Error ? caught.message : "The independent level scan could not complete.");
    } finally { levelLabRequestActive.current = false; }
  }

  async function reanalyseResult() {
    if (!analysis || busy || analysisRequestActive.current) return;
    const resultScroller = document.querySelector(".psResults") as HTMLElement | null;
    const savedScrollTop = resultScroller?.scrollTop ?? 0;
    setError("");
    setRefinementBefore(analysis);
    setRefinementStatus("analysing");
    try {
      const refreshed = await requestPocketAnalysis(contextImage, { bypassCache: true });
      setAnalysis(refreshed);
      setStockEvents([]);
      setStockEventStatus(refreshed.ticker === "UNKNOWN" ? "unavailable" : "loading");
      const primaryHasVerifiedLevels = refreshed.levels.some((level) => numericLevel(level.price) !== null && ["support", "resistance", "pivot"].includes(level.kind));
      const contextHasVerifiedLevels = refreshed.contextBattlefield?.levels?.some((level) => numericLevel(level.price) !== null && ["support", "resistance", "pivot"].includes(level.kind));
      setBattlefieldChart(!primaryHasVerifiedLevels && contextHasVerifiedLevels ? "context" : "primary");
      setRefinementStatus("updated");
      requestAnimationFrame(() => { if (resultScroller) resultScroller.scrollTop = savedScrollTop; });
    } catch (caught) {
      setRefinementStatus("error");
      setError(caught instanceof Error ? caught.message : "This result could not be reanalysed safely.");
    }
  }

  function openResultReport(target?: string) {
    setResultView("report");
    requestAnimationFrame(() => requestAnimationFrame(() => target ? document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" }) : document.querySelector(".psResults")?.scrollTo({ top: 0, behavior: "smooth" })));
  }

  function applyAccuracyCorrection(feedback: AccuracyFeedback) {
    const patch = correctionPatch(feedback);
    setAccuracyCorrection(feedback);
    setAnalysis((current) => {
      if (!current) return current;
      setCorrectionOriginal((original) => original ?? current);
      let levels = current.levels;
      if (patch.level) {
        const index = levels.findIndex((level) => level.kind === patch.level!.kind);
        const verified = index >= 0
          ? { ...levels[index], price: patch.level.price, label: `${levels[index].label} · USER VERIFIED` }
          : { kind: patch.level.kind, label: `USER VERIFIED ${patch.level.kind.toUpperCase()}`, price: patch.level.price, x: 10, y: 50, x2: 90, y2: 50 };
        levels = index >= 0 ? levels.map((level, levelIndex) => levelIndex === index ? verified : level) : [...levels, verified];
      }
      return { ...current, instrument: patch.instrument ?? current.instrument, timeframe: patch.timeframe ?? current.timeframe, currentPrice: patch.currentPrice ?? current.currentPrice, levels };
    });
  }

  async function reanalyseWithCorrection() {
    if (!accuracyCorrection || !image || busy) return;
    setError("");
    try {
      const corrected = await requestPocketAnalysis(contextImage, { bypassCache: true });
      setAnalysis(corrected);
      setResultView("report");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Correction replay could not complete safely.");
    }
  }

  async function requestPocketAnalysis(selectedContext: string | null, options: { bypassCache?: boolean } = {}): Promise<Analysis> {
    if (!image || analysisRequestActive.current) throw new Error("An analysis is already running.");
    analysisRequestActive.current = true;
    setBusy(true);
    try {
      const cacheKey = await analysisCacheKey(image, selectedContext, intention, chartConfirmation, accuracyCorrection);
      if (!options.bypassCache) {
        const cached = await analysisCacheGet(cacheKey).catch(() => null);
        // A held/empty result must never become sticky. Only reuse evidence
        // that contains an independently verified structural price level.
        if (cached && hasVerifiedStructuralLevel(cached)) return cached;
      }
      const [precisionImage, contextPrecisionImage] = await Promise.all([
        createPrecisionReadingCrop(image),
        selectedContext ? createPrecisionReadingCrop(selectedContext) : Promise.resolve(null),
      ]);
      const response = await fetch("/api/pocket/analyse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image, contextImage: selectedContext, precisionImage, contextPrecisionImage, intention, chartConfirmation, accuracyCorrection }),
      });
      const payload = await response.json() as { analysis?: Analysis; error?: string };
      if (!response.ok || !payload.analysis) throw new Error(payload.error || "Analysis is temporarily unavailable.");
      payload.analysis.levels = payload.analysis.levels.map((level) => ({ ...level, y: clampY(level.y) }));
      if (hasVerifiedStructuralLevel(payload.analysis)) {
        await analysisCacheSave(cacheKey, payload.analysis).catch(() => undefined);
      }
      return payload.analysis;
    } finally {
      analysisRequestActive.current = false;
      setBusy(false);
    }
  }

  async function analyse() {
    if (!image || !privacyChecked || busy || analysisRequestActive.current || (!reviewTarget && !preflightAllowsAnalysis(preflightStatus))) return;
    if (!reviewTarget && isAppleNativeApp() && !appleAccess) {
      setError("Apple purchase status is temporarily unavailable. Please check your connection and try again; you have not been charged.");
      getAppleAccessStatus().then(setAppleAccess).catch(() => undefined);
      return;
    }
    if (!reviewTarget && appleAccess?.isNative && appleAccess.freeUseConsumed && !appleAccess.entitled) {
      setShowApplePaywall(true);
      return;
    }
    setError("");
    try {
      if (!reviewTarget) {
        const nextAnalysis = await requestPocketAnalysis(contextImage);
        setStockEvents([]);
        setStockEventStatus(nextAnalysis.ticker === "UNKNOWN" ? "unavailable" : "loading");
        setAnalysis(nextAnalysis);
        if (appleAccess?.isNative && !appleAccess.entitled && !appleAccess.freeUseConsumed) {
          await consumeAppleFreeUse();
          setAppleAccess({ ...appleAccess, freeUseConsumed: true });
        }
        setResultView("cinema");
        setImmersive(true);
        setShowResultReveal(true);
        return;
      }
      analysisRequestActive.current = true;
      setBusy(true);
      const response = await fetch("/api/pocket/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ beforeImage: reviewTarget.image, afterImage: image, lockedAnalysis: reviewTarget.analysis }),
      });
      const payload = await response.json() as { review?: ProcessReview; error?: string };
      if (!response.ok || !payload.review) throw new Error(payload.error || "Review is temporarily unavailable.");
      setReview(payload.review); setImmersive(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis is temporarily unavailable.");
    } finally {
      analysisRequestActive.current = false;
      setBusy(false);
    }
  }

  async function askBullseye(question = followUpQuestion) {
    if (!analysis || !question.trim() || followUpBusy || followUpRequestActive.current) return;
    followUpRequestActive.current = true;
    setFollowUpBusy(true); setFollowUpError(""); setFollowUpReply(null);
    try {
      const response = await fetch("/api/pocket/follow-up", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ analysis, question: question.trim() }),
      });
      const payload = await response.json() as { reply?: FollowUpReply; error?: string };
      if (!response.ok || !payload.reply) throw new Error(payload.error || "Ask Bullseye is temporarily unavailable.");
      setFollowUpReply(payload.reply); setFollowUpQuestion(question.trim());
    } catch (caught) {
      setFollowUpError(caught instanceof Error ? caught.message : "Ask Bullseye is temporarily unavailable.");
    } finally { followUpRequestActive.current = false; setFollowUpBusy(false); }
  }

  async function shareDecision() {
    if (!analysis) return;
    const summary = [
      `Pocket Bullseye · ${analysis.instrument} · ${analysis.timeframe}`,
      `Grade ${analysis.setupScore.grade} (${analysis.setupScore.overall}/100) · ${analysis.verdict.replaceAll("_", " ")}`,
      analysis.verdictHeadline,
      `Confirmation: ${analysis.nextSequence.confirmation}`,
      `Failure: ${analysis.nextSequence.failure}`,
      "Conditional decision support—not a trade instruction.",
    ].join("\n");
    try {
      if (navigator.share) await navigator.share({ title: "Pocket Bullseye decision audit", text: summary });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(summary); setVaultMessage("Decision summary copied."); }
    } catch { setVaultMessage("Sharing was cancelled."); }
  }

  async function shareResultCard() {
    if (!analysis) return;
    const canvas = document.createElement("canvas");
    canvas.width = 1080; canvas.height = 1350;
    const context = canvas.getContext("2d");
    if (!context) return;
    const wrap = (copy: string, x: number, y: number, width: number, lineHeight: number, maxLines: number) => {
      const words = copy.split(/\s+/); let line = ""; let row = 0;
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (context.measureText(candidate).width > width && line) { context.fillText(line, x, y + row * lineHeight); line = word; row += 1; if (row >= maxLines) return y + row * lineHeight; }
        else line = candidate;
      }
      if (row < maxLines) context.fillText(line, x, y + row * lineHeight);
      return y + (row + 1) * lineHeight;
    };
    const gradient = context.createLinearGradient(0, 0, 1080, 1350);
    gradient.addColorStop(0, "#111b21"); gradient.addColorStop(.58, "#071014"); gradient.addColorStop(1, "#0b1812");
    context.fillStyle = gradient; context.fillRect(0, 0, 1080, 1350);
    context.strokeStyle = "#55e99b"; context.lineWidth = 4; context.strokeRect(34, 34, 1012, 1282);
    context.fillStyle = "#65eda7"; context.font = "700 35px monospace"; context.fillText("◎ POCKET BULLSEYE", 78, 112);
    context.fillStyle = "#75838b"; context.font = "700 22px monospace"; context.fillText("PRIVATE DECISION AUDIT", 78, 158);
    context.fillStyle = "#e8f0ec"; context.font = "700 37px sans-serif"; context.fillText(analysis.instrument, 78, 235);
    context.fillStyle = "#9aa8a1"; context.font = "700 25px monospace"; context.fillText(analysis.timeframe, 78, 276);
    context.fillStyle = "#55e99b"; context.font = "700 230px sans-serif"; context.fillText(analysis.setupScore.grade, 76, 520);
    context.fillStyle = "#edf4f0"; context.font = "700 66px monospace"; context.fillText(`${analysis.setupScore.overall}/100`, 455, 410);
    context.fillStyle = analysis.direction === "BULLISH" ? "#55e99b" : analysis.direction === "BEARISH" ? "#ef6672" : "#e1bb5b";
    context.font = "700 34px monospace"; context.fillText(`${analysis.direction} · ${analysis.verdict.replaceAll("_", " ")}`, 455, 474);
    context.fillStyle = "#e8f0ec"; context.font = "700 48px sans-serif";
    let nextY = wrap(analysis.verdictHeadline, 78, 635, 924, 62, 4) + 35;
    context.strokeStyle = "#2d3b42"; context.beginPath(); context.moveTo(78, nextY); context.lineTo(1002, nextY); context.stroke();
    nextY += 62; context.fillStyle = "#d9b45b"; context.font = "700 23px monospace"; context.fillText("CLARITY IMPROVES WHEN", 78, nextY);
    nextY += 49; context.fillStyle = "#c4cec9"; context.font = "500 31px sans-serif"; wrap(analysis.nextSequence.confirmation, 78, nextY, 924, 43, 5);
    context.fillStyle = "#68777f"; context.font = "700 19px monospace"; context.fillText("CONDITIONAL DECISION SUPPORT · NOT A TRADE INSTRUCTION", 78, 1250);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    const file = new File([blob], "pocket-bullseye-result.png", { type: "image/png" });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "Pocket Bullseye Result" });
      else { const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = file.name; link.click(); URL.revokeObjectURL(link.href); setVaultMessage("Result card downloaded without your chart image."); }
    } catch { setVaultMessage("Sharing was cancelled."); }
  }

  async function lockDecision() {
    if (!analysis || !image) return;
    const decision: LockedDecision = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), intention, image, analysis };
    try { await vaultSave(decision); setVault((current) => [decision, ...current]); setVaultMessage("Saved privately on this device. Upload a later chart whenever you want Bullseye to review the decision process."); }
    catch { setVaultMessage("This decision could not be saved on this device."); }
  }

  async function shareFoundingInvite() {
    const url = `${window.location.origin}/join`;
    const text = "Try Pocket Bullseye — upload a chart and get an evidence-first second opinion before you trade. Founding 650 access is £4.99/month.";
    try {
      if (navigator.share) {
        await navigator.share({ title: "Pocket Bullseye", text, url });
        setVaultMessage("Pocket Bullseye invite shared.");
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setVaultMessage("Founding 650 invite link copied. Paste it into any message.");
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") {
        setVaultMessage("Sharing was cancelled.");
        return;
      }
      setVaultMessage("The invite could not open automatically. Visit the Founding 650 page and copy its address.");
    }
  }

  function startReview(decision: LockedDecision) {
    setReviewTarget(decision); setReview(null); setAnalysis(null); setImage(null); setFileName(""); setContextImage(null); setContextFileName(""); setImmersive(false); setError("");
  }

  const vaultStats = (() => {
    const total = vault.length;
    if (!total) return { total: 0, average: 0, patience: 0, commonRisk: "NOT ENOUGH HISTORY", dominant: "NO PATTERN YET" };
    const average = Math.round(vault.reduce((sum, item) => sum + item.analysis.setupScore.overall, 0) / total);
    const patience = Math.round(vault.filter((item) => item.analysis.verdict !== "WATCH").length / total * 100);
    const risks = new Map<string, number>();
    const instruments = new Map<string, number>();
    vault.forEach((item) => {
      item.analysis.riskFlags.forEach((risk) => risks.set(risk, (risks.get(risk) ?? 0) + 1));
      instruments.set(item.analysis.instrument, (instruments.get(item.analysis.instrument) ?? 0) + 1);
    });
    const top = (map: Map<string, number>, fallback: string) => [...map.entries()].sort((a,b) => b[1] - a[1])[0]?.[0] ?? fallback;
    return { total, average, patience, commonRisk: top(risks, "NO REPEATED RISK"), dominant: top(instruments, "NO PATTERN YET") };
  })();

  const sourceChart = (focus = false) => image ? <SourceChart image={image} expanded={focus} /> : null;
  const contextSourceChart = (focus = false) => contextImage ? <SourceChart image={contextImage} expanded={focus} /> : null;

  if (review && reviewTarget) {
    return <main className="psApp" data-pocket-build="v3.1"><section className="psResults" data-immersive="true"><div className="psImmersiveBar"><span>BULLSEYE · PROCESS REVIEW</span><button type="button" onClick={() => { setReview(null); setReviewTarget(null); setImage(null); }}>DONE</button></div><header className="psVerdict psReviewVerdict"><p><i /> BEFORE VS AFTER · OUTCOME IS NOT PROCESS</p><div className="psVerdictTop"><h1><small>PROCESS GRADE</small><em data-grade={review.processGrade}>{review.processGrade}</em></h1><div><small>{review.decisionQuality}/100</small><strong>{review.outcome}</strong></div></div><h2>{review.headline}</h2><span>{review.outcomeSummary}</span></header><section className="psReviewGrid"><article><span>CONFIRMATION</span><p>{review.confirmationReview}</p></article><article><span>INVALIDATION</span><p>{review.invalidationReview}</p></article><article><span>TIMING</span><p>{review.timingReview}</p></article><article><span>DISCIPLINE</span><p>{review.disciplineReview}</p></article></section><section className="psAuditGrid"><article data-audit="improve"><span>LESSONS TO CARRY FORWARD</span><ul>{review.lessons.map((lesson) => <li key={lesson}>{lesson}</li>)}</ul></article><article data-audit="trap"><span>BEHAVIOUR TAGS</span><p>{review.behaviourTags.join(" · ") || "No reliable behaviour tag"}</p></article></section>{review.goodDecisionBadOutcome ? <p className="psProcessNote">GOOD DECISION · BAD OUTCOME — protect the process; do not rewrite it because of one result.</p> : null}<p className="psLegal">Screenshots cannot prove exact execution. Confirm fills and P&amp;L on the original platform.</p></section><FeedbackButton /></main>;
  }

  if (analysis) {
    const todayInLondon = londonDay(new Date().toISOString());
    const todayMacro = macroContext.releases.filter((event) => londonDay(event.scheduledAt) === todayInLondon).sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
    const contextBattlefield = analysis.contextBattlefield;
    const primaryNumericLevels: NumericChartLevel[] = analysis.levels.flatMap((level) => {
      const price = numericLevel(level.price);
      return price !== null && ["support", "resistance", "pivot"].includes(level.kind)
        ? [{ kind: level.kind as NumericChartLevel["kind"], label: level.label, price }]
        : [];
    });
    const contextNumericLevels: NumericChartLevel[] = (contextBattlefield?.levels ?? []).flatMap((level) => {
      const price = numericLevel(level.price);
      return price !== null && ["support", "resistance", "pivot"].includes(level.kind)
        ? [{ kind: level.kind as NumericChartLevel["kind"], label: level.label, price }]
        : [];
    });
    const combinedNumericLevels = mergeCompatibleChartLevels(
      primaryNumericLevels,
      contextNumericLevels,
      numericLevel(analysis.currentPrice),
      numericLevel(contextBattlefield?.currentPrice),
    );
    const combinedLevels: Level[] = combinedNumericLevels.map((numeric) => {
      const source = analysis.levels.find((level) => level.kind === numeric.kind && numericLevel(level.price) === numeric.price)
        ?? contextBattlefield?.levels.find((level) => level.kind === numeric.kind && numericLevel(level.price) === numeric.price);
      return source ?? { kind: numeric.kind, label: numeric.label, price: String(numeric.price), x: 0, y: 0, x2: 0, y2: 0 };
    });
    const combinedAnalysis: Analysis = { ...analysis, levels: combinedLevels };
    const battlefieldAnalysis: Analysis = battlefieldChart === "context" && contextBattlefield ? {
      ...analysis,
      levels: Array.isArray(contextBattlefield.levels) ? contextBattlefield.levels : [],
      currentPrice: contextBattlefield.currentPrice,
      timeframe: analysis.higherTimeframe.timeframe || "CONTEXT",
      direction: analysis.higherTimeframe.direction === "UNKNOWN" ? "NEUTRAL" : analysis.higherTimeframe.direction,
    } : combinedAnalysis;
    const battlefieldTabs = contextImage ? <nav className="psBattleTabs" aria-label="Choose chart for Bullseye Decision Map">
      <button type="button" data-active={battlefieldChart === "primary"} aria-pressed={battlefieldChart === "primary"} onClick={() => setBattlefieldChart("primary")}><span>①＋②</span><strong>COMBINED MAP</strong><small>{analysis.timeframe} + {analysis.higherTimeframe.timeframe || "SECOND VIEW"}</small></button>
      <button type="button" data-active={battlefieldChart === "context"} aria-pressed={battlefieldChart === "context"} onClick={() => setBattlefieldChart("context")}><span>②</span><strong>CONTEXT</strong><small>{analysis.higherTimeframe.timeframe || "SECOND VIEW"}</small></button>
    </nav> : null;
    return (
      <main className="psApp" data-pocket-build="v3.1">
        <section className="psResults" data-immersive={immersive ? "true" : "false"}>
          <div className="psImmersiveBar">
            <span>POCKET BULLSEYE · PRIVATE RESULT</span>
            <button type="button" onClick={() => { setImmersive(false); setAnalysis(null); setContextImage(null); setContextFileName(""); setBattlefieldChart("primary"); setResultView("cinema"); setShowResultReveal(false); }}>NEW CHART</button>
          </div>
          <nav className="psResultViewSwitch" aria-label="Choose result view"><button type="button" data-active={resultView === "cinema"} aria-pressed={resultView === "cinema"} onClick={() => setResultView("cinema")}>▶ CINEMATIC RESULT</button><button type="button" data-active={resultView === "report"} aria-pressed={resultView === "report"} onClick={() => openResultReport()}>▤ WRITTEN REPORT</button></nav>
          {resultView === "cinema" ? <MarketStory analysis={analysis} sourceImage={image ?? ""} onShare={() => setShowResultCard(true)} onOpenReport={openResultReport} viewerName={viewerName.trim()} intention={intention} /> : <div className="psWrittenReport">
          <nav className="psReportRail" aria-label="Written result sections"><a href="#bullseye-verdict">VERDICT</a><a href="#bullseye-events">EVENTS</a><a href="#bullseye-levels">LEVELS</a><a href="#bullseye-evidence">EVIDENCE</a><a href="#bullseye-feedback">FEEDBACK</a></nav>
          <header id="bullseye-verdict" className="psVerdict">
            <p><i /> BULLSEYE PRE-TRADE DECISION AUDIT</p>
            <div className="psVerdictTop"><h1><small>SETUP GRADE</small><em data-grade={analysis.setupScore.grade}>{analysis.setupScore.grade}</em></h1><div><small>{analysis.setupScore.overall}/100</small><strong data-verdict={analysis.verdict}>{analysis.verdict.replaceAll("_", " ")}</strong></div></div>
            <h2>{analysis.verdictHeadline}</h2><span>{analysis.summary}</span>
            <b>CONDITIONAL DECISION SUPPORT · NOT A TRADE INSTRUCTION</b>
          </header>
          <PocketCommandDeck analysis={analysis} sourceImage={image ?? ""} onResultCard={() => setShowResultCard(true)} onAddChart={addResultContextFile} onReanalyse={reanalyseResult} hasContext={Boolean(contextImage)} reanalysing={refinementStatus === "analysing"} />
          <section id="bullseye-events" className="psDecisionEvents" data-status={stockEventStatus}>
            <header><div><span>◷ EVENT RISK CONTEXT</span><small>{analysis.ticker !== "UNKNOWN" ? `${analysis.ticker} · COMPANY + MACRO` : "GENERAL MACRO CHECK · CONFIRM BEFORE TRADING"}</small></div>{isListedEquityAnalysis(analysis) && stockEvents.length ? <strong>{analysis.setupScore.eventSafety}<small>/10</small></strong> : <strong className="psEventCheckOnly">CHECK<small>NO VERIFIED SCORE</small></strong>}</header>
            <div className="psTodayCalendar"><header><div><span>📅 TODAY · UK TIME</span><small>OFFICIAL US MACRO SCHEDULE</small></div><b>{todayMacro.length ? `${todayMacro.length} EVENT${todayMacro.length === 1 ? "" : "S"}` : "CLEAR"}</b></header>{todayMacro.length ? <ol>{todayMacro.map((event) => <li key={event.id} data-risk={event.risk}><time>{londonClock(event.scheduledAt)}</time><div><strong>{event.name}</strong><small>{event.agency} · {event.risk} IMPACT</small></div>{event.sourceUrl ? <a href={event.sourceUrl} target="_blank" rel="noreferrer">SOURCE ↗</a> : null}</li>)}</ol> : <p>No scheduled BLS, BEA or Federal Reserve release was returned for today. Unscheduled news can still move price.</p>}</div>
            {isListedEquityAnalysis(analysis) ? <div className="psEventHeadline"><b>{stockEventStatus === "loading" ? "CHECKING COMPANY CALENDAR…" : stockEvents[0] ? `${stockEvents[0].type} · ${stockEvents[0].date}` : stockEventStatus === "unavailable" ? "COMPANY FEED UNAVAILABLE" : `NO UPCOMING ${analysis.ticker} EVENT RETURNED`}</b><span>{stockEvents[0]?.detail ?? "No symbol-matched company event was returned in the connected provider window."}</span></div> : <div className="psEventHeadline"><b>MACRO TIMING ONLY</b><span>This chart was not confidently identified as one listed company, so Bullseye will not attach a company calendar to it.</span></div>}
            <details><summary>VIEW EVENT SOURCES <b>⌄</b></summary><div><p>Relevant categories: {analysis.relevantEventTypes.length ? analysis.relevantEventTypes.join(" · ") : "No category identified safely"}</p>{stockEvents.length ? <ol>{stockEvents.map((event) => <li key={event.id}><time>{event.date}</time><strong>{event.type}</strong><span>{event.detail} · {event.source} · SYMBOL MATCHED</span></li>)}</ol> : null}{macroContext.releases.length ? <ol>{macroContext.releases.slice(0, 5).map((event) => <li key={event.id}><time>{formatEventTime(event.scheduledAt)}</time><strong>{event.name}</strong><span>{event.agency} · OFFICIAL SCHEDULE · {event.risk} IMPACT</span></li>)}</ol> : <p>No verified official macro release rows are available in the current window.</p>}{isListedEquityAnalysis(analysis) ? <a href={`https://www.sec.gov/edgar/browse/?CIK=${encodeURIComponent(analysis.ticker)}&owner=exclude&action=getcompany`} target="_blank" rel="noreferrer">CHECK OFFICIAL SEC FILINGS ↗</a> : null}</div></details>
            <footer>Company dates are provider-scheduled and symbol-matched; they may be estimated or revised. Macro rows labelled official come from agency schedules. Always confirm with the issuer or exchange.</footer>
          </section>
          <section id="bullseye-levels" className="psResultChart psChartWorkspace psBattleWorkspace psDecisionMapWorkspace">
            <header><div><span>🗺️ EXPLORE PRICE LEVELS</span><small>OPTIONAL DECISION MAP · PRIMARY / CONTEXT</small></div><button type="button" onClick={() => setChartFocus(true)}>EXPAND</button></header>
            <section id="bullseye-level-lab" className="psLevelLab" data-status={levelLabStatus} aria-live="polite" aria-busy={levelLabStatus === "scanning"}>
              <header><div><span>◎ INDEPENDENT LEVEL LAB</span><small>SUPPORT + RESISTANCE ONLY</small></div><b>{levelLabStatus === "updated" ? "MAP UPDATED" : levelLabStatus === "scanning" ? "SCANNING…" : levelLabStatus === "attached" ? "PHOTO READY" : "SEPARATE SCAN"}</b></header>
              <p>Add a clearer price-scale photo, then rescan only this map. Your verdict, patterns, scenarios, score and Clarity Lock will not change.</p>
              {levelLabImage ? <div className="psLevelLabPhoto"><img src={levelLabImage} alt="Chart selected for independent support and resistance scan" /><span>{levelLabFileName}</span></div> : null}
              <div><label>{levelLabImage ? "CHANGE PHOTO" : "＋ ADD PHOTO"}<input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Add photo for independent support and resistance scan" disabled={levelLabStatus === "scanning"} onChange={addLevelLabFile} /></label><button type="button" disabled={!levelLabImage || levelLabStatus === "scanning"} onClick={rescanLevelsOnly}>{levelLabStatus === "scanning" ? "SCANNING LEVELS…" : "↻ RESCAN LEVELS ONLY"}</button></div>
              {levelLabError ? <small role="alert">{levelLabError}</small> : null}
            </section>
            {battlefieldTabs}
            <DecisionMap analysis={battlefieldAnalysis} sourceImage={battlefieldChart === "context" ? contextImage : image} scenario={selectedScenario} onScenario={setSelectedScenario} onReanalyse={reanalyseResult} reanalysing={refinementStatus === "analysing"} />
            {battlefieldChart === "primary" ? <LevelProvenancePanel levels={combinedAnalysis.levels} anchors={analysis.priceScaleAnchors} /> : null}
            <details className="psSourceEvidence"><summary>VIEW {battlefieldChart === "context" ? "CONTEXT" : "PRIMARY"} SOURCE CHART <b>⌄</b></summary>{battlefieldChart === "context" ? contextSourceChart() : sourceChart()}</details>
          </section>
          {analysis.missingInputs.length || refinementStatus !== "idle" || !analysis.levels.some((level) => numericLevel(level.price) !== null) ? <section className="psMissingInputs" data-refined={refinementStatus === "updated"} data-status={refinementStatus} aria-busy={refinementStatus === "analysing"} aria-live="polite"><header><span>📷 {refinementStatus === "updated" ? "TWO CHARTS ANALYSED" : refinementStatus === "attached" ? "SECOND VIEW ATTACHED" : contextImage ? "TWO CHARTS LOADED · OPTIONAL FINAL CHECK" : "ONE MORE VIEW COULD HELP"}</span><b>{refinementStatus === "analysing" ? "REANALYSING ALL CHARTS…" : refinementStatus === "updated" ? analysis.contextContribution?.materialChange ? "FINDINGS UPDATED" : "READ CONFIRMED" : refinementStatus === "attached" ? "2 CHARTS READY" : contextImage ? "ONLY MISSING EVIDENCE" : "ONLY IF AVAILABLE"}</b></header>{contextImage && (refinementStatus === "attached" || refinementStatus === "updated") ? <div className="psViewComparison"><div className="psViewPair"><figure><img src={image ?? ""} alt="Original trading chart" /><figcaption>PRIMARY</figcaption></figure><i>＋</i><figure><img src={contextImage} alt="Supporting timeframe chart" /><figcaption>ADDED VIEW</figcaption></figure></div><p>{refinementStatus === "attached" ? "Your second timeframe is attached. Tap Reanalyse all charts to replace the findings using both images." : analysis.contextContribution?.summary || "Both charts were compared and the current findings were replaced."}</p>{refinementStatus === "updated" ? <><div className="psRefineDelta"><article><span>SCORE</span><strong>{refinementBefore ? `${analysis.setupScore.overall - refinementBefore.setupScore.overall >= 0 ? "+" : ""}${analysis.setupScore.overall - refinementBefore.setupScore.overall}` : "—"}</strong></article><article><span>VERDICT</span><strong>{refinementBefore && refinementBefore.verdict !== analysis.verdict ? `${refinementBefore.verdict.replaceAll("_", " ")} → ${analysis.verdict.replaceAll("_", " ")}` : "UNCHANGED"}</strong></article><article><span>LEVELS</span><strong>{battlefieldChart === "context" ? "CONTEXT VIEW" : "PRIMARY VIEW"}</strong></article></div>{analysis.contextContribution?.resolvedInputs.length ? <small>RESOLVED · {analysis.contextContribution.resolvedInputs.join(" · ")}</small> : null}</> : null}</div> : analysis.missingInputs.length ? <ul>{analysis.missingInputs.slice(0, 2).map((item) => <li key={item}>{item}</li>)}</ul> : <p className="psPrecisionPrompt">Add a view with a clear price scale so Bullseye can retry exact support and resistance verification.</p>}<footer><div><strong>{refinementStatus === "analysing" ? "CHECKING BOTH CHARTS" : refinementStatus === "updated" ? "FINDINGS REPLACED" : refinementStatus === "attached" ? "PHOTO ADDED — READY" : "HAVE THAT VIEW?"}</strong><span>{refinementStatus === "analysing" ? "Support, resistance and the written read are being checked again." : refinementStatus === "updated" ? "The decision map and report now use the latest two-chart analysis." : refinementStatus === "attached" ? contextFileName : contextImage ? (analysis.missingInputs.slice(0, 2).join(" · ") || "Two charts were analysed; add another image only if it contains the missing evidence above.") : "Add a clearer lower, upper or higher-timeframe view."}</span></div><div className="psRefineActions"><label>{contextImage ? "CHANGE PHOTO" : "＋ ADD PHOTO"}<input id="psResultSupportInput" disabled={refinementStatus === "analysing"} aria-label="Add another timeframe chart photo" accept="image/jpeg,image/png,image/webp" type="file" onChange={addResultContextFile} /></label><button type="button" disabled={!contextImage || refinementStatus === "analysing"} onClick={reanalyseResult}>{refinementStatus === "analysing" ? "REANALYSING…" : "↻ REANALYSE ALL CHARTS"}</button></div></footer>{refinementStatus === "error" && error ? <p className="psRefineError" role="alert">{error}</p> : null}</section> : null}
          <section className="psAskBullseye">
            <header><span>💬 ASK BULLSEYE</span><b>USES THIS AUDIT ONLY</b></header>
            <p>Challenge one part of the result without uploading the chart again.</p>
            <div className="psQuickQuestions">{["What am I missing?","Why should I wait?","What would improve this?","Where is the trap?"].map((question) => <button key={question} type="button" disabled={followUpBusy} onClick={() => askBullseye(question)}>{question}</button>)}</div>
            <form onSubmit={(event) => { event.preventDefault(); askBullseye(); }}><input value={followUpQuestion} maxLength={180} onChange={(event) => setFollowUpQuestion(event.target.value)} placeholder="Ask one short question…" aria-label="Ask Bullseye a follow-up question" /><button type="submit" disabled={!followUpQuestion.trim() || followUpBusy}>{followUpBusy ? "THINKING…" : "ASK"}</button></form>
            {followUpError ? <p className="psAskError" role="alert">{followUpError}</p> : null}
            {followUpReply ? <article className="psAskReply"><strong>BULLSEYE ANSWER</strong><p>{followUpReply.answer}</p><ul>{followUpReply.evidence.map((item) => <li key={item}>{item}</li>)}</ul><small>CAUTION · {followUpReply.caution}</small><b>NEXT CHECK · {followUpReply.nextCheck}</b></article> : null}
          </section>

          {correctionOriginal ? <section className="psCorrectionReplaySummary"><header><span>↻ CORRECTION REPLAY ACTIVE</span><strong>ORIGINAL RESULT PRESERVED</strong></header><div><article><small>ORIGINAL</small><b>{correctionOriginal.instrument} · {correctionOriginal.timeframe} · {correctionOriginal.currentPrice || "UNKNOWN"}</b></article><article><small>CORRECTED MAP</small><b>{analysis.instrument} · {analysis.timeframe} · {analysis.currentPrice || "UNKNOWN"}</b></article></div></section> : null}
          <div id="bullseye-feedback" className="psFeedbackTarget"><AccuracyFeedbackPanel analysis={analysis} onApplyCorrection={applyAccuracyCorrection} onReanalyse={reanalyseWithCorrection} reanalysing={busy} /></div>

          {vaultMessage ? <p className="psVaultMessage" role="status">{vaultMessage}</p> : null}
          <p className="psLegal">AI can misread screenshots. Confirm instrument, timeframe, prices and levels on the original platform. Educational market preparation only.</p>
          <details className="psUtilityTray">
            <summary><span>RESULT OPTIONS</span><small>SAVE · CHART · SHARE · INVITE</small><b>＋</b></summary>
            <div>
              <button type="button" onClick={lockDecision}><i>▣</i><span><strong>SAVE</strong><small>Review this decision later</small></span></button>
              <button type="button" onClick={() => setChartFocus(true)}><i>⛶</i><span><strong>DECISION MAP</strong><small>Open full screen</small></span></button>
              <button type="button" onClick={shareDecision}><i>↗</i><span><strong>SHARE</strong><small>Decision summary only</small></span></button>
              <button type="button" onClick={shareFoundingInvite}><i>◎</i><span><strong>INVITE A TRADER</strong><small>Share the Founding 650 link</small></span></button>
            </div>
            <p>Saved decisions stay privately on this device. Shared summaries and invites never include the uploaded screenshot.</p>
          </details>
          </div>}
        </section>
        {chartFocus && (
          <section className="psChartFocus psBattleFocus" aria-modal="true" role="dialog" aria-label="Full-screen Bullseye Decision Map">
            <header><span>DECISION MAP · {analysis.instrument}</span><button type="button" onClick={() => setChartFocus(false)}>CLOSE</button></header>
            {battlefieldTabs}
            <DecisionMap analysis={battlefieldAnalysis} sourceImage={battlefieldChart === "context" ? contextImage : image} expanded scenario={selectedScenario} onScenario={setSelectedScenario} onReanalyse={reanalyseResult} reanalysing={refinementStatus === "analysing"} />
            <details className="psSourceEvidence"><summary>VIEW {battlefieldChart === "context" ? "CONTEXT" : "PRIMARY"} SOURCE CHART <b>⌄</b></summary>{battlefieldChart === "context" ? contextSourceChart(true) : sourceChart(true)}</details>
            <footer><div><small>DIRECTIONAL READ</small><strong data-direction={analysis.direction}>{analysis.direction}</strong></div><p>{analysis.summary}</p></footer>
          </section>
        )}
        {showResultReveal && (
          <section className="psResultReveal" role="dialog" aria-modal="true" aria-label="Pocket Bullseye result ready">
            <div className="psRevealRadar" aria-hidden="true"><i /><i /><i /><b>🎯</b></div>
            <p>BULLSEYE ANALYSIS COMPLETE</p>
            <div className="psRevealScore"><span>SETUP GRADE</span><strong data-grade={analysis.setupScore.grade}>{analysis.setupScore.grade}</strong><b>{analysis.setupScore.overall}<small>/100</small></b></div>
            <div className="psRevealVerdict"><span data-direction={analysis.direction}>{analysis.direction}</span><strong>{analysis.verdict.replaceAll("_", " ")}</strong></div>
            <h2>{analysis.verdictHeadline}</h2>
            <button type="button" onClick={() => { setResultView("cinema"); setShowResultReveal(false); }}>START MY CINEMATIC RESULT <b>→</b></button>
            <small>CONDITIONAL DECISION SUPPORT · NOT A TRADE INSTRUCTION</small>
          </section>
        )}
        {showResultCard ? <ResultCard analysis={analysis} onClose={() => setShowResultCard(false)} onShare={shareResultCard} /> : null}
        <FeedbackButton />
      </main>
    );
  }

  return (
    <main className="psApp" data-pocket-build="v3.1">
      <header className="psHeader">
        <div className="psLogo"><span className="psLogoMark"><i /></span><span><strong>BULLSEYE</strong><small>TRADE SECOND OPINION</small></span></div>
        <div className="psHeaderActions"><span>BULLSEYE ENGINE · PRIVATE BETA</span></div>
      </header>
      <section className="psScanner">
        <section className="psLaunchHero">
          <div className="psCopy"><p><i /> {reviewTarget ? "LOCKED DECISION REVIEW" : "PRIVATE PRE-TRADE AUDIT"}</p><h1>{reviewTarget ? <>What happened<br /><em>after the decision?</em></> : <>One chart.<br /><em>One honest challenge.</em></>}</h1><span>{reviewTarget ? "Upload the later chart. Bullseye will compare it with the original locked reasoning and grade the process separately from the outcome." : "Before money meets market, Bullseye tests the evidence, challenges your bias and shows what a patient trader should wait for."}</span></div>
          {!reviewTarget ? <div className="psLaunchTarget" aria-hidden="true"><i /><i /><i /><b>🎯</b><span>SCANNING<br />FOR CLARITY</span></div> : null}
          {!reviewTarget ? <div className="psLaunchSignals" aria-label="Bullseye decision perspectives"><article data-tone="bull"><b>🐂</b><span>BULL CASE</span></article><article data-tone="wait"><b>🛡️</b><span>PATIENCE</span></article><article data-tone="bear"><b>🐻</b><span>BEAR CASE</span></article></div> : null}
        </section>
        {!reviewTarget ? <section className="psOpeningRail" aria-label="How Bullseye works"><article><i>01</i><div><strong>READ</strong><span>Structure and levels</span></div></article><article><i>02</i><div><strong>CHALLENGE</strong><span>Bias and contradictions</span></div></article><article><i>03</i><div><strong>PROTECT</strong><span>Patience and risk</span></div></article></section> : null}
        {!reviewTarget ? <div className="psTrustPulse"><span>🔒 PRIVATE IMAGE</span><span>◉ EVIDENCE FIRST</span><span>✕ NO ORDER CONNECTION</span></div> : null}
        {!reviewTarget ? <label className="psPersonalTouch"><span><strong>MAKE BULLSEYE YOURS</strong><small>OPTIONAL · STAYS ON THIS DEVICE</small></span><input value={viewerName} maxLength={24} autoComplete="given-name" placeholder="What should Bullseye call you?" onChange={(event) => { const value = event.target.value; setViewerName(value); try { localStorage.setItem("pocket-bullseye-viewer-name", value); } catch {} }} /></label> : null}
        <label id="pocket-chart-upload" className="psUpload" data-loaded={image ? "true" : "false"}>
          {image ? <>
            <img src={image} alt="Selected chart preview" />
          </> : <div className="psTarget psTargetLarge" aria-hidden="true"><i /><i /><b /><b /></div>}
          <div className="psScanLine" aria-hidden="true" /><strong>{image ? "CHART LOADED" : "LOAD CHART"}</strong><small>{image ? fileName : "PHOTO · SCREENSHOT · CAMERA ROLL"}</small>
          <input aria-label="Load chart photo, screenshot or camera roll image" accept="image/jpeg,image/png,image/webp" type="file" onChange={loadFile} />
        </label>
        <div className="psCaptureRow"><label>USE CAMERA<input aria-label="Use camera" accept="image/*" capture="environment" type="file" onChange={loadFile} /></label><span>OR CHOOSE FROM CAMERA ROLL ABOVE</span></div>
        {image && !reviewTarget ? <section className="psContextUpload" data-loaded={contextImage ? "true" : "false"}>
          <div><span>② OPTIONAL CONTEXT CHART</span><strong>{contextImage ? "HIGHER TIMEFRAME LOADED" : "ADD HIGHER TIMEFRAME"}</strong><p>{contextImage ? contextFileName : "Add a 1-hour, 4-hour or daily view for alignment. Skip to keep analysis fast and data-light."}</p></div>
          {contextImage ? <button type="button" onClick={() => { setContextImage(null); setContextFileName(""); }}>REMOVE</button> : <label>ADD CHART<input aria-label="Add optional higher-timeframe chart" accept="image/jpeg,image/png,image/webp" type="file" onChange={loadContextFile} /></label>}
        </section> : null}
        {image && !reviewTarget ? <ChartPreflightPanel image={image} contextImage={contextImage} onStatus={setPreflightStatus} onConfirmation={setChartConfirmation} /> : null}
        {image && !reviewTarget && <section className="psIntent"><header><span>WHAT ARE YOU CONSIDERING?</span></header><div>{(["LONG","SHORT","UNSURE"] as const).map((value) => <button key={value} type="button" data-active={intention === value} onClick={() => setIntention(value)}>{value === "UNSURE" ? "JUST ANALYSE" : value}</button>)}</div></section>}
        {image && <section className="psAutoPreview"><header><span>SOURCE CHART READY</span><b>AI DECISION MAP NEXT</b></header>{sourceChart()}<p>Bullseye will transform verified prices into a clear Decision Map—without drawing over your screenshot.</p></section>}
        <label className="psPrivacy"><input type="checkbox" checked={privacyChecked} onChange={(event) => setPrivacyChecked(event.target.checked)} /><span><strong>PRIVACY SHIELD</strong>I removed my name, account number, balance and notifications.</span></label>
        <p className="psDataNote">Images are sent to our AI provider for this audit. Saved decisions stay in this browser. <a href="/privacy" target="_blank" rel="noreferrer">HOW YOUR CHART IS HANDLED ↗</a></p>
        {error && <p className="psMessage" role="alert">{error}</p>}
        <button className="psAnalyse" data-busy={busy ? "true" : "false"} type="button" disabled={!image || !privacyChecked || busy || (!reviewTarget && !preflightAllowsAnalysis(preflightStatus))} onClick={analyse}><span><strong>{busy ? (reviewTarget ? "COMPARING DECISIONS…" : "BULLSEYE IS CHALLENGING YOUR SETUP…") : reviewTarget ? "RUN BEFORE VS AFTER REVIEW" : preflightStatus === "CHECKING" ? "CHECKING CHART QUALITY…" : preflightStatus === "AWAITING_CONFIRMATION" ? "CONFIRM CHART FACTS ABOVE" : preflightStatus === "RETAKE" ? "RETAKE CHART TO CONTINUE" : "CHALLENGE MY SETUP"}</strong>{busy && !reviewTarget ? <small>READING STRUCTURE · TESTING BIAS · MAPPING RISK</small> : null}</span><b>🎯</b>{busy ? <i aria-hidden="true" /> : null}</button>
        {!reviewTarget && vault.length ? <section className="psFingerprint">
          <header><span>🧬 YOUR TRADER FINGERPRINT</span><b>{vaultStats.total} SAVED AUDIT{vaultStats.total === 1 ? "" : "S"}</b></header>
          <div><article><small>AVERAGE SETUP</small><strong>{vaultStats.average}/100</strong></article><article><small>PATIENCE FLAGS</small><strong>{vaultStats.patience}%</strong></article><article><small>MOST REVIEWED</small><strong>{vaultStats.dominant}</strong></article></div>
          <p><strong>REPEATED RISK WATCH:</strong> {vaultStats.commonRisk}</p>
          <footer>{vaultStats.total < 10 ? `${10 - vaultStats.total} more saved audits will make this fingerprint substantially more useful.` : "Your fingerprint is now using enough decisions to expose repeated tendencies."}</footer>
        </section> : null}
        {!reviewTarget && vault.length ? <section className="psVault"><header><span>SAVED DECISIONS</span><b>PRIVATE · THIS DEVICE</b></header>{vault.slice(0,5).map((decision) => <article key={decision.id}><div><strong>{decision.analysis.instrument}</strong><span>{new Date(decision.createdAt).toLocaleString("en-GB", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })} · {decision.intention}</span></div><b>{decision.analysis.setupScore.grade}</b><button type="button" onClick={() => startReview(decision)}>REVIEW LATER CHART</button></article>)}</section> : null}
      </section>
      <FeedbackButton />
      {showApplePaywall && appleAccess ? <AppleSubscriptionPaywall status={appleAccess} onClose={() => setShowApplePaywall(false)} onUnlocked={(next) => { setAppleAccess(next); setShowApplePaywall(false); }} /> : null}
    </main>
  );
}
