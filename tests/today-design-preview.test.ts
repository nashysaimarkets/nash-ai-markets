import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Today design preview is public, illustrative and fail-closed", async () => {
  const page = await readFile(new URL("../app/preview/today/page.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(page, /createClient|getTerminalMarketData|resolveMembershipTier/);
  assert.match(page, /DESIGN PREVIEW/);
  assert.match(page, /No live market values/);
  assert.match(page, /FAIL-CLOSED/);
  assert.match(page, /Stand aside/);
  assert.match(page, /Bullish path/);
  assert.match(page, /Bearish path/);
  assert.match(page, /No synthetic candles or market levels/);
  assert.match(page, /robots: \{ index: false, follow: false \}/);
});

test("Today preview includes the focused member hierarchy", async () => {
  const page = await readFile(new URL("../app/preview/today/page.tsx", import.meta.url), "utf8");

  for (const label of [
    "Data trust",
    "Session posture",
    "Conditional paths",
    "Evidence",
    "Review",
    "Confirmation",
    "Invalidation",
  ]) {
    assert.match(page, new RegExp(label));
  }
});
