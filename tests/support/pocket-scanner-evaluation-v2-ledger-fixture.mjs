import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {buildEvaluationV2Admission,V2_LEDGER_PINS as P} from '../../scripts/prepare-pocket-scanner-evaluation-v2-ledger.mjs';
export const planBytes=readFileSync(new URL('../../docs/monaco-126/scanner-evaluation-v2-2026-10-24/PLAN.json',import.meta.url));
export const plan=JSON.parse(planBytes),planSha256=createHash('sha256').update(planBytes).digest('hex');
export function admissionFixture({caseId='v2-d001',previousCaseReceiptSha256=null,carryIn={},now=Date.now()}={}){
 const runtimeSourceSha='a'.repeat(40);
 const approval={kind:'POCKET_SCANNER_EVALUATION_V2_EXTENSION_APPROVAL',status:'APPROVED',approvedBy:'OWNER',
  approvalRef:'https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-99999999999',scopeId:P.scopeId,originalAllowanceRef:'comment-6165012632',appSourceSha:P.appSourceSha,
  runtimeSourceSha,planSha256,allowedCaseIds:[...P.caseIds],maximumAdditionalCases:6,maximumAdditionalSends:18,
  maximumAdditionalMicroUsd:1980000,aggregateCapMicroUsd:5000000,originalHeldMicroUsd:1506400,retries:0,
  approvedAt:new Date(now-60000).toISOString(),validUntil:new Date(now+3600000).toISOString(),approvalBodySha256:'b'.repeat(64)};
 const original={originalHistorySha256:'c'.repeat(64),originalPinsSha256:P.originalPinsSha256,originalCases:6,originalSlots:18,
  originalReceipts:14,originalVoided:4,originalAccounts:6,originalHeldMicroUsd:1506400,actualMicroUsd:null,
  runnerCanLogin:false,runnerSessions:0,observedAt:new Date(now).toISOString(),...carryIn};
 const attempt={caseId,evidenceSha:'d'.repeat(40),wrapperSha:'e'.repeat(40),runId:String(90000000000+Number(caseId.at(-1))),
  jobId:String(99000000000+Number(caseId.at(-1))),runAttempt:'1',admissionEvidenceSha256:'d'.repeat(64),
  reassessmentEvidenceSha256:'e'.repeat(64),previousCaseReceiptSha256,validUntil:new Date(now+2700000).toISOString()};
 return {approval,planBytes,runtimeSourceSha,carryIn:original,attempt,mode:caseId==='v2-d001'?'scope-and-first-case':'next-case',now};
}
export {buildEvaluationV2Admission,P};
