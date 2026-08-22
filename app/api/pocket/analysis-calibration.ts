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
  const parsed = Number(value.replaceAll(",", "").match(/-?\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(parsed) ? parsed : null;
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
      .flatMap((item) => item && typeof item === "object" ? [{ price: numericPrice((item as JsonRecord).price), y: boundedPercent((item as JsonRecord).y, 50) }] : [])
      .filter((item): item is { price: number; y: number } => item.price !== null)
      .sort((a, b) => a.price - b.price) : [];
    const low = anchors[0];
    const high = anchors.at(-1);
    const priceToY = (price: unknown, fallback: number) => {
      const numeric = numericPrice(price);
      if (!low || !high || low.price === high.price || numeric === null) return fallback;
      return low.y + ((numeric - low.price) / (high.price - low.price)) * (high.y - low.y);
    };
    calibrated.plotBounds = { left, top, right, bottom };
    calibrated.levels = analysis.levels.map((item) => {
      if (!item || typeof item !== "object") return item;
      const level = item as JsonRecord;
      const kind = level.kind;
      const modelY = boundedPercent(level.y, 50);
      const scaledY = quality.scaleReadable === true ? priceToY(level.price, modelY) : modelY;
      const y = Math.max(top, Math.min(bottom, scaledY));
      const horizontal = kind === "support" || kind === "resistance";
      return {
        ...level,
        x: horizontal ? left : Math.max(left, Math.min(right, boundedPercent(level.x, left))),
        y,
        x2: horizontal ? right : Math.max(left, Math.min(right, boundedPercent(level.x2, right))),
        y2: horizontal ? y : Math.max(top, Math.min(bottom, boundedPercent(level.y2, y))),
      };
    });
  }

  if (unreadable) {
    calibrated.verdict = "REVIEW_REQUIRED";
    calibrated.confidence = "LOW";
  }
  if (quality.instrumentConfidence !== "HIGH") calibrated.ticker = "UNKNOWN";
  if (quality.timeframeConfidence === "LOW" || quality.timeframeConfidence === "UNKNOWN") calibrated.timeframe = "UNKNOWN";
  if (quality.scaleReadable === false) {
    calibrated.levels = Array.isArray(analysis.levels)
      ? analysis.levels.map((item) => item && typeof item === "object" ? { ...(item as JsonRecord), price: "" } : item)
      : [];
    calibrated.fibLevels = [];
  }

  return calibrated;
}
