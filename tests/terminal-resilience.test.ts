import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runBullseyeEngine } from "../app/lib/bullseye-engine.ts";
import { getMarketSnapshot, normalizeSnapshotFreshness, UNAVAILABLE_SNAPSHOT_TIMESTAMP, type MarketSnapshot } from "../app/lib/market-data.ts";
import { chartDataForStatus } from "../app/terminal/lib/visual-terminal.ts";

function liveSnapshot(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return {
    status: "LIVE", source: "Test provider", asOf: "2026-07-17T12:00:00.000Z",
    quotes: [{ symbol: "ES", label: "ES", value: "6300", change: "0", direction: "flat" }],
    levels: [], events: [], bias: "NEUTRAL", risk: "MODERATE", summary: "test", evidence: {},
    ...overrides,
  };
}

test("provider failure returns an empty unavailable snapshot with a fixed timestamp", async () => {
  const snapshot = await getMarketSnapshot({ provider: async () => { throw new Error("secret-bearing provider failure"); } });
  assert.equal(snapshot.status, "UNAVAILABLE");
  assert.equal(snapshot.asOf, UNAVAILABLE_SNAPSHOT_TIMESTAMP);
  assert.deepEqual(snapshot.quotes, []);
  assert.deepEqual(snapshot.levels, []);
  assert.deepEqual(snapshot.events, []);
});

test("generic freshness validation rejects materially future timestamps", () => {
  const result = normalizeSnapshotFreshness(liveSnapshot({ asOf: "2026-07-17T12:02:00.000Z" }), Date.parse("2026-07-17T12:00:00.000Z"));
  assert.equal(result.status, "UNAVAILABLE");
  assert.match(result.summary, /ahead of server time/);
});

test("preview status produces no chart data or trade guidance", () => {
  assert.deepEqual(chartDataForStatus("PREVIEW").data, []);
  const result = runBullseyeEngine(liveSnapshot({ status: "PREVIEW" }));
  assert.equal(result.confidence, 0);
  assert.equal(result.noTradeProbability, 100);
  assert.equal(result.bullTrigger, "Unavailable");
  assert.equal(result.bearTrigger, "Unavailable");
});

test("legacy trade output selects primary levels and never duplicates the UK suffix", () => {
  const result = runBullseyeEngine(liveSnapshot({
    levels: [
      { label: "R2", value: "6350", note: "far", type: "resistance" },
      { label: "R1", value: "6330", note: "primary", type: "resistance" },
      { label: "S2", value: "6270", note: "far", type: "support" },
      { label: "S1", value: "6300", note: "primary", type: "support" },
    ],
    events: [{ time: "13:30 UK", name: "US data", risk: "HIGH" }],
  }));
  assert.match(result.bullTrigger, /6330/);
  assert.match(result.bearTrigger, /6300/);
  assert.doesNotMatch(result.riskWindowPrep, /UK UK/);
});

test("login and callback paths sanitize errors and redirect destinations", async () => {
  const [login, callback, confirmation] = await Promise.all([
    readFile(new URL("../app/login/LoginForm.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/callback/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/confirm/route.ts", import.meta.url), "utf8"),
  ]);
  assert.equal(login.includes("setMessage(error ? error.message"), false);
  assert.ok(login.includes("window.location.origin"));
  assert.ok(callback.includes('!requestedNext.startsWith("//")'));
  assert.ok(confirmation.includes("verifyOtp"));
  assert.ok(confirmation.includes('!requestedNext.startsWith("//")'));
  assert.ok(confirmation.includes("EMAIL_OTP_TYPES.has"));
  assert.equal(confirmation.includes("error.message"), false);
});

test("mobile terminal controls retain touch targets and bounded chart height", async () => {
  const styles = await readFile(new URL("../app/mission-control.css", import.meta.url), "utf8");
  assert.ok(styles.includes(".timeframeSelector button,.terminalErrorCard button,.terminalErrorCard a{min-height:44px}"));
  assert.ok(styles.includes("height:clamp(260px,48vh,320px)"));
});
