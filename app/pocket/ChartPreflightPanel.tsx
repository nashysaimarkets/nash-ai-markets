"use client";

import { useEffect, useRef, useState } from "react";
import type { ChartConfirmation, ChartPreflight, PreflightStatus } from "./chart-preflight";

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
    const controller = new AbortController();
    statusHandler.current("CHECKING"); confirmationHandler.current(null);
    let finished = false;
    const timeout = window.setTimeout(() => {
      if (finished) return;
      finished = true;
      controller.abort();
      setStatus("UNAVAILABLE"); statusHandler.current("UNAVAILABLE"); confirmationHandler.current(null);
      setMessage("Preflight timed out. You may continue to analysis.");
    }, 35_000);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/pocket/preflight", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image, contextImage: contextImage || "" }), signal: controller.signal });
        const payload = await response.json() as { preflight?: ChartPreflight; error?: string };
        if (!response.ok || !payload.preflight) throw new Error(payload.error || "Preflight unavailable");
        if (finished) return;
        finished = true;
        const next = payload.preflight;
        setResult(next);
        setInstrument(next.instrumentConfidence === "UNKNOWN" ? "" : next.instrument);
        setTimeframe(next.timeframeConfidence === "UNKNOWN" ? "" : next.timeframe);
        setCurrentPrice(next.currentPriceConfidence === "UNKNOWN" ? "" : next.currentPrice);
        const nextStatus: PreflightStatus = next.status;
        setStatus(nextStatus); statusHandler.current(nextStatus);
        const detectedInstrument = next.instrumentConfidence === "UNKNOWN" ? "" : next.instrument.trim();
        const detectedTimeframe = next.timeframeConfidence === "UNKNOWN" ? "" : next.timeframe.trim();
        confirmationHandler.current(detectedInstrument && detectedTimeframe ? {
          instrument: detectedInstrument,
          timeframe: detectedTimeframe,
          currentPrice: next.currentPriceConfidence === "UNKNOWN" ? "" : next.currentPrice.trim(),
          contextMatch: contextImage && next.sameInstrument === true ? "MATCHED" : "NOT_PROVIDED",
        } : null);
      } catch (error) {
        if (finished) return;
        if (error instanceof Error && error.name === "AbortError") return;
        finished = true;
        setStatus("UNAVAILABLE"); statusHandler.current("UNAVAILABLE"); confirmationHandler.current(null);
        setMessage(error instanceof Error ? error.message : "Preflight unavailable");
      }
    }, 300);
    return () => { finished = true; window.clearTimeout(timer); window.clearTimeout(timeout); controller.abort(); };
  }, [image, contextImage]);

  if (status === "CHECKING") return <section id="pocket-preflight-lock" className="psPreflight" data-status="CHECKING"><header><span>◉ AUTOMATIC CHART PREFLIGHT</span><strong>CHECKING BEFORE ANALYSIS…</strong></header><div className="psPreflightScan"><i /></div><p>Reading labels, scale, candles and visible history.</p></section>;
  if (status === "UNAVAILABLE") return <section id="pocket-preflight-lock" className="psPreflight" data-status="UNAVAILABLE"><header><span>◉ AUTOMATIC CHART PREFLIGHT</span><strong>CHECK UNAVAILABLE</strong></header><p>{message} Full analysis remains available.</p></section>;
  if (!result) return null;

  const locked = status === "LOCKED";
  const valid = instrument.trim().length > 1 && timeframe.trim().length > 0 && (!currentPrice.trim() || /^-?\d[\d,.]*$/.test(currentPrice.trim()));
  const lock = () => {
    if (!valid) return;
    const confirmation: ChartConfirmation = {
      instrument: instrument.trim().slice(0, 80),
      timeframe: timeframe.trim().slice(0, 30),
      currentPrice: currentPrice.trim().slice(0, 30),
      contextMatch: contextImage ? "MATCHED" : "NOT_PROVIDED",
    };
    setStatus("LOCKED"); statusHandler.current("LOCKED"); confirmationHandler.current(confirmation);
  };
  const edit = () => { setStatus("AWAITING_CONFIRMATION"); statusHandler.current("AWAITING_CONFIRMATION"); confirmationHandler.current(null); };

  return <section id="pocket-preflight-lock" className="psPreflight psPreflightCompact" data-status={result.status} data-locked={locked}>
    <header><span>◉ CHART READ</span><strong>{result.status === "RETAKE" ? "LIMITED · ANALYSIS STILL AVAILABLE" : locked ? "DETAILS CONFIRMED" : result.status === "LIMITED" ? "USEFUL READ · CHECK LABELS" : "READY"}</strong></header>
    <div className="psDetectedFacts"><b>{instrument || "INSTRUMENT UNREADABLE"}</b><span>{timeframe || "TIMEFRAME UNREADABLE"}</span><em>{currentPrice ? `PRICE ${currentPrice}` : "PRICE UNVERIFIED"}</em></div>
    <details className="psConfirmDetails">
      <summary>CHECK OR EDIT DETECTED DETAILS</summary>
      <div className="psConfirmGrid">
        <label><span>INSTRUMENT</span><input value={instrument} disabled={locked} maxLength={80} placeholder="e.g. US 500" onChange={(event) => setInstrument(event.target.value)} /></label>
        <label><span>TIMEFRAME</span><input value={timeframe} disabled={locked} maxLength={30} placeholder="e.g. 30m" onChange={(event) => setTimeframe(event.target.value)} /></label>
        <label><span>CURRENT PRICE · OPTIONAL</span><input inputMode="decimal" value={currentPrice} disabled={locked} maxLength={30} placeholder="Leave blank if unclear" onChange={(event) => setCurrentPrice(event.target.value)} /></label>
        <article data-pass={!contextImage || result.sameInstrument === true}><span>CONTEXT CHART</span><strong>{!contextImage ? "NOT ADDED" : result.sameInstrument === true ? "MATCHED" : result.sameInstrument === false ? "MISMATCH" : "UNCONFIRMED"}</strong></article>
      </div>
      {result.issues.length ? <ul>{result.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : null}
      <p>{result.status === "RETAKE" ? result.guidance : "Correct only what is wrong. An unreadable live-price label withholds exact prices; it does not stop the analysis."}</p>
      <div className="psConfirmActions">{locked ? <><span>✓ YOUR CORRECTIONS OVERRIDE LABEL GUESSES</span><button type="button" onClick={edit}>EDIT</button></> : <button type="button" disabled={!valid} onClick={lock}>CONFIRM DETAILS</button>}</div>
    </details>
    <footer>ANALYSIS CAN CONTINUE · UNVERIFIED NUMBERS ARE WITHHELD</footer>
  </section>;
}
