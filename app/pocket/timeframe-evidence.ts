import type { Analysis } from "./analysis-types";
import type { UploadedChart } from "./chart-session";
import { normalizePatternFrame } from "./chart-images";

export type EvidenceTone = "bullish" | "bearish" | "neutral" | "muted" | "conflict";

/** A cached report belongs to its primary screenshot, never a neighbouring slot. */
export function chartEvidenceReport(chart: UploadedChart): Analysis | undefined {
  if (chart.sourceImages && chart.sourceImages.image !== chart.image) return undefined;
  return chart.report;
}

export function chartEvidenceStatus(chart: UploadedChart, pendingId: string | null): string {
  if (chartEvidenceReport(chart)) return "READY";
  if (chart.preparation === "failed") return "TAP TO RETRY";
  if (chart.preparation === "queued") return "QUEUED";
  if (chart.preparation === "analysing") return "ANALYSING…";
  if (chart.preparation === "verifying") return "VERIFYING…";
  if (chart.preparation === "preparing" || pendingId === chart.id) return "PREPARING…";
  return "WAITING";
}

export function chartEvidenceLabel(chart: UploadedChart, index: number): string {
  const report = chartEvidenceReport(chart);
  // A contribution can suggest a timeframe while loading. Only the completed
  // primary read can verify it; do not infer a frame from an upload's slot.
  const frame = report && report.evidenceQuality.timeframeConfidence === "HIGH"
    ? normalizePatternFrame(report.timeframe) : null;
  return frame?.toLowerCase() ?? `Chart ${index + 1}`;
}

function readable(report: Analysis | undefined): report is Analysis {
  return Boolean(report?.evidenceQuality.candlesReadable && report.evidenceQuality.chartReadability !== "POOR");
}

function identity(report: Analysis | undefined): string | null {
  if (!readable(report) || report.evidenceQuality.instrumentConfidence !== "HIGH"
    || report.evidenceQuality.timeframeConfidence !== "HIGH" || report.trustGate?.identityLocked === false
    || !normalizePatternFrame(report.timeframe)) return null;
  const name = report.instrument.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return !name || /UNKNOWN|UNCONFIRMED|UNREADABLE|NOTVISIBLE|NOTAVAILABLE|^NA$/.test(name) ? null : name;
}

function ticker(report: Analysis): string | null {
  const value = report.ticker.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return !value || /^(UNKNOWN|NA|UNCONFIRMED)$/.test(value) ? null : value;
}

/** Compare completed, readable interpretations; this is not a new trade signal. */
export function timeframeAgreement(chart: UploadedChart, reference: UploadedChart | undefined): { label: string; tone: EvidenceTone } {
  const report = chartEvidenceReport(chart);
  const active = reference && chartEvidenceReport(reference);
  const muted = (label: string) => ({ label, tone: "muted" as const });
  if (!report || !active) return muted("Awaiting analysis");
  if (!identity(report) || !identity(active)) return muted("Identity / timeframe unverified");
  if (chart.id === reference?.id) return muted("Selected view");
  if (identity(report) !== identity(active) || (ticker(report) && ticker(active) && ticker(report) !== ticker(active))) return muted("Different market");
  if (!['BULLISH', 'BEARISH', 'NEUTRAL'].includes(report.direction) || !['BULLISH', 'BEARISH', 'NEUTRAL'].includes(active.direction)) return muted("Direction unclear");
  const frame = normalizePatternFrame(active.timeframe)!.toLowerCase();
  if (report.direction === "NEUTRAL" && active.direction === "NEUTRAL") return { label: `Both neutral · ${frame}`, tone: "neutral" };
  if (report.direction === "NEUTRAL" || active.direction === "NEUTRAL") return { label: `Mixed trend · ${frame}`, tone: "neutral" };
  return report.direction === active.direction
    ? { label: `Trend agrees · ${frame}`, tone: report.direction === "BULLISH" ? "bullish" : "bearish" }
    : { label: `Trend conflicts · ${frame}`, tone: "conflict" };
}

export function timeframeEvidence(chart: UploadedChart) {
  const report = chartEvidenceReport(chart);
  if (!report) return { trend: "Awaiting analysis", tone: "muted" as const, structure: "Awaiting analysis", momentum: "Awaiting analysis" };
  if (!readable(report)) return { trend: "Unclear", tone: "muted" as const, structure: "Chart evidence unclear", momentum: "Chart evidence unclear" };
  const directions = { BULLISH: "Bullish", BEARISH: "Bearish", NEUTRAL: "Neutral" };
  return {
    trend: directions[report.direction] ?? "Unclear",
    tone: (directions[report.direction] ? report.direction.toLowerCase() : "muted") as EvidenceTone,
    // Keep the report's wording, including qualifications and missing indicators.
    structure: report.marketStructure?.trim() || "Not established",
    momentum: report.momentum?.trim() || "Not established",
  };
}
