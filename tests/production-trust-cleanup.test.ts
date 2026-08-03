import assert from "node:assert/strict";
import test from "node:test";
import { buildConfirmationSummary } from "../app/lib/confirmation-summary.ts";
import { buildDataHealthSummary } from "../app/lib/data-health-summary.ts";
import {
  buildEsCandleCloseSnapshot,
  buildEsQuoteSnapshot,
  resolvePrimaryEsDisplay,
} from "../app/lib/es-primary-snapshot.ts";
import { buildDeskDecisionPresentation } from "../app/terminal/lib/desk-decision-presentation.ts";
import { selectNextEconomicEvent } from "../app/dashboard/lib/daily-dashboard.ts";
import { groupVerifiedEvents } from "../app/terminal/lib/event-display.ts";
import { buildDeskGreeting } from "../app/dashboard/lib/market-weather.ts";
import { buildDashboardCommandSummary } from "../app/dashboard/lib/dashboard-command-summary.ts";
import { getMarketInstrument } from "../app/lib/markets/market-catalog.ts";
import {
  getCurrentMarketVideo,
  getCurrentSessionVideo,
  listPublishedMarketVideoArchive,
  marketDateInNewYork,
} from "../app/lib/market-video/select.ts";
import { privacyEnhancedEmbedUrl, normalizeMarketVideoRecord } from "../app/lib/market-video/validate.ts";
import { resolveSessionMarketVideos } from "../app/lib/market-video/session-placement.ts";
import type { MarketSnapshot } from "../app/lib/market-data.ts";
import type { SessionClockReading } from "../app/terminal/lib/session-clock.ts";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const sampleSession = (phase: SessionClockReading["phase"]): SessionClockReading => ({
  phase,
  label: phase,
  detail: "test",
  nowEt: "09:00",
  countdownLabel: null,
  countdownMs: null,
  nextEventLabel: null,
  source: "test",
});

test("customer-facing product copy stays focused on the S&P 500 decision workflow", () => {
  const repositoryRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const homepage = readFileSync(path.join(repositoryRoot, "app/page.tsx"), "utf8");
  const terminalPage = readFileSync(path.join(repositoryRoot, "app/terminal/page.tsx"), "utf8");
  const deskWidgets = readFileSync(path.join(repositoryRoot, "app/terminal/lib/desk-widgets.ts"), "utf8");

  assert.match(homepage, /Professional S&amp;P 500 futures intelligence/);
  assert.match(homepage, /Daily S&P 500 decision plan/);
  assert.doesNotMatch(homepage, /options-focused|Daily options setup|futures and options intelligence/i);
  assert.doesNotMatch(`${terminalPage}\n${deskWidgets}`, /interchangeable markets/i);
});

test("Founding Pro launch offer is reserved without sending members to the standard-price checkout", () => {
  const repositoryRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const homepage = readFileSync(path.join(repositoryRoot, "app/page.tsx"), "utf8");
  const pricingPlans = readFileSync(path.join(repositoryRoot, "app/pricing/PricingPlans.tsx"), "utf8");

  assert.match(homepage, /price: "12"/);
  assert.match(homepage, /standardPrice: "14\.99"/);
  assert.match(homepage, /\/waitlist\?plan=founding-pro/);
  assert.match(pricingPlans, /"£12\/month"/);
  assert.match(pricingPlans, /Reserve Founding Pro/);
  assert.match(pricingPlans, /checkout opens after final verification/i);
});

test("Restricted enum maps to WAIT FOR CONFIRMATION for customers", () => {
  const presentation = buildDeskDecisionPresentation({
    decision: {
      tradePermission: "no-trade",
      marketBias: "neutral",
      confidenceScore: 0,
      riskRating: "elevated",
      recommendedPosture: "stand_aside",
      topSupportingDrivers: [],
      conflictingDrivers: [],
      noTradeReasons: ["CRITICAL_INPUT_MISSING"],
      dataQualityWarnings: [],
    } as never,
    plan: null,
    signals: null,
    warnings: ["CRITICAL_INPUT_MISSING"],
  });
  assert.equal(presentation.permissionLabel, "WAIT FOR CONFIRMATION");
  assert.doesNotMatch(presentation.permissionLabel, /Restricted/i);
  assert.equal(presentation.confidenceLabel, "NOT ESTABLISHED");
  assert.doesNotMatch(presentation.confidenceLabel, /0\s*\/\s*100/);
});

test("complete valid confidence may display a number", () => {
  const presentation = buildDeskDecisionPresentation({
    decision: {
      tradePermission: "caution",
      marketBias: "bullish",
      confidenceScore: 64,
      riskRating: "moderate",
      recommendedPosture: "selective",
      topSupportingDrivers: [],
      conflictingDrivers: [],
      noTradeReasons: [],
      dataQualityWarnings: [],
    } as never,
    plan: null,
    signals: null,
    warnings: [],
  });
  assert.equal(presentation.confidenceLabel, "64 / 100");
});

test("IXIC never displays as NQ and NQ futures stay distinct", () => {
  const composite = getMarketInstrument("ixic");
  const futures = getMarketInstrument("nq-futures");
  assert.equal(composite?.symbol, "IXIC");
  assert.equal(composite?.name, "Nasdaq Composite");
  assert.doesNotMatch(composite?.name ?? "", /\bNQ\b/);
  assert.equal(futures?.symbol, "NQ");
  assert.doesNotMatch(futures?.name ?? "", /Nasdaq Composite/i);
  const controls = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../app/components/oracle/DashboardWorkspaceControls.tsx"),
    "utf8",
  );
  assert.match(controls, /value="ixic"/);
  assert.doesNotMatch(controls, /value="nq"/);
});

test("Dashboard and Brief choose the same next catalyst via shared grouping", () => {
  const now = Date.parse("2026-07-30T12:00:00.000Z");
  const events = [
    { time: "Wed 14:30", name: "Employment Cost – Wages QoQ", risk: "MED" as const, at: "2026-07-30T13:30:00.000Z" },
    { time: "Wed 14:30", name: "Employment Cost Index QoQ", risk: "MED" as const, at: "2026-07-30T13:30:00.000Z" },
    { time: "Wed 14:30", name: "Employment Cost – Benefits QoQ", risk: "MED" as const, at: "2026-07-30T13:30:00.000Z" },
  ];
  const grouped = groupVerifiedEvents(events, now, 1)[0];
  const next = selectNextEconomicEvent(events, now);
  assert.ok(grouped);
  assert.ok(next);
  assert.equal(grouped.name, "Employment Cost Index");
  assert.equal(next.name, "Employment Cost Index");
  assert.equal(next.startsAt, grouped.at);
});

test("expired catalyst is removed from next-event selection", () => {
  const now = Date.parse("2026-07-30T14:00:00.000Z");
  const next = selectNextEconomicEvent(
    [{ time: "past", name: "CPI", risk: "HIGH", at: "2026-07-30T13:00:00.000Z" }],
    now,
  );
  assert.equal(next, null);
});

test("shared ES snapshot prefers verified quote and labels candle close separately", () => {
  const snapshot = {
    status: "DELAYED",
    asOf: "2026-07-30T12:00:00.000Z",
    source: "Verified provider",
    quotes: [{ symbol: "ES", label: "ES", value: "5,500.25", change: "+12.50", direction: "up" }],
  } as MarketSnapshot;
  const quote = buildEsQuoteSnapshot({ snapshot, ageLabel: "Delayed · 10 minutes" });
  const candle = buildEsCandleCloseSnapshot({
    close: 5499.5,
    sourceTimestamp: "2026-07-30T11:55:00.000Z",
    ageLabel: "Candle · 16 minutes",
  });
  const primary = resolvePrimaryEsDisplay({ quote, candleClose: candle });
  assert.equal(primary.primarySource, "quote");
  assert.equal(primary.primaryValue, "5,500.25");
  assert.match(primary.disclosure, /verified delayed quote/i);

  const candleOnly = resolvePrimaryEsDisplay({
    quote: buildEsQuoteSnapshot({
      snapshot: { ...snapshot, quotes: [] } as MarketSnapshot,
      ageLabel: "n/a",
    }),
    candleClose: candle,
  });
  assert.equal(candleOnly.primarySource, "candle-close");
  assert.match(candleOnly.disclosure, /candle close/i);
});

test("dashboard hero and weather ES share the quote snapshot when available", () => {
  const snapshot = {
    status: "DELAYED",
    asOf: "2026-07-30T12:00:00.000Z",
    source: "Verified provider",
    risk: "MED",
    events: [],
    quotes: [
      { symbol: "ES", label: "ES", value: "5,501.00", change: "+8.00", direction: "up" },
      { symbol: "VIX", label: "VIX", value: "16.20", change: "-0.40", direction: "down" },
    ],
    levels: [],
  } as unknown as MarketSnapshot;
  const summary = buildDashboardCommandSummary({
    snapshot,
    session: sampleSession("rth"),
    candleSeries: null,
    decision: null,
    plan: null,
    signals: null,
    warnings: [],
    now: Date.parse("2026-07-30T12:05:00.000Z"),
  });
  assert.equal(summary.hero.price, "5,501.00");
  const weatherEs = summary.weather.find((item) => item.id === "ES");
  assert.equal(weatherEs?.value, "5,501.00");
  assert.match(summary.hero.priceSourceLabel, /quote/i);
});

test("data-health summary reflects stale supporting markets", () => {
  const healthy = buildDataHealthSummary([
    { id: "snapshot", label: "Market snapshot", status: "DELAYED", ageLabel: "10 minutes", detail: "ok" },
    { id: "es-candles", label: "ES candles", status: "DELAYED", ageLabel: "12 minutes", detail: "ok" },
    { id: "VIX", label: "VIX", status: "DELAYED", ageLabel: "12 minutes", detail: "ok" },
  ]);
  assert.equal(healthy.state, "healthy-delayed");

  const partial = buildDataHealthSummary([
    { id: "snapshot", label: "Market snapshot", status: "DELAYED", ageLabel: "10 minutes", detail: "ok" },
    { id: "es-candles", label: "ES candles", status: "DELAYED", ageLabel: "12 minutes", detail: "ok" },
    { id: "VIX", label: "VIX", status: "STALE", ageLabel: "46 minutes", detail: "stale" },
  ]);
  assert.equal(partial.state, "partial");
  assert.match(partial.headline, /Supporting markets stale|Partial delayed coverage/);
});

test("warning deduplication keeps at most three primary reasons", () => {
  const summary = buildConfirmationSummary([
    "support unavailable",
    "resistance unavailable",
    "trend unavailable",
    "momentum unavailable",
    "delayed data",
    "support unavailable",
    "CRITICAL_INPUT_MISSING",
  ]);
  assert.equal(summary.headline, "WAIT FOR CONFIRMATION");
  assert.ok(summary.primaryReasons.length <= 3);
  assert.equal(new Set(summary.technicalReasons).size, summary.technicalReasons.length);
});

test("session-aware brief headline changes with session phase", () => {
  assert.match(buildDeskGreeting("Alex", sampleSession("premarket")).briefHeadline, /pre-market briefing/i);
  assert.match(buildDeskGreeting("Alex", sampleSession("rth")).briefHeadline, /session update/i);
  assert.match(buildDeskGreeting("Alex", sampleSession("afterhours")).briefHeadline, /post-market review/i);
});

test("development More/Present controls stay hidden from member shell", () => {
  const shell = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../app/components/MemberShell.tsx"),
    "utf8",
  );
  assert.doesNotMatch(shell, /memberMoreMenu/);
  assert.doesNotMatch(shell, />PRESENT</);
});

test("market video selection requires exact market date and published status", () => {
  const today = marketDateInNewYork(Date.parse("2026-07-30T15:00:00.000Z"));
  const videos = [
    {
      id: "pre-today",
      youtubeVideoId: "dQw4w9WgXcQ",
      type: "PRE_MARKET",
      marketDate: today,
      title: "Pre-market",
      description: "",
      publishedAt: "2026-07-30T11:00:00.000Z",
      durationSeconds: 420,
      status: "published",
      source: "youtube",
      verifiedAt: "2026-07-30T11:00:00.000Z",
    },
    {
      id: "pre-yest",
      youtubeVideoId: "abcdefghijk",
      type: "PRE_MARKET",
      marketDate: "2026-07-29",
      title: "Yesterday",
      description: "",
      publishedAt: "2026-07-29T11:00:00.000Z",
      durationSeconds: 400,
      status: "published",
      source: "youtube",
      verifiedAt: "2026-07-29T11:00:00.000Z",
    },
    {
      id: "post-sched",
      youtubeVideoId: "lmnopqrstuv",
      type: "POST_MARKET",
      marketDate: today,
      title: "Scheduled post",
      description: "",
      publishedAt: "2026-07-30T21:00:00.000Z",
      durationSeconds: 500,
      status: "scheduled",
      source: "youtube",
      verifiedAt: "2026-07-30T12:00:00.000Z",
    },
  ];

  const pre = getCurrentMarketVideo({ type: "PRE_MARKET", marketDate: today, videos });
  assert.equal(pre.available, true);
  if (pre.available) assert.equal(pre.video.marketDate, today);

  const post = getCurrentMarketVideo({ type: "POST_MARKET", marketDate: today, videos });
  assert.equal(post.available, false);

  const wrongType = getCurrentMarketVideo({ type: "POST_MARKET", marketDate: today, videos: [videos[0]!] });
  assert.equal(wrongType.available, false);

  assert.equal(normalizeMarketVideoRecord({ ...videos[0], youtubeVideoId: "bad" }), null);
  assert.match(privacyEnhancedEmbedUrl("dQw4w9WgXcQ") ?? "", /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);

  const archive = listPublishedMarketVideoArchive(videos, 5);
  assert.ok(archive.every((item) => item.status === "published"));
  assert.ok(!archive.some((item) => item.status === "scheduled"));
});

test("session placement never treats previous-day video as today and fails soft", () => {
  const bundle = resolveSessionMarketVideos({
    phase: "premarket",
    now: Date.parse("2026-07-30T12:00:00.000Z"),
    videos: [
      {
        id: "old",
        youtubeVideoId: "abcdefghijk",
        type: "PRE_MARKET",
        marketDate: "2026-07-29",
        title: "Old",
        description: "",
        publishedAt: "2026-07-29T11:00:00.000Z",
        durationSeconds: 300,
        status: "published",
        source: "youtube",
        verifiedAt: "2026-07-29T11:00:00.000Z",
      },
    ],
  });
  assert.equal(bundle.briefPrimary.available, false);
  assert.equal(bundle.dashboardSelection.available, false);
});

test("getCurrentSessionVideo selects by session and shows pending once during RTH", () => {
  const today = "2026-07-30";
  const videos = [
    {
      id: "pre",
      youtubeVideoId: "dQw4w9WgXcQ",
      type: "PRE_MARKET",
      marketDate: today,
      title: "Pre",
      summary: "Context before the open.",
      description: "Context before the open.",
      publishedAt: "2026-07-30T11:00:00.000Z",
      durationSeconds: 300,
      status: "published",
      source: "youtube",
      verifiedAt: "2026-07-30T11:00:00.000Z",
    },
  ];
  const pre = getCurrentSessionVideo({
    marketDate: today,
    session: "premarket",
    videos,
  });
  assert.equal(pre.available, true);
  if (pre.available) assert.equal(pre.video.type, "PRE_MARKET");

  const rth = getCurrentSessionVideo({
    marketDate: today,
    session: "rth",
    videos,
  });
  assert.equal(rth.available, false);
  assert.equal(rth.showPostMarketPending, true);

  const after = resolveSessionMarketVideos({
    phase: "rth",
    now: Date.parse("2026-07-30T16:00:00.000Z"),
    videos,
  });
  assert.equal(after.postMarketPendingNotice, "Post-market review will appear here after publication.");
  assert.equal(after.dashboardSelection.available, false);
  assert.ok(after.deskShortcut?.available);
});

test("MarketVideoPlayer is click-to-load without autoplay", () => {
  const source = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../app/components/MarketVideoPlayer.tsx"),
    "utf8",
  );
  assert.match(source, /useState\(false\)/);
  assert.doesNotMatch(source, /autoplay=1|autoPlay/);
  assert.match(source, /youtube-nocookie|embedUrl/);
  assert.match(source, /loading="lazy"/);
});

test("normalizeMarketVideoRecord maps summary and rejects scheduled as displayable only via status", () => {
  const ok = normalizeMarketVideoRecord({
    id: "s1",
    youtubeVideoId: "dQw4w9WgXcQ",
    type: "POST_MARKET",
    marketDate: "2026-07-30",
    title: "Review",
    summary: "Calm session review.",
    publishedAt: "2026-07-30T21:00:00.000Z",
    durationSeconds: 420,
    status: "published",
    source: "youtube",
    verifiedAt: "2026-07-30T21:00:00.000Z",
  });
  assert.ok(ok);
  assert.equal(ok?.summary, "Calm session review.");
});
