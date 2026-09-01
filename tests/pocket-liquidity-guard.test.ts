import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  parseLiquidityCurrentPrice,
  parseLiquidityPriceRange,
  projectLiquidityPrice,
  projectLiquidityZones,
  verifiedLiquidityScale,
  type LiquidityShield,
} from "../app/pocket/liquidity-guard.ts";

const bounds = { left: 8, top: 12, right: 88, bottom: 86 };
const anchors = [{ price: 3000, y: 20 }, { price: 2900, y: 50 }, { price: 2800, y: 80 }];

function shield(zones: LiquidityShield["zones"]): LiquidityShield {
  return { status: "VISIBLE_RISK_ZONES", summary: "Visible clustered reactions.", zones, stopGuidance: "Use decisive invalidation." };
}

function zone(overrides: Partial<LiquidityShield["zones"][number]> = {}): LiquidityShield["zones"][number] {
  return {
    side: "BELOW_PRICE",
    pattern: "EQUAL_LOWS",
    label: "Equal lows",
    priceLow: 2850,
    priceHigh: 2850,
    touchPoints: [{ x: 28, y: 65 }, { x: 61, y: 65.4 }],
    confidence: "HIGH",
    evidence: "Three aligned wick lows",
    ...overrides,
  };
}

test("strict price parser accepts exact broker grouping and rejects ambiguous or annotated values", () => {
  assert.equal(parseLiquidityCurrentPrice("79,242"), 79242);
  assert.equal(parseLiquidityCurrentPrice("2,905.5"), 2905.5);
  assert.equal(parseLiquidityCurrentPrice("£7 800"), 7800);
  assert.equal(parseLiquidityCurrentPrice("7’800"), 7800);
  assert.equal(parseLiquidityCurrentPrice("18586,1"), 18586.1);
  assert.equal(parseLiquidityCurrentPrice("1.234,56"), null);
  assert.equal(parseLiquidityCurrentPrice("2,905 approx"), null);
  assert.equal(parseLiquidityCurrentPrice("79.2K"), null);
  assert.equal(parseLiquidityCurrentPrice("2900 / 2901 bid ask"), null);
  assert.equal(parseLiquidityCurrentPrice("2840–2860"), null);
  assert.deepEqual(parseLiquidityPriceRange("2,840–2,860"), [2840, 2860]);
  assert.deepEqual(parseLiquidityPriceRange("2850 (2 touches)"), []);
});

test("verified scale accepts a widely separated two-label mobile axis and rejects tight or inconsistent fits", () => {
  assert.ok(verifiedLiquidityScale(anchors, bounds));
  assert.ok(verifiedLiquidityScale(anchors.slice(0, 2), bounds));
  assert.equal(verifiedLiquidityScale([{ price: 3000, y: 35 }, { price: 2900, y: 50 }], bounds), null);
  assert.equal(verifiedLiquidityScale([{ price: 2900, y: 45 }, { price: 2950, y: 50 }, { price: 3000, y: 55 }], bounds), null);
  assert.equal(verifiedLiquidityScale([{ price: 2800, y: 80 }, { price: 2900, y: 55 }, { price: 3000, y: 15 }], bounds), null);
  assert.equal(verifiedLiquidityScale([{ price: 3000, y: 5 }, { price: 2900, y: 50 }, { price: 2800, y: 95 }], bounds), null);
});

test("single-price pools project to the exact verified price row", () => {
  const result = projectLiquidityZones(shield([zone()]), "2900", anchors, bounds);
  assert.equal(result.length, 1);
  assert.equal(result[0].lineY, 65);
  assert.equal(result[0].left, bounds.left);
  assert.equal(result[0].right, bounds.right);
});

test("tight structured price ranges become scale-derived bands", () => {
  const result = projectLiquidityZones(shield([zone({
    priceLow: 2845,
    priceHigh: 2855,
    touchPoints: [{ x: 31, y: 64.5 }, { x: 70, y: 65.7 }],
  })]), "2900", anchors, bounds);
  assert.equal(result.length, 1);
  assert.equal(result[0].priceLow, 2845);
  assert.equal(result[0].priceHigh, 2855);
  assert.equal(result[0].height, 3);
  assert.equal(result[0].lineY, 65);
});

test("above-price pools and current price use the same calibrated scale", () => {
  const result = projectLiquidityZones(shield([zone({
    side: "ABOVE_PRICE",
    pattern: "EQUAL_HIGHS",
    label: "Equal highs",
    priceLow: 2950,
    priceHigh: 2950,
    touchPoints: [{ x: 35, y: 35 }, { x: 64, y: 34.8 }],
  })]), "2900", anchors, bounds);
  assert.equal(result.length, 1);
  assert.equal(result[0].lineY, 35);
  assert.equal(projectLiquidityPrice(2900, anchors, bounds), 50);
});

test("current price must be one exact value that projects inside the visible plot", () => {
  assert.deepEqual(projectLiquidityZones(shield([zone()]), "3100", anchors, bounds), []);
  assert.deepEqual(projectLiquidityZones(shield([zone()]), "2900 approx", anchors, bounds), []);
  assert.deepEqual(projectLiquidityZones(shield([zone()]), "2899–2901", anchors, bounds), []);
});

test("every range endpoint must sit strictly on its declared side of current price", () => {
  assert.deepEqual(projectLiquidityZones(shield([zone({ side: "ABOVE_PRICE", priceLow: 2890, priceHigh: 2920 })]), "2900", anchors, bounds), []);
  assert.deepEqual(projectLiquidityZones(shield([zone({ side: "BELOW_PRICE", priceLow: 2880, priceHigh: 2910 })]), "2900", anchors, bounds), []);
  assert.deepEqual(projectLiquidityZones(shield([zone({ side: "ABOVE_PRICE", priceLow: 2900, priceHigh: 2900 })]), "2900", anchors, bounds), []);
  assert.deepEqual(projectLiquidityZones(shield([zone({ side: "BELOW_PRICE", priceLow: 2900, priceHigh: 2900 })]), "2900", anchors, bounds), []);
});

test("zones outside the visible candle plot or wider than a precise pool are withheld", () => {
  assert.deepEqual(projectLiquidityZones(shield([zone({ priceLow: 2700, priceHigh: 2700 })]), "2900", anchors, bounds), []);
  assert.deepEqual(projectLiquidityZones(shield([zone({
    priceLow: 2800,
    priceHigh: 2860,
    touchPoints: [{ x: 25, y: 70 }, { x: 60, y: 74 }],
  })]), "2900", anchors, bounds), []);
  assert.equal(projectLiquidityPrice(3100, anchors, bounds), null);
});

test("touch evidence must be distinct, inside the plot and aligned with the projected band", () => {
  assert.deepEqual(projectLiquidityZones(shield([zone({ touchPoints: [{ x: 2, y: 65 }, { x: 60, y: 65 }] })]), "2900", anchors, bounds), []);
  assert.deepEqual(projectLiquidityZones(shield([zone({ touchPoints: [{ x: 30, y: 55 }, { x: 60, y: 55 }] })]), "2900", anchors, bounds), []);
  assert.deepEqual(projectLiquidityZones(shield([zone({ touchPoints: [{ x: 30, y: 65 }, { x: 30.4, y: 65.1 }] })]), "2900", anchors, bounds), []);
  assert.deepEqual(projectLiquidityZones(shield([zone({ pattern: "SESSION_EXTREME", touchPoints: [{ x: 60, y: 65 }] })]), "2900", anchors, bounds), []);
  assert.equal(projectLiquidityZones(shield([zone({ touchPoints: [{ x: 30, y: 2 }, { x: 30.2, y: 65 }, { x: 60, y: 65 }] })]), "2900", anchors, bounds).length, 1);
});

test("low confidence, unreadable charts and unreadable candles force precision hold", () => {
  assert.deepEqual(projectLiquidityZones(shield([zone({ confidence: "LOW" })]), "2900", anchors, bounds), []);
  assert.deepEqual(projectLiquidityZones(shield([zone()]), "2900", anchors, bounds, { chartReadability: "POOR", candlesReadable: true }), []);
  assert.deepEqual(projectLiquidityZones(shield([zone()]), "2900", anchors, bounds, { chartReadability: "CLEAR", candlesReadable: false }), []);
  assert.equal(projectLiquidityZones(shield([zone()]), "2900", anchors.slice(0, 2), bounds).length, 1);
  assert.deepEqual(projectLiquidityZones(shield([zone()]), "2900", [{ price: 3000, y: 35 }, { price: 2900, y: 50 }], bounds), []);
});

test("duplicate rows keep the highest-confidence pool regardless of model order", () => {
  const result = projectLiquidityZones(shield([
    zone({ confidence: "MEDIUM", label: "Less certain" }),
    zone({ confidence: "HIGH", pattern: "SWING_CLUSTER", label: "Strong cluster" }),
  ]), "2900", anchors, bounds);
  assert.equal(result.length, 1);
  assert.equal(result[0].confidence, "HIGH");
  assert.equal(result[0].label, "Strong cluster");
});

test("malformed structured prices fail closed", () => {
  assert.deepEqual(projectLiquidityZones(shield([zone({ priceLow: Number.NaN })]), "2900", anchors, bounds), []);
  assert.deepEqual(projectLiquidityZones(shield([zone({ priceLow: 2860, priceHigh: 2840 })]), "2900", anchors, bounds), []);
  assert.deepEqual(projectLiquidityZones(shield([zone({ priceLow: 0, priceHigh: 0 })]), "2900", anchors, bounds), []);
});

test("non-visible and insufficient statuses never produce overlays", () => {
  for (const status of ["NO_VISIBLE_RISK_ZONES", "INSUFFICIENT_EVIDENCE"] as const) {
    assert.deepEqual(projectLiquidityZones({ ...shield([zone()]), status }, "2900", anchors, bounds), []);
  }
});

test("customer surface exposes a toggle, distinct safe states and explicit non-guarantee", async () => {
  const [component, client, styles, route] = await Promise.all([
    readFile(new URL("../app/pocket/LiquidityGuardOverlay.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pocket/pocket-liquidity-guard.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pocket/analyse/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(component, /LIQUIDITY GUARD/);
  assert.match(component, /TWO-LABEL SCALE CHECK/);
  assert.doesNotMatch(component, /THREE-ANCHOR SCALE/);
  assert.match(component, /HIDE OVERLAY/);
  assert.match(component, /REANALYSE CHART/);
  assert.match(component, /OVERLAY WITHHELD/);
  assert.match(component, /NO CLEAR STOP-RISK CLUSTER/);
  assert.match(component, /LIQUIDITY GUARD UNAVAILABLE/);
  assert.doesNotMatch(component, /No candidate survived scale, side, candle-row and readability verification/);
  assert.match(component, /NOT GUARANTEED REVERSALS/);
  assert.match(component, /projectLiquidityZones/);
  assert.match(client, /id: "guard"/);
  assert.match(client, /POCKET_ANALYSIS_ENGINE_VERSION = 11/);
  assert.match(styles, /\.psLiquidityVector/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(route, /liquidityShield/);
  assert.match(route, /order-book liquidity/);
});
