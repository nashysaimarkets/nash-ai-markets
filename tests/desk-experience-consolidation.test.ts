import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildDeskDecisionPresentation, buildTodaysPosture } from "../app/terminal/lib/desk-decision-presentation.ts";
import {
  dedupeVerifiedEvents,
  normalizeEventTitle,
  upcomingVerifiedEvents,
} from "../app/terminal/lib/event-display.ts";
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
  assert.equal(presentation.permissionLabel, "WAIT FOR CONFIRMATION");
  assert.equal(presentation.permissionTone, "blocked");
  assert.equal(presentation.confidenceLabel, "NOT ESTABLISHED");
  assert.match(presentation.confidenceDetail ?? "", /incomplete|not shown as a measured|Awaiting evidence/i);
  assert.doesNotMatch(presentation.confidenceDetail ?? "", /Engine confidence score: 0 \/ 100/);
  assert.match(presentation.why, /observed lean|wait for confirmation|incomplete/i);
  assert.doesNotMatch(presentation.why, /Restricted|instruction to buy|enter long/i);

  const posture = buildTodaysPosture(presentation);
  assert.equal(posture.eyebrow, "TODAY'S POSTURE");
  assert.equal(posture.headline, "Stay patient");
  assert.match(posture.summary, /mildly bullish|wait for confirmation|confirmation/i);
  assert.doesNotMatch(posture.summary, /\bbuy\b|\bsell\b|enter |Restricted/i);
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

test("upcomingVerifiedEvents keeps Brief and Desk on the same future filter", () => {
  const now = Date.parse("2026-07-28T12:00:00.000Z");
  const upcoming = upcomingVerifiedEvents([
    { time: "Wed 10:00", name: "Past CPI", risk: "HIGH", at: "2026-07-28T10:00:00.000Z" },
    { time: "Wed 14:00", name: "Future CPI", risk: "HIGH", at: "2026-07-28T14:00:00.000Z" },
    { time: "opaque", name: "Unparseable", risk: "MED" },
  ], now, 5);
  assert.equal(upcoming.length, 1);
  assert.equal(upcoming[0]?.name, "Future CPI");
});

test("desk views partition widgets without inventing new data sources", () => {
  assert.deepEqual(DESK_VIEW_IDS, ["overview", "charts", "catalysts", "risk"]);
  assert.ok(DESK_VIEW_WIDGETS.charts.includes("primary-chart"));
  assert.ok(DESK_VIEW_WIDGETS.catalysts.includes("catalyst-radar"));
  assert.equal(DESK_VIEW_WIDGETS.catalysts.includes("economic-calendar"), false);
  assert.ok(DESK_VIEW_WIDGETS.risk.includes("risk-toolkit"));
  assert.deepEqual(
    widgetsForView("charts", ["primary-chart", "edge-brief", "compare-rail"]),
    ["primary-chart", "compare-rail"],
  );
  assert.deepEqual(widgetsForView("overview", ["primary-chart", "edge-brief"]), []);
});

test("Trading Desk IA uses view tabs, decision summary, and softer coverage labels", async () => {
  const [desk, shell, catalog, decisionSummary] = await Promise.all([
    read("../app/terminal/components/TradingDeskOS.tsx"),
    read("../app/components/MemberShell.tsx"),
    read("../app/lib/markets/market-catalog.ts"),
    read("../app/terminal/components/DeskDecisionSummary.tsx"),
  ]);
  assert.match(shell, /Morning Brief/);
  assert.match(shell, /Trading Desk/);
  assert.match(desk, /DeskDecisionSummary/);
  assert.match(desk, /deskViewTabs/);
  assert.match(desk, /Workspace preset/);
  assert.match(desk, /Overview/);
  assert.match(desk, /Risk & Journal|Risk &amp; Journal/);
  assert.match(desk, /marketsCollapsed/);
  assert.match(desk, /verified delayed chart/);
  assert.match(desk, /Bullish lean/);
  assert.match(desk, /Bearish lean/);
  assert.doesNotMatch(desk, />Buying</);
  assert.match(desk, /sortInstrumentsForSidebar|Additional markets — planned|groupAvailabilityLabel/);
  assert.match(desk, /isFavouriteMarketId|resolveStoredMarketId/);
  assert.match(desk, /VerifiedCatalystIncludes|groupVerifiedEvents/);
  assert.match(desk, /formatDelayedVerifiedCandleAgeDisplay|Delayed market data/);
  assert.match(desk, /latestVerifiedCandleAgeMs|24-hour low \/ downside reference|24-hour high \/ upside reference/);
  assert.match(desk, /selectDeskView/);
  assert.match(desk, /document\.scrollingElement/);
  assert.match(desk, /measureStickyHeader\(\) \+ SECTION_SCROLL_GAP_PX/);
  assert.match(desk, /scrollTargetBelowStickyHeader/);
  assert.match(desk, /ResizeObserver/);
  assert.doesNotMatch(desk, /scrollIntoView/);
  assert.match(desk, /id=\{`desk-view-\$\{deskView\}`\}/);
  assert.match(desk, /id="primary-chart"|id="verified-levels"|id="next-catalyst"|id="risk-journal"/);
  assert.match(decisionSummary, /TODAY.?S POSTURE|buildTodaysPosture|posture\.headline/);
  assert.match(decisionSummary, /Participation/);
  assert.match(decisionSummary, /id="decision-summary"/);
  assert.match(decisionSummary, /is-blocked-priority|permissionTone === "blocked"/);
  assert.match(decisionSummary, /Technical confirmation details|Wait for confirmation|Not established|confidenceDetail/);
  assert.equal(coverageLabel("live"), "Connected");
  assert.match(catalog, /return "Connected"/);
});
