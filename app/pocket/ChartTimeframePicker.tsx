"use client";
import { useEffect, useRef, useState } from "react";
import type { UploadedChart } from "./chart-session";

export default function ChartTimeframePicker({ charts, activeId, pendingId, disabled, onSelect, compact = false }: {
  charts: UploadedChart[]; activeId: string; pendingId: string | null; disabled: boolean;
  onSelect: (id: string) => void; compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); root.current?.querySelector<HTMLButtonElement>(".psTimeframeTrigger")?.focus(); }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", closeEscape); };
  }, [open]);
  if (!charts.length) return null;
  const activeIndex = Math.max(0, charts.findIndex((chart) => chart.id === activeId));
  const active = charts[activeIndex];
  const label = active.timeframe === "READ FROM CHART" ? `CHART ${activeIndex + 1}` : active.timeframe;
  const preparing = charts.some((chart) => chart.preparation && chart.preparation !== "failed");
  const failed = charts.some((chart) => chart.preparation === "failed" && !chart.report);
  return <section ref={root} className={`psTimeframePicker psTimeframeDisclosure${compact ? " psTimeframeCompact" : ""}`} data-open={open} aria-label="Uploaded chart selection" aria-busy={Boolean(pendingId)}>
    <button className="psTimeframeTrigger" type="button" aria-expanded={open} aria-controls={`ps-timeframe-options-${compact ? "compact" : "full"}`} onClick={() => setOpen((value) => !value)}>
      <span><strong>{label}</strong><small>CHART {activeIndex + 1} OF {charts.length}{pendingId ? " · PREPARING" : ""}</small></span><span aria-hidden="true">{open ? "×" : "⌄"}</span>
    </button>
    {open ? <div className="psTimeframeOptions" id={`ps-timeframe-options-${compact ? "compact" : "full"}`}>
    <p>CHART / TIMEFRAME <span>Changes every analysis section</span></p>
    <nav aria-label="Choose uploaded chart timeframe">{charts.map((chart, index) => <button key={chart.id} type="button" aria-pressed={chart.id === activeId} data-active={chart.id === activeId} disabled={disabled} onClick={() => { onSelect(chart.id); setOpen(false); }} title={chart.name}>
      <span>{chart.timeframe === "READ FROM CHART" ? `CHART ${index + 1}` : chart.timeframe}</span>
      <small>{chart.id === activeId ? "VIEWING" : chart.report ? "READY" : chart.preparation === "failed" ? "TAP TO RETRY" : chart.preparation === "preparing" ? "PREPARING…" : chart.preparation === "verifying" ? "VERIFYING…" : chart.preparation === "analysing" ? "ANALYSING…" : chart.preparation === "queued" ? "QUEUED" : pendingId === chart.id ? "PREPARING…" : "WAITING"} · {index + 1}</small>
    </button>)}</nav>
    {pendingId ? <div className="psScanActivity" role="status"><span>Preparing the selected chart. You can choose another chart while it finishes.</span><div className="psScanActivityTrack" role="progressbar" aria-label="Selected timeframe analysis in progress"><span /></div></div> : !compact && charts.some((chart) => !chart.report) ? <p role="status">{preparing ? "Other charts are preparing in the background. Ready charts switch instantly." : failed ? "Some charts could not finish. Tap to retry; ready results are saved." : "Ready charts switch instantly. Other views are waiting to be analysed."}</p> : null}
    </div> : null}
  </section>;
}
