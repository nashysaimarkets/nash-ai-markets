import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("all billed Pocket endpoints reject unauthorized access before reading uploads or constructing a provider", async () => {
  for (const route of ["analyse", "preflight", "levels", "follow-up", "review", "options-wall", "crypto-derivatives"]) {
    const source = await readFile(new URL(`../app/api/pocket/${route}/route.ts`, import.meta.url), "utf8");
    const post = source.slice(source.indexOf("export async function POST"));
    const guard = post.indexOf("await requirePocketScanAccess()");
    assert.ok(guard >= 0, `${route}: missing server entitlement guard`);
    assert.ok(guard < post.indexOf("request.json()"), `${route}: authenticate before processing uploads`);
    assert.ok(guard < post.indexOf("createOpenAIClient("), `${route}: authenticate before provider creation`);
    assert.match(post.slice(guard, post.indexOf("request.json()")), /if \(accessError\) return accessError/);
  }
});

import { checkPocketScanAccess } from "../app/lib/server/pocket-scan-access.ts";

test("anonymous and unverified users never query subscriptions or dispatch", async () => {
  for (const user of [null, {}, { email: "test@example.invalid" }]) {
    let lookups = 0;
    const denial = await checkPocketScanAccess({ authenticate: async () => user, hasSubscription: async () => { lookups++; return true; } });
    assert.equal(denial?.status, 401);
    assert.equal(lookups, 0);
  }
});
test("expired, inactive or absent subscriptions deny; verified current Pocket subscription permits", async () => {
  for (const entitled of [false, true]) {
    let key = "";
    const result = await checkPocketScanAccess({ authenticate: async () => ({ email: " Member@Example.invalid ", email_confirmed_at: "2026-01-01" }), hasSubscription: async (email) => { key = email; return entitled; } });
    assert.equal(key, "member@example.invalid");
    assert.equal(result?.status ?? null, entitled ? null : 403);
  }
});
test("identity or subscription service errors fail closed before provider access", async () => {
  for (const authFailure of [true, false]) {
    const denial = await checkPocketScanAccess({ authenticate: async () => { if (authFailure) throw new Error("auth unavailable"); return { email: "m@example.invalid", email_confirmed_at: "2026-01-01" }; }, hasSubscription: async () => { throw new Error("database unavailable"); } });
    assert.equal(denial?.status, 503);
  }
});
test("Stripe Pocket status updates use independent entitlements and revoke failed payments", async () => {
  const source = await readFile(new URL("../app/api/stripe/webhook/route.ts", import.meta.url), "utf8");
  assert.match(source, /rpc\("sync_pocket_web_subscription"/);
  assert.match(source.slice(source.indexOf('event.type === "invoice.payment_failed"')), /rpc\("revoke_pocket_web_subscription"/);
  assert.match(source.slice(source.indexOf("async function saveSubscription"), source.indexOf("const email = fallbackEmail")), /rpc\("revoke_pocket_web_subscription"/);
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
