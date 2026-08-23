"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { IChartApi, UTCTimestamp } from "lightweight-charts";
import type { CandleInstrument } from "../../lib/providers/candle-instruments.ts";
import type { CandleTimeframe, CustomerCandleSeries } from "../../lib/providers/financial-modeling-prep-candles.ts";
import { exponentialMovingAverage, volumeWeightedAveragePrice } from "../lib/candle-analysis.ts";
import { deriveSessionReferenceLevels, sessionStatusLabel } from "../lib/session-levels.ts";

type OverlayKey = "volume" | "ema9" | "ema20" | "ema50" | "ema200" | "vwap";

const OPTIONS: Array<{ label: string; timeframe: CandleTimeframe }> = [
  { label: "1m", timeframe: "1m" },
  { label: "5m", timeframe: "5m" },
  { label: "15m", timeframe: "15m" },
  { label: "1h", timeframe: "1h" },
  { label: "4h", timeframe: "4h" },
  { label: "1D", timeframe: "1d" },
];

const REFRESH_MS = 90_000;
const DEFAULT_OVERLAYS: Record<OverlayKey, boolean> = {
  volume: true,
  ema9: true,
  ema20: true,
  ema50: true,
  ema200: true,
  vwap: true,
};

const number = (value: number | null, digits = 2) =>
  value === null ? "—" : value.toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits });

function customerStatusLabel(series: CustomerCandleSeries): string {
  if (series.status === "unavailable") return "Unavailable";
  if (series.classification === "end_of_day") return "End-of-day";
  if (series.status === "previous_session" || series.classification === "previous_session") return "Previous session";
  if (series.status === "market_closed" || series.classification === "market_closed") return "Market closed";
  if (series.status === "stale") return "Stale delayed data";
  return "Delayed";
}

export function HeroMarketChart({
  series: initialSeries,
  instrument = "ES",
  sessionPhase = "weekend",
}: {
  series: CustomerCandleSeries;
  instrument?: CandleInstrument;
  sessionPhase?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const [series, setSeries] = useState(initialSeries);
  const [timeframe, setTimeframe] = useState<CandleTimeframe>(initialSeries.timeframe);
  const [syncedSeries, setSyncedSeries] = useState(initialSeries);

  // Adjust state during render when the server sends a new series, rather than
  // in an effect — an effect would paint the stale series first.
  if (initialSeries !== syncedSeries) {
    setSyncedSeries(initialSeries);
    setSeries(initialSeries);
    setTimeframe(initialSeries.timeframe);
  }

  const [pendingTimeframe, setPendingTimeframe] = useState<CandleTimeframe | null>(null);
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [overlays, setOverlays] = useState(DEFAULT_OVERLAYS);

  const displayTimeframe = pendingTimeframe ?? timeframe;
  const intervalMismatch = pendingTimeframe !== null && pendingTimeframe !== series.timeframe;
  const available = !intervalMismatch && series.status !== "unavailable" && series.candles.length > 0;
  const volumeVerified = series.candles.some((candle) => candle.volume > 0);
  const sessionLevels = useMemo(
    () => (intervalMismatch ? null : deriveSessionReferenceLevels(series.candles)),
    [intervalMismatch, series.candles],
  );
  const marketStatus = sessionStatusLabel(sessionPhase);
  const statusLabel = intervalMismatch ? `Loading ${pendingTimeframe}` : customerStatusLabel(series);

  async function load(next: CandleTimeframe, opts?: { silent?: boolean }) {
    const requestId = ++requestIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (!opts?.silent) {
      setLoading(true);
      setPendingTimeframe(next);
      setRequestError(null);
    }
    try {
      const response = await fetch(`/api/market/candles?timeframe=${next}&instrument=${encodeURIComponent(instrument)}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(
          response.status === 403
            ? "Your membership could not be verified for candle history."
            : response.status === 503
              ? "Membership verification is temporarily unavailable."
              : "Verified candle history could not be loaded.",
        );
      }
      const result = (await response.json()) as CustomerCandleSeries;
      if (requestId !== requestIdRef.current) return;
      if (result.timeframe !== next) throw new Error("Verified candle history did not match the requested interval.");
      setSeries(result);
      setTimeframe(next);
    } catch (error) {
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      if (!opts?.silent) setRequestError(error instanceof Error ? error.message : "Verified candle history could not be loaded.");
    } finally {
      if (requestId !== requestIdRef.current) return;
      if (!opts?.silent) {
        setLoading(false);
        setPendingTimeframe(null);
      }
    }
  }

  // Held in a ref so the background refresh does not restart on every render.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadRef.current(timeframe, { silent: true });
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [timeframe, instrument]);

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
      void import("lightweight-charts")
        .then(({ CandlestickSeries, ColorType, CrosshairMode, HistogramSeries, LineSeries, createChart }) => {
          if (disposed || !containerRef.current) return;
          chartRef.current?.remove();
          chartRef.current = null;
          containerRef.current.replaceChildren();
          const chart = createChart(containerRef.current, {
            autoSize: true,
            height: Math.max(containerRef.current.clientHeight, 480),
            layout: {
              background: { type: ColorType.Solid, color: "transparent" },
              textColor: "#9aa7ad",
              attributionLogo: true,
              fontFamily: "var(--font-geist-sans), Arial, sans-serif",
            },
            grid: { vertLines: { color: "#1a262d" }, horzLines: { color: "#1a262d" } },
            crosshair: {
              mode: CrosshairMode.Normal,
              vertLine: { color: "#7a9099", labelBackgroundColor: "#24343c", width: 1, style: 0 },
              horzLine: { color: "#7a9099", labelBackgroundColor: "#24343c", width: 1, style: 0 },
            },
            rightPriceScale: { borderColor: "#2a3940", autoScale: true },
            timeScale: {
              borderColor: "#2a3940",
              timeVisible: timeframe !== "1d",
              secondsVisible: false,
              rightOffset: 8,
              barSpacing: 8,
            },
            handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
            handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
          });
          chartRef.current = chart;
          const candles = chart.addSeries(CandlestickSeries, {
            upColor: "#62e6b1",
            downColor: "#ef7777",
            borderVisible: false,
            wickUpColor: "#62e6b1",
            wickDownColor: "#ef7777",
            priceLineVisible: true,
            lastValueVisible: true,
          });
          candles.setData(
            series.candles.map(({ time, open, high, low, close }) => ({
              time: time as UTCTimestamp,
              open,
              high,
              low,
              close,
            })),
          );

          if (overlays.volume && volumeVerified) {
            const volume = chart.addSeries(HistogramSeries, {
              priceFormat: { type: "volume" },
              priceScaleId: "volume",
              lastValueVisible: false,
              priceLineVisible: false,
            });
            volume.priceScale().applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
            volume.setData(
              series.candles.map((point) => ({
                time: point.time as UTCTimestamp,
                value: point.volume,
                color: point.close >= point.open ? "#62e6b144" : "#ef777744",
              })),
            );
          }

          const addLine = (data: Array<{ time: number; value: number }>, color: string, title: string, width: 1 | 2 | 3 = 2) => {
            if (!data.length) return;
            const line = chart.addSeries(LineSeries, {
              color,
              lineWidth: width,
              title,
              priceLineVisible: false,
              lastValueVisible: false,
            });
            line.setData(data.map((point) => ({ time: point.time as UTCTimestamp, value: point.value })));
          };

          if (overlays.ema9) addLine(exponentialMovingAverage(series.candles, 9), "#f0c674", "EMA 9", 1);
          if (overlays.ema20) addLine(exponentialMovingAverage(series.candles, 20), "#71b7e6", "EMA 20", 2);
          if (overlays.ema50) addLine(exponentialMovingAverage(series.candles, 50), "#bb91e8", "EMA 50", 2);
          if (overlays.ema200) addLine(exponentialMovingAverage(series.candles, 200), "#e8a07a", "EMA 200", 2);
          if (overlays.vwap && volumeVerified) addLine(volumeWeightedAveragePrice(series.candles), "#9ce3d4", "VWAP", 2);

          const priceLines: Array<{ price: number; color: string; title: string }> = [];
          if (sessionLevels?.previousDayHigh != null) {
            priceLines.push({ price: sessionLevels.previousDayHigh, color: "#ef7777aa", title: "PDH" });
          }
          if (sessionLevels?.previousDayLow != null) {
            priceLines.push({ price: sessionLevels.previousDayLow, color: "#62e6b1aa", title: "PDL" });
          }
          if (sessionLevels?.overnightHigh != null) {
            priceLines.push({ price: sessionLevels.overnightHigh, color: "#d8b36aaa", title: "ONH" });
          }
          if (sessionLevels?.overnightLow != null) {
            priceLines.push({ price: sessionLevels.overnightLow, color: "#76cfd8aa", title: "ONL" });
          }
          if (sessionLevels?.todaysOpen != null) {
            priceLines.push({ price: sessionLevels.todaysOpen, color: "#c5d0d6aa", title: "Open" });
          }
          for (const line of priceLines) {
            candles.createPriceLine({
              price: line.price,
              color: line.color,
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title: line.title,
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
        })
        .catch(() => {
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
  }, [available, overlays, series.candles, sessionLevels, timeframe, volumeVerified]);

  const updated = series.asOf && !intervalMismatch
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(series.asOf))
    : "Awaiting verified candle";

  return (
    <section className="mccHeroChart" aria-labelledby="mcc-hero-chart-title" data-status={intervalMismatch ? "loading" : series.status}>
      <header className="mccHeroChartHeader">
        <div>
          <span className="mccEyebrow">HERO MARKET CHART</span>
          <h2 id="mcc-hero-chart-title">{series.instrumentName} · {series.symbol}</h2>
          <p>Interactive verified OHLCV · zoom, pan and crosshair · never labelled live</p>
        </div>
        <div className="mccHeroBadges">
          <span className={`mccSessionBadge is-${marketStatus.toLowerCase().replace("-", "")}`}>{marketStatus}</span>
          <span className="mccDelayedBadge" role="status">Market Data: Delayed (~10 minutes)</span>
          <div className="mccFeedPill">
            <i aria-hidden="true" />
            <strong>{statusLabel}</strong>
            <small>{updated} UK</small>
          </div>
        </div>
      </header>

      <div className="mccLevelStrip" aria-label="Session reference levels">
        <div><span>Previous Day High</span><strong>{number(sessionLevels?.previousDayHigh ?? null)}</strong></div>
        <div><span>Previous Day Low</span><strong>{number(sessionLevels?.previousDayLow ?? null)}</strong></div>
        <div><span>Overnight High</span><strong>{number(sessionLevels?.overnightHigh ?? null)}</strong></div>
        <div><span>Overnight Low</span><strong>{number(sessionLevels?.overnightLow ?? null)}</strong></div>
        <div><span>Today&apos;s Open</span><strong>{number(sessionLevels?.todaysOpen ?? null)}</strong></div>
      </div>

      <div className="mccChartControls">
        <div className="mccTimeframes" role="group" aria-label="Candlestick interval">
          {OPTIONS.map((option) => (
            <button
              key={option.timeframe}
              type="button"
              aria-pressed={option.timeframe === displayTimeframe}
              disabled={loading}
              onClick={() => option.timeframe !== displayTimeframe && void load(option.timeframe)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="mccOverlays" role="group" aria-label="Chart overlays">
          {(
            [
              ["volume", "Volume"],
              ["ema9", "EMA 9"],
              ["ema20", "EMA 20"],
              ["ema50", "EMA 50"],
              ["ema200", "EMA 200"],
              ["vwap", "VWAP"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={overlays[key]}
              disabled={(key === "volume" || key === "vwap") && !volumeVerified}
              onClick={() => setOverlays((current) => ({ ...current, [key]: !current[key] }))}
            >
              {label}
            </button>
          ))}
          <button type="button" disabled={loading} onClick={() => void load(timeframe)}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {requestError ? <div className="mccChartError" role="alert">{requestError}</div> : null}

      {available ? (
        <div className="mccChartFrame">
          {loading ? <div className="mccChartLoading" role="status">Refreshing verified candles…</div> : null}
          <div
            className="mccChartCanvas"
            ref={containerRef}
            role="img"
            tabIndex={0}
            aria-label={`${series.symbol} ${timeframe} interactive candlestick chart`}
          />
          <div className="mccChartTooltip" ref={tooltipRef} aria-live="polite">
            Move the crosshair over a candle for OHLC values
          </div>
        </div>
      ) : loading || intervalMismatch ? (
        <div className="mccChartSkeleton" role="status" aria-label="Loading chart">
          <div className="mccSkeletonBar" />
          <div className="mccSkeletonBar short" />
          <p>Loading verified {displayTimeframe} candles…</p>
        </div>
      ) : (
        <div className="mccChartUnavailable" role="status">
          <strong>Verified candlestick history unavailable</strong>
          <p>No synthetic candles are shown. Retry later or choose another interval.</p>
        </div>
      )}

      <footer>
        <span>{statusLabel} verified series · Market Data: Delayed (~10 minutes)</span>
        <span>Educational levels from verified candles · no order execution</span>
      </footer>
    </section>
  );
}
