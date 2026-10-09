import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createChartRequestEpoch } from "../app/pocket/chart-request-identity.ts";
import { stripTypeScriptTypes } from "node:module";

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const deferred = () => {
  let resolve!: (value: string) => void;
  const promise = new Promise<string>((done) => { resolve = done; });
  return { promise, resolve };
};

test("actual primary upload callback ignores a FileReader that finishes after a replacement", async () => {
  const client = await readFile(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8");
  const source = client.slice(client.indexOf("  async function loadFile("), client.indexOf("  async function loadContextFile("));
  const first = deferred(), second = deferred();
  const images: string[] = [];
  const epochs = { primaryUploadEpoch: { current: createChartRequestEpoch() }, contextUploadEpoch: { current: createChartRequestEpoch() }, analysisEpoch: { current: createChartRequestEpoch() } };
  const noop = () => {};
  const bindings = {
    ...epochs, MAX_IMAGE_BYTES: 100, prepareImage: (file: { name: string }) => file.name === "A" ? first.promise : second.promise,
    setImage: (image: string | null) => { if (image !== null) images.push(image); }, setFileName: noop, setError: noop, setAnalysis: noop, setBattlefieldChart: noop,
    setPreflightStatus: noop, setChartConfirmation: noop, invalidateChartWork: () => epochs.analysisEpoch.current.invalidate(),
  };
  const run = new AsyncFunction(...Object.keys(bindings), stripTypeScriptTypes(source) + "\nreturn loadFile;");
  const upload = await run(...Object.values(bindings));
  const event = (name: string) => ({ target: { files: [{ name, type: "image/png", size: 1 }] } });
  const old = upload(event("A")), latest = upload(event("B"));
  second.resolve("chart-B"); await latest;
  first.resolve("chart-A"); await old;
  assert.deepEqual(images, ["chart-B"]);
});

test("actual analysis caller discards success and error after chart replacement", async () => {
  const client = await readFile(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8");
  const source = client.slice(client.indexOf("  async function analyse("), client.indexOf("  async function askBullseye("));
  for (const failed of [false, true]) {
    const pending = deferred();
    const updates: unknown[] = [];
    const analysisEpoch = { current: createChartRequestEpoch() };
    const noop = () => {};
    const bindings = {
      image: "A", privacyChecked: true, busy: false, analysisRequestActive: { current: false }, reviewTarget: null,
      preflightStatus: "LOCKED", preflightAllowsAnalysis: () => true, contextImage: null, analysisEpoch,
      requestPocketAnalysis: async () => { await pending.promise; if (failed) throw new Error("old failure"); return { ticker: "A" }; },
      setError: (value: string) => { if (value) updates.push(value); }, setAnalysis: (value: unknown) => updates.push(value),
      setStockEvents: noop, setStockEventStatus: noop, setResultView: noop, setImmersive: noop, setShowResultReveal: noop, setBusy: noop,
    };
    const run = new AsyncFunction(...Object.keys(bindings), stripTypeScriptTypes(source) + "\nreturn analyse;");
    const analyse = await run(...Object.values(bindings));
    const request = analyse();
    analysisEpoch.current.invalidate();
    pending.resolve("done"); await request;
    assert.deepEqual(updates, []);
  }
});

test("actual analysis request stops before provider dispatch if chart changes during crop preparation", async () => {
  const client = await readFile(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8");
  const source = client.slice(client.indexOf("  async function requestPocketAnalysis("), client.indexOf("  async function analyse("));
  const crop = deferred(), started = deferred();
  const analysisEpoch = { current: createChartRequestEpoch() };
  let calls = 0;
  const bindings = {
    image: "A", analysisRequestActive: { current: false }, analysisEpoch, setBusy: () => {}, intention: "UNSURE",
    preflightStatus: "LOCKED", preflightAllowsAnalysis: () => true, chartConfirmation: { instrument: "US 500", timeframe: "5m", currentPrice: "100", contextMatch: "NOT_PROVIDED" }, accuracyCorrection: null, analysisCacheKey: async () => "A", analysisCacheGet: async () => null,
    hasVerifiedStructuralLevel: () => false, createPrecisionReadingCrop: () => { started.resolve("started"); return crop.promise; },
    fetch: async () => { calls += 1; throw new Error("must not dispatch"); },
  };
  const run = new AsyncFunction(...Object.keys(bindings), stripTypeScriptTypes(source) + "\nreturn requestPocketAnalysis;");
  const requestAnalysis = await run(...Object.values(bindings));
  const request = requestAnalysis(null);
  await started.promise; analysisEpoch.current.invalidate(); crop.resolve("crop");
  await assert.rejects(request, { name: "AbortError" });
  assert.equal(calls, 0);
  assert.equal(bindings.analysisRequestActive.current, false);
});

test("actual preflight effect ignores a body resolving after cleanup even if fetch ignores abort", async () => {
  const panel = await readFile(new URL("../app/pocket/ChartPreflightPanel.tsx", import.meta.url), "utf8");
  const controller = panel.indexOf("    const controller = new AbortController();");
  const start = panel.lastIndexOf("  useEffect(() => {", controller) + "  useEffect(() => {".length;
  const end = panel.indexOf("  }, [image, contextImage]);", controller);
  const body = deferred(), started = deferred();
  const updates: unknown[] = [];
  let callback!: () => Promise<void>;
  const record = (value: unknown) => updates.push(value);
  const bindings = {
    image: "A", contextImage: null, statusHandler: { current: record }, confirmationHandler: { current: record },
    window: { setTimeout: (next: () => Promise<void>) => { callback = next; return 1; }, clearTimeout: () => {} },
    fetch: async () => ({ ok: true, json: async () => { started.resolve("started"); await body.promise; return { preflight: { status: "READY" } }; } }),
    setResult: record, setInstrument: record, setTimeframe: record, setCurrentPrice: record, setStatus: record, setMessage: record,
  };
  const effect = stripTypeScriptTypes("function effect() {" + panel.slice(start, end) + "\n}");
  const run = new Function(...Object.keys(bindings), effect + "\nreturn effect();");
  const cleanup = run(...Object.values(bindings));
  const response = callback(); await started.promise;
  cleanup(); updates.length = 0; body.resolve("done"); await response;
  assert.deepEqual(updates, []);
});

test("an earlier FileReader completion cannot replace a newer chart", () => {
  const epoch = createChartRequestEpoch();
  const oldRead = epoch.begin();
  const newRead = epoch.begin();
  assert.equal(epoch.isCurrent(oldRead), false);
  assert.equal(epoch.isCurrent(newRead), true);
});

test("a response started for chart A cannot be applied after chart B is selected", () => {
  const epoch = createChartRequestEpoch();
  const chartA = epoch.snapshot();
  assert.equal(epoch.isCurrent(chartA), true);
  epoch.invalidate();
  assert.equal(epoch.isCurrent(chartA), false);
});

test("Pocket client guards FileReader and analysis responses by chart identity", async () => {
  const client = await readFile(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8");
  assert.match(client, /primaryUploadEpoch\.current\.begin\(\)/);
  assert.match(client, /contextUploadEpoch\.current\.begin\(\)/);
  assert.match(client, /analysisEpoch\.current\.invalidate\(\)/);
  assert.match(client, /primaryUploadEpoch\.current\.isCurrent\(readToken\)/);
  assert.match(client, /contextUploadEpoch\.current\.isCurrent\(readToken\)/);
  assert.match(client, /analysisEpoch\.current\.isCurrent\(requestToken\)/);
  assert.match(client, /setPreflightStatus\("CHECKING"\)/);
  assert.match(client, /setChartConfirmation\(null\)/);
});

test("old preflight callbacks are cancelled after image replacement", async () => {
  const panel = await readFile(new URL("../app/pocket/ChartPreflightPanel.tsx", import.meta.url), "utf8");
  assert.match(panel, /controller\.abort\(\)/);
  assert.match(panel, /if \(!active\) return/);
});

test("actual independent level scan cannot overwrite a replacement chart", async () => {
  const client = await readFile(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8");
  const source = client.slice(client.indexOf("  async function rescanLevelsOnly("), client.indexOf("  async function reanalyseResult("));
  const pending = deferred(), started = deferred();
  const updates: unknown[] = [];
  const analysisEpoch = { current: createChartRequestEpoch() }, levelLabUploadEpoch = { current: createChartRequestEpoch() };
  const noop = () => {};
  const bindings = {
    analysis: {}, levelLabImage: "A", levelLabRequestActive: { current: false }, analysisEpoch, levelLabUploadEpoch,
    setLevelLabStatus: noop, setLevelLabError: noop, setBattlefieldChart: noop, createPrecisionReadingCrop: async () => "crop",
    fetch: async () => ({ ok: true, json: async () => { started.resolve("started"); await pending.promise; return { levels: { levels: [] } }; } }),
    setAnalysis: (value: unknown) => updates.push(value), clampY: (value: number) => value,
  };
  const run = new AsyncFunction(...Object.keys(bindings), stripTypeScriptTypes(source) + "\nreturn rescanLevelsOnly;");
  const scan = await run(...Object.values(bindings));
  const response = scan(); await started.promise;
  analysisEpoch.current.invalidate(); pending.resolve("done"); await response;
  assert.deepEqual(updates, []);
});
