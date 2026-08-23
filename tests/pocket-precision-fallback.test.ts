import test from "node:test";
import assert from "node:assert/strict";
import { recoverPrecisionGeometry } from "../app/api/pocket/precision-fallback.ts";

test("retains precision levels when the dedicated pass found them", () => {
  const precision = { levels: [{ kind: "resistance", price: "7800" }], priceScaleAnchors: [{}, {}] };
  assert.equal(recoverPrecisionGeometry({ levels: [{ kind: "support", price: "7600" }] }, precision), precision);
});

test("recovers report-pass structures when precision verified the scale but returned no levels", () => {
  const reportLevel = { kind: "support", price: "7600", y: 60 };
  const recovered = recoverPrecisionGeometry(
    { levels: [reportLevel] },
    { levels: [], priceScaleAnchors: [{ price: 7800, y: 20 }, { price: 7500, y: 80 }], plotBounds: { left: 10, top: 10, right: 90, bottom: 90 } },
  );
  assert.deepEqual(recovered?.levels, [reportLevel]);
});

test("does not recover numeric levels without a verified two-point scale", () => {
  const precision = { levels: [], priceScaleAnchors: [{ price: 7800, y: 20 }] };
  assert.equal(recoverPrecisionGeometry({ levels: [{ kind: "support", price: "7600" }] }, precision), precision);
});
