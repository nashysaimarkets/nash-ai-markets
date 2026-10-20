/**
 * Offline, fail-closed reporting for the proposed 50-case benchmark.
 * This module neither dispatches requests nor approves a corpus or a protocol.
 * Trusted review/receipt arguments must come from independently retained records,
 * never from assertions embedded in a submitted dataset or model response.
 */
import { isDeepStrictEqual } from 'node:util';
import { evidenceHash, scoreMonacoObservation, validateFeatures } from './pocket-monaco-measurement.ts';
import type { CorpusCase, EvidenceReview, Feature, RecordedObservation } from './pocket-monaco-measurement.ts';

export const MONACO50_TOOLS = ['pattern', 'level', 'liquidity_pool', 'liquidity_event'] as const;
export const MONACO50_CATEGORY_ALLOCATION = Object.freeze({ clear_pattern: 15, structure: 15, near_miss: 10, phone: 10 });
export type Monaco50Tool = typeof MONACO50_TOOLS[number];
export type Monaco50Case = Omit<CorpusCase, 'negative' | 'features'> & {
  split: 'development' | 'heldout';
  category: 'clear_pattern' | 'structure' | 'near_miss' | 'phone';
  groupId: string;
};
export type Monaco50Manifest = { schemaVersion: 2; cases: readonly Monaco50Case[] };
export type Monaco50Reference = {
  caseId: string;
  /** Unreadable or unreviewed screenshots are not negative reference examples. */
  readable: boolean | null;
  features: readonly Feature[];
  /** Missing, partial, and unknown coverage never establish a negative. */
  coverage: Partial<Record<Monaco50Tool, 'complete' | 'partial' | 'unknown'>>;
};
export type Monaco50References = { schemaVersion: 1; cases: readonly Monaco50Reference[] };
export type Monaco50Protocol = {
  schemaVersion: 1;
  status: 'DRAFT' | 'REVIEWED';
  candidateSha: string;
  model: string;
  /** Safe labels accepted by validateFeatures; never rewrite receipt-bound labels. */
  labelToTool: Readonly<Record<string, Monaco50Tool>>;
  pixelTolerance: number;
  priceTolerance: number;
  maxLatencyMs: number;
  negativeRule: 'COMPLETE_TOOL_REFERENCE_AND_NO_TOOL_PREDICTIONS';
  casePassRule: 'EXACT_WITHIN_TOLERANCES';
};
export type Monaco50Hashes = {
  datasetSha256: string;
  referencesSha256: string;
  scannerSourceSha256: string;
  protocolSha256: string;
};
export type Monaco50Freeze = Monaco50Hashes & { frozenAt: string; candidateSha: string; model: string };
export type Monaco50ProtocolReview = Monaco50Hashes & {
  documentSha256: string;
  reviewer: string;
  independent: true;
  disposition: 'APPROVED';
  candidateSha: string;
  model: string;
  approvedAt: string;
  validUntil: string;
};
type OriginalReceipt = Parameters<typeof scoreMonacoObservation>[2]['reviewedExecutorReceipts'][number];
export type Monaco50ExecutionAudit = Monaco50Hashes & {
  startedAt: string;
  attemptNumber: number;
  exposure: 'FIRST_UNSEEN' | 'RERUN' | 'TUNED';
};
export type Monaco50ExecutorReceipt = OriginalReceipt & { benchmark: Monaco50ExecutionAudit };
export type Monaco50RecordedObservation = RecordedObservation | (Omit<RecordedObservation, 'status'> & { status: 'UNREADABLE' });
export type Monaco50Observation = {
  observation: Monaco50RecordedObservation;
  rawResponse: Uint8Array;
  audit: Monaco50ExecutionAudit;
};
export type Monaco50ReportInput = {
  manifest: Monaco50Manifest;
  references: Monaco50References;
  protocol: Monaco50Protocol;
  artifacts: { dataset: Uint8Array; references: Uint8Array; scannerSource: Uint8Array; protocol: Uint8Array };
  freeze?: Monaco50Freeze;
  protocolReviews?: readonly Monaco50ProtocolReview[];
  evidenceReviews?: readonly EvidenceReview[];
  /** Existing per-case source/input/annotation/licence/review artifacts, by exact SHA. */
  caseArtifacts?: ReadonlyMap<string, Uint8Array>;
  reviewedExecutorReceipts?: readonly Monaco50ExecutorReceipt[];
  observations?: readonly Monaco50Observation[];
  now?: number;
};

const identifier = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(v);
const sha256 = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const finiteNonnegative = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const date = (v: unknown) => typeof v === 'string' && /Z$/.test(v) ? Date.parse(v) : NaN;
const hashKeys = ['datasetSha256', 'referencesSha256', 'scannerSourceSha256', 'protocolSha256'] as const;
const sameHashes = (a: Monaco50Hashes | undefined, b: Monaco50Hashes) => !!a && hashKeys.every(k => sha256(a[k]) && a[k] === b[k]);
const safeLatency = (o: Pick<RecordedObservation, 'latencyMs'> | undefined) => finiteNonnegative(o?.latencyMs) ? o!.latencyMs : null;

/** Metadata counts are preparation only; no file, rights, annotation, or provider claim. */
export function checkMonaco50Manifest(manifest: Monaco50Manifest) {
  const issues: string[] = [];
  const cases = Array.isArray(manifest?.cases) ? manifest.cases : [];
  if (manifest?.schemaVersion !== 2) issues.push('SCHEMA_VERSION_2_REQUIRED');
  if (cases.length !== 50) issues.push('EXACT_FIFTY_CASES_REQUIRED');
  if (cases.filter(c => c?.split === 'development').length !== 6 || cases.filter(c => c?.split === 'heldout').length !== 44) issues.push('SIX_DEVELOPMENT_FORTY_FOUR_HELDOUT_REQUIRED');
  const categoryCounts = Object.fromEntries(Object.keys(MONACO50_CATEGORY_ALLOCATION).map(category =>
    [category, cases.filter(c => c?.category === category).length])) as Record<Monaco50Case['category'], number>;
  for (const [category, required] of Object.entries(MONACO50_CATEGORY_ALLOCATION)) {
    const actual = categoryCounts[category as Monaco50Case['category']];
    if (actual !== required) issues.push(`CATEGORY_ALLOCATION_MISMATCH:${category}:expected=${required}:actual=${actual}`);
  }
  const seen = new Set<string>(), groups = new Map<string, string>();
  for (const c of cases) {
    if (!c || !identifier(c.caseId) || !identifier(c.groupId) || !['development', 'heldout'].includes(c.split) ||
      !['clear_pattern', 'structure', 'near_miss', 'phone'].includes(c.category)) { issues.push('INVALID_CASE_METADATA'); continue; }
    if (seen.has(c.caseId)) issues.push(`DUPLICATE_CASE_ID:${c.caseId}`);
    seen.add(c.caseId);
    if (groups.has(c.groupId) && groups.get(c.groupId) !== c.split) issues.push(`GROUP_SPLIT_LEAKAGE:${c.groupId}`);
    groups.set(c.groupId, c.split);
  }
  return { prepared: seen.size, categoryCounts, requiredCategoryCounts: MONACO50_CATEGORY_ALLOCATION, issues, metadataOnly: true as const };
}

function protocolValid(p: Monaco50Protocol) {
  return !!p && p.schemaVersion === 1 && ['DRAFT', 'REVIEWED'].includes(p.status) &&
    /^[a-f0-9]{40}$/.test(p.candidateSha) && typeof p.model === 'string' && p.model.trim().length > 0 &&
    object(p.labelToTool) && Object.entries(p.labelToTool).every(([label, tool]) => identifier(label) && MONACO50_TOOLS.includes(tool)) &&
    [p.pixelTolerance, p.priceTolerance, p.maxLatencyMs].every(finiteNonnegative) &&
    p.negativeRule === 'COMPLETE_TOOL_REFERENCE_AND_NO_TOOL_PREDICTIONS' && p.casePassRule === 'EXACT_WITHIN_TOLERANCES';
}
function artifactMatches(bytes: Uint8Array, value: unknown) {
  try { return isDeepStrictEqual(JSON.parse(Buffer.from(bytes).toString('utf8')), value); } catch { return false; }
}
function toolFor(label: string, p: Monaco50Protocol) {
  return Object.hasOwn(p.labelToTool, label) ? p.labelToTool[label] : undefined;
}
/** Execution and success are separate: a scoped failure receipt still records an attempt. */
function scopedExecutionReceipt(attempt: Monaco50Observation | undefined, c: Monaco50Case, input: Monaco50ReportInput, hashes: Monaco50Hashes) {
  if (!attempt?.observation) return null;
  const o = attempt.observation;
  const matches = (input.reviewedExecutorReceipts ?? []).filter(r => r.receiptSha256 === o.executorReceiptSha256), r = matches[0];
  try {
    if (matches.length !== 1 || !r || !sha256(o.executorReceiptSha256) ||
      typeof o.requestId !== 'string' || !o.requestId.trim() || o.requestId.length > 200 ||
      r.caseId !== o.caseId || o.caseId !== c.caseId || r.requestId !== o.requestId ||
      r.candidateSha !== o.candidateSha || o.candidateSha !== input.protocol.candidateSha ||
      r.model !== o.model || o.model !== input.protocol.model ||
      r.rawResponseSha256 !== o.rawResponseSha256 || evidenceHash(attempt.rawResponse) !== o.rawResponseSha256 ||
      r.rasterSha256 !== o.rasterSha256 || o.rasterSha256 !== c.rasterSha256 ||
      r.inputSha256 !== o.inputSha256 || o.inputSha256 !== c.inputSha256 ||
      r.labelSha256 !== o.labelSha256 || o.labelSha256 !== c.labelSha256 || r.costReconciled !== true ||
      !['GENUINE_PROVIDER', 'SYNTHETIC_OFFLINE'].includes(r.provenance) ||
      !sameHashes(attempt.audit, hashes) || !isDeepStrictEqual(r.benchmark, attempt.audit)) return null;
    return r;
  } catch { return null; }
}
function corpusReviewed(c: Monaco50Case, reference: Monaco50Reference, input: Monaco50ReportInput, now: number) {
  const hashes = [c.rasterSha256, c.inputSha256, c.labelSha256, c.licenceSha256, c.reviewSha256];
  if (!hashes.every(h => sha256(h) && input.caseArtifacts?.has(h) && evidenceHash(input.caseArtifacts.get(h)!) === h) ||
    !identifier(c.primaryAnnotator) || !identifier(c.independentAnnotator) || c.primaryAnnotator === c.independentAnnotator) return false;
  try {
    const labels = JSON.parse(Buffer.from(input.caseArtifacts!.get(c.labelSha256)!).toString('utf8'));
    if (labels.caseId !== c.caseId || labels.rasterSha256 !== c.rasterSha256 || labels.readable !== reference.readable ||
      !isDeepStrictEqual(labels.features, reference.features) || !isDeepStrictEqual(labels.coverage, reference.coverage)) return false;
  } catch { return false; }
  return ([['LICENCE', c.licenceSha256], ['ANNOTATION', c.reviewSha256]] as const).every(([kind, documentSha256]) => {
    const matches = (input.evidenceReviews ?? []).filter(r => r.kind === kind && r.documentSha256 === documentSha256 &&
      r.rasterSha256 === c.rasterSha256 && r.inputSha256 === c.inputSha256 && r.labelSha256 === c.labelSha256);
    const r = matches[0];
    return matches.length === 1 && identifier(r?.reviewer) && date(r.validUntil) > now && r.analysisAllowed === true &&
      r.providerProcessingAllowed === true && r.canonicalCaseAccepted === true && (kind !== 'ANNOTATION' || r.reviewer === c.independentAnnotator);
  });
}

type MatchedPair = Extract<ReturnType<typeof scoreMonacoObservation>, { status: 'MEASURED' }>['pairs'][number];
type NearestError = Extract<ReturnType<typeof scoreMonacoObservation>, { status: 'MEASURED' }>['nearestErrors'][number];
export type Monaco50ToolResult = {
  tool: Monaco50Tool;
  coverage: 'complete' | 'partial' | 'unknown';
  tp: number;
  fp: number | null;
  fn: number | null;
  precision: number | null;
  recall: number | null;
  correctAbstention: boolean | null;
  unmatchedPredictionIds: string[];
  unmatchedAnnotatedReferenceIds: string[];
  pairs: MatchedPair[];
  nearestErrors: NearestError[];
  latencyMs: number;
};
export type Monaco50CaseResult = {
  caseId: string;
  split: Monaco50Case['split'];
  category: Monaco50Case['category'];
  status: 'MEASURED' | 'UNMEASURED';
  reason: string | null;
  technicalFailure: boolean;
  reportedLatencyMs: number | null;
  provenance: OriginalReceipt['provenance'] | null;
  providerExecuted: boolean;
  reviewed: boolean;
  eligibleForAcceptance: boolean;
  passed: boolean;
  tools: Monaco50ToolResult[] | null;
  /** Keep all hypotheses, including duplicates, unmapped labels, and false positives. */
  hypotheses: readonly Feature[];
};

/**
 * Exactly one invocation of the existing full scorer per valid observation; tool
 * counts come from its actual one-to-one pairs. No per-tool rematching, label
 * rewriting, hypothesis filtering, new receipt creation, or provider calls.
 * Input must include the full retained execution history; omitted prior exposure
 * cannot be inferred by an offline reporter.
 */
export function buildMonaco50BenchmarkReport(input: Monaco50ReportInput) {
  const now = input.now ?? Date.now();
  const manifest = checkMonaco50Manifest(input.manifest), issues = [...manifest.issues];
  const hashes: Monaco50Hashes = {
    datasetSha256: evidenceHash(input.artifacts.dataset), referencesSha256: evidenceHash(input.artifacts.references),
    scannerSourceSha256: evidenceHash(input.artifacts.scannerSource), protocolSha256: evidenceHash(input.artifacts.protocol),
  };
  if (!Number.isSafeInteger(now)) issues.push('INVALID_REPORT_TIME');
  if (!artifactMatches(input.artifacts.dataset, input.manifest) || !artifactMatches(input.artifacts.references, input.references) ||
    !artifactMatches(input.artifacts.protocol, input.protocol)) issues.push('ARTIFACT_OBJECT_MISMATCH');
  if (!protocolValid(input.protocol)) issues.push('INVALID_PROTOCOL');
  const references: readonly Monaco50Reference[] = Array.isArray(input.references?.cases) ? input.references.cases : [];
  const caseIds = new Set((input.manifest?.cases ?? []).map(c => c?.caseId));
  if (input.references?.schemaVersion !== 1 || references.some(r => !r || !caseIds.has(r.caseId)) ||
    new Set(references.map(r => r?.caseId)).size !== references.length) issues.push('INVALID_REFERENCE_CASES');
  const f = input.freeze;
  const frozen = !!f && sameHashes(f, hashes) && f.candidateSha === input.protocol.candidateSha && f.model === input.protocol.model &&
    Number.isFinite(date(f.frozenAt)) && date(f.frozenAt) <= now;
  if (!frozen) issues.push('EXACT_ARTIFACT_FREEZE_REQUIRED');
  const approvals = (input.protocolReviews ?? []).filter(r => sameHashes(r, hashes) && sha256(r.documentSha256) &&
    identifier(r.reviewer) && r.independent === true && r.disposition === 'APPROVED' &&
    r.candidateSha === input.protocol.candidateSha && r.model === input.protocol.model &&
    Number.isFinite(date(r.approvedAt)) && date(r.approvedAt) <= now && date(r.validUntil) > now);
  const protocolReviewed = approvals.length === 1;
  if (!protocolReviewed) issues.push('INDEPENDENT_EXACT_PROTOCOL_REVIEW_REQUIRED');
  const observations = input.observations ?? [];
  if (observations.some(o => !caseIds.has(o?.observation?.caseId))) issues.push('UNKNOWN_OBSERVATION_CASE');
  const requests = observations.map(o => o?.observation?.requestId).filter(Boolean);
  const repeatedRequests = new Set(requests.filter((id, index) => requests.indexOf(id) !== index));
  // A heldout report freezes all four artifacts before every retained observation,
  // including development observations; a newer freeze cannot hide earlier tuning.
  const historyFrozen = frozen && observations.every(o => !!o?.audit && sameHashes(o.audit, hashes) &&
    Number.isFinite(date(o.audit.startedAt)) && date(o.audit.startedAt) > date(f!.frozenAt) && date(o.audit.startedAt) <= now);
  if (!historyFrozen) issues.push('OBSERVATION_HISTORY_PRECEDES_OR_DIFFERS_FROM_FREEZE');
  const blockingIssues = issues.filter(i => i !== 'INDEPENDENT_EXACT_PROTOCOL_REVIEW_REQUIRED');

  const cases: Monaco50CaseResult[] = (input.manifest?.cases ?? []).map(c => {
    const attempts = observations.filter(o => o?.observation?.caseId === c.caseId), attempt = attempts[0], o = attempt?.observation;
    const reference = references.find(r => r?.caseId === c.caseId);
    const execution = scopedExecutionReceipt(attempt, c, input, hashes);
    let reviewed = false;
    const base = (): Monaco50CaseResult => ({ caseId: c.caseId, split: c.split, category: c.category, status: 'UNMEASURED',
      reason: null, technicalFailure: false, reportedLatencyMs: safeLatency(o), provenance: execution?.provenance ?? null, providerExecuted: execution?.provenance === 'GENUINE_PROVIDER',
      reviewed, eligibleForAcceptance: false, passed: false, tools: null, hypotheses: Array.isArray(o?.features) ? o.features : [] });
    const fail = (reason: string, technicalFailure = false): Monaco50CaseResult => ({ ...base(), reason, technicalFailure });
    if (reference) reviewed = corpusReviewed(c, reference, input, now) && protocolReviewed;
    if (!attempt) return fail('MISSING_OBSERVATION');
    if (attempts.length !== 1) return fail(c.split === 'heldout' ? 'HELDOUT_REPEATED_OBSERVATION' : 'MULTIPLE_OBSERVATIONS_REQUIRE_EXPLICIT_RUN_SELECTION');
    if (o.status !== 'COMPLETED') return fail(['TRANSPORT_ERROR', 'HOLD', 'CANCELLED', 'UNREADABLE'].includes(o.status) ? o.status : 'MALFORMED_STATUS', o.status === 'TRANSPORT_ERROR' || !['HOLD', 'CANCELLED', 'UNREADABLE'].includes(o.status));
    if (!finiteNonnegative(o.latencyMs) || typeof o.noSignal !== 'boolean') return fail('MALFORMED_OBSERVATION', true);
    if (blockingIssues.length) return fail(blockingIssues[0]);
    if (!reference) return fail('MISSING_REFERENCE');
    if (reference.readable === false) return fail('UNREADABLE_REFERENCE');
    if (reference.readable !== true) return fail('REFERENCE_READABILITY_UNREVIEWED');
    if (!object(reference.coverage) || Object.entries(reference.coverage).some(([tool, coverage]) =>
      !MONACO50_TOOLS.includes(tool as Monaco50Tool) || !['complete', 'partial', 'unknown'].includes(String(coverage)))) return fail('MALFORMED_REFERENCE_COVERAGE', true);
    if (!Number.isSafeInteger(c.width) || !Number.isSafeInteger(c.height) || c.width < 10 || c.height < 10 || c.width * c.height > 40_000_000 ||
      ![c.rasterSha256, c.inputSha256, c.labelSha256].every(sha256)) return fail('INVALID_CASE_SCORING_IDENTITY', true);
    try { validateFeatures(reference.features, c.width, c.height); validateFeatures(o.features, c.width, c.height); }
    catch { return fail('INVALID_FEATURE_EVIDENCE', true); }
    if ([...reference.features, ...o.features].some(feature => !toolFor(feature.label, input.protocol))) return fail('UNMAPPED_FEATURE_LABEL', true);
    if (!Number.isSafeInteger(attempt.audit.attemptNumber) || attempt.audit.attemptNumber < 1 ||
      !['FIRST_UNSEEN', 'RERUN', 'TUNED'].includes(attempt.audit.exposure)) return fail('INVALID_EXECUTION_AUDIT', true);
    if (c.split === 'heldout' && (attempt.audit.attemptNumber !== 1 || attempt.audit.exposure !== 'FIRST_UNSEEN')) return fail('HELDOUT_RERUN_OR_TUNING');
    if (repeatedRequests.has(o.requestId)) return fail('REUSED_REQUEST_ID');
    const receipts = (input.reviewedExecutorReceipts ?? []).filter(r => r.receiptSha256 === o.executorReceiptSha256);
    if (receipts.length !== 1 || !isDeepStrictEqual(receipts[0].benchmark, attempt.audit)) return fail('EXECUTOR_BENCHMARK_SCOPE_MISMATCH');
    const expected: CorpusCase = { ...c, features: reference.features,
      negative: MONACO50_TOOLS.every(tool => reference.coverage[tool] === 'complete') && reference.features.length === 0 };
    const result = scoreMonacoObservation(expected, o, { candidateSha: input.protocol.candidateSha, model: input.protocol.model,
      reviewedExecutorReceipts: receipts, rawResponse: attempt.rawResponse,
      pixelTolerance: input.protocol.pixelTolerance, priceTolerance: input.protocol.priceTolerance });
    if (result.status === 'UNMEASURED') return fail(result.reason,
      !['EXECUTOR_RECEIPT_SCOPE_MISMATCH', 'MEASUREMENT_PROVENANCE_INVALID'].includes(result.reason));
    // The retained, receipt-bound normalized response may explicitly mark an
    // unreadable chart. Empty predictions in that response are not a negative.
    const normalizedResponse = JSON.parse(Buffer.from(attempt.rawResponse).toString('utf8'));
    if (normalizedResponse.readable === false) return fail('UNREADABLE');
    const predictedById = new Map(o.features.map(feature => [feature.id, feature]));
    const matchedExpected = new Set(result.pairs.map(pair => pair.expectedId)), matchedPredicted = new Set(result.pairs.map(pair => pair.predictedId));
    const toolResults = MONACO50_TOOLS.map(tool => {
      const expectedFeatures = reference.features.filter(feature => toolFor(feature.label, input.protocol) === tool);
      const predicted = o.features.filter(feature => toolFor(feature.label, input.protocol) === tool);
      const pairs = result.pairs.filter(pair => toolFor(predictedById.get(pair.predictedId)!.label, input.protocol) === tool);
      const unmatchedPredictionIds = predicted.filter(feature => !matchedPredicted.has(feature.id)).map(feature => feature.id);
      const unmatchedAnnotatedReferenceIds = expectedFeatures.filter(feature => !matchedExpected.has(feature.id)).map(feature => feature.id);
      const complete = reference.coverage[tool] === 'complete', tp = pairs.length;
      return { tool, coverage: reference.coverage[tool] ?? 'unknown', tp, fp: complete ? unmatchedPredictionIds.length : null,
        fn: complete ? unmatchedAnnotatedReferenceIds.length : null,
        precision: complete && predicted.length ? tp / predicted.length : null, recall: complete && expectedFeatures.length ? tp / expectedFeatures.length : null,
        correctAbstention: complete && expectedFeatures.length === 0 ? predicted.length === 0 && (o.features.length > 0 || o.noSignal) : null,
        unmatchedPredictionIds, unmatchedAnnotatedReferenceIds, pairs,
        nearestErrors: result.nearestErrors.filter(error => toolFor(predictedById.get(error.predictedId)!.label, input.protocol) === tool), latencyMs: result.metrics.latencyMs } satisfies Monaco50ToolResult;
    });
    const reviewedBeforeExecution = protocolReviewed && date(approvals[0].approvedAt) < date(attempt.audit.startedAt);
    const eligible = reviewed && reviewedBeforeExecution && result.provenance === 'GENUINE_PROVIDER' && toolResults.every(t => t.coverage === 'complete');
    const exact = toolResults.every(t => t.fp === 0 && t.fn === 0 && t.correctAbstention !== false) && result.metrics.latencyMs <= input.protocol.maxLatencyMs;
    return { ...base(), status: 'MEASURED', reason: null, provenance: result.provenance, providerExecuted: result.provenance === 'GENUINE_PROVIDER',
      eligibleForAcceptance: eligible, passed: eligible && exact, tools: toolResults };
  });
  const summary = summarizeMonaco50Progress(input.manifest, cases);
  return { purpose: 'OFFLINE_BENCHMARK_REPORT' as const, hashes, protocolDeclaredStatus: input.protocol.status, protocolReviewed,
    frozen, historyFrozen, issues, cases, summary, acceptance: issues.length === 0 && summary.passed === 50 ? 'PASS' as const : 'BLOCKED' as const,
    dispatchAuthorised: false as const, productionReady: false as const,
    limitations: ['Synthetic fixtures are code regressions, not accuracy measurements.',
      'Preparation counts metadata only; source, rights and annotation truth require independent review.',
      'The complete retained execution history and trusted external reviews/receipts must be supplied; omitted prior exposure cannot be detected.'] };
}

/** No observations means zero executions, measurements, passes, and provider results. */
export function summarizeMonaco50Progress(manifest: Monaco50Manifest, results: readonly Monaco50CaseResult[] = []) {
  const metadata = checkMonaco50Manifest(manifest), ids = new Set(manifest.cases.map(c => c.caseId));
  const invalidResults = results.some(r => !ids.has(r.caseId)) || new Set(results.map(r => r.caseId)).size !== results.length;
  const rows = invalidResults ? [] : results;
  const measured = rows.filter(r => r.status === 'MEASURED' && r.eligibleForAcceptance && r.provenance === 'GENUINE_PROVIDER');
  const byTool = MONACO50_TOOLS.map(tool => {
    const tools = measured.flatMap(r => r.tools?.filter(t => t.tool === tool && t.coverage === 'complete') ?? []);
    const tp = tools.reduce((n, t) => n + t.tp, 0), fp = tools.reduce((n, t) => n + (t.fp ?? 0), 0), fn = tools.reduce((n, t) => n + (t.fn ?? 0), 0);
    return { tool, measuredCases: tools.length, unmeasuredCases: 50 - tools.length,
      technicalFailures: rows.filter(r => r.technicalFailure).length,
      tp, fp, fn, correctAbstentions: tools.filter(t => t.correctAbstention === true).length,
      precision: tp + fp ? tp / (tp + fp) : null, recall: tp + fn ? tp / (tp + fn) : null };
  });
  return { required: 50, developmentRequired: 6, heldoutRequired: 44, prepared: metadata.prepared,
    categoryCounts: metadata.categoryCounts, requiredCategoryCounts: metadata.requiredCategoryCounts,
    reviewed: rows.filter(r => r.reviewed).length, executed: rows.filter(r => r.providerExecuted).length,
    measured: measured.length, passed: measured.filter(r => r.passed).length,
    actualProviderResults: rows.filter(r => r.status === 'MEASURED' && r.provenance === 'GENUINE_PROVIDER').length,
    syntheticFixturesScored: rows.filter(r => r.status === 'MEASURED' && r.provenance === 'SYNTHETIC_OFFLINE').length,
    technicalFailures: rows.filter(r => r.technicalFailure).length,
    unreadableCases: rows.filter(r => r.reason === 'UNREADABLE' || r.reason === 'UNREADABLE_REFERENCE').length,
    unmeasured: 50 - measured.length,
    missingObservations: Math.max(0, 50 - rows.length) + rows.filter(r => r.reason === 'MISSING_OBSERVATION').length,
    heldoutMeasured: measured.filter(r => r.split === 'heldout').length, heldoutPassed: measured.filter(r => r.split === 'heldout' && r.passed).length,
    byTool, status: invalidResults || metadata.issues.length ? 'INVALID' as const : measured.length === 50 ? 'MEASURED' as const : 'INCOMPLETE' as const,
    dispatchAuthorised: false as const, productionReady: false as const };
}
