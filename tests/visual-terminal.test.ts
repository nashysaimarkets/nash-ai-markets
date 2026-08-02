import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { MarketSnapshot } from "../app/lib/market-data.ts";
import { TERMINAL_TIMEFRAMES, chartDisplayState, clampConfidence, isValidOhlcv, terminalMarketState, verifiedQuote } from "../app/terminal/lib/visual-terminal.ts";

test("chart reports an honest empty state without candles", () => {
  assert.equal(chartDisplayState([]), "empty");
});

test("chart loading state takes precedence", () => {
  assert.equal(chartDisplayState([], true, "ignored"), "loading");
});

test("chart error state is explicit", () => {
  assert.equal(chartDisplayState([], false, "provider timeout"), "error");
  assert.equal(chartDisplayState([{ time: 1, open: 2, high: 1, low: 0, close: 2, volume: 1 }]), "error");
  assert.equal(isValidOhlcv([]), true);
});

test("chart exposes every required timeframe", () => {
  assert.deepEqual(TERMINAL_TIMEFRAMES, ["1m", "5m", "15m", "1h", "4h", "1D"]);
});

test("preview data is disabled and never live", () => {
  assert.equal(terminalMarketState("PREVIEW", "not_configured", true), "Offline");
  assert.notEqual(terminalMarketState("PREVIEW", "connected", false), "Live");
});

test("confidence gauge values are bounded", () => {
  assert.equal(clampConfidence(-12), 0);
  assert.equal(clampConfidence(56.6), 57);
  assert.equal(clampConfidence(140), 100);
  assert.equal(clampConfidence(Number.NaN), 0);
});

test("status badges map live, delayed, cached and offline states", () => {
  assert.equal(terminalMarketState("LIVE", "connected", false), "Live");
  assert.equal(terminalMarketState("DELAYED", "degraded", false), "Delayed");
  assert.equal(terminalMarketState("PREVIEW", "not_configured", true), "Offline");
  assert.equal(terminalMarketState("UNAVAILABLE", "offline", true), "Offline");
});

test("unavailable snapshots hide values instead of inventing them", () => {
  const snapshot: MarketSnapshot = { status: "UNAVAILABLE", source: "none", asOf: "2026-07-16T12:00:00.000Z", quotes: [{ symbol: "ES", label: "ES", value: "9999", change: "+1", direction: "up" }], levels: [], events: [], bias: "UNAVAILABLE", risk: "HIGH", summary: "none", evidence: {} };
  assert.equal(verifiedQuote(snapshot, "ES"), null);
});

test("visual terminal preserves responsive safeguards while the page canvas is cleared", async () => {
  const [page, canvas, components, styles, warnings] = await Promise.all([
    readFile(new URL("../app/terminal/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/MemberEmptyCanvas.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/terminal/components/CustomerTerminal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/mission-control.css", import.meta.url), "utf8"),
    readFile(new URL("../app/terminal/lib/customer-warnings.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /TradingDeskOS/);
  assert.match(canvas, /BrandLogo/);
  assert.match(canvas, /terminalEmptyCanvas|terminalCanvasLogo/);
  assert.doesNotMatch(page, /DecisionEnginePanel snapshot=\{snapshot\} decision=\{decision\}|MarketsBrowser/);
  assert.match(warnings, /formatCustomerParticipationWarnings/);
  assert.match(components, /hasDisplayableQuotes|isDecisionReadySnapshot/);
  assert.match(styles, /overflow-x:hidden/);
  assert.match(styles, /@media\(max-width:640px\)/);
  assert.match(styles, /marketChartCanvas,.marketChartState\{height:300px\}/);
});
