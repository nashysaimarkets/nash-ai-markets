import assert from "node:assert/strict";
import test from "node:test";
import { calibratePocketAnalysis } from "../app/api/pocket/analysis-calibration.ts";
import { assessProductionLiquidityChain } from "../app/api/pocket/liquidity-chain.ts";
import { originalPixelLevels, type OriginalLevelReport } from "../app/pocket/original-pixel-levels.ts";

type Calibrated = {
  plotBounds?: unknown;
  priceScaleAnchors: unknown;
  evidenceQuality: { scaleReadable: boolean };
  levels: Array<Record<string, unknown>>;
  fibLevels: unknown[];
  liquidity: { state: string; event: string; zones: []; observations?: unknown; evidenceChain?: { status: string; reasons: string[] } };
};
const witnesses = [
  { kind: "equal-highs", side: "buy-side", x: 25, y: 30, confidence: "HIGH" },
  { kind: "equal-highs", side: "buy-side", x: 60, y: 30, confidence: "HIGH" },
];
function fixture() {
  return {
    evidenceQuality: { chartReadability: "CLEAR", candlesReadable: true, scaleReadable: true, instrumentConfidence: "HIGH", timeframeConfidence: "HIGH" },
    plotBounds: { left: 5, top: 10, right: 90, bottom: 90 },
    priceScaleAnchors: [{ price: 7800, y: 20 }, { price: 7650, y: 50 }, { price: 7500, y: 80 }],
    levels: [{ kind: "support", label: "Synthetic reference", price: "7650", x: 5, y: 50, x2: 90, y2: 50 }],
    fibLevels: [{ ratio: "0.5", price: "7650", y: 50 }],
    liquidity: { state: "VERIFIED", event: "REJECTION", confidence: "HIGH", evidence: "Synthetic repeated highs",
      confirmation: "Synthetic condition", invalidation: "Synthetic condition", observations: witnesses,
      zones: [{ side: "BUY_SIDE", basis: "EQUAL_HIGHS", price: "7750", x: 18, x2: 82, y: 30 }] },
  };
}
const calibrate = (value: unknown) => calibratePocketAnalysis(value) as Calibrated;
const finalChain = (result: Calibrated) => assessProductionLiquidityChain(
  result.liquidity.observations, result.evidenceQuality, result.plotBounds, result.liquidity.zones,
);

test("retained main inverted bounds stay invalid instead of manufacturing bottom101 and a readable scale", () => {
  // Minimal geometry/readability from the retained completed main response.
  // Raw provenance is recorded separately; no chart image or prose is copied.
  const input = {
    evidenceQuality: fixture().evidenceQuality,
    plotBounds: { left: 70, top: 100, right: 100, bottom: 20 },
    priceScaleAnchors: [{ price: 7757.31, y: 10 }, { price: 7732.4183, y: 60 }],
    levels: [
      { kind: "resistance", price: "7752.3317", x: 86, y: 20, x2: 98, y2: 20 },
      { kind: "resistance", price: "7747.3533", x: 86, y: 32, x2: 98, y2: 32 },
      { kind: "support", price: "7742.3750", x: 10, y: 44, x2: 98, y2: 44 },
      { kind: "support", price: "7732.4183", x: 10, y: 60, x2: 98, y2: 60 },
    ],
  };
  const before = structuredClone(input), result = calibrate(input);
  assert.deepEqual(result.plotBounds, input.plotBounds);
  assert.deepEqual(result.priceScaleAnchors, input.priceScaleAnchors);
  assert.equal(result.evidenceQuality.scaleReadable, false);
  assert.deepEqual(result.levels, []);
  assert.deepEqual(result.fibLevels, []);
  assert.deepEqual(finalChain(result), { status: "BLOCKED", zones: [], reasons: ["PLOT_BOUNDS_UNVERIFIED"] });
  assert.deepEqual(input, before, "The retained model fields must not be rewritten");
});

const invalidBounds: [string, unknown][] = [
  ["missing", undefined], ["null", null], ["empty object", {}], ["array", []], ["text", "unreadable"],
  ["missing edge", { left: 5, top: 10, right: 90 }],
  ["numeric string", { left: "5", top: 10, right: 90, bottom: 90 }],
  ["nonfinite", { left: 5, top: NaN, right: 90, bottom: 90 }],
  ["infinite", { left: 5, top: 10, right: Infinity, bottom: 90 }],
  ["negative", { left: -1, top: 10, right: 90, bottom: 90 }],
  ["above100", { left: 5, top: 10, right: 101, bottom: 90 }],
  ["inverted horizontal", { left: 90, top: 10, right: 5, bottom: 90 }],
  ["inverted vertical", { left: 5, top: 90, right: 90, bottom: 10 }],
  ["zero width", { left: 100, top: 10, right: 100, bottom: 90 }],
  ["zero height", { left: 5, top: 50, right: 90, bottom: 50 }],
];

test("invalid bounds cannot be repaired by defaulting or clamping despite three consistent anchors", () => {
  for (const [label, plotBounds] of invalidBounds) {
    const input = { ...fixture(), plotBounds }, before = structuredClone(input);
    const result = calibrate(input);
    assert.deepEqual(result.plotBounds, plotBounds, label);
    assert.deepEqual(result.priceScaleAnchors, input.priceScaleAnchors, label);
    assert.equal(result.evidenceQuality.scaleReadable, false, label);
    assert.deepEqual(result.levels, [], label);
    assert.deepEqual(result.fibLevels, [], label);
    assert.equal(result.liquidity.state, "PARTIAL", label);
    assert.deepEqual(result.liquidity.zones, [], label);
    assert.deepEqual(result.liquidity.observations, witnesses, label);
    assert.deepEqual(finalChain(result), { status: "BLOCKED", zones: [], reasons: ["PLOT_BOUNDS_UNVERIFIED"] }, label);
    assert.deepEqual(input, before, label);
  }
});

test("an omitted bounds property stays omitted while all dependent geometry is withheld", () => {
  const { plotBounds: _bounds, ...input } = fixture();
  const result = calibrate(input);
  assert.equal(Object.hasOwn(result, "plotBounds"), false);
  assert.equal(Object.hasOwn(JSON.parse(JSON.stringify(result)), "plotBounds"), false);
  assert.equal(result.evidenceQuality.scaleReadable, false);
  assert.deepEqual(result.levels, []);
  assert.deepEqual(result.fibLevels, []);
});

test("missing or malformed level arrays do not bypass the invalid-bounds scale gate", () => {
  for (const levels of [undefined, null, {}]) {
    const result = calibrate({ ...fixture(), plotBounds: { left: 70, top: 100, right: 100, bottom: 20 }, levels });
    assert.equal(result.evidenceQuality.scaleReadable, false);
    assert.deepEqual(result.levels, []);
    assert.deepEqual(result.fibLevels, []);
    assert.deepEqual(result.plotBounds, { left: 70, top: 100, right: 100, bottom: 20 });
  }
});

test("invalid-bound liquidity stays blocked and preserves empty, missing, malformed and rejected witnesses", () => {
  for (const observations of [[], undefined, null, {}, [null], witnesses]) {
    const input = { ...fixture(), plotBounds: {}, liquidity: { ...fixture().liquidity, observations } };
    const result = calibrate(input);
    assert.equal(result.liquidity.state, "PARTIAL");
    assert.equal(result.liquidity.event, "NONE");
    assert.deepEqual(result.liquidity.zones, []);
    assert.deepEqual(result.liquidity.observations, observations);
    assert.deepEqual(result.liquidity.evidenceChain, { status: "BLOCKED", reasons: ["PLOT_BOUNDS_UNVERIFIED"] });
    assert.deepEqual(finalChain(result), { status: "BLOCKED", zones: [], reasons: ["PLOT_BOUNDS_UNVERIFIED"] });
    assert.equal("noSignal" in result, false);
    if (observations === undefined) assert.equal("observations" in JSON.parse(JSON.stringify(result)).liquidity, false);
  }
});

test("a reported NONE does not turn invalid bounds into a verified empty result", () => {
  const result = calibrate({ ...fixture(), plotBounds: null, liquidity: { ...fixture().liquidity, state: "NONE", observations: [], zones: [] } });
  assert.equal(result.liquidity.state, "NONE");
  assert.deepEqual(result.liquidity.observations, []);
  assert.equal(result.evidenceQuality.scaleReadable, false);
  assert.equal(finalChain(result).status, "BLOCKED");
  assert.equal("noSignal" in result, false);
});

test("calibration cannot make empty bounds eligible for independent original-pixel placement", () => {
  const base = fixture(), axis = { status: "verified" as const, anchors: base.priceScaleAnchors, matchedModelTicks: 3, axisLeft: 950 };
  const good = calibrate(base) as unknown as OriginalLevelReport;
  assert.equal(originalPixelLevels(good, true, axis, 1000, 1000).levels.length, 1, "Positive placement control");
  const invalid = calibrate({ ...base, plotBounds: {} }) as unknown as OriginalLevelReport;
  assert.equal(originalPixelLevels(invalid, true, axis, 1000, 1000).levels.length, 0);
});

test("valid percentage geometry keeps existing calibration and verified liquidity behavior", () => {
  const input = fixture(), result = calibrate(input);
  assert.deepEqual(result.plotBounds, input.plotBounds);
  assert.equal(result.evidenceQuality.scaleReadable, true);
  assert.deepEqual(result.levels, input.levels);
  assert.deepEqual(result.fibLevels, input.fibLevels);
  assert.equal(result.liquidity.state, "VERIFIED");
  assert.equal(finalChain(result).status, "VERIFIED");
});

test("retained fractional coordinates stay literal percentages without a minimum-size repair or unit guess", () => {
  const plotBounds = { left: 0.057, top: 0.124, right: 0.936, bottom: 0.703 };
  const priceScaleAnchors = [{ price: 7757.31, y: 0.1628 }, { price: 7747.3533, y: 0.397 }, { price: 7727.44, y: 0.6771 }];
  const result = calibrate({ ...fixture(), plotBounds, priceScaleAnchors, levels: [] });
  assert.deepEqual(result.plotBounds, plotBounds);
  assert.deepEqual(result.priceScaleAnchors, priceScaleAnchors);
  assert.equal(result.evidenceQuality.scaleReadable, false);
});

test("non-object analysis inputs retain their existing no-crash behavior", () => {
  for (const value of [undefined, null, false, 0, "unreadable"]) assert.equal(calibratePocketAnalysis(value), value);
});
