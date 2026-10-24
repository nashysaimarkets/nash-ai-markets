/** Executes actual accepted + proposed SQL against disposable cached PGlite.
 * All approval/comment/usage values are synthetic test evidence, never authority.
 * No provider, network, credential, real chart or hosted database is accessed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createFixture,submitArgs,receiptArgs,finishArgs,sha} from './support/expiry-recovery-fixture.mjs';
import {validateEvaluationInspection} from '../../../scanner-evaluation-v2/scripts/pocket-scanner-evaluation-v2-bridge.mjs';
import {ownerAmendmentBody} from '../recovery-builder.mjs';
import {prepareOperationalVariants} from '../recovery-operations.mjs';

const f=await createFixture();
const caseId='v2-d002';
const version=(await f.ownerQuery('SELECT version() AS v')).rows[0].v;
console.log('# Local engine: '+version);
console.log('# Single-connection WASM SQL/role tests; no network, hosted DB, provider or multi-session concurrency claim.');

async function isolated(body,fixture=f){
 await fixture.begin();
 try{return await body(fixture);}finally{await fixture.rollback();}
}
async function installed(g,options){const w=await g.witness(options);await g.install(w);return w;}
async function granted(g,options){const w=await installed(g,options);await g.grant(w);await g.activate();return w;}
async function unchanged(g){assert.deepEqual(await g.snapshot(),g.original);}
async function count(g,table,where="case_id='v2-d002'"){
 return (await g.ownerQuery(`SELECT count(*)::int AS n FROM private.monaco_scanner_eval_v2_${table} WHERE ${where}`)).rows[0].n;
}
async function revoke(g,target='scope'){
 await g.ownerQuery('INSERT INTO private.monaco_scanner_eval_v2_revocations(scope_id,target,evidence_sha256) VALUES($1,$2,$3)',
  [g.identity.evaluation.scopeId,target,'4'.repeat(64)]);
}
async function mandatoryPending(g){
 assert.equal((await g.rpc('begin_case')).allowed,true);
 assert.equal((await g.rpc('submit_slot',submitArgs(caseId,'main'))).claimed,true);
 await g.rpc('receipt_slot',receiptArgs(caseId,'main'));
 assert.equal((await g.rpc('submit_slot',submitArgs(caseId,'primary_precision'))).claimed,true);
}
function rebindDecisionHashes(w){
 w.amendment.approvalRequestSha256=sha(w.owner_decision.requestText);
 w.amendment.ownerResponseSha256=sha(w.owner_decision.ownerResponseText);
 w.owner_comment.body=ownerAmendmentBody(w.amendment);w.amendment.approvalBodySha256=sha(w.owner_comment.body);
}

try{
 await test('expired unused original permit remains denied before any amendment, without a new claim or hold',()=>isolated(async g=>{
  await g.activate();
  for(const op of ['inspect','begin_case']){const r=await g.rpc(op);assert.equal(r.allowed,false);assert.equal(r.reason,'expired');assert.equal(r.aggregateCommittedMicroUsd,1836400);}
  await g.rejected(()=>g.rpc('submit_slot',submitArgs(caseId,'main')),/unrevoked running attempt/);
  assert.equal(await count(g,'claims'),0);assert.equal(await count(g,'submissions'),0);await unchanged(g);
 }));

 await test('install requires a separately recorded amendment and exact accepted RPC preimage',()=>isolated(async g=>{
  await g.rejected(()=>g.ownerExec(g.proposal.installSql),/new separately recorded owner amendment/i);
  const w=await g.witness();w.amendment.approvalRef=g.identity.evaluation.approvalRef;
  await g.rejected(()=>g.install(w),/new separately recorded owner amendment/i);
  assert.equal((await g.ownerQuery("SELECT to_regclass('private.monaco_scanner_eval_v2_unused_leases') AS r")).rows[0].r,null);
  await unchanged(g);
 }));

 await test('installed code without a lease and NULL/missing helper lookup fail closed',()=>isolated(async g=>{
  await installed(g);
  const checks=(await g.ownerQuery(`SELECT
   private.monaco_scanner_eval_v2_unused_lease_active(NULL::private.monaco_scanner_eval_v2_permits) AS null_record,
   private.monaco_scanner_eval_v2_unused_lease_active(jsonb_populate_record(NULL::private.monaco_scanner_eval_v2_permits,'{"scope_id":"missing","case_id":"v2-d002"}'::jsonb)) AS missing,
   private.monaco_scanner_eval_v2_unused_lease_active(p) AS present_without_lease
   FROM private.monaco_scanner_eval_v2_permits p WHERE case_id='v2-d002'`)).rows[0];
  assert.deepEqual(checks,{null_record:false,missing:false,present_without_lease:false});
  await g.activate();assert.equal((await g.rpc('inspect')).reason,'expired');assert.equal((await g.rpc('begin_case')).allowed,false);
  assert.equal(await count(g,'claims'),0);await unchanged(g);
 }));

 await test('approved exact-identity lease composes with unchanged inspection and runs mandatory slots once with full hold',()=>isolated(async g=>{
  const w=await granted(g),inspection=await g.rpc('inspect');
  assert.equal(validateEvaluationInspection(inspection,g.identity,g.prepared.expectedAdmission).allowed,true);
  assert.equal((await g.rpc('begin_case')).allowed,true);
  assert.equal((await g.rpc('begin_case')).allowed,false);
  await g.rejected(()=>g.rpc('submit_slot',submitArgs(caseId,'primary_precision')),/Earlier mandatory receipt/);
  assert.equal((await g.rpc('submit_slot',submitArgs(caseId,'main'))).claimed,true);
  assert.equal((await g.rpc('submit_slot',submitArgs(caseId,'main'))).claimed,false);
  await g.rejected(()=>g.rpc('finish_case',finishArgs(caseId)),/Complete mandatory receipts/);
  assert.equal((await g.rpc('receipt_slot',receiptArgs(caseId,'main'))).idempotent,false);
  assert.equal((await g.rpc('receipt_slot',receiptArgs(caseId,'main'))).idempotent,true);
  await g.rejected(()=>g.rpc('receipt_slot',{...receiptArgs(caseId,'main'),responseSha256:'0'.repeat(64)}),/Receipt conflict/);
  assert.equal((await g.rpc('submit_slot',submitArgs(caseId,'primary_precision'))).claimed,true);
  await g.rpc('receipt_slot',receiptArgs(caseId,'primary_precision'));
  const complete=await g.rpc('finish_case',finishArgs(caseId));
  assert.equal(complete.status,'completed');assert.equal(complete.idempotent,false);assert.equal(complete.accountingStatus,'FULL_RESERVATION_HELD');
  assert.equal((await g.rpc('finish_case',finishArgs(caseId))).idempotent,true);
  assert.equal(await count(g,'claims'),1);assert.equal(await count(g,'submissions'),2);assert.equal(await count(g,'receipts'),2);assert.equal(await count(g,'accounts'),1);
  const after=await g.rpc('inspect');assert.equal(after.aggregateCommittedMicroUsd,2166400);assert.equal(after.evaluationCommitmentsMicroUsd,660000);
  assert.equal(after.originalCommitmentsMicroUsd,1506400);assert.equal(after.financiallySettled,false);assert.equal(after.actualMicroUsd,null);
  assert.equal(after.slots.find(s=>s.slot==='rescue_precision').status,'voided');
  await g.inactive();await g.rejected(()=>g.grant(w),/never claimed|no second lease/i);
  assert.equal(await count(g,'unused_leases'),1);await unchanged(g);
 }));

 await test('lease cannot authorize changed run, job, source, wrapper, evidence, case, project, plan or key identity',()=>isolated(async g=>{
  await granted(g);
  const changes=[i=>i.evaluation.runId='40105387616',i=>i.evaluation.jobId='120905891815',i=>i.evaluation.runAttempt='2',
   i=>i.sourceSha='f'.repeat(40),i=>i.evaluation.wrapperSha='f'.repeat(40),i=>i.evaluation.evidenceSha='f'.repeat(40),
   i=>i.evaluation.caseId='v2-d003',i=>i.evaluation.attemptId='v2-d002-attempt-2',i=>i.evaluation.scopeId='another-scope',
   i=>i.projectRef='wrong',i=>i.planSha256='0'.repeat(64),i=>i.keyFingerprintSha256='0'.repeat(64),
   i=>delete i.evaluation.jobId,i=>i.evaluation.jobId=null];
  for(const mutate of changes){const i=structuredClone(g.identity);mutate(i);await g.rejected(()=>g.rpc('begin_case',{},i));}
  assert.equal(await count(g,'claims'),0);await unchanged(g);
 }));

 await test('grant rejects missing and JSON-null approval and comment timestamps',()=>isolated(async g=>{
  const base=await installed(g);
  for(const field of ['approvedAt','createdAt'])for(const missing of [true,false]){
   const w=structuredClone(base),v=field==='approvedAt'?w.amendment:w.owner_comment;
   if(missing)delete v[field];else v[field]=null;
   await g.rejected(()=>g.grant(w),/owner amendment|fresh pending/i);
  }
  assert.equal(await count(g,'unused_leases'),0);await unchanged(g);
 }));

 await test('declined, proposed, comment-only and missing owner decisions roll back the whole install and grant',()=>isolated(async g=>{
  const base=await g.witness();
  const changes=[w=>w.owner_decision.decision='DENIED',w=>w.owner_decision.decision='PROPOSED',w=>w.owner_decision.decision=null,
   w=>delete w.owner_decision.decision,w=>w.owner_decision=null,w=>delete w.owner_decision,
   w=>{w.owner_decision.ownerResponseText='No';rebindDecisionHashes(w);},w=>w.owner_decision.ownerResponseText=null,
   w=>w.owner_decision.requestText='unbound request',
   w=>{w.owner_decision.requestText=`Do you want to reject ${g.proposal.proposalSha256} for v2-d002 / run 40105387615 / job 120905891814 / attempt 1?`;rebindDecisionHashes(w);},
   w=>w.owner_comment.body='proposal-sha256: '+g.proposal.proposalSha256,
   w=>w.owner_decision.recordedAt=null,w=>delete w.owner_decision.recordedAt];
  for(const mutate of changes){const w=structuredClone(base);mutate(w);
   await g.rejected(async()=>{await g.install(w);await g.grant(w);});
   assert.equal((await g.ownerQuery("SELECT to_regclass('private.monaco_scanner_eval_v2_unused_leases') AS r")).rows[0].r,null);
  }
  await unchanged(g);
 }));

 await test('grant rejects mismatched scope, permit, identity, previous evidence and stale observed evidence',()=>isolated(async g=>{
  const base=await installed(g);
  const changes=[w=>w.original_permit.identity.evaluation.jobId='120905891815',w=>w.original_permit.identity.evaluation.jobId=null,
   w=>delete w.original_permit.identity.sourceSha,w=>w.original_scope.maximum_additional_microusd=5000000,
   w=>w.original_permit.valid_until='2000-01-01T00:00:00Z',w=>w.prior_evidence.account.receipt_sha256='0'.repeat(64),
   w=>w.prior_evidence.receipts.pop(),w=>w.prior_evidence.pins.pop(),w=>w.original_history_sha256='0'.repeat(64),
   w=>w.pending_observed_at='2000-01-01T00:00:00Z',w=>w.ledger_observed_at='2000-01-01T00:00:00Z',
   w=>w.amendment.targetIdentity.evaluation.jobId='120905891815',w=>w.owner_comment.body+=' unrecorded edit'];
  for(const mutate of changes){const w=structuredClone(base);mutate(w);await g.rejected(()=>g.grant(w));}
  assert.equal(await count(g,'unused_leases'),0);await unchanged(g);
 }));

 await test('grant cannot exceed its 60 minute lease, original scope, or reuse original authority',()=>isolated(async g=>{
  const base=await installed(g);
  for(const mutate of [w=>w.valid_until=new Date(Date.now()+3601000).toISOString(),w=>w.valid_until=new Date(Date.parse(w.original_scope.valid_until)+1000).toISOString(),
   w=>w.valid_until=new Date(Date.now()-1).toISOString(),w=>w.amendment.approvalRef=g.identity.evaluation.approvalRef,
   w=>w.amendment.maximumLeases=2,w=>w.amendment.aggregateCapMicroUsd=10000000,w=>w.amendment.retries=1]){
   const w=structuredClone(base);mutate(w);await g.rejected(()=>g.grant(w));
  }
  assert.equal(await count(g,'unused_leases'),0);await unchanged(g);
 }));

 await test('existing permit, original scope, and lease cannot be updated, deleted, truncated or reissued',()=>isolated(async g=>{
  const w=await granted(g);await g.inactive();
  for(const table of ['permits','scopes','unused_leases']){
   for(const statement of [`UPDATE private.monaco_scanner_eval_v2_${table} SET valid_until=valid_until+interval '1 minute'`,
    `DELETE FROM private.monaco_scanner_eval_v2_${table}`,`TRUNCATE private.monaco_scanner_eval_v2_${table} CASCADE`])
    await g.rejected(()=>g.ownerExec(statement));
  }
  await g.rejected(()=>g.grant(w));await g.rejected(()=>g.install(w),/preimage|already installed/i);
  assert.equal(await count(g,'unused_leases'),1);await unchanged(g);
 }));

 await test('runner cannot grant a lease, read private witnesses, or call private helpers',()=>isolated(async g=>{
  const w=await installed(g);await g.authorize(w);await g.runner();
  await g.rejected(()=>g.insertLease(w),/permission denied/);
  for(const sql of ["SELECT * FROM private.monaco_scanner_eval_v2_unused_leases",
   "SELECT private.monaco_scanner_eval_v2_recovery_prior_matches('{}'::jsonb)",
   "SELECT private.monaco_scanner_eval_v2_unused_lease_active(NULL::private.monaco_scanner_eval_v2_permits)"]){
   await g.runner();await g.rejected(()=>g.db.query(sql),/permission denied/);
  }
  const p=(await g.ownerQuery(`SELECT has_schema_privilege('monaco_ledger_runner','private','USAGE') AS schema_usage,
   has_table_privilege('monaco_ledger_runner','private.monaco_scanner_eval_v2_unused_leases','SELECT,INSERT,UPDATE,DELETE') AS table_access,
   has_function_privilege('monaco_ledger_runner','public.monaco_scanner_evaluation_v2_rpc(jsonb,jsonb,text,jsonb)','EXECUTE') AS rpc`)).rows[0];
  assert.deepEqual(p,{schema_usage:false,table_access:false,rpc:true});assert.equal(await count(g,'unused_leases'),0);await unchanged(g);
 }));

 for(const target of ['scope','v2-d002-attempt-1'])await test(`revoked ${target} refuses lease grant and cannot become current`,()=>isolated(async g=>{
  const w=await installed(g);await revoke(g,target);await g.rejected(()=>g.grant(w),/never claimed|no second lease/);
  await g.activate();assert.equal((await g.rpc('inspect')).reason,'revoked');assert.equal((await g.rpc('begin_case')).allowed,false);
  assert.equal(await count(g,'claims'),0);await unchanged(g);
 }));

 await test('revocation after valid grant still blocks claim and subsequent dispatch',()=>isolated(async g=>{
  await granted(g);await revoke(g);
  assert.equal((await g.rpc('begin_case')).reason,'revoked');await g.rejected(()=>g.rpc('submit_slot',submitArgs(caseId,'main')),/unrevoked running/);
  assert.equal(await count(g,'claims'),0);await unchanged(g);
 }));

 await test('revocation after submitted mandatory slots permits late receipts and accounting, but no new dispatch',()=>isolated(async g=>{
  await granted(g);await mandatoryPending(g);await revoke(g);
  await g.rejected(()=>g.rpc('submit_slot',submitArgs(caseId,'rescue_precision')),/unrevoked running/);
  assert.equal((await g.rpc('receipt_slot',receiptArgs(caseId,'primary_precision'))).status,'receipted');
  assert.equal((await g.rpc('finish_case',finishArgs(caseId))).status,'completed');
  assert.equal((await g.rpc('inspect')).aggregateCommittedMicroUsd,2166400);await unchanged(g);
 }));

 await test('lease expiry blocks remaining dispatch while retaining late authentic receipts and full reservation',()=>isolated(async g=>{
  const w=await granted(g,{leaseMs:1200});await mandatoryPending(g);await g.waitUntil(w.valid_until);
  assert.equal((await g.rpc('inspect')).reason,'expired');
  await g.rejected(()=>g.rpc('submit_slot',submitArgs(caseId,'rescue_precision')),/unrevoked running/);
  assert.equal((await g.rpc('receipt_slot',receiptArgs(caseId,'primary_precision'))).status,'receipted');
  assert.equal((await g.rpc('finish_case',finishArgs(caseId))).status,'completed');
  assert.equal((await g.rpc('inspect')).aggregateCommittedMicroUsd,2166400);await unchanged(g);
 }));

 await test('unknown submission cannot be completed or released; explicit stop retains full claim',()=>isolated(async g=>{
  await granted(g);assert.equal((await g.rpc('begin_case')).allowed,true);
  await g.rpc('submit_slot',submitArgs(caseId,'main'));
  await g.rejected(()=>g.rpc('finish_case',finishArgs(caseId)),/Complete mandatory receipts/);
  await g.rejected(()=>g.rpc('submit_slot',submitArgs(caseId,'primary_precision')),/Earlier mandatory receipt/);
  assert.equal((await g.rpc('stop_case',{reason:'TRANSPORT_OUTCOME_UNKNOWN'})).accountingStatus,'FULL_RESERVATION_HELD');
  await g.rejected(()=>g.rpc('submit_slot',submitArgs(caseId,'main')),/unrevoked running/);
  assert.equal((await g.rpc('inspect')).aggregateCommittedMicroUsd,2166400);assert.equal(await count(g,'accounts'),0);await unchanged(g);
 }));

 for(const send of [false,true])await test(`a previously ${send?'submitted':'claimed'} expired attempt cannot receive recovery`,async()=>{
  const used=await createFixture({permitLifeMs:1800,beforePermitExpiry:async g=>{
   await g.activate();assert.equal((await g.rpc('begin_case')).allowed,true);
   if(send)assert.equal((await g.rpc('submit_slot',submitArgs(caseId,'main'))).claimed,true);
  }});
  try{await isolated(async g=>{const w=await installed(g);await g.rejected(()=>g.grant(w),/never claimed|no second lease/);
   assert.equal(await count(g,'unused_leases'),0);assert.equal(await count(g,'claims'),1);assert.equal(await count(g,'submissions'),send?1:0);await unchanged(g);
  },used);}finally{await used.close();}
 });

 await test('expired original scope stays expired and cannot be rescued by an unused-permit lease',async()=>{
  const short=await createFixture({scopeLifeMs:3200,permitLifeMs:1000});
  try{await isolated(async g=>{
   const w=await installed(g,{leaseMs:500});await g.waitUntil(g.original.scope.valid_until);
   await g.rejected(()=>g.grant(w),/expired unused permit|unchanged scope/);
   await g.activate();assert.equal((await g.rpc('inspect')).reason,'expired');assert.equal((await g.rpc('begin_case')).allowed,false);
   assert.equal(await count(g,'claims'),0);await unchanged(g);
  },short);}finally{await short.close();}
 });

 await test('actual generated owner PRE, POST and terminal reconciliation SQL expose exact protocol and unchanged history',async()=>{
  const g=await createFixture();
  try{
   const variants=prepareOperationalVariants(g.proposal);
   const observe=async name=>{
    await g.owner();const results=await g.db.exec(variants[name]);
    const rows=results.flatMap(r=>r.rows??[]).filter(r=>r.reconciliation);
    assert.equal(rows.length,1);return rows[0].reconciliation;
   };
   const before=await observe('PRE-GRANT-OBSERVATION.sql');
   assert.equal(before.recoveryInstalled,false);assert.equal(before.originalRpcBodySha256,g.proposal.rpcBeforeSha256);
   assert.equal(before.runnerRestricted,true);assert.equal(before.runner.canLogin,false);assert.equal(before.runner.sessions,0);
   assert.equal(before.originalHeldMicroUsd,1506400);assert.equal(before.evaluationHeldMicroUsd,330000);
   assert.deepEqual(before.permit,g.original.permit);assert.deepEqual(before.recoveryPrior,g.original.prior);
   await g.begin();const w=await installed(g);await g.grant(w);await g.db.exec('COMMIT');
   const post=await observe('POST-LEASE-OBSERVATION.sql'),lease=post.executionLease;
   assert.equal(lease.count,1);assert.equal(lease.active,true);assert.equal(lease.rpcBodySha256,g.proposal.rpcAfterSha256);
   assert.equal(lease.owner,'monaco_ledger_owner');assert.equal(lease.securityDefiner,true);
   assert.deepEqual(lease.settings,['search_path=pg_catalog, private']);
   assert.equal(lease.acl,'{monaco_ledger_owner=X/monaco_ledger_owner,monaco_ledger_runner=X/monaco_ledger_owner}');
   assert.equal(Object.keys(lease.helpers).length,3);
   for(const [name,hash] of Object.entries(g.proposal.manifest.helperBodies)){
    const h=lease.helpers[name];assert.equal(h.bodySha256,hash);assert.equal(h.owner,'monaco_ledger_owner');
    assert.equal(h.securityDefiner,true);assert.deepEqual(h.settings,['search_path=pg_catalog, private','TimeZone=UTC']);
    assert.equal(h.acl,'{monaco_ledger_owner=X/monaco_ledger_owner}');
   }
   assert.deepEqual(post.permit,g.original.permit);assert.deepEqual(post.scope,g.original.scope);
   await g.activate();await mandatoryPending(g);await g.rpc('receipt_slot',receiptArgs(caseId,'primary_precision'));
   await g.rpc('finish_case',finishArgs(caseId));await g.inactive();
   const terminal=await observe('RECONCILE-RECOVERED-v2-d002.sql');
   assert.deepEqual(terminal.executionLease,lease);assert.equal(terminal.claimCount,2);assert.equal(terminal.accountCount,2);
   assert.equal(terminal.submissions.length,2);assert.equal(terminal.receipts.length,2);assert.equal(terminal.evaluationHeldMicroUsd,660000);
   assert.equal(terminal.originalHeldMicroUsd,1506400);assert.equal(terminal.unreceiptedSubmissionCount,0);
   assert.equal(terminal.unaccountedClaimCount,0);assert.equal(terminal.runner.canLogin,false);assert.equal(terminal.runner.sessions,0);
   assert.equal(terminal.financiallySettled,false);assert.equal(terminal.actualMicroUsd,null);await unchanged(g);
  }finally{await g.close();}
 });
}finally{await f.close();}
