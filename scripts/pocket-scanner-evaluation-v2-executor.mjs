/** Exactly one new case per instance/invocation. No resume, retry, case loop,
 * credit reset or in-memory approval can replace the authoritative SQL permit. */
import {V2,SLOTS,sha256,need,digest,scopedFingerprint} from './pocket-scanner-evaluation-v2-source.mjs';
import {validateEvaluationIdentity,validateEvaluationInspection,validateAdmissionEvidence} from './pocket-scanner-evaluation-v2-bridge.mjs';
const amount=v=>Number.isSafeInteger(v)&&v>=0;
export const knownOutputLimit=r=>r?.status==='incomplete'&&r.incomplete_details?.reason==='max_output_tokens'
  &&Object.keys(r.incomplete_details).length===1&&(r.error===null||r.error===undefined);
const validResponse=(r,slot)=>typeof r?._request_id==='string'&&r._request_id.trim()&&typeof r.id==='string'&&r.id.trim()
  &&r.model===V2.model&&r.service_tier==='default'&&amount(r.usage?.input_tokens)&&amount(r.usage?.output_tokens)
  &&amount(r.usage?.total_tokens)&&r.usage.input_tokens+r.usage.output_tokens===r.usage.total_tokens
  &&r.usage.total_tokens<=400000&&r.usage.output_tokens<=(slot==='main'?7000:4000)&&typeof r.output_text==='string';

export function createEvaluationExecutor({identity,expectedAdmission,ledger,transport,privateArtifacts,prepareCase,needsRescue,finishCase}){
  const bound=validateEvaluationIdentity(identity),e=bound.evaluation,admission=validateAdmissionEvidence(expectedAdmission,bound);
  need(['inspect','claim','submit','receipt','finish','stop'].every(k=>typeof ledger?.[k]==='function')
    &&typeof transport?.send==='function'&&typeof privateArtifacts?.write==='function'
    &&[prepareCase,needsRescue,finishCase].every(fn=>typeof fn==='function'));
  let used=false;
  return Object.freeze({async run(input,{signal}={}){
    const summary={kind:'POCKET_SCANNER_EVALUATION_V2_EXECUTION',scopeId:e.scopeId,attemptId:e.attemptId,
      caseId:e.caseId,sourceCaseId:e.sourceCaseId,status:'HOLD',transportSendAttempts:0,rawSha256:{},
      financiallySettled:false,actualMicroUsd:null,diagnosticCasesRetained:0,
      providerAuthenticity:'NOT_ATTESTED_BY_EXECUTOR_LIBRARY',timing:{executionMs:null,providerCallMs:{},deployedHttpLatencyMs:null}};
    if(used)return {...summary,reason:'INSTANCE_ALREADY_USED'};used=true;
    let c;
    try{c=structuredClone(prepareCase(structuredClone(input)));need(c&&c.caseId===e.caseId&&c.sourceCaseId===e.sourceCaseId
      &&c.attemptId===e.attemptId&&c.planSha256===bound.planSha256&&Object.keys(c.requests).sort().join()===([...SLOTS].sort()).join());
      for(const slot of SLOTS){const r=c.requests[slot];need(r.bytes instanceof Uint8Array&&sha256(r.bytes)===r.requestSha256
        &&r.fingerprint===scopedFingerprint({caseId:c.caseId,sourceCaseId:c.sourceCaseId,slot,requestSha256:r.requestSha256}));}}
    catch{return {...summary,reason:'PREPARATION_REFUSED'};}
    if(signal?.aborted)return {...summary,status:'CANCELLED',reason:'CANCELLED_BEFORE_CLAIM'};
    try{validateEvaluationInspection(await ledger.inspect(),bound,admission);}catch{return {...summary,reason:'AUTHORITATIVE_ADMISSION_REFUSED'};}
    let claimed=false,stage='CLAIM',stopReason='RUNTIME_ERROR';
    const raw={},responseIds=new Set(),requestIds=new Set(),artifactIds=new Set(),started=performance.now();
    const checkCancel=()=>{if(signal?.aborted){stopReason='CANCELLED';throw Error('CANCELLED');}};
    const retain=async(kind,slot,bytes,request)=>{
      const sha=sha256(bytes),ack=await privateArtifacts.write({scopeId:e.scopeId,attemptId:e.attemptId,caseId:e.caseId,
        sourceCaseId:e.sourceCaseId,planSha256:bound.planSha256,kind,slot,bytes:Uint8Array.from(bytes),sha256:sha,
        ...(request?{requestId:request.requestId,requestSha256:request.requestSha256,fingerprint:request.fingerprint}:{})});
      need(ack?.retained===true&&ack.sha256===sha&&Number.isSafeInteger(ack.artifact?.id)&&ack.artifact.id>0&&!artifactIds.has(ack.artifact.id));
      artifactIds.add(ack.artifact.id);return {sha256:sha,artifactId:ack.artifact.id};
    };
    const send=async slot=>{
      checkCancel();const request=c.requests[slot];stage='SUBMIT';stopReason='SUBMIT_ACK_UNKNOWN';
      const a=await ledger.submit(slot,request);need(a?.ok===true&&a.status==='submitted'&&a.claimed===true);
      checkCancel();stage='TRANSPORT';stopReason='TRANSPORT_OUTCOME_UNKNOWN';summary.transportSendAttempts++;
      const callStarted=performance.now();
      const response=structuredClone(await transport.send({caseId:e.caseId,sourceCaseId:e.sourceCaseId,attemptId:e.attemptId,
        slot,requestBytes:Uint8Array.from(request.bytes),requestId:request.requestId,requestSha256:request.requestSha256,
        fingerprint:request.fingerprint,signal}));
      summary.timing.providerCallMs[slot]=performance.now()-callStarted;
      stage='PRIVATE_RECEIPT';const retained=await retain('provider-response',slot,Buffer.from(JSON.stringify(response)),request);
      summary.rawSha256[slot]=retained.sha256;stage='RECEIPT';stopReason='RECEIPT_ACK_UNKNOWN';
      need(validResponse(response,slot)&&!responseIds.has(response.id)&&!requestIds.has(response._request_id));
      const ack=await ledger.receipt(slot,{requestId:request.requestId,providerRequestId:response._request_id,responseId:response.id,
        model:response.model,serviceTier:response.service_tier,usage:{input_tokens:response.usage.input_tokens,
          output_tokens:response.usage.output_tokens,total_tokens:response.usage.total_tokens},responseSha256:retained.sha256});
      need(ack?.ok===true&&ack.status==='receipted');responseIds.add(response.id);requestIds.add(response._request_id);
      raw[slot]=response;checkCancel();stage='RESPONSE_STATUS';stopReason='RUNTIME_ERROR';
      need(response.status==='completed'||knownOutputLimit(response));return response;
    };
    try{
      checkCancel();const claim=await ledger.claim();
      if(claim?.allowed===false)return {...summary,reason:'CLAIM_REFUSED'};
      need(claim?.allowed===true&&claim.status==='reserved'&&claim.idempotent===false);claimed=true;
      await send('main');const precision=await send('primary_precision');
      if(precision.status==='completed'&&needsRescue(precision.output_text))await send('rescue_precision');
      checkCancel();stage='DIAGNOSTICS';stopReason='DIAGNOSTIC_RETENTION_FAILED';
      summary.timing.executionMs=performance.now()-started;
      const diagnostics=finishCase(structuredClone(c),structuredClone(raw),structuredClone(summary.timing));
      need(diagnostics&&typeof diagnostics==='object'&&typeof diagnostics.then!=='function');
      const retained=await retain('diagnostic-output',null,Buffer.from(JSON.stringify({diagnostics,rawSha256:summary.rawSha256,timing:summary.timing})));
      summary.diagnosticCasesRetained=1;summary.diagnosticSha256=retained.sha256;
      checkCancel();stage='ACCOUNTING';stopReason='ACCOUNTING_ACK_UNKNOWN';
      const ack=await ledger.finish({diagnosticSha256:retained.sha256,diagnosticArtifactId:String(retained.artifactId)});
      need(ack?.ok===true&&ack.status==='completed'&&ack.accountingStatus==='FULL_RESERVATION_HELD'&&ack.financiallySettled===false);
      return {...summary,status:'COMPLETED',caseReservationMicroUsd:330000};
    }catch{
      // A submitted slot remains submitted/held after every unknown outcome.
      // Stop is a different, conservative terminal transition, never a retry.
      if(claimed){try{await ledger.stop(stopReason);}catch{ /* Unknown cleanup acknowledgement remains held. */ }}
      return {...summary,status:signal?.aborted?'CANCELLED':'UNCERTAIN',stage,reason:'STOPPED_WITHOUT_REPLAY',
        caseReservationMicroUsd:claimed?330000:null};
    }
  }});
}
