import test from "node:test";
import assert from "node:assert/strict";
import { calibratePocketAnalysis } from "../app/api/pocket/analysis-calibration.ts";

const highs = [
  { kind: "equal-highs", side: "buy-side", x: 25, y: 30, confidence: "HIGH" },
  { kind: "equal-highs", side: "buy-side", x: 60, y: 30, confidence: "HIGH" },
];
function analyse(observations: unknown[], event = "SWEEP", side = "BUY_SIDE") {
  const result = calibratePocketAnalysis({
    evidenceQuality: { chartReadability: "CLEAR", candlesReadable: true, scaleReadable: true, instrumentConfidence: "HIGH", timeframeConfidence: "HIGH" },
    plotBounds: { left: 5, top: 10, right: 90, bottom: 90 },
    priceScaleAnchors: [{ price: 7800, y: 20 }, { price: 7650, y: 50 }, { price: 7500, y: 80 }],
    levels: [],
    liquidity: { state: "VERIFIED", event, confidence: "HIGH", evidence: "Repeated visible extremes.", confirmation: "Reaction needs a visible witness.", invalidation: "Acceptance beyond the extremes.", observations,
      zones: [{ side, basis: side === "BUY_SIDE" ? "EQUAL_HIGHS" : "EQUAL_LOWS", price: "7750", x: 18, x2: 82, y: 30 }] },
  }) as { liquidity: { state: string; event: string; zones: unknown[] } };
  return result.liquidity;
}

test("a verified repeated-high pool does not certify a sweep from prose alone", () => {
  const result = analyse(highs);
  assert.equal(result.state, "VERIFIED");
  assert.equal(result.zones.length, 1);
  assert.equal(result.event, "NONE");
});

test("event kind, side, row and confidence must match the defended pool", () => {
  for (const event of [
    { kind: "rejection", side: "buy-side", x: 75, y: 30, confidence: "HIGH" },
    { kind: "sweep-reclaim", side: "sell-side", x: 75, y: 30, confidence: "HIGH" },
    { kind: "sweep-reclaim", side: "buy-side", x: 75, y: 50, confidence: "HIGH" },
    { kind: "sweep-reclaim", side: "buy-side", x: 75, y: 30, confidence: "LOW" },
  ]) assert.equal(analyse([...highs, event]).event, "NONE", JSON.stringify(event));
});

test("a sweep must occur after the two visible extrema, never before or at them", () => {
  for (const x of [20, 25, 40, 60]) assert.equal(analyse([...highs, { kind: "sweep-reclaim", side: "buy-side", x, y: 30, confidence: "HIGH" }]).event, "NONE", String(x));
});

test("two distinct same-side structural observations are required before the event", () => {
  for (const observations of [
    [{ ...highs[0] }, { ...highs[0] }, { kind: "sweep-reclaim", side: "buy-side", x: 75, y: 30, confidence: "HIGH" }],
    [{ ...highs[0] }, { kind: "rejection", side: "buy-side", x: 60, y: 30, confidence: "HIGH" }, { kind: "sweep-reclaim", side: "buy-side", x: 75, y: 30, confidence: "HIGH" }],
  ]) assert.equal(analyse(observations).event, "NONE");
});

test("explicit later matching observations retain sweep, reclaim and rejection events", () => {
  for (const side of ["buy-side", "sell-side"]) {
    const structural = highs.map(p => ({ ...p, side, kind: side === "buy-side" ? "equal-highs" : "equal-lows" }));
    for (const event of ["SWEEP", "RECLAIM", "REJECTION"]) {
      const witness = { kind: event === "REJECTION" ? "rejection" : "sweep-reclaim", side, x: 75, y: 30, confidence: "MEDIUM" };
      assert.equal(analyse([...structural, witness], event, side === "buy-side" ? "BUY_SIDE" : "SELL_SIDE").event, event);
    }
  }
});

test("an unrequested event is never manufactured from an observation", () => {
  assert.equal(analyse([...highs, { kind: "sweep-reclaim", side: "buy-side", x: 75, y: 30, confidence: "HIGH" }], "NONE").event, "NONE");
});
