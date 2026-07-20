import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server.ts";
import { MemberShell } from "../components/MemberShell.tsx";
import { SubscriptionStatusCard } from "../components/SubscriptionStatusCard.tsx";
import { analyzeMarketSnapshot } from "../lib/market-intelligence-engine.ts";
import { applyAIMorningBrief, createMorningBrief, MORNING_BRIEF_PLACEHOLDER_INPUT } from "../lib/morning-brief-engine.ts";
import { generateAIMorningBrief } from "../lib/server/ai-morning-brief.ts";
import { loadFounding100ForEmail } from "../lib/server/founding-100.ts";
import { createStructuredTradePlan } from "../lib/structured-trade-planner.ts";
import { createTradingDecision } from "../lib/trading-decision-engine.ts";
import { LockedPremiumCard } from "../terminal/components/LockedPremiumCard.tsx";
import { TerminalBadge } from "../terminal/components/TerminalBadge.tsx";
import { createProgressiveAccess, membershipRedirect, resolveMembershipTier } from "../terminal/lib/membership-entitlement.ts";
import { getTerminalMarketData } from "../terminal/lib/terminal-market-data-provider.ts";
import { loadPreviewClaims } from "../terminal/lib/preview-access.ts";
import { EventCountdown } from "./components/EventCountdown.tsx";
import { EliteScenarioCard } from "./components/EliteScenarioCard.tsx";
import { EliteConversionPreview } from "./components/EliteConversionPreview.tsx";
import { EliteOnboardingChecklist } from "./components/EliteOnboardingChecklist.tsx";
import { BullseyeSignature } from "./components/BullseyeSignature.tsx";
import { BullseyeMissionControl } from "./components/BullseyeMissionControl.tsx";
import { MarketStructureVisual } from "./components/MarketStructureVisual.tsx";
import { TodaysBullseyePlan } from "./components/TodaysBullseyePlan.tsx";
import { TodaysEdge } from "./components/TodaysEdge.tsx";
import { buildDailyMission, currentServerTimestamp, memberDisplayName, selectNextEconomicEvent } from "./lib/daily-dashboard.ts";
import { commandCentreState, marketSessionState, primaryLevel } from "./lib/command-centre.ts";
import { loadAccuracySummary } from "./lib/performance-history.ts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "BULLSEYE Command Centre", description: "Authenticated market intelligence, scenario analysis and verified data status.", robots: { index: false, follow: false } };

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
  const [previewState, market, accuracy, founding100] = await Promise.all([
    loadPreviewClaims(user.id),
    getTerminalMarketData(undefined, now),
    loadAccuracySummary(),
    loadFounding100ForEmail(user.email),
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
  const directionalContext = morningBrief.directionalBias ?? "Not available";
  const nextEvent = selectNextEconomicEvent(market.snapshot.events, now);
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
  const bullishScenario = intelligence.scenarios.find((scenario) => scenario.type === "BULLISH")!;
  const bearishScenario = intelligence.scenarios.find((scenario) => scenario.type === "BEARISH")!;
  const verifiedMarket = (
    market.snapshot.status === "LIVE" || market.snapshot.status === "DELAYED"
  ) && intelligence.actionable && intelligence.reasoning.missingDataWarnings.length === 0;
  const marketTimestamp = (market.snapshot.status === "LIVE" || market.snapshot.status === "DELAYED")
    && Number.isFinite(Date.parse(market.snapshot.asOf))
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(market.snapshot.asOf))
    : "No verified timestamp";
  const expectedMove = "Not supplied";
  const session = marketSessionState(now);
  const centreState = commandCentreState(market.snapshot, market.gatewayStatus, session.label);
  const support = primaryLevel(market.snapshot, "support");
  const resistance = primaryLevel(market.snapshot, "resistance");
  const stateCopy = { live: "Verified current inputs are available.", delayed: "Verified inputs are delayed; check the timestamp before use.", stale: "The last snapshot is too old for current analytics.", unavailable: "The provider is unavailable; current analytics are withheld.", partial: "Some required instruments or levels are missing.", closed: "The major session is closed; the last verified context remains labelled." }[centreState];
  const statusPresentation = {
    live: { label: "Live verified", symbol: "✓", detail: "Current provider inputs cleared" },
    delayed: { label: "Delayed", symbol: "D", detail: "Timestamp review required" },
    stale: { label: "Stale", symbol: "!", detail: "Current analytics withheld" },
    unavailable: { label: "Unavailable", symbol: "×", detail: "Provider safety state active" },
    partial: { label: "Partial", symbol: "P", detail: "Required inputs incomplete" },
    closed: { label: "Market closed", symbol: "C", detail: "Last context remains labelled" },
  }[centreState];

  return <MemberShell active="dashboard">
    <div className="memberDashboardShell eliteDashboard">
      <section className="eliteCommandHeader">
        <BullseyeSignature />
        <div className="eliteCommandIntro">
          <span className="eliteEyebrow">NASH AI MARKETS <i /> ELITE INTELLIGENCE</span>
          <h1>BULLSEYE<br /><em>Command Centre.</em></h1>
          <p><strong>Good {new Date(now).getUTCHours() < 12 ? "morning" : new Date(now).getUTCHours() < 18 ? "afternoon" : "evening"}, {name}.</strong> {accessCopy}</p>
          <span className="eliteAdviceLabel">Market intelligence, not financial advice</span>
        </div>
        <div className="eliteHeaderMeta">
          <div className={`eliteFeedState is${market.snapshot.status}`}><i aria-hidden="true" /><span>DATA FEED</span><strong>{statusPresentation.label}</strong><small>{market.gatewayStatus.providerName}</small></div>
          <div><span>LAST VERIFIED</span><strong>{marketTimestamp} UK</strong><small>{statusPresentation.detail}</small></div>
          <div><span>SESSION</span><strong>{session.label}</strong><small>{session.detail}</small></div>
        </div>
        <div className="eliteCommandActions">
          <Link href="/terminal" className="elitePrimaryAction"><span><small>FULL WORKSPACE</small>Open terminal</span><b aria-hidden="true">→</b></Link>
          <Link href="/brief" className="eliteSecondaryAction"><span><small>DAILY READ</small>Morning brief</span><b aria-hidden="true">↗</b></Link>
          {access.tier === "pro" || access.tier === "elite" ? <Link href="/founding-member" className="eliteTertiaryAction">Founding onboarding <span aria-hidden="true">→</span></Link> : null}
        </div>
      </section>

      <section className={`commandDataNotice is-${centreState}`} aria-live="polite" aria-label={`${statusPresentation.label} market data state`}>
        <div className="commandStateIdentity"><i aria-hidden="true">{statusPresentation.symbol}</i><div><strong>{statusPresentation.label}</strong><span>{stateCopy}</span></div></div>
        <div><span>Last verified update</span><strong>{marketTimestamp} UK</strong></div>
        {access.features["launch-diagnostics"] ? <Link href="/terminal/diagnostics">Data diagnostics <span aria-hidden="true">→</span></Link> : null}
      </section>

      <TodaysEdge
        verified={verifiedMarket}
        marketCondition={mission.marketCondition}
        directionalBias={mission.directionalBias}
        keyRisk={mission.keyWarning}
        nextAction={mission.nextAction}
        dataLabel={statusPresentation.label}
        lastUpdated={marketTimestamp === "No verified timestamp" ? marketTimestamp : `${marketTimestamp} UK`}
        confidence={mission.confidence}
        analysisMode={morningBrief.generation === "ai-assisted" ? "AI assisted" : "Deterministic"}
      />

      {access.tier === "elite" ? <EliteOnboardingChecklist /> : null}

      <section className="eliteStatusDeck executiveKpiStrip" aria-label="Market status and decision summary">
        <article className="elitePrimaryStatus">
          <div><span className="eliteEyebrow">MARKET REGIME</span><strong>{verifiedMarket ? decision.volatilityRegime : "Awaiting verified intelligence"}</strong><small>{verifiedMarket ? `${decision.marketBias} bias · ${decision.recommendedPosture}` : "Provider validation is active; no market state has been inferred"}</small></div>
          <div className={`elitePermission is${decision.tradePermission.replace("-", "")}`}><span>TRADE PERMISSION</span><strong>{verifiedMarket ? decision.tradePermission : "NO-TRADE"}</strong><small>{market.gatewayStatus.fallbackActive ? "Fallback active" : "Fail-closed controls active"}</small></div>
        </article>
        <article className="eliteMetricCard">
          <span><i aria-hidden="true">R</i> RISK RATING</span><strong>{verifiedMarket ? decision.riskRating : "Unrated"}</strong><div className="eliteRiskScale" data-value={verifiedMarket ? decision.riskRating : "none"}><i /><i /><i /><i /></div><small>{verifiedMarket ? `${market.snapshot.risk.toLowerCase()} provider risk` : "Activates after required inputs verify"}</small>
        </article>
        <article className="eliteMetricCard">
          <span><i aria-hidden="true">E</i> EXPECTED MOVE</span><strong>{expectedMove}</strong><small>Intentionally withheld without a provider-supplied field</small>
        </article>
        <article className="eliteMetricCard eliteConfidenceCard">
          <span><i aria-hidden="true">C</i> BULLSEYE CONFIDENCE</span><strong>{mission.confidence === null ? "Verification pending" : mission.confidence}<em>{mission.confidence === null ? "" : "/100"}</em></strong><div className="eliteConfidenceTrack"><i style={{ width: `${mission.confidence ?? 0}%` }} /></div><small>{mission.available ? "Verified deterministic output" : "No confidence inferred from incomplete evidence"}</small>
        </article>
      </section>

      <TodaysBullseyePlan verified={verifiedMarket} dataStatus={market.snapshot.status} stateLabel={session.label} confidence={mission.confidence} bias={decision.marketBias} risk={decision.riskRating} expectedMove={expectedMove} support={support} resistance={resistance} bullishTrigger={bullishScenario.trigger.level ? `${bullishScenario.trigger.kind.replaceAll("_", " ").toLowerCase()} at ${bullishScenario.trigger.level}` : bullishScenario.trigger.kind.replaceAll("_", " ").toLowerCase()} bearishTrigger={bearishScenario.trigger.level ? `${bearishScenario.trigger.kind.replaceAll("_", " ").toLowerCase()} at ${bearishScenario.trigger.level}` : bearishScenario.trigger.kind.replaceAll("_", " ").toLowerCase()} invalidation={decision.invalidationConditions[0]?.level ?? decision.invalidationConditions[0]?.kind.replaceAll("_", " ").toLowerCase() ?? "Awaiting verified input"} noTradeConditions={decision.noTradeReasons.length ? decision.noTradeReasons : plan.reasonsToRemainSidelined} summary={market.snapshot.summary} />

      {access.tier !== "elite" ? <EliteConversionPreview /> : null}

      <BullseyeMissionControl
        verified={verifiedMarket}
        confidence={mission.confidence}
        marketCondition={mission.marketCondition}
        directionalBias={mission.directionalBias}
        keyRisk={mission.keyWarning}
        nextAction={mission.nextAction}
        tradePermission={decision.tradePermission}
        riskRating={decision.riskRating}
        volatilityRegime={decision.volatilityRegime}
        providerName={market.gatewayStatus.providerName}
        fallbackActive={market.gatewayStatus.fallbackActive}
        dataStatus={market.snapshot.status}
        scores={intelligence.scores}
      />

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

      <MarketStructureVisual levels={market.snapshot.levels} scores={intelligence.scores} status={market.snapshot.status} directionalBias={decision.marketBias} confidence={mission.confidence} />

      <section className="eliteScenarioGrid" aria-label="Conditional bullish and bearish scenarios">
        <EliteScenarioCard tone="bullish" verified={verifiedMarket} probability={bullishScenario.probability} trigger={bullishScenario.trigger.kind.replaceAll("_", " ").toLowerCase()} level={bullishScenario.trigger.level ?? "Range confirmation"} invalidation={bullishScenario.invalidation.level ?? bullishScenario.invalidation.kind.replaceAll("_", " ").toLowerCase()} />
        <EliteScenarioCard tone="bearish" verified={verifiedMarket} probability={bearishScenario.probability} trigger={bearishScenario.trigger.kind.replaceAll("_", " ").toLowerCase()} level={bearishScenario.trigger.level ?? "Range confirmation"} invalidation={bearishScenario.invalidation.level ?? bearishScenario.invalidation.kind.replaceAll("_", " ").toLowerCase()} />
      </section>

      <section className={`executiveMorningBrief eliteMorningBrief executiveMorningBrief-${morningBrief.mode}`} aria-labelledby="morning-brief-title">
        <header><div><span>{morningBrief.label}</span><h2 id="morning-brief-title">{morningBrief.headline}</h2>{morningBrief.summary ? <p>{morningBrief.summary}</p> : null}</div><div className="morningBriefBadges"><TerminalBadge label={morningBrief.mode} tone={morningBrief.mode === "verified" ? "positive" : morningBrief.mode === "preview" ? "warning" : "danger"} /><TerminalBadge label={morningBrief.generation === "ai-assisted" ? "AI assisted" : "Deterministic"} tone={morningBrief.generation === "ai-assisted" ? "info" : "neutral"} /></div></header>
        <div className="executiveMorningBriefBody">
          <div className="morningBriefSignal"><span>Directional context</span><strong>{directionalContext === "Not available" ? "Verification in progress" : directionalContext}</strong><small>{morningBrief.confidence === null ? "Decision score activates after provider verification" : `${morningBrief.confidence} / 100 confidence`}</small></div>
          <div><h3>Executive priorities</h3><ol>{morningBrief.priorities.map((priority) => <li key={priority}>{priority}</li>)}</ol></div>
          <div><h3>Session checklist</h3><ul>{morningBrief.checklist.map((item) => <li key={item}>{item}</li>)}</ul></div>
        </div>
        {morningBrief.warning ? <footer><strong>Safety state:</strong> {morningBrief.warning}<span>Preview fixture timestamp: {morningBrief.asOf}</span></footer> : <footer><span>As of {morningBrief.asOf} · Refresh after material data or event changes.</span><span>{morningBrief.generation === "ai-assisted" ? "OpenAI summarized verified engine evidence only." : morningBrief.aiStatus === "not_requested" ? "Deterministic brief active for current access." : `Deterministic fallback active · ${morningBrief.aiStatus.replaceAll("_", " ")}.`}</span></footer>}
      </section>

      <section className="eliteOperationsGrid">
        <article className="dailyCard todayMission eliteMissionCard">
          <header><div><span>TODAY’S MISSION</span><h2>Decision protocol</h2></div><TerminalBadge label={market.snapshot.status} tone={mission.available ? "positive" : "danger"} /></header>
          <dl><div><dt>Market condition</dt><dd>{mission.marketCondition}</dd></div><div><dt>Directional posture</dt><dd>{mission.directionalBias}</dd></div><div><dt>Principal risk</dt><dd>{mission.keyWarning}</dd></div><div><dt>Next action</dt><dd>{mission.nextAction}</dd></div></dl>
          <Link href="/terminal">Continue into the full terminal <span>→</span></Link>
        </article>
        <div className="eliteSideStack">
          <article className="dailyCard nextEventCard eliteEventCard">
            <header><div><span>EVENT RISK</span><h2>Next economic event</h2></div>{nextEvent ? <TerminalBadge label={nextEvent.risk} tone={nextEvent.risk === "HIGH" ? "danger" : "warning"} /> : <TerminalBadge label="No schedule" tone="neutral" />}</header>
            {nextEvent ? <div className="eventCountdown"><span>NEXT WINDOW IN</span><EventCountdown startsAt={nextEvent.startsAt} initialNow={now} /><h3>{nextEvent.name}</h3><time dateTime={nextEvent.startsAt}>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(nextEvent.startsAt))} UK</time><p>Calculated from the verified provider timestamp.</p></div> : <div className="dashboardUnavailable"><i aria-hidden="true">◷</i><strong>Awaiting verified event intelligence</strong><p>The next risk window will appear when the provider supplies a complete future timestamp.</p><ul><li>Review the session label</li><li>Keep risk conditions visible</li><li>Refresh after provider recovery</li></ul></div>}
          </article>
          <article className="dailyCard accuracyCard elitePerformanceCard">
            <header><div><span>VERIFIED HISTORY</span><h2>Classification record</h2></div><TerminalBadge label={accuracy.status} tone={accuracy.status === "verified" ? "positive" : "neutral"} /></header>
            {accuracy.status === "verified" ? <div className="accuracyVerified"><div className="eliteAccuracyRing" style={{ "--accuracy": `${accuracy.accuracyPercent * 3.6}deg` } as React.CSSProperties}><strong>{accuracy.accuracyPercent}%</strong></div><div><p>{accuracy.correct} correct directional classifications from {accuracy.sampleSize} independently verified outcomes.</p><small>Latest verification: {accuracy.latestVerifiedAt}</small></div></div> : accuracy.status === "insufficient" ? <div className="dashboardUnavailable"><i aria-hidden="true">i</i><strong>Building a verified record</strong><p>{accuracy.sampleSize} of {accuracy.required} independently verified outcomes stored. Accuracy remains hidden until the threshold is met.</p><ul><li>Only independently verified outcomes count</li><li>Returns and profitability are never inferred</li></ul></div> : <div className="dashboardUnavailable"><i aria-hidden="true">↻</i><strong>Verified history synchronising</strong><p>No performance result is shown until the outcome store can be verified.</p><ul><li>Current dashboard access remains available</li><li>No placeholder statistic is displayed</li></ul></div>}
            <footer>Directional classification accuracy only—not returns, profitability, or a guarantee.</footer>
          </article>
        </div>
      </section>

      <SubscriptionStatusCard tier={access.tier} status={membership?.status ?? null} billingPlan={membership?.plan ?? null} periodEnd={membership?.current_period_end ?? null} portalUrl={portalUrl} foundingRecords={founding100.records} billingInterval={membership?.billing_interval ?? null} compact />

      <section className="dashboardAccessArea" aria-label="Progressive membership access">
        <header><span>YOUR ACCESS PATH</span><h2>Use more depth when it adds value</h2><p>No artificial deadlines. Preview availability resets on the published UTC cadence.</p></header>
        {access.tier === "elite" ? <article className="dailyCard fullyUnlocked"><TerminalBadge label="Elite unlocked" tone="warning" /><h3>Full decision workflow available</h3><p>Intelligence, decisions, structured planning and launch diagnostics are included in your current membership.</p><Link href="/terminal">Open the Elite terminal →</Link></article> : <LockedPremiumCard tier={offer!.targetTier} title={offer!.targetTier === "pro" ? "Explore the explainable decision workflow" : "Explore structured planning and diagnostics"} value={offer!.targetTier === "pro" ? "See how Bullseye turns verified market inputs into explainable confidence, bias and trade permission." : "See how Elite converts a deterministic decision into disciplined participation, confirmations and review triggers."} benefits={offer!.targetTier === "pro" ? ["Explainable scores", "Decision permission", "Conflict warnings"] : ["Structured planner", "Event-risk controls", "Launch diagnostics"]} previewEligible={offer!.eligible} previewAvailable={previewState.available} previewCadence={offer!.cadence} />}
      </section>
      <details className="commandMethodology"><summary><span>Methodology &amp; data labels</span><small>How BULLSEYE turns verified observations into derived intelligence</small></summary><div><p><strong>Observed</strong> values come from the current provider snapshot. <strong>Derived</strong> scores, scenarios and risk classifications are deterministic analytics calculated from those inputs.</p><p>Delayed, stale, partial or unavailable inputs keep directional output visibly restricted. BULLSEYE is educational market intelligence, not personalised financial advice.</p><nav><Link href="/risk-disclaimer">Risk disclosure</Link><Link href="/help">Help</Link>{access.features["launch-diagnostics"] ? <Link href="/terminal/diagnostics">Sanitized diagnostics</Link> : null}</nav></div></details>
    </div>
  </MemberShell>;
}
