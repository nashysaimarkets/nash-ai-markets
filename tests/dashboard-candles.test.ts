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
  assert.equal(determineCandleFreshness(candles, base * 1000 + 61 * 60_000).status, "stale");
  assert.equal(determineCandleFreshness(candles, base * 1000 - 1).status, "unavailable");
  assert.equal(determineCandleFreshness([], base * 1000).status, "unavailable");
});

test("provider failures remain fail closed and contract labels remain exact", async () => {
  const unavailable = await loadFmpCandles({ apiKey: "configured", symbol: "ESUSD", fetchImpl: async () => new Response(JSON.stringify({ error: "restricted" }), { status: 402 }) });
  assert.equal(unavailable.status, "unavailable");
  assert.equal(unavailable.failureCategory, "entitlement");
  assert.equal(unavailable.symbol, "ESUSD");
  assert.equal(unavailable.instrumentName, "S&P 500 futures reference series");
  assert.match(unavailable.contract, /no dated contract/i);
  assert.match(unavailable.exchange, /not verified/i);
  assert.deepEqual(unavailable.candles, []);
});

test("provider response returns verified schema without exposing its credential", async () => {
  let requested = "";
  const result = await loadFmpCandles({ apiKey: "do-not-expose", symbol: "ESUSD", now: (base + 300) * 1000, fetchImpl: async (input) => { requested = String(input); return new Response(JSON.stringify([{ timestamp: base, open: 99, high: 101, low: 98, close: 100, volume: 10 }]), { status: 200 }); } });
  assert.equal(result.symbol, "ESUSD");
  assert.equal(result.status, "delayed");
  assert.match(requested, /historical-chart\/15min/);
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

test("timezone-less provider date strings fail closed instead of being assumed UTC", () => {
  const payload = [{ date: "2026-07-21 10:00:00", open: 99, high: 101, low: 98, close: 100, volume: 10 }];
  assert.deepEqual(normalizeFmpCandles(payload), []);
  assert.equal(normalizeFmpCandles([{ ...payload[0], date: "2026-07-21T10:00:00Z" }]).length, 1);
});

test("dashboard chart calls only the protected candle route on an explicit control action", async () => {
  const [chart, page, loading] = await Promise.all([
    readFile(new URL("../app/dashboard/components/DashboardCandlestickChart.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/loading.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(chart, /fetch\(`\/api\/market\/candles\?timeframe=/);
  assert.doesNotMatch(chart, /financialmodelingprep\.com|setInterval|setTimeout/);
  assert.match(chart, /aria-label="Candlestick interval"/);
  assert.match(chart, /aria-label="Chart overlays"/);
  assert.match(chart, /Verified candlestick history unavailable/);
  assert.match(chart, /HistogramSeries/);
  assert.match(chart, /option\.timeframe !== timeframe/);
  assert.doesNotMatch(chart, /Session high|Session low|Previous close/);
  assert.match(chart, /series\.instrumentDetail/);
  assert.match(chart, /series\.status !== "unavailable"/);
  assert.doesNotMatch(chart, /Failure category|requests avoided|cache \{/);
  assert.match(page, /access\.tier === "pro" \|\| access\.tier === "elite"/);
  assert.match(loading, /dashboardChartSkeletonCanvas/);
});

test("documented FMP intervals use one upstream series and 4-hour is aggregated locally", async () => {
  for (const [timeframe, expected] of [["1m", "1min"], ["5m", "5min"], ["15m", "15min"], ["1h", "1hour"], ["4h", "1hour"], ["1d", "historical-price-eod/full"]] as const) {
    let requested = "";
    const points = Array.from({ length: 8 }, (_, index) => ({ timestamp: base + index * 3600, open: 99 + index, high: 101 + index, low: 98 + index, close: 100 + index, volume: 10 }));
    const result = await loadFmpCandles({ apiKey: "configured", symbol: "ESUSD", timeframe, now: (base + 8 * 3600) * 1000, fetchImpl: async (input) => { requested = String(input); return new Response(JSON.stringify(points)); } });
    assert.match(requested, new RegExp(expected.replaceAll("/", "\\/")));
    assert.equal(result.timeframe, timeframe);
    assert.equal(result.classification, timeframe === "1d" ? "end_of_day" : "delayed");
    if (timeframe === "4h") assert.ok(result.candles.every((item) => item.time % 14_400 === 0));
  }
});
