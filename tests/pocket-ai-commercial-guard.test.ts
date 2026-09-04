import assert from "node:assert/strict";
import test from "node:test";
import {
  pocketAIEnabled,
  pocketGlobalMonthlyLimit,
  pocketMonthlyLimit,
  pocketRequestIdentity,
  pocketResponseCacheKey,
} from "../app/lib/server/pocket-ai-commercial-guard.ts";

test("Pocket owner kill switch accepts explicit off values", () => {
  const before = process.env.POCKET_AI_ENABLED;
  try {
    for (const value of ["false", "OFF", "0", "disabled"]) {
      process.env.POCKET_AI_ENABLED = value;
      assert.equal(pocketAIEnabled(), false);
    }
    process.env.POCKET_AI_ENABLED = "true";
    assert.equal(pocketAIEnabled(), true);
  } finally {
    if (before === undefined) delete process.env.POCKET_AI_ENABLED;
    else process.env.POCKET_AI_ENABLED = before;
  }
});

test("Pocket uses conservative monthly defaults and validates overrides", () => {
  const customer = process.env.POCKET_AI_MONTHLY_LIMIT;
  const global = process.env.POCKET_AI_GLOBAL_MONTHLY_LIMIT;
  try {
    delete process.env.POCKET_AI_MONTHLY_LIMIT;
    delete process.env.POCKET_AI_GLOBAL_MONTHLY_LIMIT;
    assert.equal(pocketMonthlyLimit(), 30);
    assert.equal(pocketGlobalMonthlyLimit(), 0);
    process.env.POCKET_AI_MONTHLY_LIMIT = "12";
    process.env.POCKET_AI_GLOBAL_MONTHLY_LIMIT = "500";
    assert.equal(pocketMonthlyLimit(), 12);
    assert.equal(pocketGlobalMonthlyLimit(), 500);
    process.env.POCKET_AI_MONTHLY_LIMIT = "-1";
    assert.equal(pocketMonthlyLimit(), 30);
  } finally {
    if (customer === undefined) delete process.env.POCKET_AI_MONTHLY_LIMIT;
    else process.env.POCKET_AI_MONTHLY_LIMIT = customer;
    if (global === undefined) delete process.env.POCKET_AI_GLOBAL_MONTHLY_LIMIT;
    else process.env.POCKET_AI_GLOBAL_MONTHLY_LIMIT = global;
  }
});

test("Pocket stores only stable salted hashes for anonymous devices", () => {
  const request = new Request("https://example.test/api/pocket/analyse", {
    headers: { "x-pocket-client-id": "12345678-1234-1234-1234-123456789abc", "x-forwarded-for": "203.0.113.5" },
  });
  const identity = pocketRequestIdentity(request);
  assert.match(identity, /^[a-f0-9]{64}$/);
  assert.equal(identity, pocketRequestIdentity(request));
  assert.ok(!identity.includes("203.0.113.5"));
});

test("Pocket response keys change with any chart or model input", () => {
  const first = pocketResponseCacheKey("analysis", ["sol", "chart-a", "context-a"]);
  const same = pocketResponseCacheKey("analysis", ["sol", "chart-a", "context-a"]);
  const changed = pocketResponseCacheKey("analysis", ["sol", "chart-b", "context-a"]);
  assert.equal(first, same);
  assert.notEqual(first, changed);
  assert.match(first, /^[a-f0-9]{64}$/);
});
