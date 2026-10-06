import test from "node:test";
import assert from "node:assert/strict";
import { calibratePocketAnalysis } from "../app/api/pocket/analysis-calibration.ts";

function base(patterns: unknown[]) {
  return {
    evidenceQuality: { chartReadability: "CLEAR", candlesReadable: true, scaleReadable: false, instrumentConfidence: "HIGH", timeframeConfidence: "HIGH" },
    setupScore: { overall: 60 },
    patterns,
  };
}

test("drops a named pattern when geometry is too weak to defend", () => {
  const calibrated = calibratePocketAnalysis(base([{ name: "DOUBLE TOP", status: "FORMING", confidence: "MEDIUM", evidence: "Two highs are visible.", confirmation: "Break the neckline.", invalidation: "New high.", geometry: { points: [{x:45,y:30},{x:48,y:31}], labelX: 50, labelY: 20 } }])) as { patterns: unknown[] };
  assert.deepEqual(calibrated.patterns, []);
});

test("keeps a defensible pattern with meaningful geometry", () => {
  const calibrated = calibratePocketAnalysis(base([{ name: "DOUBLE TOP", status: "FORMING", confidence: "MEDIUM", evidence: "Two highs and an intervening trough are visible.", confirmation: "Break the neckline.", invalidation: "New high.", geometry: { points: [{x:20,y:30},{x:50,y:55},{x:80,y:31}], labelX: 70, labelY: 18 } }])) as { patterns: { name: string }[] };
  assert.equal(calibrated.patterns[0]?.name, "DOUBLE TOP");
});

test("downgrades low-confidence confirmed patterns instead of presenting false certainty", () => {
  const calibrated = calibratePocketAnalysis(base([{ name: "TRIANGLE", status: "CONFIRMED", confidence: "LOW", evidence: "Compression is visible.", confirmation: "Boundary break.", invalidation: "Return through the range.", geometry: { points: [{x:15,y:20},{x:40,y:65},{x:65,y:32},{x:85,y:55}], labelX: 75, labelY: 20 } }])) as { patterns: { status: string }[] };
  assert.equal(calibrated.patterns[0]?.status, "AMBIGUOUS");
});

test("removes all pattern claims when candles are unreadable", () => {
  const value = base([{ name: "BULL FLAG", status: "FORMING", confidence: "HIGH", evidence: "Flag.", confirmation: "Break.", invalidation: "Loss.", geometry: { points: [{x:10,y:70},{x:35,y:20},{x:60,y:45}], labelX: 70, labelY: 20 } }]);
  value.evidenceQuality.candlesReadable = false;
  const calibrated = calibratePocketAnalysis(value) as { patterns: unknown[] };
  assert.deepEqual(calibrated.patterns, []);
});
