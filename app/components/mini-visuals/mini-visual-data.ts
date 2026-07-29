import type { OhlcvPoint } from "../../terminal/lib/visual-terminal.ts";
import { candleSessionStats, exponentialMovingAverage } from "../../dashboard/lib/candle-analysis.ts";

/** Minimum verified closes required before drawing a sparkline. */
export const MIN_SPARKLINE_POINTS = 8;

export function downsampleSeries(values: number[], maxPoints: number): number[] {
  if (values.length <= maxPoints) return values;
  if (maxPoints < 2) return values.slice(-1);
  const result: number[] = [];
  const last = values.length - 1;
  for (let index = 0; index < maxPoints; index += 1) {
    const sourceIndex = Math.round((index / (maxPoints - 1)) * last);
    result.push(values[sourceIndex]!);
  }
  return result;
}

/** Verified close series for sparklines — never invents points. Returns null when history is too thin. */
export function sparklineFromCandles(candles: OhlcvPoint[], maxPoints = 36): number[] | null {
  const stats = candleSessionStats(candles);
  if (!stats) return null;
  const closes = stats.visibleCandles.map((candle) => candle.close).filter((value) => Number.isFinite(value));
  if (closes.length < MIN_SPARKLINE_POINTS) return null;
  return downsampleSeries(closes, maxPoints);
}

export function parsePriceLevel(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.replaceAll(",", "").replaceAll("%", "").trim();
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export type RangeLaneMarkers = {
  low: number;
  high: number;
  current: number;
  firstClose: number | null;
  ema20: number | null;
  ema50: number | null;
};

export function rangeLaneFromCandles(candles: OhlcvPoint[]): RangeLaneMarkers | null {
  const stats = candleSessionStats(candles);
  if (!stats || stats.high === stats.low) return null;
  const ema20 = exponentialMovingAverage(candles, 20).at(-1)?.value ?? null;
  const ema50 = exponentialMovingAverage(candles, 50).at(-1)?.value ?? null;
  return {
    low: stats.low,
    high: stats.high,
    current: stats.latest,
    firstClose: stats.firstAvailableClose,
    ema20: ema20 != null && Number.isFinite(ema20) ? ema20 : null,
    ema50: ema50 != null && Number.isFinite(ema50) ? ema50 : null,
  };
}

export type ScenarioLaneMarkers = {
  lower: number;
  upper: number;
  current: number;
  confirmation: number | null;
  invalidation: number | null;
};

export function scenarioLaneMarkers(input: {
  low: number;
  high: number;
  current: number;
  confirmation: number | null;
  invalidation: number | null;
}): ScenarioLaneMarkers | null {
  if (!(input.high > input.low) || !Number.isFinite(input.current)) return null;
  return {
    lower: input.low,
    upper: input.high,
    current: input.current,
    confirmation: input.confirmation,
    invalidation: input.invalidation,
  };
}

export function positionPercent(value: number, low: number, high: number): number {
  if (!(high > low)) return 50;
  return Math.max(0, Math.min(100, ((value - low) / (high - low)) * 100));
}
