import { chartGridRows } from "./chart-grid-rows.ts";
import { readCandlePixels, type PixelCandle } from "./candle-pixels.ts";

export type PlotRaster = { width: number; height: number; data: Uint8ClampedArray };
export type PixelRectangle = { left: number; top: number; right: number; bottom: number };
/** Original pixels only; recovery abstains rather than resizing a larger image. */
export const MAX_IMAGE_PLOT_PIXELS = 4_000_000;
const MAX_CANDLE_WITNESSES = 256;
const MAX_COLOURED_COMPONENTS = 1024;
const MAX_FLAT_BAR_COMPONENTS = 128;
export type ImagePlotRegion = {
  status: "measured";
  width: number;
  height: number;
  plotPixels: PixelRectangle;
  plotPercent: PixelRectangle;
  gridRowPixels: number[];
  /** Observed text column only. Numeric OCR and price-scale validity remain unverified. */
  axisLabelRegionPixels: PixelRectangle & { side: "left" | "right"; matchedGridRows: number[] };
  evidence: { gridRows: number; candles: number; candleSpanPixels: number; borderEdges: 4; coherentPricePanels: 1; axisTextColumns: 1 };
} | {
  status: "held";
  reason: "INVALID_RASTER" | "RASTER_TOO_COMPLEX" | "NO_COHERENT_GRID_RECTANGLE" |
    "INSUFFICIENT_CANDLE_EVIDENCE" | "AMBIGUOUS_PRICE_PANELS" | "AXIS_TEXT_UNRESOLVED" | "AMBIGUOUS_AXIS_COLUMNS";
};
type Run = { first: number; last: number; count: number };
type GridBand = { left: number; right: number; y: number };
type Edge = { x: number; top: number; bottom: number };
type Glyph = PixelRectangle & { count: number };

const median = (values: number[]) => {
  const a = [...values].sort((x, y) => x - y), m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
function runs(points: number[], maximumGap: number, minimumSpan: number, minimumCoverage: number) {
  const result: Run[] = [];
  let run: Run | null = null;
  const finish = () => {
    if (run && run.last - run.first + 1 >= minimumSpan && run.count / (run.last - run.first + 1) >= minimumCoverage) result.push(run);
  };
  for (const point of points) {
    if (!run || point - run.last - 1 > maximumGap) {
      finish(); run = { first: point, last: point, count: 1 };
    } else { run.last = point; run.count++; }
  }
  finish(); return result;
}
const percent = (p: PixelRectangle, width: number, height: number): PixelRectangle => ({
  left: p.left / width * 100, right: p.right / width * 100,
  top: p.top / height * 100, bottom: p.bottom / height * 100,
});

/** Find a bounded class of original-image layouts without a model ROI.
 * Requires a visible rectangular grid, corroborating candle pixels and one
 * adjacent text column. Borderless, unsupported or ambiguous layouts abstain.
 * It supplies no prices, scale type, semantic levels or accuracy certificate.
 */
export function detectImagePlotRegion(raster: PlotRaster): ImagePlotRegion {
  const hold = (reason: Extract<ImagePlotRegion, { status: "held" }>["reason"]): ImagePlotRegion => ({ status: "held", reason });
  const { width, height, data } = raster;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 128 || height < 128 ||
    width > 4096 || height > 4096 || !(data instanceof Uint8ClampedArray) || data.length !== width * height * 4) return hold("INVALID_RASTER");
  if (width * height > MAX_IMAGE_PLOT_PIXELS) return hold("RASTER_TOO_COMPLEX");
  const tones = new Uint16Array(width * height);
  for (let i = 0; i < tones.length; i++) {
    const p = i * 4;
    tones[i] = data[p + 3] >= 240 ? Math.round((data[p] + data[p + 1] + data[p + 2]) / 3) : 65535;
  }
  const rule = (x: number, y: number, vertical: boolean) => {
    const i = y * width + x, p = i * 4, before = tones[i - (vertical ? 4 : width * 4)], after = tones[i + (vertical ? 4 : width * 4)];
    const valid = tones[i] !== 65535 && before !== 65535 && after !== 65535 &&
      Math.max(data[p], data[p + 1], data[p + 2]) - Math.min(data[p], data[p + 1], data[p + 2]) <= 48 &&
      Math.abs(before - after) <= 8;
    const contrast = valid ? Math.abs(tones[i] - (before + after) / 2) : 0;
    return contrast >= 10 ? contrast : 0;
  };
  const horizontal: { left: number; right: number; y: number }[] = [];
  const minimumWidth = Math.max(96, width * .2), minimumHeight = Math.max(80, height * .15);
  for (let y = 4; y < height - 4; y++) {
    // Nearby high-contrast text must not extend a softer grid rule. Overlapping
    // contrast bands preserve ordinary antialiasing without assuming a theme.
    const bands: number[][] = [[], [], []], limits = [[10, 48], [32, 128], [96, 256]];
    for (let x = 4; x < width - 4; x++) {
      const contrast = rule(x, y, false);
      for (let i = 0; i < limits.length; i++) if (contrast >= limits[i][0] && contrast <= limits[i][1]) bands[i].push(x);
    }
    for (const active of bands) for (const r of runs(active, Math.max(6, Math.ceil(width * .025)), minimumWidth, .6)) {
      if (!horizontal.some(v => v.y === y && v.left === r.first && v.right === r.last)) horizontal.push({ left: r.first, right: r.last, y });
    }
    if (horizontal.length > 2048) return hold("RASTER_TOO_COMPLEX");
  }
  // A multi-pixel stroke is one measured row. Do not treat its edges as two ticks.
  const strokes: { left: number[]; right: number[]; rows: number[] }[] = [];
  for (const r of horizontal) {
    const prior = strokes.find(s => r.y - s.rows.at(-1)! === 1 && Math.abs(median(s.left) - r.left) <= 3 && Math.abs(median(s.right) - r.right) <= 3);
    if (prior) { prior.left.push(r.left); prior.right.push(r.right); prior.rows.push(r.y); }
    else strokes.push({ left: [r.left], right: [r.right], rows: [r.y] });
  }
  const bands: GridBand[] = strokes.filter(s => s.rows.length <= 5).map(s => ({ left: median(s.left), right: median(s.right), y: median(s.rows) }));
  const groups: GridBand[][] = [];
  for (const b of bands) {
    const group = groups.find(g => Math.abs(median(g.map(v => v.left)) - b.left) <= 4 && Math.abs(median(g.map(v => v.right)) - b.right) <= 4);
    if (group) group.push(b); else groups.push([b]);
  }
  const rectangles: PixelRectangle[] = [];
  function edges(around: number, rows: number[]): Edge[] {
    const found: Edge[] = [];
    for (let x = Math.max(4, Math.floor(around) - 5); x <= Math.min(width - 5, Math.ceil(around) + 5); x++) {
      const active: number[] = [];
      for (let y = 4; y < height - 4; y++) if (rule(x, y, true)) active.push(y);
      for (const r of runs(active, 5, minimumHeight, .94)) {
        const first = rows.reduce((best, y) => Math.abs(y - r.first) < Math.abs(best - r.first) ? y : best, rows[0]);
        const last = rows.reduce((best, y) => Math.abs(y - r.last) < Math.abs(best - r.last) ? y : best, rows[0]);
        if (Math.abs(first - r.first) <= 6 && Math.abs(last - r.last) <= 6 && last - first >= minimumHeight) found.push({ x, top: first, bottom: last });
      }
    }
    const grouped: Edge[][] = [];
    for (const e of found) {
      const g = grouped.find(a => Math.abs(a.at(-1)!.x - e.x) <= 1 && a[0].top === e.top && a[0].bottom === e.bottom);
      if (g) g.push(e); else grouped.push([e]);
    }
    return grouped.filter(g => g.length <= 5).map(g => ({ x: median(g.map(e => e.x)), top: g[0].top, bottom: g[0].bottom }));
  }
  for (const group of groups) {
    if (group.length < 4) continue;
    const rows = [...new Set(group.map(g => g.y))].sort((a, b) => a - b);
    if (rows.length < 4) continue;
    const leftEdges = edges(median(group.map(g => g.left)), rows), rightEdges = edges(median(group.map(g => g.right)), rows);
    for (const left of leftEdges) for (const right of rightEdges) {
      if (right.x - left.x < minimumWidth || left.top !== right.top || left.bottom !== right.bottom) continue;
      const p = { left: left.x, right: right.x, top: left.top, bottom: left.bottom };
      if (!rectangles.some(r => r.left === p.left && r.right === p.right && r.top === p.top && r.bottom === p.bottom)) rectangles.push(p);
    }
    if (rectangles.length > 24) return hold("RASTER_TOO_COMPLEX");
  }
  if (!rectangles.length) return hold("NO_COHERENT_GRID_RECTANGLE");
  const coherent: { plot: PixelRectangle; rows: number[]; candles: number; span: number }[] = [];
  let verifiedGrids = 0;
  for (const plot of rectangles) {
    const bounds = percent(plot, width, height);
    const rows = chartGridRows(raster, bounds).map(y => y * height / 100).filter(y => y >= plot.top - 1 && y <= plot.bottom + 1);
    if (rows.length < 4 || Math.abs(rows[0] - plot.top) > 1 || Math.abs(rows.at(-1)! - plot.bottom) > 1) continue;
    const steps = rows.slice(1).map((y, i) => y - rows[i]), pitch = median(steps);
    if (pitch < 12 || steps.some(step => Math.abs(step - pitch) > Math.max(2, pitch * .035))) continue;
    // A stable blank gutter splitting all grid rules is not a single price plot.
    let blank = 0, split = false;
    for (let x = Math.ceil(plot.left) + 5; x < Math.floor(plot.right) - 5; x++) {
      const absent = rows.slice(1, -1).filter(y => !rule(x, Math.round(y), false)).length;
      blank = absent === rows.length - 2 ? blank + 1 : 0;
      if (blank >= Math.max(6, Math.floor(width * .006))) { split = true; break; }
    }
    if (split) continue;
    verifiedGrids++;
    const pixels = readCandlePixels(raster, bounds), candles = pixels?.candles ?? [];
    if (candles.length > MAX_CANDLE_WITNESSES) return hold("RASTER_TOO_COMPLEX");
    if (candles.length < 6) continue;
    const span = Math.max(...candles.map(c => c.x)) - Math.min(...candles.map(c => c.x));
    const verticalSpan = Math.max(...candles.map(c => c.lowY)) - Math.min(...candles.map(c => c.highY));
    if (span < (plot.right - plot.left) * .55 || verticalSpan < (plot.bottom - plot.top) * .25) continue;
    // Touching panels can share both side borders and a regular grid. Candle
    // count in that outer rectangle cannot establish one price panel. Retain
    // evidence the candle reader deliberately filters (common-baseline bars),
    // and abstain on repeated series rather than choosing a guessed divider.
    if (hasStackedPriceSeries(candles, rows, plot)) return hold("AMBIGUOUS_PRICE_PANELS");
    const histogram = commonBaselineBars(raster, plot);
    if (histogram === "complex") return hold("RASTER_TOO_COMPLEX");
    if (histogram === "present") return hold("AMBIGUOUS_PRICE_PANELS");
    coherent.push({ plot, rows, candles: candles.length, span });
  }
  if (!coherent.length) return hold(verifiedGrids ? "INSUFFICIENT_CANDLE_EVIDENCE" : "NO_COHERENT_GRID_RECTANGLE");
  if (coherent.length !== 1) return hold("AMBIGUOUS_PRICE_PANELS");
  const chosen = coherent[0];
  const axes = axisTextColumns(raster, tones, chosen.plot, chosen.rows);
  if (!axes.length) return hold("AXIS_TEXT_UNRESOLVED");
  if (axes.length !== 1) return hold("AMBIGUOUS_AXIS_COLUMNS");
  return { status: "measured", width, height, plotPixels: chosen.plot, plotPercent: percent(chosen.plot, width, height),
    gridRowPixels: chosen.rows, axisLabelRegionPixels: axes[0],
    evidence: { gridRows: chosen.rows.length, candles: chosen.candles, candleSpanPixels: chosen.span, borderEdges: 4, coherentPricePanels: 1, axisTextColumns: 1 } };
}

function hasStackedPriceSeries(candles: PixelCandle[], rows: number[], plot: PixelRectangle) {
  for (const row of rows.slice(1, -1)) {
    const above = candles.filter(c => c.lowY < row - 2), below = candles.filter(c => c.highY > row + 2);
    const repeated = above.filter(a => below.some(b => a.left <= b.right && b.left <= a.right));
    if (repeated.length >= 4 && Math.max(...repeated.map(c => c.x)) - Math.min(...repeated.map(c => c.x)) >= (plot.right - plot.left) * .5) return true;
  }
  return false;
}

/** Common-baseline flat bars are evidence of a histogram/second panel, not
 * candle witnesses. This examines only observed red/green components inside
 * the candidate rectangle; it supplies no inferred panel boundary. */
function commonBaselineBars(raster: PlotRaster, plot: PixelRectangle) {
  const { width, data } = raster;
  const left = Math.ceil(plot.left), top = Math.ceil(plot.top);
  const rw = Math.floor(plot.right) - left + 1, rh = Math.floor(plot.bottom) - top + 1;
  const mask = new Uint8Array(rw * rh), bars: PixelRectangle[] = [];
  let components = 0;
  for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
    const i = ((top + y) * width + left + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2];
    if (data[i + 3] >= 240) mask[y * rw + x] = r > 110 && r > g * 1.3 && r > b * 1.3 ? 1 : g > 85 && g > r * 1.3 && g > b * .9 ? 2 : 0;
  }
  for (let start = 0; start < mask.length; start++) {
    const colour = mask[start]; if (!colour) continue;
    // Do not silently truncate evidence. These hard budgets bound subsequent
    // pair/group comparisons even when a dense image fits the pixel budget.
    if (++components > MAX_COLOURED_COMPONENTS) return "complex";
    const queue = [start]; mask[start] = 0;
    let minX = start % rw, maxX = minX, minY = Math.floor(start / rw), maxY = minY;
    for (let i = 0; i < queue.length; i++) {
      const at = queue[i], x = at % rw, y = Math.floor(at / rw);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      for (const next of [x ? at - 1 : -1, x + 1 < rw ? at + 1 : -1, y ? at - rw : -1, y + 1 < rh ? at + rw : -1]) {
        if (next >= 0 && mask[next] === colour) { mask[next] = 0; queue.push(next); }
      }
    }
    const w = maxX - minX + 1, h = maxY - minY + 1;
    // A substantial repeated rectangular body is needed. Isolated labels,
    // support lines, and tapered candle wicks cannot establish this series.
    if (w < 3 || w > rw * .04 || h < Math.max(6, w * 1.2) || queue.length / (w * h) < .96) continue;
    bars.push({ left: minX, right: maxX, top: minY, bottom: maxY });
    if (bars.length > MAX_FLAT_BAR_COMPONENTS) return "complex";
  }
  for (const edge of ["top", "bottom"] as const) for (const anchor of bars) {
    const aligned = bars.filter(b => Math.abs(b[edge] - anchor[edge]) <= 2).sort((a, b) => a.left - b.left);
    const separated = aligned.filter((b, i) => i === 0 || b.left > aligned[i - 1].right + 1);
    if (separated.length >= 6 && separated.at(-1)!.right - separated[0].left >= rw * .55) return "present";
  }
  return "none";
}

/** Find repeated adjacent glyph groups, not their numeric contents. */
function axisTextColumns(raster: PlotRaster, tones: Uint16Array, plot: PixelRectangle, rows: number[]) {
  const { width, height } = raster;
  const pitch = median(rows.slice(1).map((y, i) => y - rows[i]));
  const halfHeight = Math.max(6, Math.min(24, Math.ceil(pitch * .22)));
  const reach = Math.ceil(Math.min(width * .25, (plot.right - plot.left) * .35));
  const results: Extract<ImagePlotRegion, { status: "measured" }>["axisLabelRegionPixels"][] = [];
  for (const side of ["left", "right"] as const) {
    const left = side === "right" ? Math.ceil(plot.right) + 2 : Math.max(0, Math.floor(plot.left) - reach);
    const right = side === "right" ? Math.min(width - 1, Math.ceil(plot.right) + reach) : Math.floor(plot.left) - 2;
    if (right - left < 12) continue;
    const words: { row: number; box: Glyph; font: number }[] = [];
    for (const row of rows) {
      const top = Math.max(0, Math.floor(row) - halfHeight), bottom = Math.min(height - 1, Math.ceil(row) + halfHeight);
      const rw = right - left + 1, rh = bottom - top + 1, samples: number[] = [];
      for (let y = top; y <= bottom; y += 2) for (let x = left; x <= right; x += 2) if (tones[y * width + x] !== 65535) samples.push(tones[y * width + x]);
      if (!samples.length) continue;
      const background = median(samples), mask = new Uint8Array(rw * rh), seen = new Uint8Array(rw * rh), glyphs: Glyph[] = [];
      for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
        const tone = tones[(top + y) * width + left + x];
        if (tone !== 65535 && Math.abs(tone - background) >= 25) mask[y * rw + x] = 1;
      }
      for (let i = 0; i < mask.length; i++) {
        if (!mask[i] || seen[i]) continue;
        const queue = [i]; seen[i] = 1;
        let minX = i % rw, maxX = minX, minY = Math.floor(i / rw), maxY = minY;
        for (let j = 0; j < queue.length; j++) {
          const at = queue[j], x = at % rw, y = Math.floor(at / rw);
          minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
          for (const next of [x ? at - 1 : -1, x + 1 < rw ? at + 1 : -1, y ? at - rw : -1, y + 1 < rh ? at + rw : -1]) {
            if (next >= 0 && mask[next] && !seen[next]) { seen[next] = 1; queue.push(next); }
          }
        }
        const w = maxX - minX + 1, h = maxY - minY + 1;
        if (queue.length < 2 || h > halfHeight * 1.8 || w > Math.max(12, h * 3) || minY === 0 || maxY === rh - 1) continue;
        glyphs.push({ left: left + minX, right: left + maxX, top: top + minY, bottom: top + maxY, count: queue.length });
      }
      if (glyphs.length < 3) continue;
      const font = median(glyphs.map(g => g.bottom - g.top + 1).filter(h => h >= 4));
      if (!Number.isFinite(font) || font < 4) continue;
      const groups: Glyph[][] = [];
      for (const g of glyphs.sort((a, b) => a.left - b.left)) {
        const last = groups.at(-1);
        if (last && g.left - Math.max(...last.map(v => v.right)) <= font * .8) last.push(g); else groups.push([g]);
      }
      for (const group of groups) {
        if (group.length < 3) continue;
        const box = { left: Math.min(...group.map(g => g.left)), right: Math.max(...group.map(g => g.right)),
          top: Math.min(...group.map(g => g.top)), bottom: Math.max(...group.map(g => g.bottom)), count: group.reduce((n, g) => n + g.count, 0) };
        const h = box.bottom - box.top + 1, w = box.right - box.left + 1;
        const gap = side === "right" ? box.left - plot.right : plot.left - box.right;
        if (h < 4 || w < h * 1.5 || w > h * 16 || Math.abs((box.top + box.bottom) / 2 - row) > Math.max(3, h * .5) || gap > Math.max(12, h * 2.5)) continue;
        words.push({ row, box, font: h });
      }
    }
    const groups: typeof words[] = [];
    for (const word of words) {
      const edge = side === "right" ? word.box.left : word.box.right;
      const group = groups.find(g => Math.abs(edge - (side === "right" ? g[0].box.left : g[0].box.right)) <= Math.max(2, g[0].font * .45));
      if (group) group.push(word); else groups.push([word]);
    }
    for (const group of groups) {
      const matched = [...new Set(group.map(w => w.row))];
      if (matched.length < Math.max(3, Math.ceil(rows.length * .6)) || group.length !== matched.length) continue;
      results.push({ side, left: Math.max(0, Math.min(...group.map(w => w.box.left)) - 2),
        right: Math.min(width, Math.max(...group.map(w => w.box.right)) + 2),
        top: Math.max(0, Math.min(...group.map(w => w.box.top)) - 2),
        bottom: Math.min(height, Math.max(...group.map(w => w.box.bottom)) + 2), matchedGridRows: matched });
    }
  }
  return results;
}
