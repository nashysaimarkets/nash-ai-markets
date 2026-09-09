import { normalizePatternFrame, POCKET_IMAGE_SLOTS } from "./chart-images";
import type { Analysis } from "./analysis-types";

export type ChartBundle = Record<typeof POCKET_IMAGE_SLOTS[number][0], string | null>;
export type UploadedChart = { id: string; image: string; name: string; timeframe: string; report?: Analysis; sourceImages?: ChartBundle; sourceNames?: string[] };

/** Source IDs are upload identities, not timeframes: two 1h crops stay separate. */
export function createChartSession(images: ChartBundle, names: string[], report: Analysis): UploadedChart[] {
  return POCKET_IMAGE_SLOTS.flatMap(([field, role], index) => {
    const image = images[field];
    if (!image) return [];
    const contribution = report.evidencePack?.contributions.find((item) => item.role === role);
    const timeframe = index === 0 ? report.timeframe : contribution?.timeframe;
    return [{ id: field, image, name: names[index] || `Chart ${index + 1}`, timeframe: normalizePatternFrame(timeframe) ?? "READ FROM CHART", ...(index === 0 ? { report, sourceImages: images, sourceNames: names } : {}) }];
  });
}

/** Promote the requested source, retaining every other upload exactly once. */
export function bundleForChart(charts: UploadedChart[], id: string): { images: ChartBundle; ordered: UploadedChart[] } {
  const selected = charts.find((chart) => chart.id === id);
  if (!selected) throw new Error("That uploaded chart is no longer available.");
  const ordered = [selected, ...charts.filter((chart) => chart.id !== id)];
  const images = Object.fromEntries(POCKET_IMAGE_SLOTS.map(([field], index) => [field, ordered[index]?.image ?? null])) as ChartBundle;
  return { images, ordered };
}

/** Only the selected screenshot owns its geometry and section-level evidence. */
export function selectedChartReport(report: Analysis): Analysis {
  return { ...report, combinedBattlefield: undefined, contextBattlefield: null, patterns: report.patterns.filter((pattern) => (pattern.sourceRole ?? "PRIMARY") === "PRIMARY") };
}

export function comparisonIdentity(analysis: { instrument?: string; ticker?: string; timeframe?: string }): string | null {
  const instrument = (typeof analysis.instrument === "string" ? analysis.instrument : "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const timeframe = normalizePatternFrame(typeof analysis.timeframe === "string" ? analysis.timeframe : undefined);
  if (!instrument || /UNKNOWN|UNCONFIRMED|DEMO/.test(instrument) || !timeframe) return null;
  const ticker = (typeof analysis.ticker === "string" ? analysis.ticker : "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `${instrument}:${ticker === "UNKNOWN" ? "" : ticker}:${timeframe}`;
}

export function previousComparableScan<T extends { id: string; createdAt: string; image: string; analysis: Analysis }>(history: T[], current: Analysis, image: string): T | null {
  const identity = comparisonIdentity(current);
  if (!identity) return null;
  return history.filter((entry) => entry.image !== image && Number.isFinite(Date.parse(entry.createdAt)) && comparisonIdentity(entry.analysis) === identity)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] ?? null;
}
