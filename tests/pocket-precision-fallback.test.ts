import test from "node:test";
import assert from "node:assert/strict";
import { recoverPrecisionGeometry } from "../app/api/pocket/precision-fallback.ts";

const scale = [{ price: 7800, y: 20 }, { price: 7500, y: 80 }];

test("merges distinct structures from both passes", () => {
  const precision = { levels: [{ kind: "resistance", price: "7800" }], priceScaleAnchors: scale };
  assert.deepEqual(recoverPrecisionGeometry({ levels: [{ kind: "support", price: "7600" }] }, precision)?.levels, [
    { kind: "resistance", price: "7800" }, { kind: "support", price: "7600" },
  ]);
});

test("does not duplicate the same price", () => {
  const recovered = recoverPrecisionGeometry(
    { levels: [{ kind: "support", price: "7,800.5" }] },
    { levels: [{ kind: "resistance", price: "7800" }], priceScaleAnchors: scale },
  );
  assert.equal(Array.isArray(recovered?.levels) ? recovered.levels.length : 0, 1);
});

test("recovers report structures when precision verified the scale", () => {
  const reportLevel = { kind: "support", price: "7600", y: 60 };
  const recovered = recoverPrecisionGeometry({ levels: [reportLevel] }, { levels: [], priceScaleAnchors: scale });
  assert.deepEqual(recovered?.levels, [reportLevel]);
});

test("keeps first-pass scale when rescue finds levels but loses anchors", () => {
  const first = { currentPrice: "7658", priceScaleAnchors: scale, plotBounds: { left: 5, top: 10, right: 88, bottom: 85 }, levels: [] };
  const rescue = { currentPrice: "7658", priceScaleAnchors: [], plotBounds: { left: 0, top: 0, right: 100, bottom: 100 }, levels: [{ kind: "support", price: "7650" }, { kind: "resistance", price: "7680" }] };
  const recovered = recoverPrecisionGeometry(first, rescue);
  assert.deepEqual(recovered?.priceScaleAnchors, scale);
  assert.deepEqual(recovered?.plotBounds, first.plotBounds);
  assert.deepEqual(recovered?.levels, rescue.levels);
});

test("does not recover levels without a verified two-point scale", () => {
  const precision = { levels: [], priceScaleAnchors: [{ price: 7800, y: 20 }] };
  assert.equal(recoverPrecisionGeometry({ levels: [{ kind: "support", price: "7600" }] }, precision), precision);
});
