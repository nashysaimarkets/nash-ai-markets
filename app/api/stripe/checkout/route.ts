import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "../../../../utils/supabase/server.ts";
import { createAdminClient } from "../../../../utils/supabase/admin.ts";
import { checkoutOffering, validFoundingProPrice, validPocketFoundingPrice } from "../../../lib/stripe-commercial.ts";
import { campaignAttribution, campaignQuery } from "../../../lib/marketing-attribution.ts";
import { createPocketCheckoutStripeDriver, ensurePocketCheckoutIntent } from "../../../lib/server/pocket-checkout-intent.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requestOrigin(request: Request): string | null {
  try {
    const url = new URL(request.url);
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) ? url.origin : null;
  } catch {
    return null;
  }
}

function cancelledCheckout() {
  return NextResponse.json({ error: "Checkout request cancelled" }, { status: 409 });
}

export async function POST(request: Request) {
  const origin = requestOrigin(request);
  const requestOriginHeader = request.headers.get("origin");
  if (!origin || requestOriginHeader !== origin) {
    return NextResponse.json({ error: "Checkout request rejected" }, { status: 403 });
  }
  if (request.signal.aborted) return cancelledCheckout();
  let form: FormData;
  try { form = await request.formData(); }
  catch {
    if (request.signal.aborted) return cancelledCheckout();
    return NextResponse.json({ error: "Invalid checkout form" }, { status: 400 });
  }
  if (request.signal.aborted) return cancelledCheckout();
  const attribution = campaignAttribution({
    utm_source: form.get("utm_source"),
    utm_medium: form.get("utm_medium"),
    utm_campaign: form.get("utm_campaign"),
  });
  const selected = checkoutOffering(typeof form.get("offering") === "string" ? String(form.get("offering")) : null);
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey || !selected) {
    console.error("[stripe-checkout] configuration unavailable", {
      secretKeyPresent: Boolean(secretKey),
      pocketPricePresent: Boolean(process.env.STRIPE_POCKET_FOUNDING_PRICE_ID?.trim()),
      offeringPresent: Boolean(selected),
    });
    const unavailablePath = form.get("offering") === "pocket_founding_month"
      ? "/pocket/founding?checkout=unavailable&" + campaignQuery(attribution)
      : "/pricing?checkout=unavailable";
    return NextResponse.redirect(new URL(unavailablePath, origin), 303);
  }
  try {
    const stripe = new Stripe(secretKey);
    if (selected.offering.foundingEligible) {
      const price = await stripe.prices.retrieve(selected.priceId);
      const valid = selected.offering.plan === "pocket" ? validPocketFoundingPrice(price) : validFoundingProPrice(price);
      // A monthly interval can still bill every 3 months. This check applies
      // to new Checkout only; historical renewal eligibility stays unchanged.
      if (!valid || price.recurring?.interval_count !== 1) {
        const unavailablePath = selected.offering.plan === "pocket"
          ? "/pocket/founding?checkout=unavailable&" + campaignQuery(attribution)
          : "/pricing?checkout=unavailable";
        return NextResponse.redirect(new URL(unavailablePath, origin), 303);
      }
    }
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const verifiedEmail = user?.email?.trim().toLowerCase() || undefined;
    if (selected.offering.plan === "pocket" && (!user?.id || !verifiedEmail || !user.email_confirmed_at || user.is_anonymous)) {
      return NextResponse.redirect(new URL("/pocket/login?next=/pocket/founding", origin), 303);
    }
    let pocketCustomer: string | null = null;
    if (selected.offering.plan === "pocket") {
      // Preserve the durable UUID/customer binding when a member resubscribes.
      // Never select a customer by email or trust a customer ID from the form.
      const { data, error } = await createAdminClient().rpc("get_pocket_web_customer", {
        p_user_id: user!.id, p_email: verifiedEmail!,
      });
      if (error || (data !== null && (typeof data !== "string" || !/^cus_[A-Za-z0-9]+$/.test(data)))) {
        throw new Error("Pocket customer identity lookup unavailable");
      }
      pocketCustomer = data;
      const { data: active, error: accessError } = await createAdminClient().rpc("has_pocket_web_subscription", { p_user_id: user!.id });
      if (accessError || typeof active !== "boolean") throw new Error("Pocket subscription lookup unavailable");
      if (active) return NextResponse.redirect(new URL("/pocket?subscription=active", origin), 303);
    }
    // Account/price lookups are asynchronous. An abandoned request must not
    // begin session creation after those lookups return. Already dispatched
    // Stripe operations cannot be undone by a later browser cancellation.
    if (request.signal.aborted) return cancelledCheckout();
    const parameters: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      line_items: [{ price: selected.priceId, quantity: 1 }],
      success_url: selected.offering.plan === "pocket" ? `${origin}/pocket/founding/welcome` : `${origin}/welcome`,
      cancel_url: selected.offering.plan === "pocket" ? `${origin}/pocket/founding?checkout=cancelled&${campaignQuery(attribution)}` : `${origin}/cancelled`,
      allow_promotion_codes: true,
      ...(pocketCustomer ? { customer: pocketCustomer } : { customer_email: verifiedEmail }),
      client_reference_id: user?.id,
      metadata: { ...(user?.id ? { supabase_user_id: user.id } : {}), offering: selected.offering.plan === "pocket" ? "pocket_founding_650" : selected.offering.plan, acquisition_source: attribution.source, acquisition_medium: attribution.medium, acquisition_campaign: attribution.campaign },
      subscription_data: selected.offering.plan === "pocket" ? { metadata: { offering: "pocket_founding_650", supabase_user_id: user!.id, acquisition_source: attribution.source, acquisition_medium: attribution.medium, acquisition_campaign: attribution.campaign } } : undefined,
    };
    if (selected.offering.plan === "pocket") {
      // UNINSTALLED proposal: an existing binding alone cannot clear legacy
      // sessions. Missing schema, scope or independent baseline remains HOLD.
      const candidateSha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? "";
      const stripeAccountId = process.env.POCKET_CHECKOUT_STRIPE_ACCOUNT_ID ?? "";
      const stripeMode = process.env.POCKET_CHECKOUT_STRIPE_MODE;
      if (!pocketCustomer || !/^[a-f0-9]{40}$/.test(candidateSha) || !/^acct_[A-Za-z0-9]+$/.test(stripeAccountId) ||
          (stripeMode !== "test" && stripeMode !== "live")) {
        throw new Error("Pocket checkout proposal authority unavailable");
      }
      const livemode = stripeMode === "live";
      const admin = createAdminClient();
      const result = await ensurePocketCheckoutIntent({
        scope: { userId: user!.id, email: verifiedEmail!, customerId: pocketCustomer, priceId: selected.priceId,
          candidateSha, stripeAccountId, livemode, offer: "pocket_founding_650" },
        parameters,
      }, {
        authorise: async () => {
          const { data: { user: current }, error } = await supabase.auth.getUser();
          if (error || !current?.id || !current.email || !current.email_confirmed_at || current.is_anonymous) return null;
          return { userId: current.id, email: current.email, emailConfirmedAt: current.email_confirmed_at,
            isAnonymous: false, stripeAccountId, livemode };
        },
        rpc: async (name, args) => {
          const { data, error } = await admin.rpc(name, args);
          return { data, error };
        },
        stripeDriver: createPocketCheckoutStripeDriver(stripe),
      }, request.signal);
      if (result.kind !== "READY") throw new Error("Pocket checkout intent remains on hold");
      return NextResponse.redirect(result.url, 303);
    }
    const session = await stripe.checkout.sessions.create(parameters);
    if (!session.url) throw new Error("checkout_url_unavailable");
    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    const stripeError = error as { type?: string; code?: string; message?: string };
    console.error("[stripe-checkout] session creation failed", {
      type: stripeError?.type || "unknown",
      code: stripeError?.code || "unknown",
      message: stripeError?.message || "unknown",
    });
    const unavailablePath = selected.offering.plan === "pocket"
      ? "/pocket/founding?checkout=unavailable&" + campaignQuery(attribution)
      : "/pricing?checkout=unavailable";
    return NextResponse.redirect(new URL(unavailablePath, origin), 303);
  }
}
