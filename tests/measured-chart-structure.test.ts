import assert from 'node:assert/strict';
import test from 'node:test';
import { measuredChartStructure } from '../prototype/chart-extraction/measured-chart-structure';
import type { CandlePixels } from '../app/pocket/candle-pixels';
const bounds = { left: 0, right: 100, top: 0, bottom: 100 };
const make = (highs: number[]): CandlePixels => ({ width: 400, height: 200, candles: highs.map((highY, id) => ({ id, x: 20 + id * 20, left: 18 + id * 20, right: 22 + id * 20, highY, lowY: highY + 20, upperWick: true, lowerWick: true })) });
test('discovers separated repeated highs from exact measured endpoints without model coordinates', () => {
  const pixels = make([90,90,90,50,90,90,90,90,90,51,90,90,90,90]);
  const result = measuredChartStructure(pixels, bounds);
  const band = result.repeatedBands.find(b => b.edge === 'high')!;
  assert.equal(result.status, 'measured'); assert.deepEqual(band.touches.map(p => p.candleId), [3,9]);
  assert.equal(band.top, 50); assert.equal(band.bottom, 51);
  for (const p of band.touches) assert.equal(p.y, pixels.candles[p.candleId].highY);
});
test('everyday flat rows and monotonic trends are not repeated swing clusters', () => {
  for (const highs of [Array(16).fill(70), Array.from({length:16}, (_, i) => 50 + i * 3)]) {
    assert.equal(measuredChartStructure(make(highs), bounds).repeatedBands.length, 0);
  }
});
test('nearby noise and a chain of increasingly different peaks do not manufacture a band', () => {
  const highs = Array(18).fill(90); highs[3]=50; highs[8]=54; highs[13]=58;
  const result = measuredChartStructure(make(highs), bounds);
  assert.ok(result.repeatedBands.every(b => b.bottom - b.top <= 5));
  assert.ok(result.repeatedBands.every(b => b.touches.length < 3));
});
test('missing, duplicated, overlapping and out-of-bounds candles fail closed', () => {
  assert.equal(measuredChartStructure(null, bounds).status, 'held');
  for (const mutate of [
    (p: CandlePixels) => { p.candles[4].id=p.candles[3].id; },
    (p: CandlePixels) => { p.candles[4].left=p.candles[3].right; },
    (p: CandlePixels) => { p.candles[4].highY=-1; },
  ]) { const pixels=make(Array(16).fill(70)); mutate(pixels); assert.equal(measuredChartStructure(pixels,bounds).status,'held'); }
});
