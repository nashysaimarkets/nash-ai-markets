import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("all billed Pocket endpoints reject unauthorized access before reading uploads or constructing a provider", async () => {
  for (const route of ["analyse", "preflight", "levels", "follow-up", "review", "options-wall", "crypto-derivatives"]) {
    const source = await readFile(new URL(`../app/api/pocket/${route}/route.ts`, import.meta.url), "utf8");
    const post = source.slice(source.indexOf("export async function POST"));
    const guard = post.indexOf("await requirePocketScanAccess(request)");
    assert.ok(guard >= 0, `${route}: missing server entitlement guard`);
    assert.ok(guard < post.indexOf("request.json()"), `${route}: authenticate before processing uploads`);
    assert.ok(guard < post.indexOf("createOpenAIClient("), `${route}: authenticate before provider creation`);
    assert.match(post.slice(guard, post.indexOf("request.json()")), /if \(accessError\) return accessError/);
  }
});

import { checkPocketScanAccess } from "../app/lib/server/pocket-scan-access.ts";

test("Apple entitlement permits only a verified identity, leaves Stripe unchanged and fails closed on verification errors", async () => {
  const member = { id: "7a9d6268-93d5-43ec-bd05-15f074e35bcc", email: "m@example.invalid", email_confirmed_at: "2026-01-01" };
  let calls = 0;
  assert.equal(await checkPocketScanAccess({ authenticate: async () => member, hasSubscription: async () => false, hasAppleSubscription: async id => { calls++; assert.equal(id, member.id); return true; } }), null);
  assert.equal(calls, 1);
  for (const identity of [null, { ...member, email_confirmed_at: undefined }]) assert.equal((await checkPocketScanAccess({ authenticate: async () => identity, hasSubscription: async () => false, hasAppleSubscription: async () => { throw new Error("anonymous must not reach Apple"); } }))?.status, 401);
  assert.equal(await checkPocketScanAccess({ authenticate: async () => member, hasSubscription: async () => true, hasAppleSubscription: async () => { throw new Error("web subscribers do not need Apple"); } }), null);
  assert.equal((await checkPocketScanAccess({ authenticate: async () => member, hasSubscription: async () => false, hasAppleSubscription: async () => false }))?.status, 403);
  assert.equal((await checkPocketScanAccess({ authenticate: async () => member, hasSubscription: async () => false, hasAppleSubscription: async () => { throw new Error("offline"); } }))?.status, 503);
});

test("anonymous and unverified users never query subscriptions or dispatch", async () => {
  for (const user of [null, {}, { email: "test@example.invalid" }, { email: "test@example.invalid", email_confirmed_at: "2026-01-01" }]) {
    let lookups = 0;
    const denial = await checkPocketScanAccess({ authenticate: async () => user, hasSubscription: async () => { lookups++; return true; } });
    assert.equal(denial?.status, 401);
    assert.equal(lookups, 0);
  }
});
test("expired, inactive or absent subscriptions deny; verified current Pocket subscription permits", async () => {
  for (const entitled of [false, true]) {
    let key = "";
    const result = await checkPocketScanAccess({ authenticate: async () => ({ id: "11111111-1111-4111-8111-111111111111", email: " Member@Example.invalid ", email_confirmed_at: "2026-01-01" }), hasSubscription: async (userId) => { key = userId; return entitled; } });
    assert.equal(key, "11111111-1111-4111-8111-111111111111");
    assert.equal(result?.status ?? null, entitled ? null : 403);
  }
});
test("identity or subscription service errors fail closed before provider access", async () => {
  for (const authFailure of [true, false]) {
    const denial = await checkPocketScanAccess({ authenticate: async () => { if (authFailure) throw new Error("auth unavailable"); return { id: "11111111-1111-4111-8111-111111111111", email: "m@example.invalid", email_confirmed_at: "2026-01-01" }; }, hasSubscription: async () => { throw new Error("database unavailable"); } });
    assert.equal(denial?.status, 503);
  }
});

test("a recreated account sharing a verified email cannot inherit another UUID's web subscription", async () => {
  const linkedUserId = "11111111-1111-4111-8111-111111111111";
  const replacementUserId = "22222222-2222-4222-8222-222222222222";
  const hasSubscription = async (userId: string) => userId === linkedUserId;
  const identity = (id: string) => ({ id, email: "same@example.invalid", email_confirmed_at: "2026-01-01" });
  assert.equal(await checkPocketScanAccess({ authenticate: async () => identity(linkedUserId), hasSubscription }), null);
  assert.equal((await checkPocketScanAccess({ authenticate: async () => identity(replacementUserId), hasSubscription }))?.status, 403);
});
test("Stripe Pocket status updates use independent entitlements and revoke failed payments", async () => {
  const source = await readFile(new URL("../app/api/stripe/webhook/route.ts", import.meta.url), "utf8");
  assert.match(source, /rpc\("sync_pocket_web_subscription"/);
  assert.match(source, /p_app_user_id: appUserId/);
  assert.match(source, /subscription\.metadata\?\.supabase_user_id/);
  assert.match(source.slice(source.indexOf('event.type === "invoice.payment_failed"')), /rpc\("revoke_pocket_web_subscription"/);
  assert.match(source.slice(source.indexOf("async function saveSubscription"), source.indexOf("const email = fallbackEmail")), /rpc\("revoke_pocket_web_subscription"/);
});

test("Pocket checkout requires a verified application account and copies its UUID to the subscription", async () => {
  const source = await readFile(new URL("../app/api/stripe/checkout/route.ts", import.meta.url), "utf8");
  assert.match(source, /selected\.offering\.plan === "pocket"[\s\S]*!user\?\.id[\s\S]*!user\.email_confirmed_at/);
  assert.match(source, /subscription_data:[\s\S]*supabase_user_id: user!\.id/);
});

test("identity-binding migration removes email lookup and requires UUID, customer and exact subscription", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20261014143000_bind_pocket_web_subscription_identity.sql", import.meta.url), "utf8");
  assert.match(sql, /add column app_user_id uuid/);
  assert.match(sql, /add column stripe_customer_id text/);
  assert.match(sql, /drop function public\.has_pocket_web_subscription\(text\)/);
  assert.match(sql, /has_pocket_web_subscription\(p_user_id uuid\)/);
  assert.match(sql, /s\.app_user_id=p_user_id/);
  assert.match(sql, /s\.stripe_customer_id is not null/);
  assert.match(sql, /pocket_subscription_identity_conflict/);
  assert.match(sql, /link_pocket_web_subscription_identity/);
  assert.match(sql, /identity_evidence_ref/);
});

test("actual route handlers return denial before parsing payloads, consuming budgets or constructing providers", async () => {
  const { stripTypeScriptTypes } = await import("node:module");
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  for (const route of ["analyse", "preflight", "levels", "follow-up", "review", "options-wall", "crypto-derivatives"]) {
    const source = await readFile(new URL(`../app/api/pocket/${route}/route.ts`, import.meta.url), "utf8");
    const post = source.slice(source.indexOf("export async function POST(")).replace("export async function", "async function");
    for (const status of [401, 403, 503]) {
      let touches = 0;
      const denial = Response.json({ error: "denied" }, { status });
      const bindings = { requirePocketScanAccess: async () => denial, createOpenAIClient: () => { touches++; throw new Error("provider reached"); }, takePocketBudget: () => { touches++; throw new Error("budget reached"); } };
      const handler = await new AsyncFunction(...Object.keys(bindings), stripTypeScriptTypes(post) + "\nreturn POST;")(...Object.values(bindings));
      const response = await handler({ json: async () => { touches++; throw new Error("upload read"); } });
      assert.equal(response, denial, `${route} must return access denial`);
      assert.equal(touches, 0);
    }
  }
});

test("cancelled Pocket subscriptions revoke before a missing/deleted customer can prevent synchronization", async () => {
  const { stripTypeScriptTypes } = await import("node:module");
  const source = await readFile(new URL("../app/api/stripe/webhook/route.ts", import.meta.url), "utf8");
  const start = source.indexOf("async function saveSubscription(");
  const body = source.slice(start, source.indexOf("async function sendPocketWelcome", start));
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const calls: unknown[] = [];
  const bindings = {
    configuredOffering: () => ({ plan: "pocket", billingInterval: "month" }),
    foundingSubscriptionActive: (status: string) => status === "active" || status === "trialing",
    customerEmail: async () => { throw new Error("deleted customer cannot supply email"); },
    createAdminClient: () => ({ rpc: async (name: string, args: unknown) => { calls.push([name, args]); return { error: null }; } }),
  };
  const save = await new AsyncFunction(...Object.keys(bindings), stripTypeScriptTypes(body) + "\nreturn saveSubscription;")(...Object.values(bindings));
  assert.equal(await save({}, { id: "sub-test", status: "canceled", customer: { id: "cus-test", deleted: true }, items: { data: [{ price: { id: "price-test" } }] } }, 200), "pocket");
  assert.deepEqual(calls, [["revoke_pocket_web_subscription", { p_stripe_subscription_id: "sub-test", p_event_created_at: 200 }]]);
});
