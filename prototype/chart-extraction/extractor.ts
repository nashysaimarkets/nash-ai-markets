import sharp from "sharp";

export type Box = { left: number; top: number; right: number; bottom: number };
export type PriceAnchor = { price: number; y: number };
export type RelativeLevel = { kind: "support" | "resistance" | "pivot"; yPercent: number; strength: number; touches: number; price?: number };

export type Extraction = {
  version: "offline-cv-v1";
  image: { width: number; height: number };
  plot: Box & { confidence: number };
  chartStatus: "chart-detected" | "not-a-chart";
  identity: { instrument?: string; timeframe?: string };
  candles: { count: number; confidence: number; centres: number[] };
  scale: {
    status: "calibrated" | "unverified";
    anchors: PriceAnchor[];
    fitError?: number;
  };
  levels: RelativeLevel[];
  volumeProfile: {
    status: "visible" | "not-detected";
    side?: "left" | "right";
    pointOfControlYPercent?: number;
    confidence: number;
  };
  warnings: string[];
};

type RawImage = { data: Uint8Array; width: number; height: number; channels: number };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const percentile = (values: number[], fraction: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(clamp(fraction, 0, 1) * (sorted.length - 1))];
};

async function load(input: string | Buffer): Promise<RawImage> {
  const result = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: result.data, width: result.info.width, height: result.info.height, channels: result.info.channels };
}

function pixel(image: RawImage, x: number, y: number) {
  const offset = (y * image.width + x) * image.channels;
  const r = image.data[offset] ?? 0;
  const g = image.data[offset + 1] ?? r;
  const b = image.data[offset + 2] ?? r;
  return { r, g, b, light: (r + g + b) / 3, chroma: Math.max(r, g, b) - Math.min(r, g, b) };
}

function locatePlot(image: RawImage): Box & { confidence: number } {
  const rowScores: number[] = [];
  const colScores: number[] = [];
  for (let y = 1; y < image.height - 1; y += 2) {
    let transitions = 0;
    for (let x = 2; x < image.width - 2; x += 3) {
      const a = pixel(image, x - 2, y).light;
      const b = pixel(image, x + 2, y).light;
      if (Math.abs(a - b) > 24) transitions++;
    }
    rowScores.push(transitions);
  }
  for (let x = 1; x < image.width - 1; x += 2) {
    let transitions = 0;
    for (let y = 2; y < image.height - 2; y += 3) {
      const a = pixel(image, x, y - 2).light;
      const b = pixel(image, x, y + 2).light;
      if (Math.abs(a - b) > 24) transitions++;
    }
    colScores.push(transitions);
  }
  const rowGate = percentile(rowScores, 0.58);
  const colGate = percentile(colScores, 0.58);
  const activeRows = rowScores.flatMap((score, i) => score >= rowGate ? [i * 2] : []);
  const activeCols = colScores.flatMap((score, i) => score >= colGate ? [i * 2] : []);
  const fallback: Box = {
    left: Math.round(image.width * 0.04), top: Math.round(image.height * 0.08),
    right: Math.round(image.width * 0.86), bottom: Math.round(image.height * 0.9),
  };
  if (activeRows.length < 8 || activeCols.length < 8) return { ...fallback, confidence: 0.2 };
  return {
    left: clamp(percentile(activeCols, 0.05), 0, image.width - 2),
    top: clamp(percentile(activeRows, 0.05), 0, image.height - 2),
    right: clamp(percentile(activeCols, 0.95), 1, image.width - 1),
    bottom: clamp(percentile(activeRows, 0.95), 1, image.height - 1),
    confidence: 0.55,
  };
}

function candleColumns(image: RawImage, plot: Box) {
  const scores: number[] = [];
  for (let x = plot.left; x <= plot.right; x++) {
    let coloured = 0;
    let verticalRun = 0;
    let bestRun = 0;
    for (let y = plot.top; y <= plot.bottom; y++) {
      const p = pixel(image, x, y);
      const candidate = p.chroma > 38 && (p.r > 85 || p.g > 85 || p.b > 85);
      coloured += candidate ? 1 : 0;
      verticalRun = candidate ? verticalRun + 1 : 0;
      bestRun = Math.max(bestRun, verticalRun);
    }
    scores.push(coloured + bestRun * 1.5);
  }
  const nonZero = scores.filter(Boolean);
  const gate = Math.max(5, percentile(nonZero, 0.5));
  const peaks = scores.flatMap((score, i) => {
    if (score < gate) return [];
    const left = Math.max(0, i - 2);
    const right = Math.min(scores.length - 1, i + 2);
    return score >= Math.max(...scores.slice(left, right + 1)) ? [{ i, score }] : [];
  }).sort((a, b) => b.score - a.score || a.i - b.i);
  const accepted: Array<{ i: number; score: number }> = [];
  const minimumSpacing = Math.max(4, Math.round(image.width * 0.004));
  for (const peak of peaks) {
    if (accepted.every(other => Math.abs(other.i - peak.i) >= minimumSpacing)) accepted.push(peak);
  }
  return accepted.map(peak => plot.left + peak.i).sort((a, b) => a - b);
}

type CandleGeometry = { x: number; highY: number; lowY: number; midpointY: number };

function candleGeometry(image: RawImage, plot: Box, centres: number[]): CandleGeometry[] {
  return centres.flatMap(centre => {
    const activeRows: number[] = [];
    for (let y = plot.top; y <= plot.bottom; y++) {
      let active = false;
      for (let x = Math.max(plot.left, Math.round(centre) - 2); x <= Math.min(plot.right, Math.round(centre) + 2); x++) {
        const p = pixel(image, x, y);
        if (p.chroma > 38 && p.light > 45) { active = true; break; }
      }
      if (active) activeRows.push(y);
    }
    if (activeRows.length < 4) return [];
    let bestStart = activeRows[0], bestEnd = activeRows[0], start = activeRows[0], previous = activeRows[0];
    for (const y of activeRows.slice(1)) {
      if (y - previous > 3) start = y;
      previous = y;
      if (y - start > bestEnd - bestStart) { bestStart = start; bestEnd = y; }
    }
    if (bestEnd - bestStart < 4 || bestEnd - bestStart > (plot.bottom - plot.top) * 0.38) return [];
    return [{ x: centre, highY: bestStart, lowY: bestEnd, midpointY: (bestStart + bestEnd) / 2 }];
  });
}

function relativeLevels(image: RawImage, plot: Box, candles: CandleGeometry[]): RelativeLevel[] {
  if (candles.length < 5) return [];
  const pivots: Array<{ y: number; recency: number }> = [];
  const radius = 2;
  for (let i = radius; i < candles.length - radius; i++) {
    const neighbours = candles.slice(i - radius, i + radius + 1);
    if (candles[i].highY <= Math.min(...neighbours.map(candle => candle.highY))) pivots.push({ y: candles[i].highY, recency: (i + 1) / candles.length });
    if (candles[i].lowY >= Math.max(...neighbours.map(candle => candle.lowY))) pivots.push({ y: candles[i].lowY, recency: (i + 1) / candles.length });
  }
  const typicalRange = percentile(candles.map(candle => candle.lowY - candle.highY), 0.5);
  const tolerance = clamp(typicalRange * 0.45, 4, (plot.bottom - plot.top) * 0.025);
  const clusters: Array<{ ys: number[]; recency: number }> = [];
  for (const pivot of pivots.sort((a, b) => a.y - b.y)) {
    const cluster = clusters.find(candidate => Math.abs(candidate.ys.reduce((s, y) => s + y, 0) / candidate.ys.length - pivot.y) <= tolerance);
    if (cluster) { cluster.ys.push(pivot.y); cluster.recency = Math.max(cluster.recency, pivot.recency); }
    else clusters.push({ ys: [pivot.y], recency: pivot.recency });
  }
  const currentY = candles[candles.length - 1].midpointY;
  const ranked = clusters
    .filter(cluster => cluster.ys.length >= 2)
    .map(cluster => {
      const y = cluster.ys.reduce((s, value) => s + value, 0) / cluster.ys.length;
      const distance = y - currentY;
      return {
        kind: Math.abs(distance) <= tolerance ? "pivot" as const : distance > 0 ? "support" as const : "resistance" as const,
        yPercent: Number((100 * y / image.height).toFixed(2)),
        touches: cluster.ys.length,
        strength: Number(Math.min(1, 0.18 * cluster.ys.length + 0.28 * cluster.recency).toFixed(2)),
      };
    })
    .sort((a, b) => b.strength - a.strength);
  const balanced = [
    ...ranked.filter(level => level.kind === "resistance").slice(0, 2),
    ...ranked.filter(level => level.kind === "support").slice(0, 2),
    ...ranked.filter(level => level.kind === "pivot").slice(0, 1),
  ].sort((a, b) => b.strength - a.strength).slice(0, 4);
  return balanced.sort((a, b) => a.yPercent - b.yPercent);
}

function volumeProfile(image: RawImage, plot: Box) {
  const bandWidth = Math.max(10, Math.round((plot.right - plot.left) * 0.22));
  const inspect = (side: "left" | "right") => {
    const x0 = side === "left" ? plot.left : plot.right - bandWidth;
    const x1 = side === "left" ? plot.left + bandWidth : plot.right;
    const rows: number[] = [];
    for (let y = plot.top; y <= plot.bottom; y++) {
      let run = 0;
      let longestRun = 0;
      for (let x = x0; x <= x1; x++) {
        const p = pixel(image, x, y);
        const active = p.chroma > 24 && p.light > 55;
        run = active ? run + 1 : 0;
        longestRun = Math.max(longestRun, run);
      }
      rows.push(longestRun);
    }
    const peak = Math.max(...rows, 0);
    const denseRows = rows.filter(run => run / bandWidth >= 0.3 && run / bandWidth <= 0.88).length;
    let denseClusters = 0;
    let inCluster = false;
    for (const run of rows) {
      const dense = run / bandWidth >= 0.3 && run / bandWidth <= 0.88;
      if (dense && !inCluster) denseClusters++;
      inCluster = dense;
    }
    return { side, rows, peak, index: rows.indexOf(peak), ratio: peak / bandWidth, denseRows, denseClusters };
  };
  const best = [inspect("left"), inspect("right")].sort((a, b) => b.ratio - a.ratio)[0];
  const height = Math.max(1, plot.bottom - plot.top + 1);
  const profileShape = best.denseRows / height >= 0.025 && best.denseClusters >= 10;
  if (best.ratio < 0.48 || !profileShape) return { status: "not-detected" as const, confidence: Number(Math.min(0.8, 1 - best.ratio).toFixed(2)) };
  return {
    status: "visible" as const, side: best.side,
    pointOfControlYPercent: Number((100 * (plot.top + best.index) / image.height).toFixed(2)),
    confidence: Number(Math.min(0.95, best.ratio).toFixed(2)),
  };
}

export function calibrateScale(anchors: PriceAnchor[], height: number) {
  const clean = anchors.filter(a => Number.isFinite(a.price) && Number.isFinite(a.y) && a.y >= 0 && a.y <= height);
  if (clean.length < 2) return { status: "unverified" as const, anchors: clean };
  const sorted = [...clean].sort((a, b) => a.y - b.y);
  if (!sorted.every((a, i) => i === 0 || a.price < sorted[i - 1].price)) return { status: "unverified" as const, anchors: clean };
  const meanY = sorted.reduce((s, a) => s + a.y, 0) / sorted.length;
  const meanP = sorted.reduce((s, a) => s + a.price, 0) / sorted.length;
  const variance = sorted.reduce((s, a) => s + (a.y - meanY) ** 2, 0);
  if (!variance) return { status: "unverified" as const, anchors: clean };
  const slope = sorted.reduce((s, a) => s + (a.y - meanY) * (a.price - meanP), 0) / variance;
  const intercept = meanP - slope * meanY;
  const range = Math.max(...sorted.map(a => a.price)) - Math.min(...sorted.map(a => a.price));
  const rmse = Math.sqrt(sorted.reduce((s, a) => s + (a.price - (intercept + slope * a.y)) ** 2, 0) / sorted.length);
  if (slope >= 0 || range <= 0 || rmse / range > 0.025) return { status: "unverified" as const, anchors: clean };
  return { status: "calibrated" as const, anchors: sorted, fitError: Number((rmse / range).toFixed(5)), slope, intercept };
}

export async function extractChart(
  input: string | Buffer,
  anchors: PriceAnchor[] = [],
  identity: { instrument?: string; timeframe?: string } = {},
  volumeCue: { visibleCue?: boolean; pointOfControlYPercent?: number } = {},
): Promise<Extraction> {
  const image = await load(input);
  const plot = locatePlot(image);
  const scaleFit = calibrateScale(anchors, image.height);
  const plotAspect = (plot.right - plot.left) / Math.max(1, plot.bottom - plot.top);
  // Portrait broker captures contain a wide chart panel inside a taller phone
  // screenshot. Reject narrow form/card layouts, but retain those chart panels.
  const chartDetected = plotAspect >= 0.45 && plot.confidence >= 0.45;
  const scaleYs = scaleFit.anchors.map(anchor => anchor.y);
  const typicalGap = scaleYs.length >= 2
    ? percentile(scaleYs.slice(1).map((y, i) => Math.abs(y - scaleYs[i])), 0.5)
    : 0;
  const analysisPlot = scaleFit.status === "calibrated" ? {
    ...plot,
    top: Math.max(plot.top, Math.round(Math.min(...scaleYs) - typicalGap)),
    bottom: Math.min(plot.bottom, Math.round(Math.max(...scaleYs) + typicalGap)),
  } : plot;
  const centres = chartDetected ? candleColumns(image, analysisPlot) : [];
  const geometries = chartDetected ? candleGeometry(image, analysisPlot, centres) : [];
  const levels = (chartDetected ? relativeLevels(image, analysisPlot, geometries) : []).map(level => scaleFit.status === "calibrated"
    ? { ...level, price: Number((scaleFit.intercept + scaleFit.slope * image.height * level.yPercent / 100).toPrecision(8)) }
    : level);
  const warnings: string[] = [];
  if (!chartDetected) warnings.push("No chart-like plot region passed the geometry gate.");
  if (scaleFit.status !== "calibrated") warnings.push("Exact prices withheld: no validated multi-anchor price scale.");
  if (centres.length < 8) warnings.push("Candle extraction confidence is too low for pattern claims.");
  const measuredVolume = chartDetected ? volumeProfile(image, analysisPlot) : { status: "not-detected" as const, confidence: 0.95 };
  const resolvedVolume = volumeCue.visibleCue ? {
    status: "visible" as const,
    confidence: 0.95,
    ...(volumeCue.pointOfControlYPercent !== undefined ? { pointOfControlYPercent: volumeCue.pointOfControlYPercent } : {}),
  } : measuredVolume;
  return {
    version: "offline-cv-v1", image: { width: image.width, height: image.height }, plot: analysisPlot,
    chartStatus: chartDetected ? "chart-detected" : "not-a-chart", identity,
    candles: { count: geometries.length, confidence: Number(Math.min(0.95, geometries.length / 30).toFixed(2)), centres: geometries.map(candle => Number((100 * candle.x / image.width).toFixed(2))) },
    scale: { status: scaleFit.status, anchors: scaleFit.anchors, ...(scaleFit.status === "calibrated" ? { fitError: scaleFit.fitError } : {}) },
    levels, volumeProfile: resolvedVolume, warnings,
  };
}
