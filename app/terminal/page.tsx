import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server";
import { BrandLogo } from "../components/BrandLogo";
import { MemberShell } from "../components/MemberShell";
import { MarketsBrowser } from "./components/MarketsBrowser";
import { createProgressiveAccess, membershipRedirect, resolveMembershipTier } from "./lib/membership-entitlement";
import { loadPreviewClaims } from "./lib/preview-access";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Terminal | NASH AI Markets",
  description: "Verified cross-asset market intelligence, decision constraints and scenario readiness.",
  robots: { index: false, follow: false },
};

export default async function Terminal() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!user.email) redirect("/?membership=required#membership");

  const { data: membership, error: membershipError } = await supabase.from("memberships").select("plan, status, current_period_end").ilike("email", user.email).in("plan", ["free", "pro", "elite"]).maybeSingle();
  const tier = resolveMembershipTier(membership, Boolean(membershipError));
  if (tier === "temporarily_unavailable") redirect(membershipRedirect(tier));
  const previewState = await loadPreviewClaims(user.id);
  createProgressiveAccess(tier, previewState.claims);

  return (
    <MemberShell
      active="terminal"
      className="customerTerminal premiumTerminal terminalMemberPage terminalCanvasPage"
    >
      <div className="memberDashboardShell ctWorkspace terminalMarketsCanvas" id="overview">
        <div className="terminalCanvasHeader">
          <BrandLogo authenticated className="terminalCanvasLogo" />
        </div>
        <MarketsBrowser />
      </div>
    </MemberShell>
  );
}
