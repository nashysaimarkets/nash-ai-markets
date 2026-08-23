export type CompatibleIntention = "LONG" | "SHORT" | "UNSURE";

export type CompatibleLockedDecision = {
  id: string;
  createdAt: string;
  intention: CompatibleIntention;
  image: string;
  analysis: Record<string, unknown> & {
    instrument: string;
    verdict: string;
    riskFlags: string[];
    setupScore: Record<string, unknown> & { overall: number; grade: "A" | "B" | "C" | "D" | "F" };
  };
};

const GRADES = new Set(["A", "B", "C", "D", "F"]);
const INTENTIONS = new Set(["LONG", "SHORT", "UNSURE"]);

function finiteScore(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : 0;
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

  return {
    id: typeof candidate.id === "string" && candidate.id ? candidate.id : `legacy-${String(candidate.createdAt ?? "unknown")}`,
    createdAt: typeof candidate.createdAt === "string" && Number.isFinite(Date.parse(candidate.createdAt))
      ? candidate.createdAt
      : new Date(0).toISOString(),
    intention,
    image: candidate.image,
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
