import type { MarketDataProvider, MarketQuote, MarketSnapshot } from "../market-data.ts";

export const FINANCIAL_MODELING_PREP_PROVIDER_NAME = "Financial Modeling Prep";
export const DEFAULT_FINANCIAL_MODELING_PREP_BASE_URL = "https://financialmodelingprep.com/stable/";

export type FinancialModelingPrepSymbolMap = {
  sp500Futures: string;
  vix: string;
  usDollarIndex: string;
};

export const DEFAULT_FINANCIAL_MODELING_PREP_SYMBOLS: FinancialModelingPrepSymbolMap = {
  sp500Futures: "ESUSD",
  vix: "^VIX",
  usDollarIndex: "DX-Y.NYB",
};

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type FinancialModelingPrepAdapterOptions = {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  symbols?: Partial<FinancialModelingPrepSymbolMap>;
  fetchImpl?: FetchLike;
  logger?: (message: string, details?: Record<string, unknown>) => void;
};

type FmpQuote = {
  symbol: string;
  price: number;
  change: number;
  changesPercentage: number;
  timestamp: number;
};

type FmpTreasuryRates = {
  date: string;
  year2: number;
  year10: number;
};

const MAX_FUTURE_SKEW_MS = 60_000;
const MAX_TREASURY_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type SafeFailureCategory = "authentication_rejected" | "plan_restricted" | "rate_limited" | "malformed_json" | "timeout" | "invalid_response" | "network_interruption";
type FmpInstrument = "sp500" | "vix" | "us_dollar" | "treasury";

class SafeProviderFailure extends Error {
  readonly category: SafeFailureCategory;

  constructor(category: SafeFailureCategory) {
    super(category);
    this.category = category;
    this.name = "SafeProviderFailure";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseQuote(payload: unknown, expectedSymbol: string): FmpQuote | null {
  if (!Array.isArray(payload) || payload.length !== 1 || !isRecord(payload[0])) return null;
  const candidate = payload[0];
  const price = finiteNumber(candidate.price);
  const change = finiteNumber(candidate.change);
  const changesPercentage = finiteNumber(candidate.changesPercentage);
  const timestamp = finiteNumber(candidate.timestamp);
  if (candidate.symbol !== expectedSymbol || price === null || change === null || changesPercentage === null || timestamp === null) {
    return null;
  }
  return { symbol: expectedSymbol, price, change, changesPercentage, timestamp };
}

function parseTreasuryRates(payload: unknown): FmpTreasuryRates | null {
  if (!Array.isArray(payload)) return null;
  const rows = payload.filter(isRecord).map((candidate) => ({
    date: typeof candidate.date === "string" ? candidate.date : "",
    year2: finiteNumber(candidate.year2),
    year10: finiteNumber(candidate.year10),
  })).filter((candidate): candidate is FmpTreasuryRates => (
    candidate.date.length > 0 && candidate.year2 !== null && candidate.year10 !== null
  ));
  rows.sort((left, right) => Date.parse(right.date) - Date.parse(left.date));
  return rows[0] ?? null;
}

function quoteTimestampMs(quote: FmpQuote): number | null {
  const timestamp = quote.timestamp * 1000;
  return Number.isFinite(timestamp) ? timestamp : null;
}

function treasuryTimestampMs(rates: FmpTreasuryRates): number | null {
  const timestamp = Date.parse(rates.date);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function direction(change: number): MarketQuote["direction"] {
  return change > 0 ? "up" : change < 0 ? "down" : "flat";
}

function formatPrice(value: number, digits = 2): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatChange(quote: FmpQuote): string {
  const prefix = quote.changesPercentage > 0 ? "+" : "";
  return `${prefix}${quote.changesPercentage.toFixed(2)}%`;
}

function sp500Presentation(providerSymbol: string): Pick<MarketQuote, "symbol" | "label"> {
  if (providerSymbol === DEFAULT_FINANCIAL_MODELING_PREP_SYMBOLS.sp500Futures) {
    return { symbol: "ES", label: "ES FUTURES" };
  }
  return providerSymbol === "SPY"
    ? { symbol: "SPY", label: "S&P 500 ETF" }
    : { symbol: "SPX", label: "S&P 500" };
}

function createUrl(baseUrl: string, pathname: string, apiKey: string, symbol?: string): URL {
  const base = new URL(baseUrl);
  const baseQuery = new URLSearchParams(base.search);
  base.search = "";
  if (!base.pathname.endsWith("/")) base.pathname = `${base.pathname}/`;
  const url = new URL(pathname, base);
  baseQuery.forEach((value, key) => url.searchParams.append(key, value));
  if (symbol) url.searchParams.set("symbol", symbol);
  url.searchParams.set("apikey", apiKey);
  return url;
}

export function createFinancialModelingPrepAdapter(options: FinancialModelingPrepAdapterOptions): MarketDataProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 4_500;
  const baseUrl = options.baseUrl?.trim() || DEFAULT_FINANCIAL_MODELING_PREP_BASE_URL;
  const symbols: FinancialModelingPrepSymbolMap = {
    sp500Futures: options.symbols?.sp500Futures || DEFAULT_FINANCIAL_MODELING_PREP_SYMBOLS.sp500Futures,
    vix: options.symbols?.vix || DEFAULT_FINANCIAL_MODELING_PREP_SYMBOLS.vix,
    usDollarIndex: options.symbols?.usDollarIndex || DEFAULT_FINANCIAL_MODELING_PREP_SYMBOLS.usDollarIndex,
  };
  const logger = options.logger ?? (() => undefined);

  return {
    async fetchSnapshot() {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const request = async (pathname: string, symbol?: string): Promise<unknown> => {
        let response: Response;
        try {
          response = await fetchImpl(createUrl(baseUrl, pathname, options.apiKey, symbol), { cache: "no-store", signal: controller.signal });
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") throw error;
          throw new SafeProviderFailure("network_interruption");
        }
        if (response.status === 401 || response.status === 403) throw new SafeProviderFailure("authentication_rejected");
        if (response.status === 402) throw new SafeProviderFailure("plan_restricted");
        if (response.status === 429) throw new SafeProviderFailure("rate_limited");
        if (!response.ok) throw new SafeProviderFailure("invalid_response");
        try {
          return await response.json() as unknown;
        } catch {
          throw new SafeProviderFailure("malformed_json");
        }
      };

      try {
        logger("market-provider:request", { provider: FINANCIAL_MODELING_PREP_PROVIDER_NAME });
        const [esResult, vixResult, dollarResult, treasuryResult] = await Promise.allSettled([
          request("quote", symbols.sp500Futures),
          request("quote", symbols.vix),
          request("quote", symbols.usDollarIndex),
          request("treasury-rates"),
        ]);
        if (esResult.status === "rejected") throw esResult.reason;
        const es = parseQuote(esResult.value, symbols.sp500Futures);
        if (!es) throw new SafeProviderFailure("invalid_response");
        const esTimestamp = quoteTimestampMs(es);
        if (esTimestamp === null) throw new SafeProviderFailure("invalid_response");
        const now = Date.now();
        if (esTimestamp > now + MAX_FUTURE_SKEW_MS) throw new SafeProviderFailure("invalid_response");

        const secondaryFailure = (instrument: Exclude<FmpInstrument, "sp500">, category: SafeFailureCategory) => {
          logger("market-provider:failure", {
            provider: FINANCIAL_MODELING_PREP_PROVIDER_NAME,
            category,
            instrument,
          });
        };
        const optionalQuote = (
          instrument: "vix" | "us_dollar",
          result: PromiseSettledResult<unknown>,
          expectedSymbol: string,
        ): FmpQuote | null => {
          if (result.status === "rejected") {
            const category = result.reason instanceof SafeProviderFailure ? result.reason.category : "invalid_response";
            secondaryFailure(instrument, category);
            return null;
          }
          const quote = parseQuote(result.value, expectedSymbol);
          const timestamp = quote ? quoteTimestampMs(quote) : null;
          if (!quote || timestamp === null || timestamp > now + MAX_FUTURE_SKEW_MS) {
            secondaryFailure(instrument, "invalid_response");
            return null;
          }
          return quote;
        };

        const vix = optionalQuote("vix", vixResult, symbols.vix);
        const dollar = optionalQuote("us_dollar", dollarResult, symbols.usDollarIndex);
        let treasury: FmpTreasuryRates | null = null;
        if (treasuryResult.status === "rejected") {
          const category = treasuryResult.reason instanceof SafeProviderFailure ? treasuryResult.reason.category : "invalid_response";
          secondaryFailure("treasury", category);
        } else {
          treasury = parseTreasuryRates(treasuryResult.value);
          const treasuryTimestamp = treasury ? treasuryTimestampMs(treasury) : null;
          if (
            !treasury ||
            treasuryTimestamp === null ||
            treasuryTimestamp > now + MAX_FUTURE_SKEW_MS ||
            now - treasuryTimestamp > MAX_TREASURY_AGE_MS
          ) {
            secondaryFailure("treasury", "invalid_response");
            treasury = null;
          }
        }

        // The S&P observation is the primary dashboard clock. Secondary
        // instruments can be daily or unavailable and must not stale or erase it.
        const asOf = new Date(esTimestamp).toISOString();
        const sp500 = sp500Presentation(symbols.sp500Futures);
        const quotes: MarketQuote[] = [
          { ...sp500, value: formatPrice(es.price), change: formatChange(es), direction: direction(es.change) },
        ];
        if (vix) quotes.push({ symbol: "VIX", label: "VIX", value: formatPrice(vix.price), change: formatChange(vix), direction: direction(vix.change) });
        if (treasury) {
          quotes.push(
            { symbol: "US2Y", label: "2Y YIELD", value: `${treasury.year2.toFixed(2)}%`, change: "—", direction: "flat" },
            { symbol: "US10Y", label: "10Y YIELD", value: `${treasury.year10.toFixed(2)}%`, change: "—", direction: "flat" },
          );
        }
        if (dollar) quotes.push({ symbol: "DXY", label: "US DOLLAR", value: formatPrice(dollar.price), change: formatChange(dollar), direction: direction(dollar.change) });
        const secondaryAvailable = Boolean(vix && treasury && dollar);

        const snapshot: MarketSnapshot = {
          status: "LIVE",
          source: FINANCIAL_MODELING_PREP_PROVIDER_NAME,
          asOf,
          quotes,
          levels: [],
          events: [],
          bias: "UNAVAILABLE",
          risk: "MODERATE",
          summary: secondaryAvailable
            ? "Verified market observations supplied by Financial Modeling Prep. Economic calendar data is not connected."
            : "Verified S&P observation supplied by Financial Modeling Prep. One or more secondary instruments are unavailable; trading conclusions remain fail-closed.",
          evidence: {},
        };
        return snapshot;
      } catch (error) {
        const category: SafeFailureCategory = error instanceof Error && error.name === "AbortError"
          ? "timeout"
          : error instanceof SafeProviderFailure
            ? error.category
            : "invalid_response";
        logger("market-provider:failure", { provider: FINANCIAL_MODELING_PREP_PROVIDER_NAME, category });
        throw new Error(category === "timeout" ? "FMP request timed out" : `FMP provider failure: ${category}`);
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
