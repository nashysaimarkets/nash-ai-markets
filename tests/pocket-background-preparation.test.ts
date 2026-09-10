import { withDeadline, throwIfCancelled } from "../app/pocket/async-deadline";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { bundleForChart } from "../app/pocket/chart-session";
import { ChartWorkQueue } from "../app/pocket/chart-work-queue";
import { createSampleCharts } from "../app/pocket/sample-analysis";
import { pocketAnalysisPolicy, needsPocketLiquidityRecovery } from "../app/pocket/analysis-policy";
import { hasVerifiedTwoSidedStructure } from "../app/pocket/pocket-chart-toolkit";
import { selectedChartReport } from "../app/pocket/chart-session";
import { postPocketAnalysis } from "../app/pocket/analysis-request";
import { normalizePatternFrame } from "../app/pocket/chart-images";

const samples = createSampleCharts();
const text = readFileSync(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("PocketBullseye.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function actualFunction(name: string) {
  let source = "";
  function visit(node: ts.Node) { if (ts.isFunctionDeclaration(node) && node.name?.text === name) source = node.getText(ast); ts.forEachChild(node, visit); }
  visit(ast); assert.ok(source, name);
  return ts.transpile(source, { target: ts.ScriptTarget.ES2022 });
}

function harness() {
  const h: vm.Context = {
    Error, DOMException, AbortSignal, Promise, Date, crypto, withDeadline, throwIfCancelled, normalizePatternFrame, bundleForChart,
    image: samples[0].image, analysis: samples[0].report, resultCharts: samples.map((chart, index) => ({ ...chart, report: index === 0 ? chart.report : undefined })),
    activeChartId: samples[0].id, pendingChartId: null, sampleMode: false, busy: false, followUpBusy: false, liquidityRescanning: false,
    nativeAppleApp: false, appleAccess: { entitled: true }, document: { visibilityState: "visible" },
    selectionActive: { current: false }, selectionRevision: { current: 0 }, sessionRevision: { current: 1 }, resultRevision: { current: 0 },
    analysisRequestActive: { current: false }, levelLabRequestActive: { current: false }, backgroundActive: { current: new Set() },
    chartWork: { current: new ChartWorkQueue(4) }, evidenceCacheEpoch: { current: "" }, precisionReceiptCache: { current: [] },
    providerPauseUntil: { current: 0 }, scanAllowance: { current: null }, activePrimaryImage: { current: samples[0].image },
    calls: [], wakes: 0, remembered: [],
    analysisCacheKey: async (...images: unknown[]) => JSON.stringify(images),
    readAppleAccessStatus: async () => h.appleAccess,
    requireAppleEntitlementForAdditionalRequest: async () => true,
    executePocketAnalysis: async (options: { images: ReturnType<typeof bundleForChart>["images"] & { image: string }; signal: AbortSignal; background: boolean }) => { h.calls.push(options); return samples.find((chart) => chart.image === options.images.image)!.report; },
    rememberScan: async (report: unknown) => h.remembered.push(report),
    setBackgroundWake: () => { h.wakes++; },
  };
  for (const name of ["Image", "FileName", "ContextImage", "ContextFileName", "DetailImage", "DetailFileName", "FourHourImage", "FourHourFileName", "IndicatorImage", "IndicatorFileName", "ResultCharts", "ActiveChartId", "Analysis", "BattlefieldChart", "ChartConfirmation", "AccuracyCorrection", "CorrectionOriginal", "FollowUpReply", "FollowUpQuestion", "FollowUpError", "LevelLabImage", "LevelLabFileName", "LevelLabStatus", "LevelLabError", "LiquidityError", "RefinementBefore", "RefinementStatus", "SelectedScenario", "PendingChartId", "Error", "AppleAccess"]) {
    const key = name[0].toLowerCase() + name.slice(1);
    h[`set${name}`] = (value: unknown) => { h[key] = typeof value === "function" ? value(h[key]) : value; };
  }
  vm.runInContext(["prepareNextChart", "requestPocketAnalysis", "activateResultChart", "selectResultChart"].map(actualFunction).join("\n"), vm.createContext(h));
  return h;
}
const tick = () => new Promise(setImmediate);

test("opening the result prepares all four other charts without selecting them; all five then switch without scans", async () => {
  const h = harness();
  for (let i = 0; i < 5; i++) { await h.prepareNextChart(); await tick(); }
  assert.equal(h.calls.length, 4);
  assert.equal(h.resultCharts.filter((chart: (typeof samples)[number]) => chart.report).length, 5);
  assert.equal(h.activeChartId, samples[0].id);
  assert.equal(h.analysis, samples[0].report);
  for (const call of h.calls) { assert.equal(call.background, true); assert.equal(new Set(Object.values(call.images)).size, 5); }
  for (let pass = 0; pass < 3; pass++) for (const chart of samples) {
    await h.selectResultChart(chart.id);
    assert.equal(h.analysis!.timeframe, chart.timeframe);
    assert.equal(h.image, chart.image);
  }
  assert.equal(h.calls.length, 4);
});

test("selecting the preparing chart shares one scan; returning to a ready view preserves its late result", async () => {
  const h = harness(); let finish!: (report: unknown) => void;
  h.executePocketAnalysis = (options: { images: ReturnType<typeof bundleForChart>["images"] & { image: string }; signal: AbortSignal; background: boolean }) => { h.calls.push(options); return new Promise(resolve => { finish = resolve; }); };
  const background = h.prepareNextChart(); await tick();
  const selected = h.selectResultChart(samples[1].id); await tick();
  assert.equal(h.calls.length, 1);
  assert.equal(h.resultCharts[1].preparation, "preparing");
  await h.selectResultChart(samples[0].id);
  assert.equal(h.calls[0].signal.aborted, false);
  finish(samples[1].report); await Promise.all([background, selected]);
  assert.equal(h.analysis, samples[0].report);
  assert.equal(h.resultCharts[1].report, samples[1].report);
  await h.selectResultChart(samples[1].id);
  assert.equal(h.calls.length, 1);
});

test("selecting another chart retains the report that finished while the selection was waiting", async () => {
  const h = harness(); let finish!: (report: unknown) => void;
  h.executePocketAnalysis = (options: { images: ReturnType<typeof bundleForChart>["images"] & { image: string }; signal: AbortSignal; background: boolean }) => { h.calls.push(options); return h.calls.length === 1 ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(samples[2].report); };
  const background = h.prepareNextChart(); await tick();
  const selection = h.selectResultChart(samples[2].id); await tick();
  assert.equal(h.calls.length, 2); assert.equal(h.calls[0].signal.aborted, false);
  finish(samples[1].report); await Promise.all([background, selection]);
  assert.equal(h.activeChartId, samples[2].id);
  assert.equal(h.resultCharts[1].report, samples[1].report);
  assert.equal(h.resultCharts[2].report, samples[2].report);
});

test("background work respects hidden pages, native entitlement, provider pauses and scan allowance", async () => {
  for (const reason of ["hidden", "sample", "native-free", "expired", "provider", "allowance", "busy"]) {
    const h = harness();
    if (reason === "hidden") h.document.visibilityState = "hidden";
    if (reason === "sample") h.sampleMode = true;
    if (reason === "native-free") { h.nativeAppleApp = true; h.appleAccess = { entitled: false }; }
    if (reason === "expired") { h.nativeAppleApp = true; h.readAppleAccessStatus = async () => ({ entitled: false }); }
    if (reason === "provider") h.providerPauseUntil.current = Date.now() + 60_000;
    if (reason === "allowance") h.scanAllowance.current = { remaining: 0, resetAt: Date.now() + 60_000 };
    if (reason === "busy") h.busy = true;
    await h.prepareNextChart(); await h.prepareNextChart();
    assert.equal(h.calls.length, 0, reason);
  }
  const h = harness(); h.scanAllowance.current = { remaining: 0, resetAt: Date.now() - 1000 };
  await h.prepareNextChart(); assert.equal(h.calls.length, 1);
});

test("failure preserves the main result, avoids retry loops and still prepares other charts", async () => {
  const h = harness();
  const execute = h.executePocketAnalysis;
  h.executePocketAnalysis = async (options: { images: ReturnType<typeof bundleForChart>["images"] & { image: string }; signal: AbortSignal; background: boolean }) => { if (options.images.image === samples[1].image) { h.calls.push(options); throw new Error("timeout"); } return execute(options); };
  for (let i = 0; i < 6; i++) { await h.prepareNextChart(); await tick(); }
  assert.equal(h.calls.length, 4); assert.equal(h.resultCharts[1].preparation, "failed");
  assert.equal(h.resultCharts.filter((chart: (typeof samples)[number]) => chart.report).length, 4);
  assert.equal(h.analysis, samples[0].report); assert.equal(h.error, undefined);
});

test("a reset or corrected evidence cannot receive a late background report", async () => {
  for (const invalidation of ["session", "evidence"]) {
    const h = harness(); let finish!: (report: unknown) => void;
    h.executePocketAnalysis = () => new Promise(resolve => { finish = resolve; });
    const background = h.prepareNextChart(); await tick();
    if (invalidation === "session") h.sessionRevision.current++;
    else h.evidenceCacheEpoch.current = "corrected";
    finish(samples[1].report); await background;
    assert.equal(h.resultCharts[1].report, undefined);
    assert.equal(h.analysis, samples[0].report);
    assert.equal(h.backgroundActive.current.size, 0);
  }
});

// Exercise the real effect entrypoint with overlapping work, including a stalled first chart.
test("all remaining reports start while one is stalled and a newer selection can finish first", async () => {
  const h = harness(); const finishes = new Map<string, (report: unknown) => void>();
  h.executePocketAnalysis = (options: { images: ReturnType<typeof bundleForChart>["images"] & { image: string }; signal: AbortSignal; background: boolean }) => { h.calls.push(options); return new Promise(resolve => finishes.set(options.images.image, resolve)); };
  const jobs = [];
  for (let i = 0; i < 4; i++) { jobs.push(h.prepareNextChart()); await tick(); }
  assert.equal(h.calls.length, 4);
  assert.equal(h.backgroundActive.current.size, 4);
  const oldSelection = h.selectResultChart(samples[1].id); await tick();
  const newSelection = h.selectResultChart(samples[2].id); await tick();
  assert.equal(h.pendingChartId, samples[2].id);
  for (const chart of samples.slice(2)) finishes.get(chart.image)!(chart.report);
  await newSelection; await tick();
  assert.equal(h.resultCharts.filter((chart: (typeof samples)[number]) => chart.report).length, 4);
  assert.equal(h.analysis, samples[2].report);
  assert.equal(h.calls.length, 4, "selections share background requests");
  finishes.get(samples[1].image)!(samples[1].report);
  await Promise.all([...jobs, oldSelection]);
  assert.equal(h.analysis, samples[2].report, "late completion cannot reverse the latest choice");
  assert.equal(h.resultCharts.filter((chart: (typeof samples)[number]) => chart.report).length, 5);
});


test("the real request executor overlaps provider calls while keeping all canvas work serial", async () => {
  const h = harness();
  let canvases = 0, peakCanvases = 0;
  const allowanceReset = String(Math.ceil(Date.now()/1000)+1800);
  const finishes = new Map<string, () => void>();
  Object.assign(h, {
    Number, JSON, Set, Map, pocketAnalysisPolicy, needsPocketLiquidityRecovery, hasVerifiedTwoSidedStructure, selectedChartReport,
    chartImageWork: {current: new ChartWorkQueue()}, measuredCharts: {current: new Map()}, providerPauseMessage: {current: "paused"},
    numericLevel: (n: string) => Number(n), clampY: (y: number) => y,
    analysisCacheGet: async () => null, analysisCacheSave: async () => new Promise(() => {}),
    hasVerifiedTwoSidedAnalysis: () => true, derivedTrustGate: (r: NonNullable<(typeof samples)[number]["report"]>) => r.trustGate,
    enforcePocketTrustGate: (r: unknown) => r,
    createProviderScanImage: async (image: string) => { peakCanvases = Math.max(peakCanvases, ++canvases); await tick(); canvases--; return image; },
    measureChart: async (source: string, role: string) => { peakCanvases = Math.max(peakCanvases, ++canvases); await tick(); canvases--; return {source, role}; },
    postPocketAnalysis: (body: string, options: Parameters<typeof postPocketAnalysis>[1]) => postPocketAnalysis(body, {...options, fetchImpl: async (_url, init) => {
      const payload = JSON.parse(String(init?.body)); h.calls.push(payload);
      const chart = samples.find(chart => chart.image === payload.image)!;
      await new Promise<void>(resolve => finishes.set(chart.image, resolve));
      return Response.json({analysis: chart.report}, {headers: {"x-ratelimit-remaining": String(chart === samples[1] ? 8 : 5), "x-ratelimit-reset": allowanceReset}});
    }}),
  });
  vm.runInContext(["numericStructure", "withChartImages", "executePocketAnalysis"].map(actualFunction).join("\n"), vm.createContext(h));
  const jobs = samples.slice(1).map(chart => h.requestPocketAnalysis(null, {images: bundleForChart(h.resultCharts, chart.id).images, chartId: chart.id, background: true}));
  // Wait only for the deterministic canvas/encoding work, never for a provider response.
  for (let i = 0; i < 100 && h.calls.length < 4; i++) await tick();
  assert.equal(h.calls.length, 4, "the executor must not reject siblings as already running");
  assert.equal(peakCanvases, 1);
  assert.equal(h.analysisRequestActive.current, false, "background work must not occupy the initial-scan UI lock");
  for (const call of h.calls) {
    assert.equal(new Set([call.image, call.contextImage, call.detailImage, call.fourHourImage, call.indicatorImage]).size, 5);
    assert.equal(call.deterministicEvidence[0].source, call.image);
    assert.equal(call.deterministicEvidence[0].role, "PRIMARY");
  }
  for (const chart of samples.slice(2)) finishes.get(chart.image)!();
  await Promise.all(jobs.slice(1));
  assert.equal(h.resultCharts.filter((chart: (typeof samples)[number]) => chart.report).length, 4);
  h.providerPauseUntil.current = Date.now() + 60_000;
  finishes.get(samples[1].image)!(); await jobs[0];
  assert.equal(h.scanAllowance.current.remaining, 5, "older responses must not restore spent scans");
  assert.ok(h.providerPauseUntil.current > Date.now(), "a late success must not clear a newer quota pause");
  assert.equal(h.resultCharts.filter((chart: (typeof samples)[number]) => chart.report).length, 5);
});
