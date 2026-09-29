import type { Analysis } from "./analysis-types";
import type { UploadedChart } from "./chart-session";

/** Fictional, deterministic OHLC data. These illustrations never call an AI API. */
export function createSampleCharts(): UploadedChart[] {
  return ["5M", "30M", "1H", "4H", "1D"].map((timeframe, frameIndex) => {
    const direction = frameIndex < 2 ? "BULLISH" : frameIndex < 4 ? "BEARISH" : "NEUTRAL";
    const slope = direction === "BULLISH" ? .55 : direction === "BEARISH" ? -.5 : .04;
    const candles = Array.from({ length: 28 }, (_, i) => {
      const open = 115 + (i - 14) * slope + Math.sin(i * .8) * 2;
      const close = open + Math.cos(i * .6) * 1.3 + slope;
      return { open, close, high: Math.max(open, close) + 1.1, low: Math.min(open, close) - 1.1 };
    });
    const offset = 120 - candles.at(-1)!.close;
    candles.forEach((c) => { c.open += offset; c.close += offset; c.high += offset; c.low += offset; });
    const low = Math.floor(Math.min(...candles.map((c) => c.low)));
    const high = Math.ceil(Math.max(...candles.map((c) => c.high)));
    const current = candles.at(-1)!.close.toFixed(2);
    const y = (price: number) => 85 - (price - (low - 3)) / (high - low + 6) * 65;
    const bounds = { left: 8, top: 20, right: 85, bottom: 85 };
    const anchors = [low - 3, (low + high) / 2, high + 3].map((price) => ({ price, y: y(price) }));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480"><rect width="640" height="480" fill="#0c1720"/><text x="35" y="32" font-size="20" fill="#ffe1a0">FICTIONAL SAMPLE · DEMO INDEX · ${timeframe}</text>${anchors.map((p) => `<line x1="50" x2="540" y1="${p.y * 4.8}" y2="${p.y * 4.8}" stroke="#293947"/><text x="548" y="${p.y * 4.8 + 5}" fill="#a9becb" font-size="15">${p.price.toFixed(2)}</text>`).join("")}${candles.map((c, i) => { const x = 65 + i * 17; const color = c.close >= c.open ? "#63dba1" : "#f27783"; return `<line x1="${x}" x2="${x}" y1="${y(c.high) * 4.8}" y2="${y(c.low) * 4.8}" stroke="${color}" stroke-width="2"/><rect x="${x - 5}" y="${Math.min(y(c.open), y(c.close)) * 4.8}" width="10" height="${Math.max(2, Math.abs(y(c.open) - y(c.close)) * 4.8)}" fill="${color}"/>`; }).join("")}<text x="36" y="450" fill="#a9becb" font-size="16">Illustration only · No live prices or trading signal</text></svg>`;
    const report: Analysis = {
      direction, confidence: "MEDIUM", instrument: "DEMO INDEX", ticker: "UNKNOWN", timeframe,
      evidenceQuality: { chartReadability: "CLEAR", instrumentConfidence: "HIGH", timeframeConfidence: "HIGH", scaleReadable: true, candlesReadable: true, limitations: ["Fictional sample data, not an AI scan or a live market."] },
      observableFacts: [direction === "BULLISH" ? "The sample candles broadly rise from left to right." : direction === "BEARISH" ? "The sample candles broadly fall from left to right." : "The sample candles stay within a relatively narrow band."],
      contradictions: ["Different sample timeframes show different directions."],
      higherTimeframe: { provided: true, timeframe: "1D", direction: "NEUTRAL", alignment: "MIXED", summary: "The fictional daily view is broadly sideways; shorter views move in different directions." },
      patterns: [], nextSequence: { now: "Read the selected sample timeframe.", confirmation: "A future close and hold beyond the range would add evidence; it is not shown.", failure: "A break of the opposing boundary would challenge the directional interpretation.", patience: "Wait for visible confirmation.", reassess: "Upload a later screenshot to check what changed." },
      missingInputs: ["No real market or execution data is attached."],
      summary: `This fictional ${timeframe} chart illustrates a ${direction.toLowerCase()} reading. Switch timeframe to see the entire report change.`,
      verdict: "WAIT", verdictHeadline: "Sample analysis — wait for confirmation",
      setupScore: { overall: 55, grade: "C", structure: 12, momentum: 6, location: 10, confirmation: 8, riskClarity: 14, eventSafety: 5 },
      whatYouMayBeMissing: ["A rising short view can coexist with a falling wider view."], improvesSetup: ["Visible confirmation at the relevant boundary."], killsSetup: ["A confirmed move through opposing structure."],
      traderTrap: "Treating one timeframe as the whole market picture.", bullishCase: "A confirmed hold above the upper boundary would support a bullish scenario.", bearishCase: "A confirmed hold below the lower boundary would support a bearish scenario.", invalidation: "Verify an opposing boundary break on a later chart.",
      marketStructure: direction === "BULLISH" ? "The fictional chart has a broad higher high and higher low sequence." : direction === "BEARISH" ? "The fictional chart has a broad lower high and lower low sequence." : "The fictional chart shows sideways structure.",
      levelStory: "These illustrative boundaries are calculated directly from the sample candles.", momentum: `${direction === "NEUTRAL" ? "Mixed" : direction === "BULLISH" ? "Upward" : "Downward"} price movement in this sample. No RSI or MACD panel is supplied.`,
      bullConfirmation: "Close and hold beyond the upper boundary.", bearConfirmation: "Close and hold beyond the lower boundary.", noTradeCondition: "This is an educational sample, not a tradeable instrument.", riskFlags: ["FICTIONAL SAMPLE"], indicators: [], checklist: ["Check instrument and timeframe.", "Check the source candles.", "Wait for visible confirmation."], relevantEventTypes: [],
      currentPrice: current, plotBounds: bounds, priceScaleAnchors: anchors,
      levels: [{ kind: "support", label: "Sample lower boundary", price: String(low), x: 10, x2: 82, y: y(low), y2: y(low), source: "PRIMARY" }, { kind: "resistance", label: "Sample upper boundary", price: String(high), x: 10, x2: 82, y: y(high), y2: y(high), source: "PRIMARY" }],
      fibLevels: [], liquidityShield: { status: "NO_VISIBLE_RISK_ZONES", summary: "No repeated stop-risk cluster is established in these fictional candles.", stopGuidance: "Read the chart's structure before considering any risk plan.", zones: [] },
      trustGate: { status: "LOCKED", chartLocked: true, identityLocked: true, scaleLocked: true, exactLevelCount: 2, reasons: ["Known fictional sample data."], nextAction: "Try your own chart for a real analysis." },
    };
    return { id: `sample-${frameIndex}`, image: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, name: `Fictional ${timeframe} sample`, timeframe, report };
  });
}
