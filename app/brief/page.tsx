import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server.ts";
import { MemberShell } from "../components/MemberShell";
import { analyzeMarketSnapshot } from "../lib/market-intelligence-engine";
import {
  availableBriefDrivers,
  availableBriefRisks,
  buildMarketBrief,
} from "../lib/market-brief.ts";
import { createTradingDecision } from "../lib/trading-decision-engine";
import { createStructuredTradePlan } from "../lib/structured-trade-planner";
import {
  formatUkTimestamp,
  isDecisionReadySnapshot,
  formatSnapshotAge,
} from "../lib/market-data";
import { getConfiguredFmpCandlesForInstruments, toCustomerCandleSeries } from "../lib/providers/financial-modeling-prep-candles";
import { generateAIMarketBriefSelection } from "../lib/server/ai-market-brief.ts";
import { getTerminalMarketData } from "../terminal/lib/terminal-market-data-provider";
import { createProgressiveAccess, membershipRedirect, resolveMembershipTier } from "../terminal/lib/membership-entitlement";
import { loadPreviewClaims } from "../terminal/lib/preview-access";
import { readSessionClock } from "../terminal/lib/session-clock";
import { currentServerTimestamp, memberDisplayName } from "../dashboard/lib/daily-dashboard.ts";
import { primaryLevel } from "../dashboard/lib/command-centre.ts";
import { buildDecisionDesk } from "../dashboard/lib/decision-desk.ts";
import { buildDeskGreeting } from "../dashboard/lib/market-weather.ts";
import { deriveSessionReferenceLevels } from "../dashboard/lib/session-levels.ts";
import { MorningMarketBrief } from "./components/MorningMarketBrief";
import { composeMorningMarketBrief } from "./lib/compose-market-brief.ts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Morning Brief | NASH AI Markets",
  description: "A concise verified briefing for S&P 500 futures traders — what changed, what matters now and what to watch or avoid.",
  robots: { index: false, follow: false },
};

/** Premium Market Brief — verified inputs only, fail-closed when incomplete. */
export default async function AIMarketBriefPage() {
  const now = currentServerTimestamp();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("plan, status, current_period_end")
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

  const verified = isDecisionReadySnapshot(snapshot) && intelligence.actionable;
  const support = primaryLevel(snapshot, "support");
  const resistance = primaryLevel(snapshot, "resistance");
  const asOfLabel = formatUkTimestamp(snapshot.asOf);
  const dataAgeLabel = formatUkTimestamp(snapshot.asOf) !== "Timestamp unavailable"
    ? formatSnapshotAge(snapshot.asOf, now)
    : gatewayStatus.dataAgeMs != null
      ? `${Math.max(1, Math.round(gatewayStatus.dataAgeMs / 60_000))}m old`
      : "Age unavailable";

  const rangeHigh = candleSeries?.candles.length
    ? Math.max(...candleSeries.candles.slice(-48).map((candle) => candle.high))
    : null;
  const rangeLow = candleSeries?.candles.length
    ? Math.min(...candleSeries.candles.slice(-48).map((candle) => candle.low))
    : null;
  const expectedMove = verified && rangeHigh != null && rangeLow != null
    ? `${(rangeHigh - rangeLow).toLocaleString("en-GB", { maximumFractionDigits: 2 })} pts (verified 48-bar range)`
    : "Expected move awaits a verified candle range";

  const decisionDesk = buildDecisionDesk({
    verified,
    decision,
    plan,
    intelligence,
    session,
    candles: candleSeries?.candles,
    expectedMoveLabel: expectedMove,
    support: support?.value ?? null,
    resistance: resistance?.value ?? null,
  });

  let selection = null;
  if (verified) {
    const ai = await generateAIMarketBriefSelection({
      marketBias: decision.marketBias,
      tradePermission: decision.tradePermission,
      riskRating: decision.riskRating,
      confidence: decision.confidenceScore,
      availableDrivers: availableBriefDrivers(intelligence, decision),
      availableRisks: availableBriefRisks(decision, plan),
    });
    selection = ai.selection;
  }

  const brief = buildMarketBrief(snapshot, intelligence, decision, plan, selection);
  const greeting = buildDeskGreeting(displayName, session, new Date(now));
  const sessionLevels = candleSeries?.candles?.length
    ? deriveSessionReferenceLevels(candleSeries.candles, Math.floor(now / 1000))
    : null;

  const model = composeMorningMarketBrief({
    brief,
    desk: decisionDesk,
    intelligence,
    decision,
    plan,
    snapshot,
    sessionLevels,
    support: support?.value ?? null,
    resistance: resistance?.value ?? null,
    expectedMoveLabel: expectedMove,
    asOfLabel,
    dataAgeLabel,
    sessionLabel: session.label,
    sessionDetail: session.detail,
    tierLabel: access.tier.toUpperCase(),
    greeting: greeting.name ? `${greeting.salutation}, ${greeting.name}` : greeting.salutation,
    verified,
    youtubeId: null,
  });

  return (
    <MemberShell active="brief">
      <MorningMarketBrief model={model} />
    </MemberShell>
  );
}
