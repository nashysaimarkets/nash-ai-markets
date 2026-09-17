"use client";
import { trackGrowth } from "./growth-client";
import type { Analysis } from "./analysis-types";
import type { UploadedChart } from "./chart-session";
import { timeframeComparison } from "./timeframe-comparison";

export default function TimeframeComparison({ charts, analysis, activeId, disabled, onSelect }: { charts: UploadedChart[]; analysis: Analysis; activeId: string; disabled: boolean; onSelect: (id: string) => void }) {
  const rows = timeframeComparison(charts, analysis, activeId);
  const conflicts = rows.filter((row) => row.relation === "Opposing direction").length;
  return <section className="pbResearchPanel pbFrames" id="bullseye-timeframe-comparison">
    <header><div><span>Across your charts</span><h2>{conflicts ? "Different views. Different signals." : "See the whole picture"}</h2></div><b>{rows.filter((row) => row.report).length}/{rows.length} ready</b></header>
    <p>Compared with the selected {analysis.timeframe} read. Shared screenshots can influence several reports.</p>
    <div className="pbFrameRows">{rows.map((row) => <button type="button" key={row.id} disabled={disabled || !row.report} aria-pressed={row.id === activeId} onClick={() => { trackGrowth("timeframe_opened"); onSelect(row.id); }} data-conflict={row.relation === "Opposing direction"}>
      <span><strong>{row.timeframe}</strong><small>{row.report?.direction.toLowerCase() ?? "Preparing"}</small></span>
      <span><b>{row.relation}</b><small>Support {row.support ?? "unverified"} · Resistance {row.resistance ?? "unverified"}</small></span><i aria-hidden="true">↗</i>
    </button>)}</div>
    <small>Ready views open without another scan. Agreement is not a probability or independent confirmation.</small>
  </section>;
}
