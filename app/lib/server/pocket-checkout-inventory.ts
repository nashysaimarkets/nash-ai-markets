/** Read-only evidence collection; no route, baseline issuer or Checkout authority. */
import { createHash } from "node:crypto";
import type Stripe from "stripe";

export type PocketCheckoutInventoryScope = Readonly<{
  intentId: string; userId: string; customerId: string; priceId: string;
  stripeAccountId: string; livemode: boolean; candidateSha: string; offer: "pocket_founding_650";
}>;
type RecordValue = Record<string, unknown>;
type Item = Readonly<{ id: string; status: string; created: number; subscription?: string | null; releasedSubscription?: string | null; mode?: string; paymentStatus?: string }>;
type Blockers = Readonly<{ openCheckout: number; activeOrPendingSubscription: number; activeOrPendingSchedule: number; checkoutReconciliation: number; scheduleReconciliation: number }>;
type Receipt = Readonly<{
  schemaVersion: 1; authorisesCheckout: false; scope: PocketCheckoutInventoryScope;
  inventoryStartedAt: string; inventoryCompletedAt: string; allPagesVerified: true;
  subscriptions: readonly Item[]; checkoutSessions: readonly Item[]; subscriptionSchedules: readonly Item[];
  pages: Readonly<{ subscriptions: number; checkoutSessions: number; subscriptionSchedules: number }>;
  blockers: Blockers;
}>;
export type PocketCheckoutInventoryResult = Readonly<{ kind: "COMPLETE"; receipt: Receipt; receiptText: string; receiptSha256: string }>
  | Readonly<{ kind: "HOLD"; reason: "SERVER_ONLY" | "CANCELLED" | "AUTHORITY_OR_INVENTORY_UNAVAILABLE" }>;
export type PocketCheckoutInventoryReader = Readonly<{
  account: () => Promise<unknown>; customer: (id: string) => Promise<unknown>;
  subscriptions: (customer: string, cursor?: string) => Promise<unknown>;
  sessions: (customer: string, cursor?: string) => Promise<unknown>;
  schedules: (customer: string, cursor?: string) => Promise<unknown>;
}>;
const readers = new WeakSet<object>();
const options = Object.freeze({ timeout: 5000, maxNetworkRetries: 0 });
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const validId = (prefix: string, value: unknown): value is string => typeof value === "string" && new RegExp(prefix === "cs" ? "^cs_(?:test_|live_)?[A-Za-z0-9]{1,200}$" : `^${prefix}_[A-Za-z0-9]{1,200}$`).test(value);
const subscriptionStates = new Set(["active", "canceled", "incomplete", "incomplete_expired", "past_due", "paused", "trialing", "unpaid"]);
const terminalSubscriptions = new Set(["canceled", "incomplete_expired"]);
const scheduleStates = new Set(["not_started", "active", "completed", "released", "canceled"]);

/** Capture only documented SDK GET methods from one existing server instance. */
export function createPocketCheckoutInventoryReader(stripe: Pick<Stripe, "accounts" | "customers" | "subscriptions" | "checkout" | "subscriptionSchedules">): PocketCheckoutInventoryReader {
  if (typeof window !== "undefined") return invalid();
  const account = stripe.accounts.retrieve.bind(stripe.accounts);
  const customer = stripe.customers.retrieve.bind(stripe.customers);
  const subscriptions = stripe.subscriptions.list.bind(stripe.subscriptions);
  const sessions = stripe.checkout.sessions.list.bind(stripe.checkout.sessions);
  const schedules = stripe.subscriptionSchedules.list.bind(stripe.subscriptionSchedules);
  const params = (customer: string, cursor?: string) => ({ customer, limit: 100, ...(cursor ? { starting_after: cursor } : {}) });
  const reader: PocketCheckoutInventoryReader = Object.freeze({
    account: async () => account({}, options),
    customer: async (id) => customer(id, {}, options),
    subscriptions: async (customer, cursor) => subscriptions({ ...params(customer, cursor), status: "all" }, options),
    sessions: async (customer, cursor) => sessions(params(customer, cursor), options),
    schedules: async (customer, cursor) => schedules(params(customer, cursor), options),
  });
  readers.add(reader);
  return reader;
}
function invalid(): never { throw new Error("POCKET_CHECKOUT_INVENTORY_CONTRACT"); }
function object(value: unknown): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  return value as RecordValue;
}
function scopeValid(scope: PocketCheckoutInventoryScope): void {
  if (!uuid.test(scope.intentId) || !uuid.test(scope.userId) || !validId("cus", scope.customerId) || !validId("price", scope.priceId) ||
      !validId("acct", scope.stripeAccountId) || typeof scope.livemode !== "boolean" || !/^[a-f0-9]{40}$/.test(scope.candidateSha) ||
      scope.offer !== "pocket_founding_650" || Object.keys(scope).sort().join() !== "candidateSha,customerId,intentId,livemode,offer,priceId,stripeAccountId,userId") return invalid();
}
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const o = object(value);
  return `{${Object.keys(o).sort().map(key => `${JSON.stringify(key)}:${canonical(o[key])}`).join(",")}}`;
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function metadataOwner(raw: unknown, userId: string, nullable = false): void {
  if (nullable && raw === null) return;
  const metadata = object(raw);
  if ("supabase_user_id" in metadata && metadata.supabase_user_id !== userId) return invalid();
}
function scopedItem(raw: unknown, scope: PocketCheckoutInventoryScope, kind: string, prefix: string): RecordValue {
  const o = object(raw);
  if (o.object !== kind || !validId(prefix, o.id) || o.customer !== scope.customerId || o.livemode !== scope.livemode ||
      !Number.isSafeInteger(o.created) || Number(o.created) <= 0) return invalid();
  // The pinned SDK permits null metadata on Sessions and schedules. Ownership
  // still comes from the trusted durable binding; supplied UUIDs must agree.
  metadataOwner(o.metadata, scope.userId, kind === "subscription_schedule" || kind === "checkout.session");
  return o;
}
function reference(value: unknown): string | null {
  if (value === null) return null;
  return validId("sub", value) ? value : invalid();
}
function subscriptionItem(raw: unknown, scope: PocketCheckoutInventoryScope): Item {
  const o = scopedItem(raw, scope, "subscription", "sub");
  if (typeof o.status !== "string" || !subscriptionStates.has(o.status)) return invalid();
  return { id: String(o.id), status: o.status, created: Number(o.created) };
}
function sessionItem(raw: unknown, scope: PocketCheckoutInventoryScope): Item {
  const o = scopedItem(raw, scope, "checkout.session", "cs");
  if (typeof o.status !== "string" || !["open", "complete", "expired"].includes(o.status) ||
      typeof o.mode !== "string" || !["subscription", "payment", "setup"].includes(o.mode) ||
      typeof o.payment_status !== "string" || !["paid", "unpaid", "no_payment_required"].includes(o.payment_status) ||
      (/^cs_(?:test|live)_/.test(String(o.id)) && !String(o.id).startsWith(scope.livemode ? "cs_live_" : "cs_test_")) ||
      (o.client_reference_id !== null && o.client_reference_id !== scope.userId)) return invalid();
  return { id: String(o.id), status: o.status, created: Number(o.created), mode: o.mode, paymentStatus: o.payment_status, subscription: reference(o.subscription) };
}
function scheduleItem(raw: unknown, scope: PocketCheckoutInventoryScope): Item {
  const o = scopedItem(raw, scope, "subscription_schedule", "sub_sched");
  if (typeof o.status !== "string" || !scheduleStates.has(o.status)) return invalid();
  const subscription = reference(o.subscription), released = reference(o.released_subscription);
  return { id: String(o.id), status: o.status, created: Number(o.created), subscription, releasedSubscription: released };
}

/** Caller must supply trusted server identity/binding; no request JSON/email lookup. */
export async function collectPocketCheckoutInventory(
  input: PocketCheckoutInventoryScope,
  dependencies: Readonly<{ reader: PocketCheckoutInventoryReader; authorise: () => Promise<PocketCheckoutInventoryScope | null>; now?: () => number }>,
  signal?: AbortSignal,
): Promise<PocketCheckoutInventoryResult> {
  const hold = (reason: "SERVER_ONLY" | "CANCELLED" | "AUTHORITY_OR_INVENTORY_UNAVAILABLE"): PocketCheckoutInventoryResult => Object.freeze({ kind: "HOLD", reason });
  try {
    if (typeof window !== "undefined") return hold("SERVER_ONLY");
    if (signal?.aborted) return hold("CANCELLED");
    const scope = Object.freeze({ ...input }); scopeValid(scope);
    if (!readers.has(dependencies.reader)) return invalid();
    const now = dependencies.now ?? Date.now;
    const started = now();
    const check = () => {
      const time = now();
      if (signal?.aborted || !Number.isSafeInteger(time) || time < started || time - started > 45_000) return invalid();
      return time;
    };
    check();
    const read = async (fn: () => Promise<unknown>): Promise<unknown> => {
      check();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let abort: (() => void) | undefined;
      const cancelled = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("INVENTORY_READ_TIMEOUT")), 5000);
        abort = () => reject(new Error("INVENTORY_READ_CANCELLED"));
        signal?.addEventListener("abort", abort, { once: true });
      });
      try {
        const result = await Promise.race([Promise.resolve().then(() => { check(); return fn(); }), cancelled]);
        check(); return result;
      } finally {
        clearTimeout(timer);
        if (abort) signal?.removeEventListener("abort", abort);
      }
    };
    const authorise = async () => {
      const authority = await read(dependencies.authorise);
      if (!authority || canonical(authority) !== canonical(scope)) return invalid();
    };
    await authorise();
    const account = object(await read(dependencies.reader.account));
    if (account.object !== "account" || account.id !== scope.stripeAccountId) return invalid();
    const customer = object(await read(() => dependencies.reader.customer(scope.customerId)));
    if (customer.object !== "customer" || customer.id !== scope.customerId || customer.deleted === true || customer.livemode !== scope.livemode) return invalid();
    metadataOwner(customer.metadata, scope.userId);
    const pages = async (kind: string, getter: (customer: string, cursor?: string) => Promise<unknown>, parse: (raw: unknown, scope: PocketCheckoutInventoryScope) => Item) => {
      const items: Item[] = [], ids = new Set<string>();
      let cursor: string | undefined;
      for (let page = 1; page <= 20; page++) {
        const raw = object(await read(() => getter(scope.customerId, cursor)));
        if (raw.object !== "list" || raw.url !== `/v1/${kind}` || typeof raw.has_more !== "boolean" ||
            !Array.isArray(raw.data) || raw.data.length > 100 || (raw.has_more && raw.data.length === 0)) return invalid();
        for (const entry of raw.data) {
          const item = parse(entry, scope);
          if (ids.has(item.id)) return invalid();
          ids.add(item.id); items.push(item);
        }
        if (!raw.has_more) return { items: items.sort((a, b) => a.id.localeCompare(b.id)), pages: page };
        cursor = items.at(-1)?.id;
      }
      return invalid();
    };
    const subscriptions = await pages("subscriptions", dependencies.reader.subscriptions, subscriptionItem);
    const sessions = await pages("checkout/sessions", dependencies.reader.sessions, sessionItem);
    const schedules = await pages("subscription_schedules", dependencies.reader.schedules, scheduleItem);
    await authorise();
    const terminal = new Set(subscriptions.items.filter(s => terminalSubscriptions.has(s.status)).map(s => s.id));
    const receipt: Receipt = freeze({
      schemaVersion: 1, authorisesCheckout: false, scope,
      inventoryStartedAt: new Date(started).toISOString(), inventoryCompletedAt: new Date(check()).toISOString(), allPagesVerified: true,
      subscriptions: subscriptions.items, checkoutSessions: sessions.items, subscriptionSchedules: schedules.items,
      pages: { subscriptions: subscriptions.pages, checkoutSessions: sessions.pages, subscriptionSchedules: schedules.pages },
      blockers: {
        openCheckout: sessions.items.filter(s => s.status === "open").length,
        activeOrPendingSubscription: subscriptions.items.filter(s => !terminalSubscriptions.has(s.status)).length,
        activeOrPendingSchedule: schedules.items.filter(s => ["active", "not_started"].includes(s.status)).length,
        checkoutReconciliation: sessions.items.filter(s => s.mode === "subscription" && s.status === "complete" && (!s.subscription || !terminal.has(s.subscription))).length,
        scheduleReconciliation: schedules.items.filter(s => !["active", "not_started"].includes(s.status) && (
          (s.status === "released" && !s.releasedSubscription) ||
          (s.subscription != null && !terminal.has(s.subscription)) ||
          (s.releasedSubscription != null && !terminal.has(s.releasedSubscription))
        )).length,
      },
    });
    const receiptText = canonical(receipt);
    return Object.freeze({ kind: "COMPLETE", receipt, receiptText, receiptSha256: createHash("sha256").update(receiptText).digest("hex") });
  } catch {
    return hold(signal?.aborted ? "CANCELLED" : "AUTHORITY_OR_INVENTORY_UNAVAILABLE");
  }
}
