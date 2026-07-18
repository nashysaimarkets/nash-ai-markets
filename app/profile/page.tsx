import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server.ts";
import { DashboardCard } from "../components/DashboardCard.tsx";
import { MemberShell } from "../components/MemberShell.tsx";
import { SafeState } from "../components/SafeState.tsx";
import { SubscriptionStatusCard } from "../components/SubscriptionStatusCard.tsx";
import { memberDisplayName } from "../dashboard/lib/daily-dashboard.ts";
import { resolveMembershipTier } from "../terminal/lib/membership-entitlement.ts";
import { loadFounding100ForEmail } from "../lib/server/founding-100.ts";
import { loadCommercialMembership } from "../lib/server/commercial.ts";
import { ProfileForm } from "./components/ProfileForm.tsx";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Member Profile",
  description: "Manage your NASH AI Markets profile and review subscription access.",
  robots: { index: false, follow: false },
};

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ billing?: string; preferences?: string }> }) {
  const query = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const [{ data: membership, error: membershipError }, { data: preferences }, founding100, commercial] = await Promise.all([
    supabase
      .from("memberships")
      .select("plan, status, current_period_end")
      .ilike("email", user.email)
      .in("plan", ["free", "pro", "elite"])
      .maybeSingle(),
    supabase
      .from("member_onboarding")
      .select("experience, interests, notifications, completed_at, updated_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    loadFounding100ForEmail(user.email),
    loadCommercialMembership(user.email),
  ]);
  const resolved = resolveMembershipTier(membership, Boolean(membershipError));
  const tier = resolved === "temporarily_unavailable" ? "free" : resolved;
  const portalUrl = "/api/stripe/portal";
  const name = memberDisplayName(user.email, user.user_metadata);
  const preferenceLabels: Record<string, string> = {
    new: "New to structured analysis",
    developing: "Developing a consistent process",
    experienced: "Experienced workflow",
    futures: "Index futures",
    options: "Options",
    macro: "Macro and rates",
    volatility: "Volatility",
    essential: "Essential notices",
    "brief-and-essential": "Morning Brief + essential notices",
    none: "No optional notifications",
  };
  const preferenceInterests = Array.isArray(preferences?.interests)
    ? preferences.interests.filter((item): item is string => typeof item === "string")
    : [];
  const accountReady = !membershipError && Boolean(preferences?.completed_at);

  return <MemberShell active="profile" className="profilePage">
    <div className="memberDashboardShell">
      <section className="profileHero">
        <div><span>ACCOUNT MISSION CONTROL</span><h1>Your account</h1><p>Manage identity, workspace preferences and subscription access from one secure member hub.</p></div>
        <div className="profileHeroActions"><Link href="/terminal">Open terminal</Link><a href="/auth/signout">Sign out securely</a></div>
      </section>

      {membershipError ? <SafeState title="Subscription verification is temporarily unavailable" tone="warning"><p>Your account remains signed in, but Bullseye cannot confirm current billing status. No database error details are displayed.</p></SafeState> : null}
      {query.billing === "unavailable" ? <SafeState title="Stripe account management is temporarily unavailable" tone="warning"><p>No billing change was made. Please retry shortly or contact support if the issue continues.</p></SafeState> : null}
      {query.preferences === "updated" ? <SafeState title="Workspace preferences updated"><p>Your member workspace now uses the choices shown below.</p></SafeState> : null}

      <section className="profileOverview" aria-label="Account overview">
        <article><span>Account status</span><strong>{accountReady ? "Ready" : "Action needed"}</strong><small>{accountReady ? "Identity, preferences and access available" : "Complete the highlighted account step"}</small></article>
        <article><span>Membership</span><strong>{membershipError ? "Unverified" : tier.toUpperCase()}</strong><small>{commercial.membership?.billingInterval === "year" ? "Annual billing" : commercial.membership?.billingInterval === "month" ? "Monthly billing" : "No paid billing cadence"}</small></article>
        <article><span>Workspace</span><strong>{preferences?.completed_at ? "Configured" : "Not configured"}</strong><small>{preferences?.completed_at ? "Preferences can be updated anytime" : "Set up your market workspace"}</small></article>
        <article><span>Security</span><strong>Passwordless</strong><small>Supabase session · Stripe-hosted billing</small></article>
      </section>

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
            foundingRecords={founding100.records}
            billingInterval={commercial.membership?.billingInterval ?? null}
          />
        </DashboardCard>

        <DashboardCard eyebrow="WORKSPACE" title="Market preferences" className="profilePreferences">
          {preferences?.completed_at ? (
            <div className="profilePreferenceBody">
              <dl>
                <div><dt>Experience</dt><dd>{preferenceLabels[preferences.experience] ?? "Configured"}</dd></div>
                <div><dt>Interests</dt><dd>{preferenceInterests.map((item) => preferenceLabels[item] ?? item).join(" · ")}</dd></div>
                <div><dt>Notifications</dt><dd>{preferenceLabels[preferences.notifications] ?? "Configured"}</dd></div>
              </dl>
              <Link href="/onboarding">Update workspace preferences <span>↗</span></Link>
            </div>
          ) : (
            <div className="profilePreferenceEmpty">
              <strong>Your workspace needs three short preferences</strong>
              <p>Choose your experience, market interests and optional notification setting.</p>
              <Link href="/onboarding">Complete workspace setup <span>↗</span></Link>
            </div>
          )}
        </DashboardCard>

        <DashboardCard eyebrow="ACCOUNT SECURITY" title="Protected by passwordless access" className="profileSecurity">
          <ul><li>Authentication is managed through Supabase secure sessions.</li><li>Payment-card information remains with Stripe.</li><li>Market and AI provider credentials are never exposed to your browser.</li></ul>
        </DashboardCard>

        <nav className="profileQuickLinks" aria-label="Account quick links">
          <Link href="/dashboard"><span>01</span><div><strong>Dashboard</strong><small>Return to today’s mission</small></div><i>↗</i></Link>
          <Link href="/pricing"><span>02</span><div><strong>Membership options</strong><small>Compare Free, Pro and Elite</small></div><i>↗</i></Link>
          <Link href="/help"><span>03</span><div><strong>Help centre</strong><small>Account and product guidance</small></div><i>↗</i></Link>
          <Link href="/risk-disclaimer"><span>04</span><div><strong>Risk information</strong><small>Review important product limits</small></div><i>↗</i></Link>
        </nav>
      </section>
    </div>
  </MemberShell>;
}
