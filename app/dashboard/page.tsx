import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server.ts";
import { currentServerTimestamp } from "./lib/daily-dashboard.ts";
import { membershipRedirect, resolveMembershipTier } from "../terminal/lib/membership-entitlement.ts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Mission Control | NASH AI Markets",
  description: "Premium daily command centre for verified Bullseye market preparation.",
  robots: { index: false, follow: false },
};

/** Dashboard entry redirects into the Trading Desk workspace. */
export default async function MemberDashboard() {
  const now = currentServerTimestamp();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");
  const { data: onboarding, error: onboardingError } = await supabase
    .from("member_onboarding")
    .select("completed_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!onboardingError && !onboarding?.completed_at) redirect("/onboarding");

  const { data: membership, error: membershipError } = await supabase.from("memberships")
    .select("plan, status, current_period_end, billing_interval")
    .ilike("email", user.email)
    .in("plan", ["free", "pro", "elite"])
    .maybeSingle();
  const tier = resolveMembershipTier(membership, Boolean(membershipError), now);
  if (tier === "temporarily_unavailable") redirect(membershipRedirect(tier));

  redirect("/terminal");
}
