import test from "node:test";
import assert from "node:assert/strict";
import { calculateRangePosition, calculateRTargets, hasVerifiedTwoSidedStructure, mergeCompatibleChartLevels, rankChartLevels, sanitizeChartLevels } from "../app/pocket/pocket-chart-toolkit.ts";

test("level ranking prioritises multi-timeframe agreement then proximity", () => {
  const levels = [{ kind: "support" as const, label: "near", price: 99 }, { kind: "resistance" as const, label: "matched", price: 104 }];
  const ranked = rankChartLevels(levels, 100, [{ kind: "resistance", label: "context", price: 104.04 }], true);
  assert.equal(ranked[0].label, "matched");
  assert.equal(ranked[0].verification, "MEDIUM");
  assert.equal(ranked[1].distancePercent, 1);
});

test("range position requires verified bounds on both sides", () => {
  assert.equal(calculateRangePosition(105, [{ kind: "support", label: "S", price: 100 }]), null);
  assert.deepEqual(calculateRangePosition(105, [{ kind: "support", label: "S", price: 100 }, { kind: "resistance", label: "R", price: 110 }]), { support: 100, resistance: 110, percent: 50, label: "MID-RANGE" });
});

test("decision map fills a missing side from a compatible second timeframe", () => {
  const primary = [{ kind: "resistance" as const, label: "4h resistance", price: 7800, source: "PRIMARY" as const }];
  const context = [{ kind: "support" as const, label: "1h support", price: 7600, source: "CONTEXT" as const }];
  assert.deepEqual(mergeCompatibleChartLevels(primary, context, 7671.61, 7670.8), [...primary, ...context]);
});

test("decision map never merges an unconfirmed context chart", () => {
  const primary = [{ kind: "resistance" as const, label: "primary resistance", price: 7800 }];
  const context = [{ kind: "support" as const, label: "unconfirmed support", price: 7600 }];
  assert.deepEqual(mergeCompatibleChartLevels(primary, context, 7671.61, 7670.8, false), primary);
});

test("decision map rejects levels from a mismatched price scale", () => {
  const primary = [{ kind: "resistance" as const, label: "primary", price: 7800 }];
  const context = [{ kind: "support" as const, label: "other instrument", price: 8600 }];
  assert.deepEqual(mergeCompatibleChartLevels(primary, context, 7671.61, 8640.5), primary);
});

test("decision map deduplicates the same multi-timeframe level", () => {
  const primary = [{ kind: "support" as const, label: "primary support", price: 7600 }];
  const context = [{ kind: "support" as const, label: "context support", price: 7605 }];
  assert.deepEqual(mergeCompatibleChartLevels(primary, context, 7671.61, 7670.8), primary);
});

test("level sanitation rejects wrong-side and implausibly distant zones", () => {
  const levels = [
    { kind: "support" as const, label: "valid support", price: 98 },
    { kind: "support" as const, label: "wrong side", price: 104 },
    { kind: "resistance" as const, label: "too far", price: 140 },
  ];
  assert.deepEqual(sanitizeChartLevels(levels, 100), [levels[0]]);
});

test("level sanitation never certifies a wrong-side level as near-current evidence", () => {
  const current = 7639.92;
  const wrongSideLevels = [
    { kind: "support" as const, label: "support above market", price: 7650 },
    { kind: "resistance" as const, label: "resistance below market", price: 7630 },
  ];

  assert.deepEqual(sanitizeChartLevels(wrongSideLevels, current), []);
  assert.equal(hasVerifiedTwoSidedStructure(wrongSideLevels, current), false);
  assert.deepEqual(rankChartLevels(wrongSideLevels, current, [], true), []);
});

test("level sanitation prefers a user-verified duplicate", () => {
  const levels = [{ kind: "support" as const, label: "AI", price: 99 }, { kind: "support" as const, label: "USER VERIFIED", price: 99.1 }];
  assert.equal(sanitizeChartLevels(levels, 100)[0].label, "USER VERIFIED");
});

test("single-view levels fall to low confidence when the price scale is unreadable", () => {
  const ranked = rankChartLevels([{ kind: "support", label: "single", price: 99 }], 100, [], false);
  assert.equal(ranked[0].verification, "LOW");
  assert.equal(ranked[0].reason, "SINGLE_VIEW");
});

test("AI agreement never promotes an automatic level to high confidence", () => {
  const ranked = rankChartLevels(
    [{ kind: "support", label: "AI detected", price: 99 }],
    100,
    [{ kind: "support", label: "context", price: 99.02 }],
    true,
  );
  assert.equal(ranked[0].verification, "MEDIUM");
});

test("strict structural coverage requires current price and both real sides", () => {
  const support = { kind: "support" as const, label: "support", price: 99 };
  const resistance = { kind: "resistance" as const, label: "resistance", price: 101 };
  const pivot = { kind: "pivot" as const, label: "pivot", price: 102 };

  assert.equal(hasVerifiedTwoSidedStructure([support, resistance], null), false);
  assert.equal(hasVerifiedTwoSidedStructure([support, pivot], 100), false);
  assert.equal(hasVerifiedTwoSidedStructure([resistance, pivot], 100), false);
  assert.equal(hasVerifiedTwoSidedStructure([support, resistance, pivot], 100), true);
});

test("a pivot or same-price marker never substitutes for support or resistance", () => {
  assert.equal(hasVerifiedTwoSidedStructure([
    { kind: "support", label: "at market", price: 100 },
    { kind: "resistance", label: "above", price: 101 },
    { kind: "pivot", label: "below pivot", price: 99 },
  ], 100), false);
});

test("R targets enforce direction and calculate exact multiples", () => {
  assert.equal(calculateRTargets("100", "101", "LONG"), null);
  assert.deepEqual(calculateRTargets("100", "98", "LONG")?.targets.map((target) => target.price), [102, 103, 104, 106]);
  assert.deepEqual(calculateRTargets("100", "102", "SHORT")?.targets.map((target) => target.price), [98, 97, 96, 94]);
});
