import assert from "node:assert/strict";
import test from "node:test";
import { buildLevelScanner, scannerDistance, scannerPercent, scannerView } from "../app/pocket/level-scanner-model";
import type { Level } from "../app/pocket/analysis-types";

const level = (kind: Level["kind"], price: string, label = "Visible chart level", source: Level["source"] = "PRIMARY"): Level => ({ kind, price, label, source, x: 10, y: 40, x2: 80, y2: 40 });

test("the screenshot's nearby boundaries remain visible beside chart price", () => {
  const model = buildLevelScanner({ currentPrice: "7656.44", levels: [level("resistance", "7675.80"), level("resistance", "7660.00"), level("support", "7650.00"), level("pivot", "7617.41")] });
  const nearby = scannerView(model, false)!;
  assert.deepEqual(nearby.entries.map((entry) => entry.price), ["7660.00", "7656.44", "7650.00"]);
  assert.equal(scannerDistance(model.resistance!.value - model.current!, model.decimals), "3.56");
  assert.equal(scannerDistance(model.current! - model.support!.value, model.decimals), "6.44");
  assert.equal(new Set(nearby.entries.map((entry) => entry.labelY)).size, 3);
  const all = scannerView(model, true)!;
  assert.equal(all.entries.length, model.levels.length + 1);
  assert.deepEqual(all.entries.map((entry) => entry.price), ["7675.80", "7660.00", "7656.44", "7650.00", "7617.41"]);
});

test("price geometry stays linear even when callouts move apart", () => {
  const model = buildLevelScanner({ currentPrice: "100.01", levels: [level("support", "100.00"), level("resistance", "105.00")] });
  const view = scannerView(model, false)!;
  const [resistance, current, support] = view.entries;
  const pixelsPerPrice = (support.y - resistance.y) / (resistance.value - support.value);
  assert.ok(Math.abs((support.y - current.y) / (current.value - support.value) - pixelsPerPrice) < 1e-8);
  assert.ok(Math.abs(support.y - current.y) < 1, "close evidence anchors remain close");
  assert.ok(Math.abs(support.labelY - current.labelY) > 30, "labels have separate reading slots");
});

test("forex distances retain screenshot precision instead of rounding to zero", () => {
  const model = buildLevelScanner({ currentPrice: "1.17234", levels: [level("support", "1.17230"), level("resistance", "1.17238")] });
  assert.equal(model.decimals, 5);
  assert.equal(scannerDistance(model.current! - model.support!.value, model.decimals), "0.00004");
  assert.equal(scannerPercent(.00004, model.current!), "<0.01%");
  const view = scannerView(model, false)!;
  assert.ok(view.max - view.min < .001, "small prices must not receive a whole-unit display pad");
});

test("empty, invalid, and one-sided evidence keep the existing trust boundary", () => {
  assert.equal(scannerView(buildLevelScanner({ currentPrice: "Unknown", levels: [level("support", "99")] }), false), null);
  assert.equal(scannerView(buildLevelScanner({ currentPrice: "100", levels: [level("pivot", "98")] }), false), null);
  const model = buildLevelScanner({ currentPrice: "100", levels: [level("support", "101"), level("resistance", "99"), level("support", "95"), level("resistance", "500")] });
  assert.equal(model.twoSided, false);
  assert.equal(model.resistance, null);
  assert.deepEqual(scannerView(model, false)!.entries.map((entry) => entry.price), ["100", "95"]);
});

test("deduplication retains the exact selected source without altering input", () => {
  const input = { currentPrice: "100", levels: [level("support", "99.00", "Original"), level("support", "99.01", "USER VERIFIED support", "USER_VERIFIED"), level("resistance", "104.00")] };
  const before = JSON.stringify(input);
  const model = buildLevelScanner(input);
  assert.equal(model.support!.source, "USER_VERIFIED");
  assert.equal(model.support!.price, "99.01");
  assert.equal(JSON.stringify(input), before);
});
