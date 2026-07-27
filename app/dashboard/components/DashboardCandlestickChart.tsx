"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { IChartApi, UTCTimestamp } from "lightweight-charts";
import type { CandleInstrument } from "../../lib/providers/candle-instruments.ts";
import type { CandleTimeframe, CustomerCandleSeries } from "../../lib/providers/financial-modeling-prep-candles.ts";
import { candleReferenceLevels, candleSessionStats, exponentialMovingAverage } from "../lib/candle-analysis.ts";

type Overlay = "volume" | "ema20" | "ema50";
const OPTIONS: Array<{ label: string; timeframe: CandleTimeframe }> = [
  { label: "1m", timeframe: "1m" },
  { label: "5m", timeframe: "5m" },
  { label: "15m", timeframe: "15m" },
  { label: "1h", timeframe: "1h" },
  { label: "4h", timeframe: "4h" },
  { label: "1D", timeframe: "1d" },
];
const REFRESH_MS = 90_000;
const number = (value: number | null, digits = 2) => value === null ? "Unavailable" : value.toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const age = (ms: number | null) => ms === null ? "Age unavailable" : ms < 60_000 ? "Under 1 minute old" : ms < 3_600_000 ? `${Math.floor(ms / 60_000)} minutes old` : ms < 86_400_000 ? `${Math.floor(ms / 3_600_000)} hours old` : `${Math.floor(ms / 86_400_000)} days old`;

function customerStatusLabel(series: CustomerCandleSeries): string {
  if (series.status === "unavailable") return "Unavailable";
  if (series.classification === "end_of_day") return "End-of-day";
  if (series.status === "previous_session" || series.classification === "previous_session") return "Previous session";
  if (series.status === "market_closed" || series.classification === "market_closed") return "Market closed";
  if (series.status === "stale") return "Stale delayed data";
  return "Delayed";
}

function unavailableCopy(series: CustomerCandleSeries) {
  const interval = series.timeframe === "1d" ? "daily" : series.timeframe;
  const metric = `Verified ${interval} candlestick history for ${series.symbol}`;
  switch (series.failureCategory) {
    case "authentication":
      return { title: metric, detail: "Unavailable because the market-data provider rejected authentication for this environment. No candles are shown." };
    case "entitlement":
      return { title: metric, detail: "Unavailable because the configured provider plan does not include this interval. No synthetic candles are generated." };
    case "rate_limit":
      return { title: metric, detail: "Unavailable because the provider rate limit was reached. Retry shortly. No candles have been invented." };
    case "not_configured":
      return { title: metric, detail: "Unavailable because candle provider credentials are not configured for this environment." };
    case "schema":
      return { title: metric, detail: "Unavailable because the provider returned no structurally valid OHLCV observations for this interval." };
    case "provider":
      return { title: metric, detail: "Unavailable because the provider request failed. Existing analysis is not back-filled with invented prices." };
    default:
      return { title: metric, detail: "Unavailable while verified OHLCV observations are missing. No quote-derived, synthetic or carried-forward candles are displayed." };
  }
}

export function DashboardCandlestickChart({
  series: initialSeries,
  instrument = "ES",
  compact = false,
  structureLevels,
}: {
  series: CustomerCandleSeries;
  instrument?: CandleInstrument;
  compact?: boolean;
  structureLevels?: {
    support: { value: number; label: string } | null;
    resistance: { value: number; label: string } | null;
  };
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const requestIdRef = useRef(0);
  const [series, setSeries] = useState(initialSeries);
  const [timeframe, setTimeframe] = useState<CandleTimeframe>(initialSeries.timeframe);
  const [pendingTimeframe, setPendingTimeframe] = useState<CandleTimeframe | null>(null);
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [overlays, setOverlays] = useState<Record<Overlay, boolean>>({ volume: !compact, ema20: true, ema50: false });
  const displayTimeframe = pendingTimeframe ?? timeframe;
  const intervalMismatch = pendingTimeframe !== null && pendingTimeframe !== series.timeframe;
  const stats = useMemo(() => (intervalMismatch ? null : candleSessionStats(series.candles)), [intervalMismatch, series.candles]);
  const levels = useMemo(() => (intervalMismatch ? [] : candleReferenceLevels(series.candles)), [intervalMismatch, series.candles]);
  const available = !intervalMismatch && series.status !== "unavailable" && series.candles.length > 0;
  const volumeVerified = series.candles.some((candle) => candle.volume > 0);
  const newest = !intervalMismatch ? series.candles.at(-1) ?? null : null;
  const opening = !intervalMismatch ? series.candles.at(0)?.open ?? null : null;
  const newestLabel = newest
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(newest.time * 1000))
    : null;
  const statusLabel = intervalMismatch ? `Loading ${pendingTimeframe}` : customerStatusLabel(series);
  const empty = unavailableCopy(series);
  const chartHeight = compact ? 220 : 360;

  async function load(next: CandleTimeframe, opts?: { silent?: boolean }) {
    const requestId = ++requestIdRef.current;
    if (!opts?.silent) {
      setLoading(true);
      setPendingTimeframe(next);
      setRequestError(null);
    }
    try {
      const response = await fetch(`/api/market/candles?timeframe=${next}&instrument=${encodeURIComponent(instrument)}`, { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 403 ? "Your membership could not be verified for candle history." : "Verified candle history could not be loaded.");
      const result = await response.json() as CustomerCandleSeries;
      if (requestId !== requestIdRef.current) return;
      if (result.timeframe !== next) throw new Error("Verified candle history did not match the requested interval.");
      setSeries(result);
      setTimeframe(next);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      if (!opts?.silent) setRequestError(error instanceof Error ? error.message : "Verified candle history could not be loaded.");
    } finally {
      if (requestId !== requestIdRef.current) return;
      if (!opts?.silent) {
        setLoading(false);
        setPendingTimeframe(null);
      }
    }
  }

  useEffect(() => {
    const timer = window.setInterval(() => { void load(timeframe, { silent: true }); }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [timeframe, instrument]);

  useEffect(() => {
    setSeries(initialSeries);
    setTimeframe(initialSeries.timeframe);
  }, [initialSeries]);

  useEffect(() => {
    if (!available) {
      chartRef.current?.remove();
      chartRef.current = null;
      return;
    }
    const host = containerRef.current;
    if (!host) return;
    let disposed = false;
    let painted = false;
    let resizeObserver: ResizeObserver | null = null;

    const paint = () => {
      if (disposed || painted || !containerRef.current || containerRef.current.clientWidth < 40) return;
      painted = true;
      void import("lightweight-charts").then(({ CandlestickSeries, ColorType, HistogramSeries, LineSeries, createChart }) => {
        if (disposed || !containerRef.current) return;
        chartRef.current?.remove();
        chartRef.current = null;
        containerRef.current.replaceChildren();
        const chart = createChart(containerRef.current, {
          autoSize: true,
          height: Math.max(containerRef.current.clientHeight, chartHeight),
          layout: { background: { type: ColorType.Solid, color: "#091014" }, textColor: "#9aa7ad", attributionLogo: true },
          grid: { vertLines: { color: "#19252b" }, horzLines: { color: "#19252b" } },
          crosshair: { vertLine: { color: "#63777f", labelBackgroundColor: "#26373e" }, horzLine: { color: "#63777f", labelBackgroundColor: "#26373e" } },
          rightPriceScale: { borderColor: "#2a3940", autoScale: true },
          timeScale: { borderColor: "#2a3940", timeVisible: timeframe !== "1d", secondsVisible: false, rightOffset: 6, barSpacing: compact ? 5 : 7 },
          handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
          handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
        });
        chartRef.current = chart;
        const candles = chart.addSeries(CandlestickSeries, {
          upColor: "#68d7b4",
          downColor: "#e77f86",
          borderVisible: false,
          wickUpColor: "#68d7b4",
          wickDownColor: "#e77f86",
          priceLineVisible: true,
          lastValueVisible: true,
        });
        const points = series.candles.map(({ time, open, high, low, close }) => ({ time: time as UTCTimestamp, open, high, low, close }));
        candles.setData(points);
        if (overlays.volume && volumeVerified) {
          const volume = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "volume", lastValueVisible: false, priceLineVisible: false });
          volume.priceScale().applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
          volume.setData(series.candles.map((point) => ({ time: point.time as UTCTimestamp, value: point.volume, color: point.close >= point.open ? "#68d7b455" : "#e77f8655" })));
        }
        const addLine = (data: Array<{ time: number; value: number }>, color: string, title: string) => {
          const line = chart.addSeries(LineSeries, { color, lineWidth: 2, title, priceLineVisible: false, lastValueVisible: true });
          line.setData(data.map((point) => ({ time: point.time as UTCTimestamp, value: point.value })));
        };
        if (overlays.ema20) addLine(exponentialMovingAverage(series.candles, 20), "#71b7e6", "EMA 20");
        if (overlays.ema50) addLine(exponentialMovingAverage(series.candles, 50), "#bb91e8", "EMA 50");
        if (!compact) {
          for (const level of levels) candles.createPriceLine({ price: level.value, color: "#8fa2a866", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: level.label });
        }
        if (structureLevels?.support) {
          candles.createPriceLine({
            price: structureLevels.support.value,
            color: "#55e69a",
            lineWidth: 2,
            lineStyle: 2,
            axisLabelVisible: true,
            title: structureLevels.support.label,
          });
        }
        if (structureLevels?.resistance) {
          candles.createPriceLine({
            price: structureLevels.resistance.value,
            color: "#ec7474",
            lineWidth: 2,
            lineStyle: 2,
            axisLabelVisible: true,
            title: structureLevels.resistance.label,
          });
        }
        chart.subscribeCrosshairMove((param) => {
          const value = param.seriesData.get(candles);
          if (tooltipRef.current && value && "open" in value) {
            tooltipRef.current.textContent = `O ${number(value.open)} · H ${number(value.high)} · L ${number(value.low)} · C ${number(value.close)}`;
          }
        });
        requestAnimationFrame(() => {
          if (!disposed) chart.timeScale().fitContent();
        });
      }).catch(() => {
        painted = false;
      });
    };

    paint();
    resizeObserver = new ResizeObserver(() => { if (!painted) paint(); });
    resizeObserver.observe(host);
    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, [available, chartHeight, compact, levels, overlays, series.candles, structureLevels, timeframe, volumeVerified]);

  const updated = series.asOf && !intervalMismatch
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(series.asOf))
    : intervalMismatch
      ? `Loading verified ${pendingTimeframe} series`
      : "Awaiting first verified candle";

  return <section className={`dashboardMarketChart${compact ? " is-compact" : ""}`} aria-labelledby={`dashboard-market-chart-title-${instrument}`} data-status={intervalMismatch ? "loading" : series.status} data-timeframe={displayTimeframe} data-instrument={instrument}>
    <header>
      <div>
        <span className="eliteEyebrow">{compact ? "VERIFIED CANDLES" : "PRIMARY MARKET WORKSPACE"}</span>
        <h2 id={`dashboard-market-chart-title-${instrument}`}>{series.instrumentName} · {series.symbol}</h2>
        {!compact ? <p>{series.instrumentDetail}</p> : null}
      </div>
      <div className="chartStatus"><i aria-hidden="true" /><strong>{statusLabel}</strong><small>{updated}{intervalMismatch ? "" : ` UK · ${age(series.dataAgeMs)}`}</small></div>
    </header>
    {stats && !compact ? <>
      <div className="chartMarketStrip" aria-label="Verified rolling 24-hour statistics">
        <div><span>Latest verified close</span><strong>{number(stats.latest)}</strong></div>
        <div><span>Net / % change</span><strong>{stats.change >= 0 ? "+" : ""}{number(stats.change)} ({number(stats.percentageChange)}%)</strong></div>
        <div><span>24h high</span><strong>{number(stats.high)}</strong></div>
        <div><span>24h low</span><strong>{number(stats.low)}</strong></div>
        <div><span>Newest candle</span><strong>{newestLabel ?? "Unavailable"}</strong></div>
        <div><span>Latest candle age</span><strong>{age(series.dataAgeMs)}</strong></div>
      </div>
      <div className="chartRange"><span>Rolling 24h position</span><div><i style={{ width: `${stats.rangePosition}%` }} /></div><strong>{number(stats.low)} — {number(stats.high)}</strong></div>
    </> : stats && compact && structureLevels ? (
      <div className="chartMarketStrip is-structure" aria-label="Verified opening, range and structure levels">
        <div><span>Opening</span><strong>{number(opening)}</strong></div>
        <div><span>Rolling high</span><strong>{number(stats.high)}</strong></div>
        <div><span>Rolling low</span><strong>{number(stats.low)}</strong></div>
        <div data-level="support"><span>Support</span><strong>{number(structureLevels.support?.value ?? null)}</strong></div>
        <div data-level="resistance"><span>Resistance</span><strong>{number(structureLevels.resistance?.value ?? null)}</strong></div>
      </div>
    ) : stats && compact ? (
      <div className="chartMarketStrip is-compact" aria-label="Verified candle summary">
        <div><span>Latest close</span><strong>{number(stats.latest)}</strong></div>
        <div><span>Latest candle age</span><strong>{age(series.dataAgeMs)}</strong></div>
      </div>
    ) : loading || intervalMismatch ? <div className="chartRequestError" role="status">Loading verified {displayTimeframe} statistics. The previous interval is not shown as the new selection.</div> : null}
    <div className="chartControlBar">
      <div className="dashboardTimeframes" role="group" aria-label="Candlestick interval">
        {(compact ? OPTIONS.filter((option) => option.timeframe !== "1m" && option.timeframe !== "4h") : OPTIONS).map((option) => <button key={option.timeframe} type="button" aria-pressed={option.timeframe === displayTimeframe} disabled={loading} onClick={() => option.timeframe !== displayTimeframe && void load(option.timeframe)}>{option.label}</button>)}
      </div>
      {!compact ? (
        <div className="dashboardOverlays" role="group" aria-label="Chart overlays">
          {([["volume", "Volume"], ["ema20", "20 EMA"], ["ema50", "50 EMA"]] as const).map(([key, label]) => (
            <button key={key} type="button" aria-pressed={overlays[key]} disabled={key === "volume" && !volumeVerified} onClick={() => setOverlays((current) => ({ ...current, [key]: !current[key] }))}>{label}</button>
          ))}
          <button type="button" disabled={loading} onClick={() => void load(timeframe)}>{loading ? "Refreshing…" : "Refresh"}</button>
        </div>
      ) : (
        <button type="button" disabled={loading} onClick={() => void load(timeframe)}>{loading ? "Refreshing…" : "Refresh"}</button>
      )}
    </div>
    {requestError ? <div className="chartRequestError" role="alert">{requestError} You can retry safely without inventing candles.</div> : null}
    {available ? <div className="dashboardChartFrame" style={compact ? { minHeight: chartHeight } : undefined}>
      {loading ? <div className="dashboardChartLoading" role="status">Refreshing verified {displayTimeframe} candles…</div> : null}
      <div className="dashboardChartCanvas" ref={containerRef} role="img" tabIndex={0} aria-label={`${series.symbol} ${timeframe} interactive candlestick chart`} style={compact ? { minHeight: chartHeight } : undefined} />
      <div className="dashboardChartTooltip" ref={tooltipRef} aria-live="polite">Move the crosshair over a candle for OHLC values</div>
    </div> : intervalMismatch || loading ? <div className="dashboardChartUnavailable" role="status" data-state="loading"><span aria-hidden="true">⟳</span><div><strong>Loading verified {displayTimeframe} candles</strong><p>Waiting for the provider response for this interval. The previous interval stays hidden so it cannot be mistaken for the new selection.</p></div></div>
      : <div className="dashboardChartUnavailable" role="status" data-state={series.status}><span aria-hidden="true">⌁</span><div><strong>{empty.title}</strong><p>{empty.detail}</p><small>Choose another interval or retry later.</small></div></div>}
    <footer>
      <span>{statusLabel} verified series · never labelled live</span>
      <span>Interactive intelligence only · no order execution</span>
    </footer>
  </section>;
}
