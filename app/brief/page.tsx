import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server.ts";
import { DashboardCard } from "../components/DashboardCard.tsx";
import { MemberShell } from "../components/MemberShell.tsx";
import { SafeState } from "../components/SafeState.tsx";
import { currentServerTimestamp } from "../dashboard/lib/daily-dashboard.ts";
import { formatScoreDisplay, scoreIsDisplayable } from "../dashboard/lib/score-display.ts";
import { analyzeMarketSnapshot } from "../lib/market-intelligence-engine.ts";
import {
  availableBriefDrivers,
  availableBriefRisks,
  buildMarketBrief,
} from "../lib/market-brief.ts";
import { generateAIMarketBriefSelection } from "../lib/server/ai-market-brief.ts";
import { createStructuredTradePlan } from "../lib/structured-trade-planner.ts";
import { createTradingDecision } from "../lib/trading-decision-engine.ts";
import { formatSnapshotAge, isDecisionReadySnapshot } from "../lib/market-data.ts";
import { BullseyeGauge } from "../components/mini-visuals/BullseyeGauge.tsx";
import { getConfiguredFmpCandles, toCustomerCandleSeries } from "../lib/providers/financial-modeling-prep-candles.ts";
import { parsePriceLevel, sparklineFromCandles } from "../components/mini-visuals/mini-visual-data.ts";
import { CrossAssetBoard } from "../terminal/components/CustomerTerminal.tsx";
import { LockedPremiumCard } from "../terminal/components/LockedPremiumCard.tsx";
import { TerminalBadge } from "../terminal/components/TerminalBadge.tsx";
import {
  createProgressiveAccess,
  membershipRedirect,
  resolveMembershipTier,
} from "../terminal/lib/membership-entitlement.ts";
import { loadPreviewClaims } from "../terminal/lib/preview-access.ts";
import { getTerminalMarketData } from "../terminal/lib/terminal-market-data-provider.ts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Market Brief | NASH AI Markets",
  description: "A plain-English daily briefing from verified Bullseye engine evidence.",
  robots: { index: false, follow: false },
};

export default async function AIMarketBriefPage() {
  const now = currentServerTimestamp();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("plan, status, current_period_end")
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
  const access = createProgressiveAccess(tier, previewState.claims, now);
  const candleSeries = candleSeriesRaw ? toCustomerCandleSeries(candleSeriesRaw) : null;
  const esSparkline = candleSeries?.candles.length ? sparklineFromCandles(candleSeries.candles) : null;
  const decisionReady = isDecisionReadySnapshot(market.snapshot);
  const delayed = market.snapshot.status === "DELAYED" || !decisionReady;
  const intelligence = analyzeMarketSnapshot(market.snapshot);
  const engineInput = {
    intelligence,
    reasoning: intelligence.reasoning,
    dataStatus: market.snapshot.status,
    providerStatus: market.gatewayStatus.connectionStatus,
    dataAgeMs: market.gatewayStatus.dataAgeMs,
    fallbackActive: market.gatewayStatus.fallbackActive,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  } as const;
  const decision = createTradingDecision(engineInput);
  const plan = createStructuredTradePlan({
    decision,
    intelligence,
    dataStatus: engineInput.dataStatus,
    providerStatus: engineInput.providerStatus,
    dataAgeMs: engineInput.dataAgeMs,
    fallbackActive: engineInput.fallbackActive,
    missingDataWarnings: engineInput.missingDataWarnings,
  });
  const baseline = buildMarketBrief(market.snapshot, intelligence, decision, plan);
  const canUseAI = access.features.intelligence && baseline.mode !== "unavailable";
  const aiResult = canUseAI
    ? await generateAIMarketBriefSelection({
      marketBias: decision.marketBias,
      tradePermission: decision.tradePermission,
      riskRating: decision.riskRating,
      confidence: decision.confidenceScore,
      availableDrivers: availableBriefDrivers(intelligence, decision),
      availableRisks: availableBriefRisks(decision, plan),
    })
    : { status: "not_configured" as const, selection: null };
  const brief = buildMarketBrief(
    market.snapshot,
    intelligence,
    decision,
    plan,
    aiResult.selection,
  );
  const scoreReady = brief.mode !== "unavailable" && scoreIsDisplayable(brief.confidence, true);
  const statusTone = brief.mode === "ai-assisted"
    ? "positive"
    : brief.mode === "unavailable"
      ? "danger"
      : "info";

  return <MemberShell active="brief" className="marketBriefPage">
    <div className="memberDashboardShell">
      <section className="briefHero">
        <div>
          <span>DAILY MARKET BRIEF</span>
          <h1>Market Brief</h1>
          <p>Plain-English answers first. Technical evidence underneath. Deterministic wording even when AI prioritisation is active.</p>
        </div>
        <div className="briefHeroStatus">
          <TerminalBadge label={brief.mode === "ai-assisted" ? "Deterministic + AI prioritisation" : brief.mode} tone={statusTone} />
          <strong>{access.effectiveTier.toUpperCase()} ACCESS</strong>
          <small>{brief.sourceLabel}</small>
        </div>
      </section>

      {brief.mode === "unavailable" ? <SafeState title={brief.headline} tone="danger"><p>{brief.summary}</p><Link href="/brief">Refresh brief</Link></SafeState> : null}

      {(() => {
        const find = (symbol: string) => market.snapshot.quotes.find((item) => item.symbol === symbol);
        const es = find("ES");
        const vix = find("VIX");
        const two = parsePriceLevel(find("US2Y")?.value);
        const ten = parsePriceLevel(find("US10Y")?.value);
        const dxy = find("DXY");
        const spread = two != null && ten != null ? ten - two : null;
        return <section className="briefKeyRibbon" aria-label="Key market information">
          <article><span>ES</span><strong>{es?.value ?? "—"}</strong><small>{es?.change ?? "Unavailable"}</small></article>
          <article><span>VIX</span><strong>{vix?.value ?? "—"}</strong><small>{decisionReady ? decision.volatilityRegime : "Not rated"}</small></article>
          <article><span>Rates spread</span><strong>{spread != null ? `${spread >= 0 ? "+" : ""}${spread.toFixed(2)} pp` : "—"}</strong><small>10Y − 2Y</small></article>
          <article><span>DXY</span><strong>{dxy?.value ?? "—"}</strong><small>{dxy?.change ?? "Unavailable"}</small></article>
          <article><span>Next event</span><strong>{market.snapshot.events[0]?.name ?? "Awaiting schedule"}</strong><small>{market.snapshot.events[0]?.time ?? "Unverified excluded"}</small></article>
          <article><span>Bullseye posture</span><strong>{decisionReady ? plan.directionalPosture.replaceAll("_", " ") : "Stand aside"}</strong><small>{formatSnapshotAge(market.snapshot.asOf)}</small></article>
        </section>;
      })()}

      <section className="briefCommand" aria-label="Brief decision summary">
        <div className="briefCommandGauge">
          <BullseyeGauge
            score={brief.confidence}
            ready={scoreReady}
            posture={plan.directionalPosture}
            delayed={delayed}
            compact
          />
        </div>
        <div className="briefCommandCopy">
          <span>WHAT HAPPENED</span>
          <h2>{brief.headline}</h2>
          <p>{brief.whatHappened}</p>
          <p>{brief.whatMatters}</p>
          <dl>
            <div><dt>Market bias</dt><dd>{brief.mode === "unavailable" ? "Not inferred" : brief.marketBias}</dd></div>
            <div><dt>Trade permission</dt><dd>{brief.tradePermission}</dd></div>
            <div><dt>Risk rating</dt><dd>{brief.riskRating ?? "Not rated"}</dd></div>
            <div><dt>Information age</dt><dd>{brief.informationAge}</dd></div>
            <div><dt>As of</dt><dd>{brief.asOf ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(brief.asOf)) : "Unavailable"}</dd></div>
            <div><dt>Score</dt><dd>{formatScoreDisplay(brief.confidence, scoreReady)}</dd></div>
          </dl>
        </div>
      </section>

      <div className="briefCrossAsset">
        <CrossAssetBoard
          snapshot={market.snapshot}
          sparklines={{ ES: esSparkline }}
          volatilityRegime={decisionReady ? decision.volatilityRegime : null}
          compact
        />
      </div>

      <section className="briefGrid">
        <DashboardCard eyebrow="SUPPORT VERSUS CONSTRAINT" title="What is helping or blocking risk appetite" className="briefEvidence">
          <p>{brief.supporting}</p>
          <p>{brief.constraining}</p>
          {brief.focusDrivers.length ? <ol>{brief.focusDrivers.map((driver) => <li key={driver}>{driver}</li>)}</ol> : null}
        </DashboardCard>

        <DashboardCard eyebrow="LEVELS AND PATHS" title="What would change the case" className="briefEvidence">
          <p>{brief.levelsMatter}</p>
          <p>{brief.bullishImprove}</p>
          <p>{brief.bearishImprove}</p>
          {brief.scenarios.length ? <ul>{brief.scenarios.map((note) => <li key={note}>{note}</li>)}</ul> : <p>No unsupported directional probabilities are shown.</p>}
        </DashboardCard>

        <DashboardCard eyebrow="RISK CONTROL" title="When to avoid trading" className="briefRisk">
          <p>{brief.avoidWhen}</p>
          {brief.riskFlags.length ? <ul>{brief.riskFlags.map((risk) => <li key={risk}>{risk}</li>)}</ul> : null}
        </DashboardCard>

        <DashboardCard eyebrow="NEXT EVENT" title="Verified catalyst window" className="briefActions">
          <p>{brief.nextEvent}</p>
          {brief.nextActions.length ? <ol>{brief.nextActions.map((action) => <li key={action}>{action}</li>)}</ol> : null}
        </DashboardCard>
      </section>

      {access.features.intelligence ? <section className="briefIntegrity" aria-label="Brief integrity">
        <div><span>OUTPUT MODE</span><strong>{brief.mode === "ai-assisted" ? "Deterministic wording with AI evidence prioritisation" : "Deterministic engine brief"}</strong></div>
        <p>{brief.mode === "ai-assisted" ? "AI may only reorder engine-provided evidence codes. It cannot invent prices, levels, probabilities or trade instructions." : "OpenAI is unavailable or unused. The verified engines produced this brief without an external AI dependency."}</p>
      </section> : <LockedPremiumCard
        tier="pro"
        title="Add AI-assisted evidence prioritisation"
        value="Pro can use a constrained AI pass to order verified Bullseye drivers while preserving deterministic decisions and fail-closed safety."
        benefits={["Grounded evidence ordering", "No invented market levels", "Deterministic fallback"]}
        previewEligible={access.previewOffer?.eligible ?? false}
        previewAvailable={previewState.available}
        previewCadence={access.previewOffer?.cadence}
      />}

      <footer className="briefDisclaimer">
        <strong>Decision support, not financial advice.</strong>
        <span>No brief places trades or guarantees outcomes. Confirm market data, suitability and risk independently.</span>
      </footer>
    </div>
  </MemberShell>;
}
