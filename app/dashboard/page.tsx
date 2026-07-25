import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server.ts";
import { MemberShell } from "../components/MemberShell.tsx";
import { MissionControl } from "../components/mission-control/MissionControl.tsx";
import { analyzeMarketSnapshot } from "../lib/market-intelligence-engine.ts";
import { formatSnapshotAge, hasDisplayableQuotes, isDecisionReadySnapshot } from "../lib/market-data.ts";
import { createStructuredTradePlan } from "../lib/structured-trade-planner.ts";
import { createTradingDecision } from "../lib/trading-decision-engine.ts";
import { createProgressiveAccess, membershipRedirect, resolveMembershipTier } from "../terminal/lib/membership-entitlement.ts";
import { getTerminalMarketData } from "../terminal/lib/terminal-market-data-provider.ts";
import { getConfiguredFmpCandlesForInstruments, toCustomerCandleSeries } from "../lib/providers/financial-modeling-prep-candles.ts";
import { CrossAssetCandleGallery } from "../components/CrossAssetCandleGallery.tsx";
import { MarketDirectionalGaugesPanel } from "../terminal/components/CustomerTerminal.tsx";
import { loadPreviewClaims } from "../terminal/lib/preview-access.ts";
import { candleReferenceLevels } from "./lib/candle-analysis.ts";
import { currentServerTimestamp, memberDisplayName } from "./lib/daily-dashboard.ts";
import { rangeLaneFromCandles, sparklineFromCandles } from "../components/mini-visuals/mini-visual-data.ts";
import { formatCustomerParticipationWarnings } from "../terminal/lib/customer-warnings.ts";
import { getPriorSnapshot, persistAnalysisSnapshot } from "../lib/server/market-snapshots.ts";
import { createMarketDeskSignals, deskCandleContextFromRange } from "../lib/market-desk-signals.ts";
import { createMarketDirectionalGauges } from "../lib/market-directional-gauges.ts";
import { createMarketStructureLevels } from "../lib/market-structure-levels.ts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Mission Control | NASH AI Markets",
  description: "Premium daily command centre for verified Bullseye market preparation.",
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

  const [previewState, market, candleBundleRaw, prior] = await Promise.all([
    loadPreviewClaims(user.id),
    getTerminalMarketData(undefined, now),
    tier === "pro" || tier === "elite" ? getConfiguredFmpCandlesForInstruments("5m", now) : Promise.resolve(null),
    getPriorSnapshot(new Date(now).toISOString()),
  ]);
  const candleSeriesByInstrument = candleBundleRaw
    ? {
      ES: toCustomerCandleSeries(candleBundleRaw.ES),
      VIX: toCustomerCandleSeries(candleBundleRaw.VIX),
      DXY: toCustomerCandleSeries(candleBundleRaw.DXY),
      OIL: toCustomerCandleSeries(candleBundleRaw.OIL),
      QQQ: toCustomerCandleSeries(candleBundleRaw.QQQ),
      NQ: toCustomerCandleSeries(candleBundleRaw.NQ),
    }
    : null;
  const candleSeries = candleSeriesByInstrument?.ES ?? null;
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
  const decisionReady = isDecisionReadySnapshot(market.snapshot);
  const observable = hasDisplayableQuotes(market.snapshot);
  const candleLevels = candleSeries?.candles.length ? candleReferenceLevels(candleSeries.candles) : [];
  const rollingHigh = candleLevels.find((level) => level.label === "24h high");
  const rollingLow = candleLevels.find((level) => level.label === "24h low");
  const esSparkline = candleSeries?.candles.length ? sparklineFromCandles(candleSeries.candles) : null;
  const rangeLane = candleSeries?.candles.length ? rangeLaneFromCandles(candleSeries.candles) : null;
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
  const delayed = market.snapshot.status === "DELAYED" || (!decisionReady && observable);
  const deskCandle = deskCandleContextFromRange(rangeLane);
  const deskSignals = createMarketDeskSignals({
    snapshot: market.snapshot,
    intelligence,
    decision,
    plan,
    candle: deskCandle,
  });
  const directionalGauges = createMarketDirectionalGauges({
    snapshot: market.snapshot,
    deskSignals,
    candle: deskCandle,
  });
  const structureLevels = createMarketStructureLevels({
    snapshot: market.snapshot,
    candlesBySymbol: {
      ES: candleSeriesByInstrument?.ES?.candles,
      VIX: candleSeriesByInstrument?.VIX?.candles,
      DXY: candleSeriesByInstrument?.DXY?.candles,
      OIL: candleSeriesByInstrument?.OIL?.candles,
      QQQ: candleSeriesByInstrument?.QQQ?.candles,
      NQ: candleSeriesByInstrument?.NQ?.candles,
    },
  });
  const candleRefs = rangeLane
    ? {
      rangeHigh: rangeLane.high,
      rangeLow: rangeLane.low,
      firstClose: rangeLane.firstClose,
      ema20: rangeLane.ema20,
      ema50: rangeLane.ema50,
      latest: rangeLane.current,
    }
    : null;

  void persistAnalysisSnapshot({
    snapshot: market.snapshot,
    intelligence,
    decision,
    plan,
    gateway: market.gatewayStatus,
    kind: "morning",
    candleRefs,
  });

  return <MemberShell active="dashboard" className="missionControlPage">
    <div className="memberDashboardShell">
      <MissionControl
        name={memberDisplayName(user.email, user.user_metadata)}
        snapshot={market.snapshot}
        intelligence={intelligence}
        decision={decision}
        plan={plan}
        gateway={market.gatewayStatus}
        decisionReady={decisionReady}
        score={score}
        delayed={delayed}
        dataAge={observable ? formatSnapshotAge(market.snapshot.asOf) : "Age unavailable"}
        esSparkline={esSparkline}
        previousPayload={prior?.payload ?? null}
        bullishConfirm={bullishConfirm}
        bearishConfirm={bearishConfirm}
        invalidation={String(invalidation)}
        noTrade={noTrade}
        deskSignals={deskSignals}
      />
      {candleSeriesByInstrument ? (
        <CrossAssetCandleGallery
          seriesByInstrument={candleSeriesByInstrument}
          title="Verified candlesticks across live feeds"
          eyebrow="MISSION CONTROL CHARTS"
        />
      ) : null}
      {access.features.intelligence ? (
        <MarketDirectionalGaugesPanel
          gauges={directionalGauges}
          structure={structureLevels}
          snapshotAge={observable ? formatSnapshotAge(market.snapshot.asOf) : "Age unavailable"}
        />
      ) : null}
      {!access.features.intelligence ? <p className="dashAccountHint"><Link href="/profile">Manage membership</Link> · <Link href="/pricing">Compare plans</Link> · <Link href="/methodology">Methodology</Link></p> : null}
    </div>
  </MemberShell>;
}
