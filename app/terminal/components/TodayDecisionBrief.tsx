import Link from "next/link";
import { CrossAssetCandleGallery } from "../../components/CrossAssetCandleGallery";
import { RangePositionLane } from "../../components/mini-visuals/RangePositionLane";
import { Sparkline } from "../../components/mini-visuals/Sparkline";
import { DashboardCandlestickChart } from "../../dashboard/components/DashboardCandlestickChart";
import {
  parsePriceLevel,
  rangeLaneFromCandles,
  sparklineFromCandles,
} from "../../components/mini-visuals/mini-visual-data";
import type { TradingDeskPayload } from "../lib/desk-payload";
import { DecisionCapture } from "./DecisionCapture";
import { getTodaysYouTubeBroadcasts } from "../../lib/youtube-broadcasts";

type Posture = {
  label: string;
  detail: string;
  tone: "positive" | "negative" | "warning" | "unavailable";
};

type BroadcastEpisodeProps = {
  slot: "Pre-market" | "Closing review";
  videoId: string | undefined;
  publishedAt: string | undefined;
  summary: string;
  transcript: string[];
};

function ukDateKey(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function currentYouTubeEpisode(videoId: string | undefined, publishedAt: string | undefined) {
  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId) || !publishedAt) return null;
  const published = new Date(publishedAt);
  if (!Number.isFinite(published.getTime()) || ukDateKey(published) !== ukDateKey(new Date())) return null;
  return {
    src: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`,
    publishedLabel: new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(published),
  };
}

function BroadcastEpisode({ slot, videoId, publishedAt, summary, transcript }: BroadcastEpisodeProps) {
  const episode = currentYouTubeEpisode(videoId, publishedAt);
  return (
    <article className="todayBroadcastEpisode" data-ready={episode ? "true" : "false"}>
      <header>
        <div>
          <span>{slot}</span>
          <h3>{episode ? `${slot} AI market briefing` : `Awaiting today’s ${slot.toLowerCase()}`}</h3>
        </div>
        <strong>{episode ? `Published ${episode.publishedLabel}` : "Not published"}</strong>
      </header>
      {episode ? (
        <div className="todayBroadcastVideo">
          <iframe
            src={episode.src}
            title={`${slot} NASH AI Markets briefing`}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="todayBroadcastAwaiting">
          <span aria-hidden="true">▶</span>
          <div>
            <strong>Today’s video will appear here after review</strong>
            <p>No previous episode is presented as current.</p>
          </div>
        </div>
      )}
      <div className="todayBroadcastTranscript">
        <p>{summary}</p>
        <details>
          <summary>Read briefing points</summary>
          <ul>{transcript.slice(0, 4).map((item) => <li key={item}>{item}</li>)}</ul>
        </details>
      </div>
    </article>
  );
}

function postureFor(payload: TradingDeskPayload): Posture {
  if (
    payload.snapshot.status !== "LIVE"
    && payload.snapshot.status !== "DELAYED"
  ) {
    return {
      label: "Stand aside",
      detail: "Verified market evidence is outside the decision window.",
      tone: "unavailable",
    };
  }

  switch (payload.deskSignals?.overallLean) {
    case "buying":
      return {
        label: "Prepare the bullish path",
        detail: "Verified evidence currently leans higher, but confirmation remains mandatory.",
        tone: "positive",
      };
    case "selling":
      return {
        label: "Prepare the bearish path",
        detail: "Verified evidence currently leans lower, but confirmation remains mandatory.",
        tone: "negative",
      };
    case "mixed":
      return {
        label: "Wait for confirmation",
        detail: "Cross-market evidence conflicts, so neither directional path has permission.",
        tone: "warning",
      };
    case "neutral":
      return {
        label: "Stand aside",
        detail: "The verified evidence does not currently support a directional posture.",
        tone: "warning",
      };
    case "insufficient":
    default:
      return {
        label: "Stand aside",
        detail: "Directional evidence is incomplete and the brief remains fail-closed.",
        tone: "unavailable",
      };
  }
}

function statusTone(status: string): "positive" | "warning" | "negative" {
  if (status === "LIVE") return "positive";
  if (status === "DELAYED" || status === "PREVIOUS_SESSION" || status === "MARKET_CLOSED") return "warning";
  return "negative";
}

function displayText(value: string | null | undefined, fallback = "Unavailable"): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function curveContext(twoYear: number | null, tenYear: number | null) {
  if (twoYear === null || tenYear === null) {
    return {
      value: "Unavailable",
      detail: "Both verified Treasury readings are required",
      tone: "unavailable",
    };
  }

  const spreadBasisPoints = Math.round((tenYear - twoYear) * 100);
  const formattedSpread = `${spreadBasisPoints > 0 ? "+" : ""}${spreadBasisPoints} bp`;

  if (spreadBasisPoints < -5) {
    return { value: formattedSpread, detail: "Inverted curve · growth caution", tone: "negative" };
  }

  if (spreadBasisPoints > 5) {
    return { value: formattedSpread, detail: "Positive curve · normal slope", tone: "positive" };
  }

  return { value: formattedSpread, detail: "Flat curve · transition zone", tone: "warning" };
}

function workspaceLabel(preset: TradingDeskPayload["initialWorkspace"]["preset"]): string {
  switch (preset) {
    case "index-day-trader":
      return "Index day trader";
    case "macro":
      return "Macro desk";
    case "earnings":
      return "Earnings watch";
    case "crypto":
      return "Crypto desk";
    case "volatility":
      return "Volatility desk";
    default:
      return "Custom desk";
  }
}

function evidenceFingerprint(evidence: Record<string, number>) {
  const dimensions = [
    ["trend", "Trend"],
    ["momentum", "Momentum"],
    ["volatility", "Volatility"],
    ["breadth", "Breadth"],
    ["macro", "Macro"],
  ] as const;

  return dimensions.map(([key, label]) => {
    const raw = evidence[key];
    const available = typeof raw === "number" && Number.isFinite(raw);
    return {
      key,
      label,
      value: available ? Math.max(0, Math.min(100, Math.round(raw))) : null,
    };
  });
}

export async function TodayDecisionBrief({ payload }: { payload: TradingDeskPayload }) {
  const channelBroadcasts = await getTodaysYouTubeBroadcasts();
  const premarketVideoId = process.env.BULLSEYE_PREMARKET_YOUTUBE_ID || channelBroadcasts.premarket?.videoId;
  const premarketPublishedAt = process.env.BULLSEYE_PREMARKET_VIDEO_PUBLISHED_AT || channelBroadcasts.premarket?.publishedAt;
  const closeVideoId = process.env.BULLSEYE_CLOSE_YOUTUBE_ID || channelBroadcasts.close?.videoId;
  const closePublishedAt = process.env.BULLSEYE_CLOSE_VIDEO_PUBLISHED_AT || channelBroadcasts.close?.publishedAt;
  const posture = postureFor(payload);
  const buying = payload.deskSignals?.buying ?? null;
  const selling = payload.deskSignals?.selling ?? null;
  const esStructure = payload.structureLevels?.instruments.find((item) => item.symbol === "ES") ?? null;
  const esQuote = payload.snapshot.quotes.find((item) => item.symbol === "ES") ?? null;
  const verifiedWindow = payload.snapshot.status === "LIVE" || payload.snapshot.status === "DELAYED";
  const warnings = payload.customerWarnings.length
    ? payload.customerWarnings.slice(0, 4)
    : ["No additional participation warnings are present in the verified payload."];
  const nextCatalysts = payload.catalystRadar.items.slice(0, 3);
  const esCandles = payload.candleSeriesByInstrument?.ES?.candles ?? [];
  const esRange = rangeLaneFromCandles(esCandles);
  const esSparkline = sparklineFromCandles(esCandles);
  const twoYearQuote = payload.snapshot.quotes.find((item) => item.symbol === "US2Y") ?? null;
  const tenYearQuote = payload.snapshot.quotes.find((item) => item.symbol === "US10Y") ?? null;
  const treasuryCurve = curveContext(
    parsePriceLevel(twoYearQuote?.value),
    parsePriceLevel(tenYearQuote?.value),
  );
  const workspace = payload.initialWorkspace;
  const activeBrief = payload.edgeBriefByMarketId[workspace.activeMarketId] ?? null;
  const focusLabel = workspaceLabel(workspace.preset);
  const platformLabel = workspace.preferredPlatformId.replaceAll("-", " ");
  const candleFeedCount = payload.candleSeriesByInstrument
    ? Object.values(payload.candleSeriesByInstrument).filter((series) => series.candles.length > 0).length
    : 0;
  const newsFeed = payload.freshnessFeeds.find((feed) => feed.id === "news") ?? null;
  const fingerprint = evidenceFingerprint(payload.snapshot.evidence);
  const sparklineBySymbol = {
    ES: sparklineFromCandles(payload.candleSeriesByInstrument?.ES?.candles ?? []),
    VIX: sparklineFromCandles(payload.candleSeriesByInstrument?.VIX?.candles ?? []),
    DXY: sparklineFromCandles(payload.candleSeriesByInstrument?.DXY?.candles ?? []),
    OIL: sparklineFromCandles(payload.candleSeriesByInstrument?.OIL?.candles ?? []),
    QQQ: sparklineFromCandles(payload.candleSeriesByInstrument?.QQQ?.candles ?? []),
    NQ: sparklineFromCandles(payload.candleSeriesByInstrument?.NQ?.candles ?? []),
  } as const;

  return (
    <div className="todayLive" data-market-state={payload.marketState}>
      <section className="todayLiveHeader" aria-labelledby="today-live-title">
        <div>
          <p className="todayLiveEyebrow">Today · your {focusLabel.toLowerCase()}</p>
          <h1 id="today-live-title">Your market,<br /><em>prepared in minutes.</em></h1>
          <p>
            The current posture, what changed, the levels that matter and the
            conditions that would change the plan.
          </p>
        </div>
        <dl>
          <div><dt>Session</dt><dd>{payload.session.label}</dd></div>
          <div><dt>Now (ET)</dt><dd>{payload.session.nowEt}</dd></div>
          <div><dt>Updated</dt><dd>{payload.timestamp}</dd></div>
          <div><dt>Membership</dt><dd>{payload.tier}</dd></div>
          <div><dt>Desk</dt><dd>{focusLabel}</dd></div>
          <div><dt>Saved markets</dt><dd>{workspace.favourites.length}</dd></div>
        </dl>
      </section>

      <section className="todayLiveTrust" data-tone={statusTone(payload.snapshot.status)} aria-label="Verified data trust state">
        <div className="todayLiveTrustMark" aria-hidden="true">
          {payload.snapshot.status === "LIVE" ? "✓" : "!"}
        </div>
        <div>
          <span>Data trust</span>
          <strong>{payload.snapshot.status} · {payload.snapshotAge}</strong>
          <p>{displayText(payload.snapshot.source, "No verified market provider")}</p>
        </div>
        <div className="todayLiveTrustFeeds">
          {payload.freshnessFeeds.slice(0, 4).map((feed) => (
            <span key={feed.id} data-tone={statusTone(feed.status)}>
              <i aria-hidden="true" /> {feed.label}: {feed.status.replaceAll("_", " ")}
            </span>
          ))}
        </div>
      </section>

      <section className="todayPersonalFocus" aria-labelledby="today-personal-focus-title">
        <header>
          <div>
            <span>Your focus</span>
            <h2 id="today-personal-focus-title">{activeBrief?.title ?? `${focusLabel} ready`}</h2>
          </div>
          <dl>
            <div><dt>Layout</dt><dd>{focusLabel}</dd></div>
            <div><dt>Platform</dt><dd>{platformLabel}</dd></div>
            <div><dt>Mode</dt><dd>{workspace.focusMode ? "Focus on" : "Full desk"}</dd></div>
          </dl>
        </header>
        <div>
          <p>{activeBrief?.secondsCopy ?? "Your saved desk is ready. Verified focus details are currently unavailable."}</p>
          <ul>
            {(activeBrief?.bullets ?? [
              "No verified focus briefing is available.",
              `${workspace.favourites.length} markets are saved to this desk.`,
            ]).slice(0, 3).map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
        <footer>
          <span>{workspace.favourites.length} saved markets</span>
          <span>{workspace.compareIds.length} comparison slots</span>
          <Link href="/brief">Open your full brief →</Link>
        </footer>
      </section>

      <section className="todayDecisionDelta" aria-labelledby="today-decision-delta-title">
        <header>
          <div>
            <span>Bullseye decision delta</span>
            <h2 id="today-decision-delta-title">See the market. See what would change the plan.</h2>
            <p>A single evidence chain from verified conditions to confirmation, veto and review.</p>
          </div>
          <strong data-tone={posture.tone}>{posture.label}</strong>
        </header>

        <div className="todayDecisionDeltaGrid">
          <article data-step="now">
            <span>01 · Now</span>
            <h3>{posture.label}</h3>
            <p>{activeBrief?.secondsCopy ?? posture.detail}</p>
          </article>
          <article data-step="bull">
            <span>02 · Bullish confirmation</span>
            <h3>{buying?.status ?? "Unavailable"}</h3>
            <p>{buying?.watchingFor ?? "Await verified upside confirmation."}</p>
          </article>
          <article data-step="bear">
            <span>03 · Bearish confirmation</span>
            <h3>{selling?.status ?? "Unavailable"}</h3>
            <p>{selling?.watchingFor ?? "Await verified downside confirmation."}</p>
          </article>
          <article data-step="veto">
            <span>04 · Risk veto</span>
            <h3>{warnings.length} active condition{warnings.length === 1 ? "" : "s"}</h3>
            <p>{warnings[0]}</p>
          </article>
          <article data-step="next">
            <span>05 · Next decision point</span>
            <h3>{nextCatalysts[0]?.time ?? payload.session.countdownLabel ?? payload.session.label}</h3>
            <p>{nextCatalysts[0]?.title ?? payload.session.nextEventLabel ?? "Await the next verified session transition."}</p>
          </article>
          <article data-step="review">
            <span>06 · Prior brief delta</span>
            <h3>{payload.briefChange?.available ? "Comparison ready" : "Awaiting history"}</h3>
            <p>{payload.briefChange?.headline ?? "No earlier immutable session brief is available for comparison."}</p>
          </article>
        </div>

        <div className="todaySessionFingerprint">
          <div>
            <span>Session fingerprint</span>
            <h3>Five verified dimensions. No hidden composite score.</h3>
            <p>Every bar is a preserved evidence input. Missing dimensions remain visibly unavailable.</p>
          </div>
          <div className="todayFingerprintBars">
            {fingerprint.map((dimension) => (
              <div key={dimension.key} data-available={dimension.value === null ? "false" : "true"}>
                <header>
                  <span>{dimension.label}</span>
                  <strong>{dimension.value === null ? "—" : dimension.value}</strong>
                </header>
                <div
                  role="meter"
                  aria-label={`${dimension.label} evidence`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={dimension.value ?? undefined}
                >
                  <i style={{ width: `${dimension.value ?? 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="todayBroadcast" aria-labelledby="today-broadcast-title">
        <header>
          <div>
            <span>AI market broadcast</span>
            <h2 id="today-broadcast-title">Watch the plan. Review the outcome.</h2>
            <p>Human-reviewed video briefings supported by the same verified evidence shown on this page.</p>
          </div>
          <div className="todayBroadcastCadence">
            <span>Pre-market</span>
            <i aria-hidden="true">→</i>
            <span>Closing review</span>
          </div>
        </header>
        <div className="todayBroadcastGrid">
          <BroadcastEpisode
            slot="Pre-market"
            videoId={premarketVideoId}
            publishedAt={premarketPublishedAt}
            summary={activeBrief?.secondsCopy ?? posture.detail}
            transcript={activeBrief?.bullets ?? [posture.detail, displayText(payload.snapshot.summary)]}
          />
          <BroadcastEpisode
            slot="Closing review"
            videoId={closeVideoId}
            publishedAt={closePublishedAt}
            summary={payload.briefChange?.headline ?? "The closing review is published only after the session evidence has been checked."}
            transcript={[
              ...(payload.briefChange?.stateChanges.map((item) => `${item.label}: ${item.from} to ${item.to}.`) ?? []),
              ...(payload.briefChange?.quoteChanges.map((item) => `${item.label}: ${item.from} to ${item.to}.`) ?? []),
              "No closing outcome is inferred before a verified review is available.",
            ]}
          />
        </div>
        <footer>
          Videos are educational commentary, manually approved before publication and never treated as executable trade instructions.
        </footer>
      </section>

      <section className="todayLiveCockpit" aria-labelledby="today-cockpit-title">
        <article className="todayCockpitDecision" data-tone={posture.tone}>
          <header>
            <span>Decision now</span>
            <b>{verifiedWindow ? "Confirmation gated" : "Safety locked"}</b>
          </header>
          <div>
            <p>{payload.deskSignals?.overallLean?.replaceAll("-", " ") ?? "Insufficient"}</p>
            <h2 id="today-cockpit-title">{posture.label}</h2>
            <strong>{posture.detail}</strong>
          </div>
          <ul>
            {(payload.deskSignals?.contextNotes ?? ["Verified directional context is not available."])
              .slice(0, 3)
              .map((note) => <li key={note}>{note}</li>)}
          </ul>
        </article>

        <div className="todayCockpitSide">
          <article className="todayCockpitTiming">
            <span>Session clock</span>
            <strong>{payload.session.countdownLabel ?? payload.session.label}</strong>
            <p>{payload.session.nextEventLabel ?? payload.session.detail}</p>
            <small>{payload.session.nowEt}</small>
          </article>
          <article className="todayCockpitCatalyst">
            <span>Next verified catalyst</span>
            {nextCatalysts[0] ? (
              <>
                <strong>{nextCatalysts[0].time}</strong>
                <p>{nextCatalysts[0].title}</p>
                <small data-risk={nextCatalysts[0].risk}>{nextCatalysts[0].risk} impact</small>
              </>
            ) : (
              <>
                <strong>Unavailable</strong>
                <p>No verified calendar row is present.</p>
                <small>No event invented</small>
              </>
            )}
          </article>
        </div>

        <article className="todayCockpitStructure">
          <header>
            <div>
              <span>ES verified structure</span>
              <strong>{esQuote?.value ?? "Unavailable"}</strong>
              <small>{esQuote?.change ?? "No verified move"}</small>
            </div>
            <Sparkline
              values={esSparkline}
              tone={esQuote?.direction ?? "neutral"}
              label="Verified ES rolling candle trend"
              width={260}
              height={68}
              filled
            />
          </header>
          {esRange ? (
            <RangePositionLane markers={esRange} title="ES position within the verified rolling 24-hour range" />
          ) : (
            <p className="todayCockpitUnavailable">Verified candle history is insufficient for a range visual.</p>
          )}
        </article>
      </section>

      <section className="todayStructureChart" aria-labelledby="today-structure-chart-title">
        <header>
          <div>
            <span>Verified price structure</span>
            <h2 id="today-structure-chart-title">Opening range, support and resistance.</h2>
          </div>
          <div className="todayStructureLegend" aria-label="Structure level legend">
            <span data-level="support"><i aria-hidden="true" /> Support</span>
            <span data-level="resistance"><i aria-hidden="true" /> Resistance</span>
          </div>
        </header>
        {payload.candleSeriesByInstrument?.ES ? (
          <DashboardCandlestickChart
            series={payload.candleSeriesByInstrument.ES}
            instrument="ES"
            compact
            structureLevels={{
              support: esStructure?.support
                ? { value: esStructure.support.value, label: "Support" }
                : null,
              resistance: esStructure?.resistance
                ? { value: esStructure.resistance.value, label: "Resistance" }
                : null,
            }}
          />
        ) : (
          <div className="todayStructureUnavailable">
            <strong>Verified ES candlesticks unavailable</strong>
            <p>The structure chart stays empty until valid OHLC candle history is present.</p>
          </div>
        )}
        <footer>
          Support and resistance are educational rolling 24-hour structure levels derived from verified candle lows and highs.
        </footer>
      </section>

      {payload.candleSeriesByInstrument ? (
        <section className="todayVisualIntelligence" aria-label="Cross-asset visual intelligence">
          <CrossAssetCandleGallery
            seriesByInstrument={payload.candleSeriesByInstrument}
            eyebrow="MULTI-MARKET VISUAL INTELLIGENCE"
            title="Compare the markets shaping today’s decision."
          />
        </section>
      ) : null}

      <section className="todayCoverageMap" aria-labelledby="today-coverage-title">
        <header>
          <div>
            <span>Information coverage</span>
            <h2 id="today-coverage-title">What the platform can verify right now.</h2>
          </div>
          <Link href="/terminal/diagnostics">Inspect feed health →</Link>
        </header>
        <div>
          <article data-tone={statusTone(payload.snapshot.status)}>
            <i aria-hidden="true" />
            <span>Market snapshot</span>
            <strong>{payload.snapshot.status}</strong>
            <p>{payload.snapshot.quotes.length} verified quote rows · {payload.snapshotAge}</p>
          </article>
          <article data-tone={candleFeedCount ? "positive" : "negative"}>
            <i aria-hidden="true" />
            <span>Candlestick feeds</span>
            <strong>{candleFeedCount} / 6</strong>
            <p>Structurally valid OHLC histories available in this desk payload.</p>
          </article>
          <article data-tone={nextCatalysts.length ? "warning" : "negative"}>
            <i aria-hidden="true" />
            <span>Economic catalysts</span>
            <strong>{nextCatalysts.length}</strong>
            <p>{nextCatalysts.length ? "Verified calendar events currently on radar." : "No verified events in the current window."}</p>
          </article>
          <article data-tone={newsFeed ? statusTone(newsFeed.status) : "negative"}>
            <i aria-hidden="true" />
            <span>Market news</span>
            <strong>{newsFeed?.status.replaceAll("_", " ") ?? "UNAVAILABLE"}</strong>
            <p>{newsFeed?.detail ?? "No verified news provider is connected, so no headlines are invented."}</p>
          </article>
        </div>
      </section>

      {payload.briefChange ? (
        <section className="todayBriefChange" aria-labelledby="today-change-title">
          <header>
            <div>
              <span>Since the prior brief</span>
              <h2 id="today-change-title">What changed?</h2>
            </div>
            <small>{payload.briefChange.previousSessionDate ?? "Awaiting prior session"}</small>
          </header>
          <p>{payload.briefChange.headline}</p>
          {payload.briefChange.available ? (
            <div className="todayBriefChangeGrid">
              {payload.briefChange.stateChanges.map((item) => (
                <article key={item.label} data-changed={item.changed}>
                  <span>{item.label}</span>
                  <div><del>{item.from}</del><i aria-hidden="true">→</i><strong>{item.to}</strong></div>
                  <small>{item.changed ? "Changed" : "Unchanged"}</small>
                </article>
              ))}
              {payload.briefChange.quoteChanges.slice(0, 4).map((item) => (
                <article key={item.label} data-changed="true">
                  <span>{item.label}</span>
                  <div><del>{item.from}</del><i aria-hidden="true">→</i><strong>{item.to}</strong></div>
                  <small>Verified quote changed</small>
                </article>
              ))}
            </div>
          ) : null}
          <footer>Compared only with the latest earlier immutable session snapshot. Missing evidence stays missing.</footer>
        </section>
      ) : null}

      <section className="todayLivePosture" data-tone={posture.tone} aria-labelledby="today-posture-title">
        <header>
          <span>01 / Session posture</span>
          <b>{verifiedWindow ? "Confirmation required" : "Trading safety lock"}</b>
        </header>
        <div className="todayLivePostureMain">
          <p>Current decision</p>
          <h2 id="today-posture-title">{posture.label}</h2>
          <strong>{posture.detail}</strong>
        </div>
        <div className="todayLivePostureWhy">
          <span>Why this posture</span>
          <p>{displayText(payload.snapshot.summary)}</p>
          <ul>
            {payload.deskSignals?.contextNotes.slice(0, 3).map((note) => <li key={note}>{note}</li>)}
            {!payload.deskSignals?.contextNotes.length ? <li>Verified directional context is not available.</li> : null}
          </ul>
        </div>
      </section>

      <section className="todayLivePaths" aria-labelledby="today-paths-title">
        <header>
          <div>
            <span>02 / Conditional paths</span>
            <h2 id="today-paths-title">Plan more than one outcome.</h2>
          </div>
          <p>Each path remains educational and confirmation-gated. No path is an executable order.</p>
        </header>

        <div className="todayLivePathGrid">
          <article data-tone="bull">
            <span>Bullish path</span>
            <h3>{buying?.headline ?? "Bullish path unavailable"}</h3>
            <p>{buying?.summary ?? "Verified inputs are insufficient for a bullish interpretation."}</p>
            <dl>
              <div>
                <dt>Evidence</dt>
                <dd>
                  <ul>{(buying?.drivers ?? ["Insufficient verified market data."]).slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul>
                </dd>
              </div>
              <div><dt>Confirmation</dt><dd>{buying?.watchingFor ?? "Await verified upside confirmation."}</dd></div>
              <div><dt>Invalidation</dt><dd>{esStructure?.resistance ? `Failure to accept above ${esStructure.resistance.display}, or a verified deterioration in supporting evidence.` : "Withheld until verified structure is available."}</dd></div>
            </dl>
            <footer>{buying?.status ?? "unavailable"}</footer>
          </article>

          <article data-tone="bear">
            <span>Bearish path</span>
            <h3>{selling?.headline ?? "Bearish path unavailable"}</h3>
            <p>{selling?.summary ?? "Verified inputs are insufficient for a bearish interpretation."}</p>
            <dl>
              <div>
                <dt>Evidence</dt>
                <dd>
                  <ul>{(selling?.drivers ?? ["Insufficient verified market data."]).slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul>
                </dd>
              </div>
              <div><dt>Confirmation</dt><dd>{selling?.watchingFor ?? "Await verified downside confirmation."}</dd></div>
              <div><dt>Invalidation</dt><dd>{esStructure?.support ? `Recovery through ${esStructure.support.display}, or a verified improvement in supporting evidence.` : "Withheld until verified structure is available."}</dd></div>
            </dl>
            <footer>{selling?.status ?? "unavailable"}</footer>
          </article>

          <article data-tone="neutral">
            <span>Stand aside</span>
            <h3>Capital protection conditions</h3>
            <p>Remain out when the evidence does not support a clean, verified decision.</p>
            <dl>
              <div>
                <dt>No-trade conditions</dt>
                <dd><ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></dd>
              </div>
              <div><dt>Confirmation</dt><dd>Neither path receives permission while freshness, catalysts or structure conflict.</dd></div>
              <div><dt>Invalidation</dt><dd>A directional path becomes valid only when its own verified confirmation conditions clear.</dd></div>
            </dl>
            <footer>{warnings.length ? "active protection" : "monitoring"}</footer>
          </article>
        </div>
      </section>

      <section className="todayLiveEvidence" aria-labelledby="today-evidence-title">
        <header>
          <div>
            <span>03 / Evidence</span>
            <h2 id="today-evidence-title">The inputs behind the brief.</h2>
          </div>
          <Link href="/brief">Open full evidence →</Link>
        </header>

        <div className="todayLiveEvidenceGrid">
          {payload.snapshot.quotes.slice(0, 6).map((quote) => (
            <article key={quote.symbol} data-direction={quote.direction}>
              <span>{quote.label}</span>
              <strong>{quote.value}</strong>
              <small>{quote.change}</small>
              {quote.symbol === "US2Y" ? (
                <div className="todayYieldContext">
                  <span>Front-end pressure</span>
                  <b>Policy-sensitive benchmark</b>
                  <small>Verified scalar · no candle history</small>
                </div>
              ) : quote.symbol === "US10Y" ? (
                <div className="todayYieldContext" data-tone={treasuryCurve.tone}>
                  <span>10Y − 2Y curve</span>
                  <b>{treasuryCurve.value}</b>
                  <small>{treasuryCurve.detail}</small>
                </div>
              ) : (
                <Sparkline
                  values={sparklineBySymbol[quote.symbol as keyof typeof sparklineBySymbol]}
                  tone={quote.direction}
                  label={`${quote.label} verified rolling candle trend`}
                  filled
                />
              )}
            </article>
          ))}
          {!payload.snapshot.quotes.length ? (
            <article className="isUnavailable">
              <span>Verified quotes</span>
              <strong>Unavailable</strong>
              <small>No live values supplied</small>
            </article>
          ) : null}
        </div>

        <div className="todayLiveEvidenceDetail">
          <article>
            <span>S&amp;P 500 structure</span>
            <h3>{esStructure?.status === "ready" ? "Verified range available" : "Structure unavailable"}</h3>
            <dl>
              <div><dt>Last</dt><dd>{esQuote?.value ?? "Unavailable"}</dd></div>
              <div><dt>Resistance</dt><dd>{esStructure?.resistance?.display ?? "Withheld"}</dd></div>
              <div><dt>Support</dt><dd>{esStructure?.support?.display ?? "Withheld"}</dd></div>
            </dl>
            <p>{esStructure?.summary ?? "No verified OHLCV series is available for structure."}</p>
          </article>
          <article>
            <span>Next catalysts</span>
            <h3>{nextCatalysts.length ? "Verified calendar rows" : "Calendar unavailable"}</h3>
            <ul>
              {nextCatalysts.map((item) => (
                <li key={item.id}><b>{item.time}</b><span>{item.title}</span><em>{item.risk}</em></li>
              ))}
              {!nextCatalysts.length ? <li><span>No verified catalyst rows in the current snapshot.</span></li> : null}
            </ul>
            <p>{payload.catalystRadar.disclosure}</p>
          </article>
        </div>
      </section>

      <section className="todayLiveReview" aria-labelledby="today-review-title">
        <div>
          <span>04 / Review</span>
          <h2 id="today-review-title">Close the loop after the session.</h2>
          <p>Preserve what was known beforehand, record the decision and review the process without rewriting history.</p>
        </div>
        <div className="todayLiveReviewActions">
          {payload.paid ? <DecisionCapture posture={posture.label} /> : null}
          <Link href="/journal"><span>01</span><strong>Record today’s decision</strong><small>Journal the action or stand-aside.</small></Link>
          <Link href="/review"><span>02</span><strong>Review the session</strong><small>Compare the process with the verified record.</small></Link>
          <Link href="/archive"><span>03</span><strong>Open the archive</strong><small>Inspect saved briefing history.</small></Link>
        </div>
      </section>

      <footer className="todayLiveDisclosure">
        <strong>Educational market analysis only.</strong>
        <span>{payload.deskSignals?.disclosure ?? "Directional output remains unavailable until verified inputs are complete."}</span>
      </footer>
    </div>
  );
}
