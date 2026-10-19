/** Proposed bound-customer protocol only; no route, issuer or migration is activated. */
import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { validPocketFoundingPrice } from "../stripe-commercial.ts";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type ObjectJson = { [key: string]: Json };
export type PocketCheckoutScope = Readonly<{
  userId: string; email: string; customerId: string; priceId: string;
  candidateSha: string; stripeAccountId: string; livemode: boolean;
  offer: "pocket_founding_650";
}>;
export type PocketCheckoutAuthority = Readonly<{
  userId: string; email: string; emailConfirmedAt: string | null; isAnonymous: boolean;
  stripeAccountId: string; livemode: boolean;
}>;
export type PocketCheckoutIntentDependencies = Readonly<{
  /** Server getUser + independently bound SDK account/mode, never request JSON. */
  authorise: () => Promise<PocketCheckoutAuthority | null>;
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  stripeDriver: PocketCheckoutStripeDriver;
  now?: () => number;
}>;
type DispatchOptions = Readonly<{
    idempotencyKey: string; timeout: 10_000; maxNetworkRetries: 0;
    expectedStripeAccountId: string; expectedLivemode: boolean;
}>;
export type PocketCheckoutStripeDriver = Readonly<{
  verifyScope: (priceId: string) => Promise<Readonly<{ stripeAccountId: string; livemode: boolean }>>;
  createSession: (parameters: Readonly<ObjectJson>, options: DispatchOptions) => Promise<unknown>;
}>;
export type PocketCheckoutIntentResult = Readonly<{
  kind: "READY"; intentId: string; url: string;
}> | Readonly<{
  kind: "HOLD"; reason: string; intentId?: string;
}>;

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const id = (prefix: string, value: unknown): value is string => typeof value === "string" && new RegExp(prefix === "cs" ? "^cs_(test_|live_)?[A-Za-z0-9]{1,200}$" : `^${prefix}_[A-Za-z0-9]{1,200}$`).test(value);
const drivers = new WeakSet<object>();

/** Bind GET account + GET price + POST creation to the same server SDK instance. */
export function createPocketCheckoutStripeDriver(stripe: Pick<Stripe, "accounts" | "prices" | "checkout">): PocketCheckoutStripeDriver {
  if (typeof window !== "undefined") return fail();
  const account = stripe.accounts.retrieve.bind(stripe.accounts);
  const price = stripe.prices.retrieve.bind(stripe.prices);
  const create = stripe.checkout.sessions.create.bind(stripe.checkout.sessions);
  let proof: { account: string; mode: boolean; price: string; at: number } | null = null;
  const driver: PocketCheckoutStripeDriver = Object.freeze({
    async verifyScope(priceId: string) {
      if (!id("price", priceId)) return fail();
      const readOptions = { timeout: 10_000, maxNetworkRetries: 0 };
      const [providerAccount, offeredPrice] = await Promise.all([account({}, readOptions), price(priceId, {}, readOptions)]);
      if (!id("acct", providerAccount.id) || offeredPrice.id !== priceId || typeof offeredPrice.livemode !== "boolean" ||
          !validPocketFoundingPrice(offeredPrice) || offeredPrice.recurring?.interval_count !== 1) return fail();
      proof = { account: providerAccount.id, mode: offeredPrice.livemode, price: priceId, at: Date.now() };
      return Object.freeze({ stripeAccountId: proof.account, livemode: proof.mode });
    },
    async createSession(parameters: Readonly<ObjectJson>, options: DispatchOptions) {
      const line = Array.isArray(parameters.line_items) ? object(parameters.line_items[0]) : fail();
      if (!proof || proof.price !== line.price || proof.account !== options.expectedStripeAccountId || proof.mode !== options.expectedLivemode ||
          Date.now() < proof.at || Date.now() - proof.at > 30_000 || options.maxNetworkRetries !== 0 || options.timeout !== 10_000) return fail();
      // SDK retries are disabled even if its instance default is more permissive.
      return create(parameters as unknown as Stripe.Checkout.SessionCreateParams, {
        idempotencyKey: options.idempotencyKey, maxNetworkRetries: 0, timeout: 10_000,
      });
    },
  });
  drivers.add(driver);
  return driver;
}
function fail(): never { throw new Error("POCKET_CHECKOUT_INTENT_CONTRACT"); }
function object(raw: unknown): ObjectJson {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail();
  return raw as ObjectJson;
}
function canonical(value: Json): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}
function clone(value: unknown): Json {
  // Reject undefined, NaN, exotic objects and silent JSON coercion before async work.
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(clone);
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return fail();
  const result: ObjectJson = {};
  for (const [key, entry] of Object.entries(value)) {
    if (["__proto__", "constructor", "prototype"].includes(key)) return fail();
    result[key] = clone(entry);
  }
  return result;
}
function freeze<T extends Json>(value: T): Readonly<T> {
  if (value && typeof value === "object") { for (const entry of Object.values(value)) freeze(entry); Object.freeze(value); }
  return value;
}
function checkoutUrl(raw: unknown): string {
  if (typeof raw !== "string" || raw.length > 8192) return fail();
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com" || url.port || url.username || url.password || !url.pathname.startsWith("/c/pay/")) return fail();
  return raw;
}
function scopeValid(scope: PocketCheckoutScope): void {
  if (!uuid.test(scope.userId) || !id("cus", scope.customerId) || !id("price", scope.priceId) ||
      !id("acct", scope.stripeAccountId) || !/^[a-f0-9]{40}$/.test(scope.candidateSha) ||
      typeof scope.livemode !== "boolean" || scope.offer !== "pocket_founding_650" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(scope.email) || scope.email !== scope.email.trim().toLowerCase()) return fail();
}
function seedValid(parameters: ObjectJson, scope: PocketCheckoutScope): void {
  const keys = ["mode", "line_items", "success_url", "cancel_url", "allow_promotion_codes", "customer", "client_reference_id", "metadata", "subscription_data"];
  if (Object.keys(parameters).sort().join() !== keys.sort().join() || parameters.mode !== "subscription" ||
      parameters.customer !== scope.customerId || parameters.client_reference_id !== scope.userId || parameters.allow_promotion_codes !== true ||
      !Array.isArray(parameters.line_items) || canonical(parameters.line_items) !== canonical([{ price: scope.priceId, quantity: 1 }])) return fail();
  const meta = object(parameters.metadata);
  const subscription = object(parameters.subscription_data);
  if (Object.keys(subscription).join() !== "metadata" || canonical(meta) !== canonical(object(subscription.metadata)) || meta.supabase_user_id !== scope.userId || meta.offering !== scope.offer) return fail();
  const allowed = ["supabase_user_id", "offering", "acquisition_source", "acquisition_medium", "acquisition_campaign"];
  if (Object.keys(meta).some((key) => !allowed.includes(key)) || Object.values(meta).some((value) => typeof value !== "string" || value.length > 500)) return fail();
  for (const key of ["success_url", "cancel_url"]) {
    if (typeof parameters[key] !== "string" || parameters[key].length > 2048) return fail();
    const url = new URL(parameters[key]);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return fail();
  }
  if (new URL(String(parameters.success_url)).origin !== new URL(String(parameters.cancel_url)).origin) return fail();
}
function packet(raw: unknown, scope: PocketCheckoutScope, seed: ObjectJson) {
  const value = object(raw);
  if (typeof value.intent_id !== "string" || !uuid.test(value.intent_id) || value.user_id !== scope.userId ||
      value.customer_id !== scope.customerId || value.price_id !== scope.priceId || value.candidate_sha !== scope.candidateSha ||
      value.stripe_account_id !== scope.stripeAccountId || value.livemode !== scope.livemode || value.offer !== scope.offer ||
      value.idempotency_key !== `pocket-checkout:${value.intent_id}` || typeof value.parameters_text !== "string" || value.parameters_text.length > 16_384 ||
      value.parameters_sha256 !== createHash("sha256").update(value.parameters_text).digest("hex")) return fail();
  const parameters = object(JSON.parse(value.parameters_text));
  const expiresAt = parameters.expires_at;
  if (typeof expiresAt !== "number" || !Number.isSafeInteger(expiresAt)) return fail();
  const expected = clone(seed) as ObjectJson;
  expected.expires_at = expiresAt;
  const additions = { pocket_checkout_intent_id: value.intent_id, pocket_candidate_sha: scope.candidateSha };
  expected.metadata = { ...object(expected.metadata), ...additions };
  expected.subscription_data = { metadata: { ...object(object(expected.subscription_data).metadata), ...additions } };
  if (canonical(expected) !== canonical(parameters)) return fail();
  return { value, parameters: freeze(parameters), expiresAt, intentId: value.intent_id, key: String(value.idempotency_key), hash: String(value.parameters_sha256) };
}
function session(raw: unknown, p: ReturnType<typeof packet>, scope: PocketCheckoutScope): ObjectJson {
  const value = object(raw);
  if (!id("cs", value.id) || value.mode !== "subscription" || value.status !== "open" || value.customer !== scope.customerId ||
      value.client_reference_id !== scope.userId || value.livemode !== scope.livemode || value.expires_at !== p.expiresAt ||
      object(value.metadata).pocket_checkout_intent_id !== p.intentId || object(value.metadata).supabase_user_id !== scope.userId ||
      object(value.metadata).pocket_candidate_sha !== scope.candidateSha || object(value.metadata).offering !== scope.offer ||
      canonical(object(value.metadata)) !== canonical(object(p.parameters.metadata))) return fail();
  return { id: value.id, customer: scope.customerId, mode: "subscription", status: "open", livemode: scope.livemode,
    client_reference_id: scope.userId, expires_at: p.expiresAt, url: checkoutUrl(value.url), metadata: clone(value.metadata) };
}

/** No automatic retries or reconciliation: a claimed/unknown dispatch remains HOLD. */
export async function ensurePocketCheckoutIntent(
  input: Readonly<{ scope: PocketCheckoutScope; parameters: unknown }>,
  dependencies: PocketCheckoutIntentDependencies,
  signal?: AbortSignal,
): Promise<PocketCheckoutIntentResult> {
  const hold = (reason: string, intentId?: string): PocketCheckoutIntentResult => Object.freeze({ kind: "HOLD", reason, ...(intentId ? { intentId } : {}) });
  let intentId: string | undefined;
  let dispatched = false;
  try {
    if (typeof window !== "undefined") return hold("SERVER_ONLY");
    const scope = Object.freeze({ ...input.scope });
    const seed = object(clone(input.parameters));
    scopeValid(scope); seedValid(seed, scope); freeze(seed);
    const now = dependencies.now ?? Date.now;
    if (!drivers.has(dependencies.stripeDriver)) return hold("PROVIDER_DRIVER_UNAVAILABLE");
    const authorised = async () => {
      const current = await dependencies.authorise();
      if (!current || current.userId !== scope.userId || current.email.trim().toLowerCase() !== scope.email ||
          !current.emailConfirmedAt || !Number.isFinite(Date.parse(current.emailConfirmedAt)) || current.isAnonymous !== false ||
          current.stripeAccountId !== scope.stripeAccountId || current.livemode !== scope.livemode) return fail();
    };
    if (signal?.aborted) return hold("CANCELLED");
    await authorised();
    const provider = await dependencies.stripeDriver.verifyScope(scope.priceId);
    if (provider.stripeAccountId !== scope.stripeAccountId || provider.livemode !== scope.livemode) return hold("PROVIDER_SCOPE_MISMATCH");
    if (signal?.aborted) return hold("CANCELLED");
    const prepared = await dependencies.rpc("prepare_pocket_checkout_intent", {
      p_user_id: scope.userId, p_email: scope.email, p_customer_id: scope.customerId, p_price_id: scope.priceId,
      p_candidate_sha: scope.candidateSha, p_stripe_account_id: scope.stripeAccountId,
      p_livemode: scope.livemode, p_offer: scope.offer, p_seed: seed,
    });
    if (prepared.error) return hold("PREPARATION_UNAVAILABLE");
    const preparedValue = object(prepared.data);
    if (preparedValue.kind === "HOLD") {
      const reasons = ["BASELINE_REQUIRED", "DISPATCH_UNRESOLVED", "IMMUTABLE_SCOPE_CONFLICT", "VERIFIED_BOUND_IDENTITY_REQUIRED", "ACTIVE_SUBSCRIPTION", "SESSION_RECONCILIATION_REQUIRED"];
      return hold(typeof preparedValue.reason === "string" && reasons.includes(preparedValue.reason) ? preparedValue.reason : "PREPARATION_UNAVAILABLE",
        typeof preparedValue.intent_id === "string" && uuid.test(preparedValue.intent_id) ? preparedValue.intent_id : undefined);
    }
    const p = packet(preparedValue, scope, seed); intentId = p.intentId;
    if (preparedValue.kind === "READY") {
      const known = session(preparedValue.session, p, scope);
      if (p.expiresAt * 1000 <= now()) return hold("SESSION_RECONCILIATION_REQUIRED", intentId);
      await authorised();
      return signal?.aborted ? hold("CANCELLED", intentId) : Object.freeze({ kind: "READY", intentId, url: String(known.url) });
    }
    if (preparedValue.kind !== "PREPARED" || p.expiresAt * 1000 < now() + 1_800_000 || p.expiresAt * 1000 > now() + 86_400_000) return hold("PARAMETERS_EXPIRED_OR_UNEXPECTED", intentId);
    if (signal?.aborted) return hold("CANCELLED", intentId);
    await authorised();
    if (signal?.aborted) return hold("CANCELLED", intentId);
    const claimed = await dependencies.rpc("claim_pocket_checkout_intent", {
      p_user_id: scope.userId, p_intent_id: intentId, p_parameters_sha256: p.hash,
      p_customer_id: scope.customerId, p_candidate_sha: scope.candidateSha,
      p_stripe_account_id: scope.stripeAccountId, p_livemode: scope.livemode,
    });
    if (claimed.error) return hold("CLAIM_OUTCOME_UNKNOWN", intentId);
    const claimValue = object(claimed.data);
    if (claimValue.kind !== "DISPATCH") return hold("DISPATCH_UNRESOLVED", intentId);
    const claimedPacket = packet(claimValue, scope, seed);
    if (claimedPacket.intentId !== intentId || claimedPacket.hash !== p.hash || claimValue.parameters_text !== p.value.parameters_text ||
        typeof claimValue.dispatch_token !== "string" || !uuid.test(claimValue.dispatch_token) || claimValue.dispatch_count !== 1) return hold("CLAIM_CONTRACT_INVALID", intentId);
    if (signal?.aborted) return hold("CLAIMED_BUT_CANCELLED", intentId);
    // This is the sole application dispatch. Never re-enter it after any failure.
    dispatched = true;
    const raw = await dependencies.stripeDriver.createSession(claimedPacket.parameters, Object.freeze({
      idempotencyKey: p.key, timeout: 10_000, maxNetworkRetries: 0,
      expectedStripeAccountId: scope.stripeAccountId, expectedLivemode: scope.livemode,
    }));
    const known = session(raw, claimedPacket, scope);
    const saved = await dependencies.rpc("record_pocket_checkout_session", {
      p_user_id: scope.userId, p_intent_id: intentId, p_dispatch_token: claimValue.dispatch_token,
      p_parameters_sha256: p.hash, p_session: known,
    });
    if (saved.error) return hold("SESSION_PERSISTENCE_UNKNOWN", intentId);
    const savedValue = object(saved.data);
    if (savedValue.kind !== "READY") return hold("SESSION_RECONCILIATION_REQUIRED", intentId);
    const savedPacket = packet(savedValue, scope, seed);
    const savedSession = session(savedValue.session, savedPacket, scope);
    if (savedPacket.intentId !== intentId || savedPacket.hash !== p.hash || savedSession.id !== known.id || savedSession.url !== known.url || p.expiresAt * 1000 <= now()) return hold("SESSION_PERSISTENCE_UNKNOWN", intentId);
    await authorised();
    return signal?.aborted ? hold("CANCELLED_AFTER_DISPATCH", intentId) : Object.freeze({ kind: "READY", intentId, url: String(savedSession.url) });
  } catch {
    return hold(dispatched ? "DISPATCH_OUTCOME_UNKNOWN" : "AUTHORITY_OR_CONTRACT_UNAVAILABLE", intentId);
  }
}
