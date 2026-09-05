import { structuralSideCoverage } from "./precision-structure.ts";
import { canonicalizePocketGeometry } from "../../lib/pocket-geometry.ts";
import { boundedPocketScore as boundedScore, enforcePocketTrustGate, pocketScoreGrade as scoreGrade } from "../../lib/pocket-trust-gate.ts";

export { enforcePocketTrustGate } from "../../lib/pocket-trust-gate.ts";

type JsonRecord = Record<string, unknown>;

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

const PATTERN_MIN_POINTS: Record<string, number> = {
  "HEAD & SHOULDERS": 5,
  "INVERSE H&S": 5,
  "DOUBLE TOP": 3,
  "DOUBLE BOTTOM": 3,
  "CUP & HANDLE": 6,
  "BREAKOUT & RETEST": 3,
  "RECTANGLE / RANGE": 4,
  "TREND CHANNEL": 4,
  "ASCENDING TRIANGLE": 4,
  "DESCENDING TRIANGLE": 4,
  "TRIANGLE": 4,
  "RISING WEDGE": 4,
  "FALLING WEDGE": 4,
  "BULL FLAG": 4,
  "BEAR FLAG": 4,
  "PENNANT": 4,
};

function patternSpanThreshold(name: string) {
  if (["BULL FLAG", "BEAR FLAG", "PENNANT", "BREAKOUT & RETEST"].includes(name)) return { x: .055, y: .03 };
  if (["RECTANGLE / RANGE", "TREND CHANNEL"].includes(name)) return { x: .08, y: .035 };
  return { x: .1, y: .04 };
}

function calibratePatterns(value: unknown, primaryBounds: JsonRecord | null, candlesReadable: boolean) {
  if (!Array.isArray(value) || !candlesReadable) return [];
  const seenSources = new Set<string>();
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const pattern = item as JsonRecord;
    const name = typeof pattern.name === "string" ? pattern.name : "";
    const sourceRole = typeof pattern.sourceRole === "string" ? pattern.sourceRole : "";
    if (!["PRIMARY", "HIGHER_TIMEFRAME", "PRICE_DETAIL", "INDICATOR_VOLUME"].includes(sourceRole)) return [];
    const minimum = PATTERN_MIN_POINTS[name];
    const geometry = pattern.geometry && typeof pattern.geometry === "object" ? pattern.geometry as JsonRecord : null;
    const returnedBounds = geometry?.plotBounds && typeof geometry.plotBounds === "object" ? geometry.plotBounds as JsonRecord : null;
    const bounds = sourceRole === "PRIMARY" && primaryBounds ? primaryBounds : returnedBounds;
    const left = numericPrice(bounds?.left);
    const right = numericPrice(bounds?.right);
    const top = numericPrice(bounds?.top);
    const bottom = numericPrice(bounds?.bottom);
    if (left === null || right === null || top === null || bottom === null || right <= left || bottom <= top) return [];
    const points = Array.isArray(geometry?.points) ? geometry.points.flatMap((point) => {
      if (!point || typeof point !== "object") return [];
      const x = numericPrice((point as JsonRecord).x);
      const y = numericPrice((point as JsonRecord).y);
      return x === null || y === null ? [] : [{ x, y }];
    }) : [];
    if (!minimum || points.length < minimum) return [];
    if (points.some((point) => point.x < left || point.x > right || point.y < top || point.y > bottom)) return [];
    if (points.some((point, index) => index > 0 && point.x < points[index - 1]!.x - .5)) return [];
    const xSpan = Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x));
    const ySpan = Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y));
    const span = patternSpanThreshold(name);
    if (xSpan < (right - left) * span.x || ySpan < (bottom - top) * span.y) return [];
    if (typeof pattern.evidence !== "string" || pattern.evidence.trim().length < 24) return [];
    if (typeof pattern.confirmation !== "string" || pattern.confirmation.trim().length < 12) return [];
    if (typeof pattern.invalidation !== "string" || pattern.invalidation.trim().length < 12) return [];
    const timeframe = typeof pattern.timeframe === "string" ? pattern.timeframe.trim().toUpperCase() : "";
    const frameKey = timeframe.replace(/[^A-Z0-9]/g, "");
    if (!frameKey || seenSources.has(sourceRole)) return [];
    seenSources.add(sourceRole);
    const status = pattern.status;
    const confidence = pattern.confidence === "HIGH" && status !== "CONFIRMED" && status !== "EXTENDED"
      ? "MEDIUM"
      : pattern.confidence;
    return [{ ...pattern, confidence }];
  }).slice(0, 4);
}

export function verifiedLinearScale(items: ScaleAnchor[]) {
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

/**
 * Re-apply evidence rules after structured model output.
 * Callers such as Level Lab may supply a dedicated linear-scale checker;
 * the default remains the global verifiedLinearScale used by the primary read.
 */
export function calibratePocketAnalysis(
  value: unknown,
  linearScale: typeof verifiedLinearScale = verifiedLinearScale,
): unknown {
  if (!value || typeof value !== "object") return value;
  const analysis = canonicalizePocketGeometry(value) as JsonRecord;
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
  };

  const initialBounds = analysis.plotBounds && typeof analysis.plotBounds === "object"
    ? analysis.plotBounds as JsonRecord
    : null;
  calibrated.patterns = calibratePatterns(analysis.patterns, initialBounds, quality.candlesReadable === true);

  if (Array.isArray(analysis.missingInputs)) {
    calibrated.missingInputs = analysis.missingInputs.filter((item) =>
      typeof item === "string" && !/\b(entry|stop|target|trade size|position size|account size|risk percentage|stake)\b/i.test(item),
    ).slice(0, 2);
  }

  if (Array.isArray(analysis.levels) && analysis.plotBounds && typeof analysis.plotBounds === "object") {
    const rawBounds = analysis.plotBounds as JsonRecord;
    const left = Math.min(99, boundedPercent(rawBounds.left, 4));
    const top = Math.min(99, boundedPercent(rawBounds.top, 5));
    const right = Math.min(100, Math.max(left + 1, boundedPercent(rawBounds.right, 96)));
    const bottom = Math.min(100, Math.max(top + 1, boundedPercent(rawBounds.bottom, 95)));
    const anchors = Array.isArray(analysis.priceScaleAnchors) ? analysis.priceScaleAnchors
      .flatMap((item) => item && typeof item === "object" ? [{ price: numericPrice((item as JsonRecord).price), y: numericPrice((item as JsonRecord).y) }] : [])
      .filter((item): item is { price: number; y: number } => item.price !== null && item.price > 0 && item.y !== null && item.y >= top && item.y <= bottom)
      .sort((a, b) => a.price - b.price) : [];
    const scale = linearScale(anchors);
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
      // Market location is deterministic. A rounded quote effectively on the
      // current row is a pivot/at-market marker, not evidence for either side;
      // otherwise a support just above market could be counted as resistance
      // by one gate and displayed as support by another.
      if ((kind === "support" || kind === "resistance") && currentPrice !== null && price !== null) {
        const sideTolerance = Math.max(Math.abs(currentPrice) * .00015, .01);
        if (price < currentPrice - sideTolerance) kind = "support";
        else if (price > currentPrice + sideTolerance) kind = "resistance";
        else kind = "pivot";
      }
      const horizontal = kind === "support" || kind === "resistance";
      const scaledY = horizontal ? priceToY(level.price, modelY) : modelY;
      // Axis anchors verify a linear scale, but the model often returns only
      // middle labels. Permit a candidate outside the sampled price interval
      // only when that scale still projects it inside the visible candle plot.
      // Mobile vision coordinates carry a few percentage points of row jitter.
      // The exact price is still independently projected through a verified
      // linear axis, so tolerate that bounded jitter while rejecting a
      // genuinely different candle row.
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

  if (unreadable) {
    calibrated.verdict = "REVIEW_REQUIRED";
    calibrated.confidence = "LOW";
  }
  if (quality.instrumentConfidence !== "HIGH") calibrated.ticker = "UNKNOWN";
  if (quality.timeframeConfidence === "LOW" || quality.timeframeConfidence === "UNKNOWN") calibrated.timeframe = "UNKNOWN";
  const calibratedBounds = calibrated.plotBounds && typeof calibrated.plotBounds === "object" ? calibrated.plotBounds as JsonRecord : null;
  const verifiedTop = calibratedBounds ? numericPrice(calibratedBounds.top) : null;
  const verifiedBottom = calibratedBounds ? numericPrice(calibratedBounds.bottom) : null;
  const verifiedAnchors = Array.isArray(calibrated.priceScaleAnchors)
    ? calibrated.priceScaleAnchors.flatMap((item) => item && typeof item === "object"
      ? [{ price: numericPrice((item as JsonRecord).price), y: numericPrice((item as JsonRecord).y) }]
      : []).filter((item) => item.price !== null && item.y !== null
        && verifiedTop !== null && verifiedBottom !== null
        && item.y >= verifiedTop && item.y <= verifiedBottom)
    : [];
  // The dedicated geometry pass is authoritative for numeric overlays. Do not
  // erase its verified prices because the broader prose pass was conservative.
  const hasVerifiedScale = Boolean(linearScale(verifiedAnchors as ScaleAnchor[]));
  if (hasVerifiedScale) {
    calibrated.evidenceQuality = { ...quality, scaleReadable: true };
  } else if (quality.scaleReadable === false) {
    calibrated.levels = Array.isArray(calibrated.levels)
      ? calibrated.levels.map((item) => item && typeof item === "object" ? { ...(item as JsonRecord), price: "" } : item)
      : [];
    calibrated.fibLevels = [];
  }

  const hasTrustInputs = Array.isArray(analysis.levels)
    && Boolean(analysis.plotBounds && typeof analysis.plotBounds === "object")
    && Array.isArray(analysis.priceScaleAnchors);
  const structuralLevels = Array.isArray(calibrated.levels)
    ? calibrated.levels.filter((item) => item && typeof item === "object" && ["support", "resistance", "pivot"].includes(String((item as JsonRecord).kind)))
    : [];
  const horizontalLevels = structuralLevels.filter((item) => ["support", "resistance"].includes(String((item as JsonRecord).kind)));
  const exactStructuralLevels = horizontalLevels.filter((item) => numericPrice((item as JsonRecord).price) !== null);
  const chartLocked = quality.chartReadability === "CLEAR" && quality.candlesReadable === true;
  const identityLocked = quality.instrumentConfidence === "HIGH" && quality.timeframeConfidence === "HIGH";
  const structuralCoverage = structuralSideCoverage(exactStructuralLevels, calibrated.currentPrice);
  const scaleLocked = hasVerifiedScale && structuralCoverage.twoSided;
  const contradictions = Array.isArray(analysis.contradictions) ? analysis.contradictions.filter((item) => typeof item === "string" && item.trim()) : [];
  const status = chartLocked && identityLocked && scaleLocked
    ? "LOCKED"
    : unreadable || !horizontalLevels.length
      ? "HOLD"
      : "PARTIAL";
  const trustReasons = [
    chartLocked ? "Candles and structure are readable" : "Chart readability is incomplete",
    identityLocked ? "Instrument and timeframe are verified" : "Instrument or timeframe needs confirmation",
    scaleLocked ? `${exactStructuralLevels.length} exact structural levels bracket current price` : horizontalLevels.length ? "Two-sided exact structure is not verified" : "No structural level passed verification",
    contradictions.length ? `${contradictions.length} contradiction${contradictions.length === 1 ? "" : "s"} remain visible` : "No explicit contradiction was returned",
  ];
  if (hasTrustInputs) calibrated.trustGate = {
    status,
    chartLocked,
    identityLocked,
    scaleLocked,
    exactLevelCount: exactStructuralLevels.length,
    reasons: trustReasons,
    nextAction: status === "LOCKED"
      ? "Verify the marked prices on the original chart before acting."
      : !identityLocked
        ? "Confirm the instrument, timeframe and current price, then reanalyse."
        : !scaleLocked
          ? "Add a chart with a clear price scale or a supporting timeframe, then reanalyse."
          : "Use a clearer chart before relying on this read.",
  };

  // A visually plausible narrative must never outrank the evidence gate.
  // Without a locked chart identity and verified structural map, Bullseye may
  // still explain what is visible but cannot present the result as trade-ready.
  return hasTrustInputs ? enforcePocketTrustGate(calibrated) : calibrated;
}
