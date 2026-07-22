import { NextResponse } from "next/server";
import { createClient } from "../../../../utils/supabase/server.ts";
import { resolveMembershipTier } from "../../../terminal/lib/membership-entitlement.ts";
import { isCandleInstrument } from "../../../lib/providers/candle-instruments.ts";
import { getConfiguredFmpCandles, toCustomerCandleSeries, type CandleTimeframe } from "../../../lib/providers/financial-modeling-prep-candles.ts";

const TIMEFRAMES = new Set<CandleTimeframe>(["1m", "5m", "15m", "1h", "4h", "1d"]);

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: membership, error } = await supabase.from("memberships").select("plan, status, current_period_end, billing_interval").ilike("email", user.email).in("plan", ["free", "pro", "elite"]).maybeSingle();
  const tier = resolveMembershipTier(membership, Boolean(error), Date.now());
  if (tier !== "pro" && tier !== "elite") return NextResponse.json({ error: "A Pro or Elite membership is required" }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const requested = params.get("timeframe") as CandleTimeframe | null;
  if (!requested || !TIMEFRAMES.has(requested)) return NextResponse.json({ error: "Unsupported candle interval" }, { status: 400 });
  const instrumentParam = params.get("instrument") ?? "ES";
  if (!isCandleInstrument(instrumentParam)) {
    return NextResponse.json({ error: "Unsupported candle instrument" }, { status: 400 });
  }
  const series = await getConfiguredFmpCandles(requested, Date.now(), instrumentParam);
  return NextResponse.json(toCustomerCandleSeries(series), { headers: { "Cache-Control": "private, no-store" } });
}
