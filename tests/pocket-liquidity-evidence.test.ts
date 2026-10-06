import assert from "node:assert/strict";
import test from "node:test";
import { assessLiquidity, type LiquidityInput } from "../app/pocket/liquidity-evidence.ts";

const clear = (overrides: Partial<LiquidityInput> = {}): LiquidityInput => ({
  chartReadability: "CLEAR",
  candlesReadable: true,
  plotBoundsVerified: true,
  evidence: [
    { kind: "equal-highs", side: "buy-side", x: 20, y: 25, confidence: "HIGH" },
    { kind: "rejection", side: "buy-side", x: 70, y: 26, confidence: "MEDIUM" },
  ],
  ...overrides,
});

test("verifies a zone only from repeated spatially separated screenshot evidence", () => {
  const result = assessLiquidity(clear());
  assert.equal(result.status, "VERIFIED");
  assert.equal(result.zones.length, 1);
  assert.equal(result.zones[0].side, "buy-side");
  assert.equal(result.zones[0].y, 25.5);
});

test("fails closed when chart readability is partial or poor", () => {
  for (const chartReadability of ["PARTIAL", "POOR"] as const) {
    const result = assessLiquidity(clear({ chartReadability }));
    assert.equal(result.status, "BLOCKED");
    assert.deepEqual(result.zones, []);
  }
});

test("fails closed when candles or plot bounds are not verified", () => {
  assert.equal(assessLiquidity(clear({ candlesReadable: false })).status, "BLOCKED");
  assert.equal(assessLiquidity(clear({ plotBoundsVerified: false })).status, "BLOCKED");
});

test("never emits a zone from a single observation", () => {
  const result = assessLiquidity(clear({ evidence: [{ kind: "equal-highs", side: "buy-side", x: 20, y: 25, confidence: "HIGH" }] }));
  assert.equal(result.status, "BLOCKED");
  assert.deepEqual(result.zones, []);
});

test("low-confidence observations cannot manufacture a zone", () => {
  const result = assessLiquidity(clear({ evidence: [
    { kind: "equal-highs", side: "buy-side", x: 20, y: 25, confidence: "LOW" },
    { kind: "rejection", side: "buy-side", x: 70, y: 25, confidence: "LOW" },
  ] }));
  assert.equal(result.status, "BLOCKED");
  assert.deepEqual(result.zones, []);
});

test("near-duplicate x observations do not count as independent evidence", () => {
  const result = assessLiquidity(clear({ evidence: [
    { kind: "equal-highs", side: "buy-side", x: 20, y: 25, confidence: "HIGH" },
    { kind: "rejection", side: "buy-side", x: 22, y: 25.5, confidence: "HIGH" },
  ] }));
  assert.equal(result.status, "BLOCKED");
  assert.deepEqual(result.zones, []);
});

test("out-of-bounds or non-finite geometry blocks the whole assessment", () => {
  for (const bad of [-1, 101, Number.NaN, Number.POSITIVE_INFINITY]) {
    const result = assessLiquidity(clear({ evidence: [
      { kind: "equal-highs", side: "buy-side", x: bad, y: 25, confidence: "HIGH" },
      { kind: "rejection", side: "buy-side", x: 70, y: 25, confidence: "HIGH" },
    ] }));
    assert.equal(result.status, "BLOCKED");
    assert.deepEqual(result.zones, []);
  }
});

test("opposite-side evidence cannot be combined into a fake zone", () => {
  const result = assessLiquidity(clear({ evidence: [
    { kind: "equal-highs", side: "buy-side", x: 20, y: 25, confidence: "HIGH" },
    { kind: "equal-lows", side: "sell-side", x: 70, y: 25, confidence: "HIGH" },
  ] }));
  assert.equal(result.status, "BLOCKED");
  assert.deepEqual(result.zones, []);
});

test("widely separated y evidence cannot be averaged into a fake zone", () => {
  const result = assessLiquidity(clear({ evidence: [
    { kind: "equal-highs", side: "buy-side", x: 20, y: 20, confidence: "HIGH" },
    { kind: "rejection", side: "buy-side", x: 70, y: 40, confidence: "HIGH" },
  ] }));
  assert.equal(result.status, "BLOCKED");
  assert.deepEqual(result.zones, []);
});

test("engine outputs image-relative geometry only and never invents prices", () => {
  const result = assessLiquidity(clear());
  assert.equal(result.status, "VERIFIED");
  for (const zone of result.zones) {
    assert.ok(zone.y >= 0 && zone.y <= 100);
    assert.equal("price" in zone, false);
  }
});

test("supports independently verified buy-side and sell-side zones", () => {
  const result = assessLiquidity(clear({ evidence: [
    { kind: "equal-highs", side: "buy-side", x: 15, y: 20, confidence: "HIGH" },
    { kind: "rejection", side: "buy-side", x: 65, y: 21, confidence: "HIGH" },
    { kind: "equal-lows", side: "sell-side", x: 25, y: 80, confidence: "HIGH" },
    { kind: "sweep-reclaim", side: "sell-side", x: 75, y: 79, confidence: "HIGH" },
  ] }));
  assert.equal(result.status, "VERIFIED");
  assert.deepEqual(result.zones.map((zone) => zone.side).sort(), ["buy-side", "sell-side"]);
});
