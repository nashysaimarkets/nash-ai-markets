import type { Metadata } from "next";
import Link from "next/link";
import { MemberShell } from "../components/MemberShell.tsx";
import { buildOptionsFramework } from "../lib/options-framework.ts";
import { analyzeMarketSnapshot } from "../lib/market-intelligence-engine.ts";
import { formatSnapshotAge, isDecisionReadySnapshot } from "../lib/market-data.ts";
import { createStructuredTradePlan } from "../lib/structured-trade-planner.ts";
import { createTradingDecision } from "../lib/trading-decision-engine.ts";
import { requireMemberPage } from "../lib/server/member-page-access.ts";
import { LockedPremiumCard } from "../terminal/components/LockedPremiumCard.tsx";
import { TerminalBadge } from "../terminal/components/TerminalBadge.tsx";
import { getTerminalMarketData } from "../terminal/lib/terminal-market-data-provider.ts";
import { getConfiguredFmpCandles, toCustomerCandleSeries } from "../lib/providers/financial-modeling-prep-candles.ts";
import { DashboardCandlestickChart } from "../dashboard/components/DashboardCandlestickChart.tsx";

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

  const paid = access.tier === "pro" || access.tier === "elite";
  const [market, candleSeriesRaw] = await Promise.all([
    getTerminalMarketData(undefined, now),
    paid ? getConfiguredFmpCandles("5m", now, "ES") : Promise.resolve(null),
  ]);
  const candleSeries = candleSeriesRaw ? toCustomerCandleSeries(candleSeriesRaw) : null;
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
  const snapshotAge = formatSnapshotAge(market.snapshot.asOf);

  return <MemberShell active="options" className="optionsPage">
    <div className="memberDashboardShell optionsShell">
      <section className="optionsHero">
        <div>
          <span>OPTIONS CORNER</span>
          <h1>Educational decision framework</h1>
          <p>Use underlying evidence to prepare structure ideas. Exact strikes stay withheld until a verified options-chain provider exists.</p>
        </div>
        <div className="optionsHeroStatus">
          <TerminalBadge label="Options chain unavailable" tone="warning" />
          <strong>{access.effectiveTier.toUpperCase()} ACCESS</strong>
        </div>
      </section>

      <section className="optionsSummary" aria-label="Options framework summary">
        <article><span>Permission</span><strong>{decisionReady ? decision.tradePermission.replaceAll("-", " ") : "No trade permitted"}</strong></article>
        <article><span>Directional bias</span><strong>{decisionReady ? decision.marketBias : "Stand aside"}</strong></article>
        <article><span>Volatility regime</span><strong>{decisionReady ? decision.volatilityRegime : "Unrated"}</strong></article>
        <article><span>Snapshot age</span><strong>{snapshotAge}</strong></article>
        <article><span>Options chain</span><strong>Unavailable</strong></article>
        <article><span>Next catalyst</span><strong>{market.snapshot.events[0]?.name ?? "No verified schedule"}</strong></article>
      </section>

      <section className="optionsProviderPanel" aria-label="Options chain provider status">
        <div>
          <span>Provider status</span>
          <h2>Options chain unavailable</h2>
          <p>Bullseye will not invent strikes, premiums, Greeks or expected-move figures. The scenarios below are educational structure guidance only.</p>
        </div>
        <dl>
          <div><dt>Underlying (ES)</dt><dd>{framework.underlying ?? "Unavailable"}</dd></div>
          <div><dt>VIX</dt><dd>{framework.vix ?? "Unavailable"}</dd></div>
          <div><dt>Event risk</dt><dd>{framework.eventRisk}</dd></div>
          <div><dt>Expected move</dt><dd>Withheld</dd></div>
        </dl>
      </section>

      {candleSeries ? (
        <section className="optionsUnderlyingChart" aria-label="Underlying verified candlesticks">
          <DashboardCandlestickChart series={candleSeries} instrument="ES" compact />
        </section>
      ) : null}

      <section className="optionsPathway" aria-hidden="true">
        <div className="is-bull"><span>1</span><strong>Bullish</strong><small>Confirmation above</small></div>
        <i />
        <div className="is-neutral"><span>2</span><strong>Neutral</strong><small>Permission closed / mixed</small></div>
        <i />
        <div className="is-bear"><span>3</span><strong>Bearish</strong><small>Confirmation below</small></div>
      </section>

      <section className="optionsScenarioGrid" aria-label="Scenario frameworks">
        {framework.ideas.map((idea) => (
          <article key={idea.id} className={`optionsScenarioCard is-${idea.direction}`}>
            <header>
              <span>{idea.direction}</span>
              <strong>{idea.strategyType}</strong>
              <em>{idea.status === "Watching" ? `Watching: ${idea.watchingFor}` : idea.status}</em>
            </header>
            <dl>
              <div><dt>When relevant</dt><dd>{idea.trigger}</dd></div>
              <div><dt>Confirmation required</dt><dd>{idea.watchingFor}</dd></div>
              <div><dt>Invalidation</dt><dd>{idea.invalidation}</dd></div>
              <div><dt>Expiry logic</dt><dd>{idea.expiryWindow}</dd></div>
              <div><dt>Max defined risk</dt><dd>{idea.maxDefinedRisk}</dd></div>
              <div><dt>Evidence quality</dt><dd>{idea.evidenceQuality === "framework-only" ? "Framework only" : "Chain verified"}</dd></div>
            </dl>
          </article>
        ))}
      </section>

      <section className="optionsWatchStrip" aria-label="Framework watchlist">
        <header>
          <span>Watchlist</span>
          <h2>What each scenario is waiting for</h2>
        </header>
        <ul>
          {framework.watchlist.map((idea) => (
            <li key={`watch-${idea.id}`} className={`is-${idea.direction}`}>
              <strong>{idea.strategyType}</strong>
              <span>{idea.status === "Watching" ? `Watching: ${idea.watchingFor}` : idea.status}</span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="optionsDisclosure">
        <strong>Shared disclosure</strong>
        <p>{framework.disclosure}</p>
        <span><Link href="/methodology">Options methodology</Link> · <Link href="/risk-disclaimer">Risk disclosure</Link></span>
      </footer>
    </div>
  </MemberShell>;
}
