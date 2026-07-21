"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { UTCTimestamp } from "lightweight-charts";
import type { VerifiedCandleSeries } from "../../lib/providers/financial-modeling-prep-candles.ts";
import { aggregateCandles, candleReferenceLevels, candleSessionStats, exponentialMovingAverage, volumeWeightedAveragePrice, type DashboardChartTimeframe } from "../lib/candle-analysis.ts";

type Overlay = "vwap" | "ema20" | "ema50";
const OPTIONS: Array<{ label: string; timeframe: DashboardChartTimeframe | null; reason?: string }> = [
  { label: "1m", timeframe: null, reason: "Not available from the current verified history" },
  { label: "5m", timeframe: "5m" },
  { label: "15m", timeframe: "15m" },
  { label: "1h", timeframe: "1h" },
  { label: "1D", timeframe: null, reason: "Daily history is not included in the verified intraday payload" },
];

const number = (value: number | null, digits = 2) => value === null ? "Unavailable" : value.toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function DashboardCandlestickChart({ series }: { series: VerifiedCandleSeries }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [timeframe, setTimeframe] = useState<DashboardChartTimeframe>("5m");
  const [overlays, setOverlays] = useState<Record<Overlay, boolean>>({ vwap: false, ema20: false, ema50: false });
  const stats = useMemo(() => candleSessionStats(series.candles), [series.candles]);
  const levels = useMemo(() => candleReferenceLevels(series.candles), [series.candles]);
  const chartCandles = useMemo(() => aggregateCandles(stats?.visibleCandles ?? [], timeframe), [stats, timeframe]);
  const available = series.status !== "unavailable" && chartCandles.length > 0;

  useEffect(() => {
    if (!available || !containerRef.current) return;
    let disposed = false;
    let remove: () => void = () => {};
    void import("lightweight-charts").then(({ CandlestickSeries, ColorType, LineSeries, createChart }) => {
      if (disposed || !containerRef.current) return;
      const chart = createChart(containerRef.current, {
        autoSize: true, height: 520,
        layout: { background: { type: ColorType.Solid, color: "#091014" }, textColor: "#9aa7ad", attributionLogo: true },
        grid: { vertLines: { color: "#19252b" }, horzLines: { color: "#19252b" } },
        crosshair: { vertLine: { color: "#63777f", labelBackgroundColor: "#26373e" }, horzLine: { color: "#63777f", labelBackgroundColor: "#26373e" } },
        rightPriceScale: { borderColor: "#2a3940", autoScale: true },
        timeScale: { borderColor: "#2a3940", timeVisible: true, secondsVisible: false, rightOffset: 4, barSpacing: timeframe === "5m" ? 8 : 12 },
        handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
        handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      });
      const candleSeries = chart.addSeries(CandlestickSeries, { upColor: "#68d7b4", downColor: "#e77f86", borderVisible: false, wickUpColor: "#68d7b4", wickDownColor: "#e77f86" });
      candleSeries.setData(chartCandles.map(({ time, open, high, low, close }) => ({ time: time as UTCTimestamp, open, high, low, close })));
      const addLine = (data: Array<{ time: number; value: number }>, color: string, title: string) => {
        const line = chart.addSeries(LineSeries, { color, lineWidth: 2, title, priceLineVisible: false, lastValueVisible: true });
        line.setData(data.map((point) => ({ time: point.time as UTCTimestamp, value: point.value })));
      };
      if (overlays.vwap) addLine(volumeWeightedAveragePrice(chartCandles), "#d8b875", "VWAP");
      if (overlays.ema20) addLine(exponentialMovingAverage(chartCandles, 20), "#71b7e6", "EMA 20");
      if (overlays.ema50) addLine(exponentialMovingAverage(chartCandles, 50), "#bb91e8", "EMA 50");
      for (const level of levels) candleSeries.createPriceLine({ price: level.value, color: "#8fa2a866", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: level.label });
      chart.subscribeCrosshairMove((param) => {
        const value = param.seriesData.get(candleSeries);
        if (!tooltipRef.current || !value || !("open" in value)) return;
        tooltipRef.current.textContent = `O ${number(value.open)} · H ${number(value.high)} · L ${number(value.low)} · C ${number(value.close)}`;
      });
      chart.timeScale().fitContent();
      remove = () => chart.remove();
    });
    return () => { disposed = true; remove(); };
  }, [available, chartCandles, levels, overlays, timeframe]);

  const updated = series.asOf ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(series.asOf)) : "Awaiting first verified candle";
  return <section className="dashboardMarketChart" aria-labelledby="dashboard-market-chart-title" data-status={series.status}>
    <header>
      <div><span className="eliteEyebrow">PRIMARY MARKET WORKSPACE</span><h2 id="dashboard-market-chart-title">{series.instrumentName} · {series.symbol}</h2><p>{series.exchange} · {series.provider} · {series.instrumentDetail}. Verified {series.timeframe} candles are aggregated locally without additional provider requests.</p></div>
      <div className="chartStatus"><i aria-hidden="true" /><strong>{series.status}</strong><small>{updated} UK</small></div>
    </header>
    {stats ? <div className="chartMarketStrip" aria-label="Verified rolling 24-hour statistics">
      <div><span>Latest verified close</span><strong>{number(stats.latest)}</strong></div><div><span>24h change</span><strong>{stats.change >= 0 ? "+" : ""}{number(stats.change)}</strong></div><div><span>24h percent</span><strong>{stats.percentageChange >= 0 ? "+" : ""}{number(stats.percentageChange)}%</strong></div><div><span>24h high</span><strong>{number(stats.high)}</strong></div><div><span>24h low</span><strong>{number(stats.low)}</strong></div><div><span>First available close</span><strong>{number(stats.firstAvailableClose)}</strong></div>
    </div> : null}
    <div className="chartControlBar">
      <div className="dashboardTimeframes" role="group" aria-label="Candlestick interval">{OPTIONS.map((option) => <button key={option.label} type="button" disabled={!option.timeframe} title={option.reason} aria-pressed={option.timeframe === timeframe} onClick={() => option.timeframe && setTimeframe(option.timeframe)}>{option.label}</button>)}</div>
      <div className="dashboardOverlays" role="group" aria-label="Chart overlays">{([['vwap','VWAP'],['ema20','20 EMA'],['ema50','50 EMA']] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={overlays[key]} onClick={() => setOverlays((current) => ({ ...current, [key]: !current[key] }))}>{label}</button>)}</div>
    </div>
    {available ? <><div className="dashboardChartCanvas" ref={containerRef} role="img" tabIndex={0} aria-label={`${series.symbol} ${timeframe} interactive candlestick chart. Use mouse, trackpad or touch to pan and zoom.`} /><div className="dashboardChartTooltip" ref={tooltipRef} aria-live="polite">Move the crosshair over a candle for OHLC values</div></> : <div className="dashboardChartUnavailable" role="status"><span aria-hidden="true">⌁</span><div><strong>Verified candlestick history unavailable</strong><p>The chart remains empty because FMP did not return a current, structurally valid OHLC series. No fixture, synthetic or carried-forward candles are displayed.</p><small>Try again later; no chart data has been substituted.</small></div></div>}
    <footer><span>Provider status: {series.status} · locally aggregated from verified history</span><span>Interactive display only · no order execution</span></footer>
  </section>;
}
