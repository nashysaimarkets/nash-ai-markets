import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { answerAskBullseye, answerAskBullseyeQuery, ASK_BULLSEYE_QUESTIONS, parseAskBullseyeQuery } from "../app/lib/ask-bullseye.ts";
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

test("Ask Bullseye answers only from provided verified context", () => {
  const ctx = {
    snapshot: {
      status: "DELAYED",
      asOf: "2026-07-22T11:50:00.000Z",
      source: "test",
      quotes: [
        { symbol: "ES", label: "ES futures", value: "6350.25", change: "+1.2", direction: "up" },
        { symbol: "OIL", label: "Oil (USO)", value: "78.40", change: "-0.5", direction: "down" },
        { symbol: "US10Y", label: "US 10-year", value: "4.25", change: "+0.02", direction: "up" },
      ],
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
    structure: {
      schemaVersion: "1.0",
      instruments: [
        {
          symbol: "ES",
          label: "ES futures",
          status: "ready",
          support: { kind: "support", label: "Support", value: 6320, display: "6,320.00", source: "24h low" },
          resistance: { kind: "resistance", label: "Resistance", value: 6380, display: "6,380.00", source: "24h high" },
          references: [{ kind: "midpoint", label: "Range midpoint", value: 6350, display: "6,350.00", source: "mid" }],
          summary: "ES futures desk levels use the verified 24-hour candle range.",
          scalarOnly: false,
        },
        {
          symbol: "US10Y",
          label: "US 10-year",
          status: "insufficient",
          support: null,
          resistance: null,
          references: [],
          summary: "US 10-year is a verified scalar yield (4.25). OHLC support/resistance is unavailable for this feed.",
          scalarOnly: true,
        },
      ],
      disclosure: "Interpretive educational desk levels.",
    },
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

  const oil = answerAskBullseyeQuery("What is oil last?", ctx);
  assert.match(oil.body, /78\.40/);
  assert.match(oil.body, /Oil/);
  assert.doesNotMatch(oil.body, /forecast|will rise|target price/i);

  const treasury = answerAskBullseyeQuery("US10Y support and resistance", ctx);
  assert.match(treasury.body, /scalar|OHLC|unavailable/i);
  assert.doesNotMatch(treasury.body, /support:\s*4\.|resistance:\s*4\./i);

  const esRange = answerAskBullseyeQuery("ES support resistance", ctx);
  assert.match(esRange.body, /24-hour candle range|desk levels/i);
  assert.match(esRange.bullets.join(" "), /6,320\.00|6,380\.00/);

  const parsed = parseAskBullseyeQuery("How old is the VIX data?");
  assert.equal(parsed.questionId, "age");
  assert.equal(parsed.symbol, "VIX");
});

test("premium UX surfaces are wired without auth churn", async () => {
  const [shell, terminal, motion, mission, dashboard] = await Promise.all([
    read("../app/components/MemberShell.tsx"),
    read("../app/terminal/page.tsx"),
    read("../app/premium-motion.css"),
    read("../app/components/mission-control/MissionControl.tsx"),
    read("../app/globals.css"),
  ]);
  assert.match(shell, /PresentationModeToggle/);
  assert.match(shell, /Market brief/);
  assert.doesNotMatch(shell, /href="\/options"/);
  assert.match(terminal, /MemberShell/);
  assert.match(terminal, /active="terminal"/);
  assert.doesNotMatch(terminal, /<Link href="\/dashboard">Dashboard<\/Link><Link href="\/brief">Brief<\/Link>/);
  assert.match(motion, /prefers-reduced-motion:reduce/);
  assert.match(motion, /pmShimmerSweep/);
  assert.match(motion, /pmLogoFloat/);
  assert.match(motion, /pmHeadingIn/);
  assert.match(motion, /data-presentation/);
  assert.match(mission, /AskBullseye/);
  assert.match(mission, /askInteractive/);
  assert.match(mission, /mcActionTile/);
  assert.match(mission, /deskSignals/);
  assert.doesNotMatch(mission, /Open Options Corner|href="\/options"/);
  assert.match(dashboard, /premium-motion\.css/);
  assert.match(await read("../app/components/AskBullseye.tsx"), /askBullseyeForm/);
  assert.match(await read("../app/components/AskBullseye.tsx"), /interactive/);
  assert.match(await read("../app/terminal/page.tsx"), /interactive=\{access\.features\.intelligence\}/);
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
  assert.match(css, /ctReadinessGroups/);
});
