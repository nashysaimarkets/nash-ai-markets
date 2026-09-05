Warning: truncated output (original token count: 47207)
Total output lines: 2199

"use client";

/* Uploaded charts are private data URLs; routing them through next/image would add no optimisation benefit. */
/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent } from "react";
import type { SupplementalMarketEvent, VerifiedMacroContext } from "../lib/macro-data";
import { normalizeLockedDecisions } from "./decision-compatibility";
import { calculateRiskDesk, type RiskDeskInput } from "./pocket-risk-desk";
import { hasVerifiedTwoSidedStructure, mergeCompatibleChartLevels, rankChartLevels, sanitizeChartLevels, type NumericChartLevel } from "./pocket-chart-toolkit";
import ChartPreflightPanel from "./ChartPreflightPanel";
import AccuracyFeedbackPanel from "./AccuracyFeedbackPanel";
import LevelProvenancePanel from "./LevelProvenancePanel";
import LiquidityGuardOverlay from "./LiquidityGuardOverlay";
import { projectLiquidityZones, type LiquidityShield } from "./liquidity-guard";
import { numericLevelPrice } from "./level-verification";
import { correctionPatch, type AccuracyFeedback } from "./accuracy-feedback";
import { preflightAllowsAnalysis, type ChartConfirmation, type PreflightStatus } from "./chart-preflight";
import { invalidateDerivedChartEvidence, levelEvidenceSourceLabel, type LevelEvidenceSource } from "./pocket-derived-evidence";
import AppleSubscriptionPaywall from "./AppleSubscriptionPaywall";
import { consumeAppleFreeUse, getAppleAccessStatus, isAppleNativeApp, recordAppleSuccessfulAnalysis, requestAppleReviewIfEligible, type AppleAccessStatus } from "./apple-storekit";
import { postLevelLabScan } from "./level-lab-client";
import { enforcePocketTrustGate } from "../lib/pocket-trust-gate";
import DecisionIntelligenceSuite from "./DecisionIntelligenceSuite";
import { eventCoverageFor, isListedEquityEventInput } from "./event-coverage";
import { measureChart } from "./browser-chart-extractor";
import type { ChartEvidenceRole, DeterministicChartEvidence } from "../lib/deterministic-chart-evidence";

type Direction = "BULLISH" | "BEARISH" | "NEUTRAL";
type ToolKind = "support" | "resistance" | "trend" | "pivot" | "zone" | "gap";
type Level = { kind: ToolKind; label: string; price: string; x: number; y: number; x2: number; y2: number; source?: LevelEvidenceSource };
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
  patterns: { name: string; sourceRole?: "PRIMARY" | "HIGHER_TIMEFRAME" | "PRICE_DETAIL" | "INDICATOR_VOLUME"; status: "FORMING" | "CONFIRMED" | "FAILED" | "AMBIGUOUS" | "EXTENDED"; timeframe?: string; confidence?: "LOW" | "MEDIUM" | "HIGH"; evidence: string; confirmation?: string; invalidation: string; geometry?: { plotBounds?: { left: number; top: number; right: number; bottom: number }; points: { x: number; y: number }[]; labelX: number; labelY: number } }[];
  nextSequence: { now: string; confirmation: string; failure: string; patience: string; reassess: string };
  missingInputs: string[];
  contextContribution?: { used: boolean; materialChange: boolean; summary: string; resolvedInputs: string[] };
  evidencePack?: {
    received: number;
    contributions: Array<{
      role: "PRIMARY" | "HIGHER_TIMEFRAME" | "PRICE_DETAIL" | "INDICATOR_VOLUME";
      used: boolean;
      summary: string;
    }>;
  };
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
  liquidityShield?: LiquidityShield;
  plotBounds?: { left: number; top: number; right: number; bottom: number };
  priceScaleAnchors?: { price: number; y: number }[];
  currentPrice?: string;
  levels: Level[];
  contextBattlefield?: { currentPrice?: string; levels: Level[]; priceScaleAnchors?: { price: number; y: number }[]; plotBounds?: { left: number; top: number; right: number; bottom: number } } | null;
  combinedBattlefield?: {
    currentPrice: string;
    levels: Array<{ kind: "support" | "resistance" | "pivot"; label: string; price: string; source: "PRIMARY" | "CONTEXT" | "USER_VERIFIED" }>;
    contextCompatible: boolean;
    compatibilityReason: "NO_CONTEXT" | "IDENTITY_MISSING" | "IDENTITY_MISMATCH" | "PRICE_MISMATCH" | "EXPLICIT_MATCH" | "REPORT_AND_PRICE_MATCH" | "NOT_CONFIRMED";
    coverage: { currentPrice: number | null; supportBelow: boolean; resistanceAbove: boolean; exactHorizontalLevels: number; twoSided: boolean };
  };
  fibLevels: FibLevel[];
  trustGate?: {
    status: "LOCKED" | "PARTIAL" | "HOLD";
    chartLocked: boolean;
    identityLocked: boolean;
    scaleLocked: boolean;
    exactLevelCount: number;
    reasons: string[];
    nextAction: string;
  };
};
type StockEvent = { id: string; type: "EARNINGS" | "DIVIDEND" | "SPLIT"; date: string; detail: string; source: string };
type LockedDecision = { id: string; createdAt: string; intention: Intention; image: string; analysis: Analysis; review?: ProcessReview; afterImage?: string; reviewedAt?: string };
type FollowUpReply = { answer: string; evidence: string[]; caution: string; nextCheck: string };
type ProcessReview = { outcome: "PROFIT" | "LOSS" | "BREAKEVEN" | "UNCLEAR"; processGrade: "A" | "B" | "C" | "D" | "F"; decisionQuality: number; headline: string; outcomeSummary: string; confirmationReview: string; invalidationReview: string; timingReview: string; disciplineReview: string; goodDecisionBadOutcome: boolean; thesisStatus: "HELD" | "FAILED" | "CHANGED" | "NOT_PROVEN"; structureShift: "STRENGTHENED" | "WEAKENED" | "FLIPPED" | "UNCHANGED" | "UNCLEAR"; rootCause: "CHART_READ" | "ENTRY_TIMING" | "STOP_PLACEMENT" | "DISCIPLINE" | "MARKET_OUTCOME" | "NOT_PROVEN"; evidenceChanges: { before: string; after: string; impact: "STRENGTHENED" | "WEAKENED" | "INVALIDATED" | "UNCHANGED" | "UNCLEAR" }[]; nextRule: string; lessons: string[]; behaviourTags: string[] };

function decisionSignature(analysis: Analysis) {
  return JSON.stringify([
    analysis.instrument,
    analysis.timeframe,
    analysis.currentPrice ?? "",
    analysis.direction,
    analysis.verdict,
    analysis.setupScore.overall,
    analysis.verdictHeadline,
  ]);
}

function numericStructure(levels: Array<Pick<Level, "kind" | "label" | "price" | "source">>): NumericChartLevel[] {
  return levels.flatMap((level) => {
    const price = numericLevel(level.price);
    return price !== null && ["support", "resistance", "pivot"].includes(level.kind)
      ? [{ kind: level.kind as NumericChartLevel["kind"], label: level.label, price, source: level.source }]
      : [];
  });
}

function structuralEvidence(analysis: Analysis) {
  const currentPrice = numericLevel(analysis.currentPrice);
  const levels = numericStructure(analysis.levels);
  const exactLevelCount = levels.filter((level) => level.kind === "support" || level.kind === "resistance").length;
  const supportBelow = currentPrice !== null && levels.some((level) => level.kind === "support" && level.price < currentPrice);
  const resistanceAbove = currentPrice !== null && levels.some((level) => level.kind === "resistance" && level.price > currentPrice);
  return {
    currentPrice,
    exactLevelCount,
    supportBelow,
    resistanceAbove,
    twoSided: hasVerifiedTwoSidedStructure(levels, currentPrice),
  };
}

function derivedTrustGate(analysis: Analysis) {
  const structure = structuralEvidence(analysis);
  // Mirror the server's fail-closed identity/readability thresholds exactly.
  // A merely medium-confidence label or limited chart must not be promoted to
  // LOCKED by the client after a correction or Level Lab update.
  const derivedIdentityLocked = analysis.instrument !== "UNKNOWN"
    && analysis.timeframe !== "UNKNOWN"
    && analysis.evidenceQuality.instrumentConfidence === "HIGH"
    && analysis.evidenceQuality.timeframeConfidence === "HIGH";
  const derivedChartLocked = analysis.evidenceQuality.chartReadability === "CLEAR" && analysis.evidenceQuality.candlesReadable;
  // Server locks are authoritative. Client-side edits may remove evidence, but
  // they must never upgrade an analysis the server held or marked partial.
  const identityLocked = derivedIdentityLocked && (analysis.trustGate?.identityLocked ?? true);
  const chartLocked = derivedChartLocked && (analysis.trustGate?.chartLocked ?? true);
  const hasLevelLabPriceMap = analysis.levels.some((level) => level.source === "LEVEL_LAB" && numericLevel(level.price) !== null);
  const priceMapLocked = (analysis.evidenceQuality.scaleReadable || hasLevelLabPriceMap) && structure.currentPrice !== null;
  const structureLocked = structure.twoSided;
  const scaleLocked = priceMapLocked && structureLocked;
  const derivedStatus: "LOCKED" | "PARTIAL" | "HOLD" = chartLocked && identityLocked && scaleLocked
    ? "LOCKED"
    : !chartLocked || structure.exactLevelCount === 0
      ? "HOLD"
      : "PARTIAL";
  const statusRank = { HOLD: 0, PARTIAL: 1, LOCKED: 2 } as const;
  const serverStatus = analysis.trustGate?.status;
  const status: "LOCKED" | "PARTIAL" | "HOLD" = serverStatus && statusRank[serverStatus] < statusRank[derivedStatus]
    ? serverStatus
    : derivedStatus;
  const structuralReasons = [
    structure.currentPrice === null ? "Current price is not verified from the visible scale." : "Current price is verified from the visible scale.",
    structure.supportBelow ? "Support below the current price is verified." : "Support below the current price is not verified.",
    structure.resistanceAbove ? "Resistance above the current price is verified." : "Resistance above the current price is not verified.",
  ];
  const inheritedReasons = analysis.trustGate?.reasons.filter((reason) => !/support|resistance|exact level/i.test(reason)) ?? [];
  return {
    status,
    chartLocked,
    identityLocked,
    priceMapLocked,
    structureLocked,
    scaleLocked,
    exactLevelCount: structure.exactLevelCount,
    reasons: [...structuralReasons, ...inheritedReasons].slice(0, 4),
    nextAction: structure.twoSided
      ? analysis.trustGate?.nextAction ?? "Confirm the marked levels on the source platform before acting."
      : "Add one clearer price-scale chart or use Level Lab. Bullseye will not guess the missing side.",
    structure,
  };
}

function ResultTruthStrip({ analysis }: { analysis: Analysis }) {
  const identityVerified = analysis.instrument !== "UNKNOWN" && analysis.evidenceQuality.instrumentConfidence === "HIGH";
  const timeframeVerified = analysis.timeframe !== "UNKNOWN" && analysis.evidenceQuality.timeframeConfidence === "HIGH";
  const gate = derivedTrustGate(analysis);
  const priceVerified = gate.structure.currentPrice !== null;
  const exactLevelCount = gate.exactLevelCount;
  const gateStatus = gate.status;
  const facts = [
    { label: "INSTRUMENT", value: identityVerified ? analysis.instrument : "VERIFY", verified: identityVerified },
    { label: "TIMEFRAME", value: timeframeVerified ? analysis.timeframe : "VERIFY", verified: timeframeVerified },
    { label: "CURRENT PRICE", value: priceVerified ? analysis.currentPrice : "NOT VERIFIED", verified: priceVerified },
    { label: "TWO-SIDED S / R", value: gate.structure.twoSided ? String(exactLevelCount) : "NOT VERIFIED", verified: gate.structure.twoSided },
  ];

  return <section className="psResultTruthStrip" data-status={gateStatus} aria-label={`Result evidence status: ${gateStatus.toLowerCase()}`}>
    <header><span><i /> PRECISION STATUS</span><strong>{gateStatus === "LOCKED" ? "EVIDENCE LOCKED" : gateStatus === "PARTIAL" ? "PARTIAL — CHECK HIGHLIGHTED ITEMS" : "PRECISION HOLD"}</strong></header>
    <div>{facts.map((fact) => <article key={fact.label} data-verified={fact.verified}><small>{fact.label}</small><b>{fact.value}</b><span>{fact.verified ? "VERIFIED" : "CHECK"}</span></article>)}</div>
    <footer>{gateStatus === "LOCKED" ? "The screenshot supplied enough visible evidence for the fields above. Confirm them on the original platform before acting." : "Unverified fields are never replaced with estimates. Add a clearer chart view where requested."}</footer>
  </section>;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
function clampY(y: number) {
  return Math.max(5, Math.min(95, Number.isFinite(y) ? y : 50));
}

const MAX_PROVIDER_SCAN_DATA_URL_CHARS = 1_900_000;
function createProviderScanImage(dataUrl: string, forceDecode = false) {
  if (!forceDecode && /^data:image\/(?:jpeg|png|webp);base64,/.test(dataUrl) && dataUrl.length <= MAX_PROVIDER_SCAN_DATA_URL_CHARS) {
    return Promise.resolve(dataUrl);
  }
  return new Promise<string | null>((resolve) => {
    const source = new Image();
    source.onload = () => {
      try {
        // Keep the complete chart in the same coordinate frame as the first
        // provider frame. The former fixed 6%/82% crop clipped lower support
        // and made a crop-row percentage disagree with its full-image row.
        const attempts = [
          { maxWidth: 1800, maxHeight: 3000, quality: .88 },
          { maxWidth: 1400, maxHeight: 2600, quality: .82 },
          { maxWidth: 1100, maxHeight: 2200, quality: .76 },
          { maxWidth: 800, maxHeight: 1600, quality: .68 },
          { maxWidth: 600, maxHeight: 1200, quality: .58 },
        ];
        for (const attempt of attempts) {
          const scale = Math.min(1, attempt.maxWidth / source.naturalWidth, attempt.maxHeight / source.naturalHeight);
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
          const context = canvas.getContext("2d");
          if (!context) return resolve(null);
          context.drawImage(source, 0, 0, source.naturalWidth, source.naturalHeight, 0, 0, canvas.width, canvas.height);
          const encoded = canvas.toDataURL("image/jpeg", attempt.quality);
          if (encoded.length <= MAX_PROVIDER_SCAN_DATA_URL_CHARS) return resolve(encoded);
        }
        resolve(null);
      } catch { resolve(null); }
    };
    source.onerror = () => resolve(null);
    source.src = dataUrl;
  });
}

const MAX_LEVEL_LAB_DATA_URL_CHARS = 3_600_000;
function createLevelLabScanImage(dataUrl: string) {
  return new Promise<string | null>((resolve) => {
    const source = new Image();
    source.onload = () => {
      try {
        const render = (width: number, quality: number) => {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = Math.max(1, Math.round(source.naturalHeight * width / source.naturalWidth));
          const context = canvas.getContext("2d");
          if (!context) return null;
          context.drawImage(source, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL("image/jpeg", quality);
        };
        // One complete, readable frame is more reliable in WKWebView than the
        // previous original-plus-crop request. Keep the chart title, candles
        // and price scale together while bounding the final JSON payload.
        const targetWidth = Math.min(1600, source.naturalWidth);
        const first = render(targetWidth, .88);
        if (first && first.length <= MAX_LEVEL_LAB_DATA_URL_CHARS) return resolve(first);
        const compact = render(Math.min(1100, targetWidth), .78);
        resolve(compact && compact.length <= MAX_LEVEL_LAB_DATA_URL_CHARS ? compact : null);
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

// Retained temporarily for saved-result compatibility while its retired stylesheet no longer ships.
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
// Retained temporarily for saved-result compatibility while its retired stylesheet no longer ships.
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
// Retained temporarily for saved-result compatibility while its retired stylesheet no longer ships.
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

// Retained presentation prototypes are deliberately excluded from the current
// result flow while remaining type-checked for a future evidence-led decision.
void LockOnReveal;
void BullseyeCommandArena;
void BubbleChartLab;

function isListedEquityAnalysis(analysis: Analysis | null) {
  return analysis ? isListedEquityEventInput(analysis) : false;
}

function DecisionMap({ analysis, sourceImage, expanded = false, scenario = null, onScenario, hasContext = false }: { analysis: Analysis; sourceImage?: string | null; expanded?: boolean; scenario?: "bull" | "wait" | "bear" | null; onScenario?: (scenario: "bull" | "wait" | "bear") => void; hasContext?: boolean }) {
  const candidates = analysis.levels.flatMap((level) => {
    const price = numericLevel(level.price);
    return price !== null && ["support", "resistance", "pivot"].includes(level.kind) ? [{ ...level, numericPrice: price }] : [];
  });
  const current = numericLevel(analysis.currentPrice);
  const strictLevels: NumericChartLevel[] = sanitizeChartLevels(candidates.map((level) => ({ kind: level.kind as NumericChartLevel["kind"], label: level.label, price: level.numericPrice, source: level.source })), current);
  const verified = candidates.filter((candidate) => strictLevels.some((level) => level.kind === candidate.kind && level.price === candidate.numericPrice));
  const verifiedStructure = verified.filter((level) => level.kind === "support" || level.kind === "resistance");
  const twoSided = hasVerifiedTwoSidedStructure(strictLevels, current);

  // Withhold the map only when there is no exact price evidence at all. A
  // verified one-sided level remains useful as PARTIAL evidence, but it never
  // upgrades the Trust Gate or pretends the missing side was found.
  if (current === null || !verifiedStructure.length) {
    return <section className={`psDecisionMapHold${expanded ? " psDecisionMapHoldExpanded" : ""}`} aria-label="Bullseye Decision Map precision hold">
      <span>◎ PRECISION HOLD</span>
      <strong>{hasContext ? "NO VERIFIED TWO-SIDED LEVELS" : "EXACT LEVELS NOT VERIFIED"}</strong>
      <p>{hasContext
        ? "Bullseye checked both charts but could not verify support below and resistance above the current price. The map is withheld rather than guessed."
        : "Bullseye could not verify both support below and resistance above the current price from this chart. The map is withheld rather than guessed."}</p>
      {hasContext ? <nav aria-label="Precision hold actions">
        <a href="#bullseye-source-charts">VIEW BOTH SOURCE CHARTS</a>
        <a href="#bullseye-level-lab">OPEN LEVEL LAB</a>
      </nav> : <button type="button" onClick={() => document.getElementById("psResultSupportInput")?.click()}>＋ ADD ONE CLEARER PRICE-SCALE CHART</button>}
      <small>NO ESTIMATED LEVELS · NO HIDDEN MAP</small>
    </section>;
  }

  const values = [...verified.map((level) => level.numericPrice), ...(current !== null ? [current] : [])];
  const rawMin = values.length ? Math.min(...values) : 0;
  const rawMax = values.length ? Math.max(...values) : 1;
  const padding = Math.max((rawMax - rawMin) * .16, Math.abs(rawMax || 1) * .0025, 1);
  const min = rawMin - padding;
  const max = rawMax + padding;
  const position = (price: number) => 34 + ((max - price) / (max - min)) * 42;
  const ordered = [...verified].sort((a, b) => b.numericPrice - a.numericPrice);
  const nearCurrentTolerance = Math.max(Math.abs(current) * .0015, .01);
  const supports = ordered.filter((level) => level.kind === "support" && level.numericPrice < current);
  const resistances = ordered.filter((level) => level.kind === "resistance" && level.numericPrice > current);
  const nearestSupport = supports[0] ?? null;
  const nearestResistance = resistances.at(-1) ?? null;
  const supportDistance = nearestSupport ? current - nearestSupport.numericPrice : null;
  const resistanceDistance = nearestResistance ? nearestResistance.numericPrice - current : null;
  const supportAtCurrent = supportDistance !== null && supportDistance <= nearCurrentTolerance;
  const resistanceAtCurrent = resistanceDistance !== null && resistanceDistance <= nearCurrentTolerance;
  const formatDistance = (distance: number | null) => distance === null ? "—" : distance.toLocaleString("en-GB", { maximumFractionDigits: 2 });
  const formatPercent = (distance: number | null) => distance === null || current === null || current === 0 ? "" : `${(distance / current * 100).toFixed(2)}%`;
  const proximity = supportAtCurrent && nearestResistance
    ? "AT SUPPORT · BELOW RESISTANCE"
    : resistanceAtCurrent && nearestSupport
      ? "ABOVE SUPPORT · AT RESISTANCE"
      : supportAtCurrent
        ? "AT VERIFIED SUPPORT"
        : resistanceAtCurrent
          ? "AT VERIFIED RESISTANCE"
          : supportDistance !== null && resistanceDistance !== null
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
  const locationHeadline = supportAtCurrent
    ? `Price is testing verified support${nearestResistance && resistanceDistance !== null ? `, with resistance ${formatDistance(resistanceDistance)} above` : ""}.`
    : resistanceAtCurrent
      ? `Price is testing verified resistance${nearestSupport && supportDistance !== null ? `, with support ${formatDistance(supportDistance)} below` : ""}.`
      : nearestSupport && nearestResistance && supportDistance !== null && resistanceDistance !== null
        ? `Price is ${formatDistance(supportDistance)} above support and ${formatDistance(resistanceDistance)} below resistance.`
        : nearestSupport && supportDistance !== null
          ? `Price is ${formatDistance(supportDistance)} above verified support.`
          : nearestResistance && resistanceDistance !== null
            ? `Price is ${formatDistance(resistanceDistance)} below verified resistance.`
      : "Verified price location needs a clearer scale.";

  const mapDetail = twoSided
    ? "Nearest verified levels and the conditions that could change this read."
    : nearestSupport
      ? "Partial map: support is verified; resistance still needs a clearer view."
      : nearestResistance
        ? "Partial map: resistance is verified; support still needs a clearer view."
        : "Partial map: one exact level is verified, but its market side still needs confirmation.";

  return <div className={`psBattlefield psDecisionMap${expanded ? " psBattlefieldExpanded" : ""}`} data-scenario={scenario ?? "all"} data-structure={twoSided ? "two-sided" : "partial"} aria-label="Bullseye Decision Map">
    <header className="psMapIntro"><div><small>{twoSided ? "YOU ARE HERE" : "PARTIAL PRICE MAP"}</small><strong>{locationHeadline}</strong><p>{mapDetail}</p></div>{sourceImage ? <figure><img src={sourceImage} alt="Selected source chart thumbnail" /><figcaption>{analysis.timeframe}</figcaption></figure> : null}</header>
    <div className="psBattleGrid" aria-hidden="true" />
    {verified.length ? <div className="psPriceLadder" aria-label="Calibrated Decision Map price ladder">{scaleTicks.map((tick) => <span key={`${tick.price}-${tick.top}`} style={{ top: `${tick.top}%` }}><i /><small>{tick.price.toLocaleString("en-GB", { minimumFractionDigits: priceDecimals, maximumFractionDigits: priceDecimals })}</small></span>)}</div> : null}
    {nearestSupport && nearestResistance ? <div className="psDecisionRange" style={{ top: `${rangeTop}%`, height: `${rangeHeight}%` }} aria-label={`Active decision range from ${nearestSupport.price} to ${nearestResistance.price}`}><span>ACTIVE DECISION RANGE</span><i /><i /><i /></div> : null}
    {current !== null ? <div className="psPressureContours" style={{ top: `${currentY}%` }} aria-hidden="true"><i /><i /><i /></div> : null}
    <div className="psBattleIntel">
      <article data-tone="support"><span>TO SUPPORT</span><strong>{nearestSupport ? formatDistance(supportDistance) : "NOT VERIFIED"}</strong><small>{nearestSupport ? formatPercent(supportDistance) : "CLEARER VIEW NEEDED"}</small></article>
      <article data-tone="location"><span>MARKET LOCAT…27207 tokens truncated…ata-impact={change.impact}><i>{String(index + 1).padStart(2, "0")}</i><div><small>BEFORE</small><p>{change.before}</p><small>AFTER</small><p>{change.after}</p></div><b>{change.impact}</b></article>) : <p>No reliable structural change could be proven from the two screenshots.</p>}</section>
        <section className="psReviewGrid"><article><span>CONFIRMATION</span><p>{review.confirmationReview}</p></article><article><span>INVALIDATION</span><p>{review.invalidationReview}</p></article><article><span>TIMING</span><p>{review.timingReview}</p></article><article><span>DISCIPLINE</span><p>{review.disciplineReview}</p></article></section>
        <section className="psNextRule"><span>NEXT DECISION RULE</span><strong>{review.nextRule}</strong></section>
        <section className="psAuditGrid"><article data-audit="improve"><span>LESSONS TO CARRY FORWARD</span><ul>{review.lessons.map((lesson) => <li key={lesson}>{lesson}</li>)}</ul></article><article data-audit="trap"><span>BEHAVIOUR TAGS</span><p>{review.behaviourTags.join(" · ") || "No reliable behaviour tag"}</p></article></section>
        {review.goodDecisionBadOutcome ? <p className="psProcessNote">GOOD DECISION · BAD OUTCOME — protect the process; do not rewrite it because of one result.</p> : null}
        <p className="psLegal">Screenshots cannot prove exact execution. Confirm fills and P&amp;L on the original platform.</p>
      </section><FeedbackButton />
    </main>;
  }

  if (analysis) {
    const eventNow = eventClock.now;
    const todayInLondon = londonDay(eventClock.iso);
    const scheduledMacro = [
      ...eventContext.releases.map((event) => ({ ...event, sourceLabel: `${event.agency} · OFFICIAL SCHEDULE`, sourceUrl: event.sourceUrl ?? "" })),
      ...marketEvents.map((event) => ({ ...event, sourceLabel: `${event.source} · PROVIDER SCHEDULE`, sourceUrl: "" })),
    ].sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
    const todayMacro = scheduledMacro.filter((event) => londonDay(event.scheduledAt) === todayInLondon);
    const nextHighImpact = scheduledMacro.find((event) => event.risk === "HIGH" && Date.parse(event.scheduledAt) > eventNow);
    const calendarUnavailable = eventContext.calendarSources?.unavailable ?? [];
    const eventCoverage = eventCoverageFor(analysis);
    const contextBattlefield = analysis.contextBattlefield;
    const contextMergeConfirmed = Boolean(
      contextImage
      && analysis.combinedBattlefield?.contextCompatible
      && analysis.higherTimeframe.alignment !== "CONFLICTING",
    );
    const serverCombinedBattlefield = contextMergeConfirmed && analysis.combinedBattlefield?.contextCompatible
      ? analysis.combinedBattlefield
      : null;
    const primaryNumericLevels: NumericChartLevel[] = analysis.levels.flatMap((level) => {
      const price = numericLevel(level.price);
      return price !== null && ["support", "resistance", "pivot"].includes(level.kind)
        ? [{ kind: level.kind as NumericChartLevel["kind"], label: level.label, price, source: level.source ?? "PRIMARY" }]
        : [];
    });
    const contextNumericLevels: NumericChartLevel[] = (contextBattlefield?.levels ?? []).flatMap((level) => {
      const price = numericLevel(level.price);
      return price !== null && ["support", "resistance", "pivot"].includes(level.kind)
        ? [{ kind: level.kind as NumericChartLevel["kind"], label: level.label, price, source: "CONTEXT" as const }]
        : [];
    });
    const serverContextNumericLevels = numericStructure((serverCombinedBattlefield?.levels ?? []).filter((level) => level.source === "CONTEXT"));
    const candidateContextLevels = serverContextNumericLevels.length ? serverContextNumericLevels : contextNumericLevels;
    const combinedNumericLevels = mergeCompatibleChartLevels(
      primaryNumericLevels,
      candidateContextLevels,
      numericLevel(analysis.currentPrice),
      numericLevel(serverCombinedBattlefield?.currentPrice ?? contextBattlefield?.currentPrice),
      contextMergeConfirmed,
    );
    const combinedLevels: Level[] = combinedNumericLevels.map((numeric) => {
      const primarySource = analysis.levels.find((level) => level.kind === numeric.kind && numericLevel(level.price) === numeric.price);
      // Context-only numeric evidence is valid for lists and the price ladder,
      // but its crop coordinates must never be drawn over the primary image.
      const source = numeric.source ?? (primarySource ? "PRIMARY" : "CONTEXT");
      return primarySource
        ? { ...primarySource, source }
        : { kind: numeric.kind, label: numeric.label, price: String(numeric.price), x: Number.NaN, y: Number.NaN, x2: Number.NaN, y2: Number.NaN, source };
    });
    const combinedAnalysis: Analysis = {
      ...analysis,
      currentPrice: analysis.currentPrice || serverCombinedBattlefield?.currentPrice,
      levels: combinedLevels,
    };
    const currentDecisionSaved = vault.some((item) => decisionSignature(item.analysis) === decisionSignature(analysis));
    const battlefieldAnalysis: Analysis = battlefieldChart === "context" && contextBattlefield ? {
      ...analysis,
      levels: Array.isArray(contextBattlefield.levels) ? contextBattlefield.levels.map((level) => ({ ...level, source: "CONTEXT" as const })) : [],
      currentPrice: contextBattlefield.currentPrice,
      timeframe: analysis.higherTimeframe.timeframe || "CONTEXT",
      direction: analysis.higherTimeframe.direction === "UNKNOWN" ? "NEUTRAL" : analysis.higherTimeframe.direction,
    } : combinedAnalysis;
    const battlefieldTabs = contextImage ? <nav className="psBattleTabs" aria-label="Choose chart for Bullseye Decision Map">
      <button type="button" data-active={battlefieldChart === "primary"} aria-pressed={battlefieldChart === "primary"} onClick={() => setBattlefieldChart("primary")}><span>{contextMergeConfirmed ? "①＋②" : "①"}</span><strong>{contextMergeConfirmed ? "COMBINED MAP" : "PRIMARY MAP"}</strong><small>{contextMergeConfirmed ? `${analysis.timeframe} + ${analysis.higherTimeframe.timeframe || "SECOND VIEW"}` : "CONTEXT NOT MERGED"}</small></button>
      <button type="button" disabled={!contextBattlefield} data-active={battlefieldChart === "context"} aria-pressed={battlefieldChart === "context"} onClick={() => setBattlefieldChart("context")}><span>②</span><strong>{contextBattlefield ? "CONTEXT" : "CONTEXT PENDING"}</strong><small>{contextBattlefield ? analysis.higherTimeframe.timeframe || "SECOND VIEW" : "REANALYSE TO VERIFY"}</small></button>
    </nav> : null;
    return (
      <main className="psApp" data-pocket-build="v3.2" data-chart-focus={chartFocus ? "true" : "false"}>
        <section className="psResults" data-immersive={immersive ? "true" : "false"} data-chart-focus={chartFocus ? "true" : "false"}>
          <div className="psImmersiveBar">
            <span>POCKET BULLSEYE · PRIVATE RESULT</span>
            <button type="button" onClick={startNewChart}>NEW CHART</button>
          </div>
          <nav className="psResultViewSwitch" aria-label="Choose result view"><button type="button" data-active={resultView === "cinema"} aria-pressed={resultView === "cinema"} onClick={() => setResultView("cinema")}>▶ CINEMATIC RESULT</button><button type="button" data-active={resultView === "report"} aria-pressed={resultView === "report"} onClick={() => openResultReport()}>▤ WRITTEN REPORT</button></nav>
          <CoreScanSummary
            analysis={combinedAnalysis}
            todayMacroCount={todayMacro.length}
            nextHighImpactLabel={nextHighImpact ? `${macroEventDisplayName(nextHighImpact.name)} · ${formatEventTime(nextHighImpact.scheduledAt)}` : null}
            macroAvailable={calendarUnavailable.length < 3 || marketEvents.length > 0}
            onOpenTool={(mode) => { setCommandDeckMode(mode); openResultReport("bullseye-tools"); }}
            onOpenMacro={() => openResultReport("bullseye-events")}
          />
          {resultView === "cinema" ? <MarketStory analysis={combinedAnalysis} sourceImage={image ?? ""} onShare={() => setShowResultCard(true)} onOpenReport={openResultReport} viewerName={viewerName.trim()} intention={intention} /> : <div className="psWrittenReport">
          <nav className="psReportRail" aria-label="Written result sections"><a href="#bullseye-verdict">VERDICT</a><a href="#bullseye-tools">TOOLS</a><a href="#bullseye-intelligence-maps">MAPS</a><a href="#bullseye-levels">LEVELS</a><a href="#bullseye-events">EVENTS</a><a href="#bullseye-evidence">EVIDENCE</a><a href="#bullseye-ask">ASK</a><a href="#bullseye-feedback">FEEDBACK</a></nav>
          <ResultTruthStrip analysis={combinedAnalysis} />
          <header id="bullseye-verdict" className="psVerdict">
            <p><i /> BULLSEYE PRE-TRADE DECISION AUDIT</p>
            <div className="psVerdictTop"><h1><small>SETUP GRADE</small><em data-grade={analysis.setupScore.grade}>{analysis.setupScore.grade}</em></h1><div><small>{analysis.setupScore.overall}/100</small><strong data-verdict={analysis.verdict}>{analysis.verdict.replaceAll("_", " ")}</strong></div></div>
            <h2>{analysis.verdictHeadline}</h2><span>{analysis.summary}</span>
            <b>CONDITIONAL DECISION SUPPORT · NOT A TRADE INSTRUCTION</b>
          </header>
          {analysis.evidencePack?.contributions?.length ? <section className="psEvidenceContribution">
            <header><div><span>◎ EVIDENCE PACK USED</span><strong>{analysis.evidencePack.received}/4 IMAGES RECEIVED</strong></div><b>{analysis.evidencePack.contributions.filter((item) => item.used).length} CONTRIBUTED</b></header>
            <div>{analysis.evidencePack.contributions.map((item) => <article key={item.role} data-used={item.used ? "true" : "false"}><i>{item.role === "PRIMARY" ? "①" : item.role === "HIGHER_TIMEFRAME" ? "②" : item.role === "PRICE_DETAIL" ? "③" : "④"}</i><div><strong>{item.role.replaceAll("_", " ")}</strong><p>{item.summary}</p></div><b>{item.used ? "USED" : "NO NEW EVIDENCE"}</b></article>)}</div>
            <footer>Every supporting image is assessed separately. A chart that adds nothing cannot inflate the score or confidence.</footer>
          </section> : null}
          <div id="bullseye-tools" className="psReportTools"><PocketCommandDeck analysis={combinedAnalysis} primaryLevels={analysis.levels} sourceImage={image ?? ""} onResultCard={() => setShowResultCard(true)} onAddChart={addResultContextFile} onReanalyse={reanalyseResult} hasContext={Boolean(contextImage)} reanalysing={refinementStatus === "analysing"} mode={commandDeckMode} onMode={setCommandDeckMode} /></div>
          <DecisionIntelligenceSuite analysis={combinedAnalysis} />
          <section id="bullseye-events" className="psDecisionEvents" data-status={stockEventStatus}>
            <header><div><span>◷ EVENT RISK CONTEXT</span><small>{analysis.ticker !== "UNKNOWN" ? `${analysis.ticker} · ${eventCoverage.label}` : `${eventCoverage.label} · CONFIRM BEFORE TRADING`}</small></div>{nextHighImpact ? <strong className="psEventHighAlert">HIGH<small>EVENT AHEAD</small></strong> : isListedEquityAnalysis(analysis) && stockEvents.length ? <strong>{analysis.setupScore.eventSafety}<small>/10</small></strong> : <strong className="psEventCheckOnly">CHECK<small>NO VERIFIED SCORE</small></strong>}</header>
            <div className="psEventScope" data-asset={eventCoverage.assetClass}><b>{eventCoverage.label}</b><span>{eventCoverage.summary}</span>{eventCoverage.limitation ? <small>NOT INCLUDED · {eventCoverage.limitation}</small> : null}</div>
            <div className="psTodayCalendar"><header><div><span>📅 TODAY · UK TIME</span><small>US MACRO + MARKET CALENDAR · AUTO-REFRESH</small></div><b>{todayMacro.length ? `${todayMacro.length} EVENT${todayMacro.length === 1 ? "" : "S"}` : calendarUnavailable.length === 3 && !marketEvents.length ? "UNAVAILABLE" : "NO RELEASE"}</b></header>{todayMacro.length ? <ol>{todayMacro.map((event) => { const released = Date.parse(event.scheduledAt) <= eventNow; return <li key={event.id} data-risk={event.risk}><time>{londonClock(event.scheduledAt)}</time><div><strong>{macroEventDisplayName(event.name)}</strong><small>{event.sourceLabel} · {event.risk} IMPACT · {released ? "RELEASED" : "SCHEDULED"}</small></div>{event.sourceUrl ? <a href={event.sourceUrl} target="_blank" rel="noreferrer">SOURCE ↗</a> : null}</li>; })}</ol> : <p>{calendarUnavailable.length === 3 && !marketEvents.length ? "The connected calendar sources could not be reached. Treat event risk as unverified and check the agency or broker calendar." : "No medium or high-impact US release is listed for today in the connected schedules. Unscheduled news can still move price."}</p>}</div>
            {nextHighImpact ? <div className="psMacroNext" data-risk="HIGH"><b>NEXT HIGH IMPACT · {formatEventTime(nextHighImpact.scheduledAt)}</b><span>{nextHighImpact.name} · {nextHighImpact.sourceLabel}</span>{nextHighImpact.sourceUrl ? <a href={nextHighImpact.sourceUrl} target="_blank" rel="noreferrer">VERIFY SOURCE ↗</a> : null}</div> : <div className="psMacroNext"><b>NO UPCOMING HIGH-IMPACT ROW RETURNED</b><span>{calendarUnavailable.length && !marketEvents.length ? `Schedule coverage unavailable: ${calendarUnavailable.join(" · ")}.` : "No high-impact row appears in the connected schedule window."}</span></div>}
            {isListedEquityAnalysis(analysis) ? <div className="psEventHeadline"><b>{stockEventStatus === "loading" ? "CHECKING COMPANY CALENDAR…" : stockEvents[0] ? `${stockEvents[0].type} · ${stockEvents[0].date}` : stockEventStatus === "unavailable" ? "COMPANY FEED UNAVAILABLE" : `NO UPCOMING ${analysis.ticker} EVENT RETURNED`}</b><span>{stockEvents[0]?.detail ?? "No symbol-matched company event was returned in the connected provider window."}</span></div> : <div className="psEventHeadline"><b>SYMBOL-SPECIFIC CALENDAR NOT ATTACHED</b><span>{eventCoverage.limitation ?? "This instrument uses the official macro schedule rather than a company calendar."}</span></div>}
            <details><summary>VIEW EVENT SOURCES <b>⌄</b></summary><div><p>Relevant categories: {analysis.relevantEventTypes.length ? analysis.relevantEventTypes.join(" · ") : "No category identified safely"}</p>{stockEvents.length ? <ol>{stockEvents.map((event) => <li key={event.id}><time>{event.date}</time><strong>{event.type}</strong><span>{event.detail} · {event.source} · SYMBOL MATCHED</span></li>)}</ol> : null}{scheduledMacro.length ? <ol>{scheduledMacro.slice(0, 8).map((event) => <li key={event.id}><time>{formatEventTime(event.scheduledAt)}</time><strong>{event.name}</strong><span>{event.sourceLabel} · {event.risk} IMPACT</span></li>)}</ol> : <p>No medium or high-impact US release rows are available in the current window.</p>}{isListedEquityAnalysis(analysis) ? <a href={`https://www.sec.gov/edgar/browse/?CIK=${encodeURIComponent(analysis.ticker)}&owner=exclude&action=getcompany`} target="_blank" rel="noreferrer">CHECK OFFICIAL SEC FILINGS ↗</a> : null}</div></details>
            <footer>Schedule refreshed {formatEventTime(eventContext.generatedAt)} · {eventContext.calendarSources?.available.length ? `${eventContext.calendarSources.available.join(" · ")} official` : "No official calendar source confirmed"}{marketEvents.length ? " · Financial Modeling Prep connected" : ""}{calendarUnavailable.length ? ` · ${calendarUnavailable.join(" · ")} unavailable` : ""}. Provider dates may be estimated or revised. Always verify before trading.</footer>
          </section>
          <section id="bullseye-levels" className="psResultChart psChartWorkspace psBattleWorkspace psDecisionMapWorkspace">
            <header><div><span>🗺️ EXPLORE PRICE LEVELS</span><small>OPTIONAL DECISION MAP · PRIMARY / CONTEXT</small></div><button type="button" onClick={openChartFocus}>EXPAND</button></header>
            <section id="bullseye-level-lab" className="psLevelLab" data-status={levelLabStatus} aria-live="polite" aria-busy={levelLabStatus === "scanning"}>
              <header><div><span>◎ INDEPENDENT LEVEL LAB</span><small>SUPPORT + RESISTANCE ONLY</small></div><b>{levelLabStatus === "updated" ? "MAP UPDATED" : levelLabStatus === "scanning" ? "SCANNING…" : levelLabStatus === "attached" ? "PHOTO READY" : "SEPARATE SCAN"}</b></header>
              <p>Add a clearer price-scale photo, then rescan only this map. Patterns and scenarios stay unchanged; if the new map is partial, confidence, score and verdict are reduced safely.</p>
              {levelLabImage ? <div className="psLevelLabPhoto"><img src={levelLabImage} alt="Chart selected for independent support and resistance scan" /><span>{levelLabFileName}</span></div> : null}
              <div><label>{levelLabImage ? "CHANGE PHOTO" : "＋ ADD PHOTO"}<input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Add photo for independent support and resistance scan" disabled={levelLabStatus === "scanning"} onChange={addLevelLabFile} /></label><button type="button" disabled={!levelLabImage || levelLabStatus === "scanning"} onClick={rescanLevelsOnly}>{levelLabStatus === "scanning" ? "SCANNING LEVELS…" : "↻ RESCAN LEVELS ONLY"}</button></div>
              {levelLabError ? <small role="alert">{levelLabError}</small> : null}
            </section>
            {battlefieldTabs}
            <DecisionMap analysis={battlefieldAnalysis} sourceImage={battlefieldChart === "context" ? contextImage : image} scenario={selectedScenario} onScenario={setSelectedScenario} hasContext={Boolean(contextBattlefield)} />
            {battlefieldChart === "primary" ? <LevelProvenancePanel levels={analysis.levels} anchors={analysis.priceScaleAnchors} /> : null}
            <details id="bullseye-source-charts" className="psSourceEvidence"><summary>VIEW {battlefieldChart === "context" ? "CONTEXT" : "PRIMARY"} SOURCE CHART <b>⌄</b></summary>{battlefieldChart === "context" ? contextSourceChart() : sourceChart()}</details>
          </section>
          {analysis.missingInputs.length || refinementStatus !== "idle" || !structuralEvidence(combinedAnalysis).twoSided ? <section className="psMissingInputs" data-refined={refinementStatus === "updated"} data-status={refinementStatus} aria-busy={refinementStatus === "analysing"} aria-live="polite"><header><span>📷 {refinementStatus === "updated" ? "TWO CHARTS ANALYSED" : refinementStatus === "attached" ? "SECOND VIEW ATTACHED" : contextImage ? "TWO CHARTS LOADED · OPTIONAL FINAL CHECK" : "ONE MORE VIEW COULD HELP"}</span><b>{refinementStatus === "analysing" ? "REANALYSING ALL CHARTS…" : refinementStatus === "updated" ? analysis.contextContribution?.materialChange ? "FINDINGS UPDATED" : "READ CONFIRMED" : refinementStatus === "attached" ? "2 CHARTS READY" : contextImage ? "ONLY MISSING EVIDENCE" : "ONLY IF AVAILABLE"}</b></header>{contextImage && (refinementStatus === "attached" || refinementStatus === "updated") ? <div className="psViewComparison"><div className="psViewPair"><figure><img src={image ?? ""} alt="Original trading chart" /><figcaption>PRIMARY</figcaption></figure><i>＋</i><figure><img src={contextImage} alt="Supporting timeframe chart" /><figcaption>ADDED VIEW</figcaption></figure></div><p>{refinementStatus === "attached" ? "Your second timeframe is attached. Tap Reanalyse all charts to replace the findings using both images." : analysis.contextContribution?.summary || "Both charts were compared and the current findings were replaced."}</p>{refinementStatus === "updated" ? <><div className="psRefineDelta"><article><span>SCORE</span><strong>{refinementBefore ? `${analysis.setupScore.overall - refinementBefore.setupScore.overall >= 0 ? "+" : ""}${analysis.setupScore.overall - refinementBefore.setupScore.overall}` : "—"}</strong></article><article><span>VERDICT</span><strong>{refinementBefore && refinementBefore.verdict !== analysis.verdict ? `${refinementBefore.verdict.replaceAll("_", " ")} → ${analysis.verdict.replaceAll("_", " ")}` : "UNCHANGED"}</strong></article><article><span>LEVELS</span><strong>{battlefieldChart === "context" ? "CONTEXT VIEW" : "PRIMARY VIEW"}</strong></article></div>{analysis.contextContribution?.resolvedInputs.length ? <small>RESOLVED · {analysis.contextContribution.resolvedInputs.join(" · ")}</small> : null}</> : null}</div> : analysis.missingInputs.length ? <ul>{analysis.missingInputs.slice(0, 2).map((item) => <li key={item}>{item}</li>)}</ul> : <p className="psPrecisionPrompt">Add a view with a clear price scale so Bullseye can retry exact support and resistance verification.</p>}<footer><div><strong>{refinementStatus === "analysing" ? "CHECKING BOTH CHARTS" : refinementStatus === "updated" ? "FINDINGS REPLACED" : refinementStatus === "attached" ? "PHOTO ADDED — READY" : "HAVE THAT VIEW?"}</strong><span>{refinementStatus === "analysing" ? "Support, resistance and the written read are being checked again." : refinementStatus === "updated" ? "The decision map and report now use the latest two-chart analysis." : refinementStatus === "attached" ? contextFileName : contextImage ? (analysis.missingInputs.slice(0, 2).join(" · ") || "Two charts were analysed; add another image only if it contains the missing evidence above.") : "Add a clearer lower, upper or higher-timeframe view."}</span></div><div className="psRefineActions"><label>{contextImage ? "CHANGE PHOTO" : "＋ ADD PHOTO"}<input id="psResultSupportInput" disabled={refinementStatus === "analysing"} aria-label="Add another timeframe chart photo" accept="image/jpeg,image/png,image/webp" type="file" onChange={addResultContextFile} /></label><button type="button" disabled={!contextImage || refinementStatus === "analysing"} onClick={reanalyseResult}>{refinementStatus === "analysing" ? "REANALYSING…" : "↻ REANALYSE ALL CHARTS"}</button></div></footer>{refinementStatus === "error" && error ? <p className="psRefineError" role="alert">{error}</p> : null}</section> : null}
          <section id="bullseye-ask" className="psAskBullseye">
            <header><span>💬 ASK BULLSEYE</span><b>USES THIS AUDIT ONLY</b></header>
            <p>Challenge one part of the result without uploading the chart again.</p>
            <div className="psQuickQuestions">{["What am I missing?","Why should I wait?","What would improve this?","Where is the trap?"].map((question) => <button key={question} type="button" disabled={followUpBusy} onClick={() => askBullseye(question)}>{question}</button>)}</div>
            <form onSubmit={(event) => { event.preventDefault(); askBullseye(); }}><input value={followUpQuestion} maxLength={180} onChange={(event) => setFollowUpQuestion(event.target.value)} placeholder="Ask one short question…" aria-label="Ask Bullseye a follow-up question" /><button type="submit" disabled={!followUpQuestion.trim() || followUpBusy}>{followUpBusy ? "THINKING…" : "ASK"}</button></form>
            {followUpError ? <p className="psAskError" role="alert">{followUpError}</p> : null}
            {followUpReply ? <article className="psAskReply"><strong>BULLSEYE ANSWER</strong><p>{followUpReply.answer}</p><ul>{followUpReply.evidence.map((item) => <li key={item}>{item}</li>)}</ul><small>CAUTION · {followUpReply.caution}</small><b>NEXT CHECK · {followUpReply.nextCheck}</b></article> : null}
          </section>

          {correctionOriginal ? <section className="psCorrectionReplaySummary"><header><span>↻ CORRECTION REPLAY ACTIVE</span><strong>ORIGINAL RESULT PRESERVED</strong></header><div><article><small>ORIGINAL</small><b>{correctionOriginal.instrument} · {correctionOriginal.timeframe} · {correctionOriginal.currentPrice || "UNKNOWN"}</b></article><article><small>CORRECTED MAP</small><b>{analysis.instrument} · {analysis.timeframe} · {analysis.currentPrice || "UNKNOWN"}</b></article></div></section> : null}
          <div id="bullseye-feedback" className="psFeedbackTarget"><AccuracyFeedbackPanel analysis={analysis} onApplyCorrection={applyAccuracyCorrection} onReanalyse={reanalyseWithCorrection} reanalysing={busy} /></div>

          <section className="psJournalCta" data-saved={currentDecisionSaved}>
            <div><span>▣ PRIVATE DECISION JOURNAL</span><strong>{currentDecisionSaved ? "RESULT SAVED" : "MAKE THIS RESULT MORE VALUABLE LATER"}</strong><p>{currentDecisionSaved ? "Return with a later chart to compare what happened with the reasoning you locked today." : "Save the chart, evidence and verdict now. Later, Bullseye can grade whether the process was sound without judging it only by profit or loss."}</p></div>
            <button type="button" disabled={currentDecisionSaved} onClick={lockDecision}>{currentDecisionSaved ? "✓ SAVED TO JOURNAL" : "SAVE TO MY JOURNAL"}</button>
            <small>PRIVATE · STORED ON THIS DEVICE · NEVER SHARED WITH OTHER MEMBERS</small>
          </section>

          {vaultMessage ? <p className="psVaultMessage" role="status">{vaultMessage}</p> : null}
          <p className="psLegal">AI can misread screenshots. Confirm instrument, timeframe, prices and levels on the original platform. Educational market preparation only.</p>
          <details className="psUtilityTray">
            <summary><span>RESULT OPTIONS</span><small>{appleAccess?.isNative ? "SAVE · CHART · SHARE" : "SAVE · CHART · SHARE · INVITE"}</small><b>＋</b></summary>
            <div>
              <button type="button" onClick={lockDecision}><i>▣</i><span><strong>SAVE</strong><small>Review this decision later</small></span></button>
              <button type="button" onClick={openChartFocus}><i>⛶</i><span><strong>DECISION MAP</strong><small>Open full screen</small></span></button>
              <button type="button" onClick={shareDecision}><i>↗</i><span><strong>SHARE</strong><small>Decision summary only</small></span></button>
              {appleAccess && !appleAccess.isNative ? <button type="button" onClick={shareFoundingInvite}><i>◎</i><span><strong>INVITE A TRADER</strong><small>Share the Founding 650 link</small></span></button> : null}
            </div>
            <p>Saved decisions stay privately on this device. Shared summaries and invites never include the uploaded screenshot.</p>
          </details>
          </div>}
        </section>
        {chartFocus && (
          <section ref={chartFocusDialog} className="psChartFocus psBattleFocus" aria-modal="true" role="dialog" aria-labelledby="psDecisionMapDialogTitle">
            <header><span id="psDecisionMapDialogTitle">DECISION MAP · {analysis.instrument}</span><button type="button" autoFocus aria-label="Close full-screen Decision Map" onClick={closeChartFocus}>CLOSE</button></header>
            <div className="psBattleFocusBody" ref={chartFocusScroll}>
              {battlefieldTabs}
              <DecisionMap analysis={battlefieldAnalysis} sourceImage={battlefieldChart === "context" ? contextImage : image} expanded scenario={selectedScenario} onScenario={setSelectedScenario} hasContext={Boolean(contextBattlefield)} />
              <details className="psSourceEvidence"><summary>VIEW {battlefieldChart === "context" ? "CONTEXT" : "PRIMARY"} SOURCE CHART <b>⌄</b></summary>{battlefieldChart === "context" ? contextSourceChart(true) : sourceChart(true)}</details>
              <button className="psBattleBackToResult" type="button" onClick={closeChartFocus}>← BACK TO RESULT</button>
            </div>
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
        {showResultCard ? <ResultCard analysis={combinedAnalysis} onClose={() => setShowResultCard(false)} onShare={shareResultCard} /> : null}
        <FeedbackButton />
        {applePaywallStatus ? <AppleSubscriptionPaywall status={applePaywallStatus} onClose={closeApplePaywall} onUnlocked={(next) => { setAppleAccess(next); closeApplePaywall(); }} /> : null}
      </main>
    );
  }

  return (
    <main className="psApp" data-pocket-build="v3.2">
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
        {image && !reviewTarget ? <section className="psEvidencePack">
          <header><div><span>◎ GUIDED EVIDENCE PACK</span><strong>{evidenceImageCount}/4 CHARTS READY</strong></div><b>PRIMARY + OPTIONAL PROOF</b></header>
          <p>Each extra image has one job. Add only views that genuinely reveal more evidence.</p>
          <div>
            <section className="psContextUpload" data-loaded={contextImage ? "true" : "false"}>
              <div><span>② HIGHER TIMEFRAME</span><strong>{contextImage ? "CONTEXT LOADED" : "ADD 1H · 4H · DAILY"}</strong><p>{contextImage ? contextFileName : "Shows the wider trend, major structure and alignment."}</p></div>
              {contextImage ? <button type="button" onClick={() => { setContextImage(null); setContextFileName(""); }}>REMOVE</button> : <label>ADD CHART<input aria-label="Add higher-timeframe chart" accept="image/jpeg,image/png,image/webp" type="file" onChange={loadContextFile} /></label>}
            </section>
            <section className="psContextUpload" data-loaded={detailImage ? "true" : "false"}>
              <div><span>③ CURRENT-PRICE CLOSE-UP</span><strong>{detailImage ? "PRICE DETAIL LOADED" : "ADD CLOSE VIEW"}</strong><p>{detailImage ? detailFileName : "Makes recent candles, reactions and the price scale easier to verify."}</p></div>
              {detailImage ? <button type="button" onClick={() => { setDetailImage(null); setDetailFileName(""); }}>REMOVE</button> : <label>ADD CHART<input aria-label="Add current-price close-up chart" accept="image/jpeg,image/png,image/webp" type="file" onChange={loadDetailFile} /></label>}
            </section>
            <section className="psContextUpload" data-loaded={indicatorImage ? "true" : "false"}>
              <div><span>④ INDICATOR / VOLUME</span><strong>{indicatorImage ? "EXTRA EVIDENCE LOADED" : "ADD IF RELEVANT"}</strong><p>{indicatorImage ? indicatorFileName : "Optional RSI, VWAP, ATR, volume profile or session evidence."}</p></div>
              {indicatorImage ? <button type="button" onClick={() => { setIndicatorImage(null); setIndicatorFileName(""); }}>REMOVE</button> : <label>ADD CHART<input aria-label="Add indicator or volume chart" accept="image/jpeg,image/png,image/webp" type="file" onChange={loadIndicatorFile} /></label>}
            </section>
          </div>
          <footer>Primary chart required · Supporting charts must show the same instrument and decision window.</footer>
        </section> : null}
        {image && !reviewTarget && appleNeedsSubscription ? <p className="psMessage" role="status">Your free analysis is complete. Unlock another analysis through Apple to run a new chart challenge.</p> : null}
        {image && !reviewTarget && <section className="psIntent"><header><span>WHAT ARE YOU CONSIDERING?</span></header><div>{(["LONG","SHORT","UNSURE"] as const).map((value) => <button key={value} type="button" data-active={intention === value} onClick={() => setIntention(value)}>{value === "UNSURE" ? "JUST ANALYSE" : value}</button>)}</div></section>}
        {image && <section className="psAutoPreview"><header><span>SOURCE CHART READY</span><b>AI DECISION MAP NEXT</b></header>{sourceChart()}<p>Bullseye will transform verified prices into a clear Decision Map—without drawing over your screenshot.</p></section>}
        {image && !reviewTarget ? <ChartPreflightPanel image={image} contextImage={contextImage} onStatus={setPreflightStatus} onConfirmation={setChartConfirmation} /> : null}
        <label className="psPrivacy"><input type="checkbox" checked={privacyChecked} onChange={(event) => setPrivacyChecked(event.target.checked)} /><span><strong>PRIVACY SHIELD</strong>I removed my name, account number, balance and notifications.</span></label>
        <p className="psDataNote">Images are sent to our AI provider for this audit. Saved decisions stay in this browser. <a href="/privacy" target="_blank" rel="noreferrer">HOW YOUR CHART IS HANDLED ↗</a></p>
        {error && <p className="psMessage" role="alert">{error}</p>}
        <button className="psAnalyse" data-busy={busy ? "true" : "false"} type="button" disabled={!image || !privacyChecked || busy || (!reviewTarget && !appleNeedsSubscription && !preflightAllowsAnalysis(preflightStatus))} onClick={analyse}><span><strong>{busy ? (reviewTarget ? "COMPARING DECISIONS…" : "MEASURING CHART · CHALLENGING SETUP…") : reviewTarget ? "RUN BEFORE VS AFTER REVIEW" : appleNeedsSubscription ? "UNLOCK ANOTHER ANALYSIS" : preflightStatus === "CHECKING" ? "CHECKING CHART QUALITY…" : "CHALLENGE MY SETUP"}</strong>{busy && !reviewTarget ? <small>MEASURING STRUCTURE · VERIFYING LEVELS · MAPPING RISK</small> : null}</span><b>🎯</b>{busy ? <i aria-hidden="true" /> : null}</button>
        {!reviewTarget ? <section className="psJournalHome" data-empty={!vault.length}>
          <header><div><span>▣ YOUR DECISION JOURNAL</span><strong>{vault.length ? `${vault.length} SAVED AUDIT${vault.length === 1 ? "" : "S"}` : "START YOUR PRIVATE HISTORY"}</strong></div><b>{Math.min(100, vault.length * 10)}<small>% PROFILE BUILT</small></b></header>
          <div className="psJournalLoop"><span><i>1</i>SAVE TODAY&apos;S READ</span><span><i>2</i>RETURN WITH A LATER CHART</span><span><i>3</i>REVIEW THE PROCESS</span></div>
          <p>{vault.length ? "Every saved decision improves your private trader fingerprint and exposes repeated risks." : "Your first saved result begins a private record that becomes more useful each time you return."}</p>
        </section> : null}
        {!reviewTarget && vault.length ? <section className="psFingerprint psFingerprintPro">
          <header><span>🧬 YOUR MISTAKE FINGERPRINT</span><b>{vaultStats.reviewed}/{vaultStats.total} AUTOPSIES</b></header>
          <div><article><small>AVERAGE SETUP</small><strong>{vaultStats.average}/100</strong></article><article><small>PATIENCE RATE</small><strong>{vaultStats.patience}%</strong></article><article><small>DECISION QUALITY</small><strong>{vaultStats.reviewed ? `${vaultStats.averageDecisionQuality}/100` : "—"}</strong></article></div>
          <section className="psFingerprintSignals"><article><small>REPEATED BEHAVIOUR</small><strong>{vaultStats.commonBehaviour}</strong></article><article><small>REPEATED ROOT CAUSE</small><strong>{vaultStats.commonRootCause}</strong></article><article><small>REPEATED RISK WATCH</small><strong>{vaultStats.commonRisk}</strong></article></section>
          <p><strong>BULLSEYE COACH:</strong> {vaultStats.insight}</p>
          <footer>Built only from decisions and later-chart autopsies saved privately on this device. Profit alone never earns a good process grade.</footer>
        </section> : null}
        {!reviewTarget && vault.length ? <section className="psVault"><header><span>SAVED DECISIONS</span><b>PRIVATE · THIS DEVICE</b></header>{vault.slice(0,5).map((decision) => <article key={decision.id}><div><strong>{decision.analysis.instrument}</strong><span>{new Date(decision.createdAt).toLocaleString("en-GB", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })} · {decision.intention}{decision.review ? " · AUTOPSY COMPLETE" : ""}</span></div><b>{decision.review?.processGrade ?? decision.analysis.setupScore.grade}</b><button type="button" onClick={() => startReview(decision)}>{decision.review ? "VIEW DECISION AUTOPSY" : "REVIEW LATER CHART"}</button></article>)}</section> : null}
      </section>
      <FeedbackButton />
      {applePaywallStatus ? <AppleSubscriptionPaywall status={applePaywallStatus} onClose={closeApplePaywall} onUnlocked={(next) => { setAppleAccess(next); closeApplePaywall(); }} /> : null}
    </main>
  );
}
