import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runBullseyeEngine } from "../app/lib/bullseye-engine.ts";
import { formatSnapshotAge, formatUkTimestamp, getMarketSnapshot, normalizeSnapshotFreshness, UNAVAILABLE_SNAPSHOT_TIMESTAMP, type MarketSnapshot } from "../app/lib/market-data.ts";
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
  assert.equal(formatUkTimestamp(snapshot.asOf), "Timestamp unavailable");
  assert.equal(formatSnapshotAge(snapshot.asOf), "age unavailable");
});

test("generic freshness validation rejects materially future timestamps", () => {
  const result = normalizeSnapshotFreshness(liveSnapshot({ asOf: "2026-07-17T12:02:00.000Z" }), Date.parse("2026-07-17T12:00:00.000Z"));
  assert.equal(result.status, "UNAVAILABLE");
  assert.deepEqual(result.quotes, []);
  assert.match(result.summary, /ahead of server time/);
});

test("aged verified quotes remain visible after the decision window closes", () => {
  const result = normalizeSnapshotFreshness(
    liveSnapshot({ asOf: "2026-07-17T11:00:00.000Z" }),
    Date.parse("2026-07-17T12:00:00.000Z"),
  );
  assert.equal(result.status, "UNAVAILABLE");
  assert.equal(result.quotes.length, 1);
  assert.equal(result.quotes[0]?.value, "6300");
  assert.match(result.source, /previous session/i);
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
  const [login, browserClient, callback, confirmation, implicit] = await Promise.all([
    readFile(new URL("../app/login/LoginForm.tsx", import.meta.url), "utf8"),
    readFile(new URL("../utils/supabase/client.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/callback/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/confirm/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/implicit/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.equal(login.includes("setMessage(error ? error.message"), false);
  assert.ok(login.includes("window.location.origin"));
  assert.ok(login.includes("buildEmailRedirectTo"));
  assert.ok(login.includes("defaultPostAuthPath"));
  assert.ok(login.includes("Request accepted."));
  assert.ok(login.includes("setCooldown(60)"));
  assert.ok(login.includes("Retry available in"));
  assert.ok(login.includes("disabled={loading || cooldown > 0}"));
  assert.ok(login.includes("Delivery may take a few minutes"));
  assert.ok(login.includes('searchParams.get("error")'));
  assert.ok(login.includes("messageForSignInError"));
  assert.ok(login.includes("messageForOtpRequestError"));
  assert.ok(login.includes("over_email_send_rate_limit"));
  assert.ok(login.includes("Do not retry yet"));
  assert.equal(login.includes("Link sent."), false);
  assert.ok(browserClient.includes('flowType: "pkce"'));
  assert.ok(callback.includes("safeAuthNextPath"));
  assert.ok(callback.includes("exchangeCodeForSession"));
  assert.ok(callback.includes("login?error=signin"));
  assert.ok(confirmation.includes("verifyOtp"));
  assert.ok(confirmation.includes("safeAuthNextPath"));
  assert.ok(confirmation.includes("EMAIL_OTP_TYPES.has"));
  assert.equal(confirmation.includes("error.message"), false);
  assert.ok(implicit.includes("window.location.hash.slice(1)"));
  assert.ok(implicit.includes("setSession"));
  assert.ok(implicit.includes("safeAuthNextPath"));
  assert.ok(implicit.includes("window.history.replaceState"));
});

test("mobile terminal controls retain touch targets and bounded chart height", async () => {
  const styles = await readFile(new URL("../app/mission-control.css", import.meta.url), "utf8");
  assert.ok(styles.includes(".timeframeSelector button,.terminalErrorCard button,.terminalErrorCard a{min-height:44px}"));
  assert.ok(styles.includes("height:clamp(260px,48vh,320px)"));
});
