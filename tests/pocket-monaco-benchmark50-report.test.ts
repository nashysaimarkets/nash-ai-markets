/**
 * SYNTHETIC CODE REGRESSION FIXTURES ONLY. No screenshots, licence grants,
 * human approvals, genuine executor receipts, calls, spend, or accuracy results.
 * Mock review/receipt records below exercise contracts, never provider evidence.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { evidenceHash } from '../scripts/pocket-monaco-measurement.ts';
import type { Feature } from '../scripts/pocket-monaco-measurement.ts';
import { MONACO50_TOOLS, buildMonaco50BenchmarkReport, checkMonaco50Manifest, summarizeMonaco50Progress } from '../scripts/pocket-monaco-benchmark50-report.ts';
import type { Monaco50Case, Monaco50ExecutorReceipt, Monaco50Hashes, Monaco50Manifest, Monaco50Observation,
  Monaco50Protocol, Monaco50ProtocolReview, Monaco50RecordedObservation, Monaco50Reference, Monaco50ReportInput, Monaco50Tool } from '../scripts/pocket-monaco-benchmark50-report.ts';

const bytes = (value: unknown) => Buffer.from(JSON.stringify(value));
const hash = (value: string) => evidenceHash('SYNTHETIC_REGRESSION_ONLY:' + value);
const freezeTime = '2026-01-01T00:00:00.000Z', startTime = '2026-01-02T00:00:00.000Z';
const candidateSha = 'a'.repeat(40);
const feature = (id: string, label = 'level_support', x = 10, price = 100): Feature => ({ id, label, pixels: [{ x, y: 20 }], prices: [price] });
const allFeatures = () => [feature('pattern-1', 'pattern_double_top'), feature('level-1'), feature('pool-1', 'liquidity_pool'), feature('event-1', 'liquidity_sweep')];
const complete = { pattern: 'complete', level: 'complete', liquidity_pool: 'complete', liquidity_event: 'complete' } as const;
type Fixture = Omit<Monaco50ReportInput, 'manifest' | 'references' | 'observations' | 'reviewedExecutorReceipts'> & {
  manifest: Monaco50Manifest & { cases: Monaco50Case[] };
  references: { schemaVersion: 1; cases: Monaco50Reference[] };
  observations: Monaco50Observation[];
  reviewedExecutorReceipts: Monaco50ExecutorReceipt[];
};

function syncArtifacts(f: Fixture) {
  f.artifacts = { dataset: bytes(f.manifest), references: bytes(f.references), protocol: bytes(f.protocol), scannerSource: Buffer.from('SYNTHETIC SCANNER SOURCE, NOT A DEPLOYMENT') };
  f.freeze = { ...hashes(f), frozenAt: freezeTime, candidateSha, model: f.protocol.model };
}
function hashes(f: Fixture): Monaco50Hashes {
  return { datasetSha256: evidenceHash(f.artifacts.dataset), referencesSha256: evidenceHash(f.artifacts.references),
    scannerSourceSha256: evidenceHash(f.artifacts.scannerSource), protocolSha256: evidenceHash(f.artifacts.protocol) };
}
function fixture(): Fixture {
  const cases: Monaco50Case[] = Array.from({ length: 50 }, (_, i) => ({ caseId: `synthetic-${i}`, split: i < 6 ? 'development' : 'heldout',
    category: i < 15 ? 'clear_pattern' : i < 30 ? 'structure' : i < 40 ? 'near_miss' : 'phone', groupId: `synthetic-group-${i}`,
    scenario: 'synthetic-regression', timeframe: '5m', instrument: 'SYNTHETIC', width: 64, height: 48,
    rasterSha256: hash(`raster-${i}`), inputSha256: hash(`input-${i}`), labelSha256: hash(`label-${i}`),
    licenceSha256: hash(`not-a-licence-${i}`), reviewSha256: hash(`not-an-annotation-${i}`),
    primaryAnnotator: 'synthetic-first', independentAnnotator: 'synthetic-second' }));
  const protocol: Monaco50Protocol = { schemaVersion: 1, status: 'DRAFT', candidateSha, model: 'synthetic-no-provider-model',
    labelToTool: { pattern_double_top: 'pattern', level_support: 'level', liquidity_pool: 'liquidity_pool', liquidity_sweep: 'liquidity_event' },
    pixelTolerance: 2, priceTolerance: 1, maxLatencyMs: 1000,
    negativeRule: 'COMPLETE_TOOL_REFERENCE_AND_NO_TOOL_PREDICTIONS', casePassRule: 'EXACT_WITHIN_TOLERANCES' };
  const f: Fixture = { manifest: { schemaVersion: 2, cases }, references: { schemaVersion: 1, cases: cases.map(c => ({ caseId: c.caseId, readable: true, features: allFeatures(), coverage: complete })) },
    protocol, artifacts: { dataset: Buffer.alloc(0), references: Buffer.alloc(0), protocol: Buffer.alloc(0), scannerSource: Buffer.alloc(0) },
    observations: [], reviewedExecutorReceipts: [], now: Date.parse('2026-01-03T00:00:00.000Z') };
  syncArtifacts(f);
  return f;
}
function observe(f: Fixture, caseIndex = 6, features: readonly Feature[] = f.references.cases[caseIndex].features, patch: Partial<Monaco50RecordedObservation> = {}) {
  const c = f.manifest.cases[caseIndex], index = f.observations.length;
  const rawResponse = bytes({ features, noSignal: features.length === 0 });
  const observation: Monaco50RecordedObservation = { caseId: c.caseId, rasterSha256: c.rasterSha256, inputSha256: c.inputSha256, labelSha256: c.labelSha256,
    candidateSha, model: f.protocol.model, requestId: `SYNTHETIC-NOT-PROVIDER-${c.caseId}-${index}`, executorReceiptSha256: hash(`mock-receipt-${c.caseId}-${index}`),
    rawResponseSha256: evidenceHash(rawResponse), status: 'COMPLETED', latencyMs: 42, features, noSignal: features.length === 0, ...patch };
  const audit = { ...hashes(f), startedAt: startTime, attemptNumber: 1, exposure: 'FIRST_UNSEEN' as const };
  const attempt: Monaco50Observation = { observation, rawResponse, audit };
  f.observations.push(attempt);
  f.reviewedExecutorReceipts.push({ receiptSha256: observation.executorReceiptSha256, caseId: c.caseId, requestId: observation.requestId,
    candidateSha, model: f.protocol.model, rawResponseSha256: observation.rawResponseSha256, rasterSha256: c.rasterSha256,
    inputSha256: c.inputSha256, labelSha256: c.labelSha256, costReconciled: true, provenance: 'SYNTHETIC_OFFLINE', benchmark: audit });
  return attempt;
}
function firstResult(f: Fixture, caseIndex = 6) { return buildMonaco50BenchmarkReport(f).cases[caseIndex]; }
function tool(f: Fixture, name: Monaco50Tool, caseIndex = 6) {
  const result = firstResult(f, caseIndex);
  assert.equal(result.status, 'MEASURED', JSON.stringify(result));
  return result.tools!.find(t => t.tool === name)!;
}
function approval(f: Fixture): Monaco50ProtocolReview {
  return { ...hashes(f), documentSha256: hash('MOCK-NOT-HUMAN-APPROVAL'), reviewer: 'synthetic-reviewer', independent: true, disposition: 'APPROVED',
    candidateSha, model: f.protocol.model, approvedAt: '2026-01-01T12:00:00.000Z', validUntil: '2026-02-01T00:00:00.000Z' };
}
function replaceRaw(f: Fixture, rawResponse: Uint8Array) {
  const attempt = f.observations[0];
  f.observations[0] = { ...attempt, rawResponse, observation: { ...attempt.observation, rawResponseSha256: evidenceHash(rawResponse) } };
  f.reviewedExecutorReceipts[0] = { ...f.reviewedExecutorReceipts[0], rawResponseSha256: evidenceHash(rawResponse) };
}
function mockCorpusReview(f: Fixture, caseIndex = 6) {
  // Deliberately not a real raster/licence/annotation. Only tests the review contract.
  const c = f.manifest.cases[caseIndex], reference = f.references.cases[caseIndex], files = new Map<string, Uint8Array>();
  const put = (value: unknown) => { const valueBytes = bytes(value), h = evidenceHash(valueBytes); files.set(h, valueBytes); return h; };
  const rasterSha256 = put('SYNTHETIC-NOT-A-SCREENSHOT'), inputSha256 = put('SYNTHETIC-NOT-A-PROVIDER-INPUT');
  const labelSha256 = put({ caseId: c.caseId, rasterSha256, readable: reference.readable, features: reference.features, coverage: reference.coverage });
  const licenceSha256 = put('SYNTHETIC-NOT-A-LICENCE'), reviewSha256 = put('SYNTHETIC-NOT-A-HUMAN-REVIEW');
  f.manifest.cases[caseIndex] = { ...c, rasterSha256, inputSha256, labelSha256, licenceSha256, reviewSha256 };
  f.caseArtifacts = files;
  f.evidenceReviews = ([['LICENCE', licenceSha256], ['ANNOTATION', reviewSha256]] as const).map(([kind, documentSha256]) => ({
    kind, documentSha256, reviewer: kind === 'ANNOTATION' ? c.independentAnnotator : 'synthetic-licence-reviewer', rasterSha256, inputSha256, labelSha256,
    validUntil: '2026-02-01T00:00:00.000Z', analysisAllowed: true, providerProcessingAllowed: true, canonicalCaseAccepted: true,
  }));
  syncArtifacts(f); f.protocolReviews = [approval(f)];
}

test('prepared-only 50-case summary explicitly reports zero real progress and provider results', () => {
  const f = fixture(), s = summarizeMonaco50Progress(f.manifest);
  assert.deepEqual([s.required, s.prepared, s.developmentRequired, s.heldoutRequired], [50, 50, 6, 44]);
  assert.deepEqual([s.reviewed, s.executed, s.measured, s.passed, s.actualProviderResults, s.syntheticFixturesScored], [0, 0, 0, 0, 0, 0]);
  assert.equal(s.missingObservations, 50); assert.equal(s.unmeasured, 50); assert.equal(s.productionReady, false); assert.equal(s.dispatchAuthorised, false);
});
test('schema, split, group leakage, duplicate cases and extra cases cannot satisfy the manifest', () => {
  const f = fixture(); assert.deepEqual(checkMonaco50Manifest(f.manifest).issues, []);
  f.manifest.cases[6] = { ...f.manifest.cases[6], groupId: f.manifest.cases[0].groupId };
  assert.ok(checkMonaco50Manifest(f.manifest).issues.some(i => i.startsWith('GROUP_SPLIT_LEAKAGE')));
  f.manifest.cases[6] = { ...f.manifest.cases[0] };
  assert.ok(checkMonaco50Manifest(f.manifest).issues.some(i => i.startsWith('DUPLICATE_CASE_ID')));
  f.manifest.cases.push({ ...f.manifest.cases[49], caseId: 'extra' });
  assert.ok(checkMonaco50Manifest(f.manifest).issues.includes('EXACT_FIFTY_CASES_REQUIRED'));
  assert.ok(checkMonaco50Manifest({ ...f.manifest, schemaVersion: 1 } as unknown as Monaco50Manifest).issues.includes('SCHEMA_VERSION_2_REQUIRED'));
});
test('category allocation is exactly 15 clear patterns, 15 structure, 10 near misses and 10 phone cases', () => {
  const f = fixture(), initial = checkMonaco50Manifest(f.manifest);
  assert.deepEqual(initial.categoryCounts, { clear_pattern: 15, structure: 15, near_miss: 10, phone: 10 });
  assert.deepEqual(initial.requiredCategoryCounts, initial.categoryCounts);
  f.manifest.cases[6] = { ...f.manifest.cases[6], category: 'near_miss' }; syncArtifacts(f); observe(f);
  const changed = checkMonaco50Manifest(f.manifest);
  assert.ok(changed.issues.includes('CATEGORY_ALLOCATION_MISMATCH:clear_pattern:expected=15:actual=14'));
  assert.ok(changed.issues.includes('CATEGORY_ALLOCATION_MISMATCH:near_miss:expected=10:actual=11'));
  assert.equal(firstResult(f).status, 'UNMEASURED'); assert.equal(buildMonaco50BenchmarkReport(f).summary.status, 'INVALID');
});
test('four tools derive correct detections from full-scorer pairs with errors and latency', () => {
  const f = fixture(); observe(f);
  for (const name of MONACO50_TOOLS) {
    const t = tool(f, name); assert.deepEqual([t.tp, t.fp, t.fn], [1, 0, 0]);
    assert.deepEqual([t.pairs[0].pixel, t.pairs[0].price, t.latencyMs], [0, 0, 42]);
  }
  const r = buildMonaco50BenchmarkReport(f);
  assert.equal(r.summary.syntheticFixturesScored, 1); assert.equal(r.summary.measured, 0); assert.equal(r.summary.actualProviderResults, 0);
  assert.equal(r.cases[6].eligibleForAcceptance, false); assert.equal(r.cases[6].passed, false); assert.equal(r.acceptance, 'BLOCKED');
});
test('liquidity pools and events have separate matches, errors and absence coverage', () => {
  const f = fixture(); f.references.cases[6] = { ...f.references.cases[6], features: [feature('expected-pool', 'liquidity_pool')] }; syncArtifacts(f);
  observe(f, 6, [feature('unwitnessed-event', 'liquidity_sweep')]);
  assert.deepEqual([tool(f, 'liquidity_pool').tp, tool(f, 'liquidity_pool').fp, tool(f, 'liquidity_pool').fn], [0, 0, 1]);
  assert.deepEqual([tool(f, 'liquidity_event').tp, tool(f, 'liquidity_event').fp, tool(f, 'liquidity_event').fn], [0, 1, 0]);
  assert.equal(tool(f, 'liquidity_event').correctAbstention, false);
  f.observations = []; f.reviewedExecutorReceipts = []; observe(f, 6, [feature('observed-pool', 'liquidity_pool')]);
  assert.equal(tool(f, 'liquidity_pool').tp, 1); assert.equal(tool(f, 'liquidity_event').correctAbstention, true);
  assert.deepEqual(buildMonaco50BenchmarkReport(f).summary.byTool.map(t => t.tool), ['pattern', 'level', 'liquidity_pool', 'liquidity_event']);
});
test('all wrong and duplicate hypotheses remain visible in per-tool FP/FN and price errors', () => {
  const f = fixture(), predictions = [feature('right-pattern', 'pattern_double_top'), feature('wrong-level', 'level_support', 10, 150), feature('duplicate-level', 'level_support', 10, 150)];
  observe(f, 6, predictions);
  assert.deepEqual([tool(f, 'pattern').tp, tool(f, 'pattern').fp, tool(f, 'pattern').fn], [1, 0, 0]);
  assert.deepEqual([tool(f, 'level').tp, tool(f, 'level').fp, tool(f, 'level').fn], [0, 2, 1]);
  assert.equal(tool(f, 'level').nearestErrors[0].nearestPriceError, 50);
  assert.deepEqual([tool(f, 'liquidity_pool').tp, tool(f, 'liquidity_pool').fp, tool(f, 'liquidity_pool').fn], [0, 0, 1]);
  assert.deepEqual([tool(f, 'liquidity_event').tp, tool(f, 'liquidity_event').fp, tool(f, 'liquidity_event').fn], [0, 0, 1]);
  assert.deepEqual(firstResult(f).hypotheses, predictions);
});
test('maximum-cardinality matching is reused across crossing edges; duplicates count once', () => {
  const f = fixture(); f.references.cases[6] = { ...f.references.cases[6], features: [feature('a', 'level_support', 10), feature('b', 'level_support', 12)] }; syncArtifacts(f);
  observe(f, 6, [feature('flexible', 'level_support', 11), feature('restricted', 'level_support', 8), feature('duplicate', 'level_support', 11)]);
  const t = tool(f, 'level'); assert.deepEqual([t.tp, t.fp, t.fn], [2, 1, 0]); assert.equal(new Set(t.pairs.map(p => p.expectedId)).size, 2);
});
test('tool labels cannot cross-match geometrically identical pattern and support hypotheses', () => {
  const f = fixture(); f.references.cases[6] = { ...f.references.cases[6], features: [feature('expected-level')] }; syncArtifacts(f);
  observe(f, 6, [feature('wrong-tool', 'pattern_double_top')]);
  assert.deepEqual([tool(f, 'pattern').tp, tool(f, 'pattern').fp], [0, 1]); assert.deepEqual([tool(f, 'level').tp, tool(f, 'level').fn], [0, 1]);
});
test('complete no-pattern reference permits a pattern abstention while levels remain positive', () => {
  const f = fixture(); f.references.cases[6] = { ...f.references.cases[6], features: [feature('expected-level')] }; syncArtifacts(f); observe(f);
  assert.equal(tool(f, 'pattern').correctAbstention, true); assert.equal(tool(f, 'level').correctAbstention, null); assert.equal(tool(f, 'level').tp, 1);
  f.observations = []; f.reviewedExecutorReceipts = []; observe(f, 6, []);
  assert.equal(tool(f, 'pattern').correctAbstention, true); assert.equal(tool(f, 'level').fn, 1); assert.equal(tool(f, 'level').correctAbstention, null);
});
test('complete all-negative reference needs explicit global noSignal for empty all-tool abstention', () => {
  const f = fixture(); f.references.cases[6] = { ...f.references.cases[6], features: [] }; syncArtifacts(f); observe(f, 6, []);
  for (const t of firstResult(f).tools!) { assert.equal(t.correctAbstention, true); assert.equal(t.precision, null); assert.equal(t.recall, null); }
  f.observations[0] = { ...f.observations[0], observation: { ...f.observations[0].observation, noSignal: false } }; replaceRaw(f, bytes({ features: [], noSignal: false }));
  for (const t of firstResult(f).tools!) assert.equal(t.correctAbstention, false);
});
test('an unreadable reference is unmeasurable even with complete empty coverage and noSignal', () => {
  const f = fixture(); f.references.cases[6] = { ...f.references.cases[6], readable: false, features: [] }; syncArtifacts(f); observe(f, 6, []);
  const r = firstResult(f), summary = buildMonaco50BenchmarkReport(f).summary;
  assert.equal(r.status, 'UNMEASURED'); assert.equal(r.reason, 'UNREADABLE_REFERENCE'); assert.equal(r.technicalFailure, false);
  assert.equal(r.tools, null); assert.equal(r.passed, false); assert.equal(summary.unreadableCases, 1);
  assert.equal(summary.syntheticFixturesScored, 0); assert.ok(summary.byTool.every(t => t.correctAbstentions === 0));
});
test('unreviewed reference readability cannot become an empty true negative', () => {
  const f = fixture(); f.references.cases[6] = { ...f.references.cases[6], readable: null, features: [] }; syncArtifacts(f); observe(f, 6, []);
  const r = firstResult(f); assert.equal(r.status, 'UNMEASURED'); assert.equal(r.reason, 'REFERENCE_READABILITY_UNREVIEWED'); assert.equal(r.tools, null);
});
test('explicit unreadable observation and receipt-bound raw unreadability never become true negatives', () => {
  const f = fixture(); f.references.cases[6] = { ...f.references.cases[6], features: [] }; syncArtifacts(f); observe(f, 6, [], { status: 'UNREADABLE' });
  const g = fixture(); g.references.cases[6] = { ...g.references.cases[6], features: [] }; syncArtifacts(g); observe(g, 6, []);
  replaceRaw(g, bytes({ features: [], noSignal: true, readable: false }));
  for (const sample of [f, g]) {
    const r = firstResult(sample), summary = buildMonaco50BenchmarkReport(sample).summary;
    assert.equal(r.status, 'UNMEASURED'); assert.equal(r.reason, 'UNREADABLE'); assert.equal(r.technicalFailure, false);
    assert.equal(r.tools, null); assert.equal(r.passed, false); assert.equal(summary.unreadableCases, 1); assert.equal(summary.syntheticFixturesScored, 0);
    assert.ok(summary.byTool.every(t => t.correctAbstentions === 0));
  }
});
for (const coverage of ['partial', 'unknown', undefined] as const) test(`reference ${coverage} cannot manufacture FP/FN/abstention metrics`, () => {
  const f = fixture(); f.references.cases[6] = { ...f.references.cases[6], features: [], coverage: coverage ? { pattern: coverage } : {} }; syncArtifacts(f); observe(f, 6, []);
  const t = tool(f, 'pattern'); assert.equal(t.correctAbstention, null); assert.equal(t.fp, null); assert.equal(t.fn, null); assert.equal(t.precision, null); assert.equal(t.recall, null);
  assert.equal(firstResult(f).eligibleForAcceptance, false);
});
test('partial references retain unmatched hypotheses without declaring them false positives', () => {
  const f = fixture(); f.references.cases[6] = { ...f.references.cases[6], features: [], coverage: { pattern: 'partial' } }; syncArtifacts(f);
  observe(f, 6, [feature('uncertain', 'pattern_double_top')]); const t = tool(f, 'pattern');
  assert.equal(t.fp, null); assert.deepEqual(t.unmatchedPredictionIds, ['uncertain']); assert.equal(t.correctAbstention, null);
});
test('unmapped hypotheses block scoring and remain retained rather than being filtered', () => {
  const f = fixture(), prediction = feature('unmapped', 'unknown_tool'); observe(f, 6, [prediction]);
  const r = firstResult(f); assert.equal(r.status, 'UNMEASURED'); assert.equal(r.reason, 'UNMAPPED_FEATURE_LABEL'); assert.deepEqual(r.hypotheses, [prediction]); assert.equal(r.tools, null);
});
test('safe explicit label map preserves the existing strict label validator', () => {
  const f = fixture(); f.protocol = { ...f.protocol, labelToTool: { 'pattern:double_top': 'pattern' } }; syncArtifacts(f); observe(f, 6, [feature('bad', 'pattern:double_top')]);
  assert.equal(firstResult(f).status, 'UNMEASURED'); assert.equal(firstResult(f).reason, 'INVALID_PROTOCOL');
});
test('post-hoc hypothesis removal disagrees with retained raw response and is unmeasured', () => {
  const f = fixture(); observe(f); const a = f.observations[0]; f.observations[0] = { ...a, observation: { ...a.observation, features: a.observation.features.slice(0, 1) } };
  const r = firstResult(f); assert.equal(r.status, 'UNMEASURED'); assert.equal(r.reason, 'RAW_OBSERVATION_MISMATCH'); assert.equal(r.tools, null);
});
test('malformed raw JSON is a technical failure, never a successful or negative result', () => {
  for (const raw of ['{', 'null', '[]', 'true', '{}', '{"features":null,"noSignal":false}']) {
    const f = fixture(); observe(f); replaceRaw(f, Buffer.from(raw));
    const r = firstResult(f); assert.equal(r.status, 'UNMEASURED'); assert.equal(r.technicalFailure, true, raw); assert.equal(r.tools, null); assert.equal(r.passed, false);
  }
});
for (const status of ['TRANSPORT_ERROR', 'HOLD', 'CANCELLED'] as const) test(`${status} remains unmeasured and cannot become negative/FN`, () => {
  const f = fixture(); observe(f, 6, [], { status }); const r = firstResult(f);
  assert.equal(r.status, 'UNMEASURED'); assert.equal(r.reason, status); assert.equal(r.tools, null); assert.equal(r.passed, false);
  assert.equal(r.technicalFailure, status === 'TRANSPORT_ERROR'); const summary = buildMonaco50BenchmarkReport(f).summary;
  assert.equal(summary.measured, 0); assert.ok(summary.byTool.every(t => t.technicalFailures === (status === 'TRANSPORT_ERROR' ? 1 : 0)));
});
for (const [name, patch] of [
  ['coordinates', { features: [feature('bad', 'level_support', 200)] }], ['contradictory noSignal', { noSignal: true }],
  ['latency', { latencyMs: NaN }], ['request ID', { requestId: '' }], ['candidate SHA', { candidateSha: 'b'.repeat(40) }],
  ['model', { model: 'wrong' }], ['raw hash', { rawResponseSha256: hash('wrong-raw') }], ['label hash', { labelSha256: hash('wrong-label') }],
] as const) test(`malformed/provenance mismatch ${name} stays unmeasured`, () => {
  const f = fixture(); observe(f); f.observations[0] = { ...f.observations[0], observation: { ...f.observations[0].observation, ...patch } };
  const r = firstResult(f); assert.equal(r.status, 'UNMEASURED'); assert.equal(r.tools, null); assert.equal(r.passed, false);
});
for (const [name, patch] of [
  ['unreconciled cost', { costReconciled: false }], ['wrong model', { model: 'wrong' }], ['wrong case', { caseId: 'synthetic-0' }],
  ['wrong candidate', { candidateSha: 'b'.repeat(40) }], ['wrong request', { requestId: 'wrong' }],
  ['wrong raw response', { rawResponseSha256: hash('wrong') }], ['wrong raster', { rasterSha256: hash('wrong') }],
  ['wrong input', { inputSha256: hash('wrong') }], ['wrong label', { labelSha256: hash('wrong') }],
] as const) test(`existing receipt scope rejects ${name}`, () => {
  const f = fixture(); observe(f); f.reviewedExecutorReceipts[0] = { ...f.reviewedExecutorReceipts[0], ...patch };
  assert.equal(firstResult(f).status, 'UNMEASURED'); assert.equal(firstResult(f).reason, 'EXECUTOR_RECEIPT_SCOPE_MISMATCH');
});
test('missing or duplicate receipt cannot substitute for genuine retained execution evidence', () => {
  const f = fixture(); observe(f); f.reviewedExecutorReceipts.push(f.reviewedExecutorReceipts[0]);
  assert.equal(firstResult(f).reason, 'EXECUTOR_BENCHMARK_SCOPE_MISMATCH'); f.reviewedExecutorReceipts = []; assert.equal(firstResult(f).status, 'UNMEASURED');
});
test('self-declared REVIEWED status cannot approve protocol; exact external review still cannot turn fixtures into passes', () => {
  const f = fixture(); f.protocol = { ...f.protocol, status: 'REVIEWED' }; syncArtifacts(f); observe(f);
  assert.equal(buildMonaco50BenchmarkReport(f).protocolReviewed, false);
  f.protocolReviews = [approval(f)]; const r = buildMonaco50BenchmarkReport(f);
  assert.equal(r.protocolReviewed, true); assert.equal(r.cases[6].reviewed, false); assert.equal(r.cases[6].passed, false); assert.equal(r.summary.actualProviderResults, 0); assert.equal(r.acceptance, 'BLOCKED');
});
test('independent corpus/licence review and hash-bound tool coverage remain required even with protocol review', () => {
  const f = fixture(); mockCorpusReview(f); observe(f);
  assert.equal(firstResult(f).reviewed, true); assert.equal(firstResult(f).passed, false); assert.equal(buildMonaco50BenchmarkReport(f).summary.actualProviderResults, 0);
  f.evidenceReviews = f.evidenceReviews!.map(r => ({ ...r, providerProcessingAllowed: false })); assert.equal(firstResult(f).reviewed, false);
  const g = fixture(); mockCorpusReview(g); observe(g); g.caseArtifacts = new Map(g.caseArtifacts).set(g.manifest.cases[6].labelSha256, Buffer.from('tampered'));
  assert.equal(firstResult(g).reviewed, false);
  const h = fixture(); mockCorpusReview(h); h.references.cases[6] = { ...h.references.cases[6], coverage: { pattern: 'partial' } }; syncArtifacts(h); h.protocolReviews = [approval(h)]; observe(h);
  assert.equal(firstResult(h).reviewed, false);
});
for (const key of ['datasetSha256', 'referencesSha256', 'scannerSourceSha256', 'protocolSha256'] as const) test(`protocol review must bind exact ${key}`, () => {
  const f = fixture(); observe(f); f.protocolReviews = [{ ...approval(f), [key]: hash('wrong-scope') }];
  const r = buildMonaco50BenchmarkReport(f); assert.equal(r.protocolReviewed, false); assert.equal(r.acceptance, 'BLOCKED'); assert.equal(r.summary.passed, 0);
});
test('stale and ambiguous approval records fail closed', () => {
  const f = fixture(); observe(f); f.protocolReviews = [{ ...approval(f), validUntil: freezeTime }]; assert.equal(buildMonaco50BenchmarkReport(f).protocolReviewed, false);
  f.protocolReviews = [approval(f), approval(f)]; assert.equal(buildMonaco50BenchmarkReport(f).protocolReviewed, false);
});
test('mutated artifact object or scanner bytes cannot reuse the frozen version', () => {
  const f = fixture(); observe(f); f.protocol = { ...f.protocol, pixelTolerance: 60 };
  assert.equal(firstResult(f).reason, 'ARTIFACT_OBJECT_MISMATCH');
  const g = fixture(); observe(g); g.artifacts.scannerSource = Buffer.from('SYNTHETIC ALTERED SOURCE'); assert.equal(firstResult(g).reason, 'EXACT_ARTIFACT_FREEZE_REQUIRED');
});
test('freeze after any retained observation invalidates the entire heldout report, including development history', () => {
  const f = fixture(); observe(f, 0); observe(f, 6);
  f.observations[0].audit.startedAt = '2025-12-31T00:00:00.000Z';
  const r = buildMonaco50BenchmarkReport(f); assert.equal(r.historyFrozen, false); assert.equal(r.cases[6].status, 'UNMEASURED');
  assert.equal(r.cases[6].reason, 'OBSERVATION_HISTORY_PRECEDES_OR_DIFFERS_FROM_FREEZE');
});
test('execution audit version mismatch and receipt audit mismatch are not unseen measurements', () => {
  const f = fixture(); observe(f); f.observations[0] = { ...f.observations[0], audit: { ...f.observations[0].audit, scannerSourceSha256: hash('old-scanner') } };
  assert.equal(firstResult(f).reason, 'OBSERVATION_HISTORY_PRECEDES_OR_DIFFERS_FROM_FREEZE');
  const g = fixture(); observe(g); g.reviewedExecutorReceipts[0] = { ...g.reviewedExecutorReceipts[0], benchmark: { ...g.reviewedExecutorReceipts[0].benchmark, attemptNumber: 2 } };
  assert.equal(firstResult(g).reason, 'EXECUTOR_BENCHMARK_SCOPE_MISMATCH');
});
for (const exposure of ['RERUN', 'TUNED'] as const) test(`heldout ${exposure} is refused rather than silently called unseen`, () => {
  const f = fixture(); const a = observe(f); a.audit.exposure = exposure; a.audit.attemptNumber = 2;
  assert.equal(firstResult(f).reason, 'HELDOUT_RERUN_OR_TUNING'); assert.equal(firstResult(f).status, 'UNMEASURED');
});
test('multiple heldout observations and reused request IDs are refused', () => {
  const f = fixture(); observe(f); observe(f); assert.equal(firstResult(f).reason, 'HELDOUT_REPEATED_OBSERVATION');
  const g = fixture(); observe(g, 6); observe(g, 7, allFeatures(), { requestId: g.observations[0].observation.requestId });
  assert.equal(firstResult(g).reason, 'REUSED_REQUEST_ID'); assert.equal(firstResult(g, 7).reason, 'REUSED_REQUEST_ID');
});
test('all fifty synthetic regressions remain zero actual provider measurements and zero passes', () => {
  const f = fixture(); for (let i = 0; i < 50; i++) observe(f, i);
  const r = buildMonaco50BenchmarkReport(f); assert.equal(r.summary.syntheticFixturesScored, 50);
  assert.deepEqual([r.summary.prepared, r.summary.reviewed, r.summary.executed, r.summary.measured, r.summary.passed, r.summary.actualProviderResults], [50, 0, 0, 0, 0, 0]);
  assert.equal(r.acceptance, 'BLOCKED'); assert.equal(r.dispatchAuthorised, false); assert.equal(r.productionReady, false);
});
