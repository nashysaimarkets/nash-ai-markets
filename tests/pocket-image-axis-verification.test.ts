import assert from "node:assert/strict";
import test from "node:test";
import { verifyAxisWords, type AxisWord } from "../app/pocket/axis-verification.ts";
import { MAX_IMAGE_PLOT_PIXELS, detectImagePlotRegion, type ImagePlotRegion } from "../app/pocket/image-plot-region.ts";
import { IMAGE_AXIS_POLICY, imagePixelPriceCandidates, isMeasuredImagePlotRegion, verifyImageAxisWords, type MeasuredImagePlotRegion, type VerifiedImageAxis } from "../app/pocket/image-axis-verification.ts";
import { collectSourcePriceCandidates } from "../app/pocket/source-price-candidates.ts";
import { plotRaster } from "./support/pocket-image-plot-raster.ts";

function fixture() {
  const rows = [100, 200, 300, 400, 500, 600, 700];
  const region: MeasuredImagePlotRegion = {
    status: "measured", width: 1000, height: 1000,
    plotPixels: { left: 100, right: 850, top: 100, bottom: 700 }, plotPercent: { left: 10, right: 85, top: 10, bottom: 70 },
    gridRowPixels: rows, axisLabelRegionPixels: { side: "right", left: 860, right: 950, top: 90, bottom: 710, matchedGridRows: [...rows] },
    evidence: { gridRows: 7, candles: 12, candleSpanPixels: 600, borderEdges: 4, coherentPricePanels: 1, axisTextColumns: 1 },
  };
  const words: AxisWord[] = rows.map((y, i) => ({ text: String(160 - i * 10), confidence: 95, x: 862, y: y + 1, width: 60, height: 12 }));
  const candidates = collectSourcePriceCandidates({ levels: [{ kind: "support", label: "USER VERIFIED", price: "125", x: .5, x2: -1, y: 100, y2: NaN }],
    priceScaleAnchors: [{ price: 160, y: 99 }, { price: 100, y: 1 }] });
  const axis = verifyImageAxisWords(words, region, candidates.axisPrices);
  if (axis.status !== "verified") throw new Error(axis.reason);
  assert.equal(axis.status, "verified");
  return { region, words, candidates, axis };
}
const held = (result: { status: string }) => assert.equal(result.status, "held");

test("new image-origin policy keeps three independent ticks while the legacy three-model-match rule stays intact", () => {
  const { region, words, candidates, axis } = fixture();
  assert.equal(axis.policy, IMAGE_AXIS_POLICY); assert.equal(axis.anchors.length, 7); assert.deepEqual(axis.matchedModelPrices, [160, 100]);
  assert.equal(axis.anchors[0].y, 10); assert.equal(axis.maxResidualPixels, 0);
  held(verifyAxisWords(words, region.gridRowPixels, candidates.axisPrices.map(price => ({ price, y: 99 })), region.height));
  assert.equal(verifyImageAxisWords([words[0], words[3], words[6]], region, [160, 100]).status, "verified");
  held(verifyImageAxisWords([words[0], words[6]], region, [160, 100]));
});

test("price projection uses only measured pixels and exact prices, preserving unverified semantics", () => {
  const { region, candidates, axis } = fixture(), before = JSON.stringify({ region, candidates, axis });
  const placed = imagePixelPriceCandidates(candidates, true, region, axis);
  assert.equal(placed.reason, null);
  assert.deepEqual(placed.levels, [{ kind: "support", label: "Reported support candidate", price: "125", provenance: "UNVERIFIED",
    source: "PRIMARY", placement: "IMAGE_AXIS", x: 10, x2: 85, y: 45, y2: 45 }]);
  assert.equal(JSON.stringify({ region, candidates, axis }), before);
  assert.deepEqual(imagePixelPriceCandidates(candidates, false, region, axis).levels, []);
});

test("detector holds, ambiguous panels and malformed pixel relationships cannot become usable geometry", () => {
  const { region, words } = fixture();
  assert.equal(MAX_IMAGE_PLOT_PIXELS, 4_000_000);
  const oversized = { ...region, width: 2001, height: 2000, plotPercent: {
    left: region.plotPixels.left / 2001 * 100, right: region.plotPixels.right / 2001 * 100,
    top: region.plotPixels.top / 2000 * 100, bottom: region.plotPixels.bottom / 2000 * 100,
  } };
  for (const reason of ["AMBIGUOUS_PRICE_PANELS", "AMBIGUOUS_AXIS_COLUMNS", "AXIS_TEXT_UNRESOLVED"] as const) held(verifyImageAxisWords(words, { status: "held", reason }, [160, 100]));
  const changes: unknown[] = [null, {}, oversized, { ...region, width: NaN }, { ...region, width: 5000 },
    { ...region, plotPercent: { ...region.plotPercent, right: 84 } }, { ...region, plotPixels: { ...region.plotPixels, bottom: 50 } },
    { ...region, gridRowPixels: [100, 200, 300, 400, 500, 700, 600] },
    { ...region, axisLabelRegionPixels: { ...region.axisLabelRegionPixels, side: "left" } },
    { ...region, axisLabelRegionPixels: { ...region.axisLabelRegionPixels, left: 840 } },
    { ...region, axisLabelRegionPixels: { ...region.axisLabelRegionPixels, matchedGridRows: [100, 200, 301, 400, 500, 600, 700] } },
    ...[{ coherentPricePanels: 2 }, { axisTextColumns: 2 }, { borderEdges: 3 }, { gridRows: 8 }, { candles: 0 }, { candleSpanPixels: 5 }].map(evidence => ({ ...region, evidence: { ...region.evidence, ...evidence } })),
  ];
  for (const bad of changes) { assert.equal(isMeasuredImagePlotRegion(bad), false); held(verifyImageAxisWords(words, bad as ImagePlotRegion, [160, 100])); }
});

test("exact numeric corroboration rejects decimal loss, multiplied magnitude and nearby or duplicated matches", () => {
  const { region, words } = fixture();
  for (const multiple of [100, .01]) held(verifyImageAxisWords(words.map(w => ({ ...w, text: String(Number(w.text) * multiple) })), region, [160, 100]));
  for (const model of [[], [160], [160, 160], [160, 150], [160, 101], [16000, 10000], [NaN, 100], [160, 100, 140, 130, 120]])
    held(verifyImageAxisWords(words, region, model));
  assert.equal(verifyImageAxisWords(words, region, [160, 140]).status, "verified", "two corroborated rows exactly 20 percentage points apart qualify");
});

test("strict OCR text, confidence, row snapping and original-pixel fit are retained", () => {
  const { region, words } = fixture();
  for (const text of ["1,09505", "O.95", "1.09%", "1 09505", "1.", "Infinity", "-10"])
    held(verifyImageAxisWords(words.map(w => ({ ...w, text })), region, [160, 100]));
  held(verifyImageAxisWords(words.map(w => ({ ...w, confidence: 79 })), region, [160, 100]));
  held(verifyImageAxisWords(words.slice(1, -1).map(w => ({ ...w, y: w.y + 20 })), region, [160, 100]));
  const nonlinear = words.map((w, i) => ({ ...w, text: i === 1 ? "150.3" : w.text }));
  held(verifyImageAxisWords(nonlinear, region, [160, 100]));
  const subpixel = verifyImageAxisWords(words.map((w, i) => ({ ...w, text: i === 1 ? "150.1" : w.text })), region, [160, 100]);
  assert.equal(subpixel.status, "verified"); if (subpixel.status === "verified") assert.ok(subpixel.maxResidualPixels <= 1.5);
  held(verifyImageAxisWords(words.map((w, i) => ({ ...w, text: String(2 ** (7 - i)) })), region, [128, 2]));
});

test("conflicting row values and competing columns are rejected in either OCR ordering", () => {
  const { region, words } = fixture(), conflict = { ...words[3], text: "131" };
  for (const input of [[...words, conflict], [conflict, ...words]]) held(verifyImageAxisWords(input, region, [160, 100]));
  assert.equal(verifyImageAxisWords([...words, { ...words[3] }], region, [160, 100]).status, "verified");
  const narrow = words.map(w => ({ ...w, width: 30 })), other = narrow.map(w => ({ ...w, x: 915 }));
  for (const input of [[...narrow, ...other], [...other, ...narrow]]) held(verifyImageAxisWords(input, region, [160, 100]));
  held(verifyImageAxisWords([words[0], words[1], words[1]], region, [160, 150]));
});

test("clipped, out-of-region and malformed OCR evidence is never widened or repaired", () => {
  const { region, words } = fixture();
  for (const change of [{ x: 859 }, { width: 100 }, { y: 89 }, { height: 100 }, { confidence: 101 }, { confidence: NaN }, { text: "1".repeat(65) }])
    held(verifyImageAxisWords([{ ...words[0], ...change }, ...words.slice(1)], region, [160, 100]));
  held(verifyImageAxisWords(Array.from({ length: 257 }, () => words[0]), region, [160, 100]));
});

test("projection rechecks retained evidence and rejects changed axes, source regions and candidate magnitude", () => {
  const { region, candidates, axis } = fixture();
  for (const changed of [
    { ...axis, policy: "other" }, { ...axis, anchors: axis.anchors.map((a, i) => i === 2 ? { ...a, y: a.y + .1 } : a) },
    { ...axis, maxResidualPixels: 1 }, { ...axis, matchedModelPrices: [160, 140] }, { ...axis, modelPriceEvidence: [160, 140] },
    { ...axis, wordEvidence: axis.wordEvidence.map(w => ({ ...w, confidence: 70 })) }, { status: "verified", policy: IMAGE_AXIS_POLICY },
  ]) assert.deepEqual(imagePixelPriceCandidates(candidates, true, region, changed as VerifiedImageAxis).levels, []);
  const shifted = { ...region, plotPixels: { ...region.plotPixels, left: 110 }, plotPercent: { ...region.plotPercent, left: 11 } };
  assert.ok(isMeasuredImagePlotRegion(shifted));
  assert.deepEqual(imagePixelPriceCandidates(candidates, true, shifted, axis).levels, []);
  const magnitude = collectSourcePriceCandidates({ levels: [{ kind: "support", price: "12500" }], priceScaleAnchors: [{ price: 160 }, { price: 100 }] });
  assert.deepEqual(imagePixelPriceCandidates(magnitude, true, region, axis).levels, []);
});

test("unsupported, malformed, missing and empty candidates remain held without claiming verified absence", () => {
  const { region, candidates, axis } = fixture();
  for (const value of [null, { ...candidates, source: "CONTEXT" }, { ...candidates, provenance: "VERIFIED" },
    { ...candidates, levels: [{ ...candidates.levels[0], kind: "pivot" }] }, { ...candidates, levels: [{ ...candidates.levels[0], label: "USER VERIFIED" }] }])
    assert.deepEqual(imagePixelPriceCandidates(value, true, region, axis).levels, []);
  for (const price of ["99", "161"]) {
    const outside = collectSourcePriceCandidates({ levels: [{ kind: "support", price }], priceScaleAnchors: [{ price: 160 }, { price: 100 }] });
    assert.deepEqual(imagePixelPriceCandidates(outside, true, region, axis).levels, []);
  }
  for (const input of [{}, { levels: null }, { levels: [] }, { levels: [{ kind: "support", price: "bad" }] }]) {
    const empty = collectSourcePriceCandidates({ ...input, priceScaleAnchors: [{ price: 160 }, { price: 100 }] });
    const held = imagePixelPriceCandidates(empty, true, region, axis);
    assert.deepEqual(held.levels, []); assert.ok(held.reason);
    if (empty.levelInput === "EMPTY" || empty.levelInput === "PRESENT") assert.match(held.reason!, /absence is not verified/);
  }
});

test("left-hand measured axes use the same plot and do not inherit right-axis clipping", () => {
  const { region, words, candidates } = fixture();
  const left: MeasuredImagePlotRegion = { ...region, axisLabelRegionPixels: { ...region.axisLabelRegionPixels, side: "left", left: 10, right: 90 } };
  const axis = verifyImageAxisWords(words.map(w => ({ ...w, x: 20 })), left, candidates.axisPrices);
  assert.equal(axis.status, "verified");
  const placed = imagePixelPriceCandidates(candidates, true, left, axis);
  assert.equal(placed.levels[0].x, 10); assert.equal(placed.levels[0].x2, 85);
});

test("actual detector output composes with original-pixel OCR-word controls without model geometry", () => {
  const source = plotRaster(), region = detectImagePlotRegion(source.raster);
  if (region.status !== "measured") throw new Error(region.reason);
  assert.equal(region.status, "measured");
  assert.ok(isMeasuredImagePlotRegion(region));
  // Synthetic OCR word controls, not a Tesseract run or retained-chart claim.
  const roi = region.axisLabelRegionPixels;
  const words: AxisWord[] = region.gridRowPixels.map((y, i) => ({ text: String(12345 - i * 125), confidence: 95,
    x: roi.left + 2, y: y + .5, width: roi.right - roi.left - 4, height: 8 }));
  const candidates = collectSourcePriceCandidates({ levels: [{ kind: "support", price: "12000" }],
    priceScaleAnchors: [{ price: 12345, y: 99 }, { price: 11720, y: 0 }] });
  const axis = verifyImageAxisWords(words, region, candidates.axisPrices);
  assert.equal(axis.status, "verified");
  const placed = imagePixelPriceCandidates(candidates, true, region, axis);
  assert.equal(placed.levels.length, 1); assert.equal(placed.levels[0].provenance, "UNVERIFIED");
  assert.ok(Math.abs(placed.levels[0].x * region.width / 100 - source.expected[0].left) < 1e-9);
});

test("only insufficient usable readings, coverage or exact corroborations are eligible for a reread", () => {
  const { region, words } = fixture();
  for (const result of [
    verifyImageAxisWords([], region, [160, 100]),
    verifyImageAxisWords(words.slice(0, 2), region, [160, 100]),
    verifyImageAxisWords(words.map(w => ({ ...w, confidence: 79 })), region, [160, 100]),
    verifyImageAxisWords(words, region, []),
    verifyImageAxisWords(words, region, [160, 150]),
  ]) {
    assert.equal(result.status, "held");
    if (result.status === "held") assert.equal(result.retryable, true);
  }
  const tall: MeasuredImagePlotRegion = { ...region, height: 2000, plotPercent: { ...region.plotPercent, top: 5, bottom: 35 } };
  const insufficientSpan = verifyImageAxisWords(words.slice(0, 3), tall, [160, 140]);
  assert.equal(insufficientSpan.status, "held");
  if (insufficientSpan.status === "held") assert.equal(insufficientSpan.retryable, true);
});

test("contradictions, non-monotonicity and bad fits stay terminal even before coverage is sufficient", () => {
  const { region, words } = fixture();
  const narrow = words.map(w => ({ ...w, width: 30 }));
  const tall: MeasuredImagePlotRegion = { ...region, height: 2000, plotPercent: { ...region.plotPercent, top: 5, bottom: 35 } };
  for (const result of [
    verifyImageAxisWords([...words, { ...words[3], text: "131" }], region, [160, 100]),
    verifyImageAxisWords([...narrow, ...narrow.map(w => ({ ...w, x: 915 }))], region, [160, 100]),
    verifyImageAxisWords([{ ...words[0], text: "140" }, { ...words[1], text: "150" }], region, [140, 150]),
    verifyImageAxisWords([{ ...words[0], text: "160.000000001" }, { ...words[1], text: "160" }], region, [160, 100]),
    verifyImageAxisWords(words.map((w, i) => ({ ...w, text: i === 1 ? "150.3" : w.text })), region, [160, 100]),
    verifyImageAxisWords(words.slice(0, 3).map((w, i) => ({ ...w, text: i === 1 ? "151" : w.text })), tall, [160, 140]),
    verifyImageAxisWords([{ ...words[0], x: 0 }, ...words.slice(1)], region, [160, 100]),
    verifyImageAxisWords(words, { status: "held", reason: "AMBIGUOUS_AXIS_COLUMNS" }, [160, 100]),
    verifyImageAxisWords(words, region, [NaN, 100]),
  ]) {
    assert.equal(result.status, "held");
    if (result.status === "held") assert.equal(result.retryable, undefined);
  }
});

test("retaining first-pass words prevents a second clean subset from hiding earlier price conflicts", () => {
  const { region, words } = fixture();
  const firstWords = [{ ...words[0], text: "163" }, { ...words[3], text: "131" }];
  const first = verifyImageAxisWords(firstWords, region, [160, 100]);
  assert.equal(first.status, "held");
  if (first.status === "held") assert.equal(first.retryable, true, "two readings alone cannot establish the scale");
  assert.equal(verifyImageAxisWords(words, region, [160, 100]).status, "verified", "discarding first-pass evidence would conceal its contradictions");
  for (const accumulated of [[...firstWords, ...words], [...words, ...firstWords]]) {
    const result = verifyImageAxisWords(accumulated, region, [160, 100]);
    assert.equal(result.status, "held");
    if (result.status === "held") { assert.equal(result.retryable, undefined); assert.match(result.reason, /conflict/); }
  }
});
