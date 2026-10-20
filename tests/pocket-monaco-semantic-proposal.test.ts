/** SYNTHETIC CODE REGRESSIONS ONLY: no provider calls, human approvals, spend, or accuracy evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evidenceHash } from '../scripts/pocket-monaco-measurement.ts';
import type { CorpusCase, Feature, RecordedObservation, scoreMonacoObservation } from '../scripts/pocket-monaco-measurement.ts';
import { DRAFT_MONACO_SEMANTIC_RULES, normalizeMonacoSemanticEnvelope, scoreMonacoSemanticProposal } from '../scripts/pocket-monaco-semantic-proposal.ts';
import type { MonacoSemanticContext, MonacoSemanticEnvelope, MonacoSemanticFact, MonacoSemanticReview } from '../scripts/pocket-monaco-semantic-proposal.ts';
import type { Monaco50Tool } from '../scripts/pocket-monaco-benchmark50-report.ts';

const hash = (s: string) => evidenceHash('SYNTHETIC-ONLY:' + s), bytes = (v: unknown) => Buffer.from(JSON.stringify(v));
const feature = (id: string, label: string, x: number, prices = [100]): Feature => ({ id, label, pixels: [{ x, y: 20 }], prices });
const labelToTool = { pattern_range: 'pattern', level_support: 'level', pool_highs: 'liquidity_pool', event_sweep: 'liquidity_event' } as const;
type Fixture = { reference: CorpusCase; observation: RecordedObservation; measurement: Parameters<typeof scoreMonacoObservation>[2];
  context: MonacoSemanticContext; expected: MonacoSemanticEnvelope; predicted: MonacoSemanticEnvelope; rawReadable?: boolean };
function fixture(): Fixture {
  const features: Feature[] = [{ id: 'pattern', label: 'pattern_range', pixels: [{ x: 5, y: 20 }, { x: 10, y: 30 }, { x: 15, y: 20 }], prices: [100, 99, 100] },
    feature('level', 'level_support', 20), feature('pool', 'pool_highs', 40, [110]), feature('event', 'event_sweep', 80, [109])];
  const facts: MonacoSemanticFact[] = [
    { featureId: 'pattern', tool: 'pattern', assertion: 'ASSERTED', side: 'NEUTRAL', witnessBars: [1, 2, 3], priceKind: 'ANCHORS', status: 'FORMING', formationComplete: true, confirmation: null, invalidationBar: null, extensionBar: null },
    { featureId: 'level', tool: 'level', assertion: 'ASSERTED', side: 'SUPPORT', witnessBars: [4, 6], priceKind: 'POINT' },
    { featureId: 'pool', tool: 'liquidity_pool', assertion: 'ASSERTED', side: 'BUY_SIDE', witnessBars: [3, 5], priceKind: 'POINT', basis: 'EQUAL_HIGHS' },
    { featureId: 'event', tool: 'liquidity_event', assertion: 'ASSERTED', side: 'BUY_SIDE', witnessBars: [8, 9], priceKind: 'POINT', event: 'SWEEP', poolFeatureId: 'pool',
      steps: [{ kind: 'BREACH', bar: 8, price: 111, close: false }, { kind: 'RETURN', bar: 9, price: 109, close: true }] },
  ];
  const context: MonacoSemanticContext = { rules: { ...structuredClone(DRAFT_MONACO_SEMANTIC_RULES),
    patternRules: { pattern_range: { minimumAnchors: 3, direction: 'NEUTRAL', confirmationKind: 'BOUNDARY_BREAK' } },
    instrumentRules: [{ instrument: 'SYNTHETIC', priceUnit: 'test_points', tickSize: 0.25, maxPriceErrorTicks: 1, pixelTolerance: 2, maxBarError: 0 }] },
    rulesBytes: Buffer.alloc(0), normalizerSourceBytes: readFileSync(new URL('../scripts/pocket-monaco-semantic-proposal.ts', import.meta.url)), referenceArtifact: Buffer.alloc(0), labelToTool,
    scope: { datasetSha256: hash('dataset'), referencesSha256: hash('references'), scannerSourceSha256: hash('scanner'), protocolSha256: hash('protocol'),
      rulesSha256: hash('rules'), normalizerSourceSha256: hash('normalizer'), candidateSha: 'a'.repeat(40), model: 'synthetic-no-provider', frozenAt: '2026-01-01T00:00:00Z' },
    observationStartedAt: '2026-01-02T00:00:00Z', now: Date.parse('2026-01-03T00:00:00Z') };
  const expected: MonacoSemanticEnvelope = { schemaVersion: 1, rulesSha256: hash('rules'), caseId: 'synthetic', instrument: 'SYNTHETIC', priceUnit: 'test_points', barCount: 20, readable: true,
    tools: { pattern: { state: 'POSITIVE', complete: true }, level: { state: 'POSITIVE', complete: true }, liquidity_pool: { state: 'POSITIVE', complete: true }, liquidity_event: { state: 'POSITIVE', complete: true } }, facts };
  const predicted: MonacoSemanticEnvelope = { ...structuredClone(expected), tools: { pattern: { state: 'ASSERTIONS' }, level: { state: 'ASSERTIONS' }, liquidity_pool: { state: 'ASSERTIONS' }, liquidity_event: { state: 'ASSERTIONS' } } };
  const reference: CorpusCase = { caseId: 'synthetic', scenario: 'synthetic-regression', timeframe: '5m', instrument: 'SYNTHETIC', width: 100, height: 100,
    rasterSha256: hash('raster'), inputSha256: hash('input'), labelSha256: hash('label'), licenceSha256: hash('not-a-licence'), reviewSha256: hash('not-a-human-review'),
    primaryAnnotator: 'synthetic-first', independentAnnotator: 'synthetic-second', negative: false, features };
  const observation: RecordedObservation = { caseId: reference.caseId, rasterSha256: reference.rasterSha256, inputSha256: reference.inputSha256, labelSha256: reference.labelSha256,
    candidateSha: 'a'.repeat(40), model: 'synthetic-no-provider', requestId: 'SYNTHETIC-NOT-PROVIDER-REQUEST', executorReceiptSha256: hash('mock-receipt'),
    rawResponseSha256: hash('raw'), status: 'COMPLETED', latencyMs: 12, noSignal: false, features: structuredClone(features) };
  const f: Fixture = { reference, observation, context, expected, predicted, measurement: { candidateSha: observation.candidateSha, model: observation.model,
    reviewedExecutorReceipts: [], rawResponse: Buffer.alloc(0), pixelTolerance: 2, priceTolerance: 2 } };
  refresh(f); return f;
}
function refresh(f: Fixture) {
  f.context.rulesBytes = bytes(f.context.rules); const rulesSha256 = evidenceHash(f.context.rulesBytes);
  f.expected.rulesSha256 = rulesSha256; f.predicted.rulesSha256 = rulesSha256;
  f.context.referenceArtifact = bytes({ caseId: f.reference.caseId, rasterSha256: f.reference.rasterSha256, features: f.reference.features, semantic: f.expected });
  f.reference = { ...f.reference, labelSha256: evidenceHash(f.context.referenceArtifact) };
  f.measurement.rawResponse = bytes({ features: f.observation.features, noSignal: f.observation.noSignal, semantic: f.predicted, ...(f.rawReadable === undefined ? {} : { readable: f.rawReadable }) });
  f.observation = { ...f.observation, labelSha256: f.reference.labelSha256, rawResponseSha256: evidenceHash(f.measurement.rawResponse) };
  f.context.scope = { ...f.context.scope, referencesSha256: evidenceHash(f.context.referenceArtifact), rulesSha256, normalizerSourceSha256: evidenceHash(f.context.normalizerSourceBytes) };
  f.measurement.reviewedExecutorReceipts = [{ receiptSha256: f.observation.executorReceiptSha256, caseId: f.reference.caseId, requestId: f.observation.requestId,
    candidateSha: f.observation.candidateSha, model: f.observation.model, rawResponseSha256: f.observation.rawResponseSha256,
    rasterSha256: f.reference.rasterSha256, inputSha256: f.reference.inputSha256, labelSha256: f.reference.labelSha256, costReconciled: true, provenance: 'SYNTHETIC_OFFLINE' }];
}
const result = (f: Fixture) => scoreMonacoSemanticProposal(f.reference, f.observation, f.measurement, f.context);
function tool(f: Fixture, name: Monaco50Tool) { const r = result(f); assert.equal(r.status, 'DIAGNOSTIC_SCORED', JSON.stringify(r)); return r.tools!.find(t => t.tool === name)!; }
function changeFact(f: Fixture, which: 'expected' | 'predicted', featureId: string, patch: Partial<MonacoSemanticFact>) {
  f[which].facts = f[which].facts.map(fact => fact.featureId === featureId ? { ...fact, ...patch } : fact);
}
function omit(f: Fixture, which: 'expected' | 'predicted', featureId: string) {
  f[which].facts = f[which].facts.filter(fact => fact.featureId !== featureId);
  if (which === 'expected') f.reference = { ...f.reference, features: f.reference.features.filter(feature => feature.id !== featureId) };
  else f.observation = { ...f.observation, features: f.observation.features.filter(feature => feature.id !== featureId) };
}
function mockReview(f: Fixture): MonacoSemanticReview { return { ...f.context.scope, documentSha256: hash('MOCK-NOT-HUMAN-REVIEW'), reviewer: 'synthetic-reviewer',
  independent: true, disposition: 'APPROVED', approvedAt: '2026-01-01T12:00:00Z', validUntil: '2026-02-01T00:00:00Z' }; }

test('four semantic tools reuse geometric pairs but DRAFT remains blocked with zero provider evidence', () => {
  const f = fixture(), r = result(f); assert.equal(r.status, 'DIAGNOSTIC_SCORED'); assert.equal(r.geometry!.provenance, 'SYNTHETIC_OFFLINE');
  assert.deepEqual(r.tools!.map(t => [t.tp, t.fp, t.fn]), [[1, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]]);
  assert.equal(r.acceptance, 'BLOCKED'); assert.equal(r.passed, false); assert.equal(r.dispatchAuthorised, false);
  assert.ok(r.blockers.includes('EXACT_INDEPENDENT_SEMANTIC_RULE_REVIEW_REQUIRED'));
});
test('complete geometry without confirmation remains FORMING and cannot match a CONFIRMED reference semantically', () => {
  const f = fixture(); changeFact(f, 'expected', 'pattern', { status: 'CONFIRMED', confirmation: { kind: 'BOUNDARY_BREAK', bar: 7, closeBeyond: true } }); refresh(f);
  assert.equal(result(f).geometry!.tp, 4); const t = tool(f, 'pattern'); assert.deepEqual([t.tp, t.fp, t.fn], [0, 1, 1]);
  assert.ok(t.pairs[0].semanticIssues.includes('PATTERN_STATUS_MISMATCH')); assert.ok(t.pairs[0].semanticIssues.includes('CONFIRMATION_BAR_MISMATCH'));
});
test('a confirmation string or status without a later visible completion witness cannot earn semantic credit', () => {
  const f = fixture(); changeFact(f, 'predicted', 'pattern', { status: 'CONFIRMED' }); refresh(f);
  assert.ok(tool(f, 'pattern').pairs[0].semanticIssues.includes('COMPLETION_AND_CONFIRMATION_REQUIRED'));
  changeFact(f, 'predicted', 'pattern', { confirmation: { kind: 'BOUNDARY_BREAK', bar: 2, closeBeyond: false } }); refresh(f);
  assert.ok(tool(f, 'pattern').pairs[0].semanticIssues.includes('CONFIRMATION_NOT_VISIBLY_SUPPORTED'));
});
for (const [status, patch, issue] of [
  ['FAILED', { invalidationBar: 2 }, 'VISIBLE_LATER_INVALIDATION_REQUIRED'],
  ['EXTENDED', { confirmation: { kind: 'BOUNDARY_BREAK', bar: 7, closeBeyond: true }, extensionBar: 6 }, 'VISIBLE_LATER_EXTENSION_REQUIRED'],
] as const) test(`${status} needs its own correctly ordered visible evidence`, () => {
  const f = fixture(); changeFact(f, 'predicted', 'pattern', { status, ...patch }); refresh(f); assert.ok(tool(f, 'pattern').pairs[0].semanticIssues.includes(issue));
});
test('level side and liquidity basis side are separate scored claims', () => {
  const f = fixture(); changeFact(f, 'predicted', 'level', { side: 'RESISTANCE' }); changeFact(f, 'predicted', 'pool', { side: 'SELL_SIDE' }); refresh(f);
  assert.ok(tool(f, 'level').pairs[0].semanticIssues.includes('SIDE_MISMATCH')); assert.ok(tool(f, 'liquidity_pool').pairs[0].semanticIssues.includes('POOL_BASIS_SIDE_MISMATCH'));
});
test('same-bar and before-pool liquidity order cannot be invented from a screenshot', () => {
  for (const bars of [[8, 8], [4, 9], [9, 8]]) {
    const f = fixture(), event = f.predicted.facts.find(x => x.featureId === 'event')!;
    changeFact(f, 'predicted', 'event', { steps: event.steps!.map((s, i) => ({ ...s, bar: bars[i] })) }); refresh(f);
    assert.ok(tool(f, 'liquidity_event').pairs[0].semanticIssues.includes('EVENT_ORDER_UNPROVEN'));
  }
});
test('reclaim needs an explicit close back through the same-side pool', () => {
  const f = fixture(), event = f.predicted.facts.find(x => x.featureId === 'event')!;
  changeFact(f, 'predicted', 'event', { event: 'RECLAIM', steps: event.steps!.map(s => ({ ...s, close: false })) }); refresh(f);
  assert.ok(tool(f, 'liquidity_event').pairs[0].semanticIssues.includes('RECLAIM_REQUIRES_CLOSE_BACK_THROUGH_LEVEL'));
});
test('rejection is a test then reaction, and cannot silently reuse a sweep sequence', () => {
  const f = fixture(); changeFact(f, 'predicted', 'event', { event: 'REJECTION' }); refresh(f);
  assert.ok(tool(f, 'liquidity_event').pairs[0].semanticIssues.includes('EVENT_STEP_SEQUENCE_MISMATCH'));
  const steps = [{ kind: 'TEST', bar: 8, price: 110, close: false }, { kind: 'REACTION', bar: 9, price: 109, close: true }] as const;
  changeFact(f, 'expected', 'event', { event: 'REJECTION', steps }); changeFact(f, 'predicted', 'event', { event: 'REJECTION', steps }); refresh(f);
  assert.equal(tool(f, 'liquidity_event').tp, 1);
});
test('an event without its retained pool cannot gain semantic credit', () => {
  const f = fixture(); omit(f, 'predicted', 'pool'); f.predicted.tools.liquidity_pool.state = 'NO_SIGNAL'; refresh(f);
  assert.ok(tool(f, 'liquidity_event').pairs[0].semanticIssues.includes('VALID_SAME_SIDE_POOL_REQUIRED'));
});
test('event witness prices and bars are compared separately from event geometry', () => {
  const f = fixture(), event = f.predicted.facts.find(x => x.featureId === 'event')!;
  changeFact(f, 'predicted', 'event', { witnessBars: [7, 9], steps: event.steps!.map((s, i) => i ? s : { ...s, price: 112 }) }); refresh(f);
  const issues = tool(f, 'liquidity_event').pairs[0].semanticIssues;
  assert.ok(issues.includes('EVENT_STEP_PRICE_TOLERANCE_EXCEEDED')); assert.ok(issues.includes('WITNESS_BAR_MISMATCH'));
});
test('instrument ticks can tighten price matching without changing the old scorer threshold', () => {
  const f = fixture(); f.observation = { ...f.observation, features: f.observation.features.map(x => x.id === 'level' ? { ...x, prices: [100.5] } : x) }; refresh(f);
  assert.equal(result(f).geometry!.tp, 4); assert.equal(f.measurement.priceTolerance, 2); const t = tool(f, 'level');
  assert.equal(t.pairs[0].priceErrorTicks, 2); assert.ok(t.pairs[0].semanticIssues.includes('INSTRUMENT_PRICE_TOLERANCE_EXCEEDED')); assert.equal(t.tp, 0);
});
test('missing instrument units or tolerance never get guessed', () => {
  const f = fixture(); f.context.rules.instrumentRules = []; refresh(f); assert.equal(result(f).reason, 'REVIEWABLE_INSTRUMENT_TOLERANCE_MISSING');
  const g = fixture(); g.predicted.priceUnit = 'wrong_units'; refresh(g); assert.equal(result(g).reason, 'SEMANTIC_CASE_INSTRUMENT_OR_RULE_MISMATCH');
});
test('proposed price and pixel tolerances cannot relax the existing limits', () => {
  for (const patch of [{ maxPriceErrorTicks: 20 }, { pixelTolerance: 3 }]) {
    const f = fixture(); f.context.rules.instrumentRules = f.context.rules.instrumentRules.map(i => ({ ...i, ...patch })); refresh(f);
    assert.equal(result(f).reason, 'PROPOSED_TOLERANCE_WOULD_RELAX_EXISTING_RULE');
  }
});
test('normalization preserves every hypothesis and rejects missing semantic associations', () => {
  const f = fixture(); f.predicted.facts = f.predicted.facts.slice(1); refresh(f);
  const r = result(f); assert.equal(r.status, 'UNMEASURED'); assert.equal(r.retainedHypotheses.length, 4);
  assert.equal(r.reason, 'OBSERVATION:MALFORMED_SEMANTIC_ENVELOPE');
});
test('no pattern can be a target negative while support and liquidity remain positive', () => {
  const f = fixture(); omit(f, 'expected', 'pattern'); omit(f, 'predicted', 'pattern'); f.expected.tools.pattern.state = 'NEGATIVE'; f.predicted.tools.pattern.state = 'NO_SIGNAL'; refresh(f);
  assert.equal(tool(f, 'pattern').strictNegativeSuccess, true); assert.equal(tool(f, 'level').tp, 1); assert.equal(f.reference.negative, false); assert.equal(f.observation.noSignal, false);
});
test('an untriggered pool can be positive while the event target is negative', () => {
  const f = fixture(); omit(f, 'expected', 'event'); omit(f, 'predicted', 'event'); f.expected.tools.liquidity_event.state = 'NEGATIVE'; f.predicted.tools.liquidity_event.state = 'NO_SIGNAL'; refresh(f);
  assert.equal(tool(f, 'liquidity_pool').tp, 1); assert.equal(tool(f, 'liquidity_event').strictNegativeSuccess, true);
});
test('abstention on a readable negative is recorded separately and is not true-negative success', () => {
  const f = fixture(); omit(f, 'expected', 'pattern'); omit(f, 'predicted', 'pattern'); f.expected.tools.pattern.state = 'NEGATIVE'; f.predicted.tools.pattern.state = 'ABSTAIN'; refresh(f);
  const t = tool(f, 'pattern'); assert.equal(t.strictNegativeSuccess, false); assert.equal(t.abstained, true); assert.equal(t.falsePositiveNegative, false);
});
test('named ambiguous hypotheses are retained as unsupported assertions and cannot manufacture a negative pass', () => {
  const f = fixture(); omit(f, 'expected', 'pattern'); f.expected.tools.pattern.state = 'NEGATIVE'; f.predicted.tools.pattern.state = 'ABSTAIN';
  changeFact(f, 'predicted', 'pattern', { status: 'AMBIGUOUS', assertion: 'AMBIGUOUS' }); refresh(f);
  const t = tool(f, 'pattern'); assert.equal(t.strictNegativeSuccess, false); assert.equal(t.fp, 1); assert.equal(t.abstained, true); assert.equal(t.unsupportedAssertions.length, 1);
  assert.equal(result(f).retainedHypotheses.length, 4);
});
test('completed no-signal output against a positive target is FN plus abstention', () => {
  const f = fixture(); omit(f, 'predicted', 'pattern'); f.predicted.tools.pattern.state = 'NO_SIGNAL'; refresh(f);
  const t = tool(f, 'pattern'); assert.equal(t.fn, 1); assert.equal(t.abstained, true); assert.equal(t.strictNegativeSuccess, null);
});
for (const state of ['AMBIGUOUS', 'UNMEASURABLE'] as const) test(`reference ${state} has no asserted ground-truth denominator`, () => {
  const f = fixture(); f.expected.tools.pattern.state = state; refresh(f); const t = tool(f, 'pattern');
  assert.equal(t.status, 'UNMEASURED'); assert.deepEqual([t.tp, t.fp, t.fn, t.strictNegativeSuccess], [null, null, null, null]);
});
test('unreadable and incomplete targets never turn empty annotations into negatives', () => {
  const f = fixture(); f.rawReadable = false; refresh(f); assert.ok(result(f).tools!.every(t => t.status === 'UNMEASURED' && t.strictNegativeSuccess === null));
  const g = fixture(); omit(g, 'expected', 'pattern'); omit(g, 'predicted', 'pattern'); g.expected.tools.pattern = { state: 'NEGATIVE', complete: false }; g.predicted.tools.pattern.state = 'NO_SIGNAL'; refresh(g);
  assert.equal(tool(g, 'pattern').status, 'UNMEASURED'); assert.equal(tool(g, 'pattern').strictNegativeSuccess, null);
});
for (const status of ['TRANSPORT_ERROR', 'HOLD', 'CANCELLED'] as const) test(`${status} stays UNMEASURED before semantic scoring`, () => {
  const f = fixture(); f.observation = { ...f.observation, status }; const r = result(f); assert.equal(r.status, 'UNMEASURED'); assert.equal(r.reason, status); assert.equal(r.tools, null);
});
test('semantic edits must match retained raw response and per-case reference hashes', () => {
  const f = fixture(); f.measurement.rawResponse = bytes({ features: f.observation.features, noSignal: false, semantic: { ...f.predicted, readable: false } });
  assert.equal(result(f).status, 'UNMEASURED');
  const g = fixture(); g.context.referenceArtifact = bytes({ caseId: 'tampered' }); assert.equal(result(g).reason, 'SEMANTIC_REFERENCE_ARTIFACT_MISMATCH');
});
test('exact review matching is explicit but cannot turn this DRAFT implementation into acceptance', () => {
  const f = fixture(); f.context.reviewedRules = [mockReview(f)]; assert.equal(result(f).reviewedRulesMatched, true); assert.equal(result(f).acceptance, 'BLOCKED'); assert.equal(result(f).passed, false);
  f.context.reviewedRules = [{ ...mockReview(f), rulesSha256: hash('wrong') }]; assert.equal(result(f).reviewedRulesMatched, false);
});
test('self-asserted reviewed status, changed rules, later freezes and changed source are blocked', () => {
  const f = fixture(); (f.context.rules as { status: string }).status = 'REVIEWED'; refresh(f); assert.equal(result(f).reason, 'RULE_ARTIFACT_OR_SCHEMA_MISMATCH');
  const g = fixture(); g.context.rules.minimumPoolWitnesses = 3; assert.equal(result(g).reason, 'RULE_ARTIFACT_OR_SCHEMA_MISMATCH');
  const h = fixture(); h.context.scope.frozenAt = h.context.observationStartedAt; assert.equal(result(h).reason, 'SEMANTIC_FREEZE_SCOPE_MISMATCH');
  const i = fixture(); i.context.normalizerSourceBytes = Buffer.from('changed'); assert.equal(result(i).reason, 'SEMANTIC_FREEZE_SCOPE_MISMATCH');
});
test('aliases require explicit frozen mappings; original geometry labels and raw facts remain intact', () => {
  const f = fixture(); changeFact(f, 'predicted', 'level', { side: 'support' }); refresh(f);
  assert.ok(tool(f, 'level').pairs[0].semanticIssues.includes('UNKNOWN_SIDE_ALIAS'));
  f.context.rules.aliases.side = { ...f.context.rules.aliases.side, support: 'SUPPORT' }; refresh(f); assert.equal(tool(f, 'level').tp, 1);
  const normalized = normalizeMonacoSemanticEnvelope(f.predicted, f.observation.features, 'OBSERVATION', f.context.rules, labelToTool);
  assert.equal(normalized.facts![1].side, 'support'); assert.equal(normalized.facts![1].canonicalSide, 'SUPPORT'); assert.deepEqual(normalized.retainedHypotheses, f.observation.features);
});
test('duplicate hypotheses remain false positives rather than being filtered or semantically rematched', () => {
  const f = fixture(); f.observation = { ...f.observation, features: [...f.observation.features, { ...f.observation.features[1], id: 'level-duplicate' }] };
  f.predicted.facts = [...f.predicted.facts, { ...f.predicted.facts[1], featureId: 'level-duplicate' }]; refresh(f);
  const r = result(f); assert.equal(r.retainedHypotheses.length, 5); assert.equal(r.geometry!.fp, 1); assert.deepEqual([tool(f, 'level').tp, tool(f, 'level').fp], [1, 1]);
});
test('all-target empty noSignal preserves the legacy explicit global noSignal rule', () => {
  const f = fixture(); f.reference = { ...f.reference, features: [], negative: true }; f.observation = { ...f.observation, features: [], noSignal: false };
  f.expected.facts = []; f.predicted.facts = [];
  for (const name of Object.keys(f.expected.tools) as Monaco50Tool[]) { f.expected.tools[name].state = 'NEGATIVE'; f.predicted.tools[name].state = 'NO_SIGNAL'; }
  refresh(f); assert.equal(result(f).reason, 'GLOBAL_NO_SIGNAL_NOT_EXPLICIT');
  f.observation = { ...f.observation, noSignal: true }; refresh(f); assert.ok(result(f).tools!.every(t => t.strictNegativeSuccess === true)); assert.equal(result(f).passed, false);
});
