"use client";
import type { UploadedChart } from "./chart-session";

export default function ChartTimeframePicker({ charts, activeId, pendingId, disabled, onSelect, compact = false }: {
  charts: UploadedChart[]; activeId: string; pendingId: string | null; disabled: boolean;
  onSelect: (id: string) => void; compact?: boolean;
}) {
  if (!charts.length) return null;
  const preparing = charts.some((chart) => chart.preparation && chart.preparation !== "failed");
  const failed = charts.some((chart) => chart.preparation === "failed" && !chart.report);
  return <section className={`psTimeframePicker${compact ? " psTimeframeCompact" : ""}`} aria-label="Uploaded chart selection" aria-busy={Boolean(pendingId)}>
    <div><strong>CHART / TIMEFRAME</strong><span>Applies to every analysis section</span></div>
    <nav aria-label="Choose uploaded chart timeframe">{charts.map((chart, index) => <button key={chart.id} type="button" aria-pressed={chart.id === activeId} data-active={chart.id === activeId} disabled={disabled} onClick={() => onSelect(chart.id)} title={chart.name}>
      <span>{chart.timeframe === "READ FROM CHART" ? `CHART ${index + 1}` : chart.timeframe}</span>
      <small>{chart.id === activeId ? "VIEWING" : chart.report ? "READY" : chart.preparation === "failed" ? "TAP TO RETRY" : chart.preparation === "preparing" ? "PREPARING…" : chart.preparation === "verifying" ? "VERIFYING…" : chart.preparation === "analysing" ? "ANALYSING…" : chart.preparation === "queued" ? "QUEUED" : pendingId === chart.id ? "PREPARING…" : "WAITING"} · {index + 1}</small>
    </button>)}</nav>
    {pendingId ? <div className="psScanActivity" role="status"><span>Preparing the selected chart. You can choose another chart while it finishes.</span><div className="psScanActivityTrack" role="progressbar" aria-label="Selected timeframe analysis in progress"><span /></div></div> : !compact && charts.some((chart) => !chart.report) ? <p role="status">{preparing ? "Other charts are preparing in the background. Ready charts switch instantly." : failed ? "Some charts could not finish. Tap to retry; ready results are saved." : "Ready charts switch instantly. Other views are waiting to be analysed."}</p> : null}
  </section>;
}
