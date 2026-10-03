import test from 'node:test';
import assert from 'node:assert/strict';
import { completedScannerAnalysis } from '../app/api/pocket/independent-scanner';
import { ScannerOnlyError } from '../app/pocket/independent-scanner';
const source = { instrumentIdentifier: 'US 500 (DFB)', timeframe: '30m', currentPrice: '7723.23', confidence: 'HIGH', limitation: '', plotBounds: { left: 5, top: 10, right: 85, bottom: 85 }, priceScaleAnchors: [{ price: 7800, y: 20 }, { price: 7700, y: 45 }, { price: 7600, y: 70 }], evidenceQuality: { chartReadability: 'CLEAR', instrumentConfidence: 'HIGH', timeframeConfidence: 'HIGH', candlesReadable: true, scaleReadable: true, limitations: [] }, patterns: [], liquidityShield: { status: 'NO_VISIBLE_RISK_ZONES', summary: 'No clear repeated cluster.', stopGuidance: 'Verify your source chart.', zones: [] } };
const hint = { instrument: 'US 500 (DFB)', timeframe: '30m', currentPrice: '7723.23', contextMatch: 'NOT_PROVIDED' as const, source: 'PREFLIGHT' as const };
test('completed scanner evidence survives a narrative error without becoming a full report', () => {
  const result = completedScannerAnalysis(JSON.stringify(source), hint)!;
  assert.ok(result.trustGate.identityLocked); assert.equal(result.timeframe, '30m'); assert.equal(result.currentPrice, '7723.23');
  assert.equal(result.liquidityShield?.status, 'NO_VISIBLE_RISK_ZONES');
  for (const field of ['setupScore','verdict','summary','direction']) assert.equal(field in result, false);
  const error = new ScannerOnlyError('Report timed out', result, 'exact-primary-source');
  assert.equal(error.scanner, result); assert.equal(error.sourceImage, 'exact-primary-source');
});
test('partial JSON and old cached geometry lacking independent timeframe/readability never become finished scanner evidence', () => {
  assert.equal(completedScannerAnalysis('{"instrumentIdentifier":', hint), null);
  const old = { ...source, timeframe: undefined, evidenceQuality: undefined };
  assert.equal(completedScannerAnalysis(JSON.stringify(old), hint), null);
});
test('instrument and timeframe conflicts retain a hold instead of borrowing selected-chart identity', () => {
  for (const changed of [{...hint,instrument:'Oil - US Crude (DFB)'}, {...hint,timeframe:'4h'}]) {
    const result=completedScannerAnalysis(JSON.stringify(source),changed)!;
    assert.equal(result.trustGate.identityLocked,false); assert.equal(result.instrument,source.instrumentIdentifier); assert.deepEqual(result.patterns,[]);
  }
});
test('poor evidence and malformed bounds cannot establish verified drawings', () => {
  const poor = completedScannerAnalysis(JSON.stringify({...source,evidenceQuality:{...source.evidenceQuality,chartReadability:'POOR',candlesReadable:false}}),hint)!;
  assert.equal(poor.evidenceQuality.candlesReadable,false); assert.deepEqual(poor.patterns,[]);
  assert.equal(completedScannerAnalysis(JSON.stringify({...source,plotBounds:{left:90,right:10,top:10,bottom:80}}),hint),null);
});
