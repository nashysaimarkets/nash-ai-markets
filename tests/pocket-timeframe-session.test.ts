import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { bundleForChart, createChartSession, previousComparableScan, selectedChartReport, comparisonIdentity } from "../app/pocket/chart-session";
import { createSampleCharts } from "../app/pocket/sample-analysis";
import { normalizePatternFrame } from "../app/pocket/chart-images";
import { createScanMetrics } from "../app/api/pocket/scan-metrics";

const samples = createSampleCharts();
const source = readFileSync(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("PocketBullseye.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function actualFunction(name: string) {
  let code = "";
  function visit(node: ts.Node) { if (ts.isFunctionDeclaration(node) && node.name?.text === name) code = node.getText(ast); ts.forEachChild(node, visit); }
  visit(ast); assert.ok(code, `actual ${name} handler exists`);
  return ts.transpile(code, { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX });
}

function harness() {
  const charts = samples.map((chart, index) => ({ ...chart, report: index === 0 ? chart.report : undefined }));
  const context: Record<string, any> = {
    resultCharts: charts, analysis: samples[0].report, image: samples[0].image, activeChartId: charts[0].id,
    busy: false, followUpBusy: false, liquidityRescanning: false,
    selectionActive: { current: false }, selectionRevision: { current: 0 }, chartWork: { current: { clear: () => { context.cancelled = true; } } }, analysisRequestActive: { current: false }, levelLabRequestActive: { current: false }, activePrimaryImage: { current: samples[0].image },
    sessionRevision: { current: 1 }, resultRevision: { current: 0 },
    Error, Promise, calls: [], remembered: [], bundleForChart, normalizePatternFrame,
    requireAppleEntitlementForAdditionalRequest: async () => { context.entitlements = (context.entitlements ?? 0) + 1; return true; },
    requestPocketAnalysis: async (_: unknown, options: any) => { context.calls.push(options); return samples.find((chart) => chart.image === options.images.image)!.report; },
    rememberScan: async (report: unknown, image: string) => context.remembered.push({ report, image }),
  };
  for (const name of ["Image", "FileName", "ContextImage", "ContextFileName", "DetailImage", "DetailFileName", "FourHourImage", "FourHourFileName", "IndicatorImage", "IndicatorFileName", "ResultCharts", "ActiveChartId", "Analysis", "BattlefieldChart", "ChartConfirmation", "AccuracyCorrection", "CorrectionOriginal", "FollowUpReply", "FollowUpQuestion", "FollowUpError", "LevelLabImage", "LevelLabFileName", "LevelLabStatus", "LevelLabError", "LiquidityError", "RefinementBefore", "RefinementStatus", "SelectedScenario", "PendingChartId", "Error"]) context[`set${name}`] = (value: any) => { const key = name[0].toLowerCase() + name.slice(1); context[key] = typeof value === "function" ? value(context[key]) : value; };
  const sandbox = vm.createContext(context);
  vm.runInContext(actualFunction("activateResultChart") + actualFunction("selectResultChart"), sandbox);
  return context;
}

test("all five uploads can own a full report and return to their cached result without extra requests", async () => {
  const h = harness();
  for (let index = 1; index < samples.length; index++) {
    await h.selectResultChart(samples[index].id);
    assert.equal(h.image, samples[index].image);
    assert.equal(h.analysis.timeframe, samples[index].timeframe);
    assert.equal(h.analysis.levels[0].price, samples[index].report!.levels[0].price);
    assert.equal(h.calls.at(-1).images.image, samples[index].image);
    assert.equal(new Set(Object.values(h.calls.at(-1).images)).size, 5);
    assert.equal(h.chartConfirmation, null);
    assert.equal(h.accuracyCorrection, null);
  }
  for (const chart of samples) await h.selectResultChart(chart.id);
  assert.equal(h.calls.length, 4);
  assert.equal(h.entitlements, 4);
});

test("a failed timeframe request preserves the active report and every original upload", async () => {
  const h = harness(); const before = h.resultCharts;
  h.requestPocketAnalysis = async () => { throw new Error("provider timeout"); };
  await h.selectResultChart(samples[2].id);
  assert.equal(h.image, samples[0].image); assert.equal(h.analysis, samples[0].report);
  assert.equal(h.resultCharts, before); assert.equal(h.pendingChartId, null);
  assert.equal(h.error, "provider timeout"); assert.equal(h.remembered.length, 0);
});

test("a result arriving after New chart cannot overwrite the next chart session", async () => {
  const h = harness(); let finish!: (value: unknown) => void;
  h.requestPocketAnalysis = () => new Promise((resolve) => { finish = resolve; });
  const pending = h.selectResultChart(samples[2].id);
  await new Promise((resolve) => setImmediate(resolve)); h.sessionRevision.current += 1; h.image = "next-upload"; h.analysis = null;
  finish(samples[2].report); await pending;
  assert.equal(h.image, "next-upload"); assert.equal(h.analysis, null); assert.equal(h.remembered.length, 0);
});

test("rapid taps share the in-flight request and an unentitled request never runs", async () => {
  const h = harness(); let finish!: (value: unknown) => void; let calls = 0;
  h.requestPocketAnalysis = () => { calls++; return new Promise((resolve) => { finish = resolve; }); };
  const pending = h.selectResultChart(samples[1].id); await new Promise((resolve) => setImmediate(resolve));
  await h.selectResultChart(samples[2].id); assert.equal(calls, 1);
  finish(samples[1].report); await pending;
  h.requireAppleEntitlementForAdditionalRequest = async () => false;
  await h.selectResultChart(samples[2].id); assert.equal(calls, 1); assert.equal(h.pendingChartId, null);
});

test("cached sample switching needs neither entitlement checks nor provider calls", async () => {
  const h = harness(); h.resultCharts = samples;
  for (const chart of samples) await h.selectResultChart(chart.id);
  assert.equal(h.calls.length, 0); assert.equal(h.entitlements, undefined); assert.equal(h.remembered.length, 0);
});

test("source roles never invent timeframe labels, and duplicate timeframe crops remain selectable", () => {
  const report = { ...samples[0].report!, evidencePack: { received: 3, contributions: [{ role: "PRIMARY" as const, used: true, summary: "main", timeframe: "5M" }, { role: "FOUR_HOUR" as const, used: true, summary: "crop", timeframe: "1H" }] } };
  const charts = createChartSession({ image: "a", contextImage: null, detailImage: "b", fourHourImage: "c", indicatorImage: null }, ["main", "", "unknown", "crop"], report);
  assert.deepEqual(charts.map((c) => c.timeframe), ["5M", "READ FROM CHART", "1H"]);
  assert.equal(charts[0].sourceImages!.detailImage, "b");
  charts[1].timeframe = "1H";
  assert.notEqual(charts[1].id, charts[2].id);
  assert.equal(bundleForChart(charts, charts[1].id).images.image, "b");
});

test("all optional-slot combinations preserve each uploaded source exactly once", () => {
  for (let mask = 0; mask < 16; mask++) {
    const values = ["a", ...["b", "c", "d", "e"].map((value, index) => mask & (1 << index) ? value : null)];
    const images = Object.fromEntries(["image", "contextImage", "detailImage", "fourHourImage", "indicatorImage"].map((field, index) => [field, values[index]])) as any;
    const charts = createChartSession(images, [], samples[0].report!);
    for (const chart of charts) { const { images: selected } = bundleForChart(charts, chart.id); assert.equal(selected.image, chart.image); assert.deepEqual(Object.values(selected).filter(Boolean).sort(), values.filter(Boolean).sort()); }
  }
});

test("selected report cannot borrow another crop's patterns or combined geometry", () => {
  const pattern = { name: "TRIANGLE", status: "FORMING" as const, evidence: "test", invalidation: "test" };
  const input = { ...samples[0].report!, patterns: [{ ...pattern, sourceRole: "PRIMARY" as const }, { ...pattern, sourceRole: "PRICE_DETAIL" as const }] };
  const output = selectedChartReport(input);
  assert.equal(output.patterns.length, 1); assert.equal(output.patterns[0].sourceRole, "PRIMARY");
  assert.equal(output.combinedBattlefield, undefined); assert.equal(output.contextBattlefield, null);
  assert.equal(input.patterns.length, 2);
});

test("comparison requires same instrument and timeframe, a different screenshot, and valid history", () => {
  const analysis = { ...samples[0].report!, instrument: "US 500 (DFB)", ticker: "UNKNOWN" };
  const history = [
    { id: "match", createdAt: "2026-09-09T10:00:00Z", image: "before", analysis },
    { id: "wrong-frame", createdAt: "2026-09-09T11:00:00Z", image: "x", analysis: { ...analysis, timeframe: "4H" } },
    { id: "wrong-market", createdAt: "2026-09-09T12:00:00Z", image: "y", analysis: { ...analysis, instrument: "Gold" } },
    { id: "same-picture", createdAt: "2026-09-09T13:00:00Z", image: "current", analysis },
  ];
  assert.equal(previousComparableScan(history, analysis, "current")?.id, "match");
  assert.equal(previousComparableScan(history, { ...analysis, instrument: "UNKNOWN" }, "current"), null);
  assert.equal(comparisonIdentity({ instrument: 55 as any, timeframe: {} as any }), null);
});

test("reliability metrics record one terminal outcome and both report attempts without chart data", () => {
  const records: Record<string, unknown>[] = []; let clock = 10;
  const metrics = createScanMetrics(5, (record) => records.push(record), () => clock);
  metrics.usage("report", "test", { input_tokens: 100, output_tokens: 20 });
  metrics.usage("recovery", "test", { input_tokens: 100, output_tokens: 40, input_tokens_details: { cached_tokens: 80 } });
  clock = 1010; metrics.finish("completed"); metrics.finish("failed");
  assert.equal(records.length, 1); assert.equal(records[0].elapsedMs, 1000); assert.equal(records[0].outputTokens, 60); assert.equal(records[0].inputTokens, 200);
  assert.equal(records[0].chartCount, 5); assert.ok(!("image" in records[0]));
});

test("monthly chart labels remain distinct from minute chart labels", () => {
  for (const input of ["Monthly", "1 month", "MN1", "1MO"]) assert.equal(normalizePatternFrame(input), "1MO");
  assert.equal(normalizePatternFrame("1 min"), "1M");
  assert.equal(normalizePatternFrame("Yearly"), "1Y");
});

test("the actual initial scan consumes a free use only after a readable result", async () => {
  for (const outcome of ["poor", "unreadable", "failed", "ready"]) {
    const report = structuredClone(samples[0].report!);
    if (outcome === "poor") report.evidenceQuality.chartReadability = "POOR";
    if (outcome === "unreadable") report.evidenceQuality.candlesReadable = false;
    const h: Record<string, any> = { Error, image: "chart", privacyChecked: true, busy: false, analysisRequestActive: { current: false }, sessionRevision: { current: 1 }, appleAccess: { isNative: true, entitled: false, freeUseConsumed: false }, reviewTarget: null, preflightStatus: "READY", contextImage: null, consumed: 0, published: null,
      isAppleNativeApp: () => true, refreshAppleAccess: async () => h.appleAccess,
      preflightAllowsAnalysis: () => true, requestPocketAnalysis: async () => { if (outcome === "failed") throw new Error("timeout"); return report; },
      consumeAppleFreeUse: async () => { h.consumed++; }, setAnalysis: (value: unknown) => { h.published = value; },
      recordAppleSuccessfulAnalysis: async () => undefined, rememberScan: async () => undefined,
    };
    for (const name of ["setError", "setStockEvents", "setStockEventStatus", "setAppleAccess", "initialiseChartSession", "setResultView", "setImmersive", "setShowResultReveal", "setBusy", "notifyPocketAnalysisReady"]) h[name] = () => undefined;
    vm.runInContext(actualFunction("analyse"), vm.createContext(h));
    await h.analyse();
    assert.equal(h.consumed, outcome === "ready" ? 1 : 0, outcome);
    assert.equal(Boolean(h.published), outcome === "ready", outcome);
  }
});

test("leaving What changed during the access check never starts a stale comparison", async () => {
  const text = readFileSync(new URL("../app/pocket/ScanChanges.tsx", import.meta.url), "utf8");
  const tree = ts.createSourceFile("ScanChanges.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let fn = "";
  function visit(node: ts.Node) { if (ts.isFunctionDeclaration(node) && node.name?.text === "compare") fn = node.getText(tree); ts.forEachChild(node, visit); }
  visit(tree); assert.ok(fn);
  let finish!: (allowed: boolean) => void;
  const h: Record<string, any> = { previous: { image: "old" }, sample: false, requestActive: { current: false }, controller: { current: null }, AbortController,
    setBusy: () => undefined, setError: () => undefined, canCompare: () => new Promise((resolve) => { finish = resolve; }),
    calls: 0, fetch: async () => { h.calls++; throw new Error("must not start"); },
  };
  vm.runInContext(ts.transpile(fn, { target: ts.ScriptTarget.ES2022 }), vm.createContext(h));
  const pending = h.compare(); h.controller.current.abort(); finish(true); await pending;
  assert.equal(h.calls, 0); assert.equal(h.requestActive.current, false);
});

test("a ready timeframe remains usable during a stalled switch and late work cannot replace it", async () => {
  const h = harness(); let finish!: (value: unknown) => void;
  h.requestPocketAnalysis = () => new Promise(resolve => { finish = resolve; });
  const pending = h.selectResultChart(samples[2].id);
  await new Promise(setImmediate);
  h.busy = true; h.error = "old failure";
  await h.selectResultChart(samples[0].id);
  assert.equal(h.cancelled, undefined); assert.equal(h.error, ""); assert.equal(h.pendingChartId, null);
  finish(samples[2].report); await pending;
  assert.equal(h.activeChartId, samples[0].id); assert.equal(h.analysis, samples[0].report);
  assert.equal(h.remembered.length, 0);
});
