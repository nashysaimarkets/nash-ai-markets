import type { CandlePixels, PixelCandle } from '../../app/pocket/candle-pixels';
import type { LiquidityPlotBounds } from '../../app/pocket/liquidity-guard';

export type MeasuredSwing = { candleId: number; edge: 'high' | 'low'; x: number; y: number; prominencePixels: number };
export type RepeatedSwingBand = { edge: 'high' | 'low'; top: number; bottom: number; touches: MeasuredSwing[] };
export type MeasuredStructure = { status: 'measured' | 'held'; reason: string; swings: MeasuredSwing[]; repeatedBands: RepeatedSwingBand[] };

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Experimental candidate discovery, separate from the customer drawing gate.
 * Uses measured high/low pixels only. It supplies neither prices nor pattern
 * names, model confidence, hidden orders or an assertion of actual liquidity.
 */
export function measuredChartStructure(pixels: CandlePixels | null, bounds: LiquidityPlotBounds): MeasuredStructure {
  const hold = (reason: string): MeasuredStructure => ({ status: 'held', reason, swings: [], repeatedBands: [] });
  if (!pixels || !Number.isInteger(pixels.width) || !Number.isInteger(pixels.height) || pixels.width <= 0 || pixels.height <= 0 ||
    ![bounds.left, bounds.right, bounds.top, bounds.bottom].every(Number.isFinite) || bounds.left < 0 || bounds.top < 0 || bounds.right > 100 || bounds.bottom > 100 || bounds.left >= bounds.right || bounds.top >= bounds.bottom) return hold('Original chart pixels and bounds are required.');
  if (pixels.candles.length < 12 || pixels.candles.length > 1000) return hold('Not enough separated candle witnesses for a structure check.');
  const candles = [...pixels.candles].sort((a, b) => a.x - b.x);
  const ids = new Set<number>();
  for (const c of candles) {
    if (![c.id, c.left, c.right, c.x, c.highY, c.lowY].every(Number.isFinite) || !Number.isInteger(c.id) || ids.has(c.id) ||
      c.left > c.x || c.right < c.x || c.highY >= c.lowY || c.left < bounds.left * pixels.width / 100 || c.right > bounds.right * pixels.width / 100 || c.highY < bounds.top * pixels.height / 100 || c.lowY > bounds.bottom * pixels.height / 100) return hold('Candle witnesses are invalid, duplicated or outside the plot.');
    ids.add(c.id);
  }
  if (candles.some((c, i) => i > 0 && c.left <= candles[i - 1].right)) return hold('Overlapping candle witnesses cannot establish independent reactions.');
  const pitch = median(candles.slice(1).map((c, i) => c.x - candles[i].x));
  const typicalRange = median(candles.map(c => c.lowY - c.highY));
  const minimumProminence = Math.max(4, typicalRange * .75);
  const bandTolerance = Math.max(2, Math.min((bounds.bottom - bounds.top) * pixels.height / 100 * .01, typicalRange * .25));
  const swings: MeasuredSwing[] = [];
  const endpoint = (c: PixelCandle, edge: 'high' | 'low') => edge === 'high' ? c.highY : c.lowY;
  // A three-candle neighbourhood on both sides avoids labelling every candle
  // endpoint a swing. Missing witness gaps do not get interpolated.
  for (let i = 3; i < candles.length - 3; i++) {
    const local = candles.slice(i - 3, i + 4);
    if (local.some((c, j) => j > 0 && c.x - local[j - 1].x > pitch * 2.5)) continue;
    for (const edge of ['high', 'low'] as const) {
      const point = endpoint(candles[i], edge);
      if (local.some((c, j) => j !== 3 && (edge === 'high' ? endpoint(c, edge) <= point : endpoint(c, edge) >= point))) continue;
      const away = (items: PixelCandle[]) => edge === 'high' ? Math.max(...items.map(c => c.highY)) - point : point - Math.min(...items.map(c => c.lowY));
      const prominencePixels = Math.min(away(local.slice(0, 3)), away(local.slice(4)));
      if (prominencePixels >= minimumProminence) swings.push({ candleId: candles[i].id, edge, x: candles[i].x, y: point, prominencePixels });
    }
  }
  const repeatedBands: RepeatedSwingBand[] = [];
  for (const edge of ['high', 'low'] as const) {
    const points = swings.filter(s => s.edge === edge).sort((a, b) => a.y - b.y);
    const used = new Set<number>();
    for (const seed of points) {
      if (used.has(seed.candleId)) continue;
      const group = points.filter(p => !used.has(p.candleId) && p.y >= seed.y && p.y - seed.y <= bandTolerance).sort((a, b) => a.x - b.x);
      const touches: MeasuredSwing[] = [];
      for (const p of group) {
        const prior = touches.at(-1);
        if (prior && p.x - prior.x < pitch * 4) continue;
        if (prior) {
          const between = candles.filter(c => c.x > prior.x && c.x < p.x);
          if (!between.length) continue;
          const excursion = edge === 'high' ? Math.max(...between.map(c => c.lowY)) - Math.max(prior.y, p.y) : Math.min(prior.y, p.y) - Math.min(...between.map(c => c.highY));
          if (excursion < Math.max(minimumProminence, bandTolerance * 3)) continue;
        }
        touches.push(p);
      }
      if (touches.length < 2) continue;
      touches.forEach(p => used.add(p.candleId));
      repeatedBands.push({ edge, top: Math.min(...touches.map(p => p.y)), bottom: Math.max(...touches.map(p => p.y)), touches });
    }
  }
  return { status: 'measured', reason: 'Historical pixel structures only; interpretation and price calibration remain separate.', swings: swings.sort((a, b) => a.x - b.x), repeatedBands };
}
