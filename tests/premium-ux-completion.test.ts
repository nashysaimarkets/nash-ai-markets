import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { answerAskBullseye, ASK_BULLSEYE_QUESTIONS } from "../app/lib/ask-bullseye.ts";
import { formatAgeFromMs, formatFreshnessLabel, formatRelativeAge } from "../app/lib/freshness-labels.ts";
import type { AskBullseyeContext } from "../app/lib/ask-bullseye.ts";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("freshness labels distinguish snapshot and candle ages", () => {
  const now = Date.parse("2026-07-22T12:00:00.000Z");
  assert.equal(formatRelativeAge("2026-07-22T11:50:00.000Z", now), "10m old");
  assert.equal(formatAgeFromMs(18 * 60_000), "18m old");
  assert.match(formatFreshnessLabel("snapshot", "2026-07-22T11:50:00.000Z", now), /Snapshot age: 10m old/);
  assert.match(formatFreshnessLabel("candle", 18 * 60_000), /Latest candle age: 18m old/);
});

test("authoritative delayed candle age uses dataAgeMs across surfaces", async () => {
  const {
    formatDelayedVerifiedCandleAgeDisplay,
    formatVerifiedCandleAgePhrase,
    formatNominalProviderDelayNote,
  } = await import("../app/lib/freshness-labels.ts");
  const ageMs = 14 * 60_000;
  const phrase = formatVerifiedCandleAgePhrase(ageMs);
  const line = formatDelayedVerifiedCandleAgeDisplay(ageMs);
  assert.equal(phrase, "14 minutes old");
  assert.equal(line, "Delayed market data · latest verified candle 14 minutes old");
  assert.equal(
    formatDelayedVerifiedCandleAgeDisplay(ageMs),
    `Delayed market data · latest verified candle ${formatVerifiedCandleAgePhrase(ageMs)}`,
  );
  assert.equal(formatNominalProviderDelayNote(10), "Nominal provider delay: approximately 10 minutes");
  assert.notEqual(formatNominalProviderDelayNote(10), line);
  assert.doesNotMatch(line, /\b10m\b|approximately 10/);

  const chartMetric = phrase.charAt(0).toUpperCase() + phrase.slice(1);
  assert.equal(chartMetric, "14 minutes old");
  assert.match(line, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("mapCandleFreshness age labels match shared candle age phrase", async () => {
  const { mapCandleFreshness } = await import("../app/terminal/lib/desk-payload.ts");
  const { formatVerifiedCandleAgePhrase } = await import("../app/lib/freshness-labels.ts");
  const ageMs = 14 * 60_000;
  const feed = mapCandleFreshness(
    {
      symbol: "ESUSD",
      contract: "ES",
      instrumentName: "ES",
      exchange: "CME",
      instrumentDetail: "test",
      timeframe: "5m",
      classification: "delayed",
      dataAgeMs: ageMs,
      provider: "Financial Modeling Prep",
      status: "delayed",
      asOf: "2026-07-22T11:46:00.000Z",
      candles: [],
      failureCategory: null,
    },
    "ES candles",
  );
  assert.equal(feed.ageLabel, formatVerifiedCandleAgePhrase(ageMs));
  assert.equal(feed.ageLabel, "14 minutes old");
});

test("Ask Bullseye answers only from provided verified context", () => {
  const ctx = {
    snapshot: {
      status: "DELAYED",
      asOf: "2026-07-22T11:50:00.000Z",
      source: "test",
      quotes: [{ symbol: "ES", value: "6350.25", change: "+1.2", direction: "up" }],
      levels: [{ label: "S1", value: "6320", type: "support", note: "primary" }],
      events: [{ time: "13:30 UK", name: "US data", risk: "HIGH" }],
      evidence: {},
    },
    intelligence: {
      scores: { bullseyeConfidence: 42, trend: 40, volatility: 55 },
      scenarios: [],
      reasoning: { missingDataWarnings: ["Breadth incomplete"] },
    },
    decision: {
      marketBias: "neutral",
      riskRating: "elevated",
      tradePermission: "no-trade",
      volatilityRegime: "elevated",
      confidenceScore: 42,
      noTradeReasons: ["Evidence incomplete"],
      invalidationConditions: [],
      topSupportingDrivers: ["Verified delayed ES"],
      conflictingDrivers: ["Event risk"],
    },
    plan: {
      directionalPosture: "stand_aside",
      executionReadiness: "closed",
      preferredSetupType: "none",
      participationLevel: "none",
      requiredConfirmations: [],
      eventRiskWarnings: [],
    },
    gateway: { connectionStatus: "connected", dataAgeMs: 600_000, fallbackActive: false },
    decisionReady: false,
    bullishConfirm: "Bullish confirmation above 6365",
    bearishConfirm: "Bearish confirmation below 6310",
    invalidation: "Stand aside if data ages out",
    noTrade: ["Evidence incomplete"],
    dataAge: "10m old",
  } as unknown as AskBullseyeContext;

  assert.equal(ASK_BULLSEYE_QUESTIONS.length >= 6, true);
  const answer = answerAskBullseye("stand-aside", ctx);
  assert.match(answer.body, /closed|Stand aside|Permission/i);
  assert.match(answer.disclaimer, /Deterministic educational/);
  assert.doesNotMatch(answer.body, /buy calls|sell puts|delta|premium \$/i);

  const lean = answerAskBullseye("desk-lean", {
    ...ctx,
    deskSignals: {
      schemaVersion: "1.0",
      overallLean: "buying",
      buying: {
        side: "buying",
        strength: "moderate",
        status: "active",
        headline: "Moderate buying lean",
        summary: "Verified cross-asset inputs currently lean toward an educational buying interpretation.",
        drivers: ["ES futures latest move is higher (+1.2%)."],
        watchingFor: "Watching bullish confirmation above 6365 on verified ES evidence.",
      },
      selling: {
        side: "selling",
        strength: "none",
        status: "inactive",
        headline: "Selling lean inactive",
        summary: "Verified inputs do not currently support an educational selling lean.",
        drivers: ["No verified inputs currently align with a selling lean."],
        watchingFor: "Watching for verified downside confirmation on ES before treating selling lean as active.",
      },
      contextNotes: [],
      disclosure: "Interpretive educational desk signals derived from verified market snapshot inputs. Not trade advice, not broker execution signals, and not executable orders.",
    },
  });
  assert.match(lean.body, /Moderate buying lean/i);
  assert.match(lean.bullets.join(" "), /ES futures|educational desk signals/i);
  assert.doesNotMatch(lean.body, /strike|greek|premium \$/i);
});

test("premium UX surfaces are wired without auth churn", async () => {
  const [shell, terminal, motion, mission, dashboard] = await Promise.all([
    read("../app/components/MemberShell.tsx"),
    read("../app/terminal/page.tsx"),
    read("../app/premium-motion.css"),
    read("../app/components/mission-control/MissionControl.tsx"),
    read("../app/globals.css"),
  ]);
  assert.doesNotMatch(shell, /PresentationModeToggle/);
  assert.doesNotMatch(shell, /memberMoreMenu/);
  assert.match(shell, /Morning Brief/);
  assert.match(shell, /Trading Desk/);
  assert.doesNotMatch(shell, /href="\/options"/);
  assert.match(terminal, /TradingDeskOS/);
  assert.match(terminal, /active="terminal"/);
  assert.doesNotMatch(terminal, /<Link href="\/dashboard">Dashboard<\/Link><Link href="\/brief">Brief<\/Link>/);
  assert.match(motion, /prefers-reduced-motion:reduce/);
  assert.match(motion, /pmShimmerSweep/);
  assert.match(motion, /pmLogoFloat/);
  assert.match(motion, /pmHeadingIn/);
  assert.match(motion, /data-presentation/);
  assert.doesNotMatch(mission, /AskBullseye/);
  assert.match(mission, /mcActionTile/);
  assert.match(mission, /deskSignals/);
  assert.doesNotMatch(mission, /Open Options Corner|href="\/options"/);
  assert.match(dashboard, /premium-motion\.css/);
});

test("logo concept review harness stays non-production", async () => {
  const page = await read("../app/dev/logo-concepts/page.tsx");
  assert.match(page, /NODE_ENV === "production"/);
  assert.match(page, /logo-mark-command\.svg/);
  assert.match(page, /logo-mark-candle\.svg/);
  assert.match(page, /logo-horizontal-command\.svg/);
  assert.match(page, /Logo concept review/);
});

test("mission control overflow root cause is cleared", async () => {
  const css = await read("../app/mission-control.css");
  assert.match(css, /\.missionControlLegacy\{[^}]*grid-template-columns:58px 1fr/);
  assert.match(css, /\.missionControl\{display:grid;gap:18px/);
  assert.doesNotMatch(css, /\.missionControl\{min-height:100vh;background:var\(--ft-bg\);color:var\(--ft-text\);display:grid;grid-template-columns:58px 1fr\}/);
  assert.match(css, /mcActionTile/);
  assert.match(css, /ctInstrumentBoard\.is-compact/);
  assert.doesNotMatch(css, /ctReadinessGroups/);
});
