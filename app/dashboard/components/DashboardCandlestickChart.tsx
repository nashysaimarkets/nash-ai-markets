"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { UTCTimestamp } from "lightweight-charts";
import type { CandleTimeframe, VerifiedCandleSeries } from "../../lib/providers/financial-modeling-prep-candles.ts";
import { candleReferenceLevels, candleSessionStats, exponentialMovingAverage } from "../lib/candle-analysis.ts";

type Overlay = "volume" | "ema20" | "ema50";
const OPTIONS: Array<{ label: string; timeframe: CandleTimeframe }> = [{ label: "1m", timeframe: "1m" }, { label: "5m", timeframe: "5m" }, { label: "1h", timeframe: "1h" }, { label: "1D", timeframe: "1d" }];
const number = (value: number | null, digits = 2) => value === null ? "Unavailable" : value.toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const age = (ms: number | null) => ms === null ? "Age unavailable" : ms < 60_000 ? "Under 1 minute old" : ms < 3_600_000 ? `${Math.floor(ms / 60_000)} minutes old` : ms < 86_400_000 ? `${Math.floor(ms / 3_600_000)} hours old` : `${Math.floor(ms / 86_400_000)} days old`;

export function DashboardCandlestickChart({ series: initialSeries }: { series: VerifiedCandleSeries }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [series, setSeries] = useState(initialSeries);
  const [timeframe, setTimeframe] = useState<CandleTimeframe>(initialSeries.timeframe);
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [overlays, setOverlays] = useState<Record<Overlay, boolean>>({ volume: true, ema20: true, ema50: false });
  const stats = useMemo(() => candleSessionStats(series.candles), [series.candles]);
  const levels = useMemo(() => candleReferenceLevels(series.candles), [series.candles]);
  const available = series.status !== "unavailable" && series.candles.length > 0;
  const unavailableCopy = (() => {
    switch (series.failureCategory) {
      case "authentication":
        return { title: "Verified candle history unavailable", detail: "The market-data provider rejected authentication. No candles are shown." };
      case "entitlement":
        return { title: "Verified candle history unavailable", detail: "The configured provider entitlement does not include this series. No candles are shown." };
      case "rate_limit":
        return { title: "Verified candle history unavailable", detail: "The provider rate limit was reached. Retry shortly. No candles have been invented." };
      case "not_configured":
        return { title: "Verified candle history unavailable", detail: "Candle provider credentials are not configured for this environment." };
      case "schema":
        return { title: "Verified candle history unavailable", detail: "No structurally valid OHLCV series was returned for this interval." };
      default:
        return { title: "Verified candlestick history unavailable", detail: "No structurally valid OHLCV series was returned for this interval. No quote-derived, synthetic or carried-forward candles are displayed." };
    }
  })();

  async function load(next: CandleTimeframe) {
    setLoading(true); setRequestError(null);
    try {
      const response = await fetch(`/api/market/candles?timeframe=${next}`, { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 403 ? "Your membership could not be verified for candle history." : "Verified candle history could not be loaded.");
      const result = await response.json() as VerifiedCandleSeries;
      setSeries(result); setTimeframe(next);
    } catch (error) { setRequestError(error instanceof Error ? error.message : "Verified candle history could not be loaded."); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (!available || !containerRef.current) return;
    let disposed = false; let remove = () => {};
    void import("lightweight-charts").then(({ CandlestickSeries, ColorType, HistogramSeries, LineSeries, createChart }) => {
      if (disposed || !containerRef.current) return;
      const chart = createChart(containerRef.current, { autoSize: true, height: 520, layout: { background: { type: ColorType.Solid, color: "#091014" }, textColor: "#9aa7ad", attributionLogo: true }, grid: { vertLines: { color: "#19252b" }, horzLines: { color: "#19252b" } }, crosshair: { vertLine: { color: "#63777f", labelBackgroundColor: "#26373e" }, horzLine: { color: "#63777f", labelBackgroundColor: "#26373e" } }, rightPriceScale: { borderColor: "#2a3940", autoScale: true }, timeScale: { borderColor: "#2a3940", timeVisible: timeframe !== "1d", secondsVisible: false, rightOffset: 4, barSpacing: 8 }, handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true }, handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false } });
      const candles = chart.addSeries(CandlestickSeries, { upColor: "#68d7b4", downColor: "#e77f86", borderVisible: false, wickUpColor: "#68d7b4", wickDownColor: "#e77f86", priceLineVisible: true, lastValueVisible: true });
      candles.setData(series.candles.map(({ time, open, high, low, close }) => ({ time: time as UTCTimestamp, open, high, low, close })));
      if (overlays.volume) { const volume = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "volume", lastValueVisible: false, priceLineVisible: false }); volume.priceScale().applyOptions({ scaleMargins: { top: .78, bottom: 0 } }); volume.setData(series.candles.map((point) => ({ time: point.time as UTCTimestamp, value: point.volume, color: point.close >= point.open ? "#68d7b455" : "#e77f8655" }))); }
      const addLine = (data: Array<{ time: number; value: number }>, color: string, title: string) => { const line = chart.addSeries(LineSeries, { color, lineWidth: 2, title, priceLineVisible: false, lastValueVisible: true }); line.setData(data.map((point) => ({ time: point.time as UTCTimestamp, value: point.value }))); };
      if (overlays.ema20) addLine(exponentialMovingAverage(series.candles, 20), "#71b7e6", "EMA 20");
      if (overlays.ema50) addLine(exponentialMovingAverage(series.candles, 50), "#bb91e8", "EMA 50");
      for (const level of levels) candles.createPriceLine({ price: level.value, color: "#8fa2a866", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: level.label });
      chart.subscribeCrosshairMove((param) => { const value = param.seriesData.get(candles); if (tooltipRef.current && value && "open" in value) tooltipRef.current.textContent = `O ${number(value.open)} · H ${number(value.high)} · L ${number(value.low)} · C ${number(value.close)}`; });
      chart.timeScale().fitContent(); remove = () => chart.remove();
    });
    return () => { disposed = true; remove(); };
  }, [available, levels, overlays, series.candles, timeframe]);

  const updated = series.asOf ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(series.asOf)) : "Awaiting first verified candle";
  return <section className="dashboardMarketChart" aria-labelledby="dashboard-market-chart-title" data-status={series.status}>
    <header><div><span className="eliteEyebrow">PRIMARY MARKET WORKSPACE</span><h2 id="dashboard-market-chart-title">{series.instrumentName} · {series.symbol}</h2><p>{series.provider} · {series.exchange}. {series.instrumentDetail}</p></div><div className="chartStatus"><i aria-hidden="true" /><strong>{series.classification === "end_of_day" ? "End-of-day" : series.status === "stale" ? "Stale delayed data" : series.status}</strong><small>{updated} UK · {age(series.dataAgeMs)}</small></div></header>
    {stats ? <><div className="chartMarketStrip" aria-label="Verified rolling 24-hour statistics"><div><span>Latest verified close</span><strong>{number(stats.latest)}</strong></div><div><span>24h change</span><strong>{stats.change >= 0 ? "+" : ""}{number(stats.change)} ({number(stats.percentageChange)}%)</strong></div><div><span>24h high</span><strong>{number(stats.high)}</strong></div><div><span>24h low</span><strong>{number(stats.low)}</strong></div><div><span>First available close</span><strong>{number(stats.firstAvailableClose)}</strong></div><div><span>Average candle range · 14</span><strong>{number(stats.averageCandleRange)}</strong></div></div><div className="chartRange"><span>Rolling 24h position</span><div><i style={{ width: `${stats.rangePosition}%` }} /></div><strong>{number(stats.low)} — {number(stats.high)}</strong></div></> : null}
    <div className="chartControlBar"><div className="dashboardTimeframes" role="group" aria-label="Candlestick interval">{OPTIONS.map((option) => <button key={option.timeframe} type="button" aria-pressed={option.timeframe === timeframe} disabled={loading} onClick={() => option.timeframe !== timeframe && void load(option.timeframe)}>{option.label}</button>)}</div><div className="dashboardOverlays" role="group" aria-label="Chart overlays">{([['volume','Volume'],['ema20','20 EMA'],['ema50','50 EMA']] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={overlays[key]} onClick={() => setOverlays((current) => ({ ...current, [key]: !current[key] }))}>{label}</button>)}<button type="button" disabled={loading} onClick={() => void load(timeframe)}>{loading ? "Loading…" : "Refresh"}</button></div></div>
    {requestError ? <div className="chartRequestError" role="alert">{requestError} Your existing chart remains visible. You can retry safely.</div> : null}
    {loading ? <div className="dashboardChartLoading" role="status">Loading verified {timeframe} candles…</div> : available ? <><div className="dashboardChartCanvas" ref={containerRef} role="img" tabIndex={0} aria-label={`${series.symbol} ${timeframe} interactive candlestick chart`} /><div className="dashboardChartTooltip" ref={tooltipRef} aria-live="polite">Move the crosshair over a candle for OHLC values</div></> : <div className="dashboardChartUnavailable" role="status"><span aria-hidden="true">⌁</span><div><strong>{unavailableCopy.title}</strong><p>{unavailableCopy.detail}</p><small>Choose another interval or retry later.</small></div></div>}
    <footer><span>{series.classification === "end_of_day" ? "End-of-day" : "Delayed"} verified provider series</span><span>Interactive intelligence only · no order execution</span></footer>
  </section>;
}
