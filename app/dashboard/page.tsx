import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server.ts";
import { MemberShell } from "../components/MemberShell.tsx";
import { Founding100Badge } from "../components/Founding100Badge.tsx";
import { SubscriptionStatusCard } from "../components/SubscriptionStatusCard.tsx";
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
import "./direct-dashboard.css";
import "./dashboard-corrections.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Member Dashboard",
  description: "Your daily Bullseye command centre.",
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

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
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
  const name = memberDisplayName(user.email, user.user_metadata);
  const offer = access.previewOffer;
  const portalUrl = "/api/stripe/portal";
  const foundingRecord = founding100.records[0] ?? null;
  const foundingRecords = foundingRecord ? [foundingRecord] : [];

  const marketState = mission.available ? mission.marketCondition : "Awaiting verified data";
  const bias = mission.available ? mission.directionalBias : "Stand aside";
  const confidence = mission.confidence === null ? "—" : `${mission.confidence}`;
  const permission = mission.available ? decision.tradePermission : "Protected";
  const primaryPriority = morningBrief.priorities[0] ?? mission.nextAction;
  const secondaryPriority = morningBrief.priorities[1] ?? mission.keyWarning;
  const firstChecklist = morningBrief.checklist[0] ?? "Confirm verified provider freshness";
  const secondChecklist = morningBrief.checklist[1] ?? "Review event risk before participation";

  return <MemberShell active="dashboard">
    <div className="bullseyeCommand">
      <section className="bullseyeHero">
        <div className="bullseyeHeroCopy">
          <div>
            <span className="bullseyeEyebrow">Bullseye command centre</span>
            <h1>Welcome back, <em>{name}.</em></h1>
            <p>
              Your daily decision workspace—verified market context, scenario discipline and risk controls,
              arranged around the one question that matters: what should you do next?
            </p>
          </div>
          <div className="bullseyeHeroActions">
            <Link href="/terminal">Open Bullseye Terminal <span>↗</span></Link>
            <Link href="/brief">Read today&apos;s brief</Link>
            <Link href="/ideas">Member ideas</Link>
          </div>
        </div>

        <aside className="bullseyeIdentity" aria-label="Membership identity">
          <Image
            src={access.tier === "elite" ? "/brand/elite-member-badge.svg" : "/brand/logo-horizontal.svg"}
            width={320}
            height={80}
            alt={access.tier === "elite" ? "Elite member" : "NASH AI Markets"}
            priority
          />
          <div className="bullseyeIdentityMeta">
            <span>CURRENT ACCESS</span>
            <strong>{access.effectiveTier.toUpperCase()}</strong>
            <small>{previewState.available ? "Entitlement verified" : "Base membership active"}</small>
          </div>
          {foundingRecord ? <div className="bullseyeFounder">
            <Founding100Badge record={foundingRecord} compact />
          </div> : null}
        </aside>
      </section>

      <section className="bullseyeSignalBar" aria-label="Current command summary">
        <article><span>Market state</span><strong>{marketState}</strong><small>{market.gatewayStatus.providerName}</small></article>
        <article><span>Directional bias</span><strong>{bias}</strong><small>{mission.available ? "Verified engine output" : "Safety state active"}</small></article>
        <article><span>Confidence</span><strong>{confidence}</strong><small>{mission.confidence === null ? "Pending verification" : "out of 100"}</small></article>
        <article><span>Trade permission</span><strong>{permission}</strong><small>{market.gatewayStatus.fallbackActive ? "Fallback active" : "Risk controls active"}</small></article>
        <article><span>Next event</span><strong>{nextEvent ? nextEvent.name : "No verified event"}</strong><small>{nextEvent ? nextEvent.risk : "No timing inferred"}</small></article>
      </section>

      <section className="bullseyeMainGrid">
        <article className="bullseyePanel">
          <header className="bullseyePanelHeader">
            <div><span>TODAY&apos;S BULLSEYE</span><h2>Your decision plan</h2></div>
            <TerminalBadge
              label={mission.available ? market.snapshot.status : "protected"}
              tone={mission.available ? "positive" : "warning"}
            />
          </header>

          <div className="bullseyePlanState">
            <div className="bullseyeBias">
              <span>CURRENT POSTURE</span>
              <strong>{bias}</strong>
              <p>{mission.available ? mission.nextAction : "No directional conclusion is shown until the connected market data passes freshness and validation checks."}</p>
            </div>
            <div className="bullseyePlanDetails">
              <div><span>Market condition</span><strong>{marketState}</strong></div>
              <div><span>Key risk</span><strong>{mission.keyWarning}</strong></div>
              <div><span>Priority</span><strong>{primaryPriority}</strong></div>
              <div><span>Review trigger</span><strong>{secondaryPriority}</strong></div>
            </div>
          </div>

          <div className="bullseyeScenarioGrid">
            <section className="bullseyeScenario" data-tone="bull">
              <span>01 / PARTICIPATION CASE</span>
              <h3>Evidence required</h3>
              <p>{firstChecklist}</p>
            </section>
            <section className="bullseyeScenario" data-tone="bear">
              <span>02 / PROTECTION CASE</span>
              <h3>Stand-aside trigger</h3>
              <p>{secondChecklist}</p>
            </section>
          </div>
        </article>

        <article className="bullseyePanel">
          <header className="bullseyePanelHeader">
            <div><span>NEXT RISK WINDOW</span><h2>Economic event</h2></div>
            <TerminalBadge
              label={nextEvent?.risk ?? "protected"}
              tone={nextEvent?.risk === "HIGH" ? "danger" : nextEvent ? "warning" : "neutral"}
            />
          </header>
          {nextEvent ? <div className="bullseyeEventBody">
            <EventCountdown startsAt={nextEvent.startsAt} initialNow={now} />
            <strong>{nextEvent.name}</strong>
            <time dateTime={nextEvent.startsAt}>
              {new Intl.DateTimeFormat("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Europe/London",
              }).format(new Date(nextEvent.startsAt))} UK
            </time>
            <p>Timing is drawn from the verified provider event record and updates automatically.</p>
          </div> : <div className="bullseyeEmpty">
            <i aria-hidden="true" />
            <strong>Event radar is clear</strong>
            <p>No complete future event timestamp is currently verified. Nothing has been invented or estimated.</p>
          </div>}
        </article>
      </section>

      <section className="bullseyeTools" aria-labelledby="bullseye-tools-title">
        <header className="bullseyeToolsHeader">
          <div><span>MISSION TOOLS</span><h2 id="bullseye-tools-title">Go deeper when it matters</h2></div>
        </header>
        <div className="bullseyeToolGrid">
          <Link href="/terminal"><b>01</b><em>↗</em><strong>Terminal</strong><small>Charts, intelligence and structured decisions.</small></Link>
          <Link href="/brief"><b>02</b><em>↗</em><strong>Morning brief</strong><small>Your concise preparation checklist.</small></Link>
          <Link href="/ideas"><b>03</b><em>↗</em><strong>Ideas hub</strong><small>Help shape the product roadmap.</small></Link>
          <Link href="/profile"><b>04</b><em>↗</em><strong>Account</strong><small>Membership, profile and billing controls.</small></Link>
          <Link href="/onboarding"><b>05</b><em>↗</em><strong>Preferences</strong><small>Keep the experience aligned to your workflow.</small></Link>
        </div>
      </section>

      <section className="bullseyeService" aria-label="Service status">
        <details>
          <summary><span>●</span> System and data status <b>View diagnostics</b></summary>
          <div className="bullseyeServiceGrid">
            <div><span>Provider</span><strong>{market.gatewayStatus.providerName}</strong></div>
            <div><span>Connection</span><strong>{market.gatewayStatus.connectionStatus}</strong></div>
            <div><span>Data state</span><strong>{market.snapshot.status}</strong></div>
          </div>
        </details>
      </section>

      {process.env.NEXT_PUBLIC_EASTER_HUNT_ENABLED === "true" ? <section className="bullseyeHunt">
        <aside className="dashboardHuntClue" aria-labelledby="hunt-clue-title">
          <Image src="/brand/logo-mark.svg" width={48} height={48} alt="" />
          <div><span>SEASONAL SIGNAL</span><h2 id="hunt-clue-title">NASH Golden Egg Hunt</h2><p>Five golden signals are hidden away from trading controls.</p></div>
          <Link href="/about">Begin the hunt <span>↗</span></Link>
        </aside>
      </section> : null}

      <section className="bullseyeAccount" aria-label="Membership and account">
        <SubscriptionStatusCard
          tier={access.tier}
          status={membership?.status ?? null}
          billingPlan={membership?.plan ?? null}
          periodEnd={membership?.current_period_end ?? null}
          portalUrl={portalUrl}
          foundingRecords={foundingRecords}
          billingInterval={commercial.membership?.billingInterval ?? null}
          compact
        />
        <section className="dashboardAccessArea" aria-label="Progressive membership access">
          <header><span>YOUR ACCESS</span><h2>Membership depth</h2><p>Account controls stay separate from today&apos;s market decision.</p></header>
          {access.tier === "elite" ? <article className="dailyCard fullyUnlocked">
            <TerminalBadge label="Elite unlocked" tone="warning" />
            <h3>Full Bullseye workflow available</h3>
            <p>Intelligence, decisions, structured planning and diagnostics are included.</p>
            <Link href="/terminal">Open the Elite terminal →</Link>
          </article> : <LockedPremiumCard
            tier={offer!.targetTier}
            title={offer!.targetTier === "pro" ? "Explore explainable decisions" : "Explore structured planning"}
            value={offer!.targetTier === "pro"
              ? "See how Bullseye turns verified inputs into confidence, bias and trade permission."
              : "See how Elite converts a decision into disciplined participation and review triggers."}
            benefits={offer!.targetTier === "pro"
              ? ["Explainable scores", "Decision permission", "Conflict warnings"]
              : ["Structured planner", "Event-risk controls", "Launch diagnostics"]}
            previewEligible={offer!.eligible}
            previewAvailable={previewState.available}
            previewCadence={offer!.cadence}
          />}
        </section>
      </section>

      <section className="bullseyeAccuracy" aria-label="Verified performance status">
        <span>VERIFIED HISTORY</span>
        <strong>{accuracy.status === "verified" ? `${accuracy.accuracyPercent}% directional accuracy` : "Performance verification building"}</strong>
        <small>{accuracy.status === "verified"
          ? `${accuracy.correct} correct classifications from ${accuracy.sampleSize} verified outcomes.`
          : accuracy.status === "insufficient"
            ? `${accuracy.sampleSize} of ${accuracy.required} required outcomes stored. No percentage is shown early.`
            : "Verified outcome history is temporarily unavailable."}</small>
      </section>
    </div>
  </MemberShell>;
}
