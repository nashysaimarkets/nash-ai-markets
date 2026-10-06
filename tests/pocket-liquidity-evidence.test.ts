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


test("input order cannot change the assessment", () => {
  const evidence = [
    { kind: "equal-highs" as const, side: "buy-side" as const, x: 12, y: 22, confidence: "HIGH" as const },
    { kind: "rejection" as const, side: "buy-side" as const, x: 72, y: 23, confidence: "MEDIUM" as const },
    { kind: "equal-lows" as const, side: "sell-side" as const, x: 18, y: 78, confidence: "HIGH" as const },
    { kind: "sweep-reclaim" as const, side: "sell-side" as const, x: 82, y: 79, confidence: "HIGH" as const },
  ];
  const forward = assessLiquidity(clear({ evidence }));
  const reverse = assessLiquidity(clear({ evidence: [...evidence].reverse() }));
  assert.deepEqual(reverse, forward);
});

test("extreme but valid edge coordinates remain bounded", () => {
  const result = assessLiquidity(clear({ evidence: [
    { kind: "equal-highs", side: "buy-side", x: 0, y: 0, confidence: "HIGH" },
    { kind: "rejection", side: "buy-side", x: 100, y: 3, confidence: "HIGH" },
  ] }));
  assert.equal(result.status, "VERIFIED");
  assert.ok(result.zones[0].y >= 0 && result.zones[0].y <= 100);
});

test("evidence just outside the clustering tolerance cannot become a zone", () => {
  const result = assessLiquidity(clear({ evidence: [
    { kind: "equal-highs", side: "buy-side", x: 10, y: 25, confidence: "HIGH" },
    { kind: "rejection", side: "buy-side", x: 90, y: 28.01, confidence: "HIGH" },
  ] }));
  assert.equal(result.status, "BLOCKED");
  assert.deepEqual(result.zones, []);
});

test("evidence exactly at the clustering tolerance is accepted", () => {
  const result = assessLiquidity(clear({ evidence: [
    { kind: "equal-highs", side: "buy-side", x: 10, y: 25, confidence: "HIGH" },
    { kind: "rejection", side: "buy-side", x: 90, y: 28, confidence: "HIGH" },
  ] }));
  assert.equal(result.status, "VERIFIED");
});

test("five-percent x separation is the minimum independent spacing", () => {
  const accepted = assessLiquidity(clear({ evidence: [
    { kind: "equal-highs", side: "buy-side", x: 10, y: 25, confidence: "HIGH" },
    { kind: "rejection", side: "buy-side", x: 15, y: 25, confidence: "HIGH" },
  ] }));
  const rejected = assessLiquidity(clear({ evidence: [
    { kind: "equal-highs", side: "buy-side", x: 10, y: 25, confidence: "HIGH" },
    { kind: "rejection", side: "buy-side", x: 14.99, y: 25, confidence: "HIGH" },
  ] }));
  assert.equal(accepted.status, "VERIFIED");
  assert.equal(rejected.status, "BLOCKED");
});

test("one strong observation plus low-confidence noise still fails closed", () => {
  const result = assessLiquidity(clear({ evidence: [
    { kind: "equal-highs", side: "buy-side", x: 10, y: 25, confidence: "HIGH" },
    { kind: "rejection", side: "buy-side", x: 70, y: 25, confidence: "LOW" },
    { kind: "sweep-reclaim", side: "buy-side", x: 90, y: 26, confidence: "LOW" },
  ] }));
  assert.equal(result.status, "BLOCKED");
  assert.deepEqual(result.zones, []);
});


test("chained y-clusters are deterministic across every input permutation", () => {
  const a = { kind: "equal-highs" as const, side: "buy-side" as const, x: 10, y: 20, confidence: "HIGH" as const };
  const b = { kind: "rejection" as const, side: "buy-side" as const, x: 50, y: 23, confidence: "HIGH" as const };
  const c = { kind: "sweep-reclaim" as const, side: "buy-side" as const, x: 90, y: 26, confidence: "HIGH" as const };
  const permutations = [
    [a, b, c], [a, c, b], [b, a, c],
    [b, c, a], [c, a, b], [c, b, a],
  ];
  const baseline = assessLiquidity(clear({ evidence: permutations[0] }));
  for (const evidence of permutations.slice(1)) {
    assert.deepEqual(assessLiquidity(clear({ evidence })), baseline);
  }
});

test("one invalid observation blocks an otherwise defensible liquidity zone", () => {
  const result = assessLiquidity(clear({ evidence: [
    { kind: "equal-highs", side: "buy-side", x: 10, y: 25, confidence: "HIGH" },
    { kind: "rejection", side: "buy-side", x: 80, y: 26, confidence: "HIGH" },
    { kind: "rejection", side: "buy-side", x: 101, y: 25, confidence: "LOW" },
  ] }));
  assert.equal(result.status, "BLOCKED");
  assert.deepEqual(result.zones, []);
  assert.deepEqual(result.reasons, ["INVALID_EVIDENCE_GEOMETRY"]);
});
