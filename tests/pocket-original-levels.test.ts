import assert from "node:assert/strict";
import test from "node:test";
import { originalPixelLevels } from "../app/pocket/original-pixel-levels.ts";

const anchors = [{ price: 3000, y: 20 }, { price: 2900, y: 50 }, { price: 2800, y: 80 }];
const report = { evidenceQuality: { chartReadability: "CLEAR", instrumentConfidence: "HIGH", timeframeConfidence: "HIGH", scaleReadable: true, candlesReadable: true, limitations: [] as string[] }, plotBounds: { left: 5, right: 90, top: 10, bottom: 90 }, priceScaleAnchors: anchors, levels: [{ kind: "support", label: "Support", price: "2850", x: 10, x2: 85, y: 65, y2: 65 }] };
const axis = { status: "verified" as const, anchors, matchedModelTicks: 3, axisLeft: 950 };
test("original levels use independently read original-price pixels, not reported row coordinates", () => {
  const projected = originalPixelLevels({ ...report, levels: [{ ...report.levels[0], y: 40, y2: 40 }] }, true, axis, 1000, 1000);
  assert.equal(projected.levels.length, 1);
  assert.equal(projected.levels[0].y, 65);
});
test("unconfirmed identity, model-only anchors, wrong axis readings and uncertain scale hold all placement", () => {
  assert.equal(originalPixelLevels(report, false, axis, 1000, 1000).levels.length, 0);
  assert.equal(originalPixelLevels(report, true, null, 1000, 1000).levels.length, 0);
  assert.equal(originalPixelLevels(report, true, { ...axis, anchors: anchors.map(a => ({ ...a, price: a.price + 10 })) }, 1000, 1000).levels.length, 0);
  assert.equal(originalPixelLevels({ ...report, evidenceQuality: { ...report.evidenceQuality, limitations: ["logarithmic scale"] } }, true, axis, 1000, 1000).levels.length, 0);
});
test("uncovered prices, another source, malformed prices and invalid bounds are never extrapolated or repaired", () => {
  for (const change of [{ price: "3100" }, { price: "2850-ish" }, { source: "CONTEXT" }, { x: -2 }, { x2: 110 }]) assert.equal(originalPixelLevels({ ...report, levels: [{ ...report.levels[0], ...change }] }, true, axis, 1000, 1000).levels.length, 0);
  assert.equal(originalPixelLevels({ ...report, plotBounds: { ...report.plotBounds, right: 101 } }, true, axis, 1000, 1000).levels.length, 0);
  assert.equal(originalPixelLevels(report, true, { ...axis, anchors: [{ price: 3000, y: 20 }, { price: 2900, y: 56 }, { price: 2800, y: 80 }] }, 1000, 1000).levels.length, 0);
});
