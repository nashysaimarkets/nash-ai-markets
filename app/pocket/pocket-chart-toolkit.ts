import type { LevelEvidenceSource } from "./pocket-derived-evidence";

export type ToolkitDirection = "LONG" | "SHORT";

export type NumericChartLevel = {
  kind: "support" | "resistance" | "pivot";
  label: string;
  price: number;
  source?: LevelEvidenceSource;
};

export type RankedChartLevel = NumericChartLevel & {
  distance: number | null;
  distancePercent: number | null;
  contextMatch: boolean;
  verification: "HIGH" | "MEDIUM" | "LOW";
  reason: "USER_VERIFIED" | "MULTI_TIMEFRAME" | "SCALE_CALIBRATED" | "SINGLE_VIEW";
};

const levelTolerance = (price: number) => Math.max(Math.abs(price) * 0.0015, 0.01);
const corroborationTolerance = (price: number) => Math.max(Math.abs(price) * 0.0005, 0.01);

export function sanitizeChartLevels(levels: NumericChartLevel[], currentPrice: number | null) {
  const usable = levels.filter((level) => {
    if (!Number.isFinite(level.price) || level.price <= 0) return false;
    if (currentPrice !== null && Math.abs(level.price - currentPrice) / Math.max(Math.abs(currentPrice), 1) > 0.2) return false;
    if (level.kind === "support" && currentPrice !== null && level.price > currentPrice + levelTolerance(currentPrice)) return false;
    if (level.kind === "resistance" && currentPrice !== null && level.price < currentPrice - levelTolerance(currentPrice)) return false;
    return true;
  });
  return usable.reduce<NumericChartLevel[]>((clean, level) => {
    const duplicateIndex = clean.findIndex((existing) => existing.kind === level.kind && Math.abs(existing.price - level.price) <= levelTolerance(level.price));
    if (duplicateIndex < 0) return [...clean, level];
    const existing = clean[duplicateIndex];
    const preferIncoming = /USER VERIFIED/i.test(level.label) && !/USER VERIFIED/i.test(existing.label);
    return preferIncoming ? clean.map((item, index) => index === duplicateIndex ? level : item) : clean;
  }, []);
}

export function mergeCompatibleChartLevels(
  primaryLevels: NumericChartLevel[],
  contextLevels: NumericChartLevel[],
  primaryCurrentPrice: number | null,
  contextCurrentPrice: number | null,
  contextConfirmed = true,
) {
  const cleanPrimary = sanitizeChartLevels(primaryLevels, primaryCurrentPrice);
  if (!contextConfirmed || !contextLevels.length) return cleanPrimary;

  // A second screenshot may be a different instrument or contract. Never mix its
  // geometry into the decision map when the visible current prices disagree.
  if (primaryCurrentPrice !== null && contextCurrentPrice !== null) {
    const denominator = Math.max(Math.abs(primaryCurrentPrice), Math.abs(contextCurrentPrice), 1);
    if (Math.abs(primaryCurrentPrice - contextCurrentPrice) / denominator > 0.05) return cleanPrimary;
  }

  const reference = primaryCurrentPrice ?? contextCurrentPrice;
  const compatibleContext = sanitizeChartLevels(contextLevels, reference);

  return compatibleContext.reduce<NumericChartLevel[]>((merged, level) => {
    const duplicate = merged.some((existing) => {
      const tolerance = levelTolerance(level.price);
      return existing.kind === level.kind && Math.abs(existing.price - level.price) <= tolerance;
    });
    return duplicate ? merged : [...merged, level];
  }, [...cleanPrimary]);
}

/**
 * The minimum evidence required for a structural result that can be reused.
 * A pivot is context, not a substitute for either side of the current price.
 */
export function hasVerifiedTwoSidedStructure(levels: NumericChartLevel[], currentPrice: number | null) {
  if (currentPrice === null || !Number.isFinite(currentPrice) || currentPrice <= 0) return false;
  const clean = sanitizeChartLevels(levels, currentPrice);
  const supportBelow = clean.some((level) => level.kind === "support" && level.price < currentPrice);
  const resistanceAbove = clean.some((level) => level.kind === "resistance" && level.price > currentPrice);
  return supportBelow && resistanceAbove;
}

export function rankChartLevels(levels: NumericChartLevel[], currentPrice: number | null, contextLevels: NumericChartLevel[], scaleReadable: boolean): RankedChartLevel[] {
  return sanitizeChartLevels(levels, currentPrice).map((level): RankedChartLevel => {
    const priceNow = currentPrice;
    const distance = priceNow === null ? null : Math.abs(level.price - priceNow);
    const contextMatch = contextLevels.some((context) => {
      const tolerance = corroborationTolerance(level.price);
      return context.kind === level.kind && Math.abs(context.price - level.price) <= tolerance;
    });
    const userVerified = /USER VERIFIED/i.test(level.label);
    // AI agreement is useful corroboration, but only a trader-confirmed price
    // deserves the word HIGH. This prevents two vision passes from validating
    // the same shared misread.
    const verification = userVerified ? "HIGH" : scaleReadable && contextMatch ? "MEDIUM" : scaleReadable ? "MEDIUM" : "LOW";
    const reason = userVerified ? "USER_VERIFIED" : contextMatch ? "MULTI_TIMEFRAME" : scaleReadable ? "SCALE_CALIBRATED" : "SINGLE_VIEW";
    return {
      ...level,
      distance,
      distancePercent: distance === null || priceNow === null || priceNow === 0 ? null : distance / Math.abs(priceNow) * 100,
      contextMatch,
      verification,
      reason,
    };
  }).sort((a, b) => {
    if (a.contextMatch !== b.contextMatch) return a.contextMatch ? -1 : 1;
    return (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY);
  });
}

export function calculateRangePosition(currentPrice: number | null, levels: NumericChartLevel[]) {
  if (currentPrice === null) return null;
  const supports = levels.filter((level) => level.kind === "support" && level.price < currentPrice).sort((a, b) => b.price - a.price);
  const resistances = levels.filter((level) => level.kind === "resistance" && level.price > currentPrice).sort((a, b) => a.price - b.price);
  const support = supports[0]?.price;
  const resistance = resistances[0]?.price;
  if (support === undefined || resistance === undefined || resistance <= support) return null;
  const percent = Math.max(0, Math.min(100, (currentPrice - support) / (resistance - support) * 100));
  return { support, resistance, percent, label: percent < 33 ? "LOWER THIRD" : percent > 67 ? "UPPER THIRD" : "MID-RANGE" } as const;
}

export function calculateRTargets(entryText: string, stopText: string, direction: ToolkitDirection) {
  const entry = Number(entryText.replaceAll(",", "").trim());
  const stop = Number(stopText.replaceAll(",", "").trim());
  if (!Number.isFinite(entry) || !Number.isFinite(stop) || entry <= 0 || stop <= 0 || entry === stop) return null;
  if ((direction === "LONG" && stop >= entry) || (direction === "SHORT" && stop <= entry)) return null;
  const risk = Math.abs(entry - stop);
  const sign = direction === "LONG" ? 1 : -1;
  return { entry, stop, risk, targets: [1, 1.5, 2, 3].map((multiple) => ({ multiple, price: entry + risk * multiple * sign })) };
}
