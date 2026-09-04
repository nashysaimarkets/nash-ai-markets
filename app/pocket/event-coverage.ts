export type EventAssetClass =
  | "LISTED_COMPANY"
  | "INDEX_OR_ETF"
  | "FUTURES"
  | "FOREX"
  | "CRYPTO"
  | "COMMODITY"
  | "RATES"
  | "UNKNOWN";

export type EventCoverageInput = {
  instrument: string;
  ticker: string;
  evidenceQuality: { instrumentConfidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN" };
};

export type EventCoverage = {
  assetClass: EventAssetClass;
  label: string;
  summary: string;
  limitation: string | null;
  attachCompanyCalendar: boolean;
};

const CURRENCY_CODES = new Set([
  "AUD", "CAD", "CHF", "CNY", "CNH", "EUR", "GBP", "HKD", "JPY", "MXN", "NOK", "NZD", "SEK", "SGD", "TRY", "USD", "ZAR",
]);
const ETF_TICKERS = new Set(["DIA", "EEM", "EFA", "GLD", "IWM", "QQQ", "SLV", "SPY", "TLT", "USO", "VTI", "XLE", "XLF", "XLK"]);
const INDEX_TICKERS = new Set(["DJI", "DJIA", "DOW", "IXIC", "NDX", "RUT", "SPX", "VIX"]);
const FUTURES_TICKERS = new Set(["CL", "ES", "GC", "HG", "MES", "MNQ", "NG", "NQ", "RTY", "SI", "YM", "ZB", "ZN"]);
const CRYPTO_CODES = new Set(["ADA", "AVAX", "BNB", "BTC", "DOGE", "DOT", "ETH", "LINK", "LTC", "SOL", "XRP"]);

function normalized(input: EventCoverageInput) {
  return {
    identity: `${input.instrument} ${input.ticker}`.trim().toUpperCase(),
    ticker: input.ticker.trim().toUpperCase(),
  };
}

function compactPair(ticker: string): [string, string] | null {
  const compact = ticker.replace(/[^A-Z]/g, "");
  if (compact.length !== 6) return null;
  const base = compact.slice(0, 3);
  const quote = compact.slice(3);
  return CURRENCY_CODES.has(base) && CURRENCY_CODES.has(quote) ? [base, quote] : null;
}

export function classifyEventAsset(input: EventCoverageInput): EventAssetClass {
  if (input.evidenceQuality.instrumentConfidence !== "HIGH") return "UNKNOWN";
  const { identity, ticker } = normalized(input);

  // Broker display names are often the strongest available identity on a
  // screenshot. A confirmed "US 500 (DFB)" must not be downgraded merely
  // because the broker does not print an exchange ticker beside it.
  const brokerIndexIdentity = /\b(?:US\s*500|S\s*&?\s*P\s*500|WALL\s+STREET|US\s*TECH\s*100|GERMANY\s*40|FTSE\s*100)\b/.test(identity)
    || /\b(?:INDEX|INDICES|ETF|DFB|CASH INDEX)\b/.test(identity);
  if (!ticker || ticker === "UNKNOWN") return brokerIndexIdentity ? "INDEX_OR_ETF" : "UNKNOWN";

  if (/\b(CRYPTO|BITCOIN|ETHEREUM|ALTCOIN)\b/.test(identity)) return "CRYPTO";
  const cryptoCompact = ticker.replace(/[^A-Z]/g, "");
  if ([...CRYPTO_CODES].some((code) => cryptoCompact === code || cryptoCompact === `${code}USD` || cryptoCompact === `${code}USDT`)) return "CRYPTO";

  if (/\b(COMMODIT(?:Y|IES)|GOLD|SILVER|COPPER|CRUDE|BRENT|WTI|NATURAL GAS)\b/.test(identity) || /^(XAU|XAG|XPT|XPD)(USD)?$/.test(cryptoCompact)) return "COMMODITY";
  if (/\b(FOREX|FX|CURRENCY)\b/.test(identity) || compactPair(ticker)) return "FOREX";
  if (/\b(FUTURE|FUTURES|CONTINUOUS CONTRACT)\b/.test(identity) || FUTURES_TICKERS.has(ticker)) return "FUTURES";
  if (/\b(BOND|BONDS|TREASURY|TREASURIES|YIELD|GILT|BUND)\b/.test(identity) || /^(US)?(?:2Y|5Y|10Y|30Y)$/.test(ticker)) return "RATES";
  if (brokerIndexIdentity || INDEX_TICKERS.has(ticker) || ETF_TICKERS.has(ticker)) return "INDEX_OR_ETF";

  return /^[A-Z][A-Z0-9.-]{0,14}$/.test(ticker) ? "LISTED_COMPANY" : "UNKNOWN";
}

export function eventCoverageFor(input: EventCoverageInput): EventCoverage {
  const assetClass = classifyEventAsset(input);
  switch (assetClass) {
    case "LISTED_COMPANY":
      return {
        assetClass,
        label: "COMPANY + US MACRO",
        summary: "Official US macro events apply, with symbol-matched earnings, dividend and split dates checked separately.",
        limitation: "Company dates are provider-scheduled and can be revised.",
        attachCompanyCalendar: true,
      };
    case "FOREX": {
      const pair = compactPair(input.ticker.trim().toUpperCase());
      const includesUsd = pair?.includes("USD") ?? /\bUSD\b/.test(input.instrument.toUpperCase());
      return {
        assetClass,
        label: includesUsd ? "USD MACRO + PAIR CONTEXT" : "GLOBAL RISK CONTEXT",
        summary: includesUsd
          ? "Official US events cover the USD side of this pair and remain visible for every analysis."
          : "Official US events remain visible as broad risk context for this currency pair.",
        limitation: "Non-US central-bank and national statistics calendars are not yet connected.",
        attachCompanyCalendar: false,
      };
    }
    case "CRYPTO":
      return { assetClass, label: "US MACRO + CRYPTO CONTEXT", summary: "Official US macro events remain visible because rates, inflation and Fed decisions can affect crypto risk conditions.", limitation: "Token, protocol, exchange and unlock calendars are not connected.", attachCompanyCalendar: false };
    case "COMMODITY":
      return { assetClass, label: "US MACRO + COMMODITY CONTEXT", summary: "Official US macro events remain visible for this commodity analysis.", limitation: "Inventory, OPEC, USDA and specialist commodity schedules are not connected.", attachCompanyCalendar: false };
    case "RATES":
      return { assetClass, label: "US MACRO + RATES CONTEXT", summary: "Fed, inflation, labour and growth schedules remain visible for this rates instrument.", limitation: "Non-US sovereign and central-bank calendars are not connected.", attachCompanyCalendar: false };
    case "FUTURES":
    case "INDEX_OR_ETF":
      return { assetClass, label: "US MACRO MARKET CONTEXT", summary: "Official Fed, BLS and BEA events remain visible for this market instrument.", limitation: null, attachCompanyCalendar: false };
    default:
      return { assetClass, label: "GENERAL US MACRO CHECK", summary: "The official US macro schedule remains visible even though the symbol type could not be verified.", limitation: "Symbol-specific events are withheld until the instrument is confirmed.", attachCompanyCalendar: false };
  }
}

export function isListedEquityEventInput(input: EventCoverageInput): boolean {
  return eventCoverageFor(input).attachCompanyCalendar;
}
