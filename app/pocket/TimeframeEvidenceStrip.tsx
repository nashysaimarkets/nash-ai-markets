"use client";
import { useState } from "react";
import type { UploadedChart } from "./chart-session";
import { chartEvidenceLabel, chartEvidenceReport, chartEvidenceStatus, timeframeAgreement, timeframeEvidence } from "./timeframe-evidence";

export default function TimeframeEvidenceStrip({ charts, activeId, pendingId, disabled, onSelect }: {
  charts: UploadedChart[]; activeId: string; pendingId: string | null; disabled: boolean;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!charts.length) return null;
  const reference = charts.find((chart) => chart.id === activeId);
  const ready = charts.filter((chart) => chartEvidenceReport(chart)).length;
  return <section className="psTimeframeEvidence" aria-label="Timeframe evidence comparison" data-expanded={expanded}>
    <header>
      <div><strong>TIMEFRAME EVIDENCE</strong><span role="status">{ready} of {charts.length} ready</span></div>
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? "Less detail" : "Full wording"}</button>
    </header>
    <nav aria-label="Compare and choose uploaded chart timeframe">{charts.map((chart, index) => {
      const evidence = timeframeEvidence(chart);
      const agreement = timeframeAgreement(chart, reference);
      const label = chartEvidenceLabel(chart, index);
      const status = chartEvidenceStatus(chart, pendingId);
      const hasReport = Boolean(chartEvidenceReport(chart));
      return <button className="psEvidenceCard" key={chart.id} type="button" aria-pressed={chart.id === activeId} data-active={chart.id === activeId} disabled={disabled} onClick={() => onSelect(chart.id)}>
        <span className="psEvidenceSource"><img src={chart.image} alt="" width="64" height="48" /><span><b>{label}</b><small>{status}</small></span><span className="psEvidenceNumber">{index + 1}</span></span>
        {hasReport ? <><span className="psEvidenceMetric"><span>Trend</span><b data-tone={evidence.tone}>{evidence.trend}</b></span>
        <span className="psEvidenceMetric psEvidenceCopy"><span>Structure</span><span>{evidence.structure}</span></span>
        <span className="psEvidenceMetric psEvidenceCopy"><span>Momentum</span><span>{evidence.momentum}</span></span>
        <span className="psEvidenceAgreement" data-tone={agreement.tone}>{agreement.label}</span></>
          : <span className="psEvidencePending">{chart.preparation === "failed" ? "No completed analysis. Tap to try again." : "Awaiting analysis"}</span>}
      </button>;
    })}</nav>
    <p>{pendingId ? "Selected chart is preparing. You can still open a ready view." : "Tap a chart to use its report across every section."}</p>
  </section>;
}
