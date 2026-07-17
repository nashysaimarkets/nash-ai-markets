import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server.ts";
import { DashboardCard } from "../components/DashboardCard.tsx";
import { MemberShell } from "../components/MemberShell.tsx";
import { SafeState } from "../components/SafeState.tsx";
import { SubscriptionStatusCard } from "../components/SubscriptionStatusCard.tsx";
import { memberDisplayName } from "../dashboard/lib/daily-dashboard.ts";
import { resolveMembershipTier } from "../terminal/lib/membership-entitlement.ts";
import { ProfileForm } from "./components/ProfileForm.tsx";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Member Profile",
  description: "Manage your NASH AI Markets profile and review subscription access.",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("plan, status, current_period_end")
    .ilike("email", user.email)
    .in("plan", ["free", "pro", "elite"])
    .maybeSingle();
  const resolved = resolveMembershipTier(membership, Boolean(membershipError));
  const tier = resolved === "temporarily_unavailable" ? "free" : resolved;
  const portalUrl = process.env.STRIPE_CUSTOMER_PORTAL_LINK
    || "mailto:hello@nashaimarkets.com?subject=Manage%20my%20subscription";
  const name = memberDisplayName(user.email, user.user_metadata);

  return <MemberShell active="profile" className="profilePage">
    <div className="memberDashboardShell">
      <section className="profileHero">
        <div><span>MEMBER ACCOUNT</span><h1>Your profile</h1><p>Review identity, access and subscription status without exposing billing details inside Bullseye.</p></div>
        <a href="/auth/signout">Sign out securely</a>
      </section>

      {membershipError ? <SafeState title="Subscription verification is temporarily unavailable" tone="warning"><p>Your account remains signed in, but Bullseye cannot confirm current billing status. No database error details are displayed.</p></SafeState> : null}

      <section className="profileGrid">
        <DashboardCard eyebrow="PERSONAL DETAILS" title="Profile identity" className="profileIdentity">
          <div className="profileIdentitySummary"><span>{name.slice(0, 1).toUpperCase()}</span><div><strong>{name}</strong><small>{user.email}</small></div></div>
          <ProfileForm initialName={name} />
        </DashboardCard>

        <DashboardCard eyebrow="MEMBERSHIP" title="Access and billing" className="profileSubscription">
          <SubscriptionStatusCard
            tier={tier}
            status={membership?.status ?? null}
            billingPlan={membership?.plan ?? null}
            periodEnd={membership?.current_period_end ?? null}
            portalUrl={portalUrl}
            verificationUnavailable={Boolean(membershipError)}
          />
        </DashboardCard>

        <DashboardCard eyebrow="ACCOUNT SECURITY" title="Protected by passwordless access" className="profileSecurity">
          <ul><li>Authentication is managed through Supabase secure sessions.</li><li>Payment-card information remains with Stripe.</li><li>Market and AI provider credentials are never exposed to your browser.</li></ul>
        </DashboardCard>
      </section>
    </div>
  </MemberShell>;
}
