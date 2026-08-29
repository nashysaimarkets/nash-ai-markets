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

export type NormalizedAccuracyCorrection = {
  category: AccuracyCategory;
  categories: [AccuracyCategory];
  correction: string;
  note: string;
  instrument?: string;
  timeframe?: string;
  currentPrice?: string;
  level?: { kind: "support" | "resistance"; price: string };
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

export type AccuracyCorrectionPatch = {
  instrument?: string;
  timeframe?: string;
  currentPrice?: string;
  level?: { kind: "support" | "resistance"; price: string };
};

const CORRECTION_NUMBER = "-?(?:\\d+(?:\\.\\d+)?|\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?)";
const ACCURACY_CATEGORIES = new Set<AccuracyCategory>(["INSTRUMENT", "TIMEFRAME", "CURRENT_PRICE", "SUPPORT", "RESISTANCE", "CHART_READING"]);

function categoryPrice(value: string, category: "CURRENT_PRICE" | "SUPPORT" | "RESISTANCE") {
  const label = category === "CURRENT_PRICE" ? "(?:current\\s*price|price)" : category.toLowerCase();
  const match = value.trim().replace(/[−–—]/g, "-").match(new RegExp(`^(?:${label}\\s*(?::|=)?\\s*)?(${CORRECTION_NUMBER})$`, "i"));
  return match?.[1] ?? null;
}

/** Normalize one correction fact for both the browser replay and API boundary. */
export function normalizeAccuracyCorrection(value: unknown): NormalizedAccuracyCorrection | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.verdict !== "NEEDS_CORRECTION" || !Array.isArray(candidate.categories) || candidate.categories.length !== 1) return null;
  const category = candidate.categories[0];
  if (typeof category !== "string" || !ACCURACY_CATEGORIES.has(category as AccuracyCategory)) return null;
  const typedCategory = category as AccuracyCategory;
  const correction = typeof candidate.correction === "string" ? candidate.correction.trim().replace(/\s+/g, " ").slice(0, 80) : "";
  const note = typeof candidate.note === "string" ? candidate.note.trim().replace(/\s+/g, " ").slice(0, 180) : "";
  const normalized: NormalizedAccuracyCorrection = { category: typedCategory, categories: [typedCategory], correction, note };

  if (typedCategory === "INSTRUMENT") {
    if (!correction) return null;
    normalized.instrument = correction;
  }
  if (typedCategory === "TIMEFRAME") {
    if (!correction) return null;
    normalized.timeframe = correction.slice(0, 30);
  }
  if (["CURRENT_PRICE", "SUPPORT", "RESISTANCE"].includes(typedCategory)) {
    if (!correction) return null;
    const numeric = categoryPrice(correction, typedCategory as "CURRENT_PRICE" | "SUPPORT" | "RESISTANCE");
    const canonical = numeric?.replaceAll(",", "") ?? "";
    if (!canonical || !Number.isFinite(Number(canonical)) || Number(canonical) <= 0) return null;
    if (typedCategory === "CURRENT_PRICE") normalized.currentPrice = canonical;
    if (typedCategory === "SUPPORT" || typedCategory === "RESISTANCE") {
      normalized.level = { kind: typedCategory === "SUPPORT" ? "support" : "resistance", price: canonical };
    }
  }
  if (typedCategory === "CHART_READING" && !correction && !note) return null;
  return normalized;
}

export function correctionPatch(feedback: AccuracyFeedback): AccuracyCorrectionPatch {
  const normalized = normalizeAccuracyCorrection(feedback);
  if (!normalized) return {};
  const patch: AccuracyCorrectionPatch = {};
  if (normalized.instrument) patch.instrument = normalized.instrument;
  if (normalized.timeframe) patch.timeframe = normalized.timeframe;
  if (normalized.currentPrice) patch.currentPrice = normalized.currentPrice;
  if (normalized.level) patch.level = normalized.level;
  return patch;
}
