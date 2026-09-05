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
import { effectiveLiquidityGeometry, projectLiquidityZones, type LiquidityShield } from "./liquidity-guard";
import { numericLevelPrice } from "./level-verification";
import { correctionPatch, type AccuracyFeedback } from "./accuracy-feedback";
import { preflightAllowsAnalysis, type ChartConfirmation, type PreflightStatus } from "./chart-preflight";
import { invalidateDerivedChartEvidence, levelEvidenceSourceLabel, type LevelEvidenceSource } from "./pocket-derived-evidence";
import AppleSubscriptionPaywall from "./AppleSubscriptionPaywall";
import { consumeAppleFreeUse, getAppleAccessStatus, isAppleNativeApp, recordAppleSuccessfulAnalysis, requestAppleReviewIfEligible, type AppleAccessStatus } from "./apple-storekit";
import { postLevelLabScan } from "./level-lab-client";
import { postLiquidityRescan } from "./liquidity-rescan-client";
import { enforcePocketTrustGate } from "../lib/pocket-trust-gate";
import DecisionIntelligenceSuite from "./DecisionIntelligenceSuite";
import { eventCoverageFor, isListedEquityEventInput } from "./event-coverage";
import { measureChart } from "./browser-chart-extractor";
import type { ChartEvidenceRole, DeterministicChartEvidence } from "../lib/deterministic-chart-evidence";
import { POCKET_ANALYSIS_CLIENT_TIMEOUT_MS, pocketAnalysisCountdownLabel, postPocketAnalysis } from "./analysis-request";

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
  patterns: { name: string; sourceRole?: "PRIMARY" | "HIGHER_TIMEFRAME" | "PRICE_DETAIL" | "FOUR_HOUR" | "INDICATOR_VOLUME"; status: "FORMING" | "CONFIRMED" | "FAILED" | "AMBIGUOUS" | "EXTENDED"; timeframe?: string; confidence?: "LOW" | "MEDIUM" | "HIGH"; evidence: string; confirmation?: string; invalidation: string; geometry?: { plotBounds?: { left: number; top: number; right: number; bottom: number }; points: { x: number; y: number }[]; labelX: number; labelY: number } }[];
  nextSequence: { now: string; confirmation: string; failure: string; patience: string; reassess: string };
  missingInputs: string[];
  contextContribution?: { used: boolean; materialChange: boolean; summary: string; resolvedInputs: string[] };
  evidencePack?: {
    received: number;
    contributions: Array<{
      role: "PRIMARY" | "HIGHER_TIMEFRAME" | "PRICE_DETAIL" | "FOUR_HOUR" | "INDICATOR_VOLUME";
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
  liquidityGeometry?: {
    plotBounds?: { left: number; top: number; right: number; bottom: number };
    priceScaleAnchors?: { price: number; y: number }[];
    liquidityShield?: LiquidityShield;
    evidenceQuality?: { chartReadability?: string; candlesReadable?: boolean };
  };
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

function createMeasuredScanImage(dataUrl: string) {
  return new Promise<string | null>((resolve) => {
    const source = new Image();
    source.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = source.naturalWidth;
        canvas.height = source.naturalHeight;
        const context = canvas.getContext("2d");
        if (!context) return resolve(null);
        context.drawImage(source, 0, 0);
        const lineWidth = Math.max(1, Math.round(canvas.width / 800));
        const fontSize = Math.max(11, Math.round(canvas.width * .018));
        context.save();
        context.lineWidth = lineWidth;
        context.font = `700 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        context.textBaseline = "middle";
        for (let percent = 5; percent < 100; percent += 5) {
          const y = Math.round(canvas.height * percent / 100);
          context.strokeStyle = percent % 10 === 0 ? "rgba(0, 229, 255, .34)" : "rgba(0, 229, 255, .18)";
          context.beginPath(); context.moveTo(0, y); context.lineTo(canvas.width, y); context.stroke();
          if (percent % 10 === 0) {
            const label = `Y${String(percent).padStart(2, "0")}`;
            const width = context.measureText(label).width + 8;
            context.fillStyle = "rgba(0, 12, 18, .78)"; context.fillRect(0, y - fontSize * .7, width, fontSize * 1.4);
            context.fillStyle = "rgba(194, 250, 255, .98)"; context.fillText(label, 4, y);
          }
        }
        for (let percent = 10; percent < 100; percent += 10) {
          const x = Math.round(canvas.width * percent / 100);
          context.strokeStyle = "rgba(0, 229, 255, .18)";
          context.beginPath(); context.moveTo(x, 0); context.lineTo(x, canvas.height); context.stroke();
        }
        context.restore();
        const encoded = canvas.toDataURL("image/jpeg", .9);
        resolve(encoded.length <= MAX_PROVIDER_SCAN_DATA_URL_CHARS ? encoded : null);
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
  // The first 42% is reserved for the intrinsic intro and intelligence strip;
  // the final 22% is reserved for direction/scenario controls.
  const mapTop = 42;
  const mapSpan = 36;
  const position = (price: number) => mapTop + ((max - price) / (max - min)) * mapSpan;
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
  // The evidence list retains every verified level. The compact visual map
  // shows a collision-free subset so nearby primary/context prices and the
  // current-price badge cannot cover one another on an iPhone-sized screen.
  const mapLevels = [nearestResistance, nearestSupport, ...ordered]
    .filter((level): level is typeof ordered[number] => Boolean(level))
    .filter((level, index, all) => all.findIndex((candidate) => candidate.kind === level.kind && candidate.numericPrice === level.numericPrice && candidate.source === level.source) === index)
    .reduce<typeof ordered>((visible, level) => {
      const y = position(level.numericPrice);
      if (Math.abs(y - currentY) < 8 || visible.some((candidate) => Math.abs(position(candidate.numericPrice) - y) < 8)) return visible;
      return visible.length < 4 ? [...visible, level] : visible;
    }, [])
    .sort((left, right) => right.numericPrice - left.numericPrice);
  const priceDecimals = values.some((value) => Math.abs(value - Math.round(value)) > .001) ? 2 : 0;
  const scaleTicks = Array.from({ length: 7 }, (_, index) => {
    const fraction = index / 6;
    return { price: max - (max - min) * fraction, top: mapTop + mapSpan * fraction };
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
      <article data-tone="support"><span>TO SUPPORT</span><strong>{nearestSupport ? formatDistance(supportDistance) : "NOT VERIFIED"}</strong><small>{nearestSupport ? `${nearestSupport.price} · ${formatPercent(supportDistance)}` : "CLEARER VIEW NEEDED"}</small></article>
      <article data-tone="location"><span>MARKET LOCATION</span><strong>{proximity}</strong><small>{analysis.timeframe}</small></article>
      <article data-tone="resistance"><span>TO RESISTANCE</span><strong>{nearestResistance ? formatDistance(resistanceDistance) : "NOT VERIFIED"}</strong><small>{nearestResistance ? `${nearestResistance.price} · ${formatPercent(resistanceDistance)}` : "CLEARER VIEW NEEDED"}</small></article>
    </div>
    <div className="psBattleScan" aria-hidden="true" />
    <div className="psBattleAxis" aria-hidden="true"><i /><i /><i /></div>
    {current !== null && verified.length ? <svg className="psBattleRoutes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {nearestResistance ? <path data-route="bull" d={`M 50 ${currentY} C 68 ${currentY - 4}, 67 ${resistanceY + 6}, 82 ${resistanceY}`} /> : null}
      {nearestSupport ? <path data-route="bear" d={`M 50 ${currentY} C 32 ${currentY + 4}, 33 ${supportY - 5}, 18 ${Math.min(93, supportY + 7)}`} /> : null}
    </svg> : null}
    {nearestResistance ? <div className="psRouteCue psRouteBull" style={{ top: `${Math.max(16, resistanceY + 4)}%` }}><b>↗</b><span>RECLAIM ROUTE</span></div> : null}
    {nearestSupport ? <div className="psRouteCue psRouteBear" style={{ top: `${Math.min(87, supportY + 7)}%` }}><b>↘</b><span>BREAK ROUTE</span></div> : null}
    {mapLevels.map((level, index) => <button key={`${level.kind}-${level.numericPrice}-${index}`} type="button" className="psBattleLevel" data-kind={level.kind} data-source={level.source ?? "PRIMARY"} style={{ top: `${position(level.numericPrice)}%` }} aria-label={`${level.kind} at ${level.price} from the ${levelEvidenceSourceLabel(level.source).toLowerCase()}`}>
      <span className="psBattleIcon">{level.kind === "support" ? "●" : level.kind === "resistance" ? "●" : "◆"}</span>
      <i /><strong>{level.price}</strong><small>{level.kind === "pivot" ? "SWING REFERENCE" : level.kind.toUpperCase()} · {levelEvidenceSourceLabel(level.source)}</small><em>{current === null ? "" : formatPercent(Math.abs(level.numericPrice - current))}</em>
    </button>)}
    {current !== null ? <div className="psBattleCurrent" style={{ top: `${position(current)}%` }}><i /><span><b>◎</b> CURRENT</span><strong>{analysis.currentPrice}</strong></div> : null}
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

function patternStatusMeaning(status: Analysis["patterns"][number]["status"]) {
  if (status === "CONFIRMED") return "REACTION CONFIRMED";
  if (status === "FAILED") return "PATTERN FAILED";
  if (status === "EXTENDED") return "MOVE ALREADY MATURE";
  if (status === "AMBIGUOUS") return "NO CLEAN READ YET";
  return "WAITING FOR HOLD / REJECTION";
}

function patternOverlayTitle(pattern: Analysis["patterns"][number]) {
  return /BREAK(?:OUT|DOWN).*RETEST/i.test(pattern.name)
    ? "BREAK + RETEST CHECK"
    : pattern.name;
}

function macroEventDisplayName(name: string) {
  return name === "Employment Situation"
    ? "US JOBS REPORT · NFP + UNEMPLOYMENT + WAGES"
    : name;
}

function ChartXRay({ analysis, primaryLevels, sourceImage, onAddChart, onReanalyse, hasContext, reanalysing }: { analysis: Analysis; primaryLevels: Level[]; sourceImage: string; onAddChart: (event: ChangeEvent<HTMLInputElement>) => void; onReanalyse: () => void; hasContext: boolean; reanalysing: boolean }) {
  const [layer] = useState<XRayLayer>("patterns");
  const normalizeFrame = (value: string | undefined) => (value ?? "").toUpperCase().replace(/MIN(?:UTE)?S?/g, "M").replace(/HOUR(?:S)?/g, "H").replace(/[^A-Z0-9]/g, "");
  const primaryFrame = normalizeFrame(analysis.timeframe);
  const drawablePatterns = analysis.patterns.filter((pattern) => (pattern.sourceRole ?? "PRIMARY") === "PRIMARY"
    && normalizeFrame(pattern.timeframe) === primaryFrame
    && (pattern.geometry?.points?.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)).length ?? 0) >= 2);
  // X-Ray is drawn over the primary image. Context-only levels may corroborate
  // a primary price, but must never corroborate themselves or inherit geometry
  // from another crop.
  const verifiedLevels = primaryLevels.filter((item) => numericLevel(item.price) !== null && ["support", "resistance", "pivot"].includes(item.kind));
  const drawableLevels = primaryLevels.filter((item) => ["support", "resistance"].includes(item.kind)
    && [item.x, item.y, item.x2, item.y2].every(Number.isFinite));
  const swingLevels = primaryLevels.filter((item) => item.kind === "pivot"
    && [item.x, item.y].every(Number.isFinite));
  const numericLevels: NumericChartLevel[] = verifiedLevels.map((item) => ({ kind: item.kind as NumericChartLevel["kind"], label: item.label, price: numericLevel(item.price)! }));
  const contextLevels: NumericChartLevel[] = (analysis.combinedBattlefield?.contextCompatible ? analysis.contextBattlefield?.levels ?? [] : []).filter((item) => numericLevel(item.price) !== null && ["support", "resistance", "pivot"].includes(item.kind)).map((item) => ({ kind: item.kind as NumericChartLevel["kind"], label: item.label, price: numericLevel(item.price)! }));
  const current = numericLevel(analysis.currentPrice ?? "");
  const rankedLevels = rankChartLevels(numericLevels, current, contextLevels, analysis.evidenceQuality.scaleReadable);
  const rsiMatch = analysis.momentum.match(/RSI[^0-9]{0,18}(\d{1,3}(?:\.\d+)?)/i);
  const rsi = rsiMatch ? Math.max(0, Math.min(100, Number(rsiMatch[1]))) : null;
  const formatPrice = (value: number) => new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(value);
  return <section className="psChartXRay" data-layer={layer}>
    <header><div><span>⌖ BULLSEYE PATTERN X-RAY</span><small>VISIBLE FORMATIONS · DRAWN ON YOUR CHART</small></div><strong>1 FOCUSED TOOL</strong></header>
    <div className="psXRayCanvas"><img src={sourceImage} alt="Customer's uploaded source chart with verified Bullseye X-Ray overlays"/><div className="psXRayShade"/><div className="psXRayScan" aria-hidden="true"/>
      {layer === "patterns" ? <><svg className="psXRayPatterns" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Visible historical candle-shape evidence; not a price forecast">{drawablePatterns.flatMap((pattern, index) => {
        const points = pattern.geometry?.points?.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)) ?? [];
        if (points.length < 2) return [];
        const path = points.map((point) => `${point.x},${point.y}`).join(" ");
        return [<g key={`${pattern.name}-${index}`} data-status={pattern.status} data-confidence={pattern.confidence ?? "LOW"} data-pattern={/BREAK(?:OUT|DOWN).*RETEST/i.test(pattern.name) ? "break-retest" : "structure"}><polyline points={path} vectorEffect="non-scaling-stroke"/>{points.map((point, pointIndex) => <circle key={`${point.x}-${point.y}-${pointIndex}`} cx={point.x} cy={point.y} r={pointIndex === points.length - 1 ? "1.35" : ".72"} vectorEffect="non-scaling-stroke"/>)}</g>];
      })}</svg><div className="psXRayTraceKey"><i />VISIBLE HISTORY <b>NOT A FORECAST</b></div><div className="psXRayPatternLabels">{drawablePatterns.map((pattern, index) => { const points = pattern.geometry!.points; const left = Math.min(64, Math.max(3, pattern.geometry?.labelX ?? points[0].x)); const top = Math.min(82, Math.max(10, pattern.geometry?.labelY ?? points[0].y)); return <span key={`${pattern.name}-label-${index}`} data-status={pattern.status} style={{ left: `${left}%`, top: `${top}%` }}><small>{patternOverlayTitle(pattern)}</small><strong>{patternStatusMeaning(pattern.status)}</strong><b>{pattern.status === "FORMING" || pattern.status === "AMBIGUOUS" ? "UNCONFIRMED" : pattern.status}</b></span>; })}</div></> : null}
      {layer === "levels" ? <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Verified chart level overlay">{drawableLevels.map((item, index) => <g key={`${item.kind}-${item.label}-${index}`} data-kind={item.kind}><line x1={item.x} y1={item.y} x2={item.x2} y2={item.y2} vectorEffect="non-scaling-stroke"/><circle cx={item.x} cy={item.y} r="1.15" vectorEffect="non-scaling-stroke"/><text x={Math.min(82, Math.max(3, item.x + 2))} y={Math.min(96, Math.max(5, item.y - 2))}>{numericLevel(item.price) !== null ? item.price : item.label}</text></g>)}</svg> : null}
      {layer === "swings" ? <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Detected swing high and low overlay">{swingLevels.map((item, index) => <g key={`${item.label}-${index}`} data-kind="pivot"><circle cx={item.x} cy={item.y} r="2" vectorEffect="non-scaling-stroke"/><line x1={Math.max(1, item.x - 4)} y1={item.y} x2={Math.min(99, item.x + 4)} y2={item.y} vectorEffect="non-scaling-stroke"/><text x={Math.min(78, Math.max(3, item.x + 3))} y={Math.min(96, Math.max(6, item.y - 3))}>{item.label || "SWING"}</text></g>)}</svg> : null}
      {layer === "fib" ? <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Fibonacci retracement overlay">{analysis.fibLevels.map((item, index) => <g key={`${item.ratio}-${index}`} data-kind="fib"><line x1="5" y1={item.y} x2="95" y2={item.y} vectorEffect="non-scaling-stroke"/><text x="6" y={Math.min(97, Math.max(5, item.y - 1.5))}>{item.ratio} · {item.price}</text></g>)}</svg> : null}
      {layer === "rsi" ? <div className="psXRayRsi" data-state={rsi === null ? "unverified" : rsi >= 70 ? "hot" : rsi <= 30 ? "cold" : "balanced"}><small>VISIBLE RSI</small><strong>{rsi === null ? "—" : Math.round(rsi)}</strong><span>{rsi === null ? "NOT SHOWN ON CHART" : rsi >= 70 ? "OVERBOUGHT AREA" : rsi <= 30 ? "OVERSOLD AREA" : "MID-RANGE"}</span><i><b style={{ width: `${rsi ?? 50}%` }}/></i></div> : null}
      <span className="psXRaySource">● SOURCE CHART</span><span className="psXRayLayerTag">{layer.toUpperCase()} LAYER</span></div>
    <div className="psXRayCounts psPatternOnlyCounts" aria-label="Pattern X-Ray summary"><article data-tone="verified"><strong>{drawablePatterns.filter((item) => item.confidence === "HIGH").length}</strong><span>HIGH-CONFIDENCE</span></article><article data-tone="uncertain"><strong>{drawablePatterns.length}</strong><span>VISIBLE PATTERNS</span></article><article data-tone="missing"><strong>{drawablePatterns.filter((item) => item.status === "FORMING" || item.status === "AMBIGUOUS").length}</strong><span>NEEDS CONFIRMING</span></article></div>
    <article className="psXRayRead" aria-live="polite">
      {layer === "patterns" ? <><small>PATTERN SCAN · VISIBLE GEOMETRY ONLY</small>{drawablePatterns.length ? <><p className="psXRayPlainNote">The line joins swings already visible on your screenshot. It never predicts where price goes next.</p><div className="psPatternXRayRead">{drawablePatterns.map((pattern) => <section key={`${pattern.name}-${pattern.status}`} data-status={pattern.status}><div><strong>{patternOverlayTitle(pattern)}</strong><b>{patternStatusMeaning(pattern.status)}</b></div><p>{pattern.evidence}</p><span>ONLY CONFIRMS IF · {pattern.confirmation}</span></section>)}</div></> : <div className="psToolkitEmpty"><strong>NO CLEAN PATTERN VISIBLE</strong><p>This chart does not contain enough defensible geometry for a gallery pattern.</p><span>Try a wider 30m, 1h or 4h chart showing more candles.</span></div>}</> : null}
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
    return price !== null && ["support", "resistance", "pivot"].includes(level.kind) ? [{ kind: level.kind as NumericChartLevel["kind"], label: level.label, price, source: level.source }] : [];
  }), numericLevel(analysis.currentPrice), [], analysis.evidenceQuality.scaleReadable);
  const storyHasTwoSidedStructure = hasVerifiedTwoSidedStructure(
    verifiedLevels.map((level) => ({ kind: level.kind, label: level.label, price: level.price })),
    numericLevel(analysis.currentPrice),
  );
  const storyLevels = verifiedLevels;
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
        {scene === 2 ? <article className="psStoryLevels"><small>CHAPTER 03 · THE PRICE BATTLEFIELD</small><h2>{storyHasTwoSidedStructure ? `${storyLevels.length} level${storyLevels.length === 1 ? "" : "s"} bracket current price.` : storyLevels.length ? `${storyLevels.length} exact level${storyLevels.length === 1 ? " is" : "s are"} verified; the opposite side is still missing.` : "Two-sided levels remain unverified."}</h2><div>{analysis.currentPrice ? <span><small>CURRENT · PRIMARY CHART</small><b>{analysis.currentPrice}</b></span> : null}{storyLevels.slice(0, 3).map((level) => <span key={`${level.kind}-${level.price}`} data-kind={level.kind} data-source={level.source ?? "PRIMARY"}><small>{level.kind.toUpperCase()} · {levelEvidenceSourceLabel(level.source)}</small><b>{level.price}</b></span>)}</div><p>{analysis.levelStory}</p><button type="button" onClick={() => openExplanation("bullseye-levels")}>EXPLORE PRICE LEVELS ↓</button></article> : null}
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

const PATTERN_FRAMES = ["30M", "1H", "4H"] as const;
type PatternFrame = typeof PATTERN_FRAMES[number];

function normalizePatternFrame(value: string | undefined): PatternFrame | null {
  const compact = (value ?? "")
    .toUpperCase()
    .replace(/MINUTES?|MINS?/g, "M")
    .replace(/HOURS?|HRS?/g, "H")
    .replace(/[^A-Z0-9]/g, "");
  if (compact.startsWith("30M") || compact.startsWith("M30")) return "30M";
  if (compact.startsWith("1H") || compact.startsWith("H1")) return "1H";
  if (compact.startsWith("4H") || compact.startsWith("H4")) return "4H";
  return null;
}

function PatternWatch({ analysis, onAddChart, onReanalyse, hasContext, reanalysing }: { analysis: Analysis; onAddChart: (event: ChangeEvent<HTMLInputElement>) => void; onReanalyse: () => void; hasContext: boolean; reanalysing: boolean }) {
  const [guideOpen, setGuideOpen] = useState(true);
  const [selectedGuide, setSelectedGuide] = useState<string>(PATTERN_GUIDE[0].name);
  const [selectedFrame, setSelectedFrame] = useState<PatternFrame>(() => normalizePatternFrame(analysis.timeframe) ?? "4H");
  const [requestedFrame, setRequestedFrame] = useState<PatternFrame | null>(null);
  const timeframeInput = useRef<HTMLInputElement>(null);
  const suppliedFrames = useMemo(() => PATTERN_FRAMES.filter((frame) => [analysis.timeframe, analysis.higherTimeframe.provided ? analysis.higherTimeframe.timeframe : "", ...analysis.patterns.map((pattern) => pattern.timeframe ?? "")].some((value) => normalizePatternFrame(value) === frame)), [analysis.timeframe, analysis.higherTimeframe.provided, analysis.higherTimeframe.timeframe, analysis.patterns]);
  const primaryFrame = normalizePatternFrame(analysis.timeframe);
  const activeFrame = suppliedFrames.includes(selectedFrame) ? selectedFrame : primaryFrame && suppliedFrames.includes(primaryFrame) ? primaryFrame : suppliedFrames[0] ?? "4H";
  const visiblePatterns = analysis.patterns.filter((pattern) => normalizePatternFrame(pattern.timeframe || analysis.timeframe) === activeFrame);
  const contextPending = hasContext && !analysis.higherTimeframe.provided;
  const selectFrame = (frame: PatternFrame) => {
    if (suppliedFrames.includes(frame)) {
      setSelectedFrame(frame);
      setRequestedFrame(null);
      return;
    }
    setRequestedFrame(frame);
    timeframeInput.current?.click();
  };
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
    <div className="psPatternFrames" role="tablist" aria-label="Choose Pattern Watch timeframe">{PATTERN_FRAMES.map((frame) => {
      const supplied = suppliedFrames.includes(frame);
      return <button key={frame} type="button" role="tab" data-supplied={supplied} data-active={supplied && activeFrame === frame} aria-selected={supplied && activeFrame === frame} aria-label={supplied ? `Show ${frame} pattern analysis` : `Add a ${frame} chart`} onClick={() => selectFrame(frame)}>{frame}<small>{supplied ? activeFrame === frame ? "VIEWING" : "CHART READ" : "+ ADD CHART"}</small></button>;
    })}</div>
    <input ref={timeframeInput} className="psPatternFrameInput" type="file" accept="image/jpeg,image/png,image/webp" aria-label={`Add ${requestedFrame ?? "another"} timeframe chart`} onChange={onAddChart}/>
    {contextPending ? <div className="psPatternFrameAction" role="status"><span>{requestedFrame ?? "TIMEFRAME"} PHOTO READY</span><button type="button" disabled={reanalysing} onClick={onReanalyse}>{reanalysing ? "ANALYSING…" : "↻ REANALYSE TIMEFRAMES"}</button></div> : null}
    {visiblePatterns.length ? <div className="psPatternSignals" role="tabpanel" aria-label={`${activeFrame} pattern analysis`}>{visiblePatterns.map((pattern, index) => <article key={`${pattern.name}-${pattern.sourceRole ?? "PRIMARY"}-${index}`} data-status={pattern.status} data-confidence={pattern.confidence ?? "LOW"}><header><div><small>{pattern.timeframe || activeFrame} · {(pattern.sourceRole ?? "PRIMARY").replaceAll("_", " ")} · {pattern.confidence ?? "LOW"} CONFIDENCE</small><strong>{pattern.name}</strong></div><b>{pattern.status}</b></header><p>{pattern.evidence}</p><div><span>CONFIRMS IF</span><strong>{pattern.confirmation || "The visible boundary breaks and holds."}</strong></div><div><span>INVALID IF</span><strong>{pattern.invalidation}</strong></div><button type="button" onClick={() => selectGuide(pattern.name)}>WHAT DOES THIS MEAN? →</button></article>)}</div> : <div className="psPatternNone" role="tabpanel" aria-label={`${activeFrame} pattern analysis`}><strong>NO SIGNIFICANT {activeFrame} PATTERN VERIFIED</strong><p>None of the supplied images currently shows a clean named formation on this timeframe. Bullseye will not force a label onto ordinary price noise.</p></div>}
    {guideOpen ? <div className="psPatternGuide"><nav aria-label="Choose a chart pattern">{PATTERN_GUIDE.map((item) => <button key={item.name} type="button" data-active={selected.name === item.name} onClick={() => setSelectedGuide(item.name)}>{item.name}</button>)}</nav><article><header><div><small>{selected.family}</small><strong>{selected.name}</strong></div><svg viewBox="0 0 100 100" aria-hidden="true"><polyline points={selected.path}/><line x1="5" y1="76" x2="95" y2="76"/></svg></header><dl><div><dt>LOOK FOR</dt><dd>{selected.look}</dd></div><div><dt>CONFIRMATION</dt><dd>{selected.confirms}</dd></div><div><dt>COMMON TRAP</dt><dd>{selected.trap}</dd></div></dl><footer>A shape is not a signal by itself. Wait for the stated boundary or neckline confirmation.</footer></article></div> : null}
  </section>;
}

type CommandDeckMode = "xray" | "guard" | "patterns" | "scenarios" | "plan" | "risk" | "pulse";
type RiskCurrency = "GBP" | "USD" | "EUR";
type StoredRiskDesk = RiskDeskInput & { currency: RiskCurrency; version: 1 };
const COMMAND_DECK_MODES: ReadonlyArray<{ id: CommandDeckMode; number: string; label: string; detail: string }> = [
  { id: "xray", number: "01", label: "CHART X-RAY", detail: "SOURCE AUDIT" },
  { id: "guard", number: "02", label: "LIQUIDITY GUARD", detail: "STOP-CLUSTER MAP" },
  { id: "patterns", number: "03", label: "PATTERNS", detail: "FORMING SIGNALS" },
  { id: "scenarios", number: "04", label: "SCENARIOS", detail: "IF / THEN PATHS" },
  { id: "plan", number: "05", label: "PLAN", detail: "CLARITY LOCK" },
  { id: "risk", number: "06", label: "RISK", detail: "PERSONAL LIMITS" },
  { id: "pulse", number: "07", label: "SIGNAL PULSE", detail: "LIVE FORMATION" },
];

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

function PocketCommandDeck({ analysis, primaryLevels, sourceImage, onResultCard, onAddChart, onReanalyse, onLiquidityRescan, liquidityError, hasContext, reanalysing, liquidityRescanning, mode, onMode }: { analysis: Analysis; primaryLevels: Level[]; sourceImage: string; onResultCard: () => void; onAddChart: (event: ChangeEvent<HTMLInputElement>) => void; onReanalyse: () => void; onLiquidityRescan: () => void; liquidityError: string; hasContext: boolean; reanalysing: boolean; liquidityRescanning: boolean; mode: CommandDeckMode; onMode: (mode: CommandDeckMode) => void }) {
  return <section id="bullseye-evidence" className="psCommandDeck">
    <header><div><span>◎ POCKET BULLSEYE 2.0</span><strong>SCAN. UNDERSTAND. PLAN. REVIEW.</strong></div><b>COMMAND DECK</b></header>
    <nav aria-label="Pocket Bullseye command deck">{COMMAND_DECK_MODES.map((item) => <button key={item.id} type="button" data-active={mode === item.id} aria-pressed={mode === item.id} onClick={() => onMode(item.id)}><i>{item.number}</i><span>{item.label}</span><small>{item.detail}</small></button>)}</nav>
    <div className="psCommandStage" data-mode={mode}>
      {mode === "xray" ? <ChartXRay analysis={analysis} primaryLevels={primaryLevels} sourceImage={sourceImage} onAddChart={onAddChart} onReanalyse={onReanalyse} hasContext={hasContext} reanalysing={reanalysing} /> : null}
      {mode === "guard" ? <LiquidityGuardOverlay analysis={analysis} sourceImage={sourceImage} onRescan={onLiquidityRescan} rescanning={liquidityRescanning} errorMessage={liquidityError} /> : null}
      {mode === "patterns" ? <PatternWatch analysis={analysis} onAddChart={onAddChart} onReanalyse={onReanalyse} hasContext={hasContext} reanalysing={reanalysing} /> : null}
      {mode === "scenarios" ? <ScenarioTheatre analysis={analysis} sourceImage={sourceImage} /> : null}
      {mode === "plan" ? <><ClarityLock analysis={analysis} /><BullseyePlan analysis={analysis} onResultCard={onResultCard} /></> : null}
      {mode === "risk" ? <RiskDesk /> : null}
      {mode === "pulse" ? <SignalPulse analysis={analysis} /> : null}
    </div>
    <footer><span>Every mode stays evidence-first. Scenario graphics are conditional illustrations; risk figures come only from your inputs.</span></footer>
  </section>;
}

function CoreScanSummary({ analysis, todayMacroCount, nextHighImpactLabel, macroAvailable, onOpenTool, onOpenMacro }: { analysis: Analysis; todayMacroCount: number; nextHighImpactLabel: string | null; macroAvailable: boolean; onOpenTool: (mode: "guard" | "patterns") => void; onOpenMacro: () => void }) {
  const effectiveLiquidity = effectiveLiquidityGeometry(analysis);
  const liquidityZones = projectLiquidityZones(
    effectiveLiquidity.liquidityShield,
    analysis.currentPrice,
    effectiveLiquidity.priceScaleAnchors,
    effectiveLiquidity.plotBounds,
    effectiveLiquidity.evidenceQuality,
  );
  const liquidityState = liquidityZones.length
    ? { state: "found", badge: `${liquidityZones.length} FOUND`, title: `${liquidityZones.length} VISIBLE STOP-RISK ${liquidityZones.length === 1 ? "ZONE" : "ZONES"}`, detail: effectiveLiquidity.liquidityShield?.summary || "Scale-checked candle reactions were found and marked on the uploaded chart." }
    : effectiveLiquidity.liquidityShield?.status === "NO_VISIBLE_RISK_ZONES"
      ? { state: "clear", badge: "SCAN COMPLETE", title: "NO CLEAR LIQUIDITY CLUSTER", detail: "The chart was checked, but no defensible repeated stop-risk cluster was visible." }
      : { state: "withheld", badge: "NOT VERIFIED", title: "LIQUIDITY OVERLAY WITHHELD", detail: effectiveLiquidity.liquidityShield?.summary || "The chart or price scale was not precise enough to mark a zone safely." };
  const patternConfidenceRank = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
  const strongestPattern = [...analysis.patterns].sort((left, right) => patternConfidenceRank[left.confidence ?? "LOW"] - patternConfidenceRank[right.confidence ?? "LOW"])[0];
  const patternState = strongestPattern
    ? { state: "found", badge: `${analysis.patterns.length} FOUND`, title: strongestPattern.name, detail: `${strongestPattern.timeframe || analysis.timeframe} · ${strongestPattern.status} · ${strongestPattern.confidence ?? "LOW"} confidence` }
    : { state: "clear", badge: "SCAN COMPLETE", title: "NO CLEAN PATTERN VERIFIED", detail: "Every uploaded chart was checked. Bullseye did not force a gallery name onto ordinary price noise." };
  const macroState = !macroAvailable
    ? { state: "withheld", badge: "CHECK SOURCE", title: "MACRO SCHEDULE UNAVAILABLE", detail: "Connected calendar sources could not be confirmed. Treat event risk as unknown." }
    : nextHighImpactLabel
      ? { state: "warning", badge: "HIGH IMPACT", title: nextHighImpactLabel, detail: `${todayMacroCount} macro ${todayMacroCount === 1 ? "event" : "events"} listed today in UK time.` }
      : { state: "clear", badge: "LIVE CHECK", title: todayMacroCount ? `${todayMacroCount} MACRO ${todayMacroCount === 1 ? "EVENT" : "EVENTS"} TODAY` : "NO RELEASE LISTED TODAY", detail: todayMacroCount ? "Open Macro Check for times, impact and source details." : "No medium or high-impact US release is listed today; unscheduled news can still move price." };

  return <section className="psCoreScans" aria-label="Core AI scan results">
    <header><div><span>◎ CORE AI CHECKS</span><strong>LIQUIDITY · PATTERNS · MACRO</strong></div><b>ALWAYS VISIBLE</b></header>
    <div>
      <button type="button" data-scan="liquidity" data-state={liquidityState.state} onClick={() => onOpenTool("guard")}><small>LIQUIDITY GUARD</small><b>{liquidityState.badge}</b><strong>{liquidityState.title}</strong><span>{liquidityState.detail}</span><em>OPEN MAP →</em></button>
      <button type="button" data-scan="patterns" data-state={patternState.state} onClick={() => onOpenTool("patterns")}><small>PATTERN SCAN</small><b>{patternState.badge}</b><strong>{patternState.title}</strong><span>{patternState.detail}</span><em>OPEN PATTERN FINDER →</em></button>
      <button type="button" data-scan="macro" data-state={macroState.state} onClick={onOpenMacro}><small>MACRO CHECK</small><b>{macroState.badge}</b><strong>{macroState.title}</strong><span>{macroState.detail}</span><em>OPEN EVENT TIMES →</em></button>
    </div>
    <footer>The chart supplies technical evidence. Macro Check refreshes separately from connected schedules because future events cannot be read from a chart picture.</footer>
  </section>;
}

function ResultCard({ analysis, onClose, onShare }: { analysis: Analysis; onClose: () => void; onShare: () => void }) {
  const numeric = numericStructure(analysis.levels);
  const verified = hasVerifiedTwoSidedStructure(numeric, numericLevel(analysis.currentPrice))
    ? analysis.levels.filter((level) => numericLevel(level.price) !== null && ["support", "resistance", "pivot"].includes(level.kind)).slice(0, 3)
    : [];
  return <section className="psResultCardModal" role="dialog" aria-modal="true" aria-label="Shareable Pocket Bullseye result card">
    <div className="psShareCard">
      <header><span>🎯 POCKET BULLSEYE</span><button type="button" onClick={onClose} aria-label="Close result card">×</button></header>
      <div className="psShareIdentity"><small>PRIVATE DECISION AUDIT</small><strong>{analysis.instrument}</strong><span>{analysis.timeframe}</span></div>
      <div className="psShareScore"><strong>{analysis.setupScore.grade}</strong><div><span>{analysis.setupScore.overall}<small>/100</small></span><b data-direction={analysis.direction}>{analysis.direction}</b><em>{analysis.verdict.replaceAll("_", " ")}</em></div></div>
      <h2>{analysis.verdictHeadline}</h2>
      {verified.length ? <div className="psShareLevels">{verified.map((level, index) => <article key={`${level.kind}-${level.price}-${index}`} data-kind={level.kind} data-source={level.source ?? "PRIMARY"}><small>{level.kind.toUpperCase()} · {levelEvidenceSourceLabel(level.source)}</small><strong>{level.price}</strong></article>)}</div> : null}
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

const POCKET_ANALYSIS_ENGINE_VERSION = 14 as const;
const POCKET_ANALYSIS_CACHE_TTL_MS = 15 * 60 * 1000;
type CachedAnalysis = { key: string; analysis: Analysis; createdAt: string; version: typeof POCKET_ANALYSIS_ENGINE_VERSION };

function hasVerifiedTwoSidedAnalysis(analysis: Analysis, contextProvided: boolean) {
  const combined = contextProvided
    && analysis.higherTimeframe.alignment !== "CONFLICTING"
    && analysis.combinedBattlefield?.contextCompatible
      ? analysis.combinedBattlefield
      : null;
  const currentPrice = numericLevel(combined?.currentPrice ?? analysis.currentPrice);
  const levels = combined ? numericStructure(combined.levels) : numericStructure(analysis.levels);
  return analysis.trustGate?.status === "LOCKED"
    && derivedTrustGate(analysis).status === "LOCKED"
    && hasVerifiedTwoSidedStructure(levels, currentPrice);
}

async function analysisCacheKey(image: string, contextImage: string | null, detailImage: string | null, fourHourImage: string | null, indicatorImage: string | null, confirmation: ChartConfirmation | null = null, correction: AccuracyFeedback | null = null) {
  const bytes = new TextEncoder().encode(`pocket-analysis-v${POCKET_ANALYSIS_ENGINE_VERSION}\n${JSON.stringify(confirmation)}\n${JSON.stringify(correction)}\n${image}\n${contextImage ?? ""}\n${detailImage ?? ""}\n${fourHourImage ?? ""}\n${indicatorImage ?? ""}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function analysisCacheGet(key: string): Promise<Analysis | null> {
  const db = await openVault();
  return new Promise((resolve, reject) => {
    const request = db.transaction("analyses", "readonly").objectStore("analyses").get(key);
    request.onsuccess = () => {
      const cached = request.result as CachedAnalysis | undefined;
      const createdAt = cached ? Date.parse(cached.createdAt) : Number.NaN;
      const ageMs = Date.now() - createdAt;
      const fresh = Number.isFinite(createdAt) && ageMs >= 0 && ageMs < POCKET_ANALYSIS_CACHE_TTL_MS;
      resolve(cached?.version === POCKET_ANALYSIS_ENGINE_VERSION && fresh ? cached.analysis : null);
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
  // Decode and bound the upload once, while the picker action is still in
  // progress. Keeping an original multi-megapixel data URL in React state and
  // allocating a second canvas only after Analyse can terminate WKWebView
  // before the network request is sent. The provider frame remains large
  // enough to preserve chart labels, candles and the visible price scale.
  const original = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const prepared = await createProviderScanImage(original, true);
  if (!prepared) throw new Error("The chart could not be prepared within the secure mobile upload limit.");
  return prepared;
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
  const [eventContext, setEventContext] = useState<VerifiedMacroContext>(macroContext);
  const [eventClock, setEventClock] = useState({ now: 0, iso: "1970-01-01T00:00:00.000Z" });
  const [marketEvents, setMarketEvents] = useState<SupplementalMarketEvent[]>([]);
  const [image, setImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [contextImage, setContextImage] = useState<string | null>(null);
  const [contextFileName, setContextFileName] = useState("");
  const [detailImage, setDetailImage] = useState<string | null>(null);
  const [detailFileName, setDetailFileName] = useState("");
  const [fourHourImage, setFourHourImage] = useState<string | null>(null);
  const [fourHourFileName, setFourHourFileName] = useState("");
  const [indicatorImage, setIndicatorImage] = useState<string | null>(null);
  const [indicatorFileName, setIndicatorFileName] = useState("");
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [preflightStatus, setPreflightStatus] = useState<PreflightStatus>("IDLE");
  const [chartConfirmation, setChartConfirmation] = useState<ChartConfirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const [analysisSecondsRemaining, setAnalysisSecondsRemaining] = useState(Math.ceil(POCKET_ANALYSIS_CLIENT_TIMEOUT_MS / 1000));
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
  const [liquidityRescanning, setLiquidityRescanning] = useState(false);
  const [liquidityError, setLiquidityError] = useState("");
  const [refinementBefore, setRefinementBefore] = useState<Analysis | null>(null);

  useEffect(() => {
    const refresh = () => { const now = new Date(); setEventClock({ now: now.getTime(), iso: now.toISOString() }); };
    const initial = window.setTimeout(refresh, 0);
    const interval = window.setInterval(refresh, 60_000);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); };
  }, []);
  useEffect(() => {
    if (!busy || reviewTarget) return;
    const startedAt = Date.now();
    const totalSeconds = Math.ceil(POCKET_ANALYSIS_CLIENT_TIMEOUT_MS / 1000);
    const update = () => setAnalysisSecondsRemaining(Math.max(0, totalSeconds - Math.floor((Date.now() - startedAt) / 1000)));
    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [busy, reviewTarget]);
  const [showResultReveal, setShowResultReveal] = useState(false);
  const [showResultCard, setShowResultCard] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<"bull" | "wait" | "bear" | null>(null);
  const [battlefieldChart, setBattlefieldChart] = useState<"primary" | "context">("primary");
  const [viewerName, setViewerName] = useState("");
  const [resultView, setResultView] = useState<"cinema" | "report">("cinema");
  const [commandDeckMode, setCommandDeckMode] = useState<CommandDeckMode>("xray");
  const [appleAccess, setAppleAccess] = useState<AppleAccessStatus | null>(null);
  const [applePaywallStatus, setApplePaywallStatus] = useState<AppleAccessStatus | null>(null);
  const analysisRequestActive = useRef(false);
  const followUpRequestActive = useRef(false);
  const levelLabRequestActive = useRef(false);
  const liquidityRequestActive = useRef(false);
  const activePrimaryImage = useRef<string | null>(image);
  const appleAccessRequestActive = useRef<Promise<AppleAccessStatus> | null>(null);
  const chartFocusDialog = useRef<HTMLElement>(null);
  const chartFocusScroll = useRef<HTMLDivElement>(null);
  const chartFocusReturnFocus = useRef<HTMLElement | null>(null);
  const applePaywallReturnFocus = useRef<HTMLElement | null>(null);
  const nativeAppleApp = isAppleNativeApp();
  useEffect(() => { activePrimaryImage.current = image; }, [image]);
  const appleNeedsSubscription = Boolean(
    nativeAppleApp
    && appleAccess?.isNative
    && appleAccess.freeUseConsumed
    && !appleAccess.entitled,
  );
  useEffect(() => { vaultList().then(setVault).catch(() => setVaultMessage("Decision Vault is unavailable on this device.")); }, []);
  useEffect(() => {
    let cancelled = false;
    const refreshEvents = async () => {
      try {
        const response = await fetch("/api/pocket/events", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json() as { macroContext?: VerifiedMacroContext; marketEvents?: SupplementalMarketEvent[] };
        if (!cancelled && payload.macroContext) setEventContext(payload.macroContext);
        if (!cancelled && Array.isArray(payload.marketEvents)) setMarketEvents(payload.marketEvents);
      } catch {
        // Preserve the last verified schedule when a foreground refresh fails.
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshEvents();
    };
    void refreshEvents();
    const timer = window.setInterval(() => void refreshEvents(), 5 * 60 * 1000);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  function readAppleAccessStatus() {
    if (appleAccessRequestActive.current) return appleAccessRequestActive.current;
    const request = getAppleAccessStatus().finally(() => {
      if (appleAccessRequestActive.current === request) appleAccessRequestActive.current = null;
    });
    appleAccessRequestActive.current = request;
    return request;
  }

  useEffect(() => {
    let active = true;
    readAppleAccessStatus().then((latest) => { if (active) setAppleAccess(latest); }).catch(() => { if (active) setAppleAccess(null); });
    return () => { active = false; };
  }, []);

  async function refreshAppleAccess(): Promise<AppleAccessStatus | null> {
    try {
      // Reuse an in-flight StoreKit lookup. The mount lookup and a quick tap on
      // Analyse used to race; a late rejection could clear the status after
      // the paywall opened and leave an empty, scroll-locked webview.
      const latest = await readAppleAccessStatus();
      if (!latest.isNative) throw new Error("Native Apple purchase status was not returned.");
      setAppleAccess(latest);
      return latest;
    } catch {
      setError("Apple purchase status is temporarily unavailable. Please check your connection and try again; you have not been charged.");
      setAppleAccess(null);
      return null;
    }
  }

  function openApplePaywall(status: AppleAccessStatus | null) {
    if (!status?.isNative) {
      setError("Apple purchase status is temporarily unavailable. Please check your connection and try again; you have not been charged.");
      return;
    }
    applePaywallReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Hold the verified status on the modal itself. A later background status
    // refresh can no longer unmount the paywall while body scrolling is locked.
    setApplePaywallStatus(status);
  }

  function closeApplePaywall() {
    setApplePaywallStatus(null);
    window.requestAnimationFrame(() => {
      const original = applePaywallReturnFocus.current;
      const fallback = document.querySelector<HTMLElement>('[aria-label="Load 5-minute chart photo, screenshot or camera roll image"]');
      (original?.isConnected ? original : fallback)?.focus({ preventScroll: true });
    });
  }

  async function requireAppleEntitlementForAdditionalRequest(): Promise<boolean> {
    if (!isAppleNativeApp()) return true;
    const latest = await refreshAppleAccess();
    if (!latest) return false;
    if (!latest.entitled) {
      openApplePaywall(latest);
      return false;
    }
    return true;
  }

  function openChartFocus(event: ReactMouseEvent<HTMLButtonElement>) {
    chartFocusReturnFocus.current = event.currentTarget;
    setChartFocus(true);
  }

  function closeChartFocus() {
    setChartFocus(false);
    window.requestAnimationFrame(() => chartFocusReturnFocus.current?.focus({ preventScroll: true }));
  }

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
    if (!immersive && !chartFocus && !showResultReveal && !showResultCard && !applePaywallStatus) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [immersive, chartFocus, showResultReveal, showResultCard, applePaywallStatus]);

  useEffect(() => {
    if (!chartFocus) return;
    chartFocusScroll.current?.scrollTo({ top: 0 });
    const containFocus = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setChartFocus(false);
        window.requestAnimationFrame(() => chartFocusReturnFocus.current?.focus({ preventScroll: true }));
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(chartFocusDialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], summary, [tabindex]:not([tabindex="-1"])') ?? [])]
        .filter((element) => !element.hasAttribute("hidden"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", containFocus);
    return () => document.removeEventListener("keydown", containFocus);
  }, [chartFocus]);

  useEffect(() => {
    if (!image || reviewTarget || preflightStatus === "IDLE") return;
    const timer = window.setTimeout(() => {
      document.getElementById("pocket-preflight-lock")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [image, reviewTarget, preflightStatus]);

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
      setChartConfirmation(null);
      setPreflightStatus("IDLE");
      setImage(prepared);
      setFileName(file.name);
      setContextImage(null);
      setContextFileName("");
      setDetailImage(null);
      setDetailFileName("");
      setFourHourImage(null);
      setFourHourFileName("");
      setIndicatorImage(null);
      setIndicatorFileName("");
    } catch { setError("That image could not be prepared safely."); }
  }

  async function loadContextFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("Please choose a JPEG, PNG or WebP 30-minute chart.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("That 30-minute chart is too large. Please use a screenshot under 8 MB.");
      return;
    }
    try {
      setContextImage(await prepareImage(file));
      setContextFileName(file.name);
    } catch { setError("That 30-minute chart could not be prepared safely."); }
    finally { event.currentTarget.value = ""; }
  }

  async function loadDetailFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/") || file.size > MAX_IMAGE_BYTES) {
      setError("Please choose a JPEG, PNG or WebP 1-hour chart under 8 MB.");
      event.currentTarget.value = "";
      return;
    }
    try {
      setDetailImage(await prepareImage(file));
      setDetailFileName(file.name);
    } catch { setError("That 1-hour chart could not be prepared safely."); }
    finally { event.currentTarget.value = ""; }
  }

  async function loadFourHourFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/") || file.size > MAX_IMAGE_BYTES) {
      setError("Please choose a JPEG, PNG or WebP 4-hour chart under 8 MB.");
      event.currentTarget.value = "";
      return;
    }
    try {
      setFourHourImage(await prepareImage(file));
      setFourHourFileName(file.name);
    } catch { setError("That 4-hour chart could not be prepared safely."); }
    finally { event.currentTarget.value = ""; }
  }

  async function loadIndicatorFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/") || file.size > MAX_IMAGE_BYTES) {
      setError("Please choose a JPEG, PNG or WebP indicator or volume chart under 8 MB.");
      event.currentTarget.value = "";
      return;
    }
    try {
      setIndicatorImage(await prepareImage(file));
      setIndicatorFileName(file.name);
    } catch { setError("That indicator or volume chart could not be prepared safely."); }
    finally { event.currentTarget.value = ""; }
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
      setAnalysis((current) => current ? invalidateDerivedChartEvidence(current, "CONTEXT_REPLACED") : current);
      setContextImage(prepared);
      setContextFileName(file.name);
      setRefinementStatus("attached");
      setBattlefieldChart("primary");
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
    const primaryCurrentPrice = numericLevel(analysis.currentPrice);
    if (analysis.trustGate?.identityLocked !== true || primaryCurrentPrice === null) {
      setLevelLabStatus("error");
      setLevelLabError("Level Lab needs a verified primary instrument, timeframe and current price before it can replace the map.");
      return;
    }
    levelLabRequestActive.current = true;
    setLevelLabStatus("scanning");
    setLevelLabError("");
    try {
      const scanImage = await createLevelLabScanImage(levelLabImage);
      if (!scanImage) throw new Error("That Level Lab photo is too large to send safely. Crop it to the chart and price scale, then try again.");
      const primaryProvenance = {
        instrument: analysis.instrument,
        ticker: analysis.ticker,
        timeframe: analysis.timeframe,
        currentPrice: analysis.currentPrice,
        identityLocked: true as const,
      };
      const { response, payload } = await postLevelLabScan<{
        levels?: Pick<Analysis, "plotBounds" | "priceScaleAnchors" | "levels" | "currentPrice" | "levelStory" | "trustGate"> & {
          provenance?: { source?: string; primaryInstrument?: string; primaryTimeframe?: string; primaryCurrentPrice?: string; levelLabInstrument?: string };
        };
        error?: string;
      }>(JSON.stringify({ image: scanImage, primaryProvenance }));
      if (!response.ok || !payload.levels) throw new Error(payload.error || "The independent level scan could not complete.");
      const returnedCurrentPrice = numericLevel(payload.levels.currentPrice);
      const returnedLevels = numericStructure(payload.levels.levels);
      const provenance = payload.levels.provenance;
      const provenancePrice = numericLevel(provenance?.primaryCurrentPrice);
      const returnedTrustGate = payload.levels.trustGate;
      const returnedTwoSided = hasVerifiedTwoSidedStructure(returnedLevels, primaryCurrentPrice);
      const validTrustGate = returnedTrustGate?.chartLocked === true
        && returnedTrustGate.identityLocked === true
        && returnedTrustGate.exactLevelCount >= 1
        && ((returnedTwoSided && returnedTrustGate.status === "LOCKED" && returnedTrustGate.scaleLocked === true)
          || (!returnedTwoSided && returnedTrustGate.status === "PARTIAL"));
      const validProvenance = provenance?.source === "LEVEL_LAB"
        && provenance.primaryInstrument === analysis.instrument
        && provenance.primaryTimeframe === analysis.timeframe
        && provenancePrice === primaryCurrentPrice
        && returnedCurrentPrice === primaryCurrentPrice
        && payload.levels.levels.every((level) => level.source === "LEVEL_LAB");
      if (!validProvenance || !validTrustGate) {
        throw new Error("Level Lab could not verify a matching exact price map, so the existing analysis was left unchanged.");
      }
      setAnalysis((current) => {
        const currentPrice = numericLevel(current?.currentPrice);
        const stillBoundToPrimary = current
          && current.trustGate?.identityLocked === true
          && current.instrument === primaryProvenance.instrument
          && current.timeframe === primaryProvenance.timeframe
          && currentPrice === primaryCurrentPrice;
        if (!current || !stillBoundToPrimary) return current;
        const rescanned = enforcePocketTrustGate({
          ...current,
          // Level Lab may use a different crop or timeframe. Import its exact
          // prices into the abstract Decision Map, but never draw its pixel
          // coordinates over the original primary screenshot.
          levels: payload.levels!.levels.map((level) => ({
            ...level,
            x: Number.NaN,
            y: Number.NaN,
            x2: Number.NaN,
            y2: Number.NaN,
          })),
          // The secondary scan verifies compatibility but can never replace
          // the already locked current-price provenance from the primary.
          currentPrice: current.currentPrice,
          trustGate: returnedTrustGate,
          levelStory: payload.levels!.levelStory || current.levelStory,
        }, returnedTrustGate) as Analysis;
        return invalidateDerivedChartEvidence(rescanned, "PRIMARY_STRUCTURE_CHANGED");
      });
      setBattlefieldChart("primary");
      if (contextImage) setRefinementStatus("attached");
      setLevelLabStatus("updated");
    } catch (caught) {
      setLevelLabStatus("error");
      setLevelLabError(caught instanceof Error ? caught.message : "The independent level scan could not complete.");
    } finally { levelLabRequestActive.current = false; }
  }

  async function reanalyseResult() {
    if (!analysis || busy || analysisRequestActive.current) return;
    if (!await requireAppleEntitlementForAdditionalRequest()) return;
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

  async function rescanLiquidityOnly() {
    if (!analysis || !image || liquidityRequestActive.current) return;
    const primaryCurrentPrice = numericLevel(analysis.currentPrice);
    if (analysis.trustGate?.identityLocked !== true || primaryCurrentPrice === null) {
      setLiquidityError("Liquidity Guard needs a verified primary instrument, timeframe and current price before it can mark the chart.");
      return;
    }
    liquidityRequestActive.current = true;
    setLiquidityRescanning(true);
    setLiquidityError("");
    try {
      const sourceImageRevision = image;
      const scanImage = await createProviderScanImage(image);
      if (!scanImage) throw new Error("That primary chart is too large to scan safely. Crop it to the chart and price scale, then try again.");
      const measuredScanImage = await createMeasuredScanImage(scanImage);
      if (!measuredScanImage) throw new Error("Liquidity Guard could not prepare the chart measurement layer. Your existing analysis is unchanged.");
      const primaryProvenance = {
        instrument: analysis.instrument,
        ticker: analysis.ticker,
        timeframe: analysis.timeframe,
        currentPrice: analysis.currentPrice,
        identityLocked: true as const,
      };
      const { response, payload } = await postLiquidityRescan<{
        liquidity?: NonNullable<Analysis["liquidityGeometry"]>;
        error?: string;
      }>(JSON.stringify({ image: measuredScanImage, primaryProvenance }));
      if (!response.ok || !payload.liquidity) throw new Error(payload.error || "Liquidity Guard could not verify this chart.");
      setAnalysis((current) => {
        if (!current || activePrimaryImage.current !== sourceImageRevision || current.instrument !== primaryProvenance.instrument || current.timeframe !== primaryProvenance.timeframe || numericLevel(current.currentPrice) !== primaryCurrentPrice) return current;
        return {
          ...current,
          liquidityGeometry: payload.liquidity!,
        };
      });
    } catch (caught) {
      setLiquidityError(caught instanceof Error ? caught.message : "Liquidity Guard could not verify this chart.");
    } finally {
      liquidityRequestActive.current = false;
      setLiquidityRescanning(false);
    }
  }

  function openResultReport(target?: string) {
    setResultView("report");
    requestAnimationFrame(() => requestAnimationFrame(() => target ? document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" }) : document.querySelector(".psResults")?.scrollTo({ top: 0, behavior: "smooth" })));
  }

  function applyAccuracyCorrection(feedback: AccuracyFeedback) {
    const patch = correctionPatch(feedback);
    const invalidationReason = patch.instrument || patch.timeframe ? "CONTEXT_REPLACED" : "PRIMARY_STRUCTURE_CHANGED";
    setAccuracyCorrection(feedback);
    setAnalysis((current) => {
      if (!current) return current;
      setCorrectionOriginal((original) => original ?? current);
      let levels = current.levels;
      if (patch.level) {
        const index = levels.findIndex((level) => level.kind === patch.level!.kind);
        // A corrected price is authoritative list/ladder evidence, but it has no
        // trustworthy pixel row until the server can bind it to verified scale
        // geometry. Never draw it at the old row or an arbitrary midpoint.
        const unpositioned = { x: Number.NaN, y: Number.NaN, x2: Number.NaN, y2: Number.NaN };
        const verified = index >= 0
          ? { ...levels[index], ...unpositioned, price: patch.level.price, label: `${levels[index].label} · USER VERIFIED`, source: "USER_VERIFIED" as const }
          : { kind: patch.level.kind, label: `USER VERIFIED ${patch.level.kind.toUpperCase()}`, price: patch.level.price, ...unpositioned, source: "USER_VERIFIED" as const };
        levels = index >= 0 ? levels.map((level, levelIndex) => levelIndex === index ? verified : level) : [...levels, verified];
      }
      return invalidateDerivedChartEvidence({ ...current, instrument: patch.instrument ?? current.instrument, timeframe: patch.timeframe ?? current.timeframe, currentPrice: patch.currentPrice ?? current.currentPrice, levels, liquidityShield: undefined, liquidityGeometry: undefined }, invalidationReason);
    });
    setBattlefieldChart("primary");
    if (contextImage) setRefinementStatus("attached");
  }

  async function reanalyseWithCorrection() {
    if (!accuracyCorrection || !image || busy) return;
    if (!await requireAppleEntitlementForAdditionalRequest()) return;
    setError("");
    try {
      const patch = correctionPatch(accuracyCorrection);
      const identityChanged = Boolean(patch.instrument || patch.timeframe);
      const corrected = await requestPocketAnalysis(contextImage, { bypassCache: true });
      setAnalysis(corrected);
      setBattlefieldChart("primary");
      if (contextImage) setRefinementStatus(identityChanged ? "attached" : "updated");
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
      const cacheKey = await analysisCacheKey(image, selectedContext, detailImage, fourHourImage, indicatorImage, chartConfirmation, accuracyCorrection);
      if (!options.bypassCache) {
        const cached = await analysisCacheGet(cacheKey).catch(() => null);
        // Held, one-sided and pivot-only results must never become sticky.
        // A second chart counts only after server-side compatibility checks.
        if (cached && hasVerifiedTwoSidedAnalysis(cached, Boolean(selectedContext))) return cached;
      }
      // Encode one chart at a time to avoid holding two large iOS canvases in
      // memory. Already-bounded originals stay byte-for-byte unchanged.
      const providerImage = await createProviderScanImage(image);
      const providerContextImage = selectedContext ? await createProviderScanImage(selectedContext) : null;
      const providerDetailImage = detailImage ? await createProviderScanImage(detailImage) : null;
      const providerFourHourImage = fourHourImage ? await createProviderScanImage(fourHourImage) : null;
      const providerIndicatorImage = indicatorImage ? await createProviderScanImage(indicatorImage) : null;
      if (!providerImage || (selectedContext && !providerContextImage) || (detailImage && !providerDetailImage) || (fourHourImage && !providerFourHourImage) || (indicatorImage && !providerIndicatorImage)) {
        throw new Error("That chart could not be prepared within the secure mobile upload limit. Crop it to the chart and price scale, then try again.");
      }
      const evidenceInputs: Array<[string, ChartEvidenceRole]> = [
        [providerImage, "PRIMARY"],
        ...(providerContextImage ? [[providerContextImage, "HIGHER_TIMEFRAME"] as [string, ChartEvidenceRole]] : []),
        ...(providerDetailImage ? [[providerDetailImage, "PRICE_DETAIL"] as [string, ChartEvidenceRole]] : []),
        ...(providerFourHourImage ? [[providerFourHourImage, "FOUR_HOUR"] as [string, ChartEvidenceRole]] : []),
        ...(providerIndicatorImage ? [[providerIndicatorImage, "INDICATOR_VOLUME"] as [string, ChartEvidenceRole]] : []),
      ];
      const deterministicEvidence: DeterministicChartEvidence[] = [];
      // Decode one chart at a time. Four simultaneous canvases can terminate
      // WKWebView on older iPhones before the analysis request is sent.
      for (const [source, role] of evidenceInputs) deterministicEvidence.push(await measureChart(source, role));
      const response = await postPocketAnalysis(JSON.stringify({ image: providerImage, contextImage: providerContextImage, detailImage: providerDetailImage, fourHourImage: providerFourHourImage, indicatorImage: providerIndicatorImage, chartConfirmation, accuracyCorrection, deterministicEvidence }));
      const payload = await response.json() as { analysis?: Analysis; macroContext?: VerifiedMacroContext; marketEvents?: SupplementalMarketEvent[]; error?: string };
      if (!response.ok || !payload.analysis) throw new Error(payload.error || "Analysis is temporarily unavailable.");
      if (payload.macroContext) setEventContext(payload.macroContext);
      if (Array.isArray(payload.marketEvents)) setMarketEvents(payload.marketEvents);
      payload.analysis.levels = payload.analysis.levels.map((level) => {
        const drawable = [level.x, level.y, level.x2, level.y2].every(Number.isFinite);
        return level.source === "USER_VERIFIED" && !drawable
          ? { ...level, x: Number.NaN, y: Number.NaN, x2: Number.NaN, y2: Number.NaN }
          : { ...level, y: clampY(level.y) };
      });
      if (hasVerifiedTwoSidedAnalysis(payload.analysis, Boolean(selectedContext))) {
        await analysisCacheSave(cacheKey, payload.analysis).catch(() => undefined);
      }
      return payload.analysis;
    } finally {
      analysisRequestActive.current = false;
      setBusy(false);
    }
  }

  async function analyse() {
    if (!image || (!reviewTarget && (!contextImage || !detailImage || !fourHourImage)) || !privacyChecked || busy || analysisRequestActive.current) return;
    let currentAppleAccess = appleAccess;
    if (isAppleNativeApp()) {
      currentAppleAccess = await refreshAppleAccess();
      if (!currentAppleAccess) return;
    }
    if (reviewTarget && currentAppleAccess?.isNative && !currentAppleAccess.entitled) {
      openApplePaywall(currentAppleAccess);
      return;
    }
    if (!reviewTarget && currentAppleAccess?.isNative && currentAppleAccess.freeUseConsumed && !currentAppleAccess.entitled) {
      openApplePaywall(currentAppleAccess);
      return;
    }
    if (!reviewTarget && !preflightAllowsAnalysis(preflightStatus)) return;
    if (!reviewTarget) setAnalysisSecondsRemaining(Math.ceil(POCKET_ANALYSIS_CLIENT_TIMEOUT_MS / 1000));
    setError("");
    try {
      if (!reviewTarget) {
        const nextAnalysis = await requestPocketAnalysis(contextImage);
        setStockEvents([]);
        setStockEventStatus(nextAnalysis.ticker === "UNKNOWN" ? "unavailable" : "loading");
        if (currentAppleAccess?.isNative && !currentAppleAccess.entitled && !currentAppleAccess.freeUseConsumed) {
          await consumeAppleFreeUse();
          setAppleAccess({ ...currentAppleAccess, freeUseConsumed: true });
        }
        // Do not expose a completed free result until its device entitlement
        // has been secured. If Keychain persistence fails, the request fails
        // closed instead of allowing the free analysis to be replayed.
        setAnalysis(nextAnalysis);
        setResultView("cinema");
        setImmersive(true);
        setShowResultReveal(true);
        // Count only completed, newly uploaded chart analyses. Reanalysis,
        // follow-ups and review workflows must not inflate review eligibility.
        // The prompt itself is deferred until the customer leaves the result.
        void recordAppleSuccessfulAnalysis().catch(() => undefined);
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
      const completedDecision: LockedDecision = {
        ...reviewTarget,
        review: payload.review,
        afterImage: image,
        reviewedAt: new Date().toISOString(),
      };
      await vaultSave(completedDecision);
      setVault((current) => current.map((decision) => decision.id === completedDecision.id ? completedDecision : decision));
      setReviewTarget(completedDecision);
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
    if (!await requireAppleEntitlementForAdditionalRequest()) return;
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
    const signature = decisionSignature(analysis);
    if (vault.some((item) => decisionSignature(item.analysis) === signature)) {
      setVaultMessage("This result is already saved in your private Decision Journal.");
      return;
    }
    const decision: LockedDecision = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), intention, image, analysis };
    try { await vaultSave(decision); setVault((current) => [decision, ...current]); setVaultMessage("Saved to your private Decision Journal. Return with a later chart to review the process—not just the outcome."); }
    catch { setVaultMessage("This decision could not be saved on this device."); }
  }

  async function shareFoundingInvite() {
    if (isAppleNativeApp()) {
      setVaultMessage("Invites to web membership offers are unavailable in the iOS app.");
      return;
    }
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

  async function startReview(decision: LockedDecision) {
    if (decision.review) {
      setReviewTarget(decision); setReview(decision.review); setAnalysis(null); setImage(decision.afterImage ?? null); setFileName(""); setContextImage(null); setContextFileName(""); setDetailImage(null); setDetailFileName(""); setFourHourImage(null); setFourHourFileName(""); setIndicatorImage(null); setIndicatorFileName(""); setImmersive(true); setError("");
      return;
    }
    if (!await requireAppleEntitlementForAdditionalRequest()) return;
    setReviewTarget(decision); setReview(null); setAnalysis(null); setImage(null); setFileName(""); setContextImage(null); setContextFileName(""); setDetailImage(null); setDetailFileName(""); setFourHourImage(null); setFourHourFileName(""); setIndicatorImage(null); setIndicatorFileName(""); setLevelLabImage(null); setLevelLabFileName(""); setLevelLabStatus("idle"); setLevelLabError(""); setImmersive(false); setError("");
  }

  function startNewChart() {
    setImmersive(false);
    setAnalysis(null);
    setImage(null);
    setFileName("");
    setContextImage(null);
    setContextFileName("");
    setDetailImage(null);
    setDetailFileName("");
    setFourHourImage(null);
    setFourHourFileName("");
    setIndicatorImage(null);
    setIndicatorFileName("");
    setLevelLabImage(null);
    setLevelLabFileName("");
    setLevelLabStatus("idle");
    setLevelLabError("");
    setLiquidityError("");
    setChartConfirmation(null);
    setPreflightStatus("IDLE");
    setBattlefieldChart("primary");
    setResultView("cinema");
    setShowResultReveal(false);
    // This customer-controlled transition occurs after they have had time to
    // inspect the result. StoreKit decides whether to display the prompt, and
    // native persistence ensures it is requested at most once.
    void requestAppleReviewIfEligible().catch(() => undefined);
    if (appleNeedsSubscription) openApplePaywall(appleAccess);
  }

  const vaultStats = (() => {
    const total = vault.length;
    if (!total) return { total: 0, reviewed: 0, average: 0, patience: 0, averageDecisionQuality: 0, commonRisk: "NOT ENOUGH HISTORY", commonBehaviour: "NO REVIEW HISTORY", commonRootCause: "NOT PROVEN", dominant: "NO PATTERN YET", insight: "Save decisions to begin building your private fingerprint." };
    const average = Math.round(vault.reduce((sum, item) => sum + item.analysis.setupScore.overall, 0) / total);
    const patience = Math.round(vault.filter((item) => item.analysis.verdict !== "WATCH").length / total * 100);
    const reviewed = vault.filter((item) => item.review);
    const averageDecisionQuality = reviewed.length ? Math.round(reviewed.reduce((sum, item) => sum + (item.review?.decisionQuality ?? 0), 0) / reviewed.length) : 0;
    const risks = new Map<string, number>();
    const instruments = new Map<string, number>();
    const behaviours = new Map<string, number>();
    const rootCauses = new Map<string, number>();
    vault.forEach((item) => {
      item.analysis.riskFlags.forEach((risk) => risks.set(risk, (risks.get(risk) ?? 0) + 1));
      instruments.set(item.analysis.instrument, (instruments.get(item.analysis.instrument) ?? 0) + 1);
      item.review?.behaviourTags.forEach((tag) => behaviours.set(tag, (behaviours.get(tag) ?? 0) + 1));
      if (item.review?.rootCause && item.review.rootCause !== "NOT_PROVEN") rootCauses.set(item.review.rootCause, (rootCauses.get(item.review.rootCause) ?? 0) + 1);
    });
    const top = (map: Map<string, number>, fallback: string) => [...map.entries()].sort((a,b) => b[1] - a[1])[0]?.[0] ?? fallback;
    const commonBehaviour = top(behaviours, "NO REVIEW HISTORY");
    const commonRootCause = top(rootCauses, "NOT PROVEN").replaceAll("_", " ");
    const insight = reviewed.length < 3
      ? `${3 - reviewed.length} more completed autops${3 - reviewed.length === 1 ? "y" : "ies"} will start exposing repeated decision mistakes.`
      : commonBehaviour !== "NO REVIEW HISTORY"
        ? `Your most repeated reviewed behaviour is ${commonBehaviour.toLowerCase()}. Challenge it before the next decision.`
        : `${patience}% of saved reads advised waiting or standing aside.`;
    return { total, reviewed: reviewed.length, average, patience, averageDecisionQuality, commonRisk: top(risks, "NO REPEATED RISK"), commonBehaviour, commonRootCause, dominant: top(instruments, "NO PATTERN YET"), insight };
  })();

  const sourceChart = (focus = false) => image ? <SourceChart image={image} expanded={focus} /> : null;
  const contextSourceChart = (focus = false) => contextImage ? <SourceChart image={contextImage} expanded={focus} /> : null;
  const evidenceImageCount = [image, contextImage, detailImage, fourHourImage, indicatorImage].filter(Boolean).length;
  const requiredTimeframesReady = Boolean(image && contextImage && detailImage && fourHourImage);

  if (review && reviewTarget) {
    return <main className="psApp" data-pocket-build="v3.2">
      <section className="psResults psAutopsyResults" data-immersive="true">
        <div className="psImmersiveBar"><span>BULLSEYE · DECISION AUTOPSY</span><button type="button" onClick={() => { setReview(null); setReviewTarget(null); setImage(null); }}>DONE</button></div>
        <header className="psVerdict psReviewVerdict"><p><i /> BEFORE VS AFTER · OUTCOME IS NOT PROCESS</p><div className="psVerdictTop"><h1><small>PROCESS GRADE</small><em data-grade={review.processGrade}>{review.processGrade}</em></h1><div><small>{review.decisionQuality}/100</small><strong>{review.outcome}</strong></div></div><h2>{review.headline}</h2><span>{review.outcomeSummary}</span></header>
        <section className="psAutopsyCharts"><figure><img src={reviewTarget.image} alt="Original chart saved before the decision"/><figcaption>BEFORE · LOCKED AUDIT</figcaption></figure><i>→</i><figure><img src={reviewTarget.afterImage ?? image ?? ""} alt="Later chart used for the decision autopsy"/><figcaption>AFTER · LATER EVIDENCE</figcaption></figure></section>
        <section className="psAutopsyStatus"><article><small>ORIGINAL THESIS</small><strong>{review.thesisStatus.replaceAll("_", " ")}</strong></article><article><small>STRUCTURE SHIFT</small><strong>{review.structureShift}</strong></article><article><small>ROOT CAUSE</small><strong>{review.rootCause.replaceAll("_", " ")}</strong></article></section>
        <section className="psChangeLedger"><header><span>⌁ CHART CHANGE DETECTOR</span><b>{review.evidenceChanges.length} VISIBLE CHANGE{review.evidenceChanges.length === 1 ? "" : "S"}</b></header>{review.evidenceChanges.length ? review.evidenceChanges.map((change, index) => <article key={`${change.before}-${index}`} data-impact={change.impact}><i>{String(index + 1).padStart(2, "0")}</i><div><small>BEFORE</small><p>{change.before}</p><small>AFTER</small><p>{change.after}</p></div><b>{change.impact}</b></article>) : <p>No reliable structural change could be proven from the two screenshots.</p>}</section>
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
            <header><div><span>◎ EVIDENCE PACK USED</span><strong>{analysis.evidencePack.received}/5 IMAGES RECEIVED</strong></div><b>{analysis.evidencePack.contributions.filter((item) => item.used).length} CONTRIBUTED</b></header>
            <div>{analysis.evidencePack.contributions.map((item) => <article key={item.role} data-used={item.used ? "true" : "false"}><i>{item.role === "PRIMARY" ? "①" : item.role === "HIGHER_TIMEFRAME" ? "②" : item.role === "PRICE_DETAIL" ? "③" : item.role === "FOUR_HOUR" ? "④" : "⑤"}</i><div><strong>{item.role === "PRIMARY" ? "5 MINUTES" : item.role === "HIGHER_TIMEFRAME" ? "30 MINUTES" : item.role === "PRICE_DETAIL" ? "1 HOUR" : item.role === "FOUR_HOUR" ? "4 HOURS" : "INDICATOR / VOLUME"}</strong><p>{item.summary}</p></div><b>{item.used ? "USED" : "NO NEW EVIDENCE"}</b></article>)}</div>
            <footer>Every supporting image is assessed separately. A chart that adds nothing cannot inflate the score or confidence.</footer>
          </section> : null}
          <div id="bullseye-tools" className="psReportTools"><PocketCommandDeck analysis={combinedAnalysis} primaryLevels={analysis.levels} sourceImage={image ?? ""} onResultCard={() => setShowResultCard(true)} onAddChart={addResultContextFile} onReanalyse={reanalyseResult} onLiquidityRescan={rescanLiquidityOnly} liquidityError={liquidityError} hasContext={Boolean(contextImage)} reanalysing={refinementStatus === "analysing"} liquidityRescanning={liquidityRescanning} mode={commandDeckMode} onMode={setCommandDeckMode} /></div>
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
          <div className="psScanLine" aria-hidden="true" /><strong>{image ? "① 5-MINUTE CHART LOADED" : "① LOAD 5-MINUTE CHART"}</strong><small>{image ? fileName : "FIRST · PHOTO · SCREENSHOT · CAMERA ROLL"}</small>
          <input aria-label="Load 5-minute chart photo, screenshot or camera roll image" accept="image/jpeg,image/png,image/webp" type="file" onChange={loadFile} />
        </label>
        <div className="psCaptureRow"><label>USE CAMERA<input aria-label="Use camera" accept="image/*" capture="environment" type="file" onChange={loadFile} /></label><span>OR CHOOSE FROM CAMERA ROLL ABOVE</span></div>
        {image && !reviewTarget ? <section className="psEvidencePack">
          <header><div><span>◎ ORDERED EVIDENCE PACK</span><strong>{evidenceImageCount}/5 CHARTS LOADED</strong></div><b>{requiredTimeframesReady ? "4 TIMEFRAMES READY" : "COMPLETE IN ORDER"}</b></header>
          <p>Work down the list: 5m → 30m → 1h → 4h. Your preferred indicator chart is optional.</p>
          <div>
            <section className="psContextUpload" data-loaded={contextImage ? "true" : "false"}>
              <div><span>② 30 MINUTES</span><strong>{contextImage ? "30M LOADED ✓" : "ADD 30M CHART"}</strong><p>{contextImage ? contextFileName : "Second chart · same instrument."}</p></div>
              {contextImage ? <button type="button" onClick={() => { setContextImage(null); setContextFileName(""); }}>REMOVE</button> : <label>ADD 30M<input aria-label="Add 30-minute chart" accept="image/jpeg,image/png,image/webp" type="file" onChange={loadContextFile} /></label>}
            </section>
            <section className="psContextUpload" data-loaded={detailImage ? "true" : "false"}>
              <div><span>③ 1 HOUR</span><strong>{detailImage ? "1H LOADED ✓" : "ADD 1H CHART"}</strong><p>{detailImage ? detailFileName : "Third chart · same instrument."}</p></div>
              {detailImage ? <button type="button" onClick={() => { setDetailImage(null); setDetailFileName(""); }}>REMOVE</button> : <label>ADD 1H<input aria-label="Add 1-hour chart" accept="image/jpeg,image/png,image/webp" type="file" onChange={loadDetailFile} /></label>}
            </section>
            <section className="psContextUpload" data-loaded={fourHourImage ? "true" : "false"}>
              <div><span>④ 4 HOURS</span><strong>{fourHourImage ? "4H LOADED ✓" : "ADD 4H CHART"}</strong><p>{fourHourImage ? fourHourFileName : "Fourth chart · same instrument."}</p></div>
              {fourHourImage ? <button type="button" onClick={() => { setFourHourImage(null); setFourHourFileName(""); }}>REMOVE</button> : <label>ADD 4H<input aria-label="Add 4-hour chart" accept="image/jpeg,image/png,image/webp" type="file" onChange={loadFourHourFile} /></label>}
            </section>
            <section className="psContextUpload" data-loaded={indicatorImage ? "true" : "false"}>
              <div><span>⑤ YOUR INDICATOR · OPTIONAL</span><strong>{indicatorImage ? "INDICATOR LOADED ✓" : "ADD YOUR PREFERENCE"}</strong><p>{indicatorImage ? indicatorFileName : "RSI, VWAP, ATR, volume profile, volume or another preferred indicator."}</p></div>
              {indicatorImage ? <button type="button" onClick={() => { setIndicatorImage(null); setIndicatorFileName(""); }}>REMOVE</button> : <label>ADD OPTIONAL<input aria-label="Add preferred indicator or volume chart" accept="image/jpeg,image/png,image/webp" type="file" onChange={loadIndicatorFile} /></label>}
            </section>
          </div>
          <footer>Required: 5m + 30m + 1h + 4h · Optional: one indicator chart · Every chart must show the same instrument.</footer>
        </section> : null}
        {image && !reviewTarget && appleNeedsSubscription ? <p className="psMessage" role="status">Your free analysis is complete. Unlock another analysis through Apple to run a new chart challenge.</p> : null}
        {image && !reviewTarget && <section className="psIntent"><header><span>WHAT ARE YOU CONSIDERING?</span></header><div>{(["LONG","SHORT","UNSURE"] as const).map((value) => <button key={value} type="button" data-active={intention === value} onClick={() => setIntention(value)}>{value === "UNSURE" ? "JUST ANALYSE" : value}</button>)}</div></section>}
        {image && <section className="psAutoPreview"><header><span>SOURCE CHART READY</span><b>AI DECISION MAP NEXT</b></header>{sourceChart()}<p>Bullseye will transform verified prices into a clear Decision Map—without drawing over your screenshot.</p></section>}
        {requiredTimeframesReady && !reviewTarget ? <ChartPreflightPanel image={image!} contextImage={contextImage} detailImage={detailImage} fourHourImage={fourHourImage} onStatus={setPreflightStatus} onConfirmation={setChartConfirmation} /> : null}
        <label className="psPrivacy"><input type="checkbox" checked={privacyChecked} onChange={(event) => setPrivacyChecked(event.target.checked)} /><span><strong>PRIVACY SHIELD</strong>I removed my name, account number, balance and notifications.</span></label>
        <p className="psDataNote">Images are sent to our AI provider for this audit. Saved decisions stay in this browser. <a href="/privacy" target="_blank" rel="noreferrer">HOW YOUR CHART IS HANDLED ↗</a></p>
        {error && <p className="psMessage" role="alert">{error}</p>}
        <button className="psAnalyse" data-busy={busy ? "true" : "false"} type="button" disabled={!image || (!reviewTarget && !requiredTimeframesReady) || !privacyChecked || busy || (!reviewTarget && !appleNeedsSubscription && !preflightAllowsAnalysis(preflightStatus))} onClick={analyse}><span><strong>{busy ? (reviewTarget ? "COMPARING DECISIONS…" : "MEASURING CHART · CHALLENGING SETUP…") : reviewTarget ? "RUN BEFORE VS AFTER REVIEW" : appleNeedsSubscription ? "UNLOCK ANOTHER ANALYSIS" : !requiredTimeframesReady ? "ADD 5M · 30M · 1H · 4H" : preflightStatus === "CHECKING" ? "CHECKING ALL FOUR CHARTS…" : preflightStatus === "RETAKE" ? "REPLACE THE WRONG CHART" : "CHALLENGE MY SETUP"}</strong>{busy && !reviewTarget ? <small role="timer">{pocketAnalysisCountdownLabel(analysisSecondsRemaining)}</small> : null}</span><b>🎯</b>{busy ? <i aria-hidden="true" /> : null}</button>
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
