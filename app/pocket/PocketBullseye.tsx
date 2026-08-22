"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import type { VerifiedMacroContext } from "../lib/macro-data";
import { normalizeLockedDecisions } from "./decision-compatibility";

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

function PriceBattlefield({ analysis, expanded = false }: { analysis: Analysis; expanded?: boolean }) {
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
  const position = (price: number) => 9 + ((max - price) / (max - min)) * 82;
  const ordered = [...verified].sort((a, b) => b.numericPrice - a.numericPrice);

  return <div className={`psBattlefield${expanded ? " psBattlefieldExpanded" : ""}`} aria-label="Bullseye price battlefield">
    <div className="psBattleScan" aria-hidden="true" />
    <div className="psBattleAxis" aria-hidden="true"><i /><i /><i /></div>
    {ordered.map((level, index) => <button key={`${level.kind}-${level.numericPrice}-${index}`} type="button" className="psBattleLevel" data-kind={level.kind} style={{ top: `${position(level.numericPrice)}%` }} aria-label={`${level.kind} at ${level.price}`}>
      <span className="psBattleIcon">{level.kind === "support" ? "●" : level.kind === "resistance" ? "●" : "◆"}</span>
      <i /><strong>{level.price}</strong><small>{level.kind === "pivot" ? "PIVOT" : level.kind.toUpperCase()}</small>
    </button>)}
    {current !== null ? <div className="psBattleCurrent" style={{ top: `${position(current)}%` }}><i /><span>CURRENT</span><strong>{analysis.currentPrice}</strong></div> : null}
    {!verified.length ? <div className="psBattleEmpty"><b>PRECISION HOLD</b><p>No exact level survived verification. Add a chart with a clear price scale for the Battlefield.</p></div> : null}
    <div className="psBattleDirection" data-direction={analysis.direction}><span>BEAR PRESSURE</span><strong>{analysis.direction}</strong><span>BULL PRESSURE</span></div>
  </div>;
}

function SourceChart({ image, expanded = false }: { image: string; expanded?: boolean }) {
  return <div className={expanded ? "psSourceChart psSourceChartExpanded" : "psSourceChart"}>
    {/* eslint-disable-next-line @next/next/no-img-element */}<img src={image} alt="Original uploaded trading chart" />
  </div>;
}

function formatEventTime(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London", timeZoneName: "short" }).format(parsed);
}

function openVault() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("bullseye-decision-vault", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("decisions", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
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
  const analysisRequestActive = useRef(false);
  const followUpRequestActive = useRef(false);

  useEffect(() => { vaultList().then(setVault).catch(() => setVaultMessage("Decision Vault is unavailable on this device.")); }, []);

  useEffect(() => {
    if (!analysis || analysis.ticker === "UNKNOWN" || analysis.evidenceQuality.instrumentConfidence !== "HIGH") return;
    const controller = new AbortController();
    fetch(`/api/pocket/events?symbol=${encodeURIComponent(analysis.ticker)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { events?: StockEvent[] };
        if (!response.ok) throw new Error("unavailable");
        setStockEvents(payload.events ?? []);
        setStockEventStatus("ready");
      })
      .catch((error) => { if (error instanceof Error && error.name !== "AbortError") setStockEventStatus("unavailable"); });
    return () => controller.abort();
  }, [analysis]);

  useEffect(() => {
    if (!immersive && !chartFocus && !showResultReveal) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [immersive, chartFocus, showResultReveal]);

  async function loadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setAnalysis(null);
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

  async function requestPocketAnalysis(selectedContext: string | null): Promise<Analysis> {
    if (!image || analysisRequestActive.current) throw new Error("An analysis is already running.");
    analysisRequestActive.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/pocket/analyse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image, contextImage: selectedContext, intention }),
      });
      const payload = await response.json() as { analysis?: Analysis; error?: string };
      if (!response.ok || !payload.analysis) throw new Error(payload.error || "Analysis is temporarily unavailable.");
      payload.analysis.levels = payload.analysis.levels.map((level) => ({ ...level, y: clampY(level.y) }));
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

  async function lockDecision() {
    if (!analysis || !image) return;
    const decision: LockedDecision = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), intention, image, analysis };
    try { await vaultSave(decision); setVault((current) => [decision, ...current]); setVaultMessage("Saved privately on this device. Upload a later chart whenever you want Bullseye to review the decision process."); }
    catch { setVaultMessage("This decision could not be saved on this device."); }
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

  if (review && reviewTarget) {
    return <main className="psApp" data-pocket-build="v3.1"><section className="psResults" data-immersive="true"><div className="psImmersiveBar"><span>BULLSEYE · PROCESS REVIEW</span><button type="button" onClick={() => { setReview(null); setReviewTarget(null); setImage(null); }}>DONE</button></div><header className="psVerdict psReviewVerdict"><p><i /> BEFORE VS AFTER · OUTCOME IS NOT PROCESS</p><div className="psVerdictTop"><h1><small>PROCESS GRADE</small><em data-grade={review.processGrade}>{review.processGrade}</em></h1><div><small>{review.decisionQuality}/100</small><strong>{review.outcome}</strong></div></div><h2>{review.headline}</h2><span>{review.outcomeSummary}</span></header><section className="psReviewGrid"><article><span>CONFIRMATION</span><p>{review.confirmationReview}</p></article><article><span>INVALIDATION</span><p>{review.invalidationReview}</p></article><article><span>TIMING</span><p>{review.timingReview}</p></article><article><span>DISCIPLINE</span><p>{review.disciplineReview}</p></article></section><section className="psAuditGrid"><article data-audit="improve"><span>LESSONS TO CARRY FORWARD</span><ul>{review.lessons.map((lesson) => <li key={lesson}>{lesson}</li>)}</ul></article><article data-audit="trap"><span>BEHAVIOUR TAGS</span><p>{review.behaviourTags.join(" · ") || "No reliable behaviour tag"}</p></article></section>{review.goodDecisionBadOutcome ? <p className="psProcessNote">GOOD DECISION · BAD OUTCOME — protect the process; do not rewrite it because of one result.</p> : null}<p className="psLegal">Screenshots cannot prove exact execution. Confirm fills and P&amp;L on the original platform.</p></section></main>;
  }

  if (analysis) {
    return (
      <main className="psApp" data-pocket-build="v3.1">
        <section className="psResults" data-immersive={immersive ? "true" : "false"}>
          <div className="psImmersiveBar">
            <span>POCKET BULLSEYE · PRIVATE RESULT</span>
            <button type="button" onClick={() => { setImmersive(false); setAnalysis(null); setContextImage(null); setContextFileName(""); setShowResultReveal(false); }}>NEW CHART</button>
          </div>
          <header className="psVerdict">
            <p><i /> BULLSEYE PRE-TRADE DECISION AUDIT</p>
            <div className="psVerdictTop"><h1><small>SETUP GRADE</small><em data-grade={analysis.setupScore.grade}>{analysis.setupScore.grade}</em></h1><div><small>{analysis.setupScore.overall}/100</small><strong data-verdict={analysis.verdict}>{analysis.verdict.replaceAll("_", " ")}</strong></div></div>
            <h2>{analysis.verdictHeadline}</h2><span>{analysis.summary}</span>
            <b>CONDITIONAL DECISION SUPPORT · NOT A TRADE INSTRUCTION</b>
          </header>
          <section className="psDecisionCompass">
            <header><span>DECISION COMPASS</span><b>EVIDENCE · NOT ODDS</b></header>
            <div className="psCompassBody">
              <div className="psCompassDial" data-direction={analysis.direction}>
                <i /><strong>{analysis.direction}</strong><small>{analysis.verdict.replaceAll("_", " ")}</small>
              </div>
              <div className="psCompassSignals">
                <article data-signal="bull" data-active={analysis.direction === "BULLISH"}><span>🐂 BULL CASE</span><strong>{analysis.direction === "BULLISH" ? "ACTIVE READ" : "SECONDARY"}</strong></article>
                <article data-signal="wait" data-active={analysis.direction === "NEUTRAL"}><span>🛡️ PATIENCE</span><strong>{analysis.direction === "NEUTRAL" ? "ACTIVE READ" : "ALWAYS VALID"}</strong></article>
                <article data-signal="bear" data-active={analysis.direction === "BEARISH"}><span>🐻 BEAR CASE</span><strong>{analysis.direction === "BEARISH" ? "ACTIVE READ" : "SECONDARY"}</strong></article>
              </div>
            </div>
          </section>
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
          <section className="psNextSequence">
            <header><span>⏱️ WHAT MUST HAPPEN NEXT?</span><b>CONDITIONAL SEQUENCE</b></header>
            <ol>{([
              ["NOW",analysis.nextSequence.now],["CONFIRM",analysis.nextSequence.confirmation],["FAILURE",analysis.nextSequence.failure]
            ] as const).map(([label,copy],index) => <li key={label}><i>{index + 1}</i><div><strong>{label}</strong><p>{copy}</p></div></li>)}</ol>
          </section>
          {analysis.missingInputs.length || refinementStatus !== "idle" ? <section className="psMissingInputs" data-refined={refinementStatus === "updated"} aria-busy={refinementStatus === "analysing"}><header><span>📷 {refinementStatus === "updated" ? "SECOND VIEW RESULT" : "ONE MORE VIEW COULD HELP"}</span><b>{refinementStatus === "analysing" ? "COMPARING BOTH…" : refinementStatus === "updated" ? analysis.contextContribution?.materialChange ? "ANALYSIS CHANGED" : "READ CONFIRMED" : "ONLY IF AVAILABLE"}</b></header>{refinementStatus === "updated" && contextImage ? <div className="psViewComparison"><div className="psViewPair"><figure><img src={image ?? ""} alt="Original trading chart" /><figcaption>ORIGINAL</figcaption></figure><i>＋</i><figure><img src={contextImage} alt="Supporting chart" /><figcaption>SECOND VIEW</figcaption></figure></div><p>{analysis.contextContribution?.summary || "The supporting chart was compared with the original analysis."}</p><div className="psRefineDelta"><article><span>SCORE</span><strong>{refinementBefore ? `${analysis.setupScore.overall - refinementBefore.setupScore.overall >= 0 ? "+" : ""}${analysis.setupScore.overall - refinementBefore.setupScore.overall}` : "—"}</strong></article><article><span>VERDICT</span><strong>{refinementBefore && refinementBefore.verdict !== analysis.verdict ? `${refinementBefore.verdict.replaceAll("_", " ")} → ${analysis.verdict.replaceAll("_", " ")}` : "UNCHANGED"}</strong></article><article><span>EVIDENCE</span><strong>{analysis.contextContribution?.materialChange ? "MATERIAL" : "CONFIRMING"}</strong></article></div>{analysis.contextContribution?.resolvedInputs.length ? <small>RESOLVED · {analysis.contextContribution.resolvedInputs.join(" · ")}</small> : null}</div> : analysis.missingInputs.length ? <ul>{analysis.missingInputs.slice(0, 2).map((item) => <li key={item}>{item}</li>)}</ul> : null}<footer><div><strong>{refinementStatus === "analysing" ? "USING BOTH CHARTS" : refinementStatus === "updated" ? "COMPARISON COMPLETE" : "HAVE THAT VIEW?"}</strong><span>{refinementStatus === "analysing" ? "Keeping this result open while Bullseye refines it." : refinementStatus === "updated" ? "Both charts now inform the result above." : "Add a chart view that answers one of the points above."}</span></div><label>{refinementStatus === "analysing" ? "WORKING…" : refinementStatus === "updated" ? "CHANGE VIEW" : "＋ ADD PHOTO"}<input disabled={refinementStatus === "analysing"} aria-label="Add a supporting chart photo" accept="image/jpeg,image/png,image/webp" type="file" onChange={addResultContextFile} /></label></footer>{refinementStatus === "error" && error ? <p className="psRefineError" role="alert">{error}</p> : null}</section> : null}
          <section className="psScorecard">
            {([['STRUCTURE','structure'],['MOMENTUM','momentum'],['LOCATION','location'],['CONFIRMATION','confirmation'],['RISK CLARITY','riskClarity'],['EVENT SAFETY','eventSafety']] as const).map(([label,key]) => <article key={key}><span>{label}</span><strong>{analysis.setupScore[key]}/10</strong><i><b style={{ width: `${analysis.setupScore[key] * 10}%` }} /></i></article>)}
          </section>
          <div className="psConfidence">
            <div><span>CONFIDENCE</span><strong>{analysis.confidence}</strong></div>
            <div><span>INSTRUMENT</span><strong>{analysis.instrument}</strong></div>
            <div><span>TIMEFRAME</span><strong>{analysis.timeframe}</strong></div>
          </div>
          <section className="psResultChart psChartWorkspace psBattleWorkspace">
            <header><div><span>🎯 PRICE BATTLEFIELD</span><small>{analysis.levels.filter((level) => numericLevel(level.price) !== null).length} VERIFIED LEVELS</small></div><button type="button" onClick={() => setChartFocus(true)}>EXPAND</button></header>
            <PriceBattlefield analysis={analysis} />
            <details className="psSourceEvidence"><summary>VIEW ORIGINAL SOURCE CHART <b>＋</b></summary>{sourceChart()}</details>
          </section>
          <section className="psNarrative">
            <header><span>LEVEL-TO-LEVEL STORY</span><b>CONDITIONAL ROADMAP</b></header>
            <p>{analysis.levelStory}</p>
            <div><article><span>STRUCTURE</span><p>{analysis.marketStructure}</p></article><article><span>MOMENTUM / RSI</span><p>{analysis.momentum}</p></article></div>
          </section>
          <section className="psCases">
            <article data-tone="bull"><span>BULL CASE</span><p>{analysis.bullishCase}</p><strong>CONFIRMATION</strong><p>{analysis.bullConfirmation}</p></article>
            <article data-tone="bear"><span>BEAR CASE</span><p>{analysis.bearishCase}</p><strong>CONFIRMATION</strong><p>{analysis.bearConfirmation}</p></article>
          </section>
          <section className="psDecisionGrid"><article><span>STAND ASIDE WHEN</span><p>{analysis.noTradeCondition}</p></article><article><span>DECISION CHECKLIST</span><ol>{analysis.checklist.map((item) => <li key={item}>{item}</li>)}</ol></article></section>
          <section className="psIntel">
            <article><span>VISIBLE INDICATORS</span><p>{analysis.indicators.length ? analysis.indicators.join(" · ") : "No indicator can be read reliably from this image."}</p></article>
            <article data-risk><span>INVALIDATION & RISK</span><p>{analysis.invalidation}</p><ul>{analysis.riskFlags.map((risk) => <li key={risk}>{risk}</li>)}</ul></article>
          </section>
          <section className="psEventDeck">
            <header><span>VERIFIED EVENT RADAR</span><b>{macroContext.status.toUpperCase()}</b></header>
            <p>Relevant categories: {analysis.relevantEventTypes.length ? analysis.relevantEventTypes.join(" · ") : "No category identified safely"}</p>
            {macroContext.releases.length ? <ol>{macroContext.releases.slice(0, 6).map((event) => <li key={event.id}><time>{formatEventTime(event.scheduledAt)}</time><strong>{event.name}</strong><span>{event.agency} · {event.risk} IMPACT</span></li>)}</ol> : <div className="psEventEmpty">No verified official release rows are available in the current window.</div>}
            {analysis.ticker !== "UNKNOWN" && analysis.evidenceQuality.instrumentConfidence === "HIGH" ? <div className="psStockEvents"><strong>{analysis.ticker} · VERIFIED COMPANY LOOKUP</strong>{stockEventStatus === "loading" ? <p>Checking the connected company calendar…</p> : stockEvents.length ? <ol>{stockEvents.map((event) => <li key={event.id}><time>{event.date}</time><b>{event.type}</b><span>{event.detail} · {event.source}</span></li>)}</ol> : <p>No verified upcoming corporate event was returned by the connected feed.</p>}<a href={`https://www.sec.gov/edgar/browse/?CIK=${encodeURIComponent(analysis.ticker)}&owner=exclude&action=getcompany`} target="_blank" rel="noreferrer">OPEN OFFICIAL SEC FILINGS ↗</a></div> : <div className="psTickerHold"><strong>COMPANY LOOKUP PAUSED</strong><p>Bullseye will not query company data until the ticker is clearly visible and identified with high confidence.</p></div>}
            <footer>Official macro rows are scheduled facts, not live prices. Company events use the connected provider; SEC filings open from the official EDGAR service. No quote is labelled LIVE unless a licensed feed supplies a timestamp.</footer>
          </section>
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
            <summary><span>RESULT OPTIONS</span><small>SAVE · CHART · SHARE</small><b>＋</b></summary>
            <div>
              <button type="button" onClick={lockDecision}><i>▣</i><span><strong>SAVE</strong><small>Review this decision later</small></span></button>
              <button type="button" onClick={() => setChartFocus(true)}><i>⛶</i><span><strong>BATTLEFIELD</strong><small>Open full screen</small></span></button>
              <button type="button" onClick={shareDecision}><i>↗</i><span><strong>SHARE</strong><small>Decision summary only</small></span></button>
            </div>
            <p>Saved decisions stay privately on this device. Shared summaries never include the uploaded screenshot.</p>
          </details>
        </section>
        {chartFocus && (
          <section className="psChartFocus psBattleFocus" aria-modal="true" role="dialog" aria-label="Full-screen Bullseye price battlefield">
            <header><span>PRICE BATTLEFIELD · {analysis.instrument}</span><button type="button" onClick={() => setChartFocus(false)}>CLOSE</button></header>
            <PriceBattlefield analysis={analysis} expanded />
            <details className="psSourceEvidence"><summary>VIEW ORIGINAL SOURCE CHART <b>＋</b></summary>{sourceChart(true)}</details>
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
            <button type="button" onClick={() => setShowResultReveal(false)}>OPEN MY FULL RESULT <b>→</b></button>
            <small>CONDITIONAL DECISION SUPPORT · NOT A TRADE INSTRUCTION</small>
          </section>
        )}
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
        <label className="psUpload" data-loaded={image ? "true" : "false"}>
          {image ? <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
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
        {image && <section className="psAutoPreview"><header><span>SOURCE CHART READY</span><b>AI DECISION MAP NEXT</b></header>{sourceChart()}<p>Bullseye will transform verified prices into a calibrated Price Battlefield—without drawing over your screenshot.</p></section>}
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
        <div className="psEvents"><header><span>VERIFIED EVENT LAYER</span><b>{macroContext.status.toUpperCase()}</b></header><div><strong>OFFICIAL MACRO CALENDAR</strong><p>{macroContext.releases.length ? `${macroContext.releases.length} verified upcoming release${macroContext.releases.length === 1 ? "" : "s"} available for the decision audit.` : "No official release rows are available in the current window. Event safety will be marked unknown."}</p></div></div>
      </section>
    </main>
  );
}
