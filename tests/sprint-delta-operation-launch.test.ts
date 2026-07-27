import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  normalizeFoundingOnboarding,
  normalizeWaitlistSubmission,
} from "../app/lib/launch-onboarding.ts";

test("waiting-list input is normalized without accepting invalid or bot submissions", () => {
  assert.deepEqual(normalizeWaitlistSubmission({
    email: "  Member@Example.COM ",
    source: "launch-page",
    company: "",
  }), { email: "member@example.com", source: "launch-page" });
  assert.equal(normalizeWaitlistSubmission({ email: "invalid", source: "homepage" }), null);
  assert.equal(normalizeWaitlistSubmission({ email: "member@example.com", company: "bot value" }), null);
  assert.equal(normalizeWaitlistSubmission(null), null);
});

test("Founding Member onboarding accepts only complete enumerated preferences and risk acknowledgement", () => {
  const valid = {
    primaryGoal: "risk-discipline",
    experienceLevel: "experienced",
    preferredSession: "both",
    riskAcknowledged: true,
  };
  assert.deepEqual(normalizeFoundingOnboarding(valid), valid);
  assert.equal(normalizeFoundingOnboarding({ ...valid, primaryGoal: "guaranteed-returns" }), null);
  assert.equal(normalizeFoundingOnboarding({ ...valid, riskAcknowledged: false }), null);
  assert.equal(normalizeFoundingOnboarding({ ...valid, preferredSession: "always-open" }), null);
});

test("Operation Launch migration is server-only, idempotent, and cannot grant membership", async () => {
  const migration = await readFile(new URL("../supabase/migrations/202607170003_operation_launch.sql", import.meta.url), "utf8");
  assert.match(migration, /create table if not exists public\.launch_waitlist/);
  assert.match(migration, /create table if not exists public\.founding_member_onboarding/);
  assert.match(migration, /enable row level security/g);
  assert.match(migration, /No client policies/);
  assert.doesNotMatch(migration, /create policy/i);
  assert.doesNotMatch(migration, /insert into public\.memberships|update public\.memberships/i);
});

test("waiting-list endpoint is same-origin, duplicate-safe, and resists enumeration", async () => {
  const route = await readFile(new URL("../app/api/waitlist/route.ts", import.meta.url), "utf8");
  assert.match(route, /suppliedOrigin !== requestOrigin/);
  assert.match(route, /normalizeWaitlistSubmission/);
  assert.match(route, /error\.code !== "23505"/);
  assert.match(route, /NextResponse\.json\(\{ ok: true \}/);
  assert.doesNotMatch(route, /already exists|already joined|console\.|error\.message/i);
});

test("Founding Member endpoint requires current paid access and records pending review only", async () => {
  const route = await readFile(new URL("../app/api/founding-member/route.ts", import.meta.url), "utf8");
  assert.match(route, /auth\.getUser\(\)/);
  assert.match(route, /tier !== "pro" && tier !== "elite"/);
  assert.match(route, /PAID_MEMBERSHIP_REQUIRED/);
  assert.match(route, /status: "pending"/);
  assert.match(route, /founding_member_onboarding/);
  assert.doesNotMatch(route, /\.from\("memberships"\)\.upsert|stripe/i);
});

test("launch and onboarding pages avoid fake urgency and automatic-entitlement claims", async () => {
  const [waitlist, founding, dashboard] = await Promise.all([
    readFile(new URL("../app/waitlist/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/founding-member/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(waitlist, /without fake urgency, guaranteed places, or automatic billing/);
  assert.match(waitlist, /No guaranteed invitation/);
  assert.match(founding, /does not change billing, membership, or entitlement/);
  assert.match(founding, /does not guarantee Founding Member designation/);
  assert.match(dashboard, /redirect\("\/terminal"\)/);
  assert.match(dashboard, /resolveMembershipTier/);
  for (const source of [waitlist, founding]) {
    assert.doesNotMatch(source, /only \d+ (?:places|spots)|ends in|act now|hurry/i);
  }
});

test("launch privacy, loading, mobile and reduced-motion states are production-ready", async () => {
  const [privacy, waitlistLoading, foundingLoading, foundingError, css] = await Promise.all([
    readFile(new URL("../app/privacy/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/waitlist/loading.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/founding-member/loading.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/founding-member/error.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/mission-control.css", import.meta.url), "utf8"),
  ]);
  assert.match(privacy, /waiting-list requests, Founding Member onboarding preferences/);
  assert.match(waitlistLoading, /aria-busy="true"/);
  assert.match(foundingLoading, /aria-live="polite"/);
  assert.match(foundingError, /No application, membership, or database details/);
  assert.match(css, /@keyframes deltaReveal/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /\.waitlistForm>div\{grid-template-columns:1fr\}/);
  assert.match(css, /\.foundingForm fieldset\{grid-template-columns:1fr\}/);
});
