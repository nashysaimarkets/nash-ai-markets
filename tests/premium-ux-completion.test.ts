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
});

test("premium UX surfaces are wired without auth churn", async () => {
  const [shell, terminal, options, motion, mission, dashboard] = await Promise.all([
    read("../app/components/MemberShell.tsx"),
    read("../app/terminal/page.tsx"),
    read("../app/options/page.tsx"),
    read("../app/premium-motion.css"),
    read("../app/components/mission-control/MissionControl.tsx"),
    read("../app/globals.css"),
  ]);
  assert.match(shell, /PresentationModeToggle/);
  assert.match(shell, /Market brief/);
  assert.match(terminal, /MemberShell/);
  assert.match(terminal, /active="terminal"/);
  assert.doesNotMatch(terminal, /<Link href="\/dashboard">Dashboard<\/Link><Link href="\/brief">Brief<\/Link>/);
  assert.match(options, /optionsScenarioGrid/);
  assert.match(options, /Watching:/);
  assert.match(options, /optionsProviderPanel/);
  assert.match(motion, /prefers-reduced-motion:reduce/);
  assert.match(motion, /data-presentation/);
  assert.match(mission, /AskBullseye/);
  assert.match(mission, /mcActionTile/);
  assert.match(dashboard, /premium-motion\.css/);
});

test("mission control overflow root cause is cleared", async () => {
  const css = await read("../app/mission-control.css");
  assert.match(css, /\.missionControlLegacy\{[^}]*grid-template-columns:58px 1fr/);
  assert.match(css, /\.missionControl\{display:grid;gap:18px/);
  assert.doesNotMatch(css, /\.missionControl\{min-height:100vh;background:var\(--ft-bg\);color:var\(--ft-text\);display:grid;grid-template-columns:58px 1fr\}/);
  assert.match(css, /mcActionTile/);
  assert.match(css, /ctReadinessGroups/);
});
