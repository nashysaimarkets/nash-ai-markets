import type { Metadata } from "next";
import Link from "next/link";
import { MemberShell } from "../components/MemberShell.tsx";
import { EventWindowEmpty } from "../components/mini-visuals/EventWindowEmpty.tsx";
import { buildOptionsFramework } from "../lib/options-framework.ts";
import { analyzeMarketSnapshot } from "../lib/market-intelligence-engine.ts";
import { formatSnapshotAge, formatUkTimestamp, hasDisplayableQuotes, isDecisionReadySnapshot } from "../lib/market-data.ts";
import { createStructuredTradePlan } from "../lib/structured-trade-planner.ts";
import { createTradingDecision } from "../lib/trading-decision-engine.ts";
import { requireMemberPage } from "../lib/server/member-page-access.ts";
import { LockedPremiumCard } from "../terminal/components/LockedPremiumCard.tsx";
import { TerminalBadge } from "../terminal/components/TerminalBadge.tsx";
import { getTerminalMarketData } from "../terminal/lib/terminal-market-data-provider.ts";
import { getConfiguredFmpCandles, toCustomerCandleSeries } from "../lib/providers/financial-modeling-prep-candles.ts";
import { getConfiguredSp500News } from "../lib/providers/fmp-market-news.ts";
import { DashboardCandlestickChart } from "../dashboard/components/DashboardCandlestickChart.tsx";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Options Corner | NASH AI Markets",
  description: "S&P 500 futures options framework with verified calendar and news context — never invented strikes.",
  robots: { index: false, follow: false },
};

function formatHeadlineAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "Age unavailable";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)}m old`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h old`;
  return `${Math.floor(hours / 24)}d old`;
}

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
  const [market, candleSeriesRaw, headlines] = await Promise.all([
    getTerminalMarketData(undefined, now),
    paid ? getConfiguredFmpCandles("5m", now, "ES") : Promise.resolve(null),
    getConfiguredSp500News(8),
  ]);
  const candleSeries = candleSeriesRaw ? toCustomerCandleSeries(candleSeriesRaw) : null;
  const decisionReady = isDecisionReadySnapshot(market.snapshot);
  const observable = hasDisplayableQuotes(market.snapshot);
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
  const framework = buildOptionsFramework({
    snapshot: market.snapshot,
    decision,
    plan,
    decisionReady,
    intelligence,
  });
  const snapshotAge = formatSnapshotAge(market.snapshot.asOf);
  const find = (symbol: string) => market.snapshot.quotes.find((quote) => quote.symbol === symbol);
  const es = find("ES");
  const vix = find("VIX");
  const dxy = find("DXY");
  const two = find("US2Y");
  const ten = find("US10Y");
  const events = market.snapshot.events;

  return <MemberShell active="options" className="optionsPage">
    <div className="memberDashboardShell optionsShell">
      <section className="optionsHero">
        <div>
          <span>OPTIONS CORNER</span>
          <h1>S&P 500 options decision desk</h1>
          <p>Current educational structures from verified ES evidence, US catalysts and provider headlines. Exact strikes stay withheld until a verified options chain exists.</p>
        </div>
        <div className="optionsHeroStatus">
          <TerminalBadge label="Options chain unavailable" tone="warning" />
          <TerminalBadge label={decisionReady ? "Verified delayed data" : "Stand aside"} tone={decisionReady ? "info" : "warning"} />
          <strong>{access.effectiveTier.toUpperCase()} ACCESS</strong>
        </div>
      </section>

      <section className="optionsSpxBoard" aria-label="S&P 500 verified inputs">
        <article><span>ES futures</span><strong>{es?.value ?? "Unavailable"}</strong><small>{es?.change ?? "No verified reading"}</small></article>
        <article><span>VIX</span><strong>{vix?.value ?? "Unavailable"}</strong><small>{decisionReady ? decision.volatilityRegime : "Unrated"}</small></article>
        <article><span>US Dollar</span><strong>{dxy?.value ?? "Unavailable"}</strong><small>{dxy?.change ?? "No verified reading"}</small></article>
        <article><span>2Y / 10Y</span><strong>{two && ten ? `${two.value} / ${ten.value}` : "Unavailable"}</strong><small>Verified treasury scalars</small></article>
        <article><span>Permission</span><strong>{decisionReady ? decision.tradePermission.replaceAll("-", " ") : "No trade permitted"}</strong><small>Snapshot age {snapshotAge}</small></article>
        <article><span>Bias</span><strong>{decisionReady ? decision.marketBias : "Stand aside"}</strong><small>{framework.bullishConfirm}</small></article>
      </section>

      <section className="optionsSummary" aria-label="Options framework summary">
        <article><span>Bullish path</span><strong>{framework.bullishConfirm}</strong></article>
        <article><span>Bearish path</span><strong>{framework.bearishConfirm}</strong></article>
        <article><span>Invalidation</span><strong>{framework.invalidation}</strong></article>
        <article><span>Options chain</span><strong>Unavailable</strong></article>
        <article><span>Expected move</span><strong>Withheld</strong></article>
        <article><span>As of (UK)</span><strong>{observable ? formatUkTimestamp(market.snapshot.asOf) : "Unavailable"}</strong></article>
      </section>

      <section className="optionsProviderPanel" aria-label="Options chain provider status">
        <div>
          <span>Provider status</span>
          <h2>Options chain unavailable</h2>
          <p>Bullseye will not invent strikes, premiums, Greeks or expected-move figures. Use the scenarios below only as educational structure guidance against verified ES evidence.</p>
        </div>
        <dl>
          <div><dt>Underlying (ES)</dt><dd>{framework.underlying ?? "Unavailable"}</dd></div>
          <div><dt>VIX</dt><dd>{framework.vix ?? "Unavailable"}</dd></div>
          <div><dt>Event risk</dt><dd>{framework.eventRisk}</dd></div>
          <div><dt>News feed</dt><dd>{headlines.length ? `${headlines.length} verified headlines` : "Unavailable"}</dd></div>
        </dl>
      </section>

      {candleSeries ? (
        <section className="optionsUnderlyingChart" aria-label="Underlying verified candlesticks">
          <DashboardCandlestickChart series={candleSeries} instrument="ES" compact />
        </section>
      ) : null}

      <section className="optionsCalendarPanel" aria-labelledby="options-calendar-title">
        <header>
          <div>
            <span>US ECONOMIC CALENDAR</span>
            <h2 id="options-calendar-title">Verified catalysts for the S&P session</h2>
          </div>
          <small>Provider calendar · medium/high impact · next 7 days</small>
        </header>
        {events.length ? (
          <ol className="optionsEventList">
            {events.map((event) => (
              <li key={`${event.time}-${event.name}`}>
                <time>{event.time}</time>
                <div>
                  <strong>{event.name}</strong>
                  <small>{event.risk === "HIGH" ? "High-impact review window" : "Medium-impact review window"}</small>
                </div>
                <em>{event.risk}</em>
              </li>
            ))}
          </ol>
        ) : (
          <EventWindowEmpty
            providerStatus={market.gatewayStatus.connectionStatus}
            asOfLabel={observable ? `${formatUkTimestamp(market.snapshot.asOf)} UK · ${snapshotAge}` : null}
            delayed={market.snapshot.status === "DELAYED" || !decisionReady}
          />
        )}
      </section>

      <section className="optionsNewsPanel" aria-labelledby="options-news-title">
        <header>
          <div>
            <span>S&P / MARKET HEADLINES</span>
            <h2 id="options-news-title">Verified provider news</h2>
          </div>
          <small>SPY-linked headlines when the provider returns them · never invented</small>
        </header>
        {headlines.length ? (
          <ul className="optionsNewsList">
            {headlines.map((item) => (
              <li key={`${item.url}-${item.publishedAt}`}>
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  <strong>{item.title}</strong>
                  <span>{item.source} · {formatHeadlineAge(item.publishedAt)}{item.symbols.length ? ` · ${item.symbols.join(", ")}` : ""}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <div className="optionsNewsEmpty" role="status">
            <strong>Verified headlines unavailable</strong>
            <p>No structurally valid S&P-related headlines were returned by the news provider for this environment. Bullseye will not invent stories.</p>
          </div>
        )}
      </section>

      <section className="optionsPathway" aria-hidden="true">
        <div className="is-bull"><span>1</span><strong>Bullish</strong><small>{framework.bullishConfirm}</small></div>
        <i />
        <div className="is-neutral"><span>2</span><strong>Neutral</strong><small>Permission closed / mixed</small></div>
        <i />
        <div className="is-bear"><span>3</span><strong>Bearish</strong><small>{framework.bearishConfirm}</small></div>
      </section>

      <section className="optionsScenarioGrid" aria-label="Current options trading ideas">
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
              <div><dt>Volatility</dt><dd>{idea.volatilityContext}</dd></div>
              <div><dt>Event context</dt><dd>{idea.eventContext}</dd></div>
              <div><dt>Max defined risk</dt><dd>{idea.maxDefinedRisk}</dd></div>
              <div><dt>Evidence quality</dt><dd>{idea.evidenceQuality === "framework-only" ? "Framework only" : "Chain verified"}</dd></div>
            </dl>
            {idea.reasonsToAvoid.length ? (
              <ul className="optionsAvoidList">
                {idea.reasonsToAvoid.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            ) : null}
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
        <span><Link href="/terminal">Open Terminal</Link> · <Link href="/brief">Market Brief</Link> · <Link href="/methodology">Options methodology</Link> · <Link href="/risk-disclaimer">Risk disclosure</Link></span>
      </footer>
    </div>
  </MemberShell>;
}
