import assert from "node:assert/strict";
import test from "node:test";
import { LiveMarketGateway } from "../app/lib/live-market-gateway.ts";
import {
  createFinancialModelingPrepAdapter,
  FINANCIAL_MODELING_PREP_PROVIDER_NAME,
} from "../app/lib/providers/financial-modeling-prep.ts";
import { getTerminalMarketData } from "../app/terminal/lib/terminal-market-data-provider.ts";

const TEST_BASE_URL = "https://provider.invalid/stable/";
const TEST_API_KEY = "non-secret-test-value";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

function createMockFetch(asOf: string) {
  const timestamp = Date.parse(asOf) / 1000;
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.has("apikey"), false);
    assert.equal(new Headers(init?.headers).get("apikey"), TEST_API_KEY);
    if (url.pathname.endsWith("/treasury-rates")) {
      return jsonResponse([{ date: asOf, year2: 4.18, year10: 4.42 }]);
    }
    const symbol = url.searchParams.get("symbol");
    const prices: Record<string, number> = { ESUSD: 6325.5, "^VIX": 15.88, "DX-Y.NYB": 98.12 };
    const price = symbol ? prices[symbol] : undefined;
    return jsonResponse([{ symbol, price, change: 1, changesPercentage: 0.25, timestamp }]);
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

test("lets the gateway reject stale FMP data and activate fallback", async () => {
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
  assert.deepEqual(snapshot.quotes, []);
  assert.equal(gateway.getStatus().fallbackActive, true);
});

test("rejects malformed or incomplete FMP responses", async () => {
  const adapter = createFinancialModelingPrepAdapter({
    apiKey: TEST_API_KEY,
    baseUrl: TEST_BASE_URL,
    fetchImpl: async () => jsonResponse([{ unexpected: true }]),
  });

  await assert.rejects(adapter.fetchSnapshot(), /market data request failed/);
});

test("rejects materially future-dated FMP responses", async () => {
  const adapter = createFinancialModelingPrepAdapter({
    apiKey: TEST_API_KEY,
    baseUrl: TEST_BASE_URL,
    fetchImpl: createMockFetch(new Date(Date.now() + 2 * 60_000).toISOString()),
  });

  await assert.rejects(adapter.fetchSnapshot(), /market data request failed/);
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

test("supports environment-provided symbol overrides without changing the generic snapshot", async () => {
  const asOf = new Date(Date.now() - 60_000).toISOString();
  const timestamp = Date.parse(asOf) / 1000;
  const requestedSymbols: string[] = [];
  const adapter = createFinancialModelingPrepAdapter({
    apiKey: TEST_API_KEY,
    baseUrl: TEST_BASE_URL,
    symbols: { sp500Futures: "CUSTOM_ES" },
    fetchImpl: async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/treasury-rates")) return jsonResponse([{ date: asOf, year2: 4.18, year10: 4.42 }]);
      const symbol = url.searchParams.get("symbol")!;
      requestedSymbols.push(symbol);
      return jsonResponse([{ symbol, price: 100, change: 0, changesPercentage: 0, timestamp }]);
    },
  });

  const snapshot = await adapter.fetchSnapshot();
  assert.ok(snapshot);
  assert.ok(requestedSymbols.includes("CUSTOM_ES"));
  assert.equal(snapshot.quotes[0]?.symbol, "ES");
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
  } finally {
    if (previous.provider === undefined) delete process.env.MARKET_DATA_PROVIDER;
    else process.env.MARKET_DATA_PROVIDER = previous.provider;
    if (previous.apiKey === undefined) delete process.env.FMP_API_KEY;
    else process.env.FMP_API_KEY = previous.apiKey;
    if (previous.baseUrl === undefined) delete process.env.FMP_API_BASE_URL;
    else process.env.FMP_API_BASE_URL = previous.baseUrl;
  }
});
