"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { MarketSnapshot } from "../../lib/market-data.ts";
import type { CustomerCandleSeries } from "../../lib/providers/financial-modeling-prep-candles.ts";
import type { CandleInstrument } from "../../lib/providers/candle-instruments.ts";
import { DashboardCandlestickChart } from "../../dashboard/components/DashboardCandlestickChart";
import {
  DEFAULT_WIDGET_LAYOUT,
  getWidgetDefinition,
  type WidgetLayoutItem,
  type WorkspacePreferences,
  type WorkspaceInstrumentId,
  type WorkspaceWidgetId,
  WORKSPACE_WIDGETS,
  getWorkspaceInstrument,
  resolveCandleForWorkspace,
  coverageLabel,
  WORKSPACE_PRESETS,
  layoutForPreset,
  type WorkspacePresetId,
} from "../../lib/workspace/index.ts";
import type { MarketReviewResult } from "../../lib/workspace/market-review.ts";
import type { HistoricalContextResult } from "../../lib/workspace/historical-context.ts";

type QuoteView = {
  symbol: string;
  label: string;
  value: string;
  change: string;
  direction: "up" | "down" | "flat";
};

export type PersonalTradingWorkspaceProps = {
  initialPreferences: WorkspacePreferences;
  persisted: boolean;
  greeting: { headline: string; subline: string };
  snapshotStatus: MarketSnapshot["status"];
  snapshotAge: string;
  quotesByBoard: Record<string, QuoteView | undefined>;
  candleSeriesByInstrument: Record<string, CustomerCandleSeries> | null;
  paid: boolean;
  review: MarketReviewResult;
  historical: HistoricalContextResult;
  events: Array<{ time: string; name: string; risk: string }>;
  lockedChart: ReactNode;
  askBullseye: ReactNode;
  deeperEvidence: ReactNode;
};

export function PersonalTradingWorkspace(props: PersonalTradingWorkspaceProps) {
  const [prefs, setPrefs] = useState(props.initialPreferences);
  const [editLayout, setEditLayout] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const activeMeta = getWorkspaceInstrument(prefs.activeInstrument);
  const candleInstrument = resolveCandleForWorkspace(prefs.activeInstrument);
  const activeSeries = candleInstrument && props.candleSeriesByInstrument
    ? props.candleSeriesByInstrument[candleInstrument] ?? null
    : null;

  const enabledLayout = useMemo(
    () => prefs.widgets.filter((item) => item.enabled),
    [prefs.widgets],
  );

  function setActive(id: WorkspaceInstrumentId) {
    setPrefs((current) => ({ ...current, activeInstrument: id }));
  }

  function toggleWidget(id: WorkspaceWidgetId) {
    setPrefs((current) => ({
      ...current,
      preset: "custom",
      widgets: current.widgets.map((item) =>
        item.id === id ? { ...item, enabled: !item.enabled } : item,
      ),
    }));
  }

  function resizeWidget(id: WorkspaceWidgetId, size: WidgetLayoutItem["size"]) {
    setPrefs((current) => ({
      ...current,
      preset: "custom",
      widgets: current.widgets.map((item) => (item.id === id ? { ...item, size } : item)),
    }));
  }

  function moveWidget(id: WorkspaceWidgetId, direction: -1 | 1) {
    setPrefs((current) => {
      const widgets = [...current.widgets];
      const index = widgets.findIndex((item) => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= widgets.length) return current;
      const swap = widgets[index]!;
      widgets[index] = widgets[target]!;
      widgets[target] = swap;
      return { ...current, preset: "custom", widgets };
    });
  }

  function resetLayout() {
    setPrefs((current) => ({
      ...current,
      preset: "custom",
      widgets: DEFAULT_WIDGET_LAYOUT.map((item) => ({ ...item })),
    }));
  }

  function applyPreset(presetId: WorkspacePresetId) {
    setPrefs((current) => ({
      ...current,
      preset: presetId,
      widgets: layoutForPreset(presetId),
    }));
  }

  function saveWorkspace() {
    setSaveMessage(null);
    startTransition(async () => {
      const payload = {
        ...prefs,
        dismissedOnboarding: true,
        lastWorkspaceAt: new Date().toISOString(),
      };
      try {
        window.localStorage.setItem("nam_workspace_prefs_v1", JSON.stringify(payload));
      } catch {
        /* ignore */
      }
      try {
        const response = await fetch("/api/workspace/prefs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => null) as { persisted?: boolean } | null;
        setPrefs(payload);
        setSaveMessage(result?.persisted ? "Workspace saved." : "Saved locally. Cloud sync will retry when available.");
      } catch {
        setSaveMessage("Saved locally. Cloud sync unavailable right now.");
      }
    });
  }

  return (
    <div className="pwWorkspace">
      <header className="pwGreeting">
        <div>
          <p className="pwEyebrow">Your trading desk</p>
          <h1>{props.greeting.headline}</h1>
          <p>{props.greeting.subline}</p>
        </div>
        <div className="pwGreetingMeta">
          <span className={`pwStatusPill is-${props.snapshotStatus.toLowerCase()}`}>{props.snapshotStatus}</span>
          <span>Snapshot age: {props.snapshotAge}</span>
          {!props.persisted ? <span className="pwHint">Using default desk until preferences sync</span> : null}
        </div>
      </header>

      <nav className="pwMarketTabs" aria-label="Favourite markets">
        {prefs.favourites.map((id) => {
          const meta = getWorkspaceInstrument(id);
          const board = meta?.boardSymbol;
          const quote = board ? props.quotesByBoard[board] : undefined;
          return (
            <button
              key={id}
              type="button"
              className={prefs.activeInstrument === id ? "is-active" : undefined}
              onClick={() => setActive(id)}
            >
              <strong>{meta?.ticker ?? id}</strong>
              <span>{quote?.value ?? coverageLabel(meta!)}</span>
            </button>
          );
        })}
        <Link className="pwEditFavourites" href="/markets">Edit favourites</Link>
      </nav>

      <div className="pwToolbar" role="toolbar" aria-label="Workspace controls">
        <button type="button" onClick={() => setEditLayout((value) => !value)}>
          {editLayout ? "Done editing" : "Edit layout"}
        </button>
        <button type="button" onClick={resetLayout}>Reset layout</button>
        <button type="button" className="pwSave" disabled={pending} onClick={saveWorkspace}>
          {pending ? "Saving…" : "Save workspace"}
        </button>
        <details className="pwAddWidget">
          <summary>Add widget</summary>
          <div className="pwAddWidgetPanel">
            {WORKSPACE_WIDGETS.map((widget) => {
              const enabled = prefs.widgets.find((item) => item.id === widget.id)?.enabled;
              return (
                <label key={widget.id}>
                  <input type="checkbox" checked={Boolean(enabled)} onChange={() => toggleWidget(widget.id)} />
                  <span>{widget.title}</span>
                </label>
              );
            })}
          </div>
        </details>
        <details className="pwAddWidget">
          <summary>Presets</summary>
          <div className="pwAddWidgetPanel">
            {WORKSPACE_PRESETS.map((preset) => (
              <button key={preset.id} type="button" onClick={() => applyPreset(preset.id)}>
                {preset.name}
              </button>
            ))}
          </div>
        </details>
        {saveMessage ? <span className="pwSaveMsg" role="status">{saveMessage}</span> : null}
      </div>

      <div className="pwWidgetGrid">
        {enabledLayout.map((item) => (
          <section
            key={item.id}
            className={`pwWidget pwSize-${item.size}`}
            aria-labelledby={`widget-${item.id}-title`}
          >
            <header className="pwWidgetHeader">
              <div>
                <h2 id={`widget-${item.id}-title`}>{getWidgetDefinition(item.id)?.title ?? item.id}</h2>
                <p>{getWidgetDefinition(item.id)?.description}</p>
              </div>
              {editLayout ? (
                <div className="pwWidgetControls">
                  <button type="button" onClick={() => moveWidget(item.id, -1)} aria-label="Move up">↑</button>
                  <button type="button" onClick={() => moveWidget(item.id, 1)} aria-label="Move down">↓</button>
                  <select
                    aria-label="Widget size"
                    value={item.size}
                    onChange={(event) => resizeWidget(item.id, event.target.value as WidgetLayoutItem["size"])}
                  >
                    <option value="sm">S</option>
                    <option value="md">M</option>
                    <option value="lg">L</option>
                    <option value="xl">XL</option>
                  </select>
                  <button type="button" onClick={() => toggleWidget(item.id)}>Remove</button>
                </div>
              ) : null}
            </header>
            <div className="pwWidgetBody">
              <WidgetBody
                id={item.id}
                prefs={prefs}
                setPrefs={setPrefs}
                activeMetaName={activeMeta?.name ?? prefs.activeInstrument}
                coverage={activeMeta?.coverage ?? "awaiting_provider"}
                candleInstrument={candleInstrument}
                activeSeries={activeSeries}
                paid={props.paid}
                lockedChart={props.lockedChart}
                review={props.review}
                historical={props.historical}
                quotesByBoard={props.quotesByBoard}
                favourites={prefs.favourites}
                events={props.events}
                askBullseye={props.askBullseye}
                deeperEvidence={props.deeperEvidence}
                snapshotAge={props.snapshotAge}
              />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function WidgetBody(props: {
  id: WorkspaceWidgetId;
  prefs: WorkspacePreferences;
  setPrefs: Dispatch<SetStateAction<WorkspacePreferences>>;
  activeMetaName: string;
  coverage: "quotes_and_candles" | "quotes_only" | "awaiting_provider";
  candleInstrument: CandleInstrument | null;
  activeSeries: CustomerCandleSeries | null;
  paid: boolean;
  lockedChart: ReactNode;
  review: MarketReviewResult;
  historical: HistoricalContextResult;
  quotesByBoard: Record<string, QuoteView | undefined>;
  favourites: WorkspaceInstrumentId[];
  events: Array<{ time: string; name: string; risk: string }>;
  askBullseye: ReactNode;
  deeperEvidence: ReactNode;
  snapshotAge: string;
}) {
  const definition = getWidgetDefinition(props.id);

  if (props.id === "primary_chart") {
    if (props.coverage === "awaiting_provider") {
      return <UnavailableState title="Awaiting verified provider coverage" detail="No chart is shown for this market until a verified candle feed is connected." />;
    }
    if (props.coverage === "quotes_only") {
      return <UnavailableState title="Historical chart not yet supported" detail="This feed arrives as verified scalars only." />;
    }
    if (!props.paid) return <>{props.lockedChart}</>;
    if (!props.activeSeries || !props.candleInstrument) {
      return <UnavailableState title="Delayed data unavailable" detail="Verified candlesticks could not be loaded for the active market." />;
    }
    return <DashboardCandlestickChart series={props.activeSeries} instrument={props.candleInstrument} />;
  }

  if (props.id === "market_review") {
    if (!props.review.available) {
      return <UnavailableState title={props.review.unavailableReason ?? "Review unavailable"} detail={props.review.uncertainty} />;
    }
    return (
      <div className="pwReview">
        <p className="pwReviewLead">Review for {props.review.instrumentName}</p>
        <ul>
          {props.review.blocks.map((block) => (
            <li key={block.title} className={`tone-${block.tone}`}>
              <strong>{block.title}</strong>
              <span>{block.body}</span>
            </li>
          ))}
        </ul>
        <p className="pwUncertainty">{props.review.uncertainty}</p>
      </div>
    );
  }

  if (props.id === "watchlist" || props.id === "instrument_cards") {
    return (
      <div className="pwWatchlist">
        {props.favourites.map((id) => {
          const meta = getWorkspaceInstrument(id);
          const quote = meta?.boardSymbol ? props.quotesByBoard[meta.boardSymbol] : undefined;
          return (
            <article key={id}>
              <strong>{meta?.ticker ?? id}</strong>
              <span>{meta?.name}</span>
              <b>{quote?.value ?? coverageLabel(meta!)}</b>
              <em className={quote ? `is-${quote.direction}` : undefined}>{quote?.change ?? "—"}</em>
            </article>
          );
        })}
      </div>
    );
  }

  if (props.id === "economic_calendar") {
    if (!props.events.length) {
      return <UnavailableState title="No verified economic events in window" detail="The calendar stays empty until the provider returns verified rows." />;
    }
    return (
      <div className="pwCalendar">
        {props.events.map((event) => (
          <article key={`${event.time}-${event.name}`}>
            <time>{event.time}</time>
            <strong>{event.name}</strong>
            <span>{event.risk}</span>
          </article>
        ))}
        <p className="pwFreshness">Freshness tied to snapshot age: {props.snapshotAge}</p>
      </div>
    );
  }

  if (props.id === "historical_context") {
    if (!props.historical.available) {
      return <UnavailableState title={props.historical.unavailableReason ?? "Context unavailable"} detail={props.historical.disclaimer} />;
    }
    return (
      <div className="pwHistory">
        <ul>
          {props.historical.items.map((item) => (
            <li key={item.title}>
              <strong>{item.title}</strong>
              <span>{item.body}</span>
            </li>
          ))}
        </ul>
        <p className="pwUncertainty">{props.historical.disclaimer}</p>
      </div>
    );
  }

  if (props.id === "volatility_monitor" || props.id === "vix_gauge") {
    const vix = props.quotesByBoard.VIX;
    if (!vix) return <UnavailableState title="VIX unavailable" detail="Verified VIX quote is missing from the current snapshot." />;
    return (
      <div className="pwGauge">
        <strong>{vix.value}</strong>
        <span className={`is-${vix.direction}`}>{vix.change}</span>
        <p>Verified delayed VIX · {props.snapshotAge}</p>
      </div>
    );
  }

  if (props.id === "treasury_monitor") {
    const two = props.quotesByBoard.US2Y;
    const ten = props.quotesByBoard.US10Y;
    if (!two && !ten) return <UnavailableState title="Treasury yields unavailable" detail="Verified Treasury scalars are missing." />;
    return (
      <div className="pwMonitorPair">
        <article><span>US2Y</span><strong>{two?.value ?? "—"}</strong><em>{two?.change ?? ""}</em></article>
        <article><span>US10Y</span><strong>{ten?.value ?? "—"}</strong><em>{ten?.change ?? ""}</em></article>
      </div>
    );
  }

  if (props.id === "usd_monitor") {
    const dxy = props.quotesByBoard.DXY;
    if (!dxy) return <UnavailableState title="USD monitor unavailable" detail="Verified DXY quote is missing." />;
    return (
      <div className="pwGauge">
        <strong>{dxy.value}</strong>
        <span className={`is-${dxy.direction}`}>{dxy.change}</span>
        <p>US Dollar Index · {props.snapshotAge}</p>
      </div>
    );
  }

  if (props.id === "support_resistance") {
    return <>{props.deeperEvidence}</>;
  }

  if (props.id === "session_clock") {
    const nowLabel = new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/London",
    }).format(new Date());
    return (
      <div className="pwGauge">
        <strong>{nowLabel}</strong>
        <p>Europe/London session clock for planning. Not an exchange clock feed.</p>
      </div>
    );
  }

  if (props.id === "notes") {
    return (
      <textarea
        className="pwNotes"
        value={props.prefs.notes}
        maxLength={4000}
        aria-label="Desk notes"
        placeholder="Personal notes for this desk…"
        onChange={(event) => props.setPrefs((current) => ({ ...current, notes: event.target.value }))}
      />
    );
  }

  if (props.id === "checklist") {
    const items = [
      "Data decision-ready?",
      "Levels marked from verified structure?",
      "Catalyst window checked?",
      "Invalidation defined?",
      "Position size within your plan?",
    ];
    return (
      <ul className="pwChecklist">
        {items.map((item) => (
          <li key={item}>
            <label>
              <input
                type="checkbox"
                checked={props.prefs.checklist.includes(item)}
                onChange={(event) => {
                  props.setPrefs((current) => {
                    const checklist = event.target.checked
                      ? [...current.checklist, item]
                      : current.checklist.filter((entry) => entry !== item);
                    return { ...current, checklist };
                  });
                }}
              />
              <span>{item}</span>
            </label>
          </li>
        ))}
      </ul>
    );
  }

  if (props.id === "position_size" || props.id === "risk_reward") {
    return <DeskCalculator mode={props.id} />;
  }

  if (props.id === "journal") {
    return (
      <div className="pwLinkCard">
        <p>Open your trade journal to record setups after the session.</p>
        <Link href="/journal">Go to journal</Link>
      </div>
    );
  }

  if (props.id === "ai_assistant") {
    return <>{props.askBullseye}</>;
  }

  if (props.id === "heatmap") {
    return <>{props.deeperEvidence}</>;
  }

  if (props.id === "opening_range") {
    if (!props.activeSeries?.candles.length) {
      return <UnavailableState title="Opening range unavailable" detail="Needs verified session candles for the active market." />;
    }
    const window = props.activeSeries.candles.slice(0, 6);
    const high = Math.max(...window.map((candle) => candle.high));
    const low = Math.min(...window.map((candle) => candle.low));
    return (
      <div className="pwGauge">
        <strong>{low.toLocaleString("en-GB", { maximumFractionDigits: 2 })} – {high.toLocaleString("en-GB", { maximumFractionDigits: 2 })}</strong>
        <p>Early-window high/low from the first verified bars in the loaded series. Context only.</p>
      </div>
    );
  }

  if (definition && !definition.dataReady) {
    return <UnavailableState title={definition.title} detail={definition.unavailableCopy ?? "Unavailable"} />;
  }

  return <UnavailableState title="Widget unavailable" detail="This widget has no verified data path yet." />;
}

function UnavailableState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="pwUnavailable" role="status">
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

function DeskCalculator({ mode }: { mode: "position_size" | "risk_reward" }) {
  const [entry, setEntry] = useState("5000");
  const [stop, setStop] = useState("4980");
  const [target, setTarget] = useState("5040");
  const [risk, setRisk] = useState("100");

  const entryN = Number(entry);
  const stopN = Number(stop);
  const targetN = Number(target);
  const riskN = Number(risk);
  const stopDistance = Math.abs(entryN - stopN);
  const rewardDistance = Math.abs(targetN - entryN);
  const rr = stopDistance > 0 ? rewardDistance / stopDistance : null;
  const size = stopDistance > 0 && riskN > 0 ? riskN / stopDistance : null;

  return (
    <div className="pwCalc">
      <label>Entry<input value={entry} onChange={(event) => setEntry(event.target.value)} inputMode="decimal" /></label>
      <label>Stop<input value={stop} onChange={(event) => setStop(event.target.value)} inputMode="decimal" /></label>
      <label>Target<input value={target} onChange={(event) => setTarget(event.target.value)} inputMode="decimal" /></label>
      {mode === "position_size" ? (
        <label>Risk £<input value={risk} onChange={(event) => setRisk(event.target.value)} inputMode="decimal" /></label>
      ) : null}
      <p>
        {mode === "risk_reward"
          ? `R:R ${rr === null || !Number.isFinite(rr) ? "—" : rr.toFixed(2)}`
          : `Approx size ${size === null || !Number.isFinite(size) ? "—" : size.toFixed(2)} units`}
      </p>
      <small>Calculator uses your inputs only. Not brokerage sizing advice.</small>
    </div>
  );
}
