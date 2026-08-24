export const ACCURACY_STORAGE_KEY = "pocket-bullseye-accuracy-feedback-v1";
export type AccuracyCategory = "INSTRUMENT" | "TIMEFRAME" | "CURRENT_PRICE" | "SUPPORT" | "RESISTANCE" | "CHART_READING";
export type AccuracyFeedback = {
  id: string;
  createdAt: string;
  verdict: "ACCURATE" | "NEEDS_CORRECTION";
  categories: AccuracyCategory[];
  correction: string;
  note: string;
  snapshot: {
    instrument: string;
    timeframe: string;
    currentPrice: string;
    support: string[];
    resistance: string[];
  };
};

export function readAccuracyFeedback(raw: string | null): AccuracyFeedback[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((item): item is AccuracyFeedback =>
      item && typeof item === "object" && typeof item.id === "string" &&
      (item.verdict === "ACCURATE" || item.verdict === "NEEDS_CORRECTION") &&
      Array.isArray(item.categories) && item.snapshot && typeof item.snapshot === "object"
    ).slice(0, 100) : [];
  } catch { return []; }
}

export function accuracySummary(items: AccuracyFeedback[]) {
  const total = items.length;
  const accurate = items.filter((item) => item.verdict === "ACCURATE").length;
  const corrections = items.filter((item) => item.verdict === "NEEDS_CORRECTION");
  const counts = corrections.flatMap((item) => item.categories).reduce<Partial<Record<AccuracyCategory, number>>>((all, category) => {
    all[category] = (all[category] ?? 0) + 1; return all;
  }, {});
  const repeatedIssue = (Object.entries(counts) as [AccuracyCategory, number][]).sort((a,b) => b[1]-a[1])[0]?.[0] ?? "NONE";
  return { total, accurate, rate: total ? Math.round(accurate / total * 100) : 0, corrections: corrections.length, repeatedIssue };
}

export function benchmarkCandidates(items: AccuracyFeedback[]) {
  return items.filter((item) => item.verdict === "NEEDS_CORRECTION" && item.categories.length > 0).map((item) => ({
    id: item.id,
    expected: { categories: item.categories, correction: item.correction, note: item.note },
    observed: item.snapshot,
  }));
}
