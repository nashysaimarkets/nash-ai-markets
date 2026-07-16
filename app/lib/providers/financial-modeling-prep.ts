import type { MarketDataProvider, MarketQuote, MarketSnapshot } from "../market-data.ts";

export const FINANCIAL_MODELING_PREP_PROVIDER_NAME = "Financial Modeling Prep";

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
  baseUrl: string;
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

type SafeFailureCategory = "authentication_rejected" | "rate_limited" | "malformed_json" | "timeout" | "invalid_response" | "network_interruption";

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
          response = await fetchImpl(createUrl(options.baseUrl, pathname, options.apiKey, symbol), { cache: "no-store", signal: controller.signal });
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") throw error;
          throw new SafeProviderFailure("network_interruption");
        }
        if (response.status === 401 || response.status === 403) throw new SafeProviderFailure("authentication_rejected");
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
        const [esPayload, vixPayload, dollarPayload, treasuryPayload] = await Promise.all([
          request("quote", symbols.sp500Futures),
          request("quote", symbols.vix),
          request("quote", symbols.usDollarIndex),
          request("treasury-rates"),
        ]);
        const es = parseQuote(esPayload, symbols.sp500Futures);
        const vix = parseQuote(vixPayload, symbols.vix);
        const dollar = parseQuote(dollarPayload, symbols.usDollarIndex);
        const treasury = parseTreasuryRates(treasuryPayload);
        if (!es || !vix || !dollar || !treasury) throw new Error("FMP response failed schema validation");

        const timestamps = [quoteTimestampMs(es), quoteTimestampMs(vix), quoteTimestampMs(dollar), treasuryTimestampMs(treasury)];
        if (timestamps.some((timestamp) => timestamp === null)) throw new Error("FMP response contained an invalid timestamp");
        const verifiedTimestamps = timestamps as number[];
        const now = Date.now();
        if (verifiedTimestamps.some((timestamp) => timestamp > now + MAX_FUTURE_SKEW_MS)) {
          throw new Error("FMP response contained a future timestamp");
        }
        const asOf = new Date(Math.min(...verifiedTimestamps)).toISOString();

        const snapshot: MarketSnapshot = {
          status: "LIVE",
          source: FINANCIAL_MODELING_PREP_PROVIDER_NAME,
          asOf,
          quotes: [
            { symbol: "ES", label: "ES FUTURES", value: formatPrice(es.price), change: formatChange(es), direction: direction(es.change) },
            { symbol: "VIX", label: "VIX", value: formatPrice(vix.price), change: formatChange(vix), direction: direction(vix.change) },
            { symbol: "US2Y", label: "2Y YIELD", value: `${treasury.year2.toFixed(2)}%`, change: "—", direction: "flat" },
            { symbol: "US10Y", label: "10Y YIELD", value: `${treasury.year10.toFixed(2)}%`, change: "—", direction: "flat" },
            { symbol: "DXY", label: "US DOLLAR", value: formatPrice(dollar.price), change: formatChange(dollar), direction: direction(dollar.change) },
          ],
          levels: [],
          events: [],
          bias: "UNAVAILABLE",
          risk: "MODERATE",
          summary: "Verified market observations supplied by Financial Modeling Prep. Economic calendar data is not connected.",
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
