import assert from "node:assert/strict";
import test from "node:test";
import { calibratePocketAnalysis } from "../app/api/pocket/analysis-calibration.ts";

const basePattern = {
  name: "DOUBLE TOP",
  status: "CONFIRMED",
  confidence: "HIGH",
  evidence: "Two separated peaks are visible.",
  confirmation: "Neckline break required.",
  invalidation: "Break above the peaks.",
};

const baseAnalysis = (points: unknown[]) => ({
  evidenceQuality: {
    chartReadability: "CLEAR",
    candlesReadable: true,
    instrumentConfidence: "HIGH",
    timeframeConfidence: "HIGH",
    scaleReadable: false,
  },
  setupScore: { overall: 60 },
  patterns: [{ ...basePattern, geometry: { points } }],
});

test("pattern geometry fails closed when any supplied point is malformed", () => {
  const valid = [
    { x: 10, y: 30 },
    { x: 50, y: 70 },
    { x: 90, y: 30 },
  ];
  const malformed = [
    { x: Number.NaN, y: 40 },
    { x: Number.POSITIVE_INFINITY, y: 40 },
    { x: -1, y: 40 },
    { x: 101, y: 40 },
    { x: 40, y: -1 },
    { x: 40, y: 101 },
    { x: "40", y: 40 },
    null,
  ];

  for (const bad of malformed) {
    const result = calibratePocketAnalysis(baseAnalysis([...valid, bad])) as { patterns?: unknown[] };
    assert.deepEqual(result.patterns, []);
  }
});

test("fully valid pattern geometry remains eligible", () => {
  const result = calibratePocketAnalysis(baseAnalysis([
    { x: 10, y: 30 },
    { x: 50, y: 70 },
    { x: 90, y: 30 },
  ])) as { patterns?: unknown[] };
  assert.equal(result.patterns?.length, 1);
});
