import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("personal level planner is device-only and isolated from verified engine inputs", () => {
  const component = readFileSync(path.join(root, "app/dashboard/components/PersonalLevelPlanner.tsx"), "utf8");
  const dashboard = readFileSync(path.join(root, "app/dashboard/components/MarketCommandCentre.tsx"), "utf8");
  assert.match(component, /R3.*R2.*R1.*PIVOT.*S1.*S2.*S3/s);
  assert.match(component, /localStorage/);
  assert.match(component, /not verified NASH data and never enter the decision engine/i);
  assert.doesNotMatch(component, /fetch\(|\/api\//);
  assert.match(dashboard, /<PersonalLevelPlanner \/>/);
});
