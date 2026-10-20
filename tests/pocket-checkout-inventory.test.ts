import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { collectPocketCheckoutInventory, createPocketCheckoutInventoryReader } from "../app/lib/server/pocket-checkout-inventory.ts";
import type { PocketCheckoutInventoryScope } from "../app/lib/server/pocket-checkout-inventory.ts";

const scope: PocketCheckoutInventoryScope = {
  intentId: "22222222-2222-4222-8222-222222222222", userId: "11111111-1111-4111-8111-111111111111",
  customerId: "cus_QA", priceId: "price_QA", stripeAccountId: "acct_QA", livemode: false,
  candidateSha: "a".repeat(40), offer: "pocket_founding_650",
};
const list = (kind: string, data: unknown[], more = false) => ({ object: "list", url: `/v1/${kind}`, data, has_more: more });
const sub = (id = "sub_QA", patch: Record<string, unknown> = {}) => ({ id, object: "subscription", customer: "cus_QA", livemode: false, created: 100, metadata: {}, status: "canceled", ...patch });
const session = (id = "cs_test_QA", patch: Record<string, unknown> = {}) => ({ id, object: "checkout.session", customer: "cus_QA", livemode: false, created: 100, metadata: {}, client_reference_id: null, status: "expired", mode: "subscription", payment_status: "unpaid", subscription: null, ...patch });
const schedule = (id = "sub_sched_QA", patch: Record<string, unknown> = {}) => ({ id, object: "subscription_schedule", customer: "cus_QA", livemode: false, created: 100, metadata: {}, status: "canceled", subscription: null, released_subscription: null, ...patch });
function harness() {
  const calls: Array<{ method: string; parameters: unknown; options: unknown }> = [];
  let authority: PocketCheckoutInventoryScope | null = { ...scope };
  let clock = 1_800_000_000_000;
  let hook: ((method: string, parameters: unknown) => unknown | Promise<unknown>) | undefined;
  const replies: Record<string, unknown[]> = {
    account: [{ id: "acct_QA", object: "account" }],
    customer: [{ id: "cus_QA", object: "customer", livemode: false, metadata: {} }],
    subscriptions: [list("subscriptions", [])], sessions: [list("checkout/sessions", [])], schedules: [list("subscription_schedules", [])],
  };
  const read = async (method: string, parameters: unknown, options: unknown) => {
    calls.push({ method, parameters, options });
    const result = hook ? await hook(method, parameters) : undefined;
    if (result !== undefined) return result;
    const queue = replies[method];
    if (!queue.length) throw new Error("Unexpected repeated read");
    return queue.shift();
  };
  const write = () => { throw new Error("No provider write permitted"); };
  const reader = createPocketCheckoutInventoryReader({
    accounts: { retrieve: (p: unknown, o: unknown) => read("account", p, o), create: write },
    customers: { retrieve: (id: string, p: unknown, o: unknown) => read("customer", { id, ...p as object }, o), create: write, update: write },
    subscriptions: { list: (p: unknown, o: unknown) => read("subscriptions", p, o), create: write, cancel: write },
    subscriptionSchedules: { list: (p: unknown, o: unknown) => read("schedules", p, o), create: write, release: write },
    checkout: { sessions: { list: (p: unknown, o: unknown) => read("sessions", p, o), create: write, expire: write } },
  } as never);
  const dependencies = { reader, authorise: async () => authority, now: () => clock };
  return { calls, replies, dependencies,
    run: (input: PocketCheckoutInventoryScope = scope, signal?: AbortSignal) => collectPocketCheckoutInventory(input, dependencies, signal),
    authorise: (next: PocketCheckoutInventoryScope | null) => { authority = next; },
    hook: (next: typeof hook) => { hook = next; }, advance: (ms: number) => { clock += ms; },
  };
}

test("complete empty owned inventory produces evidence only, not an attestation", async () => {
  const h = harness(); const result = await h.run();
  assert.equal(result.kind, "COMPLETE");
  if (result.kind !== "COMPLETE") return;
  assert.deepEqual(result.receipt.blockers, { openCheckout: 0, activeOrPendingSubscription: 0, activeOrPendingSchedule: 0, checkoutReconciliation: 0, scheduleReconciliation: 0 });
  assert.equal(result.receipt.authorisesCheckout, false);
  assert.equal(result.receipt.allPagesVerified, true);
  assert.equal(result.receiptSha256, createHash("sha256").update(result.receiptText).digest("hex"));
  assert.deepEqual(JSON.parse(result.receiptText), result.receipt);
  assert.deepEqual(h.calls.map(c => c.method), ["account", "customer", "subscriptions", "sessions", "schedules"]);
  for (const c of h.calls) assert.deepEqual(c.options, { timeout: 5000, maxNetworkRetries: 0 });
  assert.equal(Object.isFrozen(result.receipt.scope), true);
});
test("follows every page with the previous last ID, without price or time filters", async () => {
  const h = harness();
  h.replies.subscriptions = [list("subscriptions", [sub("sub_QA1")], true), list("subscriptions", [sub("sub_QA2")])];
  h.replies.sessions = [list("checkout/sessions", [session("cs_test_QA1")], true), list("checkout/sessions", [session("cs_test_QA2")])];
  h.replies.schedules = [list("subscription_schedules", [schedule("sub_sched_QA1")], true), list("subscription_schedules", [schedule("sub_sched_QA2")])];
  const result = await h.run(); assert.equal(result.kind, "COMPLETE");
  assert.deepEqual(h.calls.filter(c => c.method === "subscriptions").map(c => c.parameters), [{ customer: "cus_QA", limit: 100, status: "all" }, { customer: "cus_QA", limit: 100, status: "all", starting_after: "sub_QA1" }]);
  assert.deepEqual(h.calls.findLast(c => c.method === "sessions")?.parameters, { customer: "cus_QA", limit: 100, starting_after: "cs_test_QA1" });
  assert.deepEqual(h.calls.findLast(c => c.method === "schedules")?.parameters, { customer: "cus_QA", limit: 100, starting_after: "sub_sched_QA1" });
});
test("nonterminal subscription and scheduled future obligations are blockers", async () => {
  const h = harness();
  h.replies.subscriptions = [list("subscriptions", [sub("sub_active", { status: "active" }), sub("sub_pending", { status: "incomplete" }), sub("sub_expired", { status: "incomplete_expired" })])];
  h.replies.schedules = [list("subscription_schedules", [schedule("sub_sched_future", { status: "not_started" }), schedule("sub_sched_active", { status: "active" })])];
  h.replies.sessions = [list("checkout/sessions", [session("cs_test_open", { status: "open" })])];
  const result = await h.run(); assert.equal(result.kind, "COMPLETE");
  if (result.kind === "COMPLETE") assert.deepEqual(result.receipt.blockers, { openCheckout: 1, activeOrPendingSubscription: 2, activeOrPendingSchedule: 2, checkoutReconciliation: 0, scheduleReconciliation: 0 });
});
test("completed subscription checkout needs a matched terminal subscription", async () => {
  const h = harness(); h.replies.subscriptions = [list("subscriptions", [sub()])];
  h.replies.sessions = [list("checkout/sessions", [session("cs_test_known", { status: "complete", subscription: "sub_QA" }), session("cs_test_unknown", { status: "complete", subscription: "sub_missing" }), session("cs_test_absent", { status: "complete" })])];
  const result = await h.run(); assert.equal(result.kind, "COMPLETE");
  if (result.kind === "COMPLETE") assert.equal(result.receipt.blockers.checkoutReconciliation, 2);
});
test("released schedule requires its terminal released subscription to be inventoried", async () => {
  const h = harness(); h.replies.subscriptions = [list("subscriptions", [sub()])];
  h.replies.schedules = [list("subscription_schedules", [schedule("sub_sched_known", { status: "released", released_subscription: "sub_QA" }), schedule("sub_sched_missing", { status: "released", released_subscription: "sub_missing" })])];
  const result = await h.run(); assert.equal(result.kind, "COMPLETE");
  if (result.kind === "COMPLETE") assert.equal(result.receipt.blockers.scheduleReconciliation, 1);
});
test("completed schedule cannot silently leave an unknown underlying subscription", async () => {
  const h = harness();
  h.replies.schedules = [list("subscription_schedules", [schedule("sub_sched_complete", { status: "completed", subscription: "sub_missing" })])];
  const result = await h.run(); assert.equal(result.kind, "COMPLETE");
  if (result.kind === "COMPLETE") assert.equal(result.receipt.blockers.scheduleReconciliation, 1);
});
test("nullable legacy Checkout and schedule metadata preserve the durable bound inventory", async () => {
  const h = harness();
  h.replies.sessions = [list("checkout/sessions", [session("cs_test_legacy", { metadata: null })])];
  h.replies.schedules = [list("subscription_schedules", [schedule("sub_sched_legacy", { metadata: null })])];
  const result = await h.run(); assert.equal(result.kind, "COMPLETE");
  if (result.kind === "COMPLETE") {
    assert.equal(result.receipt.checkoutSessions.length, 1); assert.equal(result.receipt.subscriptionSchedules.length, 1);
    assert.equal(result.receipt.scope.customerId, scope.customerId); assert.equal(result.receipt.authorisesCheckout, false);
  }
});
for (const [label, mutate] of [
  ["wrong account", (h: ReturnType<typeof harness>) => { h.replies.account = [{ id: "acct_other", object: "account" }]; }],
  ["deleted customer", (h: ReturnType<typeof harness>) => { h.replies.customer = [{ id: "cus_QA", object: "customer", deleted: true }]; }],
  ["customer mode mismatch", (h: ReturnType<typeof harness>) => { h.replies.customer = [{ id: "cus_QA", object: "customer", livemode: true, metadata: {} }]; }],
  ["customer metadata mismatch", (h: ReturnType<typeof harness>) => { h.replies.customer = [{ id: "cus_QA", object: "customer", livemode: false, metadata: { supabase_user_id: "another" } }]; }],
  ["null required customer metadata", (h: ReturnType<typeof harness>) => { h.replies.customer = [{ id: "cus_QA", object: "customer", livemode: false, metadata: null }]; }],
  ["foreign subscription", (h: ReturnType<typeof harness>) => { h.replies.subscriptions = [list("subscriptions", [sub("sub_bad", { customer: "cus_other" })])]; }],
  ["null required subscription metadata", (h: ReturnType<typeof harness>) => { h.replies.subscriptions = [list("subscriptions", [sub("sub_bad", { metadata: null })])]; }],
  ["foreign session reference", (h: ReturnType<typeof harness>) => { h.replies.sessions = [list("checkout/sessions", [session("cs_test_bad", { client_reference_id: "another" })])]; }],
  ["foreign session UUID metadata", (h: ReturnType<typeof harness>) => { h.replies.sessions = [list("checkout/sessions", [session("cs_test_bad", { metadata: { supabase_user_id: "another" } })])]; }],
  ["session prefix contradicts mode", (h: ReturnType<typeof harness>) => { h.replies.sessions = [list("checkout/sessions", [session("cs_live_bad")])]; }],
  ["foreign schedule mode", (h: ReturnType<typeof harness>) => { h.replies.schedules = [list("subscription_schedules", [schedule("sub_sched_bad", { livemode: true })])]; }],
  ["unknown subscription state", (h: ReturnType<typeof harness>) => { h.replies.subscriptions = [list("subscriptions", [sub("sub_bad", { status: "new_state" })])]; }],
  ["unknown schedule state", (h: ReturnType<typeof harness>) => { h.replies.schedules = [list("subscription_schedules", [schedule("sub_sched_bad", { status: "new_state" })])]; }],
  ["unknown session state", (h: ReturnType<typeof harness>) => { h.replies.sessions = [list("checkout/sessions", [session("cs_test_bad", { status: null })])]; }],
  ["unknown metadata type", (h: ReturnType<typeof harness>) => { h.replies.sessions = [list("checkout/sessions", [session("cs_test_bad", { metadata: [] })])]; }],
  ["malformed pagination", (h: ReturnType<typeof harness>) => { h.replies.subscriptions = [{ ...list("subscriptions", []), has_more: "false" }]; }],
  ["empty continuation", (h: ReturnType<typeof harness>) => { h.replies.sessions = [list("checkout/sessions", [], true)]; }],
  ["duplicate record", (h: ReturnType<typeof harness>) => { h.replies.subscriptions = [list("subscriptions", [sub()], true), list("subscriptions", [sub()])]; }],
  ["foreign list URL", (h: ReturnType<typeof harness>) => { h.replies.sessions = [list("evil", [])]; }],
] as const) test(`${label} fails closed without a partial receipt`, async () => {
  const h = harness(); mutate(h); const result = await h.run();
  assert.equal(result.kind, "HOLD"); assert.equal("receipt" in result, false);
});
test("auth is required before any SDK access and rechecked after all pages", async () => {
  const h = harness(); h.authorise(null); assert.equal((await h.run()).kind, "HOLD"); assert.equal(h.calls.length, 0);
  const changed = harness(); changed.hook(method => { if (method === "schedules") changed.authorise({ ...scope, userId: "33333333-3333-4333-8333-333333333333" }); });
  assert.equal((await changed.run()).kind, "HOLD");
});
test("input is snapshotted before awaiting authority", async () => {
  const h = harness(); const mutable = { ...scope }; const run = h.run(mutable); mutable.customerId = "cus_other";
  const result = await run; assert.equal(result.kind, "COMPLETE");
  if (result.kind === "COMPLETE") assert.equal(result.receipt.scope.customerId, "cus_QA");
});
test("concurrent customers sharing the SDK cannot share scope or inventory", async () => {
  const h = harness();
  h.hook((method, parameters) => {
    if (method === "account") return { id: "acct_QA", object: "account" };
    if (method === "customer") return { id: (parameters as { id: string }).id, object: "customer", livemode: false, metadata: {} };
    return list(method === "sessions" ? "checkout/sessions" : method === "schedules" ? "subscription_schedules" : "subscriptions", []);
  });
  const second: PocketCheckoutInventoryScope = { ...scope, intentId: "33333333-3333-4333-8333-333333333333", userId: "44444444-4444-4444-8444-444444444444", customerId: "cus_second" };
  const [one, two] = await Promise.all([h.run(), collectPocketCheckoutInventory(second, { ...h.dependencies, authorise: async () => second })]);
  assert.equal(one.kind, "COMPLETE"); assert.equal(two.kind, "COMPLETE");
  if (one.kind === "COMPLETE" && two.kind === "COMPLETE") {
    assert.equal(one.receipt.scope.customerId, "cus_QA"); assert.equal(two.receipt.scope.customerId, "cus_second");
    assert.notEqual(one.receiptSha256, two.receiptSha256);
  }
});
test("pre-abort and mid-read abort stop follow-up calls", async () => {
  const h = harness(); const pre = new AbortController(); pre.abort();
  assert.equal((await h.run(scope, pre.signal)).kind, "HOLD"); assert.equal(h.calls.length, 0);
  const mid = harness(); const controller = new AbortController();
  mid.hook(method => { if (method === "account") { controller.abort(); return new Promise(() => {}); } });
  assert.equal((await mid.run(scope, controller.signal)).kind, "HOLD"); assert.equal(mid.calls.length, 1);
});
test("provider errors are not retried or reflected into receipts", async () => {
  for (const statusCode of [401, 403, 429, 500]) {
    const h = harness(); h.hook(() => { throw Object.assign(new Error("private provider payload"), { statusCode }); });
    const result = await h.run(); assert.equal(result.kind, "HOLD"); assert.equal(h.calls.length, 1);
    assert.equal(JSON.stringify(result).includes("private"), false);
  }
});
test("timed out SDK read returns HOLD once and ignores late success", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const h = harness(); let resolve!: (value: unknown) => void;
  let started!: () => void; const reading = new Promise<void>(r => { started = r; });
  h.hook(method => method === "account" ? new Promise(r => { resolve = r; started(); }) : undefined);
  const pending = h.run(); await reading; t.mock.timers.tick(5000);
  assert.equal((await pending).kind, "HOLD");
  resolve({ id: "acct_QA", object: "account" }); await Promise.resolve();
  assert.equal(h.calls.length, 1);
});
test("invalid or forged scopes cannot make reads", async () => {
  const h = harness();
  assert.equal((await h.run({ ...scope, candidateSha: "short" })).kind, "HOLD");
  assert.equal((await h.run({ ...scope, customerId: "customer-by-email" })).kind, "HOLD");
  assert.equal(h.calls.length, 0);
  assert.equal((await collectPocketCheckoutInventory(scope, { ...h.dependencies, reader: { ...h.dependencies.reader } })).kind, "HOLD");
});
test("slow/backwards inventory cannot provide a fresh receipt", async () => {
  for (const delta of [45_001, -1]) {
    const h = harness(); h.hook(method => { if (method === "sessions") h.advance(delta); });
    assert.equal((await h.run()).kind, "HOLD");
  }
});
test("a full page bound stops rather than claiming truncation is complete", async () => {
  const h = harness(); h.replies.subscriptions = Array.from({ length: 20 }, (_, i) => list("subscriptions", [sub(`sub_QA${i}`)], true));
  assert.equal((await h.run()).kind, "HOLD"); assert.equal(h.calls.filter(c => c.method === "subscriptions").length, 20);
  assert.equal(h.calls.some(c => c.method === "sessions"), false);
});
test("receipt excludes provider PII, URLs, metadata and error payloads", async () => {
  const h = harness(); h.replies.customer = [{ id: "cus_QA", object: "customer", livemode: false, metadata: { supabase_user_id: scope.userId, secret: "do-not-copy" }, email: "private@example.test" }];
  h.replies.sessions = [list("checkout/sessions", [session("cs_test_QA", { url: "https://example.test/secret", customer_email: "private@example.test", metadata: { hidden: "do-not-copy" } })])];
  const result = await h.run(); assert.equal(result.kind, "COMPLETE");
  assert.equal(/private@example|do-not-copy|example\.test\/secret/.test(JSON.stringify(result)), false);
});
