"use client";

import { ChangeEvent, useEffect, useState } from "react";
import type { VerifiedMacroContext } from "../lib/macro-data";

type Direction = "BULLISH" | "BEARISH" | "NEUTRAL";
type ToolKind = "support" | "resistance" | "trend" | "pivot" | "zone" | "gap";
type Level = { kind: ToolKind; label: string; price: string; y: number };
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
  levels: Level[];
  fibLevels: FibLevel[];
};
type StockEvent = { id: string; type: "EARNINGS" | "DIVIDEND" | "SPLIT"; date: string; detail: string; source: string };
type LockedDecision = { id: string; createdAt: string; intention: Intention; image: string; analysis: Analysis };
type ProcessReview = { outcome: "PROFIT" | "LOSS" | "BREAKEVEN" | "UNCLEAR"; processGrade: "A" | "B" | "C" | "D" | "F"; decisionQuality: number; headline: string; outcomeSummary: string; confirmationReview: string; invalidationReview: string; timingReview: string; disciplineReview: string; goodDecisionBadOutcome: boolean; lessons: string[]; behaviourTags: string[] };

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function clampY(y: number) {
  return Math.max(5, Math.min(95, Number.isFinite(y) ? y : 50));
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
    request.onsuccess = () => resolve((request.result as LockedDecision[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
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
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [immersive, setImmersive] = useState(false);
  const [chartFocus, setChartFocus] = useState(false);
  const [stockEvents, setStockEvents] = useState<StockEvent[]>([]);
  const [stockEventStatus, setStockEventStatus] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
  const [visibleOverlays, setVisibleOverlays] = useState(() => new Set<ToolKind>(["support", "resistance"]));
  const [intention, setIntention] = useState<Intention>("UNSURE");
  const [vault, setVault] = useState<LockedDecision[]>([]);
  const [reviewTarget, setReviewTarget] = useState<LockedDecision | null>(null);
  const [review, setReview] = useState<ProcessReview | null>(null);
  const [vaultMessage, setVaultMessage] = useState("");

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
    if (!immersive && !chartFocus) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [immersive, chartFocus]);

  const levels = analysis?.levels ?? [];
  const displayedLevels = levels.filter((level) => visibleOverlays.has(level.kind));

  function toggleOverlay(name: ToolKind) {
    setVisibleOverlays((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

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

  async function analyse() {
    if (!image || !privacyChecked || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(reviewTarget ? "/api/pocket/review" : "/api/pocket/analyse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(reviewTarget ? { beforeImage: reviewTarget.image, afterImage: image, lockedAnalysis: reviewTarget.analysis } : { image, intention }),
      });
      if (reviewTarget) {
        const payload = await response.json() as { review?: ProcessReview; error?: string };
        if (!response.ok || !payload.review) throw new Error(payload.error || "Review is temporarily unavailable.");
        setReview(payload.review); setImmersive(true); return;
      }
      const payload = await response.json() as { analysis?: Analysis; error?: string };
      if (!response.ok || !payload.analysis) throw new Error(payload.error || "Analysis is temporarily unavailable.");
      payload.analysis.levels = payload.analysis.levels.map((level) => ({ ...level, y: clampY(level.y) }));
      setStockEvents([]);
      setStockEventStatus(payload.analysis.ticker === "UNKNOWN" ? "unavailable" : "loading");
      setAnalysis(payload.analysis);
      setImmersive(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis is temporarily unavailable.");
    } finally {
      setBusy(false);
    }
  }

  async function lockDecision() {
    if (!analysis || !image) return;
    const decision: LockedDecision = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), intention, image, analysis };
    try { await vaultSave(decision); setVault((current) => [decision, ...current]); setVaultMessage("Saved privately on this device. Upload a later chart whenever you want Bullseye to review the decision process."); }
    catch { setVaultMessage("This decision could not be saved on this device."); }
  }

  function startReview(decision: LockedDecision) {
    setReviewTarget(decision); setReview(null); setAnalysis(null); setImage(null); setFileName(""); setImmersive(false); setError("");
  }

  const annotatedChart = (focus = false) => image ? (
    <div
      className={focus ? "psChartFocusCanvas" : "psAnnotatedChart"}
      aria-label="Automatically annotated uploaded chart"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt="Uploaded trading chart" />
      {displayedLevels.map((level, index) => (
        <i key={`${level.kind}-${level.y}-${index}`} data-tool={level.kind} style={{ top: `${clampY(level.y)}%` }}>
          <span>{level.label}{level.price ? ` · ${level.price}` : ""}</span>
        </i>
      ))}
          </div>
  ) : null;

  if (review && reviewTarget) {
    return <main className="psApp" data-pocket-build="v3.1"><section className="psResults" data-immersive="true"><div className="psImmersiveBar"><span>BULLSEYE · PROCESS REVIEW</span><button type="button" onClick={() => { setReview(null); setReviewTarget(null); setImage(null); }}>DONE</button></div><header className="psVerdict psReviewVerdict"><p><i /> BEFORE VS AFTER · OUTCOME IS NOT PROCESS</p><div className="psVerdictTop"><h1><small>PROCESS GRADE</small><em data-grade={review.processGrade}>{review.processGrade}</em></h1><div><small>{review.decisionQuality}/100</small><strong>{review.outcome}</strong></div></div><h2>{review.headline}</h2><span>{review.outcomeSummary}</span></header><section className="psReviewGrid"><article><span>CONFIRMATION</span><p>{review.confirmationReview}</p></article><article><span>INVALIDATION</span><p>{review.invalidationReview}</p></article><article><span>TIMING</span><p>{review.timingReview}</p></article><article><span>DISCIPLINE</span><p>{review.disciplineReview}</p></article></section><section className="psAuditGrid"><article data-audit="improve"><span>LESSONS TO CARRY FORWARD</span><ul>{review.lessons.map((lesson) => <li key={lesson}>{lesson}</li>)}</ul></article><article data-audit="trap"><span>BEHAVIOUR TAGS</span><p>{review.behaviourTags.join(" · ") || "No reliable behaviour tag"}</p></article></section>{review.goodDecisionBadOutcome ? <p className="psProcessNote">GOOD DECISION · BAD OUTCOME — protect the process; do not rewrite it because of one result.</p> : null}<p className="psLegal">Screenshots cannot prove exact execution. Confirm fills and P&amp;L on the original platform.</p></section></main>;
  }

  if (analysis) {
    return (
      <main className="psApp" data-pocket-build="v3.1">
        <section className="psResults" data-immersive={immersive ? "true" : "false"}>
          <div className="psImmersiveBar">
            <span>POCKET BULLSEYE · PRIVATE RESULT</span>
            <button type="button" onClick={() => { setImmersive(false); setAnalysis(null); }}>NEW CHART</button>
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
                <article data-signal="bull" data-active={analysis.direction === "BULLISH"}><span>🐂 BULL PRESSURE</span><p>{analysis.bullConfirmation}</p></article>
                <article data-signal="wait" data-active={analysis.direction === "NEUTRAL"}><span>🛡️ PATIENCE ZONE</span><p>{analysis.noTradeCondition}</p></article>
                <article data-signal="bear" data-active={analysis.direction === "BEARISH"}><span>🐻 BEAR PRESSURE</span><p>{analysis.bearConfirmation}</p></article>
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
              <article data-evidence="seen"><span>👁️ WHAT THE IMAGE ACTUALLY SHOWS</span><ul>{analysis.observableFacts.map((fact) => <li key={fact}>{fact}</li>)}</ul></article>
              <article data-evidence="conflict"><span>⚡ CONFLICTING EVIDENCE</span>{analysis.contradictions.length ? <ul>{analysis.contradictions.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No clear contradiction is visible in this screenshot.</p>}</article>
            </div>
            {analysis.evidenceQuality.limitations.length ? <p className="psEvidenceLimits"><strong>LIMITS:</strong> {analysis.evidenceQuality.limitations.join(" · ")}</p> : null}
          </section>
          <section className="psScorecard">
            {([['STRUCTURE','structure'],['MOMENTUM','momentum'],['LOCATION','location'],['CONFIRMATION','confirmation'],['RISK CLARITY','riskClarity'],['EVENT SAFETY','eventSafety']] as const).map(([label,key]) => <article key={key}><span>{label}</span><strong>{analysis.setupScore[key]}/10</strong><i><b style={{ width: `${analysis.setupScore[key] * 10}%` }} /></i></article>)}
          </section>
          <section className="psAuditGrid"><article data-audit="missing"><span>WHAT YOU MAY BE MISSING</span><ul>{analysis.whatYouMayBeMissing.map((item) => <li key={item}>{item}</li>)}</ul></article><article data-audit="improve"><span>WHAT IMPROVES IT</span><ul>{analysis.improvesSetup.map((item) => <li key={item}>{item}</li>)}</ul></article><article data-audit="kill"><span>WHAT KILLS IT</span><ul>{analysis.killsSetup.map((item) => <li key={item}>{item}</li>)}</ul></article><article data-audit="trap"><span>TRADER TRAP</span><p>{analysis.traderTrap}</p></article></section>
          <div className="psConfidence">
            <div><span>CONFIDENCE</span><strong>{analysis.confidence}</strong></div>
            <div><span>INSTRUMENT</span><strong>{analysis.instrument}</strong></div>
            <div><span>TIMEFRAME</span><strong>{analysis.timeframe}</strong></div>
          </div>
          <section className="psToolDock">
            <header><span>CHART TOOLBOX</span><b>TAP TO SHOW / HIDE</b></header>
            <nav className="psOverlayBar" aria-label="Optional chart overlays">
              {([
                ["support","🟢 SUPPORT"],["resistance","🔴 RESISTANCE"],["trend","📐 TREND"],
                ["pivot","📍 SWING POINTS"],["zone","▰ REACTION ZONES"],["gap","⚡ GAPS"]
              ] as const).map(([overlay,label]) => <button key={overlay} type="button" data-active={visibleOverlays.has(overlay)} disabled={!levels.some((level) => level.kind === overlay)} onClick={() => toggleOverlay(overlay)}>{label}</button>)}
            </nav>
            <p>Support and resistance start on. Optional tools activate only when Bullseye can justify them from visible chart evidence.</p>
          </section>
          <section className="psResultChart">
            <header><span>ANNOTATED CHART</span><button type="button" onClick={() => setChartFocus(true)}>FULL SCREEN</button></header>
            <div>{annotatedChart()}</div>
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
          <div className="psResultActions">
            <button type="button" onClick={lockDecision}>SAVE FOR LATER REVIEW</button>
            <button type="button" onClick={() => setChartFocus(true)}>OPEN CHART FULL SCREEN</button>
          </div>
          <p className="psSaveExplainer">Saved privately on this device. Later, upload an after-chart and Bullseye will review the quality of the original decision—not merely whether it won or lost.</p>
          {vaultMessage ? <p className="psVaultMessage" role="status">{vaultMessage}</p> : null}
          <p className="psLegal">AI can misread screenshots. Confirm instrument, timeframe, prices and levels on the original platform. Educational market preparation only.</p>
        </section>
        {chartFocus && (
          <section className="psChartFocus" aria-modal="true" role="dialog" aria-label="Full-screen annotated chart">
            <header><span>ANNOTATED CHART · {analysis.instrument}</span><button type="button" onClick={() => setChartFocus(false)}>CLOSE</button></header>
            {annotatedChart(true)}
            <footer><div><small>DIRECTIONAL READ</small><strong data-direction={analysis.direction}>{analysis.direction}</strong></div><p>{analysis.summary}</p></footer>
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
        <div className="psCopy"><p><i /> {reviewTarget ? "LOCKED DECISION REVIEW" : "PRIVATE PRE-TRADE AUDIT"}</p><h1>{reviewTarget ? <>What happened<br /><em>after the decision?</em></> : <>Pause before<br /><em>you press buy.</em></>}</h1><span>{reviewTarget ? "Upload the later chart. Bullseye will compare it with the original locked reasoning and grade the process separately from the outcome." : "Load the chart you are considering. Bullseye grades the setup, challenges your bias and tells you what a patient trader would wait for."}</span></div>
        <label className="psUpload" data-loaded={image ? "true" : "false"}>
          {image ? <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="Selected chart preview" />
          </> : <div className="psTarget psTargetLarge" aria-hidden="true"><i /><i /><b /><b /></div>}
          <div className="psScanLine" aria-hidden="true" /><strong>{image ? "CHART LOADED" : "LOAD CHART"}</strong><small>{image ? fileName : "PHOTO · SCREENSHOT · CAMERA ROLL"}</small>
          <input aria-label="Load chart photo, screenshot or camera roll image" accept="image/jpeg,image/png,image/webp" type="file" onChange={loadFile} />
        </label>
        <div className="psCaptureRow"><label>USE CAMERA<input aria-label="Use camera" accept="image/*" capture="environment" type="file" onChange={loadFile} /></label><span>OR CHOOSE FROM CAMERA ROLL ABOVE</span></div>
        {image && !reviewTarget && <section className="psIntent"><header><span>WHAT ARE YOU CONSIDERING?</span></header><div>{(["LONG","SHORT","UNSURE"] as const).map((value) => <button key={value} type="button" data-active={intention === value} onClick={() => setIntention(value)}>{value === "UNSURE" ? "JUST ANALYSE" : value}</button>)}</div></section>}
        {image && <section className="psAutoPreview"><header><span>AUTOMATIC ANALYSIS</span><b>NO MANUAL DRAWING</b></header>{annotatedChart()}<p>Bullseye will detect and place only the levels and overlays it can justify from the screenshot.</p></section>}
        <label className="psPrivacy"><input type="checkbox" checked={privacyChecked} onChange={(event) => setPrivacyChecked(event.target.checked)} /><span><strong>PRIVACY SHIELD</strong>I removed my name, account number, balance and notifications.</span></label>
        {error && <p className="psMessage" role="alert">{error}</p>}
        <button className="psAnalyse" type="button" disabled={!image || !privacyChecked || busy} onClick={analyse}>{busy ? (reviewTarget ? "COMPARING DECISIONS…" : "BULLSEYE IS CHALLENGING YOUR SETUP…") : (reviewTarget ? "RUN BEFORE VS AFTER REVIEW" : "CHALLENGE MY SETUP")}<b>🎯</b></button>
        {!reviewTarget && vault.length ? <section className="psVault"><header><span>SAVED DECISIONS</span><b>PRIVATE · THIS DEVICE</b></header>{vault.slice(0,5).map((decision) => <article key={decision.id}><div><strong>{decision.analysis.instrument}</strong><span>{new Date(decision.createdAt).toLocaleString("en-GB", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })} · {decision.intention}</span></div><b>{decision.analysis.setupScore.grade}</b><button type="button" onClick={() => startReview(decision)}>REVIEW LATER CHART</button></article>)}</section> : null}
        <div className="psEvents"><header><span>VERIFIED EVENT LAYER</span><b>{macroContext.status.toUpperCase()}</b></header><div><strong>OFFICIAL MACRO CALENDAR</strong><p>{macroContext.releases.length ? `${macroContext.releases.length} verified upcoming release${macroContext.releases.length === 1 ? "" : "s"} available for the decision audit.` : "No official release rows are available in the current window. Event safety will be marked unknown."}</p></div></div>
      </section>
    </main>
  );
}
