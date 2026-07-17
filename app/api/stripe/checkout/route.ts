import { NextResponse } from "next/server";
import Stripe from "stripe";
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
    const session = await new Stripe(secretKey).checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cancelled`,
      allow_promotion_codes: true,
    });
    if (!session.url) throw new Error("checkout_url_unavailable");
    return NextResponse.redirect(session.url, 303);
  } catch {
    return NextResponse.redirect(new URL("/pricing?checkout=unavailable", origin), 303);
  }
}
