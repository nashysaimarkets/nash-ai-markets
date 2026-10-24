/** New RPC namespace only. The old allowance is checked by SQL, never imported
 * or reset by this adapter. Unknown acknowledgements are never retried. */
import {validateNeonIdentity} from './pocket-monaco-neon-port.ts';
import {isDeepStrictEqual} from 'node:util';
import {V2,CASE_IDS,need,digest,commit,exactKeys,sourceCaseId,attemptId} from './pocket-scanner-evaluation-v2-source.mjs';
const operations=new Set(['inspect','begin_case','submit_slot','receipt_slot','finish_case','stop_case']);
export function validateEvaluationIdentity(identity){
  need(exactKeys(identity,['environment','sourceSha','backendRef','projectRef','keyTrackingId','keyFingerprintSha256','planSha256','evaluation']));
  const e=identity.evaluation;
  need(exactKeys(e,['scopeId','attemptId','caseId','sourceCaseId','appSourceSha','evidenceSha','wrapperSha','runId','jobId','runAttempt','approvalRef'])
    &&identity.environment===V2.environment&&identity.backendRef===V2.backendRef&&identity.projectRef===V2.project
    &&identity.keyTrackingId===V2.keyTrackingId&&identity.keyFingerprintSha256===V2.keyFingerprintSha256
    &&commit(identity.sourceSha)&&digest(identity.planSha256)&&e.scopeId===V2.scopeId&&CASE_IDS.includes(e.caseId)
    &&e.sourceCaseId===sourceCaseId(e.caseId)&&e.attemptId===attemptId(e.caseId)&&e.appSourceSha===V2.appSourceSha
    &&commit(e.evidenceSha)&&commit(e.wrapperSha)&&e.runAttempt==='1'
    &&[e.runId,e.jobId].every(v=>typeof v==='string'&&/^[1-9][0-9]{0,19}$/.test(v))
    &&typeof e.approvalRef==='string'&&/^https:\/\/github\.com\/nashysaimarkets\/nash-ai-markets\/issues\/126#issuecomment-[1-9][0-9]+$/.test(e.approvalRef)
    &&!['6165012632','6309459418','6383327587','6383999765'].some(id=>e.approvalRef.endsWith(id)));
  return structuredClone(identity);
}
export function validateAdmissionEvidence(expected,identity){
  need(exactKeys(expected,['approvalRef','approvalBodySha256','admissionEvidenceSha256','reassessmentEvidenceSha256','previousCaseReceiptSha256'])
    &&expected.approvalRef===identity.evaluation.approvalRef&&digest(expected.approvalBodySha256)
    &&digest(expected.admissionEvidenceSha256)&&digest(expected.reassessmentEvidenceSha256)
    &&(identity.evaluation.caseId==='v2-d001'?expected.previousCaseReceiptSha256===null:digest(expected.previousCaseReceiptSha256)),'V2_ADMISSION_EVIDENCE_REFUSED');
  return structuredClone(expected);
}
export function validateEvaluationInspection(value,identity,expectedAdmission){
  const expected=validateAdmissionEvidence(expectedAdmission,identity);
  const e=identity.evaluation;
  need(value?.allowed===true&&value.reason===null&&value.scopeId===e.scopeId&&value.caseId===e.caseId
    &&value.attemptId===e.attemptId&&value.caseStatus===null&&value.originalCommitmentsMicroUsd===1506400
    &&Number.isSafeInteger(value.evaluationCommitmentsMicroUsd)&&value.evaluationCommitmentsMicroUsd>=0
    &&value.evaluationCommitmentsMicroUsd<=1980000&&value.evaluationCommitmentsMicroUsd%330000===0
    &&value.aggregateCommittedMicroUsd===1506400+value.evaluationCommitmentsMicroUsd
    &&value.remainingMicroUsd===5000000-value.aggregateCommittedMicroUsd&&value.remainingMicroUsd>=330000
    &&value.financiallySettled===false&&value.actualMicroUsd===null&&isDeepStrictEqual(value.admission,expected),'V2_AUTHORITATIVE_ADMISSION_REFUSED');
  return value;
}
export function createEvaluationSqlPort(client,neon,identity){
  const bound=validateEvaluationIdentity(identity);need(validateNeonIdentity(neon)===V2.backendRef&&typeof client?.query==='function');
  const n=JSON.stringify(neon),i=JSON.stringify(bound);
  return Object.freeze({async rpc(operation,args){
    if(!operations.has(operation))return {data:null,error:'V2_OPERATION_REFUSED'};
    try{const r=await client.query('select public.monaco_scanner_evaluation_v2_rpc($1::jsonb,$2::jsonb,$3::text,$4::jsonb) as result',[n,i,operation,JSON.stringify(args)]);
      need(r.rows?.length===1&&r.rows[0].result);return {data:r.rows[0].result,error:null};
    }catch{return {data:null,error:'V2_LEDGER_ACK_UNKNOWN_NO_RETRY'};}
  }});
}
export function createEvaluationLedgerBridge(port,identity,expectedAdmission){
  const bound=validateEvaluationIdentity(identity),admission=validateAdmissionEvidence(expectedAdmission,bound);need(typeof port?.rpc==='function');
  async function invoke(operation,args){const r=await port.rpc(operation,structuredClone(args));need(!r?.error&&r?.data,'V2_LEDGER_ACK_UNKNOWN_NO_RETRY');return r.data;}
  return Object.freeze({
    async inspect(){return validateEvaluationInspection(await invoke('inspect',{}),bound,admission);},
    claim:()=>invoke('begin_case',{}),
    submit:(slot,r)=>invoke('submit_slot',{slot,requestId:r.requestId,fingerprint:r.fingerprint,requestSha256:r.requestSha256}),
    receipt:(slot,r)=>invoke('receipt_slot',{slot,...r}),
    finish:r=>invoke('finish_case',r),
    stop:reason=>invoke('stop_case',{reason}),
  });
}
