import type {
  MarketDataProvider,
  MarketProviderAttemptDiagnostics,
  MarketProviderEndpointStatusCategories,
  MarketProviderHttpStatusCategory,
  MarketQuote,
  MarketSnapshot,
} from "../market-data.ts";
import { loadFmpEconomicCalendar } from "./fmp-economic-calendar.ts";

export const FINANCIAL_MODELING_PREP_PROVIDER_NAME = "Financial Modeling Prep";
export const DEFAULT_FINANCIAL_MODELING_PREP_BASE_URL = "https://financialmodelingprep.com/stable/";

export type FinancialModelingPrepSymbolMap = {
  sp500Futures: string;
  vix: string;
  usDollarIndex: string;
  oil: string;
  qqq: string;
  nasdaq: string;
};

export const DEFAULT_FINANCIAL_MODELING_PREP_SYMBOLS: FinancialModelingPrepSymbolMap = {
  sp500Futures: "ESUSD",
  vix: "^VIX",
  usDollarIndex: "DX-Y.NYB",
  oil: "USO",
  qqq: "QQQ",
  nasdaq: "^IXIC",
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
  timestampMs: number;
};

type FmpTreasuryRates = {
  date: string;
  year2: number;
  year10: number;
};

const MAX_FUTURE_SKEW_MS = 60_000;
const MAX_TREASURY_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type SafeFailureCategory = "authentication_rejected" | "access_restricted" | "rate_limited" | "malformed_json" | "timeout" | "invalid_response" | "network_interruption";
type FmpInstrument = "sp500" | "vix" | "us_dollar" | "treasury" | "oil" | "qqq" | "nasdaq";
type FmpEndpointName = "ES futures" | "VIX" | "US Dollar Index" | "Treasury rates" | "Oil" | "QQQ" | "Nasdaq";
type FmpResponseKind = "quote" | "dollar_quote" | "treasury";

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
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value.replaceAll(",", "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function recordsFromPayload(payload: unknown, kind: FmpResponseKind, depth = 0): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload) || depth > 2) return [];
  const keys = kind === "treasury"
    ? ["data", "rates", "treasuryRates", "results", "result"]
    : ["data", "quotes", "quote", "results", "result"];
  for (const key of keys) {
    const nested = payload[key];
    if (Array.isArray(nested)) return nested.filter(isRecord);
    if (isRecord(nested)) {
      const deeper = recordsFromPayload(nested, kind, depth + 1);
      return deeper.length > 0 ? deeper : [nested];
    }
  }
  return [];
}

function normalizedSymbol(value: string): string {
  return value.trim().toUpperCase();
}

function timestampMs(candidate: Record<string, unknown>): number | null {
  const numeric = finiteNumber(candidate.timestamp ?? candidate.time);
  if (numeric !== null) {
    const milliseconds = numeric >= 1_000_000_000_000 ? numeric : numeric * 1000;
    return Number.isFinite(milliseconds) ? milliseconds : null;
  }
  for (const value of [candidate.date, candidate.datetime, candidate.lastUpdated, candidate.lastUpdatedAt]) {
    if (typeof value !== "string") continue;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parseQuote(payload: unknown, expectedSymbol: string): FmpQuote | null {
  const records = recordsFromPayload(payload, "quote");
  const exactMatch = records
    .find((record) => typeof record.symbol === "string" && normalizedSymbol(record.symbol) === normalizedSymbol(expectedSymbol));
  // FMP can canonicalize a requested continuous-contract/index alias in its
  // single-record quote response. The request remains scoped to one symbol, so
  // a single structurally valid record is safe to map to the requested
  // instrument without exposing or trusting an arbitrary multi-record result.
  const singleCanonicalAlias = records.length === 1 && typeof records[0]?.symbol === "string" && records[0].symbol.trim()
    ? records[0]
    : undefined;
  const candidate = exactMatch ?? singleCanonicalAlias;
  if (!candidate) return null;
  const price = finiteNumber(candidate.price);
  const change = finiteNumber(candidate.change);
  const changesPercentage = finiteNumber(candidate.changesPercentage ?? candidate.changePercentage ?? candidate.percentChange);
  const parsedTimestamp = timestampMs(candidate);
  if (price === null || change === null || changesPercentage === null || parsedTimestamp === null) {
    return null;
  }
  return { symbol: expectedSymbol, price, change, changesPercentage, timestampMs: parsedTimestamp };
}

function parseDollarIndexQuote(payload: unknown, expectedSymbol: string): FmpQuote | null {
  const exactRecord = recordsFromPayload(payload, "dollar_quote")
    .find((record) => typeof record.symbol === "string" && normalizedSymbol(record.symbol) === normalizedSymbol(expectedSymbol));
  if (!exactRecord) return null;

  const name = typeof exactRecord.name === "string" ? exactRecord.name.trim().toUpperCase() : "";
  const exchange = typeof exactRecord.exchange === "string" ? exactRecord.exchange.trim().toUpperCase() : "";
  if (name !== "US DOLLAR INDEX" || exchange !== "INDEX") return null;

  return parseQuote([exactRecord], expectedSymbol);
}

function parseTreasuryRates(payload: unknown): FmpTreasuryRates | null {
  const rows = recordsFromPayload(payload, "treasury").map((candidate) => ({
    date: typeof candidate.date === "string" ? candidate.date : "",
    year2: finiteNumber(candidate.year2),
    year10: finiteNumber(candidate.year10),
  })).filter((candidate): candidate is FmpTreasuryRates => (
    candidate.date.length > 0 && candidate.year2 !== null && candidate.year10 !== null
  ));
  rows.sort((left, right) => Date.parse(right.date) - Date.parse(left.date));
  return rows[0] ?? null;
}

function responseShape(payload: unknown): {
  payloadType: "array" | "object" | "null" | "primitive";
  recordCount: number;
  topLevelFieldNames: string[];
} {
  if (Array.isArray(payload)) {
    const firstRecord = payload.find(isRecord);
    return {
      payloadType: "array",
      recordCount: payload.length,
      topLevelFieldNames: firstRecord ? Object.keys(firstRecord).sort() : [],
    };
  }
  if (isRecord(payload)) {
    return {
      payloadType: "object",
      recordCount: 1,
      topLevelFieldNames: Object.keys(payload).sort(),
    };
  }
  return {
    payloadType: payload === null ? "null" : "primitive",
    recordCount: 0,
    topLevelFieldNames: [],
  };
}

function schemaMismatch(payload: unknown, kind: FmpResponseKind, expectedSymbol?: string): string {
  if (kind === "quote" || kind === "dollar_quote") {
    if (recordsFromPayload(payload, kind).length === 0) return "no quote records found";
    const parsed = expectedSymbol && (kind === "dollar_quote"
      ? parseDollarIndexQuote(payload, expectedSymbol)
      : parseQuote(payload, expectedSymbol));
    if (!parsed) {
      return "quote fields or requested symbol did not match";
    }
    return "none";
  }
  return parseTreasuryRates(payload)
    ? "none"
    : "no record matched date, year2 and year10";
}

function quoteTimestampMs(quote: FmpQuote): number | null {
  return Number.isFinite(quote.timestampMs) ? quote.timestampMs : null;
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

function emptyEndpointStatusCategories(): MarketProviderEndpointStatusCategories {
  return {
    sp500Futures: "not_attempted",
    vix: "not_attempted",
    treasuryYields: "not_attempted",
    usDollarIndex: "not_attempted",
    oil: "not_attempted",
    qqq: "not_attempted",
    nasdaq: "not_attempted",
  };
}

function statusCategory(status: number): MarketProviderHttpStatusCategory {
  if (status >= 200 && status < 300) return "success";
  if (status === 401 || status === 403) return "authentication_error";
  if (status === 402) return "access_restricted";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server_error";
  return "client_error";
}

function aggregateStatusCategory(
  endpointStatuses: MarketProviderEndpointStatusCategories,
): MarketProviderHttpStatusCategory {
  const attempted = Object.values(endpointStatuses).filter((status) => status !== "not_attempted");
  if (attempted.length === 0) return "not_attempted";
  return new Set(attempted).size === 1 ? attempted[0]! : "mixed";
}

export function createFinancialModelingPrepAdapter(options: FinancialModelingPrepAdapterOptions): MarketDataProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 4_500;
  const baseUrl = options.baseUrl?.trim() || DEFAULT_FINANCIAL_MODELING_PREP_BASE_URL;
  const symbols: FinancialModelingPrepSymbolMap = {
    sp500Futures: options.symbols?.sp500Futures || DEFAULT_FINANCIAL_MODELING_PREP_SYMBOLS.sp500Futures,
    vix: options.symbols?.vix || DEFAULT_FINANCIAL_MODELING_PREP_SYMBOLS.vix,
    usDollarIndex: options.symbols?.usDollarIndex || DEFAULT_FINANCIAL_MODELING_PREP_SYMBOLS.usDollarIndex,
    oil: options.symbols?.oil || DEFAULT_FINANCIAL_MODELING_PREP_SYMBOLS.oil,
    qqq: options.symbols?.qqq || DEFAULT_FINANCIAL_MODELING_PREP_SYMBOLS.qqq,
    nasdaq: options.symbols?.nasdaq || DEFAULT_FINANCIAL_MODELING_PREP_SYMBOLS.nasdaq,
  };
  const logger = options.logger ?? (() => undefined);
  let endpointStatusCategories = emptyEndpointStatusCategories();
  let diagnostics: MarketProviderAttemptDiagnostics = {
    resultCategory: "not_attempted",
    httpStatusCategory: "not_attempted",
    endpointStatusCategories: { ...endpointStatusCategories },
    responseReceived: false,
    schemaRecognized: false,
    quoteCount: 0,
    requiredInstrumentsFound: [],
    requiredInstrumentsMissing: ["ES", "VIX", "US2Y", "US10Y", "DXY"],
    providerTimestamp: null,
    failureReason: null,
  };

  return {
    getDiagnostics: () => ({
      ...diagnostics,
      requiredInstrumentsFound: [...diagnostics.requiredInstrumentsFound],
      requiredInstrumentsMissing: [...diagnostics.requiredInstrumentsMissing],
    }),
    async fetchSnapshot() {
      diagnostics = {
        resultCategory: "request_started",
        httpStatusCategory: "not_attempted",
        endpointStatusCategories: { ...emptyEndpointStatusCategories() },
        responseReceived: false,
        schemaRecognized: false,
        quoteCount: 0,
        requiredInstrumentsFound: [],
        requiredInstrumentsMissing: ["ES", "VIX", "US2Y", "US10Y", "DXY"],
        providerTimestamp: null,
        failureReason: null,
      };
      endpointStatusCategories = emptyEndpointStatusCategories();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const request = async (
        endpointKey: keyof MarketProviderEndpointStatusCategories,
        endpointName: FmpEndpointName,
        pathname: string,
        kind: FmpResponseKind,
        symbol?: string,
      ): Promise<unknown> => {
        let response: Response;
        try {
          response = await fetchImpl(createUrl(baseUrl, pathname, options.apiKey, symbol), { cache: "no-store", signal: controller.signal });
          diagnostics.responseReceived = true;
          endpointStatusCategories[endpointKey] = statusCategory(response.status);
        } catch (error) {
          endpointStatusCategories[endpointKey] = error instanceof Error && error.name === "AbortError"
            ? "timeout"
            : "network_error";
          logger("market-provider:response", {
            endpointName,
            httpStatus: null,
            payloadType: "request_failure",
            recordCount: 0,
            topLevelFieldNames: [],
            schemaMismatch: "request failed before an HTTP response",
          });
          if (error instanceof Error && error.name === "AbortError") throw error;
          throw new SafeProviderFailure("network_interruption");
        }
        let payload: unknown;
        try {
          payload = await response.json() as unknown;
        } catch {
          logger("market-provider:response", {
            endpointName,
            httpStatus: response.status,
            payloadType: "non_json",
            recordCount: 0,
            topLevelFieldNames: [],
            schemaMismatch: "response was not valid JSON",
          });
          if (response.status === 401 || response.status === 403) throw new SafeProviderFailure("authentication_rejected");
          if (response.status === 402) throw new SafeProviderFailure("access_restricted");
          if (response.status === 429) throw new SafeProviderFailure("rate_limited");
          if (!response.ok) throw new SafeProviderFailure("invalid_response");
          throw new SafeProviderFailure("malformed_json");
        }
        logger("market-provider:response", {
          endpointName,
          httpStatus: response.status,
          ...responseShape(payload),
          schemaMismatch: schemaMismatch(payload, kind, symbol),
        });
        if (response.status === 401 || response.status === 403) throw new SafeProviderFailure("authentication_rejected");
        if (response.status === 402) throw new SafeProviderFailure("access_restricted");
        if (response.status === 429) throw new SafeProviderFailure("rate_limited");
        if (!response.ok) throw new SafeProviderFailure("invalid_response");
        return payload;
      };

      try {
        logger("market-provider:request", { provider: FINANCIAL_MODELING_PREP_PROVIDER_NAME });
        const [esResult, vixResult, dollarResult, treasuryResult, oilResult, qqqResult, nasdaqResult, calendarEvents] = await Promise.all([
          request("sp500Futures", "ES futures", "quote", "quote", symbols.sp500Futures).then(
            (value) => ({ status: "fulfilled" as const, value }),
            (reason) => ({ status: "rejected" as const, reason }),
          ),
          request("vix", "VIX", "quote", "quote", symbols.vix).then(
            (value) => ({ status: "fulfilled" as const, value }),
            (reason) => ({ status: "rejected" as const, reason }),
          ),
          request("usDollarIndex", "US Dollar Index", "quote", "dollar_quote", symbols.usDollarIndex).then(
            (value) => ({ status: "fulfilled" as const, value }),
            (reason) => ({ status: "rejected" as const, reason }),
          ),
          request("treasuryYields", "Treasury rates", "treasury-rates", "treasury").then(
            (value) => ({ status: "fulfilled" as const, value }),
            (reason) => ({ status: "rejected" as const, reason }),
          ),
          request("oil", "Oil", "quote", "quote", symbols.oil).then(
            (value) => ({ status: "fulfilled" as const, value }),
            (reason) => ({ status: "rejected" as const, reason }),
          ),
          request("qqq", "QQQ", "quote", "quote", symbols.qqq).then(
            (value) => ({ status: "fulfilled" as const, value }),
            (reason) => ({ status: "rejected" as const, reason }),
          ),
          request("nasdaq", "Nasdaq", "quote", "quote", symbols.nasdaq).then(
            (value) => ({ status: "fulfilled" as const, value }),
            (reason) => ({ status: "rejected" as const, reason }),
          ),
          loadFmpEconomicCalendar({
            apiKey: options.apiKey,
            baseUrl,
            now: Date.now(),
            timeoutMs,
            fetchImpl,
            signal: controller.signal,
          }),
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
          instrument: Exclude<FmpInstrument, "sp500" | "treasury">,
          result: PromiseSettledResult<unknown>,
          expectedSymbol: string,
        ): FmpQuote | null => {
          if (result.status === "rejected") {
            const category = result.reason instanceof SafeProviderFailure ? result.reason.category : "invalid_response";
            secondaryFailure(instrument, category);
            return null;
          }
          const quote = instrument === "us_dollar"
            ? parseDollarIndexQuote(result.value, expectedSymbol)
            : parseQuote(result.value, expectedSymbol);
          const timestamp = quote ? quoteTimestampMs(quote) : null;
          if (!quote || timestamp === null || timestamp > now + MAX_FUTURE_SKEW_MS) {
            secondaryFailure(instrument, "invalid_response");
            return null;
          }
          return quote;
        };

        const vix = optionalQuote("vix", vixResult, symbols.vix);
        const dollar = optionalQuote("us_dollar", dollarResult, symbols.usDollarIndex);
        const oil = optionalQuote("oil", oilResult, symbols.oil);
        const qqq = optionalQuote("qqq", qqqResult, symbols.qqq);
        const nasdaq = optionalQuote("nasdaq", nasdaqResult, symbols.nasdaq);
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
        if (oil) quotes.push({ symbol: "OIL", label: "OIL (USO)", value: formatPrice(oil.price), change: formatChange(oil), direction: direction(oil.change) });
        if (qqq) quotes.push({ symbol: "QQQ", label: "QQQ", value: formatPrice(qqq.price), change: formatChange(qqq), direction: direction(qqq.change) });
        if (nasdaq) quotes.push({ symbol: "IXIC", label: "Nasdaq Composite", value: formatPrice(nasdaq.price), change: formatChange(nasdaq), direction: direction(nasdaq.change) });
        const secondaryAvailable = Boolean(vix && treasury && dollar);

        const snapshot: MarketSnapshot = {
          status: "LIVE",
          source: FINANCIAL_MODELING_PREP_PROVIDER_NAME,
          asOf,
          quotes,
          levels: [],
          events: calendarEvents,
          bias: "UNAVAILABLE",
          risk: "MODERATE",
          summary: secondaryAvailable
            ? calendarEvents.length
              ? "Verified market observations and US economic calendar supplied by Financial Modeling Prep."
              : "Verified market observations supplied by Financial Modeling Prep. No US medium/high-impact calendar rows were returned for the next week."
            : "Verified S&P observation supplied by Financial Modeling Prep. One or more secondary instruments are unavailable; trading conclusions remain fail-closed.",
          evidence: {},
        };
        const found = quotes.map((quote) => quote.symbol);
        diagnostics = {
          resultCategory: secondaryAvailable ? "success" : "partial_success",
          httpStatusCategory: aggregateStatusCategory(endpointStatusCategories),
          endpointStatusCategories: { ...endpointStatusCategories },
          responseReceived: true,
          schemaRecognized: true,
          quoteCount: quotes.length,
          requiredInstrumentsFound: found,
          requiredInstrumentsMissing: ["ES", "VIX", "US2Y", "US10Y", "DXY"].filter((symbol) => !found.includes(symbol)),
          providerTimestamp: asOf,
          failureReason: secondaryAvailable ? null : "One or more secondary instruments were unavailable.",
        };
        return snapshot;
      } catch (error) {
        const category: SafeFailureCategory = error instanceof Error && error.name === "AbortError"
          ? "timeout"
          : error instanceof SafeProviderFailure
            ? error.category
            : "invalid_response";
        logger("market-provider:failure", { provider: FINANCIAL_MODELING_PREP_PROVIDER_NAME, category });
        diagnostics = {
          ...diagnostics,
          resultCategory: category,
          httpStatusCategory: aggregateStatusCategory(endpointStatusCategories),
          endpointStatusCategories: { ...endpointStatusCategories },
          schemaRecognized: false,
          failureReason: category.replaceAll("_", " "),
        };
        throw new Error(category === "timeout" ? "FMP request timed out" : `FMP provider failure: ${category}`);
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
