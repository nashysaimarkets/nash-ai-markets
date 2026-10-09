import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import * as guards from '../app/pocket/chart-preflight.ts';

const facts = { instrument: 'US 500', timeframe: '5m', currentPrice: '6725.50', hasContext: false, sameInstrument: null, contextAcknowledged: false, priceScaleConfirmed: true };
function canLock(input: Record<string, unknown>) {
  return (guards as unknown as { canLockChartFacts: (input: Record<string, unknown>) => boolean }).canLockChartFacts(input);
}
test('unavailable preflight cannot silently authorise analysis', () => {
  assert.equal(guards.preflightAllowsAnalysis('UNAVAILABLE'), false);
});
test('mismatched context stays blocked even with acknowledgement', () => {
  assert.equal(canLock({ ...facts, hasContext: true, sameInstrument: false, contextAcknowledged: true }), false);
});
test('unknown context requires explicit acknowledgement', () => {
  assert.equal(canLock({ ...facts, hasContext: true }), false);
  assert.equal(canLock({ ...facts, hasContext: true, contextAcknowledged: true }), true);
  assert.equal(canLock({ ...facts, hasContext: true, sameInstrument: true }), true);
});
test('manual fallback needs visible scale, valid facts, and readable chart', () => {
  assert.equal(canLock(facts), true);
  for (const patch of [{ priceScaleConfirmed: false }, { currentPrice: 'UNKNOWN' }, { currentPrice: '1..2' }, { currentPrice: '1,2' }, { currentPrice: '0' }, { currentPrice: '-2' }, { instrument: '' }, { timeframe: '' }, { retake: true }, { candlesReadable: false }]) {
    assert.equal(canLock({ ...facts, ...patch }), false, JSON.stringify(patch));
  }
  assert.equal(canLock({ ...facts, currentPrice: '6,725.50' }), true);
});
test('actual lock callback never confirms mismatched or unacknowledged context', async () => {
  const panel = await readFile(new URL('../app/pocket/ChartPreflightPanel.tsx', import.meta.url), 'utf8');
  const source = panel.slice(panel.indexOf('  const lock = () => {'), panel.indexOf('  const edit ='));
  for (const sameInstrument of [false, null]) {
    const updates: unknown[] = [];
    const record = (value: unknown) => updates.push(value);
    const bindings = { valid: true, result: { status: 'READY', sameInstrument }, contextImage: 'B', instrument: 'US 500', timeframe: '5m', currentPrice: '6725.50', canLockChartFacts: canLock, contextAcknowledged: false, priceScaleConfirmed: true, setStatus: record, statusHandler: { current: record }, confirmationHandler: { current: record } };
    const lock = new Function(...Object.keys(bindings), stripTypeScriptTypes(source) + '\nreturn lock;')(...Object.values(bindings));
    lock();
    assert.deepEqual(updates, []);
  }
});

test('direct analysis dispatch cannot bypass an unavailable preflight', async () => {
  const client = await readFile(new URL('../app/pocket/PocketBullseye.tsx', import.meta.url), 'utf8');
  const source = client.slice(client.indexOf('  async function requestPocketAnalysis('), client.indexOf('  async function analyse('));
  let calls = 0;
  const bindings = { image: 'A', analysisRequestActive: { current: false }, analysisEpoch: { current: { snapshot: () => 0, isCurrent: () => true } }, setBusy: () => {}, intention: 'UNSURE', preflightStatus: 'UNAVAILABLE', preflightAllowsAnalysis: guards.preflightAllowsAnalysis, chartConfirmation: null, accuracyCorrection: null, analysisCacheKey: async () => 'A', analysisCacheGet: async () => null, hasVerifiedStructuralLevel: () => false, createPrecisionReadingCrop: async () => null, fetch: async () => { calls++; throw new Error('provider dispatched'); } };
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const request = await new AsyncFunction(...Object.keys(bindings), stripTypeScriptTypes(source) + '\nreturn requestPocketAnalysis;')(...Object.values(bindings));
  await assert.rejects(request(null));
  assert.equal(calls, 0);
});
