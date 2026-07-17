import Link from "next/link";
import type { MembershipTier } from "../terminal/lib/membership-entitlement.ts";
import { TerminalBadge } from "../terminal/components/TerminalBadge.tsx";

type SubscriptionStatusCardProps = {
  tier: MembershipTier;
  status: string | null;
  billingPlan?: string | null;
  periodEnd: string | null;
  portalUrl: string;
  compact?: boolean;
  verificationUnavailable?: boolean;
};

function periodLabel(value: string | null): string {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp)
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/London" }).format(new Date(timestamp))
    : "Not applicable";
}

export function SubscriptionStatusCard({
  tier,
  status,
  billingPlan,
  periodEnd,
  portalUrl,
  compact = false,
  verificationUnavailable = false,
}: SubscriptionStatusCardProps) {
  const hasPaidRecord = billingPlan === "pro" || billingPlan === "elite" || tier === "pro" || tier === "elite";
  const recordedStatus = status?.toLowerCase() ?? "unavailable";
  const normalizedStatus = verificationUnavailable
    ? "verification unavailable"
    : tier === "free" && hasPaidRecord && (recordedStatus === "active" || recordedStatus === "trialing")
      ? "expired"
      : hasPaidRecord
        ? recordedStatus
        : "free";
  const healthy = normalizedStatus === "active" || normalizedStatus === "trialing" || normalizedStatus === "free";
  return <section className={`subscriptionStatus ${compact ? "subscriptionStatusCompact" : ""}`.trim()} aria-label="Subscription status">
    <div className="subscriptionStatusLead">
      <TerminalBadge label={`${tier} plan`} tone={tier === "elite" ? "warning" : tier === "pro" ? "info" : "neutral"} />
      <div><span>SUBSCRIPTION STATUS</span><strong>{normalizedStatus.replaceAll("_", " ")}</strong></div>
    </div>
    <dl>
      <div><dt>Current access</dt><dd>{verificationUnavailable ? "Unable to verify" : tier.toUpperCase()}</dd></div>
      <div><dt>{hasPaidRecord ? "Recorded period ends" : "Billing period"}</dt><dd>{hasPaidRecord ? periodLabel(periodEnd) : "No paid subscription"}</dd></div>
    </dl>
    <div className="subscriptionStatusActions">
      <span data-healthy={healthy}>{healthy ? "Access verified" : "Review billing status"}</span>
      {hasPaidRecord ? <a href={portalUrl}>Manage in Stripe</a> : <Link href="/#membership">Compare memberships</Link>}
    </div>
  </section>;
}
