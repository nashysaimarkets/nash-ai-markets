/** Offline evidence validation/scoring only. No dispatch, credentials or provider SDK. */
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { MONACO_REQUIRED_SCENARIOS } from './pocket-monaco-corpus-coverage.ts';
export type Feature = Readonly<{ id: string; label: string; pixels: readonly { x: number; y: number }[]; prices: readonly number[] }>;
export type CorpusCase = Readonly<{
  caseId: string; scenario: string; timeframe: string; instrument: string;
  rasterSha256: string; inputSha256: string; width: number; height: number;
  labelSha256: string; licenceSha256: string; reviewSha256: string;
  primaryAnnotator: string; independentAnnotator: string;
  negative: boolean; features: readonly Feature[];
  precisionRect?: Readonly<{ left: number; top: number; width: number; height: number }>;
}>;
export type EvidenceReview = Readonly<{
  /** Trusted out-of-band review records, never accepted from the corpus itself. */
  documentSha256: string; kind: 'LICENCE' | 'ANNOTATION'; reviewer: string;
  rasterSha256: string; inputSha256: string; labelSha256: string;
  validUntil: string; analysisAllowed: boolean; providerProcessingAllowed: boolean;
  canonicalCaseAccepted: boolean;
}>;
export type RecordedObservation = Readonly<{
  caseId: string; rasterSha256: string; inputSha256: string; labelSha256: string;
  candidateSha: string; model: string; requestId: string; executorReceiptSha256: string;
  rawResponseSha256: string; status: 'COMPLETED' | 'TRANSPORT_ERROR' | 'HOLD' | 'CANCELLED';
  latencyMs: number; features: readonly Feature[]; noSignal: boolean;
}>;
const sha = (v: string) => /^[a-f0-9]{64}$/.test(v);
const identifier = (s: string) => typeof s === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(s);
export const evidenceHash = (v: Uint8Array | string) => createHash('sha256').update(v).digest('hex');
function finite(v: number) { return typeof v === 'number' && Number.isFinite(v); }
export function validateFeatures(features: readonly Feature[], width: number, height: number) {
  if (!Array.isArray(features) || features.length > 200) throw Error('FEATURES_MISSING_OR_EXCESSIVE');
  const ids = new Set<string>();
  for (const f of features) {
    if (!f || !identifier(f.id) || ids.has(f.id) || !identifier(f.label) || !Array.isArray(f.pixels) || !Array.isArray(f.prices) ||
        f.pixels.length < 1 || f.pixels.length > 50 || f.prices.length < 1 || f.prices.length > 50 ||
        f.pixels.some((p: { x: number; y: number }) => !p || !finite(p.x) || !finite(p.y) || p.x < 0 || p.y < 0 || p.x > width || p.y > height) ||
        f.prices.some((p: number) => !finite(p))) throw Error('INVALID_FEATURE_EVIDENCE');
    ids.add(f.id);
  }
}
/** SHA-bound licence/review records must be obtained independently of submitted labels.
 * Passing validates the packet/record contract, not the legal grant or semantic truth. */
export async function validateMonacoEvidencePack(cases: readonly CorpusCase[], files: ReadonlyMap<string, Uint8Array>, reviews: readonly EvidenceReview[], now = Date.now()) {
  const issues: string[] = [];
  if (!Array.isArray(cases) || cases.length !== 6 || !Number.isSafeInteger(now)) return { status: 'BLOCKED', dispatchAuthorised: false, issues: ['EXACT_SIX_CASES_REQUIRED'] } as const;
  const ids = new Set<string>(), rasters = new Set<string>(), inputs = new Set<string>(), scenarios = new Set<string>();
  for (const c of cases) {
    try {
      if (!identifier(c.caseId) || ids.has(c.caseId) || rasters.has(c.rasterSha256) || inputs.has(c.inputSha256) ||
          ![c.rasterSha256,c.inputSha256,c.labelSha256,c.licenceSha256,c.reviewSha256].every(sha)) throw Error('DUPLICATE_OR_INVALID_IDENTITY');
      ids.add(c.caseId); rasters.add(c.rasterSha256); inputs.add(c.inputSha256);
      const required = MONACO_REQUIRED_SCENARIOS.find(s => s.scenario === c.scenario && (s.timeframe === null || s.timeframe === c.timeframe));
      if (!required || scenarios.has(required.key) || !/^[1-9]\d{0,2}[mhdw]$/.test(c.timeframe) || !c.instrument?.trim()) throw Error('CANONICAL_SCENARIO_MISMATCH');
      scenarios.add(required.key);
      if (c.negative !== (c.scenario === 'negative-no-signal') || (c.negative ? c.features.length !== 0 : c.features.length === 0)) throw Error('NEGATIVE_CONTROL_LABEL_MISMATCH');
      if (!identifier(c.primaryAnnotator) || !identifier(c.independentAnnotator) || c.primaryAnnotator === c.independentAnnotator) throw Error('INDEPENDENT_ANNOTATOR_REQUIRED');
      if (!Number.isSafeInteger(c.width) || !Number.isSafeInteger(c.height) || c.width < 10 || c.height < 10 || c.width * c.height > 40_000_000) throw Error('RASTER_DIMENSIONS_INVALID');
      validateFeatures(c.features,c.width,c.height);
      for (const h of [c.rasterSha256,c.inputSha256,c.labelSha256,c.licenceSha256,c.reviewSha256]) {
        const bytes = files.get(h); if (!bytes || evidenceHash(bytes) !== h) throw Error('ARTIFACT_HASH_MISMATCH');
      }
      const image = files.get(c.rasterSha256)!;
      const imageMetadata = await sharp(image,{ limitInputPixels: 40_000_000 }).metadata();
      if (!['png','jpeg'].includes(imageMetadata.format ?? '') || (imageMetadata.pages ?? 1) !== 1) throw Error('SINGLE_SCREENSHOT_RASTER_REQUIRED');
      const decoded = await sharp(image,{ limitInputPixels: 40_000_000, failOn: 'warning' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      if (decoded.info.width !== c.width || decoded.info.height !== c.height || decoded.info.channels !== 4) throw Error('ORIGINAL_RASTER_DIMENSIONS_MISMATCH');
      const input = JSON.parse(Buffer.from(files.get(c.inputSha256)!).toString('utf8'));
      if (input.precisionImage !== undefined) {
        const rect=c.precisionRect;
        if (!rect || !Object.values(rect).every(Number.isSafeInteger) || rect.left<0 || rect.top<0 || rect.width<1 || rect.height<1 ||
            rect.left+rect.width>c.width || rect.top+rect.height>c.height || typeof input.precisionImage!=='string' ||
            !/^data:image\/(png|jpeg);base64,/.test(input.precisionImage)) throw Error('SECONDARY_RASTER_MAPPING_REQUIRED');
        const encoded=input.precisionImage.split(',')[1], cropBytes=Buffer.from(encoded,'base64');
        if (cropBytes.toString('base64')!==encoded) throw Error('SECONDARY_BASE64_INVALID');
        const crop=await sharp(cropBytes,{limitInputPixels:40_000_000,failOn:'warning'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
        if(crop.info.width!==rect.width||crop.info.height!==rect.height) throw Error('SECONDARY_DIMENSIONS_MISMATCH');
        let total=0,maximum=0;
        for(let y=0;y<rect.height;y++)for(let x=0;x<rect.width;x++)for(let ch=0;ch<3;ch++) {
          const d=Math.abs(crop.data[(y*rect.width+x)*4+ch]-decoded.data[((y+rect.top)*c.width+x+rect.left)*4+ch]);total+=d;maximum=Math.max(maximum,d);
        }
        // Fixed conservative raster-comparison tolerance; never supplied by the corpus.
        if(total/(rect.width*rect.height*3)>3||maximum>40) throw Error('SECONDARY_PIXELS_DO_NOT_MATCH_ORIGINAL');
      } else if(c.precisionRect!==undefined) throw Error('SECONDARY_IMAGE_MISSING');
      if (input.chartConfirmation?.instrument !== c.instrument || input.chartConfirmation?.timeframe !== c.timeframe ||
          typeof input.image !== 'string' || !/^data:image\/(png|jpeg);base64,/.test(input.image)) throw Error('INPUT_CHART_IDENTITY_MISMATCH');
      const encoded = input.image.split(',')[1], original = Buffer.from(encoded, 'base64');
      if (original.toString('base64') !== encoded || evidenceHash(original) !== c.rasterSha256) throw Error('INPUT_ORIGINAL_BYTES_MISMATCH');
      const labels = JSON.parse(Buffer.from(files.get(c.labelSha256)!).toString('utf8'));
      if (labels.caseId !== c.caseId || labels.rasterSha256 !== c.rasterSha256 || labels.scenario !== c.scenario || labels.timeframe !== c.timeframe ||
          labels.negative !== c.negative || JSON.stringify(labels.precisionRect) !== JSON.stringify(c.precisionRect) || JSON.stringify(labels.features) !== JSON.stringify(c.features)) throw Error('LABEL_ARTIFACT_MISMATCH');
      for (const [kind, documentSha256] of [['LICENCE',c.licenceSha256],['ANNOTATION',c.reviewSha256]] as const) {
        const matches = reviews.filter(r => r.kind === kind && r.documentSha256 === documentSha256 && r.rasterSha256 === c.rasterSha256 &&
          r.inputSha256 === c.inputSha256 && r.labelSha256 === c.labelSha256);
        if (matches.length !== 1) throw Error('INDEPENDENT_EVIDENCE_REVIEW_REQUIRED');
        const r = matches[0];
        if (!identifier(r.reviewer) || !Number.isFinite(Date.parse(r.validUntil)) || Date.parse(r.validUntil) <= now ||
            r.analysisAllowed !== true || r.providerProcessingAllowed !== true || r.canonicalCaseAccepted !== true ||
            (kind === 'ANNOTATION' && r.reviewer !== c.independentAnnotator)) throw Error('EVIDENCE_SCOPE_OR_EXPIRY_INVALID');
      }
    } catch (error) { issues.push(`${c?.caseId ?? 'invalid'}:${error instanceof Error ? error.message : 'INVALID_CASE'}`); }
  }
  if (scenarios.size !== 6) issues.push('CANONICAL_COVERAGE_INCOMPLETE');
  return { status: issues.length ? 'BLOCKED' : 'PACK_CONTRACT_PASS', dispatchAuthorised: false, issues,
    remainingGates: ['INDEPENDENT_LEGAL_AND_SEMANTIC_REVIEW','SPECIFIC_INFERENCE_AUTHORITY','EXECUTOR_FINANCE_AND_AGGREGATE_BUDGET','GENUINE_PROVIDER_MEASUREMENTS'] } as const;
}
function errors(a: Feature, b: Feature) {
  if (a.label !== b.label || a.pixels.length !== b.pixels.length || a.prices.length !== b.prices.length) return null;
  return { pixel: Math.max(...a.pixels.map((p,i)=>Math.hypot(p.x-b.pixels[i].x,p.y-b.pixels[i].y))),
    price: Math.max(...a.prices.map((p,i)=>Math.abs(p-b.prices[i]))) };
}
/** Maximum-cardinality one-to-one matching: duplicates are FP; do not greedy-understate recall. */
export function scoreMonacoObservation(reference: CorpusCase, observation: RecordedObservation, acceptance: {
  candidateSha: string; model: string; reviewedExecutorReceipts: readonly {
    receiptSha256: string; caseId: string; requestId: string; candidateSha: string; model: string; rawResponseSha256: string;
    rasterSha256: string; inputSha256: string; labelSha256: string; costReconciled: boolean; provenance: 'GENUINE_PROVIDER' | 'SYNTHETIC_OFFLINE';
  }[]; rawResponse: Uint8Array;
  pixelTolerance: number; priceTolerance: number;
}) {
  const unmeasured = (reason: string) => ({ status: 'UNMEASURED', caseId: reference.caseId, reason, metrics: null, dispatchAuthorised: false } as const);
  if (observation.status !== 'COMPLETED') return unmeasured(observation.status);
  try {
    const receipts=acceptance.reviewedExecutorReceipts.filter(r=>r.receiptSha256===observation.executorReceiptSha256);
    const receipt=receipts[0];
    if(receipts.length!==1||!receipt||receipt.caseId!==observation.caseId||receipt.requestId!==observation.requestId||
       receipt.candidateSha!==observation.candidateSha||receipt.model!==observation.model||receipt.rawResponseSha256!==observation.rawResponseSha256||
       receipt.rasterSha256!==observation.rasterSha256||receipt.inputSha256!==observation.inputSha256||receipt.labelSha256!==observation.labelSha256||
       receipt.costReconciled!==true||!['GENUINE_PROVIDER','SYNTHETIC_OFFLINE'].includes(receipt.provenance))throw Error('EXECUTOR_RECEIPT_SCOPE_MISMATCH');
    if (observation.caseId !== reference.caseId || observation.rasterSha256 !== reference.rasterSha256 ||
        observation.inputSha256 !== reference.inputSha256 || observation.labelSha256 !== reference.labelSha256 ||
        !/^[a-f0-9]{40}$/.test(acceptance.candidateSha) || observation.candidateSha !== acceptance.candidateSha || observation.model !== acceptance.model ||
        typeof observation.requestId !== 'string' || !observation.requestId.trim() || observation.requestId.length > 200 ||
        !sha(observation.executorReceiptSha256) ||
        evidenceHash(acceptance.rawResponse) !== observation.rawResponseSha256 || !finite(observation.latencyMs) || observation.latencyMs < 0 ||
        !finite(acceptance.pixelTolerance) || acceptance.pixelTolerance < 0 || !finite(acceptance.priceTolerance) || acceptance.priceTolerance < 0 ||
        typeof observation.noSignal !== 'boolean') throw Error('MEASUREMENT_PROVENANCE_INVALID');
    validateFeatures(reference.features,reference.width,reference.height); validateFeatures(observation.features,reference.width,reference.height);
    // Raw normalized observation must match the retained response artifact. No post-hoc removal of false hypotheses.
    const raw = JSON.parse(Buffer.from(acceptance.rawResponse).toString('utf8'));
    if (JSON.stringify(raw.features) !== JSON.stringify(observation.features) || raw.noSignal !== observation.noSignal) throw Error('RAW_OBSERVATION_MISMATCH');
    if (observation.noSignal && observation.features.length) throw Error('CONTRADICTORY_NO_SIGNAL');
    const predicted = observation.features, expected = reference.features;
    const edges = predicted.map(p => expected.flatMap((e,i)=>{const d=errors(p,e);return d && d.pixel<=acceptance.pixelTolerance && d.price<=acceptance.priceTolerance?[i]:[];}));
    const matched = new Map<number,number>();
    function augment(p: number, visited: Set<number>): boolean {
      for(const e of edges[p]) { if(visited.has(e))continue;visited.add(e);const old=matched.get(e);if(old===undefined||augment(old,visited)){matched.set(e,p);return true;} } return false;
    }
    predicted.forEach((_,i)=>augment(i,new Set()));
    const tp=matched.size,fp=predicted.length-tp,fn=expected.length-tp;
    const pairs=[...matched].map(([e,p])=>({expectedId:expected[e].id,predictedId:predicted[p].id,...errors(predicted[p],expected[e])!}));
    const nearestErrors=predicted.map(p=>{const ds=expected.map(e=>errors(p,e)).filter((x): x is NonNullable<typeof x>=>x!==null);return {predictedId:p.id,nearestPixelError:ds.length?Math.min(...ds.map(d=>d.pixel)):null,nearestPriceError:ds.length?Math.min(...ds.map(d=>d.price)):null};});
    return { status:'MEASURED',caseId:reference.caseId,provenance:receipt.provenance,scenario:reference.scenario,timeframe:reference.timeframe,requestId:observation.requestId,dispatchAuthorised:false,metrics:{tp,fp,fn,precision:tp+fp?tp/(tp+fp):null,recall:tp+fn?tp/(tp+fn):null,
      trueNegative:reference.negative && predicted.length===0 && observation.noSignal,negativeCasePassed:reference.negative?predicted.length===0&&observation.noSignal:null,
      latencyMs:observation.latencyMs},pairs,nearestErrors } as const;
  } catch(error) { return unmeasured(error instanceof Error?error.message:'MALFORMED_MEASUREMENT'); }
}
/** Missing/error cases never become false negatives or disappear from the required denominator. */
export function summarizeMonacoMeasurements(results: readonly ReturnType<typeof scoreMonacoObservation>[]) {
  const measured=results.filter((r):r is Extract<typeof r,{status:'MEASURED'}>=>r.status==='MEASURED');
  const totals=measured.reduce((a,r)=>({tp:a.tp+r.metrics.tp,fp:a.fp+r.metrics.fp,fn:a.fn+r.metrics.fn}),{tp:0,fp:0,fn:0});
  const uniqueCases=new Set(results.map(r=>r.caseId)), requests=new Set(measured.map(r=>r.requestId));
  const scenarios=new Set(measured.map(r=>MONACO_REQUIRED_SCENARIOS.find(s=>s.scenario===r.scenario&&(s.timeframe===null||s.timeframe===r.timeframe))?.key));
  const duplicate=uniqueCases.size!==results.length||requests.size!==measured.length;
  return {required:6,measured:measured.length,genuineMeasured:measured.filter(r=>r.provenance==='GENUINE_PROVIDER').length,unmeasured:results.length-measured.length,missing:Math.max(0,6-results.length),
    status:duplicate?'DUPLICATE_EVIDENCE':results.length===6&&measured.length===6&&scenarios.size===6&&!scenarios.has(undefined)?(measured.every(r=>r.provenance==='GENUINE_PROVIDER')?'SIX_MEASUREMENTS_RECORDED':'SIX_OFFLINE_FIXTURES_SCORED'):'INCOMPLETE',productionReady:false,
    ...totals,precision:totals.tp+totals.fp?totals.tp/(totals.tp+totals.fp):null,recall:totals.tp+totals.fn?totals.tp/(totals.tp+totals.fn):null};
}
