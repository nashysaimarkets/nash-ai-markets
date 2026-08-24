"use client";

import { useEffect, useRef, useState } from "react";
import type { ChartPreflight, PreflightStatus } from "./chart-preflight";

export default function ChartPreflightPanel({ image, contextImage, onStatus }: {
  image: string;
  contextImage?: string | null;
  onStatus: (status: PreflightStatus) => void;
}) {
  const [status, setStatus] = useState<PreflightStatus>("CHECKING");
  const [result, setResult] = useState<ChartPreflight | null>(null);
  const [message, setMessage] = useState("");\n  const statusHandler = useRef(onStatus);\n  useEffect(() => { statusHandler.current = onStatus; }, [onStatus]);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("CHECKING"); setResult(null); setMessage(""); statusHandler.current("CHECKING");
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/pocket/preflight", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image, contextImage: contextImage || "" }), signal: controller.signal });
        const payload = await response.json() as { preflight?: ChartPreflight; error?: string };
        if (!response.ok || !payload.preflight) throw new Error(payload.error || "Preflight unavailable");
        setResult(payload.preflight); setStatus(payload.preflight.status); statusHandler.current(payload.preflight.status);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setStatus("UNAVAILABLE"); statusHandler.current("UNAVAILABLE"); setMessage(error instanceof Error ? error.message : "Preflight unavailable");
      }
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [image, contextImage]);

  if (status === "CHECKING") return <section className="psPreflight" data-status="CHECKING"><header><span>◉ AUTOMATIC CHART PREFLIGHT</span><strong>CHECKING BEFORE ANALYSIS…</strong></header><div className="psPreflightScan"><i /></div><p>Reading labels, scale, candles and visible history.</p></section>;
  if (status === "UNAVAILABLE") return <section className="psPreflight" data-status="UNAVAILABLE"><header><span>◉ AUTOMATIC CHART PREFLIGHT</span><strong>CHECK UNAVAILABLE</strong></header><p>{message} Full analysis remains available.</p></section>;
  if (!result) return null;

  const checks = [
    ["INSTRUMENT", result.instrumentConfidence === "UNKNOWN" ? "UNKNOWN" : result.instrument, result.instrumentConfidence !== "LOW" && result.instrumentConfidence !== "UNKNOWN"],
    ["TIMEFRAME", result.timeframeConfidence === "UNKNOWN" ? "UNKNOWN" : result.timeframe, result.timeframeConfidence !== "LOW" && result.timeframeConfidence !== "UNKNOWN"],
    ["PRICE SCALE", result.priceScaleVisible ? "VISIBLE" : "MISSING", result.priceScaleVisible],
    ["CANDLES", result.candlesReadable ? "READABLE" : "UNCLEAR", result.candlesReadable],
    ["HISTORY", result.enoughHistory ? "ENOUGH" : "LIMITED", result.enoughHistory],
    ...(contextImage ? [["CHART MATCH", result.sameInstrument === true ? "MATCHED" : result.sameInstrument === false ? "MISMATCH" : "UNCONFIRMED", result.sameInstrument !== false] as const] : []),
  ] as const;

  return <section className="psPreflight" data-status={result.status}>
    <header><span>◉ AUTOMATIC CHART PREFLIGHT</span><strong>{result.status === "READY" ? "READY TO ANALYSE" : result.status === "LIMITED" ? "USABLE WITH LIMITS" : "RETAKE RECOMMENDED"}</strong></header>
    <div className="psPreflightChecks">{checks.map(([label, value, pass]) => <article key={label} data-pass={pass}><i>{pass ? "✓" : "!"}</i><span>{label}</span><strong>{value}</strong></article>)}</div>
    {result.issues.length ? <ul>{result.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : null}
    <p>{result.guidance}</p>
    <footer>{result.status === "RETAKE" ? "FULL ANALYSIS PAUSED TO AVOID WASTING YOUR REQUEST" : "PREFLIGHT COMPLETE · FULL ANALYSIS HAS NOT STARTED"}</footer>
  </section>;
}
