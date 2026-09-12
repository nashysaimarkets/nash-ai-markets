import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { chartEvidenceScore, factorScore } from "../app/pocket/BullseyeDecisionEngine.tsx";
import { createSampleCharts } from "../app/pocket/sample-analysis.ts";
import { evaluateTradePlan } from "../app/pocket/trade-plan-evaluator.ts";

const analysis = createSampleCharts()[0].report!;

test("decision engine derives a bounded screenshot precision score", () => {
  const score = chartEvidenceScore(analysis);
  assert.ok(score >= 0 && score <= 100);
  assert.equal(chartEvidenceScore({ ...analysis, evidenceQuality: { ...analysis.evidenceQuality, chartReadability: "POOR", candlesReadable: false, scaleReadable: false, instrumentConfidence: "UNKNOWN", timeframeConfidence: "UNKNOWN" } }), 5);
});

test("decision factor bars stay within their displayed ten-point scale", () => {
  assert.equal(factorScore(12), 10);
  assert.equal(factorScore(-2), 0);
  assert.equal(factorScore(7.6), 8);
});

test("trade review rejects invalid geometry and challenges weak reward-to-risk", () => {
  const invalid = evaluateTradePlan({ side: "LONG", entry: "6000", stop: "6010", target: "6050" }, analysis);
  assert.equal(invalid.valid, false);
  assert.equal(invalid.verdict, "INVALID PLAN");

  const weak = evaluateTradePlan({ side: "LONG", entry: "6000", stop: "5990", target: "6010" }, analysis);
  assert.equal(weak.valid, true);
  assert.equal(weak.rewardRisk, 1);
  assert.ok(weak.checks.some((check) => check.label === "REWARD / RISK" && check.status === "FAIL"));
});

test("one synthesis surface contains the requested decision controls", async () => {
  const [component, pocket] = await Promise.all([
    readFile(new URL("../app/pocket/BullseyeDecisionEngine.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8"),
  ]);
  for (const label of ["BULLSEYE DECISION ENGINE", "EVIDENCE BALANCE", "WHAT CHANGES MY MIND", "TRAP RADAR", "SCREENSHOT PRECISION", "MULTI-TIMEFRAME CHECK", "ANALYSE MY TRADE", "SETUP QUALITY"]) {
    assert.match(component, new RegExp(label));
  }
  assert.match(pocket, /Other charts prepare in the background\. Ready charts switch instantly\./);
  assert.match(pocket, /setLastScanPerformance/);
  assert.doesNotMatch(pocket, /INDEPENDENT LEVEL LAB|RESCAN LEVELS ONLY|bullseye-level-lab/);
});
