import test from "node:test";
import assert from "node:assert/strict";
import { detectImagePlotRegion, MAX_IMAGE_PLOT_PIXELS, type ImagePlotRegion } from "../app/pocket/image-plot-region.ts";
import { plotRaster } from "./support/pocket-image-plot-raster.ts";

function measured(result: ImagePlotRegion) {
  assert.equal(result.status, "measured", JSON.stringify(result));
  if (result.status !== "measured") throw Error("Unreachable");
  return result;
}
test("measures a light grid and its adjacent right text column without model or price inputs", () => {
  const f = plotRaster(), before = f.raster.data.slice(), r = measured(detectImagePlotRegion(f.raster));
  assert.deepEqual(r.plotPixels, f.expected[0]);
  assert.equal(r.axisLabelRegionPixels.side, "right");
  assert.ok(r.axisLabelRegionPixels.left > r.plotPixels.right);
  assert.equal(r.gridRowPixels.length, 6); assert.ok(r.evidence.candles >= 6);
  assert.deepEqual(f.raster.data, before, "reading pixels must not modify the source");
  assert.equal("prices" in r, false); assert.equal("scaleReadable" in r, false);
});
test("shift, size, dark theme and left-side labels do not use a fixed screen crop", () => {
  const cases = [
    { width: 1000, height: 620, panels: [{ plot: { left: 90, right: 490, top: 140, bottom: 480 } }] },
    { width: 960, height: 640, dark: true, panels: [{ plot: { left: 190, right: 810, top: 110, bottom: 510 }, axis: "left" as const }] },
    { width: 1600, height: 960, panels: [{ plot: { left: 160, right: 1310, top: 150, bottom: 750 } }] },
  ];
  for (const config of cases) {
    const f = plotRaster(config), r = measured(detectImagePlotRegion(f.raster));
    assert.deepEqual(r.plotPixels, f.expected[0]);
    assert.equal(r.axisLabelRegionPixels.side, "axis" in config.panels[0] ? config.panels[0].axis : "right");
    assert.ok(Math.abs(r.plotPercent.left * f.raster.width / 100 - r.plotPixels.left) < 1e-8);
  }
});
test("antialiased axis glyph fringes cannot extend the visible plotting borders", () => {
  for (const dark of [false, true]) for (const axis of ["right", "left"] as const) {
    const f = plotRaster({ width: 960, height: 640, dark, panels: [
      { plot: { left: 190, right: 810, top: 110, bottom: 510 }, axis, antiAliasLabels: true },
    ] });
    const r = measured(detectImagePlotRegion(f.raster));
    assert.deepEqual(r.plotPixels, f.expected[0]); assert.equal(r.axisLabelRegionPixels.side, axis);
  }
});
test("visible inset-panel borders remain measured when only interior grid rows pass the legacy sampler", () => {
  const f = plotRaster({ panels: [
    { plot: { left: 60, right: 590, top: 55, bottom: 350 }, plotBackground: 252 },
  ] });
  const r = measured(detectImagePlotRegion(f.raster));
  assert.deepEqual(r.plotPixels, f.expected[0]);
  const expectedRows = [55, 114, 173, 232, 291, 350];
  assert.equal(r.gridRowPixels.length, expectedRows.length);
  // The legacy reader returns percentages; allow only floating-point roundoff
  // when converting those unchanged measurements back to original pixels.
  r.gridRowPixels.forEach((row, i) => assert.ok(Math.abs(row - expectedRows[i]) < 1e-9));
});
test("side-edge endpoints cannot invent a missing horizontal border in an inset panel", () => {
  for (const edge of ["top", "bottom"] as const) {
    const plot = { left: 60, right: 590, top: 55, bottom: 350 };
    const f = plotRaster({ panels: [{ plot, plotBackground: 252 }] });
    f.fill(plot.left + 1, plot[edge], plot.right - 1, plot[edge], [252, 252, 252]);
    assert.equal(detectImagePlotRegion(f.raster).status, "held");
  }
});
test("two-pixel grid strokes are measured at their centres", () => {
  const f = plotRaster({ panels: [{ plot: { left: 60, right: 590, top: 55, bottom: 350 }, stroke: 2 }] });
  const r = measured(detectImagePlotRegion(f.raster));
  assert.deepEqual(r.plotPixels, f.expected[0]);
  assert.equal(r.gridRowPixels[0], 55.5);
});
test("a volume panel outside a single measured price panel is not a second price chart", () => {
  const f = plotRaster({ width: 900, height: 700, panels: [
    { plot: { left: 90, right: 750, top: 70, bottom: 420 } },
    { plot: { left: 90, right: 750, top: 470, bottom: 650 }, candles: "volume" },
  ] });
  assert.deepEqual(measured(detectImagePlotRegion(f.raster)).plotPixels, f.expected[0]);
});
test("two vertically stacked price panels abstain instead of selecting the largest", () => {
  const f = plotRaster({ width: 900, height: 720, panels: [
    { plot: { left: 90, right: 750, top: 40, bottom: 300 } },
    { plot: { left: 90, right: 750, top: 390, bottom: 650 } },
  ] });
  assert.deepEqual(detectImagePlotRegion(f.raster), { status: "held", reason: "AMBIGUOUS_PRICE_PANELS" });
});
test("touching price panels cannot borrow their shared border and grid as one price rectangle", () => {
  const f = plotRaster({ width: 900, height: 720, panels: [
    { plot: { left: 90, right: 750, top: 40, bottom: 340 } },
    { plot: { left: 90, right: 750, top: 340, bottom: 640 } },
  ] });
  assert.deepEqual(detectImagePlotRegion(f.raster), { status: "held", reason: "AMBIGUOUS_PRICE_PANELS" });
});
test("touching price and volume panels abstain even though volume bars are not candle witnesses", () => {
  const f = plotRaster({ width: 900, height: 720, panels: [
    { plot: { left: 90, right: 750, top: 40, bottom: 340 } },
    { plot: { left: 90, right: 750, top: 340, bottom: 640 }, candles: "volume" },
  ] });
  assert.deepEqual(detectImagePlotRegion(f.raster), { status: "held", reason: "AMBIGUOUS_PRICE_PANELS" });
});
test("side-by-side price charts abstain even when their grid rows align", () => {
  const f = plotRaster({ width: 1200, height: 600, panels: [
    { plot: { left: 60, right: 500, top: 100, bottom: 480 } },
    { plot: { left: 690, right: 1100, top: 100, bottom: 480 } },
  ] });
  assert.deepEqual(detectImagePlotRegion(f.raster), { status: "held", reason: "AMBIGUOUS_PRICE_PANELS" });
});
test("grid-only and volume-only rectangles cannot establish a price panel", () => {
  for (const candles of ["none", "volume"] as const) {
    const f = plotRaster({ panels: [{ plot: { left: 60, right: 590, top: 55, bottom: 350 }, candles }] });
    assert.equal(detectImagePlotRegion(f.raster).status, "held");
  }
});
test("a missing vertical boundary, clipped boundary or weak grid remains unknown", () => {
  const fixtures = [
    plotRaster({ panels: [{ plot: { left: 60, right: 590, top: 55, bottom: 350 }, borders: false }] }),
    plotRaster({ panels: [{ plot: { left: 60, right: 590, top: 0, bottom: 350 } }] }),
    plotRaster({ gridContrast: 5 }),
  ];
  for (const f of fixtures) assert.equal(detectImagePlotRegion(f.raster).status, "held");
});
test("unresolved and competing axis columns abstain without inventing an OCR crop", () => {
  const none = plotRaster({ panels: [{ plot: { left: 60, right: 590, top: 55, bottom: 350 }, axis: "none" }] });
  assert.deepEqual(detectImagePlotRegion(none.raster), { status: "held", reason: "AXIS_TEXT_UNRESOLVED" });
  const both = plotRaster({ panels: [{ plot: { left: 90, right: 590, top: 55, bottom: 350 }, axis: "both" }] });
  assert.deepEqual(detectImagePlotRegion(both.raster), { status: "held", reason: "AMBIGUOUS_AXIS_COLUMNS" });
});
test("nonuniform repeated rules do not claim a coherent grid rectangle", () => {
  const f = plotRaster({ panels: [{ plot: { left: 60, right: 590, top: 55, bottom: 350 }, gridFractions: [0, .12, .35, .7, 1] }] });
  assert.equal(detectImagePlotRegion(f.raster).status, "held");
});
test("malformed, oversized and transparent inputs fail without a guessed rectangle", () => {
  const f = plotRaster();
  for (const raster of [ { ...f.raster, width: 4097 }, { ...f.raster, height: 0 },
    { ...f.raster, data: new Uint8ClampedArray(4) }, { ...f.raster, data: new Uint8ClampedArray(f.raster.data.length) } ]) {
    const r = detectImagePlotRegion(raster); assert.equal(r.status, "held"); assert.equal("plotPixels" in r, false);
  }
});
test("recovery holds a correctly sized raster above its original-pixel budget without resizing", () => {
  assert.equal(MAX_IMAGE_PLOT_PIXELS, 4_000_000);
  const raster = { width: 2000, height: 2001, data: new Uint8ClampedArray(2000 * 2001 * 4) };
  assert.deepEqual(detectImagePlotRegion(raster), { status: "held", reason: "RASTER_TOO_COMPLEX" });
});
test("dense small flat components hold before unbounded baseline comparisons even below the pixel budget", () => {
  const f = plotRaster({ width: 1200, height: 800, panels: [{ plot: { left: 100, right: 1100, top: 100, bottom: 700 } }] });
  // These short blocks lie in a narrow part of an otherwise supported chart.
  // They cannot satisfy a wide histogram baseline and must not cause an
  // unbounded all-pairs search or be silently discarded to measure the plot.
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) f.fill(110 + x * 9, 110 + y * 12, 112 + x * 9, 115 + y * 12, [225, 70, 100]);
  assert.deepEqual(detectImagePlotRegion(f.raster), { status: "held", reason: "RASTER_TOO_COMPLEX" });
});
