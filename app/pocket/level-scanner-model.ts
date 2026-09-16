import type { Analysis, Level } from "./analysis-types";
import { numericLevelPrice } from "./level-verification";
import { hasVerifiedTwoSidedStructure, sanitizeChartLevels, type NumericChartLevel } from "./pocket-chart-toolkit";

export type ScannerLevel = Level & { id: string; value: number };
export type ScannerModel = ReturnType<typeof buildLevelScanner>;

/** Display geometry only. The existing evidence filter remains authoritative. */
export function buildLevelScanner(analysis: Pick<Analysis, "levels" | "currentPrice">) {
  const parsed = numericLevelPrice(analysis.currentPrice ?? "");
  const current = parsed !== null && parsed > 0 ? parsed : null;
  const candidates = analysis.levels.flatMap((level) => {
    const value = numericLevelPrice(level.price);
    return value !== null && ["support", "resistance", "pivot"].includes(level.kind)
      ? [{ ...level, value }] : [];
  });
  const strict = sanitizeChartLevels(candidates.map((level) => ({
    kind: level.kind as NumericChartLevel["kind"], price: level.value, label: level.label, source: level.source,
  })), current);
  // Map back to the exact retained evidence, including source and original precision.
  const levels: ScannerLevel[] = strict.flatMap((level) => {
    const original = candidates.find((candidate) => candidate.kind === level.kind && candidate.value === level.price
      && candidate.label === level.label && candidate.source === level.source);
    return original ? [{ ...original, id: `${original.kind}:${original.value}:${original.source ?? "PRIMARY"}` }] : [];
  }).sort((a, b) => b.value - a.value);
  const support = current === null ? null : levels.find((level) => level.kind === "support" && level.value < current) ?? null;
  const resistance = current === null ? null : levels.filter((level) => level.kind === "resistance" && level.value > current).at(-1) ?? null;
  const decimals = Math.min(8, Math.max(2, ...[analysis.currentPrice ?? "", ...levels.map((level) => level.price)]
    .map((price) => price.replaceAll(",", "").match(/\.(\d+)/)?.[1].length ?? 0)));
  return { current, currentLabel: analysis.currentPrice ?? "", levels, support, resistance, decimals,
    twoSided: hasVerifiedTwoSidedStructure(strict, current), hasStructure: Boolean(support || resistance) };
}

export function scannerDistance(distance: number, decimals: number) {
  return distance.toLocaleString("en-GB", { maximumFractionDigits: decimals });
}

export function scannerPercent(distance: number, current: number) {
  const percentage = Math.abs(distance / current * 100);
  return percentage > 0 && percentage < .01 ? "<0.01%" : `${percentage.toFixed(2)}%`;
}

/** Label slots never change the measured coordinates: SVG leaders join the two. */
export function scannerView(model: ScannerModel, all: boolean) {
  if (model.current === null || !model.hasStructure) return null;
  const levels = all ? model.levels : [model.resistance, model.support].filter((level): level is ScannerLevel => Boolean(level));
  const entries = [
    ...levels.map((level) => ({ id: level.id, value: level.value, price: level.price, kind: level.kind, level })),
    { id: "current", value: model.current, price: model.currentLabel, kind: "current" as const, level: null },
  ].sort((a, b) => b.value - a.value);
  const low = Math.min(...entries.map((entry) => entry.value));
  const high = Math.max(...entries.map((entry) => entry.value));
  const padding = Math.max((high - low) * .22, Math.abs(model.current) * .00001, Number.EPSILON * model.current * 10);
  const min = low - padding;
  const max = high + padding;
  const position = (price: number) => 8 + (max - price) / (max - min) * 84;
  return { min, max, height: Math.max(300, entries.length * 86 + 24),
    entries: entries.map((entry, index) => ({ ...entry, y: position(entry.value), labelY: (index + .5) / entries.length * 100 })),
    ticks: Array.from({ length: 5 }, (_, index) => ({ value: max - (max - min) * index / 4, y: 8 + 84 * index / 4 })),
  };
}
