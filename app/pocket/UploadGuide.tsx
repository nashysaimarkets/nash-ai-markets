"use client";
import { useState } from "react";
import { normalizePatternFrame } from "./chart-images";

export const uploadPresets = {
  custom: { label: "MY OWN", main: "Your trading timeframe", context: "A higher timeframe", wider: "A wider view, if useful", frames: [] },
  scalp: { label: "SCALPING", main: "5-minute", context: "1-hour", wider: "15 or 30-minute", frames: ["5M"] },
  intraday: { label: "INTRADAY", main: "15 or 30-minute", context: "1-hour", wider: "4-hour", frames: ["15M", "30M"] },
  swing: { label: "SWING", main: "4-hour", context: "Daily", wider: "Weekly", frames: ["4H"] },
} as const;

export default function UploadGuide({ detected }: { detected?: string }) {
  const [style, setStyle] = useState<keyof typeof uploadPresets>("custom");
  const preset = uploadPresets[style];
  const frame = normalizePatternFrame(detected);
  const different = frame && preset.frames.length && !(preset.frames as readonly string[]).includes(frame);
  return <section className="psUploadGuide" aria-label="Choose charts for your trading style">
    <header><strong>CHOOSE YOUR CHARTS</strong><span>One clear chart is enough</span></header>
    <nav aria-label="Trading style">{Object.entries(uploadPresets).map(([key, value]) => <button type="button" key={key} aria-pressed={style === key} onClick={() => setStyle(key as keyof typeof uploadPresets)}>{value.label}</button>)}</nav>
    <ol><li><b>MAIN CHART</b><span>{preset.main}</span></li><li><b>RECOMMENDED CONTEXT</b><span>{preset.context}</span></li><li><b>OPTIONAL EXTRA</b><span>{preset.wider}</span></li></ol>
    {different ? <p role="status">Your uploaded main chart reads {frame}. We will analyse that actual timeframe; these suggestions are optional.</p> : null}
    <p>Use the same instrument and take the screenshots together. Keep the symbol, timeframe, price scale and candle bodies visible.</p>
    <details><summary>Which indicators should I include?</summary><p>For momentum, optionally include RSI with its settings visible. Keep any moving-average names and periods readable. A clean price chart is still valid.</p><p>For Volume Profile, include the horizontal profile and readable POC / VAH / VAL labels if available. Ordinary volume bars do not show volume by price. Tick volume is not exchange-traded volume.</p><p>Add a close-up only when the price scale is hard to read. Extra pictures should add evidence; you do not need to fill all five spaces.</p></details>
  </section>;
}
