import assert from "node:assert/strict";
import test from "node:test";
import { LiveMarketGateway } from "../app/lib/live-market-gateway.ts";
import {
  createFinancialModelingPrepAdapter,
  DEFAULT_FINANCIAL_MODELING_PREP_BASE_URL,
  FINANCIAL_MODELING_PREP_PROVIDER_NAME,
} from "../app/lib/providers/financial-modeling-prep.ts";
import { analyzeMarketSnapshot } from "../app/lib/market-intelligence-engine.ts";
import { createTradingDecision } from "../app/lib/trading-decision-engine.ts";
import { createTerminalMarketDataProvider, getTerminalMarketData } from "../app/terminal/lib/terminal-market-data-provider.ts";

const TEST_BASE_URL = "https://provider.invalid/stable/?region=us&format=json";
const TEST_API_KEY = crypto.randomUUID();

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

function createMockFetch(asOf: string) {
  const timestamp = Date.parse(asOf) / 1000;
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get("apikey") === TEST_API_KEY, true);
    if (url.pathname.endsWith("/economic-calendar")) {
      return jsonResponse([]);
    }
    assert.equal(url.searchParams.get("region"), "us");
    assert.equal(url.searchParams.get("format"), "json");
    assert.equal(new Headers(init?.headers).has("apikey"), false);
    if (url.pathname.endsWith("/treasury-rates")) {
      return jsonResponse([{ date: asOf, year2: 4.18, year10: 4.42 }]);
    }
    const symbol = url.searchParams.get("symbol");
    const prices: Record<string, number> = { ESUSD: 6325.5, "^VIX": 15.88, "DX-Y.NYB": 98.12 };
    const price = symbol ? prices[symbol] : undefined;
    return jsonResponse([{
      symbol,
      name: symbol === "DX-Y.NYB" ? "US Dollar Index" : undefined,
      exchange: symbol === "DX-Y.NYB" ? "INDEX" : undefined,
      price,
      change: 1,
      changesPercentage: 0.25,
      timestamp,
    }]);
  };
}

test("maps a valid mocked FMP response into the generic market snapshot", async () => {
  const asOf = new Date(Date.now() - 60_000).toISOString();
  const adapter = createFinancialModelingPrepAdapter({
    apiKey: TEST_API_KEY,
    baseUrl: TEST_BASE_URL,
    fetchImpl: createMockFetch(asOf),
  });

  const snapshot = await adapter.fetchSnapshot();
  assert.ok(snapshot);
  assert.equal(snapshot.status, "LIVE");
  assert.equal(snapshot.source, FINANCIAL_MODELING_PREP_PROVIDER_NAME);
  assert.equal(snapshot.asOf, asOf);
  assert.deepEqual(snapshot.quotes.map((quote) => quote.symbol), ["ES", "VIX", "US2Y", "US10Y", "DXY"]);
  assert.equal(snapshot.quotes.find((quote) => quote.symbol === "ES")?.value, "6,325.50");
  assert.equal(snapshot.quotes.find((quote) => quote.symbol === "US2Y")?.value, "4.18%");
  assert.deepEqual(snapshot.events, []);
});

test("normalizes numeric strings, nested quote data, and ISO provider timestamps", async () => {
  const asOf = new Date(Date.now() - 60_000).toISOString();
  const adapter = createFinancialModelingPrepAdapter({
    apiKey: TEST_API_KEY,
    baseUrl: TEST_BASE_URL,
    fetchImpl: async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/treasury-rates")) {
        return jsonResponse({ data: [{ date: asOf, year2: "4.18", year10: "4.42" }] });
      }
      const symbol = url.searchParams.get("symbol");
      return jsonResponse({
        data: {
          quotes: [{
            symbol,
            name: symbol === "DX-Y.NYB" ? "US Dollar Index" : undefined,
            exchange: symbol === "DX-Y.NYB" ? "INDEX" : undefined,
            price: "6,325.50",
            change: "1.25",
            changePercentage: "0.25",
            lastUpdated: asOf,
          }],
        },
      });
    },
  });

  const snapshot = await adapter.fetchSnapshot();
  assert.ok(snapshot);
  assert.equal(snapshot.status, "LIVE");
  assert.equal(snapshot.asOf, asOf);
  assert.equal(snapshot.quotes[0]?.value, "6,325.50");
  assert.equal(snapshot.quotes[0]?.change, "+0.25%");
  assert.deepEqual(adapter.getDiagnostics?.().requiredInstrumentsMissing, []);
});

test("accepts a canonical provider alias only for a single scoped quote record", async () => {
  const asOf = new Date(Date.now() - 60_000).toISOString();
  const timestamp = Date.parse(asOf) / 1000;
  const adapter = createFinancialModelingPrepAdapter({
    apiKey: TEST_API_KEY,
    baseUrl: TEST_BASE_URL,
    fetchImpl: async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/treasury-rates")) {
        return jsonResponse([{ date: asOf, year2: 4.18, year10: 4.42 }]);
      }
      const requested = url.searchParams.get("symbol");
      return jsonResponse([{
        symbol: requested === "DX-Y.NYB" ? requested : `CANONICAL:${requested}`,
        name: requested === "DX-Y.NYB" ? "US Dollar Index" : undefined,
        exchange: requested === "DX-Y.NYB" ? "INDEX" : undefined,
        price: 100,
        change: 1,
        changePercentage: 0.25,
        timestamp,
      }]);
    },
  });

  const snapshot = await adapter.fetchSnapshot();
  assert.ok(snapshot);
  assert.deepEqual(snapshot.quotes.map((quote) => quote.symbol), ["ES", "VIX", "US2Y", "US10Y", "DXY"]);
  assert.equal(adapter.getDiagnostics?.().schemaRecognized, true);
  assert.equal(adapter.getDiagnostics?.().httpStatusCategory, "success");
});

test("accepts the authenticated FMP US Dollar Index schema and rejects the unrelated USDXUSD crypto asset", async () => {
  const asOf = new Date(Date.now() - 60_000).toISOString();
  const timestamp = Date.parse(asOf) / 1000;
  const quote = {
    symbol: "DX-Y.NYB",
    name: "US Dollar Index",
    price: 100.825,
    change: 0.06,
    changesPercentage: 0.05954448,
    timestamp,
    exchange: "INDEX",
  };
  const validAdapter = createFinancialModelingPrepAdapter({
    apiKey: TEST_API_KEY,
    baseUrl: TEST_BASE_URL,
    fetchImpl: async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/treasury-rates")) {
        return jsonResponse([{ date: asOf, year2: 4.18, year10: 4.42 }]);
      }
      const symbol = url.searchParams.get("symbol");
      if (symbol === "DX-Y.NYB") return jsonResponse([quote]);
      return jsonResponse([{ symbol, price: 100, change: 1, changesPercentage: 0.25, timestamp }]);
    },
  });

  const validSnapshot = await validAdapter.fetchSnapshot();
  assert.ok(validSnapshot);
  assert.equal(validSnapshot.quotes.find(({ symbol }) => symbol === "DXY")?.value, "100.83");

  const cryptoAdapter = createFinancialModelingPrepAdapter({
    apiKey: TEST_API_KEY,
    baseUrl: TEST_BASE_URL,
    symbols: { usDollarIndex: "USDXUSD" },
    fetchImpl: async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/treasury-rates")) {
        return jsonResponse([{ date: asOf, year2: 4.18, year10: 4.42 }]);
      }
      const symbol = url.searchParams.get("symbol");
      if (symbol === "USDXUSD") {
        return jsonResponse([{
          symbol,
          name: "USDX [Lighthouse] USD",
          price: 0.65831,
          change: 0,
          changesPercentage: 0,
          timestamp,
          exchange: "CRYPTO",
        }]);
      }
      return jsonResponse([{ symbol, price: 100, change: 1, changesPercentage: 0.25, timestamp }]);
    },
  });

  const cryptoSnapshot = await cryptoAdapter.fetchSnapshot();
  assert.ok(cryptoSnapshot);
  assert.equal(cryptoSnapshot.quotes.some(({ symbol }) => symbol === "DXY"), false);
  assert.equal(cryptoAdapter.getDiagnostics?.().requiredInstrumentsMissing.includes("DXY"), true);
});

test("keeps endpoint HTTP categories sanitized when secondary access is restricted", async () => {
  const asOf = new Date(Date.now() - 60_000).toISOString();
  const timestamp = Date.parse(asOf) / 1000;
  const adapter = createFinancialModelingPrepAdapter({
    apiKey: TEST_API_KEY,
    baseUrl: TEST_BASE_URL,
    fetchImpl: async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/treasury-rates")) {
        return jsonResponse([{ date: asOf, year2: 4.18, year10: 4.42 }]);
      }
      const symbol = url.searchParams.get("symbol");
      if (symbol === "DX-Y.NYB") return new Response(null, { status: 402 });
      return jsonResponse([{ symbol: `ALIAS:${symbol}`, price: 100, change: 1, changePercentage: 0.25, timestamp }]);
    },
  });

  const snapshot = await adapter.fetchSnapshot();
  assert.ok(snapshot);
  assert.deepEqual(snapshot.quotes.map((quote) => quote.symbol), ["ES", "VIX", "US2Y", "US10Y"]);
  assert.equal(adapter.getDiagnostics?.().resultCategory, "partial_success");
  assert.equal(adapter.getDiagnostics?.().httpStatusCategory, "mixed");
  assert.equal(adapter.getDiagnostics?.().endpointStatusCategories.usDollarIndex, "access_restricted");
  assert.equal(JSON.stringify(adapter.getDiagnostics?.()).includes(TEST_API_KEY), false);
});

test("lets the gateway classify a valid older provider response as delayed", async () => {
  const now = Date.now();
  const adapter = createFinancialModelingPrepAdapter({
    apiKey: TEST_API_KEY,
    baseUrl: TEST_BASE_URL,
    fetchImpl: createMockFetch(new Date(now - 10 * 60_000).toISOString()),
  });
  const gateway = new LiveMarketGateway({
    provider: adapter,
    providerName: FINANCIAL_MODELING_PREP_PROVIDER_NAME,
    maxRetries: 0,
    logger: () => undefined,
  });

  const snapshot = await gateway.fetchSnapshot(now);
  assert.equal(snapshot.status, "DELAYED");
  assert.equal(gateway.getStatus().connectionStatus, "degraded");
  assert.equal(gateway.getStatus().dataClassification, "delayed");
});

test("rejects an empty provider quote response without fabricating values", async () => {
  const adapter = createFinancialModelingPrepAdapter({
    apiKey: TEST_API_KEY,
    baseUrl: TEST_BASE_URL,
    fetchImpl: async () => jsonResponse({ data: { quotes: [] } }),
  });

  await assert.rejects(adapter.fetchSnapshot(), /invalid_response/);
  assert.equal(adapter.getDiagnostics?.().quoteCount, 0);
  assert.equal(adapter.getDiagnostics?.().schemaRecognized, false);
});

test("rejects a malformed provider timestamp", async () => {
  const adapter = createFinancialModelingPrepAdapter({
    apiKey: TEST_API_KEY,
    baseUrl: TEST_BASE_URL,
    fetchImpl: async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/treasury-rates")) {
        return jsonResponse([{ date: new Date().toISOString(), year2: 4.18, year10: 4.42 }]);
      }
      const symbol = url.searchParams.get("symbol");
      return jsonResponse([{ symbol, price: 100, change: 0, changesPercentage: 0, timestamp: "not-a-time" }]);
    },
  });

  await assert.rejects(adapter.fetchSnapshot(), /invalid_response/);
});

test("appends query authentication without replacing existing query parameters", async () => {
  const asOf = new Date(Date.now() - 60_000).toISOString();
  const requestedQueries: Array<Record<string, string>> = [];
  const mockFetch = createMockFetch(asOf);
  const adapter = createFinancialModelingPrepAdapter({
    apiKey: TEST_API_KEY,
    baseUrl: TEST_BASE_URL,
    fetchImpl: async (input, init) => {
      const url = new URL(String(input));
      requestedQueries.push(Object.fromEntries(url.searchParams));
      return mockFetch(input, init);
    },
  });

  await adapter.fetchSnapshot();
  assert.equal(requestedQueries.length, 5);
  assert.equal(requestedQueries.every((query) => query.apikey === TEST_API_KEY), true);
  assert.equal(requestedQueries.filter((query) => query.region === "us" && query.format === "json").length, 4);
  assert.equal(requestedQueries.filter((query) => query.symbol).length, 3);
  assert.equal(requestedQueries.some((query) => query.from && query.to), true);
});

test("defaults the FMP base URL when FMP_API_BASE_URL is missing", async () => {
  const asOf = new Date(Date.now() - 60_000).toISOString();
  const requestedUrls: URL[] = [];
  const timestamp = Date.parse(asOf) / 1000;
  const adapter = createFinancialModelingPrepAdapter({
    apiKey: TEST_API_KEY,
    fetchImpl: async (input) => {
      const url = new URL(String(input));
      requestedUrls.push(url);
      if (url.pathname.endsWith("/treasury-rates")) {
        return jsonResponse([{ date: asOf, year2: 4.18, year10: 4.42 }]);
      }
      if (url.pathname.endsWith("/economic-calendar")) {
        return jsonResponse([]);
      }
      const symbol = url.searchParams.get("symbol");
      return jsonResponse([{ symbol, price: 100, change: 0, changesPercentage: 0, timestamp }]);
    },
  });

  const snapshot = await adapter.fetchSnapshot();
  assert.equal(snapshot?.status, "LIVE");
  assert.equal(requestedUrls.length, 5);
  assert.equal(requestedUrls.every((url) => url.origin === new URL(DEFAULT_FINANCIAL_MODELING_PREP_BASE_URL).origin), true);
  assert.equal(requestedUrls.every((url) => url.pathname.startsWith("/stable/")), true);
});

test("configures the terminal FMP provider when only the optional base URL is absent", () => {
  const previous = {
    provider: process.env.MARKET_DATA_PROVIDER,
    apiKey: process.env.FMP_API_KEY,
    baseUrl: process.env.FMP_API_BASE_URL,
  };
  process.env.MARKET_DATA_PROVIDER = "fmp";
  process.env.FMP_API_KEY = TEST_API_KEY;
  delete process.env.FMP_API_BASE_URL;
  try {
    assert.ok(createTerminalMarketDataProvider());
  } finally {
    if (previous.provider === undefined) delete process.env.MARKET_DATA_PROVIDER;
    else process.env.MARKET_DATA_PROVIDER = previous.provider;
    if (previous.apiKey === undefined) delete process.env.FMP_API_KEY;
    else process.env.FMP_API_KEY = previous.apiKey;
    if (previous.baseUrl === undefined) delete process.env.FMP_API_BASE_URL;
    else process.env.FMP_API_BASE_URL = previous.baseUrl;
  }
});

test("lets the gateway keep aged FMP quotes visible while closing the decision window", async () => {
  const now = Date.now();
  const adapter = createFinancialModelingPrepAdapter({
    apiKey: TEST_API_KEY,
    baseUrl: TEST_BASE_URL,
    fetchImpl: createMockFetch(new Date(now - 31 * 60_000).toISOString()),
  });
  const gateway = new LiveMarketGateway({
    provider: adapter,
    providerName: FINANCIAL_MODELING_PREP_PROVIDER_NAME,
    maxRetries: 0,
    logger: () => undefined,
  });

  const snapshot = await gateway.fetchSnapshot(now);
  assert.equal(snapshot.status, "UNAVAILABLE");
  assert.ok(snapshot.quotes.length > 0);
  assert.match(snapshot.source, /previous session/i);
  assert.equal(gateway.getStatus().fallbackActive, false);
  assert.equal(gateway.getStatus().dataClassification, "stale");
});

test("does not let a current date-only Treasury observation stale intraday quotes", async () => {
  const now = new Date();
  const quoteAsOf = new Date(now.getTime() - 60_000).toISOString();
  const treasuryDate = now.toISOString().slice(0, 10);
  const quoteTimestamp = Date.parse(quoteAsOf) / 1000;
  const adapter = createFinancialModelingPrepAdapter({
    apiKey: TEST_API_KEY,
    baseUrl: TEST_BASE_URL,
    fetchImpl: async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/treasury-rates")) {
        return jsonResponse([{ date: treasuryDate, year2: 4.18, year10: 4.42 }]);
      }
      const symbol = url.searchParams.get("symbol");
      return jsonResponse([{ symbol, price: 100, change: 0, changesPercentage: 0, timestamp: quoteTimestamp }]);
    },
  });
  const gateway = new LiveMarketGateway({
    provider: adapter,
    providerName: FINANCIAL_MODELING_PREP_PROVIDER_NAME,
    maxRetries: 0,
    logger: () => undefined,
  });

  const snapshot = await gateway.fetchSnapshot(now.getTime());
  assert.equal(snapshot.status, "LIVE");
  assert.equal(snapshot.asOf, quoteAsOf);
  assert.equal(gateway.getStatus().fallbackActive, false);
});

test("marks excessively old Treasury observations unavailable while preserving a current S&P quote", async () => {
  const quoteAsOf = new Date(Date.now() - 60_000).toISOString();
  const quoteTimestamp = Date.parse(quoteAsOf) / 1000;
  const staleTreasuryDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const adapter = createFinancialModelingPrepAdapter({
    apiKey: TEST_API_KEY,
    baseUrl: TEST_BASE_URL,
    fetchImpl: async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/treasury-rates")) {
        return jsonResponse([{ date: staleTreasuryDate, year2: 4.18, year10: 4.42 }]);
      }
      const symbol = url.searchParams.get("symbol");
      return jsonResponse([{ symbol, price: 100, change: 0, changesPercentage: 0, timestamp: quoteTimestamp }]);
    },
  });

  const snapshot = await adapter.fetchSnapshot();
  assert.equal(snapshot?.status, "LIVE");
  assert.ok(snapshot?.quotes.some((quote) => quote.symbol === "ES"));
  assert.equal(snapshot?.quotes.some((quote) => quote.symbol === "US2Y"), false);
  assert.equal(snapshot?.quotes.some((quote) => quote.symbol === "US10Y"), false);
});

test("keeps a valid S&P quote when secondary FMP responses are unavailable and fails trading conclusions closed", async () => {
  const asOf = new Date(Date.now() - 60_000).toISOString();
  const timestamp = Date.parse(asOf) / 1000;
  const messages: Array<{ message: string; details?: Record<string, unknown> }> = [];
  const adapter = createFinancialModelingPrepAdapter({
    apiKey: TEST_API_KEY,
    baseUrl: TEST_BASE_URL,
    logger: (message, details) => messages.push({ message, details }),
    fetchImpl: async (input) => {
      const url = new URL(String(input));
      if (url.searchParams.get("symbol") === "ESUSD") {
        return jsonResponse([{ symbol: "ESUSD", price: 6325.5, change: 1, changesPercentage: 0.25, timestamp }]);
      }
      return jsonResponse([{ unavailable: true }]);
    },
  });

  const snapshot = await adapter.fetchSnapshot();
  assert.ok(snapshot);
  assert.equal(snapshot.status, "LIVE");
  assert.deepEqual(snapshot.quotes.map((quote) => quote.symbol), ["ES"]);
  assert.equal(messages.filter(({ details }) => details?.category === "invalid_response").length, 3);

  const intelligence = analyzeMarketSnapshot(snapshot);
  const decision = createTradingDecision({
    intelligence,
    reasoning: intelligence.reasoning,
    dataStatus: snapshot.status,
    providerStatus: "connected",
    dataAgeMs: 60_000,
    fallbackActive: false,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  assert.equal(decision.tradePermission, "no-trade");
  assert.ok(decision.dataQualityWarnings.some((warning) => warning.code === "MISSING_QUOTE" && warning.field === "VIX"));
});

test("rejects malformed or incomplete FMP responses", async () => {
  const adapter = createFinancialModelingPrepAdapter({
    apiKey: TEST_API_KEY,
    baseUrl: TEST_BASE_URL,
    fetchImpl: async () => jsonResponse([{ unexpected: true }]),
  });

  await assert.rejects(adapter.fetchSnapshot(), /invalid_response/);
});

test("rejects materially future-dated FMP responses", async () => {
  const adapter = createFinancialModelingPrepAdapter({
    apiKey: TEST_API_KEY,
    baseUrl: TEST_BASE_URL,
    fetchImpl: createMockFetch(new Date(Date.now() + 2 * 60_000).toISOString()),
  });

  await assert.rejects(adapter.fetchSnapshot(), /invalid_response/);
});

test("times out FMP requests and logs only safe metadata", async () => {
  const logEntries: Array<{ message: string; details?: Record<string, unknown> }> = [];
  const adapter = createFinancialModelingPrepAdapter({
    apiKey: TEST_API_KEY,
    baseUrl: TEST_BASE_URL,
    timeoutMs: 5,
    logger: (message, details) => logEntries.push({ message, details }),
    fetchImpl: async (_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }),
  });

  await assert.rejects(adapter.fetchSnapshot(), /timed out/);
  const serializedLogs = JSON.stringify(logEntries);
  assert.equal(serializedLogs.includes(TEST_API_KEY), false);
  assert.equal(serializedLogs.includes(TEST_BASE_URL), false);
  assert.match(serializedLogs, /timeout/);
});

test("classifies authentication rejection without exposing credentials", async () => {
  const logs: unknown[] = [];
  const adapter = createFinancialModelingPrepAdapter({
    apiKey: TEST_API_KEY,
    baseUrl: TEST_BASE_URL,
    logger: (message, details) => logs.push({ message, details }),
    fetchImpl: async () => jsonResponse({ "Error Message": "credential value must remain private" }, 401),
  });
  await assert.rejects(adapter.fetchSnapshot(), /authentication_rejected/);
  const serializedLogs = JSON.stringify(logs);
  assert.equal(serializedLogs.includes(TEST_API_KEY), false);
  assert.equal(serializedLogs.includes(TEST_BASE_URL), false);
  assert.equal(serializedLogs.includes("credential value must remain private"), false);
  const responseLogs = logs.filter((entry): entry is {
    message: string;
    details: Record<string, unknown>;
  } => (
    typeof entry === "object" &&
    entry !== null &&
    "message" in entry &&
    entry.message === "market-provider:response" &&
    "details" in entry &&
    typeof entry.details === "object" &&
    entry.details !== null
  ));
  assert.equal(responseLogs.length, 4);
  assert.deepEqual(responseLogs.map(({ details }) => details.endpointName), [
    "ES futures",
    "VIX",
    "US Dollar Index",
    "Treasury rates",
  ]);
  assert.deepEqual(responseLogs[0]?.details, {
    endpointName: "ES futures",
    httpStatus: 401,
    payloadType: "object",
    recordCount: 1,
    topLevelFieldNames: ["Error Message"],
    schemaMismatch: "no quote records found",
  });
});

test("classifies rate limiting as a retry-safe provider failure", async () => {
  const adapter = createFinancialModelingPrepAdapter({ apiKey: TEST_API_KEY, baseUrl: TEST_BASE_URL, fetchImpl: async () => jsonResponse({}, 429) });
  await assert.rejects(adapter.fetchSnapshot(), /rate_limited/);
});

test("isolates access-restricted secondary instruments without exposing symbols or credentials", async () => {
  const messages: Array<{ message: string; details?: Record<string, unknown> }> = [];
  const asOf = new Date(Date.now() - 60_000).toISOString();
  const mockFetch = createMockFetch(asOf);
  const provider = createFinancialModelingPrepAdapter({
    apiKey: TEST_API_KEY,
    baseUrl: TEST_BASE_URL,
    fetchImpl: async (input, init) => {
      const url = new URL(String(input));
      if (url.searchParams.get("symbol") === "DX-Y.NYB") return new Response("restricted", { status: 402 });
      return mockFetch(input, init);
    },
    logger(message, details) { messages.push({ message, details }); },
  });

  const snapshot = await provider.fetchSnapshot();
  assert.ok(snapshot);
  assert.equal(snapshot.status, "LIVE");
  assert.ok(snapshot.quotes.some((quote) => quote.symbol === "ES"));
  assert.equal(snapshot.quotes.some((quote) => quote.symbol === "DXY"), false);
  assert.deepEqual(messages.find(({ details }) => details?.category === "access_restricted")?.details, {
    provider: FINANCIAL_MODELING_PREP_PROVIDER_NAME,
    category: "access_restricted",
    instrument: "us_dollar",
  });
  assert.doesNotMatch(JSON.stringify(messages), /DX-Y\.NYB/);
  assert.equal(JSON.stringify(messages).includes(TEST_API_KEY), false);
});

test("rejects malformed JSON using a sanitized failure category", async () => {
  const adapter = createFinancialModelingPrepAdapter({ apiKey: TEST_API_KEY, baseUrl: TEST_BASE_URL, fetchImpl: async () => new Response("not-json", { status: 200, headers: { "content-type": "application/json" } }) });
  await assert.rejects(adapter.fetchSnapshot(), /malformed_json/);
});

test("classifies network interruption without leaking raw provider errors", async () => {
  const rawMessage = `socket failed ${TEST_API_KEY}`;
  const adapter = createFinancialModelingPrepAdapter({ apiKey: TEST_API_KEY, baseUrl: TEST_BASE_URL, fetchImpl: async () => { throw new Error(rawMessage); } });
  await assert.rejects(adapter.fetchSnapshot(), (error: Error) => !error.message.includes(TEST_API_KEY) && /network_interruption/.test(error.message));
});

test("supports environment-provided S&P 500 symbol overrides with accurate presentation", async () => {
  const asOf = new Date(Date.now() - 60_000).toISOString();
  const timestamp = Date.parse(asOf) / 1000;
  const requestedSymbols: string[] = [];
  const adapter = createFinancialModelingPrepAdapter({
    apiKey: TEST_API_KEY,
    baseUrl: TEST_BASE_URL,
    symbols: { sp500Futures: "SPY" },
    fetchImpl: async (input) => {
      const url = new URL(String(input));
      assert.equal(url.searchParams.get("apikey") === TEST_API_KEY, true);
      if (url.pathname.endsWith("/treasury-rates")) return jsonResponse([{ date: asOf, year2: 4.18, year10: 4.42 }]);
      if (url.pathname.endsWith("/economic-calendar")) return jsonResponse([]);
      const symbol = url.searchParams.get("symbol")!;
      requestedSymbols.push(symbol);
      return jsonResponse([{ symbol, price: 100, change: 0, changesPercentage: 0, timestamp }]);
    },
  });

  const snapshot = await adapter.fetchSnapshot();
  assert.ok(snapshot);
  assert.ok(requestedSymbols.includes("SPY"));
  assert.equal(snapshot.quotes[0]?.symbol, "SPY");
  assert.equal(snapshot.quotes[0]?.label, "S&P 500 ETF");
});

test("keeps the terminal fallback unconfigured when FMP credentials are absent", async () => {
  const previous = {
    provider: process.env.MARKET_DATA_PROVIDER,
    apiKey: process.env.FMP_API_KEY,
    baseUrl: process.env.FMP_API_BASE_URL,
  };
  process.env.MARKET_DATA_PROVIDER = "fmp";
  delete process.env.FMP_API_KEY;
  delete process.env.FMP_API_BASE_URL;
  try {
    const result = await getTerminalMarketData(undefined, Date.parse("2026-07-16T12:00:00.000Z"));
    assert.equal(result.snapshot.status, "UNAVAILABLE");
    assert.deepEqual(result.snapshot.quotes, []);
    assert.equal(result.gatewayStatus.connectionStatus, "not_configured");
    assert.equal(result.gatewayStatus.fallbackActive, true);
    assert.equal(result.cache.status, "disabled");
    assert.equal(result.cache.providerLoads, 0);
  } finally {
    if (previous.provider === undefined) delete process.env.MARKET_DATA_PROVIDER;
    else process.env.MARKET_DATA_PROVIDER = previous.provider;
    if (previous.apiKey === undefined) delete process.env.FMP_API_KEY;
    else process.env.FMP_API_KEY = previous.apiKey;
    if (previous.baseUrl === undefined) delete process.env.FMP_API_BASE_URL;
    else process.env.FMP_API_BASE_URL = previous.baseUrl;
  }
});
