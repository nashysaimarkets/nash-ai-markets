import assert from "node:assert/strict";
import test from "node:test";
import {
  canClaimPreview,
  createProgressiveAccess,
  evaluateTerminalMembership,
  membershipRedirect,
  resolveMembershipTier,
  type PreviewClaim,
} from "../app/terminal/lib/membership-entitlement.ts";

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

test("resolves missing and expired memberships to the Free tier", () => {
  assert.equal(resolveMembershipTier(null, false, NOW), "free");
  assert.equal(resolveMembershipTier({ plan: "pro", status: "active", current_period_end: "2026-07-17T11:00:00.000Z" }, false, NOW), "free");
});

test("Free includes market overview but locks Pro and Elite features", () => {
  const access = createProgressiveAccess("free", [], NOW);
  assert.equal(access.features["market-overview"], true);
  assert.equal(access.features.intelligence, false);
  assert.equal(access.features["decision-engine"], false);
  assert.equal(access.features["trade-planner"], false);
  assert.equal(access.features["launch-diagnostics"], false);
});

test("Pro includes intelligence and decisions while keeping Elite planning locked", () => {
  const access = createProgressiveAccess("pro", [], NOW);
  assert.equal(access.features.intelligence, true);
  assert.equal(access.features["decision-engine"], true);
  assert.equal(access.features["trade-planner"], false);
  assert.equal(access.features["launch-diagnostics"], false);
});

test("Elite includes every terminal feature", () => {
  const access = createProgressiveAccess("elite", [], NOW);
  assert.equal(Object.values(access.features).every(Boolean), true);
});

test("Free receives one eligible weekly Pro preview", () => {
  const offer = createProgressiveAccess("free", [], NOW).previewOffer;
  assert.deepEqual(offer, {
    targetTier: "pro",
    cadence: "weekly",
    periodStart: "2026-07-13T00:00:00.000Z",
    nextReset: "2026-07-20T00:00:00.000Z",
    eligible: true,
    active: false,
  });
});

test("an active weekly Pro preview grants only Pro features", () => {
  const claims: PreviewClaim[] = [{ target_tier: "pro", period_start: "2026-07-13T00:00:00.000Z", claimed_at: "2026-07-15T09:00:00.000Z" }];
  const access = createProgressiveAccess("free", claims, NOW);
  assert.equal(access.effectiveTier, "pro");
  assert.equal(access.previewOffer?.active, true);
  assert.equal(access.previewOffer?.eligible, false);
  assert.equal(access.features["decision-engine"], true);
  assert.equal(access.features["trade-planner"], false);
});

test("Free cannot claim a second Pro preview in the same week", () => {
  const claims: PreviewClaim[] = [{ target_tier: "pro", period_start: "2026-07-13T00:00:00.000Z", claimed_at: "2026-07-15T09:00:00.000Z" }];
  assert.equal(canClaimPreview("free", "pro", claims, NOW), false);
});

test("the weekly Pro preview resets on the next UTC Monday", () => {
  const oldClaims: PreviewClaim[] = [{ target_tier: "pro", period_start: "2026-07-13T00:00:00.000Z", claimed_at: "2026-07-15T09:00:00.000Z" }];
  assert.equal(canClaimPreview("free", "pro", oldClaims, Date.parse("2026-07-20T00:00:01.000Z")), true);
});

test("Pro receives one eligible daily Elite preview", () => {
  const offer = createProgressiveAccess("pro", [], NOW).previewOffer;
  assert.equal(offer?.targetTier, "elite");
  assert.equal(offer?.cadence, "daily");
  assert.equal(offer?.periodStart, "2026-07-17T00:00:00.000Z");
  assert.equal(offer?.nextReset, "2026-07-18T00:00:00.000Z");
});

test("an active daily Elite preview grants planner and diagnostics", () => {
  const claims: PreviewClaim[] = [{ target_tier: "elite", period_start: "2026-07-17T00:00:00.000Z", claimed_at: "2026-07-17T08:00:00.000Z" }];
  const access = createProgressiveAccess("pro", claims, NOW);
  assert.equal(access.effectiveTier, "elite");
  assert.equal(access.features["trade-planner"], true);
  assert.equal(access.features["launch-diagnostics"], true);
});

test("the daily Elite preview resets at the next UTC midnight", () => {
  const oldClaims: PreviewClaim[] = [{ target_tier: "elite", period_start: "2026-07-17T00:00:00.000Z", claimed_at: "2026-07-17T08:00:00.000Z" }];
  assert.equal(canClaimPreview("pro", "elite", oldClaims, Date.parse("2026-07-18T00:00:01.000Z")), true);
});

test("Elite has no preview offer because all features are included", () => {
  assert.equal(createProgressiveAccess("elite", [], NOW).previewOffer, null);
});

test("preview claims cannot skip tiers or target the wrong plan", () => {
  assert.equal(canClaimPreview("free", "elite", [], NOW), false);
  assert.equal(canClaimPreview("pro", "pro", [], NOW), false);
  assert.equal(canClaimPreview("elite", "elite", [], NOW), false);
});
