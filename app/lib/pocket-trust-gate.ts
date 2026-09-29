type JsonRecord = Record<string, unknown>;

export function pocketScoreGrade(score: number) {
  return score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "F";
}

export function boundedPocketScore(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : 0;
}

/**
 * Keep report confidence, verdict and score beneath the final evidence gate.
 * This helper is shared by the API and client-side Level Lab replacement so a
 * fresh partial map can never leave an older actionable narrative attached.
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
    const overall = Math.min(69, boundedPocketScore(score.overall));
    analysis.setupScore = { ...score, overall, grade: pocketScoreGrade(overall) };
    return analysis;
  }

  analysis.confidence = "LOW";
  analysis.verdict = "REVIEW_REQUIRED";
  const overall = Math.min(54, boundedPocketScore(score.overall));
  analysis.setupScore = { ...score, overall, grade: pocketScoreGrade(overall) };
  return analysis;
}
