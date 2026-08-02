"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
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
import { StatusIcon } from "../../components/StatusIcon.tsx";
import { Sparkline } from "../../components/mini-visuals/Sparkline.tsx";
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
import { AiCoachPanel } from "../../components/oracle/AiCoachPanel.tsx";
import type { MarketVideoSelection } from "../../lib/market-video/types.ts";
import type { MarketQuote } from "../../lib/market-data.ts";
import type { SessionClockReading } from "../../terminal/lib/session-clock.ts";
import type { TradePlan } from "../../lib/structured-trade-planner.ts";
import { coachingNoteFor } from "../../lib/oracle/daily-checklist.ts";
import { buildCommandStrip } from "../lib/command-strip.ts";
import { buildTodaysGamePlan } from "../lib/todays-game-plan.ts";
import { delightCardForDay } from "../lib/delight-card.ts";
import { CommandStrip } from "./CommandStrip.tsx";
import { TodaysGamePlanPanel } from "./TodaysGamePlanPanel.tsx";
import { AwaitingDataNote } from "./AwaitingDataNote.tsx";
import { DashboardVideoCentre } from "./DashboardVideoCentre.tsx";
import { StatusBadge } from "./visual/StatusBadge.tsx";
import { VisualLevelMap } from "./visual/VisualLevelMap.tsx";

export type MarketCommandCentreProps = {
  greeting: DeskGreeting;
  tierLabel: string;
  summary: DashboardCommandSummary;
  insight: AiMarketInsightModel;
  oracle: OracleBundle;
  candleSeries: CustomerCandleSeries | null;
  now: number;
  marketVideo?: MarketVideoSelection | null;
  postMarketPendingNotice?: string | null;
  archiveAvailable?: boolean;
  session: SessionClockReading;
  quotes: MarketQuote[];
  plan: TradePlan | null;
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
  marketVideo = null,
  postMarketPendingNotice = null,
  archiveAvailable = false,
  session,
  quotes,
  plan,
}: MarketCommandCentreProps) {
  const { hero, decision, weather, levels, levelsNote, catalyst, unavailable } = summary;
  const posture = buildTodaysPosture(decision);
  const postClose = oracle.timeline.current === "post-close";
  const { prefs, persist } = useDashboardWorkspace();
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const sessionAccent =
    oracle.timeline.current === "post-close"
      ? "postmarket"
      : oracle.timeline.current === "premarket" || oracle.timeline.current === "overnight"
        ? "premarket"
        : "rth";

  const postureTone =
    decision.permissionTone === "blocked"
      ? "risk"
      : decision.permissionTone === "caution"
        ? "caution"
        : decision.permissionTone === "open"
          ? "positive"
          : "info";

  const primaryNext =
    postClose
      ? { href: "/dashboard#session-replay", label: oracle.replay.primaryActionLabel }
      : catalyst
        ? { href: "/terminal#catalysts", label: "Review next catalyst" }
        : { href: hero.deskHref, label: "Open Trading Desk" };

  const gamePlan = useMemo(
    () =>
      buildTodaysGamePlan({
        decision,
        plan,
        levels,
        candleSeries,
        sessionLabel: hero.sessionLabel,
      }),
    [candleSeries, decision, hero.sessionLabel, levels, plan],
  );

  const esSparkline = useMemo(() => {
    const closes = candleSeries?.candles?.map((bar) => bar.close).filter((value) => Number.isFinite(value));
    return closes && closes.length >= 8 ? closes.slice(-48) : null;
  }, [candleSeries]);

  const commandStrip = useMemo(
    () =>
      buildCommandStrip({
        hero,
        decision,
        weather,
        session,
        quotes,
        expectedMove: gamePlan.expectedMove,
        esSparkline,
      }),
    [decision, esSparkline, gamePlan.expectedMove, hero, quotes, session, weather],
  );

  const delight = useMemo(() => delightCardForDay(now), [now]);

  const coachNotes = useMemo(
    () => [
      coachingNoteFor({
        postureHeadline: oracle.checklist.postureHeadline,
        permissionTone: oracle.checklist.permissionTone,
        hasUpcomingEvent: oracle.checklist.hasUpcomingEvent,
        completedPrep: 3,
      }),
      gamePlan.mindset,
      decision.primaryRisk ? `Primary condition on record: ${decision.primaryRisk}.` : null,
      catalyst
        ? `Verified event risk ahead: ${catalyst.name}. Avoid increasing size solely into the release.`
        : "No upcoming verified catalyst is listed — still protect capital.",
      postClose
        ? "Post-market window favours review and journaling over chasing delayed prints."
        : "Wait for confirmation before treating any lean as actionable.",
    ].filter((item): item is string => Boolean(item)),
    [catalyst, decision.primaryRisk, gamePlan.mindset, oracle.checklist, postClose],
  );

  const sectionNodes = useMemo(() => {
    const map: Partial<Record<DashboardSectionId, ReactNode>> = {
      "thirty-second": <ThirtySecondBrief key="thirty-second" model={oracle.thirtySecond} />,
      "video-centre": (
        <DashboardVideoCentre
          key="video-centre"
          selection={marketVideo}
          postMarketPendingNotice={postMarketPendingNotice}
          archiveAvailable={archiveAvailable}
        />
      ),
      "game-plan": <TodaysGamePlanPanel key="game-plan" model={gamePlan} />,
      insight: <AiMarketInsightCard key="insight" model={insight} />,
      chart: candleSeries ? (
        <section key="chart" className="companionHeroChart" aria-label="ES hero chart">
          <DashboardCandlestickChart series={candleSeries} instrument="ES" compact />
        </section>
      ) : (
        <AwaitingDataNote
          key="chart"
          statusLabel="Awaiting verified ES candles"
          reason="The chart appears here once verified delayed history is available for your membership."
          action={
            <Link href="/terminal" className="dashTextLink">
              Open Trading Desk
            </Link>
          }
        />
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
            <h2 id="dash-weather-title">Market weather</h2>
            <p>Verified cross-market prints. Breadth, put/call and tick stay offline until feeds exist.</p>
            <p className="dashWeatherFreshness">{hero.delayedAgeLine}</p>
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
                </article>
              ))}
            </div>
          ) : (
            <p className="dashEmptyHint">Weather formation incomplete — awaiting verified ES, VIX, DXY or US 10-year quotes.</p>
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
      delight: (
        <aside key="delight" className="dashDelightCard vxTintReflection" aria-labelledby="dash-delight-title">
          <span className="mccEyebrow">{delight.eyebrow}</span>
          <h2 id="dash-delight-title">{delight.title}</h2>
          <p>{delight.body}</p>
        </aside>
      ),
    };
    return map;
  }, [
    archiveAvailable,
    candleSeries,
    decision,
    delight,
    gamePlan,
    hero.delayedAgeLine,
    insight,
    marketVideo,
    oracle,
    postMarketPendingNotice,
    posture.headline,
    posture.summary,
    weather,
  ]);

  const renderOrder = useMemo(() => {
    const pinned = prefs.order.filter(
      (id) => prefs.pinned.includes(id) || ESSENTIAL_DASHBOARD_SECTIONS.includes(id),
    );
    const rest = prefs.order.filter((id) => !pinned.includes(id));
    return [...pinned, ...rest];
  }, [prefs.order, prefs.pinned]);

  const cockpitIds: DashboardSectionId[] = ["thirty-second", "posture"];
  const intelligenceIds: DashboardSectionId[] = ["insight", "conviction", "weather", "internals"];
  const planningIds: DashboardSectionId[] = ["timeline", "game-plan", "opportunity", "checklist"];
  const reviewIds: DashboardSectionId[] = ["replay", "video-centre", "delight"];
  const orderedGroup = (ids: DashboardSectionId[]) =>
    renderOrder.filter((id) => ids.includes(id)).map((id) => sectionNodes[id]);

  return (
    <div
      className={`marketCommandCentre dashCommandCentre vxSessionAccent-${sessionAccent}${prefs.density === "compact" ? " is-compact" : ""}`}
    >
      <header className="dashHero" aria-labelledby="dash-hero-title">
        <div className="dashHeroCopy">
          <div className="dashHeroKicker">
            <span className="mccEyebrow vxIconLabel">
              <StatusIcon name="dashboard" />
              S&amp;P 500 MISSION CONTROL
            </span>
            <StatusBadge label={decision.permissionLabel} tone={postureTone} />
            <StatusBadge label={hero.sessionLabel} tone="info" />
          </div>
          <h1 id="dash-hero-title">
            {greeting.name ? (
              <>
                {greeting.salutation}, <em>{greeting.name}</em>
              </>
            ) : (
              <>{greeting.salutation}</>
            )}
          </h1>
          <p className="dashHeroPosture">
            <strong>{posture.headline}.</strong> {greeting.subtitle} {tierLabel} access.
          </p>
          <p className="dashHeroPosture">{posture.summary}</p>
          <div className="dashHeroActions">
            <Link href={primaryNext.href} className="dashHeroCta">
              {primaryNext.label}
            </Link>
            <button
              type="button"
              className="dashWorkspaceToggle"
              aria-expanded={workspaceOpen}
              aria-controls="dash-workspace-panel"
              onClick={() => setWorkspaceOpen((open) => !open)}
            >
              Customise
            </button>
          </div>
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
              {esSparkline ? (
                <div className="dashHeroSpark">
                  <Sparkline
                    values={esSparkline}
                    tone={hero.direction === "up" || hero.direction === "down" ? hero.direction : "neutral"}
                    label="Recent verified ES closes"
                    width={160}
                    height={36}
                    filled
                  />
                </div>
              ) : null}
            </div>
            <div className="dashHeroSession">
              <span>Session</span>
              <strong>{hero.sessionLabel}</strong>
              <small>{hero.sessionDetail}</small>
            </div>
          </div>

          <div className="dashFreshness" role="status">
            <strong>Data freshness</strong>
            <span>{hero.delayedAgeLine}</span>
            {hero.priceSourceLabel ? <em>{hero.priceSourceLabel}</em> : null}
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

      <div className="dashWorkspaceDrawer">
        <div
          id="dash-workspace-panel"
          className="dashWorkspacePanel"
          hidden={!workspaceOpen}
          role="region"
          aria-label="Dashboard layout customisation"
        >
          {workspaceOpen ? <DashboardWorkspaceControls prefs={prefs} onChange={persist} /> : null}
        </div>
      </div>

      <AiCoachPanel notes={coachNotes} sessionLabel={hero.sessionLabel} />

      <CommandStrip model={commandStrip} />

      <section className="dashCockpit" aria-labelledby="dash-cockpit-title">
        <header className="dashCockpitHeader">
          <div>
            <span className="mccEyebrow">DECISION COCKPIT</span>
            <h2 id="dash-cockpit-title">See the call. Know the risk. Move with intent.</h2>
          </div>
          <StatusBadge label={decision.permissionLabel} tone={postureTone} />
        </header>
        <div className="dashCockpitGrid">{orderedGroup(cockpitIds)}</div>
      </section>

      <div className={catalyst ? "dashSplitRow" : "dashLevelsStack"}>
        <section className="dashLevels" aria-labelledby="dash-levels-title">
          <header>
            <span className="mccEyebrow">
              VERIFIED LEVEL MAP <ConceptHint conceptId="session-open" />
            </span>
            <h2 id="dash-levels-title">ES 24-hour references</h2>
          </header>
          <VisualLevelMap levels={levels} currentPrice={hero.price} note={levelsNote} />
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
                <StatusBadge label={catalyst.impact} tone="caution" />
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
          <AwaitingDataNote
            statusLabel="No upcoming verified catalyst"
            reason="No scheduled event has been verified for the sessions ahead."
            explanation="Event risk still applies. Unscheduled news can move the market at any time."
            action={
              <Link href="/terminal#catalysts" className="dashTextLink">
                Review catalysts on Trading Desk
              </Link>
            }
          />
        )}
      </div>

      <section className="dashChartStage" aria-label="Verified market chart">
        {sectionNodes.chart}
      </section>

      <section className="dashDeepDives" aria-labelledby="dash-deep-dives-title">
        <header className="dashDeepDivesHeader">
          <div>
            <span className="mccEyebrow">ON-DEMAND INTELLIGENCE</span>
            <h2 id="dash-deep-dives-title">Go deeper only when you need to</h2>
          </div>
          <p>The decision stays visible. Supporting evidence, preparation and review open without turning the dashboard into a wall of reports.</p>
        </header>
        <div className="dashDeepDiveGrid">
          <details className="dashDeepDive">
            <summary>
              <span>01</span>
              <div><strong>Market intelligence</strong><small>Insight, conviction, weather and internals</small></div>
              <i aria-hidden="true">+</i>
            </summary>
            <div className="dashDeepDiveBody">{orderedGroup(intelligenceIds)}</div>
          </details>
          <details className="dashDeepDive">
            <summary>
              <span>02</span>
              <div><strong>Session planning</strong><small>Timeline, game plan, opportunities and checklist</small></div>
              <i aria-hidden="true">+</i>
            </summary>
            <div className="dashDeepDiveBody">{orderedGroup(planningIds)}</div>
          </details>
          <details className="dashDeepDive">
            <summary>
              <span>03</span>
              <div><strong>Review &amp; learning</strong><small>Replay, briefings and process notes</small></div>
              <i aria-hidden="true">+</i>
            </summary>
            <div className="dashDeepDiveBody">{orderedGroup(reviewIds)}</div>
          </details>
        </div>
      </section>

      <section className="dashQuickActions" aria-label="Quick actions">
        <header>
          <span className="mccEyebrow">QUICK ACTIONS</span>
          <h2>Where to go next</h2>
        </header>
        <nav className="dashActionGrid">
          <Link href="/brief" className={`dashAction${postClose ? "" : " is-gold"}`}>
            <small className="vxIconLabel">
              <StatusIcon name="brief" /> PREPARE
            </small>
            <b>Open Morning Brief</b>
          </Link>
          <Link href="/terminal" className={`dashAction${!postClose ? " is-primary" : ""}`}>
            <small className="vxIconLabel">
              <StatusIcon name="desk" /> ACTIVE SESSION
            </small>
            <b>Open Trading Desk</b>
          </Link>
          <Link href="/dashboard#opportunity-radar" className="dashAction">
            <small className="vxIconLabel">
              <StatusIcon name="verified" /> WATCH
            </small>
            <b>Review opportunities</b>
          </Link>
          <Link href="/journal" className={`dashAction${postClose ? " is-primary" : ""}`}>
            <small className="vxIconLabel">
              <StatusIcon name="risk" /> REFLECT
            </small>
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
