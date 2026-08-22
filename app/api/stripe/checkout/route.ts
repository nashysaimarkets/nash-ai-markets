import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "../../../../utils/supabase/server.ts";
import { checkoutOffering, validFoundingProPrice, validPocketFoundingPrice } from "../../../lib/stripe-commercial.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requestOrigin(request: Request): string | null {
  try {
    const origin = new URL(request.url).origin;
    return origin.startsWith("https://") || origin.startsWith("http://localhost") ? origin : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const origin = requestOrigin(request);
  const requestOriginHeader = request.headers.get("origin");
  if (!origin || requestOriginHeader !== origin) {
    return NextResponse.json({ error: "Checkout request rejected" }, { status: 403 });
  }
  const form = await request.formData();
  const selected = checkoutOffering(typeof form.get("offering") === "string" ? String(form.get("offering")) : null);
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey || !selected) {
    console.error("[stripe-checkout] configuration unavailable", {
      secretKeyPresent: Boolean(secretKey),
      pocketPricePresent: Boolean(process.env.STRIPE_POCKET_FOUNDING_PRICE_ID?.trim()),
      offeringPresent: Boolean(selected),
    });
    const unavailablePath = form.get("offering") === "pocket_founding_month"
      ? "/pocket/founding?checkout=unavailable"
      : "/pricing?checkout=unavailable";
    return NextResponse.redirect(new URL(unavailablePath, origin), 303);
  }
  try {
    const stripe = new Stripe(secretKey);
    if (selected.offering.foundingEligible) {
      const price = await stripe.prices.retrieve(selected.priceId);
      const valid = selected.offering.plan === "pocket" ? validPocketFoundingPrice(price) : validFoundingProPrice(price);
      if (!valid) {
        return NextResponse.redirect(new URL("/pricing?checkout=unavailable", origin), 303);
      }
    }
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const verifiedEmail = user?.email?.trim().toLowerCase() || undefined;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: selected.priceId, quantity: 1 }],
      success_url: selected.offering.plan === "pocket" ? `${origin}/pocket/founding/welcome` : `${origin}/welcome`,
      cancel_url: selected.offering.plan === "pocket" ? `${origin}/pocket/founding?checkout=cancelled` : `${origin}/cancelled`,
      allow_promotion_codes: true,
      customer_email: verifiedEmail,
      client_reference_id: user?.id,
      metadata: { ...(user?.id ? { supabase_user_id: user.id } : {}), offering: selected.offering.plan === "pocket" ? "pocket_founding_650" : selected.offering.plan },
      subscription_data: selected.offering.plan === "pocket" ? { metadata: { offering: "pocket_founding_650" } } : undefined,
    });
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
      ? "/pocket/founding?checkout=unavailable"
      : "/pricing?checkout=unavailable";
    return NextResponse.redirect(new URL(unavailablePath, origin), 303);
  }
}
