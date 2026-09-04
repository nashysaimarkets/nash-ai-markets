import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Pocket reserves the premium model for the customer report", async () => {
  const [analysis, preflight] = await Promise.all([
    readFile(new URL("../app/api/pocket/analyse/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pocket/preflight/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(analysis, /const POCKET_REPORT_MODEL = "gpt-6-astra"/);
  assert.match(analysis, /const POCKET_REPORT_FALLBACK_MODEL = "gpt-5\.6-sol"/);
  assert.match(analysis, /const POCKET_SUPPORT_MODEL = "gpt-5\.6-luna"/);
  assert.match(analysis, /const POCKET_SUPPORT_RESCUE_MODEL = "gpt-5\.6-terra"/);
  assert.match(preflight, /const POCKET_PREFLIGHT_MODEL = "gpt-5\.6-luna"/);
  assert.match(analysis, /OPENAI_POCKET_SUPPORT_MODEL/);
  assert.match(preflight, /OPENAI_POCKET_SUPPORT_MODEL/);
  assert.doesNotMatch(preflight, /OPENAI_POCKET_MODEL/);
});

test("Pocket records token totals for every paid AI stage", async () => {
  const [analysis, preflight] = await Promise.all([
    readFile(new URL("../app/api/pocket/analyse/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pocket/preflight/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(analysis, /\[pocket-ai-usage\]/);
  assert.match(analysis, /logPocketAIUsage\("report"/);
  assert.match(analysis, /rescue \? "precision_rescue" : "precision"/);
  assert.match(preflight, /pocketAIUsageRecord\("preflight"/);
});

test("Pocket blocks provider calls behind owner, allowance and cache guards", async () => {
  const [analysis, preflight, client] = await Promise.all([
    readFile(new URL("../app/api/pocket/analyse/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pocket/preflight/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/pocket/ChartPreflightPanel.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(analysis, /pocketAIEnabled\(\)/);
  assert.match(analysis, /reservePocketMonthlyAnalysis/);
  assert.match(analysis, /getPocketCachedResponse/);
  assert.match(analysis, /savePocketCachedResponse/);
  assert.match(analysis, /x-pocket-ai-cache/);
  assert.match(preflight, /pocketAIEnabled\(\)/);
  assert.match(preflight, /getPocketCachedResponse/);
  assert.match(client, /preflightRequests/);
  assert.match(client, /sessionStorage/);
});
