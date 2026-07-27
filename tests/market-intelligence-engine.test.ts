import assert from "node:assert/strict";
import test from "node:test";
import { analyzeMarketSnapshot } from "../app/lib/market-intelligence-engine.ts";
import type { MarketSnapshot } from "../app/lib/market-data.ts";

function snapshot(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return {
    status: "LIVE",
    source: "Mock provider",
    asOf: "2026-07-16T12:00:00.000Z",
    quotes: [
      { symbol: "ES", label: "ES FUTURES", value: "6,325.50", change: "+0.75%", direction: "up" },
      { symbol: "VIX", label: "VIX", value: "15.00", change: "-1.20%", direction: "down" },
      { symbol: "US2Y", label: "2Y YIELD", value: "4.18%", change: "-2 bps", direction: "down" },
      { symbol: "US10Y", label: "10Y YIELD", value: "4.42%", change: "-1 bps", direction: "down" },
      { symbol: "DXY", label: "US DOLLAR", value: "98.12", change: "-0.16%", direction: "down" },
    ],
    levels: [
      { label: "R2", value: "6,350", note: "Second resistance", type: "resistance" },
      { label: "S2", value: "6,280", note: "Second support", type: "support" },
      { label: "R1", value: "6,335", note: "Primary resistance", type: "resistance" },
      { label: "S1", value: "6,300", note: "Primary support", type: "support" },
    ],
    events: [],
    bias: "BULLISH",
    risk: "MODERATE",
    summary: "Mock snapshot",
    evidence: { trend: 76, momentum: 72, volatility: 35, breadth: 70, macro: 64 },
    ...overrides,
  };
}

test("returns a deterministic structured market-intelligence result", () => {
  const input = snapshot();
  const first = analyzeMarketSnapshot(input);
  const second = analyzeMarketSnapshot(input);
  assert.deepEqual(first, second);
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
  assert.equal(first.schemaVersion, "1.1");
  assert.equal(first.source.provider, "Mock provider");
  assert.equal(first.actionable, true);
  assert.equal(first.scenarios.reduce((sum, scenario) => sum + scenario.probability, 0), 100);
});

test("calculates all required scores on a zero-to-one-hundred scale", () => {
  const result = analyzeMarketSnapshot(snapshot());
  assert.deepEqual(Object.keys(result.scores), ["riskOnRiskOff", "marketSentiment", "trend", "volatility", "bullseyeConfidence"]);
  Object.values(result.scores).forEach((score) => assert.ok(score >= 0 && score <= 100));
  assert.ok(result.scores.riskOnRiskOff > 50);
  assert.ok(result.scores.marketSentiment > 50);
  assert.ok(result.scores.trend > 50);
});

test("produces bullish, neutral and bearish structured scenarios", () => {
  const result = analyzeMarketSnapshot(snapshot());
  assert.deepEqual(result.scenarios.map((scenario) => scenario.type), ["BULLISH", "NEUTRAL", "BEARISH"]);
  assert.equal(result.dominantScenario, "BULLISH");
  assert.deepEqual(result.scenarios[0].trigger, { kind: "ABOVE_RESISTANCE", level: "6,335" });
  assert.deepEqual(result.scenarios[0].invalidation, { kind: "BELOW_SUPPORT", level: "6,300" });
  assert.deepEqual(result.scenarios[2].trigger, { kind: "BELOW_SUPPORT", level: "6,300" });
  result.scenarios.forEach((scenario) => {
    assert.equal(scenario.evidence.length, 4);
    scenario.evidence.forEach((item) => {
      assert.ok(["SUPPORTS", "NEUTRAL", "OPPOSES"].includes(item.relation));
      assert.ok(item.score >= 0 && item.score <= 100);
    });
  });
});

test("provides structured reasoning for every score", () => {
  const result = analyzeMarketSnapshot(snapshot());
  assert.equal(result.reasoning.overallConfidence.score, result.scores.bullseyeConfidence);
  assert.equal(result.reasoning.overallConfidence.inputs.length, 4);
  assert.ok(result.reasoning.riskDrivers.length > 0);
  assert.ok(result.reasoning.sentimentDrivers.length > 0);
  assert.ok(result.reasoning.trendDrivers.length > 0);
  assert.ok(result.reasoning.volatilityDrivers.length > 0);
  for (const drivers of [
    result.reasoning.riskDrivers,
    result.reasoning.sentimentDrivers,
    result.reasoning.trendDrivers,
    result.reasoning.volatilityDrivers,
  ]) {
    drivers.forEach((driver) => {
      assert.equal(typeof driver.factor, "string");
      assert.ok(driver.normalizedScore >= 0 && driver.normalizedScore <= 100);
      assert.ok(driver.weight > 0 && driver.weight <= 1);
      assert.equal(typeof driver.contribution, "number");
    });
  }
});

test("reports structured Treasury, dollar and VIX impacts", () => {
  const result = analyzeMarketSnapshot(snapshot());
  assert.equal(result.reasoning.treasuryImpact.availability, "AVAILABLE");
  assert.deepEqual(result.reasoning.treasuryImpact.inputs.map((input) => input.factor), ["US2Y", "US10Y"]);
  assert.equal(result.reasoning.dollarImpact.availability, "AVAILABLE");
  assert.equal(result.reasoning.dollarImpact.inputs[0]?.factor, "DXY");
  assert.equal(result.reasoning.vixImpact.availability, "AVAILABLE");
  assert.equal(result.reasoning.vixImpact.inputs[0]?.value, 15);
  assert.deepEqual(result.reasoning.missingDataWarnings, []);
});

test("emits deterministic missing-data warning codes", () => {
  const result = analyzeMarketSnapshot(snapshot({
    quotes: [{ symbol: "ES", label: "ES FUTURES", value: "6,325.50", change: "0", direction: "flat" }],
    levels: [],
    evidence: { trend: 50 },
  }));
  assert.equal(result.reasoning.treasuryImpact.availability, "MISSING");
  assert.equal(result.reasoning.dollarImpact.availability, "MISSING");
  assert.equal(result.reasoning.vixImpact.availability, "MISSING");
  assert.equal(result.reasoning.riskDrivers.find((driver) => driver.factor === "MACRO_EVIDENCE")?.rawValue, null);
  assert.equal(result.reasoning.volatilityDrivers.find((driver) => driver.factor === "VOLATILITY_EVIDENCE")?.rawValue, null);
  assert.deepEqual(result.reasoning.missingDataWarnings, [
    { code: "MISSING_QUOTE", field: "VIX" },
    { code: "MISSING_QUOTE", field: "US2Y" },
    { code: "MISSING_QUOTE", field: "US10Y" },
    { code: "MISSING_QUOTE", field: "DXY" },
    { code: "MISSING_EVIDENCE", field: "momentum" },
    { code: "MISSING_EVIDENCE", field: "volatility" },
    { code: "MISSING_EVIDENCE", field: "breadth" },
    { code: "MISSING_EVIDENCE", field: "macro" },
    { code: "MISSING_LEVEL", field: "support" },
    { code: "MISSING_LEVEL", field: "resistance" },
  ]);
});

test("moves toward bearish risk-off conditions when trend and volatility deteriorate", () => {
  const result = analyzeMarketSnapshot(snapshot({
    quotes: [
      { symbol: "ES", label: "ES FUTURES", value: "6,100.00", change: "-2.50%", direction: "down" },
      { symbol: "VIX", label: "VIX", value: "34.00", change: "+18.00%", direction: "up" },
      { symbol: "DXY", label: "US DOLLAR", value: "104.00", change: "+1.00%", direction: "up" },
    ],
    evidence: { trend: 24, momentum: 20, volatility: 86, breadth: 28, macro: 32 },
    risk: "HIGH",
  }));
  assert.equal(result.dominantScenario, "BEARISH");
  assert.ok(result.scores.riskOnRiskOff < 50);
  assert.ok(result.scores.marketSentiment < 50);
  assert.ok(result.scores.volatility > 50);
});

test("fails closed for preview and unavailable snapshots", () => {
  for (const status of ["PREVIEW", "UNAVAILABLE"] as const) {
    const result = analyzeMarketSnapshot(snapshot({ status }));
    assert.equal(result.actionable, false);
    if (status === "UNAVAILABLE") assert.equal(result.scores.bullseyeConfidence, 0);
    else assert.ok(result.scores.bullseyeConfidence <= 25);
    assert.deepEqual(result.scenarios.map((scenario) => scenario.probability), [0, 100, 0]);
    assert.equal(result.dominantScenario, "NEUTRAL");
  }
});

test("uses numeric ordering when explicit primary level labels are absent", () => {
  const result = analyzeMarketSnapshot(snapshot({
    levels: [
      { label: "Upper", value: "6,360", note: "Far", type: "resistance" },
      { label: "Near", value: "6,330", note: "Near", type: "resistance" },
      { label: "Lower", value: "6,270", note: "Far", type: "support" },
      { label: "Near", value: "6,305", note: "Near", type: "support" },
    ],
  }));
  assert.equal(result.scenarios[0].trigger.level, "6,330");
  assert.equal(result.scenarios[2].trigger.level, "6,305");
});
