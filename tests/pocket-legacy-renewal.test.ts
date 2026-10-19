import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

async function fixture(dbError: unknown = null) {
  const source = await readFile(new URL("../app/api/stripe/webhook/route.ts", import.meta.url), "utf8");
  const start = source.indexOf("async function saveSubscription(");
  const body = source.slice(start, source.indexOf("async function sendPocketWelcome", start));
  const idStart = source.indexOf("function applicationUserId(");
  const idBody = source.slice(idStart, source.indexOf("function logSupabaseFailure", idStart));
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const bindings = {
    singleConfiguredSubscriptionItem: (items: unknown[]) => ({ item: items[0], offering: { plan: "pocket", billingInterval: "month" } }),
    foundingSubscriptionActive: (status: string) => status === "active" || status === "trialing",
    customerEmail: async () => "owner@example.invalid",
    validPocketFoundingPrice: () => true,
    subscriptionEnd: () => "2026-11-22T19:37:40.000Z",
    logSupabaseFailure: () => {},
    createAdminClient: () => ({ rpc: async (name: string, args: Record<string, unknown>) => { calls.push({ name, args }); return { error: dbError }; } }),
  };
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const save = await new AsyncFunction(...Object.keys(bindings), stripTypeScriptTypes(idBody + body) + ";return saveSubscription;")(...Object.values(bindings));
  const subscription = { id: "sub_legacy", customer: "cus_audited", status: "active", metadata: {} as Record<string, unknown>, items: { data: [{ price: { unit_amount: 499 } }] } };
  return { save, calls, subscription };
}

test("signed legacy renewal uses exact subscription/customer compatibility RPC without inventing a UUID", async () => {
  const f = await fixture(); assert.equal(await f.save({}, f.subscription, 500), "pocket");
  assert.deepEqual(f.calls, [{ name: "sync_pocket_web_subscription", args: {
    p_email: "owner@example.invalid", p_stripe_customer_id: "cus_audited", p_stripe_subscription_id: "sub_legacy",
    p_subscription_active: true, p_current_period_end: "2026-11-22T19:37:40.000Z", p_event_created_at: 500,
  } }]);
});

test("new UUID producer retains its stricter named-argument RPC contract", async () => {
  const f = await fixture(); f.subscription.metadata.supabase_user_id = "11111111-1111-4111-8111-111111111111";
  await f.save({}, f.subscription, 501);
  assert.equal(f.calls[0]?.args.p_app_user_id, f.subscription.metadata.supabase_user_id);
});

test("malformed or conflicting asserted identity is rejected rather than falling back to legacy", async () => {
  for (const metadata of ["attacker", "", 123, "22222222-2222-4222-8222-222222222222"]) {
    const f = await fixture(); f.subscription.metadata.supabase_user_id = metadata;
    await assert.rejects(f.save({}, f.subscription, 502, null, "11111111-1111-4111-8111-111111111111"));
    assert.equal(f.calls.length, 0);
  }
});

test("compatibility DB identity conflict is not swallowed or retried with email-based access", async () => {
  const f = await fixture({ code: "identity_conflict" });
  await assert.rejects(f.save({}, f.subscription, 503), /synchronization failed/); assert.equal(f.calls.length, 1);
});

test("legacy SQL reuses only an existing exact pair and unbound records cannot confer UUID access", async () => {
  const source = await readFile(new URL("../supabase/migrations/20261014143000_bind_pocket_web_subscription_identity.sql", import.meta.url), "utf8");
  const compatibility = source.slice(source.indexOf("-- Old deployed Stripe producers"));
  assert.match(compatibility, /where stripe_subscription_id=p_stripe_subscription_id for update/);
  assert.match(compatibility, /existing\.stripe_customer_id<>p_stripe_customer_id/);
  assert.match(compatibility, /sync_pocket_web_subscription\(existing\.app_user_id/);
  assert.match(source, /s\.app_user_id=p_user_id and s\.stripe_customer_id is not null/);
});
