import assert from "node:assert/strict";
import test from "node:test";
import { deriveSessionReferenceLevels, sessionStatusLabel } from "../app/dashboard/lib/session-levels.ts";

test("sessionStatusLabel maps session clock phases", () => {
  assert.equal(sessionStatusLabel("rth"), "OPEN");
  assert.equal(sessionStatusLabel("premarket"), "PRE-MARKET");
  assert.equal(sessionStatusLabel("afterhours"), "POST-MARKET");
  assert.equal(sessionStatusLabel("weekend"), "CLOSED");
});

test("deriveSessionReferenceLevels fails closed on empty candles", () => {
  const levels = deriveSessionReferenceLevels([]);
  assert.equal(levels.previousDayHigh, null);
  assert.equal(levels.todaysOpen, null);
  assert.match(levels.source, /America\/New_York/);
});

test("deriveSessionReferenceLevels computes PDH/PDL and open from verified candles", () => {
  // 2024-06-03 = Monday, 2024-06-04 = Tuesday (ET)
  // Prior RTH Mon 14:00 UTC ≈ 10:00 ET DST
  const candles = [
    { time: Date.parse("2024-06-03T14:00:00.000Z") / 1000, open: 100, high: 110, low: 99, close: 105, volume: 10 },
    { time: Date.parse("2024-06-03T15:00:00.000Z") / 1000, open: 105, high: 112, low: 104, close: 108, volume: 10 },
    { time: Date.parse("2024-06-03T20:30:00.000Z") / 1000, open: 108, high: 109, low: 107, close: 108.5, volume: 5 }, // after 16:00 ET
    { time: Date.parse("2024-06-04T10:00:00.000Z") / 1000, open: 108.2, high: 108.8, low: 107.5, close: 108.4, volume: 4 }, // overnight/premarket
    { time: Date.parse("2024-06-04T13:30:00.000Z") / 1000, open: 108.6, high: 109.2, low: 108.1, close: 109, volume: 8 }, // RTH open ~09:30 ET
  ];
  const now = Date.parse("2024-06-04T15:00:00.000Z") / 1000;
  const levels = deriveSessionReferenceLevels(candles, now);
  assert.equal(levels.previousDayHigh, 112);
  assert.equal(levels.previousDayLow, 99);
  assert.ok(levels.overnightHigh != null && levels.overnightHigh >= 108.8);
  assert.ok(levels.overnightLow != null && levels.overnightLow <= 107.5);
  assert.equal(levels.todaysOpen, 108.6);
});
