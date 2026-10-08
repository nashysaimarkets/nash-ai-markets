import { assessProductionLiquidityChain } from "./liquidity-chain.ts";

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
    const xs = points.map((point) => point.x), ys = points.map((point) => point.y);
    const xSpan = Math.max(...xs) - Math.min(...xs), ySpan = Math.max(...ys) - Math.min(...ys);
    if (xSpan < 8 || ySpan < 3) return [];
    const safeStatus = status === "CONFIRMED" && confidence === "LOW" ? "AMBIGUOUS" : status;
    return [{ ...pattern, name, status: safeStatus, geometry: { ...geometry, points } }];
  }).slice(0, 4);
}

function calibratedLiquidity(value: unknown, candlesReadable: boolean, boundsValue: unknown, anchorsValue: unknown, quality: JsonRecord) {
  const empty = { state: "NONE", event: "NONE", confidence: "LOW", evidence: "", confirmation: "", invalidation: "", zones: [] };
  if (!candlesReadable || !value || typeof value !== "object") return empty;
  const source = value as JsonRecord;
  const rawState = source.state === "VERIFIED" || source.state === "PARTIAL" ? source.state : "NONE";
  if (rawState === "NONE") return empty;
  const confidence = source.confidence === "HIGH" || source.confidence === "MEDIUM" ? source.confidence : "LOW";
  const event = ["TESTING", "SWEEP", "RECLAIM", "REJECTION"].includes(String(source.event)) ? String(source.event) : "NONE";
  const evidence = typeof source.evidence === "string" ? source.evidence.trim() : "";
  const confirmation = typeof source.confirmation === "string" ? source.confirmation.trim() : "";
  const invalidation = typeof source.invalidation === "string" ? source.invalidation.trim() : "";
  const bounds = boundsValue && typeof boundsValue === "object" ? boundsValue as JsonRecord : {};
  const left = boundedPercent(bounds.left, 4), top = boundedPercent(bounds.top, 5);
  const right = Math.max(left + 1, boundedPercent(bounds.right, 96)), bottom = Math.max(top + 1, boundedPercent(bounds.bottom, 95));
  const anchors = Array.isArray(anchorsValue) ? anchorsValue.flatMap((item) => item && typeof item === "object"
    ? [{ price: numericPrice((item as JsonRecord).price), y: numericPrice((item as JsonRecord).y) }] : [])
    .filter((item): item is ScaleAnchor => item.price !== null && item.price > 0 && item.y !== null && item.y >= 0 && item.y <= 100) : [];
  const scale = verifiedLinearScale(anchors);
  const allowedBasis = new Set(["EQUAL_HIGHS", "EQUAL_LOWS", "PRIOR_SWING_HIGH", "PRIOR_SWING_LOW", "RANGE_HIGH", "RANGE_LOW"]);
  const zones = Array.isArray(source.zones) ? source.zones.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const zone = item as JsonRecord;
    const side: "BUY_SIDE" | "SELL_SIDE" | null = zone.side === "BUY_SIDE" || zone.side === "SELL_SIDE" ? zone.side : null;
    const basis = typeof zone.basis === "string" && allowedBasis.has(zone.basis) ? zone.basis : null;
    const x = numericPrice(zone.x), x2 = numericPrice(zone.x2), y = numericPrice(zone.y), price = numericPrice(zone.price);
    if (!side || !basis || x === null || x2 === null || y === null || x < left || x2 > right || x2 - x < 8 || y < top || y > bottom) return [];
    let calibratedY = y;
    let calibratedPrice = typeof zone.price === "string" ? zone.price : "";
    if (price !== null && scale) {
      const projected = scale.project(price);
      const tolerance = Math.max(4.5, (bottom - top) * 0.09);
      if (projected < top || projected > bottom || Math.abs(projected - y) > tolerance) return [];
      calibratedY = projected;
    } else {
      calibratedPrice = "";
    }
    return [{ ...zone, side, basis, price: calibratedPrice, x, x2, y: Math.max(top, Math.min(bottom, calibratedY)) }];
  }).slice(0, 4) : [];
  if (!zones.length || !evidence) return empty;
  const chain = assessProductionLiquidityChain(source.observations, quality, boundsValue, zones);
  const state = rawState === "VERIFIED" && confidence !== "LOW" && confirmation && invalidation && chain.status === "VERIFIED" ? "VERIFIED" : "PARTIAL";
  return { state, event, confidence, evidence, confirmation, invalidation, zones,
    evidenceChain: {status:chain.status,reasons:chain.reasons} };
}

function verifiedLinearScale(items: ScaleAnchor[]) {
  const unique = items.filter((item, index, all) => all.findIndex((candidate) => candidate.price === item.price || candidate.y === item.y) === index);
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

  if (Array.isArray(analysis.levels) && analysis.plotBounds && typeof analysis.plotBounds === "object") {
    const rawBounds = analysis.plotBounds as JsonRecord;
    const left = boundedPercent(rawBounds.left, 4);
    const top = boundedPercent(rawBounds.top, 5);
    const right = Math.max(left + 1, boundedPercent(rawBounds.right, 96));
    const bottom = Math.max(top + 1, boundedPercent(rawBounds.bottom, 95));
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
  const hasVerifiedScale = Boolean(verifiedLinearScale(verifiedAnchors as ScaleAnchor[]));
  if (hasVerifiedScale) {
    calibrated.evidenceQuality = { ...quality, scaleReadable: true };
  } else if (quality.scaleReadable === false) {
    calibrated.levels = Array.isArray(calibrated.levels)
      ? calibrated.levels.map((item) => item && typeof item === "object" ? { ...(item as JsonRecord), price: "" } : item)
      : [];
    calibrated.fibLevels = [];
  }

  return calibrated;
}
