import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildDeskDecisionPresentation } from "../app/terminal/lib/desk-decision-presentation.ts";
import { dedupeVerifiedEvents, normalizeEventTitle } from "../app/terminal/lib/event-display.ts";
import { DESK_VIEW_IDS, DESK_VIEW_WIDGETS, widgetsForView } from "../app/terminal/lib/desk-views.ts";
import { coverageLabel } from "../app/lib/markets/market-catalog.ts";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("desk decision presentation separates lean from blocked permission", () => {
  const presentation = buildDeskDecisionPresentation({
    decision: {
      marketBias: "bullish",
      tradePermission: "no-trade",
      confidenceScore: 0,
      riskRating: "high",
      recommendedPosture: "stand-aside",
      volatilityRegime: "elevated",
      topSupportingDrivers: [{ factor: "TREND", contribution: 1 }],
      conflictingDrivers: [{ factor: "INVERSE_VOLATILITY", contribution: -1 }],
      noTradeReasons: ["CRITICAL_INPUT_MISSING"],
      dataQualityWarnings: [],
    } as never,
    plan: {
      reasonsToRemainSidelined: ["CRITICAL_INPUT_MISSING"],
      requiredConfirmations: ["DATA_CURRENT"],
      priorityChecklist: [],
      eventRiskWarnings: [],
      executionReadiness: "blocked",
    } as never,
    signals: {
      overallLean: "buying",
      buying: { drivers: ["ES higher"], status: "watching", side: "buying", strength: "soft", headline: "Soft buying", summary: "Soft", watchingFor: "" },
      selling: { drivers: [], status: "inactive", side: "selling", strength: "none", headline: "Inactive", summary: "", watchingFor: "" },
      contextNotes: [],
      disclosure: "",
      schemaVersion: "1.0",
    },
    warnings: ["Required market evidence is missing"],
  });

  assert.equal(presentation.leanLabel, "Mildly bullish");
  assert.equal(presentation.permissionLabel, "Blocked");
  assert.equal(presentation.permissionTone, "blocked");
  assert.equal(presentation.confidenceLabel, "0 / 100");
  assert.match(presentation.why, /blocked|incomplete|missing/i);
  assert.doesNotMatch(presentation.why, /instruction to buy|enter long/i);
});

test("event display normalizes and dedupes Fed press conference labels", () => {
  assert.equal(normalizeEventTitle("Press Conference"), "Fed Press Conference");
  const events = dedupeVerifiedEvents([
    { time: "19:30", name: "Fed Press Conference", risk: "HIGH" },
    { time: "19:30", name: "Press Conference", risk: "HIGH" },
    { time: "13:30", name: "US CPI", risk: "HIGH" },
  ]);
  assert.equal(events.length, 2);
  assert.equal(events[0]?.name, "Fed Press Conference");
});

test("desk views partition widgets without inventing new data sources", () => {
  assert.deepEqual(DESK_VIEW_IDS, ["overview", "charts", "catalysts", "risk"]);
  assert.ok(DESK_VIEW_WIDGETS.charts.includes("primary-chart"));
  assert.ok(DESK_VIEW_WIDGETS.catalysts.includes("economic-calendar"));
  assert.ok(DESK_VIEW_WIDGETS.risk.includes("risk-toolkit"));
  assert.deepEqual(
    widgetsForView("charts", ["primary-chart", "edge-brief", "compare-rail"]),
    ["primary-chart", "compare-rail"],
  );
  assert.deepEqual(widgetsForView("overview", ["primary-chart", "edge-brief"]), []);
});

test("Trading Desk IA uses view tabs, decision summary, and softer coverage labels", async () => {
  const [desk, shell, catalog] = await Promise.all([
    read("../app/terminal/components/TradingDeskOS.tsx"),
    read("../app/components/MemberShell.tsx"),
    read("../app/lib/markets/market-catalog.ts"),
  ]);
  assert.match(shell, /Morning Brief/);
  assert.match(shell, /Trading Desk/);
  assert.match(desk, /DeskDecisionSummary/);
  assert.match(desk, /deskViewTabs/);
  assert.match(desk, /Overview/);
  assert.match(desk, /Risk & Journal|Risk &amp; Journal/);
  assert.match(desk, /marketsCollapsed/);
  assert.match(desk, /Bullish lean/);
  assert.match(desk, /Bearish lean/);
  assert.doesNotMatch(desk, />Buying</);
  assert.equal(coverageLabel("live"), "Connected");
  assert.match(catalog, /return "Connected"/);
});
