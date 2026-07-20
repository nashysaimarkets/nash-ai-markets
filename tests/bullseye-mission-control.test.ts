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
