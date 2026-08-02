import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "../../../../utils/supabase/admin";
import { configuredOffering, type CommercialPlan as Plan, type StripeOffering as Offering } from "../../../lib/stripe-commercial.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function subscriptionEnd(subscription: Pick<Stripe.Subscription, "items">) {
  const seconds = subscription.items.data.reduce(
    (latest, item) => Math.max(latest, item.current_period_end ?? 0),
    0,
  );
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

function foundingSubscriptionActive(status: string): boolean {
  return status === "active" || status === "trialing";
}

function logSupabaseFailure(stage: "membership_rpc" | "founding_rpc", error: { code?: string; message?: string }) {
  console.error("Stripe membership database call failed", {
    category: "membership_sync_failure",
    stage,
    code: error.code ?? "unknown",
    message: error.message ?? "unknown",
  });
}

async function customerEmail(stripe: Stripe, customer: string | Stripe.Customer | Stripe.DeletedCustomer | null) {
  if (!customer) return null;
  const record = typeof customer === "string" ? await stripe.customers.retrieve(customer) : customer;
  return "deleted" in record && record.deleted ? null : record.email?.toLowerCase() ?? null;
}

async function syncFounding100(
  subscription: Stripe.Subscription,
  plan: Plan | null,
  email: string | null,
  eventCreated: number,
) {
  const active = foundingSubscriptionActive(subscription.status);
  const { error } = await createAdminClient().rpc("sync_founding_100", {
    p_email: email ?? "",
    p_programme: active ? plan : null,
    p_stripe_subscription_id: subscription.id,
    p_subscription_active: active,
    p_event_created_at: eventCreated,
  });
  if (error) {
    logSupabaseFailure("founding_rpc", error);
    throw new Error("Founding 100 synchronization failed");
  }
}

async function saveSubscription(
  stripe: Stripe,
  subscription: Stripe.Subscription,
  eventCreated: number,
  fallbackEmail?: string | null,
) {
  const offerings = subscription.items.data
    .map((item) => ({ offering: configuredOffering(item.price.id), item }))
    .filter((value): value is { offering: Offering; item: Stripe.SubscriptionItem } => value.offering !== null);
  const matchedPlans = [...new Set(offerings.map(({ offering }) => offering.plan))];
  const plan = matchedPlans.length === 1 ? matchedPlans[0] : null;
  const billingIntervals = [...new Set(offerings.map(({ offering }) => offering.billingInterval))];
  const billingInterval = billingIntervals.length === 1 ? billingIntervals[0] : null;
  const unitAmount = offerings.length === 1 ? offerings[0].item.price.unit_amount : null;
  const email = fallbackEmail?.toLowerCase() ?? await customerEmail(stripe, subscription.customer);

  const admin = createAdminClient();
  if (!plan && !foundingSubscriptionActive(subscription.status)) {
    const { error } = await admin.rpc("sync_membership_from_stripe", {
      p_email: email ?? "",
      p_plan: null,
      p_status: subscription.status,
      p_stripe_customer_id: null,
      p_stripe_subscription_id: subscription.id,
      p_current_period_end: subscriptionEnd(subscription),
      p_billing_interval: null,
      p_unit_amount: null,
      p_event_created_at: eventCreated,
    });
    if (error) {
      logSupabaseFailure("membership_rpc", error);
      throw error;
    }
    await syncFounding100(subscription, null, email, eventCreated);
    return;
  }

  if (!email || !plan) {
    throw new Error("Cannot safely map Stripe subscription to membership");
  }

  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const { error } = await admin.rpc("sync_membership_from_stripe", {
    p_email: email,
    p_plan: plan,
    p_status: subscription.status,
    p_stripe_customer_id: customerId,
    p_stripe_subscription_id: subscription.id,
    p_current_period_end: subscriptionEnd(subscription),
    p_billing_interval: billingInterval,
    p_unit_amount: unitAmount,
    p_event_created_at: eventCreated,
  });

  if (error) {
    logSupabaseFailure("membership_rpc", error);
    throw error;
  }
  await syncFounding100(subscription, plan, email, eventCreated);
}

export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secretKey || !webhookSecret || !signature) {
    return NextResponse.json({ error: "Webhook is not configured" }, { status: 400 });
  }

  const stripe = new Stripe(secretKey);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (session.mode === "subscription" && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(String(session.subscription));
        await saveSubscription(stripe, subscription, event.created, session.customer_details?.email);
      }
    }

    if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
      await saveSubscription(stripe, event.data.object as Stripe.Subscription, event.created);
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      const subscriptionId = typeof invoice.parent?.subscription_details?.subscription === "string"
        ? invoice.parent.subscription_details.subscription
        : invoice.parent?.subscription_details?.subscription?.id;
      if (subscriptionId) {
        const { error } = await createAdminClient().rpc("sync_membership_from_stripe", {
          p_email: "",
          p_plan: null,
          p_status: "past_due",
          p_stripe_customer_id: null,
          p_stripe_subscription_id: subscriptionId,
          p_current_period_end: null,
          p_billing_interval: null,
          p_unit_amount: null,
          p_event_created_at: event.created,
        });
        if (error) {
          logSupabaseFailure("membership_rpc", error);
          throw error;
        }
        const { error: foundingError } = await createAdminClient().rpc("sync_founding_100", {
          p_email: "",
          p_programme: null,
          p_stripe_subscription_id: subscriptionId,
          p_subscription_active: false,
          p_event_created_at: event.created,
        });
        if (foundingError) {
          logSupabaseFailure("founding_rpc", foundingError);
          throw new Error("Founding 100 synchronization failed");
        }
      }
    }
  } catch {
    console.error("Stripe membership sync failed", { eventId: event.id, category: "membership_sync_failure" });
    return NextResponse.json({ error: "Membership sync failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
