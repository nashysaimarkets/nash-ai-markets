import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server";
import { analyzeMarketSnapshot } from "../lib/market-intelligence-engine";
import { createTradingDecision } from "../lib/trading-decision-engine";
import { createStructuredTradePlan } from "../lib/structured-trade-planner";
import { formatSnapshotAge, formatUkTimestamp, hasDisplayableQuotes, isDecisionReadySnapshot } from "../lib/market-data";
import { formatFreshnessLabel } from "../lib/freshness-labels";
import { MemberShell } from "../components/MemberShell";
import { AskBullseye } from "../components/AskBullseye";
import { TerminalControls } from "./components/TerminalControls";
import { LockedPremiumCard } from "./components/LockedPremiumCard";
import { CrossAssetBoard, DecisionEnginePanel, DecisionIntelligencePanel, MarketCommandHeader, MarketDeskSignalsPanel, MarketDirectionalGaugesPanel, MarketPressureMap, StructureLevelsPanel, TodaysMarketPlan } from "./components/CustomerTerminal";
import { KeyMarketInformation } from "../components/mini-visuals/KeyMarketInformation";
import { getTerminalMarketData } from "./lib/terminal-market-data-provider";
import { getConfiguredFmpCandlesForInstruments, toCustomerCandleSeries } from "../lib/providers/financial-modeling-prep-candles";
import { DashboardCandlestickChart } from "../dashboard/components/DashboardCandlestickChart";
import { CrossAssetCandleGallery } from "../components/CrossAssetCandleGallery";
import { candleReferenceLevels, candleSessionStats } from "../dashboard/lib/candle-analysis";
import { rangeLaneFromCandles, scenarioLaneMarkers, sparklineFromCandles, parsePriceLevel } from "../components/mini-visuals/mini-visual-data";
import { createMarketDeskSignals, deskCandleContextFromRange } from "../lib/market-desk-signals";
import { createMarketDirectionalGauges } from "../lib/market-directional-gauges";
import { createMarketStructureLevels } from "../lib/market-structure-levels";
import { EventWindowEmpty } from "../components/mini-visuals/EventWindowEmpty";
import { createProgressiveAccess, membershipRedirect, resolveMembershipTier } from "./lib/membership-entitlement";
import { loadPreviewClaims } from "./lib/preview-access";
import { formatCustomerParticipationWarnings } from "./lib/customer-warnings";
import { terminalStatusMessage } from "./lib/terminal-state";
import { terminalMarketState } from "./lib/visual-terminal";
import { persistAnalysisSnapshot } from "../lib/server/market-snapshots";

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
  const access = createProgressiveAccess(tier, previewState.claims);
  const previewOffer = access.previewOffer;
  const paid = access.tier === "pro" || access.tier === "elite";

  const [{ snapshot, gatewayStatus }, candleBundleRaw] = await Promise.all([
    getTerminalMarketData(),
    paid ? getConfiguredFmpCandlesForInstruments("5m") : Promise.resolve(null),
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
  const candleLevels = candleSeries?.candles.length ? candleReferenceLevels(candleSeries.candles) : [];
  const candleStats = candleSeries?.candles.length ? candleSessionStats(candleSeries.candles) : null;
  const rangeLane = candleSeries?.candles.length ? rangeLaneFromCandles(candleSeries.candles) : null;
  const esSparkline = candleSeries?.candles.length ? sparklineFromCandles(candleSeries.candles) : null;
  const vixSparkline = candleSeriesByInstrument?.VIX?.candles.length
    ? sparklineFromCandles(candleSeriesByInstrument.VIX.candles)
    : null;
  const dxySparkline = candleSeriesByInstrument?.DXY?.candles.length
    ? sparklineFromCandles(candleSeriesByInstrument.DXY.candles)
    : null;
  const oilSparkline = candleSeriesByInstrument?.OIL?.candles.length
    ? sparklineFromCandles(candleSeriesByInstrument.OIL.candles)
    : null;
  const qqqSparkline = candleSeriesByInstrument?.QQQ?.candles.length
    ? sparklineFromCandles(candleSeriesByInstrument.QQQ.candles)
    : null;
  const nqSparkline = candleSeriesByInstrument?.NQ?.candles.length
    ? sparklineFromCandles(candleSeriesByInstrument.NQ.candles)
    : null;
  const intelligence = analyzeMarketSnapshot(snapshot);
  const decision = createTradingDecision({ intelligence, reasoning: intelligence.reasoning, dataStatus: snapshot.status, providerStatus: gatewayStatus.connectionStatus, dataAgeMs: gatewayStatus.dataAgeMs, fallbackActive: gatewayStatus.fallbackActive, missingDataWarnings: intelligence.reasoning.missingDataWarnings });
  const plan = createStructuredTradePlan({ decision, intelligence, dataStatus: snapshot.status, providerStatus: gatewayStatus.connectionStatus, dataAgeMs: gatewayStatus.dataAgeMs, fallbackActive: gatewayStatus.fallbackActive, missingDataWarnings: intelligence.reasoning.missingDataWarnings });
  const deskCandle = deskCandleContextFromRange(rangeLane);
  const deskSignals = createMarketDeskSignals({
    snapshot,
    intelligence,
    decision,
    plan,
    candle: deskCandle,
  });
  const directionalGauges = createMarketDirectionalGauges({
    snapshot,
    deskSignals,
    candle: deskCandle,
  });
  const structureLevels = createMarketStructureLevels({
    snapshot,
    candlesBySymbol: {
      ES: candleSeriesByInstrument?.ES?.candles,
      VIX: candleSeriesByInstrument?.VIX?.candles,
      DXY: candleSeriesByInstrument?.DXY?.candles,
      OIL: candleSeriesByInstrument?.OIL?.candles,
      QQQ: candleSeriesByInstrument?.QQQ?.candles,
      NQ: candleSeriesByInstrument?.NQ?.candles,
    },
  });
  const bullish = intelligence.scenarios.find((scenario) => scenario.type === "BULLISH");
  const bearish = intelligence.scenarios.find((scenario) => scenario.type === "BEARISH");
  const bullishConfirm = bullish?.trigger.level
    ? `Bullish confirmation above ${bullish.trigger.level}`
    : "Awaiting verified upside confirmation";
  const bearishConfirm = bearish?.trigger.level
    ? `Bearish confirmation below ${bearish.trigger.level}`
    : "Awaiting verified downside confirmation";
  const invalidation = bullish?.invalidation.level
    ?? bearish?.invalidation.level
    ?? "Stand aside if verified references fail or data ages out";
  const bullishLane = rangeLane
    ? scenarioLaneMarkers({
      low: rangeLane.low,
      high: rangeLane.high,
      current: rangeLane.current,
      confirmation: parsePriceLevel(bullish?.trigger.level) ?? rangeLane.high,
      invalidation: parsePriceLevel(bullish?.invalidation.level) ?? rangeLane.low,
    })
    : null;
  const bearishLane = rangeLane
    ? scenarioLaneMarkers({
      low: rangeLane.low,
      high: rangeLane.high,
      current: rangeLane.current,
      confirmation: parsePriceLevel(bearish?.trigger.level) ?? rangeLane.low,
      invalidation: parsePriceLevel(bearish?.invalidation.level) ?? rangeLane.high,
    })
    : null;
  const state = terminalMarketState(snapshot.status, gatewayStatus.connectionStatus, gatewayStatus.fallbackActive);
  const verified = snapshot.status === "LIVE" || snapshot.status === "DELAYED";
  const timestamp = snapshot.quotes.length > 0 ? formatUkTimestamp(snapshot.asOf) : "Unavailable";
  const snapshotAge = formatSnapshotAge(snapshot.asOf);
  const candleAge = candleSeries ? formatFreshnessLabel("candle", candleSeries.dataAgeMs) : null;
  const customerWarnings = formatCustomerParticipationWarnings(
    decision.noTradeReasons,
    decision.dataQualityWarnings,
    plan.eventRiskWarnings.map((warning) => warning.code),
  );
  const showCatalysts = verified && snapshot.events.length > 0;
  const decisionReady = isDecisionReadySnapshot(snapshot);

  void persistAnalysisSnapshot({
    snapshot,
    intelligence,
    decision,
    plan,
    gateway: gatewayStatus,
    kind: "refresh",
    candleRefs: rangeLane
      ? {
        rangeHigh: rangeLane.high,
        rangeLow: rangeLane.low,
        firstClose: rangeLane.firstClose,
        ema20: rangeLane.ema20,
        ema50: rangeLane.ema50,
        latest: rangeLane.current,
      }
      : null,
  });

  return (
    <MemberShell
      active="terminal"
      className="customerTerminal premiumTerminal terminalMemberPage"
      toolbar={<div className="ctToolbar ctTopbar"><TerminalControls /></div>}
    >
      <div className="memberDashboardShell ctWorkspace" id="overview">
        <MarketCommandHeader
          snapshot={snapshot}
          state={state}
          timestamp={timestamp}
          bullseyeScore={verified ? Math.min(decision.confidenceScore, intelligence.scores.bullseyeConfidence) : null}
          posture={verified ? plan.directionalPosture : null}
        />
        <section className={`ctStatus is-${state.toLowerCase()}`} role={verified ? "status" : "alert"}>
          <div>
            <strong>{terminalStatusMessage(snapshot.status, 0, hasDisplayableQuotes(snapshot))}</strong>
            <span>
              {verified
                ? `Verified delayed data when aged. Snapshot age: ${snapshotAge}.${candleAge ? ` ${candleAge}.` : ""}`
                : hasDisplayableQuotes(snapshot)
                  ? `Last verified snapshot age: ${snapshotAge}. Directional guidance stays closed.`
                  : "No live values or directional guidance are being inferred."}
            </span>
          </div>
          {!verified ? <Link href="/terminal">Retry market feed</Link> : null}
        </section>

        <KeyMarketInformation
          snapshot={snapshot}
          intelligence={intelligence}
          decision={decision}
          gatewayStatus={gatewayStatus}
          esSparkline={esSparkline}
          rangeLane={rangeLane}
        />

        {paid && candleSeries ? <section className="ctChartPrimary" aria-label="Primary verified market chart"><DashboardCandlestickChart series={candleSeries} instrument="ES" /></section> : null}
        {!paid ? <LockedPremiumCard tier="pro" title="Unlock the verified market chart" value="Pro and Elite members receive the verified candlestick workspace with interval controls and fail-closed empty states." benefits={["Verified OHLCV history", "Interval controls", "No invented candles"]} previewEligible={previewOffer?.targetTier === "pro" && previewOffer.eligible} previewAvailable={previewState.available} previewCadence={previewOffer?.cadence} /> : null}

        {paid && candleSeriesByInstrument ? (
          <CrossAssetCandleGallery
            seriesByInstrument={candleSeriesByInstrument}
            title="Every live feed with verified candles"
            eyebrow="CROSS-ASSET CANDLESTICKS"
          />
        ) : null}

        {access.features["trade-planner"] ? <TodaysMarketPlan snapshot={snapshot} decision={decision} plan={plan} /> : <LockedPremiumCard tier="elite" title="Unlock today’s complete market plan" value="Elite connects verified cross-asset conditions to a disciplined decision and participation framework." benefits={["Decision confidence", "Participation guidance", "Confirmation checklist"]} previewEligible={previewOffer?.targetTier === "elite" && previewOffer.eligible} previewAvailable={previewState.available} previewCadence={previewOffer?.cadence} />}

        {access.features.intelligence ? <MarketDeskSignalsPanel signals={deskSignals} snapshotAge={snapshotAge} /> : <LockedPremiumCard tier="pro" title="Unlock buying and selling desk signals" value="Pro surfaces interpretive buying and selling leans from verified ES, VIX, Treasuries and dollar inputs — educational only, never executable orders." benefits={["Buying and selling leans", "Verified cross-asset drivers", "Fail-closed when data is thin"]} previewEligible={previewOffer?.targetTier === "pro" && previewOffer.eligible} previewAvailable={previewState.available} previewCadence={previewOffer?.cadence} />}

        {access.features.intelligence ? <MarketDirectionalGaugesPanel gauges={directionalGauges} structure={structureLevels} snapshotAge={snapshotAge} /> : null}

        <AskBullseye
          compact
          context={{
            snapshot,
            intelligence,
            decision,
            plan,
            gateway: gatewayStatus,
            decisionReady,
            bullishConfirm,
            bearishConfirm,
            invalidation,
            noTrade: decision.noTradeReasons,
            dataAge: snapshotAge,
            deskSignals,
          }}
        />

        {customerWarnings.length ? <details className="ctPanel ctConstraintsPanel ctConstraintsCompact" aria-labelledby="customer-warnings-title">
          <summary id="customer-warnings-title"><span>Participation limits</span><strong>Delay and no-trade conditions</strong><small>{customerWarnings.length} items</small></summary>
          <div className="ctConstraints"><ul>{customerWarnings.map((item) => <li key={item}>{item}</li>)}</ul></div>
        </details> : null}

        <details className="ctPanel ctCompactPanel briefTech" open={false}>
          <summary><span>Deeper evidence</span><strong>Cross-asset board and methodology detail</strong></summary>
          <div className="ctDeepEvidence">
            <CrossAssetBoard snapshot={snapshot} sparklines={{ ES: esSparkline, VIX: vixSparkline, DXY: dxySparkline, OIL: oilSparkline, QQQ: qqqSparkline, NQ: nqSparkline }} volatilityRegime={decisionReady ? decision.volatilityRegime : null} />
            {paid && candleSeries ? <StructureLevelsPanel levels={candleLevels} recentRange={candleStats?.averageCandleRange ?? null} rangeLane={rangeLane} /> : null}
            <section className="ctTwoColumn">
              {access.features.intelligence ? <MarketPressureMap snapshot={snapshot} intelligence={intelligence} /> : <LockedPremiumCard tier="pro" title="See what is driving risk appetite" value="Pro explains the verified volatility, Treasury, dollar and equity pressures behind the market view." benefits={["Cross-asset context", "Explainable signals", "Fail-closed analysis"]} previewEligible={previewOffer?.targetTier === "pro" && previewOffer.eligible} previewAvailable={previewState.available} previewCadence={previewOffer?.cadence} />}
              {access.features["decision-engine"] ? <DecisionEnginePanel snapshot={snapshot} decision={decision} plan={plan} /> : <LockedPremiumCard tier="pro" title="Turn evidence into disciplined decisions" value="Pro identifies supporting evidence, conflicts and the confirmations required before conditions become actionable." benefits={["Conflict detection", "Invalidation awareness", "No-trade protection"]} previewEligible={previewOffer?.targetTier === "pro" && previewOffer.eligible} previewAvailable={previewState.available} previewCadence={previewOffer?.cadence} />}
            </section>
            {access.features["decision-engine"] ? <DecisionIntelligencePanel snapshot={snapshot} intelligence={intelligence} decision={decision} bullishLane={bullishLane} bearishLane={bearishLane} /> : null}
          </div>
        </details>

        {showCatalysts ? <section className="ctPanel ctCompactPanel" aria-labelledby="catalysts-title">
          <header><div><span>Upcoming catalysts</span><h2 id="catalysts-title">Verified event window</h2></div></header>
          <div className="ctEvents">{snapshot.events.map((event) => <article key={`${event.time}-${event.name}`}><time>{event.time}</time><strong>{event.name}</strong><span>{event.risk} impact</span></article>)}</div>
        </section> : <EventWindowEmpty
          providerStatus={gatewayStatus.connectionStatus}
          asOfLabel={hasDisplayableQuotes(snapshot) ? `${formatUkTimestamp(snapshot.asOf)} UK · Snapshot age ${snapshotAge}` : null}
          delayed={snapshot.status === "DELAYED" || !decisionReady}
        />}

        <footer className="ctFooter"><span>Educational market intelligence only. Not personalised financial advice. Futures involve substantial risk.</span><Link href="/risk-disclaimer">Read the risk disclosure</Link></footer>
      </div>
    </MemberShell>
  );
}
