import test from "node:test";
import assert from "node:assert/strict";
import { calibratePocketAnalysis } from "../app/api/pocket/analysis-calibration.ts";
const points = (ys: number[]) => ys.map((y, index) => ({ x: 10 + index * 12, y }));
function patterns(name: string, vertices: {x: number; y: number}[]) {
  return (calibratePocketAnalysis({
    evidenceQuality: { chartReadability: "CLEAR", candlesReadable: true, instrumentConfidence: "HIGH", timeframeConfidence: "HIGH", scaleReadable: false },
    patterns: [{ name, status: "FORMING", confidence: "MEDIUM", evidence: "Supplied visible swing path.", confirmation: "Wait for a boundary break.", invalidation: "The swing structure fails.", geometry: { points: vertices } }],
  }) as { patterns: unknown[] }).patterns;
}

test("a pattern swing path must proceed through distinct candle columns in time order", () => {
  for (const vertices of [points([30, 60, 31]).reverse(), [{ x: 10, y: 30 }, { x: 10, y: 60 }, { x: 80, y: 31 }]]) assert.deepEqual(patterns("DOUBLE TOP", vertices), []);
  assert.equal(patterns("DOUBLE TOP", points([30, 60, 31])).length, 1);
});

test("double top and bottom names require their corresponding intervening turn", () => {
  for (const name of ["DOUBLE TOP", "DOUBLE BOTTOM"]) {
    assert.deepEqual(patterns(name, points([20, 40, 60])), []);
    assert.deepEqual(patterns(name, points([60, 40, 20])), []);
  }
  assert.equal(patterns("DOUBLE TOP", points([30, 60, 31])).length, 1);
  assert.equal(patterns("DOUBLE BOTTOM", points([60, 30, 59])).length, 1);
  assert.deepEqual(patterns("DOUBLE TOP", points([60, 30, 59])), []);
  assert.deepEqual(patterns("DOUBLE BOTTOM", points([30, 60, 31])), []);
});

test("head and shoulders requires three peaks and both intervening troughs", () => {
  assert.deepEqual(patterns("HEAD & SHOULDERS", points([30, 60, 31])), []);
  assert.deepEqual(patterns("INVERSE H&S", points([60, 30, 59])), []);
  assert.deepEqual(patterns("HEAD & SHOULDERS", points([30, 60, 35, 61, 31])), []);
  assert.deepEqual(patterns("INVERSE H&S", points([60, 30, 55, 29, 59])), []);
  assert.equal(patterns("HEAD & SHOULDERS", points([30, 60, 15, 61, 31])).length, 1);
  assert.equal(patterns("INVERSE H&S", points([60, 30, 75, 29, 59])).length, 1);
  assert.equal(patterns("HEAD & SHOULDERS", points([70, 30, 60, 15, 61, 31, 71])).length, 1);
});
