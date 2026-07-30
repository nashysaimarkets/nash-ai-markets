import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server.ts";
import { MemberShell } from "../components/MemberShell";
import { analyzeMarketSnapshot } from "../lib/market-intelligence-engine";
import { createTradingDecision } from "../lib/trading-decision-engine";
import { createStructuredTradePlan } from "../lib/structured-trade-planner";
import { getConfiguredFmpCandlesForInstruments, toCustomerCandleSeries } from "../lib/providers/financial-modeling-prep-candles";
import { getTerminalMarketData } from "../terminal/lib/terminal-market-data-provider";
import { createProgressiveAccess, membershipRedirect, resolveMembershipTier } from "../terminal/lib/membership-entitlement";
import { loadPreviewClaims } from "../terminal/lib/preview-access";
import { readSessionClock } from "../terminal/lib/session-clock";
import { formatCustomerParticipationWarnings } from "../terminal/lib/customer-warnings";
import { currentServerTimestamp, memberDisplayName } from "./lib/daily-dashboard.ts";
import { buildDeskGreeting } from "./lib/market-weather.ts";
import { buildDashboardCommandSummary } from "./lib/dashboard-command-summary.ts";
import { buildAiMarketInsight } from "../lib/ai-market-insight.ts";
import { buildOracleBundle } from "../lib/oracle/build-oracle-bundle.ts";
import { MarketCommandCentre } from "./components/MarketCommandCentre";
import { isDecisionReadySnapshot } from "../lib/market-data";
import { primaryLevel } from "./lib/command-centre.ts";

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
  const session = readSessionClock(new Date(now));

  const [{ snapshot, gatewayStatus }, candleBundle] = await Promise.all([
    getTerminalMarketData(),
    paid ? getConfiguredFmpCandlesForInstruments("5m").catch(() => null) : Promise.resolve(null),
  ]);

  const candleSeries = candleBundle ? toCustomerCandleSeries(candleBundle.ES) : null;
  const intelligence = analyzeMarketSnapshot(snapshot);
  const decision = createTradingDecision({
    intelligence,
    reasoning: intelligence.reasoning,
    dataStatus: snapshot.status,
    providerStatus: gatewayStatus.connectionStatus,
    dataAgeMs: gatewayStatus.dataAgeMs,
    fallbackActive: gatewayStatus.fallbackActive,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  const plan = createStructuredTradePlan({
    decision,
    intelligence,
    dataStatus: snapshot.status,
    providerStatus: gatewayStatus.connectionStatus,
    dataAgeMs: gatewayStatus.dataAgeMs,
    fallbackActive: gatewayStatus.fallbackActive,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });

  const warnings = formatCustomerParticipationWarnings(
    decision.noTradeReasons,
    decision.dataQualityWarnings,
    plan.eventRiskWarnings.map((warning) => warning.code),
  );

  const greeting = buildDeskGreeting(displayName, session, new Date(now));
  const summary = buildDashboardCommandSummary({
    snapshot,
    session,
    candleSeries,
    decision,
    plan,
    signals: null,
    warnings,
    now,
  });
  const verified = isDecisionReadySnapshot(snapshot) && intelligence.actionable;
  const insight = buildAiMarketInsight({
    snapshot,
    intelligence,
    decision,
    plan,
    verified,
    warnings,
    now,
  });
  const support = primaryLevel(snapshot, "support");
  const resistance = primaryLevel(snapshot, "resistance");
  const oracle = buildOracleBundle({
    snapshot,
    intelligence,
    decision,
    plan,
    session,
    verified,
    freshnessLabel: summary.hero.delayedAgeLine,
    warnings,
    candles: candleSeries?.candles ?? null,
    support: support?.value ?? null,
    resistance: resistance?.value ?? null,
    now,
  });

  return (
    <MemberShell active="dashboard">
      <MarketCommandCentre
        greeting={greeting}
        tierLabel={access.tier.charAt(0).toUpperCase() + access.tier.slice(1).toLowerCase()}
        summary={summary}
        insight={insight}
        oracle={oracle}
        candleSeries={candleSeries}
        now={now}
      />
    </MemberShell>
  );
}
