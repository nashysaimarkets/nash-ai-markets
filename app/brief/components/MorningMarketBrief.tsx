import Link from "next/link";
import type { MorningMarketBriefModel } from "../lib/compose-market-brief.ts";

type MorningMarketBriefProps = {
  model: MorningMarketBriefModel;
};

function toneClass(direction: "up" | "down" | "flat" | "unknown") {
  if (direction === "up") return "is-up";
  if (direction === "down") return "is-down";
  return "is-flat";
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

function TerminalishBadge() {
  return <span className="mbSoftBadge">Not currently available</span>;
}

export function MorningMarketBrief({ model }: MorningMarketBriefProps) {
  const permissionBlocked = /stand aside|no-trade|blocked|unavailable|incomplete/i.test(
    `${model.playbook.posture} ${model.aiBriefing.mode} ${model.biggestRisk.label}`,
  );
  const timeline = model.economicTimeline.filter((item) => item.available).slice(0, 3);
  const expectedIsObserved = /verified|48-bar|range/i.test(
    `${model.expectedMove.label} ${model.expectedMove.detail}`,
  );

  return (
    <article className="morningMarketBrief" aria-labelledby="mb-title">
      <header className="mbHero">
        <div className="mbHeroCopy">
          <span className="mbEyebrow">Morning Brief · under two minutes</span>
          <h1 id="mb-title">
            {model.greeting}
            <em> Today’s briefing.</em>
          </h1>
          <p>
            A calm, verified morning briefing for S&P 500 futures traders — what happened overnight,
            what matters now, and what to watch or avoid.
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
            <small>{model.dataAgeLabel} · {model.asOfLabel}</small>
          </div>
          <div>
            <span>Membership</span>
            <strong>{model.tierLabel}</strong>
            <small>Educational · analysis pauses until required data is available</small>
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
        <strong>Market Data: Delayed (~10 minutes).</strong>
        <span>Educational commentary only — not personalised advice.</span>
      </div>

      <section className={`mbPanel mbDecision ${permissionBlocked ? "is-blocked" : ""}`} aria-labelledby="mb-decision-title">
        <header>
          <span className="mbEyebrow">Decision summary</span>
          <h2 id="mb-decision-title">{model.summary.headline}</h2>
          <p>{model.aiBriefing.sourceLabel.replace(/deterministic engine brief/i, "rules-based market summary")}</p>
        </header>
        <div className="mbDecisionGrid">
          {permissionBlocked ? (
            <>
              <div className="is-blocked">
                <span>Participation</span>
                <strong>Blocked</strong>
              </div>
              <div>
                <span>Market lean</span>
                <strong>{model.playbook.posture.split("·")[0]?.trim() || "Unavailable"}</strong>
              </div>
              <div>
                <span>Confidence</span>
                <strong>
                  {model.aiBriefing.confidence != null
                    ? `${Math.round(model.aiBriefing.confidence)} / 100`
                    : "Not rated"}
                </strong>
              </div>
              <div>
                <span>Primary risk</span>
                <strong>{model.biggestRisk.label}</strong>
              </div>
            </>
          ) : (
            <>
              <div>
                <span>Market lean</span>
                <strong>{model.playbook.posture.split("·")[0]?.trim() || "Unavailable"}</strong>
              </div>
              <div>
                <span>Participation</span>
                <strong>Caution</strong>
              </div>
              <div>
                <span>Confidence</span>
                <strong>
                  {model.aiBriefing.confidence != null
                    ? `${Math.round(model.aiBriefing.confidence)} / 100`
                    : "Not rated"}
                </strong>
              </div>
              <div>
                <span>Primary risk</span>
                <strong>{model.biggestRisk.label}</strong>
              </div>
            </>
          )}
        </div>
        <p className="mbLead">
          {model.summary.whatMatters}
          {permissionBlocked
            ? " Directional lean is not a trade instruction while participation remains blocked."
            : ""}
        </p>
        <div className="mbWatchAvoid mbInlineWatch">
          <div>
            <h3>Watch</h3>
            <ul>{model.summary.watch.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <div>
            <h3>Avoid</h3>
            <ul>{model.summary.avoid.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </div>
      </section>

      <section className="mbSummary mbOvernight" aria-labelledby="mb-overnight-title">
        <header>
          <span className="mbEyebrow">Overnight &amp; today</span>
          <h2 id="mb-overnight-title">What changed and what matters</h2>
        </header>
        <div className="mbSummaryGrid mbSummaryTight">
          <article>
            <h3>What happened overnight?</h3>
            <p>{model.summary.overnight}</p>
          </article>
          <article>
            <h3>Highest-probability behaviour</h3>
            <p>{model.summary.highestProbability}</p>
          </article>
        </div>
      </section>

      <section className="mbCross" aria-label="Market snapshot metrics">
        {model.crossAssets.map((card) => (
          <article key={card.id} className={`mbCrossCard ${toneClass(card.direction)} ${card.available ? "" : "is-empty"}`}>
            <span>{card.label}</span>
            <strong>{card.available && card.value ? card.value : "—"}</strong>
            <em>{card.available && card.change ? card.change : "Unavailable"}</em>
            <p>{card.detail.replace("configured market gateway", "market-data feed")}</p>
          </article>
        ))}
      </section>

      <div className="mbTwin mbTwinWide">
        <section className="mbPanel" aria-labelledby="mb-levels-title">
          <header>
            <span className="mbEyebrow">Key levels</span>
            <h2 id="mb-levels-title">Support / resistance</h2>
          </header>
          {model.levels.rungs.length ? (
            <ol className="mbLadder">
              {model.levels.rungs.map((rung) => (
                <li key={rung.id} className={`is-${rung.kind}`}>
                  <span>{rung.label}</span>
                  <strong>{rung.value}</strong>
                  <small>{rung.note}</small>
                </li>
              ))}
            </ol>
          ) : (
            <div className="mbEmpty mbCompactEmpty" role="status">
              <TerminalishBadge />
              <strong>Levels awaiting verification</strong>
              <p>Support and resistance stay blank until verified references arrive.</p>
            </div>
          )}
          <p className="mbFine">{model.levels.disclosure}</p>
        </section>

        <section className="mbPanel mbExpected" aria-labelledby="mb-move-title">
          <header>
            <span className="mbEyebrow">{expectedIsObserved ? "Observed range context" : "Expected move"}</span>
            <h2 id="mb-move-title">{model.expectedMove.label}</h2>
          </header>
          <p className="mbLead">{model.expectedMove.detail}</p>
          <p className="mbFine">
            {expectedIsObserved
              ? "This is a verified observed range from recent candles — not a forecasted expected move."
              : "Shown only when verified inputs support the reading."}
          </p>
        </section>
      </div>

      <div className="mbTwin mbTwinWide">
        <section className="mbPanel" aria-labelledby="mb-timeline-title">
          <header>
            <span className="mbEyebrow">Next catalysts</span>
            <h2 id="mb-timeline-title">Upcoming verified events</h2>
          </header>
          {timeline.length ? (
            <ol className="mbTimeline">
              {timeline.map((item) => (
                <li key={item.id}>
                  <time>{item.time}</time>
                  <div>
                    <strong>{item.name}</strong>
                    <span className={`mbRisk is-${item.risk.toLowerCase()}`}>{item.risk} impact</span>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="mbEmpty mbCompactEmpty" role="status">
              <TerminalishBadge />
              <p>No verified calendar events are listed in the current snapshot.</p>
            </div>
          )}
        </section>

        <section className="mbPanel" aria-labelledby="mb-news-title">
          <header>
            <span className="mbEyebrow">Coverage status</span>
            <h2 id="mb-news-title">Overnight news</h2>
          </header>
          <div className="mbEmpty mbCompactEmpty" role="status">
            <TerminalishBadge />
            <p>{model.overnightNews.reason}</p>
          </div>
        </section>
      </div>

      <div className="mbTwin">
        <section className="mbPanel mbRisk" aria-labelledby="mb-risk-title">
          <header>
            <span className="mbEyebrow">Participation gate</span>
            <h2 id="mb-risk-title">
              {permissionBlocked ? "Why participation is blocked" : "Participation conditions"}
            </h2>
          </header>
          <dl className="mbParticipationFacts">
            <div>
              <dt>Primary reason</dt>
              <dd>{model.biggestRisk.label}</dd>
            </div>
            <div>
              <dt>Confidence</dt>
              <dd>
                {model.aiBriefing.confidence != null
                  ? `${Math.round(model.aiBriefing.confidence)} / 100`
                  : "Not rated"}
              </dd>
            </div>
            <div>
              <dt>Data condition</dt>
              <dd>{model.biggestRisk.detail}</dd>
            </div>
            <div>
              <dt>Requirements before participation</dt>
              <dd>
                <ul>
                  {model.playbook.confirmations.slice(0, 4).map((item) => (
                    <li key={item}>{item.replace(/decision permission valid/i, "participation checks passed")}</li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>
        </section>

        <section className={`mbPanel mbVideo${model.video.available ? "" : " is-empty"}`} aria-labelledby="mb-video-title">
          {model.video.available ? (
            <header>
              <span className="mbEyebrow">Optional</span>
              <h2 id="mb-video-title">{model.video.title}</h2>
            </header>
          ) : (
            <h2 id="mb-video-title" className="mbVisuallyHidden">{model.video.title}</h2>
          )}
          <BriefVideo video={model.video} />
        </section>
      </div>
    </article>
  );
}
