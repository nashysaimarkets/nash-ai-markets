import { NextResponse } from "next/server";
import { createClient } from "../../../../utils/supabase/server.ts";
import { resolveMembershipTier } from "../../../terminal/lib/membership-entitlement.ts";
import { getConfiguredFmpCandles, type CandleTimeframe } from "../../../lib/providers/financial-modeling-prep-candles.ts";

const TIMEFRAMES = new Set<CandleTimeframe>(["1m", "5m", "15m", "1h", "4h", "1d"]);

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: membership, error } = await supabase.from("memberships").select("plan, status, current_period_end, billing_interval").ilike("email", user.email).in("plan", ["free", "pro", "elite"]).maybeSingle();
  const tier = resolveMembershipTier(membership, Boolean(error), Date.now());
  if (tier !== "pro" && tier !== "elite") return NextResponse.json({ error: "A Pro or Elite membership is required" }, { status: 403 });
  const requested = new URL(request.url).searchParams.get("timeframe") as CandleTimeframe | null;
  if (!requested || !TIMEFRAMES.has(requested)) return NextResponse.json({ error: "Unsupported candle interval" }, { status: 400 });
  return NextResponse.json(await getConfiguredFmpCandles(requested), { headers: { "Cache-Control": "private, no-store" } });
}
