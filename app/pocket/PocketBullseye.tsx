"use client";

/* Uploaded charts are private data URLs; routing them through next/image would add no optimisation benefit. */
/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, type CSSProperties, useEffect, useRef, useState } from "react";
import type { VerifiedMacroContext } from "../lib/macro-data";
import { normalizeLockedDecisions } from "./decision-compatibility";
import { calculateRiskDesk, type RiskDeskInput } from "./pocket-risk-desk";

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
  patterns: { name: string; status: "FORMING" | "CONFIRMED" | "FAILED" | "AMBIGUOUS" | "EXTENDED"; evidence: string; invalidation: string }[];
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

function numericLevel(value: string | undefined) {
  const parsed = Number(value?.replaceAll(",", "").match(/-?\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(parsed) ? parsed : null;
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

  return <div className={`psBattlefield psDecisionMap${expanded ? " psBattlefieldExpanded" : ""}${verified.length ? "" : " psDecisionMapEmpty"}`} data-scenario={scenario ?? "all"} aria-label="Bullseye Decision Map">
    <header className="psMapIntro"><div><small>YOU ARE HERE</small><strong>{locationHeadline}</strong><p>Nearest verified levels and the conditions that could change this read.</p></div>{sourceImage ? <figure><img src={sourceImage} alt="Selected source chart thumbnail" /><figcaption>{analysis.timeframe}</figcaption></figure> : null}</header>
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
      <i /><strong>{level.price}</strong><small>{level.kind === "pivot" ? "PIVOT" : level.kind.toUpperCase()}</small><em>{current === null ? "" : formatPercent(Math.abs(level.numericPrice - current))}</em>
    </button>)}
    {current !== null ? <div className="psBattleCurrent" style={{ top: `${position(current)}%` }}><i /><span><b>◎</b> CURRENT</span><strong>{analysis.currentPrice}</strong></div> : null}
    {verified.length && !nearestSupport ? <button type="button" className="psMissingLevelCue" data-side="support" onClick={() => document.getElementById("psResultSupportInput")?.click()}><span>SUPPORT AREA NOT VERIFIED</span><small>＋ ADD A CLEARER LOWER PRICE-SCALE VIEW</small></button> : null}
    {verified.length && !nearestResistance ? <button type="button" className="psMissingLevelCue" data-side="resistance" onClick={() => document.getElementById("psResultSupportInput")?.click()}><span>RESISTANCE AREA NOT VERIFIED</span><small>＋ ADD A CLEARER UPPER PRICE-SCALE VIEW</small></button> : null}
    {!verified.length ? <div className="psBattleEmpty"><b>PRECISION HOLD</b><p>Exact levels could not be verified safely. Add a clearer price-scale view or retry the current images.</p><div><button type="button" onClick={() => document.getElementById("psResultSupportInput")?.click()}>＋ ADD ANOTHER PHOTO</button><button type="button" disabled={reanalysing} onClick={onReanalyse}>{reanalysing ? "REANALYSING…" : "↻ REANALYSE"}</button></div></div> : null}
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
function ScenarioTheatre({ analysis, sourceImage }: { analysis: Analysis; sourceImage: string }) {
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
  const bounds = analysis.plotBounds ?? { left: 16, top: 15, right: 84, bottom: 82 };
  const anchors = analysis.priceScaleAnchors ?? [];
  const currentPrice = numericLevel(analysis.currentPrice);
  const currentY = (() => {
    if (currentPrice === null || anchors.length < 2) return bounds.top + (bounds.bottom - bounds.top) * .48;
    const sorted = [...anchors].sort((a,b) => a.price-b.price); const low = sorted[0]; const high = sorted.at(-1)!;
    if (high.price === low.price) return bounds.top + (bounds.bottom - bounds.top) * .48;
    return Math.max(bounds.top + 4, Math.min(bounds.bottom - 4, low.y + (currentPrice-low.price)/(high.price-low.price)*(high.y-low.y)));
  })();
  const bodyHeight = Math.max(4, (bounds.bottom - bounds.top) * .075);
  const nextCandle = selected === "bull"
    ? { top: currentY - bodyHeight, height: bodyHeight, wickTop: currentY - bodyHeight * 1.55, wickBottom: currentY + bodyHeight * .28, tone: "up" }
    : selected === "bear"
      ? { top: currentY, height: bodyHeight, wickTop: currentY - bodyHeight * .28, wickBottom: currentY + bodyHeight * 1.55, tone: "down" }
      : { top: currentY - bodyHeight * .22, height: Math.max(2, bodyHeight * .3), wickTop: currentY - bodyHeight, wickBottom: currentY + bodyHeight, tone: "wait" };
  return <section className="psScenarioTheatre" data-selected={selected}>
    <header><div><span>◈ BULLSEYE NEXT-CANDLE LAB</span><small>YOUR SOURCE CHART · ONE CONDITIONAL CANDLE</small></div><strong>SPECULATIVE<br/>ILLUSTRATION</strong></header>
    <div className="psNextCandleStage">
      <div className="psNextCandleCanvas" data-kind={selected}>
        <img src={sourceImage} alt="Customer's uploaded source chart with a clearly separated speculative next-candle overlay" />
        <span className="psEvidenceBadge">VERIFIED SOURCE</span>
        <div className="psProjectionGate" style={{ left: `${Math.min(94, bounds.right)}%`, top: `${bounds.top}%`, height: `${bounds.bottom-bounds.top}%` }}><span>SPECULATIVE<br/>NEXT CANDLE</span></div>
        <div className="psProjectedCandle" data-tone={nextCandle.tone} style={{ left: `${Math.min(96, bounds.right + 2.2)}%`, top: `${nextCandle.wickTop}%`, height: `${nextCandle.wickBottom-nextCandle.wickTop}%` }}><i/><b style={{ top: `${(nextCandle.top-nextCandle.wickTop)/(nextCandle.wickBottom-nextCandle.wickTop)*100}%`, height: `${nextCandle.height/(nextCandle.wickBottom-nextCandle.wickTop)*100}%` }}/></div>
      </div>
      <nav className="psNextCandleChoices" role="group" aria-label="Choose a speculative next-candle condition">{scenarios.map((scenario) => <button key={scenario.kind} type="button" data-kind={scenario.kind} data-active={selected === scenario.kind} data-read={active === scenario.kind} aria-pressed={selected === scenario.kind} onClick={() => setSelected(scenario.kind)}><b>{scenario.icon}</b><span>{scenario.title}</span><small>{active === scenario.kind ? "● AI READ" : "○ CONDITIONAL"}</small></button>)}</nav>
    </div>
    <article className="psScenarioBrief" data-kind={selected} aria-live="polite"><div><small>THIS PATH ACTIVATES IF</small><p>{chosen.trigger}</p></div><i/><div><small>THIS PATH WEAKENS IF</small><p>{chosen.failure}</p></div></article>
    <footer><b>⚠ SPECULATIVE ONLY</b><span>The added candle is an illustrative condition—not a predicted candle, price, probability or trade instruction. It is deliberately marked outside the verified source area.</span></footer>
  </section>;
}

function ConfluenceStack({ analysis, sourceImage }: { analysis: Analysis; sourceImage: string }) {
  const layers = [
    { id: "structure", icon: "⌁", label: "STRUCTURE", score: analysis.setupScore.structure, status: analysis.marketStructure },
    { id: "timeframe", icon: "◫", label: "TIMEFRAME", score: analysis.higherTimeframe.alignment === "ALIGNED" ? 9 : analysis.higherTimeframe.alignment === "CONFLICTING" ? 3 : 6, status: analysis.higherTimeframe.summary },
    { id: "location", icon: "◎", label: "LOCATION", score: analysis.setupScore.location, status: analysis.levelStory },
    { id: "momentum", icon: "↗", label: "MOMENTUM", score: analysis.setupScore.momentum, status: analysis.momentum },
    { id: "confirmation", icon: "◆", label: "CONFIRMATION", score: analysis.setupScore.confirmation, status: analysis.nextSequence.confirmation },
  ];
  const [selectedLayer, setSelectedLayer] = useState(layers[0].id);
  const selected = layers.find((layer) => layer.id === selectedLayer) ?? layers[0];
  const aligned = layers.filter((layer) => layer.score >= 7).length;
  return <section className="psConfluenceStack" data-direction={analysis.direction}>
    <header><div><span>◈ BULLSEYE CONFLUENCE STACK</span><small>FIVE EVIDENCE LAYERS · ONE DEFENSIBLE READ</small></div><strong>{aligned}<small>/5</small><b> ALIGNED</b></strong></header>
    <div className="psConfluenceStage">
      <figure><img src={sourceImage} alt="Customer's uploaded source chart used for the evidence stack"/><figcaption>① VERIFIED SOURCE</figcaption></figure>
      <div className="psLayerDeck">{layers.map((layer, index) => <button key={layer.id} type="button" data-active={selectedLayer === layer.id} data-strength={layer.score >= 8 ? "high" : layer.score >= 6 ? "mid" : "low"} style={{ "--layer": index } as CSSProperties} aria-pressed={selectedLayer === layer.id} onClick={() => setSelectedLayer(layer.id)}><i>{layer.icon}</i><span>{layer.label}</span><strong>{layer.score}<small>/10</small></strong><b/></button>)}</div>
      <div className="psConfluenceLock"><small>CURRENT READ</small><strong data-direction={analysis.direction}>{analysis.direction}</strong><span>{analysis.verdict.replaceAll("_", " ")}</span></div>
    </div>
    <article className="psLayerRead" aria-live="polite"><div><small>SELECTED EVIDENCE · {selected.label}</small><strong>{selected.score}/10</strong></div><p>{selected.status}</p></article>
    <footer><b>WHY THIS READ?</b><span>Tap each layer to inspect the evidence that supports—or weakens—the current decision. This is analysis, not a forecast or trade instruction.</span></footer>
  </section>;
}

function MarketStory({ analysis, sourceImage, onShare, onOpenReport, viewerName, intention }: { analysis: Analysis; sourceImage: string; onShare: () => void; onOpenReport: (target?: string) => void; viewerName: string; intention: Intention }) {
  const [scene, setScene] = useState(0);
  const [paused, setPaused] = useState(false);
  const sceneNames = ["OPEN", "EVIDENCE", "LEVELS", "BATTLE", "RISK", "DECISION", "BULLSEYE"];
  const verifiedLevels = analysis.levels.filter((level) => numericLevel(level.price) !== null && ["support", "resistance", "pivot"].includes(level.kind));
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

function CinematicTranscript({ analysis, viewerName }: { analysis: Analysis; viewerName: string }) {
  const balance = evidenceBalance(analysis);
  const verifiedLevels = analysis.levels.filter((level) => numericLevel(level.price) !== null && ["support", "resistance", "pivot"].includes(level.kind));
  return <section className="psCinematicTranscript">
    <header><div><span>▤ CINEMATIC ANALYSIS · WRITTEN MATCH</span><small>THE SAME EVIDENCE USED IN YOUR FILM</small></div><strong>{analysis.setupScore.grade} · {analysis.setupScore.overall}/100</strong></header>
    <div>
      <article><small>01 · VERIFIED EVIDENCE</small><ul>{analysis.observableFacts.slice(0, 3).map((fact) => <li key={fact}>{fact}</li>)}</ul></article>
      <article><small>02 · STRUCTURE & MOMENTUM</small><p>{analysis.marketStructure}</p><p>{analysis.momentum}</p></article>
      <article><small>03 · PRICE LEVELS</small><p>{verifiedLevels.length ? verifiedLevels.slice(0, 3).map((level) => `${level.kind.toUpperCase()} ${level.price}`).join(" · ") : "No exact support, resistance or pivot survived verification."}</p><p>{analysis.levelStory}</p></article>
      <article><small>04 · BULL / BEAR CASE</small><p><b>BULL ·</b> {analysis.bullishCase}</p><p><b>BEAR ·</b> {analysis.bearishCase}</p></article>
      <article><small>05 · RISKS & EVENTS</small><p>{analysis.riskFlags.slice(0, 2).join(" · ") || "No specific chart risk flag was returned."}</p><p>{analysis.relevantEventTypes.length ? `Relevant timing: ${analysis.relevantEventTypes.join(" · ")}.` : "No event category was identified safely from the image."}</p></article>
      <article><small>06 · DECISION CONDITIONS</small><p><b>STRENGTHENS ·</b> {analysis.nextSequence.confirmation}</p><p><b>FAILS ·</b> {analysis.nextSequence.failure || analysis.invalidation}</p><p><b>STAND ASIDE ·</b> {analysis.noTradeCondition}</p></article>
      <article><small>07 · ACTION PLAN</small><p>{analysis.nextSequence.now}</p><p><b>NEXT CHECK ·</b> {analysis.nextSequence.reassess}</p></article>
    </div>
    <footer><div><span>🐂 {balance.bull}% BULL</span><i><b style={{ width: `${balance.bull}%` }}/></i><span>🐻 {balance.bear}% BEAR</span></div><p>EVIDENCE BALANCE · DERIVED FROM THIS AUDIT · NOT A FORECAST OR PROBABILITY</p><blockquote><b>YOUR MESSAGE FOR TODAY</b>{personalDailyMessage(analysis, viewerName)}</blockquote></footer>
  </section>;
}

function ClarityLock({ analysis }: { analysis: Analysis }) {
  const metrics = ([
    ["STRUCTURE", analysis.setupScore.structure], ["MOMENTUM", analysis.setupScore.momentum],
    ["LOCATION", analysis.setupScore.location], ["CONFIRM", analysis.setupScore.confirmation],
    ["RISK", analysis.setupScore.riskClarity], ["EVENTS", analysis.setupScore.eventSafety],
  ] as const);
  const aligned = metrics.filter(([, score]) => score >= 7).length;
  return <section className="psClarityLock" data-direction={analysis.direction}>
    <header><div><span>🎯 BULLSEYE CLARITY LOCK</span><small>DECISION CLARITY · NOT PERMISSION TO TRADE</small></div><strong>{aligned}<small>/6</small><b> ALIGNED</b></strong></header>
    <div className="psLockStage">
      <svg className="psLockRings" viewBox="0 0 240 240" aria-hidden="true">
        <circle className="psLockTrack" cx="120" cy="120" r="78" />
        {metrics.map(([label, score], index) => <circle key={label} className="psLockArc" data-strength={score >= 8 ? "high" : score >= 6 ? "mid" : "low"} cx="120" cy="120" r="78" pathLength="100" strokeDasharray={`${Math.max(4, score * 1.35)} 100`} style={{ transform: `rotate(${index * 60 - 88}deg)`, transformOrigin: "120px 120px" }} />)}
        <circle className="psLockScan" cx="120" cy="120" r="58" />
        <line x1="120" y1="28" x2="120" y2="212" /><line x1="28" y1="120" x2="212" y2="120" />
      </svg>
      <div className="psLockCore"><small>SETUP</small><strong>{analysis.setupScore.grade}</strong><b>{analysis.verdict.replaceAll("_", " ")}</b></div>
      <div className="psLockMetrics">{metrics.map(([label, score]) => <article key={label} data-strength={score >= 8 ? "high" : score >= 6 ? "mid" : "low"}><span>{label}</span><strong>{score}<small>/10</small></strong><i /></article>)}</div>
    </div>
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

type CommandDeckMode = "evidence" | "scenarios" | "plan" | "risk";
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

function PocketCommandDeck({ analysis, sourceImage, onResultCard }: { analysis: Analysis; sourceImage: string; onResultCard: () => void }) {
  const [mode, setMode] = useState<CommandDeckMode>("evidence");
  const modes: Array<{ id: CommandDeckMode; number: string; label: string; detail: string }> = [
    { id: "evidence", number: "01", label: "EVIDENCE", detail: "WHY THIS READ" },
    { id: "scenarios", number: "02", label: "SCENARIOS", detail: "IF / THEN PATHS" },
    { id: "plan", number: "03", label: "PLAN", detail: "CLARITY LOCK" },
    { id: "risk", number: "04", label: "RISK", detail: "PERSONAL LIMITS" },
  ];

  return <section className="psCommandDeck">
    <header><div><span>◎ POCKET BULLSEYE 2.0</span><strong>SCAN. UNDERSTAND. PLAN. REVIEW.</strong></div><b>COMMAND DECK</b></header>
    <nav aria-label="Pocket Bullseye command deck">{modes.map((item) => <button key={item.id} type="button" data-active={mode === item.id} aria-pressed={mode === item.id} onClick={() => setMode(item.id)}><i>{item.number}</i><span>{item.label}</span><small>{item.detail}</small></button>)}</nav>
    <div className="psCommandStage" data-mode={mode}>
      {mode === "evidence" ? <ConfluenceStack analysis={analysis} sourceImage={sourceImage} /> : null}
      {mode === "scenarios" ? <ScenarioTheatre analysis={analysis} sourceImage={sourceImage} /> : null}
      {mode === "plan" ? <><ClarityLock analysis={analysis} /><BullseyePlan analysis={analysis} onResultCard={onResultCard} /></> : null}
      {mode === "risk" ? <RiskDesk /> : null}
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

type CachedAnalysis = { key: string; analysis: Analysis; createdAt: string; version: 1 };

async function analysisCacheKey(image: string, contextImage: string | null, intention: Intention) {
  const bytes = new TextEncoder().encode(`pocket-analysis-v1\n${intention}\n${image}\n${contextImage ?? ""}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function analysisCacheGet(key: string): Promise<Analysis | null> {
  const db = await openVault();
  return new Promise((resolve, reject) => {
    const request = db.transaction("analyses", "readonly").objectStore("analyses").get(key);
    request.onsuccess = () => {
      const cached = request.result as CachedAnalysis | undefined;
      resolve(cached?.version === 1 ? cached.analysis : null);
    };
    request.onerror = () => reject(request.error);
  });
}

async function analysisCacheSave(key: string, analysis: Analysis) {
  const db = await openVault();
  return new Promise<void>((resolve, reject) => {
    const value: CachedAnalysis = { key, analysis, createdAt: new Date().toISOString(), version: 1 };
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
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
  const [refinementStatus, setRefinementStatus] = useState<"idle" | "analysing" | "updated" | "error">("idle");
  const [refinementBefore, setRefinementBefore] = useState<Analysis | null>(null);
  const [showResultReveal, setShowResultReveal] = useState(false);
  const [showResultCard, setShowResultCard] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<"bull" | "wait" | "bear" | null>(null);
  const [battlefieldChart, setBattlefieldChart] = useState<"primary" | "context">("primary");
  const [viewerName, setViewerName] = useState("");
  const [resultView, setResultView] = useState<"cinema" | "report">("cinema");
  const analysisRequestActive = useRef(false);
  const followUpRequestActive = useRef(false);

  useEffect(() => { vaultList().then(setVault).catch(() => setVaultMessage("Decision Vault is unavailable on this device.")); }, []);

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
      setRefinementBefore(analysis);
      setContextImage(prepared);
      setContextFileName(file.name);
      setRefinementStatus("analysing");
      const refined = await requestPocketAnalysis(prepared);
      setAnalysis(refined);
      setStockEvents([]);
      setStockEventStatus(refined.ticker === "UNKNOWN" ? "unavailable" : "loading");
      setRefinementStatus("updated");
      requestAnimationFrame(() => { if (resultScroller) resultScroller.scrollTop = savedScrollTop; });
    } catch (caught) {
      setRefinementStatus("error");
      setError(caught instanceof Error ? caught.message : "That supporting chart could not be analysed safely.");
    } finally {
      event.currentTarget.value = "";
    }
  }

  async function reanalyseResult() {
    if (!analysis || busy || analysisRequestActive.current) return;
    const resultScroller = document.querySelector(".psResults") as HTMLElement | null;
    const savedScrollTop = resultScroller?.scrollTop ?? 0;
    setError("");
    setRefinementBefore(analysis);
    setRefinementStatus("analysing");
    try {
      const refreshed = await requestPocketAnalysis(contextImage);
      setAnalysis(refreshed);
      setStockEvents([]);
      setStockEventStatus(refreshed.ticker === "UNKNOWN" ? "unavailable" : "loading");
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

  async function requestPocketAnalysis(selectedContext: string | null): Promise<Analysis> {
    if (!image || analysisRequestActive.current) throw new Error("An analysis is already running.");
    analysisRequestActive.current = true;
    setBusy(true);
    try {
      const cacheKey = await analysisCacheKey(image, selectedContext, intention);
      const cached = await analysisCacheGet(cacheKey).catch(() => null);
      if (cached) return cached;
      const response = await fetch("/api/pocket/analyse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image, contextImage: selectedContext, intention }),
      });
      const payload = await response.json() as { analysis?: Analysis; error?: string };
      if (!response.ok || !payload.analysis) throw new Error(payload.error || "Analysis is temporarily unavailable.");
      payload.analysis.levels = payload.analysis.levels.map((level) => ({ ...level, y: clampY(level.y) }));
      await analysisCacheSave(cacheKey, payload.analysis).catch(() => undefined);
      return payload.analysis;
    } finally {
      analysisRequestActive.current = false;
      setBusy(false);
    }
  }

  async function analyse() {
    if (!image || !privacyChecked || busy || analysisRequestActive.current) return;
    setError("");
    try {
      if (!reviewTarget) {
        const nextAnalysis = await requestPocketAnalysis(contextImage);
        setStockEvents([]);
        setStockEventStatus(nextAnalysis.ticker === "UNKNOWN" ? "unavailable" : "loading");
        setAnalysis(nextAnalysis);
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
    const contextBattlefield = analysis.contextBattlefield;
    const battlefieldAnalysis: Analysis = battlefieldChart === "context" && contextBattlefield ? {
      ...analysis,
      levels: Array.isArray(contextBattlefield.levels) ? contextBattlefield.levels : [],
      currentPrice: contextBattlefield.currentPrice,
      timeframe: analysis.higherTimeframe.timeframe || "CONTEXT",
      direction: analysis.higherTimeframe.direction === "UNKNOWN" ? "NEUTRAL" : analysis.higherTimeframe.direction,
    } : analysis;
    const battlefieldTabs = contextImage ? <nav className="psBattleTabs" aria-label="Choose chart for Bullseye Decision Map">
      <button type="button" data-active={battlefieldChart === "primary"} aria-pressed={battlefieldChart === "primary"} onClick={() => setBattlefieldChart("primary")}><span>①</span><strong>PRIMARY</strong><small>{analysis.timeframe}</small></button>
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
          <header className="psVerdict">
            <p><i /> BULLSEYE PRE-TRADE DECISION AUDIT</p>
            <div className="psVerdictTop"><h1><small>SETUP GRADE</small><em data-grade={analysis.setupScore.grade}>{analysis.setupScore.grade}</em></h1><div><small>{analysis.setupScore.overall}/100</small><strong data-verdict={analysis.verdict}>{analysis.verdict.replaceAll("_", " ")}</strong></div></div>
            <h2>{analysis.verdictHeadline}</h2><span>{analysis.summary}</span>
            <b>CONDITIONAL DECISION SUPPORT · NOT A TRADE INSTRUCTION</b>
          </header>
          <CinematicTranscript analysis={analysis} viewerName={viewerName.trim()} />
          <PocketCommandDeck analysis={analysis} sourceImage={image ?? ""} onResultCard={() => setShowResultCard(true)} />
          <section id="bullseye-events" className="psDecisionEvents" data-status={stockEventStatus}>
            <header><div><span>◷ EVENT IMPACT CHECK</span><small>{analysis.ticker !== "UNKNOWN" ? `${analysis.ticker} · COMPANY + MACRO` : "VERIFIED MACRO TIMING"}</small></div><strong>{analysis.setupScore.eventSafety}<small>/10</small></strong></header>
            {isListedEquityAnalysis(analysis) ? <div className="psEventHeadline"><b>{stockEventStatus === "loading" ? "CHECKING COMPANY CALENDAR…" : stockEvents[0] ? `${stockEvents[0].type} · ${stockEvents[0].date}` : stockEventStatus === "unavailable" ? "COMPANY FEED UNAVAILABLE" : `NO UPCOMING ${analysis.ticker} EVENT RETURNED`}</b><span>{stockEvents[0]?.detail ?? "No symbol-matched company event was returned in the connected provider window."}</span></div> : <div className="psEventHeadline"><b>MACRO TIMING ONLY</b><span>This chart was not confidently identified as one listed company, so Bullseye will not attach a company calendar to it.</span></div>}
            <details><summary>VIEW EVENT SOURCES <b>⌄</b></summary><div><p>Relevant categories: {analysis.relevantEventTypes.length ? analysis.relevantEventTypes.join(" · ") : "No category identified safely"}</p>{stockEvents.length ? <ol>{stockEvents.map((event) => <li key={event.id}><time>{event.date}</time><strong>{event.type}</strong><span>{event.detail} · {event.source} · SYMBOL MATCHED</span></li>)}</ol> : null}{macroContext.releases.length ? <ol>{macroContext.releases.slice(0, 5).map((event) => <li key={event.id}><time>{formatEventTime(event.scheduledAt)}</time><strong>{event.name}</strong><span>{event.agency} · OFFICIAL SCHEDULE · {event.risk} IMPACT</span></li>)}</ol> : <p>No verified official macro release rows are available in the current window.</p>}{isListedEquityAnalysis(analysis) ? <a href={`https://www.sec.gov/edgar/browse/?CIK=${encodeURIComponent(analysis.ticker)}&owner=exclude&action=getcompany`} target="_blank" rel="noreferrer">CHECK OFFICIAL SEC FILINGS ↗</a> : null}</div></details>
            <footer>Company dates are provider-scheduled and symbol-matched; they may be estimated or revised. Macro rows labelled official come from agency schedules. Always confirm with the issuer or exchange.</footer>
          </section>
          <section className="psDecisionCompass">
            <header><span>DECISION COMPASS</span><b>EVIDENCE · NOT ODDS</b></header>
            <div className="psCompassBody">
              <div className="psCompassDial" data-direction={analysis.direction}>
                <i /><strong>{analysis.direction}</strong><small>{analysis.verdict.replaceAll("_", " ")}</small>
              </div>
              <div className="psCompassSignals">
                <button type="button" data-signal="bull" data-active={selectedScenario === "bull" || (!selectedScenario && analysis.direction === "BULLISH")} aria-pressed={selectedScenario === "bull"} onClick={() => setSelectedScenario((current) => current === "bull" ? null : "bull")}><span>🐂 BULL CASE</span><strong>{analysis.direction === "BULLISH" ? "ACTIVE READ" : "SECONDARY"}</strong><small>VIEW ROUTE →</small></button>
                <button type="button" data-signal="wait" data-active={selectedScenario === "wait" || (!selectedScenario && analysis.direction === "NEUTRAL")} aria-pressed={selectedScenario === "wait"} onClick={() => setSelectedScenario((current) => current === "wait" ? null : "wait")}><span>🛡️ PATIENCE</span><strong>{analysis.direction === "NEUTRAL" ? "ACTIVE READ" : "ALWAYS VALID"}</strong><small>VIEW CONDITIONS →</small></button>
                <button type="button" data-signal="bear" data-active={selectedScenario === "bear" || (!selectedScenario && analysis.direction === "BEARISH")} aria-pressed={selectedScenario === "bear"} onClick={() => setSelectedScenario((current) => current === "bear" ? null : "bear")}><span>🐻 BEAR CASE</span><strong>{analysis.direction === "BEARISH" ? "ACTIVE READ" : "SECONDARY"}</strong><small>VIEW ROUTE →</small></button>
              </div>
            </div>
            {selectedScenario ? <article className="psScenarioFocus" data-scenario={selectedScenario} aria-live="polite">
              <header><span>{selectedScenario === "bull" ? "🐂 BULL ROUTE" : selectedScenario === "bear" ? "🐻 BEAR ROUTE" : "🛡️ PATIENCE ROUTE"}</span><button type="button" onClick={() => setSelectedScenario(null)}>CLOSE</button></header>
              <p>{selectedScenario === "bull" ? analysis.bullishCase : selectedScenario === "bear" ? analysis.bearishCase : analysis.nextSequence.patience}</p>
              <div><article><small>{selectedScenario === "wait" ? "STAND ASIDE WHILE" : "ACTIVATES WHEN"}</small><strong>{selectedScenario === "bull" ? analysis.bullConfirmation : selectedScenario === "bear" ? analysis.bearConfirmation : analysis.noTradeCondition}</strong></article><article><small>{selectedScenario === "wait" ? "REASSESS WHEN" : "FAILS WHEN"}</small><strong>{selectedScenario === "wait" ? analysis.nextSequence.reassess : analysis.invalidation}</strong></article></div>
              <button type="button" className="psScenarioMapLink" onClick={() => document.querySelector(".psBattleWorkspace")?.scrollIntoView({ behavior: "smooth", block: "start" })}>SHOW ON DECISION MAP ↓</button>
            </article> : null}
          </section>
          <section id="bullseye-levels" className="psResultChart psChartWorkspace psBattleWorkspace psDecisionMapWorkspace">
            <header><div><span>🗺️ EXPLORE PRICE LEVELS</span><small>OPTIONAL DECISION MAP · PRIMARY / CONTEXT</small></div><button type="button" onClick={() => setChartFocus(true)}>EXPAND</button></header>
            {battlefieldTabs}
            <DecisionMap analysis={battlefieldAnalysis} sourceImage={battlefieldChart === "context" ? contextImage : image} scenario={selectedScenario} onScenario={setSelectedScenario} onReanalyse={reanalyseResult} reanalysing={refinementStatus === "analysing"} />
            <details className="psSourceEvidence"><summary>VIEW {battlefieldChart === "context" ? "CONTEXT" : "PRIMARY"} SOURCE CHART <b>⌄</b></summary>{battlefieldChart === "context" ? contextSourceChart() : sourceChart()}</details>
          </section>
          <details id="bullseye-evidence" className="psAuditDrawer">
            <summary><span>FULL EVIDENCE AUDIT</span><small>IMAGE QUALITY · TIMEFRAMES · PATTERNS</small><b>⌄</b></summary>
            <div>
          <section className="psEvidenceConsole">
            <header><span>EVIDENCE CONSOLE</span><b data-quality={analysis.evidenceQuality.chartReadability}>{analysis.evidenceQuality.chartReadability} IMAGE</b></header>
            <div className="psEvidenceMeters">
              <article><span>CHART</span><strong>{analysis.evidenceQuality.chartReadability}</strong></article>
              <article><span>INSTRUMENT ID</span><strong>{analysis.evidenceQuality.instrumentConfidence}</strong></article>
              <article><span>TIMEFRAME ID</span><strong>{analysis.evidenceQuality.timeframeConfidence}</strong></article>
              <article><span>PRICE SCALE</span><strong>{analysis.evidenceQuality.scaleReadable ? "READABLE" : "UNVERIFIED"}</strong></article>
            </div>
            <div className="psEvidenceSplit">
              <article data-evidence="seen"><span>👁️ VERIFIED CHART READ</span><ul>{analysis.observableFacts.slice(0, 3).map((fact) => <li key={fact}>{fact}</li>)}</ul></article>
              <article data-evidence="conflict"><span>⚡ CONFLICTING EVIDENCE</span>{analysis.contradictions.length ? <ul>{analysis.contradictions.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No clear contradiction is visible in this screenshot.</p>}</article>
            </div>
            {analysis.evidenceQuality.limitations.length ? <p className="psEvidenceLimits"><strong>LIMITS:</strong> {analysis.evidenceQuality.limitations.join(" · ")}</p> : null}
          </section>
          <section className="psTimeframeStack" data-alignment={analysis.higherTimeframe.alignment}>
            <header><span>🔭 MULTI-TIMEFRAME AGREEMENT</span><b>{analysis.higherTimeframe.alignment.replaceAll("_", " ")}</b></header>
            <div><article><small>TRADING CHART</small><strong>{analysis.timeframe}</strong><em data-direction={analysis.direction}>{analysis.direction}</em></article><i>↔</i><article><small>HIGHER CONTEXT</small><strong>{analysis.higherTimeframe.provided ? analysis.higherTimeframe.timeframe : "NOT ADDED"}</strong><em data-direction={analysis.higherTimeframe.direction}>{analysis.higherTimeframe.direction}</em></article></div>
            <p>{analysis.higherTimeframe.summary}</p>
          </section>
          {analysis.patterns.length ? <section className="psPatternDeck">
            <header><span>🧩 PATTERN STATUS</span><b>EVIDENCE REQUIRED</b></header>
            <div>{analysis.patterns.map((pattern) => <article key={pattern.name + pattern.status} data-status={pattern.status}><span>{pattern.status}</span><strong>{pattern.name}</strong><p>{pattern.evidence}</p><small>INVALIDATED WHEN · {pattern.invalidation}</small></article>)}</div>
          </section> : null}
            </div>
          </details>
          <section className="psNextSequence">
            <header><span>⏱️ WHAT MUST HAPPEN NEXT?</span><b>CONDITIONAL SEQUENCE</b></header>
            <ol>{([
              ["NOW",analysis.nextSequence.now],["CONFIRM",analysis.nextSequence.confirmation],["FAILURE",analysis.nextSequence.failure]
            ] as const).map(([label,copy],index) => <li key={label}><i>{index + 1}</i><div><strong>{label}</strong><p>{copy}</p></div></li>)}</ol>
          </section>
          {analysis.missingInputs.length || refinementStatus !== "idle" || !analysis.levels.some((level) => numericLevel(level.price) !== null) ? <section className="psMissingInputs" data-refined={refinementStatus === "updated"} aria-busy={refinementStatus === "analysing"}><header><span>📷 {refinementStatus === "updated" ? "SECOND VIEW RESULT" : "ONE MORE VIEW COULD HELP"}</span><b>{refinementStatus === "analysing" ? "COMPARING BOTH…" : refinementStatus === "updated" ? analysis.contextContribution?.materialChange ? "ANALYSIS CHANGED" : "READ CONFIRMED" : "ONLY IF AVAILABLE"}</b></header>{refinementStatus === "updated" && contextImage ? <div className="psViewComparison"><div className="psViewPair"><figure><img src={image ?? ""} alt="Original trading chart" /><figcaption>ORIGINAL</figcaption></figure><i>＋</i><figure><img src={contextImage} alt="Supporting chart" /><figcaption>SECOND VIEW</figcaption></figure></div><p>{analysis.contextContribution?.summary || "The supporting chart was compared with the original analysis."}</p><div className="psRefineDelta"><article><span>SCORE</span><strong>{refinementBefore ? `${analysis.setupScore.overall - refinementBefore.setupScore.overall >= 0 ? "+" : ""}${analysis.setupScore.overall - refinementBefore.setupScore.overall}` : "—"}</strong></article><article><span>VERDICT</span><strong>{refinementBefore && refinementBefore.verdict !== analysis.verdict ? `${refinementBefore.verdict.replaceAll("_", " ")} → ${analysis.verdict.replaceAll("_", " ")}` : "UNCHANGED"}</strong></article><article><span>EVIDENCE</span><strong>{analysis.contextContribution?.materialChange ? "MATERIAL" : "CONFIRMING"}</strong></article></div>{analysis.contextContribution?.resolvedInputs.length ? <small>RESOLVED · {analysis.contextContribution.resolvedInputs.join(" · ")}</small> : null}</div> : analysis.missingInputs.length ? <ul>{analysis.missingInputs.slice(0, 2).map((item) => <li key={item}>{item}</li>)}</ul> : <p className="psPrecisionPrompt">Add a view with a clear price scale so Bullseye can retry exact support and resistance verification.</p>}<footer><div><strong>{refinementStatus === "analysing" ? "USING BOTH CHARTS" : refinementStatus === "updated" ? "COMPARISON COMPLETE" : "HAVE THAT VIEW?"}</strong><span>{refinementStatus === "analysing" ? "Keeping this result open while Bullseye refines it." : refinementStatus === "updated" ? "Both charts now inform the result above." : "Add a chart view that answers one of the points above."}</span></div><label>{refinementStatus === "analysing" ? "WORKING…" : refinementStatus === "updated" ? "CHANGE VIEW" : "＋ ADD PHOTO"}<input id="psResultSupportInput" disabled={refinementStatus === "analysing"} aria-label="Add a supporting chart photo" accept="image/jpeg,image/png,image/webp" type="file" onChange={addResultContextFile} /></label></footer>{refinementStatus === "error" && error ? <p className="psRefineError" role="alert">{error}</p> : null}</section> : null}
          <section className="psScorecard">
            {([['STRUCTURE','structure'],['MOMENTUM','momentum'],['LOCATION','location'],['CONFIRMATION','confirmation'],['RISK CLARITY','riskClarity'],['EVENT SAFETY','eventSafety']] as const).map(([label,key]) => <article key={key}><span>{label}</span><strong>{analysis.setupScore[key]}/10</strong><i><b style={{ width: `${analysis.setupScore[key] * 10}%` }} /></i></article>)}
          </section>
          <div className="psConfidence">
            <div><span>CONFIDENCE</span><strong>{analysis.confidence}</strong></div>
            <div><span>INSTRUMENT</span><strong>{analysis.instrument}</strong></div>
            <div><span>TIMEFRAME</span><strong>{analysis.timeframe}</strong></div>
          </div>
          <details className="psAuditDrawer psDeepAudit">
            <summary><span>DETAILED MARKET AUDIT</span><small>STRUCTURE · RISK · EVENTS</small><b>⌄</b></summary>
            <div>
          <section className="psNarrative">
            <header><span>LEVEL-TO-LEVEL STORY</span><b>CONDITIONAL ROADMAP</b></header>
            <p>{analysis.levelStory}</p>
            <div><article><span>STRUCTURE</span><p>{analysis.marketStructure}</p></article><article><span>MOMENTUM / RSI</span><p>{analysis.momentum}</p></article></div>
          </section>
          <section className="psDecisionGrid"><article><span>STAND ASIDE WHEN</span><p>{analysis.noTradeCondition}</p></article><article><span>DECISION CHECKLIST</span><ol>{analysis.checklist.map((item) => <li key={item}>{item}</li>)}</ol></article></section>
          <section className="psIntel">
            <article><span>VISIBLE INDICATORS</span><p>{analysis.indicators.length ? analysis.indicators.join(" · ") : "No indicator can be read reliably from this image."}</p></article>
            <article data-risk><span>INVALIDATION & RISK</span><p>{analysis.invalidation}</p><ul>{analysis.riskFlags.map((risk) => <li key={risk}>{risk}</li>)}</ul></article>
          </section>
            </div>
          </details>
          <section className="psAskBullseye">
            <header><span>💬 ASK BULLSEYE</span><b>USES THIS AUDIT ONLY</b></header>
            <p>Challenge one part of the result without uploading the chart again.</p>
            <div className="psQuickQuestions">{["What am I missing?","Why should I wait?","What would improve this?","Where is the trap?"].map((question) => <button key={question} type="button" disabled={followUpBusy} onClick={() => askBullseye(question)}>{question}</button>)}</div>
            <form onSubmit={(event) => { event.preventDefault(); askBullseye(); }}><input value={followUpQuestion} maxLength={180} onChange={(event) => setFollowUpQuestion(event.target.value)} placeholder="Ask one short question…" aria-label="Ask Bullseye a follow-up question" /><button type="submit" disabled={!followUpQuestion.trim() || followUpBusy}>{followUpBusy ? "THINKING…" : "ASK"}</button></form>
            {followUpError ? <p className="psAskError" role="alert">{followUpError}</p> : null}
            {followUpReply ? <article className="psAskReply"><strong>BULLSEYE ANSWER</strong><p>{followUpReply.answer}</p><ul>{followUpReply.evidence.map((item) => <li key={item}>{item}</li>)}</ul><small>CAUTION · {followUpReply.caution}</small><b>NEXT CHECK · {followUpReply.nextCheck}</b></article> : null}
          </section>

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
        {image && !reviewTarget && <section className="psIntent"><header><span>WHAT ARE YOU CONSIDERING?</span></header><div>{(["LONG","SHORT","UNSURE"] as const).map((value) => <button key={value} type="button" data-active={intention === value} onClick={() => setIntention(value)}>{value === "UNSURE" ? "JUST ANALYSE" : value}</button>)}</div></section>}
        {image && <section className="psAutoPreview"><header><span>SOURCE CHART READY</span><b>AI DECISION MAP NEXT</b></header>{sourceChart()}<p>Bullseye will transform verified prices into a clear Decision Map—without drawing over your screenshot.</p></section>}
        <label className="psPrivacy"><input type="checkbox" checked={privacyChecked} onChange={(event) => setPrivacyChecked(event.target.checked)} /><span><strong>PRIVACY SHIELD</strong>I removed my name, account number, balance and notifications.</span></label>
        <p className="psDataNote">Images are sent to our AI provider for this audit. Saved decisions stay in this browser. <a href="/privacy" target="_blank" rel="noreferrer">HOW YOUR CHART IS HANDLED ↗</a></p>
        {error && <p className="psMessage" role="alert">{error}</p>}
        <button className="psAnalyse" data-busy={busy ? "true" : "false"} type="button" disabled={!image || !privacyChecked || busy} onClick={analyse}><span><strong>{busy ? (reviewTarget ? "COMPARING DECISIONS…" : "BULLSEYE IS CHALLENGING YOUR SETUP…") : (reviewTarget ? "RUN BEFORE VS AFTER REVIEW" : "CHALLENGE MY SETUP")}</strong>{busy && !reviewTarget ? <small>READING STRUCTURE · TESTING BIAS · MAPPING RISK</small> : null}</span><b>🎯</b>{busy ? <i aria-hidden="true" /> : null}</button>
        {!reviewTarget && vault.length ? <section className="psFingerprint">
          <header><span>🧬 YOUR TRADER FINGERPRINT</span><b>{vaultStats.total} SAVED AUDIT{vaultStats.total === 1 ? "" : "S"}</b></header>
          <div><article><small>AVERAGE SETUP</small><strong>{vaultStats.average}/100</strong></article><article><small>PATIENCE FLAGS</small><strong>{vaultStats.patience}%</strong></article><article><small>MOST REVIEWED</small><strong>{vaultStats.dominant}</strong></article></div>
          <p><strong>REPEATED RISK WATCH:</strong> {vaultStats.commonRisk}</p>
          <footer>{vaultStats.total < 10 ? `${10 - vaultStats.total} more saved audits will make this fingerprint substantially more useful.` : "Your fingerprint is now using enough decisions to expose repeated tendencies."}</footer>
        </section> : null}
        {!reviewTarget && vault.length ? <section className="psVault"><header><span>SAVED DECISIONS</span><b>PRIVATE · THIS DEVICE</b></header>{vault.slice(0,5).map((decision) => <article key={decision.id}><div><strong>{decision.analysis.instrument}</strong><span>{new Date(decision.createdAt).toLocaleString("en-GB", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })} · {decision.intention}</span></div><b>{decision.analysis.setupScore.grade}</b><button type="button" onClick={() => startReview(decision)}>REVIEW LATER CHART</button></article>)}</section> : null}
      </section>
      <FeedbackButton />
    </main>
  );
}
