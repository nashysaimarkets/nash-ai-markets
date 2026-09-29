import { canonicalizePocketGeometry } from "../../lib/pocket-geometry.ts";

type JsonRecord = Record<string, unknown>;

const SIDES = new Set(["ABOVE_PRICE", "AT_PRICE", "BELOW_PRICE"]);
const PATTERNS = new Set(["EQUAL_HIGHS", "EQUAL_LOWS", "SWING_CLUSTER", "RANGE_EDGE", "SESSION_EXTREME", "ROUND_NUMBER"]);
const CONFIDENCE = new Set(["HIGH", "MEDIUM"]);
const PLAIN_NUMERIC_PRICE = /^-?(?:\d+(?:\.\d+)?|\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+,\d{1,2})$/;

type Bounds = { left: number; top: number; right: number; bottom: number };
type Anchor = { price: number; y: number };
const SCALE_ANCHOR_RESIDUAL_TOLERANCE = 2.25;

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function boundedText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function numericPrice(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const source = value.trim().replace(/[−–—]/g, "-").replace(/[’'\s]/g, "");
  // Parse the complete normalized value. Number() alone accepts exponent
  // notation and the old fallback parser accepted numeric substrings inside
  // annotations, neither of which is an exact price read from the chart.
  if (!source || !PLAIN_NUMERIC_PRICE.test(source)) return null;
  const commaDecimal = /^-?\d+,\d{1,2}$/.test(source) && !source.includes(".");
  const normalized = commaDecimal ? source.replace(",", ".") : source.replaceAll(",", "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isPlainNumericPrice(value: string) {
  return PLAIN_NUMERIC_PRICE.test(value) && numericPrice(value) !== null;
}

export function correctedCurrentPrice(correction: { categories: string[]; correction: string } | null) {
  if (!correction || correction.categories.length !== 1 || correction.categories[0] !== "CURRENT_PRICE") return null;
  const match = correction.correction.trim().replace(/[−–—]/g, "-").match(/^\s*(?:(?:current\s*price|price)\s*(?::|=)?\s*)?(-?(?:\d+(?:\.\d+)?|\d{1,3}(?:,\d{3})+(?:\.\d+)?))\s*$/i);
  const candidate = match?.[1] ?? "";
  return isPlainNumericPrice(candidate) ? candidate : null;
}

export function insufficientLiquidityShield(summary = "Liquidity candidates could not be verified against the visible price scale and candle rows.") {
  return {
    status: "INSUFFICIENT_EVIDENCE",
    summary,
    zones: [],
    stopGuidance: "Use the invalidation defined by your setup; no stop-risk zone is precise enough to mark on this chart.",
  };
}

function verifiedBounds(value: unknown): Bounds | null {
  if (!value || typeof value !== "object") return null;
  const record = value as JsonRecord;
  const left = finiteNumber(record.left);
  const top = finiteNumber(record.top);
  const right = finiteNumber(record.right);
  const bottom = finiteNumber(record.bottom);
  if (left === null || top === null || right === null || bottom === null) return null;
  if ([left, top, right, bottom].some((item) => item < 0 || item > 100)) return null;
  return right > left && bottom > top ? { left, top, right, bottom } : null;
}

function verifiedScale(value: unknown, bounds: Bounds) {
  if (!Array.isArray(value)) return null;
  const anchors = value.flatMap((item): Anchor[] => {
    if (!item || typeof item !== "object") return [];
    const record = item as JsonRecord;
    const price = finiteNumber(record.price);
    const y = finiteNumber(record.y);
    return price !== null && price > 0 && y !== null && y >= bounds.top && y <= bounds.bottom ? [{ price, y }] : [];
  });
  const unique = anchors.filter((anchor, index, all) =>
    all.findIndex((candidate) => candidate.price === anchor.price || candidate.y === anchor.y) === index,
  );
  if (unique.length < 3) return null;
  const candidates: Array<{ project: (price: number) => number; inliers: Anchor[]; span: number; residual: number }> = [];
  for (let leftIndex = 0; leftIndex < unique.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < unique.length; rightIndex += 1) {
      const left = unique[leftIndex], right = unique[rightIndex];
      if (left.price === right.price) continue;
      const project = (price: number) => left.y + ((price - left.price) / (right.price - left.price)) * (right.y - left.y);
      const inliers = unique.filter((anchor) => Math.abs(project(anchor.price) - anchor.y) <= SCALE_ANCHOR_RESIDUAL_TOLERANCE)
        .sort((a, b) => a.price - b.price);
      if (inliers.length < 3 || !inliers.every((anchor, index) => index === 0 || anchor.y < inliers[index - 1].y)) continue;
      const span = Math.abs(inliers.at(-1)!.y - inliers[0].y);
      if (span < 12) continue;
      const residual = inliers.reduce((total, anchor) => total + Math.abs(project(anchor.price) - anchor.y), 0);
      candidates.push({ project, inliers, span, residual });
    }
  }
  candidates.sort((a, b) => b.inliers.length - a.inliers.length || b.span - a.span || a.residual - b.residual);
  return candidates[0] ? { project: candidates[0].project } : null;
}

function normalizedShieldRank(shield: { status: string; zones?: unknown[] }) {
  if (shield.status === "VISIBLE_RISK_ZONES" && Array.isArray(shield.zones)) {
    return 20 + shield.zones.reduce<number>((total, zone) => {
      const touchPoints = zone && typeof zone === "object" ? (zone as JsonRecord).touchPoints : null;
      return total + (Array.isArray(touchPoints) ? touchPoints.length : 0);
    }, 0);
  }
  return shield.status === "NO_VISIBLE_RISK_ZONES" ? 10 : 1;
}

export function choosePrecisionLiquidityShield(
  first: unknown,
  rescue: unknown,
  geometry: JsonRecord | null,
  currentPriceText: string | null = null,
) {
  // A retry can look richer in raw model output while failing the exact scale,
  // side or candle-row checks. Rank only the candidates that survive against
  // the geometry actually selected for the result, otherwise a bad retry can
  // erase a valid first-pass Liquidity Guard zone.
  const normalizedFirst = normalizePrecisionLiquidityShield(
    geometry ? { ...geometry, liquidityShield: first } : null,
    currentPriceText,
  );
  const normalizedRescue = normalizePrecisionLiquidityShield(
    geometry ? { ...geometry, liquidityShield: rescue } : null,
    currentPriceText,
  );
  return normalizedShieldRank(normalizedRescue) > normalizedShieldRank(normalizedFirst) ? rescue : first;
}

export function normalizePrecisionLiquidityShield(precision: JsonRecord | null, currentPriceText: string | null, diagnostics: string[] = []) {
  const reject = (reason: string) => { diagnostics.push(reason); return []; };
  if (!precision) { diagnostics.push("NO_PRECISION"); return insufficientLiquidityShield("The precision chart-reading pass did not complete, so no liquidity zone was drawn."); }
  precision = canonicalizePocketGeometry(precision) as JsonRecord;
  const shield = precision.liquidityShield;
  if (!shield || typeof shield !== "object") { diagnostics.push("MISSING_SHIELD"); return insufficientLiquidityShield(); }
  const raw = shield as JsonRecord;
  const bounds = verifiedBounds(precision.plotBounds);
  const scale = bounds ? verifiedScale(precision.priceScaleAnchors, bounds) : null;
  const currentPrice = numericPrice(currentPriceText ?? precision.currentPrice);
  if (!bounds || !scale || currentPrice === null || currentPrice <= 0) {
    diagnostics.push(!bounds ? "INVALID_BOUNDS" : !scale ? "INVALID_SCALE" : "INVALID_CURRENT_PRICE");
    return insufficientLiquidityShield();
  }
  const currentY = scale.project(currentPrice);
  if (currentY < bounds.top || currentY > bounds.bottom) { diagnostics.push("CURRENT_OUTSIDE_PLOT"); return insufficientLiquidityShield(); }

  if (raw.status === "INSUFFICIENT_EVIDENCE") {
    return insufficientLiquidityShield(boundedText(raw.summary, 220) || undefined);
  }
  if (raw.status === "NO_VISIBLE_RISK_ZONES") {
    return {
      status: "NO_VISIBLE_RISK_ZONES",
      summary: boundedText(raw.summary, 220) || "No defensible stop-risk cluster is visible on this chart.",
      zones: [],
      stopGuidance: boundedText(raw.stopGuidance, 220) || "Use the invalidation defined by your setup; no chart-derived stop-risk zone was verified.",
    };
  }
  if (raw.status !== "VISIBLE_RISK_ZONES" || !Array.isArray(raw.zones)) { diagnostics.push("INVALID_SHIELD_STATUS"); return insufficientLiquidityShield(); }

  const seen = new Set<number>();
  const plotHeight = bounds.bottom - bounds.top;
  // A narrow price cluster can occupy up to twelve percent of a tightly
  // cropped mobile plot; it must still have multiple scale-aligned touches.
  const maxBandHeight = plotHeight * .12;
  const rowTolerance = Math.min(3.5, Math.max(1.25, plotHeight * .045));
  const confidenceRank: Record<string, number> = { HIGH: 0, MEDIUM: 1 };
  const zones = [...raw.zones].sort((left, right) => {
    const leftConfidence = left && typeof left === "object" ? String((left as JsonRecord).confidence) : "";
    const rightConfidence = right && typeof right === "object" ? String((right as JsonRecord).confidence) : "";
    return (confidenceRank[leftConfidence] ?? 2) - (confidenceRank[rightConfidence] ?? 2);
  }).flatMap((item) => {
    if (!item || typeof item !== "object") return reject("INVALID_ZONE");
    const zone = item as JsonRecord;
    const side = typeof zone.side === "string" && SIDES.has(zone.side) ? zone.side : null;
    const pattern = typeof zone.pattern === "string" && PATTERNS.has(zone.pattern) ? zone.pattern : null;
    const rawConfidence = typeof zone.confidence === "string" && CONFIDENCE.has(zone.confidence) ? zone.confidence : null;
    const priceLow = finiteNumber(zone.priceLow);
    const priceHigh = finiteNumber(zone.priceHigh);
    if (!side || !pattern || !rawConfidence || priceLow === null || priceHigh === null || priceLow <= 0 || priceHigh <= 0 || priceHigh < priceLow) return reject("INVALID_ZONE_FIELDS");
    // Side labels must remain literal. A narrow cluster currently being
    // tested is retained as AT_PRICE instead of being silently discarded.
    if (side === "ABOVE_PRICE" && priceLow <= currentPrice) return reject("SIDE_MISMATCH");
    if (side === "BELOW_PRICE" && priceHigh >= currentPrice) return reject("SIDE_MISMATCH");
    if (side === "AT_PRICE" && (currentPrice < priceLow || currentPrice > priceHigh)) return reject("SIDE_MISMATCH");

    const projectedLow = scale.project(priceLow);
    const projectedHigh = scale.project(priceHigh);
    const bandTop = Math.min(projectedLow, projectedHigh);
    const bandBottom = Math.max(projectedLow, projectedHigh);
    if (bandTop < bounds.top || bandBottom > bounds.bottom) return reject("BAND_OUTSIDE_PLOT");
    if (bandBottom - bandTop > maxBandHeight) return reject("BAND_TOO_WIDE");

    const touchPoints = Array.isArray(zone.touchPoints) ? zone.touchPoints.flatMap((point) => {
      if (!point || typeof point !== "object") return [];
      const record = point as JsonRecord;
      const x = finiteNumber(record.x);
      const y = finiteNumber(record.y);
      return x !== null && y !== null && x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom ? [{ x, y }] : [];
    }).filter((point, index, all) => all.findIndex((candidate) => Math.abs(candidate.x - point.x) < .75) === index) : [];
    if (touchPoints.length < 2) return reject("TOUCH_COUNT");
    if (!touchPoints.every((point) => point.y >= bandTop - rowTolerance && point.y <= bandBottom + rowTolerance)) return reject("TOUCH_ROW_MISMATCH");
    const confidence = rawConfidence === "HIGH" && touchPoints.length < 3 ? "MEDIUM" : rawConfidence;

    const key = Math.round(((bandTop + bandBottom) / 2) * 2);
    if (seen.has(key)) return reject("DUPLICATE_ROW");
    seen.add(key);
    return [{
      side,
      pattern,
      label: boundedText(zone.label, 48) || pattern.replaceAll("_", " "),
      priceLow,
      priceHigh,
      confidence,
      evidence: boundedText(zone.evidence, 160) || `${touchPoints.length} visible reactions align with the verified price band.`,
      touchPoints: touchPoints.slice(0, 6),
    }];
  }).slice(0, 4);

  if (!zones.length) { diagnostics.push("NO_ACCEPTED_ZONES"); return insufficientLiquidityShield("No candidate liquidity zone survived price-scale, side and candle-row verification."); }
  return {
    status: "VISIBLE_RISK_ZONES",
    summary: `${zones.length} visually inferred stop-risk zone${zones.length === 1 ? "" : "s"} passed scale, side and candle-row checks.`,
    zones,
    stopGuidance: boundedText(raw.stopGuidance, 220) || "Keep invalidation structurally decisive and verify the marked risk area on the original chart.",
  };
}
