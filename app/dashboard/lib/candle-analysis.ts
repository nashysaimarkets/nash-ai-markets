import type { OhlcvPoint } from "../../terminal/lib/visual-terminal.ts";

export type DashboardChartTimeframe = "5m" | "15m" | "1h";

function chronologicalCandles(candles: OhlcvPoint[]): OhlcvPoint[] {
  const unique = new Map<number, OhlcvPoint>();
  for (const candle of candles) unique.set(candle.time, candle);
  return [...unique.values()].sort((left, right) => left.time - right.time);
}

export function aggregateCandles(candles: OhlcvPoint[], timeframe: DashboardChartTimeframe): OhlcvPoint[] {
  const seconds = timeframe === "5m" ? 300 : timeframe === "15m" ? 900 : 3600;
  const ordered = chronologicalCandles(candles);
  if (seconds === 300) return ordered.map((candle) => ({ ...candle }));
  const groups = new Map<number, OhlcvPoint[]>();
  for (const candle of ordered) {
    const bucket = Math.floor(candle.time / seconds) * seconds;
    groups.set(bucket, [...(groups.get(bucket) ?? []), candle]);
  }
  return [...groups.entries()].sort(([left], [right]) => left - right).map(([time, values]) => ({
    time, open: values[0]!.open, high: Math.max(...values.map((value) => value.high)), low: Math.min(...values.map((value) => value.low)), close: values.at(-1)!.close, volume: values.reduce((sum, value) => sum + value.volume, 0),
  }));
}

export function exponentialMovingAverage(candles: OhlcvPoint[], period: number): Array<{ time: number; value: number }> {
  const ordered = chronologicalCandles(candles);
  if (!Number.isInteger(period) || period < 1 || ordered.length < period) return [];
  const multiplier = 2 / (period + 1);
  let value = ordered.slice(0, period).reduce((sum, candle) => sum + candle.close, 0) / period;
  const result = [{ time: ordered[period - 1]!.time, value }];
  for (const candle of ordered.slice(period)) { value = (candle.close - value) * multiplier + value; result.push({ time: candle.time, value }); }
  return result;
}

export function volumeWeightedAveragePrice(candles: OhlcvPoint[]): Array<{ time: number; value: number }> {
  let cumulativeVolume = 0; let cumulativeValue = 0;
  return chronologicalCandles(candles).flatMap((candle) => {
    if (candle.volume <= 0) return [];
    cumulativeVolume += candle.volume;
    cumulativeValue += ((candle.high + candle.low + candle.close) / 3) * candle.volume;
    return [{ time: candle.time, value: cumulativeValue / cumulativeVolume }];
  });
}

export function candleSessionStats(candles: OhlcvPoint[]) {
  const ordered = chronologicalCandles(candles);
  const latest = ordered.at(-1);
  if (!latest) return null;
  const sessionStart = latest.time - 24 * 60 * 60;
  const current = ordered.filter((candle) => candle.time >= sessionStart);
  const firstAvailableClose = current[0]!.close;
  const high = Math.max(...current.map((candle) => candle.high));
  const low = Math.min(...current.map((candle) => candle.low));
  const change = latest.close - firstAvailableClose;
  const percentageChange = firstAvailableClose === 0 ? 0 : (change / firstAvailableClose) * 100;
  const averageSample = current.slice(-14);
  const averageCandleRange = averageSample.reduce((sum, candle) => sum + candle.high - candle.low, 0) / averageSample.length;
  const rangePosition = high === low ? 50 : Math.max(0, Math.min(100, ((latest.close - low) / (high - low)) * 100));
  return { latest: latest.close, firstAvailableClose, high, low, change, percentageChange, averageCandleRange, rangePosition, visibleCandles: current };
}

export function candleReferenceLevels(candles: OhlcvPoint[]) {
  const stats = candleSessionStats(candles);
  if (!stats) return [];
  return [
    { label: "24h high", value: stats.high, source: "High across verified candles in the rolling 24-hour window", relation: stats.latest >= stats.high ? "at" : "below" },
    { label: "24h low", value: stats.low, source: "Low across verified candles in the rolling 24-hour window", relation: stats.latest <= stats.low ? "at" : "above" },
    { label: "First available close", value: stats.firstAvailableClose, source: "Close of the first verified candle in the rolling 24-hour window", relation: stats.latest >= stats.firstAvailableClose ? "above" : "below" },
  ];
}
