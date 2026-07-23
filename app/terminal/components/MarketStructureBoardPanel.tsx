"use client";

import { useMemo, useState } from "react";
import type { MarketStructureLevels, InstrumentStructureLevels } from "../../lib/market-structure-levels.ts";
import type { MarketBoardSymbol } from "../../lib/market-board-instruments.ts";
import {
  candleSupportNote,
  isCandleInstrument,
  type CandleInstrument,
} from "../../lib/providers/candle-instruments.ts";
import type { CustomerCandleSeries } from "../../lib/providers/financial-modeling-prep-candles.ts";
import { DashboardCandlestickChart } from "../../dashboard/components/DashboardCandlestickChart.tsx";

type Props = {
  structure: MarketStructureLevels;
  snapshotAge: string;
  seriesByInstrument?: Partial<Record<CandleInstrument, CustomerCandleSeries>> | null;
};

function defaultSelection(
  instruments: InstrumentStructureLevels[],
  seriesByInstrument: Partial<Record<CandleInstrument, CustomerCandleSeries>> | null | undefined,
): MarketBoardSymbol {
  const withCandles = instruments.find(
    (item) => isCandleInstrument(item.symbol) && (seriesByInstrument?.[item.symbol]?.candles.length ?? 0) > 0,
  );
  if (withCandles) return withCandles.symbol;
  const es = instruments.find((item) => item.symbol === "ES");
  return es?.symbol ?? instruments[0]?.symbol ?? "ES";
}

function StructureCardBody({ levels }: { levels: InstrumentStructureLevels }) {
  if (levels.status !== "ready" || !levels.support || !levels.resistance) {
    return (
      <div className={`ctSrBox is-insufficient${levels.scalarOnly ? " is-scalar" : ""}`} role="status">
        <span>Support / Resistance</span>
        <strong>Insufficient data</strong>
        <p>{levels.summary}</p>
      </div>
    );
  }
  return (
    <div className="ctSrBox is-ready" aria-label={`${levels.label} support and resistance`}>
      <span>Support / Resistance</span>
      <dl>
        <div>
          <dt>Support</dt>
          <dd>{levels.support.display}</dd>
        </div>
        <div>
          <dt>Resistance</dt>
          <dd>{levels.resistance.display}</dd>
        </div>
      </dl>
      <p>{levels.summary}</p>
      <ul>
        {levels.references.slice(0, 3).map((ref) => (
          <li key={ref.kind}><b>{ref.label}</b> {ref.display}</li>
        ))}
      </ul>
    </div>
  );
}

function StructureChartPanel({
  selected,
  levels,
  series,
}: {
  selected: MarketBoardSymbol;
  levels: InstrumentStructureLevels | undefined;
  series: CustomerCandleSeries | null | undefined;
}) {
  const candleNote = candleSupportNote(selected);
  const hasCandles = Boolean(series && series.candles.length > 0 && isCandleInstrument(selected));

  if (candleNote || levels?.scalarOnly) {
    return (
      <div className="ctStructureBoardEmpty" role="status">
        <strong>No OHLC / candles unavailable</strong>
        <p>
          {candleNote
            ?? `${levels?.label ?? selected} is a verified scalar feed. OHLC candlesticks are not available for this instrument.`}
        </p>
        <small>Bullseye will not invent candles from quote scalars.</small>
      </div>
    );
  }

  if (!hasCandles || !series || !isCandleInstrument(selected)) {
    return (
      <div className="ctStructureBoardEmpty" role="status">
        <strong>Verified candles unavailable</strong>
        <p>
          {levels?.summary
            ?? `No structurally valid OHLCV series is available for ${levels?.label ?? selected} in this update.`}
        </p>
        <small>Desk levels and charts stay fail-closed when verified candles are missing.</small>
      </div>
    );
  }

  return (
    <DashboardCandlestickChart
      key={selected}
      series={series}
      instrument={selected}
      compact
    />
  );
}

/**
 * Desk support & resistance cards with a dedicated click-to-chart panel.
 * Chart uses verified OHLCV only — treasuries and missing feeds show honest empty states.
 */
export function MarketStructureBoardPanel({
  structure,
  snapshotAge,
  seriesByInstrument = null,
}: Props) {
  const initial = useMemo(
    () => defaultSelection(structure.instruments, seriesByInstrument),
    [structure.instruments, seriesByInstrument],
  );
  const [selected, setSelected] = useState<MarketBoardSymbol>(initial);
  const selectedLevels = structure.instruments.find((item) => item.symbol === selected);
  const series = isCandleInstrument(selected) ? seriesByInstrument?.[selected] : null;

  return (
    <section className="ctPanel ctStructureBoard" aria-labelledby="structure-board-title">
      <header>
        <div>
          <span>Desk support &amp; resistance</span>
          <h2 id="structure-board-title">Verified candle range levels by instrument</h2>
        </div>
        <small>Educational · {snapshotAge}</small>
      </header>
      <div className="ctStructureBoardGrid">
        <div className="ctStructureBoardChart" aria-label={`${selectedLevels?.label ?? selected} verified candlestick chart`}>
          <div className="ctStructureBoardChartHead">
            <span>Selected market</span>
            <strong>{selectedLevels?.label ?? selected}</strong>
            <small>{selected}</small>
          </div>
          <StructureChartPanel selected={selected} levels={selectedLevels} series={series} />
        </div>
        {structure.instruments.map((levels) => {
          const isSelected = levels.symbol === selected;
          const candleReady = isCandleInstrument(levels.symbol)
            && (seriesByInstrument?.[levels.symbol]?.candles.length ?? 0) > 0;
          return (
            <button
              key={levels.symbol}
              type="button"
              className={`ctStructureBoardCard${isSelected ? " is-selected" : ""}${levels.scalarOnly ? " is-scalar" : ""}`}
              aria-pressed={isSelected}
              aria-label={`${levels.label} desk levels${candleReady ? ", show candlestick chart" : levels.scalarOnly ? ", candles unavailable" : ""}`}
              onClick={() => setSelected(levels.symbol)}
            >
              <div className="ctStructureBoardHead">
                <span>{levels.label}</span>
                <small>{levels.symbol}</small>
              </div>
              <StructureCardBody levels={levels} />
            </button>
          );
        })}
      </div>
      <p className="ctCaution">{structure.disclosure}</p>
    </section>
  );
}
