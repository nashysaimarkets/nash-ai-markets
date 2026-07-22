import type { CandleTimeframe, VerifiedCandleSeries } from "./financial-modeling-prep-candles.ts";

/** Instruments that can request verified OHLCV candles (never invents series). */
export const CANDLE_INSTRUMENTS = ["ES", "VIX", "DXY", "OIL", "QQQ", "NQ"] as const;
export type CandleInstrument = (typeof CANDLE_INSTRUMENTS)[number];

export function isCandleInstrument(value: string | null | undefined): value is CandleInstrument {
  return Boolean(value && (CANDLE_INSTRUMENTS as readonly string[]).includes(value));
}

type InstrumentMeta = {
  envSymbol: string | undefined;
  fallbackSymbol: string;
  contract: string;
  instrumentName: string;
  exchange: string;
  instrumentDetail: string;
};

export function resolveCandleInstrumentMeta(instrument: CandleInstrument): InstrumentMeta {
  switch (instrument) {
    case "VIX":
      return {
        envSymbol: process.env.FMP_VIX_SYMBOL?.trim(),
        fallbackSymbol: "^VIX",
        contract: "CBOE Volatility Index",
        instrumentName: "VIX",
        exchange: "Verified delayed index series",
        instrumentDetail: "VIX reference series from the configured market-data provider. Delayed quotes only — never treated as live.",
      };
    case "DXY":
      return {
        envSymbol: process.env.FMP_US_DOLLAR_INDEX_SYMBOL?.trim(),
        fallbackSymbol: "DX-Y.NYB",
        contract: "US Dollar Index",
        instrumentName: "US Dollar Index",
        exchange: "Verified delayed index series",
        instrumentDetail: "US Dollar Index reference series from the configured market-data provider. Delayed quotes only — never treated as live.",
      };
    case "OIL":
      return {
        envSymbol: process.env.FMP_OIL_SYMBOL?.trim(),
        fallbackSymbol: "USO",
        contract: "United States Oil Fund (USO)",
        instrumentName: "Oil (USO)",
        exchange: "Verified delayed ETF series",
        instrumentDetail: "USO equity ETF proxy for crude oil exposure from the configured market-data provider. Delayed quotes only — never treated as live futures prints.",
      };
    case "QQQ":
      return {
        envSymbol: process.env.FMP_QQQ_SYMBOL?.trim(),
        fallbackSymbol: "QQQ",
        contract: "Invesco QQQ Trust",
        instrumentName: "QQQ",
        exchange: "Verified delayed ETF series",
        instrumentDetail: "QQQ equity ETF reference series from the configured market-data provider. Delayed quotes only — never treated as live.",
      };
    case "NQ":
      return {
        envSymbol: process.env.FMP_NASDAQ_SYMBOL?.trim(),
        fallbackSymbol: "^IXIC",
        contract: "NASDAQ Composite",
        instrumentName: "Nasdaq Composite",
        exchange: "Verified delayed index series",
        instrumentDetail: "Nasdaq Composite (^IXIC) reference series from the configured market-data provider. Delayed quotes only — never treated as live Nasdaq futures.",
      };
    case "ES":
    default:
      return {
        envSymbol: process.env.FMP_SP500_FUTURES_SYMBOL?.trim(),
        fallbackSymbol: "ESUSD",
        contract: "S&P 500 futures reference series",
        instrumentName: "S&P 500 futures reference series",
        exchange: "Verified delayed provider series",
        instrumentDetail: "ESUSD reference series from the configured market-data provider. Delayed quotes only — never treated as live.",
      };
  }
}

export function providerSymbolForInstrument(instrument: CandleInstrument): string {
  const meta = resolveCandleInstrumentMeta(instrument);
  return meta.envSymbol || meta.fallbackSymbol;
}

export function applyInstrumentIdentity(
  series: VerifiedCandleSeries,
  instrument: CandleInstrument,
): VerifiedCandleSeries {
  const meta = resolveCandleInstrumentMeta(instrument);
  const keepDetail = /layout fixture|not live market data|Four-hour bars/i.test(series.instrumentDetail);
  return {
    ...series,
    symbol: series.symbol || providerSymbolForInstrument(instrument),
    contract: meta.contract,
    instrumentName: meta.instrumentName,
    exchange: meta.exchange,
    instrumentDetail: keepDetail ? series.instrumentDetail : meta.instrumentDetail,
  };
}

/** Human label for UI chips. */
export function candleInstrumentLabel(instrument: CandleInstrument): string {
  switch (instrument) {
    case "VIX":
      return "VIX";
    case "DXY":
      return "US Dollar Index";
    case "OIL":
      return "Oil (USO)";
    case "QQQ":
      return "QQQ";
    case "NQ":
      return "Nasdaq";
    case "ES":
    default:
      return "ES futures";
  }
}

export function instrumentsSupportingCandles(): CandleInstrument[] {
  return [...CANDLE_INSTRUMENTS];
}

/** Treasuries and other scalar feeds intentionally have no OHLC path. */
export function candleSupportNote(symbol: string): string | null {
  if (symbol === "US2Y" || symbol === "US10Y") {
    return "Treasury yields arrive as verified scalars. OHLC candles are not available from the configured provider for this feed.";
  }
  if ((CANDLE_INSTRUMENTS as readonly string[]).includes(symbol)) return null;
  return "Candlestick history is not configured for this instrument.";
}
