import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "../../../../utils/supabase/server.ts";
import { checkoutPriceId } from "../../../lib/stripe-commercial.ts";

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
  const priceId = checkoutPriceId(typeof form.get("offering") === "string" ? String(form.get("offering")) : null);
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey || !priceId) {
    return NextResponse.redirect(new URL("/pricing?checkout=unavailable", origin), 303);
  }
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const verifiedEmail = user?.email?.trim().toLowerCase() || undefined;
    const session = await new Stripe(secretKey).checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/welcome`,
      cancel_url: `${origin}/cancelled`,
      allow_promotion_codes: true,
      customer_email: verifiedEmail,
      client_reference_id: user?.id,
      metadata: user?.id ? { supabase_user_id: user.id } : undefined,
    });
    if (!session.url) throw new Error("checkout_url_unavailable");
    return NextResponse.redirect(session.url, 303);
  } catch {
    return NextResponse.redirect(new URL("/pricing?checkout=unavailable", origin), 303);
  }
}
