import test from "node:test";
import assert from "node:assert/strict";
import { calibratePocketAnalysis } from "../app/api/pocket/analysis-calibration.ts";

function base(liquidity: unknown, overrides: Record<string, unknown> = {}) {
  return {
    evidenceQuality: { chartReadability: "CLEAR", candlesReadable: true, scaleReadable: true, instrumentConfidence: "HIGH", timeframeConfidence: "HIGH" },
    setupScore: { overall: 62 },
    plotBounds: { left: 5, top: 10, right: 90, bottom: 90 },
    priceScaleAnchors: [{ price: 7800, y: 20 }, { price: 7650, y: 50 }, { price: 7500, y: 80 }],
    levels: [],
    liquidity,
    ...overrides,
  };
}

const good = {
  state: "VERIFIED",
  event: "SWEEP",
  confidence: "HIGH",
  evidence: "Two prior highs formed a visible pool and price traded above them before closing back below.",
  confirmation: "The rejection continues below the swept highs.",
  invalidation: "Price accepts back above the swept area.",
  observations: [
    { kind: "equal-highs", side: "buy-side", x: 25, y: 30, confidence: "HIGH" },
    { kind: "equal-highs", side: "buy-side", x: 60, y: 30, confidence: "HIGH" },
  ],
  zones: [{ side: "BUY_SIDE", basis: "EQUAL_HIGHS", price: "7750", x: 18, x2: 82, y: 30 }],
};

test("keeps a scale-aligned visible liquidity structure", () => {
  const calibrated = calibratePocketAnalysis(base(good)) as { liquidity: { state: string; zones: { price: string }[] } };
  assert.equal(calibrated.liquidity.state, "VERIFIED");
  assert.equal(calibrated.liquidity.zones.length, 1);
  assert.equal(calibrated.liquidity.zones[0]?.price, "7750");
});

test("fails closed when a numeric liquidity row contradicts the verified price scale", () => {
  const bad = { ...good, zones: [{ ...good.zones[0], price: "7500", y: 25 }] };
  const calibrated = calibratePocketAnalysis(base(bad)) as { liquidity: { state: string; zones: unknown[] } };
  assert.equal(calibrated.liquidity.state, "NONE");
  assert.deepEqual(calibrated.liquidity.zones, []);
});

test("keeps chart-relative evidence but strips numeric price when the scale is unverified", () => {
  const calibrated = calibratePocketAnalysis(base(good, { priceScaleAnchors: [] })) as { liquidity: { state: string; zones: { price: string }[] } };
  assert.equal(calibrated.liquidity.state, "VERIFIED");
  assert.equal(calibrated.liquidity.zones[0]?.price, "");
});

test("downgrades low-confidence verified claims to partial", () => {
  const calibrated = calibratePocketAnalysis(base({ ...good, confidence: "LOW" })) as { liquidity: { state: string } };
  assert.equal(calibrated.liquidity.state, "PARTIAL");
});

test("removes liquidity claims when candles are unreadable", () => {
  const calibrated = calibratePocketAnalysis(base(good, {
    evidenceQuality: { chartReadability: "POOR", candlesReadable: false, scaleReadable: false, instrumentConfidence: "LOW", timeframeConfidence: "UNKNOWN" },
  })) as { liquidity: { state: string; zones: unknown[] } };
  assert.equal(calibrated.liquidity.state, "NONE");
  assert.deepEqual(calibrated.liquidity.zones, []);
});
