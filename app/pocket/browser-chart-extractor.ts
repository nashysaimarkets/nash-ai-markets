"use client";

import type { ChartEvidenceRole, DeterministicChartEvidence } from "../lib/deterministic-chart-evidence";

type PixelImage = { data: Uint8ClampedArray; width: number; height: number };
type Box = { left: number; top: number; right: number; bottom: number };
type Candle = { x: number; highY: number; lowY: number; midpointY: number };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const percentile = (values: number[], fraction: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(clamp(fraction, 0, 1) * (sorted.length - 1))] ?? 0;
};
const pixel = (image: PixelImage, x: number, y: number) => {
  const offset = (y * image.width + x) * 4;
  const r = image.data[offset] ?? 0, g = image.data[offset + 1] ?? r, b = image.data[offset + 2] ?? r;
  return { light: (r + g + b) / 3, chroma: Math.max(r, g, b) - Math.min(r, g, b) };
};

async function decode(dataUrl: string): Promise<PixelImage> {
  const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
  const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale)), height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Chart measurement is unavailable in this browser.");
  context.drawImage(bitmap, 0, 0, width, height); bitmap.close();
  return { data: context.getImageData(0, 0, width, height).data, width, height };
}

function locatePlot(image: PixelImage) {
  const rowScores: number[] = [], colScores: number[] = [];
  for (let y = 1; y < image.height - 1; y += 2) { let transitions = 0; for (let x = 2; x < image.width - 2; x += 3) if (Math.abs(pixel(image, x - 2, y).light - pixel(image, x + 2, y).light) > 24) transitions++; rowScores.push(transitions); }
  for (let x = 1; x < image.width - 1; x += 2) { let transitions = 0; for (let y = 2; y < image.height - 2; y += 3) if (Math.abs(pixel(image, x, y - 2).light - pixel(image, x, y + 2).light) > 24) transitions++; colScores.push(transitions); }
  const activeRows = rowScores.flatMap((score, index) => score >= percentile(rowScores, .58) ? [index * 2] : []);
  const activeCols = colScores.flatMap((score, index) => score >= percentile(colScores, .58) ? [index * 2] : []);
  if (activeRows.length < 8 || activeCols.length < 8) return { left: image.width * .04, top: image.height * .08, right: image.width * .86, bottom: image.height * .9, confidence: .2 };
  return { left: percentile(activeCols, .05), top: percentile(activeRows, .05), right: percentile(activeCols, .95), bottom: percentile(activeRows, .95), confidence: .55 };
}

function candles(image: PixelImage, plot: Box) {
  const scores: number[] = [];
  for (let x = plot.left; x <= plot.right; x++) { let coloured = 0, run = 0, best = 0; for (let y = plot.top; y <= plot.bottom; y++) { const p = pixel(image, x, y); const active = p.chroma > 38 && p.light > 45; coloured += active ? 1 : 0; run = active ? run + 1 : 0; best = Math.max(best, run); } scores.push(coloured + best * 1.5); }
  const gate = Math.max(5, percentile(scores.filter(Boolean), .5));
  const peaks = scores.flatMap((score, index) => score >= gate && score >= Math.max(...scores.slice(Math.max(0, index - 2), index + 3)) ? [{ index, score }] : []).sort((a, b) => b.score - a.score);
  const accepted: typeof peaks = [], spacing = Math.max(4, Math.round(image.width * .004));
  for (const peak of peaks) if (accepted.every((other) => Math.abs(other.index - peak.index) >= spacing)) accepted.push(peak);
  return accepted.map((peak) => plot.left + peak.index).sort((a, b) => a - b).flatMap((centre): Candle[] => {
    const rows: number[] = [];
    for (let y = plot.top; y <= plot.bottom; y++) for (let x = Math.max(plot.left, centre - 2); x <= Math.min(plot.right, centre + 2); x++) { const p = pixel(image, x, y); if (p.chroma > 38 && p.light > 45) { rows.push(y); break; } }
    if (rows.length < 4) return [];
    let bestStart = rows[0]!, bestEnd = rows[0]!, start = rows[0]!, previous = rows[0]!;
    for (const y of rows.slice(1)) { if (y - previous > 3) start = y; previous = y; if (y - start > bestEnd - bestStart) { bestStart = start; bestEnd = y; } }
    return bestEnd - bestStart >= 4 && bestEnd - bestStart <= (plot.bottom - plot.top) * .38 ? [{ x: centre, highY: bestStart, lowY: bestEnd, midpointY: (bestStart + bestEnd) / 2 }] : [];
  });
}

function levels(image: PixelImage, plot: Box, items: Candle[]) {
  if (items.length < 5) return [];
  const pivots: Array<{ y: number; recency: number }> = [];
  for (let i = 2; i < items.length - 2; i++) { const neighbours = items.slice(i - 2, i + 3); if (items[i]!.highY <= Math.min(...neighbours.map((c) => c.highY))) pivots.push({ y: items[i]!.highY, recency: (i + 1) / items.length }); if (items[i]!.lowY >= Math.max(...neighbours.map((c) => c.lowY))) pivots.push({ y: items[i]!.lowY, recency: (i + 1) / items.length }); }
  const tolerance = clamp(percentile(items.map((c) => c.lowY - c.highY), .5) * .45, 4, (plot.bottom - plot.top) * .025);
  const clusters: Array<{ ys: number[]; recency: number }> = [];
  for (const pivot of pivots.sort((a, b) => a.y - b.y)) { const cluster = clusters.find((candidate) => Math.abs(candidate.ys.reduce((sum, y) => sum + y, 0) / candidate.ys.length - pivot.y) <= tolerance); if (cluster) { cluster.ys.push(pivot.y); cluster.recency = Math.max(cluster.recency, pivot.recency); } else clusters.push({ ys: [pivot.y], recency: pivot.recency }); }
  const currentY = items.at(-1)!.midpointY;
  const ranked = clusters.filter((cluster) => cluster.ys.length >= 2).map((cluster) => { const y = cluster.ys.reduce((sum, value) => sum + value, 0) / cluster.ys.length; const distance = y - currentY; return { kind: Math.abs(distance) <= tolerance ? "pivot" as const : distance > 0 ? "support" as const : "resistance" as const, y: Number((100 * y / image.height).toFixed(2)), touches: cluster.ys.length, strength: Number(Math.min(1, .18 * cluster.ys.length + .28 * cluster.recency).toFixed(2)) }; }).sort((a, b) => b.strength - a.strength);
  return [...ranked.filter((l) => l.kind === "resistance").slice(0, 2), ...ranked.filter((l) => l.kind === "support").slice(0, 2), ...ranked.filter((l) => l.kind === "pivot").slice(0, 1)].sort((a, b) => b.strength - a.strength).slice(0, 4);
}

function profile(image: PixelImage, plot: Box, role: ChartEvidenceRole) {
  const bandWidth = Math.max(10, Math.round((plot.right - plot.left) * .22));
  const inspect = (side: "left" | "right") => { const x0 = side === "left" ? plot.left : plot.right - bandWidth, x1 = side === "left" ? plot.left + bandWidth : plot.right, rows: number[] = []; for (let y = plot.top; y <= plot.bottom; y++) { let run = 0, longest = 0; for (let x = x0; x <= x1; x++) { const p = pixel(image, x, y); const active = p.chroma > 24 && p.light > 55; run = active ? run + 1 : 0; longest = Math.max(longest, run); } rows.push(longest); } const peak = Math.max(...rows, 0), denseRows = rows.filter((run) => run / bandWidth >= .3 && run / bandWidth <= .88).length; let clusters = 0, active = false; for (const run of rows) { const dense = run / bandWidth >= .3 && run / bandWidth <= .88; if (dense && !active) clusters++; active = dense; } return { side, rows, peak, index: rows.indexOf(peak), ratio: peak / bandWidth, denseRows, clusters }; };
  const best = [inspect("left"), inspect("right")].sort((a, b) => b.ratio - a.ratio)[0]!;
  const sideVisible = best.ratio >= .48 && best.denseRows / Math.max(1, plot.bottom - plot.top + 1) >= .025 && best.clusters >= 10;
  // The dedicated indicator/volume slot may contain profiles drawn through
  // the middle of the plot (session profiles), not only on an outer edge.
  // Scan for many thick horizontal histogram rows. Sparse order lines and
  // ordinary vertical volume bars cannot pass the row-density requirement.
  const width = Math.max(1, plot.right - plot.left + 1), rowRuns: number[] = [];
  for (let y = plot.top; y <= plot.bottom; y++) {
    let run = 0, longest = 0;
    for (let x = plot.left; x <= plot.right; x++) {
      const p = pixel(image, x, y);
      const active = p.chroma > 28 && p.light > 48;
      run = active ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
    rowRuns.push(longest);
  }
  const histogramRows = rowRuns.filter((run) => run / width >= .075 && run / width <= .78).length;
  const fullPlotVisible = role === "INDICATOR_VOLUME" && histogramRows / Math.max(1, rowRuns.length) >= .055;
  // Primary charts require the stricter edge shape. Dedicated indicator
  // images may use either edge or session-profile geometry.
  if (!(role === "INDICATOR_VOLUME" ? sideVisible || fullPlotVisible : sideVisible && histogramRows / Math.max(1, rowRuns.length) >= .055)) {
    return { status: "not-detected" as const, confidence: Number(Math.min(.8, 1 - best.ratio).toFixed(2)) };
  }
  const index = fullPlotVisible ? rowRuns.indexOf(Math.max(...rowRuns)) : best.index;
  return { status: "visible" as const, side: best.side, pointOfControlY: Number((100 * (plot.top + index) / image.height).toFixed(2)), confidence: Number(Math.min(.95, Math.max(best.ratio, histogramRows / Math.max(1, rowRuns.length))).toFixed(2)) };
}

export function measureChartPixels(image: PixelImage, role: ChartEvidenceRole): DeterministicChartEvidence {
  const located = locatePlot(image);
  const plot = { left: Math.round(located.left), top: Math.round(located.top), right: Math.round(located.right), bottom: Math.round(located.bottom) };
  const chartDetected = (plot.right - plot.left) / Math.max(1, plot.bottom - plot.top) >= .45 && located.confidence >= .45;
  const found = chartDetected ? candles(image, plot) : [];
  return { version: "pocket-cv-v1", role, image: { width: image.width, height: image.height }, chartStatus: chartDetected ? "chart-detected" : "not-a-chart", plot: { left: Number((100 * plot.left / image.width).toFixed(2)), top: Number((100 * plot.top / image.height).toFixed(2)), right: Number((100 * plot.right / image.width).toFixed(2)), bottom: Number((100 * plot.bottom / image.height).toFixed(2)), confidence: located.confidence }, candles: { count: found.length, confidence: Number(Math.min(.95, found.length / 30).toFixed(2)), centres: found.map((c) => Number((100 * c.x / image.width).toFixed(2))) }, levels: levels(image, plot, found), volumeProfile: chartDetected ? profile(image, plot, role) : { status: "not-detected", confidence: .95 }, warnings: [...(!chartDetected ? ["No chart-like plot region passed the geometry gate."] : []), ...(found.length < 8 ? ["Candle extraction confidence is too low for pattern claims."] : []), "Exact prices require a validated visible price scale."] };
}

export async function measureChart(dataUrl: string, role: ChartEvidenceRole): Promise<DeterministicChartEvidence> {
  return measureChartPixels(await decode(dataUrl), role);
}
