import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "../../../../utils/supabase/server.ts";
import { membershipEmailKey } from "../../../lib/server/membership-email.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeOrigin(request: Request): string | null {
  try {
    const origin = new URL(request.url).origin;
    return origin.startsWith("https://") || origin.startsWith("http://localhost") ? origin : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const origin = safeOrigin(request);
  if (!origin) return NextResponse.json({ error: "Portal request rejected" }, { status: 403 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.redirect(new URL("/login", origin), 303);

  const { data: membership, error } = await supabase
    .from("memberships")
    .select("stripe_customer_id")
    .eq("email", membershipEmailKey(user.email))
    .maybeSingle();
  const customerId = membership?.stripe_customer_id;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (error || !customerId || !secretKey) {
    return NextResponse.redirect(new URL("/profile?billing=unavailable", origin), 303);
  }

  try {
    const session = await new Stripe(secretKey).billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/profile`,
    });
    return NextResponse.redirect(session.url, 303);
  } catch {
    return NextResponse.redirect(new URL("/profile?billing=unavailable", origin), 303);
  }
}
