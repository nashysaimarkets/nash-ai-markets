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

test("dashboard includes the premium plan and customer trust labels", async () => {
  const dashboard = await readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/dashboard-elite.css", import.meta.url), "utf8");
  const plan = await readFile(new URL("../app/dashboard/components/DashboardMarketPlan.tsx", import.meta.url), "utf8");
  assert.match(dashboard, /title: "Dashboard \| NASH AI Markets"/);
  assert.match(dashboard, /DashboardMarketStatus/);
  assert.doesNotMatch(dashboard, /href="\/terminal\/diagnostics"/);
  assert.match(plan, /Verified rolling range and reference levels/);
  assert.match(plan, /Bullish confirmation/);
  assert.match(dashboard, /No verified timestamp/);
  assert.match(styles, /\.dashCompact\{/);
  assert.match(styles, /eliteHeaderMeta strong\{overflow:visible;text-overflow:clip;white-space:normal;overflow-wrap:anywhere\}/);
});

test("dashboard exposes verified catalysts and readable risk controls without additional requests", async () => {
  const [dashboard, review, styles] = await Promise.all([
    readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/components/DashboardReviewPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard-elite.css", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /DashboardReviewPanel/);
  assert.match(review, /Events, review conditions and checklist/);
  assert.match(review, /Next verified event/);
  assert.match(review, /TradePlanChecklist/);
  assert.doesNotMatch(review, /fetch\(|useEffect|setInterval/);
  assert.match(styles, /\.dashReviewGrid\{/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
});
