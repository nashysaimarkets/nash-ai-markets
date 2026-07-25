"use client";

import Link from "next/link";
import { startTransition, useEffect, useEffectEvent, useMemo, useState } from "react";
import {
  MARKET_CATALOG,
  coverageDetail,
  coverageLabel,
  getMarketInstrument,
  type MarketGroupId,
  type MarketInstrument,
} from "../../lib/markets/market-catalog.ts";
import { isCandleInstrument, type CandleInstrument } from "../../lib/providers/candle-instruments.ts";
import type { CustomerCandleSeries } from "../../lib/providers/financial-modeling-prep-candles.ts";
import { DashboardCandlestickChart } from "../../dashboard/components/DashboardCandlestickChart.tsx";
import { LockedPremiumCard } from "./LockedPremiumCard.tsx";
import { TerminalBadge } from "./TerminalBadge.tsx";
import { DESK_WIDGET_REGISTRY, type DeskWidgetId } from "../lib/desk-widgets.ts";
import {
  DESK_PRESETS,
  applyPreset,
  createDefaultWorkspace,
  journalDayKey,
  journalKey,
  persistWorkspaceToBrowser,
  readJournalMap,
  readWorkspaceFromBrowser,
  writeJournalEntry,
  type DeskPresetId,
  type DeskWorkspaceState,
  type JournalEntry,
} from "../lib/desk-workspace.ts";
import { readSessionClock } from "../lib/session-clock.ts";
import { createEdgeBrief } from "../lib/edge-brief.ts";
import { createCatalystRadar } from "../lib/catalyst-radar.ts";
import type { TradingDeskPayload } from "../lib/desk-payload.ts";
import {
  PREFERRED_PLATFORMS,
  PREFERRED_PLATFORM_IDS,
  resolvePlatformEmbed,
  resolvePlatformLaunch,
} from "../lib/preferred-platforms.ts";

function favouriteInstruments(ids: string[]): MarketInstrument[] {
  return ids.map((id) => getMarketInstrument(id)).filter((item): item is MarketInstrument => Boolean(item));
}

function candleForMarket(
  instrument: MarketInstrument,
  bundle: TradingDeskPayload["candleSeriesByInstrument"],
): CustomerCandleSeries | null {
  if (!bundle) return null;
  if (!isCandleInstrument(instrument.symbol)) return null;
  return bundle[instrument.symbol] ?? null;
}

function structureForSymbol(payload: TradingDeskPayload, symbol: string) {
  return payload.structureLevels?.instruments.find((item) => item.symbol === symbol) ?? null;
}

function quoteFor(payload: TradingDeskPayload, symbol: string) {
  return payload.snapshot.quotes.find((item) => item.symbol === symbol);
}

export function TradingDeskOS({ payload }: { payload: TradingDeskPayload }) {
  const [workspace, setWorkspace] = useState<DeskWorkspaceState>(payload.initialWorkspace);
  const [hydrated, setHydrated] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [layoutName, setLayoutName] = useState("");
  const [session, setSession] = useState(payload.session);
  const [openGroup, setOpenGroup] = useState<MarketGroupId | null>("indices");
  const [marketsOpen, setMarketsOpen] = useState(false);
  const [journal, setJournal] = useState<JournalEntry | null>(null);
  const [embedAllowed, setEmbedAllowed] = useState(false);

  const onPersist = useEffectEvent((next: DeskWorkspaceState) => {
    persistWorkspaceToBrowser(next);
  });

  useEffect(() => {
    const stored = readWorkspaceFromBrowser();
    startTransition(() => {
      setWorkspace(stored.version === 1 ? stored : payload.initialWorkspace);
      setHydrated(true);
    });
  }, [payload.initialWorkspace]);

  useEffect(() => {
    if (!hydrated) return;
    onPersist(workspace);
  }, [workspace, hydrated]);

  useEffect(() => {
    const tick = () => setSession(readSessionClock(new Date()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const active = getMarketInstrument(workspace.activeMarketId) ?? getMarketInstrument("es")!;
  const favourites = favouriteInstruments(workspace.favourites);
  const activeCandle = candleForMarket(active, payload.candleSeriesByInstrument);
  const activeQuote = quoteFor(payload, active.symbol);
  const activeStructure = structureForSymbol(payload, active.symbol);

  const platformLaunch = useMemo(
    () => resolvePlatformLaunch(workspace.preferredPlatformId, active, workspace.externalUrlTemplate),
    [workspace.preferredPlatformId, workspace.externalUrlTemplate, active],
  );
  const platformEmbed = useMemo(
    () => resolvePlatformEmbed(workspace.preferredPlatformId, active),
    [workspace.preferredPlatformId, active],
  );

  useEffect(() => {
    setEmbedAllowed(false);
  }, [active.id, workspace.preferredPlatformId]);

  useEffect(() => {
    const day = journalDayKey();
    const map = readJournalMap();
    const existing = map[journalKey(active.id, day)];
    setJournal(
      existing ?? {
        marketId: active.id,
        dayKey: day,
        note: "",
        checklist: [
          { label: "Checked freshness trust bar", done: false },
          { label: "Reviewed catalysts / calendar", done: false },
          { label: "Defined invalidation before size", done: false },
        ],
        updatedAt: new Date().toISOString(),
      },
    );
  }, [active.id]);

  const edgeBrief = useMemo(
    () =>
      payload.edgeBriefByMarketId[active.id] ??
      createEdgeBrief({
        instrument: active,
        snapshot: payload.snapshot,
        candle: activeCandle,
        structure: activeStructure,
        deskSignals: payload.deskSignals,
        events: payload.snapshot.events,
        session,
        snapshotAge: payload.snapshotAge,
      }),
    [active, activeCandle, activeStructure, payload, session],
  );

  const catalyst = useMemo(
    () =>
      createCatalystRadar({
        events: payload.snapshot.events,
        active,
        favourites,
      }),
    [active, favourites, payload.snapshot.events],
  );

  const visibleWidgets = workspace.widgets.filter((id) => !workspace.hidden.includes(id));
  const stageWidgets = workspace.focusMode
    ? visibleWidgets.filter((id) => DESK_WIDGET_REGISTRY[id].stage)
    : visibleWidgets;
  const railWidgets = workspace.focusMode
    ? visibleWidgets.filter((id) => !DESK_WIDGET_REGISTRY[id].stage)
    : [];
  const stackedWidgets = workspace.focusMode ? stageWidgets : visibleWidgets;

  function updateWorkspace(patch: Partial<DeskWorkspaceState> | ((prev: DeskWorkspaceState) => DeskWorkspaceState)) {
    setWorkspace((prev) => {
      const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch, preset: "custom" as DeskPresetId };
      return next;
    });
  }

  function selectMarket(instrument: MarketInstrument) {
    updateWorkspace({ activeMarketId: instrument.id, preset: workspace.preset === "custom" ? "custom" : workspace.preset });
    setMarketsOpen(false);
    setOpenGroup(instrument.group);
  }

  function toggleFavourite(id: string) {
    updateWorkspace((prev) => {
      const has = prev.favourites.includes(id);
      return {
        ...prev,
        preset: "custom",
        favourites: has ? prev.favourites.filter((item) => item !== id) : [...prev.favourites, id].slice(0, 24),
      };
    });
  }

  function moveWidget(id: DeskWidgetId, direction: -1 | 1) {
    updateWorkspace((prev) => {
      const order = [...prev.widgets];
      const index = order.indexOf(id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return prev;
      const swap = order[nextIndex]!;
      order[nextIndex] = id;
      order[index] = swap;
      return { ...prev, widgets: order, preset: "custom" };
    });
  }

  function toggleWidget(id: DeskWidgetId) {
    updateWorkspace((prev) => {
      const hidden = prev.hidden.includes(id)
        ? prev.hidden.filter((item) => item !== id)
        : [...prev.hidden, id];
      return { ...prev, hidden, preset: "custom" };
    });
  }

  function saveNamedLayout() {
    const name = layoutName.trim().slice(0, 40);
    if (!name) return;
    updateWorkspace((prev) => ({
      ...prev,
      preset: "custom",
      namedLayouts: [
        { name, widgets: [...prev.widgets], favourites: [...prev.favourites] },
        ...prev.namedLayouts.filter((layout) => layout.name !== name),
      ].slice(0, 8),
    }));
    setLayoutName("");
  }

  function renderWidget(id: DeskWidgetId) {
    switch (id) {
      case "freshness-trust":
        return (
          <section key={id} className="deskWidget deskFreshness" aria-label="Freshness trust bar">
            <header>
              <span>Freshness trust</span>
              <strong>Every active feed, honestly labelled</strong>
            </header>
            <ul>
              {payload.freshnessFeeds.map((feed) => (
                <li key={feed.id} data-status={feed.status}>
                  <span>{feed.label}</span>
                  <TerminalBadge
                    label={feed.status.replace("_", " ")}
                    tone={
                      feed.status === "LIVE"
                        ? "positive"
                        : feed.status === "DELAYED" || feed.status === "PREVIOUS_SESSION" || feed.status === "MARKET_CLOSED"
                          ? "warning"
                          : "danger"
                    }
                    pulse={feed.status === "LIVE"}
                  />
                  <small>{feed.ageLabel}</small>
                  <em>{feed.detail}</em>
                </li>
              ))}
            </ul>
          </section>
        );
      case "session-clock":
        return (
          <section key={id} className={`deskWidget deskSession is-${session.phase}`} aria-label="Session command strip">
            <header>
              <span>Session command</span>
              <strong>{session.label}</strong>
            </header>
            <div className="deskSessionGrid">
              <div>
                <span>Now (ET)</span>
                <strong>{session.nowEt}</strong>
              </div>
              <div>
                <span>Countdown</span>
                <strong>{session.countdownLabel ?? "—"}</strong>
              </div>
              <div>
                <span>Next</span>
                <strong>{session.nextEventLabel ?? "—"}</strong>
              </div>
            </div>
            <p>{session.detail}</p>
            <small>{session.source}</small>
          </section>
        );
      case "quote-overview":
        return (
          <section key={id} className="deskWidget deskQuote" aria-labelledby="desk-quote-title">
            <header>
              <div>
                <span>Quote overview</span>
                <h2 id="desk-quote-title">{active.name}</h2>
              </div>
              <TerminalBadge label={coverageLabel(active.coverage)} tone={active.coverage === "live" ? "positive" : active.coverage === "proxy" ? "warning" : "info"} />
            </header>
            {activeQuote ? (
              <div className="deskQuoteBody">
                <strong className={`is-${activeQuote.direction}`}>{activeQuote.value}</strong>
                <span className={`ctMove is-${activeQuote.direction}`}>{activeQuote.change}</span>
                <small>{payload.snapshotAge} · {payload.snapshot.status}</small>
              </div>
            ) : (
              <div className="deskUnavailable" role="status">
                <strong>Quote unavailable</strong>
                <p>{coverageDetail(active)}</p>
              </div>
            )}
          </section>
        );
      case "primary-chart":
        return (
          <section key={id} className="deskWidget deskChart" aria-label="Primary verified chart">
            <header>
              <span>Primary chart</span>
              <strong>{active.symbol} · verified candles only</strong>
            </header>
            {!payload.paid ? (
              <LockedPremiumCard
                tier="pro"
                title="Unlock the verified market chart"
                value="Pro and Elite members receive verified candlesticks with interval controls and fail-closed empty states."
                benefits={["Verified OHLCV history", "Interval controls", "No invented candles"]}
                previewEligible={payload.preview.eligible}
                previewAvailable={payload.preview.available}
                previewCadence={payload.preview.cadence}
              />
            ) : activeCandle && isCandleInstrument(active.symbol) ? (
              <DashboardCandlestickChart series={activeCandle} instrument={active.symbol as CandleInstrument} />
            ) : (
              <div className="deskUnavailable" role="status">
                <strong>Chart unavailable for {active.symbol}</strong>
                <p>
                  {isCandleInstrument(active.symbol)
                    ? "Verified candle history could not be loaded for this instrument right now."
                    : "Candlestick history is not on the verified provider path for this market. No synthetic series is shown."}
                </p>
              </div>
            )}
          </section>
        );
      case "edge-brief":
        return (
          <section key={id} className={`deskWidget deskEdge is-${edgeBrief.status}`} aria-labelledby="edge-brief-title">
            <header>
              <span>Edge brief</span>
              <h2 id="edge-brief-title">{edgeBrief.title}</h2>
            </header>
            <p className="deskEdgeLead">{edgeBrief.secondsCopy}</p>
            <ul>{edgeBrief.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
            <small>{edgeBrief.disclosure}</small>
          </section>
        );
      case "structure-map":
        return (
          <section key={id} className="deskWidget deskStructure" aria-labelledby="structure-map-title">
            <header>
              <span>Structure map</span>
              <h2 id="structure-map-title">Educational levels from verified candles</h2>
            </header>
            {activeStructure?.status === "ready" && activeStructure.support && activeStructure.resistance ? (
              <div className="deskStructureBody">
                <dl>
                  <div><dt>Support</dt><dd>{activeStructure.support.display}</dd></div>
                  <div><dt>Resistance</dt><dd>{activeStructure.resistance.display}</dd></div>
                </dl>
                <ul>
                  {activeStructure.references.map((ref) => (
                    <li key={ref.kind}><b>{ref.label}</b> {ref.display}</li>
                  ))}
                </ul>
                <p>{activeStructure.summary}</p>
              </div>
            ) : (
              <div className="deskUnavailable" role="status">
                <strong>Structure unavailable</strong>
                <p>{activeStructure?.summary ?? "No verified candle range is attached for this instrument."}</p>
              </div>
            )}
            {payload.structureLevels ? <small>{payload.structureLevels.disclosure}</small> : null}
          </section>
        );
      case "watchlist":
        return (
          <section key={id} className="deskWidget deskWatchlist" aria-labelledby="watchlist-title">
            <header>
              <span>Watchlist</span>
              <h2 id="watchlist-title">Favourites</h2>
            </header>
            <ul className="deskWatchGrid">
              {favourites.map((item) => {
                const quote = quoteFor(payload, item.symbol);
                return (
                  <li key={item.id}>
                    <button type="button" className={item.id === active.id ? "is-active" : undefined} onClick={() => selectMarket(item)}>
                      <span>{item.symbol}</span>
                      <strong>{quote?.value ?? "—"}</strong>
                      <small>{quote?.change ?? coverageLabel(item.coverage)}</small>
                    </button>
                    <button type="button" className="deskStar" aria-label={`Remove ${item.symbol} from favourites`} onClick={() => toggleFavourite(item.id)}>★</button>
                  </li>
                );
              })}
            </ul>
            {!favourites.length ? <p className="deskUnavailable">Add markets from the browser to build your watchlist.</p> : null}
          </section>
        );
      case "compare-rail":
        return (
          <section key={id} className="deskWidget deskCompare" aria-labelledby="compare-title">
            <header>
              <span>Compare rail</span>
              <h2 id="compare-title">Side-compare favourites with candles</h2>
            </header>
            <div className="deskCompareGrid">
              {workspace.compareIds.map((compareId) => {
                const instrument = getMarketInstrument(compareId);
                if (!instrument) return null;
                const series = candleForMarket(instrument, payload.candleSeriesByInstrument);
                const quote = quoteFor(payload, instrument.symbol);
                return (
                  <article key={compareId}>
                    <header>
                      <strong>{instrument.symbol}</strong>
                      <span>{quote?.value ?? "—"}</span>
                    </header>
                    {payload.paid && series && isCandleInstrument(instrument.symbol) ? (
                      <DashboardCandlestickChart series={series} instrument={instrument.symbol as CandleInstrument} compact />
                    ) : (
                      <p>{coverageDetail(instrument)}</p>
                    )}
                  </article>
                );
              })}
            </div>
            <div className="deskComparePick">
              {favourites.filter((item) => item.id !== active.id).slice(0, 8).map((item) => {
                const selected = workspace.compareIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={selected ? "is-selected" : undefined}
                    onClick={() =>
                      updateWorkspace((prev) => {
                        const has = prev.compareIds.includes(item.id);
                        const compareIds = has
                          ? prev.compareIds.filter((id) => id !== item.id)
                          : [...prev.compareIds, item.id].slice(0, 3);
                        return { ...prev, compareIds, preset: "custom" };
                      })
                    }
                  >
                    {item.symbol}
                  </button>
                );
              })}
            </div>
          </section>
        );
      case "catalyst-radar":
        return (
          <section key={id} className="deskWidget deskCatalyst" aria-labelledby="catalyst-title">
            <header>
              <span>Catalyst radar</span>
              <h2 id="catalyst-title">Macro timeline for your desk</h2>
            </header>
            {catalyst.items.length ? (
              <ol>
                {catalyst.items.map((item) => (
                  <li key={item.id}>
                    <time>{item.time}</time>
                    <strong>{item.title}</strong>
                    <TerminalBadge label={item.risk} tone={item.risk === "HIGH" ? "danger" : "warning"} />
                    <p>{item.relevance}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="deskUnavailable" role="status">
                <strong>No verified macro catalysts in window</strong>
                <p>US medium/high-impact calendar rows were empty in the current snapshot.</p>
              </div>
            )}
            <ul className="deskUnavailableList">
              {catalyst.unavailable.map((item) => (
                <li key={item.kind}><b>{item.kind}</b> — {item.reason}</li>
              ))}
            </ul>
            <small>{catalyst.disclosure}</small>
          </section>
        );
      case "economic-calendar":
        return (
          <section key={id} className="deskWidget deskCalendar" aria-labelledby="econ-cal-title">
            <header>
              <span>Economic calendar</span>
              <h2 id="econ-cal-title">Verified US releases</h2>
            </header>
            {payload.snapshot.events.length ? (
              <div className="ctEvents">
                {payload.snapshot.events.map((event) => (
                  <article key={`${event.time}-${event.name}`}>
                    <time>{event.time}</time>
                    <strong>{event.name}</strong>
                    <span>{event.risk}</span>
                  </article>
                ))}
              </div>
            ) : (
              <div className="deskUnavailable" role="status">
                <strong>Calendar unavailable</strong>
                <p>No verified US medium/high-impact events are present in the current provider snapshot.</p>
              </div>
            )}
          </section>
        );
      case "earnings-calendar":
        return (
          <section key={id} className="deskWidget" aria-labelledby="earn-cal-title">
            <header>
              <span>Earnings calendar</span>
              <h2 id="earn-cal-title">{active.symbol} earnings</h2>
            </header>
            <div className="deskUnavailable" role="status">
              <strong>Earnings feed awaiting verified provider</strong>
              <p>No earnings-calendar path is wired for {active.name}. Dates and estimates are not invented.</p>
            </div>
          </section>
        );
      case "news-intelligence":
        return (
          <section key={id} className="deskWidget" aria-labelledby="news-title">
            <header>
              <span>News intelligence</span>
              <h2 id="news-title">Filtered by {active.symbol}</h2>
            </header>
            <div className="deskUnavailable" role="status">
              <strong>News feed awaiting verified provider</strong>
              <p>Market-filtered headlines will appear here once a verified FMP news path is connected. No placeholder stories are shown.</p>
            </div>
          </section>
        );
      case "volatility-context": {
        const vix = quoteFor(payload, "VIX");
        const vixCandle = payload.candleSeriesByInstrument?.VIX ?? null;
        return (
          <section key={id} className="deskWidget deskVol" aria-labelledby="vol-title">
            <header>
              <span>Volatility context</span>
              <h2 id="vol-title">VIX</h2>
            </header>
            {vix ? (
              <div className="deskQuoteBody">
                <strong className={`is-${vix.direction}`}>{vix.value}</strong>
                <span className={`ctMove is-${vix.direction}`}>{vix.change}</span>
                <small>{payload.snapshotAge}</small>
              </div>
            ) : (
              <div className="deskUnavailable" role="status">
                <strong>VIX quote unavailable</strong>
                <p>No verified VIX row in the current snapshot.</p>
              </div>
            )}
            {payload.paid && vixCandle ? (
              <DashboardCandlestickChart series={vixCandle} instrument="VIX" compact />
            ) : null}
          </section>
        );
      }
      case "desk-signals":
        return (
          <section key={id} className="deskWidget deskSignals" aria-labelledby="desk-signals-title">
            <header>
              <span>Desk signals</span>
              <h2 id="desk-signals-title">Educational directional lean</h2>
            </header>
            {payload.deskSignals ? (
              <>
                <p className="deskEdgeLead">Overall lean: <b>{payload.deskSignals.overallLean}</b></p>
                <div className="ctDeskSignalPair">
                  <article className="ctDeskSignalCard is-buying">
                    <div className="ctDeskSignalHead"><span>Buying</span><em>{payload.deskSignals.buying.status}</em></div>
                    <strong>{payload.deskSignals.buying.strength}</strong>
                    <ul>{payload.deskSignals.buying.drivers.slice(0, 3).map((driver) => <li key={driver}>{driver}</li>)}</ul>
                  </article>
                  <article className="ctDeskSignalCard is-selling">
                    <div className="ctDeskSignalHead"><span>Selling</span><em>{payload.deskSignals.selling.status}</em></div>
                    <strong>{payload.deskSignals.selling.strength}</strong>
                    <ul>{payload.deskSignals.selling.drivers.slice(0, 3).map((driver) => <li key={driver}>{driver}</li>)}</ul>
                  </article>
                </div>
                <small>{payload.deskSignals.disclosure}</small>
              </>
            ) : (
              <div className="deskUnavailable" role="status">
                <strong>Signals unavailable</strong>
                <p>Desk signals require verified snapshot inputs inside the decision window.</p>
              </div>
            )}
          </section>
        );
      case "risk-toolkit":
        return <RiskToolkit key={id} />;
      case "preferred-platform": {
        const platform = PREFERRED_PLATFORMS[workspace.preferredPlatformId];
        return (
          <section key={id} className="deskWidget deskPlatform" aria-labelledby="platform-title">
            <header>
              <span>Preferred platform</span>
              <h2 id="platform-title">{platform.label}</h2>
            </header>
            <p className="deskEdgeLead">{platform.description}</p>
            {platformLaunch.status === "ready" ? (
              <div className="deskPlatformLaunch">
                <a href={platformLaunch.url} target="_blank" rel="noopener noreferrer" className="deskLaunchBtn">
                  Open {active.symbol} in {platform.shortLabel}
                </a>
                <p>{platformLaunch.detail}</p>
              </div>
            ) : (
              <div className="deskUnavailable" role="status">
                <strong>No launch URL for this market</strong>
                <p>{platformLaunch.reason}</p>
              </div>
            )}
            <small>Deep links only — no order routing, OAuth, broker credentials, or invented fills.</small>
          </section>
        );
      }
      case "platform-embed":
        return (
          <section key={id} className="deskWidget deskPlatformEmbed" aria-labelledby="platform-embed-title">
            <header>
              <span>Platform embed</span>
              <h2 id="platform-embed-title">Third-party chart</h2>
            </header>
            {platformEmbed.status !== "ready" ? (
              <div className="deskUnavailable" role="status">
                <strong>Embed unavailable</strong>
                <p>{platformEmbed.reason}</p>
              </div>
            ) : !embedAllowed ? (
              <div className="deskEmbedGate">
                <p>{platformEmbed.detail}</p>
                <button type="button" onClick={() => setEmbedAllowed(true)}>Load TradingView embed</button>
                <small>Sandboxed iframe · no NASH keys · not the verified FMP desk feed</small>
              </div>
            ) : (
              <div className="deskEmbedFrame">
                <iframe
                  title={platformEmbed.title}
                  src={platformEmbed.src}
                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
                <small>{platformEmbed.detail}</small>
              </div>
            )}
          </section>
        );
      case "journal-lite":
        return (
          <section key={id} className="deskWidget deskJournal" aria-labelledby="journal-title">
            <header>
              <span>Journal lite</span>
              <h2 id="journal-title">{active.symbol} · {journal?.dayKey ?? journalDayKey()}</h2>
            </header>
            {journal ? (
              <>
                <label>
                  Notes
                  <textarea
                    value={journal.note}
                    rows={4}
                    onChange={(event) => {
                      const next = { ...journal, note: event.target.value, updatedAt: new Date().toISOString() };
                      setJournal(next);
                      writeJournalEntry(next);
                    }}
                  />
                </label>
                <ul className="deskChecklist">
                  {journal.checklist.map((item, index) => (
                    <li key={item.label}>
                      <label>
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => {
                            const checklist = journal.checklist.map((row, rowIndex) =>
                              rowIndex === index ? { ...row, done: !row.done } : row,
                            );
                            const next = { ...journal, checklist, updatedAt: new Date().toISOString() };
                            setJournal(next);
                            writeJournalEntry(next);
                          }}
                        />
                        {item.label}
                      </label>
                    </li>
                  ))}
                </ul>
                <small>Stored locally in this browser — not synced to the server journal API.</small>
              </>
            ) : null}
          </section>
        );
      default:
        return null;
    }
  }

  return (
    <div className={`tradingDeskOS${workspace.focusMode ? " is-focus" : ""}`} id="overview">
      <section className="deskHero" aria-labelledby="desk-hero-title">
        <img className="deskHeroMark" src="/brand/logo-mark.svg" alt="" aria-hidden="true" />
        <div className="deskHeroCopy">
          <span className="ctEyebrow">NASH AI MARKETS</span>
          <h1 id="desk-hero-title">Trading Desk</h1>
          <p>Build your own page across interchangeable markets — verified feeds only, honest empty states everywhere else.</p>
        </div>
        <div className="deskHeroActions">
          <button type="button" className={workspace.focusMode ? "is-on" : undefined} onClick={() => setWorkspace((prev) => ({ ...prev, focusMode: !prev.focusMode }))}>
            {workspace.focusMode ? "Exit focus" : "Market focus"}
          </button>
          <button type="button" className={builderOpen ? "is-on" : undefined} onClick={() => setBuilderOpen((open) => !open)}>
            Desk builder
          </button>
          <button type="button" onClick={() => setMarketsOpen(true)}>Markets</button>
        </div>
      </section>

      <div className="deskPresetRow" role="toolbar" aria-label="Desk presets">
        {(Object.keys(DESK_PRESETS) as Array<keyof typeof DESK_PRESETS>).map((presetId) => (
          <button
            key={presetId}
            type="button"
            className={workspace.preset === presetId ? "is-selected" : undefined}
            onClick={() => setWorkspace(applyPreset(presetId))}
            title={DESK_PRESETS[presetId].description}
          >
            {DESK_PRESETS[presetId].label}
          </button>
        ))}
        <button type="button" className={workspace.preset === "custom" ? "is-selected" : undefined} onClick={() => updateWorkspace({ preset: "custom" })}>
          Custom
        </button>
        {workspace.namedLayouts.map((layout) => (
          <button
            key={layout.name}
            type="button"
            onClick={() =>
              updateWorkspace({
                widgets: layout.widgets,
                favourites: layout.favourites,
                preset: "custom",
              })
            }
          >
            {layout.name}
          </button>
        ))}
      </div>

      {builderOpen ? (
        <section className="deskBuilder" aria-labelledby="desk-builder-title">
          <header>
            <div>
              <span>Desk builder</span>
              <h2 id="desk-builder-title">Stack, hide, and save your layout</h2>
            </div>
            <button type="button" onClick={() => setWorkspace(createDefaultWorkspace(active.id))}>Reset</button>
          </header>
          <ul className="deskBuilderList">
            {workspace.widgets.map((id, index) => {
              const meta = DESK_WIDGET_REGISTRY[id];
              const hidden = workspace.hidden.includes(id);
              return (
                <li key={id} className={hidden ? "is-hidden" : undefined}>
                  <div>
                    <strong>{meta.label}</strong>
                    <span>{meta.description}</span>
                  </div>
                  <div className="deskBuilderControls">
                    <button type="button" aria-label={`Move ${meta.label} up`} disabled={index === 0} onClick={() => moveWidget(id, -1)}>↑</button>
                    <button type="button" aria-label={`Move ${meta.label} down`} disabled={index === workspace.widgets.length - 1} onClick={() => moveWidget(id, 1)}>↓</button>
                    <button type="button" onClick={() => toggleWidget(id)}>{hidden ? "Show" : "Hide"}</button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="deskBuilderSave">
            <label>
              Save named layout
              <input value={layoutName} onChange={(event) => setLayoutName(event.target.value)} placeholder="My open session" maxLength={40} />
            </label>
            <button type="button" onClick={saveNamedLayout}>Save</button>
          </div>
          <div className="deskPlatformPicker">
            <header>
              <span>Preferred platform</span>
              <strong>Deep-link destination for Launch</strong>
            </header>
            <div className="deskPlatformChips" role="radiogroup" aria-label="Preferred trading platform">
              {PREFERRED_PLATFORM_IDS.map((platformId) => {
                const platform = PREFERRED_PLATFORMS[platformId];
                return (
                  <button
                    key={platformId}
                    type="button"
                    role="radio"
                    aria-checked={workspace.preferredPlatformId === platformId}
                    className={workspace.preferredPlatformId === platformId ? "is-selected" : undefined}
                    onClick={() =>
                      setWorkspace((prev) => ({
                        ...prev,
                        preferredPlatformId: platformId,
                        preset: "custom",
                        hidden:
                          platformId === "tradingview"
                            ? prev.hidden
                            : prev.hidden.includes("platform-embed")
                              ? prev.hidden
                              : [...prev.hidden, "platform-embed"],
                      }))
                    }
                    title={platform.description}
                  >
                    {platform.shortLabel}
                  </button>
                );
              })}
            </div>
            {workspace.preferredPlatformId === "external" ? (
              <label className="deskExternalTemplate">
                External URL template (https only · use {"{SYMBOL}"} or {"{NAME}"})
                <input
                  value={workspace.externalUrlTemplate}
                  onChange={(event) =>
                    updateWorkspace({ externalUrlTemplate: event.target.value.slice(0, 500) })
                  }
                  placeholder="https://example.com/quote/{SYMBOL}"
                  maxLength={500}
                />
              </label>
            ) : null}
            <p className="deskPlatformHint">
              {PREFERRED_PLATFORMS[workspace.preferredPlatformId].description} No broker login, credentials, or order routing.
            </p>
          </div>
        </section>
      ) : null}

      <div className="deskShell">
        <aside className={`deskMarkets${marketsOpen ? " is-open" : ""}`} aria-label="Markets browser">
          <div className="deskMarketsInner">
            <header>
              <strong>Markets</strong>
              <button type="button" className="deskMarketsClose" onClick={() => setMarketsOpen(false)}>Close</button>
            </header>
            <ul className="tmMarketsGroups">
              {MARKET_CATALOG.map((group) => {
                const expanded = openGroup === group.id;
                return (
                  <li key={group.id}>
                    <button type="button" className="tmMarketsGroupToggle" aria-expanded={expanded} onClick={() => setOpenGroup(expanded ? null : group.id)}>
                      <span>{group.label}</span>
                      <small>{group.instruments.length}</small>
                      <i aria-hidden="true">{expanded ? "▾" : "▸"}</i>
                    </button>
                    {expanded ? (
                      <ul className="tmMarketsInstruments">
                        {group.instruments.map((instrument) => (
                          <li key={instrument.id}>
                            <button
                              type="button"
                              className={`tmMarketsInstrument${instrument.id === active.id ? " is-selected" : ""}`}
                              onClick={() => selectMarket(instrument)}
                            >
                              <span className="tmMarketsInstrumentName">{instrument.name}</span>
                              <span className="tmMarketsInstrumentMeta">
                                <code>{instrument.symbol}</code>
                                <em className={`tmCoverage is-${instrument.coverage}`}>{coverageLabel(instrument.coverage)}</em>
                              </span>
                            </button>
                            <button
                              type="button"
                              className={`deskStar${workspace.favourites.includes(instrument.id) ? " is-on" : ""}`}
                              aria-label={`${workspace.favourites.includes(instrument.id) ? "Remove" : "Add"} ${instrument.symbol} favourites`}
                              onClick={() => toggleFavourite(instrument.id)}
                            >
                              ★
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <p className="tmMarketsHonesty">Live = verified in-app path. Symbol mapped = reserved provider symbol. Awaiting = taxonomy only. Prices are never invented.</p>
          </div>
        </aside>
        {marketsOpen ? <button type="button" className="deskMarketsBackdrop" aria-label="Close markets" onClick={() => setMarketsOpen(false)} /> : null}

        <div className="deskStage">
          <div className="deskActiveRail" aria-label="Active market">
            <div>
              <span className="ctEyebrow">{active.group.replaceAll("_", " ")}</span>
              <strong>{active.symbol}</strong>
              <span>{active.name}</span>
            </div>
            <div className="deskActiveActions">
              <TerminalBadge label={coverageLabel(active.coverage)} tone={active.coverage === "live" ? "positive" : "warning"} />
              {platformLaunch.status === "ready" ? (
                <a href={platformLaunch.url} target="_blank" rel="noopener noreferrer" className="deskLaunchBtn is-compact">
                  Launch {PREFERRED_PLATFORMS[workspace.preferredPlatformId].shortLabel}
                </a>
              ) : (
                <span className="deskLaunchUnavailable" title={platformLaunch.reason}>
                  No {PREFERRED_PLATFORMS[workspace.preferredPlatformId].shortLabel} link
                </span>
              )}
            </div>
          </div>

          <div className={`deskMainColumn${workspace.focusMode ? " is-focus" : ""}`}>
            <div className="deskStageStack">{stackedWidgets.map(renderWidget)}</div>
            {workspace.focusMode && railWidgets.length ? (
              <aside className="deskFocusRail" aria-label="Focus mode rail">
                {railWidgets.map(renderWidget)}
              </aside>
            ) : null}
          </div>

          {payload.customerWarnings.length ? (
            <details className="ctPanel ctConstraintsPanel ctConstraintsCompact">
              <summary><span>Participation limits</span><strong>Delay and no-trade conditions</strong></summary>
              <div className="ctConstraints"><ul>{payload.customerWarnings.map((item) => <li key={item}>{item}</li>)}</ul></div>
            </details>
          ) : null}

          <footer className="ctFooter">
            <span>Educational market intelligence only. Not personalised financial advice. Futures involve substantial risk.</span>
            <Link href="/risk-disclaimer">Read the risk disclosure</Link>
          </footer>
        </div>
      </div>
    </div>
  );
}

function RiskToolkit() {
  const [equity, setEquity] = useState("10000");
  const [riskPct, setRiskPct] = useState("0.5");
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");

  const riskAmount = Number(equity) * (Number(riskPct) / 100);
  const stopDistance = Math.abs(Number(entry) - Number(stop));
  const targetDistance = Math.abs(Number(target) - Number(entry));
  const size = Number.isFinite(riskAmount) && stopDistance > 0 ? riskAmount / stopDistance : null;
  const rr = stopDistance > 0 && targetDistance > 0 ? targetDistance / stopDistance : null;

  return (
    <section className="deskWidget deskRisk" aria-labelledby="risk-title">
      <header>
        <span>Risk toolkit</span>
        <h2 id="risk-title">Position size &amp; R:R</h2>
      </header>
      <p className="deskRiskNote">Local calculator only — uses your inputs, never fake fills or broker prices.</p>
      <div className="deskRiskGrid">
        <label>Account equity<input inputMode="decimal" value={equity} onChange={(e) => setEquity(e.target.value)} /></label>
        <label>Risk %<input inputMode="decimal" value={riskPct} onChange={(e) => setRiskPct(e.target.value)} /></label>
        <label>Entry<input inputMode="decimal" value={entry} onChange={(e) => setEntry(e.target.value)} placeholder="Your level" /></label>
        <label>Stop<input inputMode="decimal" value={stop} onChange={(e) => setStop(e.target.value)} placeholder="Invalidation" /></label>
        <label>Target<input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Optional" /></label>
      </div>
      <dl className="deskRiskOut">
        <div><dt>Risk amount</dt><dd>{Number.isFinite(riskAmount) ? riskAmount.toLocaleString("en-GB", { maximumFractionDigits: 2 }) : "—"}</dd></div>
        <div><dt>Position size</dt><dd>{size != null && Number.isFinite(size) ? size.toLocaleString("en-GB", { maximumFractionDigits: 4 }) : "—"}</dd></div>
        <div><dt>R:R</dt><dd>{rr != null && Number.isFinite(rr) ? `${rr.toFixed(2)}R` : "—"}</dd></div>
      </dl>
    </section>
  );
}
