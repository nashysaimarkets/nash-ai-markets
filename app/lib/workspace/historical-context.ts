/**
 * Historical context from verified candle history.
 * Labelled as context — never predictions or guarantees of repeats.
 */

import type { OhlcvPoint } from "../../terminal/lib/visual-terminal.ts";
import { getWorkspaceInstrument, type WorkspaceInstrumentId } from "./instruments.ts";

export type HistoricalContextItem = {
  title: string;
  body: string;
};

export type HistoricalContextResult = {
  available: boolean;
  unavailableReason: string | null;
  items: HistoricalContextItem[];
  disclaimer: string;
};

export function buildHistoricalContext(input: {
  instrumentId: WorkspaceInstrumentId;
  candles: OhlcvPoint[] | null | undefined;
  coverage: "quotes_and_candles" | "quotes_only" | "awaiting_provider";
}): HistoricalContextResult {
  const instrument = getWorkspaceInstrument(input.instrumentId);
  const disclaimer = "Historical context only. Past reactions do not guarantee future repeats.";

  if (input.coverage === "awaiting_provider") {
    return {
      available: false,
      unavailableReason: "Awaiting verified provider coverage — no historical narrative is shown.",
      items: [],
      disclaimer,
    };
  }

  if (input.coverage === "quotes_only") {
    return {
      available: false,
      unavailableReason: "Historical chart not yet supported for this feed.",
      items: [],
      disclaimer,
    };
  }

  const candles = input.candles ?? [];
  if (candles.length < 8) {
    return {
      available: false,
      unavailableReason: "Not enough verified candles to describe historical context.",
      items: [],
      disclaimer,
    };
  }

  const highs = candles.map((candle) => candle.high);
  const lows = candles.map((candle) => candle.low);
  const closes = candles.map((candle) => candle.close);
  const majorHigh = Math.max(...highs);
  const majorLow = Math.min(...lows);
  const latest = closes.at(-1)!;
  const first = closes[0]!;
  const range = majorHigh - majorLow;
  const movePct = first !== 0 ? ((latest - first) / first) * 100 : null;

  const returns: number[] = [];
  for (let index = 1; index < closes.length; index += 1) {
    const prev = closes[index - 1]!;
    const curr = closes[index]!;
    if (prev !== 0) returns.push((curr - prev) / prev);
  }
  const mean = returns.length ? returns.reduce((sum, value) => sum + value, 0) / returns.length : 0;
  const variance = returns.length
    ? returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / returns.length
    : 0;
  const histVol = Math.sqrt(variance) * 100;

  let gapCount = 0;
  for (let index = 1; index < candles.length; index += 1) {
    const prior = candles[index - 1]!;
    const candle = candles[index]!;
    const gap = Math.abs(candle.open - prior.close);
    const threshold = Math.abs(prior.close) * 0.002;
    if (gap > threshold) gapCount += 1;
  }

  const items: HistoricalContextItem[] = [
    {
      title: "Major high / low in window",
      body: `${instrument?.name ?? input.instrumentId} traded between ${majorLow.toLocaleString("en-GB", { maximumFractionDigits: 2 })} and ${majorHigh.toLocaleString("en-GB", { maximumFractionDigits: 2 })} across the verified candle window.`,
    },
    {
      title: "Window trend change",
      body: movePct === null
        ? "Trend change across the window could not be computed from verified closes."
        : `Net change across the verified window is ${movePct >= 0 ? "+" : ""}${movePct.toFixed(2)}%. This describes the sample only.`,
    },
    {
      title: "Historical volatility (sample)",
      body: `Close-to-close realised volatility proxy over this window: ${histVol.toFixed(2)}% per bar (descriptive, not annualised or predictive).`,
    },
    {
      title: "Gaps / structure notes",
      body: gapCount > 0
        ? `${gapCount} open-vs-prior-close gap${gapCount === 1 ? "" : "s"} exceeded a 0.2% threshold in this window. Gaps are structure context, not signals.`
        : "No material open-vs-prior-close gaps exceeded a 0.2% threshold in this verified window.",
    },
  ];

  if (range > 0) {
    const position = (latest - majorLow) / range;
    items.push({
      title: "Position in range",
      body: `Latest verified close sits near ${(position * 100).toFixed(0)}% of the window high-low range. Comparable conditions can look similar without repeating.`,
    });
  }

  return { available: true, unavailableReason: null, items, disclaimer };
}
