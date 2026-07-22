import type { Metadata } from "next";
import Link from "next/link";
import { DashboardCard } from "../components/DashboardCard.tsx";
import { MemberShell } from "../components/MemberShell.tsx";
import { SafeState } from "../components/SafeState.tsx";
import { buildOptionsFramework } from "../lib/options-framework.ts";
import { analyzeMarketSnapshot } from "../lib/market-intelligence-engine.ts";
import { isDecisionReadySnapshot } from "../lib/market-data.ts";
import { createStructuredTradePlan } from "../lib/structured-trade-planner.ts";
import { createTradingDecision } from "../lib/trading-decision-engine.ts";
import { requireMemberPage } from "../lib/server/member-page-access.ts";
import { LockedPremiumCard } from "../terminal/components/LockedPremiumCard.tsx";
import { TerminalBadge } from "../terminal/components/TerminalBadge.tsx";
import { getTerminalMarketData } from "../terminal/lib/terminal-market-data-provider.ts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Options Corner | NASH AI Markets",
  description: "Underlying-based options framework without invented strikes, premiums or Greeks.",
  robots: { index: false, follow: false },
};

export default async function OptionsCornerPage() {
  const { access, previewState, now } = await requireMemberPage();

  if (!access.features["options-corner"]) {
    return <MemberShell active="options" className="optionsPage">
      <div className="memberDashboardShell">
        <section className="optionsHero">
          <div>
            <span>OPTIONS CORNER</span>
            <h1>Underlying-based framework</h1>
            <p>Educational structure ideas only — never fabricated strikes or Greeks.</p>
          </div>
        </section>
        <LockedPremiumCard
          tier="pro"
          title="Unlock Options Corner"
          value="Pro and Elite members receive an underlying-based options framework with chain-provider honesty when strikes are unavailable."
          benefits={["No invented strikes", "Defined-risk framing", "Provider unavailable states"]}
          previewEligible={access.previewOffer?.eligible ?? false}
          previewAvailable={previewState.available}
          previewCadence={access.previewOffer?.cadence}
        />
      </div>
    </MemberShell>;
  }

  const market = await getTerminalMarketData(undefined, now);
  const decisionReady = isDecisionReadySnapshot(market.snapshot);
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
  const framework = buildOptionsFramework({ snapshot: market.snapshot, decision, plan, decisionReady });

  return <MemberShell active="options" className="optionsPage">
    <div className="memberDashboardShell">
      <section className="optionsHero">
        <div>
          <span>OPTIONS CORNER</span>
          <h1>{framework.label}</h1>
          <p>Framework ideas from live underlying evidence. Exact strikes, premiums and Greeks stay withheld without a verified options chain.</p>
        </div>
        <div className="optionsHeroStatus">
          <TerminalBadge label="Underlying-based framework" tone="positive" />
          <TerminalBadge label="Options chain provider unavailable" tone="warning" />
          <strong>{access.effectiveTier.toUpperCase()} ACCESS</strong>
        </div>
      </section>

      <section className="optionsContext" aria-label="Underlying context">
        <article><span>Underlying (ES)</span><strong>{framework.underlying ?? "Unavailable"}</strong></article>
        <article><span>VIX</span><strong>{framework.vix ?? "Unavailable"}</strong></article>
        <article><span>Event risk</span><strong>{framework.eventRisk}</strong></article>
        <article><span>Expected move</span><strong>{framework.expectedMove}</strong><small>Withheld without chain</small></article>
      </section>

      <SafeState title="Options chain provider unavailable" tone="warning">
        <p>Bullseye will not invent strikes, premiums, Greeks or expected-move figures. Use the framework below only as educational structure guidance.</p>
      </SafeState>

      <section className="optionsIdeaGrid" aria-label="Framework ideas">
        {framework.ideas.map((idea) => (
          <DashboardCard
            key={idea.id}
            eyebrow={idea.direction.toUpperCase()}
            title={idea.strategyType}
            badge={<TerminalBadge label={idea.status} tone={idea.status === "Unavailable" ? "warning" : "info"} />}
            className="optionsIdeaCard"
          >
            <dl>
              <div><dt>Trigger</dt><dd>{idea.trigger}</dd></div>
              <div><dt>Invalidation</dt><dd>{idea.invalidation}</dd></div>
              <div><dt>Expiry window</dt><dd>{idea.expiryWindow}</dd></div>
              <div><dt>Strike selection logic</dt><dd>{idea.strikeSelectionLogic}</dd></div>
              <div><dt>Max defined risk</dt><dd>{idea.maxDefinedRisk}</dd></div>
              <div><dt>Volatility</dt><dd>{idea.volatilityContext}</dd></div>
            </dl>
            {idea.reasonsToAvoid.length ? <ul>{idea.reasonsToAvoid.map((reason) => <li key={reason}>{reason}</li>)}</ul> : null}
            <small>Evidence quality: {idea.evidenceQuality}</small>
          </DashboardCard>
        ))}
      </section>

      <DashboardCard eyebrow="WATCHLIST" title="Framework watchlist" className="optionsWatchlist">
        <ul>
          {framework.watchlist.map((idea) => (
            <li key={`watch-${idea.id}`}>
              <strong>{idea.strategyType}</strong>
              <span>{idea.status} · {idea.direction}</span>
            </li>
          ))}
        </ul>
      </DashboardCard>

      <footer className="optionsDisclosure">
        <strong>Disclosure</strong>
        <p>{framework.disclosure}</p>
        <span><Link href="/methodology">Options methodology</Link> · <Link href="/risk-disclaimer">Risk disclosure</Link></span>
      </footer>
    </div>
  </MemberShell>;
}
