export type ToolkitDirection = "LONG" | "SHORT";

export type NumericChartLevel = {
  kind: "support" | "resistance" | "pivot";
  label: string;
  price: number;
};

export type RankedChartLevel = NumericChartLevel & {
  distance: number | null;
  distancePercent: number | null;
  contextMatch: boolean;
  verification: "HIGH" | "MEDIUM";
};

export function rankChartLevels(levels: NumericChartLevel[], currentPrice: number | null, contextLevels: NumericChartLevel[], scaleReadable: boolean): RankedChartLevel[] {
  return levels.map((level): RankedChartLevel => {
    const priceNow = currentPrice;
    const distance = priceNow === null ? null : Math.abs(level.price - priceNow);
    const contextMatch = contextLevels.some((context) => {
      const tolerance = Math.max(Math.abs(level.price) * 0.0015, 0.01);
      return context.kind === level.kind && Math.abs(context.price - level.price) <= tolerance;
    });
    return {
      ...level,
      distance,
      distancePercent: distance === null || priceNow === null || priceNow === 0 ? null : distance / Math.abs(priceNow) * 100,
      contextMatch,
      verification: scaleReadable && contextMatch ? "HIGH" : "MEDIUM",
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
