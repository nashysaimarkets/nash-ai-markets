import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Mission Control command centre uses verified live inputs without inventing history", async () => {
  const component = await readFile(new URL("../app/components/mission-control/MissionControl.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(component, /KeyMarketInformation/);
  assert.doesNotMatch(component, /BullseyeGauge|AskBullseye|Stand aside if/);
  assert.match(component, /What changed/);
  assert.match(component, /never reconstructed history/);
  assert.doesNotMatch(component, /Suggested Copilot prompts|fake strike|guaranteed/);
});

test("Mission Control includes workflow actions and path cards", async () => {
  const component = await readFile(new URL("../app/components/mission-control/MissionControl.tsx", import.meta.url), "utf8");
  assert.match(component, /Open Terminal/);
  assert.match(component, /Read Market Brief/);
  assert.doesNotMatch(component, /Open Options Corner|href="\/options"/);
  assert.match(component, /Review Previous Session/);
  assert.match(component, /mcPaths/);
  assert.match(component, /No-trade/);
});

test("dashboard includes the premium plan and customer trust labels", async () => {
  const dashboard = await readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");
  const mission = await readFile(new URL("../app/components/mission-control/MissionControl.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/mission-control.css", import.meta.url), "utf8");
  assert.match(dashboard, /title: "Mission Control \| NASH AI Markets"/);
  assert.match(dashboard, /MemberEmptyCanvas/);
  assert.match(dashboard, /resolveMembershipTier/);
  assert.doesNotMatch(dashboard, /MissionControl|href="\/terminal\/diagnostics"/);
  assert.match(mission, /Open Terminal/);
  assert.match(mission, /Review Previous Session/);
  assert.match(styles, /\.mcHero\{/);
});

test("dashboard exposes verified catalysts and readable risk controls without additional requests", async () => {
  const [dashboard, mission, styles] = await Promise.all([
    readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/mission-control/MissionControl.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/mission-control.css", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /MemberEmptyCanvas/);
  assert.doesNotMatch(dashboard, /MissionControl/);
  assert.match(mission, /mcPaths/);
  assert.match(mission, /No-trade/);
  assert.doesNotMatch(mission, /fetch\(|useEffect|setInterval/);
  assert.match(styles, /\.mcPaths/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
});
