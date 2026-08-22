type JsonRecord = Record<string, unknown>;

function scoreGrade(score: number) {
  return score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "F";
}

function boundedScore(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : 0;
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
