import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.110.2";

const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const stripe = new Stripe(stripeKey);
const cryptoProvider = Stripe.createSubtleCryptoProvider();

type Plan = "pro" | "elite";
type Offering = { plan: Plan; billingInterval: "month" | "year"; foundingEligible: boolean };

function admin() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) throw new Error("Supabase server credentials are not configured");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function configuredOffering(priceId: string | undefined): Offering | null {
  if (!priceId) return null;
  const mappings: Array<[string, Offering]> = [
    [Deno.env.get("STRIPE_FOUNDING_PRO_PRICE_ID") ?? "", { plan: "pro", billingInterval: "month", foundingEligible: true }],
    [Deno.env.get("STRIPE_PRO_PRICE_ID") ?? "", { plan: "pro", billingInterval: "month", foundingEligible: false }],
    [Deno.env.get("STRIPE_PRO_ANNUAL_PRICE_ID") ?? "", { plan: "pro", billingInterval: "year", foundingEligible: false }],
    [Deno.env.get("STRIPE_ELITE_PRICE_ID") ?? "", { plan: "elite", billingInterval: "month", foundingEligible: false }],
    [Deno.env.get("STRIPE_ELITE_ANNUAL_PRICE_ID") ?? "", { plan: "elite", billingInterval: "year", foundingEligible: false }],
  ];
  const matches = mappings.filter(([value]) => value && value === priceId).map(([, offering]) => offering);
  return matches.length === 1 ? matches[0] : null;
}

function subscriptionEnd(subscription: Stripe.Subscription) {
  const seconds = subscription.items.data.reduce((latest, item) => Math.max(latest, item.current_period_end ?? 0), 0);
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

const active = (status: string) => status === "active" || status === "trialing";

async function customerEmail(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null) {
  if (!customer) return null;
  const record = typeof customer === "string" ? await stripe.customers.retrieve(customer) : customer;
  return "deleted" in record && record.deleted ? null : record.email?.toLowerCase() ?? null;
}

async function syncCancellation(subscription: Stripe.Subscription, created: number) {
  const { error } = await admin().rpc("sync_membership_cancellation_from_stripe", {
    p_stripe_subscription_id: subscription.id,
    p_cancel_at_period_end: subscription.cancel_at_period_end,
    p_event_created_at: created,
  });
  if (error) throw error;
}

async function syncFounding(subscription: Stripe.Subscription, plan: Plan | null, eligible: boolean, email: string | null, created: number) {
  const isActive = active(subscription.status);
  const db = admin();
  if (isActive && !eligible) {
    const { data: existing, error: lookupError } = await db.from("founding_100_members").select("programme").eq("stripe_subscription_id", subscription.id).eq("status", "active").maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing || existing.programme === plan) return;
  }
  const award = isActive && eligible;
  const { error } = await db.rpc("sync_founding_100", {
    p_email: email ?? "",
    p_programme: award ? plan : null,
    p_stripe_subscription_id: subscription.id,
    p_subscription_active: award,
    p_event_created_at: created,
  });
  if (error) throw error;
}

async function saveSubscription(subscription: Stripe.Subscription, created: number, fallbackEmail?: string | null) {
  const offerings = subscription.items.data.map((item) => ({ offering: configuredOffering(item.price.id), item })).filter((value): value is { offering: Offering; item: Stripe.SubscriptionItem } => value.offering !== null);
  const plans = [...new Set(offerings.map(({ offering }) => offering.plan))];
  const intervals = [...new Set(offerings.map(({ offering }) => offering.billingInterval))];
  const plan = plans.length === 1 ? plans[0] : null;
  const interval = intervals.length === 1 ? intervals[0] : null;
  const amount = offerings.length === 1 ? offerings[0].item.price.unit_amount : null;
  const email = fallbackEmail?.toLowerCase() ?? await customerEmail(subscription.customer);
  const db = admin();

  if (!plan && !active(subscription.status)) {
    const { error } = await db.rpc("sync_membership_from_stripe", {
      p_email: email ?? "", p_plan: null, p_status: subscription.status,
      p_stripe_customer_id: null, p_stripe_subscription_id: subscription.id,
      p_current_period_end: subscriptionEnd(subscription), p_billing_interval: null,
      p_unit_amount: null, p_event_created_at: created,
    });
    if (error) throw error;
    await syncCancellation(subscription, created);
    await syncFounding(subscription, null, false, email, created);
    return;
  }
  if (!email || !plan) throw new Error("Cannot safely map Stripe subscription to membership");

  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const { error } = await db.rpc("sync_membership_from_stripe", {
    p_email: email, p_plan: plan, p_status: subscription.status,
    p_stripe_customer_id: customerId, p_stripe_subscription_id: subscription.id,
    p_current_period_end: subscriptionEnd(subscription), p_billing_interval: interval,
    p_unit_amount: amount, p_event_created_at: created,
  });
  if (error) throw error;
  await syncCancellation(subscription, created);

  const founding = offerings.length === 1 && offerings[0].offering.foundingEligible
    && offerings[0].item.price.active && offerings[0].item.price.currency.toLowerCase() === "gbp"
    && offerings[0].item.price.type === "recurring" && offerings[0].item.price.unit_amount === 1200
    && offerings[0].item.price.recurring?.interval === "month";
  await syncFounding(subscription, founding ? plan : null, founding, email, created);
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return new Response("Not found", { status: 404 });
  const signature = request.headers.get("stripe-signature");
  if (!stripeKey || !webhookSecret || !signature) return Response.json({ error: "Webhook is not configured" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await request.text(), signature, webhookSecret, undefined, cryptoProvider);
  } catch {
    return Response.json({ error: "Invalid Stripe signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (session.mode === "subscription" && session.subscription) {
        await saveSubscription(await stripe.subscriptions.retrieve(String(session.subscription)), event.created, session.customer_details?.email);
      }
    } else if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
      await saveSubscription(event.data.object as Stripe.Subscription, event.created);
    } else if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const details = invoice.parent?.subscription_details?.subscription;
      const subscriptionId = typeof details === "string" ? details : details?.id;
      if (subscriptionId) {
        const db = admin();
        const { error } = await db.rpc("sync_membership_from_stripe", {
          p_email: "", p_plan: null, p_status: "past_due", p_stripe_customer_id: null,
          p_stripe_subscription_id: subscriptionId, p_current_period_end: null,
          p_billing_interval: null, p_unit_amount: null, p_event_created_at: event.created,
        });
        if (error) throw error;
        const { error: foundingError } = await db.rpc("sync_founding_100", {
          p_email: "", p_programme: null, p_stripe_subscription_id: subscriptionId,
          p_subscription_active: false, p_event_created_at: event.created,
        });
        if (foundingError) throw foundingError;
      }
    }
  } catch {
    console.error("Stripe membership sync failed", { eventId: event.id, category: "membership_sync_failure" });
    return Response.json({ error: "Membership sync failed" }, { status: 500 });
  }
  return Response.json({ received: true });
});
