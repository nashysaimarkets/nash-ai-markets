import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("authenticated terminal presents the focused Today decision brief", async () => {
  const [page, today, css] = await Promise.all([
    read("app/terminal/page.tsx"),
    read("app/terminal/components/TodayDecisionBrief.tsx"),
    read("app/today-live.css"),
  ]);

  assert.match(page, /<TodayDecisionBrief payload=\{payload\}/);
  assert.doesNotMatch(page, /<TradingDeskOS/);
  assert.match(today, /Today · verified decision cockpit/);
  assert.match(today, /Your market,/);
  assert.match(today, /Decision now/);
  assert.match(today, /Session clock/);
  assert.match(today, /Next verified catalyst/);
  assert.match(today, /Data trust/);
  assert.match(today, /Session posture/);
  assert.match(today, /Conditional paths/);
  assert.match(today, /Confirmation/);
  assert.match(today, /Invalidation/);
  assert.match(today, /Evidence/);
  assert.match(today, /Review/);
  assert.match(css, /\.todayLiveCockpit/);
  assert.match(css, /\.todayMemberPage \.memberDashboardNav\{position:relative/);
});

test("Today earns its visual value from verified candle history only", async () => {
  const today = await read("app/terminal/components/TodayDecisionBrief.tsx");

  assert.match(today, /sparklineFromCandles/);
  assert.match(today, /rangeLaneFromCandles/);
  assert.match(today, /<Sparkline/);
  assert.match(today, /<RangePositionLane/);
  assert.match(today, /payload\.candleSeriesByInstrument/);
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
