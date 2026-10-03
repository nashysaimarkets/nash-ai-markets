import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { CoreScanSummary } from '../../app/pocket/PocketBullseye';
import { createSampleCharts } from '../../app/pocket/sample-analysis';
import type { Analysis } from '../../app/pocket/analysis-types';

const sample = createSampleCharts()[0].report!;
const render = (analysis: Analysis) => renderToStaticMarkup(<CoreScanSummary analysis={analysis} todayMacroCount={0} nextHighImpactLabel={null} macroAvailable={false} macroUnavailable={[]} onOpenTool={() => {}} onOpenMacro={() => {}} />);

test('inconclusive empty scans render warnings instead of structural all-clears', () => {
  for (const analysis of [
    { ...sample, trustGate: { ...sample.trustGate!, identityLocked: false } },
    { ...sample, evidenceQuality: { ...sample.evidenceQuality, candlesReadable: false } },
  ]) {
    const html = render(analysis);
    assert.match(html, /PATTERN READ INCONCLUSIVE/);
    assert.match(html, /Liquidity risk remains unverified/);
    assert.doesNotMatch(html, /NO CLEAR LIQUIDITY CLUSTER|NO CLEAN PATTERN VERIFIED|SCAN COMPLETE/);
  }
});

test('readable selected-chart empty results do not claim every upload was checked', () => {
  const html = render(sample);
  assert.match(html, /NO CLEAN PATTERN VERIFIED/);
  assert.match(html, /this selected chart/);
  assert.doesNotMatch(html, /Every uploaded chart was checked/);
});
