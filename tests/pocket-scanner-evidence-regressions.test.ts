import assert from "node:assert/strict";
import test from "node:test";
import { calibratePocketAnalysis } from "../app/api/pocket/analysis-calibration.ts";

const buy = { side: "BUY_SIDE", basis: "EQUAL_HIGHS", price: "7750", x: 18, x2: 82, y: 30 };
const sell = { side: "SELL_SIDE", basis: "EQUAL_LOWS", price: "7600", x: 18, x2: 82, y: 60 };
const observations = [
  { kind: "equal-highs", side: "buy-side", x: 25, y: 30, confidence: "HIGH" },
  { kind: "equal-highs", side: "buy-side", x: 60, y: 30, confidence: "HIGH" },
  { kind: "equal-lows", side: "sell-side", x: 25, y: 60, confidence: "HIGH" },
  { kind: "equal-lows", side: "sell-side", x: 60, y: 60, confidence: "HIGH" },
];
const base = {
  evidenceQuality: { chartReadability: "CLEAR", candlesReadable: true, scaleReadable: true, instrumentConfidence: "HIGH", timeframeConfidence: "HIGH" },
  plotBounds: { left: 5, top: 10, right: 90, bottom: 90 },
  priceScaleAnchors: [{ price: 7800, y: 20 }, { price: 7650, y: 50 }, { price: 7500, y: 80 }],
  levels: [{ kind: "support", price: "7600", x: 18, x2: 82, y: 60, y2: 60 }],
  fibLevels: [{ ratio: "0.5", price: "7650", y: 50 }],
  liquidity: { state: "VERIFIED", event: "NONE", confidence: "HIGH", evidence: "Repeated visible highs and lows.", confirmation: "Visible reaction.", invalidation: "Acceptance beyond the structure.", zones: [buy, sell], observations },
};
type Result = { evidenceQuality: { scaleReadable: boolean }; levels: { price: string }[]; fibLevels: unknown[]; liquidity: { state: string; zones: { side: string; basis: string; price: string }[] } };
const run = (overrides: Record<string, unknown> = {}) => calibratePocketAnalysis({ ...base, ...overrides }) as Result;

test("opposite-side structural bases cannot be certified by otherwise valid screenshot observations", () => {
  for (const [zone, bases] of [[buy, ["EQUAL_LOWS", "PRIOR_SWING_LOW", "RANGE_LOW"]], [sell, ["EQUAL_HIGHS", "PRIOR_SWING_HIGH", "RANGE_HIGH"]]] as const) {
    for (const basis of bases) {
      const result = run({ liquidity: { ...base.liquidity, zones: [{ ...zone, basis }] } });
      assert.equal(result.liquidity.state, "NONE", `${zone.side} / ${basis}`);
      assert.deepEqual(result.liquidity.zones, []);
    }
  }
});

test("both independently corroborated sides and their compatible structural bases remain available", () => {
  for (const [buyBasis, sellBasis] of [["EQUAL_HIGHS", "EQUAL_LOWS"], ["PRIOR_SWING_HIGH", "PRIOR_SWING_LOW"], ["RANGE_HIGH", "RANGE_LOW"]]) {
    const result = run({ liquidity: { ...base.liquidity, zones: [{ ...buy, basis: buyBasis }, { ...sell, basis: sellBasis }] } });
    assert.equal(result.liquidity.state, "VERIFIED");
    assert.deepEqual(result.liquidity.zones.map(zone => zone.side), ["BUY_SIDE", "SELL_SIDE"]);
  }
});

test("conflicting axis labels cannot be silently dropped to manufacture a verified scale", () => {
  for (const conflict of [{ price: 7650, y: 65 }, { price: 7550, y: 50 }]) {
    const result = run({ priceScaleAnchors: [...base.priceScaleAnchors, conflict] });
    assert.equal(result.evidenceQuality.scaleReadable, false);
    assert.ok(result.levels.every(level => level.price === ""));
    assert.ok(result.liquidity.zones.every(zone => zone.price === ""));
    assert.deepEqual(result.fibLevels, []);
  }
});

test("identical repeated axis readings do not erase a valid numeric scale", () => {
  const result = run({ priceScaleAnchors: [...base.priceScaleAnchors, { ...base.priceScaleAnchors[1] }] });
  assert.equal(result.evidenceQuality.scaleReadable, true);
  assert.equal(result.levels[0]?.price, "7600");
  assert.deepEqual(result.liquidity.zones.map(zone => zone.price), ["7750", "7600"]);
});
