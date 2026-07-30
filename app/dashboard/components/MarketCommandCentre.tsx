import Link from "next/link";
import { VerifiedCatalystIncludes } from "../../components/VerifiedCatalystIncludes.tsx";
import { buildTodaysPosture } from "../../terminal/lib/desk-decision-presentation.ts";
import type { DeskGreeting } from "../lib/market-weather.ts";
import type { DashboardCommandSummary } from "../lib/dashboard-command-summary.ts";
import { EventCountdown } from "./EventCountdown";

export type MarketCommandCentreProps = {
  greeting: DeskGreeting;
  tierLabel: string;
  summary: DashboardCommandSummary;
  now: number;
};

function toneClass(tone: string) {
  return `is-${tone}`;
}

export function MarketCommandCentre({
  greeting,
  tierLabel,
  summary,
  now,
}: MarketCommandCentreProps) {
  const { hero, decision, weather, levels, levelsNote, catalyst, unavailable } = summary;
  const posture = buildTodaysPosture(decision);

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

          <Link href={hero.deskHref} className="dashHeroCta">
            Open Trading Desk
          </Link>
        </article>
      </header>

      <section className="dashDecisionSnap" aria-labelledby="dash-decision-title">
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
            <span>Confidence</span>
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

      <section className="dashWeather" aria-labelledby="dash-weather-title">
        <header>
          <span className="mccEyebrow">MARKET WEATHER</span>
          <h2 id="dash-weather-title">Verified cross-market context</h2>
          <p>Values and direction from delayed verified quotes only. Breadth is omitted until a verified breadth feed exists.</p>
        </header>
        {weather.length ? (
          <div className="dashWeatherGrid">
            {weather.map((item) => (
              <article key={item.id} className={`dashWeatherCard is-${item.direction}`}>
                <span>{item.name}</span>
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

      <div className={catalyst ? "dashSplitRow" : "dashLevelsStack"}>
        <section className="dashLevels" aria-labelledby="dash-levels-title">
          <header>
            <span className="mccEyebrow">VERIFIED LEVELS</span>
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
              <span className="mccEyebrow">NEXT VERIFIED CATALYST</span>
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
            <small>EXECUTE VIEW</small>
            <b>Open Trading Desk</b>
          </Link>
          <Link href="/ideas" className="dashAction">
            <small>EXPLORE</small>
            <b>Review Ideas</b>
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
    </div>
  );
}
