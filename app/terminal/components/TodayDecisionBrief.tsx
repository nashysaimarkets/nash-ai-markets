import Link from "next/link";
import { RangePositionLane } from "../../components/mini-visuals/RangePositionLane";
import { Sparkline } from "../../components/mini-visuals/Sparkline";
import {
  parsePriceLevel,
  rangeLaneFromCandles,
  sparklineFromCandles,
} from "../../components/mini-visuals/mini-visual-data";
import type { TradingDeskPayload } from "../lib/desk-payload";
import { DecisionCapture } from "./DecisionCapture";

type Posture = {
  label: string;
  detail: string;
  tone: "positive" | "negative" | "warning" | "unavailable";
};

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

export function TodayDecisionBrief({ payload }: { payload: TradingDeskPayload }) {
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
          <p className="todayLiveEyebrow">Today · verified decision cockpit</p>
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
