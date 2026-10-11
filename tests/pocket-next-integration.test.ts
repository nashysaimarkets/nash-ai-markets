import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("redesign analysis retains image-bound confirmation, cancellation and server entitlement transport", async () => {
  const source = await readFile(new URL("../app/pocket-next/PocketNext.tsx", import.meta.url), "utf8");
  const start = source.indexOf("const analyseChart = async");
  const body = source.slice(start, source.indexOf("const run = async", start));
  assert.match(body, /preflightAllowsAnalysis\(slot.status\)/);
  assert.match(body, /!slot.confirmation/);
  assert.match(body, /pocketAuthenticatedFetch\("\/api\/pocket\/analyse"/);
  assert.match(body, /chartConfirmation: slot.confirmation/);
  assert.match(body, /signal: controller.signal/);
  assert.match(body, /chartEpoch.current.isCurrent\(token\)/);
});
test("redesign never overlays another chart's report or automatically runs the unqualified device scanner", async () => {
  const source = await readFile(new URL("../app/pocket-next/PocketNext.tsx", import.meta.url), "utf8");
  assert.match(source, /const analysis = activeSlot\?\.analysis \?\? null/);
  assert.doesNotMatch(source, /await scanChartLocally\(nextImage\)/);
  assert.match(source, /<OriginalChartEvidence/);
  assert.match(source, /demoMode && <svg/);
  assert.match(source, /<ChartPreflightPanel/);
});

test("actual redesign handler blocks unconfirmed charts and abandons cancelled crop work before transport", async () => {
  const { stripTypeScriptTypes } = await import("node:module");
  const { createChartRequestEpoch } = await import("../app/pocket/chart-request-identity.ts");
  const source = await readFile(new URL("../app/pocket-next/PocketNext.tsx", import.meta.url), "utf8");
  const start = source.indexOf("  const analyseChart = async");
  const body = source.slice(start, source.indexOf("  const run = async", start));
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  let dispatches = 0, cropResolve!: (value: null) => void;
  const crop = new Promise<null>(resolve => { cropResolve = resolve; });
  const slot = { image: "A", status: "LOCKED", confirmation: null as unknown, revision: 1 };
  const epoch = createChartRequestEpoch();
  const bindings = { charts: [slot], privacy: true, busy: false, requestActive: { current: false }, demoMode: false, chartEpoch: { current: epoch }, controllerRef: { current: null }, preflightAllowsAnalysis: () => true, setBusyChart: () => {}, setError: () => {}, precisionCrop: async () => crop, pocketAuthenticatedFetch: async () => { dispatches++; throw new Error("transport reached"); }, intention: "UNSURE", setCharts: () => { throw new Error("stale result applied"); }, setActiveChart: () => {}, setActive: () => {} };
  const handler = await new AsyncFunction(...Object.keys(bindings), stripTypeScriptTypes(body) + "\nreturn analyseChart;")(...Object.values(bindings));
  await handler(0); assert.equal(dispatches, 0); assert.equal(bindings.requestActive.current, false);
  slot.confirmation = { instrument: "US 500", timeframe: "5m", currentPrice: "100" };
  const pending = handler(0);
  epoch.invalidate(); cropResolve(null); await pending;
  assert.equal(dispatches, 0); assert.equal(bindings.requestActive.current, false);
});

test("professional preview exposes guarded existing cross-check and native subscription tools without dispatching them in demos", async () => {
  const source = await readFile(new URL("../app/pocket-next/PocketNext.tsx", import.meta.url), "utf8");
  for (const component of ["OptionsWallCheck", "CryptoDerivativesCheck", "PersonalRiskDesk", "NativeSubscriptionControls"]) assert.match(source, new RegExp(`<${component}\\b`));
  assert.match(source, /!demoMode && !deviceOnly/);
});
