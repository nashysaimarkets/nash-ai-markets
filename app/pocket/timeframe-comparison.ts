import type { Analysis } from "./analysis-types";
import type { UploadedChart } from "./chart-session";
import { buildLevelScanner } from "./level-scanner-model";

function identity(report: Analysis) {
  const value = report.instrument.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return value && !/UNKNOWN|UNCONFIRMED/.test(value) ? `${value}:${report.ticker.toUpperCase()}` : null;
}
export function timeframeComparison(charts: UploadedChart[], active: Analysis, activeId: string) {
  return charts.map((chart, index) => {
    const report = chart.id === activeId ? active : chart.report;
    const comparable = !!report && identity(report) !== null && identity(report) === identity(active)
      && report.evidenceQuality.instrumentConfidence === "HIGH" && report.evidenceQuality.timeframeConfidence === "HIGH"
      && active.evidenceQuality.instrumentConfidence === "HIGH" && active.evidenceQuality.timeframeConfidence === "HIGH"
      && report.trustGate?.status !== "HOLD" && active.trustGate?.status !== "HOLD";
    const relation = !report ? (chart.preparation === "failed" ? "Retry needed" : "Not ready")
      : !comparable ? "Verify identity / evidence" : chart.id === activeId ? "Selected view"
      : report.direction === "NEUTRAL" || active.direction === "NEUTRAL" ? "Neutral / mixed"
      : report.direction === active.direction ? "Same direction" : "Opposing direction";
    const model = report && comparable ? buildLevelScanner(report) : null;
    return { id: chart.id, timeframe: report?.timeframe || chart.timeframe || `Chart ${index + 1}`, relation,
      report, support: model?.support?.price ?? null, resistance: model?.resistance?.price ?? null };
  });
}
