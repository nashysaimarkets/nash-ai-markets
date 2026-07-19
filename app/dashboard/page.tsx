import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server.ts";
import { MemberShell } from "../components/MemberShell.tsx";
import { SubscriptionStatusCard } from "../components/SubscriptionStatusCard.tsx";
import { formatMarketGatewayDataAge } from "../lib/live-market-gateway.ts";
import { analyzeMarketSnapshot } from "../lib/market-intelligence-engine.ts";
import { applyAIMorningBrief, createMorningBrief, MORNING_BRIEF_PLACEHOLDER_INPUT } from "../lib/morning-brief-engine.ts";
import { generateAIMorningBrief } from "../lib/server/ai-morning-brief.ts";
import { loadFounding100ForEmail } from "../lib/server/founding-100.ts";
import { loadCommercialMembership } from "../lib/server/commercial.ts";
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
export const metadata: Metadata = { title: "Member Dashboard", description: "Your daily Bullseye market mission and membership access.", robots: { index: false, follow: false } };

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
    .select("plan, status, current_period_end")
    .ilike("email", user.email)
    .in("plan", ["free", "pro", "elite"])
    .maybeSingle();
  const tier = resolveMembershipTier(membership, Boolean(membershipError), now);
  if (tier === "temporarily_unavailable") redirect(membershipRedirect(tier));
  const [previewState, market, accuracy, founding100, commercial] = await Promise.all([
    loadPreviewClaims(user.id),
    getTerminalMarketData(undefined, now),
    loadAccuracySummary(),
    loadFounding100ForEmail(user.email),
    loadCommercialMembership(user.email),
  ]);
  const access = createProgressiveAccess(tier, previewState.claims, now);
  const intelligence = analyzeMarketSnapshot(market.snapshot);
  const decision = createTradingDecision({ intelligence, reasoning: intelligence.reasoning, dataStatus: market.snapshot.status, providerStatus: market.gatewayStatus.connectionStatus, dataAgeMs: market.gatewayStatus.dataAgeMs, fallbackActive: market.gatewayStatus.fallbackActive, missingDataWarnings: intelligence.reasoning.missingDataWarnings });
  const plan = createStructuredTradePlan({ decision, intelligence, dataStatus: market.snapshot.status, providerStatus: market.gatewayStatus.connectionStatus, dataAgeMs: market.gatewayStatus.dataAgeMs, fallbackActive: market.gatewayStatus.fallbackActive, missingDataWarnings: intelligence.reasoning.missingDataWarnings });
  const mission = buildDailyMission(market.snapshot, intelligence, decision, plan);
  const deterministicMorningBrief = createMorningBrief(mission.available ? {
    source: "verified",
    asOf: market.snapshot.asOf,
    sessionLabel: "London market session",
    marketCondition: mission.marketCondition,
    confidence: mission.confidence,
    directionalBias: mission.directionalBias,
    keyRisk: mission.keyWarning,
    nextAction: mission.nextAction,
  } : MORNING_BRIEF_PLACEHOLDER_INPUT);
  const aiMorningBrief = access.features.intelligence && deterministicMorningBrief.mode === "verified"
    ? await generateAIMorningBrief(deterministicMorningBrief)
    : { status: "not_requested" as const, content: null };
  const morningBrief = applyAIMorningBrief(deterministicMorningBrief, aiMorningBrief);
  const nextEvent = selectNextEconomicEvent(market.snapshot.events, now);
  const pulseState = mission.available
    ? decision.tradePermission === "no-trade" ? "no-trade" : "live"
    : market.gatewayStatus.connectionStatus === "offline" || market.gatewayStatus.fallbackActive ? "awaiting" : "inactive";
  const pulseWaitingFor = mission.available
    ? "The next verified material change"
    : market.gatewayStatus.fallbackActive
      ? "A validated provider snapshot"
      : "Fresh, complete market evidence";
  const pulseSafeAction = mission.available
    ? mission.nextAction
    : "Remain in standby. Refresh only when the provider connection is available.";
  const name = memberDisplayName(user.email, user.user_metadata);
  const offer = access.previewOffer;
  const portalUrl = "/api/stripe/portal";
  const accessCopy = access.tier === "elite"
    ? "Every Bullseye intelligence, decision, planning and diagnostics feature is unlocked."
    : offer?.active
      ? `${offer.targetTier.toUpperCase()} preview active for the current ${offer.cadence} access period.`
      : offer?.eligible
        ? `Your ${offer.cadence} ${offer.targetTier.toUpperCase()} preview is available.`
        : `Your ${offer?.cadence ?? ""} preview has been used and resets automatically.`;
  const accessFeatures = [
    { key: "market-overview" as const, label: "Market overview", tier: "Free", copy: "Provider status and cross-market snapshot" },
    { key: "intelligence" as const, label: "Intelligence", tier: "Pro", copy: "Explainable drivers and scenario evidence" },
    { key: "decision-engine" as const, label: "Decision engine", tier: "Pro", copy: "Bias, conflicts and trade permission" },
    { key: "trade-planner" as const, label: "Trade planner", tier: "Elite", copy: "Participation, confirmations and review triggers" },
    { key: "launch-diagnostics" as const, label: "Diagnostics", tier: "Elite", copy: "Provider health and engine synchronization" },
  ];

  return <MemberShell active="dashboard">
    <div className="memberDashboardShell">
      <section className="memberWelcome">
        <div><span>DAILY MEMBER BRIEF</span><h1>Welcome back, {name}.</h1><p>{accessCopy}</p><div className="memberWelcomeActions"><Link href="/brief">Read today’s market brief</Link><Link href="/terminal">Open full terminal</Link>{access.tier === "pro" || access.tier === "elite" ? <Link href="/founding-member">Founding Member onboarding</Link> : null}</div></div>
        <div className="memberAccessStatus"><TerminalBadge label={`${access.tier} member`} tone={access.tier === "elite" ? "warning" : access.tier === "pro" ? "info" : "neutral"} /><strong>{access.effectiveTier.toUpperCase()} ACCESS ACTIVE</strong><small>{previewState.available ? "Preview entitlement verified" : "Preview service unavailable · base access unaffected"}</small></div>
      </section>

      <section className="sessionPulse" data-pulse-state={pulseState} aria-labelledby="session-pulse-title">
        <div className="sessionPulseVisual" aria-hidden="true">
          <span className="sessionPulseOrbit sessionPulseOrbitOuter" />
          <span className="sessionPulseOrbit sessionPulseOrbitMiddle" />
          <span className="sessionPulseOrbit sessionPulseOrbitInner" />
          <span className="sessionPulseCrosshair" />
          <i />
          <b>{mission.confidence === null ? "—" : mission.confidence}</b>
          <small>{mission.confidence === null ? "STANDBY" : "CONFIDENCE"}</small>
        </div>
        <div className="sessionPulseBody">
          <header>
            <div><span>SESSION PULSE · VERIFIED CONTROL LAYER</span><h2 id="session-pulse-title">{mission.available ? "Market evidence is synchronized" : "Bullseye is holding a safe standby"}</h2></div>
            <TerminalBadge label={pulseState.replace("-", " ")} tone={pulseState === "live" ? "positive" : pulseState === "no-trade" ? "danger" : "warning"} />
          </header>
          <div className="sessionPulseBand">
            <article data-state={mission.available ? "live" : "inactive"}><span>Session status</span><strong>{market.snapshot.status}</strong><small>{mission.available ? "Verified market context" : "No active conclusion"}</small></article>
            <article data-state={market.gatewayStatus.fallbackActive ? "awaiting" : "live"}><span>Provider freshness</span><strong>{formatMarketGatewayDataAge(market.gatewayStatus.dataAgeMs)}</strong><small>{market.gatewayStatus.providerName}</small></article>
            <article data-state={mission.available ? "live" : "inactive"}><span>Market posture</span><strong>{mission.available ? plan.directionalPosture : "STAND ASIDE"}</strong><small>{mission.available ? mission.marketCondition : "Awaiting verified evidence"}</small></article>
            <article data-state={decision.tradePermission === "no-trade" ? "no-trade" : "live"}><span>Trade permission</span><strong>{mission.available ? decision.tradePermission : "NO TRADE"}</strong><small>Fail-closed safety active</small></article>
            <article data-state={mission.confidence === null ? "history" : "live"}><span>Confidence</span><strong>{mission.confidence === null ? "NOT AVAILABLE" : `${mission.confidence} / 100`}</strong><small>{mission.confidence === null ? "No score inferred" : "Verified engine output"}</small></article>
            <article data-state={nextEvent ? "live" : "awaiting"}><span>Next risk event</span><strong>{nextEvent?.name ?? "NOT VERIFIED"}</strong><div className="sessionPulseEvent">{nextEvent ? <EventCountdown startsAt={nextEvent.startsAt} initialNow={now} /> : "No event time inferred"}</div></article>
          </div>
          <footer>
            <div><span>WAITING FOR</span><strong>{pulseWaitingFor}</strong></div>
            <div><span>NEXT SAFE ACTION</span><strong>{pulseSafeAction}</strong></div>
          </footer>
        </div>
      </section>

      <section className="executiveKpiStrip" aria-label="Executive account and market summary">
        <div><span>Market data</span><strong>{market.snapshot.status}</strong><small>{market.gatewayStatus.providerName}</small></div>
        <div><span>Bullseye confidence</span><strong>{mission.confidence === null ? "—" : mission.confidence}</strong><small>{mission.available ? "Verified engine output" : "Unavailable"}</small></div>
        <div><span>Current access</span><strong>{access.effectiveTier.toUpperCase()}</strong><small>{offer?.active ? "Preview active" : `${access.tier} membership`}</small></div>
        <div><span>Trade permission</span><strong>{mission.available ? decision.tradePermission : "NO-TRADE"}</strong><small>{market.gatewayStatus.fallbackActive ? "Fallback active" : "Fail-closed controls active"}</small></div>
      </section>

      <section className="memberAccessMap" aria-labelledby="access-map-title">
        <header>
          <div><span>MEMBERSHIP ACCESS</span><h2 id="access-map-title">Your Bullseye workspace</h2></div>
          <div><TerminalBadge label={`${access.effectiveTier} active`} tone={access.effectiveTier === "elite" ? "warning" : access.effectiveTier === "pro" ? "info" : "neutral"} /><Link href="/pricing">Compare plans</Link></div>
        </header>
        <div>
          {accessFeatures.map((feature) => {
            const unlocked = access.features[feature.key];
            const previewUnlocked = unlocked && access.effectiveTier !== access.tier && feature.tier.toLowerCase() === access.effectiveTier;
            return <article key={feature.key} data-unlocked={unlocked}>
              <span aria-hidden="true">{unlocked ? "✓" : "◇"}</span>
              <div><strong>{feature.label}</strong><small>{feature.copy}</small></div>
              <b>{previewUnlocked ? "Preview" : unlocked ? "Included" : `${feature.tier} required`}</b>
            </article>;
          })}
        </div>
        <footer>
          <span>{offer?.active ? `${offer.targetTier.toUpperCase()} preview capabilities are temporarily active.` : "Access is verified from your current membership on every request."}</span>
          <Link href="/profile">Manage account <span>↗</span></Link>
        </footer>
      </section>

      <section className={`executiveMorningBrief executiveMorningBrief-${morningBrief.mode}`} aria-labelledby="morning-brief-title">
        <header><div><span>{morningBrief.label}</span><h2 id="morning-brief-title">{morningBrief.headline}</h2>{morningBrief.summary ? <p>{morningBrief.summary}</p> : null}</div><div className="morningBriefBadges"><TerminalBadge label={morningBrief.mode} tone={morningBrief.mode === "verified" ? "positive" : morningBrief.mode === "preview" ? "warning" : "danger"} /><TerminalBadge label={morningBrief.generation === "ai-assisted" ? "AI assisted" : "Deterministic"} tone={morningBrief.generation === "ai-assisted" ? "info" : "neutral"} /></div></header>
        <div className="executiveMorningBriefBody">
          <div className="morningBriefSignal"><span>Directional context</span><strong>{morningBrief.directionalBias ?? "Not available"}</strong><small>{morningBrief.confidence === null ? "No confidence score active" : `${morningBrief.confidence} / 100 confidence`}</small></div>
          <div><h3>Executive priorities</h3><ol>{morningBrief.priorities.map((priority) => <li key={priority}>{priority}</li>)}</ol></div>
          <div><h3>Session checklist</h3><ul>{morningBrief.checklist.map((item) => <li key={item}>{item}</li>)}</ul></div>
        </div>
        {morningBrief.warning ? <footer><strong>Safety state:</strong> {morningBrief.warning}<span>Preview fixture timestamp: {morningBrief.asOf}</span></footer> : <footer><span>As of {morningBrief.asOf} · Refresh after material data or event changes.</span><span>{morningBrief.generation === "ai-assisted" ? "OpenAI summarized verified engine evidence only." : morningBrief.aiStatus === "not_requested" ? "Deterministic brief active for current access." : `Deterministic fallback active · ${morningBrief.aiStatus.replaceAll("_", " ")}.`}</span></footer>}
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

      <SubscriptionStatusCard tier={access.tier} status={membership?.status ?? null} billingPlan={membership?.plan ?? null} periodEnd={membership?.current_period_end ?? null} portalUrl={portalUrl} foundingRecords={founding100.records} billingInterval={commercial.membership?.billingInterval ?? null} compact />

      <section className="dashboardAccessArea" aria-label="Progressive membership access">
        <header><span>YOUR ACCESS PATH</span><h2>Use more depth when it adds value</h2><p>No artificial deadlines. Preview availability resets on the published UTC cadence.</p></header>
        {access.tier === "elite" ? <article className="dailyCard fullyUnlocked"><TerminalBadge label="Elite unlocked" tone="warning" /><h3>Full decision workflow available</h3><p>Intelligence, decisions, structured planning and launch diagnostics are included in your current membership.</p><Link href="/terminal">Open the Elite terminal →</Link></article> : <LockedPremiumCard tier={offer!.targetTier} title={offer!.targetTier === "pro" ? "Explore the explainable decision workflow" : "Explore structured planning and diagnostics"} value={offer!.targetTier === "pro" ? "See how Bullseye turns verified market inputs into explainable confidence, bias and trade permission." : "See how Elite converts a deterministic decision into disciplined participation, confirmations and review triggers."} benefits={offer!.targetTier === "pro" ? ["Explainable scores", "Decision permission", "Conflict warnings"] : ["Structured planner", "Event-risk controls", "Launch diagnostics"]} previewEligible={offer!.eligible} previewAvailable={previewState.available} previewCadence={offer!.cadence} />}
      </section>
    </div>
  </MemberShell>;
}
