import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server.ts";
import { MemberShell } from "../components/MemberShell";
import {
  availableBriefDrivers,
  availableBriefRisks,
  buildMarketBrief,
} from "../lib/market-brief.ts";
import { formatUkTimestamp } from "../lib/market-data";
import { generateAIMarketBriefSelection } from "../lib/server/ai-market-brief.ts";
import { createProgressiveAccess, membershipRedirect, resolveMembershipTier } from "../terminal/lib/membership-entitlement";
import { loadPreviewClaims } from "../terminal/lib/preview-access";
import { currentServerTimestamp, memberDisplayName } from "../dashboard/lib/daily-dashboard.ts";
import { primaryLevel } from "../dashboard/lib/command-centre.ts";
import { buildDecisionDesk } from "../dashboard/lib/decision-desk.ts";
import { buildDeskGreeting } from "../dashboard/lib/market-weather.ts";
import { deriveSessionReferenceLevels } from "../dashboard/lib/session-levels.ts";
import { composeMorningMarketBrief } from "./lib/compose-market-brief.ts";
import { buildAiMarketInsight } from "../lib/ai-market-insight.ts";
import { buildOracleBundle } from "../lib/oracle/build-oracle-bundle.ts";
import { MorningMarketBrief } from "./components/MorningMarketBrief";
import { getVerifiedMarketContext } from "../lib/verified-market-context.ts";
import { sanitizeForClient } from "../lib/serialize-for-client.ts";
import { createUnavailableSnapshot } from "../lib/market-data.ts";
import { analyzeMarketSnapshot } from "../lib/market-intelligence-engine.ts";
import { createTradingDecision } from "../lib/trading-decision-engine.ts";
import { createStructuredTradePlan } from "../lib/structured-trade-planner.ts";
import { readSessionClock } from "../terminal/lib/session-clock.ts";
import { createUnconfiguredMarketGatewayStatus } from "../lib/live-market-gateway.ts";
import { formatDelayedVerifiedCandleAgeDisplay } from "../lib/freshness-labels.ts";
import { resolveSessionMarketVideos } from "../lib/market-video/session-placement.ts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Morning Brief | NASH AI Markets",
  description: "A concise verified briefing for S&P 500 futures traders — what changed, what matters now and what to watch or avoid.",
  robots: { index: false, follow: false },
};

/** Premium Market Brief — verified inputs first; AI narrative is optional and fail-soft. */
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
  const tierLabel = access.tier.charAt(0).toUpperCase() + access.tier.slice(1).toLowerCase();

  try {
    const context = await getVerifiedMarketContext({ paid, now, route: "/brief" });
    const { snapshot, intelligence, decision, plan, session, verified, candles } = context;
    const support = primaryLevel(snapshot, "support");
    const resistance = primaryLevel(snapshot, "resistance");
    const asOfLabel = formatUkTimestamp(snapshot.asOf);
    const dataAgeLabel = formatDelayedVerifiedCandleAgeDisplay(candles?.dataAgeMs ?? null);
    const rangeHigh = candles?.candles.length
      ? Math.max(...candles.candles.slice(-48).map((candle) => candle.high))
      : null;
    const rangeLow = candles?.candles.length
      ? Math.min(...candles.candles.slice(-48).map((candle) => candle.low))
      : null;
    const expectedMove =
      verified && rangeHigh != null && rangeLow != null && Number.isFinite(rangeHigh - rangeLow)
        ? `${(rangeHigh - rangeLow).toLocaleString("en-GB", { maximumFractionDigits: 2 })} pts (verified 48-bar range)`
        : "Expected move awaits a verified candle range";

    const decisionDesk = buildDecisionDesk({
      verified,
      decision,
      plan,
      intelligence,
      session,
      candles: candles?.candles,
      expectedMoveLabel: expectedMove,
      support: support?.value ?? null,
      resistance: resistance?.value ?? null,
    });

    let selection = null;
    if (verified) {
      try {
        const ai = await generateAIMarketBriefSelection({
          marketBias: decision.marketBias,
          tradePermission: decision.tradePermission,
          riskRating: decision.riskRating,
          confidence: decision.confidenceScore,
          availableDrivers: availableBriefDrivers(intelligence, decision),
          availableRisks: availableBriefRisks(decision, plan),
        });
        selection = ai.selection;
      } catch (error) {
        console.error("[brief] optional AI selection failed", {
          name: error instanceof Error ? error.name : "Error",
          correlationId: context.correlationId,
        });
      }
    }

    const brief = buildMarketBrief(snapshot, intelligence, decision, plan, selection);
    const greeting = buildDeskGreeting(displayName, session, new Date(now));
    const sessionVideos = resolveSessionMarketVideos({ phase: session.phase, now });
    const sessionLevels = candles?.candles?.length
      ? deriveSessionReferenceLevels(candles.candles, Math.floor(now / 1000))
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
      tierLabel,
      greeting: greeting.name ? `${greeting.salutation}, ${greeting.name}` : greeting.salutation,
      briefHeadline: greeting.briefHeadline,
      verified,
      videoSlot: sessionVideos.briefPrimary,
      earlierVideoSlot: sessionVideos.briefEarlier,
      sessionPhase: session.phase,
      now,
    });

    const insight = buildAiMarketInsight({
      snapshot,
      intelligence,
      decision,
      plan,
      verified,
      now,
    });
    const oracle = buildOracleBundle({
      snapshot,
      intelligence,
      decision,
      plan,
      session,
      verified,
      freshnessLabel: dataAgeLabel,
      candles: candles?.candles ?? null,
      support: support?.value ?? null,
      resistance: resistance?.value ?? null,
      expectedMoveLabel: expectedMove,
      now,
    });

    const props = sanitizeForClient({
      model,
      insight,
      oracle,
      contextStatus: context.status,
      missingInputs: context.missingInputs,
      correlationId: context.correlationId,
      archiveAvailable: sessionVideos.archive.length > 0,
    });

    return (
      <MemberShell active="brief">
        {props.contextStatus !== "complete" ? (
          <aside className="dashPartialBanner" role="status">
            <strong>
              {props.contextStatus === "unavailable"
                ? "Morning Brief is running with limited verified context"
                : "Partial Morning Brief"}
            </strong>
            <span>
              Deterministic sections remain available.{" "}
              {props.missingInputs.length
                ? `Awaiting: ${props.missingInputs.slice(0, 3).join("; ")}.`
                : null}{" "}
              Ref {props.correlationId}.
            </span>
            <div>
              <Link href="/brief">Retry brief</Link>
              <Link href="/terminal">Open Trading Desk</Link>
              <Link href="/dashboard">Show dashboard context</Link>
            </div>
          </aside>
        ) : null}
        <MorningMarketBrief
          model={props.model}
          insight={props.insight}
          oracle={props.oracle}
          archiveAvailable={props.archiveAvailable}
        />
      </MemberShell>
    );
  } catch (error) {
    console.error("[brief] page failed; rendering recovery shell", {
      name: error instanceof Error ? error.name : "Error",
    });
    const snapshot = createUnavailableSnapshot();
    const gatewayStatus = createUnconfiguredMarketGatewayStatus("Brief recovery");
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
    const decisionDesk = buildDecisionDesk({
      verified: false,
      decision,
      plan,
      intelligence,
      session,
      candles: undefined,
      expectedMoveLabel: "Unavailable",
      support: null,
      resistance: null,
    });
    const brief = buildMarketBrief(snapshot, intelligence, decision, plan, null);
    const greeting = buildDeskGreeting(displayName, session, new Date(now));
    const sessionVideos = resolveSessionMarketVideos({ phase: session.phase, now });
    const model = composeMorningMarketBrief({
      brief,
      desk: decisionDesk,
      intelligence,
      decision,
      plan,
      snapshot,
      sessionLevels: null,
      support: null,
      resistance: null,
      expectedMoveLabel: "Unavailable",
      asOfLabel: formatUkTimestamp(snapshot.asOf),
      dataAgeLabel: "Delayed market data · age unavailable",
      sessionLabel: session.label,
      sessionDetail: session.detail,
      tierLabel,
      greeting: greeting.name ? `${greeting.salutation}, ${greeting.name}` : greeting.salutation,
      briefHeadline: greeting.briefHeadline,
      verified: false,
      videoSlot: sessionVideos.briefPrimary,
      earlierVideoSlot: sessionVideos.briefEarlier,
      sessionPhase: session.phase,
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
    const props = sanitizeForClient({
      model,
      insight,
      oracle,
      archiveAvailable: sessionVideos.archive.length > 0,
    });

    return (
      <MemberShell active="brief">
        <aside className="dashPartialBanner is-critical" role="alert">
          <strong>Brief recovered in safe mode</strong>
          <span>No invented market narrative is shown. Retry or continue on the Trading Desk.</span>
          <div>
            <Link href="/brief">Retry brief</Link>
            <Link href="/terminal">Open Trading Desk</Link>
            <Link href="/dashboard">Open Dashboard</Link>
          </div>
        </aside>
        <MorningMarketBrief
          model={props.model}
          insight={props.insight}
          oracle={props.oracle}
          archiveAvailable={props.archiveAvailable}
        />
      </MemberShell>
    );
  }
}
