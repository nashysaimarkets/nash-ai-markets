import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  chartDataForStatus,
  isValidOhlcv,
  terminalFallbackMessage,
  terminalMarketState,
} from "../app/terminal/lib/visual-terminal.ts";

test("terminal page is a brand canvas with auth gates intact", async () => {
  const page = await readFile(new URL("../app/terminal/page.tsx", import.meta.url), "utf8");
  assert.match(page, /MemberEmptyCanvas/);
  assert.match(page, /active="terminal"/);
  assert.match(page, /resolveMembershipTier/);
  assert.match(page, /createProgressiveAccess/);
  assert.doesNotMatch(page, /MarketsBrowser/);
  assert.doesNotMatch(page, /MarketDirectionalGaugesPanel|DashboardCandlestickChart|CrossAssetCandleGallery|LockedPremiumCard/);
  assert.doesNotMatch(page, /TodaysMarketPlan|CrossAssetBoard|KeyMarketInformation|Upcoming catalysts|EventWindowEmpty/);
  assert.doesNotMatch(page, /MarketDeskSignalsPanel|AskBullseye|MarketPressureMap|DecisionEnginePanel|DecisionIntelligencePanel|StructureLevelsPanel/);
});

test("decision and planner fields render in their respective panels", async () => {
  const source = await readFile(new URL("../app/terminal/components/EngineSummary.tsx", import.meta.url), "utf8");
  for (const field of ["marketBias", "riskRating", "volatilityRegime", "tradePermission", "topSupportingDrivers", "conflictingDrivers", "invalidationConditions", "noTradeReasons"]) assert.match(source, new RegExp(`decision\\.${field}`));
  for (const field of ["directionalPosture", "participationLevel", "preferredSetupType", "executionReadiness", "invalidationConditions", "reasonsToRemainSidelined"]) assert.match(source, new RegExp(`plan\\.${field}`));
});

test("live delayed cached and offline states remain truthful", () => {
  assert.equal(terminalMarketState("LIVE", "connected", false), "Live");
  assert.equal(terminalMarketState("DELAYED", "degraded", false), "Delayed");
  assert.equal(terminalMarketState("PREVIEW", "connected", false), "Offline");
  assert.equal(terminalMarketState("LIVE", "connected", true), "Offline");
  assert.match(terminalFallbackMessage("Delayed", "DELAYED"), /delayed data/i);
  assert.match(terminalFallbackMessage("Offline", "UNAVAILABLE"), /fail closed/i);
});

test("preview input never renders demonstration candles", async () => {
  const preview = chartDataForStatus("PREVIEW");
  const live = chartDataForStatus("LIVE");
  const chartSource = await readFile(new URL("../app/terminal/components/MarketChart.tsx", import.meta.url), "utf8");
  assert.equal(preview.mode, "verified");
  assert.deepEqual(preview.data, []);
  assert.equal(live.mode, "verified");
  assert.deepEqual(live.data, []);
  assert.doesNotMatch(chartSource, /PREVIEW FIXTURE|demonstration candles/);
});

test("OHLCV validation rejects malformed, unordered and impossible candles", () => {
  assert.equal(isValidOhlcv([]), true);
  assert.equal(isValidOhlcv([{ time: 1, open: 10, high: 8, low: 9, close: 10, volume: 1 }]), false);
  assert.equal(isValidOhlcv([{ time: 2, open: 10, high: 11, low: 9, close: 10, volume: 1 }, { time: 1, open: 10, high: 11, low: 9, close: 10, volume: 1 }]), false);
});

test("participation warning helpers remain available for rebuild", async () => {
  const warnings = await readFile(new URL("../app/terminal/lib/customer-warnings.ts", import.meta.url), "utf8");
  assert.match(warnings, /formatCustomerParticipationWarnings/);
});

test("responsive integration keeps chart primitives usable", async () => {
  const styles = await readFile(new URL("../app/mission-control.css", import.meta.url), "utf8");
  assert.match(styles, /ftEngineStrip\{grid-template-columns:1fr 1fr\}/);
  assert.match(styles, /ftPrimaryGrid\{display:flex;flex-direction:column\}/);
  assert.match(styles, /marketChartCanvas,.marketChartState\{height:300px\}/);
  assert.match(styles, /\.terminalMarketsCanvas|\.terminalEmptyCanvas/);
  assert.match(styles, /\.tmMarketsSidebar/);
});
