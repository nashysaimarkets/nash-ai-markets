import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("authenticated terminal presents the focused Today decision brief", async () => {
  const [page, today, css, chart] = await Promise.all([
    read("app/terminal/page.tsx"),
    read("app/terminal/components/TodayDecisionBrief.tsx"),
    read("app/today-live.css"),
    read("app/dashboard/components/DashboardCandlestickChart.tsx"),
  ]);

  assert.match(page, /<TodayDecisionBrief payload=\{payload\}/);
  assert.doesNotMatch(page, /<TradingDeskOS/);
  assert.match(today, /Today · your/);
  assert.match(today, /Your market,/);
  assert.match(today, /Decision now/);
  assert.match(today, /Session clock/);
  assert.match(today, /Next verified catalyst/);
  assert.match(today, /Data trust/);
  assert.match(today, /Your focus/);
  assert.match(today, /workspaceLabel/);
  assert.match(today, /payload\.initialWorkspace/);
  assert.match(today, /payload\.edgeBriefByMarketId/);
  assert.match(today, /preferredPlatformId/);
  assert.match(today, /saved markets/);
  assert.match(today, /Bullseye decision delta/);
  assert.match(today, /Session fingerprint/);
  assert.match(today, /Five verified dimensions/);
  assert.match(today, /payload\.snapshot\.evidence/);
  assert.match(today, /Bullish confirmation/);
  assert.match(today, /Bearish confirmation/);
  assert.match(today, /Risk veto/);
  assert.match(today, /Prior brief delta/);
  assert.match(today, /NASH original instrument · BDI-01/);
  assert.match(today, /Bullseye Decision Instrument/);
  assert.match(today, /Five separate verified readings/);
  assert.match(today, /Decision posture/);
  assert.match(today, /Safety locked/);
  assert.match(today, /No directional permission/);
  assert.match(today, /ES range position unavailable/);
  assert.match(today, /The dial needle represents only ES position/);
  assert.match(today, /AI market broadcast/);
  assert.match(today, /BULLSEYE_PREMARKET_YOUTUBE_ID/);
  assert.match(today, /BULLSEYE_CLOSE_YOUTUBE_ID/);
  assert.match(today, /youtube-nocookie\.com\/embed/);
  assert.match(today, /No previous episode is presented as current/);
  assert.match(today, /ukDateKey\(published\) !== ukDateKey\(new Date\(\)\)/);
  assert.match(today, /Opening range, support and resistance/);
  assert.match(today, /<DashboardCandlestickChart/);
  assert.match(today, /structureLevels=/);
  assert.match(today, /Bullseye level matrix/);
  assert.match(today, /How far is the market from a decision/);
  assert.match(today, /Distance to support/);
  assert.match(today, /Distance to resistance/);
  assert.match(today, /Range position/);
  assert.match(today, /instrument\.references/);
  assert.match(today, /levelDistance/);
  assert.match(today, /proximityLabel/);
  assert.match(today, /<CrossAssetCandleGallery/);
  assert.match(today, /Compare the markets shaping today’s decision/);
  assert.match(today, /What the platform can verify right now/);
  assert.match(today, /No verified news provider is connected/);
  assert.match(today, /Session posture/);
  assert.match(today, /Conditional paths/);
  assert.match(today, /Confirmation/);
  assert.match(today, /Invalidation/);
  assert.match(today, /Evidence/);
  assert.match(today, /Review/);
  assert.match(css, /\.todayLiveCockpit/);
  assert.match(css, /\.todayPersonalFocus/);
  assert.match(css, /\.todayDecisionDelta/);
  assert.match(css, /\.todaySessionFingerprint/);
  assert.match(css, /\.todayFingerprintBars/);
  assert.match(css, /\.todayDecisionInstrument/);
  assert.match(css, /\.todayInstrumentDial/);
  assert.match(css, /\.todayInstrumentReadings/);
  assert.match(css, /\.todayInstrumentEvidence/);
  assert.match(css, /\.todayBroadcast/);
  assert.match(css, /\.todayBroadcastVideo iframe/);
  assert.match(css, /\.todayStructureChart/);
  assert.match(css, /\.todayLevelMatrix/);
  assert.match(css, /\.todayLevelRange/);
  assert.match(css, /\.todayLevelMatrixGrid/);
  assert.match(css, /\.todayCoverageMap/);
  assert.match(css, /\.todayVisualIntelligence/);
  assert.match(css, /\[data-level=support\] strong/);
  assert.match(css, /\[data-level=resistance\] strong/);
  assert.match(chart, /structureLevels\?\.support/);
  assert.match(chart, /color: "#55e69a"/);
  assert.match(chart, /structureLevels\?\.resistance/);
  assert.match(chart, /color: "#ec7474"/);
  assert.match(css, /\.todayMemberPage \.memberDashboardNav\{position:relative/);
});

test("Today earns its visual value from verified candle history only", async () => {
  const today = await read("app/terminal/components/TodayDecisionBrief.tsx");

  assert.match(today, /sparklineFromCandles/);
  assert.match(today, /rangeLaneFromCandles/);
  assert.match(today, /<Sparkline/);
  assert.match(today, /<RangePositionLane/);
  assert.match(today, /payload\.candleSeriesByInstrument/);
  assert.match(today, /quote\.symbol === "US2Y"/);
  assert.match(today, /quote\.symbol === "US10Y"/);
  assert.match(today, /10Y − 2Y curve/);
  assert.match(today, /Verified scalar · no candle history/);
  assert.match(today, /parsePriceLevel/);
  assert.doesNotMatch(today, /synthetic|Math\.random|sampleSeries|fake/i);
});

test("Today uses the existing protected server payload and fails closed", async () => {
  const [page, today] = await Promise.all([
    read("app/terminal/page.tsx"),
    read("app/terminal/components/TodayDecisionBrief.tsx"),
  ]);

  for (const contract of [
    "getTerminalMarketData",
    "resolveMembershipTier",
    "createTradingDecision",
    "createStructuredTradePlan",
    "persistAnalysisSnapshot",
  ]) {
    assert.match(page, new RegExp(contract));
  }

  assert.match(today, /payload\.snapshot\.status/);
  assert.match(today, /payload\.freshnessFeeds/);
  assert.match(today, /payload\.customerWarnings/);
  assert.match(today, /Stand aside/);
  assert.match(today, /Trading safety lock/i);
  assert.doesNotMatch(today, /Math\.random|mock|placeholder price/i);
});

test("legacy configurable workspace remains available for safe migration but is not mounted", async () => {
  const legacy = await read("app/terminal/components/TradingDeskOS.tsx");
  const page = await read("app/terminal/page.tsx");

  assert.match(legacy, /export function TradingDeskOS/);
  assert.doesNotMatch(page, /from "\.\/components\/TradingDeskOS"/);
});
