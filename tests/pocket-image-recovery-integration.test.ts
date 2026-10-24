import assert from "node:assert/strict";
import test from "node:test";
import { detectImagePlotRegion } from "../app/pocket/image-plot-region.ts";
import { verifyImageAxisWords, type ImageAxisVerification } from "../app/pocket/image-axis-verification.ts";
import { collectSourcePriceCandidates } from "../app/pocket/source-price-candidates.ts";
import { currentSourceMeasurement, sourceImageRecoveryEligible, sourceLevelPlacement, type OriginalChartMeasurement } from "../app/pocket/source-placement.ts";
import { pixelCheckedLiquidity, pixelCheckedPatterns, type OriginalGeometryReport } from "../app/pocket/original-pixel-geometry.ts";
import { deriveLevelProvenance } from "../app/pocket/level-provenance.ts";
import { plotRaster } from "./support/pocket-image-plot-raster.ts";

function fixture() {
  const source = plotRaster(), region = detectImagePlotRegion(source.raster);
  if (region.status !== "measured") throw new Error(region.reason);
  const roi = region.axisLabelRegionPixels;
  // Controlled synthetic OCR words, not a Tesseract/retained-image accuracy claim.
  const words = region.gridRowPixels.map((y, i) => ({ text: String(12345 - i * 125), confidence: 95,
    x: roi.left + 2, y: y + .5, width: roi.right - roi.left - 4, height: 8 }));
  const candidates = collectSourcePriceCandidates({ levels: [{ kind: "support", label: "USER VERIFIED", price: "12000", x: 70, x2: 0, y: 100, y2: -1 }],
    priceScaleAnchors: [{ price: 12345, y: 99 }, { price: 11720, y: 0 }] });
  const axis = verifyImageAxisWords(words, region, candidates.axisPrices);
  if (axis.status !== "verified") throw new Error(axis.reason);
  const image = "data:image/png;base64,synthetic-image-recovery-A";
  const report: OriginalGeometryReport = {
    evidenceQuality: { chartReadability: "POOR", instrumentConfidence: "UNKNOWN", timeframeConfidence: "UNKNOWN", scaleReadable: false, candlesReadable: false, limitations: [] },
    plotBounds: { left: 70, top: 100, right: 100, bottom: 20 },
    priceScaleAnchors: [{ price: 12345, y: 99 }, { price: 11720, y: 0 }],
    levels: [], sourcePriceCandidates: candidates, timeframe: "5M", currentPrice: "12100", patterns: [],
    liquidity: { state: "PARTIAL", confidence: "LOW", zones: [], observations: [] },
  };
  const measurement: OriginalChartMeasurement = { image, report, width: source.raster.width, height: source.raster.height,
    axis: { status: "held", reason: "Legacy scale remains held." }, pixels: null, imageRecovery: { region, axis } };
  return { image, report, measurement, region, axis, candidates };
}

function legacyFixture() {
  const f = fixture(), anchors = [{ price: 3000, y: 20 }, { price: 2900, y: 50 }, { price: 2800, y: 80 }];
  const report: OriginalGeometryReport = { ...f.report,
    evidenceQuality: { chartReadability: "CLEAR", instrumentConfidence: "HIGH", timeframeConfidence: "HIGH", scaleReadable: true, candlesReadable: true, limitations: [] },
    plotBounds: { left: 5, right: 90, top: 10, bottom: 90 }, priceScaleAnchors: anchors,
    levels: [{ kind: "support", label: "Legacy candidate", price: "2850", x: 10, x2: 85, y: 40, y2: 40 }],
  };
  const measurement: OriginalChartMeasurement = { ...f.measurement, report,
    axis: { status: "verified", anchors, matchedModelTicks: 3, axisLeft: 690 } };
  return { ...f, report, measurement };
}

test("current image evidence recovers horizontal price placement despite withheld model bounds and quality", () => {
  const { image, report, measurement, region } = fixture();
  assert.equal(sourceImageRecoveryEligible(report), true);
  const before = JSON.stringify({ report, measurement });
  const placed = sourceLevelPlacement(measurement, image, report, true);
  assert.equal(placed.reason, null); assert.equal(placed.levels.length, 1);
  const level = placed.levels[0] as typeof placed.levels[0] & { placement?: string; provenance?: string };
  assert.equal(level.price, "12000"); assert.equal(level.label, "Reported support candidate");
  assert.equal(level.placement, "IMAGE_AXIS"); assert.equal(level.provenance, "UNVERIFIED");
  assert.ok(Math.abs(level.x * measurement.width / 100 - region.plotPixels.left) < 1e-9);
  assert.ok(Math.abs(level.x2 * measurement.width / 100 - region.plotPixels.right) < 1e-9);
  const expectedY = region.plotPixels.top + (12345 - 12000) / (12345 - 11720) * (region.plotPixels.bottom - region.plotPixels.top);
  assert.ok(Math.abs(level.y * measurement.height / 100 - expectedY) < 1e-9);
  assert.equal(JSON.stringify({ report, measurement }), before, "recovery does not rewrite quality, raw bounds, report levels or legacy evidence");
});

test("recovery remains bound to the current image, report object and identity confirmation", () => {
  const { image, report, measurement } = fixture();
  for (const changedImage of [null, "data:image/png;base64,synthetic-image-recovery-B", "context-image", "level-lab-image"]) {
    assert.equal(currentSourceMeasurement(measurement, changedImage, report, true), null);
    assert.deepEqual(sourceLevelPlacement(measurement, changedImage, report, true).levels, []);
  }
  assert.deepEqual(sourceLevelPlacement(measurement, image, structuredClone(report), true).levels, []);
  assert.deepEqual(sourceLevelPlacement(measurement, image, report, false).levels, []);
  assert.deepEqual(sourceLevelPlacement(null, image, report, true).levels, []);
  assert.deepEqual(sourceLevelPlacement(measurement, image, null, true).levels, []);
});

test("recovery rejects measured image dimension mismatches instead of scaling or reusing coordinates", () => {
  const { image, report, measurement } = fixture();
  for (const change of [{ width: measurement.width + 1 }, { height: measurement.height + 1 }, { width: 0 }, { height: NaN }, { width: Infinity }]) {
    const result = sourceLevelPlacement({ ...measurement, ...change }, image, report, true);
    assert.deepEqual(result.levels, []); assert.match(result.reason ?? "", /does not match/);
  }
});

test("missing, held, malformed or altered independent proof cannot unlock fallback placement", () => {
  const { image, report, measurement, region, axis } = fixture();
  const attempts: OriginalChartMeasurement[] = [
    { ...measurement, imageRecovery: undefined },
    { ...measurement, imageRecovery: { region, axis: null } },
    { ...measurement, imageRecovery: { region, axis: { status: "held", policy: "image-axis-v1", reason: "Conflicting source labels." } } },
    { ...measurement, imageRecovery: { region: { status: "held", reason: "AMBIGUOUS_PRICE_PANELS" }, axis } },
    { ...measurement, imageRecovery: { region: { ...region, plotPercent: { ...region.plotPercent, right: 1 } }, axis } },
    { ...measurement, imageRecovery: { region, axis: { ...axis, anchors: axis.anchors.map((a, i) => i === 1 ? { ...a, y: a.y + .1 } : a) } } },
    { ...measurement, imageRecovery: { region, axis: { status: "verified", policy: "image-axis-v1" } as ImageAxisVerification } },
  ];
  for (const attempt of attempts) assert.deepEqual(sourceLevelPlacement(attempt, image, report, true).levels, []);
});

test("fallback eligibility requires a valid nonempty candidate envelope and two distinct numeric price hints", () => {
  const { image, report, measurement, candidates } = fixture();
  for (const sourcePriceCandidates of [undefined, null, {},
    collectSourcePriceCandidates({ levels: [], priceScaleAnchors: [{ price: 12345 }, { price: 11720 }] }),
    collectSourcePriceCandidates({ levels: [{ kind: "pivot", price: "12000" }], priceScaleAnchors: [{ price: 12345 }, { price: 11720 }] }),
    collectSourcePriceCandidates({ levels: [{ kind: "support", price: "12000" }], priceScaleAnchors: [{ price: 12345 }] }),
    { ...candidates, source: "CONTEXT" }, { ...candidates, provenance: "VERIFIED" }, { ...candidates, axisPrices: [12345, 12345] },
  ]) {
    const changed = { ...report, sourcePriceCandidates } as OriginalGeometryReport;
    assert.equal(sourceImageRecoveryEligible(changed), false);
    assert.deepEqual(sourceLevelPlacement({ ...measurement, report: changed }, image, changed, true).levels, []);
  }
});

test("explicit unsupported-scale warnings and malformed limitation data hold both recovery and legacy success", () => {
  for (const fixtureFactory of [fixture, legacyFixture]) {
    const { image, report, measurement } = fixtureFactory();
    for (const limitations of [["logarithmic scale"], ["Non-linear scale"], ["scale type unknown"], ["scale type uncertain"],
      ["Unknown scale type"], ["Price scale is unknown"], ["Uncertain price scale"],
      "logarithmic scale", null, {}, [null], [42]]) {
      const changed = { ...report, evidenceQuality: { ...report.evidenceQuality, limitations } } as unknown as OriginalGeometryReport;
      assert.equal(sourceImageRecoveryEligible(changed), false);
      const held = sourceLevelPlacement({ ...measurement, report: changed }, image, changed, true);
      assert.deepEqual(held.levels, []); assert.match(held.reason ?? "", /not supported/);
    }
  }
  const { report } = fixture();
  assert.equal(sourceImageRecoveryEligible({ ...report, evidenceQuality: { ...report.evidenceQuality, limitations: undefined } }), true);
  assert.equal(sourceImageRecoveryEligible({ ...report, evidenceQuality: { ...report.evidenceQuality, limitations: ["Some candles are unclear."] } }), true);
});

test("a successful legacy placement retains priority over the independent recovery candidate", () => {
  const { image, report, measurement } = legacyFixture();
  assert.equal(sourceImageRecoveryEligible(report), true);
  const placed = sourceLevelPlacement(measurement, image, report, true);
  assert.equal(placed.reason, null); assert.equal(placed.levels.length, 1);
  assert.equal(placed.levels[0].price, "2850"); assert.equal(placed.levels[0].y, 65);
  assert.equal(Object.hasOwn(placed.levels[0], "placement"), false);
  assert.equal(Object.hasOwn(placed.levels[0], "provenance"), false);
  const withoutRecovery = sourceLevelPlacement({ ...measurement, imageRecovery: undefined }, image, report, true);
  assert.deepEqual(placed, withoutRecovery);
});

test("horizontal recovery leaves legacy axis and candle witnesses held for pattern and liquidity consumers", () => {
  const { image, report, measurement } = fixture();
  const patterns = [{ name: "Model pattern", timeframe: "5M", confidence: "HIGH", status: "CONFIRMED",
    geometry: { points: [{ x: 10, y: 20 }, { x: 30, y: 40 }, { x: 50, y: 20 }], labelX: 30, labelY: 20 } }];
  const before = JSON.stringify(measurement);
  assert.equal(sourceLevelPlacement(measurement, image, report, true).levels.length, 1);
  assert.equal(measurement.axis.status, "held"); assert.equal(measurement.pixels, null);
  assert.deepEqual(pixelCheckedPatterns(patterns, "5M", report.plotBounds, measurement.pixels), []);
  assert.deepEqual(pixelCheckedLiquidity({ ...report, liquidity: { state: "VERIFIED", confidence: "HIGH", observations: [],
    zones: [{ side: "BUY_SIDE", basis: "EQUAL_HIGHS", price: "12200", x: 10, x2: 80, y: 20 }] } }, true, measurement.axis, measurement.pixels), []);
  assert.equal(JSON.stringify(measurement), before);
});

test("only image placement earns position-checked provenance while unverified hints override hostile authority labels", () => {
  const { image, report, measurement } = fixture();
  const placed = sourceLevelPlacement(measurement, image, report, true).levels[0];
  assert.ok(placed);
  for (const marker of [{ placement: "IMAGE_AXIS" }, { provenance: "UNVERIFIED" }, { placement: "IMAGE_AXIS", provenance: "UNVERIFIED" }, { placement: "MODEL", provenance: "UNVERIFIED" }]) {
    const result = deriveLevelProvenance({ kind: placed.kind, price: placed.price, label: "USER VERIFIED EXACT", ...marker }, 100);
    assert.equal(result.method, "AI_CANDIDATE"); assert.equal(result.confidence, "LOW");
    if (marker.placement === "IMAGE_AXIS") {
      assert.equal(result.precision, "POSITION_CHECKED"); assert.match(result.evidence, /position checked/i);
    } else {
      assert.equal(result.precision, "APPROXIMATE"); assert.match(result.evidence, /position.*not.*checked/i);
    }
    assert.match(result.evidence, /unconfirmed/i);
    assert.doesNotMatch(result.evidence, /visible structure|Trader-confirmed/i);
  }
});
