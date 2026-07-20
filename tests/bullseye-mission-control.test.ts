import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source() {
  return readFile(new URL("../app/dashboard/components/BullseyeMissionControl.tsx", import.meta.url), "utf8");
}

test("Mission Control renders verified derived engine analytics without provider-native claims", async () => {
  const component = await source();
  assert.match(component, /scores\.trend/);
  assert.match(component, /scores\.marketSentiment/);
  assert.match(component, /scores\.volatility/);
  assert.match(component, /scores\.riskOnRiskOff/);
  assert.match(component, /BULLSEYE RADAR™ · DERIVED/);
  assert.match(component, /Summary uses current deterministic engine outputs only/);
  assert.doesNotMatch(component, /Suggested Copilot prompts/);
});

test("Mission Control renders an intentional fail-closed unavailable state", async () => {
  const component = await source();
  assert.match(component, /VERIFICATION IN PROGRESS/);
  assert.match(component, /Stand by for verified inputs/);
  assert.match(component, /NO-TRADE/);
  assert.match(component, /Do not infer direction from incomplete data/);
  assert.match(component, /verified \? item\.score : "—"/);
});

test("dashboard includes the premium plan, trust labels and protected diagnostics entry", async () => {
  const dashboard = await readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/dashboard-elite.css", import.meta.url), "utf8");
  const plan = await readFile(new URL("../app/dashboard/components/TodaysBullseyePlan.tsx", import.meta.url), "utf8");
  assert.match(dashboard, /BULLSEYE Command Centre/);
  assert.match(dashboard, /Market intelligence, not financial advice/);
  assert.match(dashboard, /access\.features\["launch-diagnostics"\]/);
  assert.match(plan, /OBSERVED LEVELS/);
  assert.match(plan, /DERIVED SCENARIOS/);
  assert.match(plan, /Awaiting verified input/);
  assert.match(dashboard, /No verified timestamp/);
  assert.match(styles, /subscriptionStatusCompact dl div:last-child\{grid-column:1\/-1\}/);
  assert.match(styles, /eliteHeaderMeta strong\{overflow:visible;text-overflow:clip;white-space:normal;overflow-wrap:anywhere\}/);
});
