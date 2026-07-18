import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server";
import { analyzeMarketSnapshot } from "../lib/market-intelligence-engine";
import { createTradingDecision } from "../lib/trading-decision-engine";
import { createStructuredTradePlan } from "../lib/structured-trade-planner";
import { formatMarketGatewayDataAge } from "../lib/live-market-gateway";
import { formatSnapshotAge, formatUkTimestamp } from "../lib/market-data";
import { TerminalControls } from "./components/TerminalControls";
import { MarketChart } from "./components/MarketChart";
import { DecisionSummary, IntelligenceSummary, PlannerSummary, TerminalSummaryStrip, WarningList } from "./components/EngineSummary";
import { TerminalBadge } from "./components/TerminalBadge";
import { LaunchDiagnosticsPanel } from "./components/LaunchDiagnosticsPanel";
import { LockedPremiumCard } from "./components/LockedPremiumCard";
import { getTerminalMarketData } from "./lib/terminal-market-data-provider";
import { createLaunchDiagnostics } from "./lib/launch-diagnostics";
import { createProgressiveAccess, membershipRedirect, resolveMembershipTier } from "./lib/membership-entitlement";
import { loadPreviewClaims } from "./lib/preview-access";
import { terminalStatusMessage } from "./lib/terminal-state";
import { chartDataForStatus, chartDisplayState, terminalFallbackMessage, terminalMarketState, verifiedQuote } from "./lib/visual-terminal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bullseye Terminal | NASH AI Markets", description: "Professional deterministic market intelligence terminal.", robots: { index: false, follow: false } };

const toneForState = (state: string) => state === "Live" ? "positive" : state === "Delayed" ? "warning" : state === "Cached" ? "info" : "danger";
const quoteTone = (direction?: "up" | "down" | "flat") => direction === "up" ? "positive" : direction === "down" ? "danger" : "neutral";

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

  const { snapshot, gatewayStatus } = await getTerminalMarketData();
  const intelligence = analyzeMarketSnapshot(snapshot);
  const decision = createTradingDecision({ intelligence, reasoning: intelligence.reasoning, dataStatus: snapshot.status, providerStatus: gatewayStatus.connectionStatus, dataAgeMs: gatewayStatus.dataAgeMs, fallbackActive: gatewayStatus.fallbackActive, missingDataWarnings: intelligence.reasoning.missingDataWarnings });
  const plan = createStructuredTradePlan({ decision, intelligence, dataStatus: snapshot.status, providerStatus: gatewayStatus.connectionStatus, dataAgeMs: gatewayStatus.dataAgeMs, fallbackActive: gatewayStatus.fallbackActive, missingDataWarnings: intelligence.reasoning.missingDataWarnings });
  const state = terminalMarketState(snapshot.status, gatewayStatus.connectionStatus, gatewayStatus.fallbackActive);
  const isVerified = snapshot.status === "LIVE" || snapshot.status === "DELAYED";
  const quotes = ["ES", "VIX", "US2Y", "US10Y", "DXY"].map((symbol) => verifiedQuote(snapshot, symbol));
  const chart = chartDataForStatus(snapshot.status);
  const highImpactEvents = isVerified ? snapshot.events.filter((event) => event.risk === "HIGH") : [];
  const diagnostics = createLaunchDiagnostics({ snapshot, gatewayStatus, intelligence, decision, plan, chartState: chartDisplayState([...chart.data]), providerType: process.env.MARKET_DATA_PROVIDER, apiCredentialConfigured: Boolean(process.env.FMP_API_KEY), accessibilityContract: true });
  const portalUrl = "/api/stripe/portal";

  return <main className="foxtrotTerminal" id="overview">
    <header className="ftTopbar">
      <Link href="/" className="ftBrand" aria-label="NASH AI Markets home"><span className="ftReticle" aria-hidden="true" /><span>NASH <b>AI</b> / BULLSEYE</span></Link>
      <div className="ftMarketIdentity"><strong>S&amp;P 500 FUTURES</strong><span>{isVerified ? `${snapshot.source} · ${formatSnapshotAge(snapshot.asOf)}` : "Verified feed unavailable"}</span></div>
      <div className="ftTopActions"><TerminalBadge label={state} tone={toneForState(state)} pulse={state === "Live"} /><time dateTime={snapshot.asOf}>{isVerified ? `${formatUkTimestamp(snapshot.asOf)} UK` : "Last update unavailable"}</time><TerminalControls /></div>
    </header>

    <aside className="ftRail">
      <nav aria-label="Terminal sections"><a href="#overview" className="active">OV</a><a href="#chart">CH</a><a href="#intelligence">AI</a><a href="#markets">MK</a><a href="#events">EV</a><a href="#provider">PX</a></nav>
      <div><a href={portalUrl} aria-label="Manage subscription">MB</a><a href="/auth/signout" aria-label="Sign out">OUT</a></div>
    </aside>

    <section className="ftWorkspace">
      <div className={`ftSafetyBanner ftSafetyBanner-${state.toLowerCase()}`} role={!isVerified ? "alert" : "status"}><div><TerminalBadge label={state} tone={toneForState(state)} /><strong>{terminalStatusMessage(snapshot.status, gatewayStatus.failureCount)}</strong></div>{!isVerified ? <Link href="/terminal">Retry provider</Link> : null}</div>

      <section className="progressiveAccessBar" aria-label="Membership access"><div><TerminalBadge label={access.tier} tone={access.tier === "elite" ? "warning" : access.tier === "pro" ? "info" : "neutral"} /><strong>{access.effectiveTier.toUpperCase()} FEATURES ACTIVE</strong>{previewOffer?.active ? <span>{previewOffer.targetTier.toUpperCase()} preview active until reset</span> : null}</div><span>Progressive access · upgrade when the deeper workflow earns its place</span></section>
      {previewOffer?.active ? <p className="premiumPreviewNotice" role="status">Your {previewOffer.cadence} {previewOffer.targetTier.toUpperCase()} preview is active for this access period.</p> : null}

      {access.features["trade-planner"] ? <TerminalSummaryStrip intelligence={intelligence} decision={decision} plan={plan} /> : <LockedPremiumCard tier="elite" title="Complete decision-to-plan summary" value="See confidence, permission, posture, participation and readiness in one synchronized strip." benefits={["Planner alignment", "Execution readiness", "Full warning context"]} previewEligible={previewOffer?.targetTier === "elite" && previewOffer.eligible} previewAvailable={previewState.available} previewCadence={previewOffer?.cadence} />}

      <section className="ftQuoteStrip" aria-label="Market snapshot" id="markets">
        {quotes.map((quote, index) => <article key={quote?.symbol ?? index}><span>{quote?.label ?? ["ES FUTURES", "VIX", "US 2Y", "US 10Y", "US DOLLAR"][index]}</span><strong>{quote?.value ?? "—"}</strong><TerminalBadge label={quote?.change ?? "Unavailable"} tone={quoteTone(quote?.direction)} /></article>)}
      </section>

      <section className="ftPrimaryGrid" id="chart"><MarketChart data={[...chart.data]} mode={chart.mode} symbol="ES" /><div className="ftDecisionStack">{access.features["decision-engine"] ? <DecisionSummary decision={decision} /> : <LockedPremiumCard tier="pro" title="Turn market conditions into a decision" value="Pro translates verified inputs into bias, risk, volatility regime and trade permission." benefits={["Deterministic bias", "Conflict detection", "No-trade protection"]} previewEligible={previewOffer?.targetTier === "pro" && previewOffer.eligible} previewAvailable={previewState.available} previewCadence={previewOffer?.cadence} />}{access.features["trade-planner"] ? <PlannerSummary plan={plan} /> : <LockedPremiumCard tier="elite" title="Move from decision to disciplined planning" value="Elite adds participation, setup preference, confirmations and recalculation triggers without fabricating prices." benefits={["Structured checklist", "Event-risk controls", "Review triggers"]} previewEligible={previewOffer?.targetTier === "elite" && previewOffer.eligible} previewAvailable={previewState.available} previewCadence={previewOffer?.cadence} />}</div></section>

      <section className="ftAnalysisGrid" id="intelligence">{access.features.intelligence ? <IntelligenceSummary intelligence={intelligence} /> : <LockedPremiumCard tier="pro" title="Understand what is driving the score" value="Pro reveals the deterministic intelligence breakdown behind risk, trend, sentiment and volatility." benefits={["Explainable drivers", "Missing-data warnings", "Scenario evidence"]} previewEligible={previewOffer?.targetTier === "pro" && previewOffer.eligible} previewAvailable={previewState.available} previewCadence={previewOffer?.cadence} />}<section className="ftCard ftRiskMonitor"><header><div><span>RISK MONITOR</span><h2>Warnings &amp; constraints</h2></div><TerminalBadge label={`${decision.dataQualityWarnings.length + plan.eventRiskWarnings.length + highImpactEvents.length} flags`} tone={decision.dataQualityWarnings.length || highImpactEvents.length ? "warning" : "positive"} /></header><p className="ftStateCopy">{terminalFallbackMessage(state, snapshot.status)}</p>{decision.dataQualityWarnings.length ? <WarningList title="Data-quality warnings" values={decision.dataQualityWarnings.map((warning) => `${warning.code}: ${warning.field}`)} /> : <p className="ftEmptyCopy">No engine data-quality warnings.</p>}{access.features["trade-planner"] && plan.eventRiskWarnings.length ? <WarningList title="Planner event-risk warnings" values={plan.eventRiskWarnings.map((warning) => warning.code)} /> : null}{highImpactEvents.length ? <WarningList title="High-impact provider events" values={highImpactEvents.map((event) => `${event.time}: ${event.name}`)} /> : null}</section></section>

      <section className="ftLowerGrid">
        <section className="ftCard ftEvents" id="events"><header><div><span>ECONOMIC EVENT WINDOW</span><h2>Upcoming catalysts</h2></div><TerminalBadge label={snapshot.events.length && isVerified ? "Provider data" : "Unavailable"} tone={snapshot.events.length && isVerified ? "info" : "neutral"} /></header>{snapshot.events.length && isVerified ? <div className="eventRows">{snapshot.events.map((event) => <article key={`${event.time}-${event.name}`}><time>{event.time}</time><strong>{event.name}</strong><TerminalBadge label={event.risk} tone={event.risk === "HIGH" ? "danger" : "warning"} /></article>)}</div> : <div className="ftUnavailable"><strong>No verified economic events</strong><span>The current provider has not supplied an economic calendar. No events have been inferred.</span></div>}</section>
        <section className="ftCard ftProvider" id="provider"><header><div><span>MARKET GATEWAY</span><h2>Provider &amp; data quality</h2></div><TerminalBadge label={gatewayStatus.connectionStatus.replace("_", " ")} tone={toneForState(state)} /></header><dl><div><dt>Provider</dt><dd>{gatewayStatus.providerName}</dd></div><div><dt>Snapshot status</dt><dd>{snapshot.status}</dd></div><div><dt>Data age</dt><dd>{formatMarketGatewayDataAge(gatewayStatus.dataAgeMs)}</dd></div><div><dt>Last attempt</dt><dd>{gatewayStatus.lastAttempt ? formatUkTimestamp(gatewayStatus.lastAttempt) : "Not attempted"}</dd></div><div><dt>Last success</dt><dd>{gatewayStatus.lastSuccessfulUpdate ? formatUkTimestamp(gatewayStatus.lastSuccessfulUpdate) : "None"}</dd></div><div><dt>Failures</dt><dd>{gatewayStatus.failureCount}</dd></div><div><dt>Fallback</dt><dd>{gatewayStatus.fallbackActive ? "Active" : "Inactive"}</dd></div><div><dt>Warnings</dt><dd>{decision.dataQualityWarnings.length}</dd></div></dl></section>
      </section>

      {access.features["launch-diagnostics"] ? <LaunchDiagnosticsPanel diagnostics={diagnostics} compact /> : <LockedPremiumCard tier="elite" title="Validate the full launch-quality data path" value="Elite diagnostics show provider health, freshness, latency, fallback state and engine synchronization." benefits={["Provider health", "Readiness checks", "Safe build provenance"]} previewEligible={previewOffer?.targetTier === "elite" && previewOffer.eligible} previewAvailable={previewState.available} previewCadence={previewOffer?.cadence} />}

      <footer className="ftFooter"><span>Educational decision support only. Not personalised financial advice. Futures and options involve substantial risk. Verify source, status and timestamp independently.</span><Link href="/terms">Terms &amp; risk disclosure</Link></footer>
    </section>
  </main>;
}
