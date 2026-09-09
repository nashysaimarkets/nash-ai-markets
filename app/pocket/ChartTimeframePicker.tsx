"use client";
import type { UploadedChart } from "./chart-session";

export default function ChartTimeframePicker({ charts, activeId, pendingId, disabled, onSelect, compact = false }: {
  charts: UploadedChart[]; activeId: string; pendingId: string | null; disabled: boolean;
  onSelect: (id: string) => void; compact?: boolean;
}) {
  if (!charts.length) return null;
  return <section className={`psTimeframePicker${compact ? " psTimeframeCompact" : ""}`} aria-label="Uploaded chart selection" aria-busy={Boolean(pendingId)}>
    <div><strong>CHART / TIMEFRAME</strong><span>Applies to every analysis section</span></div>
    <nav aria-label="Choose uploaded chart timeframe">{charts.map((chart, index) => <button key={chart.id} type="button" aria-pressed={chart.id === activeId} data-active={chart.id === activeId} disabled={disabled} onClick={() => onSelect(chart.id)} title={chart.name}>
      <span>{chart.timeframe === "READ FROM CHART" ? `CHART ${index + 1}` : chart.timeframe}</span>
      <small>{pendingId === chart.id ? "ANALYSING…" : chart.id === activeId ? "VIEWING" : chart.report ? "READY" : "ANALYSE THIS VIEW"} · {index + 1}</small>
    </button>)}</nav>
    {pendingId ? <div className="psScanActivity" role="status"><span>Reading the selected chart. Your current result is kept until it is ready.</span><div className="psScanActivityTrack" role="progressbar" aria-label="Selected timeframe analysis in progress"><span /></div></div> : !compact && charts.some((chart) => !chart.report) ? <p>First selection analyses that view. Returning to a ready view uses its saved result.</p> : null}
  </section>;
}
