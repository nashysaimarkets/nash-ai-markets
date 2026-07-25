import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("customer terminal routes render instrument modules without confidence gauge chrome", async () => {
  const [customer, terminal, brief, styles, volGauge, yieldVisual, dxyVisual] = await Promise.all([
    read("../app/terminal/components/CustomerTerminal.tsx"),
    read("../app/terminal/page.tsx"),
    read("../app/brief/page.tsx"),
    read("../app/mission-control.css"),
    read("../app/components/mini-visuals/VolatilityGauge.tsx"),
    read("../app/components/mini-visuals/YieldSpreadVisual.tsx"),
    read("../app/components/mini-visuals/DxyPressureVisual.tsx"),
  ]);
  assert.doesNotMatch(customer, /BullseyeGauge|ctShield/);
  assert.doesNotMatch(customer, /CrossAssetBoard|TodaysMarketPlan|KeyMarketInformation/);
  assert.doesNotMatch(customer, /ctIntelStripAuto/);
  assert.doesNotMatch(terminal, /EventWindowEmpty|Upcoming catalysts|CrossAssetBoard|TodaysMarketPlan|KeyMarketInformation|MarketsBrowser/);
  assert.match(terminal, /TradingDeskOS/);
  assert.doesNotMatch(brief, /BullseyeGauge|CrossAssetBoard/);
  assert.match(brief, /redirect\("\/terminal"\)/);
  assert.match(volGauge, /export function VolatilityGauge/);
  assert.match(yieldVisual, /export function YieldSpreadVisual/);
  assert.match(dxyVisual, /export function DxyPressureVisual/);
  assert.match(styles, /\.bullseyeGauge\{/);
  assert.match(styles, /\.volGauge,/);
  assert.match(styles, /\.briefCommand\{/);
  assert.match(styles, /\.profileMembershipBadge\{/);
});

test("truthful history empty states exist as real components", async () => {
  const [unavailable, gauge] = await Promise.all([
    read("../app/components/mini-visuals/UnavailableHistory.tsx"),
    read("../app/components/mini-visuals/BullseyeGauge.tsx"),
  ]);
  assert.match(unavailable, /History waiting/);
  assert.match(gauge, /not calculated/);
  assert.match(gauge, /Not calculated/);
});

test("terminal keeps safe hero classes without removed panels", async () => {
  const [terminal, canvas, customer, styles] = await Promise.all([
    read("../app/terminal/page.tsx"),
    read("../app/components/MemberEmptyCanvas.tsx"),
    read("../app/terminal/components/CustomerTerminal.tsx"),
    read("../app/mission-control.css"),
  ]);
  assert.doesNotMatch(terminal, /KeyMarketInformation|TodaysMarketPlan|CrossAssetBoard|Upcoming catalysts|EventWindowEmpty/);
  assert.match(terminal, /TradingDeskOS/);
  assert.match(canvas, /BrandLogo/);
  assert.match(canvas, /terminalEmptyCanvas/);
  assert.match(customer, /ctHeroSummary/);
  assert.match(customer, /ctHeroWatermark/);
  assert.match(styles, /\.ctHeroMeta>div\{/);
  assert.doesNotMatch(styles, /\.ctHeroMeta div\{/);
  assert.match(styles, /overflow-wrap:normal/);
  assert.doesNotMatch(styles, /\.ctKeyMarket\{/);
  assert.match(styles, /\.tradingDeskOS|\.terminalEmptyCanvas/);
});
