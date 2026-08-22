import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "../../../../utils/supabase/admin";
import { buildPocketFoundingWelcomeEmail, buildPocketSubscriptionAlertEmail } from "../../../lib/launch-email.ts";
import { dispatchLaunchEmail } from "../../../lib/server/resend-launch-email.ts";
import { configuredOffering, validFoundingProPrice, validPocketFoundingPrice, type CommercialPlan as Plan, type StripeOffering as Offering } from "../../../lib/stripe-commercial.ts";

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

async function syncCancellationSchedule(subscription: Stripe.Subscription, eventCreated: number) {
  const { error } = await createAdminClient().rpc("sync_membership_cancellation_from_stripe", {
    p_stripe_subscription_id: subscription.id,
    p_cancel_at_period_end: subscription.cancel_at_period_end,
    p_event_created_at: eventCreated,
  });
  if (error) {
    logSupabaseFailure("membership_rpc", error);
    throw error;
  }
}

async function syncFounding100(
  subscription: Stripe.Subscription,
  plan: Plan | null,
  foundingEligible: boolean,
  email: string | null,
  eventCreated: number,
) {
  const subscriptionActive = foundingSubscriptionActive(subscription.status);
  const admin = createAdminClient();
  if (subscriptionActive && !foundingEligible) {
    const { data: existing, error: lookupError } = await admin
      .from("founding_100_members")
      .select("programme")
      .eq("stripe_subscription_id", subscription.id)
      .eq("status", "active")
      .maybeSingle();
    if (lookupError) {
      logSupabaseFailure("founding_rpc", lookupError);
      throw new Error("Founding 100 eligibility lookup failed");
    }
    if (!existing || existing.programme === plan) return;
  }
  const active = subscriptionActive && foundingEligible;
  const { error } = await admin.rpc("sync_founding_100", {
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

  if (plan === "pocket") {
    if (!email || offerings.length !== 1 || !validPocketFoundingPrice(offerings[0].item.price)) throw new Error("Cannot safely map Pocket founding subscription");
    const { error } = await createAdminClient().rpc("sync_pocket_founding_650", {
      p_email: email,
      p_stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
      p_stripe_subscription_id: subscription.id,
      p_subscription_active: foundingSubscriptionActive(subscription.status),
      p_current_period_end: subscriptionEnd(subscription),
      p_event_created_at: eventCreated,
    });
    if (error) { logSupabaseFailure("founding_rpc", error); throw new Error("Pocket Founding 650 synchronization failed"); }
    return "pocket" as const;
  }

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
    await syncCancellationSchedule(subscription, eventCreated);
    await syncFounding100(subscription, null, false, email, eventCreated);
    return null;
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
  await syncCancellationSchedule(subscription, eventCreated);
  const foundingEligible = offerings.length === 1
    && offerings[0].offering.foundingEligible
    && validFoundingProPrice(offerings[0].item.price);
  await syncFounding100(subscription, foundingEligible ? plan : null, foundingEligible, email, eventCreated);
  return plan;
}

async function sendPocketWelcome(email: string, sessionId: string, requestUrl: string) {
  const pocketUrl = new URL("/pocket", requestUrl).toString();
  const result = await dispatchLaunchEmail({
    to: email,
    email: buildPocketFoundingWelcomeEmail(pocketUrl),
    idempotencyKey: `pocket-welcome:${sessionId}`,
  });
  if (result.status === "failed" || result.status === "rejected") {
    console.error("Pocket welcome email was not delivered", {
      category: "pocket_welcome_email_failure",
      status: result.status,
      reason: result.reason,
    });
  }
}

async function sendPocketOwnerAlert(customerEmail: string, sessionId: string, requestUrl: string) {
  const configuredOwner = process.env.BULLSEYE_ADMIN_EMAILS
    ?.split(",")
    .map((value) => value.trim().toLowerCase())
    .find(Boolean);
  const ownerEmail = configuredOwner || "hello@nashaimarkets.com";
  const dashboardUrl = new URL("/admin/commercial", requestUrl).toString();
  const result = await dispatchLaunchEmail({
    to: ownerEmail,
    email: buildPocketSubscriptionAlertEmail(customerEmail, dashboardUrl),
    idempotencyKey: `pocket-owner-alert:${sessionId}`,
  });
  if (result.status !== "sent") {
    console.error("Pocket owner subscription alert was not delivered", {
      category: "pocket_owner_alert_failure",
      status: result.status,
      reason: "reason" in result ? result.reason : "unknown",
    });
  }
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
        const customerAddress = session.customer_details?.email?.toLowerCase() ?? await customerEmail(stripe, subscription.customer);
        const savedPlan = await saveSubscription(stripe, subscription, event.created, customerAddress);
        if (savedPlan === "pocket" && customerAddress) {
          // Welcome delivery is deliberately non-blocking: membership access is the critical path.
          await Promise.allSettled([
            sendPocketWelcome(customerAddress, session.id, request.url),
            sendPocketOwnerAlert(customerAddress, session.id, request.url),
          ]);
        }
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
