export type CompatibleIntention = "LONG" | "SHORT" | "UNSURE";

export type CompatibleProcessReview = {
  outcome: "PROFIT" | "LOSS" | "BREAKEVEN" | "UNCLEAR";
  processGrade: "A" | "B" | "C" | "D" | "F";
  decisionQuality: number;
  headline: string;
  outcomeSummary: string;
  confirmationReview: string;
  invalidationReview: string;
  timingReview: string;
  disciplineReview: string;
  goodDecisionBadOutcome: boolean;
  thesisStatus: "HELD" | "FAILED" | "CHANGED" | "NOT_PROVEN";
  structureShift: "STRENGTHENED" | "WEAKENED" | "FLIPPED" | "UNCHANGED" | "UNCLEAR";
  rootCause: "CHART_READ" | "ENTRY_TIMING" | "STOP_PLACEMENT" | "DISCIPLINE" | "MARKET_OUTCOME" | "NOT_PROVEN";
  evidenceChanges: Array<{ before: string; after: string; impact: "STRENGTHENED" | "WEAKENED" | "INVALIDATED" | "UNCHANGED" | "UNCLEAR" }>;
  nextRule: string;
  lessons: string[];
  behaviourTags: string[];
};

export type CompatibleLockedDecision = {
  id: string;
  createdAt: string;
  intention: CompatibleIntention;
  image: string;
  afterImage?: string;
  reviewedAt?: string;
  review?: CompatibleProcessReview;
  analysis: Record<string, unknown> & {
    instrument: string;
    verdict: string;
    riskFlags: string[];
    setupScore: Record<string, unknown> & { overall: number; grade: "A" | "B" | "C" | "D" | "F" };
  };
};

const GRADES = new Set(["A", "B", "C", "D", "F"]);
const INTENTIONS = new Set(["LONG", "SHORT", "UNSURE"]);
const OUTCOMES = new Set(["PROFIT", "LOSS", "BREAKEVEN", "UNCLEAR"]);
const THESIS_STATUSES = new Set(["HELD", "FAILED", "CHANGED", "NOT_PROVEN"]);
const STRUCTURE_SHIFTS = new Set(["STRENGTHENED", "WEAKENED", "FLIPPED", "UNCHANGED", "UNCLEAR"]);
const ROOT_CAUSES = new Set(["CHART_READ", "ENTRY_TIMING", "STOP_PLACEMENT", "DISCIPLINE", "MARKET_OUTCOME", "NOT_PROVEN"]);
const CHANGE_IMPACTS = new Set(["STRENGTHENED", "WEAKENED", "INVALIDATED", "UNCHANGED", "UNCLEAR"]);

function finiteScore(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : 0;
}

function safeText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim().slice(0, 320) : fallback;
}

function safeTexts(value: unknown, limit: number, maxLength: number) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, maxLength)).filter(Boolean).slice(0, limit)
    : [];
}

function normalizeProcessReview(value: unknown): CompatibleProcessReview | null {
  if (!value || typeof value !== "object") return null;
  const review = value as Record<string, unknown>;
  if (typeof review.processGrade !== "string" || !GRADES.has(review.processGrade)) return null;
  const impact = (value: unknown) => typeof value === "string" && CHANGE_IMPACTS.has(value)
    ? value as CompatibleProcessReview["evidenceChanges"][number]["impact"]
    : "UNCLEAR";
  return {
    outcome: typeof review.outcome === "string" && OUTCOMES.has(review.outcome) ? review.outcome as CompatibleProcessReview["outcome"] : "UNCLEAR",
    processGrade: review.processGrade as CompatibleProcessReview["processGrade"],
    decisionQuality: finiteScore(review.decisionQuality),
    headline: safeText(review.headline, "Decision review complete."),
    outcomeSummary: safeText(review.outcomeSummary, "The screenshots do not prove the financial outcome."),
    confirmationReview: safeText(review.confirmationReview, "Confirmation could not be proven."),
    invalidationReview: safeText(review.invalidationReview, "Invalidation could not be proven."),
    timingReview: safeText(review.timingReview, "Timing could not be proven."),
    disciplineReview: safeText(review.disciplineReview, "Discipline could not be proven."),
    goodDecisionBadOutcome: review.goodDecisionBadOutcome === true,
    thesisStatus: typeof review.thesisStatus === "string" && THESIS_STATUSES.has(review.thesisStatus) ? review.thesisStatus as CompatibleProcessReview["thesisStatus"] : "NOT_PROVEN",
    structureShift: typeof review.structureShift === "string" && STRUCTURE_SHIFTS.has(review.structureShift) ? review.structureShift as CompatibleProcessReview["structureShift"] : "UNCLEAR",
    rootCause: typeof review.rootCause === "string" && ROOT_CAUSES.has(review.rootCause) ? review.rootCause as CompatibleProcessReview["rootCause"] : "NOT_PROVEN",
    evidenceChanges: Array.isArray(review.evidenceChanges) ? review.evidenceChanges.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const change = item as Record<string, unknown>;
      const before = safeText(change.before).slice(0, 120);
      const after = safeText(change.after).slice(0, 120);
      return before && after ? [{ before, after, impact: impact(change.impact) }] : [];
    }).slice(0, 4) : [],
    nextRule: safeText(review.nextRule, "Wait for visible confirmation before changing the plan.").slice(0, 180),
    lessons: safeTexts(review.lessons, 4, 150),
    behaviourTags: safeTexts(review.behaviourTags, 5, 50),
  };
}

/**
 * Migrates device-local decisions written by earlier Pocket Bullseye builds.
 * The screenshot string is returned unchanged so saved chart bytes are never
 * recompressed or silently modified.
 */
export function normalizeLockedDecision(value: unknown): CompatibleLockedDecision | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.image !== "string" || !candidate.image.startsWith("data:image/")) return null;

  const rawAnalysis = candidate.analysis && typeof candidate.analysis === "object"
    ? candidate.analysis as Record<string, unknown>
    : {};
  const rawScore = rawAnalysis.setupScore && typeof rawAnalysis.setupScore === "object"
    ? rawAnalysis.setupScore as Record<string, unknown>
    : {};
  const overall = finiteScore(rawScore.overall);
  const inferredGrade = overall >= 85 ? "A" : overall >= 70 ? "B" : overall >= 55 ? "C" : overall >= 40 ? "D" : "F";
  const grade = typeof rawScore.grade === "string" && GRADES.has(rawScore.grade)
    ? rawScore.grade as CompatibleLockedDecision["analysis"]["setupScore"]["grade"]
    : inferredGrade;
  const intention = typeof candidate.intention === "string" && INTENTIONS.has(candidate.intention)
    ? candidate.intention as CompatibleIntention
    : "UNSURE";
  const review = normalizeProcessReview(candidate.review);

  return {
    id: typeof candidate.id === "string" && candidate.id ? candidate.id : `legacy-${String(candidate.createdAt ?? "unknown")}`,
    createdAt: typeof candidate.createdAt === "string" && Number.isFinite(Date.parse(candidate.createdAt))
      ? candidate.createdAt
      : new Date(0).toISOString(),
    intention,
    image: candidate.image,
    ...(typeof candidate.afterImage === "string" && candidate.afterImage.startsWith("data:image/") ? { afterImage: candidate.afterImage } : {}),
    ...(typeof candidate.reviewedAt === "string" && Number.isFinite(Date.parse(candidate.reviewedAt)) ? { reviewedAt: candidate.reviewedAt } : {}),
    ...(review ? { review } : {}),
    analysis: {
      ...rawAnalysis,
      instrument: typeof rawAnalysis.instrument === "string" && rawAnalysis.instrument.trim()
        ? rawAnalysis.instrument
        : "UNKNOWN INSTRUMENT",
      verdict: typeof rawAnalysis.verdict === "string" ? rawAnalysis.verdict : "REVIEW_REQUIRED",
      riskFlags: Array.isArray(rawAnalysis.riskFlags)
        ? rawAnalysis.riskFlags.filter((item): item is string => typeof item === "string").slice(0, 4)
        : [],
      setupScore: { ...rawScore, overall, grade },
    },
  };
}

export function normalizeLockedDecisions(values: unknown): CompatibleLockedDecision[] {
  if (!Array.isArray(values)) return [];
  return values.map(normalizeLockedDecision).filter((item): item is CompatibleLockedDecision => item !== null);
}
