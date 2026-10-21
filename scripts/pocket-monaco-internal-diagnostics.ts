/** Separately versioned, offline development diagnostics. No human-reference substitute,
 * provider client, dispatch, receipt fabrication, or expert acceptance path. */
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { calibratePocketAnalysis } from '../app/api/pocket/analysis-calibration.ts';
import { assessProductionLiquidityChain, corroborateLiquidityEvent } from '../app/api/pocket/liquidity-chain.ts';
import { exactAxisPrice } from '../app/pocket/axis-verification.ts';

export const INTERNAL_DIAGNOSTIC_TOOLS = ['pattern', 'level', 'liquidity_pool', 'liquidity_event'] as const;
type Tool = typeof INTERNAL_DIAGNOSTIC_TOOLS[number];
type Json = Record<string, unknown>;
type Point = { x: number; y: number };
type SourcePoint = Point & { price: number; sourcePriceToken?: string | number };
type Candle = { barIndex: number; timestamp: string; points: Record<'open' | 'high' | 'low' | 'close', SourcePoint> };
type Scale = { width: number; height: number; coordinates: 'ORIGINAL_IMAGE_PIXELS'; plot: { left: number; right: number; top: number; bottom: number }; priceMin: number; priceMax: number; pricePerPixel: number; pixelQuantizationBound: number };
type Assessability = { status: 'OBJECTIVE_ONLY' | 'UNSCORED'; reasonCode: string; reason: string };
export type InternalSourceCase = {
  caseId: string; instrument: string; inputInstrument?: string; timeframe: string;
  identities: { subsetManifestSha256: string; inputSha256: string; imageSha256: string; sourceZipSha256: string; sourceMemberSha256: string; barsSha256: string; calibrationSha256: string };
  objective: { aggregation: { exactOhlcvMatch: boolean; barCount: number }; priceScale: Scale; candles: Candle[] };
  perToolAssessability: Record<Tool, Assessability>;
};
export const INTERNAL_DIAGNOSTIC_PROTOCOL = {
  schemaVersion: 1,
  protocolId: 'MONACO_INTERNAL_DIAGNOSTICS_V1',
  purpose: 'INTERNAL_DEVELOPMENT_DIAGNOSTICS_WITHOUT_HUMAN_REFERENCES',
  caseIds: ['d001', 'd002', 'd003', 'd004', 'd005', 'd006'],
  scope: 'FIRST_SIX_DEVELOPMENT_ONLY',
  referenceKind: 'MONACO_INTERNAL_SOURCE_REFERENCE',
  coordinates: 'ORIGINAL_IMAGE_PIXELS',
  scannerCoordinates: 'FULL_ORIGINAL_IMAGE_PERCENT',
  comparisonAllowancePixels: 0.5,
  maximumCombinedPixelTolerance: 2,
  priceTolerance: 'COMBINED_PIXEL_TOLERANCE_TIMES_SOURCE_PRICE_PER_PIXEL',
  toleranceMeaning: 'RENDERING_UNITS_NOT_EXCHANGE_TICKS',
  weakPatternCaseIds: ['d003'],
  ambiguousPatternStatuses: ['AMBIGUOUS'],
  emptyOutputMeaning: 'NO_ASSERTION_NOT_TRUE_NEGATIVE',
  interpretation: 'UNSCORED_WITHOUT_SEMANTIC_REFERENCES',
  expertAcceptance: 'UNRESOLVED',
  dispatchAuthorised: false,
} as const;
Object.freeze(INTERNAL_DIAGNOSTIC_PROTOCOL.caseIds);
Object.freeze(INTERNAL_DIAGNOSTIC_PROTOCOL.weakPatternCaseIds);
Object.freeze(INTERNAL_DIAGNOSTIC_PROTOCOL.ambiguousPatternStatuses);
Object.freeze(INTERNAL_DIAGNOSTIC_PROTOCOL);

const object = (x: unknown): x is Json => !!x && typeof x === 'object' && !Array.isArray(x);
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const hash = (x: unknown): x is string => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const sha256 = (x: Uint8Array) => createHash('sha256').update(x).digest('hex');
const text = (x: unknown): x is string => typeof x === 'string' && x.length > 0;
function check(ok: unknown, reason: string): asserts ok { if (!ok) throw Error(reason); }
function record(x: unknown, reason: string): Json { check(object(x), reason); return x; }
function array(x: unknown, maximum: number, reason: string): unknown[] { check(Array.isArray(x) && x.length <= maximum, reason); return x; }
function member(x: unknown, options: readonly string[], reason: string): string { check(typeof x === 'string' && options.includes(x), reason); return x; }
function parse(bytes: Uint8Array): unknown { return JSON.parse(Buffer.from(bytes).toString('utf8')); }
function pct(x: unknown): number { check(finite(x) && x >= 0 && x <= 100, 'INVALID_PERCENT_COORDINATE'); return x; }
function point(x: unknown, size: { width: number; height: number }): Point { const p = record(x, 'MALFORMED_POINT'); return { x: pct(p.x) * size.width / 100, y: pct(p.y) * size.height / 100 }; }
function price(x: unknown): number | null { return finite(x) ? x : typeof x === 'string' ? exactAxisPrice(x) : null; }
function sourceDecimal(x: unknown): number { const result = typeof x === 'string' && /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(x) ? Number(x) : x; check(finite(result), 'SOURCE_DECIMAL_INVALID'); return result; }
const formatError = (e: unknown) => e instanceof Error ? e.message : 'MALFORMED_DIAGNOSTIC';

type Pattern = { id: string; raw: Json; points: Point[] };
type Level = { id: string; raw: Json; points: Point[]; price: number | null };
type Zone = { id: string; raw: Json; points: Point[]; price: number | null; low: number | null; high: number | null };
type Witness = { id: string; raw: Json; point: Point };
type Normalized = { status: 'NORMALIZED'; rawResponseSha256: string; raw: Json; readable: boolean; scaleReadable: boolean; patterns: Pattern[]; levels: Level[]; zones: Zone[]; witnesses: Witness[]; axisAnchors: { id: string; price: number; y: number }[] };

/** Preserve raw assertions and their order. No filtering, calibration, relabeling,
 * deduplication, clamping, or reference-derived fields are applied to the response. */
export function normalizeInternalDiagnosticObservation(rawResponseBytes: Uint8Array, size: { width: number; height: number }): Normalized | { status: 'UNMEASURED'; reason: string; rawResponseSha256: string } {
  const rawResponseSha256 = sha256(rawResponseBytes);
  try {
    check(Number.isSafeInteger(size.width) && Number.isSafeInteger(size.height) && size.width > 0 && size.height > 0, 'INVALID_IMAGE_DIMENSIONS');
    const raw = record(parse(rawResponseBytes), 'MALFORMED_SCANNER_OBJECT');
    const quality = record(raw.evidenceQuality, 'MISSING_READABILITY');
    member(quality.chartReadability, ['CLEAR', 'PARTIAL', 'POOR'], 'INVALID_READABILITY');
    check(typeof quality.candlesReadable === 'boolean' && typeof quality.scaleReadable === 'boolean', 'MISSING_READABILITY');
    const patterns = array(raw.patterns, 4, 'MALFORMED_PATTERNS').map((value, i) => {
      const p = record(value, 'MALFORMED_PATTERN');
      check(text(p.name) && typeof p.evidence === 'string' && typeof p.confirmation === 'string' && typeof p.invalidation === 'string', 'MALFORMED_PATTERN');
      member(p.status, ['FORMING', 'CONFIRMED', 'FAILED', 'EXTENDED', 'AMBIGUOUS'], 'MALFORMED_PATTERN_STATUS');
      member(p.confidence, ['HIGH', 'MEDIUM', 'LOW'], 'MALFORMED_PATTERN_CONFIDENCE');
      const geometry = record(p.geometry, 'MALFORMED_PATTERN_GEOMETRY');
      return { id: `patterns[${i}]`, raw: p, points: array(geometry.points, 10, 'MALFORMED_PATTERN_POINTS').map(p => point(p, size)) };
    });
    const levels = array(raw.levels, 8, 'MALFORMED_LEVELS').map((value, i) => {
      const p = record(value, 'MALFORMED_LEVEL');
      member(p.kind, ['support', 'resistance', 'trend', 'pivot', 'zone', 'gap'], 'MALFORMED_LEVEL_KIND');
      check(typeof p.price === 'string', 'MALFORMED_LEVEL_PRICE');
      return { id: `levels[${i}]`, raw: p, points: [point(p, size), point({ x: p.x2, y: p.y2 }, size)], price: price(p.price) };
    });
    const liquidity = record(raw.liquidity, 'MALFORMED_LIQUIDITY');
    member(liquidity.state, ['VERIFIED', 'PARTIAL', 'NONE'], 'MALFORMED_LIQUIDITY_STATE');
    member(liquidity.event, ['NONE', 'TESTING', 'SWEEP', 'RECLAIM', 'REJECTION'], 'MALFORMED_LIQUIDITY_EVENT');
    member(liquidity.confidence, ['HIGH', 'MEDIUM', 'LOW'], 'MALFORMED_LIQUIDITY_CONFIDENCE');
    const zones = array(liquidity.zones, 4, 'MALFORMED_ZONES').map((value, i) => {
      const p = record(value, 'MALFORMED_ZONE');
      member(p.side, ['BUY_SIDE', 'SELL_SIDE'], 'MALFORMED_ZONE_SIDE');
      member(p.basis, ['EQUAL_HIGHS', 'EQUAL_LOWS', 'PRIOR_SWING_HIGH', 'PRIOR_SWING_LOW', 'RANGE_HIGH', 'RANGE_LOW'], 'MALFORMED_ZONE_BASIS');
      check(typeof p.price === 'string', 'MALFORMED_ZONE_PRICE');
      const hasBand = p.priceLow != null || p.priceHigh != null;
      check(!hasBand || (finite(p.priceLow) && finite(p.priceHigh)), 'MALFORMED_PRICE_BAND');
      return { id: `liquidity.zones[${i}]`, raw: p, points: [point(p, size), point({ x: p.x2, y: p.y }, size)], price: price(p.price), low: hasBand ? p.priceLow as number : null, high: hasBand ? p.priceHigh as number : null };
    });
    const witnesses = array(liquidity.observations, 12, 'MALFORMED_OBSERVATIONS').map((value, i) => {
      const p = record(value, 'MALFORMED_WITNESS');
      member(p.kind, ['equal-highs', 'equal-lows', 'rejection', 'sweep-reclaim'], 'MALFORMED_WITNESS_KIND');
      member(p.side, ['buy-side', 'sell-side'], 'MALFORMED_WITNESS_SIDE');
      member(p.confidence, ['HIGH', 'MEDIUM', 'LOW'], 'MALFORMED_WITNESS_CONFIDENCE');
      return { id: `liquidity.observations[${i}]`, raw: p, point: point(p, size) };
    });
    const axisAnchors = array(raw.priceScaleAnchors, 4, 'MALFORMED_AXIS_ANCHORS').map((value, i) => {
      const p = record(value, 'MALFORMED_AXIS_ANCHOR'); check(finite(p.price), 'MALFORMED_AXIS_PRICE');
      return { id: `priceScaleAnchors[${i}]`, price: p.price, y: pct(p.y) * size.height / 100 };
    });
    check(!(liquidity.state === 'NONE' && (zones.length || witnesses.length || liquidity.event !== 'NONE')), 'CONTRADICTORY_LIQUIDITY_NONE');
    if (raw.noSignal !== undefined) check(typeof raw.noSignal === 'boolean' && !(raw.noSignal && (patterns.length || levels.length || zones.length || witnesses.length || liquidity.event !== 'NONE')), 'CONTRADICTORY_NO_SIGNAL');
    return { status: 'NORMALIZED', rawResponseSha256, raw, readable: quality.candlesReadable && quality.chartReadability !== 'POOR', scaleReadable: quality.scaleReadable, patterns, levels, zones, witnesses, axisAnchors };
  } catch (e) { return { status: 'UNMEASURED', reason: formatError(e), rawResponseSha256 }; }
}

function validateOracle(value: unknown, caseId: string): InternalSourceCase {
  const root = record(value, 'MALFORMED_SOURCE_REFERENCE');
  check(root.schemaVersion === 1 && root.kind === INTERNAL_DIAGNOSTIC_PROTOCOL.referenceKind && isDeepStrictEqual(root.caseIds, INTERNAL_DIAGNOSTIC_PROTOCOL.caseIds), 'SOURCE_REFERENCE_SCOPE_MISMATCH');
  const cases = array(root.cases, 6, 'MALFORMED_SOURCE_CASES') as InternalSourceCase[];
  check(cases.length === 6 && isDeepStrictEqual(cases.map(c => c.caseId), INTERNAL_DIAGNOSTIC_PROTOCOL.caseIds), 'EXACT_FIRST_SIX_REQUIRED');
  const c = cases.find(c => c.caseId === caseId); check(c, 'CASE_OUTSIDE_DEVELOPMENT_SCOPE');
  check(text(c.instrument) && text(c.timeframe), 'SOURCE_IDENTITY_MISSING');
  check(object(c.identities) && ['subsetManifestSha256', 'inputSha256', 'imageSha256', 'sourceZipSha256', 'sourceMemberSha256', 'barsSha256', 'calibrationSha256'].every(k => hash((c.identities as unknown as Json)[k])), 'SOURCE_HASH_IDENTITIES_INVALID');
  const rawScale = c.objective?.priceScale, rawCandles = c.objective?.candles;
  check(rawScale && Array.isArray(rawCandles), 'SOURCE_SCALE_INVALID');
  const s = { ...rawScale, priceMin: sourceDecimal(rawScale.priceMin), priceMax: sourceDecimal(rawScale.priceMax) };
  const candles = rawCandles.map(candle => ({ ...candle, points: Object.fromEntries((['open', 'high', 'low', 'close'] as const).map(key => {
    const p = candle.points?.[key]; check(p, 'SOURCE_CANDLE_INVALID');
    return [key, { ...p, sourcePriceToken: p.price, price: sourceDecimal(p.price) }];
  })) as Candle['points'] }));
  check(s && s.coordinates === 'ORIGINAL_IMAGE_PIXELS' && Number.isSafeInteger(s.width) && Number.isSafeInteger(s.height) && s.width > 0 && s.height > 0 && object(s.plot), 'SOURCE_SCALE_INVALID');
  check([s.plot.left, s.plot.right, s.plot.top, s.plot.bottom, s.priceMin, s.priceMax, s.pricePerPixel, s.pixelQuantizationBound].every(finite) &&
    s.plot.left >= 0 && s.plot.top >= 0 && s.plot.right <= s.width && s.plot.bottom <= s.height && s.plot.left < s.plot.right && s.plot.top < s.plot.bottom &&
    s.priceMax > s.priceMin && s.pricePerPixel > 0 && s.pixelQuantizationBound >= 0 && s.pixelQuantizationBound + INTERNAL_DIAGNOSTIC_PROTOCOL.comparisonAllowancePixels <= INTERNAL_DIAGNOSTIC_PROTOCOL.maximumCombinedPixelTolerance, 'SOURCE_SCALE_INVALID');
  const expectedStep = (s.priceMax - s.priceMin) / (s.plot.bottom - s.plot.top);
  check(Math.abs(expectedStep - s.pricePerPixel) <= Math.max(1, Math.abs(expectedStep)) * 1e-12, 'SOURCE_PRICE_PROJECTION_MISMATCH');
  check(c.objective.aggregation?.exactOhlcvMatch === true && Array.isArray(candles) && candles.length > 0 && candles.length <= 10000 && c.objective.aggregation.barCount === candles.length, 'SOURCE_OHLCV_NOT_REPRODUCED');
  for (const [i, candle] of candles.entries()) {
    check(candle.barIndex === i && text(candle.timestamp) && object(candle.points), 'SOURCE_CANDLE_INVALID');
    for (const key of ['open', 'high', 'low', 'close'] as const) {
      const p = candle.points[key];
      check(p && [p.x, p.y, p.price].every(finite) && p.x >= s.plot.left && p.x <= s.plot.right && p.y >= s.plot.top && p.y <= s.plot.bottom, 'SOURCE_CANDLE_INVALID');
      check(Math.abs(p.y - (s.plot.bottom - (p.price - s.priceMin) / s.pricePerPixel)) <= s.pixelQuantizationBound + 1e-8, 'SOURCE_POINT_PROJECTION_MISMATCH');
      check(p.x === candle.points.open.x, 'SOURCE_CANDLE_X_MISMATCH');
    }
    check(candle.points.high.price >= Math.max(candle.points.open.price, candle.points.close.price) && candle.points.low.price <= Math.min(candle.points.open.price, candle.points.close.price), 'SOURCE_OHLC_INVALID');
    if (i) check(candle.points.open.x > candles[i - 1].points.open.x, 'SOURCE_BARS_NOT_ORDERED');
  }
  for (const tool of INTERNAL_DIAGNOSTIC_TOOLS) {
    const a = c.perToolAssessability?.[tool]; check(a && ['OBJECTIVE_ONLY', 'UNSCORED'].includes(a.status) && text(a.reasonCode) && text(a.reason), 'SOURCE_ASSESSABILITY_MISSING');
  }
  return { ...c, objective: { ...c.objective, priceScale: s, candles } };
}

type CheckResult = { status: 'CONFORMANT' | 'NONCONFORMANT' | 'UNSCORED'; reason: string; pixelError?: number; priceError?: number; [key: string]: unknown };
const unscored = (reason: string): CheckResult => ({ status: 'UNSCORED', reason });
function atPriceRow(priceValue: number | null, y: number, s: Scale, tolerance: number): CheckResult {
  if (priceValue === null) return unscored('EXACT_NUMERIC_PRICE_UNAVAILABLE');
  const sourcePriceAtRow = s.priceMin + (s.plot.bottom - y) * s.pricePerPixel;
  const pixelError = Math.abs(priceValue - sourcePriceAtRow) / s.pricePerPixel;
  return { status: pixelError <= tolerance && y >= s.plot.top && y <= s.plot.bottom && priceValue >= s.priceMin && priceValue <= s.priceMax ? 'CONFORMANT' : 'NONCONFORMANT', reason: 'SOURCE_SCALE_PRICE_ROW_AGREEMENT_ONLY', pixelError, priceError: Math.abs(priceValue - sourcePriceAtRow), suppliedPrice: priceValue, sourcePriceAtRow };
}
function nearest(p: Point, candles: Candle[], keys: readonly (keyof Candle['points'])[], tolerance: number): CheckResult {
  let minimum = Infinity; let matches: { barIndex: number; kind: string; point: SourcePoint }[] = [];
  for (const candle of candles) for (const key of keys) {
    const q = candle.points[key], d = Math.hypot(p.x - q.x, p.y - q.y);
    if (d < minimum) { minimum = d; matches = [{ barIndex: candle.barIndex, kind: key, point: q }]; }
    else if (d === minimum) matches.push({ barIndex: candle.barIndex, kind: key, point: q });
  }
  return { status: minimum <= tolerance ? 'CONFORMANT' : 'NONCONFORMANT', reason: 'NEAREST_SOURCE_ENDPOINT_NOT_SEMANTIC_TRUTH', pixelError: minimum, matches };
}
function summary(results: { conformance: CheckResult }[]) {
  return { assertions: results.length, conformant: results.filter(r => r.conformance.status === 'CONFORMANT').length, nonconformant: results.filter(r => r.conformance.status === 'NONCONFORMANT').length, unscored: results.filter(r => r.conformance.status === 'UNSCORED').length, emptyOutput: results.length === 0, trueNegatives: null, semanticTp: null, semanticFp: null, semanticFn: null };
}
export type InternalDiagnosticInput = {
  caseId: string; status: 'COMPLETED' | 'NOT_EXECUTED' | 'TRANSPORT_ERROR' | 'HOLD' | 'CANCELLED';
  inputSha256: string; imageSha256: string; rawResponseBytes: Uint8Array; rawResponseSha256: string;
  oracleBytes: Uint8Array; oracleSha256: string; protocolBytes: Uint8Array; protocolSha256: string;
  latencyMs: number | null; evidenceKind: 'SYNTHETIC_FIXTURE' | 'RETAINED_SCANNER_OUTPUT';
};

/** Measures source geometry and declared scanner-rule conformance only. No semantic
 * reference labels are constructed, so this deliberately does not invoke the legacy
 * acceptance scorer with fabricated annotators or executor receipts. */
export function scoreInternalDiagnostics(input: InternalDiagnosticInput) {
  const base = { protocolId: INTERNAL_DIAGNOSTIC_PROTOCOL.protocolId, caseId: input.caseId, purpose: INTERNAL_DIAGNOSTIC_PROTOCOL.purpose, expertAcceptance: 'UNRESOLVED', tradingInterpretation: 'UNSCORED', dispatchAuthorised: false, providerAuthenticity: 'NOT_ATTESTED_BY_DIAGNOSTIC_WRAPPER', actualProviderResults: 0 } as const;
  const unmeasured = (reason: string) => ({ ...base, status: 'UNMEASURED', reason, metrics: null } as const);
  if (input.status !== 'COMPLETED') return unmeasured(input.status);
  try {
    check([input.inputSha256, input.imageSha256, input.rawResponseSha256, input.oracleSha256, input.protocolSha256].every(hash), 'DIAGNOSTIC_HASH_INVALID');
    check(sha256(input.oracleBytes) === input.oracleSha256 && sha256(input.protocolBytes) === input.protocolSha256 && sha256(input.rawResponseBytes) === input.rawResponseSha256, 'DIAGNOSTIC_ARTIFACT_HASH_MISMATCH');
    check(isDeepStrictEqual(parse(input.protocolBytes), INTERNAL_DIAGNOSTIC_PROTOCOL), 'DIAGNOSTIC_PROTOCOL_VERSION_MISMATCH');
    check(finite(input.latencyMs) && input.latencyMs >= 0 && ['SYNTHETIC_FIXTURE', 'RETAINED_SCANNER_OUTPUT'].includes(input.evidenceKind), 'DIAGNOSTIC_OBSERVATION_INVALID');
    const c = validateOracle(parse(input.oracleBytes), input.caseId), s = c.objective.priceScale;
    check(c.identities.inputSha256 === input.inputSha256 && c.identities.imageSha256 === input.imageSha256, 'DIAGNOSTIC_CASE_BINDING_MISMATCH');
    const n = normalizeInternalDiagnosticObservation(input.rawResponseBytes, s);
    if (n.status !== 'NORMALIZED') return unmeasured(n.reason);
    if (!n.readable) return unmeasured('UNREADABLE_SCANNER_OUTPUT');
    const tolerance = s.pixelQuantizationBound + INTERNAL_DIAGNOSTIC_PROTOCOL.comparisonAllowancePixels;
    const inside = (p: Point) => p.x >= s.plot.left && p.x <= s.plot.right && p.y >= s.plot.top && p.y <= s.plot.bottom;
    const unavailable = (tool: Tool) => c.perToolAssessability[tool].status === 'UNSCORED' ? c.perToolAssessability[tool].reasonCode : null;
    const candles = c.objective.candles;
    const patterns = n.patterns.map(p => {
      const anchors = p.points.map(v => nearest(v, candles, ['high', 'low'], tolerance));
      const result = calibratePocketAnalysis({ evidenceQuality: n.raw.evidenceQuality, patterns: [p.raw] }) as { patterns: Json[] };
      const retained = result.patterns.length === 1 && result.patterns[0].status === p.raw.status;
      const skip = unavailable('pattern') || (INTERNAL_DIAGNOSTIC_PROTOCOL.weakPatternCaseIds as readonly string[]).includes(c.caseId) && 'UNSCORED_WEAK_4H' || p.raw.status === 'AMBIGUOUS' && 'AMBIGUOUS_PATTERN' || p.raw.confidence === 'LOW' && 'LOW_CONFIDENCE_PATTERN';
      const conformance: CheckResult = skip ? unscored(String(skip)) : { status: retained && anchors.every(a => a.status === 'CONFORMANT') ? 'CONFORMANT' : 'NONCONFORMANT', reason: 'EXISTING_STRUCTURAL_GATE_AND_SOURCE_WICK_ALIGNMENT_ONLY' };
      return { id: p.id, raw: p.raw, sourceAnchors: anchors, existingStructuralGateRetained: retained, conformance, canonicalPatternTruth: 'UNSCORED', formationVersusConfirmation: 'UNSCORED_NO_MACHINE_WITNESS_IN_SCANNER_FIELDS' };
    });
    const levels = n.levels.map(p => {
      const projection = n.scaleReadable ? atPriceRow(p.price, p.points[0].y, s, tolerance) : unscored('SCANNER_PRICE_SCALE_UNREADABLE');
      const horizontal = p.raw.kind === 'support' || p.raw.kind === 'resistance';
      const conformance = unavailable('level') ? unscored(unavailable('level')!) : !horizontal ? unscored('NON_HORIZONTAL_LEVEL_HAS_NO_SEMANTIC_REFERENCE') : projection.status === 'UNSCORED' ? projection : { ...projection, status: projection.status === 'CONFORMANT' && p.points.every(inside) && p.points[0].y === p.points[1].y && p.points[0].x < p.points[1].x ? 'CONFORMANT' as const : 'NONCONFORMANT' as const, reason: 'HORIZONTAL_PRICE_GEOMETRY_ONLY' };
      return { id: p.id, raw: p.raw, projection, conformance, supportResistanceRole: 'UNSCORED', reactionMateriality: 'UNSCORED' };
    });
    const liquidity = n.raw.liquidity as Json;
    const rawZones = n.zones.map(z => z.raw) as { side: 'BUY_SIDE' | 'SELL_SIDE'; x: number; x2: number; y: number }[];
    const chain = assessProductionLiquidityChain(liquidity.observations, n.raw.evidenceQuality as Json, n.raw.plotBounds, rawZones);
    const witnesses = n.witnesses.map(w => ({ id: w.id, raw: w.raw, sourceAnchor: nearest(w.point, candles, w.raw.kind === 'equal-highs' ? ['high'] : w.raw.kind === 'equal-lows' ? ['low'] : ['open', 'high', 'low', 'close'], tolerance) }));
    const pools = n.zones.map(z => {
      const projection = n.scaleReadable ? atPriceRow(z.low !== null && z.high !== null ? (z.low + z.high) / 2 : z.price, z.points[0].y, s, tolerance) : unscored('SCANNER_PRICE_SCALE_UNREADABLE');
      const bandValid = z.low === null || (z.high !== null && z.low <= z.high && z.price !== null && z.price >= z.low && z.price <= z.high && z.low >= s.priceMin && z.high <= s.priceMax);
      const sideValid = z.raw.side === 'BUY_SIDE' ? ['EQUAL_HIGHS', 'PRIOR_SWING_HIGH', 'RANGE_HIGH'].includes(String(z.raw.basis)) : ['EQUAL_LOWS', 'PRIOR_SWING_LOW', 'RANGE_LOW'].includes(String(z.raw.basis));
      const local = witnesses.filter(w => w.raw.side === (z.raw.side === 'BUY_SIDE' ? 'buy-side' : 'sell-side') && Number(w.raw.x) >= Number(z.raw.x) && Number(w.raw.x) <= Number(z.raw.x2) && Math.abs(Number(w.raw.y) - Number(z.raw.y)) <= 3);
      const conformance: CheckResult = unavailable('liquidity_pool') ? unscored(unavailable('liquidity_pool')!) : projection.status === 'UNSCORED' ? projection : { status: projection.status === 'CONFORMANT' && z.points.every(inside) && Number(z.raw.x2) - Number(z.raw.x) >= 8 && bandValid && sideValid && chain.status === 'VERIFIED' && local.length >= 2 && local.every(w => w.sourceAnchor.status === 'CONFORMANT') ? 'CONFORMANT' : 'NONCONFORMANT', reason: 'EXISTING_POOL_RULE_AND_SOURCE_GEOMETRY_ONLY' };
      return { id: z.id, raw: z.raw, projection, conformance, semanticPoolTruth: 'UNSCORED' };
    });
    const corroborated = corroborateLiquidityEvent(String(liquidity.event), liquidity.observations, rawZones);
    const events = liquidity.event === 'NONE' ? [] : [{ id: 'liquidity.event', raw: liquidity.event, conformance: unavailable('liquidity_event') ? unscored(unavailable('liquidity_event')!) : liquidity.event === 'TESTING' ? unscored('TESTING_IS_NOT_A_COMPLETED_EVENT') : unscored('SCANNER_EVENT_FIELDS_DO_NOT_ESTABLISH_BREACH_RETURN_CLOSE_SEQUENCE'), existingEventRuleCorroborated: chain.status === 'VERIFIED' && corroborated === liquidity.event, eventChronology: 'UNSCORED', semanticEventTruth: 'UNSCORED' }];
    const axis = n.axisAnchors.map(a => ({ id: a.id, projection: n.scaleReadable ? atPriceRow(a.price, a.y, s, tolerance) : unscored('SCANNER_PRICE_SCALE_UNREADABLE') }));
    return { ...base, status: 'DIAGNOSTIC_RECORDED', evidenceKind: input.evidenceKind, latencyMs: input.latencyMs, rawResponseSha256: input.rawResponseSha256, sourceReferenceSha256: input.oracleSha256, protocolSha256: input.protocolSha256, identities: c.identities,
      tolerance: { originalPixels: tolerance, priceUnits: tolerance * s.pricePerPixel, exchangeTickSize: null },
      identity: { inputInstrument: c.inputInstrument ?? c.instrument, manifestInstrument: c.instrument, scannerInstrument: n.raw.instrument ?? null, scannerTimeframe: n.raw.timeframe ?? null, timeframeMatches: n.raw.timeframe === c.timeframe, instrumentExactlyMatchesInput: n.raw.instrument === (c.inputInstrument ?? c.instrument) },
      currentPrice: { supplied: price(n.raw.currentPrice), sourceLastClose: candles.at(-1)!.points.close.price, absoluteError: price(n.raw.currentPrice) === null ? null : Math.abs(price(n.raw.currentPrice)! - candles.at(-1)!.points.close.price) },
      tools: { pattern: { assertions: patterns, summary: summary(patterns) }, level: { assertions: levels, summary: summary(levels) }, liquidity_pool: { assertions: pools, summary: summary(pools) }, liquidity_event: { assertions: events, summary: summary(events) } },
      axis, liquidityWitnesses: witnesses, existingLiquidityChain: chain, sourceAssessability: c.perToolAssessability,
      absence: 'UNSCORED_NO_SEMANTIC_NEGATIVE_REFERENCE', rawScannerResponse: n.raw,
      limitations: ['SOURCE_ENDPOINT_AGREEMENT_IS_NOT_PATTERN_TRUTH', 'NO_SEMANTIC_TP_FP_FN_OR_TRUE_NEGATIVES', 'NO_TRADING_INTERPRETATION_OR_EXPERT_ACCEPTANCE', 'NO_PROVIDER_OR_FINANCE_ATTESTATION', 'DEVELOPMENT_ONLY_NO_HELDOUT_CLAIM'] } as const;
  } catch (e) { return unmeasured(formatError(e)); }
}
