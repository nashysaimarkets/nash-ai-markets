/** Unmounted operations. No route/env toggle activates these governed proposals. */
import { createHash } from 'node:crypto';
import type Stripe from 'stripe';
import { collectPocketCheckoutInventory, createPocketCheckoutInventoryReader } from './pocket-checkout-inventory.ts';
import type { PocketCheckoutInventoryScope } from './pocket-checkout-inventory.ts';
import { validPocketFoundingPrice } from '../stripe-commercial.ts';

type Obj = Record<string, unknown>;
type Rpc = (name: string, args: Obj) => Promise<{ data: unknown; error: unknown }>;
type Result = { kind: 'HOLD'; reason: string } | { kind: 'ISSUED' | 'BOUND' | 'RECOVERED' | 'RECONCILED'; id: string };
type BaseScope = Omit<PocketCheckoutInventoryScope, 'intentId' | 'customerId'>;
type Dependencies = {
  /** Separately authenticated verifier RPC for issue/reconcile; runtime RPC for provisioning. */
  rpc: Rpc;
  authorise: () => Promise<unknown>;
  driver: ReturnType<typeof createPocketCheckoutRecoveryDriver>;
  now?: () => number;
};
const drivers = new WeakSet<object>();
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const hold = (reason = 'AUTHORITY_OR_EVIDENCE_UNAVAILABLE'): Result => ({ kind: 'HOLD', reason });
function fail(): never { throw Error('CHECKOUT_COMPLETION_HOLD'); }
function obj(v: unknown): Obj { if (!v || typeof v !== 'object' || Array.isArray(v)) return fail(); return v as Obj; }
function id(prefix: string, v: unknown): v is string {
  return typeof v === 'string' && new RegExp(prefix === 'cs' ? '^cs_(?:test_|live_)?[A-Za-z0-9]+$' : `^${prefix}_[A-Za-z0-9]+$`).test(v);
}
function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') { const s = JSON.stringify(v); if (s === undefined) return fail(); return s; }
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(obj(v)[k])}`).join(',')}}`;
}
function snapshot<T>(v: T): T { const c = structuredClone(v); const freeze = (x: unknown) => { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x); } }; freeze(c); return c; }
function scopeValid(s: BaseScope) {
  if (!uuid.test(s.userId) || !id('price', s.priceId) || !id('acct', s.stripeAccountId) ||
      typeof s.livemode !== 'boolean' || !/^[a-f0-9]{40}$/.test(s.candidateSha) || s.offer !== 'pocket_founding_650') fail();
}
const options = Object.freeze({ timeout: 5000, maxNetworkRetries: 0 });
/** One existing SDK instance; never read credentials, discover by email or retry POST. */
export function createPocketCheckoutRecoveryDriver(stripe: Pick<Stripe, 'accounts' | 'prices' | 'customers' | 'subscriptions' | 'checkout' | 'subscriptionSchedules'>) {
  if (typeof window !== 'undefined') return fail();
  const account = stripe.accounts.retrieve.bind(stripe.accounts), price = stripe.prices.retrieve.bind(stripe.prices);
  const create = stripe.customers.create.bind(stripe.customers), customer = stripe.customers.retrieve.bind(stripe.customers);
  const session = stripe.checkout.sessions.retrieve.bind(stripe.checkout.sessions);
  const driver = Object.freeze({
    inventory: createPocketCheckoutInventoryReader(stripe),
    async verify(s: BaseScope) {
      const a = await account({}, options), p = await price(s.priceId, {}, options);
      if (a.id !== s.stripeAccountId || p.id !== s.priceId || p.livemode !== s.livemode || !validPocketFoundingPrice(p) || p.recurring?.interval_count !== 1) fail();
    },
    createCustomer: (metadata: Record<string, string>, key: string) => create({ metadata }, { ...options, idempotencyKey: key }),
    customer: (customerId: string) => customer(customerId, {}, options),
    session: (sessionId: string) => session(sessionId, {}, options),
  });
  drivers.add(driver); return driver;
}
function context(scope: BaseScope, d: Dependencies, signal?: AbortSignal) {
  if (typeof window !== 'undefined' || !drivers.has(d.driver)) fail();
  scopeValid(scope);
  const now = d.now ?? Date.now, started = now();
  const check = () => { const t = now(); if (signal?.aborted || !Number.isSafeInteger(t) || t < started || t - started > 55_000) fail(); return t; };
  const authorise = async (expected: unknown) => { check(); const a = await d.authorise(); check(); if (canonical(a) !== canonical(expected)) fail(); };
  const rpc = async (name: string, args: Obj) => { check(); const r = await d.rpc(name, args); check(); if (r.error) fail(); return obj(r.data); };
  return { now, check, authorise, rpc };
}
function fenceValid(f: Obj, scope: BaseScope, now: number) {
  if (f.kind !== 'FENCED' || !/^[a-f0-9]{64}$/.test(String(f.receipt_sha256)) || canonical(f.scope) !== canonical(scope) ||
      !Number.isFinite(Date.parse(String(f.fenced_at))) || Date.parse(String(f.fenced_at)) > now ||
      !Number.isFinite(Date.parse(String(f.valid_until))) || Date.parse(String(f.valid_until)) <= now ||
      f.old_writers_drained !== true || f.recovery_links_disabled !== true || f.other_obligations_reviewed !== true) fail();
}
function base(scope: PocketCheckoutInventoryScope): BaseScope {
  const { intentId: _intent, customerId: _customer, ...b } = scope; return b;
}
async function inventory(scope: PocketCheckoutInventoryScope, d: Dependencies, signal?: AbortSignal) {
  const r = await collectPocketCheckoutInventory(scope, { reader: d.driver.inventory, authorise: async () => {
    const a = await d.authorise(); return canonical(a) === canonical(scope) ? scope : null;
  }, now: d.now }, signal);
  if (r.kind !== 'COMPLETE') return fail(); return r;
}
/** Collect authenticated inventory after a durable operator fence, then issue through verifier-only SQL. */
export async function issuePocketCheckoutBaseline(input: PocketCheckoutInventoryScope, d: Dependencies, signal?: AbortSignal): Promise<Result> {
  try {
    const scope = snapshot(input), c = context(scope, d, signal); await c.authorise(scope);
    const f = await c.rpc('get_pocket_checkout_fence', { p_scope: base(scope) }); fenceValid(f, base(scope), c.check());
    await d.driver.verify(scope); c.check();
    const evidence = await inventory(scope, d, signal);
    if (Object.values(evidence.receipt.blockers).some(n => n !== 0) || Date.parse(String(f.fenced_at)) > Date.parse(evidence.receipt.inventoryStartedAt)) return hold('EXISTING_OBLIGATIONS');
    await c.authorise(scope);
    const current = await c.rpc('get_pocket_checkout_fence', { p_scope: base(scope) });
    if (canonical(current) !== canonical(f)) return hold('FENCE_CHANGED');
    fenceValid(current, base(scope), c.check());
    const issued = await c.rpc('issue_pocket_checkout_baseline', { p_inventory_text: evidence.receiptText,
      p_inventory_sha256: evidence.receiptSha256, p_fence_sha256: f.receipt_sha256 });
    return issued.kind === 'ISSUED' && issued.id === scope.intentId ? { kind: 'ISSUED', id: scope.intentId } : hold();
  } catch { return hold(signal?.aborted ? 'CANCELLED' : undefined); }
}
/** Exactly one Customer create after a durable claim; ambiguous dispatch stays unresolved. */
export async function provisionPocketCustomer(input: BaseScope, d: Dependencies, signal?: AbortSignal): Promise<Result> {
  let dispatched = false;
  try {
    const scope = snapshot(input), c = context(scope, d, signal); await c.authorise(scope);
    await d.driver.verify(scope); c.check();
    const p = await c.rpc('prepare_pocket_customer_provision', { p_scope: scope });
    if (p.kind === 'BOUND' && id('cus', p.customer_id)) return { kind: 'BOUND', id: p.customer_id };
    if (p.kind !== 'PREPARED' || !uuid.test(String(p.id)) || canonical(p.scope) !== canonical(scope)) return hold('ENROLLMENT_REQUIRED_OR_UNRESOLVED');
    await c.authorise(scope);
    const claim = await c.rpc('claim_pocket_customer_provision', { p_id: p.id, p_scope: scope });
    if (claim.kind !== 'DISPATCH' || claim.id !== p.id || !uuid.test(String(claim.token)) || canonical(claim.scope) !== canonical(scope) || claim.key !== `pocket-customer:${p.id}`) return hold('CLAIM_UNRESOLVED');
    c.check(); dispatched = true;
    const expected = { supabase_user_id: scope.userId, pocket_provision_id: String(p.id), pocket_candidate_sha: scope.candidateSha };
    const customer = obj(await d.driver.createCustomer(expected, String(claim.key)));
    if (!id('cus', customer.id) || customer.object !== 'customer' || customer.deleted === true || customer.livemode !== scope.livemode || canonical(customer.metadata) !== canonical(expected)) return hold('DISPATCH_UNRESOLVED');
    // Always retain a known outcome after dispatch, even if the browser cancelled.
    const saved = await d.rpc('record_pocket_customer_provision', { p_id: p.id, p_token: claim.token, p_scope: scope, p_customer: { id: customer.id, livemode: customer.livemode, metadata: expected } });
    if (saved.error || obj(saved.data).kind !== 'BOUND' || obj(saved.data).customer_id !== customer.id) return hold('PERSISTENCE_UNRESOLVED');
    await c.authorise(scope);
    return { kind: 'BOUND', id: customer.id };
  } catch { return hold(dispatched ? 'DISPATCH_UNRESOLVED' : signal?.aborted ? 'CANCELLED' : undefined); }
}
/** Recover a known provider Customer using verifier authority; never repeat Customer create. */
export async function recoverPocketCustomer(input: BaseScope & { provisionId: string; customerId: string }, d: Dependencies, signal?: AbortSignal): Promise<Result> {
  try {
    const frozen = snapshot(input), { provisionId, customerId, ...scope } = frozen;
    const c = context(scope, d, signal); if (!uuid.test(provisionId) || !id('cus', customerId)) fail();
    await c.authorise(scope); await d.driver.verify(scope); c.check();
    const customer = obj(await d.driver.customer(customerId)); c.check();
    const metadata = { supabase_user_id: scope.userId, pocket_provision_id: provisionId, pocket_candidate_sha: scope.candidateSha };
    if (customer.id !== customerId || customer.object !== 'customer' || customer.deleted === true || customer.livemode !== scope.livemode || canonical(customer.metadata) !== canonical(metadata)) fail();
    await c.authorise(scope);
    const saved = await c.rpc('recover_pocket_customer_provision', { p_id: provisionId, p_scope: scope, p_customer: { id: customerId, livemode: scope.livemode, metadata } });
    return saved.kind === 'BOUND' && saved.customer_id === customerId ? { kind: 'BOUND', id: customerId } : hold();
  } catch { return hold(signal?.aborted ? 'CANCELLED' : undefined); }
}
/** Known-session GET + full inventory. Unknown/absent session never releases a dispatch. */
export async function reconcilePocketCheckout(input: PocketCheckoutInventoryScope & { sessionId: string }, d: Dependencies, signal?: AbortSignal): Promise<Result> {
  try {
    const frozen = snapshot(input), { sessionId, ...scope } = frozen, c = context(scope, d, signal);
    if (!id('cs', sessionId)) fail(); await c.authorise(scope);
    const f = await c.rpc('get_pocket_checkout_fence', { p_scope: base(scope) }); fenceValid(f, base(scope), c.check());
    await d.driver.verify(scope); c.check();
    const p = await c.rpc('inspect_pocket_checkout_recovery', { p_scope: scope });
    if (p.kind !== 'DISPATCHED' && p.kind !== 'READY') return hold('NO_KNOWN_DISPATCH');
    if (canonical(p.scope) !== canonical(scope) || typeof p.parameters_text !== 'string' || hash(p.parameters_text) !== p.parameters_sha256 ||
        (p.session_id !== null && p.session_id !== sessionId)) fail();
    const parameters = obj(JSON.parse(p.parameters_text)), s = obj(await d.driver.session(sessionId)); c.check();
    if (s.id !== sessionId || s.object !== 'checkout.session' || s.customer !== scope.customerId || s.livemode !== scope.livemode ||
        s.client_reference_id !== scope.userId || s.mode !== 'subscription' || canonical(s.metadata) !== canonical(parameters.metadata) ||
        obj(s.metadata).pocket_checkout_intent_id !== scope.intentId || obj(s.metadata).pocket_candidate_sha !== scope.candidateSha ||
        s.expires_at !== parameters.expires_at || !['open', 'complete', 'expired'].includes(String(s.status))) fail();
    const evidence = await inventory(scope, d, signal);
    const listed = evidence.receipt.checkoutSessions.find(x => x.id === sessionId);
    if (!listed || listed.status !== s.status || listed.subscription !== s.subscription || listed.paymentStatus !== s.payment_status ||
        Date.parse(String(f.fenced_at)) > Date.parse(evidence.receipt.inventoryStartedAt)) fail();
    const blockers = evidence.receipt.blockers;
    if (blockers.activeOrPendingSubscription || blockers.activeOrPendingSchedule || blockers.checkoutReconciliation || blockers.scheduleReconciliation ||
        blockers.openCheckout !== (s.status === 'open' ? 1 : 0)) return hold('EXISTING_OBLIGATIONS');
    if (s.status === 'open') {
      const u = new URL(String(s.url));
      if (u.origin !== 'https://checkout.stripe.com' || u.username || u.password || !u.pathname.startsWith('/c/pay/') || Number(s.expires_at) * 1000 <= c.check()) fail();
    }
    await c.authorise(scope);
    const current = await c.rpc('get_pocket_checkout_fence', { p_scope: base(scope) });
    if (canonical(current) !== canonical(f)) fail(); fenceValid(current, base(scope), c.check());
    const projection = { id: s.id, customer: s.customer, mode: s.mode, status: s.status, livemode: s.livemode,
      client_reference_id: s.client_reference_id, expires_at: s.expires_at, metadata: s.metadata,
      url: s.status === 'open' ? s.url : null, subscription: s.subscription, payment_status: s.payment_status };
    const saved = await c.rpc('reconcile_pocket_checkout_intent', { p_scope: scope, p_session: projection,
      p_parameters_sha256: p.parameters_sha256, p_inventory_text: evidence.receiptText, p_inventory_sha256: evidence.receiptSha256, p_fence_sha256: f.receipt_sha256 });
    const expected = s.status === 'open' ? 'RECOVERED' : 'RECONCILED';
    return saved.kind === expected && saved.id === scope.intentId ? { kind: expected, id: scope.intentId } : hold();
  } catch { return hold(signal?.aborted ? 'CANCELLED' : undefined); }
}
