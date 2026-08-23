import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const source = (file: string) => readFileSync(path.join(root, file), "utf8");

test("annual Pro is explicitly outside the monthly Founding programme", () => {
  const pricing = source("app/pricing/PricingPlans.tsx");
  assert.match(pricing, /annual \? <div className="commercialFounding isFull">/);
  assert.match(pricing, /Annual Pro is not part of the monthly Founding 100 price-lock programme/);
  assert.match(pricing, /value=\{annual \? "pro_year" : "pro_month"\}/);
});

test("homepage and help centre preserve licensed-data boundaries and useful fallbacks", () => {
  const home = source("app/page.tsx");
  const help = source("app/help/page.tsx");
  assert.match(home, /Verified market status when licensed data is available/);
  assert.match(home, /Founding Pro reservations open/);
  assert.doesNotMatch(home, /Free, Pro and Elite access available/);
  assert.match(help, /official macro context, My Levels planner and preparation checklist/);
});
