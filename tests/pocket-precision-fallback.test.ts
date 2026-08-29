import test from "node:test";
import assert from "node:assert/strict";
import { recoverPrecisionGeometry } from "../app/api/pocket/precision-fallback.ts";

const scale = [{ price: 7800, y: 20 }, { price: 7650, y: 50 }, { price: 7500, y: 80 }];

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

test("an unscaled rescue cannot replace the current price from the selected scale", () => {
  const first = {
    currentPrice: "7658",
    priceScaleAnchors: scale,
    levels: [{ kind: "support", price: "7600", y: 60 }],
  };
  const rescue = {
    currentPrice: "7590",
    priceScaleAnchors: [],
    levels: [{ kind: "resistance", price: "7620", y: 55 }],
  };
  assert.equal(recoverPrecisionGeometry(first, rescue)?.currentPrice, first.currentPrice);
});

test("a selected scale without a current marker never borrows one from an unscaled pass", () => {
  const first = {
    currentPrice: "",
    priceScaleAnchors: scale,
    levels: [{ kind: "support", price: "7600", y: 60 }],
  };
  const rescue = {
    currentPrice: "7590",
    priceScaleAnchors: [],
    levels: [{ kind: "resistance", price: "7620", y: 55 }],
  };
  assert.equal(recoverPrecisionGeometry(first, rescue)?.currentPrice, "");
});

test("annotated and exponent prices cannot enter recovered exact geometry", () => {
  const precision = {
    priceScaleAnchors: scale,
    levels: [
      { kind: "support", price: "$7600" },
      { kind: "support", price: "7600 USD" },
      { kind: "support", price: "7.6e3" },
      { kind: "support", price: "7600" },
    ],
  };
  assert.deepEqual(recoverPrecisionGeometry({}, precision)?.levels, [{ kind: "support", price: "7600" }]);
});

test("a duplicate from an unscaled rescue cannot displace first-pass geometry", () => {
  const first = {
    priceScaleAnchors: scale,
    levels: [{ kind: "support", label: "first-pass row", price: "7600", y: 60 }],
  };
  const rescue = {
    priceScaleAnchors: [],
    levels: [{ kind: "support", label: "crop-relative row", price: "7600", y: 78 }],
  };
  assert.deepEqual(recoverPrecisionGeometry(first, rescue)?.levels, first.levels);
});

test("does not recover levels without two usable scale labels", () => {
  const precision = { levels: [], priceScaleAnchors: [{ price: 7800, y: 20 }] };
  assert.equal(recoverPrecisionGeometry({ levels: [{ kind: "support", price: "7600" }] }, precision), null);
});

test("a rejected raw precision scale cannot overwrite the verified report current price", () => {
  const report = {
    currentPrice: "100",
    priceScaleAnchors: [{ price: 110, y: 20 }, { price: 100, y: 50 }, { price: 90, y: 80 }],
    levels: [{ kind: "support", price: "85" }, { kind: "support", price: "95" }],
  };
  const rawPrecision = {
    currentPrice: "90",
    priceScaleAnchors: [{ price: 110, y: 20 }, { price: 90, y: 20 }],
    levels: [{ kind: "support", price: "85" }, { kind: "resistance", price: "95" }],
  };
  assert.equal(recoverPrecisionGeometry(report, rawPrecision)?.currentPrice, "100");
});

test("accepts two widely separated exact scale labels", () => {
  const report = {
    currentPrice: "7658",
    plotBounds: { left: 5, top: 10, right: 88, bottom: 88 },
    priceScaleAnchors: [{ price: 7690, y: 34 }, { price: 7650, y: 74 }],
    levels: [{ kind: "support", price: "7650", y: 74 }],
  };
  assert.deepEqual(recoverPrecisionGeometry(report, null)?.levels, report.levels);
});

test("rejects two scale labels that are too close to calibrate safely", () => {
  const report = {
    priceScaleAnchors: [{ price: 7690, y: 34 }, { price: 7680, y: 45 }],
    levels: [{ kind: "support", price: "7680", y: 45 }],
  };
  assert.equal(recoverPrecisionGeometry(report, null), null);
});

test("a verified main-pass scale survives a transient precision-pass failure", () => {
  const report = {
    currentPrice: "7658",
    plotBounds: { left: 5, top: 10, right: 88, bottom: 88 },
    priceScaleAnchors: [{ price: 7690, y: 34 }, { price: 7670, y: 54 }, { price: 7650, y: 74 }],
    levels: [
      { kind: "support", label: "Defended shelf", price: "7650", y: 74 },
      { kind: "resistance", label: "Prior rejection", price: "7680", y: 44 },
    ],
  };

  assert.deepEqual(recoverPrecisionGeometry(report, null), {
    currentPrice: "7658",
    plotBounds: report.plotBounds,
    priceScaleAnchors: report.priceScaleAnchors,
    levels: report.levels,
  });
});

test("a main-pass chart without two scale anchors still fails closed", () => {
  const report = {
    currentPrice: "7658",
    priceScaleAnchors: [{ price: 7690, y: 34 }],
    levels: [{ kind: "support", price: "7650" }],
  };
  assert.equal(recoverPrecisionGeometry(report, null), null);
});

test("an inverted price scale fails closed instead of drawing false levels", () => {
  const report = {
    currentPrice: "7658",
    priceScaleAnchors: [{ price: 7500, y: 20 }, { price: 7800, y: 80 }],
    levels: [{ kind: "support", price: "7600" }],
  };
  assert.equal(recoverPrecisionGeometry(report, null), null);
});

test("accepts equivalent string coordinates and common chart price formats", () => {
  const report = {
    currentPrice: "7 658,25",
    priceScaleAnchors: [{ price: "7’800", y: "20" }, { price: "7,650", y: "50" }, { price: "7,500", y: "80" }],
    levels: [{ kind: "support", price: "7 600,50" }],
  };
  assert.deepEqual(recoverPrecisionGeometry(report, null)?.levels, report.levels);
});

test("rejects scale coordinates outside the chart percentage range", () => {
  const report = {
    priceScaleAnchors: [{ price: 7800, y: -10 }, { price: 7500, y: 130 }],
    levels: [{ kind: "support", price: "7600" }],
  };
  assert.equal(recoverPrecisionGeometry(report, null), null);
});

test("rejects a non-linear three-point scale", () => {
  const report = {
    priceScaleAnchors: [{ price: 7800, y: 20 }, { price: 7650, y: 37 }, { price: 7500, y: 80 }],
    levels: [{ kind: "support", price: "7600", y: 60 }],
  };
  assert.equal(recoverPrecisionGeometry(report, null), null);
});
