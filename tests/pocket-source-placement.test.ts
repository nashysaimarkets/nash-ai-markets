import assert from "node:assert/strict";
import test from "node:test";
import { currentSourceMeasurement, sourceLevelPlacement, type OriginalChartMeasurement } from "../app/pocket/source-placement.ts";
import type { OriginalGeometryReport } from "../app/pocket/original-pixel-geometry.ts";

const anchors = [{ price: 3000, y: 20 }, { price: 2900, y: 50 }, { price: 2800, y: 80 }];
function fixture() {
  const image = "data:image/png;base64,synthetic-original-A";
  const report: OriginalGeometryReport = {
    evidenceQuality: { chartReadability: "CLEAR", instrumentConfidence: "HIGH", timeframeConfidence: "HIGH", scaleReadable: true, candlesReadable: true },
    plotBounds: { left: 5, right: 90, top: 10, bottom: 90 },
    // A perfectly consistent model scale can still be at the wrong raster rows.
    priceScaleAnchors: anchors.map(a => ({ ...a, y: a.y - 7 })),
    levels: [{ kind: "support", label: "Model candidate", price: "2850", x: 10, x2: 85, y: 40, y2: 40 }],
  };
  const measurement: OriginalChartMeasurement = { image, report, width: 1000, height: 1000, axis: { status: "verified", anchors, matchedModelTicks: 3, axisLeft: 950 }, pixels: null };
  return { image, report, measurement };
}

test("numeric model levels and self-consistent anchors alone never become placed levels", () => {
  const { image, report } = fixture();
  assert.equal(report.levels.length, 1);
  const pending = sourceLevelPlacement(null, image, report, true);
  assert.equal(pending.levels.length, 0);
  assert.match(pending.reason ?? "", /Verifying original price labels/);
});

test("current independent source scale corrects a wrong model row without rewriting its candidate", () => {
  const { image, report, measurement } = fixture();
  const before = JSON.stringify(report);
  const placed = sourceLevelPlacement(measurement, image, report, true);
  assert.equal(placed.reason, null);
  assert.equal(placed.levels.length, 1);
  assert.equal(placed.levels[0].y, 65);
  assert.equal(placed.levels[0].y2, 65);
  assert.equal(placed.levels[0].x, 5);
  assert.equal(placed.levels[0].x2, 90);
  assert.equal(JSON.stringify(report), before, "raw model geometry stays available as the original candidate");
});

test("changing the image holds placement synchronously, including a sibling or context source", () => {
  const { report, measurement } = fixture();
  for (const image of [null, "data:image/png;base64,synthetic-original-B", "context-image", "level-lab-image"]) {
    assert.equal(currentSourceMeasurement(measurement, image, report, true), null);
    assert.equal(sourceLevelPlacement(measurement, image, report, true).levels.length, 0);
  }
});

test("a replacement report cannot inherit the previous report's measurement even if values match", () => {
  const { image, report, measurement } = fixture();
  const replacement = structuredClone(report);
  assert.equal(currentSourceMeasurement(measurement, image, replacement, true), null);
  assert.equal(sourceLevelPlacement(measurement, image, replacement, true).levels.length, 0);
  assert.equal(sourceLevelPlacement(measurement, image, null, true).levels.length, 0);
});

test("revoked identity confirmation immediately suppresses a completed measurement", () => {
  const { image, report, measurement } = fixture();
  assert.equal(currentSourceMeasurement(measurement, image, report, false), null);
  const held = sourceLevelPlacement(measurement, image, report, false);
  assert.equal(held.levels.length, 0);
  assert.match(held.reason ?? "", /Confirm the source chart facts/);
});

test("OCR failure and price disagreement remain held despite readable model fields", () => {
  const { image, report, measurement } = fixture();
  const failed: OriginalChartMeasurement = { ...measurement, axis: { status: "held", reason: "Independent reader unavailable." } };
  assert.deepEqual(sourceLevelPlacement(failed, image, report, true), { levels: [], reason: "Independent reader unavailable." });
  const disagreement: OriginalChartMeasurement = { ...measurement, axis: { status: "verified", anchors: anchors.map(a => ({ ...a, price: a.price + 10 })), matchedModelTicks: 3 } };
  assert.equal(sourceLevelPlacement(disagreement, image, report, true).levels.length, 0);
});

test("a supplied measurement does not bypass original-pixel fit, unsupported scale, or source bounds", () => {
  const { image, report, measurement } = fixture();
  const distorted: OriginalChartMeasurement = { ...measurement, axis: { status: "verified", anchors: [anchors[0], { price: 2900, y: 51 }, anchors[2]], matchedModelTicks: 3 } };
  assert.equal(sourceLevelPlacement(distorted, image, report, true).levels.length, 0);
  for (const changed of [
    { ...report, evidenceQuality: { ...report.evidenceQuality, limitations: ["logarithmic scale"] } },
    { ...report, levels: [{ ...report.levels[0], price: "3100" }] },
    { ...report, levels: [{ ...report.levels[0], source: "CONTEXT" }] },
  ]) {
    assert.equal(sourceLevelPlacement({ ...measurement, report: changed }, image, changed, true).levels.length, 0);
  }
});
