import Link from "next/link";
import { AiMarketInsightCard } from "../../components/companion/AiMarketInsightCard.tsx";
import { MarketInternalsPanel } from "../../components/companion/MarketInternalsPanel.tsx";
import { ConfidenceChangePanel } from "../../components/oracle/ConfidenceChangePanel.tsx";
import { ConvictionExplainer } from "../../components/oracle/ConvictionExplainer.tsx";
import { DailyChecklistPanel } from "../../components/oracle/DailyChecklistPanel.tsx";
import type { OracleBundle } from "../../components/oracle/OracleCompanionStack.tsx";
import { SessionTimeline } from "../../components/oracle/SessionTimeline.tsx";
import { ThirtySecondBrief } from "../../components/oracle/ThirtySecondBrief.tsx";
import { VerifiedCatalystIncludes } from "../../components/VerifiedCatalystIncludes.tsx";
import { formatDelayedDataAgeDisplay } from "../../lib/freshness-labels.ts";
import type { AiMarketInsightModel } from "../../lib/ai-market-insight.ts";
import type { MorningMarketBriefModel } from "../lib/compose-market-brief.ts";

type MorningMarketBriefProps = {
  model: MorningMarketBriefModel;
  insight: AiMarketInsightModel;
  oracle: OracleBundle;
};

function weatherDirectionClass(direction: MorningMarketBriefModel["crossAssets"][number]["direction"]) {
  if (direction === "up") return "is-up";
  if (direction === "down") return "is-down";
  if (direction === "flat") return "is-flat";
  return "is-empty";
}

function weatherMoveCue(direction: MorningMarketBriefModel["crossAssets"][number]["direction"]) {
  if (direction === "up") return { arrow: "↑", label: "Higher" };
  if (direction === "down") return { arrow: "↓", label: "Lower" };
  if (direction === "flat") return { arrow: "→", label: "Unchanged" };
  return { arrow: "·", label: "Unavailable" };
}

function BriefVideo({ video }: { video: MorningMarketBriefModel["video"] }) {
  if (!video.available || !video.youtubeId) {
    return (
      <div className="mbVideoUnavailable" role="status">
        <strong>Daily market video — not available today</strong>
        <p>{video.reason}</p>
      </div>
    );
  }

  const src = `https://www.youtube-nocookie.com/embed/${video.youtubeId}?rel=0&modestbranding=1`;
  return (
    <div className="mbVideoFrame">
      <iframe
        title={video.title}
        src={src}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}

function customerLevelLabel(label: string, kind: string): string {
  if (/24h high|resistance \(24h/i.test(label)) return "24-hour high / upside reference";
  if (/24h low|support \(24h/i.test(label)) return "24-hour low / downside reference";
  if (kind === "resistance" && /key resistance|upside reference/i.test(label)) {
    return "24-hour high / upside reference";
  }
  if (kind === "support" && /key support|downside reference/i.test(label)) {
    return "24-hour low / downside reference";
  }
  return label;
}

export function MorningMarketBrief({ model, insight, oracle }: MorningMarketBriefProps) {
  const permissionBlocked = /stand aside|no-trade|blocked|unavailable|incomplete|restricted/i.test(
    `${model.playbook.posture} ${model.aiBriefing.mode} ${model.biggestRisk.label}`,
  );
  const timeline = model.economicTimeline.filter((item) => item.available).slice(0, 3);
  const expectedIsObserved = /verified|48-bar|range/i.test(
    `${model.expectedMove.label} ${model.expectedMove.detail}`,
  );
  const confidenceLabel = model.aiBriefing.confidence == null
    ? "Not rated"
    : model.aiBriefing.confidence === 0
      ? "Not established"
      : permissionBlocked
        ? "Limited"
        : `${Math.round(model.aiBriefing.confidence)} / 100`;
  const confidenceDetail = model.aiBriefing.confidence == null
    ? null
    : model.aiBriefing.confidence === 0 || permissionBlocked
      ? `Engine confidence score: ${Math.round(model.aiBriefing.confidence)} / 100`
      : null;
  const delayedAge = formatDelayedDataAgeDisplay(model.dataAgeLabel);
  const primaryReason = model.biggestRisk.label
    .replace(/critical input missing/i, "Confirmation data is incomplete")
    .replace(/required market evidence is missing/i, "Confirmation data is incomplete")
    .replace(/incomplete verified inputs/i, "Confirmation data is incomplete");

  return (
    <article className="morningMarketBrief" aria-labelledby="mb-title">
      <header className="mbHero" id="brief-hero">
        <div className="mbHeroCopy">
          <span className="mbEyebrow">Morning Brief</span>
          <h1 id="mb-title">
            {model.greeting}
            <em> Here is today’s market briefing.</em>
          </h1>
          <p>
            A concise verified briefing for S&P 500 futures traders — what changed,
            what matters now, and where to go next.
          </p>
        </div>
        <div className="mbHeroMeta">
          <div>
            <span>Session</span>
            <strong>{model.sessionLabel}</strong>
            <small>{model.sessionDetail}</small>
          </div>
          <div>
            <span>Feed</span>
            <strong className={model.verified ? "is-ok" : "is-warn"}>
              {model.verified ? "Verified delayed" : "Awaiting verification"}
            </strong>
            <small>{delayedAge}</small>
          </div>
          <div>
            <span>Membership</span>
            <strong>{model.tierLabel}</strong>
            <small>Educational commentary only</small>
          </div>
        </div>
        <nav className="mbHeroActions" aria-label="Brief actions">
          <Link href="/dashboard" className="mbPrimaryAction">
            <small>DASHBOARD</small>
            <b>Open Dashboard</b>
          </Link>
          <Link href="/terminal" className="mbSecondaryAction">
            <small>DESK</small>
            <b>Open Trading Desk</b>
          </Link>
        </nav>
      </header>

      <div className="mbDelayed" role="status">
        <strong>{delayedAge}.</strong>
        <span>Educational commentary only — not personalised advice.</span>
      </div>

      <ThirtySecondBrief model={oracle.thirtySecond} />
      <AiMarketInsightCard model={insight} />
      <SessionTimeline model={oracle.timeline} />

      <section
        className={`mbPanel mbDecision mbPosture ${permissionBlocked ? "is-blocked" : ""}`}
        id="todays-posture"
        aria-labelledby="mb-posture-title"
      >
        <header>
          <span className="mbEyebrow">{model.posture.eyebrow}</span>
          <h2 id="mb-posture-title">{model.posture.headline}</h2>
          <p className="mbDecisionNote">{model.posture.summary}</p>
        </header>
        <div className="mbDecisionGrid">
          <div className={permissionBlocked ? "is-blocked" : ""}>
            <span>Participation</span>
            <strong>{permissionBlocked ? "Restricted" : "Caution"}</strong>
          </div>
          <div>
            <span>Observed market lean</span>
            <strong>{model.playbook.leanLabel}</strong>
          </div>
          <div>
            <span>Confidence</span>
            <strong>{confidenceLabel}</strong>
            {confidenceDetail ? <small className="mbScoreDetail">{confidenceDetail}</small> : null}
          </div>
          <div>
            <span>Primary condition</span>
            <strong>{primaryReason}</strong>
          </div>
        </div>
        <details className="mbParticipationDetails">
          <summary>Technical engine detail</summary>
          <p>{model.summary.setupReading}</p>
          {model.summary.engineWeightDetail ? <p>{model.summary.engineWeightDetail}</p> : null}
          <p className="mbFine">
            Internal posture reference: {model.playbook.posture}. Raw engine scores stay secondary to
            today’s posture above.
          </p>
        </details>
      </section>

      <section className="mbPanel mbExecutive" id="executive-summary" aria-labelledby="mb-exec-title">
        <header>
          <span className="mbEyebrow">Market state</span>
          <h2 id="mb-exec-title">What the verified inputs say now</h2>
        </header>
        <p className="mbLead">{model.executiveSummary}</p>
      </section>

      <section className="mbSummary mbOvernight" id="what-changed" aria-labelledby="mb-overnight-title">
        <header>
          <span className="mbEyebrow">What changed and what matters</span>
          <h2 id="mb-overnight-title">Session context</h2>
        </header>
        <div className="mbSummaryGrid mbSummaryTight">
          <article>
            <h3>Cross-market reading</h3>
            <p>{model.summary.overnight}</p>
          </article>
          <article>
            <h3>Practical significance</h3>
            <p>{model.summary.whatMatters}</p>
          </article>
        </div>
      </section>

      <section className="mbWeather" id="market-weather" aria-labelledby="mb-weather-title">
        <header>
          <span className="mbEyebrow">Market weather</span>
          <h2 id="mb-weather-title">Verified cross-market context</h2>
          <p>
            Values from delayed verified quotes only. Colour follows each instrument’s own numeric
            move. Breadth is omitted until a verified advance/decline feed exists.
          </p>
        </header>
        {model.crossAssets.length ? (
          <div className="mbCross">
            {model.crossAssets.map((card) => {
              const move = weatherMoveCue(card.direction);
              return (
              <article
                key={card.id}
                className={`mbCrossCard ${weatherDirectionClass(card.direction)}`}
              >
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <em>
                  <span aria-hidden="true">{move.arrow} </span>
                  {card.change}
                  <span className="mbMoveLabel"> · {move.label}</span>
                </em>
                <span className="mbVisuallyHidden">
                  Numerical move: {move.label}
                </span>
                <p>{card.detail}</p>
                <small>Delayed · verified · colour follows this instrument’s own move</small>
              </article>
              );
            })}
          </div>
        ) : (
          <p className="mbFine">Cross-market weather awaits verified ES, VIX, DXY or US 10-year quotes.</p>
        )}
      </section>

      <MarketInternalsPanel cards={insight.internals} />
      <ConvictionExplainer model={oracle.conviction} />
      <ConfidenceChangePanel current={oracle.confidenceSnapshot} />
      <DailyChecklistPanel
        postureHeadline={oracle.checklist.postureHeadline}
        permissionTone={oracle.checklist.permissionTone}
        hasUpcomingEvent={oracle.checklist.hasUpcomingEvent}
      />
      <Link href="/dashboard#opportunity-radar" className="oracleLinkCard">
        <strong>Educational opportunity conditions</strong>
        <span>
          Watch setups and confirmation requirements live on the Dashboard radar — kept there to avoid
          duplicating the same cards on Morning Brief.
        </span>
      </Link>
      <Link href="/dashboard#session-replay" className="oracleLinkCard">
        <strong>{oracle.replay.primaryActionLabel}</strong>
        <span>
          Post-close session review foundation is on the Dashboard. Morning Brief stays focused on narrative
          context.
        </span>
      </Link>

      <div className="mbTwin mbTwinWide">
        <section className="mbPanel mbLevelsPanel" id="verified-levels" aria-labelledby="mb-levels-title">
          <header>
            <span className="mbEyebrow">Verified levels</span>
            <h2 id="mb-levels-title">ES references</h2>
            <p>Educational references from verified prints — not confirmed support or resistance.</p>
          </header>
          {model.levels.rungs.length ? (
            <ol className="mbLadder">
              {model.levels.rungs.map((rung) => (
                <li key={rung.id} className={`is-${rung.kind}`} title={rung.note}>
                  <span>{customerLevelLabel(rung.label, rung.kind)}</span>
                  <strong>{rung.value}</strong>
                </li>
              ))}
            </ol>
          ) : (
            <div className="mbEmpty mbCompactEmpty" role="status">
              <strong>Levels awaiting verification</strong>
              <p>Reference levels stay blank until verified prints arrive.</p>
            </div>
          )}
          <div className="mbExpectedInline">
            <span>{expectedIsObserved ? "Observed range context" : "Range context"}</span>
            <strong>{model.expectedMove.label}</strong>
            <p>{model.expectedMove.detail}</p>
            <small>
              {expectedIsObserved
                ? "Verified observed range from recent candles — not a forecasted expected move."
                : "Shown only when verified inputs support the reading."}
            </small>
          </div>
          <Link href="/terminal" className="mbTextLink">
            Open full chart on Trading Desk
          </Link>
        </section>

        {timeline.length ? (
          <section className="mbPanel mbCatalystPanel" id="catalysts" aria-labelledby="mb-timeline-title">
            <header>
              <span className="mbEyebrow">Next verified catalysts</span>
              <h2 id="mb-timeline-title">Event risk ahead</h2>
            </header>
            <ol className="mbTimeline">
              {timeline.map((item) => (
                <li key={item.id}>
                  <time>{item.time}</time>
                  <div>
                    <strong>{item.name}</strong>
                    <span className={`mbRisk is-${item.risk.toLowerCase()}`}>{item.risk} impact</span>
                    {item.includes.length ? (
                      <VerifiedCatalystIncludes
                        includes={item.includes}
                        variant="details"
                        className="mbCatalystIncludes"
                      />
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
            <Link href="/terminal#catalysts" className="mbTextLink">
              Review catalysts on Trading Desk
            </Link>
          </section>
        ) : (
          <aside className="mbCatalystEmpty" role="status" aria-label="Next verified catalysts">
            <span className="mbEyebrow">Next verified catalysts</span>
            <p>No upcoming verified event is currently available.</p>
            <Link href="/terminal#catalysts" className="mbTextLink">
              Review catalysts on Trading Desk
            </Link>
          </aside>
        )}
      </div>

      <section className="mbPanel mbWatchAvoidPanel" id="watch-avoid" aria-labelledby="mb-watch-title">
        <header>
          <span className="mbEyebrow">Watch and avoid</span>
          <h2 id="mb-watch-title">Practical observations</h2>
        </header>
        <div className="mbWatchAvoid">
          {model.summary.watch.length ? (
            <div>
              <h3>Watch</h3>
              <ul>{model.summary.watch.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          ) : null}
          {model.summary.avoid.length ? (
            <div>
              <h3>Avoid</h3>
              <ul>{model.summary.avoid.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          ) : null}
        </div>
      </section>

      <section className="mbQuickActions" aria-label="Next actions">
        <header>
          <span className="mbEyebrow">Next actions</span>
          <h2>Where to go next</h2>
        </header>
        <nav className="mbActionGrid">
          <Link href="/terminal" className="mbAction is-primary">
            <small>DEPTH</small>
            <b>Open Trading Desk</b>
          </Link>
          <Link href="/dashboard" className="mbAction is-gold">
            <small>COMMAND</small>
            <b>Open Dashboard</b>
          </Link>
          <Link href="/ideas" className="mbAction">
            <small>EXPLORE</small>
            <b>Review Ideas</b>
          </Link>
          <Link href="/journal" className="mbAction">
            <small>REFLECT</small>
            <b>Risk &amp; Journal</b>
          </Link>
        </nav>
      </section>

      {model.serviceStatusSummary && model.serviceStatus.length ? (
        <details
          className={`mbServiceStatus${model.serviceStatus.some((item) => !item.optional) ? " is-warning" : ""}`}
        >
          <summary>{model.serviceStatusSummary}</summary>
          <ul>
            {model.serviceStatus.map((item) => (
              <li key={item.label}>
                <strong>
                  {item.label}
                  {item.optional ? <span className="mbSoftBadge">Optional</span> : null}
                </strong>
                <span>{item.detail}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {model.video.available ? (
        <section className="mbPanel" aria-labelledby="mb-video-title">
          <header>
            <span className="mbEyebrow">Optional</span>
            <h2 id="mb-video-title">{model.video.title}</h2>
          </header>
          <BriefVideo video={model.video} />
        </section>
      ) : null}
    </article>
  );
}
