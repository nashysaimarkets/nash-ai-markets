import { structuralSideCoverage } from "./precision-structure.ts";

type JsonRecord = Record<string, unknown>;

function scoreGrade(score: number) {
  return score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "F";
}

function boundedScore(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : 0;
}

/**
 * Reapply the customer-facing score, confidence and verdict ceilings after the
 * final structural trust gate has been calculated. The combined primary +
 * context battlefield is assembled after the broad report calibration, so the
 * route must run this guard once more with that final gate rather than leaving
 * an earlier HIGH/A narrative attached to a withheld map.
 */
export function enforcePocketTrustGate(value: unknown, gateValue?: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const analysis = { ...(value as JsonRecord) };
  const candidate = gateValue ?? analysis.trustGate;
  if (!candidate || typeof candidate !== "object") return analysis;
  const gate = candidate as JsonRecord;
  const status = String(gate.status);
  analysis.trustGate = gate;
  if (status === "LOCKED") return analysis;

  const score = analysis.setupScore && typeof analysis.setupScore === "object"
    ? analysis.setupScore as JsonRecord
    : {};
  if (status === "PARTIAL") {
    analysis.confidence = analysis.confidence === "HIGH" || analysis.confidence === "MEDIUM"
      ? "MEDIUM"
      : "LOW";
    analysis.verdict = analysis.verdict === "WATCH"
      ? "WAIT"
      : ["WAIT", "STAND_ASIDE", "REVIEW_REQUIRED"].includes(String(analysis.verdict))
        ? analysis.verdict
        : "REVIEW_REQUIRED";
    const overall = Math.min(69, boundedScore(score.overall));
    analysis.setupScore = { ...score, overall, grade: scoreGrade(overall) };
    return analysis;
  }

  // HOLD is the current fail-closed state. Unknown future/non-locked states
  // also take the same conservative ceiling until explicitly supported.
  analysis.confidence = "LOW";
  analysis.verdict = "REVIEW_REQUIRED";
  const overall = Math.min(54, boundedScore(score.overall));
  analysis.setupScore = { ...score, overall, grade: scoreGrade(overall) };
  return analysis;
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
  const exactStructuralLevels = structuralLevels.filter((item) => numericPrice((item as JsonRecord).price) !== null);
  const chartLocked = quality.chartReadability === "CLEAR" && quality.candlesReadable === true;
  const identityLocked = quality.instrumentConfidence === "HIGH" && quality.timeframeConfidence === "HIGH";
  const structuralCoverage = structuralSideCoverage(exactStructuralLevels, calibrated.currentPrice);
  const scaleLocked = hasVerifiedScale && structuralCoverage.twoSided;
  const contradictions = Array.isArray(analysis.contradictions) ? analysis.contradictions.filter((item) => typeof item === "string" && item.trim()) : [];
  const status = chartLocked && identityLocked && scaleLocked
    ? "LOCKED"
    : unreadable || !structuralLevels.length
      ? "HOLD"
      : "PARTIAL";
  const trustReasons = [
    chartLocked ? "Candles and structure are readable" : "Chart readability is incomplete",
    identityLocked ? "Instrument and timeframe are verified" : "Instrument or timeframe needs confirmation",
    scaleLocked ? `${exactStructuralLevels.length} exact structural levels bracket current price` : structuralLevels.length ? "Two-sided exact structure is not verified" : "No structural level passed verification",
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
