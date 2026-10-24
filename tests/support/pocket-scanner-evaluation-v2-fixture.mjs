/** Explicit synthetic effects only; the numeric approval URL is NOT an actual approval. */
import {V2,SLOTS,extractEvaluationRequests,sourceCaseId,attemptId,sha256} from '../../scripts/pocket-scanner-evaluation-v2-source.mjs';
export const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
export const input={image,intention:'UNSURE',chartConfirmation:{instrument:'SYNTHETIC_ONLY',timeframe:'1h',currentPrice:'100',contextMatch:'NOT_PROVIDED'}};
export function identity(caseId='v2-d001'){
  return {environment:V2.environment,sourceSha:'a'.repeat(40),backendRef:V2.backendRef,projectRef:V2.project,
    keyTrackingId:V2.keyTrackingId,keyFingerprintSha256:V2.keyFingerprintSha256,planSha256:'b'.repeat(64),
    evaluation:{scopeId:V2.scopeId,attemptId:attemptId(caseId),caseId,sourceCaseId:sourceCaseId(caseId),appSourceSha:V2.appSourceSha,
      evidenceSha:'c'.repeat(40),wrapperSha:'d'.repeat(40),runId:'900000001',jobId:'900000002',runAttempt:'1',
      approvalRef:'https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-999999999999'}};
}
export function material(caseId='v2-d001'){
  return {caseId,sourceCaseId:sourceCaseId(caseId),attemptId:attemptId(caseId),planSha256:identity(caseId).planSha256,
    requests:extractEvaluationRequests(input,caseId)};
}
export function admission(bound=identity()){return {approvalRef:bound.evaluation.approvalRef,approvalBodySha256:'d'.repeat(64),
  admissionEvidenceSha256:'e'.repeat(64),reassessmentEvidenceSha256:'f'.repeat(64),previousCaseReceiptSha256:bound.evaluation.caseId==='v2-d001'?null:'a'.repeat(64)};}
export function inspection(bound){return {allowed:true,reason:null,scopeId:V2.scopeId,caseId:bound.evaluation.caseId,
  attemptId:bound.evaluation.attemptId,caseStatus:null,originalCommitmentsMicroUsd:1506400,evaluationCommitmentsMicroUsd:0,
  aggregateCommittedMicroUsd:1506400,remainingMicroUsd:3493600,financiallySettled:false,actualMicroUsd:null,slots:[],admission:admission(bound)};}
export function response(slot,patch={}){return {_request_id:`synthetic-req-${slot}`,id:`synthetic-res-${slot}`,model:V2.model,
  service_tier:'default',status:'completed',output_text:JSON.stringify({currentPrice:'100',levels:[{price:'90'},{price:'110'}]}),
  usage:{input_tokens:100,output_tokens:100,total_tokens:200},...patch};}
export function harness(options={}){
  const bound=identity(),c=material(),events=[],slots=Object.fromEntries(SLOTS.map(s=>[s,'reserved']));
  const journal=options.journal??{claimed:false,stop:false,finished:false};let artifacts=0;
  async function event(name,data){events.push({name,data});if(options.after)await options.after(name,data);if(options.fail===name)throw Error('Synthetic acknowledgement lost');}
  const ledger={
    async inspect(){await event('inspect');if(options.inspection)return options.inspection;return inspection(bound);},
    async claim(){const existed=journal.claimed;journal.claimed=true;await event('claim');return {allowed:!existed,status:'reserved',idempotent:false};},
    async submit(slot,r){slots[slot]='submitted';await event(`submit:${slot}`,r);return {ok:true,status:'submitted',claimed:true};},
    async receipt(slot,r){slots[slot]='receipted';await event(`receipt:${slot}`,r);return {ok:true,status:'receipted'};},
    async finish(data){journal.finished=true;await event('finish',data);slots.rescue_precision=slots.rescue_precision==='reserved'?'voided':slots.rescue_precision;
      return {ok:true,status:'completed',accountingStatus:'FULL_RESERVATION_HELD',financiallySettled:false};},
    async stop(reason){journal.stop=true;await event('stop',reason);return {ok:true,status:'stopped'};},
  };
  const transport={async send(r){await event(`send:${r.slot}`,r);return response(r.slot,options.responses?.[r.slot]);}};
  const privateArtifacts={async write(r){await event(`retain:${r.kind}:${r.slot}`,r);return {retained:true,sha256:sha256(r.bytes),artifact:{id:++artifacts}};}};
  return {identity:bound,expectedAdmission:admission(bound),c,ledger,transport,privateArtifacts,prepareCase:x=>x,
    needsRescue:text=>{const p=JSON.parse(text);return p.levels.length===0;},finishCase:()=>({kind:'SYNTHETIC_DIAGNOSTIC_ONLY',expertAccepted:false}),events,slots,journal};
}
