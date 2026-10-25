"use client";
import { pocketAuthenticatedFetch } from "./apple-storekit";

import { useEffect, useMemo, useRef, useState } from "react";
import { validateChartPreflight, automaticChartConfirmation, type ChartConfirmation, type ChartPreflight, type PreflightStatus } from "./chart-preflight";

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
  const [attempt, setAttempt] = useState(0);
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
        const response = await pocketAuthenticatedFetch("/api/pocket/preflight", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image, contextImage: contextImage || "" }), signal: controller.signal });
        const payload = await response.json() as { preflight?: ChartPreflight; error?: string };
        if (!active) return;
        if (!response.ok || !payload.preflight) throw new Error(payload.error || "Preflight unavailable");
        const next = validateChartPreflight(payload.preflight);
        setResult(next);
        setInstrument(next.instrumentConfidence === "UNKNOWN" ? "" : next.instrument);
        setTimeframe(next.timeframeConfidence === "UNKNOWN" ? "" : next.timeframe);
        setCurrentPrice(next.currentPriceConfidence === "UNKNOWN" ? "" : next.currentPrice);
        const confirmation = automaticChartConfirmation(next, Boolean(contextImage));
        const nextStatus: PreflightStatus = confirmation ? "LOCKED" : next.status === "RETAKE" ? "RETAKE" : "AWAITING_CONFIRMATION";
        setStatus(nextStatus); statusHandler.current(nextStatus);
        confirmationHandler.current(confirmation);
      } catch (error) {
        if (!active) return;
        if (error instanceof Error && error.name === "AbortError") return;
        setStatus("UNAVAILABLE"); statusHandler.current("UNAVAILABLE"); confirmationHandler.current(null);
        setMessage(error instanceof Error ? error.message : "Preflight unavailable");
      }
    }, 300);
    return () => { active = false; window.clearTimeout(timer); controller.abort(); };
  }, [image, contextImage, attempt]);

  const retry = () => {
    setStatus("CHECKING"); setResult(null); setMessage("");
    statusHandler.current("CHECKING"); confirmationHandler.current(null);
    setAttempt(value => value + 1);
  };
  const locked = status === "LOCKED";
  const correction = result ? automaticChartConfirmation(result, Boolean(contextImage), { instrument, timeframe, currentPrice }) : null;
  const applyCorrection = () => {
    if (!correction) return;
    setStatus("LOCKED"); statusHandler.current("LOCKED"); confirmationHandler.current(correction);
  };
  const readable = result && result.status !== "RETAKE" && result.priceScaleVisible && result.candlesReadable && result.enoughHistory
    && (!contextImage || result.sameInstrument === true);
  return <section className="psPreflight pnAutoPreflight" data-status={status} data-locked={locked} aria-label="Automatic chart check">
    <p role="status">{status === "CHECKING" ? "Reading chart labels and price scale…" : locked
      ? `${instrument} · ${timeframe} · ${currentPrice}`
      : status === "UNAVAILABLE" ? "Chart check unavailable. Retry after checking account access, or explore the demo."
      : !readable ? "Use a clearer chart with readable labels, price scale and candles. Remove any unmatched context chart."
      : "Check the unclear detail below against your chart."}</p>
    {status === "UNAVAILABLE" && message ? <small>{message}</small> : null}
    {!locked && readable ? <div className="psConfirmActions">
      {result.instrumentConfidence !== "HIGH" ? <label>Instrument<input aria-label="Correct unclear instrument" maxLength={40} value={instrument} onChange={e => setInstrument(e.target.value)} /></label> : null}
      {result.timeframeConfidence !== "HIGH" ? <label>Timeframe<input aria-label="Correct unclear timeframe" maxLength={30} value={timeframe} onChange={e => setTimeframe(e.target.value)} /></label> : null}
      {result.currentPriceConfidence !== "HIGH" ? <label>Visible last price<input aria-label="Correct unclear last price" inputMode="decimal" maxLength={30} value={currentPrice} onChange={e => setCurrentPrice(e.target.value)} /></label> : null}
      <button type="button" disabled={!correction} onClick={applyCorrection}>Use corrected detail</button>
    </div> : null}
    {status !== "CHECKING" ? <button type="button" onClick={retry}>{locked ? "Recheck chart" : "Retry chart check"}</button> : null}
  </section>;
}
