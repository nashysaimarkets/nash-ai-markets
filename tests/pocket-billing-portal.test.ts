import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { openPocketBillingPortal, type PocketBillingDependencies } from "../app/lib/server/pocket-billing-portal.ts";

const member = { id: "11111111-1111-4111-8111-111111111111", email: " Member@Example.invalid ", email_confirmed_at: "2026-10-19", is_anonymous: false };
function request(headers: Record<string, string> = { origin: "https://pocket.nashaimarkets.com" }, url = "https://pocket.nashaimarkets.com/api/pocket/billing-portal", signal?: AbortSignal) {
  return new Request(url, { method: "POST", headers, body: "customer=cus_attacker&app_user_id=attacker", signal });
}
function fixture(overrides: Partial<PocketBillingDependencies> = {}) {
  const lookups: unknown[] = [], sessions: unknown[] = [];
  return { lookups, sessions, deps: {
    authenticate: async () => member,
    customerForIdentity: async (id: string, email: string) => { lookups.push({ id, email }); return "cus_bound"; },
    createPortal: async (customer: string, returnUrl: string) => { sessions.push({ customer, returnUrl }); return "https://billing.stripe.com/p/session/unit-test"; },
    ...overrides,
  } };
}

test("Pocket-only and expired members can open only their UUID-bound billing account", async () => {
  const f = fixture(); const r = await openPocketBillingPortal(request(), f.deps);
  assert.equal(r.status, 303);
  assert.equal(r.headers.get("location"), "https://billing.stripe.com/p/session/unit-test");
  assert.deepEqual(f.lookups, [{ id: member.id, email: "member@example.invalid" }]);
  assert.deepEqual(f.sessions, [{ customer: "cus_bound", returnUrl: "https://pocket.nashaimarkets.com/pocket" }]);
  assert.equal(r.headers.get("cache-control"), "private, no-store");
});

test("anonymous, malformed, unverified and provider-rejected identities never create a portal", async () => {
  for (const user of [null, { ...member, id: "attacker" }, { ...member, email_confirmed_at: undefined }, { ...member, is_anonymous: true }]) {
    const f = fixture({ authenticate: async () => user }); const r = await openPocketBillingPortal(request(), f.deps);
    assert.equal(r.status, 401); assert.equal(f.lookups.length, 0); assert.equal(f.sessions.length, 0);
  }
  const f = fixture({ customerForIdentity: async () => { throw Error("foreign, banned or recreated identity"); } });
  assert.equal((await openPocketBillingPortal(request(), f.deps)).status, 503); assert.equal(f.sessions.length, 0);
});

test("missing or malformed bindings and lookup outages cannot use a submitted customer or email fallback", async () => {
  for (const value of [null, undefined, {}, "cus other", "", 123]) {
    const f = fixture({ customerForIdentity: async () => value });
    const r = await openPocketBillingPortal(request(), f.deps); assert.equal(r.status, 503); assert.equal(f.sessions.length, 0);
    assert.doesNotMatch(await r.text(), /attacker|member@|cus_/);
  }
});

test("cross-site, missing-origin, HTTP and lookalike-localhost requests fail before authentication", async () => {
  for (const req of [request({}), request({ origin: "https://attacker.invalid" }), request({ origin: "http://pocket.nashaimarkets.com" }, "http://pocket.nashaimarkets.com/api/pocket/billing-portal"), request({ origin: "http://localhost.evil.invalid" }, "http://localhost.evil.invalid/api/pocket/billing-portal")]) {
    let auth = 0; const f = fixture({ authenticate: async () => { auth++; return member; } });
    assert.equal((await openPocketBillingPortal(req, f.deps)).status, 403); assert.equal(auth, 0);
  }
});

test("portal provider errors and non-Stripe redirects are opaque and never grant access", async () => {
  for (const url of [null, "https://billing.stripe.com.evil.invalid/p", "http://billing.stripe.com/p", "https://billing.stripe.com:444/p", "https://name:secret@billing.stripe.com/p"]) {
    const f = fixture({ createPortal: async () => url }); const r = await openPocketBillingPortal(request(), f.deps);
    assert.equal(r.status, 503); assert.equal(r.headers.get("location"), null);
  }
  const f = fixture({ createPortal: async () => { throw Error("secret provider detail"); } });
  const r = await openPocketBillingPortal(request(), f.deps); assert.equal(r.status, 503); assert.doesNotMatch(await r.text(), /secret/);
});

test("GET and a cancelled request cannot create a billing session", async () => {
  const f = fixture(); const get = await openPocketBillingPortal(new Request("https://pocket.nashaimarkets.com/api/pocket/billing-portal"), f.deps);
  assert.equal(get.status, 405); assert.equal(get.headers.get("allow"), "POST");
  const controller = new AbortController(); controller.abort();
  assert.equal((await openPocketBillingPortal(request(undefined, undefined, controller.signal), f.deps)).status, 409);
  assert.equal(f.sessions.length, 0);
});

test("deployed handler uses verified auth and UUID RPC only; web control submits POST", async () => {
  const source = await readFile(new URL("../app/api/pocket/billing-portal/route.ts", import.meta.url), "utf8");
  assert.match(source, /auth\.getUser\(\)/); assert.match(source, /rpc\("get_pocket_web_customer", \{ p_user_id: userId, p_email: email \}\)/);
  assert.doesNotMatch(source, /\.from\(|customer_email|request\.json|request\.formData/);
  const control = await readFile(new URL("../app/pocket/WebSubscriptionControls.tsx", import.meta.url), "utf8");
  assert.match(control, /method="post" action="\/api\/pocket\/billing-portal"/);
});
