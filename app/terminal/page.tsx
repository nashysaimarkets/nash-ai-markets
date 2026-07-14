import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server";

export const metadata: Metadata = {
  title: "Mission Control | NASH AI Markets",
  description: "The NASH AI Markets Mission Control pre-market intelligence workspace.",
};

type ScoreComponent = { label: string; score: number };
type MarketEvent = { time: string; name: string; risk: "HIGH" | "MED"; countdown: string };

const events: MarketEvent[] = [
  { time: "13:30 UK", name: "US inflation data", risk: "HIGH", countdown: "01:24:18" },
  { time: "14:30 UK", name: "US cash session opens", risk: "HIGH", countdown: "02:24:18" },
  { time: "19:00 UK", name: "Federal Reserve speaker", risk: "MED", countdown: "06:54:18" },
];

const weatherDetails = [
  ["PRESSURE", "Bullish and rising"],
  ["WIND", "Moderate buying"],
  ["VISIBILITY", "Good"],
  ["STORM RISK", "Elevated after 13:30"],
] as const;

const scoreComponents: ScoreComponent[] = [
  { label: "Trend", score: 88 },
  { label: "Momentum", score: 82 },
  { label: "Liquidity", score: 76 },
  { label: "Breadth", score: 79 },
  { label: "Volatility", score: 68 },
  { label: "Macro", score: 61 },
];

const keyLevels = [
  ["R2", "6,350", "Momentum breakout", "resistance"],
  ["R1", "6,332", "First resistance", "resistance"],
  ["PV", "6,310", "Daily pivot", "pivot"],
  ["S1", "6,288", "First support", "support"],
  ["S2", "6,264", "Overnight range low", "support"],
] as const;


  export default async function Terminal() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!user.email) {
    redirect("/?membership=required#membership");
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("plan, status, current_period_end")
    .ilike("email", user.email)
    .in("status", ["active", "trialing"])
    .in("plan", ["pro", "elite"])
    .maybeSingle();

  if (!membership) {
    redirect("/?membership=required#membership");
  }

  const portalUrl =
    process.env.STRIPE_CUSTOMER_PORTAL_LINK ||
    "mailto:hello@nashaimarkets.com?subject=Manage%20my%20subscription";
