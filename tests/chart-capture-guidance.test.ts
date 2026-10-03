import assert from 'node:assert/strict';
import test from 'node:test';
import { chartCaptureGuidance } from '../app/pocket/chart-preflight';
const clear = { priceScaleVisible: true, candlesReadable: true, enoughHistory: true, instrumentConfidence: 'HIGH' as const, timeframeConfidence: 'HIGH' as const };
test('readable charts receive no retake guidance', () => assert.deepEqual(chartCaptureGuidance(clear), []));
test('missing history suggests wider view without sacrificing candle readability', () => {
  const advice = chartCaptureGuidance({ ...clear, enoughHistory: false });
  assert.equal(advice.length, 1); assert.match(advice[0], /landscape.*keeping candles clear/);
});
test('unreadable candles, scale and identity get specific repairs', () => {
  const advice = chartCaptureGuidance({ ...clear, candlesReadable: false, priceScaleVisible: false, timeframeConfidence: 'LOW' });
  assert.equal(advice.length, 3);
  assert.match(advice[0], /Zoom in/); assert.match(advice[1], /price scale/); assert.match(advice[2], /timeframe/);
});
