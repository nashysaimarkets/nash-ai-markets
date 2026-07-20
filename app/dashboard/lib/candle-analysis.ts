import type { OhlcvPoint } from "../../terminal/lib/visual-terminal.ts";

export type DashboardChartTimeframe = "5m" | "15m" | "1h";

export function aggregateCandles(candles: OhlcvPoint[], timeframe: DashboardChartTimeframe): OhlcvPoint[] {
  const seconds = timeframe === "5m" ? 300 : timeframe === "15m" ? 900 : 3600;
  if (seconds === 300) return candles.map((candle) => ({ ...candle }));
  const groups = new Map<number, OhlcvPoint[]>();
  for (const candle of candles) {
    const bucket = Math.floor(candle.time / seconds) * seconds;
    groups.set(bucket, [...(groups.get(bucket) ?? []), candle]);
  }
  return [...groups.entries()].sort(([left], [right]) => left - right).map(([time, values]) => ({
    time, open: values[0]!.open, high: Math.max(...values.map((value) => value.high)), low: Math.min(...values.map((value) => value.low)), close: values.at(-1)!.close, volume: values.reduce((sum, value) => sum + value.volume, 0),
  }));
}

export function exponentialMovingAverage(candles: OhlcvPoint[], period: number): Array<{ time: number; value: number }> {
  if (!Number.isInteger(period) || period < 1 || candles.length < period) return [];
  const multiplier = 2 / (period + 1);
  let value = candles.slice(0, period).reduce((sum, candle) => sum + candle.close, 0) / period;
  const result = [{ time: candles[period - 1]!.time, value }];
  for (const candle of candles.slice(period)) { value = (candle.close - value) * multiplier + value; result.push({ time: candle.time, value }); }
  return result;
}

export function volumeWeightedAveragePrice(candles: OhlcvPoint[]): Array<{ time: number; value: number }> {
  let cumulativeVolume = 0; let cumulativeValue = 0;
  return candles.flatMap((candle) => {
    if (candle.volume <= 0) return [];
    cumulativeVolume += candle.volume;
    cumulativeValue += ((candle.high + candle.low + candle.close) / 3) * candle.volume;
    return [{ time: candle.time, value: cumulativeValue / cumulativeVolume }];
  });
}

export function candleSessionStats(candles: OhlcvPoint[]) {
  const latest = candles.at(-1);
  if (!latest) return null;
  const sessionStart = latest.time - 24 * 60 * 60;
  const current = candles.filter((candle) => candle.time >= sessionStart);
  const prior = candles.filter((candle) => candle.time < sessionStart);
  const previousClose = prior.at(-1)?.close ?? null;
  const open = current[0]!.open;
  const high = Math.max(...current.map((candle) => candle.high));
  const low = Math.min(...current.map((candle) => candle.low));
  const change = latest.close - (previousClose ?? open);
  const percentageChange = (change / (previousClose ?? open)) * 100;
  return { latest: latest.close, open, high, low, previousClose, change, percentageChange, visibleCandles: current };
}

export function candleReferenceLevels(candles: OhlcvPoint[]) {
  const stats = candleSessionStats(candles);
  if (!stats) return [];
  return [
    { label: "Session high", value: stats.high, source: "Verified 24-hour candle range", relation: stats.latest >= stats.high ? "at" : "below" },
    { label: "Session low", value: stats.low, source: "Verified 24-hour candle range", relation: stats.latest <= stats.low ? "at" : "above" },
    ...(stats.previousClose === null ? [] : [{ label: "Previous close", value: stats.previousClose, source: "Last verified candle before current range", relation: stats.latest >= stats.previousClose ? "above" : "below" }]),
  ];
}
