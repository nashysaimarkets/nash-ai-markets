import {
  MARKET_BOARD_LABELS,
  MARKET_BOARD_SYMBOLS,
  isTreasuryScalar,
  type MarketBoardSymbol,
} from "./market-board-instruments.ts";
import { candleSessionStats, exponentialMovingAverage } from "../dashboard/lib/candle-analysis.ts";
import type { OhlcvPoint } from "../terminal/lib/visual-terminal.ts";
import { parsePriceLevel } from "../components/mini-visuals/mini-visual-data.ts";
import type { MarketSnapshot } from "./market-data.ts";
import { isCandleInstrument, type CandleInstrument } from "./providers/candle-instruments.ts";

export type StructureLevelKind = "support" | "resistance" | "midpoint" | "prior-close" | "ema20";

export type StructureLevelReading = {
  kind: StructureLevelKind;
  label: string;
  value: number;
  display: string;
  source: string;
};

export type InstrumentStructureLevels = {
  symbol: MarketBoardSymbol;
  label: string;
  status: "ready" | "insufficient";
  support: StructureLevelReading | null;
  resistance: StructureLevelReading | null;
  references: StructureLevelReading[];
  summary: string;
  scalarOnly: boolean;
};

export type MarketStructureLevels = {
  schemaVersion: "1.0";
  instruments: InstrumentStructureLevels[];
  disclosure: string;
};

const DISCLOSURE =
  "Interpretive educational desk levels derived only from verified candle highs/lows, session range, prior close, and EMA when available. Not broker orders, not exchange-published S/R, and never invented.";

function formatLevel(value: number, symbol: MarketBoardSymbol): string {
  if (symbol === "VIX" || isTreasuryScalar(symbol)) {
    return value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildFromCandles(
  symbol: MarketBoardSymbol,
  candles: OhlcvPoint[],
): InstrumentStructureLevels {
  const label = MARKET_BOARD_LABELS[symbol];
  const stats = candleSessionStats(candles);
  if (!stats || !(stats.high > stats.low)) {
    return {
      symbol,
      label,
      status: "insufficient",
      support: null,
      resistance: null,
      references: [],
      summary: `${label} has no verified rolling range suitable for support/resistance context.`,
      scalarOnly: false,
    };
  }

  const resistance: StructureLevelReading = {
    kind: "resistance",
    label: "Resistance (24h high)",
    value: stats.high,
    display: formatLevel(stats.high, symbol),
    source: "Highest verified high in the rolling 24-hour candle window",
  };
  const support: StructureLevelReading = {
    kind: "support",
    label: "Support (24h low)",
    value: stats.low,
    display: formatLevel(stats.low, symbol),
    source: "Lowest verified low in the rolling 24-hour candle window",
  };
  const references: StructureLevelReading[] = [
    {
      kind: "midpoint",
      label: "Range midpoint",
      value: (stats.high + stats.low) / 2,
      display: formatLevel((stats.high + stats.low) / 2, symbol),
      source: "Midpoint of the verified 24-hour high/low range",
    },
    {
      kind: "prior-close",
      label: "Window open close",
      value: stats.firstAvailableClose,
      display: formatLevel(stats.firstAvailableClose, symbol),
      source: "Close of the first verified candle in the rolling 24-hour window",
    },
  ];

  const ema = exponentialMovingAverage(candles, 20);
  const emaLatest = ema.at(-1)?.value;
  if (emaLatest != null && Number.isFinite(emaLatest)) {
    references.push({
      kind: "ema20",
      label: "EMA 20",
      value: emaLatest,
      display: formatLevel(emaLatest, symbol),
      source: "Rolling EMA 20 from verified closes when enough bars exist",
    });
  }

  return {
    symbol,
    label,
    status: "ready",
    support,
    resistance,
    references,
    summary: `${label} desk levels use the verified 24-hour candle range. Current close ${formatLevel(stats.latest, symbol)} sits ${stats.rangePosition >= 50 ? "in the upper half" : "in the lower half"} of that range.`,
    scalarOnly: false,
  };
}

function insufficient(
  symbol: MarketBoardSymbol,
  summary: string,
  scalarOnly = false,
): InstrumentStructureLevels {
  return {
    symbol,
    label: MARKET_BOARD_LABELS[symbol],
    status: "insufficient",
    support: null,
    resistance: null,
    references: [],
    summary,
    scalarOnly,
  };
}

/**
 * Per-instrument support/resistance context from verified OHLCV only.
 * Treasuries and missing candle feeds fail closed — never invent levels from a lone quote.
 */
export function createMarketStructureLevels(input: {
  snapshot: MarketSnapshot;
  candlesBySymbol?: Partial<Record<MarketBoardSymbol, OhlcvPoint[] | null | undefined>>;
}): MarketStructureLevels {
  const { snapshot, candlesBySymbol = {} } = input;

  const instruments = MARKET_BOARD_SYMBOLS.map((symbol) => {
    if (isTreasuryScalar(symbol)) {
      const quote = snapshot.quotes.find((item) => item.symbol === symbol);
      const reading = quote ? parsePriceLevel(quote.value) : null;
      return insufficient(
        symbol,
        reading != null
          ? `${MARKET_BOARD_LABELS[symbol]} is a verified scalar yield (${quote!.value}). OHLC support/resistance is unavailable for this feed.`
          : `${MARKET_BOARD_LABELS[symbol]} has no verified OHLC path, so support/resistance stays withheld.`,
        true,
      );
    }

    const candles = candlesBySymbol[symbol];
    if (candles?.length) {
      return buildFromCandles(symbol, candles);
    }

    if (isCandleInstrument(symbol as CandleInstrument)) {
      return insufficient(
        symbol,
        `${MARKET_BOARD_LABELS[symbol]} has no verified OHLCV series in this update, so support/resistance is withheld.`,
      );
    }

    return insufficient(
      symbol,
      `${MARKET_BOARD_LABELS[symbol]} is not configured for candlestick-derived levels.`,
    );
  });

  return {
    schemaVersion: "1.0",
    instruments,
    disclosure: DISCLOSURE,
  };
}
