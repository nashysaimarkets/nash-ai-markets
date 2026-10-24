import { assessProductionLiquidityChain, corroborateLiquidityEvent, validPlotBounds } from "./liquidity-chain.ts";
import { exactAxisPrice } from "../../pocket/axis-verification.ts";

type JsonRecord = Record<string, unknown>;

function scoreGrade(score: number) {
  return score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "F";
}

function boundedScore(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : 0;
}

function boundedPercent(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : fallback;
}

function numericPrice(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const source = value.replace(/[−–—]/g, "-").replace(/[’'\s]/g, "");
  const commaDecimal = /^-?\d+,\d{1,2}(?:\D|$)/.test(source) && !source.includes(".");
  const normalized = commaDecimal ? source.replace(",", ".") : source.replaceAll(",", "");
  const parsed = Number(normalized.match(/-?\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

type ScaleAnchor = { price: number; y: number };

const PATTERN_NAMES = new Set([
  "HEAD & SHOULDERS", "INVERSE H&S", "RISING WEDGE", "FALLING WEDGE", "BULL FLAG", "BEAR FLAG",
  "DOUBLE TOP", "DOUBLE BOTTOM", "TRIANGLE", "ASCENDING TRIANGLE", "DESCENDING TRIANGLE", "PENNANT",
  "CUP & HANDLE", "RECTANGLE / RANGE", "TREND CHANNEL", "BREAKOUT & RETEST",
]);

function hasNamedReversalTurns(name: string, points: { x: number; y: number }[]) {
  const shoulders = name === "HEAD & SHOULDERS" || name === "INVERSE H&S";
  const double = name === "DOUBLE TOP" || name === "DOUBLE BOTTOM";
  if (!shoulders && !double) return true;
  // Image y increases downward. Invert bottom/inverse paths so the same exact
  // peak/trough relationships apply, without guessing tolerance or symmetry.
  const inverse = name === "INVERSE H&S" || name === "DOUBLE BOTTOM";
  const ys = points.map(point => inverse ? -point.y : point.y);
  const length = shoulders ? 5 : 3;
  return ys.some((_value, start) => {
    const turn = ys.slice(start, start + length);
    if (turn.length !== length) return false;
    return shoulders
      ? turn[0] < turn[1] && turn[2] < Math.min(turn[0], turn[4]) && turn[4] < turn[3]
      : turn[0] < turn[1] && turn[2] < turn[1];
  });
}

function calibratedPatterns(value: unknown, candlesReadable: boolean) {
  if (!candlesReadable || !Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const pattern = item as JsonRecord;
    const name = typeof pattern.name === "string" ? pattern.name.trim().toUpperCase() : "";
    const status = typeof pattern.status === "string" ? pattern.status : "";
    const confidence = typeof pattern.confidence === "string" ? pattern.confidence : "LOW";
    const evidence = typeof pattern.evidence === "string" ? pattern.evidence.trim() : "";
    const confirmation = typeof pattern.confirmation === "string" ? pattern.confirmation.trim() : "";
    const invalidation = typeof pattern.invalidation === "string" ? pattern.invalidation.trim() : "";
    const geometry = pattern.geometry && typeof pattern.geometry === "object" ? pattern.geometry as JsonRecord : null;
    const rawPoints = geometry && Array.isArray(geometry.points) ? geometry.points : [];
    const points = rawPoints.flatMap((point) => {
      if (!point || typeof point !== "object") return [];
      const candidate = point as JsonRecord;
      const x = typeof candidate.x === "number" && Number.isFinite(candidate.x) ? candidate.x : null;
      const y = typeof candidate.y === "number" && Number.isFinite(candidate.y) ? candidate.y : null;
      return x !== null && y !== null && x >= 0 && x <= 100 && y >= 0 && y <= 100 ? [{ x, y }] : [];
    });
    if (rawPoints.length !== points.length || !PATTERN_NAMES.has(name) || !evidence || !confirmation || !invalidation || points.length < 3) return [];
    if (new Set(points.map(point => `${point.x}:${point.y}`)).size !== points.length) return [];
    if (points.some((point, index) => index > 0 && point.x <= points[index - 1].x) || !hasNamedReversalTurns(name, points)) return [];
    const xs = points.map((point) => point.x), ys = points.map((point) => point.y);
    const xSpan = Math.max(...xs) - Math.min(...xs), ySpan = Math.max(...ys) - Math.min(...ys);
    if (xSpan < 8 || ySpan < 3) return [];
    const safeStatus = status === "CONFIRMED" && confidence === "LOW" ? "AMBIGUOUS" : status;
    return [{ ...pattern, name, status: safeStatus, geometry: { ...geometry, points } }];
  }).slice(0, 4);
}

function calibratedLiquidity(value: unknown, candlesReadable: boolean, boundsValue: unknown, anchorsValue: unknown, quality: JsonRecord) {
  const source = value && typeof value === "object" ? value as JsonRecord : {};
  // Preserve the witness field even when claims are held. Explicit [] means
  // no reported witnesses; missing/malformed or rejected nonempty evidence
  // must not be rewritten as known-empty by the calibration/scorer boundary.
  const empty = { state: "NONE", event: "NONE", confidence: "LOW", evidence: "", confirmation: "", invalidation: "", zones: [], observations: source.observations };
  if (!candlesReadable || !value || typeof value !== "object") return empty;
  const rawState = source.state === "VERIFIED" || source.state === "PARTIAL" ? source.state : "NONE";
  if (rawState === "NONE") return empty;
  const confidence = source.confidence === "HIGH" || source.confidence === "MEDIUM" ? source.confidence : "LOW";
  const event = ["TESTING", "SWEEP", "RECLAIM", "REJECTION"].includes(String(source.event)) ? String(source.event) : "NONE";
  const evidence = typeof source.evidence === "string" ? source.evidence.trim() : "";
  const confirmation = typeof source.confirmation === "string" ? source.confirmation.trim() : "";
  const invalidation = typeof source.invalidation === "string" ? source.invalidation.trim() : "";
  if (!validPlotBounds(boundsValue)) {
    const chain = assessProductionLiquidityChain(source.observations, quality, boundsValue, []);
    return { ...empty, state: "PARTIAL", confidence, evidence, confirmation, invalidation,
      evidenceChain: { status: chain.status, reasons: chain.reasons } };
  }
  const { left, top, right, bottom } = boundsValue;
  const anchors = Array.isArray(anchorsValue) ? anchorsValue.flatMap((item) => item && typeof item === "object"
    ? [{ price: numericPrice((item as JsonRecord).price), y: numericPrice((item as JsonRecord).y) }] : [])
    .filter((item): item is ScaleAnchor => item.price !== null && item.price > 0 && item.y !== null && item.y >= 0 && item.y <= 100) : [];
  const scale = verifiedLinearScale(anchors);
  const zones = Array.isArray(source.zones) ? source.zones.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const zone = item as JsonRecord;
    const side: "BUY_SIDE" | "SELL_SIDE" | null = zone.side === "BUY_SIDE" || zone.side === "SELL_SIDE" ? zone.side : null;
    const allowedBasis = side === "BUY_SIDE"
      ? ["EQUAL_HIGHS", "PRIOR_SWING_HIGH", "RANGE_HIGH"]
      : ["EQUAL_LOWS", "PRIOR_SWING_LOW", "RANGE_LOW"];
    const basis = typeof zone.basis === "string" && allowedBasis.includes(zone.basis) ? zone.basis : null;
    const x = numericPrice(zone.x), x2 = numericPrice(zone.x2), y = numericPrice(zone.y), price = numericPrice(zone.price);
    if (!side || !basis || x === null || x2 === null || y === null || x < left || x2 > right || x2 - x < 8 || y < top || y > bottom) return [];
    const interval = zone.priceLow != null || zone.priceHigh != null;
    const low = zone.priceLow, high = zone.priceHigh;
    if (interval) {
      const exact = typeof zone.price === "string" ? exactAxisPrice(zone.price) : null;
      if (!scale || typeof low !== "number" || typeof high !== "number" || !Number.isFinite(low) || !Number.isFinite(high) || low <= 0 || high < low || exact === null || exact < low || exact > high) return [];
      const bandTop = scale.project(high), bandBottom = scale.project(low);
      if (low < scale.low.price || high > scale.high.price || bandTop < top || bandBottom > bottom || bandBottom-bandTop > (bottom-top)*.12) return [];
    }
    let calibratedY = y;
    let calibratedPrice = typeof zone.price === "string" ? zone.price : "";
    if (price !== null && scale) {
      const projected = scale.project(interval ? ((low as number)+(high as number))/2 : price);
      const tolerance = Math.max(4.5, (bottom - top) * 0.09);
      if (projected < top || projected > bottom || Math.abs(projected - y) > tolerance) return [];
      calibratedY = projected;
    } else {
      calibratedPrice = "";
    }
    const { priceLow: _rawLow, priceHigh: _rawHigh, ...rest } = zone;
    return [{ ...rest, ...(interval ? {priceLow:low,priceHigh:high} : {}), side, basis, price: calibratedPrice, x, x2, y: Math.max(top, Math.min(bottom, calibratedY)) }];
  }).slice(0, 4) : [];
  if (!zones.length || !evidence) return empty;
  const chain = assessProductionLiquidityChain(source.observations, quality, boundsValue, zones);
  const state = rawState === "VERIFIED" && confidence !== "LOW" && confirmation && invalidation && chain.status === "VERIFIED" ? "VERIFIED" : "PARTIAL";
  return { state, event: chain.status === "VERIFIED" ? corroborateLiquidityEvent(event, source.observations, zones) : "NONE", confidence, evidence, confirmation, invalidation, zones,
    observations: source.observations,
    evidenceChain: {status:chain.status,reasons:chain.reasons} };
}

function verifiedLinearScale(items: ScaleAnchor[]) {
  // Duplicate reads of the same tick are harmless. Conflicting labels or rows
  // must invalidate the scale, rather than disappear during deduplication.
  if (items.some((item, index) => items.slice(index + 1).some(candidate =>
    (candidate.price === item.price && candidate.y !== item.y) ||
    (candidate.y === item.y && candidate.price !== item.price)))) return null;
  const unique = items.filter((item, index, all) => all.findIndex((candidate) => candidate.price === item.price && candidate.y === item.y) === index);
  if (unique.length < 2) return null;
  const ordered = [...unique].sort((a, b) => a.price - b.price);
  if (!ordered.every((item, index) => index === 0 || item.y < ordered[index - 1].y)) return null;
  const low = ordered[0];
  const high = ordered.at(-1)!;
  // Two exact axis labels are sufficient only when they are widely separated;
  // each proposed level is independently checked against its original row.
  if (Math.abs(high.y - low.y) < (ordered.length === 2 ? 20 : 12)) return null;
  const project = (price: number) => low.y + ((price - low.price) / (high.price - low.price)) * (high.y - low.y);
  if (ordered.length >= 3 && ordered.some((item) => Math.abs(project(item.price) - item.y) > 2.5)) return null;
  return { low, high, project, count: ordered.length };
}

/** Applies non-negotiable evidence rules after structured model output. */
export function calibratePocketAnalysis(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const analysis = value as JsonRecord;
  const quality = analysis.evidenceQuality && typeof analysis.evidenceQuality === "object"
    ? analysis.evidenceQuality as JsonRecord
    : {};
  const score = analysis.setupScore && typeof analysis.setupScore === "object"
    ? analysis.setupScore as JsonRecord
    : {};
  const plotBounds = validPlotBounds(analysis.plotBounds) ? analysis.plotBounds : null;

  const unreadable = quality.chartReadability === "POOR" || quality.candlesReadable === false;
  const overall = unreadable ? Math.min(54, boundedScore(score.overall)) : boundedScore(score.overall);
  const calibrated: JsonRecord = {
    ...analysis,
    setupScore: { ...score, overall, grade: scoreGrade(overall) },
    patterns: calibratedPatterns(analysis.patterns, quality.candlesReadable !== false && quality.chartReadability !== "POOR"),
  };

  if (Array.isArray(analysis.missingInputs)) {
    calibrated.missingInputs = analysis.missingInputs.filter((item) =>
      typeof item === "string" && !/\b(entry|stop|target|trade size|position size|account size|risk percentage|stake)\b/i.test(item),
    ).slice(0, 2);
  }

  if (Array.isArray(analysis.levels) && plotBounds) {
    const { left, top, right, bottom } = plotBounds;
    const anchors = Array.isArray(analysis.priceScaleAnchors) ? analysis.priceScaleAnchors
      .flatMap((item) => item && typeof item === "object" ? [{ price: numericPrice((item as JsonRecord).price), y: numericPrice((item as JsonRecord).y) }] : [])
      .filter((item): item is { price: number; y: number } => item.price !== null && item.price > 0 && item.y !== null && item.y >= 0 && item.y <= 100)
      .sort((a, b) => a.price - b.price) : [];
    const scale = verifiedLinearScale(anchors);
    const low = scale?.low;
    const high = scale?.high;
    const calibratedScale = Boolean(scale);
    const currentPrice = numericPrice(analysis.currentPrice);
    const priceToY = (price: unknown, fallback: number) => {
      const numeric = numericPrice(price);
      if (!low || !high || low.price === high.price || numeric === null) return fallback;
      return low.y + ((numeric - low.price) / (high.price - low.price)) * (high.y - low.y);
    };
    calibrated.plotBounds = { left, top, right, bottom };
    const seen = new Set<string>();
    calibrated.levels = analysis.levels.flatMap((item) => {
      if (!item || typeof item !== "object") return item;
      const level = item as JsonRecord;
      let kind = level.kind;
      const suppliedY = numericPrice(level.y);
      const modelY = boundedPercent(level.y, 50);
      const price = numericPrice(level.price);
      // A vision pass can correctly read a horizontal price but invert its
      // semantic label. Market location is deterministic: below current is
      // support; above current is resistance.
      if ((kind === "support" || kind === "resistance") && currentPrice !== null && price !== null) {
        if (price < currentPrice) kind = "support";
        else if (price > currentPrice) kind = "resistance";
      }
      const horizontal = kind === "support" || kind === "resistance";
      const scaledY = horizontal ? priceToY(level.price, modelY) : modelY;
      // Axis anchors verify a linear scale, but the model often returns only
      // middle labels. Permit a candidate outside the sampled price interval
      // only when that scale still projects it inside the visible candle plot.
      // Reading crops improve tiny price labels but introduce a few percentage
      // points of full-image coordinate drift. The exact price is still
      // independently projected through a verified linear axis, so tolerate
      // that mobile crop offset while rejecting a genuinely different row.
      const geometryTolerance = Math.max(4.5, (bottom - top) * 0.09);
      const exactHorizontal = horizontal && calibratedScale && price !== null && suppliedY !== null && Math.abs(suppliedY - scaledY) <= geometryTolerance && scaledY >= top && scaledY <= bottom;
      const visualHorizontal = horizontal && !calibratedScale && quality.candlesReadable !== false && suppliedY !== null && suppliedY >= top && suppliedY <= bottom;
      if (horizontal && !exactHorizontal && !visualHorizontal) return [];
      const y = Math.max(top, Math.min(bottom, visualHorizontal ? modelY : scaledY));
      const key = `${String(kind)}:${Math.round(y * 2)}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{
        ...level,
        price: visualHorizontal ? "" : level.price,
        kind,
        x: horizontal ? left : Math.max(left, Math.min(right, boundedPercent(level.x, left))),
        y,
        x2: horizontal ? right : Math.max(left, Math.min(right, boundedPercent(level.x2, right))),
        y2: horizontal ? y : Math.max(top, Math.min(bottom, boundedPercent(level.y2, y))),
      }];
    });
  } else if (!plotBounds) {
    // Preserve the raw missing/malformed bounds as unknown evidence. Filtering
    // drawable claims does not repair the plot or assert that no structure exists.
    calibrated.levels = [];
    calibrated.fibLevels = [];
  }

  calibrated.liquidity = calibratedLiquidity(
    analysis.liquidity,
    quality.candlesReadable !== false && quality.chartReadability !== "POOR",
    analysis.plotBounds,
    calibrated.priceScaleAnchors ?? analysis.priceScaleAnchors,
    quality,
  );

  if (unreadable) {
    calibrated.verdict = "REVIEW_REQUIRED";
    calibrated.confidence = "LOW";
  }
  if (quality.instrumentConfidence !== "HIGH") calibrated.ticker = "UNKNOWN";
  if (quality.timeframeConfidence === "LOW" || quality.timeframeConfidence === "UNKNOWN") calibrated.timeframe = "UNKNOWN";
  const verifiedAnchors = Array.isArray(calibrated.priceScaleAnchors)
    ? calibrated.priceScaleAnchors.flatMap((item) => item && typeof item === "object"
      ? [{ price: numericPrice((item as JsonRecord).price), y: numericPrice((item as JsonRecord).y) }]
      : []).filter((item) => item.price !== null && item.y !== null)
    : [];
  // The dedicated geometry pass is authoritative for numeric overlays. Do not
  // erase its verified prices because the broader prose pass was conservative.
  const hasVerifiedScale = Boolean(plotBounds && verifiedLinearScale(verifiedAnchors as ScaleAnchor[]));
  if (hasVerifiedScale) {
    calibrated.evidenceQuality = { ...quality, scaleReadable: true };
  } else {
    // A prose claim of readability cannot restore numeric outputs after the
    // geometry pass failed to establish a consistent scale.
    calibrated.evidenceQuality = { ...quality, scaleReadable: false };
    calibrated.levels = Array.isArray(calibrated.levels)
      ? calibrated.levels.map((item) => item && typeof item === "object" ? { ...(item as JsonRecord), price: "" } : item)
      : [];
    calibrated.fibLevels = [];
  }

  return calibrated;
}
