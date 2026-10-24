import { exactAxisPrice, type AxisWord } from "./axis-verification.ts";
import { MAX_IMAGE_PLOT_PIXELS, type ImagePlotRegion, type PixelRectangle } from "./image-plot-region.ts";
import { isSourcePriceCandidates, type SourcePriceCandidate } from "./source-price-candidates.ts";

export const IMAGE_AXIS_POLICY = "image-axis-v1" as const;
export type MeasuredImagePlotRegion = Extract<ImagePlotRegion, { status: "measured" }>;
export type VerifiedImageAxis = {
  status: "verified";
  policy: typeof IMAGE_AXIS_POLICY;
  anchors: { price: number; y: number }[];
  matchedModelPrices: number[];
  maxResidualPixels: number;
  region: MeasuredImagePlotRegion;
  wordEvidence: AxisWord[];
  modelPriceEvidence: number[];
};
export type ImageAxisVerification = VerifiedImageAxis | {
  status: "held"; policy: typeof IMAGE_AXIS_POLICY; reason: string;
  /** Only insufficient evidence may be reread. The caller must retain earlier words. */
  retryable?: true;
};
export type ImagePlacedPriceCandidate = SourcePriceCandidate & {
  x: number; x2: number; y: number; y2: number; source: "PRIMARY"; placement: "IMAGE_AXIS";
};
export type ImagePricePlacement = { levels: ImagePlacedPriceCandidate[]; reason: string | null };

const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const close = (a: number, b: number) => Math.abs(a - b) <= 1e-6;
const samePrice = (a: number, b: number) => Math.abs(a - b) <= Math.max(1e-10, Math.abs(b) * 1e-10);
function rectangle(value: unknown, width: number, height: number): value is PixelRectangle {
  const b = object(value);
  return Boolean(b && [b.left, b.right, b.top, b.bottom].every(finite) &&
    (b.left as number) >= 0 && (b.top as number) >= 0 && (b.right as number) <= width && (b.bottom as number) <= height &&
    (b.left as number) < (b.right as number) && (b.top as number) < (b.bottom as number));
}
function orderedRows(value: unknown, minimum: number): value is number[] {
  return Array.isArray(value) && value.length >= minimum && value.length <= 512 &&
    value.every((row, i) => finite(row) && (i === 0 || row > value[i - 1]));
}

/** Structural boundary check, not a substitute for running the pixel detector.
 * The caller must obtain this region from the current original image, never a report.
 */
export function isMeasuredImagePlotRegion(value: unknown): value is MeasuredImagePlotRegion {
  const r = object(value);
  if (!r || r.status !== "measured" || !Number.isSafeInteger(r.width) || !Number.isSafeInteger(r.height)) return false;
  const width = r.width as number, height = r.height as number;
  if (width < 128 || height < 128 || width > 4096 || height > 4096 || width * height > MAX_IMAGE_PLOT_PIXELS ||
    !rectangle(r.plotPixels, width, height) || !rectangle(r.plotPercent, 100, 100) || !rectangle(r.axisLabelRegionPixels, width, height)) return false;
  const p = r.plotPixels, percent = r.plotPercent, axis = r.axisLabelRegionPixels as PixelRectangle & Record<string, unknown>;
  if (p.right - p.left < Math.max(96, width * .2) || p.bottom - p.top < Math.max(80, height * .15)) return false;
  if (!close(percent.left, p.left / width * 100) || !close(percent.right, p.right / width * 100) ||
    !close(percent.top, p.top / height * 100) || !close(percent.bottom, p.bottom / height * 100)) return false;
  if ((axis.side !== "right" || axis.left <= p.right) && (axis.side !== "left" || axis.right >= p.left)) return false;
  if (axis.bottom <= p.top || axis.top >= p.bottom || !orderedRows(r.gridRowPixels, 4)) return false;
  const rows = r.gridRowPixels;
  if (rows.some(y => y < p.top - 1 || y > p.bottom + 1) || Math.abs(rows[0] - p.top) > 1 || Math.abs(rows.at(-1)! - p.bottom) > 1) return false;
  const steps = rows.slice(1).map((y, i) => y - rows[i]), sorted = [...steps].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2), pitch = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  if (pitch < 12 || steps.some(step => Math.abs(step - pitch) > Math.max(2, pitch * .035))) return false;
  if (!orderedRows(axis.matchedGridRows, Math.max(3, Math.ceil(rows.length * .6))) ||
    axis.matchedGridRows.some(y => y < axis.top || y > axis.bottom || !rows.some(row => close(row, y)))) return false;
  const e = object(r.evidence);
  return Boolean(e && e.coherentPricePanels === 1 && e.axisTextColumns === 1 && e.borderEdges === 4 && e.gridRows === rows.length &&
    Number.isSafeInteger(e.candles) && (e.candles as number) >= 6 && finite(e.candleSpanPixels) &&
    e.candleSpanPixels >= (p.right - p.left) * .55 && e.candleSpanPixels <= p.right - p.left);
}

function copyRegion(r: MeasuredImagePlotRegion): MeasuredImagePlotRegion {
  const bounds = (p: PixelRectangle) => ({ left: p.left, top: p.top, right: p.right, bottom: p.bottom });
  const e = r.evidence;
  return { status: "measured", width: r.width, height: r.height, plotPixels: bounds(r.plotPixels), plotPercent: bounds(r.plotPercent),
    gridRowPixels: [...r.gridRowPixels], axisLabelRegionPixels: { ...bounds(r.axisLabelRegionPixels), side: r.axisLabelRegionPixels.side, matchedGridRows: [...r.axisLabelRegionPixels.matchedGridRows] },
    evidence: { gridRows: e.gridRows, candles: e.candles, candleSpanPixels: e.candleSpanPixels, borderEdges: 4, coherentPricePanels: 1, axisTextColumns: 1 } };
}
const sameNumbers = (value: unknown, expected: readonly number[]) => Array.isArray(value) && value.length === expected.length && value.every((n, i) => n === expected[i]);
const sameAnchors = (value: unknown, expected: { price: number; y: number }[]) => Array.isArray(value) && value.length === expected.length &&
  value.every((item, i) => { const a = object(item); return a?.price === expected[i].price && a?.y === expected[i].y; });
function fit(anchors: { price: number; y: number }[], height: number) {
  const meanPrice = anchors.reduce((sum, a) => sum + a.price, 0) / anchors.length;
  const meanY = anchors.reduce((sum, a) => sum + a.y, 0) / anchors.length;
  const variance = anchors.reduce((sum, a) => sum + (a.price - meanPrice) ** 2, 0);
  const slope = anchors.reduce((sum, a) => sum + (a.price - meanPrice) * (a.y - meanY), 0) / variance;
  const row = (price: number) => meanY + (price - meanPrice) * slope;
  const residual = Math.max(...anchors.map(a => Math.abs(row(a.price) - a.y) * height / 100));
  return finite(slope) && slope < 0 && finite(residual) && residual <= 1.5 ? { row, residual } : null;
}

/** A new image-origin policy. The legacy three-model-tick policy is unchanged.
 * At least three independent OCR/grid ticks still establish the scale; two
 * exact, widely separated MAIN numeric prices corroborate its magnitude only.
 * No model coordinate, quality flag, source oracle or inferred decimal is used.
 */
export function verifyImageAxisWords(words: readonly AxisWord[], region: ImagePlotRegion, modelPrices: readonly number[]): ImageAxisVerification {
  const hold = (reason: string, retryable = false): ImageAxisVerification => ({ status: "held", policy: IMAGE_AXIS_POLICY, reason, ...(retryable ? { retryable: true as const } : {}) });
  if (!isMeasuredImagePlotRegion(region)) return hold("A unique source-pixel plot and price-label region are required.");
  if (!Array.isArray(words) || words.length > 256 || !Array.isArray(modelPrices) || modelPrices.length > 4 ||
    modelPrices.some(price => !finite(price) || price <= 0)) return hold("Price-axis evidence is malformed or exceeds its bound.");
  const roi = region.axisLabelRegionPixels;
  const candidates: { price: number; y: number; row: number; x: number; font: number }[] = [];
  for (const word of words) {
    if (!word || typeof word !== "object" || typeof word.text !== "string" || word.text.length > 64 ||
      ![word.x, word.y, word.width, word.height, word.confidence].every(finite) || word.width <= 0 || word.height <= 0 || word.confidence < 0 || word.confidence > 100)
      return hold("Original-pixel OCR word evidence is malformed.");
    if (word.x < roi.left || word.x + word.width > roi.right || word.y - word.height / 2 < roi.top || word.y + word.height / 2 > roi.bottom)
      return hold("OCR word evidence leaves the independently measured price-label region.");
    const price = exactAxisPrice(word.text);
    if (price === null || word.confidence < 80) continue;
    const nearest = [...roi.matchedGridRows].sort((a, b) => Math.abs(a - word.y) - Math.abs(b - word.y));
    if (Math.abs(nearest[0] - word.y) > Math.max(3, word.height * .35)) continue;
    if (close(Math.abs(nearest[0] - word.y), Math.abs(nearest[1] - word.y))) return hold("A price label has more than one possible grid row.");
    candidates.push({ price, y: nearest[0] / region.height * 100, row: nearest[0], x: word.x, font: word.height });
  }
  const groups = candidates.map(seed => candidates.filter(w => Math.abs(w.x - seed.x) <= Math.max(8, seed.font)));
  const selected = groups.sort((a, b) => b.length - a.length)[0] ?? [];
  if (selected.length !== candidates.length) return hold("Independent OCR contains competing price-label columns.");
  const byRow = new Map<number, typeof candidates[number]>();
  for (const candidate of selected) {
    const prior = byRow.get(candidate.row);
    if (prior && prior.price !== candidate.price) return hold("Independent price labels conflict on the same grid row.");
    byRow.set(candidate.row, candidate);
  }
  const ordered = [...byRow.values()].sort((a, b) => a.y - b.y);
  if (ordered.some((a, i) => i > 0 && a.price >= ordered[i - 1].price))
    return hold("Independent price labels are not strictly decreasing down the source image.");
  const numeric = [...new Set(modelPrices)];
  if (numeric.some(price => ordered.filter(a => samePrice(price, a.price)).length > 1)) return hold("Numeric price corroboration is ambiguous.");
  if (ordered.length < 3) return hold("At least three clear independent price labels are required.", true);
  const anchors = ordered.map(({ price, y }) => ({ price, y })), scale = fit(anchors, region.height);
  if (!scale) return hold("Independent price labels do not establish the required linear pixel fit.");
  if (ordered.at(-1)!.y - ordered[0].y < 20) return hold("Independent price labels need wider vertical coverage.", true);
  const matched = ordered.filter(a => numeric.some(price => samePrice(price, a.price)));
  if (matched.length < 2 || matched.at(-1)!.y - matched[0].y < 20)
    return hold("Two exact, widely separated main price readings must corroborate the independent axis.", true);
  return { status: "verified", policy: IMAGE_AXIS_POLICY, anchors, matchedModelPrices: matched.map(a => a.price), maxResidualPixels: scale.residual,
    region: copyRegion(region), wordEvidence: words.map(w => ({ text: w.text, confidence: w.confidence, x: w.x, y: w.y, width: w.width, height: w.height })), modelPriceEvidence: [...modelPrices] };
}

/** Placement only: model support/resistance meaning remains UNVERIFIED.
 * Revalidate serialized candidates, current region and retained OCR evidence at
 * this boundary; never accept a bare `verified` flag or supplied projection.
 */
export function imagePixelPriceCandidates(candidates: unknown, identityConfirmed: boolean, region: ImagePlotRegion, axis: ImageAxisVerification | null): ImagePricePlacement {
  const hold = (reason: string): ImagePricePlacement => ({ levels: [], reason });
  if (!identityConfirmed) return hold("Confirm the source chart facts before placement.");
  if (!isSourcePriceCandidates(candidates)) return hold("Untrusted source-price candidate evidence is unavailable or malformed.");
  if (candidates.levelInput === "MISSING" || candidates.levelInput === "MALFORMED") return hold("The main response did not provide usable price-candidate input.");
  if (!axis || axis.status !== "verified") return hold(axis?.status === "held" && typeof axis.reason === "string" ? axis.reason : "Verifying the source-pixel price axis…");
  if (axis.policy !== IMAGE_AXIS_POLICY || !isMeasuredImagePlotRegion(region) || !isMeasuredImagePlotRegion(axis.region) ||
    JSON.stringify(copyRegion(region)) !== JSON.stringify(copyRegion(axis.region)) ||
    !sameNumbers(axis.modelPriceEvidence, candidates.axisPrices)) return hold("Price-axis evidence does not belong to the current measured region and candidate readings.");
  const checked = verifyImageAxisWords(axis.wordEvidence, region, candidates.axisPrices);
  if (checked.status !== "verified") return hold(checked.reason);
  if (!sameAnchors(axis.anchors, checked.anchors) || !sameNumbers(axis.matchedModelPrices, checked.matchedModelPrices) ||
    axis.maxResidualPixels !== checked.maxResidualPixels) return hold("Retained price-axis verification evidence was changed.");
  const scale = fit(checked.anchors, region.height);
  if (!scale) return hold("Independent price scale is inconsistent.");
  const minimum = Math.min(...checked.anchors.map(a => a.price)), maximum = Math.max(...checked.anchors.map(a => a.price)), p = region.plotPixels;
  const levels: ImagePlacedPriceCandidate[] = candidates.levels.flatMap(candidate => {
    const value = exactAxisPrice(candidate.price);
    if (value === null || value < minimum || value > maximum) return [];
    const y = scale.row(value), rowPixels = y * region.height / 100;
    if (!finite(y) || rowPixels < p.top || rowPixels > p.bottom) return [];
    return [{ kind: candidate.kind, label: candidate.label, price: candidate.price, provenance: "UNVERIFIED" as const,
      source: "PRIMARY" as const, placement: "IMAGE_AXIS" as const, x: p.left / region.width * 100, x2: p.right / region.width * 100, y, y2: y }];
  });
  return { levels, reason: levels.length ? null : candidates.levelInput === "EMPTY"
    ? "The main response reported no horizontal price candidates; absence is not verified."
    : "No untrusted price candidate passed source-pixel placement checks; absence is not verified." };
}
