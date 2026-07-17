import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server.ts";
import { analyzeMarketSnapshot } from "../lib/market-intelligence-engine.ts";
import { createStructuredTradePlan } from "../lib/structured-trade-planner.ts";
import { createTradingDecision } from "../lib/trading-decision-engine.ts";
import { LockedPremiumCard } from "../terminal/components/LockedPremiumCard.tsx";
import { TerminalBadge } from "../terminal/components/TerminalBadge.tsx";
import { createProgressiveAccess, membershipRedirect, resolveMembershipTier } from "../terminal/lib/membership-entitlement.ts";
import { getTerminalMarketData } from "../terminal/lib/terminal-market-data-provider.ts";
import { loadPreviewClaims } from "../terminal/lib/preview-access.ts";
import { EventCountdown } from "./components/EventCountdown.tsx";
import { buildDailyMission, currentServerTimestamp, memberDisplayName, selectNextEconomicEvent } from "./lib/daily-dashboard.ts";
import { loadAccuracySummary } from "./lib/performance-history.ts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Member Dashboard", description: "Your daily Bullseye market mission and membership access." };

export default async function MemberDashboard() {
  const now = currentServerTimestamp();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const { data: membership, error: membershipError } = await supabase.from("memberships")
    .select("plan, status, current_period_end")
    .ilike("email", user.email)
    .in("plan", ["free", "pro", "elite"])
    .maybeSingle();
  const tier = resolveMembershipTier(membership, Boolean(membershipError), now);
  if (tier === "temporarily_unavailable") redirect(membershipRedirect(tier));
  const [previewState, market, accuracy] = await Promise.all([
    loadPreviewClaims(user.id),
    getTerminalMarketData(undefined, now),
    loadAccuracySummary(),
  ]);
  const access = createProgressiveAccess(tier, previewState.claims, now);
  const intelligence = analyzeMarketSnapshot(market.snapshot);
  const decision = createTradingDecision({ intelligence, reasoning: intelligence.reasoning, dataStatus: market.snapshot.status, providerStatus: market.gatewayStatus.connectionStatus, dataAgeMs: market.gatewayStatus.dataAgeMs, fallbackActive: market.gatewayStatus.fallbackActive, missingDataWarnings: intelligence.reasoning.missingDataWarnings });
  const plan = createStructuredTradePlan({ decision, intelligence, dataStatus: market.snapshot.status, providerStatus: market.gatewayStatus.connectionStatus, dataAgeMs: market.gatewayStatus.dataAgeMs, fallbackActive: market.gatewayStatus.fallbackActive, missingDataWarnings: intelligence.reasoning.missingDataWarnings });
  const mission = buildDailyMission(market.snapshot, intelligence, decision, plan);
  const nextEvent = selectNextEconomicEvent(market.snapshot.events, now);
  const name = memberDisplayName(user.email, user.user_metadata);
  const offer = access.previewOffer;
  const accessCopy = access.tier === "elite"
    ? "Every Bullseye intelligence, decision, planning and diagnostics feature is unlocked."
    : offer?.active
      ? `${offer.targetTier.toUpperCase()} preview active for the current ${offer.cadence} access period.`
      : offer?.eligible
        ? `Your ${offer.cadence} ${offer.targetTier.toUpperCase()} preview is available.`
        : `Your ${offer?.cadence ?? ""} preview has been used and resets automatically.`;

  return <main className="memberDashboard">
    <header className="memberDashboardNav"><Link href="/" className="ftBrand"><span className="ftReticle" aria-hidden="true" /><span>NASH <b>AI</b> / BULLSEYE</span></Link><nav><Link href="/terminal">Open terminal</Link><Link href="/auth/signout">Sign out</Link></nav></header>
    <div className="memberDashboardShell">
      <section className="memberWelcome">
        <div><span>DAILY MEMBER BRIEF</span><h1>Welcome back, {name}.</h1><p>{accessCopy}</p></div>
        <div className="memberAccessStatus"><TerminalBadge label={`${access.tier} member`} tone={access.tier === "elite" ? "warning" : access.tier === "pro" ? "info" : "neutral"} /><strong>{access.effectiveTier.toUpperCase()} ACCESS ACTIVE</strong><small>{previewState.available ? "Preview entitlement verified" : "Preview service unavailable · base access unaffected"}</small></div>
      </section>

      <section className="dailyDashboardGrid">
        <article className="dailyCard todayMission">
          <header><div><span>TODAY’S MISSION</span><h2>What matters now</h2></div><TerminalBadge label={market.snapshot.status} tone={mission.available ? "positive" : "danger"} /></header>
          <dl><div><dt>Current market condition</dt><dd>{mission.marketCondition}</dd></div><div><dt>Bullseye confidence</dt><dd>{mission.confidence === null ? "Unavailable" : `${mission.confidence} / 100`}</dd></div><div><dt>Directional bias</dt><dd>{mission.directionalBias}</dd></div><div><dt>Key risk / no-trade warning</dt><dd>{mission.keyWarning}</dd></div><div><dt>Next important action</dt><dd>{mission.nextAction}</dd></div></dl>
          <Link href="/terminal">Continue into the full terminal →</Link>
        </article>

        <article className="dailyCard nextEventCard">
          <header><div><span>NEXT MAJOR EVENT</span><h2>Economic risk window</h2></div>{nextEvent ? <TerminalBadge label={nextEvent.risk} tone={nextEvent.risk === "HIGH" ? "danger" : "warning"} /> : <TerminalBadge label="Unavailable" tone="neutral" />}</header>
          {nextEvent ? <div className="eventCountdown"><EventCountdown startsAt={nextEvent.startsAt} initialNow={now} /><h3>{nextEvent.name}</h3><time dateTime={nextEvent.startsAt}>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(nextEvent.startsAt))} UK</time><p>Countdown is calculated from the verified provider timestamp and updates automatically.</p></div> : <div className="dashboardUnavailable"><strong>Reliable event timing unavailable</strong><p>The connected provider has not supplied a future event with a complete timestamp. No event or countdown has been inferred.</p></div>}
        </article>

        <article className="dailyCard accuracyCard">
          <header><div><span>VERIFIED HISTORY</span><h2>Bullseye accuracy</h2></div><TerminalBadge label={accuracy.status} tone={accuracy.status === "verified" ? "positive" : "neutral"} /></header>
          {accuracy.status === "verified" ? <div className="accuracyVerified"><strong>{accuracy.accuracyPercent}%</strong><p>{accuracy.correct} correct directional classifications from {accuracy.sampleSize} independently verified outcomes.</p><small>Latest verification: {accuracy.latestVerifiedAt}</small></div> : accuracy.status === "insufficient" ? <div className="dashboardUnavailable"><strong>Insufficient verified history</strong><p>{accuracy.sampleSize} of {accuracy.required} required verified outcomes are stored. No accuracy percentage is shown until the minimum sample is reached.</p></div> : <div className="dashboardUnavailable"><strong>Verified history unavailable</strong><p>The outcome store could not be verified. No performance result has been displayed.</p></div>}
          <footer>Directional classification accuracy only. Not trading returns, profitability, or a guarantee of future results.</footer>
        </article>
      </section>

      <section className="dashboardAccessArea" aria-label="Progressive membership access">
        <header><span>YOUR ACCESS PATH</span><h2>Use more depth when it adds value</h2><p>No artificial deadlines. Preview availability resets on the published UTC cadence.</p></header>
        {access.tier === "elite" ? <article className="dailyCard fullyUnlocked"><TerminalBadge label="Elite unlocked" tone="warning" /><h3>Full decision workflow available</h3><p>Intelligence, decisions, structured planning and launch diagnostics are included in your current membership.</p><Link href="/terminal">Open the Elite terminal →</Link></article> : <LockedPremiumCard tier={offer!.targetTier} title={offer!.targetTier === "pro" ? "Explore the explainable decision workflow" : "Explore structured planning and diagnostics"} value={offer!.targetTier === "pro" ? "See how Bullseye turns verified market inputs into explainable confidence, bias and trade permission." : "See how Elite converts a deterministic decision into disciplined participation, confirmations and review triggers."} benefits={offer!.targetTier === "pro" ? ["Explainable scores", "Decision permission", "Conflict warnings"] : ["Structured planner", "Event-risk controls", "Launch diagnostics"]} previewEligible={offer!.eligible} previewAvailable={previewState.available} previewCadence={offer!.cadence} />}
      </section>
    </div>
  </main>;
}
