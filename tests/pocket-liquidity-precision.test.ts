import assert from "node:assert/strict";
import test from "node:test";
import {
  choosePrecisionLiquidityShield,
  correctedCurrentPrice,
  isPlainNumericPrice,
  normalizePrecisionLiquidityShield,
  numericPrice,
} from "../app/api/pocket/liquidity-precision.ts";

const anchors = [{ price: 3000, y: 20 }, { price: 2900, y: 50 }, { price: 2800, y: 80 }];

function precision(overrides: Record<string, unknown> = {}) {
  return {
    plotBounds: { left: 8, top: 12, right: 88, bottom: 86 },
    priceScaleAnchors: anchors,
    currentPrice: "2900",
    liquidityShield: {
      status: "VISIBLE_RISK_ZONES",
      summary: "Candidate stop-risk cluster.",
      stopGuidance: "Use structural invalidation.",
      zones: [{
        side: "BELOW_PRICE",
        pattern: "EQUAL_LOWS",
        label: "Equal lows",
        priceLow: 2850,
        priceHigh: 2850,
        confidence: "HIGH",
        evidence: "Three wick reactions.",
        touchPoints: [{ x: 25, y: 65 }, { x: 48, y: 65.2 }, { x: 70, y: 64.8 }],
      }],
    },
    ...overrides,
  };
}

test("confirmed and corrected prices accept strict broker numerics only", () => {
  assert.equal(isPlainNumericPrice("18,586.1"), true);
  assert.equal(isPlainNumericPrice("18586.1 approx"), false);
  assert.equal(numericPrice("7 658,25"), 7658.25);
  assert.equal(numericPrice("$7658"), null);
  assert.equal(numericPrice("7658 USD"), null);
  assert.equal(numericPrice("7.658e3"), null);
  assert.equal(correctedCurrentPrice({ categories: ["CURRENT_PRICE"], correction: "Current price: 18,586.1" }), "18,586.1");
  assert.equal(correctedCurrentPrice({ categories: ["SUPPORT"], correction: "18,586.1" }), null);
  assert.equal(correctedCurrentPrice({ categories: ["INSTRUMENT", "CURRENT_PRICE"], correction: "US 500, current 7738" }), null);
  assert.equal(correctedCurrentPrice({ categories: ["CURRENT_PRICE"], correction: "US 500, current 7738" }), null);
  assert.equal(correctedCurrentPrice({ categories: ["CURRENT_PRICE"], correction: "Current price: 7738 and support 7700" }), null);
});

test("server normalizer keeps a scale, side and candle-row verified candidate", () => {
  const shield = normalizePrecisionLiquidityShield(precision(), "2900");
  assert.equal(shield.status, "VISIBLE_RISK_ZONES");
  assert.equal(shield.zones.length, 1);
  assert.equal(shield.zones[0].confidence, "HIGH");
});

test("two anchors, out-of-plot anchors and an off-chart current price fail closed", () => {
  assert.equal(normalizePrecisionLiquidityShield(precision({ priceScaleAnchors: anchors.slice(0, 2) }), "2900").status, "INSUFFICIENT_EVIDENCE");
  assert.equal(normalizePrecisionLiquidityShield(precision({ priceScaleAnchors: [{ price: 3000, y: 5 }, anchors[1], { price: 2800, y: 95 }] }), "2900").status, "INSUFFICIENT_EVIDENCE");
  assert.equal(normalizePrecisionLiquidityShield(precision(), "3100").status, "INSUFFICIENT_EVIDENCE");
});

test("straddling, current-row and over-wide bands are rejected", () => {
  const base = precision().liquidityShield as Record<string, unknown>;
  const candidate = (zone: Record<string, unknown>) => precision({ liquidityShield: { ...base, zones: [zone] } });
  const original = (base.zones as Record<string, unknown>[])[0];
  for (const zone of [
    { ...original, side: "ABOVE_PRICE", priceLow: 2890, priceHigh: 2920 },
    { ...original, side: "BELOW_PRICE", priceLow: 2900, priceHigh: 2900 },
    { ...original, priceLow: 2800, priceHigh: 2860, touchPoints: [{ x: 25, y: 70 }, { x: 70, y: 74 }] },
  ]) assert.equal(normalizePrecisionLiquidityShield(candidate(zone), "2900").status, "INSUFFICIENT_EVIDENCE");
});

test("touch points must be distinct, inside the plot and agree with the projected band", () => {
  const base = precision().liquidityShield as Record<string, unknown>;
  const original = (base.zones as Record<string, unknown>[])[0];
  const candidate = (touchPoints: Array<{ x: number; y: number }>) => precision({ liquidityShield: { ...base, zones: [{ ...original, touchPoints }] } });
  assert.equal(normalizePrecisionLiquidityShield(candidate([{ x: 25, y: 55 }, { x: 70, y: 55 }]), "2900").status, "INSUFFICIENT_EVIDENCE");
  assert.equal(normalizePrecisionLiquidityShield(candidate([{ x: 25, y: 65 }, { x: 25.2, y: 65.1 }]), "2900").status, "INSUFFICIENT_EVIDENCE");
  assert.equal(normalizePrecisionLiquidityShield(candidate([{ x: 2, y: 65 }, { x: 70, y: 65 }]), "2900").status, "INSUFFICIENT_EVIDENCE");
});

test("two verified touches downgrade HIGH to MEDIUM", () => {
  const base = precision().liquidityShield as Record<string, unknown>;
  const original = (base.zones as Record<string, unknown>[])[0];
  const result = normalizePrecisionLiquidityShield(precision({ liquidityShield: { ...base, zones: [{ ...original, touchPoints: [{ x: 25, y: 65 }, { x: 70, y: 65 }] }] } }), "2900");
  assert.equal(result.status, "VISIBLE_RISK_ZONES");
  assert.equal(result.zones[0].confidence, "MEDIUM");
});

test("duplicate rows retain HIGH confidence even when MEDIUM arrives first", () => {
  const base = precision().liquidityShield as Record<string, unknown>;
  const original = (base.zones as Record<string, unknown>[])[0];
  const result = normalizePrecisionLiquidityShield(precision({ liquidityShield: { ...base, zones: [
    { ...original, label: "Medium", confidence: "MEDIUM" },
    { ...original, label: "High", confidence: "HIGH" },
  ] } }), "2900");
  assert.equal(result.zones.length, 1);
  assert.equal(result.zones[0].label, "High");
});

test("rescue selection prefers visible evidence with more observed touches", () => {
  const first = (precision().liquidityShield as Record<string, unknown>);
  const rescue = { ...first, zones: [{ ...(first.zones as Record<string, unknown>[])[0], touchPoints: [{ x: 20, y: 65 }, { x: 40, y: 65 }, { x: 60, y: 65 }, { x: 80, y: 65 }] }] };
  assert.equal(choosePrecisionLiquidityShield(first, rescue, precision(), "2900"), rescue);
});

test("a richer raw rescue cannot replace a first-pass shield when its candle rows fail verification", () => {
  const first = precision().liquidityShield as Record<string, unknown>;
  const firstZone = (first.zones as Record<string, unknown>[])[0];
  const rescue = {
    ...first,
    zones: [{
      ...firstZone,
      label: "Raw rescue with more touches on the wrong row",
      touchPoints: [{ x: 20, y: 55 }, { x: 35, y: 55 }, { x: 50, y: 55 }, { x: 65, y: 55 }, { x: 80, y: 55 }],
    }],
  };

  assert.equal(choosePrecisionLiquidityShield(first, rescue, precision(), "2900"), first);
});

test("a verified no-zone first pass survives an invalid visible rescue", () => {
  const first = {
    status: "NO_VISIBLE_RISK_ZONES",
    summary: "No defensible cluster is visible.",
    stopGuidance: "Use the setup invalidation.",
    zones: [],
  };
  const visible = precision().liquidityShield as Record<string, unknown>;
  const rescue = {
    ...visible,
    zones: (visible.zones as Record<string, unknown>[]).map((zone) => ({
      ...zone,
      touchPoints: [{ x: 25, y: 55 }, { x: 48, y: 55 }, { x: 70, y: 55 }],
    })),
  };

  assert.equal(choosePrecisionLiquidityShield(first, rescue, precision(), "2900"), first);
});
