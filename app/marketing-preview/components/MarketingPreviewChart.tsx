"use client";

import { useEffect, useMemo, useRef } from "react";
import type { IChartApi, UTCTimestamp } from "lightweight-charts";
import {
  exponentialMovingAverage,
  volumeWeightedAveragePrice,
} from "../../dashboard/lib/candle-analysis.ts";
import type { IllustrativeCandle, IllustrativeLevels } from "../lib/illustrative-fixtures.ts";

type MarketingPreviewChartProps = {
  candles: IllustrativeCandle[];
  levels: IllustrativeLevels;
  stateLabel: string;
};

export function MarketingPreviewChart({ candles, levels, stateLabel }: MarketingPreviewChartProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const ema9 = useMemo(() => exponentialMovingAverage(candles, 9), [candles]);
  const ema21 = useMemo(() => exponentialMovingAverage(candles, 21), [candles]);
  const ema50 = useMemo(() => exponentialMovingAverage(candles, 50), [candles]);
  const ema200 = useMemo(() => exponentialMovingAverage(candles, 200), [candles]);
  const vwap = useMemo(() => volumeWeightedAveragePrice(candles), [candles]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || candles.length === 0) return;
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
          height: Math.max(hostRef.current.clientHeight, 420),
          layout: { background: { type: ColorType.Solid, color: "#091014" }, textColor: "#9aa7ad", attributionLogo: false },
          grid: { vertLines: { color: "#19252b" }, horzLines: { color: "#19252b" } },
          rightPriceScale: { borderColor: "#2a3940", autoScale: true },
          timeScale: { borderColor: "#2a3940", timeVisible: true, secondsVisible: false, rightOffset: 4, barSpacing: 6 },
          handleScale: false,
          handleScroll: false,
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
          candles.map(({ time, open, high, low, close }) => ({
            time: time as UTCTimestamp,
            open,
            high,
            low,
            close,
          })),
        );
        const volume = chart.addSeries(HistogramSeries, {
          priceFormat: { type: "volume" },
          priceScaleId: "volume",
          lastValueVisible: false,
          priceLineVisible: false,
        });
        volume.priceScale().applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
        volume.setData(
          candles.map((point) => ({
            time: point.time as UTCTimestamp,
            value: point.volume,
            color: point.close >= point.open ? "#68d7b455" : "#e77f8655",
          })),
        );
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
        addLine(ema9, "#f0c674", "EMA 9");
        addLine(ema21, "#71b7e6", "EMA 21");
        addLine(ema50, "#bb91e8", "EMA 50");
        addLine(ema200, "#9aa7ad", "EMA 200");
        addLine(vwap, "#d8b36a", "VWAP");
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
  }, [candles, ema9, ema21, ema50, ema200, levels.priorClose, levels.sessionHigh, levels.sessionLow, vwap]);

  return (
    <section className="mpChart" aria-label={`Illustrative ${stateLabel} candlestick chart`}>
      <header>
        <div>
          <span>ILLUSTRATIVE 5-MINUTE CHART</span>
          <h2>S&P 500 futures · ES presentation tape</h2>
          <p>Synthetic OHLCV geometry for screenshots and launch video only.</p>
        </div>
        <strong>ILLUSTRATIVE · NOT LIVE</strong>
      </header>
      <div className="mpChartCanvas" ref={hostRef} role="img" aria-label="Illustrative candlestick chart with EMA and VWAP overlays" />
      <footer>
        <span>EMA 9 / 21 / 50 / 200 · VWAP · volume · prior close · session high/low</span>
        <span>Deterministic fixture · no provider fetch</span>
      </footer>
    </section>
  );
}
