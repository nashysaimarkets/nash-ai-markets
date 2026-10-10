"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { canLockChartFacts, type ChartConfirmation, type ChartPreflight, type PreflightStatus } from "./chart-preflight";

type ChartPreflightPanelProps = {
  image: string;
  contextImage?: string | null;
  onStatus: (status: PreflightStatus) => void;
  onConfirmation: (confirmation: ChartConfirmation | null) => void;
};

function preflightImageKey(image: string, contextImage: string | null | undefined) {
  let hash = 2166136261;
  const combined = image + "\u0000" + (contextImage || "");
  for (let index = 0; index < combined.length; index += 1) {
    hash = Math.imul(hash ^ combined.charCodeAt(index), 16777619);
  }
  return `${combined.length}:${hash >>> 0}`;
}

export default function ChartPreflightPanel(props: ChartPreflightPanelProps) {
  const key = useMemo(() => preflightImageKey(props.image, props.contextImage), [props.image, props.contextImage]);
  return <ChartPreflightPanelForImage key={key} {...props} />;
}

function ChartPreflightPanelForImage({ image, contextImage, onStatus, onConfirmation }: ChartPreflightPanelProps) {
  const [status, setStatus] = useState<PreflightStatus>("CHECKING");
  const [result, setResult] = useState<ChartPreflight | null>(null);
  const [message, setMessage] = useState("");
  const [instrument, setInstrument] = useState("");
  const [timeframe, setTimeframe] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [contextAcknowledged, setContextAcknowledged] = useState(false);
  const [priceScaleConfirmed, setPriceScaleConfirmed] = useState(false);
  const statusHandler = useRef(onStatus);
  const confirmationHandler = useRef(onConfirmation);
  useEffect(() => { statusHandler.current = onStatus; }, [onStatus]);
  useEffect(() => { confirmationHandler.current = onConfirmation; }, [onConfirmation]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    statusHandler.current("CHECKING"); confirmationHandler.current(null);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/pocket/preflight", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image, contextImage: contextImage || "" }), signal: controller.signal });
        const payload = await response.json() as { preflight?: ChartPreflight; error?: string };
        if (!active) return;
        if (!response.ok || !payload.preflight) throw new Error(payload.error || "Preflight unavailable");
        const next = payload.preflight;
        setResult(next);
        setInstrument(next.instrumentConfidence === "UNKNOWN" ? "" : next.instrument);
        setTimeframe(next.timeframeConfidence === "UNKNOWN" ? "" : next.timeframe);
        setCurrentPrice(next.currentPriceConfidence === "UNKNOWN" ? "" : next.currentPrice);
        const nextStatus: PreflightStatus = next.status === "RETAKE" ? "RETAKE" : "AWAITING_CONFIRMATION";
        setStatus(nextStatus); statusHandler.current(nextStatus);
      } catch (error) {
        if (!active) return;
        if (error instanceof Error && error.name === "AbortError") return;
        setStatus("UNAVAILABLE"); statusHandler.current("UNAVAILABLE"); confirmationHandler.current(null);
        setMessage(error instanceof Error ? error.message : "Preflight unavailable");
      }
    }, 300);
    return () => { active = false; window.clearTimeout(timer); controller.abort(); };
  }, [image, contextImage]);

  if (status === "CHECKING") return <section className="psPreflight" data-status="CHECKING"><header><span>◉ AUTOMATIC CHART PREFLIGHT</span><strong>CHECKING BEFORE ANALYSIS…</strong></header><div className="psPreflightScan"><i /></div><p>Reading labels, scale, candles and visible history.</p></section>;
  if (!result && status !== "UNAVAILABLE" && status !== "LOCKED" && status !== "AWAITING_CONFIRMATION") return null;

  const locked = status === "LOCKED";
  const valid = canLockChartFacts({ instrument, timeframe, currentPrice, hasContext: Boolean(contextImage),
    sameInstrument: result?.sameInstrument ?? null, contextAcknowledged, priceScaleConfirmed,
    retake: result?.status === "RETAKE" || result?.priceScaleVisible === false, candlesReadable: result?.candlesReadable });
  const lock = () => {
    if (!canLockChartFacts({ instrument, timeframe, currentPrice, hasContext: Boolean(contextImage),
      sameInstrument: result?.sameInstrument ?? null, contextAcknowledged, priceScaleConfirmed,
      retake: result?.status === "RETAKE" || result?.priceScaleVisible === false, candlesReadable: result?.candlesReadable })) return;
    const confirmation: ChartConfirmation = {
      instrument: instrument.trim().slice(0, 40),
      timeframe: timeframe.trim().slice(0, 30),
      currentPrice: currentPrice.trim().slice(0, 30),
      contextMatch: contextImage ? "MATCHED" : "NOT_PROVIDED",
    };
    setStatus("LOCKED"); statusHandler.current("LOCKED"); confirmationHandler.current(confirmation);
  };
  const edit = () => { setStatus("AWAITING_CONFIRMATION"); statusHandler.current("AWAITING_CONFIRMATION"); confirmationHandler.current(null); };

  return <section className="psPreflight" data-status={status} data-locked={locked}>
    <header><span>◉ PREFLIGHT CONFIRMATION LOCK</span><strong>{result?.status === "RETAKE" ? "RETAKE RECOMMENDED" : locked ? "CHART FACTS LOCKED" : result?.status === "LIMITED" ? "CHECK & CONFIRM" : "CONFIRM BEFORE ANALYSIS"}</strong></header>
    <div className="psConfirmGrid">
      <label><span>INSTRUMENT</span><input value={instrument} disabled={locked || result?.status === "RETAKE"} maxLength={40} placeholder="e.g. US 500" onChange={(event) => setInstrument(event.target.value)} /></label>
      <label><span>TIMEFRAME</span><input value={timeframe} disabled={locked || result?.status === "RETAKE"} maxLength={30} placeholder="e.g. 30m" onChange={(event) => setTimeframe(event.target.value)} /></label>
      <label><span>CURRENT PRICE</span><input inputMode="decimal" value={currentPrice} disabled={locked || result?.status === "RETAKE"} maxLength={30} placeholder="e.g. 7658.01" onChange={(event) => setCurrentPrice(event.target.value)} /></label>
      <article data-pass={!contextImage || result?.sameInstrument === true}><span>CONTEXT CHART</span><strong>{!contextImage ? "NOT ADDED" : result?.sameInstrument === true ? "MATCHED" : result?.sameInstrument === false ? "MISMATCH" : locked && contextAcknowledged ? "TRADER CONFIRMED" : "UNCONFIRMED"}</strong></article>
    </div>
    {!result ? <p>{message} Confirm the chart facts manually before analysis.</p> : null}
    {contextImage && result?.sameInstrument === false ? <p>Remove or replace the context chart: it shows a different instrument.</p> : null}
    {!locked && result?.status !== "RETAKE" ? <>
      <label><input type="checkbox" checked={priceScaleConfirmed} onChange={(event) => setPriceScaleConfirmed(event.target.checked)} /> I can read the price scale and candles on this chart.</label>
      {contextImage && result?.sameInstrument == null ? <label><input type="checkbox" checked={contextAcknowledged} onChange={(event) => setContextAcknowledged(event.target.checked)} /> I checked that both charts show the same instrument.</label> : null}
    </> : null}
    {result?.issues.length ? <ul>{result.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : null}
    <p>{result?.status === "RETAKE" ? result.guidance : "Check these detected facts against your broker chart. Correct anything wrong, then lock them for the analysis."}</p>
    {result?.status !== "RETAKE" ? <div className="psConfirmActions">{locked ? <><span>✓ CONFIRMED INPUTS WILL OVERRIDE AI LABEL GUESSES</span><button type="button" onClick={edit}>EDIT</button></> : <button type="button" disabled={!valid} onClick={lock}>CONFIRM & LOCK CHART FACTS</button>}</div> : null}
    <footer>{result?.status === "RETAKE" ? "FULL ANALYSIS PAUSED TO AVOID WASTING YOUR REQUEST" : locked ? "LOCKED · READY FOR FULL ANALYSIS" : "FULL ANALYSIS WILL NOT START UNTIL CONFIRMED"}</footer>
  </section>;
}
