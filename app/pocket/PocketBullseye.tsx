"use client";

import { ChangeEvent, useEffect, useState } from "react";
import type { VerifiedMacroContext } from "../lib/macro-data";

type Direction = "BULLISH" | "BEARISH" | "NEUTRAL";
type Level = { kind: "support" | "resistance" | "trend"; label: string; price: string; y: number };
type FibLevel = { ratio: string; price: string; y: number };
type StudyName = "RSI" | "EMA" | "MACD" | "BOLLINGER" | "VWAP" | "ATR" | "FIBONACCI";
type StudyReading = { name: StudyName; status: "APPLIED" | "VISIBLE" | "UNAVAILABLE"; signal: "BULLISH" | "BEARISH" | "NEUTRAL" | "UNKNOWN"; detail: string };
type Intention = "LONG" | "SHORT" | "UNSURE";
type SetupScore = { overall: number; grade: "A" | "B" | "C" | "D" | "F"; structure: number; momentum: number; location: number; confirmation: number; riskClarity: number; eventSafety: number };
type Analysis = {
  direction: Direction;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  instrument: string;
  ticker: string;
  timeframe: string;
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
  studyReadings: StudyReading[];
  levels: Level[];
  fibLevels: FibLevel[];
};
type StockEvent = { id: string; type: "EARNINGS" | "DIVIDEND" | "SPLIT"; date: string; detail: string; source: string };

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const POPULAR_STUDIES: Array<{ name: StudyName; label: string }> = [
  { name: "RSI", label: "RSI 14" }, { name: "EMA", label: "EMA 20/50" }, { name: "MACD", label: "MACD" },
  { name: "BOLLINGER", label: "BOLLINGER" }, { name: "VWAP", label: "VWAP" }, { name: "ATR", label: "ATR 14" }, { name: "FIBONACCI", label: "FIBONACCI" },
];

function clampY(y: number) {
  return Math.max(5, Math.min(95, Number.isFinite(y) ? y : 50));
}

function formatEventTime(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London", timeZoneName: "short" }).format(parsed);
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
  const [visibleOverlays, setVisibleOverlays] = useState(() => new Set(["support", "resistance", "trend", "fibonacci"]));
  const [requestedStudies, setRequestedStudies] = useState<StudyName[]>(["FIBONACCI"]);
  const [intention, setIntention] = useState<Intention>("UNSURE");

  useEffect(() => {
    if (!analysis || analysis.ticker === "UNKNOWN") return;
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

  function toggleOverlay(name: string) {
    setVisibleOverlays((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  function toggleStudy(name: StudyName) {
    setRequestedStudies((current) => current.includes(name) ? current.filter((study) => study !== name) : [...current, name]);
  }

  function loadFile(event: ChangeEvent<HTMLInputElement>) {
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
    const reader = new FileReader();
    reader.onload = () => {
      setImage(String(reader.result));
      setFileName(file.name);
    };
    reader.readAsDataURL(file);
  }

  async function analyse() {
    if (!image || !privacyChecked || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/pocket/analyse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image, requestedStudies, intention }),
      });
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
      {analysis && visibleOverlays.has("fibonacci") && analysis.fibLevels.map((level, index) => (
        <i key={`fib-${level.ratio}-${index}`} data-tool="fibonacci" style={{ top: `${clampY(level.y)}%` }}><span>FIB {level.ratio}{level.price ? ` · ${level.price}` : ""}</span></i>
      ))}
    </div>
  ) : null;

  if (analysis) {
    return (
      <main className="psApp">
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
          <section className="psScorecard">
            {([['STRUCTURE','structure'],['MOMENTUM','momentum'],['LOCATION','location'],['CONFIRMATION','confirmation'],['RISK CLARITY','riskClarity'],['EVENT SAFETY','eventSafety']] as const).map(([label,key]) => <article key={key}><span>{label}</span><strong>{analysis.setupScore[key]}/10</strong><i><b style={{ width: `${analysis.setupScore[key] * 10}%` }} /></i></article>)}
          </section>
          <section className="psAuditGrid"><article data-audit="missing"><span>WHAT YOU MAY BE MISSING</span><ul>{analysis.whatYouMayBeMissing.map((item) => <li key={item}>{item}</li>)}</ul></article><article data-audit="improve"><span>WHAT IMPROVES IT</span><ul>{analysis.improvesSetup.map((item) => <li key={item}>{item}</li>)}</ul></article><article data-audit="kill"><span>WHAT KILLS IT</span><ul>{analysis.killsSetup.map((item) => <li key={item}>{item}</li>)}</ul></article><article data-audit="trap"><span>TRADER TRAP</span><p>{analysis.traderTrap}</p></article></section>
          <div className="psConfidence">
            <div><span>CONFIDENCE</span><strong>{analysis.confidence}</strong></div>
            <div><span>INSTRUMENT</span><strong>{analysis.instrument}</strong></div>
            <div><span>TIMEFRAME</span><strong>{analysis.timeframe}</strong></div>
          </div>
          <nav className="psOverlayBar" aria-label="Chart overlays">
            {(["support", "resistance", "trend", "fibonacci"] as const).map((overlay) => <button key={overlay} type="button" data-active={visibleOverlays.has(overlay)} onClick={() => toggleOverlay(overlay)}>{overlay === "fibonacci" ? "FIB" : overlay.toUpperCase()}</button>)}
          </nav>
          <section className="psResultChart">
            <header><span>ANNOTATED CHART</span><button type="button" onClick={() => setChartFocus(true)}>FULL SCREEN</button></header>
            <div>{annotatedChart()}</div>
          </section>
          <section className="psLevelDeck">
            <header><span>VISIBLE LEVEL MAP</span><b>VERIFY ON YOUR PLATFORM</b></header>
            {levels.length ? levels.map((level, index) => (
              <div key={`${level.label}-${index}`}><span>{level.label}</span><i /><strong>{level.price || `${Math.round(level.y)}%`}</strong></div>
            )) : <div><span>NO RELIABLE LEVEL</span><i /><strong>UNREADABLE</strong></div>}
          </section>
          <section className="psNarrative">
            <header><span>LEVEL-TO-LEVEL STORY</span><b>CONDITIONAL ROADMAP</b></header>
            <p>{analysis.levelStory}</p>
            <div><article><span>STRUCTURE</span><p>{analysis.marketStructure}</p></article><article><span>MOMENTUM / RSI</span><p>{analysis.momentum}</p></article></div>
          </section>
          <section className="psStudyResults">
            <header><span>REQUESTED STUDIES</span><b>AUTOMATIC · EVIDENCE-GATED</b></header>
            <div>{analysis.studyReadings.map((study) => <article key={study.name} data-status={study.status}><span>{study.name}</span><strong>{study.status}</strong><b data-signal={study.signal}>{study.signal}</b><p>{study.detail}</p></article>)}</div>
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
            {analysis.ticker !== "UNKNOWN" ? <div className="psStockEvents"><strong>{analysis.ticker} CORPORATE EVENTS</strong>{stockEventStatus === "loading" ? <p>Checking verified company calendar…</p> : stockEvents.length ? <ol>{stockEvents.map((event) => <li key={event.id}><time>{event.date}</time><b>{event.type}</b><span>{event.detail}</span></li>)}</ol> : <p>No verified upcoming corporate event was returned for this symbol.</p>}</div> : null}
            <footer>Corporate rows appear only when the chart contains a reliable listed-company ticker and the provider responds. Dates must be confirmed with the issuer or exchange.</footer>
          </section>
          <div className="psResultActions">
            <button type="button" onClick={() => setImmersive(false)}>COMPACT VIEW</button>
            <button type="button" onClick={() => setChartFocus(true)}>OPEN CHART FULL SCREEN</button>
          </div>
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
    <main className="psApp">
      <header className="psHeader">
        <div className="psLogo"><span className="psLogoMark"><i /></span><span><strong>BULLSEYE</strong><small>POCKET ANALYSIS</small></span></div>
        <div className="psHeaderActions"><span>PRIVATE BETA</span></div>
      </header>
      <section className="psScanner">
        <div className="psCopy"><p><i /> PRIVATE PRE-TRADE AUDIT</p><h1>Pause before<br /><em>you press buy.</em></h1><span>Load the chart you are considering. Bullseye grades the setup, challenges your bias and tells you what a patient trader would wait for.</span></div>
        <label className="psUpload" data-loaded={image ? "true" : "false"}>
          {image ? <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="Selected chart preview" />
          </> : <div className="psTarget psTargetLarge" aria-hidden="true"><i /><i /><b /><b /></div>}
          <div className="psScanLine" aria-hidden="true" /><strong>{image ? "CHART LOADED" : "LOAD CHART"}</strong><small>{image ? fileName : "PHOTO · SCREENSHOT · CAMERA ROLL"}</small>
          <input aria-label="Load chart photo, screenshot or camera roll image" accept="image/jpeg,image/png,image/webp" type="file" onChange={loadFile} />
        </label>
        <div className="psCaptureRow"><label>USE CAMERA<input aria-label="Use camera" accept="image/*" capture="environment" type="file" onChange={loadFile} /></label><span>OR CHOOSE FROM CAMERA ROLL ABOVE</span></div>
        {image && <section className="psIntent"><header><span>WHAT ARE YOU CONSIDERING?</span><b>ONE TAP · NO ORDER IS PLACED</b></header><div>{(["LONG","SHORT","UNSURE"] as const).map((value) => <button key={value} type="button" data-active={intention === value} onClick={() => setIntention(value)}>{value === "UNSURE" ? "JUST ANALYSE" : value}</button>)}</div></section>}
        {image && <section className="psAutoPreview"><header><span>AUTOMATIC ANALYSIS</span><b>NO MANUAL DRAWING</b></header>{annotatedChart()}<p>Bullseye will detect and place only the levels and overlays it can justify from the screenshot.</p></section>}
        {image && <section className="psStudyPicker"><header><span>POPULAR INDICATORS</span><b>CHOOSE WHAT BULLSEYE CHECKS</b></header><div>{POPULAR_STUDIES.map((study) => <button key={study.name} type="button" data-active={requestedStudies.includes(study.name)} onClick={() => toggleStudy(study.name)}>{study.label}</button>)}</div><p>Selected studies are checked automatically. Hidden studies requiring candle or volume data are never guessed from the screenshot.</p></section>}
        <label className="psPrivacy"><input type="checkbox" checked={privacyChecked} onChange={(event) => setPrivacyChecked(event.target.checked)} /><span><strong>PRIVACY SHIELD</strong>I removed my name, account number, balance and notifications.</span></label>
        {error && <p className="psMessage" role="alert">{error}</p>}
        <button className="psAnalyse" type="button" disabled={!image || !privacyChecked || busy} onClick={analyse}>{busy ? "CHALLENGING THE SETUP…" : "RUN PRE-TRADE CHECK"}<b>◎</b></button>
        <div className="psEvents"><header><span>VERIFIED EVENT LAYER</span><b>{macroContext.status.toUpperCase()}</b></header><div><strong>OFFICIAL MACRO CALENDAR</strong><p>{macroContext.releases.length ? `${macroContext.releases.length} verified upcoming release${macroContext.releases.length === 1 ? "" : "s"} available for the decision audit.` : "No official release rows are available in the current window. Event safety will be marked unknown."}</p></div></div>
      </section>
    </main>
  );
}
