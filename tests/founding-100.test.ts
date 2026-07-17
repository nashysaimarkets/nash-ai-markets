import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  FOUNDING_100_LIMIT,
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

test("Stripe lifecycle synchronizes awards from signed server events only", async () => {
  const webhook = await read("app/api/stripe/webhook/route.ts");
  assert.match(webhook, /stripe\.webhooks\.constructEvent/);
  assert.match(webhook, /\.rpc\("sync_founding_100"/);
  assert.match(webhook, /event\.created/);
  assert.match(webhook, /status === "active" \|\| status === "trialing"/);
  assert.match(webhook, /invoice\.payment_failed/);
  assert.doesNotMatch(webhook, /NEXT_PUBLIC_.*FOUNDING/);
});

test("Founding awards appear on member surfaces and reporting remains server restricted", async () => {
  const [dashboard, profile, badge, admin] = await Promise.all([
    read("app/dashboard/page.tsx"),
    read("app/profile/page.tsx"),
    read("app/components/Founding100Badge.tsx"),
    read("app/admin/founding-100/page.tsx"),
  ]);
  assert.match(dashboard, /loadFounding100ForEmail/);
  assert.match(profile, /loadFounding100ForEmail/);
  assert.match(badge, /price lock active while this subscription remains continuously active/i);
  assert.match(badge, /price lock forfeited/i);
  assert.match(admin, /isFounding100Admin/);
  assert.match(admin, /robots: \{ index: false/);
});

test("pricing states the factual continuous-subscription rule without artificial urgency", async () => {
  const page = await read("app/page.tsx");
  assert.match(page, /First 100 successful Pro subscribers only/);
  assert.match(page, /First 100 successful Elite subscribers only/);
  assert.match(page, /locked for life while that same membership remains continuously active/);
  assert.match(page, /cancelled or lapses, the price lock is permanently lost/);
  assert.doesNotMatch(page, /only \d+ (spots|places) left/i);
});
