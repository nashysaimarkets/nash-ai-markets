/** Unmounted isolated SQL bridge. No SDK/client, environment secret lookup,
 * network transport, live route, metadata request or provider dispatch. */
import { readFileSync } from 'node:fs';
import { COSTS, MODEL, SLOTS, sha256 } from './pocket-monaco-offline-executor.ts';
import { FIRST_SIX, dispatchRealInternalDiagnostics } from './pocket-monaco-diagnostic-provider.ts';

export const RUNNER_ENVIRONMENT='monaco-first-six-inference';
export const CANONICAL_ALLOWANCE='comment-6165012632';
export const PAID_SCOPE='issue126-6309459418';
export const FROZEN_PLAN_SHA256='9490af55e554f84d63d7afc1fe2442298afd6cdbe8f356d6d8d0517504420ff0';
const root=new URL('../',import.meta.url);
const check=(ok:unknown,message:string):void=>{if(!ok)throw Error(message);};
type Slot=typeof SLOTS[number];
type PlanCall={caseId:string;slot:Slot;fingerprint:string;requestSha256:string;maxCostMicroUsd:number};
export function loadFrozenRunnerPlan(){
 const bytes=readFileSync(new URL('docs/monaco-126/internal-diagnostics/FIRST-SIX-PROVIDER-PLAN.json',root));
 check(sha256(bytes)===FROZEN_PLAN_SHA256,'Frozen first-six plan changed');
 const plan=JSON.parse(bytes.toString());
 check(plan.calls.length===18&&JSON.stringify(plan.caseIds)===JSON.stringify(FIRST_SIX),'Exact first-six inventory required');
 check(plan.model===MODEL&&plan.maximumSends===18&&plan.retries===0,'Approved request scope changed');
 for(const id of FIRST_SIX)for(const slot of SLOTS){
  const calls=plan.calls.filter((x:PlanCall)=>x.caseId===id&&x.slot===slot);
  check(calls.length===1&&calls[0].maxCostMicroUsd===COSTS[slot]&&/^[a-f0-9]{64}$/.test(calls[0].fingerprint),'Frozen request pin missing');
 }
 return plan as {calls:PlanCall[];scannerCandidateSha:string;model:string;caseIds:string[]};
}
export type RunnerIdentity={environment:string;sourceSha:string;backendRef:string;projectRef:string;
 keyTrackingId:string;keyFingerprintSha256:string;planSha256:string};
export type RpcPort={rpc:(name:string,args:Record<string,unknown>)=>Promise<{data:unknown;error:unknown}>};

/** RPC effects are explicitly injected for offline tests or a later reviewed
 * protected runner. This module never constructs a database/provider client.
 * Each method calls once: a lost acknowledgement propagates, never retries. */
export function createIsolatedLedgerBridge(port:RpcPort,ledgerKey:string,identity:RunnerIdentity){
 const plan=loadFrozenRunnerPlan();
 check(JSON.stringify(Object.keys(identity).sort())===JSON.stringify(['environment','sourceSha','backendRef','projectRef','keyTrackingId','keyFingerprintSha256','planSha256'].sort()),'Only non-secret runner identity fields allowed');
 check(identity.environment===RUNNER_ENVIRONMENT&&identity.planSha256===FROZEN_PLAN_SHA256,'Runner/plan binding required');
 check((/^[a-z]{20}$/.test(identity.backendRef)||/^neon:[a-z0-9-]{3,100}\/br-[a-z0-9-]{3,100}\/[a-z_][a-z0-9_]{0,62}$/.test(identity.backendRef))&&!['pxlqvaddvghjjhenqmdh','opmgzchnmcgnsfwpmysc'].includes(identity.backendRef),'Shared-live backend prohibited');
 check(identity.projectRef==='proj_LTmAIE2Ve7gUAFJ9M74ZxIBI'&&identity.keyTrackingId==='key_EjND5GXtuqF2K0hp','Existing inference-key binding required');
 check(/^[a-f0-9]{40}$/.test(identity.sourceSha)&&/^[a-f0-9]{64}$/.test(identity.keyFingerprintSha256),'Exact runner identity required');
 const bound=structuredClone(identity);
 async function rpc(name:string,args:Record<string,unknown>){
  try{const result=await port.rpc(name,args);if(result.error)throw Error();return result.data as Record<string,unknown>;}
  catch{throw Error('Ledger operation failed; retain reservation and reconcile acknowledgement');}
 }
 const pin=(caseId:string,slot:Slot)=>{const c=plan.calls.find(x=>x.caseId===caseId&&x.slot===slot);check(c,'Held-out or unknown request');return c!;};
 const inspect=async()=>{
  const s=await rpc('inspect_monaco_isolated_runner',{p_key:ledgerKey,p_identity:bound});
  check(s?.binding_matches===true&&s?.ledger_key===ledgerKey,'Unverified ledger identity');
  const amounts=[s.prior_exposure_microusd,s.new_commitments_microusd,s.remaining_microusd];
  check(amounts.every(n=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0)
   &&(amounts as number[]).reduce((a,b)=>a+b,0)===5000000,'Authoritative aggregate balance missing');
  return s;
 };
 return {
  inspect,
  async claim(caseId:string){
   for(const slot of SLOTS)pin(caseId,slot);
   await inspect();
   const callPlan=SLOTS.map(slot=>({slot,model:MODEL,serviceTier:'default',maxOutputTokens:slot==='main'?7000:1400,
    maxInputTextChars:30000,maxSchemaBytes:30000,maxImages:2,maxImageBytes:8000000,maxImageWidth:4096,maxImageHeight:4096,maxImagePixels:33554432,
    maxCostMicroUsd:COSTS[slot],costBoundEvidenceRef:'PR137-pinned-full-context-bounds'}));
   const claim=await rpc('claim_pocket_benchmark_case',{p_ledger_key:ledgerKey,p_case_id:caseId,p_project_ref:bound.projectRef,
    p_owner_approval_ref:CANONICAL_ALLOWANCE,p_candidate_sha:plan.scannerCandidateSha,p_plan:callPlan});
   // The legacy claim's remaining field excludes carry-in. Never expose it as
   // authoritative: read the extension's combined committed+prior accounting.
   return {claim:{allowed:claim.allowed,status:claim.status,idempotent:claim.idempotent,reason:claim.reason},
    budget:await inspect(),providerDispatchEnabled:false};
  },
  async submit(caseId:string,slot:Slot,fingerprint:string){const p=pin(caseId,slot);check(p.fingerprint===fingerprint,'Frozen request fingerprint mismatch');await inspect();
   return rpc('submit_pocket_benchmark_call',{p_ledger_key:ledgerKey,p_case_id:caseId,p_slot:slot,p_envelope_sha256:fingerprint});},
  async recordReceipt(caseId:string,slot:Slot,receipt:{requestId:string;responseId:string;model:string;serviceTier:string;usage:{input_tokens:number;output_tokens:number;total_tokens:number}}){
   const u=receipt.usage;const usage={input_tokens:u?.input_tokens,output_tokens:u?.output_tokens,total_tokens:u?.total_tokens};
   check(Object.values(usage).every(n=>Number.isSafeInteger(n)&&n>=0)&&usage.input_tokens+usage.output_tokens===usage.total_tokens,'Valid non-secret usage counts required');
   const p=pin(caseId,slot);return rpc('record_pocket_benchmark_receipt',{p_ledger_key:ledgerKey,p_case_id:caseId,p_slot:slot,
    p_provider_request_id:receipt.requestId,p_response_id:receipt.responseId,p_model:receipt.model,p_service_tier:receipt.serviceTier,
    p_usage:usage,p_envelope_sha256:p.fingerprint});},
  async voidUnused(caseId:string,slot:Slot){pin(caseId,slot);return rpc('void_pocket_benchmark_call',{p_ledger_key:ledgerKey,p_case_id:caseId,p_slot:slot,p_reason:'Not dispatched; existing rescue/cancellation predicate'});},
  async account(caseId:string){pin(caseId,'main');return rpc('account_pocket_benchmark_reserved_case',{p_ledger_key:ledgerKey,p_case_id:caseId});},
  dispatch:dispatchRealInternalDiagnostics,
 };
}
