import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  downsampleSeries,
  MIN_SPARKLINE_POINTS,
  parsePriceLevel,
  rangeLaneFromCandles,
  scenarioLaneMarkers,
  sparklineFromCandles,
} from "../app/components/mini-visuals/mini-visual-data.ts";
import type { OhlcvPoint } from "../app/terminal/lib/visual-terminal.ts";

function candle(time: number, close: number): OhlcvPoint {
  return { time, open: close - 1, high: close + 2, low: close - 2, close, volume: 100 };
}

test("sparkline requires verified closes and never fabricates history", () => {
  const thin = Array.from({ length: MIN_SPARKLINE_POINTS - 1 }, (_, index) => candle(1_700_000_000 + index * 300, 100 + index));
  assert.equal(sparklineFromCandles(thin), null);

  const base = 1_700_000_000;
  const rich = Array.from({ length: 40 }, (_, index) => candle(base + index * 300, 100 + index));
  const series = sparklineFromCandles(rich, 12);
  assert.ok(series);
  assert.equal(series!.length, 12);
  assert.equal(series![0], 100);
  assert.equal(series!.at(-1), 139);
  assert.deepEqual(downsampleSeries([1, 2, 3, 4], 4), [1, 2, 3, 4]);
});

test("range lane markers come only from verified candle statistics", () => {
  const base = 1_700_000_000;
  const candles = Array.from({ length: 30 }, (_, index) => candle(base + index * 300, 100 + index));
  candles[10] = { ...candles[10]!, high: 200, low: 50, close: 120 };
  const lane = rangeLaneFromCandles(candles);
  assert.ok(lane);
  assert.equal(lane!.high, 200);
  assert.equal(lane!.low, 50);
  assert.equal(lane!.current, candles.at(-1)!.close);
  assert.ok(lane!.firstClose != null);
});

test("scenario lanes omit themselves when range is invalid", () => {
  assert.equal(scenarioLaneMarkers({ low: 10, high: 10, current: 10, confirmation: 10, invalidation: 10 }), null);
  const lane = scenarioLaneMarkers({ low: 10, high: 20, current: 15, confirmation: 18, invalidation: 12 });
  assert.deepEqual(lane, { lower: 10, upper: 20, current: 15, confirmation: 18, invalidation: 12 });
  assert.equal(parsePriceLevel("7,545.25"), 7545.25);
  assert.equal(parsePriceLevel("Unavailable"), null);
});

test("dashboard and terminal wire mini visuals without inventing cross-asset history", async () => {
  const [dashboard, terminal, status, plan, customer] = await Promise.all([
    readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/terminal/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/components/DashboardMarketStatus.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/components/DashboardMarketPlan.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/terminal/components/CustomerTerminal.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /sparklineFromCandles/);
  assert.match(dashboard, /rangeLaneFromCandles/);
  assert.match(terminal, /sparklines=\{\{ ES: esSparkline, VIX: vixSparkline, DXY: dxySparkline \}\}/);
  assert.match(status, /Sparkline/);
  assert.match(status, /sparkline: null/);
  assert.match(plan, /RangePositionLane/);
  assert.match(plan, /ScenarioPositionLane/);
  assert.match(customer, /EvidenceMeter/);
  assert.match(customer, /RangePositionLane/);
  assert.match(customer, /BullseyeGauge/);
  assert.match(customer, /UnavailableHistory/);
});
