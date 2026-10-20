/** DRAFT offline semantic diagnostics. No dispatch, runtime calibration, or acceptance amendment. */
import { isDeepStrictEqual } from 'node:util';
import { evidenceHash, scoreMonacoObservation } from './pocket-monaco-measurement.ts';
import type { CorpusCase, Feature, RecordedObservation } from './pocket-monaco-measurement.ts';
import { MONACO50_TOOLS } from './pocket-monaco-benchmark50-report.ts';
import type { Monaco50Hashes, Monaco50Tool } from './pocket-monaco-benchmark50-report.ts';

type PatternStatus = 'FORMING' | 'CONFIRMED' | 'FAILED' | 'EXTENDED' | 'AMBIGUOUS';
type Side = 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'SUPPORT' | 'RESISTANCE' | 'BUY_SIDE' | 'SELL_SIDE';
type Event = 'TESTING' | 'SWEEP' | 'RECLAIM' | 'REJECTION';
type ConfirmationKind = 'NECKLINE_BREAK' | 'BOUNDARY_BREAK' | 'OTHER_COMPLETION';
type ReferenceState = 'POSITIVE' | 'NEGATIVE' | 'AMBIGUOUS' | 'UNMEASURABLE';
type OutputState = 'ASSERTIONS' | 'NO_SIGNAL' | 'ABSTAIN' | 'UNREADABLE';
export type MonacoSemanticRules = {
  schemaVersion: 1;
  status: 'DRAFT';
  aliases: { status: Readonly<Record<string, PatternStatus>>; side: Readonly<Record<string, Side>>; event: Readonly<Record<string, Event>> };
  patternRules: Readonly<Record<string, { minimumAnchors: number; direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; confirmationKind: ConfirmationKind }>>;
  instrumentRules: readonly { instrument: string; priceUnit: string; tickSize: number; maxPriceErrorTicks: number; pixelTolerance: number; maxBarError: number }[];
  minimumPoolWitnesses: number;
  negativeProtocol: 'COMPLETE_READABLE_REFERENCE_AND_EXPLICIT_TARGET_NO_SIGNAL';
};
const identity = <T extends string>(items: readonly T[]) => Object.fromEntries(items.map(v => [v, v])) as Record<T, T>;
/** No instrument tolerance or pattern rubric is invented by this template. */
export const DRAFT_MONACO_SEMANTIC_RULES: MonacoSemanticRules = {
  schemaVersion: 1, status: 'DRAFT',
  aliases: {
    status: identity(['FORMING', 'CONFIRMED', 'FAILED', 'EXTENDED', 'AMBIGUOUS']),
    side: { ...identity(['BULLISH', 'BEARISH', 'NEUTRAL', 'SUPPORT', 'RESISTANCE', 'BUY_SIDE', 'SELL_SIDE']), 'buy-side': 'BUY_SIDE', 'sell-side': 'SELL_SIDE' },
    event: identity(['TESTING', 'SWEEP', 'RECLAIM', 'REJECTION']),
  },
  patternRules: {}, instrumentRules: [], minimumPoolWitnesses: 2,
  negativeProtocol: 'COMPLETE_READABLE_REFERENCE_AND_EXPLICIT_TARGET_NO_SIGNAL',
};
type Step = { kind: 'TEST' | 'BREACH' | 'RETURN' | 'REACTION'; bar: number; price: number; close: boolean };
export type MonacoSemanticFact = {
  featureId: string;
  tool: Monaco50Tool;
  assertion: 'ASSERTED' | 'AMBIGUOUS';
  side: string;
  witnessBars: readonly number[];
  priceKind: 'POINT' | 'BAND' | 'ANCHORS';
  status?: string;
  formationComplete?: boolean;
  confirmation?: { kind: ConfirmationKind; bar: number; closeBeyond: boolean } | null;
  invalidationBar?: number | null;
  extensionBar?: number | null;
  basis?: 'EQUAL_HIGHS' | 'EQUAL_LOWS' | 'PRIOR_SWING_HIGH' | 'PRIOR_SWING_LOW' | 'RANGE_HIGH' | 'RANGE_LOW';
  event?: string;
  poolFeatureId?: string;
  steps?: readonly Step[];
};
export type MonacoSemanticEnvelope = {
  schemaVersion: 1;
  rulesSha256: string;
  caseId: string;
  instrument: string;
  priceUnit: string;
  barCount: number;
  readable: boolean;
  tools: Record<Monaco50Tool, { state: ReferenceState | OutputState; complete?: boolean }>;
  facts: readonly MonacoSemanticFact[];
};
type NormalizedFact = MonacoSemanticFact & { canonicalSide: Side | null; canonicalStatus: PatternStatus | null; canonicalEvent: Event | null };
export type MonacoSemanticScope = Monaco50Hashes & {
  rulesSha256: string; normalizerSourceSha256: string; candidateSha: string; model: string; frozenAt: string;
};
export type MonacoSemanticReview = Omit<MonacoSemanticScope, 'frozenAt'> & {
  documentSha256: string; reviewer: string; independent: true; disposition: 'APPROVED'; approvedAt: string; validUntil: string;
};
export type MonacoSemanticContext = {
  rules: MonacoSemanticRules;
  rulesBytes: Uint8Array;
  normalizerSourceBytes: Uint8Array;
  referenceArtifact: Uint8Array;
  labelToTool: Readonly<Record<string, Monaco50Tool>>;
  scope: MonacoSemanticScope;
  observationStartedAt: string;
  /** Trusted external records, never claims copied from submitted rules or model output. */
  reviewedRules?: readonly MonacoSemanticReview[];
  now?: number;
};

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const sha = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const id = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(v);
const date = (v: unknown) => typeof v === 'string' && /Z$/.test(v) ? Date.parse(v) : NaN;
const owned = <T>(map: Readonly<Record<string, T>>, key: string | undefined): T | null => key && Object.hasOwn(map, key) ? map[key] : null;
const toolOf = (feature: Feature, map: Readonly<Record<string, Monaco50Tool>>) => owned(map, feature.label);
const nullableBar = (v: unknown, count: number) => v === null || (Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) < count);
const hashKeys = ['datasetSha256', 'referencesSha256', 'scannerSourceSha256', 'protocolSha256', 'rulesSha256', 'normalizerSourceSha256'] as const;

function validateRules(r: MonacoSemanticRules) {
  if (!r || r.schemaVersion !== 1 || r.status !== 'DRAFT' || r.negativeProtocol !== 'COMPLETE_READABLE_REFERENCE_AND_EXPLICIT_TARGET_NO_SIGNAL' ||
    !Number.isSafeInteger(r.minimumPoolWitnesses) || r.minimumPoolWitnesses < 2 || !object(r.patternRules) || !Array.isArray(r.instrumentRules) ||
    !object(r.aliases?.status) || !object(r.aliases.side) || !object(r.aliases.event)) return false;
  if (Object.values(r.aliases.status).some(v => !['FORMING', 'CONFIRMED', 'FAILED', 'EXTENDED', 'AMBIGUOUS'].includes(v)) ||
    Object.values(r.aliases.side).some(v => !['BULLISH', 'BEARISH', 'NEUTRAL', 'SUPPORT', 'RESISTANCE', 'BUY_SIDE', 'SELL_SIDE'].includes(v)) ||
    Object.values(r.aliases.event).some(v => !['TESTING', 'SWEEP', 'RECLAIM', 'REJECTION'].includes(v))) return false;
  return Object.entries(r.patternRules).every(([label, p]) => id(label) && p && Number.isSafeInteger(p.minimumAnchors) && p.minimumAnchors >= 3 &&
    ['BULLISH', 'BEARISH', 'NEUTRAL'].includes(p.direction) && ['NECKLINE_BREAK', 'BOUNDARY_BREAK', 'OTHER_COMPLETION'].includes(p.confirmationKind)) &&
    r.instrumentRules.every(i => i && typeof i.instrument === 'string' && i.instrument.trim() && typeof i.priceUnit === 'string' && i.priceUnit.trim() &&
      finite(i.tickSize) && i.tickSize > 0 && Number.isSafeInteger(i.maxPriceErrorTicks) && i.maxPriceErrorTicks >= 0 &&
      finite(i.pixelTolerance) && i.pixelTolerance >= 0 && Number.isSafeInteger(i.maxBarError) && i.maxBarError >= 0) &&
    new Set(r.instrumentRules.map(i => i.instrument)).size === r.instrumentRules.length;
}

/** Exact declared aliases only. Never filters, deduplicates, rewrites or reorders geometry hypotheses. */
export function normalizeMonacoSemanticEnvelope(value: unknown, features: readonly Feature[], mode: 'REFERENCE' | 'OBSERVATION',
  rules: MonacoSemanticRules, labelToTool: Readonly<Record<string, Monaco50Tool>>) {
  const fail = (reason: string) => ({ status: 'UNMEASURED' as const, reason, envelope: null, facts: null, retainedHypotheses: features });
  if (!validateRules(rules)) return fail('INVALID_DRAFT_SEMANTIC_RULES');
  if (!object(value) || value.schemaVersion !== 1 || !sha(value.rulesSha256) || !id(value.caseId) || typeof value.instrument !== 'string' ||
    typeof value.priceUnit !== 'string' || !Number.isSafeInteger(value.barCount) || Number(value.barCount) < 1 || Number(value.barCount) > 1_000_000 ||
    typeof value.readable !== 'boolean' || !object(value.tools) || !Array.isArray(value.facts) || value.facts.length !== features.length) return fail('MALFORMED_SEMANTIC_ENVELOPE');
  const envelope = value as unknown as MonacoSemanticEnvelope;
  if (Object.keys(envelope.tools).length !== MONACO50_TOOLS.length || MONACO50_TOOLS.some(tool => !object(envelope.tools[tool]) ||
    !(mode === 'REFERENCE' ? ['POSITIVE', 'NEGATIVE', 'AMBIGUOUS', 'UNMEASURABLE'] : ['ASSERTIONS', 'NO_SIGNAL', 'ABSTAIN', 'UNREADABLE']).includes(envelope.tools[tool].state) ||
    (mode === 'REFERENCE' && typeof envelope.tools[tool].complete !== 'boolean'))) return fail('INCOMPLETE_TARGET_SEMANTICS');
  const normalized: NormalizedFact[] = [];
  for (let i = 0; i < features.length; i++) {
    const f = envelope.facts[i], feature = features[i];
    if (!f || f.featureId !== feature.id || f.tool !== toolOf(feature, labelToTool) || !MONACO50_TOOLS.includes(f.tool) ||
      !['ASSERTED', 'AMBIGUOUS'].includes(f.assertion) || typeof f.side !== 'string' || !Array.isArray(f.witnessBars) || f.witnessBars.length > 50 ||
      f.witnessBars.some(bar => !nullableBar(bar, envelope.barCount) || bar === null) || !['POINT', 'BAND', 'ANCHORS'].includes(f.priceKind)) return fail('SEMANTIC_HYPOTHESIS_IDENTITY_OR_SHAPE_MISMATCH');
    if (f.tool === 'pattern' && (typeof f.status !== 'string' || typeof f.formationComplete !== 'boolean' ||
      !nullableBar(f.invalidationBar, envelope.barCount) || !nullableBar(f.extensionBar, envelope.barCount) ||
      !(f.confirmation === null || (object(f.confirmation) && ['NECKLINE_BREAK', 'BOUNDARY_BREAK', 'OTHER_COMPLETION'].includes(f.confirmation.kind) &&
        nullableBar(f.confirmation.bar, envelope.barCount) && f.confirmation.bar !== null && typeof f.confirmation.closeBeyond === 'boolean')))) return fail('INCOMPLETE_PATTERN_SEMANTICS');
    if (f.tool === 'liquidity_pool' && !['EQUAL_HIGHS', 'EQUAL_LOWS', 'PRIOR_SWING_HIGH', 'PRIOR_SWING_LOW', 'RANGE_HIGH', 'RANGE_LOW'].includes(f.basis ?? '')) return fail('INCOMPLETE_POOL_SEMANTICS');
    if (f.tool === 'liquidity_event' && (typeof f.event !== 'string' || !id(f.poolFeatureId) || !Array.isArray(f.steps) || f.steps.length > 10 ||
      f.steps.some(s => !s || !['TEST', 'BREACH', 'RETURN', 'REACTION'].includes(s.kind) || !nullableBar(s.bar, envelope.barCount) || s.bar === null || !finite(s.price) || typeof s.close !== 'boolean'))) return fail('INCOMPLETE_EVENT_SEMANTICS');
    normalized.push({ ...f, canonicalSide: owned(rules.aliases.side, f.side), canonicalStatus: owned(rules.aliases.status, f.status), canonicalEvent: owned(rules.aliases.event, f.event) });
  }
  for (const tool of MONACO50_TOOLS) {
    const facts = normalized.filter(f => f.tool === tool), state = envelope.tools[tool].state;
    if (mode === 'REFERENCE' && ((state === 'POSITIVE' && facts.length === 0) || (state === 'NEGATIVE' && facts.length !== 0))) return fail('REFERENCE_TARGET_STATE_CONTRADICTION');
    if (mode === 'OBSERVATION' && ((state === 'NO_SIGNAL' && facts.length !== 0) || (state === 'ASSERTIONS' && facts.length === 0) ||
      (state === 'ABSTAIN' && facts.some(f => f.assertion !== 'AMBIGUOUS')))) return fail('OBSERVED_TARGET_STATE_CONTRADICTION');
  }
  return { status: 'NORMALIZED' as const, reason: null, envelope, facts: normalized, retainedHypotheses: features };
}

function claimIssues(f: NormalizedFact, feature: Feature, all: readonly NormalizedFact[], features: readonly Feature[], rules: MonacoSemanticRules, priceTolerance: number) {
  const issues: string[] = [], last = f.witnessBars.at(-1) ?? -1;
  if (!f.canonicalSide) issues.push('UNKNOWN_SIDE_ALIAS');
  if (f.witnessBars.some((bar, i) => i > 0 && bar <= f.witnessBars[i - 1])) issues.push('WITNESSES_NOT_DISTINCT_AND_ORDERED');
  if (f.priceKind === 'POINT' && feature.prices.length !== 1) issues.push('POINT_PRICE_SHAPE');
  if (f.priceKind === 'BAND' && (feature.prices.length !== 2 || feature.prices[0] > feature.prices[1])) issues.push('BAND_ENDPOINT_ORDER');
  if (f.tool === 'level' && !['SUPPORT', 'RESISTANCE'].includes(f.canonicalSide ?? '')) issues.push('LEVEL_SIDE_REQUIRED');
  if (f.tool === 'pattern') {
    const rubric = owned(rules.patternRules, feature.label), status = f.canonicalStatus;
    if (!rubric) issues.push('PATTERN_RUBRIC_MISSING');
    if (!status) issues.push('UNKNOWN_PATTERN_STATUS_ALIAS');
    if ((status === 'AMBIGUOUS') !== (f.assertion === 'AMBIGUOUS')) issues.push('AMBIGUITY_STATUS_CONTRADICTION');
    if (rubric && f.canonicalSide !== rubric.direction) issues.push('PATTERN_DIRECTION_MISMATCH');
    if (status !== 'AMBIGUOUS' && rubric && (f.witnessBars.length < rubric.minimumAnchors || feature.pixels.length < rubric.minimumAnchors ||
      feature.pixels.some((p, i) => i > 0 && p.x <= feature.pixels[i - 1].x))) issues.push('FORMATION_ANCHORS_INSUFFICIENT_OR_UNORDERED');
    if (f.confirmation && (f.confirmation.bar <= last || !f.confirmation.closeBeyond || f.confirmation.kind !== rubric?.confirmationKind)) issues.push('CONFIRMATION_NOT_VISIBLY_SUPPORTED');
    if (status === 'FORMING' && (f.confirmation !== null || f.invalidationBar !== null || f.extensionBar !== null)) issues.push('FORMING_IS_NOT_CONFIRMATION_OR_FAILURE');
    if ((status === 'CONFIRMED' || status === 'EXTENDED') && (!f.formationComplete || !f.confirmation || f.invalidationBar !== null)) issues.push('COMPLETION_AND_CONFIRMATION_REQUIRED');
    if (status === 'CONFIRMED' && f.extensionBar !== null) issues.push('CONFIRMED_NOT_EXTENDED');
    if (status === 'FAILED' && (f.invalidationBar === null || f.invalidationBar === undefined || f.invalidationBar <= Math.max(last, f.confirmation?.bar ?? -1) || f.extensionBar !== null)) issues.push('VISIBLE_LATER_INVALIDATION_REQUIRED');
    if (status === 'EXTENDED' && (f.extensionBar === null || f.extensionBar === undefined || f.extensionBar <= (f.confirmation?.bar ?? Infinity))) issues.push('VISIBLE_LATER_EXTENSION_REQUIRED');
  }
  if (f.tool === 'liquidity_pool') {
    const buy = ['EQUAL_HIGHS', 'PRIOR_SWING_HIGH', 'RANGE_HIGH'].includes(f.basis ?? '');
    if (f.canonicalSide !== (buy ? 'BUY_SIDE' : 'SELL_SIDE')) issues.push('POOL_BASIS_SIDE_MISMATCH');
    if (f.witnessBars.length < rules.minimumPoolWitnesses) issues.push('POOL_WITNESSES_INSUFFICIENT');
  }
  if (f.tool === 'liquidity_event') {
    const pool = all.find(p => p.featureId === f.poolFeatureId && p.tool === 'liquidity_pool');
    const poolFeature = features.find(p => p.id === f.poolFeatureId), steps = f.steps ?? [];
    if (!pool || !poolFeature || pool.assertion !== 'ASSERTED' || pool.canonicalSide !== f.canonicalSide ||
      claimIssues(pool, poolFeature, all, features, rules, priceTolerance).length) issues.push('VALID_SAME_SIDE_POOL_REQUIRED');
    const required = f.canonicalEvent === 'REJECTION' ? ['TEST', 'REACTION'] : ['BREACH', 'RETURN'];
    if (!['SWEEP', 'RECLAIM', 'REJECTION'].includes(f.canonicalEvent ?? '')) issues.push('COMPLETED_EVENT_REQUIRED');
    if (!isDeepStrictEqual(steps.map(s => s.kind), required)) issues.push('EVENT_STEP_SEQUENCE_MISMATCH');
    if (steps.some((s, i) => s.bar <= (i ? steps[i - 1].bar : pool?.witnessBars.at(-1) ?? Infinity))) issues.push('EVENT_ORDER_UNPROVEN');
    if (f.canonicalEvent === 'RECLAIM' && !steps.find(s => s.kind === 'RETURN')?.close) issues.push('RECLAIM_REQUIRES_CLOSE_BACK_THROUGH_LEVEL');
    if (poolFeature && ['BUY_SIDE', 'SELL_SIDE'].includes(f.canonicalSide ?? '')) {
      const buy = f.canonicalSide === 'BUY_SIDE', boundary = buy ? Math.max(...poolFeature.prices) : Math.min(...poolFeature.prices);
      for (const s of steps) {
        if (s.kind === 'BREACH' && !(buy ? s.price > boundary : s.price < boundary)) issues.push('BREACH_SIDE_PRICE_MISMATCH');
        if (s.kind === 'RETURN' && !(buy ? s.price <= boundary : s.price >= boundary)) issues.push('RETURN_SIDE_PRICE_MISMATCH');
        if (s.kind === 'TEST' && Math.abs(s.price - boundary) > priceTolerance) issues.push('TEST_NOT_AT_POOL');
        if (s.kind === 'REACTION' && !(buy ? s.price < boundary : s.price > boundary)) issues.push('REACTION_SIDE_PRICE_MISMATCH');
      }
    }
  }
  return issues;
}

/** Additional semantic checks on the existing scorer's exact pairs, never rematching or relaxing its thresholds. */
export function scoreMonacoSemanticProposal(reference: CorpusCase, observation: RecordedObservation,
  measurement: Parameters<typeof scoreMonacoObservation>[2], context: MonacoSemanticContext) {
  const base = scoreMonacoObservation(reference, observation, measurement);
  const rulesHash = evidenceHash(context.rulesBytes), now = context.now ?? Date.now(), blockers = ['DRAFT_SEMANTIC_PROPOSAL_NOT_ACCEPTANCE'];
  const scope = context.scope;
  const matchingReviews = (context.reviewedRules ?? []).filter(r => hashKeys.every(k => sha(r[k]) && r[k] === scope[k]) &&
    sha(r.documentSha256) && id(r.reviewer) && r.independent === true && r.disposition === 'APPROVED' &&
    r.candidateSha === scope.candidateSha && r.model === scope.model && date(r.approvedAt) < date(context.observationStartedAt) && date(r.validUntil) > now);
  const reviewedRulesMatched = matchingReviews.length === 1;
  if (!reviewedRulesMatched) blockers.push('EXACT_INDEPENDENT_SEMANTIC_RULE_REVIEW_REQUIRED');
  const header = { proposalStatus: 'DRAFT' as const, acceptance: 'BLOCKED' as const, passed: false as const, dispatchAuthorised: false as const,
    caseId: reference.caseId, rulesSha256: rulesHash, reviewedRulesMatched, blockers, retainedHypotheses: observation.features };
  const fail = (reason: string) => ({ ...header, status: 'UNMEASURED' as const, reason, geometry: null, tools: null });
  if (base.status !== 'MEASURED') return fail(base.reason);
  try {
    if (!isDeepStrictEqual(JSON.parse(Buffer.from(context.rulesBytes).toString('utf8')), context.rules) || !validateRules(context.rules)) return fail('RULE_ARTIFACT_OR_SCHEMA_MISMATCH');
    if (!hashKeys.every(k => sha(scope[k])) || rulesHash !== scope.rulesSha256 || evidenceHash(context.normalizerSourceBytes) !== scope.normalizerSourceSha256 ||
      scope.candidateSha !== measurement.candidateSha || scope.model !== measurement.model || !Number.isSafeInteger(now) ||
      !Number.isFinite(date(scope.frozenAt)) || !(date(scope.frozenAt) < date(context.observationStartedAt)) || date(context.observationStartedAt) > now) return fail('SEMANTIC_FREEZE_SCOPE_MISMATCH');
    const labels = JSON.parse(Buffer.from(context.referenceArtifact).toString('utf8'));
    if (evidenceHash(context.referenceArtifact) !== reference.labelSha256 || labels.caseId !== reference.caseId || labels.rasterSha256 !== reference.rasterSha256 ||
      !isDeepStrictEqual(labels.features, reference.features)) return fail('SEMANTIC_REFERENCE_ARTIFACT_MISMATCH');
    const raw = JSON.parse(Buffer.from(measurement.rawResponse).toString('utf8'));
    const expected = normalizeMonacoSemanticEnvelope(labels.semantic, reference.features, 'REFERENCE', context.rules, context.labelToTool);
    const predicted = normalizeMonacoSemanticEnvelope(raw.semantic, observation.features, 'OBSERVATION', context.rules, context.labelToTool);
    if (expected.status !== 'NORMALIZED') return fail(`REFERENCE:${expected.reason}`);
    if (predicted.status !== 'NORMALIZED') return fail(`OBSERVATION:${predicted.reason}`);
    const e = expected.envelope, p = predicted.envelope;
    if ([e, p].some(v => v.caseId !== reference.caseId || v.rulesSha256 !== rulesHash || v.instrument !== reference.instrument) ||
      e.priceUnit !== p.priceUnit || e.barCount !== p.barCount) return fail('SEMANTIC_CASE_INSTRUMENT_OR_RULE_MISMATCH');
    if (observation.features.length === 0 && MONACO50_TOOLS.every(tool => p.tools[tool].state === 'NO_SIGNAL') && observation.noSignal !== true) return fail('GLOBAL_NO_SIGNAL_NOT_EXPLICIT');
    const unit = context.rules.instrumentRules.find(i => i.instrument === reference.instrument && i.priceUnit === e.priceUnit);
    if (!unit) return fail('REVIEWABLE_INSTRUMENT_TOLERANCE_MISSING');
    const tolerance = unit.tickSize * unit.maxPriceErrorTicks;
    if (!finite(tolerance) || tolerance > measurement.priceTolerance || unit.pixelTolerance > measurement.pixelTolerance) return fail('PROPOSED_TOLERANCE_WOULD_RELAX_EXISTING_RULE');
    const expectedIssues = new Map(expected.facts.map(f => [f.featureId, claimIssues(f, reference.features.find(x => x.id === f.featureId)!, expected.facts, reference.features, context.rules, tolerance)]));
    const predictedIssues = new Map(predicted.facts.map(f => [f.featureId, claimIssues(f, observation.features.find(x => x.id === f.featureId)!, predicted.facts, observation.features, context.rules, tolerance)]));
    const tools = MONACO50_TOOLS.map(tool => {
      const refs = expected.facts.filter(f => f.tool === tool), preds = predicted.facts.filter(f => f.tool === tool);
      const rs = e.tools[tool], os = p.tools[tool];
      const unmeasuredReason = !e.readable || !p.readable || raw.readable === false || rs.state === 'UNMEASURABLE' || os.state === 'UNREADABLE' ? 'UNREADABLE_OR_UNMEASURABLE_TARGET'
        : rs.complete !== true || rs.state === 'AMBIGUOUS' ? 'REFERENCE_TARGET_INCOMPLETE_OR_AMBIGUOUS'
        : refs.some(f => expectedIssues.get(f.featureId)!.length || f.assertion !== 'ASSERTED') ? 'REFERENCE_SEMANTIC_CLAIM_INVALID' : null;
      const pairs = base.pairs.filter(pair => preds.some(f => f.featureId === pair.predictedId)).map(pair => {
        const a = expected.facts.find(f => f.featureId === pair.expectedId)!, b = predicted.facts.find(f => f.featureId === pair.predictedId)!;
        const issues = [...predictedIssues.get(b.featureId)!];
        if (a.canonicalSide !== b.canonicalSide) issues.push('SIDE_MISMATCH');
        if (a.witnessBars.length !== b.witnessBars.length || a.witnessBars.some((bar, i) => Math.abs(bar - b.witnessBars[i]) > unit.maxBarError)) issues.push('WITNESS_BAR_MISMATCH');
        if (b.assertion === 'AMBIGUOUS') issues.push('NAMED_AMBIGUOUS_ASSERTION');
        if (tool === 'pattern') {
          if (a.canonicalStatus !== b.canonicalStatus) issues.push('PATTERN_STATUS_MISMATCH');
          if (a.formationComplete !== b.formationComplete) issues.push('FORMATION_COMPLETENESS_MISMATCH');
          for (const [name, av, bv] of [['confirmation', a.confirmation?.bar ?? null, b.confirmation?.bar ?? null], ['invalidation', a.invalidationBar, b.invalidationBar], ['extension', a.extensionBar, b.extensionBar]] as const) {
            if (av === null || bv === null ? av !== bv : Math.abs(Number(av) - Number(bv)) > unit.maxBarError) issues.push(`${name.toUpperCase()}_BAR_MISMATCH`);
          }
        }
        if (tool === 'liquidity_pool' && a.basis !== b.basis) issues.push('POOL_BASIS_MISMATCH');
        if (tool === 'liquidity_event') {
          if (a.canonicalEvent !== b.canonicalEvent) issues.push('EVENT_KIND_MISMATCH');
          if (!base.pairs.some(pool => pool.expectedId === a.poolFeatureId && pool.predictedId === b.poolFeatureId)) issues.push('EVENT_POOL_REFERENCE_MISMATCH');
          if (!isDeepStrictEqual(a.steps?.map(s => s.kind), b.steps?.map(s => s.kind)) || a.steps!.some((s, i) => !b.steps?.[i] || Math.abs(s.bar - b.steps[i].bar) > unit.maxBarError)) issues.push('EVENT_ORDER_OR_BAR_MISMATCH');
          if (a.steps!.some((s, i) => !b.steps?.[i] || Math.abs(s.price - b.steps[i].price) > tolerance)) issues.push('EVENT_STEP_PRICE_TOLERANCE_EXCEEDED');
          if (a.steps!.some((s, i) => s.close !== b.steps?.[i]?.close)) issues.push('EVENT_CLOSE_EVIDENCE_MISMATCH');
        }
        if (a.priceKind !== b.priceKind) issues.push('PRICE_SHAPE_MISMATCH');
        if (pair.price > tolerance) issues.push('INSTRUMENT_PRICE_TOLERANCE_EXCEEDED');
        if (pair.pixel > unit.pixelTolerance) issues.push('ORIGINAL_PIXEL_TOLERANCE_EXCEEDED');
        return { ...pair, priceErrorTicks: pair.price / unit.tickSize, semanticIssues: issues, semanticCorrect: issues.length === 0 };
      });
      const tp = pairs.filter(pair => pair.semanticCorrect).length;
      const abstained = os.state === 'ABSTAIN' || preds.some(f => f.assertion === 'AMBIGUOUS') || (rs.state === 'POSITIVE' && os.state === 'NO_SIGNAL');
      return { tool, referenceState: rs.state, outputState: os.state, status: unmeasuredReason ? 'UNMEASURED' as const : 'DIAGNOSTIC_SCORED' as const,
        reason: unmeasuredReason, tp: unmeasuredReason ? null : tp, fp: unmeasuredReason ? null : preds.length - tp, fn: unmeasuredReason ? null : refs.length - tp,
        strictNegativeSuccess: !unmeasuredReason && rs.state === 'NEGATIVE' ? os.state === 'NO_SIGNAL' && preds.length === 0 : null,
        falsePositiveNegative: !unmeasuredReason && rs.state === 'NEGATIVE' ? preds.length > 0 : null,
        abstained, pairs: unmeasuredReason ? [] : pairs,
        unsupportedAssertions: preds.filter(f => f.assertion === 'AMBIGUOUS' || predictedIssues.get(f.featureId)!.length).map(f => ({ featureId: f.featureId, issues: predictedIssues.get(f.featureId)!, ambiguous: f.assertion === 'AMBIGUOUS' })),
        latencyMs: base.metrics.latencyMs };
    });
    return { ...header, status: 'DIAGNOSTIC_SCORED' as const, reason: null,
      geometry: { provenance: base.provenance, tp: base.metrics.tp, fp: base.metrics.fp, fn: base.metrics.fn, pairs: base.pairs, nearestErrors: base.nearestErrors }, tools };
  } catch { return fail('MALFORMED_SEMANTIC_ARTIFACT'); }
}
