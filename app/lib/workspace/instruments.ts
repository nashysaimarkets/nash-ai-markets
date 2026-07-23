/**
 * Customer gallery catalog for Project BULLSEYE personal desk.
 * Coverage maps to existing board/candle feeds where verified; otherwise
 * instruments stay selectable as favourites but render truthful unavailable states.
 */

import { CANDLE_INSTRUMENTS, type CandleInstrument } from "../providers/candle-instruments.ts";
import { MARKET_BOARD_SYMBOLS, type MarketBoardSymbol } from "../market-board-instruments.ts";

export type WorkspaceCoverage =
  | "quotes_and_candles"
  | "quotes_only"
  | "awaiting_provider";

export type WorkspaceInstrumentId =
  | "ES"
  | "NQ"
  | "YM"
  | "RTY"
  | "GC"
  | "SI"
  | "CL"
  | "BTC"
  | "EURUSD"
  | "GBPUSD"
  | "FTSE"
  | "DAX"
  | "NIKKEI"
  | "VIX"
  | "DXY"
  | "QQQ"
  | "US10Y"
  | "US2Y"
  | "OIL";

export type WorkspaceInstrument = {
  id: WorkspaceInstrumentId;
  name: string;
  ticker: string;
  category: "index_futures" | "metals" | "energy" | "crypto" | "fx" | "international" | "macro";
  coverage: WorkspaceCoverage;
  /** Maps to live board quote symbol when available. */
  boardSymbol: MarketBoardSymbol | null;
  /** Maps to verified candle instrument when available. */
  candleInstrument: CandleInstrument | null;
  unavailableReason: string | null;
};

export const WORKSPACE_INSTRUMENTS: readonly WorkspaceInstrument[] = [
  {
    id: "ES",
    name: "S&P 500",
    ticker: "ES",
    category: "index_futures",
    coverage: "quotes_and_candles",
    boardSymbol: "ES",
    candleInstrument: "ES",
    unavailableReason: null,
  },
  {
    id: "NQ",
    name: "Nasdaq",
    ticker: "NQ",
    category: "index_futures",
    coverage: "quotes_and_candles",
    boardSymbol: "NQ",
    candleInstrument: "NQ",
    unavailableReason: null,
  },
  {
    id: "YM",
    name: "Dow",
    ticker: "YM",
    category: "index_futures",
    coverage: "awaiting_provider",
    boardSymbol: null,
    candleInstrument: null,
    unavailableReason: "Awaiting verified provider coverage",
  },
  {
    id: "RTY",
    name: "Russell 2000",
    ticker: "RTY",
    category: "index_futures",
    coverage: "awaiting_provider",
    boardSymbol: null,
    candleInstrument: null,
    unavailableReason: "Awaiting verified provider coverage",
  },
  {
    id: "GC",
    name: "Gold",
    ticker: "GC",
    category: "metals",
    coverage: "awaiting_provider",
    boardSymbol: null,
    candleInstrument: null,
    unavailableReason: "Awaiting verified provider coverage",
  },
  {
    id: "SI",
    name: "Silver",
    ticker: "SI",
    category: "metals",
    coverage: "awaiting_provider",
    boardSymbol: null,
    candleInstrument: null,
    unavailableReason: "Awaiting verified provider coverage",
  },
  {
    id: "CL",
    name: "Crude Oil",
    ticker: "CL",
    category: "energy",
    /** OIL board uses USO equity proxy — label crude honestly as proxy-backed. */
    coverage: "quotes_and_candles",
    boardSymbol: "OIL",
    candleInstrument: "OIL",
    unavailableReason: null,
  },
  {
    id: "BTC",
    name: "Bitcoin",
    ticker: "BTC",
    category: "crypto",
    coverage: "awaiting_provider",
    boardSymbol: null,
    candleInstrument: null,
    unavailableReason: "Awaiting verified provider coverage",
  },
  {
    id: "EURUSD",
    name: "EUR/USD",
    ticker: "EURUSD",
    category: "fx",
    coverage: "awaiting_provider",
    boardSymbol: null,
    candleInstrument: null,
    unavailableReason: "Awaiting verified provider coverage",
  },
  {
    id: "GBPUSD",
    name: "GBP/USD",
    ticker: "GBPUSD",
    category: "fx",
    coverage: "awaiting_provider",
    boardSymbol: null,
    candleInstrument: null,
    unavailableReason: "Awaiting verified provider coverage",
  },
  {
    id: "FTSE",
    name: "FTSE 100",
    ticker: "FTSE",
    category: "international",
    coverage: "awaiting_provider",
    boardSymbol: null,
    candleInstrument: null,
    unavailableReason: "Awaiting verified provider coverage",
  },
  {
    id: "DAX",
    name: "DAX",
    ticker: "DAX",
    category: "international",
    coverage: "awaiting_provider",
    boardSymbol: null,
    candleInstrument: null,
    unavailableReason: "Awaiting verified provider coverage",
  },
  {
    id: "NIKKEI",
    name: "Nikkei",
    ticker: "NIKKEI",
    category: "international",
    coverage: "awaiting_provider",
    boardSymbol: null,
    candleInstrument: null,
    unavailableReason: "Awaiting verified provider coverage",
  },
  {
    id: "VIX",
    name: "VIX",
    ticker: "VIX",
    category: "macro",
    coverage: "quotes_and_candles",
    boardSymbol: "VIX",
    candleInstrument: "VIX",
    unavailableReason: null,
  },
  {
    id: "DXY",
    name: "US Dollar Index",
    ticker: "DXY",
    category: "macro",
    coverage: "quotes_and_candles",
    boardSymbol: "DXY",
    candleInstrument: "DXY",
    unavailableReason: null,
  },
  {
    id: "QQQ",
    name: "Nasdaq-100 ETF",
    ticker: "QQQ",
    category: "index_futures",
    coverage: "quotes_and_candles",
    boardSymbol: "QQQ",
    candleInstrument: "QQQ",
    unavailableReason: null,
  },
  {
    id: "US10Y",
    name: "US 10-year",
    ticker: "US10Y",
    category: "macro",
    coverage: "quotes_only",
    boardSymbol: "US10Y",
    candleInstrument: null,
    unavailableReason: "Historical chart not yet supported",
  },
  {
    id: "US2Y",
    name: "US 2-year",
    ticker: "US2Y",
    category: "macro",
    coverage: "quotes_only",
    boardSymbol: "US2Y",
    candleInstrument: null,
    unavailableReason: "Historical chart not yet supported",
  },
  {
    id: "OIL",
    name: "Oil (USO)",
    ticker: "USO",
    category: "energy",
    coverage: "quotes_and_candles",
    boardSymbol: "OIL",
    candleInstrument: "OIL",
    unavailableReason: null,
  },
] as const;

const BY_ID = new Map(WORKSPACE_INSTRUMENTS.map((item) => [item.id, item]));

export function isWorkspaceInstrumentId(value: string | null | undefined): value is WorkspaceInstrumentId {
  return Boolean(value && BY_ID.has(value as WorkspaceInstrumentId));
}

export function getWorkspaceInstrument(id: string): WorkspaceInstrument | null {
  return BY_ID.get(id as WorkspaceInstrumentId) ?? null;
}

/** Gallery-facing catalogue (deduped display set for selection UI). */
export const GALLERY_INSTRUMENT_IDS: readonly WorkspaceInstrumentId[] = [
  "ES",
  "NQ",
  "YM",
  "RTY",
  "GC",
  "SI",
  "CL",
  "BTC",
  "EURUSD",
  "GBPUSD",
  "FTSE",
  "DAX",
  "NIKKEI",
];

export function galleryInstruments(): WorkspaceInstrument[] {
  return GALLERY_INSTRUMENT_IDS.map((id) => BY_ID.get(id)!);
}

export function coverageLabel(instrument: WorkspaceInstrument): string {
  if (instrument.coverage === "awaiting_provider") {
    return instrument.unavailableReason ?? "Awaiting verified provider coverage";
  }
  if (instrument.coverage === "quotes_only") {
    return instrument.unavailableReason ?? "Historical chart not yet supported";
  }
  return "Verified delayed coverage";
}

export function defaultFavouriteIds(): WorkspaceInstrumentId[] {
  return ["ES", "NQ", "CL"];
}

export function resolveCandleForWorkspace(id: WorkspaceInstrumentId): CandleInstrument | null {
  const instrument = BY_ID.get(id);
  if (!instrument?.candleInstrument) return null;
  if (!(CANDLE_INSTRUMENTS as readonly string[]).includes(instrument.candleInstrument)) return null;
  return instrument.candleInstrument;
}

export function resolveBoardForWorkspace(id: WorkspaceInstrumentId): MarketBoardSymbol | null {
  const instrument = BY_ID.get(id);
  if (!instrument?.boardSymbol) return null;
  if (!(MARKET_BOARD_SYMBOLS as readonly string[]).includes(instrument.boardSymbol)) return null;
  return instrument.boardSymbol;
}
