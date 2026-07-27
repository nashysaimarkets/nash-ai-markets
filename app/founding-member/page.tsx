import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server.ts";
import { DashboardCard } from "../components/DashboardCard.tsx";
import { MemberShell } from "../components/MemberShell.tsx";
import { SafeState } from "../components/SafeState.tsx";
import { resolveMembershipTier } from "../terminal/lib/membership-entitlement.ts";
import { FoundingMemberForm } from "./FoundingMemberForm.tsx";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Founding Member Onboarding",
  description: "Submit workflow preferences for NASH AI Markets Founding Member review.",
  robots: { index: false, follow: false },
};

export default async function FoundingMemberPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");
  const { data: membership, error } = await supabase
    .from("memberships")
    .select("plan, status, current_period_end")
    .ilike("email", user.email)
    .in("plan", ["pro", "elite"])
    .maybeSingle();
  const tier = resolveMembershipTier(membership, Boolean(error));
  const eligible = tier === "pro" || tier === "elite";

  return <MemberShell active="profile" className="foundingPage">
    <div className="memberDashboardShell">
      <section className="foundingHero"><div><span>FOUNDING 100 PROGRAMME</span><h1>Founding Member onboarding</h1><p>Tell us how you use Bullseye so your launch onboarding can be supported responsibly. Submission creates a pending review only—it does not change billing, membership, or entitlement.</p></div><Link href="/dashboard">Return to dashboard</Link></section>
      {error ? <SafeState title="Membership verification unavailable" tone="warning"><p>Onboarding is paused until current paid access can be verified.</p></SafeState> : eligible ? <section className="foundingGrid"><DashboardCard eyebrow="WORKFLOW PROFILE" title="Prepare your beta onboarding"><FoundingMemberForm /></DashboardCard><DashboardCard eyebrow="WHAT THIS MEANS" title="Transparent review, no hidden upgrade"><ul className="foundingPrinciples"><li>Your existing {tier.toUpperCase()} subscription remains unchanged.</li><li>Submission does not guarantee Founding Member designation.</li><li>No new payment is taken through this form.</li><li>Preferences support product onboarding, not personalised trading advice.</li></ul></DashboardCard></section> : <SafeState title="Active Pro or Elite membership required"><p>The Founding Member onboarding workflow is available to verified paid members. You can compare membership value without an artificial deadline.</p><Link href="/#membership">Compare memberships</Link></SafeState>}
    </div>
  </MemberShell>;
}
