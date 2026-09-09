"use client";
import { useEffect, useRef, useState } from "react";
import type { Analysis, LockedDecision, ProcessReview } from "./analysis-types";

export default function ScanChanges({ previous, analysis, image, sample, canCompare }: {
  previous: LockedDecision | null; analysis: Analysis; image: string; sample: boolean; canCompare: () => Promise<boolean>;
}) {
  const [result, setResult] = useState<ProcessReview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestActive = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function compare() {
    if (!previous || sample || requestActive.current) return;
    requestActive.current = true;
    const requestController = new AbortController();
    controller.current = requestController;
    setBusy(true); setError("");
    try {
      if (!await canCompare() || requestController.signal.aborted) return;
      const response = await fetch("/api/pocket/review", {
        method: "POST", headers: { "content-type": "application/json" },
        signal: AbortSignal.any([requestController.signal, AbortSignal.timeout(60_000)]),
        body: JSON.stringify({ beforeImage: previous.image, afterImage: image, lockedAnalysis: previous.analysis, currentAnalysis: analysis, mode: "CHART_CHANGES" }),
      });
      const payload = await response.json() as { review?: ProcessReview; error?: string };
      if (!response.ok || !payload.review) throw new Error(payload.error || "The comparison did not finish. Both scans are still saved.");
      if (!requestController.signal.aborted) setResult(payload.review);
    } catch (caught) {
      if (!requestController.signal.aborted) setError(caught instanceof Error && caught.name !== "TimeoutError" ? caught.message : "The comparison timed out. Both scans are still saved; you can retry.");
    } finally { requestActive.current = false; if (!requestController.signal.aborted) setBusy(false); }
  }
  return <section id="bullseye-changes" className="psScanChanges" aria-busy={busy}>
    <header><div><span>WHAT CHANGED?</span><strong>{analysis.timeframe} · {analysis.instrument}</strong></div><small>PRIVATE · THIS DEVICE</small></header>
    {sample ? <p>With your own charts, compare a fresh scan against the previous saved scan of the same instrument and timeframe.</p> : previous ? <>
      <p>Compare with your scan saved {new Date(previous.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}. The original stays unchanged.</p>
      <details><summary>View the two screenshots</summary><div className="psComparisonImages"><figure><img src={previous.image} alt="Previous saved chart"/><figcaption>PREVIOUS</figcaption></figure><figure><img src={image} alt="Current chart"/><figcaption>CURRENT UPLOAD</figcaption></figure></div></details>
      <button type="button" disabled={busy} onClick={compare}>{busy ? "COMPARING…" : result ? "COMPARE AGAIN" : "COMPARE WITH PREVIOUS SCAN"}</button>
    </> : <p>No earlier, different screenshot of this instrument and timeframe is saved here yet. Successful scans are saved privately on this device for your next comparison.</p>}
    {error ? <p role="alert">{error}</p> : null}
    {result ? <div className="psChangeLedger" role="status"><h3>{result.headline}</h3><p>{result.outcomeSummary}</p><p><strong>THESIS: {result.thesisStatus.replaceAll("_", " ")}</strong> · STRUCTURE: {result.structureShift}</p>{result.evidenceChanges.map((change, index) => <article key={index} data-impact={change.impact}><div><small>BEFORE</small><p>{change.before}</p><small>AFTER</small><p>{change.after}</p></div><b>{change.impact}</b></article>)}<p>{result.nextRule}</p></div> : null}
  </section>;
}
