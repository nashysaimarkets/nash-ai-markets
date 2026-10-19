import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { createPocketCheckoutStripeDriver, ensurePocketCheckoutIntent } from "../app/lib/server/pocket-checkout-intent.ts";
import type { PocketCheckoutAuthority, PocketCheckoutIntentDependencies, PocketCheckoutScope } from "../app/lib/server/pocket-checkout-intent.ts";

const user = "11111111-1111-4111-8111-111111111111";
const intent = "22222222-2222-4222-8222-222222222222";
const token = "33333333-3333-4333-8333-333333333333";
const scope: PocketCheckoutScope = { userId: user, email: "one@example.test", customerId: "cus_QA", priceId: "price_QA", candidateSha: "a".repeat(40), stripeAccountId: "acct_QA", livemode: false, offer: "pocket_founding_650" };
function seed() {
  const metadata = { supabase_user_id: user, offering: "pocket_founding_650", acquisition_source: "test" };
  return { mode: "subscription", customer: "cus_QA", client_reference_id: user, line_items: [{ price: "price_QA", quantity: 1 }],
    success_url: "https://example.test/pocket/founding/welcome", cancel_url: "https://example.test/pocket/founding?checkout=cancelled",
    allow_promotion_codes: true, metadata, subscription_data: { metadata: { ...metadata } } };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }
function harness() {
  let tick = Date.now();
  let state = "PREPARED";
  let baseline = true;
  let parameters: ReturnType<typeof seed> & { expires_at: number };
  let text = "";
  let hash = "";
  let storedSession: unknown;
  let frozenSeed = "";
  let authoriseOverride: (() => Promise<PocketCheckoutAuthority | null>) | undefined;
  let rpcOverride: ((name: string, args: Record<string, unknown>) => { data: unknown; error: unknown } | Promise<{ data: unknown; error: unknown }> | null) | undefined;
  let sdkOverride: ((p: Record<string, unknown>) => unknown | Promise<unknown>) | undefined;
  let providerAccount = "acct_QA";
  let providerMode = false;
  let pricePatch: Record<string, unknown> = {};
  const sdkCalls: { parameters: Record<string, unknown>; options: unknown }[] = [];
  const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];
  const authority: PocketCheckoutAuthority = { userId: user, email: scope.email, emailConfirmedAt: new Date().toISOString(), isAnonymous: false, stripeAccountId: "acct_QA", livemode: false };
  const driver = createPocketCheckoutStripeDriver({
    accounts: { async retrieve() { return { id: providerAccount }; } },
    prices: { async retrieve(id: string) { return { id, active: true, currency: "gbp", type: "recurring", unit_amount: 499, recurring: { interval: "month", interval_count: 1 }, livemode: providerMode, ...pricePatch }; } },
    checkout: { sessions: { async create(p: Record<string, unknown>, options: unknown) {
      assert.equal(Object.isFrozen(p), true); assert.equal(Object.isFrozen(p.metadata), true); assert.equal(Object.isFrozen(p.line_items), true);
      sdkCalls.push({ parameters: structuredClone(p), options });
      if (sdkOverride) return sdkOverride(p);
      return { id: "cs_test_QA", mode: "subscription", status: "open", customer: p.customer, client_reference_id: p.client_reference_id,
        metadata: p.metadata, expires_at: p.expires_at, livemode: false, url: "https://checkout.stripe.com/c/pay/cs_test_QA" };
    } } },
  } as never);
  function packet(kind: string) {
    return { kind, intent_id: intent, user_id: user, customer_id: "cus_QA", price_id: "price_QA", candidate_sha: scope.candidateSha,
      stripe_account_id: "acct_QA", livemode: false, offer: scope.offer, idempotency_key: `pocket-checkout:${intent}`,
      parameters_text: text, parameters_sha256: hash, session: storedSession };
  }
  const dependencies: PocketCheckoutIntentDependencies = {
    authorise: async () => authoriseOverride ? authoriseOverride() : authority,
    stripeDriver: driver, now: () => tick,
    rpc: async (name, args) => {
      rpcCalls.push({ name, args });
      if (rpcOverride) { const overridden = await rpcOverride(name, args); if (overridden) return overridden; }
      if (name === "prepare_pocket_checkout_intent") {
        const incoming = JSON.stringify(args.p_seed);
        if (frozenSeed && incoming !== frozenSeed) return { data: { kind: "HOLD", reason: "IMMUTABLE_SCOPE_CONFLICT" }, error: null };
        if (!baseline) return { data: { kind: "HOLD", reason: "BASELINE_REQUIRED", intent_id: intent }, error: null };
        if (!text) {
          frozenSeed = incoming;
          parameters = structuredClone(args.p_seed) as typeof parameters;
          parameters.expires_at = Math.floor(tick / 1000) + 2700;
          parameters.metadata = { ...parameters.metadata, pocket_checkout_intent_id: intent, pocket_candidate_sha: scope.candidateSha } as typeof parameters.metadata;
          parameters.subscription_data.metadata = { ...parameters.subscription_data.metadata, pocket_checkout_intent_id: intent, pocket_candidate_sha: scope.candidateSha } as typeof parameters.metadata;
          // Deliberately different from JSON.stringify: hash this exact stored text.
          text = JSON.stringify(parameters, null, 1);
          hash = createHash("sha256").update(text).digest("hex");
        }
        return { data: state === "DISPATCHED" ? { kind: "HOLD", reason: "DISPATCH_UNRESOLVED" } : packet(state), error: null };
      }
      if (name === "claim_pocket_checkout_intent") {
        if (state !== "PREPARED") return { data: { kind: "HOLD", reason: "DISPATCH_UNRESOLVED" }, error: null };
        state = "DISPATCHED";
        return { data: { ...packet("DISPATCH"), dispatch_token: token, dispatch_count: 1 }, error: null };
      }
      if (name === "record_pocket_checkout_session") {
        assert.equal(args.p_dispatch_token, token); assert.equal(args.p_parameters_sha256, hash);
        storedSession = args.p_session; state = "READY";
        return { data: packet("READY"), error: null };
      }
      throw Error("unexpected mock RPC");
    },
  };
  return { dependencies, sdkCalls, rpcCalls, packet,
    run: (parameters: unknown = seed(), signal?: AbortSignal) => ensurePocketCheckoutIntent({ scope, parameters }, dependencies, signal),
    baseline: (value: boolean) => { baseline = value; },
    auth: (fn: typeof authoriseOverride) => { authoriseOverride = fn; },
    rpc: (fn: typeof rpcOverride) => { rpcOverride = fn; },
    sdk: (fn: typeof sdkOverride) => { sdkOverride = fn; },
    provider: (account: string, mode: boolean) => { providerAccount = account; providerMode = mode; },
    price: (value: typeof pricePatch) => { pricePatch = value; },
    advance: (ms: number) => { tick += ms; },
    markDispatched: () => { state = "DISPATCHED"; },
  };
}

test("missing independently verified baseline produces HOLD and no Stripe create", async () => {
  const h = harness(); h.baseline(false);
  assert.equal((await h.run()).kind, "HOLD"); assert.equal(h.sdkCalls.length, 0);
});
test("single claimed intent dispatches exact frozen stored params and persist-before-redirect", async () => {
  const h = harness(); const result = await h.run();
  assert.equal(result.kind, "READY"); assert.equal(h.sdkCalls.length, 1);
  assert.deepEqual(h.sdkCalls[0].options, { idempotencyKey: `pocket-checkout:${intent}`, timeout: 10000, maxNetworkRetries: 0 });
  assert.deepEqual(h.rpcCalls.map((r) => r.name), ["prepare_pocket_checkout_intent", "claim_pocket_checkout_intent", "record_pocket_checkout_session"]);
  assert.equal(h.sdkCalls[0].parameters.metadata && (h.sdkCalls[0].parameters.metadata as Record<string, unknown>).pocket_checkout_intent_id, intent);
});
test("two concurrent application callers share one atomic claim and at most one mock create", async () => {
  const h = harness(); const results = await Promise.all([h.run(), h.run()]);
  assert.equal(h.sdkCalls.length, 1); assert.equal(results.filter((r) => r.kind === "READY").length, 1);
});
test("a persisted READY session is reused without creating or returning a claim token", async () => {
  const h = harness(); const first = await h.run(); const second = await h.run();
  assert.deepEqual(second, first); assert.equal(h.sdkCalls.length, 1);
  assert.equal(h.rpcCalls.filter((r) => r.name === "claim_pocket_checkout_intent").length, 1);
});
test("caller mutation while authorisation waits cannot alter the frozen offer or parameters", async () => {
  const h = harness(); const pending = deferred<PocketCheckoutAuthority>(); const started = deferred<void>(); let first = true;
  h.auth(async () => { if (first) { first = false; started.resolve(); return pending.promise; } return { userId: user, email: scope.email, emailConfirmedAt: new Date().toISOString(), isAnonymous: false, stripeAccountId: "acct_QA", livemode: false }; });
  const parameters = seed(); const running = h.run(parameters); await started.promise;
  parameters.line_items[0].price = "price_ATTACK"; parameters.metadata.acquisition_source = "mutated";
  pending.resolve({ userId: user, email: scope.email, emailConfirmedAt: new Date().toISOString(), isAnonymous: false, stripeAccountId: "acct_QA", livemode: false });
  assert.equal((await running).kind, "READY");
  assert.equal((h.sdkCalls[0].parameters.line_items as { price: string }[])[0].price, "price_QA");
  assert.equal((h.sdkCalls[0].parameters.metadata as Record<string, unknown>).acquisition_source, "test");
});
test("actual SDK account/Price mode and monthly price properties must match before DB claim", async () => {
  for (const mismatch of ["account", "mode", "amount", "count"]) {
    const h = harness();
    if (mismatch === "account") h.provider("acct_OTHER", false);
    if (mismatch === "mode") h.provider("acct_QA", true);
    if (mismatch === "amount") h.price({ unit_amount: 999 });
    if (mismatch === "count") h.price({ recurring: { interval: "month", interval_count: 3 } });
    assert.equal((await h.run()).kind, "HOLD"); assert.equal(h.sdkCalls.length, 0); assert.equal(h.rpcCalls.length, 0);
  }
});
test("naked driver/config objects cannot replace the same-SDK scope verifier", async () => {
  const h = harness();
  const result = await ensurePocketCheckoutIntent({ scope, parameters: seed() }, { ...h.dependencies, stripeDriver: {} as never });
  assert.equal(result.kind, "HOLD"); assert.equal(h.sdkCalls.length, 0);
});
test("SDK 500/conflict/timeout leave the sole durable dispatch unresolved without retries", async () => {
  for (const message of ["500", "409 idempotency conflict", "ETIMEDOUT private-token"]) {
    const h = harness(); h.sdk(() => { throw Error(message); });
    const first = await h.run(); const second = await h.run();
    assert.equal(first.kind, "HOLD"); assert.equal(second.kind, "HOLD"); assert.equal(h.sdkCalls.length, 1);
    assert.equal(JSON.stringify(first).includes(message), false);
  }
});
test("lost atomic-claim response never dispatches or reacquires the previous token", async () => {
  const h = harness(); h.rpc((name) => {
    if (name === "claim_pocket_checkout_intent") { h.markDispatched(); return { data: null, error: { message: "private" } }; }
    return null;
  });
  assert.equal((await h.run()).kind, "HOLD"); h.rpc(undefined);
  assert.equal((await h.run()).kind, "HOLD"); assert.equal(h.sdkCalls.length, 0);
});
test("DB persistence ambiguity after a successful provider result blocks another create", async () => {
  const h = harness(); h.rpc((name) => name === "record_pocket_checkout_session" ? { data: null, error: Error("lost response") } : null);
  assert.equal((await h.run()).kind, "HOLD"); h.rpc(undefined);
  assert.equal((await h.run()).kind, "HOLD"); assert.equal(h.sdkCalls.length, 1);
});
test("session expiry and key age over 24 hours never authorize a new intent or key", async () => {
  const h = harness(); assert.equal((await h.run()).kind, "READY"); h.advance(48 * 3600_000);
  assert.equal((await h.run()).kind, "HOLD"); assert.equal(h.sdkCalls.length, 1);
});
test("mismatched provider session ownership/mode/metadata/expiry never becomes READY", async () => {
  for (const change of ["customer", "mode", "intent", "expiry", "status", "url"]) {
    const h = harness(); h.sdk((p) => {
      const result: Record<string, unknown> = { id: "cs_test_QA", mode: "subscription", status: "open", customer: p.customer, client_reference_id: p.client_reference_id, metadata: p.metadata, expires_at: p.expires_at, livemode: false, url: "https://checkout.stripe.com/c/pay/cs_test_QA" };
      if (change === "customer") result.customer = "cus_OTHER";
      if (change === "mode") result.livemode = true;
      if (change === "intent") result.metadata = { ...(p.metadata as object), pocket_checkout_intent_id: user };
      if (change === "expiry") result.expires_at = Number(p.expires_at) + 1;
      if (change === "status") result.status = "complete";
      if (change === "url") result.url = "https://attacker.test/c/pay/test";
      return result;
    });
    assert.equal((await h.run()).kind, "HOLD"); assert.equal(h.rpcCalls.filter((r) => r.name === "record_pocket_checkout_session").length, 0);
  }
});
test("changed attribution/parameters cannot rotate the immutable prepared intent", async () => {
  const h = harness(); assert.equal((await h.run()).kind, "READY");
  const changed = seed(); changed.metadata.acquisition_source = "different"; changed.subscription_data.metadata.acquisition_source = "different";
  assert.equal((await h.run(changed)).kind, "HOLD"); assert.equal(h.sdkCalls.length, 1);
});
test("cancellation after atomic claim consumes permission without sending a provider POST", async () => {
  const h = harness(); const abort = new AbortController();
  h.rpc((name) => {
    if (name === "claim_pocket_checkout_intent") { h.markDispatched(); abort.abort(); return { data: { ...h.packet("DISPATCH"), dispatch_token: token, dispatch_count: 1 }, error: null }; }
    return null;
  });
  assert.equal((await h.run(seed(), abort.signal)).kind, "HOLD"); assert.equal(h.sdkCalls.length, 0);
});
test("cancellation after provider dispatch still persists its outcome before withholding redirect", async () => {
  const h = harness(); const abort = new AbortController();
  h.sdk((p) => { abort.abort(); return { id: "cs_test_QA", mode: "subscription", status: "open", customer: p.customer, client_reference_id: p.client_reference_id, metadata: p.metadata, expires_at: p.expires_at, livemode: false, url: "https://checkout.stripe.com/c/pay/cs_test_QA" }; });
  assert.equal((await h.run(seed(), abort.signal)).kind, "HOLD");
  assert.equal(h.rpcCalls.filter((r) => r.name === "record_pocket_checkout_session").length, 1);
  assert.equal((await h.run()).kind, "READY"); assert.equal(h.sdkCalls.length, 1);
});
test("stored text/hash/key or fresh claim scope corruption prevents dispatch", async () => {
  for (const key of ["parameters_sha256", "idempotency_key", "customer_id", "candidate_sha", "dispatch_token"]) {
    const h = harness(); h.rpc((name) => {
      if (name !== "claim_pocket_checkout_intent") return null;
      h.markDispatched();
      return { data: { ...h.packet("DISPATCH"), dispatch_count: 1, dispatch_token: token, [key]: "corrupt" }, error: null };
    });
    assert.equal((await h.run()).kind, "HOLD"); assert.equal(h.sdkCalls.length, 0);
  }
});
