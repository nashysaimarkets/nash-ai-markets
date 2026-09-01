import assert from "node:assert/strict";
import test from "node:test";
import { canonicalizePocketGeometry } from "../app/lib/pocket-geometry.ts";
import { calibratePocketAnalysis } from "../app/api/pocket/analysis-calibration.ts";
import { recoverPrecisionGeometry } from "../app/api/pocket/precision-fallback.ts";
import { normalizePrecisionLiquidityShield } from "../app/api/pocket/liquidity-precision.ts";
import { projectLiquidityZones, type LiquidityShield } from "../app/pocket/liquidity-guard.ts";

type Bounds = { left: number; top: number; right: number; bottom: number };
type NormalizedGeometryFixture = {
  plotBounds: Bounds;
  priceScaleAnchors: Array<{ y: number }>;
  levels: Array<{ x: number; y: number }>;
  fibLevels: Array<{ y: number }>;
  patterns: Array<{ geometry: { points: Array<{ x: number; y: number }>; labelX: number; labelY: number } }>;
  liquidityShield: { zones: Array<{ touchPoints: Array<{ y: number }> }> };
};

function fractionalPrecision() {
  return {
    currentPrice: "2900",
    plotBounds: { left: .08, top: .12, right: .88, bottom: .86 },
    priceScaleAnchors: [{ price: 3000, y: .2 }, { price: 2900, y: .5 }, { price: 2800, y: .8 }],
    levels: [
      { kind: "resistance", label: "Visible ceiling", price: "2950", x: .08, y: .35, x2: .88, y2: .35 },
      { kind: "support", label: "Visible floor", price: "2850", x: .08, y: .65, x2: .88, y2: .65 },
    ],
    liquidityShield: {
      status: "VISIBLE_RISK_ZONES",
      summary: "Repeated lows are visible.",
      stopGuidance: "Use structural invalidation.",
      zones: [{
        side: "BELOW_PRICE",
        pattern: "EQUAL_LOWS",
        label: "Equal lows",
        priceLow: 2850,
        priceHigh: 2850,
        confidence: "HIGH",
        evidence: "Three visible reactions.",
        touchPoints: [{ x: .25, y: .65 }, { x: .48, y: .652 }, { x: .7, y: .648 }],
      }],
    },
  };
}

test("fractional S/R and liquidity geometry survives the exact live validation path", () => {
  const precision = fractionalPrecision();
  const recovered = recoverPrecisionGeometry({}, precision);
  assert.ok(recovered);
  const recoveredGeometry = recovered as {
    plotBounds: { left: number; top: number; right: number; bottom: number };
    priceScaleAnchors: Array<{ price: number; y: number }>;
    levels: Array<Record<string, unknown>>;
  };
  assert.deepEqual(recoveredGeometry.plotBounds, { left: 8, top: 12, right: 88, bottom: 86 });
  assert.deepEqual(recoveredGeometry.priceScaleAnchors.map((anchor) => anchor.y), [20, 50, 80]);

  const calibrated = calibratePocketAnalysis({
    ...recoveredGeometry,
    instrument: "US 500 (DFB)",
    ticker: "US500",
    timeframe: "1h",
    evidenceQuality: { chartReadability: "CLEAR", candlesReadable: true, instrumentConfidence: "HIGH", timeframeConfidence: "HIGH", scaleReadable: true },
    setupScore: { overall: 65, grade: "C" },
    contradictions: [],
    missingInputs: [],
  }) as { levels: Array<{ price: string; y: number }>; trustGate: { status: string; exactLevelCount: number; scaleLocked: boolean } };
  assert.deepEqual(calibrated.levels.map((level) => [level.price, level.y]), [["2950", 35], ["2850", 65]]);
  assert.deepEqual(calibrated.trustGate, {
    status: "LOCKED",
    chartLocked: true,
    identityLocked: true,
    scaleLocked: true,
    exactLevelCount: 2,
    reasons: [
      "Candles and structure are readable",
      "Instrument and timeframe are verified",
      "2 exact structural levels bracket current price",
      "No explicit contradiction was returned",
    ],
    nextAction: "Verify the marked prices on the original chart before acting.",
  });

  const serverShield = normalizePrecisionLiquidityShield(precision, "2900");
  assert.equal(serverShield.status, "VISIBLE_RISK_ZONES");
  assert.equal(serverShield.zones.length, 1);
  const clientZones = projectLiquidityZones(
    precision.liquidityShield as LiquidityShield,
    "2900",
    precision.priceScaleAnchors,
    precision.plotBounds,
  );
  assert.equal(clientZones.length, 1);
  assert.deepEqual(clientZones[0].touchPoints.map((point) => point.x), [25, 48, 70]);
});

test("coordinate families normalize independently in both mixed-unit directions", () => {
  const percentFrame = canonicalizePocketGeometry({
    plotBounds: { left: 5, top: 10, right: 90, bottom: 90 },
    priceScaleAnchors: [{ price: 110, y: .2 }, { price: 100, y: .5 }, { price: 90, y: .8 }],
    levels: [
      { kind: "resistance", x: .05, y: .35, x2: .9, y2: .35 },
      { kind: "support", x: .05, y: .65, x2: .9, y2: .65 },
    ],
  }) as NormalizedGeometryFixture;
  assert.deepEqual(percentFrame.plotBounds, { left: 5, top: 10, right: 90, bottom: 90 });
  assert.deepEqual(percentFrame.priceScaleAnchors.map((anchor: { y: number }) => anchor.y), [20, 50, 80]);
  assert.deepEqual(percentFrame.levels.map((level: { x: number; y: number }) => [level.x, level.y]), [[5, 35], [5, 65]]);

  const fractionalFrame = canonicalizePocketGeometry({
    plotBounds: { left: .05, top: .1, right: .9, bottom: .9 },
    priceScaleAnchors: [{ price: 110, y: 20 }, { price: 100, y: 50 }, { price: 90, y: 80 }],
    levels: [
      { kind: "resistance", x: 5, y: 35, x2: 90, y2: 35 },
      { kind: "support", x: 5, y: 65, x2: 90, y2: 65 },
    ],
  }) as NormalizedGeometryFixture;
  assert.deepEqual(fractionalFrame.plotBounds, { left: 5, top: 10, right: 90, bottom: 90 });
  assert.deepEqual(fractionalFrame.priceScaleAnchors.map((anchor: { y: number }) => anchor.y), [20, 50, 80]);
  assert.deepEqual(fractionalFrame.levels.map((level: { x: number; y: number }) => [level.x, level.y]), [[5, 35], [5, 65]]);
});

test("normalization is idempotent, leaves percent data unchanged and fails mixed anchors closed", () => {
  const percent = {
    plotBounds: { left: 5, top: 10, right: 90, bottom: 90 },
    priceScaleAnchors: [{ price: 110, y: 20 }, { price: 100, y: 50 }, { price: 90, y: 80 }],
    levels: [{ kind: "support", y: 65 }, { kind: "resistance", y: 35 }],
  };
  const once = canonicalizePocketGeometry(percent) as typeof percent;
  assert.equal(canonicalizePocketGeometry(once), once);
  assert.deepEqual(JSON.parse(JSON.stringify(once)), percent);

  const inconsistent = fractionalPrecision();
  inconsistent.priceScaleAnchors = [{ price: 3000, y: .2 }, { price: 2900, y: 50 }, { price: 2800, y: .8 }];
  assert.equal(normalizePrecisionLiquidityShield(inconsistent, "2900").status, "INSUFFICIENT_EVIDENCE");
});

test("fractional fib and pattern geometry shares the same full-image frame", () => {
  const normalized = canonicalizePocketGeometry({
    plotBounds: { left: .05, top: .1, right: .9, bottom: .9 },
    fibLevels: [{ ratio: "0.5", y: .4 }, { ratio: "0.618", y: .6 }],
    patterns: [{ name: "Triangle", geometry: { points: [{ x: .2, y: .3 }, { x: .8, y: .7 }], labelX: .5, labelY: .45 } }],
  }) as NormalizedGeometryFixture;
  assert.deepEqual(normalized.fibLevels.map((fib: { y: number }) => fib.y), [40, 60]);
  assert.deepEqual(normalized.patterns[0].geometry, {
    points: [{ x: 20, y: 30 }, { x: 80, y: 70 }],
    labelX: 50,
    labelY: 45,
  });
});

test("ambiguous percent coordinates near the image edge are never promoted into a verified fractional scale", () => {
  const nearEdgePercent = {
    currentPrice: "100",
    plotBounds: { left: 0, top: 0, right: 100, bottom: 100 },
    priceScaleAnchors: [{ price: 105, y: .1 }, { price: 100, y: .5 }, { price: 95, y: .9 }],
    levels: [
      { kind: "resistance", price: "102", x: 5, y: .3, x2: 95, y2: .3 },
      { kind: "support", price: "98", x: 5, y: .7, x2: 95, y2: .7 },
    ],
    liquidityShield: {
      status: "VISIBLE_RISK_ZONES",
      zones: [{ side: "BELOW_PRICE", touchPoints: [{ x: 20, y: .8 }, { x: 50, y: 1 }, { x: 80, y: 1.1 }] }],
    },
  };
  const normalized = canonicalizePocketGeometry(nearEdgePercent) as NormalizedGeometryFixture;
  assert.deepEqual(normalized.priceScaleAnchors.map((anchor: { y: number }) => anchor.y), [.1, .5, .9]);
  assert.deepEqual(normalized.levels.map((level: { y: number }) => level.y), [.3, .7]);
  assert.deepEqual(normalized.liquidityShield.zones[0].touchPoints.map((point: { y: number }) => point.y), [.8, 1, 1.1]);
  assert.equal(recoverPrecisionGeometry({}, nearEdgePercent), null);
  assert.equal(normalizePrecisionLiquidityShield(nearEdgePercent, "100").status, "INSUFFICIENT_EVIDENCE");
});

test("a mixed coordinate family is explicitly invalidated", () => {
  const normalized = canonicalizePocketGeometry({
    plotBounds: { left: 5, top: 10, right: 90, bottom: 90 },
    priceScaleAnchors: [{ price: 110, y: .2 }, { price: 100, y: 50 }, { price: 90, y: .8 }],
  }) as NormalizedGeometryFixture;
  assert.ok(normalized.priceScaleAnchors.every((anchor: { y: number }) => Number.isNaN(anchor.y)));
});

test("strict numeric-string coordinates normalize while degenerate bounds stay inside 100", () => {
  const normalized = canonicalizePocketGeometry({
    plotBounds: { left: "0.05", top: "0.1", right: "0.9", bottom: "0.9" },
    priceScaleAnchors: [{ price: 110, y: "0.2" }, { price: 100, y: "0.5" }, { price: 90, y: "0.8" }],
    levels: [{ kind: "support", y: "0.65", y2: "0.65" }, { kind: "resistance", y: "0.35", y2: "0.35" }],
  }) as NormalizedGeometryFixture;
  assert.deepEqual(normalized.plotBounds, { left: 5, top: 10, right: 90, bottom: 90 });
  assert.deepEqual(normalized.priceScaleAnchors.map((anchor: { y: number }) => anchor.y), [20, 50, 80]);

  const calibrated = calibratePocketAnalysis({
    currentPrice: "100",
    plotBounds: { left: 100, top: 100, right: 100, bottom: 100 },
    priceScaleAnchors: [],
    levels: [],
    evidenceQuality: { chartReadability: "POOR", candlesReadable: false },
    setupScore: { overall: 0 },
  }) as { plotBounds: Bounds };
  assert.deepEqual(calibrated.plotBounds, { left: 99, top: 99, right: 100, bottom: 100 });
});

test("a slightly overshooting fractional frame is clamped to the full image", () => {
  const normalized = canonicalizePocketGeometry({
    plotBounds: { left: .06, top: .08, right: 1.06, bottom: 1.08 },
    priceScaleAnchors: [{ price: 110, y: .2 }, { price: 100, y: .5 }, { price: 90, y: .8 }],
    levels: [{ kind: "resistance", price: "105", y: .35 }, { kind: "support", price: "95", y: .65 }],
  }) as NormalizedGeometryFixture;
  assert.deepEqual(normalized.plotBounds, { left: 6, top: 8, right: 100, bottom: 100 });
  assert.deepEqual(normalized.priceScaleAnchors.map((anchor: { y: number }) => anchor.y), [20, 50, 80]);
});
