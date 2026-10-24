import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {admissionFixture,buildEvaluationV2Admission,P,planBytes} from './support/pocket-scanner-evaluation-v2-ledger-fixture.mjs';
import {validateEvaluationV2Plan} from '../scripts/prepare-pocket-scanner-evaluation-v2-ledger.mjs';

test('real frozen application plan produces18 newpinned requests and one330000 named permit underoriginalcap',()=>{
 const c=admissionFixture(),r=buildEvaluationV2Admission(c),p=validateEvaluationV2Plan(planBytes);
 assert.equal(p.rows.length,18);assert.equal(r.executed,false);assert.equal(r.originalHeldMicroUsd,1506400);
 assert.equal(r.maximumCombinedMicroUsd,3486400);assert.equal(r.maximumAdditionalMicroUsd,1980000);
 assert.equal(r.identity.evaluation.caseId,'v2-d001');assert.equal(r.identity.evaluation.sourceCaseId,'d001');
 assert.equal(r.identity.evaluation.attemptId,'v2-d001-attempt-1');assert.equal(r.identity.planSha256,p.planSha256);
 assert.match(r.admissionSql,/INSERT INTO private.monaco_scanner_eval_v2_permits/);
 assert.doesNotMatch(r.admissionSql,/ALTER ROLE|UPDATE private|DELETE FROM|TRUNCATE|CREATE ROLE|CREATE DATABASE/);
 assert.equal(r.financiallySettled,false);assert.equal(r.actualMicroUsd,null);
});
test('HOLD, missingapproval, nakedboolean andoriginalcomment nevergrant freshscope',()=>{
 for(const approval of [null,true,{status:'APPROVED'},{status:'HOLD'}])assert.throws(()=>buildEvaluationV2Admission({...admissionFixture(),approval}),/approval/);
 for(const ref of ['comment-6165012632','comment-6383327587','comment-6383999765']){
  const c=admissionFixture();c.approval.approvalRef=ref;assert.throws(()=>buildEvaluationV2Admission(c),/new immutable/);
 }
});
test('approvalmustbind precise app runtimeplanmodelscopeboundsandfuturewindow',()=>{
 for(const mutate of [c=>c.approval.appSourceSha='f'.repeat(40),c=>c.approval.runtimeSourceSha='f'.repeat(40),
  c=>c.approval.planSha256='f'.repeat(64),c=>c.approval.maximumAdditionalCases=7,c=>c.approval.maximumAdditionalSends=19,
  c=>c.approval.maximumAdditionalMicroUsd=5000000,c=>c.approval.originalHeldMicroUsd=0,c=>c.approval.retries=1,
  c=>c.approval.allowedCaseIds[0]='d001',c=>c.approval.approvedAt=new Date(c.now+1000).toISOString(),
  c=>c.approval.validUntil=new Date(c.now-1).toISOString(),c=>c.approval.approvalBodySha256='missing',c=>c.approval.extra=true]){
  const c=admissionFixture();mutate(c);assert.throws(()=>buildEvaluationV2Admission(c));
 }
});
test('carryinrequires actual14receipts4void18pins6accounts1506400andfreshinactiveobservation',()=>{
 for(const mutate of [c=>c.carryIn.originalReceipts=0,c=>c.carryIn.originalVoided=0,c=>c.carryIn.originalSlots=17,
  c=>c.carryIn.originalAccounts=5,c=>c.carryIn.originalHeldMicroUsd=0,c=>c.carryIn.actualMicroUsd=0,
  c=>c.carryIn.originalPinsSha256='f'.repeat(64),c=>c.carryIn.runnerCanLogin=true,c=>c.carryIn.runnerSessions=1,
  c=>c.carryIn.observedAt=new Date(c.now-16*60000).toISOString(),c=>c.carryIn.observedAt=new Date(c.now+1000).toISOString()]){
  const c=admissionFixture();mutate(c);assert.throws(()=>buildEvaluationV2Admission(c),/observed/);
 }
});
test('oldrunattemptoldcaseIDfreshscopeandmissingpercasereassessment refuse',()=>{
 for(const mutate of [c=>c.attempt.caseId='d001',c=>c.attempt.caseId='v2-d007',c=>c.attempt.runId='40086015008',
  c=>c.attempt.runAttempt='2',c=>c.attempt.admissionEvidenceSha256='',c=>c.attempt.reassessmentEvidenceSha256='',
  c=>c.attempt.validUntil=new Date(c.now+61*60000).toISOString(),c=>c.mode='next-case']){
  const c=admissionFixture();mutate(c);assert.throws(()=>buildEvaluationV2Admission(c));
 }
 assert.throws(()=>buildEvaluationV2Admission(admissionFixture({caseId:'v2-d002'})),/preceding/);
 const next=buildEvaluationV2Admission(admissionFixture({caseId:'v2-d002',previousCaseReceiptSha256:'f'.repeat(64)}));
 assert.doesNotMatch(next.admissionSql,/INSERT INTO private.monaco_scanner_eval_v2_scopes/);
 assert.match(next.admissionSql,/Previous retained\/accounted case must match reassessment/);
});
test('requestsneednewscopeboundfingerprints exact4000precisionlimits andnooldplanreuse',()=>{
 for(const mutate of [p=>p.cases[0].caseId='d001',p=>p.cases[0].sourceCaseId='d007',p=>p.cases[0].attemptId='attempt-2',
  p=>p.cases[0].calls[1].maxOutputTokens=1400,p=>p.cases[0].calls[1].costBoundMicroUsd=102800,
  p=>p.cases[0].calls[0].model='other',p=>p.cases[0].calls[0].fingerprint='f'.repeat(64),
  p=>p.cases[0].calls[0].requestId='d001-main-old']){
  const p=JSON.parse(planBytes);mutate(p);assert.throws(()=>validateEvaluationV2Plan(Buffer.from(JSON.stringify(p))));
 }
});
test('proposedmigration adds newRPC append-onlyevidence and sharedparentcapguard withoutreplacingoldfunction',()=>{
 const sql=readFileSync(new URL('../database/neon/proposed/20261024-scanner-evaluation-v2.sql',import.meta.url),'utf8');
 assert.doesNotMatch(sql,/CREATE OR REPLACE|ALTER ROLE|INSERT INTO private\.pocket_benchmark_pilot_ledgers/i);
 assert.match(sql,/CREATE FUNCTION public\.monaco_scanner_evaluation_v2_rpc/);
 assert.match(sql,/CREATE TRIGGER monaco_scanner_eval_v2_shared_cap BEFORE INSERT OR UPDATE ON private\.pocket_benchmark_pilot_calls/);
 assert.match(sql,/original-previous\+proposed\+extra>cap/);
 assert.match(sql,/FOR UPDATE/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.monaco_scanner_evaluation_v2_rpc/);
 assert.doesNotMatch(sql,/GRANT (?:ALL|SELECT|INSERT|UPDATE|DELETE) ON (?:TABLE )?private\./i);
});
