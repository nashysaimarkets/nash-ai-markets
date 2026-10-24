/** Offline admission preparation; all new source/run/evidence values synthetic. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildContinuationAdmission,CONTINUATION_PINS as P} from '../scripts/prepare-monaco-continuation-admission.mjs';

export function syntheticContinuationInput(receipt='b'.repeat(64)){
 const binding={verified:true,environment:'monaco-first-six-inference',sourceSha:'a'.repeat(40),
  ledgerKey:P.ledgerKey,backendRef:P.backendRef,projectRef:P.projectRef,keyTrackingId:P.keyTrackingId,
  keyFingerprintSha256:P.keyFingerprintSha256,planSha256:P.planSha256,controlPlaneEvidenceSha256:P.controlPlaneSha256};
 const evidence={kind:'MONACO_FIRST_SIX_CONTINUATION_V1',originalSourceSha:P.originalSourceSha,
  originalRunId:P.originalRunId,remainingCaseIds:[...P.remainingCaseIds],priorReceiptSha256:receipt,
  priorCommittedMicroUsd:216800,previousTransportSendAttempts:2,maximumAdditionalSends:15,
  maximumAdditionalExposureMicroUsd:1598000,maximumCombinedSends:17,maximumCombinedExposureMicroUsd:1814800,
  originalCaseImmutable:true};
 const carryIn={observed_at:'2026-10-24T10:07:55.797Z',runner_can_login:false,runner_sessions:'0',cases:'1',calls:'3',
  original_binding:{ledger_key:P.ledgerKey,runner_source_sha:P.originalSourceSha,
   binding_evidence_sha256:P.originalBindingEvidenceSha256,plan_sha256:P.planSha256,backend_ref:P.backendRef,
   project_ref:P.projectRef,existing_key_tracking_id:P.keyTrackingId,key_fingerprint_sha256:P.keyFingerprintSha256},
  d001_account:{ledger_key:P.ledgerKey,case_id:'d001',reserved_microusd:216800,receipt_sha256:receipt}};
 return {binding,evidence,carryIn,bindingEvidenceSha256:'c'.repeat(64),authorizationEvidenceSha256:'d'.repeat(64),
  evidenceSha:'e'.repeat(40),runId:'50000000001',
  planBytes:readFileSync(new URL('../docs/monaco-126/internal-diagnostics/FIRST-SIX-PROVIDER-PLAN.json',import.meta.url))};
}

test('reviewed preparation binds a distinct run/source and retains the original two attempts',()=>{
 const f=syntheticContinuationInput(),r=buildContinuationAdmission(f);
 assert.equal(r.executed,false);assert.equal(r.identity.sourceSha,f.binding.sourceSha);
 assert.equal(r.identity.continuation.originalSourceSha,P.originalSourceSha);
 assert.equal(r.identity.continuation.runId,f.runId);
 assert.equal(r.maximumCombinedSends,17);assert.equal(r.maximumCombinedExposureMicroUsd,1814800);
 assert.match(r.admissionSql,/LOCK TABLE/);assert.doesNotMatch(r.admissionSql,/\bUPDATE\b|\bDELETE\b|\bTRUNCATE\b|\bON CONFLICT\b/);
 assert.doesNotMatch(r.admissionSql,/ALTER ROLE|PASSWORD/);
 assert.match(r.activationSql,/LOGIN VALID UNTIL/);assert.match(r.activationSql,/35 minutes/);
});
test('changed or expanded remaining scope cannot be prepared',()=>{
 for(const edit of [f=>f.evidence.remainingCaseIds.unshift('d001'),f=>f.evidence.remainingCaseIds.push('e001'),
  f=>f.evidence.maximumAdditionalSends=16,f=>f.evidence.maximumCombinedSends=18,
  f=>f.evidence.maximumAdditionalExposureMicroUsd=1600000,f=>f.evidence.originalCaseImmutable=false]){
  const f=syntheticContinuationInput();edit(f);assert.throws(()=>buildContinuationAdmission(f));
 }
});
test('predecessor replay, missing reviewed hashes and incorrect credential/source binding are rejected',()=>{
 for(const edit of [f=>f.runId=P.originalRunId,f=>f.binding.sourceSha=P.originalSourceSha,
  f=>f.binding.sourceSha='UNBOUND',f=>f.evidenceSha='UNBOUND',f=>f.binding.keyFingerprintSha256='f'.repeat(64),
  f=>f.bindingEvidenceSha256='',f=>f.binding.ledgerKey='fresh-allowance']){
  const f=syntheticContinuationInput();edit(f);assert.throws(()=>buildContinuationAdmission(f));
 }
});
test('unknown, altered, active or additionally attempted carry-in is never reclassified as unspent',()=>{
 for(const edit of [f=>f.carryIn.d001_account.reserved_microusd=0,
  f=>f.carryIn.d001_account.receipt_sha256='f'.repeat(64),f=>f.carryIn.original_binding.runner_source_sha='f'.repeat(40),
  f=>f.carryIn.calls='4',f=>f.carryIn.cases='2',f=>f.carryIn.runner_can_login=true,
  f=>f.carryIn.runner_sessions='1',f=>delete f.carryIn.d001_account]){
  const f=syntheticContinuationInput();edit(f);assert.throws(()=>buildContinuationAdmission(f));
 }
});
test('frozen request bytes cannot be replaced even by another valid-looking plan',()=>{
 const f=syntheticContinuationInput();const plan=JSON.parse(f.planBytes);plan.calls[0].fingerprint='f'.repeat(64);
 f.planBytes=Buffer.from(JSON.stringify(plan));assert.throws(()=>buildContinuationAdmission(f),/plan hash/);
});
