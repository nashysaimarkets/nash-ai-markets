import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("customer terminal routes render Bullseye gauge and instrument modules", async () => {
  const [customer, terminal, brief, plan, styles] = await Promise.all([
    read("../app/terminal/components/CustomerTerminal.tsx"),
    read("../app/terminal/page.tsx"),
    read("../app/brief/page.tsx"),
    read("../app/dashboard/components/DashboardMarketPlan.tsx"),
    read("../app/mission-control.css"),
  ]);
  assert.match(customer, /BullseyeGauge/);
  assert.match(customer, /UnavailableHistory/);
  assert.match(customer, /VolatilityGauge/);
  assert.match(customer, /YieldSpreadVisual/);
  assert.match(customer, /DxyPressureVisual/);
  assert.match(customer, /ctIntelStripAuto/);
  assert.match(customer, /ctShield/);
  assert.match(terminal, /EventWindowEmpty/);
  assert.match(terminal, /volatilityRegime=\{decisionReady \? decision\.volatilityRegime : null\}/);
  assert.match(brief, /BullseyeGauge/);
  assert.match(brief, /CrossAssetBoard/);
  assert.match(plan, /BullseyeGauge/);
  assert.match(styles, /\.bullseyeGauge\{/);
  assert.match(styles, /\.ctEventEmptyBody\{/);
  assert.match(styles, /\.volGauge,/);
  assert.match(styles, /\.briefCommand\{/);
  assert.match(styles, /\.profileMembershipBadge\{/);
});

test("truthful history empty states exist as real components", async () => {
  const [unavailable, eventEmpty, gauge] = await Promise.all([
    read("../app/components/mini-visuals/UnavailableHistory.tsx"),
    read("../app/components/mini-visuals/EventWindowEmpty.tsx"),
    read("../app/components/mini-visuals/BullseyeGauge.tsx"),
  ]);
  assert.match(unavailable, /History waiting/);
  assert.match(eventEmpty, /Awaiting verified schedule/);
  assert.match(eventEmpty, /Unverified or invented catalysts are excluded/);
  assert.match(gauge, /not calculated/);
  assert.match(gauge, /Not calculated/);
});

test("terminal wires key market information and safe hero classes", async () => {
  const [terminal, customer, styles] = await Promise.all([
    read("../app/terminal/page.tsx"),
    read("../app/terminal/components/CustomerTerminal.tsx"),
    read("../app/mission-control.css"),
  ]);
  assert.match(terminal, /KeyMarketInformation/);
  assert.match(customer, /ctHeroSummary/);
  assert.match(customer, /ctHeroWatermark/);
  assert.match(customer, /ctInstrumentMeta/);
  assert.match(styles, /\.ctHeroMeta>div\{/);
  assert.doesNotMatch(styles, /\.ctHeroMeta div\{/);
  assert.match(styles, /overflow-wrap:normal/);
  assert.match(styles, /\.ctKeyMarket\{/);
});
