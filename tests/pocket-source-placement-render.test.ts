import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { numericLevelPrice } from "../app/pocket/level-verification.ts";
import { rankChartLevels } from "../app/pocket/pocket-chart-toolkit.ts";
import { sourceLevelPlacement, type OriginalChartMeasurement } from "../app/pocket/source-placement.ts";

// Render the actual consumer functions. Extracting their AST nodes avoids
// importing unrelated authenticated transports and native billing adapters.
// Hooks select a story chapter only; the separate browser test covers the
// real measurement hook, asynchronous OCR and React lifecycle.
async function consumers(scene = 2) {
  const source = await readFile(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8");
  const ast = ts.createSourceFile("PocketBullseye.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = ["numericLevel", "evidenceBalance", "personalDailyMessage", "DecisionMap", "ScannerHealth", "MarketStory"];
  const statements = names.map(name => {
    const node = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
    assert.ok(node, `actual ${name} consumer exists`);
    return node.getText(ast);
  });
  const compiled = ts.transpileModule(statements.join("\n"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  let hookIndex = 0;
  const bindings = {
    require: createRequire(import.meta.url),
    exports: {},
    numericLevelPrice, rankChartLevels,
    useEffect: () => {},
    useState: (initial: unknown) => [hookIndex++ === 0 ? scene : initial, () => {}],
  };
  return new Function(...Object.keys(bindings), compiled + "\nreturn {DecisionMap, ScannerHealth, MarketStory};")(...Object.values(bindings));
}

function fixture() {
  const image = "data:image/png;base64,synthetic-render-source";
  const anchors = [{ price: 3000, y: 20 }, { price: 2900, y: 50 }, { price: 2800, y: 80 }];
  const report = {
    direction: "NEUTRAL", currentPrice: "2900", instrument: "SYNTHETIC", timeframe: "30m", verdict: "WAIT", verdictHeadline: "Wait for evidence.",
    evidenceQuality: { chartReadability: "CLEAR", instrumentConfidence: "HIGH", timeframeConfidence: "HIGH", scaleReadable: true, candlesReadable: true },
    priceScaleAnchors: anchors, plotBounds: { left: 5, right: 90, top: 10, bottom: 90 },
    levels: [{ kind: "support", label: "Candidate", price: "2850", x: 10, x2: 85, y: 40, y2: 40 }],
    patterns: [], higherTimeframe: { provided: false }, observableFacts: ["Model reports a range."],
    marketStructure: "Reported range.", momentum: "Reported balanced momentum.", levelStory: "Model-only level narrative.",
    setupScore: { overall: 50, confirmation: 5 }, riskFlags: [], nextSequence: { confirmation: "Wait." },
  };
  const measurement: OriginalChartMeasurement = { image, report, width: 1000, height: 1000, axis: { status: "verified", anchors, matchedModelTicks: 3 }, pixels: null };
  const placed = sourceLevelPlacement(measurement, image, report, true);
  const held = sourceLevelPlacement(null, image, report, true);
  return { image, report, placed, held };
}

test("actual DecisionMap holds all numeric model levels while independent measurement is pending", async () => {
  const { DecisionMap } = await consumers();
  const { image, report, held } = fixture();
  const html = renderToStaticMarkup(createElement(DecisionMap, { analysis: report, sourceImage: image, placement: held }));
  assert.match(html, /PRECISION HOLD/);
  assert.match(html, /Verifying original price labels/);
  assert.doesNotMatch(html, /class="psBattleLevel"|class="psPriceLadder"|class="psBattleCurrent"/);
});

test("actual DecisionMap consumes the placed subset rather than raw numeric or visual-area candidates", async () => {
  const { DecisionMap } = await consumers();
  const { image, report, placed } = fixture();
  const raw = { ...report, levels: [{ ...report.levels[0], price: "2861" }, { ...report.levels[0], price: "", y: 93 }] };
  const html = renderToStaticMarkup(createElement(DecisionMap, { analysis: raw, sourceImage: image, placement: placed }));
  assert.match(html, /aria-label="support at 2850"/);
  assert.doesNotMatch(html, /2861|psVisualBattleLevel/);
  assert.match(html, /support or resistance meaning remains a model interpretation/);
});

test("actual health panel never calls model-readable levels verified without measured placement", async () => {
  const { ScannerHealth } = await consumers();
  const { report, held } = fixture();
  const html = renderToStaticMarkup(createElement(ScannerHealth, { analysis: report, placement: held }));
  assert.match(html, /PIXEL PLACEMENT<\/span><strong>HELD/);
  assert.doesNotMatch(html, /<strong>[^<]*VERIFIED<\/strong>/);
});

test("actual health count comes from source placement rather than the report's candidate count", async () => {
  const { ScannerHealth } = await consumers();
  const { report, placed } = fixture();
  const html = renderToStaticMarkup(createElement(ScannerHealth, { analysis: { ...report, levels: Array(9).fill(report.levels[0]) }, placement: placed }));
  assert.match(html, /PIXEL PLACEMENT<\/span><strong>1 VERIFIED/);
  assert.doesNotMatch(html, /9 VERIFIED/);
});

test("actual story holds the level chapter despite numeric model candidates", async () => {
  const { MarketStory } = await consumers(2);
  const { image, report, held } = fixture();
  const html = renderToStaticMarkup(createElement(MarketStory, { analysis: report, sourceImage: image, placement: held, viewerName: "", intention: "UNSURE", onShare: () => {}, onOpenReport: () => {} }));
  assert.match(html, /Source placement remains held/);
  assert.doesNotMatch(html, /2850|survived verification/);
});

test("actual story claims verified pixel placement only and does not certify market meaning", async () => {
  const { MarketStory } = await consumers(2);
  const { image, report, placed } = fixture();
  const html = renderToStaticMarkup(createElement(MarketStory, { analysis: report, sourceImage: image, placement: placed, viewerName: "", intention: "UNSURE", onShare: () => {}, onOpenReport: () => {} }));
  assert.match(html, /1 candidate has verified pixel placement/);
  assert.match(html, /not support or resistance accuracy/);
  assert.doesNotMatch(html, /survived verification|SCALE VERIFIED/);
});
