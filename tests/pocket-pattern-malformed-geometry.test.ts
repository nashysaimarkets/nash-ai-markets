import assert from "node:assert/strict";
import test from "node:test";
import { calibratePocketAnalysis } from "../app/api/pocket/analysis-calibration.ts";

const analysis = (points: unknown[]) => ({
  evidenceQuality: { chartReadability: "CLEAR", candlesReadable: true, instrumentConfidence: "HIGH", timeframeConfidence: "HIGH", scaleReadable: false },
  setupScore: { overall: 60 },
  patterns: [{
    name: "DOUBLE TOP", status: "CONFIRMED", confidence: "HIGH",
    evidence: "Visible peaks.", confirmation: "Neckline break.", invalidation: "Peak break.",
    geometry: { points },
  }],
});

test("mixed malformed pattern geometry fails closed", () => {
  const valid = [{ x: 10, y: 30 }, { x: 50, y: 70 }, { x: 90, y: 30 }];
  for (const bad of [{ x: Number.NaN, y: 40 }, { x: 101, y: 40 }, { x: "40", y: 40 }, null]) {
    const result = calibratePocketAnalysis(analysis([...valid, bad])) as { patterns?: unknown[] };
    assert.deepEqual(result.patterns, []);
  }
});
