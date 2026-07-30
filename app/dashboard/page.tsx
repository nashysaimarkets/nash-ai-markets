import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server.ts";
import { MemberShell } from "../components/MemberShell";
import { createProgressiveAccess, membershipRedirect, resolveMembershipTier } from "../terminal/lib/membership-entitlement";
import { loadPreviewClaims } from "../terminal/lib/preview-access";
import { currentServerTimestamp, memberDisplayName } from "./lib/daily-dashboard.ts";
import { buildDeskGreeting } from "./lib/market-weather.ts";
import { buildDashboardCommandSummary } from "./lib/dashboard-command-summary.ts";
import { buildAiMarketInsight } from "../lib/ai-market-insight.ts";
import { buildOracleBundle } from "../lib/oracle/build-oracle-bundle.ts";
import { MarketCommandCentre } from "./components/MarketCommandCentre";
import { primaryLevel } from "./lib/command-centre.ts";
import { getVerifiedMarketContext } from "../lib/verified-market-context.ts";
import { sanitizeForClient } from "../lib/serialize-for-client.ts";
import { createUnavailableSnapshot } from "../lib/market-data.ts";
import { analyzeMarketSnapshot } from "../lib/market-intelligence-engine.ts";
import { createTradingDecision } from "../lib/trading-decision-engine.ts";
import { createStructuredTradePlan } from "../lib/structured-trade-planner.ts";
import { readSessionClock } from "../terminal/lib/session-clock.ts";
import { createUnconfiguredMarketGatewayStatus } from "../lib/live-market-gateway.ts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Dashboard | NASH AI Markets",
  description: "Daily command centre with verified delayed market status, decision snapshot and routing.",
  robots: { index: false, follow: false },
};

export default async function MemberDashboard() {
  const now = currentServerTimestamp();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const { data: onboarding, error: onboardingError } = await supabase
    .from("member_onboarding")
    .select("completed_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!onboardingError && !onboarding?.completed_at) redirect("/onboarding");

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("plan, status, current_period_end, billing_interval")
    .ilike("email", user.email)
    .in("plan", ["free", "pro", "elite"])
    .maybeSingle();
  const tier = resolveMembershipTier(membership, Boolean(membershipError), now);
  if (tier === "temporarily_unavailable") redirect(membershipRedirect(tier));

  const previewState = await loadPreviewClaims(user.id);
  const access = createProgressiveAccess(tier, previewState.claims);
  const paid = access.tier === "pro" || access.tier === "elite";
  const displayName = memberDisplayName(user.email, user.user_metadata as Record<string, unknown> | undefined);
  const tierLabel = access.tier.charAt(0).toUpperCase() + access.tier.slice(1).toLowerCase();

  try {
    const context = await getVerifiedMarketContext({ paid, now, route: "/dashboard" });
    const greeting = buildDeskGreeting(displayName, context.session, new Date(now));
    const summary = buildDashboardCommandSummary({
      snapshot: context.snapshot,
      session: context.session,
      candleSeries: context.candles,
      decision: context.decision,
      plan: context.plan,
      signals: null,
      warnings: context.warnings,
      now,
    });
    const insight = buildAiMarketInsight({
      snapshot: context.snapshot,
      intelligence: context.intelligence,
      decision: context.decision,
      plan: context.plan,
      verified: context.verified,
      warnings: context.warnings,
      now,
    });
    const support = primaryLevel(context.snapshot, "support");
    const resistance = primaryLevel(context.snapshot, "resistance");
    const oracle = buildOracleBundle({
      snapshot: context.snapshot,
      intelligence: context.intelligence,
      decision: context.decision,
      plan: context.plan,
      session: context.session,
      verified: context.verified,
      freshnessLabel: summary.hero.delayedAgeLine,
      warnings: context.warnings,
      candles: context.candles?.candles ?? null,
      support: support?.value ?? null,
      resistance: resistance?.value ?? null,
      now,
    });

    const props = sanitizeForClient({
      greeting,
      tierLabel,
      summary,
      insight,
      oracle,
      candleSeries: context.candles,
      now,
      contextStatus: context.status,
      missingInputs: context.missingInputs,
      correlationId: context.correlationId,
    });

    return (
      <MemberShell active="dashboard">
        {props.contextStatus !== "complete" ? (
          <aside className="dashPartialBanner" role="status">
            <strong>
              {props.contextStatus === "unavailable"
                ? "Verified context is limited"
                : "Partial verified context"}
            </strong>
            <span>
              {props.missingInputs.length
                ? `Awaiting: ${props.missingInputs.slice(0, 3).join("; ")}.`
                : "Some optional feeds are unavailable."}{" "}
              Available modules remain visible. Ref {props.correlationId}.
            </span>
            <div>
              <Link href="/dashboard">Retry dashboard</Link>
              <Link href="/terminal">Open Trading Desk</Link>
              <Link href="/brief">Open Morning Brief</Link>
            </div>
          </aside>
        ) : null}
        <MarketCommandCentre
          greeting={props.greeting}
          tierLabel={props.tierLabel}
          summary={props.summary}
          insight={props.insight}
          oracle={props.oracle}
          candleSeries={props.candleSeries}
          now={props.now}
        />
      </MemberShell>
    );
  } catch (error) {
    console.error("[dashboard] command centre failed; rendering recovery shell", {
      name: error instanceof Error ? error.name : "Error",
    });
    const snapshot = createUnavailableSnapshot();
    const gatewayStatus = createUnconfiguredMarketGatewayStatus("Dashboard recovery");
    const session = readSessionClock(new Date(now));
    const intelligence = analyzeMarketSnapshot(snapshot);
    const decision = createTradingDecision({
      intelligence,
      reasoning: intelligence.reasoning,
      dataStatus: snapshot.status,
      providerStatus: gatewayStatus.connectionStatus,
      dataAgeMs: gatewayStatus.dataAgeMs,
      fallbackActive: true,
      missingDataWarnings: intelligence.reasoning.missingDataWarnings,
    });
    const plan = createStructuredTradePlan({
      decision,
      intelligence,
      dataStatus: snapshot.status,
      providerStatus: gatewayStatus.connectionStatus,
      dataAgeMs: gatewayStatus.dataAgeMs,
      fallbackActive: true,
      missingDataWarnings: intelligence.reasoning.missingDataWarnings,
    });
    const greeting = buildDeskGreeting(displayName, session, new Date(now));
    const summary = buildDashboardCommandSummary({
      snapshot,
      session,
      candleSeries: null,
      decision,
      plan,
      signals: null,
      warnings: ["Verified market data is currently unavailable"],
      now,
    });
    const insight = buildAiMarketInsight({
      snapshot,
      intelligence,
      decision,
      plan,
      verified: false,
      now,
    });
    const oracle = buildOracleBundle({
      snapshot,
      intelligence,
      decision,
      plan,
      session,
      verified: false,
      freshnessLabel: "Delayed market data · age unavailable",
      candles: null,
      support: null,
      resistance: null,
      now,
    });
    const props = sanitizeForClient({ greeting, tierLabel, summary, insight, oracle, now });

    return (
      <MemberShell active="dashboard">
        <aside className="dashPartialBanner is-critical" role="alert">
          <strong>Command view recovered in safe mode</strong>
          <span>No invented market values are shown. Retry or continue on the Trading Desk.</span>
          <div>
            <Link href="/dashboard">Retry dashboard</Link>
            <Link href="/terminal">Open Trading Desk</Link>
          </div>
        </aside>
        <MarketCommandCentre
          greeting={props.greeting}
          tierLabel={props.tierLabel}
          summary={props.summary}
          insight={props.insight}
          oracle={props.oracle}
          candleSeries={null}
          now={props.now}
        />
      </MemberShell>
    );
  }
}
