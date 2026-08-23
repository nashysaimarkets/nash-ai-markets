import test from "node:test";
import assert from "node:assert/strict";
import { calculateRangePosition, calculateRTargets, rankChartLevels } from "../app/pocket/pocket-chart-toolkit.ts";

test("level ranking prioritises multi-timeframe agreement then proximity", () => {
  const levels = [{ kind: "support" as const, label: "near", price: 99 }, { kind: "resistance" as const, label: "matched", price: 104 }];
  const ranked = rankChartLevels(levels, 100, [{ kind: "resistance", label: "context", price: 104.1 }], true);
  assert.equal(ranked[0].label, "matched");
  assert.equal(ranked[0].verification, "HIGH");
  assert.equal(ranked[1].distancePercent, 1);
});

test("range position requires verified bounds on both sides", () => {
  assert.equal(calculateRangePosition(105, [{ kind: "support", label: "S", price: 100 }]), null);
  assert.deepEqual(calculateRangePosition(105, [{ kind: "support", label: "S", price: 100 }, { kind: "resistance", label: "R", price: 110 }]), { support: 100, resistance: 110, percent: 50, label: "MID-RANGE" });
});

test("R targets enforce direction and calculate exact multiples", () => {
  assert.equal(calculateRTargets("100", "101", "LONG"), null);
  assert.deepEqual(calculateRTargets("100", "98", "LONG")?.targets.map((target) => target.price), [102, 103, 104, 106]);
  assert.deepEqual(calculateRTargets("100", "102", "SHORT")?.targets.map((target) => target.price), [98, 97, 96, 94]);
});
