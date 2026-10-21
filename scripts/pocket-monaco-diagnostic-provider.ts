/** First-six request/receipt integration. Unmounted; inert mocks only.
 * The real boundary always throws, including when environment flags or declarations
 * claim approval. No credential lookup, SDK client, live route, RPC or network call.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  OFFLINE_ONLY, INTERNAL_DIAGNOSTICS_MODE, MODEL, SOURCE_PINS, PACKET_PINS,
  SLOTS, COSTS, sha256, materialDigest, diagnosticFreezeSha256,
  loadPreparedCase, assertDiagnosticAdmission, runOfflineDiagnosticCase, snapshot,
  type Artifact, type CaseMaterial, type Binding, type DiagnosticAdmission,
} from './pocket-monaco-offline-executor.ts';
import { scoreInternalDiagnostics } from './pocket-monaco-internal-diagnostics.ts';

export const FIRST_SIX = Object.freeze(['d001','d002','d003','d004','d005','d006']);
export const REAL_DIAGNOSTIC_DISPATCH_ENABLED = false;
export const SCOPE_A_MAXIMUM_MICRO_USD = 1917600;
export const SCOPE_A_AGGREGATE_CAP_MICRO_USD = 5000000;
export const INDEPENDENT_SOURCE_REFERENCE_SHA256 = '06fd2b201ecefbda4c7746a24ea5c5470e8679fdee2740dcac81cd3c5f8dd424';
const root = new URL('../', import.meta.url);
const codeFiles = ['scripts/pocket-monaco-offline-executor.ts', 'scripts/pocket-monaco-diagnostic-provider.ts',
  'scripts/pocket-monaco-internal-diagnostics.ts', 'scripts/monaco-diagnostic-source-reference.py'];
type Plan = {
  kind:'FIRST_SIX_INTERNAL_DIAGNOSTIC_PLAN'; admission:DiagnosticAdmission;
  materials:CaseMaterial[]; integrationSourceHashes:Record<string,string>; planFreezeSha256:string;
};
const check=(ok:unknown,message:string)=>{if(!ok)throw Error(message);};
const parse=(a:Artifact)=>JSON.parse(Buffer.from(a.bytes).toString('utf8'));
function planFreeze(plan:Pick<Plan,'kind'|'admission'|'integrationSourceHashes'>){
  return sha256(JSON.stringify({kind:plan.kind,admissionFreezeSha256:plan.admission.binding.freezeSha256,integrationSourceHashes:plan.integrationSourceHashes}));
}

/** Reads only the frozen first-six inputs; never edits or regenerates the packet.
 * The numeric prior exposure is explicitly a disposable engineering simulation.
 * It does NOT assert that any real dollar headroom exists.
 */
export function prepareInternalDiagnosticPlan(packetDirectory:string, objectiveReference:Artifact,
  protocol:Artifact, simulatedPriorExposureMicroUsd:number):Plan {
  check(objectiveReference.sha256===INDEPENDENT_SOURCE_REFERENCE_SHA256 && sha256(objectiveReference.bytes)===INDEPENDENT_SOURCE_REFERENCE_SHA256,'Exact independently calculated source oracle required');
  const materials=FIRST_SIX.map(id=>loadPreparedCase(packetDirectory,id));
  const binding:Binding={mode:OFFLINE_ONLY,scope:'A',caseIds:[...FIRST_SIX],manifestSha256:PACKET_PINS.manifest,
    candidateSha:'f5e820b0bd7bf095153e31d692a10fb3640ba16e',scannerSourcesSha256:sha256(JSON.stringify(SOURCE_PINS)),
    requestInventorySha256:PACKET_PINS.requests,referenceSha256:objectiveReference.sha256,protocolSha256:protocol.sha256,
    freezeSha256:null,model:MODEL,ledgerKey:'offline-A',capMicroUsd:SCOPE_A_AGGREGATE_CAP_MICRO_USD,
    priorExposureMicroUsd:simulatedPriorExposureMicroUsd,caseDigests:Object.fromEntries(materials.map(m=>[m.caseId,materialDigest(m)]))};
  binding.freezeSha256=diagnosticFreezeSha256(binding);
  const admission:DiagnosticAdmission={kind:INTERNAL_DIAGNOSTICS_MODE,binding,ownerAmendmentRef:'issue126-6309011401',
    budgetEvidenceKind:'DISPOSABLE_SIMULATION_NOT_OWNER_BALANCE',objectiveReference,protocol};
  for(const m of materials)assertDiagnosticAdmission(admission,m);
  const plan:Plan={kind:'FIRST_SIX_INTERNAL_DIAGNOSTIC_PLAN',admission,materials,planFreezeSha256:'',
    integrationSourceHashes:Object.fromEntries(codeFiles.map(path=>[path,sha256(readFileSync(new URL(path,root)))]))};
  plan.planFreezeSha256=planFreeze(plan);return plan;
}

/** Safe public inventory: hashes/bounds only. Restricted images and oracle stay private. */
export function diagnosticPlanInventory(plan:Plan){
  check(plan.kind==='FIRST_SIX_INTERNAL_DIAGNOSTIC_PLAN','Explicit diagnostic plan required');
  check(plan.admission.objectiveReference.sha256===INDEPENDENT_SOURCE_REFERENCE_SHA256,'Exact independently calculated source oracle required');
  check(plan.planFreezeSha256===planFreeze(plan),'Integration plan freeze mismatch');
  check(Object.keys(plan.integrationSourceHashes).length===codeFiles.length,'Complete integration source freeze required');
  for(const path of codeFiles)check(sha256(readFileSync(fileURLToPath(new URL(path,root))))===plan.integrationSourceHashes[path],'Integration source drift');
  check(JSON.stringify(plan.materials.map(m=>m.caseId))===JSON.stringify(FIRST_SIX),'Exact first-six plan required');
  for(const m of plan.materials)assertDiagnosticAdmission(plan.admission,m);
  return {schemaVersion:1,kind:plan.kind,protocolId:'MONACO_INTERNAL_DIAGNOSTICS_V1',
    ownerAmendmentRef:plan.admission.ownerAmendmentRef,manifestSha256:PACKET_PINS.manifest,requestInventorySha256:PACKET_PINS.requests,
    scannerCandidateSha:plan.admission.binding.candidateSha,scannerSourcesSha256:plan.admission.binding.scannerSourcesSha256,
    objectiveReferenceSha256:plan.admission.objectiveReference.sha256,protocolSha256:plan.admission.protocol.sha256,
    integrationSourceHashes:plan.integrationSourceHashes,offlineSimulationFreezeSha256:plan.admission.binding.freezeSha256,planFreezeSha256:plan.planFreezeSha256,
    realExecutionFreeze:null,model:MODEL,scope:'A',caseIds:[...FIRST_SIX],maximumSends:18,minimumCompletedPathSends:12,
    oneChartAtATime:true,retries:0,rescue:'ONLY_WHEN_EXISTING_NEEDS_RESCUE_PREDICATE_REQUIRES',
    maximumDirectTokenCostMicroUsd:SCOPE_A_MAXIMUM_MICRO_USD,aggregateCapMicroUsd:SCOPE_A_AGGREGATE_CAP_MICRO_USD,
    verifiedRealHeadroomMicroUsd:null,paidApproval:null,realDispatchEnabled:false,heldoutScope:'UNTOUCHED_NOT_ADMITTED',
    humanReferenceRequirement:'NOT_REQUIRED_FOR_THIS_INTERNAL_TRACK',expertAcceptance:'UNRESOLVED',
    calls:plan.materials.flatMap(m=>SLOTS.map(slot=>({caseId:m.caseId,slot,scope:'A',inputSha256:m.artifacts.input.sha256,
      imageSha256:m.artifacts.image.sha256,requestSha256:m.requests[slot].sha256,fingerprint:m.requests[slot].fingerprint,
      maxCostMicroUsd:COSTS[slot],conditional:slot==='rescue_precision'})))};
}

type OfflineArgs=Omit<Parameters<typeof runOfflineDiagnosticCase>[0],'material'|'admission'>;
/** Mock responses traverse the same durable state machine, precision predicate and
 * scanner calibration as the existing adapter. Reports never count a mock as provider evidence.
 */
export async function runInternalDiagnosticMockCase(plan:Plan,caseId:string,args:OfflineArgs){
  const p=structuredClone(plan);diagnosticPlanInventory(p);
  const material=p.materials.find(m=>m.caseId===caseId);check(material,'Held-out/unknown case prohibited');
  const {store,transport,signal}=args;
  const execution=await runOfflineDiagnosticCase({material:material!,admission:p.admission,store,transport,signal});
  const state=snapshot(store).cases[caseId];
  const complete=execution.status==='MOCK_COMPLETE';
  const raw=state?.raw.main?.output_text;
  const rawBytes=raw===undefined?new Uint8Array():Buffer.from(raw);
  const common={caseId,inputSha256:material!.artifacts.input.sha256,imageSha256:material!.artifacts.image.sha256,
    oracleBytes:p.admission.objectiveReference.bytes,oracleSha256:p.admission.objectiveReference.sha256,
    protocolBytes:p.admission.protocol.bytes,protocolSha256:p.admission.protocol.sha256,
    latencyMs:state?.latencyMs??null,evidenceKind:'SYNTHETIC_FIXTURE' as const};
  const status=complete?'COMPLETED':execution.status.includes('CANCEL')?'CANCELLED':'TRANSPORT_ERROR';
  const rawMain=scoreInternalDiagnostics({...common,status,rawResponseBytes:rawBytes,rawResponseSha256:sha256(rawBytes)});
  const processedBytes=Buffer.from(JSON.stringify(state?.analysis??null));
  const postprocessed=scoreInternalDiagnostics({...common,status,rawResponseBytes:processedBytes,rawResponseSha256:sha256(processedBytes)});
  return {kind:'SYNTHETIC_DIAGNOSTIC_INTEGRATION_ONLY',caseId,execution,actualProviderCalls:0,humanReviewed:false,
    expertAccepted:false,tradingInterpretation:'UNSCORED',rawMain,postprocessed,
    postprocessingCaveat:'Existing scanner calibration may filter claims and copy provided chart identity/currentPrice. Raw main is retained separately; provided values are not independent model measurements.',
    retainedRawSlots:state?.raw??{},rawSlotSha256:Object.fromEntries(Object.entries(state?.raw??{}).map(([slot,r])=>[slot,sha256(JSON.stringify(r))])),
    sourceIdentity:parse(p.admission.objectiveReference).cases.find((c:{caseId:string})=>c.caseId===caseId).identities};
}

export type ExecutionEvidence={
  paidApprovalRef:string|null; exactPlanApproved:boolean;
  executor:{identity:string|null;isolationVerified:boolean;existingCredentialBound:boolean;inferenceCapable:boolean;
    metadataOnlyCredential:boolean;project:string|null;securityApprovalRef:string|null};
  processor:{onBehalfAccepted:boolean;retentionAccepted:boolean;trainingAccepted:boolean;territoryAccepted:boolean;privateArtifactsAccepted:boolean};
  budget:{authoritativeLedgerVerified:boolean;ledgerIdentity:string|null;aggregateCapMicroUsd:number|null;
    spentReservedUnresolvedMicroUsd:number|null;historicalAccountingKeptSeparate:boolean;cashAllowanceApproved:boolean};
};
/** Evaluates declared evidence requirements, not proof authenticity or execution authority.
 * A declaration cannot activate this module. Unverified/null headroom is never zero.
 */
export function diagnosticExecutionReadiness(e:ExecutionEvidence){
  const blockers:string[]=[];
  if(!e.paidApprovalRef||!e.exactPlanApproved)blockers.push('EXACT_FIRST_SIX_PAID_APPROVAL_MISSING');
  const x=e.executor;
  if(!x.identity||!x.isolationVerified||!x.existingCredentialBound||!x.inferenceCapable||x.metadataOnlyCredential||
    x.project!=='proj_LTmAIE2Ve7gUAFJ9M74ZxIBI')blockers.push('EXISTING_ISOLATED_INFERENCE_EXECUTOR_NOT_BOUND');
  if(!x.securityApprovalRef||!(['onBehalfAccepted','retentionAccepted','trainingAccepted','territoryAccepted','privateArtifactsAccepted'] as const).every(k=>e.processor?.[k]===true))blockers.push('ACTUAL_PROCESSOR_SECURITY_CONDITIONS_UNACCEPTED');
  const b=e.budget;const known=b.authoritativeLedgerVerified&&!!b.ledgerIdentity&&b.aggregateCapMicroUsd===SCOPE_A_AGGREGATE_CAP_MICRO_USD&&
    Number.isSafeInteger(b.spentReservedUnresolvedMicroUsd)&&b.spentReservedUnresolvedMicroUsd!==null&&b.spentReservedUnresolvedMicroUsd>=0;
  const declaredHeadroom=known?SCOPE_A_AGGREGATE_CAP_MICRO_USD-b.spentReservedUnresolvedMicroUsd!:null;
  if(declaredHeadroom===null||declaredHeadroom<SCOPE_A_MAXIMUM_MICRO_USD)blockers.push('AUTHORITATIVE_AGGREGATE_HEADROOM_UNVERIFIED_OR_INSUFFICIENT');
  if(!b.historicalAccountingKeptSeparate||!b.cashAllowanceApproved)blockers.push('HISTORICAL_OR_CASH_ACCOUNTING_CONDITION_UNRESOLVED');
  return {kind:'DECLARED_GATE_ASSESSMENT_ONLY',blockers,declaredHeadroomMicroUsd:declaredHeadroom,
    actualHeadroomVerifiedByThisFunction:false,providerDispatchEnabled:false,scopeBApproved:false,expertAcceptance:'UNRESOLVED'};
}

export function dispatchRealInternalDiagnostics():never {
  throw Error('REAL_DIAGNOSTIC_DISPATCH_DISABLED: offline amendment only; no transport/client is mounted.');
}
