import assert from "node:assert/strict";
import test from "node:test";
import { evaluateTerminalMembership, membershipRedirect } from "../app/terminal/lib/membership-entitlement.ts";

const NOW = Date.parse("2026-07-17T12:00:00.000Z");

test("grants terminal access only inside an active membership period", () => {
  const result = evaluateTerminalMembership({ plan: "pro", status: "active", current_period_end: "2026-07-18T12:00:00.000Z" }, false, NOW);
  assert.equal(result.kind, "entitled");
});

test("accepts a current trialing Elite membership", () => {
  const result = evaluateTerminalMembership({ plan: "elite", status: "trialing", current_period_end: "2026-07-18T12:00:00.000Z" }, false, NOW);
  assert.equal(result.kind, "entitled");
});

test("fails closed when current_period_end has expired", () => {
  const result = evaluateTerminalMembership({ plan: "pro", status: "active", current_period_end: "2026-07-17T11:59:59.000Z" }, false, NOW);
  assert.equal(result.kind, "expired");
  assert.equal(membershipRedirect("expired"), "/membership-required?reason=expired");
});

test("fails closed when current_period_end is missing or malformed", () => {
  assert.equal(evaluateTerminalMembership({ plan: "pro", status: "active", current_period_end: null }, false, NOW).kind, "expired");
  assert.equal(evaluateTerminalMembership({ plan: "pro", status: "active", current_period_end: "not-a-date" }, false, NOW).kind, "expired");
});

test("distinguishes a missing membership from expiry", () => {
  assert.equal(evaluateTerminalMembership(null, false, NOW).kind, "missing");
  assert.equal(evaluateTerminalMembership({ plan: "basic", status: "active", current_period_end: "2026-07-18T12:00:00.000Z" }, false, NOW).kind, "missing");
});

test("distinguishes a temporary query failure without exposing database errors", () => {
  const result = evaluateTerminalMembership(null, true, NOW);
  assert.deepEqual(result, { kind: "temporarily_unavailable" });
  assert.equal(membershipRedirect("temporarily_unavailable"), "/membership-required?reason=temporary");
  assert.equal(JSON.stringify(result).includes("database"), false);
});
