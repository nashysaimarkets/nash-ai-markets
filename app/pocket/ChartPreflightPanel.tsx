"use client";

import { useEffect, useRef, useState } from "react";
import type { ChartConfirmation, ChartPreflight, PreflightStatus } from "./chart-preflight";
import { pocketClientCacheKey, pocketClientHeaders } from "./pocket-client-id";

type PreflightPayload = { preflight?: ChartPreflight; error?: string; code?: string; responseOk: boolean };
const PREFLIGHT_CACHE_TTL_MS = 24 * 60 * 60_000;
const preflightRequests = new Map<string, Promise<PreflightPayload>>();

async function requestPreflight(image: string, contextImage: string) {
  const cacheKey = await pocketClientCacheKey("pocket-preflight-v1", [image, contextImage]);
  try {
    const stored = JSON.parse(sessionStorage.getItem(`pocket-preflight:${cacheKey}`) ?? "null") as { payload?: PreflightPayload; createdAt?: number } | null;
    if (stored?.payload?.preflight && typeof stored.createdAt === "number" && Date.now() - stored.createdAt < PREFLIGHT_CACHE_TTL_MS) return stored.payload;
  } catch {}
  const active = preflightRequests.get(cacheKey);
  if (active) return active;
  const pending = (async () => {
    const response = await fetch("/api/pocket/preflight", {
      method: "POST",
      headers: { "content-type": "application/json", ...pocketClientHeaders() },
      body: JSON.stringify({ image, contextImage }),
    });
    const payload = await response.json() as Omit<PreflightPayload, "responseOk">;
    const result = { ...payload, responseOk: response.ok };
    if (response.ok && payload.preflight) {
      try { sessionStorage.setItem(`pocket-preflight:${cacheKey}`, JSON.stringify({ payload: result, createdAt: Date.now() })); } catch {}
    }
    return result;
  })().finally(() => preflightRequests.delete(cacheKey));
  preflightRequests.set(cacheKey, pending);
  return pending;
}

type ChartPreflightPanelProps = {
  image: string;
  contextImage?: string | null;
  onStatus: (status: PreflightStatus) => void;
  onConfirmation: (confirmation: ChartConfirmation | null) => void;
};

export default function ChartPreflightPanel(props: ChartPreflightPanelProps) {
  return <ChartPreflightForImage key={props.image} {...props} />;
}

function ChartPreflightForImage(props: ChartPreflightPanelProps) {
  return <ChartPreflightRequest key={props.contextImage ?? ""} {...props} />;
}

function ChartPreflightRequest({ image, contextImage, onStatus, onConfirmation }: ChartPreflightPanelProps) {
  const [status, setStatus] = useState<PreflightStatus>("CHECKING");
  const [result, setResult] = useState<ChartPreflight | null>(null);
  const [message, setMessage] = useState("");
  const [instrument, setInstrument] = useState("");
  const [timeframe, setTimeframe] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const statusHandler = useRef(onStatus);
  const confirmationHandler = useRef(onConfirmation);
  useEffect(() => { statusHandler.current = onStatus; }, [onStatus]);
  useEffect(() => { confirmationHandler.current = onConfirmation; }, [onConfirmation]);

  useEffect(() => {
    statusHandler.current("CHECKING"); confirmationHandler.current(null);
    let finished = false;
    const timeout = window.setTimeout(() => {
      if (finished) return;
      finished = true;
      setStatus("UNAVAILABLE"); statusHandler.current("UNAVAILABLE"); confirmationHandler.current(null);
      setMessage("Preflight timed out. You may continue to analysis.");
    }, 35_000);
    const timer = window.setTimeout(async () => {
      try {
        const payload = await requestPreflight(image, contextImage || "");
        if (["AI_CREDITS_UNAVAILABLE", "AI_DISABLED"].includes(payload.code ?? "")) {
          if (finished) return;
          finished = true;
          setStatus("SERVICE_UNAVAILABLE"); statusHandler.current("SERVICE_UNAVAILABLE"); confirmationHandler.current(null);
          setMessage(payload.error || "Analysis service is temporarily unavailable. Your chart has not been rejected.");
          return;
        }
        if (!payload.responseOk || !payload.preflight) throw new Error(payload.error || "Preflight unavailable");
        if (finished) return;
        finished = true;
        const next = payload.preflight;
        setResult(next);
        setInstrument(next.instrumentConfidence === "UNKNOWN" ? "" : next.instrument);
        setTimeframe(next.timeframeConfidence === "UNKNOWN" ? "" : next.timeframe);
        setCurrentPrice(next.currentPriceConfidence === "UNKNOWN" ? "" : next.currentPrice);
        const nextStatus: PreflightStatus = next.status === "RETAKE" ? "RETAKE" : "AWAITING_CONFIRMATION";
        setStatus(nextStatus); statusHandler.current(nextStatus);
      } catch (error) {
        if (finished) return;
        finished = true;
        setStatus("UNAVAILABLE"); statusHandler.current("UNAVAILABLE"); confirmationHandler.current(null);
        setMessage(error instanceof Error ? error.message : "Preflight unavailable");
      }
    }, 300);
    return () => { finished = true; window.clearTimeout(timer); window.clearTimeout(timeout); };
  }, [image, contextImage]);

  if (status === "CHECKING") return <section id="pocket-preflight-lock" className="psPreflight" data-status="CHECKING"><header><span>◉ AUTOMATIC CHART PREFLIGHT</span><strong>CHECKING BEFORE ANALYSIS…</strong></header><div className="psPreflightScan"><i /></div><p>Reading labels, scale, candles and visible history.</p></section>;
  if (status === "SERVICE_UNAVAILABLE") return <section id="pocket-preflight-lock" className="psPreflight" data-status="SERVICE_UNAVAILABLE"><header><span>◉ ANALYSIS SERVICE</span><strong>TEMPORARILY UNAVAILABLE</strong></header><p>{message}</p></section>;
  if (status === "UNAVAILABLE") return <section id="pocket-preflight-lock" className="psPreflight" data-status="UNAVAILABLE"><header><span>◉ AUTOMATIC CHART PREFLIGHT</span><strong>CHECK UNAVAILABLE</strong></header><p>{message} Full analysis remains available.</p></section>;
  if (!result) return null;

  const locked = status === "LOCKED";
  const valid = instrument.trim().length > 1 && timeframe.trim().length > 0 && /^-?\d[\d,.]*$/.test(currentPrice.trim());
  const lock = () => {
    if (!valid || result.status === "RETAKE") return;
    const confirmation: ChartConfirmation = {
      instrument: instrument.trim().slice(0, 80),
      timeframe: timeframe.trim().slice(0, 30),
      currentPrice: currentPrice.trim().slice(0, 30),
      contextMatch: contextImage ? "MATCHED" : "NOT_PROVIDED",
    };
    setStatus("LOCKED"); statusHandler.current("LOCKED"); confirmationHandler.current(confirmation);
  };
  const edit = () => { setStatus("AWAITING_CONFIRMATION"); statusHandler.current("AWAITING_CONFIRMATION"); confirmationHandler.current(null); };

  return <section id="pocket-preflight-lock" className="psPreflight" data-status={result.status} data-locked={locked}>
    <header><span>◉ PREFLIGHT CONFIRMATION LOCK</span><strong>{result.status === "RETAKE" ? "RETAKE RECOMMENDED" : locked ? "CHART FACTS LOCKED" : result.status === "LIMITED" ? "CHECK & CONFIRM" : "CONFIRM BEFORE ANALYSIS"}</strong></header>
    <div className="psConfirmGrid">
      <label><span>INSTRUMENT</span><input value={instrument} disabled={locked || result.status === "RETAKE"} maxLength={80} placeholder="e.g. US 500" onChange={(event) => setInstrument(event.target.value)} /></label>
      <label><span>TIMEFRAME</span><input value={timeframe} disabled={locked || result.status === "RETAKE"} maxLength={30} placeholder="e.g. 30m" onChange={(event) => setTimeframe(event.target.value)} /></label>
      <label><span>CURRENT PRICE</span><input inputMode="decimal" value={currentPrice} disabled={locked || result.status === "RETAKE"} maxLength={30} placeholder="e.g. 7658.01" onChange={(event) => setCurrentPrice(event.target.value)} /></label>
      <article data-pass={!contextImage || result.sameInstrument === true}><span>CONTEXT CHART</span><strong>{!contextImage ? "NOT ADDED" : result.sameInstrument === true ? "MATCHED" : result.sameInstrument === false ? "MISMATCH" : "UNCONFIRMED"}</strong></article>
    </div>
    {result.issues.length ? <ul>{result.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : null}
    <p>{result.status === "RETAKE" ? result.guidance : "Check these detected facts against your broker chart. Correct anything wrong, then lock them for the analysis."}</p>
    {result.status !== "RETAKE" ? <div className="psConfirmActions">{locked ? <><span>✓ CONFIRMED INPUTS WILL OVERRIDE AI LABEL GUESSES</span><button type="button" onClick={edit}>EDIT</button></> : <button type="button" disabled={!valid} onClick={lock}>CONFIRM & LOCK CHART FACTS</button>}</div> : null}
    <footer>{result.status === "RETAKE" ? "FULL ANALYSIS PAUSED TO AVOID WASTING YOUR REQUEST" : locked ? "LOCKED · READY FOR FULL ANALYSIS" : "FULL ANALYSIS WILL NOT START UNTIL CONFIRMED"}</footer>
  </section>;
}
