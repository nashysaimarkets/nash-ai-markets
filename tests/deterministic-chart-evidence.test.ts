import assert from "node:assert/strict";
import test from "node:test";
import { deterministicPrimaryFallback, hasCorroboratedVolumeProfile, normalizeDeterministicEvidence } from "../app/lib/deterministic-chart-evidence.ts";

test("normalizes measured evidence without accepting numeric prices", () => {
  const normalized = normalizeDeterministicEvidence([{
    version: "anything",
    role: "PRIMARY",
    image: { width: 1200, height: 900 },
    chartStatus: "chart-detected",
    plot: { left: 5, top: 8, right: 87, bottom: 91, confidence: 9 },
    candles: { count: 42, confidence: .9, centres: [9, 22, 101] },
    levels: [{ kind: "support", y: 70, strength: .8, touches: 3, price: 999999 }],
    volumeProfile: { status: "visible", side: "left", pointOfControlY: 55, confidence: .84 },
    warnings: [],
  }]);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0]!.plot.confidence, 1);
  assert.deepEqual(normalized[0]!.candles.centres, [9, 22, 100]);
  assert.equal("price" in normalized[0]!.levels[0]!, false);
});

test("creates useful relative fallback while withholding exact prices", () => {
  const fallback = deterministicPrimaryFallback([{
    role: "PRIMARY",
    image: { width: 900, height: 600 },
    chartStatus: "chart-detected",
    plot: { left: 4, top: 7, right: 88, bottom: 90, confidence: .55 },
    candles: { count: 25, confidence: .83, centres: [10, 20, 30] },
    levels: [{ kind: "resistance", y: 31, strength: .8, touches: 4 }],
    volumeProfile: { status: "not-detected", confidence: .7 },
  }]);
  assert.ok(fallback);
  assert.equal(fallback.levels[0]!.price, "");
  assert.match(fallback.levels[0]!.label, /IMAGE-MEASURED/);
});

test("rejects duplicate roles and invalid plot geometry", () => {
  const normalized = normalizeDeterministicEvidence([
    { role: "PRIMARY", image: {}, chartStatus: "chart-detected", plot: { left: 80, top: 5, right: 20, bottom: 90 }, candles: {}, levels: [], volumeProfile: {} },
    { role: "PRIMARY", image: {}, chartStatus: "chart-detected", plot: { left: 5, top: 5, right: 90, bottom: 90 }, candles: {}, levels: [], volumeProfile: {} },
    { role: "PRIMARY", image: {}, chartStatus: "chart-detected", plot: { left: 5, top: 5, right: 90, bottom: 90 }, candles: {}, levels: [], volumeProfile: {} },
  ]);
  assert.equal(normalized.length, 1);
});

test("volume profile requires geometry and independent visible-label corroboration", () => {
  const candidate = [{ role: "INDICATOR_VOLUME", image: {}, chartStatus: "chart-detected", plot: { left: 5, top: 5, right: 90, bottom: 90 }, candles: {}, levels: [], volumeProfile: { status: "visible", confidence: .9 } }];
  assert.equal(hasCorroboratedVolumeProfile(candidate, ["Volume Profile · POC visible"]), true);
  assert.equal(hasCorroboratedVolumeProfile(candidate, ["Ordinary volume bars"]), false);
  assert.equal(hasCorroboratedVolumeProfile([], ["Volume Profile"]), false);
});
