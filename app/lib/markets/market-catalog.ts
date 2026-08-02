/**
 * Curated Terminal Markets browser taxonomy.
 * Desk catalog of widely followed instruments — not a claim of live quotes for every row.
 * Coverage is honest: live = verified in-app provider path; proxy = known FMP-style symbol for later wiring;
 * awaiting = listed for navigation only until a verified feed exists.
 */

import { MARKET_BOARD_SYMBOLS } from "../market-board-instruments.ts";

export const MARKET_GROUPS = [
  "indices",
  "fx",
  "cryptocurrency",
  "shares",
  "commodities",
  "bonds_and_rates",
  "etfs",
  "ipos",
] as const;

export type MarketGroupId = (typeof MARKET_GROUPS)[number];
export type MarketCoverage = "live" | "proxy" | "awaiting";

export type MarketInstrument = {
  readonly id: string;
  readonly name: string;
  readonly symbol: string;
  readonly providerSymbol?: string;
  readonly group: MarketGroupId;
  readonly coverage: MarketCoverage;
  readonly note?: string;
};

export type MarketGroup = {
  readonly id: MarketGroupId;
  readonly label: string;
  readonly description: string;
  readonly instruments: readonly MarketInstrument[];
};

const LIVE = new Set<string>(MARKET_BOARD_SYMBOLS);

function instrument(
  group: MarketGroupId,
  id: string,
  name: string,
  symbol: string,
  providerSymbol: string | undefined,
  coverage: MarketCoverage,
  note?: string,
): MarketInstrument {
  const resolvedCoverage: MarketCoverage = LIVE.has(symbol) ? "live" : coverage;
  return {
    id,
    name,
    symbol,
    ...(providerSymbol ? { providerSymbol } : {}),
    group,
    coverage: resolvedCoverage,
    ...(note ? { note } : {}),
  };
}

const INDICES: readonly MarketInstrument[] = [
  instrument("indices", "es", "S&P 500 Futures (ES)", "ES", "ESUSD", "live"),
  instrument("indices", "spx", "S&P 500 Index", "SPX", "^GSPC", "proxy"),
  instrument("indices", "ixic", "Nasdaq Composite", "IXIC", "^IXIC", "live"),
  instrument("indices", "ndx", "Nasdaq-100", "NDX", "^NDX", "proxy"),
  instrument("indices", "nq-futures", "E-mini Nasdaq-100 Futures (NQ)", "NQ", undefined, "awaiting", "Futures series awaiting verified provider mapping. Not the Nasdaq Composite index."),
  instrument("indices", "dji", "Dow Jones Industrial", "DJI", "^DJI", "proxy"),
  instrument("indices", "ym", "Dow Futures (YM)", "YM", undefined, "awaiting", "Futures series awaiting verified provider mapping."),
  instrument("indices", "rut", "Russell 2000", "RUT", "^RUT", "proxy"),
  instrument("indices", "vix", "CBOE Volatility Index", "VIX", "^VIX", "live"),
  instrument("indices", "dxy", "US Dollar Index", "DXY", "DX-Y.NYB", "live"),
  instrument("indices", "ftse", "FTSE 100", "FTSE", "^FTSE", "proxy"),
  instrument("indices", "dax", "DAX", "DAX", "^GDAXI", "proxy"),
  instrument("indices", "cac", "CAC 40", "CAC", "^FCHI", "proxy"),
  instrument("indices", "stoxx50", "Euro Stoxx 50", "SX5E", "^STOXX50E", "proxy"),
  instrument("indices", "nikkei", "Nikkei 225", "N225", "^N225", "proxy"),
  instrument("indices", "hsi", "Hang Seng", "HSI", "^HSI", "proxy"),
  instrument("indices", "asx", "ASX 200", "ASX200", "^AXJO", "proxy"),
  instrument("indices", "kospi", "KOSPI", "KOSPI", "^KS11", "proxy"),
  instrument("indices", "sensex", "BSE Sensex", "SENSEX", "^BSESN", "proxy"),
];

const FX: readonly MarketInstrument[] = [
  instrument("fx", "eurusd", "Euro / US Dollar", "EURUSD", "EURUSD", "proxy"),
  instrument("fx", "gbpusd", "Pound / US Dollar", "GBPUSD", "GBPUSD", "proxy"),
  instrument("fx", "usdjpy", "US Dollar / Yen", "USDJPY", "USDJPY", "proxy"),
  instrument("fx", "audusd", "Aussie / US Dollar", "AUDUSD", "AUDUSD", "proxy"),
  instrument("fx", "usdcad", "US Dollar / Canadian", "USDCAD", "USDCAD", "proxy"),
  instrument("fx", "usdchf", "US Dollar / Swiss Franc", "USDCHF", "USDCHF", "proxy"),
  instrument("fx", "nzdusd", "Kiwi / US Dollar", "NZDUSD", "NZDUSD", "proxy"),
  instrument("fx", "eurgbp", "Euro / Pound", "EURGBP", "EURGBP", "proxy"),
  instrument("fx", "eurjpy", "Euro / Yen", "EURJPY", "EURJPY", "proxy"),
  instrument("fx", "gbpjpy", "Pound / Yen", "GBPJPY", "GBPJPY", "proxy"),
  instrument("fx", "audjpy", "Aussie / Yen", "AUDJPY", "AUDJPY", "proxy"),
  instrument("fx", "euraud", "Euro / Aussie", "EURAUD", "EURAUD", "proxy"),
  instrument("fx", "usdmxn", "US Dollar / Mexican Peso", "USDMXN", "USDMXN", "proxy"),
  instrument("fx", "usdsek", "US Dollar / Swedish Krona", "USDSEK", "USDSEK", "proxy"),
  instrument("fx", "usdtry", "US Dollar / Turkish Lira", "USDTRY", "USDTRY", "proxy"),
  instrument("fx", "usdcnh", "US Dollar / Offshore Yuan", "USDCNH", "USDCNH", "proxy"),
];

const CRYPTO: readonly MarketInstrument[] = [
  instrument("cryptocurrency", "btc", "Bitcoin", "BTC", "BTCUSD", "proxy"),
  instrument("cryptocurrency", "eth", "Ethereum", "ETH", "ETHUSD", "proxy"),
  instrument("cryptocurrency", "sol", "Solana", "SOL", "SOLUSD", "proxy"),
  instrument("cryptocurrency", "xrp", "XRP", "XRP", "XRPUSD", "proxy"),
  instrument("cryptocurrency", "bnb", "BNB", "BNB", "BNBUSD", "proxy"),
  instrument("cryptocurrency", "ada", "Cardano", "ADA", "ADAUSD", "proxy"),
  instrument("cryptocurrency", "avax", "Avalanche", "AVAX", "AVAXUSD", "proxy"),
  instrument("cryptocurrency", "dot", "Polkadot", "DOT", "DOTUSD", "proxy"),
  instrument("cryptocurrency", "link", "Chainlink", "LINK", "LINKUSD", "proxy"),
  instrument("cryptocurrency", "doge", "Dogecoin", "DOGE", "DOGEUSD", "proxy"),
  instrument("cryptocurrency", "ltc", "Litecoin", "LTC", "LTCUSD", "proxy"),
  instrument("cryptocurrency", "matic", "Polygon", "MATIC", "MATICUSD", "proxy"),
];

/** Desk watchlist examples — not an exhaustive share universe. */
const SHARES: readonly MarketInstrument[] = [
  instrument("shares", "aapl", "Apple", "AAPL", "AAPL", "proxy"),
  instrument("shares", "msft", "Microsoft", "MSFT", "MSFT", "proxy"),
  instrument("shares", "nvda", "NVIDIA", "NVDA", "NVDA", "proxy"),
  instrument("shares", "amzn", "Amazon", "AMZN", "AMZN", "proxy"),
  instrument("shares", "googl", "Alphabet", "GOOGL", "GOOGL", "proxy"),
  instrument("shares", "meta", "Meta Platforms", "META", "META", "proxy"),
  instrument("shares", "tsla", "Tesla", "TSLA", "TSLA", "proxy"),
  instrument("shares", "brkb", "Berkshire Hathaway B", "BRK.B", "BRK.B", "proxy"),
  instrument("shares", "jpm", "JPMorgan Chase", "JPM", "JPM", "proxy"),
  instrument("shares", "v", "Visa", "V", "V", "proxy"),
  instrument("shares", "unh", "UnitedHealth", "UNH", "UNH", "proxy"),
  instrument("shares", "xom", "Exxon Mobil", "XOM", "XOM", "proxy"),
  instrument("shares", "lly", "Eli Lilly", "LLY", "LLY", "proxy"),
  instrument("shares", "avgo", "Broadcom", "AVGO", "AVGO", "proxy"),
  instrument("shares", "cost", "Costco", "COST", "COST", "proxy"),
  instrument("shares", "asml", "ASML Holding", "ASML", "ASML", "proxy", "International ADR / listing example."),
  instrument("shares", "sap", "SAP", "SAP", "SAP", "proxy", "International ADR / listing example."),
  instrument("shares", "tm", "Toyota Motor", "TM", "TM", "proxy", "International ADR / listing example."),
  instrument("shares", "bhp", "BHP Group", "BHP", "BHP", "proxy", "International ADR / listing example."),
  instrument("shares", "nesn", "Nestlé (SIX)", "NESN.SW", "NESN.SW", "awaiting", "International listing awaiting verified provider path."),
];

const COMMODITIES: readonly MarketInstrument[] = [
  instrument("commodities", "gold", "Gold", "GOLD", "GCUSD", "proxy"),
  instrument("commodities", "silver", "Silver", "SILVER", "SIUSD", "proxy"),
  instrument("commodities", "oil", "Crude Oil (USO proxy)", "OIL", "USO", "live", "Equity ETF proxy — not a live futures print."),
  instrument("commodities", "wti", "WTI Crude", "CL", "CLUSD", "proxy"),
  instrument("commodities", "brent", "Brent Crude", "BZ", "BZUSD", "proxy"),
  instrument("commodities", "ngas", "Natural Gas", "NG", "NGUSD", "proxy"),
  instrument("commodities", "copper", "Copper", "HG", "HGUSD", "proxy"),
  instrument("commodities", "platinum", "Platinum", "PL", "PLUSD", "proxy"),
  instrument("commodities", "palladium", "Palladium", "PA", "PAUSD", "proxy"),
  instrument("commodities", "corn", "Corn", "ZC", undefined, "awaiting", "Ag futures awaiting verified provider mapping."),
  instrument("commodities", "wheat", "Wheat", "ZW", undefined, "awaiting", "Ag futures awaiting verified provider mapping."),
  instrument("commodities", "soy", "Soybeans", "ZS", undefined, "awaiting", "Ag futures awaiting verified provider mapping."),
];

const BONDS: readonly MarketInstrument[] = [
  instrument("bonds_and_rates", "us2y", "US 2-Year Yield", "US2Y", undefined, "live", "Verified treasury scalar when provider snapshot is available."),
  instrument("bonds_and_rates", "us10y", "US 10-Year Yield", "US10Y", undefined, "live", "Verified treasury scalar when provider snapshot is available."),
  instrument("bonds_and_rates", "us30y", "US 30-Year Yield", "US30Y", "^TYX", "proxy"),
  instrument("bonds_and_rates", "tnx", "US 10-Year Index (^TNX)", "TNX", "^TNX", "proxy"),
  instrument("bonds_and_rates", "tlt", "iShares 20+ Year Treasury (TLT)", "TLT", "TLT", "proxy"),
  instrument("bonds_and_rates", "ief", "iShares 7-10 Year Treasury (IEF)", "IEF", "IEF", "proxy"),
  instrument("bonds_and_rates", "shy", "iShares 1-3 Year Treasury (SHY)", "SHY", "SHY", "proxy"),
  instrument("bonds_and_rates", "bund", "Euro Bund (label)", "BUND", undefined, "awaiting", "Bund futures / cash yield awaiting verified provider mapping."),
  instrument("bonds_and_rates", "gilt", "UK Gilt (label)", "GILT", undefined, "awaiting", "Gilt futures / cash yield awaiting verified provider mapping."),
  instrument("bonds_and_rates", "sofr", "SOFR (label)", "SOFR", undefined, "awaiting", "Rate label only — no invented SOFR print."),
  instrument("bonds_and_rates", "ffr", "Fed Funds (label)", "FFR", undefined, "awaiting", "Policy rate label only — not a live quote feed."),
];

const ETFS: readonly MarketInstrument[] = [
  instrument("etfs", "spy", "SPDR S&P 500 (SPY)", "SPY", "SPY", "proxy"),
  instrument("etfs", "qqq", "Invesco QQQ (QQQ)", "QQQ", "QQQ", "live"),
  instrument("etfs", "iwm", "iShares Russell 2000 (IWM)", "IWM", "IWM", "proxy"),
  instrument("etfs", "dia", "SPDR Dow Jones (DIA)", "DIA", "DIA", "proxy"),
  instrument("etfs", "gld", "SPDR Gold (GLD)", "GLD", "GLD", "proxy"),
  instrument("etfs", "slv", "iShares Silver (SLV)", "SLV", "SLV", "proxy"),
  instrument("etfs", "uso", "United States Oil (USO)", "USO", "USO", "proxy"),
  instrument("etfs", "ung", "United States Natural Gas (UNG)", "UNG", "UNG", "proxy"),
  instrument("etfs", "tlt-etf", "iShares 20+ Year Treasury (TLT)", "TLT", "TLT", "proxy"),
  instrument("etfs", "hyg", "iShares High Yield Corp (HYG)", "HYG", "HYG", "proxy"),
  instrument("etfs", "lqd", "iShares Investment Grade (LQD)", "LQD", "LQD", "proxy"),
  instrument("etfs", "eem", "iShares Emerging Markets (EEM)", "EEM", "EEM", "proxy"),
  instrument("etfs", "vwo", "Vanguard Emerging Markets (VWO)", "VWO", "VWO", "proxy"),
  instrument("etfs", "efa", "iShares MSCI EAFE (EFA)", "EFA", "EFA", "proxy"),
  instrument("etfs", "xlk", "Technology Select (XLK)", "XLK", "XLK", "proxy"),
  instrument("etfs", "xle", "Energy Select (XLE)", "XLE", "XLE", "proxy"),
  instrument("etfs", "xlf", "Financial Select (XLF)", "XLF", "XLF", "proxy"),
  instrument("etfs", "arkk", "ARK Innovation (ARKK)", "ARKK", "ARKK", "proxy"),
];

/**
 * IPO desk slot — no fabricated IPO prices or unverified listing names as live rows.
 * Content is structural honesty until a verified IPO feed is wired.
 */
const IPOS: readonly MarketInstrument[] = [
  instrument(
    "ipos",
    "ipo-coverage",
    "IPO coverage awaiting verified provider",
    "IPO",
    undefined,
    "awaiting",
    "No IPO listing feed is wired. This group is a placeholder so the Markets browser stays honest — names and prices are not invented.",
  ),
];

export const MARKET_CATALOG: readonly MarketGroup[] = [
  {
    id: "indices",
    label: "Indices",
    description: "Major global equity indices and related futures references.",
    instruments: INDICES,
  },
  {
    id: "fx",
    label: "FX",
    description: "Major and selected cross currency pairs.",
    instruments: FX,
  },
  {
    id: "cryptocurrency",
    label: "Cryptocurrency",
    description: "Widely followed digital assets (provider symbols for later wiring).",
    instruments: CRYPTO,
  },
  {
    id: "shares",
    label: "Shares",
    description: "Desk watchlist examples — mega-caps and a few internationals, not all shares.",
    instruments: SHARES,
  },
  {
    id: "commodities",
    label: "Commodities",
    description: "Metals, energy, and selected ag labels.",
    instruments: COMMODITIES,
  },
  {
    id: "bonds_and_rates",
    label: "Bonds and Rates",
    description: "Treasury yields, rate ETFs, and carefully labeled rate placeholders.",
    instruments: BONDS,
  },
  {
    id: "etfs",
    label: "ETFs",
    description: "Liquid equity, commodity, and fixed-income ETFs.",
    instruments: ETFS,
  },
  {
    id: "ipos",
    label: "IPOs",
    description: "IPO watch structure — awaiting a verified listing provider.",
    instruments: IPOS,
  },
] as const;

export const MARKET_GROUP_LABELS: Record<MarketGroupId, string> = Object.fromEntries(
  MARKET_CATALOG.map((group) => [group.id, group.label]),
) as Record<MarketGroupId, string>;

export function getMarketGroup(id: MarketGroupId): MarketGroup | undefined {
  return MARKET_CATALOG.find((group) => group.id === id);
}

/** Legacy desk favourites used "nq" for the Nasdaq Composite (^IXIC) feed. */
export function resolveStoredMarketId(id: string): string {
  return id === "nq" ? "ixic" : id;
}

export function getMarketInstrument(id: string): MarketInstrument | undefined {
  const resolvedId = resolveStoredMarketId(id);
  for (const group of MARKET_CATALOG) {
    const found = group.instruments.find((item) => item.id === resolvedId);
    if (found) return found;
  }
  return undefined;
}

/** Favourite membership independent of selection; normalises legacy ids. */
export function isFavouriteMarketId(favourites: readonly string[], instrumentId: string): boolean {
  const resolved = resolveStoredMarketId(instrumentId);
  return favourites.some((id) => resolveStoredMarketId(id) === resolved);
}

export function liveAvailableCount(group: MarketGroup): number {
  return group.instruments.filter((item) => item.coverage === "live").length;
}

export function plannedMarketCount(group: MarketGroup): number {
  return group.instruments.filter((item) => item.coverage !== "live").length;
}

/** Compact group badge: "4 available" or "coming later" — never a fake catalogue total. */
export function groupAvailabilityLabel(group: MarketGroup): string {
  const live = liveAvailableCount(group);
  if (live > 0) return `${live} available`;
  return "coming later";
}

export function coverageLabel(coverage: MarketCoverage): string {
  switch (coverage) {
    case "live":
      return "Connected";
    case "proxy":
      return "Data pending";
    case "awaiting":
      return "Coming soon";
  }
}

export function coverageDetail(instrument: MarketInstrument): string {
  if (instrument.note) return instrument.note;
  switch (instrument.coverage) {
    case "live":
      return "This symbol has a verified in-app data connection. Quotes and charts appear only when a verified series is loaded — nothing is invented here.";
    case "proxy":
      return `Symbol ${instrument.providerSymbol ?? instrument.symbol} is ready; data connection pending. No live quote or chart is shown until that feed is verified.`;
    case "awaiting":
      return "Market listed; live coverage not yet available. Prices and charts are not fabricated.";
  }
}

export function catalogCountsByGroup(): Record<MarketGroupId, number> {
  return Object.fromEntries(MARKET_CATALOG.map((group) => [group.id, group.instruments.length])) as Record<
    MarketGroupId,
    number
  >;
}

export function allMarketInstruments(): readonly MarketInstrument[] {
  return MARKET_CATALOG.flatMap((group) => group.instruments);
}
