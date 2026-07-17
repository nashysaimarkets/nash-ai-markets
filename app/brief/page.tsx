import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server.ts";
import { DashboardCard } from "../components/DashboardCard.tsx";
import { MemberShell } from "../components/MemberShell.tsx";
import { SafeState } from "../components/SafeState.tsx";
import { currentServerTimestamp } from "../dashboard/lib/daily-dashboard.ts";
import { analyzeMarketSnapshot } from "../lib/market-intelligence-engine.ts";
import {
  availableBriefDrivers,
  availableBriefRisks,
  buildMarketBrief,
} from "../lib/market-brief.ts";
import { generateAIMarketBriefSelection } from "../lib/server/ai-market-brief.ts";
import { createStructuredTradePlan } from "../lib/structured-trade-planner.ts";
import { createTradingDecision } from "../lib/trading-decision-engine.ts";
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
  title: "AI Market Brief",
  description: "A grounded market brief built from verified Bullseye engine evidence.",
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

  const [previewState, market] = await Promise.all([
    loadPreviewClaims(user.id),
    getTerminalMarketData(undefined, now),
  ]);
  const access = createProgressiveAccess(tier, previewState.claims, now);
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
  const statusTone = brief.mode === "ai-assisted"
    ? "positive"
    : brief.mode === "unavailable"
      ? "danger"
      : "info";

  return <MemberShell active="brief" className="marketBriefPage">
    <div className="memberDashboardShell">
      <section className="briefHero">
        <div>
          <span>SPRINT BETA · DAILY INTELLIGENCE</span>
          <h1>AI Market Brief</h1>
          <p>A concise, evidence-grounded view of current conditions. AI may prioritize verified engine signals, but it cannot invent prices, levels, forecasts, or trade instructions.</p>
        </div>
        <div className="briefHeroStatus">
          <TerminalBadge label={brief.mode} tone={statusTone} />
          <strong>{access.effectiveTier.toUpperCase()} ACCESS</strong>
          <small>{brief.sourceLabel}</small>
        </div>
      </section>

      {brief.mode === "unavailable" ? <SafeState title={brief.headline} tone="danger"><p>{brief.summary}</p><Link href="/brief">Refresh brief</Link></SafeState> : null}

      <section className="briefGrid">
        <DashboardCard
          eyebrow="EXECUTIVE BRIEF"
          title={brief.headline}
          className="briefExecutive"
          badge={<TerminalBadge label={market.snapshot.status} tone={market.snapshot.status === "LIVE" ? "positive" : market.snapshot.status === "DELAYED" ? "warning" : "danger"} />}
        >
          <div className="briefExecutiveBody">
            <p>{brief.summary}</p>
            <dl>
              <div><dt>Market bias</dt><dd>{brief.marketBias}</dd></div>
              <div><dt>Confidence</dt><dd>{brief.confidence === null ? "Unavailable" : `${brief.confidence} / 100`}</dd></div>
              <div><dt>Trade permission</dt><dd>{brief.tradePermission}</dd></div>
              <div><dt>As of</dt><dd>{brief.asOf ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(brief.asOf)) : "Unavailable"}</dd></div>
            </dl>
          </div>
        </DashboardCard>

        <DashboardCard eyebrow="WHAT MATTERS" title="Priority evidence" className="briefEvidence">
          {brief.focusDrivers.length ? <ol>{brief.focusDrivers.map((driver) => <li key={driver}>{driver}</li>)}</ol> : <SafeState title="Evidence unavailable"><p>No verified evidence has been selected.</p></SafeState>}
        </DashboardCard>

        <DashboardCard eyebrow="RISK CONTROL" title="Reasons to slow down" className="briefRisk">
          {brief.riskFlags.length ? <ul>{brief.riskFlags.map((risk) => <li key={risk}>{risk}</li>)}</ul> : <SafeState title="No critical engine warning"><p>Continue to respect the deterministic invalidation and data-quality checks.</p></SafeState>}
        </DashboardCard>

        <DashboardCard eyebrow="NEXT REVIEW" title="Before conditions change" className="briefActions">
          {brief.nextActions.length ? <ol>{brief.nextActions.map((action) => <li key={action}>{action}</li>)}</ol> : <SafeState title="Wait for verified data"><p>The brief will provide review conditions after the provider recovers.</p></SafeState>}
        </DashboardCard>
      </section>

      {access.features.intelligence ? <section className="briefIntegrity" aria-label="AI brief integrity">
        <div><span>AI STATUS</span><strong>{brief.mode === "ai-assisted" ? "Grounded prioritisation active" : "Deterministic fallback active"}</strong></div>
        <p>{brief.mode === "ai-assisted" ? "The model selected only from engine-provided evidence codes. All displayed language is deterministic." : "OpenAI is unavailable or not configured. The same verified engines produced this brief without an external AI dependency."}</p>
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
