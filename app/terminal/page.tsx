import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server";
import { analyzeMarketSnapshot } from "../lib/market-intelligence-engine";
import { createTradingDecision } from "../lib/trading-decision-engine";
import { createStructuredTradePlan } from "../lib/structured-trade-planner";
import { formatSnapshotAge, formatUkTimestamp } from "../lib/market-data";
import { TerminalControls } from "./components/TerminalControls";
import { LockedPremiumCard } from "./components/LockedPremiumCard";
import { CrossAssetBoard, DecisionEnginePanel, MarketCommandHeader, MarketPressureMap, TodaysMarketPlan, WhatChanged } from "./components/CustomerTerminal";
import { getTerminalMarketData } from "./lib/terminal-market-data-provider";
import { createProgressiveAccess, membershipRedirect, resolveMembershipTier } from "./lib/membership-entitlement";
import { loadPreviewClaims } from "./lib/preview-access";
import { terminalStatusMessage } from "./lib/terminal-state";
import { terminalMarketState } from "./lib/visual-terminal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Elite Market Command | NASH AI Markets",
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

  const { snapshot, gatewayStatus } = await getTerminalMarketData();
  const intelligence = analyzeMarketSnapshot(snapshot);
  const decision = createTradingDecision({ intelligence, reasoning: intelligence.reasoning, dataStatus: snapshot.status, providerStatus: gatewayStatus.connectionStatus, dataAgeMs: gatewayStatus.dataAgeMs, fallbackActive: gatewayStatus.fallbackActive, missingDataWarnings: intelligence.reasoning.missingDataWarnings });
  const plan = createStructuredTradePlan({ decision, intelligence, dataStatus: snapshot.status, providerStatus: gatewayStatus.connectionStatus, dataAgeMs: gatewayStatus.dataAgeMs, fallbackActive: gatewayStatus.fallbackActive, missingDataWarnings: intelligence.reasoning.missingDataWarnings });
  const state = terminalMarketState(snapshot.status, gatewayStatus.connectionStatus, gatewayStatus.fallbackActive);
  const verified = snapshot.status === "LIVE" || snapshot.status === "DELAYED";
  const timestamp = verified ? formatUkTimestamp(snapshot.asOf) : "Unavailable";

  return <main className="foxtrotTerminal customerTerminal" id="overview">
    <header className="ctTopbar">
      <Link href="/" className="ftBrand" aria-label="NASH AI Markets home"><span className="ftReticle" aria-hidden="true" /><span>NASH <b>AI</b> / BULLSEYE</span></Link>
      <nav aria-label="Member navigation"><Link href="/dashboard">Dashboard</Link><Link href="/brief">Brief</Link><Link href="/profile">Account</Link></nav>
      <TerminalControls />
    </header>

    <section className="ctWorkspace">
      <MarketCommandHeader snapshot={snapshot} state={state} timestamp={timestamp} />
      <section className={`ctStatus is-${state.toLowerCase()}`} role={verified ? "status" : "alert"}>
        <div><strong>{terminalStatusMessage(snapshot.status, gatewayStatus.failureCount)}</strong><span>{verified ? `Verified ${formatSnapshotAge(snapshot.asOf)}.` : "No live values or directional guidance are being inferred."}</span></div>
        {!verified ? <Link href="/terminal">Retry market feed</Link> : null}
      </section>

      {access.features["trade-planner"] ? <TodaysMarketPlan snapshot={snapshot} decision={decision} plan={plan} /> : <LockedPremiumCard tier="elite" title="Unlock today’s complete market plan" value="Elite connects verified cross-asset conditions to a disciplined decision and participation framework." benefits={["Decision confidence", "Participation guidance", "Confirmation checklist"]} previewEligible={previewOffer?.targetTier === "elite" && previewOffer.eligible} previewAvailable={previewState.available} previewCadence={previewOffer?.cadence} />}

      <CrossAssetBoard snapshot={snapshot} />
      <section className="ctTwoColumn">
        {access.features.intelligence ? <MarketPressureMap snapshot={snapshot} intelligence={intelligence} /> : <LockedPremiumCard tier="pro" title="See what is driving risk appetite" value="Pro explains the verified volatility, Treasury, dollar and equity pressures behind the market view." benefits={["Cross-asset context", "Explainable signals", "Fail-closed analysis"]} previewEligible={previewOffer?.targetTier === "pro" && previewOffer.eligible} previewAvailable={previewState.available} previewCadence={previewOffer?.cadence} />}
        {access.features["decision-engine"] ? <DecisionEnginePanel snapshot={snapshot} decision={decision} plan={plan} /> : <LockedPremiumCard tier="pro" title="Turn evidence into disciplined decisions" value="Pro identifies supporting evidence, conflicts and the confirmations required before conditions become actionable." benefits={["Conflict detection", "Invalidation awareness", "No-trade protection"]} previewEligible={previewOffer?.targetTier === "pro" && previewOffer.eligible} previewAvailable={previewState.available} previewCadence={previewOffer?.cadence} />}
      </section>

      <section className="ctTwoColumn ctLower">
        <WhatChanged />
        <section className="ctPanel ctCompactPanel" aria-labelledby="history-title"><header><div><span>Market history</span><h2 id="history-title">Verified intraday chart unavailable</h2></div></header><p>The current snapshot does not include reliable OHLCV history. Bullseye will not draw or interpolate a chart from quote-only data.</p></section>
      </section>

      <section className="ctPanel ctCompactPanel" aria-labelledby="catalysts-title">
        <header><div><span>Upcoming catalysts</span><h2 id="catalysts-title">{verified && snapshot.events.length ? "Verified event window" : "Economic calendar unavailable"}</h2></div></header>
        {verified && snapshot.events.length ? <div className="ctEvents">{snapshot.events.map((event) => <article key={`${event.time}-${event.name}`}><time>{event.time}</time><strong>{event.name}</strong><span>{event.risk} impact</span></article>)}</div> : <p>The current provider snapshot contains no verified calendar events. Check a dedicated calendar before planning around scheduled releases.</p>}
      </section>

      <footer className="ctFooter"><span>Educational market intelligence only. Not personalised financial advice. Futures involve substantial risk.</span><Link href="/risk-disclaimer">Read the risk disclosure</Link></footer>
    </section>
  </main>;
}
