import assert from 'node:assert/strict';
import test from 'node:test';
import { hasReadableStructureEvidence } from '../app/pocket/structure-scan-status';
import { createSampleCharts } from '../app/pocket/sample-analysis';

test('clear, independently identified candles can support an empty structural result', () => {
  const analysis = createSampleCharts()[0].report!;
  assert.equal(hasReadableStructureEvidence(analysis), true);
});

test('missing or conflicting identity prevents an empty result from becoming an all-clear', () => {
  const analysis = createSampleCharts()[0].report!;
  for (const trustGate of [undefined, { ...analysis.trustGate!, identityLocked: false }]) {
    assert.equal(hasReadableStructureEvidence({ ...analysis, trustGate }), false);
  }
});

test('partial or unreadable candles and uncertain identity stay inconclusive', () => {
  const analysis = createSampleCharts()[0].report!;
  for (const patch of [
    { chartReadability: 'PARTIAL' as const }, { chartReadability: 'POOR' as const },
    { candlesReadable: false }, { instrumentConfidence: 'LOW' as const },
    { timeframeConfidence: 'UNKNOWN' as const },
  ]) assert.equal(hasReadableStructureEvidence({ ...analysis, evidenceQuality: { ...analysis.evidenceQuality, ...patch } }), false);
});

test('a scale hold does not erase otherwise readable relative candle structure', () => {
  const analysis = createSampleCharts()[0].report!;
  assert.equal(hasReadableStructureEvidence({ ...analysis, trustGate: { ...analysis.trustGate!, scaleLocked: false }, evidenceQuality: { ...analysis.evidenceQuality, scaleReadable: false } }), true);
});
