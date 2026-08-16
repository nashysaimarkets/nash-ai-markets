import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("personal level planner is device-only and isolated from verified engine inputs", () => {
  const component = readFileSync(path.join(root, "app/dashboard/components/PersonalLevelPlanner.tsx"), "utf8");
  const dashboard = readFileSync(path.join(root, "app/dashboard/components/MarketCommandCentre.tsx"), "utf8");
  assert.match(component, /R3[\s\S]*R2[\s\S]*R1[\s\S]*PIVOT[\s\S]*S1[\s\S]*S2[\s\S]*S3/);
  assert.match(component, /localStorage/);
  assert.match(component, /not verified NASH data and never enter the decision engine/i);
  assert.doesNotMatch(component, /fetch\(|\/api\//);
  assert.match(component, /positive numbers only/i);
  assert.match(component, /aria-live="polite"/);
  assert.match(component, /aria-invalid=\{invalidLevels\.includes\(level\)/);
  assert.match(component, /Confirm clear/);
  assert.match(component, /Keep levels/);
  assert.match(component, /role=\{messageTone === "error" \? "alert" : "status"\}/);
  assert.match(dashboard, /<PersonalLevelPlanner \/>/);
});
