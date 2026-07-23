"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MarketQuote } from "../lib/market-data.ts";
import {
  coverageLabel,
  galleryInstruments,
  type WorkspaceInstrument,
  type WorkspaceInstrumentId,
} from "../lib/workspace/instruments.ts";
import { defaultWorkspacePreferences } from "../lib/workspace/prefs.ts";
import { layoutForPreset, type WorkspacePresetId, WORKSPACE_PRESETS } from "../lib/workspace/presets.ts";

type Spark = number[] | null;

type GalleryProps = {
  quotesByBoard: Record<string, MarketQuote | undefined>;
  sparklinesByBoard: Record<string, Spark>;
  initialFavourites?: WorkspaceInstrumentId[];
  memberName?: string | null;
};

function leanFromQuote(quote: MarketQuote | undefined): "bullish" | "bearish" | "neutral" | null {
  if (!quote) return null;
  if (quote.direction === "up") return "bullish";
  if (quote.direction === "down") return "bearish";
  if (quote.direction === "flat") return "neutral";
  return null;
}

function MiniSpark({ values }: { values: number[] | null }) {
  if (!values || values.length < 2) {
    return <span className="pwSparkEmpty">Historical chart not yet supported</span>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100;
    const y = 28 - ((value - min) / span) * 24;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg className="pwSpark" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={points} />
    </svg>
  );
}

export function MarketSelectionGallery({
  quotesByBoard,
  sparklinesByBoard,
  initialFavourites = [],
  memberName,
}: GalleryProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<WorkspaceInstrumentId[]>(
    initialFavourites.length ? initialFavourites : ["ES", "NQ"],
  );
  const [primary, setPrimary] = useState<WorkspaceInstrumentId>(
    (initialFavourites[0] ?? "ES") as WorkspaceInstrumentId,
  );
  const [preset, setPreset] = useState<WorkspacePresetId | "custom">("index_day_trader");
  const [error, setError] = useState<string | null>(null);
  const instruments = useMemo(() => galleryInstruments(), []);

  function toggle(id: WorkspaceInstrumentId) {
    setSelected((current) => {
      if (current.includes(id)) {
        const next = current.filter((item) => item !== id);
        if (!next.length) return current;
        if (primary === id) setPrimary(next[0]!);
        return next;
      }
      if (current.length >= 8) return current;
      return [...current, id];
    });
  }

  async function buildDesk() {
    setError(null);
    const widgets = preset === "custom" ? undefined : layoutForPreset(preset);
    const preferences = defaultWorkspacePreferences({
      favourites: selected,
      primaryInstrument: selected.includes(primary) ? primary : selected[0],
      activeInstrument: selected.includes(primary) ? primary : selected[0],
      widgets,
      preset,
      dismissedOnboarding: true,
      lastWorkspaceAt: new Date().toISOString(),
    });

    startTransition(async () => {
      try {
        const response = await fetch("/api/workspace/prefs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(preferences),
        });
        const payload = await response.json().catch(() => null) as { ok?: boolean; code?: string } | null;
        if (!response.ok && payload?.code === "AUTH_REQUIRED") {
          setError("Please sign in again to save your desk.");
          return;
        }
        // Persist failure still continues — defaults remain usable on terminal.
        try {
          window.localStorage.setItem("nam_workspace_prefs_v1", JSON.stringify(preferences));
        } catch {
          /* ignore quota */
        }
        router.push("/terminal");
        router.refresh();
      } catch {
        setError("Could not reach the workspace service. Your selection is kept locally where possible.");
        try {
          window.localStorage.setItem("nam_workspace_prefs_v1", JSON.stringify(preferences));
        } catch {
          /* ignore */
        }
        router.push("/terminal");
      }
    });
  }

  return (
    <div className="pwGallery">
      <header className="pwGalleryHero">
        <p className="pwEyebrow">Personal trading workspace</p>
        <h1>{memberName ? `${memberName}, choose your markets` : "Choose your favourite markets"}</h1>
        <p>
          Select the instruments you want on your desk. Verified delayed values appear when provider coverage exists.
          Unsupported markets stay selectable with an honest unavailable state — nothing is fabricated.
        </p>
      </header>

      <section className="pwPresetRow" aria-label="Desk presets">
        <span className="pwEyebrow">Optional preset</span>
        <div className="pwPresetChips">
          {WORKSPACE_PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={preset === item.id ? "is-active" : undefined}
              onClick={() => setPreset(item.id)}
            >
              {item.name}
            </button>
          ))}
          <button
            type="button"
            className={preset === "custom" ? "is-active" : undefined}
            onClick={() => setPreset("custom")}
          >
            Custom
          </button>
        </div>
      </section>

      <section className="pwGalleryGrid" aria-label="Market gallery">
        {instruments.map((instrument) => (
          <InstrumentCard
            key={instrument.id}
            instrument={instrument}
            selected={selected.includes(instrument.id)}
            isPrimary={primary === instrument.id}
            quote={instrument.boardSymbol ? quotesByBoard[instrument.boardSymbol] : undefined}
            spark={instrument.boardSymbol ? sparklinesByBoard[instrument.boardSymbol] ?? null : null}
            onToggle={() => toggle(instrument.id)}
            onPrimary={() => {
              if (!selected.includes(instrument.id)) toggle(instrument.id);
              setPrimary(instrument.id);
            }}
          />
        ))}
      </section>

      <footer className="pwGalleryFooter">
        <div>
          <strong>{selected.length} selected</strong>
          <span>Primary: {primary}</span>
        </div>
        {error ? <p className="pwError" role="alert">{error}</p> : null}
        <button type="button" className="pwPrimaryCta" disabled={pending || selected.length < 1} onClick={() => void buildDesk()}>
          {pending ? "Building your desk…" : "Build My Trading Desk"}
        </button>
      </footer>
    </div>
  );
}

function InstrumentCard({
  instrument,
  selected,
  isPrimary,
  quote,
  spark,
  onToggle,
  onPrimary,
}: {
  instrument: WorkspaceInstrument;
  selected: boolean;
  isPrimary: boolean;
  quote: MarketQuote | undefined;
  spark: Spark;
  onToggle: () => void;
  onPrimary: () => void;
}) {
  const lean = leanFromQuote(quote);
  const covered = instrument.coverage !== "awaiting_provider";

  return (
    <article
      className={`pwInstrumentCard ${selected ? "is-selected" : ""} ${isPrimary ? "is-primary" : ""} coverage-${instrument.coverage}`}
    >
      <header>
        <div>
          <span className="pwTicker">{instrument.ticker}</span>
          <h2>{instrument.name}</h2>
        </div>
        <label className="pwFavToggle">
          <input type="checkbox" checked={selected} onChange={onToggle} />
          <span>Favourite</span>
        </label>
      </header>

      <div className="pwInstrumentMetrics">
        {covered && quote ? (
          <>
            <strong>{quote.value}</strong>
            <span className={`pwChange is-${quote.direction}`}>{quote.change}</span>
          </>
        ) : (
          <strong className="pwUnavailableValue">{coverageLabel(instrument)}</strong>
        )}
      </div>

      <MiniSpark values={covered ? spark : null} />

      <dl className="pwInstrumentMeta">
        <div>
          <dt>Session</dt>
          <dd>{covered && quote ? "Delayed session print" : "Data connection required"}</dd>
        </div>
        <div>
          <dt>Lean</dt>
          <dd>{lean ?? "—"}</dd>
        </div>
        <div>
          <dt>Coverage</dt>
          <dd>{coverageLabel(instrument)}</dd>
        </div>
      </dl>

      <button type="button" className="pwPrimaryPick" disabled={!selected} onClick={onPrimary}>
        {isPrimary ? "Primary market" : "Make primary"}
      </button>
    </article>
  );
}
