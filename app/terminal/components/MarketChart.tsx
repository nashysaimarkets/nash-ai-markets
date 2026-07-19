"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { UTCTimestamp } from "lightweight-charts";
import { TERMINAL_TIMEFRAMES, chartDisplayState, type ChartDataMode, type OhlcvPoint, type TerminalTimeframe } from "../lib/visual-terminal.ts";

type MarketChartProps = {
  data: OhlcvPoint[];
  symbol: string;
  loading?: boolean;
  error?: string;
  initialTimeframe?: TerminalTimeframe;
  mode?: ChartDataMode;
};

export function MarketChart({ data, symbol, loading = false, error, initialTimeframe = "15m" }: MarketChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [timeframe, setTimeframe] = useState<TerminalTimeframe>(initialTimeframe);
  const state = chartDisplayState(data, loading, error);
  const chartDescription = state === "ready"
      ? `${symbol} verified candlestick and volume chart on the ${timeframe} timeframe.`
      : `${symbol} chart has no validated candle data to display.`;

  useEffect(() => {
    if (state !== "ready" || !containerRef.current) return;
    let disposed = false;
    let removeChart: () => void = () => undefined;

    void import("lightweight-charts").then(({ CandlestickSeries, ColorType, HistogramSeries, createChart }) => {
      if (disposed || !containerRef.current) return;
      const chart = createChart(containerRef.current, {
        autoSize: true,
        height: 430,
        layout: { background: { type: ColorType.Solid, color: "#080b0f" }, textColor: "#89939f", attributionLogo: true },
        grid: { vertLines: { color: "#171c23" }, horzLines: { color: "#171c23" } },
        crosshair: { vertLine: { color: "#526170" }, horzLine: { color: "#526170" } },
        rightPriceScale: { borderColor: "#252c35" },
        timeScale: { borderColor: "#252c35", timeVisible: true, secondsVisible: timeframe === "1m" },
      });
      const candles = chart.addSeries(CandlestickSeries, {
        upColor: "#35d89b", downColor: "#f06472", borderVisible: false, wickUpColor: "#35d89b", wickDownColor: "#f06472",
      });
      const volume = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "volume" });
      chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
      candles.setData(data.map(({ time, open, high, low, close }) => ({ time: time as UTCTimestamp, open, high, low, close })));
      volume.setData(data.map(({ time, open, close, volume: value }) => ({ time: time as UTCTimestamp, value, color: close >= open ? "#35d89b44" : "#f0647244" })));
      chart.timeScale().fitContent();
      removeChart = () => chart.remove();
    });

    return () => { disposed = true; removeChart(); };
  }, [data, state, timeframe]);

  return (
    <section className="marketChart" aria-label={`${symbol} candlestick chart`} data-chart-state={state}>
      <header className="marketChartHeader">
        <div className="marketChartInstrument"><span>PRIMARY WORKSPACE · VERIFIED OHLCV ONLY</span><strong>{symbol} <i>FUTURES</i></strong><small>{state === "ready" ? `${timeframe} verified candles & volume` : "SESSION STANDBY"}</small></div>
        <div className="timeframeSelector" role="group" aria-label="Chart timeframe">
          {TERMINAL_TIMEFRAMES.map((option) => <button key={option} type="button" aria-pressed={timeframe === option} aria-label={`Show ${option} timeframe`} onClick={() => setTimeframe(option)}>{option}</button>)}
        </div>
      </header>
      <p className="srOnly" id="market-chart-description">{chartDescription}</p>
      {state === "ready" ? <div className="marketChartCanvas" ref={containerRef} role="img" tabIndex={0} aria-describedby="market-chart-description" /> : (
        <div className={`marketChartState marketChartState-${state}`} role={state === "error" ? "alert" : "status"}>
          <div className="marketStandbyLabel"><i /><span>{state === "error" ? "PROVIDER ERROR" : state === "loading" ? "CONNECTING" : "AWAITING VERIFIED HISTORY"}</span></div>
          <Image className="marketStateMark" src="/brand/logo-mark.svg" width={48} height={48} alt="" />
          <span className="marketStateChart" aria-hidden="true" />
          {state === "loading" ? <><i className="chartLoader" /><strong>Connecting to verified market data</strong><span>Waiting for validated OHLCV candles. No values are displayed until verification completes.</span></> : null}
          {state === "error" ? <><strong>Market data provider unavailable</strong><span>{error ?? "OHLCV data failed validation and has not been rendered. Existing NO TRADE safeguards remain active."}</span></> : null}
          {state === "empty" ? <><strong>No verified candle data</strong><span>The chart is in controlled standby until validated OHLCV history is received. This is not live market data; no candles, prices or signals have been invented.</span><div className="marketStandbySteps"><span><b>01</b> Waiting for provider history</span><span><b>02</b> Validate timestamp and OHLCV</span><span><b>03</b> Render only after verification</span></div><small>Safe action: remain NO TRADE and retry the provider when available.</small></> : null}
        </div>
      )}
      <footer>Charts by <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">TradingView</a> · Display only · No order execution</footer>
    </section>
  );
}
