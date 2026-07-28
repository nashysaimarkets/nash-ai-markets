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
      <div className="mbVideoEmpty" role="status">
        <span className="mbEyebrow">Daily market video</span>
        <strong>Video not linked yet</strong>
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

export function MorningMarketBrief({ model }: MorningMarketBriefProps) {
  return (
    <article className="morningMarketBrief" aria-labelledby="mb-title">
      <header className="mbHero">
        <div className="mbHeroCopy">
          <span className="mbEyebrow">Market Brief · under two minutes</span>
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
            <small>Educational · fail-closed</small>
          </div>
        </div>
        <nav className="mbHeroActions" aria-label="Brief actions">
          <Link href="/dashboard" className="mbPrimaryAction">
            <small>CENTRE</small>
            <b>Open Command Centre</b>
          </Link>
          <Link href="/terminal" className="mbSecondaryAction">
            <small>DESK</small>
            <b>Open Terminal</b>
          </Link>
        </nav>
      </header>

      <div className="mbDelayed" role="status">
        <strong>{model.delayedDisclosure.split(".")[0]}.</strong>
        <span>{model.delayedDisclosure.replace(/^[^.]+\.\s*/, "")}</span>
      </div>

      <section className="mbSummary" aria-labelledby="mb-summary-title">
        <header>
          <span className="mbEyebrow">Market summary</span>
          <h2 id="mb-summary-title">{model.summary.headline}</h2>
        </header>
        <div className="mbSummaryGrid">
          <article>
            <h3>What happened overnight?</h3>
            <p>{model.summary.overnight}</p>
          </article>
          <article>
            <h3>What matters today?</h3>
            <p>{model.summary.whatMatters}</p>
          </article>
          <article>
            <h3>Highest-probability behaviour</h3>
            <p>{model.summary.highestProbability}</p>
          </article>
          <article className="mbWatchAvoid">
            <div>
              <h3>What should I watch?</h3>
              <ul>
                {model.summary.watch.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            <div>
              <h3>What should I avoid?</h3>
              <ul>
                {model.summary.avoid.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </article>
        </div>
      </section>

      <div className="mbTwin">
        <section className="mbPanel" aria-labelledby="mb-ai-title">
          <header>
            <span className="mbEyebrow">AI briefing</span>
            <h2 id="mb-ai-title">{model.aiBriefing.headline}</h2>
            <p>{model.aiBriefing.sourceLabel}</p>
          </header>
          <p className="mbLead">{model.aiBriefing.body}</p>
          {model.aiBriefing.focusDrivers.length > 0 ? (
            <ul className="mbChips">
              {model.aiBriefing.focusDrivers.map((driver) => (
                <li key={driver}>{driver}</li>
              ))}
            </ul>
          ) : null}
          <footer>
            <span>Confidence</span>
            <strong>
              {model.aiBriefing.confidence != null
                ? `${Math.round(model.aiBriefing.confidence)} / 100`
                : "Not rated until verified"}
            </strong>
          </footer>
        </section>

        <section className="mbPanel mbExpected" aria-labelledby="mb-move-title">
          <header>
            <span className="mbEyebrow">Expected move</span>
            <h2 id="mb-move-title">{model.expectedMove.label}</h2>
          </header>
          <p className="mbLead">{model.expectedMove.detail}</p>
        </section>
      </div>

      <section className="mbCross" aria-label="Cross-market context">
        {model.crossAssets.map((card) => (
          <article key={card.id} className={`mbCrossCard ${toneClass(card.direction)} ${card.available ? "" : "is-empty"}`}>
            <span>{card.label}</span>
            <strong>{card.available && card.value ? card.value : "—"}</strong>
            <em>{card.available && card.change ? card.change : "Unavailable"}</em>
            <p>{card.detail}</p>
          </article>
        ))}
      </section>

      <div className="mbTwin mbTwinWide">
        <section className="mbPanel" aria-labelledby="mb-timeline-title">
          <header>
            <span className="mbEyebrow">Economic timeline</span>
            <h2 id="mb-timeline-title">Today’s verified calendar</h2>
          </header>
          <ol className="mbTimeline">
            {model.economicTimeline.map((item) => (
              <li key={item.id} className={item.available ? "" : "is-empty"}>
                <time>{item.time}</time>
                <div>
                  <strong>{item.name}</strong>
                  <span className={`mbRisk is-${item.risk.toLowerCase()}`}>
                    {item.available ? `${item.risk} impact` : "Awaiting verified events"}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mbPanel" aria-labelledby="mb-news-title">
          <header>
            <span className="mbEyebrow">Overnight news</span>
            <h2 id="mb-news-title">Headline desk</h2>
          </header>
          {model.overnightNews.available && model.overnightNews.items.length ? (
            <ul className="mbNews">
              {model.overnightNews.items.map((item) => (
                <li key={item.id}>
                  <strong>{item.headline}</strong>
                  <p>{item.detail}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mbEmpty" role="status">
              <strong>No verified overnight headlines</strong>
              <p>{model.overnightNews.reason}</p>
            </div>
          )}
        </section>
      </div>

      <div className="mbTwin mbTwinWide">
        <section className="mbPanel" aria-labelledby="mb-levels-title">
          <header>
            <span className="mbEyebrow">Support / resistance ladder</span>
            <h2 id="mb-levels-title">Where are the key levels?</h2>
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
            <div className="mbEmpty" role="status">
              <strong>Levels awaiting verification</strong>
              <p>Support and resistance stay blank until verified snapshot or candle references arrive.</p>
            </div>
          )}
          <p className="mbFine">{model.levels.disclosure}</p>
        </section>

        <section className="mbPanel" aria-labelledby="mb-playbook-title">
          <header>
            <span className="mbEyebrow">Today’s playbook</span>
            <h2 id="mb-playbook-title">{model.playbook.posture}</h2>
          </header>
          <div className="mbPlayColumns">
            <div>
              <h3>Steps</h3>
              <ol>
                {model.playbook.steps.map((step) => <li key={step}>{step}</li>)}
              </ol>
            </div>
            <div>
              <h3>Confirmations</h3>
              <ul>
                {model.playbook.confirmations.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </div>
        </section>
      </div>

      <div className="mbTwin">
        <section className="mbPanel mbRisk" aria-labelledby="mb-risk-title">
          <header>
            <span className="mbEyebrow">Today’s biggest risk</span>
            <h2 id="mb-risk-title">{model.biggestRisk.label}</h2>
          </header>
          <p className="mbLead">{model.biggestRisk.detail}</p>
        </section>

        <section className="mbPanel mbVideo" aria-labelledby="mb-video-title">
          <header>
            <span className="mbEyebrow">Daily market video</span>
            <h2 id="mb-video-title">{model.video.title}</h2>
          </header>
          <BriefVideo video={model.video} />
        </section>
      </div>
    </article>
  );
}
