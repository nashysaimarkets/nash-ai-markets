/** Offline, future-approval preparation. No connection, credentials or activation.
 * Every SQL string is quoted, and the database rechecks current history itself.
 */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CONTINUATION_PINS} from './prepare-monaco-continuation-admission.mjs';

export const V2_LEDGER_PINS=Object.freeze({...CONTINUATION_PINS,
 scopeId:'pocket-scanner-evaluation-v2-20261024',
 appSourceSha:'2812bfbc6e8f62e93d0bc56957fd5ce71cc819dc',
 originalPinsSha256:'90c4291252904ab977314d5c8010615bea2571c7efc5cddc0ae16df9f7d31165',
 caseIds:Object.freeze(['v2-d001','v2-d002','v2-d003','v2-d004','v2-d005','v2-d006']),
 slotNames:Object.freeze(['main','primary_precision','rescue_precision']),
 originalHeldMicroUsd:1506400,caseBoundMicroUsd:330000,maximumAdditionalMicroUsd:1980000,aggregateCapMicroUsd:5000000,
});
const P=V2_LEDGER_PINS,hash=x=>createHash('sha256').update(x).digest('hex');
const need=(v,m)=>{if(!v)throw Error(m);};
const sha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const numeric=v=>typeof v==='string'&&/^[1-9][0-9]{0,19}$/.test(v);
const q=v=>{need(typeof v==='string'&&!v.includes('\0'),'SQL string required');return "'"+v.replaceAll("'","''")+"'";};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const exact=(v,names)=>v&&typeof v==='object'&&!Array.isArray(v)&&equal(Object.keys(v).sort(),[...names].sort());
const approvalFields=['kind','status','approvedBy','approvalRef','scopeId','originalAllowanceRef','appSourceSha','runtimeSourceSha',
 'planSha256','allowedCaseIds','maximumAdditionalCases','maximumAdditionalSends','maximumAdditionalMicroUsd',
 'aggregateCapMicroUsd','originalHeldMicroUsd','retries','approvedAt','validUntil','approvalBodySha256'];
export function validateEvaluationV2Approval(a,{planSha256,runtimeSourceSha,now=Date.now()}={}){
 need(exact(a,approvalFields),'Future explicit complete owner extension approval required; draft HOLD is not authority');
 need(a.kind==='POCKET_SCANNER_EVALUATION_V2_EXTENSION_APPROVAL'&&a.status==='APPROVED'&&a.approvedBy==='OWNER',
  'Future explicit owner extension approval required');
 need(typeof a.approvalRef==='string'&&/^comment-[1-9][0-9]{8,19}$/.test(a.approvalRef)
  &&!['comment-6165012632','comment-6383327587','comment-6383999765'].includes(a.approvalRef)
  &&digest(a.approvalBodySha256),'A new immutable owner approval reference and body digest are required');
 need(a.scopeId===P.scopeId&&a.originalAllowanceRef==='comment-6165012632'
  &&a.appSourceSha===P.appSourceSha&&sha(runtimeSourceSha)&&a.runtimeSourceSha===runtimeSourceSha
  &&digest(planSha256)&&a.planSha256===planSha256&&equal(a.allowedCaseIds,P.caseIds)
  &&a.maximumAdditionalCases===6&&a.maximumAdditionalSends===18&&a.maximumAdditionalMicroUsd===1980000
  &&a.aggregateCapMicroUsd===5000000&&a.originalHeldMicroUsd===1506400&&a.retries===0,
  'Exact new versioned scope, unchanged aggregate allowance and reviewed source/plan required');
 const start=Date.parse(a.approvedAt),end=Date.parse(a.validUntil);
 need(Number.isFinite(start)&&Number.isFinite(end)&&start<=now&&end>now&&end>start&&end-start<=7*86400000,
  'Current finite owner approval window required');
 return a;
}
export function validateEvaluationV2Plan(planBytes){
 need(planBytes instanceof Uint8Array,'Exact plan bytes required');
 const plan=JSON.parse(Buffer.from(planBytes).toString('utf8'));
 need(plan.scopeId===P.scopeId&&plan.appSourceSha===P.appSourceSha&&Array.isArray(plan.cases)&&plan.cases.length===6,
  'Exact accepted application and six new case identities required');
 const rows=[];
 for(const [index,caseId] of P.caseIds.entries()){
  const c=plan.cases[index],sourceCaseId=caseId.slice(3),attemptId=caseId+'-attempt-1';
  need(c?.caseId===caseId&&c.sourceCaseId===sourceCaseId&&c.attemptId===attemptId&&c.calls?.length===3,
   'Versioned case/source/attempt identities changed');
  for(const slot of P.slotNames){
   const found=c.calls.filter(x=>x.slot===slot);need(found.length===1,'Exactly one immutable pin per slot required');
   const r=found[0],fingerprint=hash(JSON.stringify({scopeId:P.scopeId,attemptId,caseId,sourceCaseId,slot,requestSha256:r.requestSha256}));
   need(digest(r.requestSha256)&&r.requestId===`${caseId}-${slot}-${r.requestSha256.slice(0,16)}`&&r.fingerprint===fingerprint
    &&r.maxOutputTokens===(slot==='main'?7000:4000)&&r.costBoundMicroUsd===(slot==='main'?114000:108000)
    &&r.model==='gpt-5-mini-2025-08-07'&&r.serviceTier==='default','Reviewed v2 request/bound/model mismatch');
   rows.push({scopeId:P.scopeId,caseId,sourceCaseId,...r});
  }
 }
 need(new Set(rows.map(r=>r.requestId)).size===18&&new Set(rows.map(r=>r.fingerprint)).size===18,
  'Distinct new request identities required');
 return {plan,planSha256:hash(planBytes),rows};
}
export function buildEvaluationV2Admission({approval,planBytes,runtimeSourceSha,carryIn,attempt,mode='scope-and-first-case',now=Date.now()}){
 const {planSha256,rows}=validateEvaluationV2Plan(planBytes);
 validateEvaluationV2Approval(approval,{planSha256,runtimeSourceSha,now});
 need(carryIn&&digest(carryIn.originalHistorySha256)&&carryIn.originalPinsSha256===P.originalPinsSha256
  &&carryIn.originalCases===6&&carryIn.originalSlots===18&&carryIn.originalReceipts===14&&carryIn.originalVoided===4
  &&carryIn.originalAccounts===6&&carryIn.originalHeldMicroUsd===1506400&&carryIn.actualMicroUsd===null
  &&carryIn.runnerCanLogin===false&&carryIn.runnerSessions===0&&Number.isFinite(Date.parse(carryIn.observedAt))
  &&Date.parse(carryIn.observedAt)<=now&&now-Date.parse(carryIn.observedAt)<=15*60000,
  'Fresh independently observed immutable original-six accounting and inactive runner required');
 need(['scope-and-first-case','next-case'].includes(mode)&&attempt&&P.caseIds.includes(attempt.caseId),
  'One named versioned case permit required');
 const caseId=attempt.caseId,index=P.caseIds.indexOf(caseId),attemptId=caseId+'-attempt-1';
 need(mode==='scope-and-first-case'?index===0:index>0,'First admission and later reassessment are distinct');
 need(sha(attempt.evidenceSha)&&sha(attempt.wrapperSha)&&numeric(attempt.runId)&&numeric(attempt.jobId)
  &&attempt.runAttempt==='1'&&digest(attempt.admissionEvidenceSha256)&&digest(attempt.reassessmentEvidenceSha256)
  &&attempt.runId!=='40083992183'&&attempt.runId!=='40086015008',
  'Exact new source/evidence/wrapper/run/job and reviewed reassessment required');
 need(index===0?attempt.previousCaseReceiptSha256===null:digest(attempt.previousCaseReceiptSha256),
  'Later case must cite preceding accounted receipt digest');
 const deadline=Date.parse(attempt.validUntil);
 need(Number.isFinite(deadline)&&deadline>now&&deadline-now<=60*60000&&deadline<=Date.parse(approval.validUntil),
  'Current bounded per-case permit required');
 const identity={environment:'monaco-scanner-evaluation-v2',sourceSha:runtimeSourceSha,backendRef:P.backendRef,
  projectRef:P.projectRef,keyTrackingId:P.keyTrackingId,keyFingerprintSha256:P.keyFingerprintSha256,planSha256,
  evaluation:{scopeId:P.scopeId,attemptId,caseId,sourceCaseId:caseId.slice(3),appSourceSha:P.appSourceSha,
   evidenceSha:attempt.evidenceSha,wrapperSha:attempt.wrapperSha,runId:attempt.runId,jobId:attempt.jobId,
   runAttempt:'1',approvalRef:approval.approvalRef}};
 const json=v=>q(JSON.stringify(v))+'::jsonb';
 const owner=`IF current_database()<>'monaco_ledger' OR session_user<>'monaco_ledger_owner' OR current_user<>'monaco_ledger_owner' THEN RAISE EXCEPTION 'Exact isolated owner required'; END IF;`;
 const inactive=`IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='monaco_ledger_runner' AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls)
 OR EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname='monaco_ledger_runner')
 OR EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename='monaco_ledger_runner') THEN RAISE EXCEPTION 'Inactive restricted runner required'; END IF;`;
 let seed='';
 if(mode==='scope-and-first-case'){
  seed=`INSERT INTO private.monaco_scanner_eval_v2_scopes(scope_id,ledger_key,approval_ref,approval_evidence_sha256,approval_document,
 app_source_sha,runtime_source_sha,plan_sha256,original_history_sha256,original_pins_sha256,original_held_microusd,maximum_additional_microusd,approved_at,valid_until)
 VALUES(${[P.scopeId,P.ledgerKey,approval.approvalRef,approval.approvalBodySha256].map(q)},${json(approval)},${[P.appSourceSha,runtimeSourceSha,planSha256,carryIn.originalHistorySha256,P.originalPinsSha256].map(q)},1506400,1980000,${q(approval.approvedAt)}::timestamptz,${q(approval.validUntil)}::timestamptz);
 INSERT INTO private.monaco_scanner_eval_v2_pins(scope_id,case_id,source_case_id,slot,request_id,fingerprint,request_sha256,max_output_tokens,bound_microusd) VALUES
 ${rows.map(r=>'('+[P.scopeId,r.caseId,r.sourceCaseId,r.slot,r.requestId,r.fingerprint,r.requestSha256].map(q).join(',')+','+r.maxOutputTokens+','+r.costBoundMicroUsd+')').join(',\n')};`;
 }
 const previous=index?P.caseIds[index-1]:null;
 const sql=`-- PROPOSED. Requires the future owner approval and actual exact pending run above.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
DO $guard$
BEGIN
 ${owner}
 ${inactive}
 PERFORM private.monaco_scanner_eval_v2_assert_original(${q(carryIn.originalHistorySha256)});
 IF clock_timestamp()>=${q(attempt.validUntil)}::timestamptz OR clock_timestamp()>=${q(approval.validUntil)}::timestamptz
  OR clock_timestamp()<${q(approval.approvedAt)}::timestamptz THEN RAISE EXCEPTION 'Approval/permit is not current'; END IF;
 ${mode==='scope-and-first-case'?`IF EXISTS(SELECT 1 FROM private.monaco_scanner_eval_v2_scopes) THEN RAISE EXCEPTION 'Scope already admitted'; END IF;`:
 `IF NOT EXISTS(SELECT 1 FROM private.monaco_scanner_eval_v2_scopes WHERE scope_id=${q(P.scopeId)} AND approval_ref=${q(approval.approvalRef)} AND approval_evidence_sha256=${q(approval.approvalBodySha256)} AND approval_document=${json(approval)} AND runtime_source_sha=${q(runtimeSourceSha)} AND plan_sha256=${q(planSha256)} AND original_history_sha256=${q(carryIn.originalHistorySha256)}) THEN RAISE EXCEPTION 'Exact admitted scope required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM private.monaco_scanner_eval_v2_accounts WHERE scope_id=${q(P.scopeId)} AND case_id=${q(previous)} AND receipt_sha256=${q(attempt.previousCaseReceiptSha256)} AND receipt_sha256=private.monaco_scanner_eval_v2_receipt_digest(scope_id,case_id)) THEN RAISE EXCEPTION 'Previous retained/accounted case must match reassessment'; END IF;
 IF (SELECT count(*) FROM private.monaco_scanner_eval_v2_accounts)<>${index} OR EXISTS(SELECT 1 FROM private.monaco_scanner_eval_v2_claims c LEFT JOIN private.monaco_scanner_eval_v2_accounts a USING(scope_id,case_id) WHERE a.case_id IS NULL) THEN RAISE EXCEPTION 'Prior case remains unresolved'; END IF;`}
 IF EXISTS(SELECT 1 FROM private.monaco_scanner_eval_v2_revocations WHERE scope_id=${q(P.scopeId)} AND target IN ('scope',${q(attemptId)})) THEN RAISE EXCEPTION 'Scope or attempt revoked'; END IF;
END $guard$;
${seed}
INSERT INTO private.monaco_scanner_eval_v2_permits(scope_id,case_id,attempt_id,identity,admission_evidence_sha256,reassessment_evidence_sha256,previous_case_receipt_sha256,admitted_at,valid_until)
 VALUES(${[P.scopeId,caseId,attemptId].map(q)},${json(identity)},${q(attempt.admissionEvidenceSha256)},${q(attempt.reassessmentEvidenceSha256)},${previous?q(attempt.previousCaseReceiptSha256):'NULL'},clock_timestamp(),${q(attempt.validUntil)}::timestamptz);
COMMIT;
`;
 return {kind:'POCKET_SCANNER_EVALUATION_V2_ADMISSION_PROPOSAL',executed:false,mode,identity,planSha256,
  originalHeldMicroUsd:1506400,caseBoundMicroUsd:330000,maximumAdditionalMicroUsd:1980000,maximumCombinedMicroUsd:3486400,
  financiallySettled:false,actualMicroUsd:null,admissionSql:sql,admissionSqlSha256:hash(sql)};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 need(process.argv.length===4,'Usage: node prepare-pocket-scanner-evaluation-v2-ledger.mjs CONFIG.json OUTPUT_PREFIX');
 const configPath=resolve(process.argv[2]),prefix=resolve(process.argv[3]);
 const c=JSON.parse(readFileSync(configPath,'utf8'));c.planBytes=readFileSync(resolve(c.planPath));delete c.planPath;
 const result=buildEvaluationV2Admission(c);
 writeFileSync(prefix+'.admission.sql',result.admissionSql,{flag:'wx',mode:0o600});
 writeFileSync(prefix+'.manifest.json',JSON.stringify({...result,admissionSql:undefined},null,2)+'\n',{flag:'wx',mode:0o600});
 console.log(JSON.stringify({...result,admissionSql:undefined}));
}
