import { exactAxisPrice, type AxisVerification } from "./axis-verification.ts";
import { axisReadingBounds } from "./axis-reading-bounds.ts";

export type OriginalLevelReport = {
  evidenceQuality: { chartReadability: string; instrumentConfidence: string; timeframeConfidence: string; scaleReadable: boolean; candlesReadable: boolean; limitations?: string[] };
  plotBounds?: { left: number; right: number; top: number; bottom: number };
  priceScaleAnchors?: { price: number; y: number }[];
  levels: { kind: string; label: string; price: string; x: number; x2: number; y: number; y2: number; source?: string }[];
};

/** Selectively reconciled from PR #95's sourceChartLevels contract. This candidate
 * supplies its existing image-bound preflight confirmation instead of that
 * branch's absent trustGate. OCR price agreement and original-pixel fit stay strict.
 * This verifies placement, not support/resistance semantics or scanner recall. */
export function originalPixelLevels(report: OriginalLevelReport, identityConfirmed: boolean, axis: AxisVerification | null, width: number, height: number) {
  const hold = (reason: string) => ({ levels: [] as OriginalLevelReport["levels"], reason });
  if (!identityConfirmed) return hold("Confirm the source chart facts before placement.");
  const q = report.evidenceQuality;
  if (!q?.scaleReadable || !q.candlesReadable || q.chartReadability !== "CLEAR" || q.instrumentConfidence !== "HIGH" || q.timeframeConfidence !== "HIGH") return hold("Chart identity or scale needs clearer evidence.");
  if ((q.limitations ?? []).some(text => /\blog(?:arithmic)?\b|non.?linear|scale type.*(?:unknown|uncertain)/i.test(text))) return hold("This price scale is not supported for precise placement.");
  if (!axis || axis.status !== "verified") return hold(axis?.status === "held" ? axis.reason : "Verifying original price labels…");
  const bounds = report.plotBounds;
  if (!bounds || ![width, height, ...Object.values(bounds)].every(Number.isFinite) || width <= 0 || height <= 0 || bounds.left < 0 || bounds.top < 0 || bounds.right > 100 || bounds.bottom > 100 || bounds.left >= bounds.right || bounds.top >= bounds.bottom) return hold("Original plotting bounds need verification.");
  const reading = axisReadingBounds(bounds, height);
  const anchors = [...axis.anchors].sort((a, b) => a.price - b.price);
  if (anchors.length < 3 || anchors.some((a, i) => !Number.isFinite(a.price) || a.price <= 0 || !Number.isFinite(a.y) || a.y < reading.top || a.y > reading.bottom || (i > 0 && (a.price <= anchors[i - 1].price || a.y >= anchors[i - 1].y))) || anchors[0].y - anchors.at(-1)!.y < 20) return hold("Independent price labels need a clearer axis.");
  if (new Set((report.priceScaleAnchors ?? []).filter(a => anchors.some(b => Math.abs(a.price - b.price) <= Math.max(1e-10, Math.abs(b.price) * 1e-10))).map(a => a.price)).size < 3) return hold("Vision and independent price readings disagree.");
  const meanPrice = anchors.reduce((sum, a) => sum + a.price, 0) / anchors.length;
  const meanY = anchors.reduce((sum, a) => sum + a.y, 0) / anchors.length;
  const slope = anchors.reduce((sum, a) => sum + (a.price - meanPrice) * (a.y - meanY), 0) / anchors.reduce((sum, a) => sum + (a.price - meanPrice) ** 2, 0);
  const row = (price: number) => meanY + (price - meanPrice) * slope;
  if (!Number.isFinite(slope) || slope >= 0 || anchors.some(a => Math.abs(row(a.price) - a.y) * height / 100 > 1.5)) return hold("Independent price scale is inconsistent.");
  const right = axis.axisLeft == null ? bounds.right : Math.min(bounds.right, axis.axisLeft / width * 100 - 1);
  if (!Number.isFinite(right) || right <= bounds.left) return hold("Price axis overlaps the plotting area.");
  const levels = report.levels.flatMap(level => {
    const value = exactAxisPrice(level.price);
    if (value === null || (level.source && level.source !== "PRIMARY") || !["support", "resistance", "pivot"].includes(level.kind) || value < anchors[0].price || value > anchors.at(-1)!.price || ![level.x, level.x2, level.y, level.y2].every(Number.isFinite) || level.x < bounds.left || level.x2 > bounds.right || level.x2 <= level.x) return [];
    const y = row(value);
    if (y < bounds.top || y > bounds.bottom) return [];
    return [{ ...level, x: bounds.left, x2: right, y, y2: y }];
  });
  return { levels, reason: levels.length ? null : "No source levels passed original-pixel placement checks." };
}
