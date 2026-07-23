import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultWorkspacePreferences,
  galleryInstruments,
  hasCompletedMarketSelection,
  layoutForPreset,
  normalizeWorkspacePreferences,
  normalizeWidgetLayout,
  buildWorkspaceGreeting,
  buildHistoricalContext,
  buildMarketReview,
  isWorkspaceInstrumentId,
  WORKSPACE_WIDGETS,
} from "../app/lib/workspace/index.ts";
import { safeAuthNextPath } from "../app/lib/auth/safe-auth-redirect.ts";

test("gallery includes required customer instruments with truthful coverage", () => {
  const gallery = galleryInstruments();
  const ids = gallery.map((item) => item.id);
  for (const required of ["ES", "NQ", "YM", "RTY", "GC", "SI", "CL", "BTC", "EURUSD", "GBPUSD", "FTSE", "DAX", "NIKKEI"]) {
    assert.ok(ids.includes(required as never), `missing ${required}`);
  }
  const unsupported = gallery.filter((item) => item.coverage === "awaiting_provider");
  assert.ok(unsupported.length >= 5);
  for (const item of unsupported) {
    assert.equal(item.boardSymbol, null);
    assert.equal(item.candleInstrument, null);
    assert.match(item.unavailableReason ?? "", /Awaiting verified provider coverage/);
  }
  const es = gallery.find((item) => item.id === "ES");
  assert.equal(es?.coverage, "quotes_and_candles");
  assert.equal(es?.candleInstrument, "ES");
});

test("normalizeWorkspacePreferences rejects empty favourites and unknown ids", () => {
  assert.equal(normalizeWorkspacePreferences({ favourites: [] }), null);
  assert.equal(normalizeWorkspacePreferences({ favourites: ["NOPE"] }), null);
  assert.equal(normalizeWorkspacePreferences(null), null);
  const ok = normalizeWorkspacePreferences({
    favourites: ["ES", "NQ", "GC"],
    primaryInstrument: "ES",
    activeInstrument: "NQ",
    chartTimeframe: "15m",
    preset: "macro_trader",
    dismissedOnboarding: true,
    lastWorkspaceAt: "2026-07-23T12:00:00.000Z",
  });
  assert.ok(ok);
  assert.deepEqual(ok.favourites, ["ES", "NQ", "GC"]);
  assert.equal(ok.activeInstrument, "NQ");
  assert.equal(ok.chartTimeframe, "15m");
  assert.equal(hasCompletedMarketSelection(ok), true);
  assert.equal(hasCompletedMarketSelection(defaultWorkspacePreferences()), false);
});

test("widget layout normalize fills missing registry ids and drops unknowns", () => {
  const layout = normalizeWidgetLayout([
    { id: "primary_chart", size: "xl", enabled: true },
    { id: "not_a_widget", size: "md", enabled: true },
    { id: "news", size: "md", enabled: true },
  ]);
  assert.ok(layout.every((item) => WORKSPACE_WIDGETS.some((widget) => widget.id === item.id)));
  assert.ok(layout.find((item) => item.id === "primary_chart")?.enabled);
  assert.ok(layout.find((item) => item.id === "news")?.enabled);
  assert.equal(layout.find((item) => item.id === "alerts")?.enabled, false);
});

test("presets only enable known widgets", () => {
  const layout = layoutForPreset("index_day_trader");
  assert.ok(layout.some((item) => item.id === "primary_chart" && item.enabled));
  assert.ok(layout.some((item) => item.id === "session_clock" && item.enabled));
});

test("greeting uses safe first name and favourite labels only", () => {
  const greet = buildWorkspaceGreeting({
    email: "chris.trader@example.com",
    favourites: ["ES", "NQ", "GC"],
    now: new Date("2026-07-23T09:00:00Z"),
  });
  assert.match(greet.headline, /Chris/);
  assert.match(greet.subline, /S&P 500/);
  assert.match(greet.subline, /Nasdaq/);
  assert.match(greet.subline, /Gold/);
  assert.doesNotMatch(greet.subline, /suitable|wealthy|afford/i);
});

test("historical context fails closed without candles and never predicts", () => {
  const empty = buildHistoricalContext({
    instrumentId: "ES",
    candles: [],
    coverage: "quotes_and_candles",
  });
  assert.equal(empty.available, false);
  const awaiting = buildHistoricalContext({
    instrumentId: "BTC",
    candles: null,
    coverage: "awaiting_provider",
  });
  assert.match(awaiting.unavailableReason ?? "", /Awaiting verified provider coverage/);
  const candles = Array.from({ length: 12 }, (_, index) => ({
    time: 1_700_000_000 + index * 300,
    open: 100 + index,
    high: 101 + index,
    low: 99 + index,
    close: 100.5 + index,
    volume: 10,
  }));
  const ready = buildHistoricalContext({
    instrumentId: "ES",
    candles,
    coverage: "quotes_and_candles",
  });
  assert.equal(ready.available, true);
  assert.match(ready.disclaimer, /do not guarantee/);
});

test("market review fails closed for unsupported coverage", () => {
  const review = buildMarketReview({
    instrumentId: "BTC",
    snapshot: {
      status: "DELAYED",
      source: "test",
      asOf: new Date().toISOString(),
      quotes: [],
      levels: [],
      events: [],
      bias: "neutral",
      risk: "MODERATE",
      summary: "",
      evidence: {},
    },
    intelligence: null,
    decision: null,
    plan: null,
    deskSignals: null,
    structure: null,
    decisionReady: true,
    coverage: "awaiting_provider",
  });
  assert.equal(review.available, false);
  assert.match(review.unavailableReason ?? "", /Awaiting verified provider coverage/);
});

test("auth allowlist accepts /markets without changing default /terminal", () => {
  assert.equal(safeAuthNextPath("/markets"), "/markets");
  assert.equal(safeAuthNextPath(null), "/terminal");
  assert.equal(isWorkspaceInstrumentId("ES"), true);
  assert.equal(isWorkspaceInstrumentId("FAKE"), false);
});
