import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { aggregateCandles, candleReferenceLevels, candleSessionStats, exponentialMovingAverage, volumeWeightedAveragePrice } from "../app/dashboard/lib/candle-analysis.ts";
import { determineCandleFreshness, loadFmpCandles, normalizeFmpCandles } from "../app/lib/providers/financial-modeling-prep-candles.ts";

const base = 1_800_000_000;
const candle = (time: number, close: number, volume = 10) => ({ time, open: close - 1, high: close + 1, low: close - 2, close, volume });

test("FMP candles are validated, deduplicated, ordered and limited", () => {
  const payload = [
    { timestamp: base + 600, open: 102, high: 104, low: 101, close: 103, volume: 4 },
    { timestamp: base, open: 99, high: 101, low: 98, close: 100, volume: 3 },
    { timestamp: base, open: 100, high: 102, low: 99, close: 101, volume: 5 },
    { timestamp: base + 300, open: "bad", high: 103, low: 99, close: 102, volume: 3 },
  ];
  const result = normalizeFmpCandles(payload, 2);
  assert.deepEqual(result.map(({ time, close }) => ({ time, close })), [{ time: base, close: 101 }, { time: base + 600, close: 103 }]);
});

test("normalization preserves missing intervals and rejects empty or malformed payloads", () => {
  assert.deepEqual(normalizeFmpCandles({ data: [{ date: "invalid", open: 1, high: 2, low: 0, close: 1 }] }), []);
  assert.deepEqual(normalizeFmpCandles([]), []);
  const result = normalizeFmpCandles([{ timestamp: base, open: 99, high: 101, low: 98, close: 100, volume: 10 }, { timestamp: base + 900, open: 101, high: 103, low: 100, close: 102, volume: 10 }]);
  assert.deepEqual(result.map((item) => item.time), [base, base + 900]);
});

test("freshness never infers live status from a successful candle response", () => {
  const candles = [candle(base, 100)];
  assert.equal(determineCandleFreshness(candles, base * 1000 + 9 * 60_000).status, "delayed");
  assert.equal(determineCandleFreshness(candles, base * 1000 + 30 * 60_000).status, "delayed");
  assert.equal(determineCandleFreshness(candles, base * 1000 + 61 * 60_000).status, "previous_session");
  assert.equal(determineCandleFreshness(candles, base * 1000 + 20 * 60 * 60_000).status, "market_closed");
  assert.equal(determineCandleFreshness(candles, base * 1000 - 1).status, "unavailable");
  assert.equal(determineCandleFreshness([], base * 1000).status, "unavailable");
});

test("provider failures remain fail closed and contract labels remain exact", async () => {
  const unavailable = await loadFmpCandles({ apiKey: "configured", symbol: "ESUSD", fetchImpl: async () => new Response(JSON.stringify({ error: "restricted" }), { status: 402 }) });
  assert.equal(unavailable.status, "unavailable");
  assert.equal(unavailable.failureCategory, "entitlement");
  assert.equal(unavailable.symbol, "ESUSD");
  assert.equal(unavailable.instrumentName, "S&P 500 futures reference series");
  assert.match(unavailable.contract, /S&P 500 futures reference series/i);
  assert.match(unavailable.exchange, /delayed provider series/i);
  assert.deepEqual(unavailable.candles, []);
});

test("provider response returns verified schema without exposing its credential", async () => {
  let requested = "";
  const result = await loadFmpCandles({ apiKey: "do-not-expose", symbol: "ESUSD", timeframe: "5m", now: (base + 300) * 1000, fetchImpl: async (input) => { requested = String(input); return new Response(JSON.stringify([{ timestamp: base, open: 99, high: 101, low: 98, close: 100, volume: 10 }]), { status: 200 }); } });
  assert.equal(result.symbol, "ESUSD");
  assert.equal(result.status, "delayed");
  assert.match(requested, /historical-chart\/5min/);
  assert.equal(JSON.stringify(result).includes("do-not-expose"), false);
});

test("15-minute and hourly candles use UTC boundaries, chronological order and preserve missing intervals", () => {
  const candles = Array.from({ length: 12 }, (_, index) => candle(base + index * 300, 100 + index, index + 1));
  candles.splice(4, 1);
  candles.reverse();
  const fifteen = aggregateCandles(candles, "15m");
  const hourly = aggregateCandles(candles, "1h");
  assert.equal(fifteen.length, 4);
  assert.equal(hourly.length, 1);
  assert.ok(fifteen.every((item) => item.time % 900 === 0));
  assert.equal(fifteen.reduce((sum, item) => sum + item.volume, 0), candles.reduce((sum, item) => sum + item.volume, 0));
  assert.equal(hourly[0]?.open, 99);
  assert.equal(hourly[0]?.close, 111);
  assert.equal(hourly[0]?.volume, 73);
});

test("EMA, VWAP and rolling 24-hour labels use deduplicated chronological candles", () => {
  const candles = [candle(base + 600, 104, 30), candle(base, 100, 10), candle(base + 300, 102, 20), candle(base + 300, 102, 20)];
  assert.deepEqual(exponentialMovingAverage(candles, 2).map((item) => Number(item.value.toFixed(2))), [101, 103]);
  assert.deepEqual(volumeWeightedAveragePrice(candles).map((item) => Number(item.value.toFixed(2))), [99.67, 101, 102.33]);
  const stats = candleSessionStats(candles);
  assert.equal(stats?.high, 105);
  assert.equal(stats?.low, 98);
  assert.equal(stats?.firstAvailableClose, 100);
  assert.deepEqual(candleReferenceLevels(candles).map((level) => level.label), ["24h high", "24h low", "First available close"]);
});

test("FMP market-time strings are converted from New York time with DST, never host-local time", () => {
  const payload = [{ date: "2026-07-21 10:00:00", open: 99, high: 101, low: 98, close: 100, volume: 10 }];
  assert.equal(normalizeFmpCandles(payload)[0]?.time, Date.parse("2026-07-21T14:00:00Z") / 1000);
  assert.equal(normalizeFmpCandles([{ ...payload[0], date: "2026-01-21 10:00:00" }])[0]?.time, Date.parse("2026-01-21T15:00:00Z") / 1000);
  assert.equal(normalizeFmpCandles([{ ...payload[0], date: "2026-07-21T10:00:00Z" }]).length, 1);
});

test("dashboard chart calls only the protected candle route on an explicit control action", async () => {
  const [chart, page, loading] = await Promise.all([
    readFile(new URL("../app/dashboard/components/DashboardCandlestickChart.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/loading.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(chart, /fetch\(`\/api\/market\/candles\?timeframe=/);
  assert.match(chart, /setInterval/);
  assert.doesNotMatch(chart, /financialmodelingprep\.com/);
  assert.match(chart, /aria-label="Candlestick interval"/);
  assert.match(chart, /aria-label="Chart overlays"/);
  assert.match(chart, /Verified .*candlestick history|structurally valid OHLCV/);
  assert.match(chart, /HistogramSeries/);
  assert.match(chart, /option\.timeframe !== displayTimeframe|option\.timeframe !== timeframe/);
  assert.doesNotMatch(chart, /Session high|Session low|Previous close/);
  assert.match(chart, /series\.instrumentDetail/);
  assert.match(chart, /series\.status !== "unavailable"/);
  assert.doesNotMatch(chart, /Failure category|requests avoided|cache \{/);
  assert.match(chart, /Previous session|Market closed|never labelled live/);
  assert.match(page, /tier === "pro" \|\| tier === "elite"/);
  assert.match(page, /toCustomerCandleSeries/);
  assert.match(loading, /dashboardChartSkeletonCanvas/);
});

test("documented FMP intervals use their exact upstream endpoint", async () => {
  for (const [timeframe, expected] of [["1m", "1min"], ["5m", "5min"], ["15m", "15min"], ["1h", "1hour"], ["4h", "1hour"], ["1d", "historical-price-eod/full"]] as const) {
    let requested = "";
    const points = Array.from({ length: 8 }, (_, index) => ({ timestamp: base + index * 3600, open: 99 + index, high: 101 + index, low: 98 + index, close: 100 + index, volume: 10 }));
    const now = (base + 7 * 3600) * 1000 + 5 * 60_000;
    const result = await loadFmpCandles({ apiKey: "configured", symbol: "ESUSD", timeframe, now, fetchImpl: async (input) => { requested = String(input); return new Response(JSON.stringify(points)); } });
    assert.match(requested, new RegExp(expected.replaceAll("/", "\\/")));
    assert.equal(result.timeframe, timeframe);
    assert.notEqual(result.status, "unavailable");
    if (timeframe === "1d") assert.equal(result.classification, "end_of_day");
    else assert.ok(["delayed", "previous_session"].includes(result.classification));
    if (timeframe === "4h") {
      assert.ok(result.candles.every((item) => item.time % 14_400 === 0));
      assert.match(result.instrumentDetail, /aggregated from verified 1-hour|UTC/i);
    }
  }
});

test("customer controls expose verified multi-timeframe candle intervals", async () => {
  const [chart, route, terminal, customer, dashboard] = await Promise.all([
    readFile(new URL("../app/dashboard/components/DashboardCandlestickChart.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/market/candles/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/terminal/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/terminal/components/CustomerTerminal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(chart, /timeframe: "1m"[\s\S]*timeframe: "5m"[\s\S]*timeframe: "15m"[\s\S]*timeframe: "1h"[\s\S]*timeframe: "4h"[\s\S]*timeframe: "1d"/);
  assert.match(chart, /pendingTimeframe/);
  assert.match(chart, /previous interval is not shown|previous interval stays hidden/i);
  assert.match(route, /\["1m", "5m", "15m", "1h", "4h", "1d"\]/);
  assert.match(terminal, /DashboardCandlestickChart/);
  assert.match(terminal, /ctChartPrimary/);
  assert.match(terminal, /bullseyeScore/);
  assert.match(customer, /Bullseye Score/);
  assert.doesNotMatch(terminal, /Verified intraday chart unavailable|Bullseye provider diagnostics|WhatChanged/);
  assert.doesNotMatch(dashboard, /Advanced diagnostics|FMP_API_KEY|provider diagnostics/i);
});

test("layout candle fixture normalizes into a delayed series outside production", async () => {
  process.env.BULLSEYE_CANDLE_FIXTURE_PATH = new URL("../fixtures/candles-esusd-5m.json", import.meta.url).pathname;
  delete process.env.FMP_API_KEY;
  const { getConfiguredFmpCandles } = await import("../app/lib/providers/financial-modeling-prep-candles.ts?" + Date.now());
  const series = await getConfiguredFmpCandles("5m");
  assert.ok(series.candles.length > 20);
  assert.notEqual(series.status, "unavailable");
  assert.match(series.instrumentDetail, /layout fixture|not live market data/i);
  delete process.env.BULLSEYE_CANDLE_FIXTURE_PATH;
});

test("layout candle fixture never overrides a configured FMP key outside production", async () => {
  process.env.BULLSEYE_CANDLE_FIXTURE_PATH = new URL("../fixtures/candles-esusd-5m.json", import.meta.url).pathname;
  process.env.FMP_API_KEY = "test-live-key-not-a-placeholder";
  process.env.FMP_API_BASE_URL = "http://127.0.0.1:9/";
  const { getConfiguredFmpCandles } = await import("../app/lib/providers/financial-modeling-prep-candles.ts?" + Date.now());
  const series = await getConfiguredFmpCandles("5m");
  assert.doesNotMatch(series.instrumentDetail, /layout fixture|not live market data/i);
  assert.equal(series.failureCategory, "provider");
  delete process.env.BULLSEYE_CANDLE_FIXTURE_PATH;
  delete process.env.FMP_API_KEY;
  delete process.env.FMP_API_BASE_URL;
});

test("layout candle fixture is blocked on Vercel preview and production Node", async () => {
  process.env.BULLSEYE_CANDLE_FIXTURE_PATH = new URL("../fixtures/candles-esusd-5m.json", import.meta.url).pathname;
  delete process.env.FMP_API_KEY;
  process.env.VERCEL = "1";
  const { getConfiguredFmpCandles } = await import("../app/lib/providers/financial-modeling-prep-candles.ts?" + Date.now());
  const series = await getConfiguredFmpCandles("5m");
  assert.equal(series.status, "unavailable");
  assert.equal(series.failureCategory, "not_configured");
  assert.deepEqual(series.candles, []);
  delete process.env.VERCEL;
  delete process.env.BULLSEYE_CANDLE_FIXTURE_PATH;
});

test("customer candle payloads strip cache internals before browser delivery", async () => {
  const { toCustomerCandleSeries } = await import("../app/lib/providers/financial-modeling-prep-candles.ts");
  const customer = toCustomerCandleSeries({
    status: "delayed",
    asOf: "2026-07-21T12:00:00.000Z",
    dataAgeMs: 60_000,
    classification: "delayed",
    symbol: "ESUSD",
    instrumentName: "S&P 500 futures reference series",
    instrumentDetail: "Verified delayed series",
    contract: "S&P 500 futures reference series",
    exchange: "delayed provider series",
    provider: "Financial Modeling Prep",
    timeframe: "5m",
    candles: [candle(base, 100)],
    cache: { status: "hit", ttlMs: 60_000, requestsAvoided: 3 },
    failureCategory: null,
  });
  assert.equal("cache" in customer, false);
  assert.equal(customer.candles.length, 1);
});

test("candlestick chart keeps the canvas mounted while refreshing", async () => {
  const chart = await readFile(new URL("../app/dashboard/components/DashboardCandlestickChart.tsx", import.meta.url), "utf8");
  assert.match(chart, /dashboardChartCanvas/);
  assert.match(chart, /ResizeObserver/);
  assert.match(chart, /fitContent/);
  assert.match(chart, /dashboardChartLoading/);
  assert.match(chart, /pendingTimeframe/);
  assert.match(chart, /intervalMismatch/);
});

test("four-hour aggregation uses UTC epoch boundaries from verified source candles", async () => {
  const { aggregateFourHour } = await import("../app/lib/providers/financial-modeling-prep-candles.ts");
  const source = [
    candle(base, 100),
    candle(base + 3600, 101),
    candle(base + 7200, 102),
    candle(base + 10_800, 103),
    candle(base + 14_400, 104),
  ];
  const aggregated = aggregateFourHour(source);
  assert.deepEqual(aggregated.map((item) => item.time), [base, base + 14_400]);
  assert.equal(aggregated[0]?.open, 99);
  assert.equal(aggregated[0]?.close, 103);
  assert.equal(aggregated[0]?.high, 104);
  assert.equal(aggregated[0]?.low, 98);
});
