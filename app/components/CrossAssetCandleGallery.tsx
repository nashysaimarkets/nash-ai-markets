"use client";

import { useState } from "react";
import {
  candleInstrumentLabel,
  type CandleInstrument,
} from "../lib/providers/candle-instruments.ts";
import type { CustomerCandleSeries } from "../lib/providers/financial-modeling-prep-candles.ts";
import { DashboardCandlestickChart } from "../dashboard/components/DashboardCandlestickChart.tsx";

type Props = {
  seriesByInstrument: Partial<Record<CandleInstrument, CustomerCandleSeries>>;
  title?: string;
  eyebrow?: string;
};

const ORDER: CandleInstrument[] = ["ES", "VIX", "DXY", "OIL", "QQQ", "NQ"];

/**
 * Tabbed verified candlestick gallery for every instrument that can supply OHLCV.
 * Instruments without candles show an honest empty panel — never invented bars.
 */
export function CrossAssetCandleGallery({
  seriesByInstrument,
  title = "Cross-asset candlesticks",
  eyebrow = "VERIFIED OHLCV FEEDS",
}: Props) {
  const available = ORDER.filter((instrument) => seriesByInstrument[instrument]);
  const [active, setActive] = useState<CandleInstrument>(available[0] ?? "ES");
  const series = seriesByInstrument[active];

  if (!available.length) return null;

  return (
    <section className="crossAssetCandleGallery" aria-labelledby="cross-asset-candle-title">
      <header className="crossAssetCandleGalleryHeader">
        <div>
          <span>{eyebrow}</span>
          <h2 id="cross-asset-candle-title">{title}</h2>
          <p>Candlesticks appear only where the provider returns structurally valid OHLCV. Treasury yields remain scalar-only.</p>
        </div>
        <div className="crossAssetCandleTabs" role="tablist" aria-label="Candle instrument">
          {ORDER.map((instrument) => {
            const ready = Boolean(seriesByInstrument[instrument]?.candles.length);
            const hasSeries = Boolean(seriesByInstrument[instrument]);
            if (!hasSeries) return null;
            return (
              <button
                key={instrument}
                type="button"
                role="tab"
                aria-selected={active === instrument}
                data-ready={ready ? "true" : "false"}
                onClick={() => setActive(instrument)}
              >
                {candleInstrumentLabel(instrument)}
              </button>
            );
          })}
        </div>
      </header>
      {series ? (
        <DashboardCandlestickChart series={series} instrument={active} compact />
      ) : (
        <div className="crossAssetCandleEmpty" role="status">
          <strong>Verified candles unavailable for this feed</strong>
          <p>No structurally valid OHLCV series was returned. Bullseye will not invent candles from quote scalars.</p>
        </div>
      )}
    </section>
  );
}
