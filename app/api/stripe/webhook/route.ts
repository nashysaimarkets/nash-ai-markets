import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "../../../../utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Plan = "pro" | "elite";

export function configuredPlan(
  priceId: string | undefined,
  environment: Record<string, string | undefined> = process.env,
): Plan | null {
  if (!priceId) return null;
  if (priceId === environment.STRIPE_PRO_PRICE_ID) return "pro";
  if (priceId === environment.STRIPE_ELITE_PRICE_ID) return "elite";
  return null;
}

export function subscriptionEnd(subscription: Pick<Stripe.Subscription, "items">) {
  const seconds = subscription.items.data.reduce(
    (latest, item) => Math.max(latest, item.current_period_end ?? 0),
    0,
  );
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

async function customerEmail(stripe: Stripe, customer: string | Stripe.Customer | Stripe.DeletedCustomer | null) {
  if (!customer) return null;
  const record = typeof customer === "string" ? await stripe.customers.retrieve(customer) : customer;
  return "deleted" in record && record.deleted ? null : record.email?.toLowerCase() ?? null;
}

async function saveSubscription(stripe: Stripe, subscription: Stripe.Subscription, fallbackEmail?: string | null) {
  const matchedPlans = [...new Set(subscription.items.data
    .map((item) => configuredPlan(item.price.id))
    .filter((plan): plan is Plan => plan !== null))];
  const plan = matchedPlans.length === 1 ? matchedPlans[0] : null;
  const email = fallbackEmail?.toLowerCase() ?? await customerEmail(stripe, subscription.customer);

  if (!email || !plan) {
    throw new Error("Cannot safely map Stripe subscription to membership");
  }

  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const { error } = await createAdminClient().from("memberships").upsert({
    email,
    plan,
    status: subscription.status,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    current_period_end: subscriptionEnd(subscription),
    updated_at: new Date().toISOString(),
  }, { onConflict: "email" });

  if (error) throw error;
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
        await saveSubscription(stripe, subscription, session.customer_details?.email);
      }
    }

    if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
      await saveSubscription(stripe, event.data.object as Stripe.Subscription);
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      const subscriptionId = typeof invoice.parent?.subscription_details?.subscription === "string"
        ? invoice.parent.subscription_details.subscription
        : invoice.parent?.subscription_details?.subscription?.id;
      if (subscriptionId) {
        const { error } = await createAdminClient().from("memberships")
          .update({ status: "past_due", updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", subscriptionId);
        if (error) throw error;
      }
    }
  } catch {
    console.error("Stripe membership sync failed", { eventId: event.id, category: "membership_sync_failure" });
    return NextResponse.json({ error: "Membership sync failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
