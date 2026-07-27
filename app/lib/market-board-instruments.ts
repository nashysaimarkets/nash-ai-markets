/**
 * Canonical customer-terminal market set after cross-asset expansion.
 * Treasuries remain scalar-only; OIL/QQQ/NQ use verified equity/index quote+candle paths.
 */
export const MARKET_BOARD_SYMBOLS = ["ES", "VIX", "US2Y", "US10Y", "DXY", "OIL", "QQQ", "NQ"] as const;
export type MarketBoardSymbol = (typeof MARKET_BOARD_SYMBOLS)[number];

export const MARKET_BOARD_LABELS: Record<MarketBoardSymbol, string> = {
  ES: "ES futures",
  VIX: "VIX",
  US2Y: "US 2-year",
  US10Y: "US 10-year",
  DXY: "US Dollar Index",
  OIL: "Oil (USO)",
  QQQ: "QQQ",
  NQ: "Nasdaq",
};

/** Decision-critical instruments — snapshot still fails closed without these for plans. */
export const DECISION_REQUIRED_SYMBOLS = ["ES", "VIX", "US2Y", "US10Y", "DXY"] as const;

export function isMarketBoardSymbol(value: string | null | undefined): value is MarketBoardSymbol {
  return Boolean(value && (MARKET_BOARD_SYMBOLS as readonly string[]).includes(value));
}

export function isTreasuryScalar(symbol: string): boolean {
  return symbol === "US2Y" || symbol === "US10Y";
}
