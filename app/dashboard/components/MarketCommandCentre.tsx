"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { AiMarketInsightCard } from "../../components/companion/AiMarketInsightCard.tsx";
import { MarketInternalsPanel } from "../../components/companion/MarketInternalsPanel.tsx";
import { ConfidenceChangePanel } from "../../components/oracle/ConfidenceChangePanel.tsx";
import { ConvictionExplainer } from "../../components/oracle/ConvictionExplainer.tsx";
import {
  DashboardWorkspaceControls,
  useDashboardWorkspace,
} from "../../components/oracle/DashboardWorkspaceControls.tsx";
import { DailyChecklistPanel } from "../../components/oracle/DailyChecklistPanel.tsx";
import { OpportunityConditionsPanel } from "../../components/oracle/OpportunityConditionsPanel.tsx";
import type { OracleBundle } from "../../components/oracle/OracleCompanionStack.tsx";
import { SessionReplayPanel } from "../../components/oracle/SessionReplayPanel.tsx";
import { SessionTimeline } from "../../components/oracle/SessionTimeline.tsx";
import { ThirtySecondBrief } from "../../components/oracle/ThirtySecondBrief.tsx";
import { ConceptHint } from "../../components/oracle/ConceptHint.tsx";
import { VerifiedCatalystIncludes } from "../../components/VerifiedCatalystIncludes.tsx";
import type { AiMarketInsightModel } from "../../lib/ai-market-insight.ts";
import {
  ESSENTIAL_DASHBOARD_SECTIONS,
  type DashboardSectionId,
} from "../../lib/oracle/dashboard-workspace.ts";
import type { CustomerCandleSeries } from "../../lib/providers/financial-modeling-prep-candles.ts";
import { buildTodaysPosture } from "../../terminal/lib/desk-decision-presentation.ts";
import type { DeskGreeting } from "../lib/market-weather.ts";
import type { DashboardCommandSummary } from "../lib/dashboard-command-summary.ts";
import { DashboardCandlestickChart } from "./DashboardCandlestickChart.tsx";
import { EventCountdown } from "./EventCountdown";

export type MarketCommandCentreProps = {
  greeting: DeskGreeting;
  tierLabel: string;
  summary: DashboardCommandSummary;
  insight: AiMarketInsightModel;
  oracle: OracleBundle;
  candleSeries: CustomerCandleSeries | null;
  now: number;
};

function toneClass(tone: string) {
  return `is-${tone}`;
}

export function MarketCommandCentre({
  greeting,
  tierLabel,
  summary,
  insight,
  oracle,
  candleSeries,
  now,
}: MarketCommandCentreProps) {
  const { hero, decision, weather, levels, levelsNote, catalyst, unavailable } = summary;
  const posture = buildTodaysPosture(decision);
  const postClose = oracle.timeline.current === "post-close";
  const { prefs, persist } = useDashboardWorkspace();

  const sectionNodes = useMemo(() => {
    const map: Partial<Record<DashboardSectionId, ReactNode>> = {
      "thirty-second": <ThirtySecondBrief key="thirty-second" model={oracle.thirtySecond} />,
      insight: <AiMarketInsightCard key="insight" model={insight} />,
      chart: candleSeries ? (
        <section key="chart" className="companionHeroChart" aria-label="ES hero chart">
          <DashboardCandlestickChart series={candleSeries} instrument="ES" compact />
        </section>
      ) : (
        <aside key="chart" className="dashCatalystEmpty" role="status" aria-label="ES hero chart">
          <span className="mccEyebrow">VERIFIED DELAYED CHART</span>
          <p>ES candlesticks appear here once verified delayed history is available for your membership.</p>
          <Link href="/terminal" className="dashTextLink">
            Open Trading Desk
          </Link>
        </aside>
      ),
      posture: (
        <section key="posture" className="dashDecisionSnap" aria-labelledby="dash-decision-title">
          <header>
            <div>
              <span className="mccEyebrow">TODAY&apos;S POSTURE</span>
              <h2 id="dash-decision-title">{posture.headline}</h2>
              <p className="dashDecisionWhy">{posture.summary}</p>
            </div>
            <span className={`dashPill ${toneClass(decision.permissionTone)}`}>{decision.permissionLabel}</span>
          </header>

          <div className="dashDecisionGrid">
            <article>
              <span>Participation</span>
              <strong className={toneClass(decision.permissionTone)}>{decision.permissionLabel}</strong>
            </article>
            <article>
              <span>Observed market lean</span>
              <strong className={toneClass(decision.leanTone)}>{decision.leanLabel}</strong>
            </article>
            <article>
              <span>
                Confidence <ConceptHint conceptId="confidence" />
              </span>
              <strong>{decision.confidenceLabel}</strong>
              {decision.confidenceDetail ? <small>{decision.confidenceDetail}</small> : null}
            </article>
            <article>
              <span>Primary condition</span>
              <strong>{decision.primaryRisk ?? decision.riskLabel}</strong>
            </article>
          </div>

          {(decision.supporting.length > 0 || decision.opposing.length > 0) ? (
            <details className="dashEngineDetails">
              <summary>Engine detail (secondary)</summary>
              <div className="dashEngineColumns">
                {decision.supporting.length ? (
                  <div>
                    <span>Supporting</span>
                    <ul>
                      {decision.supporting.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {decision.opposing.length ? (
                  <div>
                    <span>Opposing</span>
                    <ul>
                      {decision.opposing.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </details>
          ) : null}
        </section>
      ),
      timeline: <SessionTimeline key="timeline" model={oracle.timeline} />,
      conviction: (
        <div key="conviction">
          <ConvictionExplainer model={oracle.conviction} />
          <ConfidenceChangePanel current={oracle.confidenceSnapshot} />
        </div>
      ),
      weather: (
        <section key="weather" className="dashWeather" aria-labelledby="dash-weather-title">
          <header>
            <span className="mccEyebrow">MARKET WEATHER</span>
            <h2 id="dash-weather-title">Verified cross-market context</h2>
            <p>
              Values and direction from delayed verified quotes only. Breadth is omitted until a verified
              breadth feed exists.
            </p>
          </header>
          {weather.length ? (
            <div className="dashWeatherGrid">
              {weather.map((item) => (
                <article key={item.id} className={`dashWeatherCard is-${item.direction}`}>
                  <span>
                    {item.name}{" "}
                    <ConceptHint
                      conceptId={
                        item.id === "VIX"
                          ? "vix"
                          : item.id === "DXY"
                            ? "dxy"
                            : item.id === "US10Y"
                              ? "us10y"
                              : "delayed-data"
                      }
                    />
                  </span>
                  <strong>{item.value}</strong>
                  <em>{item.change}</em>
                  <p>{item.interpretation}</p>
                  <small>Delayed · verified</small>
                </article>
              ))}
            </div>
          ) : (
            <p className="dashEmptyHint">Cross-market weather awaits verified ES, VIX, DXY or US 10-year quotes.</p>
          )}
        </section>
      ),
      internals: <MarketInternalsPanel key="internals" cards={insight.internals} />,
      opportunity: (
        <div key="opportunity" id="opportunity-radar">
          <OpportunityConditionsPanel model={oracle.opportunity} />
        </div>
      ),
      checklist: (
        <DailyChecklistPanel
          key="checklist"
          postureHeadline={oracle.checklist.postureHeadline}
          permissionTone={oracle.checklist.permissionTone}
          hasUpcomingEvent={oracle.checklist.hasUpcomingEvent}
        />
      ),
      replay: (
        <div key="replay" id="session-replay">
          <SessionReplayPanel model={oracle.replay} />
        </div>
      ),
    };
    return map;
  }, [candleSeries, decision, insight, oracle, posture.headline, posture.summary, weather]);

  const renderOrder = useMemo(() => {
    const pinned = prefs.order.filter(
      (id) => prefs.pinned.includes(id) || ESSENTIAL_DASHBOARD_SECTIONS.includes(id),
    );
    const rest = prefs.order.filter((id) => !pinned.includes(id));
    return [...pinned, ...rest];
  }, [prefs.order, prefs.pinned]);

  return (
    <div className="marketCommandCentre dashCommandCentre">
      <header className="dashHero" aria-labelledby="dash-hero-title">
        <div className="dashHeroCopy">
          <span className="mccEyebrow">DASHBOARD · DAILY COMMAND CENTRE</span>
          <h1 id="dash-hero-title">
            {greeting.name ? (
              <>
                {greeting.salutation}, <em>{greeting.name}</em>
              </>
            ) : (
              <>{greeting.salutation}</>
            )}
          </h1>
          <p>
            {greeting.subtitle} {tierLabel} access. Summarise the session in under 30 seconds, then open the
            Brief or Trading Desk for depth.
          </p>
        </div>

        <article className={`dashMarketHero is-${hero.direction}`} aria-label="ES market status">
          <div className="dashMarketHeroTop">
            <div>
              <span className="mccEyebrow">{hero.symbolLabel}</span>
              <strong className="dashHeroPrice">{hero.price ?? "—"}</strong>
              <div className="dashHeroChange">
                <span>{hero.netChange ?? "Net change awaiting verified candles"}</span>
                <em>{hero.percentChange ?? ""}</em>
              </div>
            </div>
            <div className="dashHeroSession">
              <span>Session</span>
              <strong>{hero.sessionLabel}</strong>
              <small>{hero.sessionDetail}</small>
            </div>
          </div>

          <div className="dashFreshness" role="status">
            <strong>Delayed market data</strong>
            <span>{hero.delayedAgeLine}</span>
          </div>

          {hero.rangePositionPct != null && hero.rangeLow && hero.rangeHigh ? (
            <div className="dashRangeBar" aria-label="Current price within the 24-hour range">
              <div className="dashRangeMeta">
                <span>{hero.rangeLow}</span>
                <strong>24-hour range · {hero.rangePositionPct}%</strong>
                <span>{hero.rangeHigh}</span>
              </div>
              <div className="dashRangeTrack">
                <i style={{ left: `${hero.rangePositionPct}%` }} />
              </div>
              {hero.rangeNote ? <p className="dashRangeNote">{hero.rangeNote}</p> : null}
            </div>
          ) : (
            <p className="dashRangePending">24-hour range position awaits verified ES candles.</p>
          )}

          <Link href={postClose ? "/dashboard#session-replay" : hero.deskHref} className="dashHeroCta">
            {postClose ? oracle.replay.primaryActionLabel : "Open Trading Desk"}
          </Link>
        </article>
      </header>

      {sectionNodes["thirty-second"]}

      <div className={catalyst ? "dashSplitRow" : "dashLevelsStack"}>
        <section className="dashLevels" aria-labelledby="dash-levels-title">
          <header>
            <span className="mccEyebrow">
              VERIFIED LEVELS <ConceptHint conceptId="session-open" />
            </span>
            <h2 id="dash-levels-title">ES 24-hour references</h2>
          </header>
          {levels.length ? (
            <ul>
              {levels.map((level) => (
                <li key={level.label}>
                  <span>{level.label}</span>
                  <strong>{level.value}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dashEmptyHint">{levelsNote ?? "Levels await verified candles."}</p>
          )}
          {levelsNote && levels.length ? <p className="dashLevelsNote">{levelsNote}</p> : null}
          <Link href="/terminal" className="dashTextLink">
            Open full chart on Trading Desk
          </Link>
        </section>

        {catalyst ? (
          <section className="dashCatalyst" aria-labelledby="dash-catalyst-title">
            <header>
              <span className="mccEyebrow">
                NEXT VERIFIED CATALYST <ConceptHint conceptId="event-risk" />
              </span>
              <h2 id="dash-catalyst-title">Event risk ahead</h2>
            </header>
            <article>
              <strong>{catalyst.name}</strong>
              <p>{catalyst.whenLabel}</p>
              <div className="dashCatalystMeta">
                <span>{catalyst.impact}</span>
                {catalyst.countdown ? (
                  <em>
                    In <EventCountdown startsAt={catalyst.startsAt} initialNow={now} />
                  </em>
                ) : null}
              </div>
              {catalyst.includes.length ? (
                <VerifiedCatalystIncludes includes={catalyst.includes} className="dashCatalystIncludes" />
              ) : null}
              <Link href="/terminal#catalysts" className="dashTextLink">
                Review catalysts on Trading Desk
              </Link>
            </article>
          </section>
        ) : (
          <aside className="dashCatalystEmpty" role="status" aria-label="Next verified catalyst">
            <span className="mccEyebrow">NEXT VERIFIED CATALYST</span>
            <p>No upcoming verified event is currently available.</p>
            <Link href="/terminal#catalysts" className="dashTextLink">
              Review catalysts on Trading Desk
            </Link>
          </aside>
        )}
      </div>

      {renderOrder.filter((id) => id !== "thirty-second").map((id) => sectionNodes[id])}

      <DashboardWorkspaceControls prefs={prefs} onChange={persist} />

      <section className="dashQuickActions" aria-label="Quick actions">
        <header>
          <span className="mccEyebrow">QUICK ACTIONS</span>
          <h2>Where to go next</h2>
        </header>
        <nav className="dashActionGrid">
          <Link href="/brief" className="dashAction is-gold">
            <small>PREPARE</small>
            <b>Open Morning Brief</b>
          </Link>
          <Link href="/terminal" className="dashAction is-primary">
            <small>ACTIVE SESSION</small>
            <b>Open Trading Desk</b>
          </Link>
          <Link href="/dashboard#opportunity-radar" className="dashAction">
            <small>WATCH</small>
            <b>Opportunity conditions</b>
          </Link>
          <Link href="/journal" className="dashAction">
            <small>REFLECT</small>
            <b>Risk &amp; Journal</b>
          </Link>
        </nav>
      </section>

      {unavailable.length ? (
        <details className="dashServiceStatus">
          <summary>
            {unavailable.every((item) => /breadth|video|news|catalyst|optional/i.test(`${item.label} ${item.detail}`))
              ? "Data coverage: some optional indicators are currently unavailable."
              : `Data coverage: ${unavailable.length} item${unavailable.length === 1 ? "" : "s"} need attention.`}
          </summary>
          <ul>
            {unavailable.map((item) => (
              <li key={item.label}>
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <p className="dashDisclosure" role="note">
        Educational market intelligence only. Not personalised financial advice. Market data may be delayed.
        Futures involve substantial risk of loss.
      </p>
    </div>
  );
}
