import test from "node:test";
import assert from "node:assert/strict";
import { calculateRTargets } from "../app/pocket/pocket-chart-toolkit.ts";
import { calculateRiskDesk } from "../app/pocket/pocket-risk-desk.ts";

test("risk targets reject malformed, exponential and hexadecimal price inputs", () => {
  for (const [entry, stop] of [["1,0", "9"], ["0x64", "98"], ["1e2", "98"], ["100", "9,8"]]) {
    assert.equal(calculateRTargets(entry, stop, "LONG"), null, `${entry}/${stop}`);
  }
});

test("short targets never present zero, negative or unrepresentable prices", () => {
  assert.equal(calculateRTargets("100", "200", "SHORT"), null);
  assert.deepEqual(calculateRTargets("100", "150", "SHORT")?.targets, [{ multiple: 1, price: 50 }, { multiple: 1.5, price: 25 }]);
  assert.equal(calculateRTargets("100", "98", "SIDEWAYS" as "LONG"), null);
  const huge = "9".repeat(308);
  const plan = calculateRTargets(huge, "1", "LONG");
  assert.ok(plan === null || plan.targets.every(target => Number.isFinite(target.price) && target.price > 0));
});

test("risk desk holds malformed amounts rather than silently removing separators", () => {
  const result = calculateRiskDesk({ accountValue: "1,0", riskPercent: "1", stopDistance: "0x10", valuePerPoint: "1e2" });
  assert.equal(result.accountValue, null);
  assert.equal(result.riskPerUnit, null);
  assert.equal(result.units, null);
});

test("risk desk avoids intermediate cash overflow and rejects non-finite position sizes", () => {
  const huge = "9".repeat(308);
  const result = calculateRiskDesk({ accountValue: huge, riskPercent: "10", stopDistance: "1", valuePerPoint: "1" });
  assert.ok(result.cashRisk !== null && Number.isFinite(result.cashRisk));
  assert.equal(result.units, null, "an unsafe-integer unit count cannot be offered for execution");
  for (const [stopDistance, valuePerPoint] of [[huge, huge], ["0." + "0".repeat(307) + "1", "0." + "0".repeat(307) + "1"]]) {
    const unsafe = calculateRiskDesk({ accountValue: "10000", riskPercent: "1", stopDistance, valuePerPoint });
    assert.equal(unsafe.riskPerUnit, null);
    assert.equal(unsafe.units, null);
  }
});

test("ordinary risk and exact grouped decimal inputs retain existing outputs", () => {
  assert.deepEqual(calculateRiskDesk({ accountValue: "10,000", riskPercent: "0.5", stopDistance: "12.5", valuePerPoint: "2" }), { accountValue: 10000, riskPercent: 0.5, cashRisk: 50, riskPerUnit: 25, units: 2 });
  assert.deepEqual(calculateRTargets("1,000", "998", "LONG")?.targets.map(t => t.price), [1002, 1003, 1004, 1006]);
});
