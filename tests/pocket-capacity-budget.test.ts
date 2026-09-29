import test from "node:test";
import assert from "node:assert/strict";
import { resetPocketBudgetsForTesting, takePocketBudget } from "../app/lib/server/pocket-request-budget";
import { capacityRetrySeconds, noteCapacityExhausted } from "../app/lib/server/pocket-provider-capacity";
const request = new Request("https://example.test", { headers: { "x-forwarded-for": "192.0.2.90" } });
test("a failed scan releases its slot exactly once without refunding another request", () => {
  resetPocketBudgetsForTesting();
  const failure = takePocketBudget(request, "analyse", 1000);
  takePocketBudget(request, "analyse", 1000);
  failure.release?.(); failure.release?.();
  for (let i = 0; i < 9; i++) assert.equal(takePocketBudget(request, "analyse", 1000).allowed, true);
  assert.equal(takePocketBudget(request, "analyse", 1000).allowed, false);
});
test("five uploaded views and five explicit refreshes fit; further work is bounded", () => {
  resetPocketBudgetsForTesting();
  for (let i = 0; i < 10; i++) assert.equal(takePocketBudget(request, "analyse", 1000).allowed, true);
  assert.equal(takePocketBudget(request, "analyse", 1000).allowed, false);
});
test("failed-request refunds cannot enable unbounded provider attempts", () => {
  resetPocketBudgetsForTesting();
  for (let i = 0; i < 20; i++) { const slot = takePocketBudget(request, "analyse", 1000); assert.equal(slot.allowed, true); slot.release?.(); }
  assert.equal(takePocketBudget(request, "analyse", 1000).allowed, false);
  assert.equal(takePocketBudget(request, "analyse", 1_801_000).allowed, true);
});
test("a late failure cannot refund the next window", () => {
  resetPocketBudgetsForTesting();
  const old = takePocketBudget(request, "analyse", 1000);
  takePocketBudget(request, "analyse", 1_801_000);
  old.release?.();
  assert.equal(takePocketBudget(request, "analyse", 1_801_000).remaining, 8);
});
test("capacity suppression is bounded and isolated to the configured provider key", () => {
  noteCapacityExhausted("test-key-a", 1000);
  assert.equal(capacityRetrySeconds("test-key-a", 2000), 59);
  assert.equal(capacityRetrySeconds("test-key-b", 2000), 0);
  assert.equal(capacityRetrySeconds("test-key-a", 61_000), 0);
});
