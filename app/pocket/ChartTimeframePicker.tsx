"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { UploadedChart } from "./chart-session";

export default function ChartTimeframePicker({ charts, activeId, pendingId, disabled, onSelect }: {
  charts: UploadedChart[]; activeId: string; pendingId: string | null; disabled: boolean;
  onSelect: (id: string) => void; compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLButtonElement>(".psTimeframeClose")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
      if (event.key !== "Tab" || !dialog.current) return;
      const buttons = [...dialog.current.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
      if (!buttons.length) return;
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0].focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKeyDown); };
  }, [open]);
  if (!charts.length) return null;
  const activeIndex = Math.max(0, charts.findIndex((chart) => chart.id === activeId));
  const active = charts[activeIndex];
  const label = active.timeframe === "READ FROM CHART" ? `${activeIndex + 1}` : active.timeframe;
  const close = () => { setOpen(false); trigger.current?.focus(); };
  // Keep the fixed control outside the scrolling/animated result surface. On iOS,
  // a transformed ancestor makes position:fixed relative to that ancestor.
  return mounted ? createPortal(<>
    <button ref={trigger} className="psTimeframeFab" type="button" aria-label={`Choose chart and timeframe. ${label}, chart ${activeIndex + 1} of ${charts.length}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <span aria-hidden="true">CHARTS</span><strong aria-hidden="true">{label}</strong><span className="psTimeframeChevron" aria-hidden="true">⌃</span>
    </button>
    {open && <div className="psTimeframeBackdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div ref={dialog} className="psTimeframeSheet" role="dialog" aria-modal="true" aria-labelledby="ps-timeframe-title">
        <header><div><small>YOUR UPLOADED CHARTS</small><h2 id="ps-timeframe-title">Chart / timeframe</h2></div><button className="psTimeframeClose" type="button" onClick={close} aria-label="Close chart choices">×</button></header>
        <p>Choose a chart to update the analysis sections.</p>
        <nav aria-label="Choose uploaded chart timeframe">{charts.map((chart, index) => <button key={chart.id} type="button" aria-pressed={chart.id === activeId} disabled={disabled} onClick={() => { onSelect(chart.id); close(); }} title={chart.name}>
          <span><strong>{chart.timeframe === "READ FROM CHART" ? `Chart ${index + 1}` : chart.timeframe}</strong><small>CHART {index + 1}</small></span>
          <em>{chart.id === activeId ? "VIEWING" : chart.report ? "READY" : chart.preparation === "failed" ? "RETRY" : chart.preparation === "preparing" ? "PREPARING…" : chart.preparation === "verifying" ? "VERIFYING…" : chart.preparation === "analysing" ? "ANALYSING…" : chart.preparation === "queued" ? "QUEUED" : pendingId === chart.id ? "PREPARING…" : "WAITING"}</em>
        </button>)}</nav>
        {pendingId ? <p role="status">The selected chart is preparing. Other ready charts remain available.</p> : null}
      </div>
    </div>}
  </>, document.body) : null;
}
