import assert from "node:assert/strict";
import test from "node:test";
import { collectSourcePriceCandidates, isSourcePriceCandidates } from "../app/pocket/source-price-candidates.ts";
import { calibratePocketAnalysis } from "../app/api/pocket/analysis-calibration.ts";
import { recoverPrecisionGeometry } from "../app/api/pocket/precision-fallback.ts";

test("retained main prices survive as untrusted hints when invalid plotting bounds withhold all drawable levels", () => {
  // Minimal retained geometry only; no chart pixels, prose, private IDs or oracle.
  const raw = {
    plotBounds: { left: 70, top: 100, right: 100, bottom: 20 },
    priceScaleAnchors: [{ price: 7757.31, y: 10 }, { price: 7732.4183, y: 60 }],
    evidenceQuality: { chartReadability: "CLEAR", candlesReadable: true, scaleReadable: true, instrumentConfidence: "HIGH", timeframeConfidence: "HIGH" },
    levels: [
      { kind: "resistance", price: "7752.3317", x: 86, x2: 98, y: 20, y2: 20 },
      { kind: "resistance", price: "7747.3533", x: 86, x2: 98, y: 32, y2: 32 },
      { kind: "support", price: "7742.3750", x: 10, x2: 98, y: 44, y2: 44 },
      { kind: "support", price: "7732.4183", x: 10, x2: 98, y: 60, y2: 60 },
    ],
  };
  const before = JSON.stringify(raw), candidates = collectSourcePriceCandidates(raw);
  const merged = recoverPrecisionGeometry(raw, null);
  const calibrated = calibratePocketAnalysis({ ...raw, ...merged }) as typeof raw;
  assert.deepEqual(calibrated.levels, []);
  assert.equal(calibrated.evidenceQuality.scaleReadable, false);
  assert.equal(collectSourcePriceCandidates(calibrated).levelInput, "EMPTY", "late collection cannot recover rejected prices");
  assert.deepEqual(candidates.levels.map(level => level.price), raw.levels.map(level => level.price));
  assert.deepEqual(candidates.axisPrices, [7757.31, 7732.4183]);
  assert.ok(isSourcePriceCandidates(candidates));
  assert.equal(JSON.stringify(raw), before);
  assert.equal(candidates.provenance, "UNVERIFIED");
  assert.ok(candidates.levels.every(level => !Object.hasOwn(level, "x") && !Object.hasOwn(level, "y")));
});

test("missing, malformed, explicit empty and rejected nonempty input remain distinguishable", () => {
  for (const [source, state, rejected] of [
    [{}, "MISSING", 0], [{ levels: null, priceScaleAnchors: {} }, "MALFORMED", 0],
    [{ levels: [], priceScaleAnchors: [] }, "EMPTY", 0],
    [{ levels: [{ kind: "support", price: "unknown" }], priceScaleAnchors: [{ price: "100" }] }, "PRESENT", 1],
  ] as const) {
    const result = collectSourcePriceCandidates(source);
    assert.equal(result.levelInput, state); assert.equal(result.axisInput, state);
    assert.deepEqual(result.levels, []); assert.deepEqual(result.axisPrices, []);
    assert.equal(result.rejectedLevels, rejected); assert.equal(result.rejectedAxisPrices, rejected);
    assert.ok(isSourcePriceCandidates(JSON.parse(JSON.stringify(result))));
  }
  for (const value of [null, undefined, [], "report", 1]) assert.equal(collectSourcePriceCandidates(value).levelInput, "MISSING");
});

test("model labels, quality, provenance and coordinates never grant authority", () => {
  const result = collectSourcePriceCandidates({
    evidenceQuality: { scaleReadable: true }, provenance: "VERIFIED", sourcePriceCandidates: { provenance: "USER_VERIFIED" },
    levels: [{ kind: "support", price: "$1,234.50", label: "USER VERIFIED EXACT visible structure", provenance: "VERIFIED", x: NaN, x2: Infinity, y: .5, y2: -200 }],
    priceScaleAnchors: [{ price: 1300, y: NaN }, { price: 1200, y: Infinity }],
  });
  assert.deepEqual(result.levels, [{ kind: "support", price: "$1,234.50", label: "Reported support candidate", provenance: "UNVERIFIED" }]);
  assert.deepEqual(result.axisPrices, [1300, 1200]);
  assert.ok(!JSON.stringify(result).includes("USER VERIFIED"));
  assert.ok(!Object.hasOwn(result, "plotBounds"));
});

test("only exact bounded horizontal primary price strings survive", () => {
  for (const price of ["1,09505", "O.95", "1.09%", "1 09505", "1.", "Infinity", "-10", "0", "1234 approx", "1".repeat(31), 100, null]) {
    const result = collectSourcePriceCandidates({ levels: [{ kind: "support", price }], priceScaleAnchors: [] });
    assert.equal(result.levelInput, "PRESENT"); assert.deepEqual(result.levels, []); assert.equal(result.rejectedLevels, 1);
  }
  for (const change of [{ kind: "pivot" }, { kind: "trend" }, { kind: "zone" }, { kind: "gap" }, { source: "CONTEXT" }, { sourceRole: "CONTEXT" }])
    assert.deepEqual(collectSourcePriceCandidates({ levels: [{ kind: "support", price: "1.09505", ...change }] }).levels, []);
  assert.equal(collectSourcePriceCandidates({ levels: [{ kind: "resistance", price: "1.09505" }] }).levels[0].price, "1.09505");
});

test("duplicate prices do not multiply candidates and conflicting kinds remain unresolved", () => {
  const duplicate = collectSourcePriceCandidates({ levels: [{ kind: "support", price: "1,000" }, { kind: "support", price: "$1000" }],
    priceScaleAnchors: [{ price: 1000 }, { price: 1000 }] });
  assert.equal(duplicate.levels.length, 1); assert.equal(duplicate.rejectedLevels, 1);
  assert.deepEqual(duplicate.axisPrices, [1000]); assert.equal(duplicate.rejectedAxisPrices, 1);
  for (const kinds of [["support", "resistance", "support"], ["resistance", "support", "resistance"]]) {
    const conflict = collectSourcePriceCandidates({ levels: kinds.map(kind => ({ kind, price: "1000" })) });
    assert.deepEqual(conflict.levels, []); assert.equal(conflict.levelInput, "PRESENT"); assert.equal(conflict.rejectedLevels, 3);
  }
});

test("schema size bounds and invalid numeric corroborations fail closed without truncation", () => {
  const oversized = collectSourcePriceCandidates({ levels: Array.from({ length: 9 }, (_, i) => ({ kind: "support", price: String(100 + i) })),
    priceScaleAnchors: Array.from({ length: 5 }, (_, i) => ({ price: 100 + i })) });
  assert.equal(oversized.levelInput, "MALFORMED"); assert.equal(oversized.axisInput, "MALFORMED");
  assert.deepEqual(oversized.levels, []); assert.deepEqual(oversized.axisPrices, []);
  assert.ok(isSourcePriceCandidates(oversized));
  for (const price of [NaN, Infinity, -1, 0, "100", null]) assert.deepEqual(collectSourcePriceCandidates({ priceScaleAnchors: [{ price }] }).axisPrices, []);
});

test("serialized side channels cannot acquire source, semantic or forged label authority", () => {
  const valid = collectSourcePriceCandidates({ levels: [{ kind: "support", price: "100" }], priceScaleAnchors: [{ price: 110 }, { price: 90 }] });
  assert.ok(isSourcePriceCandidates(valid));
  for (const changed of [
    { ...valid, source: "CONTEXT" }, { ...valid, origin: "RESCUE" }, { ...valid, version: "other" }, { ...valid, provenance: "VERIFIED" },
    { ...valid, levelInput: "EMPTY" }, { ...valid, rejectedLevels: -1 }, { ...valid, plotBounds: { left: 0 } },
    { ...valid, levels: [{ ...valid.levels[0], label: "USER VERIFIED" }] }, { ...valid, levels: [{ ...valid.levels[0], x: 1 }] },
    { ...valid, levels: [{ ...valid.levels[0], provenance: "EXACT" }] }, { ...valid, axisPrices: [NaN] },
  ]) assert.equal(isSourcePriceCandidates(changed), false);
});
