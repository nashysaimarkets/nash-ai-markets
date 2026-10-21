/** Synthetic code regression fixtures only: no source-market labels, provider
 * executions, human annotations, expert acceptance or accuracy measurements. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { INTERNAL_DIAGNOSTIC_PROTOCOL, normalizeInternalDiagnosticObservation, scoreInternalDiagnostics } from '../scripts/pocket-monaco-internal-diagnostics.ts';
import type { InternalDiagnosticInput, InternalSourceCase } from '../scripts/pocket-monaco-internal-diagnostics.ts';

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const bytes = (x: unknown) => Buffer.from(JSON.stringify(x));
const H = 'a'.repeat(64), I = 'b'.repeat(64);
const protocolBytes = readFileSync(new URL('../docs/monaco-126/internal-diagnostics/PROTOCOL-v1.json', import.meta.url));
function fixture() {
  const candles = [
    { open: 110, high: 120, low: 100, close: 115 },
    { open: 115, high: 117, low: 100, close: 110 },
    { open: 110, high: 120, low: 105, close: 115 },
    { open: 115, high: 120, low: 110, close: 116 },
  ].map((ohlcv, barIndex) => ({ barIndex, timestamp: `synthetic-bar-${barIndex}`, points: Object.fromEntries(Object.entries(ohlcv).map(([key, value]) => [key, { x: 200 + barIndex * 200, y: 450 - (value - 90) / 0.1, price: value }])) as InternalSourceCase['objective']['candles'][number]['points'] }));
  const c: InternalSourceCase = {
    caseId: 'd001', instrument: 'SYNTHETIC_TEST_ONLY', inputInstrument: 'SYNTHETIC_TEST_ONLY', timeframe: '1h',
    identities: { subsetManifestSha256: H, inputSha256: I, imageSha256: H, sourceZipSha256: H, sourceMemberSha256: H, barsSha256: H, calibrationSha256: H },
    objective: { aggregation: { exactOhlcvMatch: true, barCount: candles.length }, priceScale: { width: 1000, height: 500, coordinates: 'ORIGINAL_IMAGE_PIXELS', plot: { left: 100, right: 900, top: 50, bottom: 450 }, priceMin: 90, priceMax: 130, pricePerPixel: 0.1, pixelQuantizationBound: 0.5 }, candles },
    perToolAssessability: Object.fromEntries(['pattern', 'level', 'liquidity_pool', 'liquidity_event'].map(tool => [tool, { status: 'OBJECTIVE_ONLY', reasonCode: 'SYNTHETIC_GEOMETRY', reason: 'Synthetic source-coordinate contract only.' }])) as InternalSourceCase['perToolAssessability'],
  };
  const oracle = { schemaVersion: 1, kind: 'MONACO_INTERNAL_SOURCE_REFERENCE', caseIds: [...INTERNAL_DIAGNOSTIC_PROTOCOL.caseIds], cases: INTERNAL_DIAGNOSTIC_PROTOCOL.caseIds.map(caseId => ({ ...structuredClone(c), caseId })) };
  const raw = {
    instrument: 'SYNTHETIC_TEST_ONLY', timeframe: '1h', currentPrice: '116',
    evidenceQuality: { chartReadability: 'CLEAR', candlesReadable: true, scaleReadable: true },
    patterns: [{ name: 'DOUBLE TOP', status: 'FORMING', confidence: 'HIGH', timeframe: '1h', evidence: 'Synthetic ordered turn test only.', confirmation: 'Synthetic future condition.', invalidation: 'Synthetic invalidation condition.', geometry: { points: [{ x: 20, y: 30 }, { x: 40, y: 70 }, { x: 60, y: 30 }], labelX: 60, labelY: 25 } }],
    levels: [{ kind: 'support', label: 'synthetic', price: '110', x: 10, y: 50, x2: 90, y2: 50 }],
    plotBounds: { left: 10, top: 10, right: 90, bottom: 90 },
    priceScaleAnchors: [{ price: 130, y: 10 }, { price: 110, y: 50 }, { price: 90, y: 90 }],
    liquidity: { state: 'VERIFIED', event: 'NONE', confidence: 'HIGH', evidence: 'Synthetic source-backed witnesses only.', confirmation: 'Synthetic condition.', invalidation: 'Synthetic condition.',
      zones: [{ side: 'BUY_SIDE', basis: 'EQUAL_HIGHS', price: '120', priceLow: null as number | null, priceHigh: null as number | null, x: 20, x2: 80, y: 30 }],
      observations: [{ kind: 'equal-highs', side: 'buy-side', confidence: 'HIGH', x: 20, y: 30 }, { kind: 'equal-highs', side: 'buy-side', confidence: 'HIGH', x: 60, y: 30 }],
    },
  };
  const input = (): InternalDiagnosticInput => { const oracleBytes = bytes(oracle), rawResponseBytes = bytes(raw); return { caseId: 'd001', status: 'COMPLETED', inputSha256: I, imageSha256: H, oracleBytes, oracleSha256: hash(oracleBytes), rawResponseBytes, rawResponseSha256: hash(rawResponseBytes), protocolBytes, protocolSha256: hash(protocolBytes), latencyMs: 12, evidenceKind: 'SYNTHETIC_FIXTURE' }; };
  return { oracle, raw, input };
}
const scored = (input: InternalDiagnosticInput) => { const result = scoreInternalDiagnostics(input); assert.equal(result.status, 'DIAGNOSTIC_RECORDED'); return result; };

test('versioned protocol is exact and synthetic objective diagnostics need no human-review placeholders', () => {
  assert.deepEqual(JSON.parse(protocolBytes.toString()), INTERNAL_DIAGNOSTIC_PROTOCOL);
  const r = scored(fixture().input());
  assert.equal(r.tools.pattern.summary.conformant, 1); assert.equal(r.tools.level.summary.conformant, 1); assert.equal(r.tools.liquidity_pool.summary.conformant, 1);
  assert.equal(r.expertAcceptance, 'UNRESOLVED'); assert.equal(r.tradingInterpretation, 'UNSCORED'); assert.equal(r.actualProviderResults, 0); assert.equal(r.dispatchAuthorised, false);
  assert.equal(r.tools.pattern.summary.semanticTp, null); assert.equal(r.tolerance.originalPixels, 1); assert.equal(r.tolerance.priceUnits, 0.1); assert.equal(r.tolerance.exchangeTickSize, null);
});
test('normalization retains raw claims and duplicates without calibrating, filtering or relabeling', () => {
  const f = fixture(); f.raw.patterns.push(structuredClone(f.raw.patterns[0])); f.raw.levels[0].kind = 'resistance';
  const before = JSON.stringify(f.raw), r = scored(f.input());
  assert.equal(r.tools.pattern.summary.assertions, 2); assert.equal(r.rawScannerResponse.levels && JSON.stringify(r.rawScannerResponse), before);
  assert.equal(r.tools.level.assertions[0].raw.kind, 'resistance'); assert.equal(r.tools.level.assertions[0].supportResistanceRole, 'UNSCORED');
  assert.equal(JSON.stringify(f.raw), before);
});
test('d003 weak four-hour pattern is UNSCORED even when its source flags request objective assessment', () => {
  const f = fixture(), input = f.input(); input.caseId = 'd003';
  const r = scored(input); assert.equal(r.tools.pattern.summary.unscored, 1); assert.equal(r.tools.pattern.assertions[0].conformance.reason, 'UNSCORED_WEAK_4H');
  assert.equal(r.tools.level.summary.conformant, 1);
});
for (const [field, value] of [['status', 'AMBIGUOUS'], ['confidence', 'LOW']] as const) test(`${field} ${value} pattern has no conformance denominator`, () => {
  const f = fixture(); f.raw.patterns[0][field] = value;
  const r = scored(f.input()); assert.equal(r.tools.pattern.summary.unscored, 1); assert.equal(r.tools.pattern.summary.conformant, 0); assert.equal(r.tools.pattern.summary.nonconformant, 0);
});
test('source-declared ambiguous or unassessable targets retain assertions without scored conformance', () => {
  const f = fixture(); f.oracle.cases[0].perToolAssessability.pattern = { status: 'UNSCORED', reasonCode: 'SOURCE_AMBIGUOUS', reason: 'Synthetic ambiguity.' };
  const r = scored(f.input()); assert.equal(r.tools.pattern.summary.unscored, 1); assert.equal(r.tools.pattern.assertions.length, 1);
});
test('wrong row prices retain numeric errors rather than being calibrated away', () => {
  const f = fixture(); f.raw.levels[0].price = '115';
  const r = scored(f.input()); assert.equal(r.tools.level.summary.nonconformant, 1); assert.equal(r.tools.level.assertions[0].projection.priceError, 5); assert.equal(r.tools.level.assertions[0].projection.pixelError, 50);
  assert.equal(r.tools.level.assertions[0].raw.price, '115');
});
test('nearest source wick alignment does not establish canonical pattern or confirmed status', () => {
  const f = fixture(); f.raw.patterns[0].status = 'CONFIRMED';
  const r = scored(f.input()); assert.equal(r.tools.pattern.summary.conformant, 1); assert.equal(r.tools.pattern.assertions[0].canonicalPatternTruth, 'UNSCORED'); assert.match(r.tools.pattern.assertions[0].formationVersusConfirmation, /^UNSCORED/);
  f.raw.patterns[0].geometry.points[1].y = 29;
  const wrong = scored(f.input()); assert.equal(wrong.tools.pattern.summary.nonconformant, 1); assert.equal(wrong.tools.pattern.assertions[0].existingStructuralGateRetained, false);
});
test('empty completed output is no assertion and never a true negative or false negative', () => {
  const f = fixture(); f.raw.patterns = []; f.raw.levels = []; f.raw.liquidity.state = 'NONE'; f.raw.liquidity.zones = []; f.raw.liquidity.observations = [];
  const r = scored(f.input()); for (const tool of Object.values(r.tools)) { assert.equal(tool.summary.emptyOutput, true); assert.equal(tool.summary.trueNegatives, null); assert.equal(tool.summary.semanticFn, null); }
});
for (const status of ['NOT_EXECUTED', 'TRANSPORT_ERROR', 'HOLD', 'CANCELLED'] as const) test(`${status} stays unmeasured with no detection denominator`, () => {
  const input = fixture().input(); input.status = status; input.latencyMs = null; const r = scoreInternalDiagnostics(input);
  assert.equal(r.status, 'UNMEASURED'); if (r.status === 'UNMEASURED') { assert.equal(r.reason, status); assert.equal(r.metrics, null); }
});
test('unreadable response is unmeasured while unreadable scale leaves price claims unscored', () => {
  const f = fixture(); f.raw.evidenceQuality.candlesReadable = false;
  const unreadable = scoreInternalDiagnostics(f.input()); assert.equal(unreadable.status, 'UNMEASURED');
  f.raw.evidenceQuality.candlesReadable = true; f.raw.evidenceQuality.scaleReadable = false;
  const r = scored(f.input()); assert.equal(r.tools.level.summary.unscored, 1); assert.equal(r.tools.liquidity_pool.summary.unscored, 1); assert.equal(r.tools.pattern.summary.conformant, 1);
});
test('malformed geometry invalidates the response and is not selectively discarded', () => {
  const f = fixture(); f.raw.patterns[0].geometry.points[1].x = NaN;
  const r = scoreInternalDiagnostics(f.input()); assert.equal(r.status, 'UNMEASURED');
  const malformed = normalizeInternalDiagnosticObservation(Buffer.from('{broken'), { width: 1000, height: 500 }); assert.equal(malformed.status, 'UNMEASURED');
});
for (const field of ['rawResponseSha256', 'oracleSha256', 'protocolSha256', 'inputSha256', 'imageSha256'] as const) test(`wrong ${field} fails artifact or case binding`, () => {
  const input = fixture().input(); input[field] = 'f'.repeat(64); assert.equal(scoreInternalDiagnostics(input).status, 'UNMEASURED');
});
test('a changed protocol cannot widen tolerances under the same version', () => {
  const input = fixture().input(); input.protocolBytes = bytes({ ...INTERNAL_DIAGNOSTIC_PROTOCOL, comparisonAllowancePixels: 10 }); input.protocolSha256 = hash(input.protocolBytes);
  const r = scoreInternalDiagnostics(input); assert.equal(r.status, 'UNMEASURED'); if (r.status === 'UNMEASURED') assert.equal(r.reason, 'DIAGNOSTIC_PROTOCOL_VERSION_MISMATCH');
});
test('heldout or extra cases are rejected without reading any heldout artifact', () => {
  const f = fixture(), input = f.input(); input.caseId = 'h001'; assert.equal(scoreInternalDiagnostics(input).status, 'UNMEASURED');
  f.oracle.caseIds[5] = 'h001' as 'd006'; assert.equal(scoreInternalDiagnostics(f.input()).status, 'UNMEASURED');
});
test('internal source projection, source reproduction and coordinate system must be consistent', () => {
  for (const mutate of [
    (c: InternalSourceCase) => { c.objective.priceScale.pricePerPixel = 1; },
    (c: InternalSourceCase) => { c.objective.aggregation.exactOhlcvMatch = false; },
    (c: InternalSourceCase) => { c.objective.candles[0].points.high.y += 10; },
    (c: InternalSourceCase) => { c.objective.priceScale.coordinates = 'CROP_PIXELS' as 'ORIGINAL_IMAGE_PIXELS'; },
  ]) { const f = fixture(); mutate(f.oracle.cases[0]); assert.equal(scoreInternalDiagnostics(f.input()).status, 'UNMEASURED'); }
});
test('exact source decimal strings are retained while numeric copies support geometric checks', () => {
  const f = fixture(); const serialized = JSON.parse(JSON.stringify(f.oracle));
  for (const c of serialized.cases) {
    c.objective.priceScale.priceMin = String(c.objective.priceScale.priceMin); c.objective.priceScale.priceMax = String(c.objective.priceScale.priceMax);
    for (const candle of c.objective.candles) for (const p of Object.values(candle.points) as { price: number | string }[]) p.price = String(p.price);
  }
  const input = f.input(); input.oracleBytes = bytes(serialized); input.oracleSha256 = hash(input.oracleBytes);
  const r = scored(input); assert.equal(r.tools.pattern.summary.conformant, 1);
  const anchors = r.tools.pattern.assertions[0].sourceAnchors[0].matches as { point: { sourcePriceToken: string } }[];
  assert.equal(anchors[0].point.sourcePriceToken, '120');
  serialized.cases[0].objective.priceScale.priceMin = '9e1'; input.oracleBytes = bytes(serialized); input.oracleSha256 = hash(input.oracleBytes);
  assert.equal(scoreInternalDiagnostics(input).status, 'UNMEASURED');
});
test('index-based candles with session gaps do not imply intraminute event chronology', () => {
  const f = fixture(); f.oracle.cases[0].objective.candles[2].timestamp = 'synthetic-session-after-gap';
  f.raw.liquidity.event = 'RECLAIM'; f.raw.liquidity.observations.push({ kind: 'sweep-reclaim', side: 'buy-side', confidence: 'HIGH', x: 80, y: 30 });
  const r = scored(f.input()); assert.equal(r.tools.liquidity_event.assertions[0].existingEventRuleCorroborated, true); assert.equal(r.tools.liquidity_event.summary.unscored, 1); assert.equal(r.tools.liquidity_event.assertions[0].eventChronology, 'UNSCORED');
});
test('ambiguous price notation is unscored and never repaired from source prices', () => {
  const f = fixture(); f.raw.levels[0].price = '110,00'; const r = scored(f.input());
  assert.equal(r.tools.level.summary.unscored, 1); assert.equal(r.tools.level.assertions[0].raw.price, '110,00');
});
test('reversed bands and off-plot horizontal endpoints remain nonconformant', () => {
  const f = fixture(); f.raw.liquidity.zones[0].priceLow = 121; f.raw.liquidity.zones[0].priceHigh = 119; f.raw.levels[0].x = 5;
  const r = scored(f.input()); assert.equal(r.tools.liquidity_pool.summary.nonconformant, 1); assert.equal(r.tools.level.summary.nonconformant, 1);
});
test('contradictory NONE or noSignal cannot hide retained positive assertions', () => {
  const f = fixture(); f.raw.liquidity.state = 'NONE'; assert.equal(scoreInternalDiagnostics(f.input()).status, 'UNMEASURED');
  f.raw.liquidity.state = 'VERIFIED'; const input = f.input(); input.rawResponseBytes = bytes({ ...f.raw, noSignal: true }); input.rawResponseSha256 = hash(input.rawResponseBytes); assert.equal(scoreInternalDiagnostics(input).status, 'UNMEASURED');
});
test('retained-output flag alone cannot certify provider results, spend or expert acceptance', () => {
  const input = fixture().input(); input.evidenceKind = 'RETAINED_SCANNER_OUTPUT';
  const r = scored(input); assert.equal(r.actualProviderResults, 0); assert.equal(r.providerAuthenticity, 'NOT_ATTESTED_BY_DIAGNOSTIC_WRAPPER'); assert.equal(r.expertAcceptance, 'UNRESOLVED');
  input.latencyMs = null; assert.equal(scoreInternalDiagnostics(input).status, 'UNMEASURED');
  input.latencyMs = NaN; assert.equal(scoreInternalDiagnostics(input).status, 'UNMEASURED');
});
