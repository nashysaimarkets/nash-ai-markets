import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  FOUNDING_100_LIMIT,
  founding100AvailabilityLabel,
  founding100Remaining,
  isFounding100Admin,
} from "../app/lib/server/founding-100.ts";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("Founding availability counts permanent positions, including forfeited awards", () => {
  const records = [
    { programme: "pro" as const, position: 1 },
    { programme: "pro" as const, position: 2 },
    { programme: "pro" as const, position: 2 },
    { programme: "elite" as const, position: 1 },
  ];
  assert.equal(FOUNDING_100_LIMIT, 100);
  assert.equal(founding100Remaining(records, "pro"), 98);
  assert.equal(founding100Remaining(records, "elite"), 99);
});

test("tier exhaustion reaches zero and never becomes negative", () => {
  const records = Array.from({ length: 100 }, (_, index) => ({
    programme: "pro" as const,
    position: index + 1,
  }));
  assert.equal(founding100Remaining(records, "pro"), 0);
  assert.equal(founding100Remaining([...records, { programme: "pro", position: 100 }], "pro"), 0);
});

test("availability labels show verified counts, full allocation, or a neutral fallback", () => {
  assert.deepEqual(founding100AvailabilityLabel(12), {
    label: "12 of 100 founding places remaining",
    detail: "Availability is database-backed and confirmed only after successful subscription.",
    full: false,
  });
  assert.equal(founding100AvailabilityLabel(0).label, "Founding allocation full");
  assert.match(founding100AvailabilityLabel(0).detail, /standard subscription remains available/i);
  assert.deepEqual(founding100AvailabilityLabel(null), {
    label: "Founding places available",
    detail: "Live availability is temporarily unavailable. Eligibility is confirmed only after successful subscription.",
    full: false,
  });
  assert.equal(founding100AvailabilityLabel(101).label, "Founding places available");
});

test("Founding administrator allowlist is exact, normalized, and fails closed", () => {
  const configured = "owner@example.com, OPS@example.com ";
  assert.equal(isFounding100Admin("ops@example.com", configured), true);
  assert.equal(isFounding100Admin(" owner@example.com ", configured), true);
  assert.equal(isFounding100Admin("notowner@example.com", configured), false);
  assert.equal(isFounding100Admin("owner@example.com", ""), false);
});

test("database migration atomically limits each programme to 100 server-only awards", async () => {
  const sql = await read("supabase/migrations/202607170004_founding_100.sql");
  assert.match(sql, /position between 1 and 100/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /founding_100:' \|\| coalesce\(p_programme/);
  assert.match(sql, /coalesce\(max\(position\), 0\) \+ 1/);
  assert.match(sql, /if next_position > 100/);
  assert.match(sql, /security definer/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on function[\s\S]*from public/);
  assert.match(sql, /grant execute on function[\s\S]*to service_role/);
  assert.doesNotMatch(sql, /create policy/i);
});

test("database rules retain earned positions and permanently forfeit a lapsed price lock", async () => {
  const sql = await read("supabase/migrations/202607170004_founding_100.sql");
  assert.match(sql, /status = 'forfeited'/);
  assert.match(sql, /price_lock_active = false/);
  assert.match(sql, /ineligible_lapsed/);
  assert.match(sql, /last_event_created_at <= p_event_created_at/);
  assert.doesNotMatch(sql, /delete from public\.founding_100_members/i);
});

test("webhook retries cannot allocate a second position for the same member or subscription", async () => {
  const sql = await read("supabase/migrations/202607170004_founding_100.sql");
  assert.match(sql, /unique \(programme, email\)/);
  assert.match(sql, /unique \(programme, stripe_subscription_id\)/);
  assert.match(sql, /already_awarded/);
  assert.match(sql, /stale_ignored/);
});

test("Stripe lifecycle synchronizes awards from signed server events only", async () => {
  const webhook = await read("app/api/stripe/webhook/route.ts");
  assert.match(webhook, /stripe\.webhooks\.constructEvent/);
  assert.match(webhook, /\.rpc\("sync_founding_100"/);
  assert.match(webhook, /event\.created/);
  assert.match(webhook, /status === "active" \|\| status === "trialing"/);
  assert.match(webhook, /const active = subscriptionActive && foundingEligible/);
  assert.match(webhook, /validPocketFoundingPrice\(offerings\[0\]\.item\.price\)/);
  assert.match(webhook, /from\("founding_100_members"\)/);
  assert.match(webhook, /existing\.programme === plan/);
  assert.match(webhook, /invoice\.payment_failed/);
  assert.doesNotMatch(webhook, /NEXT_PUBLIC_.*FOUNDING/);
});

test("Founding awards appear on member surfaces and reporting remains server restricted", async () => {
  const [profile, badge, admin] = await Promise.all([
    read("app/profile/page.tsx"),
    read("app/components/Founding100Badge.tsx"),
    read("app/admin/founding-100/page.tsx"),
  ]);
  assert.match(profile, /loadFounding100ForEmail/);
  assert.match(badge, /price lock active while this subscription remains continuously active/i);
  assert.match(badge, /price lock forfeited/i);
  assert.match(admin, /isFounding100Admin/);
  assert.match(admin, /robots: \{ index: false/);
});

test("pricing states the factual continuous-subscription rule without artificial urgency", async () => {
  const page = await read("app/page.tsx");
  assert.match(page, /loadFounding100Availability/);
  assert.match(page, /proFounding\.label/);
  assert.doesNotMatch(page, /eliteFounding|FOUNDING 100 ELITE/);
  assert.match(page, /price remains locked while that same membership stays continuously active/);
  assert.match(page, /cancelled or lapses, the price lock is permanently lost/);
  assert.doesNotMatch(page, /only \d+ (spots|places) left/i);
});

test("public launch pricing promotes Founding Pro only while preserving Elite checkout", async () => {
  const pricing = await read("app/pricing/PricingPlans.tsx");
  assert.match(pricing, /FOUNDING 100 PRO/);
  assert.doesNotMatch(pricing, /FOUNDING 100 ELITE|badge-founding-100/);
  assert.match(pricing, /value=\{annual \? "elite_year" : "elite_month"\}/);
  assert.match(pricing, /£29\.99\/month/);
});

test("public availability reads only programme positions and fails neutral", async () => {
  const server = await read("app/lib/server/founding-100.ts");
  assert.match(server, /\.select\("programme, position"\)/);
  assert.match(server, /status: "unavailable", proRemaining: null, eliteRemaining: null/);
  assert.doesNotMatch(server, /NEXT_PUBLIC_.*FOUNDING/);
});
