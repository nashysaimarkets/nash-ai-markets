import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { recoverPrecisionGeometry } from "../app/api/pocket/precision-fallback.ts";

test("actual server parser accepts ordinary trader-confirmed numeric prices", async () => {
  const route = await readFile(new URL("../app/api/pocket/analyse/route.ts", import.meta.url), "utf8");
  const start = route.indexOf("    if (payload.chartConfirmation");
  const end = route.indexOf("    if (payload.accuracyCorrection", start);
  const parse = new Function("payload", stripTypeScriptTypes("function parse() { let chartConfirmation = null;" + route.slice(start, end) + "\nreturn chartConfirmation; }") + "\nreturn parse();");
  for (const currentPrice of ["7658.01", "7,658.01", "100", "-12.5"]) {
    const confirmation = { instrument: "US 500", timeframe: "30m", currentPrice, contextMatch: "NOT_PROVIDED" };
    assert.deepEqual(parse({ chartConfirmation: confirmation }), confirmation);
  }
  for (const currentPrice of ["", "NaN", "price=100", "12x", "\\d"]) {
    assert.equal(parse({ chartConfirmation: { instrument: "US 500", timeframe: "30m", currentPrice } }), null);
  }
});

test("actual precision merge preserves locked chart facts before calibration", async () => {
  const route = await readFile(new URL("../app/api/pocket/analyse/route.ts", import.meta.url), "utf8");
  const start = route.indexOf('    if (analysis && typeof analysis === "object")');
  const end = route.indexOf("    const calibrated = calibratePocketAnalysis", start);
  const merge = new Function("initial", "precisionResult", "contextPrecisionResult", "chartConfirmation", "recoverPrecisionGeometry", stripTypeScriptTypes("function merge() { let analysis = initial;" + route.slice(start, end) + "\nreturn analysis; }") + "\nreturn merge();");
  const locked = { instrument: "US 500", timeframe: "30m", currentPrice: "7658.01", contextMatch: "NOT_PROVIDED" };
  const report = { instrument: "wrong", timeframe: "5m", currentPrice: "7660", levels: [], priceScaleAnchors: [] };
  for (const price of ["7662", ""]) {
    const precision = { currentPrice: price, plotBounds: { left: 5, top: 5, right: 95, bottom: 95 }, priceScaleAnchors: [], levels: [] };
    const result = merge(report, { output_text: JSON.stringify(precision) }, null, locked, recoverPrecisionGeometry);
    assert.equal(result.currentPrice, locked.currentPrice);
    assert.equal(result.instrument, locked.instrument);
    assert.equal(result.timeframe, locked.timeframe);
  }
  assert.equal(merge(report, null, null, locked, recoverPrecisionGeometry).currentPrice, locked.currentPrice);
});
