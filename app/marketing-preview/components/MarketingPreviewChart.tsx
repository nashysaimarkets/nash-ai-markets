"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { IChartApi, UTCTimestamp } from "lightweight-charts";
import {
  exponentialMovingAverage,
  volumeWeightedAveragePrice,
} from "../../dashboard/lib/candle-analysis.ts";
import {
  aggregateIllustrativeCandles,
  type IllustrativeCandle,
  type IllustrativeLevels,
  type MarketingPreviewTimeframe,
} from "../lib/illustrative-fixtures.ts";

type MarketingPreviewChartProps = {
  candles: IllustrativeCandle[];
  levels: IllustrativeLevels;
  stateLabel: string;
};

const TIMEFRAMES = ["1m", "5m", "15m", "1H", "4H"] as const satisfies readonly MarketingPreviewTimeframe[];
const OVERLAYS = [
  { id: "ema9", label: "EMA 9" },
  { id: "ema21", label: "EMA 21" },
  { id: "ema50", label: "EMA 50" },
  { id: "vwap", label: "VWAP" },
  { id: "volume", label: "Volume" },
] as const;

export function MarketingPreviewChart({ candles, levels, stateLabel }: MarketingPreviewChartProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [timeframe, setTimeframe] = useState<(typeof TIMEFRAMES)[number]>("5m");
  const [overlays, setOverlays] = useState({
    ema9: true,
    ema21: true,
    ema50: true,
    vwap: true,
    volume: true,
  });
  const displayCandles = useMemo(() => aggregateIllustrativeCandles(candles, timeframe), [candles, timeframe]);
  const ema9 = useMemo(() => exponentialMovingAverage(displayCandles, 9), [displayCandles]);
  const ema21 = useMemo(() => exponentialMovingAverage(displayCandles, 21), [displayCandles]);
  const ema50 = useMemo(() => exponentialMovingAverage(displayCandles, 50), [displayCandles]);
  const ema200 = useMemo(() => exponentialMovingAverage(displayCandles, 200), [displayCandles]);
  const vwap = useMemo(() => volumeWeightedAveragePrice(displayCandles), [displayCandles]);
  const latest = displayCandles.at(-1);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || displayCandles.length === 0) return;
    let disposed = false;
    let painted = false;
    let resizeObserver: ResizeObserver | null = null;

    const paint = () => {
      if (disposed || painted || !hostRef.current || hostRef.current.clientWidth < 40) return;
      painted = true;
      void import("lightweight-charts").then(({ CandlestickSeries, ColorType, HistogramSeries, LineSeries, createChart }) => {
        if (disposed || !hostRef.current) return;
        chartRef.current?.remove();
        chartRef.current = null;
        hostRef.current.replaceChildren();
        const chart = createChart(hostRef.current, {
          autoSize: true,
          height: Math.max(hostRef.current.clientHeight, 520),
          layout: { background: { type: ColorType.Solid, color: "#071015" }, textColor: "#9aa7ad", attributionLogo: false },
          grid: { vertLines: { color: "#152229" }, horzLines: { color: "#152229" } },
          rightPriceScale: { borderColor: "#2a3940", autoScale: true },
          timeScale: { borderColor: "#2a3940", timeVisible: true, secondsVisible: false, rightOffset: 8, barSpacing: 7 },
          handleScale: false,
          handleScroll: false,
          crosshair: {
            vertLine: { color: "#62e6b144", labelBackgroundColor: "#163028" },
            horzLine: { color: "#62e6b144", labelBackgroundColor: "#163028" },
          },
        });
        chartRef.current = chart;
        const candleSeries = chart.addSeries(CandlestickSeries, {
          upColor: "#68d7b4",
          downColor: "#e77f86",
          borderVisible: false,
          wickUpColor: "#68d7b4",
          wickDownColor: "#e77f86",
          priceLineVisible: true,
          lastValueVisible: true,
        });
        candleSeries.setData(
          displayCandles.map(({ time, open, high, low, close }) => ({
            time: time as UTCTimestamp,
            open,
            high,
            low,
            close,
          })),
        );
        if (overlays.volume) {
          const volume = chart.addSeries(HistogramSeries, {
            priceFormat: { type: "volume" },
            priceScaleId: "volume",
            lastValueVisible: false,
            priceLineVisible: false,
          });
          volume.priceScale().applyOptions({ scaleMargins: { top: 0.76, bottom: 0 } });
          volume.setData(
            displayCandles.map((point) => ({
              time: point.time as UTCTimestamp,
              value: point.volume,
              color: point.close >= point.open ? "#68d7b455" : "#e77f8655",
            })),
          );
        }
        const addLine = (data: Array<{ time: number; value: number }>, color: string, title: string) => {
          if (!data.length) return;
          const line = chart.addSeries(LineSeries, {
            color,
            lineWidth: 2,
            title,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          line.setData(data.map((point) => ({ time: point.time as UTCTimestamp, value: point.value })));
        };
        if (overlays.ema9) addLine(ema9, "#f0c674", "EMA 9");
        if (overlays.ema21) addLine(ema21, "#71b7e6", "EMA 21");
        if (overlays.ema50) addLine(ema50, "#bb91e8", "EMA 50");
        addLine(ema200, "#7f8d94", "EMA 200");
        if (overlays.vwap) addLine(vwap, "#d8b36a", "VWAP");
        for (const level of [
          { label: "Prior close", value: levels.priorClose },
          { label: "Session high", value: levels.sessionHigh },
          { label: "Session low", value: levels.sessionLow },
        ]) {
          candleSeries.createPriceLine({
            price: level.value,
            color: "#8fa2a866",
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: level.label,
          });
        }
        requestAnimationFrame(() => {
          if (!disposed) chart.timeScale().fitContent();
        });
      }).catch(() => {
        painted = false;
      });
    };

    paint();
    resizeObserver = new ResizeObserver(() => {
      if (!painted) paint();
    });
    resizeObserver.observe(host);
    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, [displayCandles, ema9, ema21, ema50, ema200, levels.priorClose, levels.sessionHigh, levels.sessionLow, overlays, vwap]);

  return (
    <section className="mpChart" aria-label={`Illustrative ${stateLabel} candlestick chart`}>
      <header>
        <div>
          <span>PRIMARY MARKET WORKSPACE · ILLUSTRATIVE</span>
          <h2>S&P 500 futures · ES</h2>
          <p>Deterministic full-session presentation tape · {timeframe} view · not live market data</p>
        </div>
        <div className="mpChartMeta">
          <strong>ILLUSTRATIVE · NOT LIVE</strong>
          {latest ? (
            <small>
              O {latest.open.toFixed(2)} · H {latest.high.toFixed(2)} · L {latest.low.toFixed(2)} · C {latest.close.toFixed(2)}
            </small>
          ) : null}
        </div>
      </header>

      <div className="mpChartControls">
        <div className="mpTimeframes" role="group" aria-label="Illustrative timeframe selectors">
          {TIMEFRAMES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={timeframe === value}
              className={timeframe === value ? "is-active" : undefined}
              onClick={() => setTimeframe(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="mpOverlays" role="group" aria-label="Illustrative chart overlays">
          {OVERLAYS.map((overlay) => (
            <button
              key={overlay.id}
              type="button"
              aria-pressed={overlays[overlay.id]}
              className={overlays[overlay.id] ? "is-active" : undefined}
              onClick={() => setOverlays((current) => ({ ...current, [overlay.id]: !current[overlay.id] }))}
            >
              {overlay.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mpChartCanvas" ref={hostRef} role="img" aria-label="Illustrative candlestick chart with EMA and VWAP overlays" />
      <footer>
        <span>EMA 9 / 21 / 50 / 200 · VWAP · volume · prior close · session high/low</span>
        <span>Deterministic fixture · no provider fetch</span>
      </footer>
    </section>
  );
}
