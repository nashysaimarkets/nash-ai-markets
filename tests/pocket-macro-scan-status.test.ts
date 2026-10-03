import assert from "node:assert/strict";
import test from "node:test";
import { macroScanStatus } from "../app/pocket/macro-scan-status";

const full = { sample: false, available: true, unavailable: [], todayCount: 0, nextHighImpactLabel: null };
test("a missing BLS feed cannot turn an empty schedule into an all-clear", () => {
  const status = macroScanStatus({ ...full, unavailable: ["BLS"] });
  assert.equal(status.state, "warning");
  assert.equal(status.badge, "PARTIAL COVERAGE");
  assert.match(status.detail, /BLS unavailable/);
  assert.doesNotMatch(status.title, /NO RELEASE/);
});
test("a known high-impact event retains priority while incomplete coverage remains explicit", () => {
  const status = macroScanStatus({ ...full, todayCount: 1, unavailable: ["BEA"], nextHighImpactLabel: "CPI · 13:30" });
  assert.equal(status.badge, "HIGH IMPACT");
  assert.equal(status.title, "CPI · 13:30");
  assert.match(status.detail, /BEA unavailable/);
});
test("confirmed empty, unavailable and fictional schedules remain distinct", () => {
  assert.equal(macroScanStatus(full).badge, "LIVE CHECK");
  assert.equal(macroScanStatus({ ...full, available: false }).state, "withheld");
  assert.equal(macroScanStatus({ ...full, sample: true, available: false }).badge, "FICTIONAL SAMPLE");
});
