import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server.ts";
import { MemberEmptyCanvas } from "../components/MemberEmptyCanvas.tsx";
import { currentServerTimestamp } from "../dashboard/lib/daily-dashboard.ts";
import {
  createProgressiveAccess,
  membershipRedirect,
  resolveMembershipTier,
} from "../terminal/lib/membership-entitlement.ts";
import { loadPreviewClaims } from "../terminal/lib/preview-access.ts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Market Brief | NASH AI Markets",
  description: "A plain-English daily briefing from verified Bullseye engine evidence.",
  robots: { index: false, follow: false },
};

export default async function AIMarketBriefPage() {
  const now = currentServerTimestamp();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("plan, status, current_period_end")
    .ilike("email", user.email)
    .in("plan", ["free", "pro", "elite"])
    .maybeSingle();
  const tier = resolveMembershipTier(membership, Boolean(membershipError), now);
  if (tier === "temporarily_unavailable") redirect(membershipRedirect(tier));

  const previewState = await loadPreviewClaims(user.id);
  createProgressiveAccess(tier, previewState.claims, now);

  return <MemberEmptyCanvas active="brief" className="marketBriefPage" />;
}
