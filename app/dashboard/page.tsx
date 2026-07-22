import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server.ts";
import { MemberShell } from "../components/MemberShell.tsx";
import { analyzeMarketSnapshot } from "../lib/market-intelligence-engine.ts";
import { formatSnapshotAge, hasDisplayableQuotes, isDecisionReadySnapshot } from "../lib/market-data.ts";
import { createStructuredTradePlan } from "../lib/structured-trade-planner.ts";
import { createTradingDecision } from "../lib/trading-decision-engine.ts";
import { createProgressiveAccess, membershipRedirect, resolveMembershipTier } from "../terminal/lib/membership-entitlement.ts";
import { getTerminalMarketData } from "../terminal/lib/terminal-market-data-provider.ts";
import { getConfiguredFmpCandles, toCustomerCandleSeries } from "../lib/providers/financial-modeling-prep-candles.ts";
import { loadPreviewClaims } from "../terminal/lib/preview-access.ts";
import { DashboardCandlestickChart } from "./components/DashboardCandlestickChart.tsx";
import { DashboardMarketStatus, quoteStripFromSnapshot } from "./components/DashboardMarketStatus.tsx";
import { DashboardMarketPlan } from "./components/DashboardMarketPlan.tsx";
import { DashboardReviewPanel } from "./components/DashboardReviewPanel.tsx";
import { candleReferenceLevels, candleSessionStats } from "./lib/candle-analysis.ts";
import { interpretCrossMarket } from "./lib/cross-market-interpretation.ts";
import { buildPostureExplanation } from "./lib/posture-summary.ts";
import { buildDailyMission, currentServerTimestamp, memberDisplayName, selectNextEconomicEvent } from "./lib/daily-dashboard.ts";
import { commandCentreState, marketSessionState } from "./lib/command-centre.ts";
import { formatCustomerParticipationWarnings } from "../terminal/lib/customer-warnings.ts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Dashboard | NASH AI Markets",
  description: "Verified market status, candlestick workspace and today’s market plan.",
  robots: { index: false, follow: false },
};

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

  const [previewState, market, candleSeriesRaw] = await Promise.all([
    loadPreviewClaims(user.id),
    getTerminalMarketData(undefined, now),
    tier === "pro" || tier === "elite" ? getConfiguredFmpCandles("5m", now) : Promise.resolve(null),
  ]);
  const candleSeries = candleSeriesRaw ? toCustomerCandleSeries(candleSeriesRaw) : null;
  const access = createProgressiveAccess(tier, previewState.claims, now);
  const intelligence = analyzeMarketSnapshot(market.snapshot);
  const decision = createTradingDecision({
    intelligence,
    reasoning: intelligence.reasoning,
    dataStatus: market.snapshot.status,
    providerStatus: market.gatewayStatus.connectionStatus,
    dataAgeMs: market.gatewayStatus.dataAgeMs,
    fallbackActive: market.gatewayStatus.fallbackActive,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  const plan = createStructuredTradePlan({
    decision,
    intelligence,
    dataStatus: market.snapshot.status,
    providerStatus: market.gatewayStatus.connectionStatus,
    dataAgeMs: market.gatewayStatus.dataAgeMs,
    fallbackActive: market.gatewayStatus.fallbackActive,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  const mission = buildDailyMission(market.snapshot, intelligence, decision, plan);
  const decisionReady = isDecisionReadySnapshot(market.snapshot);
  const observable = hasDisplayableQuotes(market.snapshot);
  const session = marketSessionState(now);
  const centreState = commandCentreState(market.snapshot, market.gatewayStatus, session.label);
  const candleStats = candleSeries?.candles.length ? candleSessionStats(candleSeries.candles) : null;
  const candleLevels = candleSeries?.candles.length ? candleReferenceLevels(candleSeries.candles) : [];
  const rollingHigh = candleLevels.find((level) => level.label === "24h high");
  const rollingLow = candleLevels.find((level) => level.label === "24h low");
  const firstClose = candleLevels.find((level) => level.label === "First available close");
  const interpretation = observable ? interpretCrossMarket(market.snapshot) : "Verified cross-market readings are unavailable.";
  const posture = buildPostureExplanation({
    decisionReady,
    decision,
    plan,
    mission,
    snapshot: market.snapshot,
    candleStats: candleStats ? { high: candleStats.high, low: candleStats.low, latest: candleStats.latest } : null,
    interpretation,
  });
  const nextEvent = selectNextEconomicEvent(market.snapshot.events, now);
  const name = memberDisplayName(user.email, user.user_metadata);
  const marketTimestamp = observable && Number.isFinite(Date.parse(market.snapshot.asOf))
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(market.snapshot.asOf))
    : "No verified timestamp";
  const statusPresentation = {
    live: { label: "Live verified", detail: "Current provider inputs cleared" },
    delayed: { label: "Delayed", detail: "Check the timestamp before acting" },
    stale: { label: "Stale", detail: "Current analytics withheld" },
    unavailable: { label: "Unavailable", detail: observable ? "Previous session observation retained" : "Provider safety state active" },
    partial: { label: "Partial", detail: "Required inputs incomplete" },
    closed: { label: "Market closed", detail: "Last verified context remains labelled" },
  }[centreState];
  const bullish = intelligence.scenarios.find((scenario) => scenario.type === "BULLISH");
  const bearish = intelligence.scenarios.find((scenario) => scenario.type === "BEARISH");
  const price = (value: number | null | undefined) => value == null ? null : value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const noTrade = formatCustomerParticipationWarnings(
    decision.noTradeReasons,
    decision.dataQualityWarnings,
    plan.eventRiskWarnings.map((warning) => warning.code),
  );
  const bullishConfirm = rollingHigh
    ? `Acceptance above the verified rolling range high (${price(rollingHigh.value)}) after fresh data arrives.`
    : bullish?.trigger.level
      ? `${bullish.trigger.kind.replaceAll("_", " ").toLowerCase()} near ${bullish.trigger.level}.`
      : "Await a verified upside confirmation from fresh candles and quotes.";
  const bearishConfirm = rollingLow
    ? `Loss of the verified rolling range low (${price(rollingLow.value)}) after fresh data arrives.`
    : bearish?.trigger.level
      ? `${bearish.trigger.kind.replaceAll("_", " ").toLowerCase()} near ${bearish.trigger.level}.`
      : "Await a verified downside confirmation from fresh candles and quotes.";
  const invalidation = decision.invalidationConditions[0]?.level
    ?? decision.invalidationConditions[0]?.kind.replaceAll("_", " ").toLowerCase()
    ?? "Any unverified, stale or incomplete input.";
  const score = decisionReady ? Math.min(decision.confidenceScore, intelligence.scores.bullseyeConfidence) : null;

  return <MemberShell active="dashboard">
    <div className="memberDashboardShell eliteDashboard dashCompact">
      <DashboardMarketStatus
        name={name}
        posture={posture.posture}
        explanation={posture.explanation}
        reviewTrigger={posture.reviewTrigger}
        dataLabel={statusPresentation.label}
        dataDetail={statusPresentation.detail}
        dataAge={observable ? formatSnapshotAge(market.snapshot.asOf) : "Age unavailable"}
        lastVerified={`${marketTimestamp} UK`}
        sessionLabel={session.label}
        sessionDetail={session.detail}
        quotes={quoteStripFromSnapshot(market.snapshot.quotes, candleStats)}
        nextEvent={nextEvent ? {
          name: nextEvent.name,
          risk: nextEvent.risk,
          when: new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(nextEvent.startsAt)),
        } : null}
        riskRating={decisionReady ? decision.riskRating : null}
        bullseyeScore={score}
        decisionReady={decisionReady}
        terminalHref="/terminal"
        briefHref="/brief"
      />

      <section className="dashSection dashWorkspace" aria-labelledby="dash-workspace-title">
        <header className="dashSectionHeader">
          <div>
            <span className="eliteEyebrow">VERIFIED MARKET WORKSPACE</span>
            <h2 id="dash-workspace-title">Chart and cross-market context</h2>
            <p>{interpretation}</p>
          </div>
        </header>
        {candleSeries ? <DashboardCandlestickChart series={candleSeries} /> : <section className="dashboardChartLocked" aria-label="Premium candlestick chart">
          <span>PRO OR ELITE</span>
          <h2>Verified provider candlesticks</h2>
          <p>Intraday chart history unlocks after Pro or Elite entitlement verification.</p>
          <Link href="/pricing">Compare membership plans →</Link>
        </section>}
        {!access.features.intelligence && access.tier !== "elite" ? <p className="dashAccountHint"><Link href="/profile">Manage membership and previews in Profile</Link> · <Link href="/pricing">Compare plans</Link></p> : null}
      </section>

      {access.features["trade-planner"] || access.features["decision-engine"] ? <DashboardMarketPlan
        decisionReady={decisionReady}
        posture={posture.posture}
        bias={decision.marketBias}
        volatility={decisionReady ? decision.volatilityRegime : null}
        readiness={decisionReady ? plan.executionReadiness : null}
        approach={decisionReady ? plan.preferredSetupType : null}
        score={score}
        rangeHigh={price(rollingHigh?.value)}
        rangeLow={price(rollingLow?.value)}
        firstClose={price(firstClose?.value)}
        bullishConfirm={bullishConfirm}
        bearishConfirm={bearishConfirm}
        invalidation={invalidation}
        noTrade={noTrade}
        reviewTrigger={posture.reviewTrigger}
        interpretation={interpretation}
      /> : <section className="dashSection"><p className="dashAccountHint">Today&apos;s market plan unlocks with Pro or Elite. <Link href="/profile">View access in Profile</Link>.</p></section>}

      <DashboardReviewPanel
        nextEvent={nextEvent ? {
          name: nextEvent.name,
          risk: nextEvent.risk,
          when: new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(nextEvent.startsAt)),
          countdown: nextEvent.countdown,
        } : null}
        events={market.snapshot.events}
        noTrade={noTrade}
        reviewTrigger={posture.reviewTrigger}
        decisionReady={decisionReady}
      />
    </div>
  </MemberShell>;
}
