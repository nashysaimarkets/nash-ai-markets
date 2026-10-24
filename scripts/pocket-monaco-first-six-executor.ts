/** Strict source adapter for the unmounted first-six runner. Original scanner,
 * protocol, oracle, request and offline integration files remain unchanged.
 * This is not an admission gate or a live entry point: the explicit protected
 * bootstrap must first establish the existing evidence/credential bindings.
 */
import {readFileSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {join,isAbsolute} from 'node:path';
import {createSequentialFirstSixExecutor} from './pocket-monaco-isolated-executor.mjs';
import {createIsolatedLedgerBridge, loadFrozenRunnerPlan, type RpcPort, type RunnerIdentity} from './pocket-monaco-runner-bridge.ts';
import {MODEL, SOURCE_PINS, SLOTS, sha256, verifyMaterial, needsRescue, loadPreparedCase, type Artifact, type CaseMaterial} from './pocket-monaco-offline-executor.ts';
import {FIRST_SIX} from './pocket-monaco-diagnostic-provider.ts';
import {INTERNAL_DIAGNOSTIC_PROTOCOL, scoreInternalDiagnostics} from './pocket-monaco-internal-diagnostics.ts';
import {recoverPrecisionGeometry} from '../app/api/pocket/precision-fallback.ts';
import {calibratePocketAnalysis} from '../app/api/pocket/analysis-calibration.ts';

type Json = Record<string, any>;
type Receipt = {status:string; output_text:string};
type Prepared = {caseId:string; material:CaseMaterial; requests:CaseMaterial['requests']; input:Json;
  objectiveReference:Artifact; protocol:Artifact; sourceIdentity:Json};
export type FirstSixPreparedInput = {materials:CaseMaterial[]; packetManifest:Artifact; objectiveReference:Artifact; protocol:Artifact};
const requireValue = (ok:unknown):void => {if (!ok) throw Error('FROZEN_FIRST_SIX_MATERIAL_REFUSED');};
const parse = (artifact:Artifact) => JSON.parse(Buffer.from(artifact.bytes).toString('utf8'));
const parseRecord = (text:string):Json => {const value=JSON.parse(text); requireValue(value && typeof value==='object' && !Array.isArray(value)); return value;};
const root = new URL('../', import.meta.url);

/** All inputs are supplied by the caller; this never discovers or loads a packet. */
export function prepareFrozenFirstSix(input:FirstSixPreparedInput):Prepared[] {
  const plan = loadFrozenRunnerPlan() as ReturnType<typeof loadFrozenRunnerPlan> & Json;
  requireValue(isDeepStrictEqual(input.materials.map(m=>m.caseId), FIRST_SIX));
  requireValue(input.packetManifest.sha256===plan.manifestSha256 && sha256(input.packetManifest.bytes)===plan.manifestSha256);
  const manifest=parse(input.packetManifest);
  requireValue(plan.model===MODEL && plan.scannerSourcesSha256===sha256(JSON.stringify(SOURCE_PINS)));
  for (const [path, expected] of Object.entries(plan.integrationSourceHashes)) {
    requireValue(sha256(readFileSync(new URL(path, root)))===expected);
  }
  requireValue(input.objectiveReference.sha256===plan.objectiveReferenceSha256
    && sha256(input.objectiveReference.bytes)===plan.objectiveReferenceSha256
    && input.protocol.sha256===plan.protocolSha256 && sha256(input.protocol.bytes)===plan.protocolSha256);
  requireValue(isDeepStrictEqual(parse(input.protocol), INTERNAL_DIAGNOSTIC_PROTOCOL));
  const oracle = parse(input.objectiveReference);
  requireValue(oracle.schemaVersion===1 && oracle.kind==='MONACO_INTERNAL_SOURCE_REFERENCE'
    && oracle.packetManifestSha256===plan.manifestSha256 && isDeepStrictEqual(oracle.caseIds,FIRST_SIX)
    && isDeepStrictEqual(oracle.cases.map((c:Json)=>c.caseId),FIRST_SIX));
  return input.materials.map(material=>{
    requireValue(material.scope==='A' && material.manifestSha256===plan.manifestSha256);
    const source = oracle.cases.find((c:Json)=>c.caseId===material.caseId);
    const manifestCase=manifest.cases.find((c:Json)=>c.caseId===material.caseId);
    requireValue(manifestCase && material.artifacts.licence.sha256===manifestCase.licenceSha256);
    requireValue(source?.objective?.aggregation?.exactOhlcvMatch===true);
    for (const [artifact, field] of Object.entries({input:'inputSha256', image:'imageSha256', bars:'barsSha256',
      sourceZip:'sourceZipSha256', calibration:'calibrationSha256'})) {
      requireValue(material.artifacts[artifact as keyof CaseMaterial['artifacts']].sha256===source.identities[field]);
    }
    for (const slot of SLOTS) {
      const pinned = plan.calls.find((c:Json)=>c.caseId===material.caseId && c.slot===slot) as Json;
      const request = material.requests[slot];
      requireValue(pinned && pinned.inputSha256===material.artifacts.input.sha256
        && pinned.imageSha256===material.artifacts.image.sha256 && request.sha256===pinned.requestSha256
        && request.fingerprint===pinned.fingerprint);
    }
    const verified = verifyMaterial(material); // Original exact-byte/envelope/source checks.
    return {caseId:material.caseId, material, requests:material.requests, input:verified.input,
      objectiveReference:input.objectiveReference, protocol:input.protocol, sourceIdentity:source.identities};
  });
}

/** Explicit future mount helper; never called by module import or local tests.
 * The original loader enforces every manifest path/hash and path containment.
 */
export function loadFrozenFirstSixInputs(paths:{packetDirectory:string; objectiveReferencePath:string; protocolPath:string}):FirstSixPreparedInput {
  const artifact=(path:string|URL):Artifact=>{const bytes=readFileSync(path);return {bytes,sha256:sha256(bytes)};};
  requireValue([paths.packetDirectory,paths.objectiveReferencePath,paths.protocolPath].every(isAbsolute));
  const packetManifest=artifact(join(paths.packetDirectory,'BENCHMARK50.json'));
  return {materials:FIRST_SIX.map(id=>loadPreparedCase(paths.packetDirectory,id)),packetManifest,
    objectiveReference:artifact(paths.objectiveReferencePath),protocol:artifact(paths.protocolPath)};
}

/** Same composition as the pinned offline executor's private calibrated helper.
 * It calls the original pure scanner functions; no thresholds/rules are changed.
 */
function calibrate(raw:Partial<Record<typeof SLOTS[number],Receipt>>, input:Json) {
  requireValue(Object.values(raw).every(r=>r?.status==='completed'));
  const main=parseRecord(raw.main!.output_text); let precision:Json|null=null;
  try {precision=parseRecord(raw.primary_precision!.output_text);} catch { /* Existing fail-closed fallback. */ }
  if (raw.rescue_precision) {
    try {const rescue=parseRecord(raw.rescue_precision.output_text); precision=recoverPrecisionGeometry(precision??{},rescue)??rescue;}
    catch { /* Preserve the first precision output. */ }
  }
  precision=recoverPrecisionGeometry(main,precision);
  const merged:Json=precision ? {...main,plotBounds:precision.plotBounds,priceScaleAnchors:precision.priceScaleAnchors,
    levels:precision.levels,currentPrice:precision.currentPrice,contextBattlefield:null} : {...main,priceScaleAnchors:[],levels:[]};
  if (input.chartConfirmation) {const facts=input.chartConfirmation;
    Object.assign(merged,{instrument:facts.instrument,timeframe:facts.timeframe,currentPrice:facts.currentPrice});}
  return calibratePocketAnalysis(merged);
}

export function finishFrozenFirstSixCase(c:Prepared, raw:Partial<Record<typeof SLOTS[number],Receipt>>, latencyMs:number) {
  const rawBytes=Buffer.from(raw.main!.output_text);
  const processedBytes=Buffer.from(JSON.stringify(calibrate(raw,c.input)));
  const common={caseId:c.caseId,status:'COMPLETED' as const,inputSha256:c.material.artifacts.input.sha256,
    imageSha256:c.material.artifacts.image.sha256,oracleBytes:c.objectiveReference.bytes,
    oracleSha256:c.objectiveReference.sha256,protocolBytes:c.protocol.bytes,protocolSha256:c.protocol.sha256,
    latencyMs,evidenceKind:'RETAINED_SCANNER_OUTPUT' as const};
  return {kind:'FIRST_SIX_INTERNAL_DIAGNOSTICS',humanReviewed:false,expertAccepted:false,tradingInterpretation:'UNSCORED',
    rawMain:scoreInternalDiagnostics({...common,rawResponseBytes:rawBytes,rawResponseSha256:sha256(rawBytes)}),
    postprocessed:scoreInternalDiagnostics({...common,rawResponseBytes:processedBytes,rawResponseSha256:sha256(processedBytes)}),
    postprocessingCaveat:'Existing calibration may filter claims and copy supplied chart identity/currentPrice. Raw main is retained separately; supplied values are not independent model measurements.',
    sourceIdentity:c.sourceIdentity};
}

export function createFrozenFirstSixExecutor(args:{port:RpcPort; ledgerKey:string; identity:RunnerIdentity;
  transport:{send:Function}; privateArtifacts:{write:Function}}) {
  return createSequentialFirstSixExecutor({ledger:createIsolatedLedgerBridge(args.port,args.ledgerKey,args.identity),
    transport:args.transport,privateArtifacts:args.privateArtifacts,prepare:prepareFrozenFirstSix,
    needsRescue,finishCase:finishFrozenFirstSixCase});
}
