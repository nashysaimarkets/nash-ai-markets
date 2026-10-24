/** Real PostgreSQL17, disposable localhost only. No hosted DB/provider access. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createEvaluationSqlPort,createEvaluationLedgerBridge,validateEvaluationIdentity} from '../scripts/pocket-scanner-evaluation-v2-bridge.mjs';
import {prepareNeonLedgerSql} from '../scripts/prepare-monaco-neon-ledger.mjs';
import {admissionFixture,buildEvaluationV2Admission,P,plan} from './support/pocket-scanner-evaluation-v2-ledger-fixture.mjs';
assert.equal(process.env.MONACO_QA_DISPOSABLE_POSTGRES,'true','Disposable localhost PostgreSQL required');
assert.ok(process.env.MONACO_QA_PG_MODULE,'Locked pg module required');
const {Client}=(await import(pathToFileURL(process.env.MONACO_QA_PG_MODULE))).default;
const base={host:'127.0.0.1',port:5432,user:'postgres',database:'postgres',connectionTimeoutMillis:5000};
const control=new Client(base);await control.connect();
assert.match((await control.query('show server_version')).rows[0].server_version,/^17\./);
const migration=readFileSync(new URL('../database/neon/proposed/20261024-scanner-evaluation-v2.sql',import.meta.url),'utf8');
const oldPlan=JSON.parse(readFileSync(new URL('../docs/monaco-126/internal-diagnostics/FIRST-SIX-PROVIDER-PLAN.json',import.meta.url),'utf8'));
const n={organizationId:'org-icy-butterfly-11039021',projectId:'bitter-grass-28096464',branchId:'br-aged-mode-zaa9u7lr',
 endpointHost:'ep-silent-fire-za1s230f.c-2.eu-west-2.aws.neon.tech',databaseName:'monaco_ledger',roleName:'monaco_ledger_runner',controlPlaneEvidenceSha256:P.controlPlaneSha256};
const oldIdentity={environment:'monaco-first-six-inference',sourceSha:P.originalSourceSha,backendRef:P.backendRef,projectRef:P.projectRef,
 keyTrackingId:P.keyTrackingId,keyFingerprintSha256:P.keyFingerprintSha256,planSha256:P.planSha256};
const oldFp=(id,slot)=>oldPlan.calls.find(c=>c.caseId===id&&c.slot===slot).fingerprint;
const oldCallPlan=P.slotNames.map(slot=>({slot,model:'gpt-5-mini-2025-08-07',serviceTier:'default',maxOutputTokens:slot==='main'?7000:1400,
 maxInputTextChars:30000,maxSchemaBytes:30000,maxImages:2,maxImageBytes:8000000,maxImageWidth:4096,maxImageHeight:4096,maxImagePixels:33554432,
 maxCostMicroUsd:slot==='main'?114000:102800,costBoundEvidenceRef:'synthetic-original-bound'}));
const rpc=async(c,identity,op,args={},neon=n)=>(await c.query('select public.monaco_scanner_evaluation_v2_rpc($1::jsonb,$2::jsonb,$3,$4::jsonb) as r',
 [JSON.stringify(neon),JSON.stringify(identity),op,JSON.stringify(args)])).rows[0].r;
const oldRpc=async(c,op,args)=>(await c.query('select public.monaco_neon_rpc($1::jsonb,$2::jsonb,$3,$4::jsonb) as r',
 [JSON.stringify(n),JSON.stringify(oldIdentity),op,JSON.stringify(args)])).rows[0].r;
const row=(id,slot)=>plan.cases.find(c=>c.caseId===id).calls.find(c=>c.slot===slot);
const submitArgs=(id,slot)=>{const r=row(id,slot);return {slot,requestId:r.requestId,fingerprint:r.fingerprint,requestSha256:r.requestSha256};};
const receiptArgs=(id,slot)=>({slot,requestId:row(id,slot).requestId,providerRequestId:`synthetic-v2-request-${id}-${slot}`,
 responseId:`synthetic-v2-response-${id}-${slot}`,model:'gpt-5-mini-2025-08-07',serviceTier:'default',usage:{input_tokens:1,output_tokens:1,total_tokens:2},responseSha256:'f'.repeat(64)});
const finishArgs=id=>({diagnosticSha256:'a'.repeat(64),diagnosticArtifactId:String(97000000000+Number(id.at(-1)))});
await control.query('create role monaco_ledger_owner login nosuperuser createrole noinherit nobypassrls');

async function fixture(body){
 await control.query('create database monaco_ledger owner monaco_ledger_owner');
 const owner=new Client({...base,user:'monaco_ledger_owner',database:'monaco_ledger'});await owner.connect();
 const clients=new Set();
 const connect=async()=>{const c=new Client({...base,user:'monaco_ledger_runner',database:'monaco_ledger'});await c.connect();clients.add(c);return c;};
 const close=async c=>{await c.end();clients.delete(c);};
 try{
  await owner.query(prepareNeonLedgerSql());
  await owner.query(`insert into private.monaco_neon_identity(singleton,organization_id,project_id,branch_id,endpoint_host,database_name,runner_role,control_plane_evidence_sha256,verified_at)
   values(true,$1,$2,$3,$4,$5,$6,$7,now())`,Object.values(n));
  await owner.query(`insert into private.monaco_runner_binding(ledger_key,backend_ref,environment_name,runner_source_sha,project_ref,existing_key_tracking_id,key_fingerprint_sha256,paid_scope_ref,plan_sha256,setup_approval_sha256,processor_acceptance_sha256,binding_evidence_sha256)
   values($1,$2,$3,$4,$5,$6,$7,'issue126-6309459418',$8,repeat('c',64),repeat('d',64),$9)`,
   [P.ledgerKey,P.backendRef,oldIdentity.environment,P.originalSourceSha,P.projectRef,P.keyTrackingId,P.keyFingerprintSha256,P.planSha256,P.originalBindingEvidenceSha256]);
  await owner.query(`insert into private.pocket_benchmark_pilot_ledgers(ledger_key,cap_microusd,project_ref,owner_approval_ref,candidate_sha,rate_tier,pricing_evidence_ref,allowed_case_ids,config_verified_at,enabled)
   values($1,5000000,$2,'comment-6165012632',$3,'default','synthetic-original-pricing',array['d001','d002','d003','d004','d005','d006'],now(),true)`,[P.ledgerKey,P.projectRef,P.candidateSha]);
  await owner.query("insert into private.monaco_prior_budget values(true,0,0,0,true,true,true,'synthetic-original-prior',repeat('d',64),now())");
  for(const c of oldPlan.calls)await owner.query('insert into private.monaco_request_pins values($1,$2,$3)',[c.caseId,c.slot,c.fingerprint]);
  await owner.query(`insert into private.pocket_benchmark_budget_configs(ledger_key,project_ref,candidate_sha,staging_ref,key_tracking_id,key_fingerprint_sha256,model,service_tier,pricing_evidence_ref,runtime_evidence_sha256,reviewer_ref,verified_at,valid_until)
   values($1,$2,$3,$4,$5,$6,'gpt-5-mini-2025-08-07','default','synthetic-original-pricing',$7,'synthetic-original-review',now(),now()+interval '2 hours')`,
   [P.ledgerKey,P.projectRef,P.candidateSha,P.backendRef,P.keyTrackingId,P.keyFingerprintSha256,P.originalBindingEvidenceSha256]);
  await owner.query('alter role monaco_ledger_runner login');const old=await connect();
  for(const id of ['d001','d002','d003','d004','d005','d006']){
   assert.equal((await oldRpc(old,'claim_pocket_benchmark_case',{p_ledger_key:P.ledgerKey,p_case_id:id,p_project_ref:P.projectRef,p_owner_approval_ref:'comment-6165012632',p_candidate_sha:P.candidateSha,p_plan:oldCallPlan})).allowed,true);
   for(const slot of P.slotNames){
    const baseArgs={p_ledger_key:P.ledgerKey,p_case_id:id,p_slot:slot};
    if(slot==='rescue_precision'&&!['d004','d005'].includes(id))await oldRpc(old,'void_pocket_benchmark_call',{...baseArgs,p_reason:'Not dispatched; existing rescue/cancellation predicate'});
    else{
     await oldRpc(old,'submit_pocket_benchmark_call',{...baseArgs,p_envelope_sha256:oldFp(id,slot)});
     await oldRpc(old,'record_pocket_benchmark_receipt',{...baseArgs,p_provider_request_id:`synthetic-old-request-${id}-${slot}`,p_response_id:`synthetic-old-response-${id}-${slot}`,
      p_model:'gpt-5-mini-2025-08-07',p_service_tier:'default',p_usage:{input_tokens:1,output_tokens:1,total_tokens:2},p_envelope_sha256:oldFp(id,slot)});
    }
   }
   await oldRpc(old,'account_pocket_benchmark_reserved_case',{p_ledger_key:P.ledgerKey,p_case_id:id});
  }
  await close(old);await owner.query('alter role monaco_ledger_runner nologin');
  await owner.query(migration);
  const digest=async()=>(await owner.query('select private.monaco_scanner_eval_v2_original_digest() as h')).rows[0].h;
  const before=await digest(),config=admissionFixture({carryIn:{originalHistorySha256:before}}),prepared=buildEvaluationV2Admission(config);
  const admit=()=>owner.query(prepared.admissionSql);
  const activate=()=>owner.query('alter role monaco_ledger_runner login');
  const inactive=async()=>{await Promise.all([...clients].map(close));await owner.query('alter role monaco_ledger_runner nologin');};
  const next=async id=>{
   await inactive();const prev='v2-d00'+String(Number(id.at(-1))-1);
   const receipt=(await owner.query('select receipt_sha256 from private.monaco_scanner_eval_v2_accounts where case_id=$1',[prev])).rows[0]?.receipt_sha256;
   const c=admissionFixture({caseId:id,previousCaseReceiptSha256:receipt,carryIn:{originalHistorySha256:before}});
   c.approval=config.approval;const r=buildEvaluationV2Admission(c);await owner.query(r.admissionSql);await activate();return {prepared:r,runner:await connect()};
  };
  await body({owner,connect,close,admit,activate,inactive,next,digest,before,config,prepared});
 }finally{
  await Promise.all([...clients].map(c=>c.end().catch(()=>{})));await owner.query('rollback');await owner.query('alter role monaco_ledger_runner nologin');
  await owner.end();await control.query('drop database monaco_ledger');
 }
}
async function complete(runner,identity,{rescue=false}={}){
 const id=identity.evaluation.caseId;
 for(const slot of P.slotNames.slice(0,rescue?3:2)){
  assert.equal((await rpc(runner,identity,'submit_slot',submitArgs(id,slot))).claimed,true);
  assert.equal((await rpc(runner,identity,'receipt_slot',receiptArgs(id,slot))).status,'receipted');
 }
 return rpc(runner,identity,'finish_case',finishArgs(id));
}

await test('new admission preserves original history and privileges, and refuses resets',()=>fixture(async f=>{
 await f.admit();assert.equal(await f.digest(),f.before);
 const p=(await f.owner.query(`select has_table_privilege('monaco_ledger_runner','private.monaco_scanner_eval_v2_claims','INSERT,UPDATE,DELETE,SELECT') as data,
 has_function_privilege('monaco_ledger_runner','private.monaco_scanner_eval_v2_assert_original(text)','EXECUTE') as helper,
 has_function_privilege('monaco_ledger_runner','public.monaco_scanner_evaluation_v2_rpc(jsonb,jsonb,text,jsonb)','EXECUTE') as rpc,
 has_function_privilege('monaco_ledger_runner','public.monaco_neon_rpc(jsonb,jsonb,text,jsonb)','EXECUTE') as original_rpc`)).rows[0];
 assert.deepEqual(p,{data:false,helper:false,rpc:true,original_rpc:true});
 await assert.rejects(()=>f.admit());await f.owner.query('rollback');
 for(const sql of ['delete from private.monaco_scanner_eval_v2_scopes','truncate private.monaco_scanner_eval_v2_pins',"update private.monaco_scanner_eval_v2_scopes set approval_ref='comment-88888888888'"])
  await assert.rejects(()=>f.owner.query(sql));
 await f.activate();const r=await f.connect();
 assert.deepEqual(validateEvaluationIdentity(f.prepared.identity),f.prepared.identity);
 const bridge=createEvaluationLedgerBridge(createEvaluationSqlPort(r,n,f.prepared.identity),f.prepared.identity);
 const state=await bridge.inspect();
 assert.equal(state.allowed,true);assert.equal(state.originalCommitmentsMicroUsd,1506400);assert.equal(state.remainingMicroUsd,3493600);
 await assert.rejects(()=>r.query('select * from private.monaco_scanner_eval_v2_pins'));
 assert.equal(await f.digest(),f.before);
}));
await test('wrong approval, source, plan, key, run, case, project and extra fields never claim',()=>fixture(async f=>{
 await f.admit();await f.activate();const r=await f.connect();
 for(const change of [i=>i.sourceSha='f'.repeat(40),i=>i.planSha256='f'.repeat(64),i=>i.keyFingerprintSha256='f'.repeat(64),
  i=>i.projectRef='proj_other',i=>i.evaluation.approvalRef='comment-6165012632',i=>i.evaluation.caseId='d001',
  i=>i.evaluation.sourceCaseId='d007',i=>i.evaluation.runId='40086015008',i=>i.evaluation.runAttempt='2',
  i=>i.evaluation.jobId='1',i=>i.evaluation.wrapperSha='f'.repeat(40),i=>i.evaluation.extra=true]){
  const i=structuredClone(f.prepared.identity);change(i);await assert.rejects(()=>rpc(r,i,'begin_case'));
 }
 await assert.rejects(()=>rpc(r,f.prepared.identity,'begin_case',{}, {...n,projectId:'other'}));
 assert.equal((await f.owner.query('select count(*)::int as n from private.monaco_scanner_eval_v2_claims')).rows[0].n,0);
}));
await test('concurrent same-case claims reserve once and duplicate submissions can never resend',()=>fixture(async f=>{
 await f.admit();await f.activate();const a=await f.connect(),b=await f.connect(),i=f.prepared.identity;
 const claims=await Promise.all([rpc(a,i,'begin_case'),rpc(b,i,'begin_case')]);assert.equal(claims.filter(x=>x.allowed).length,1);
 const submissions=await Promise.all([rpc(a,i,'submit_slot',submitArgs('v2-d001','main')),rpc(b,i,'submit_slot',submitArgs('v2-d001','main'))]);
 assert.equal(submissions.filter(x=>x.claimed).length,1);
 const state=await rpc(a,i,'inspect');assert.equal(state.evaluationCommitmentsMicroUsd,330000);assert.equal(state.aggregateCommittedMicroUsd,1836400);
 assert.equal(state.slots.find(x=>x.slot==='main').status,'submitted');
 await assert.rejects(()=>rpc(a,i,'finish_case',finishArgs('v2-d001')));
 await assert.rejects(()=>rpc(a,i,'submit_slot',submitArgs('v2-d001','primary_precision')));
 assert.equal(await f.digest(),f.before);
}));
await test('different concurrent cases cannot overlap or inherit a premature operator permit',()=>fixture(async f=>{
 await f.admit();
 const nextConfig=admissionFixture({caseId:'v2-d002',previousCaseReceiptSha256:'f'.repeat(64),carryIn:{originalHistorySha256:f.before}});
 nextConfig.approval=f.config.approval;const next=buildEvaluationV2Admission(nextConfig);
 // Adversarial synthetic owner-seeded permit: claims must enforce sequencing
 // even if a privileged caller bypasses the offline admission builder.
 await f.owner.query(`insert into private.monaco_scanner_eval_v2_permits(scope_id,case_id,attempt_id,identity,admission_evidence_sha256,reassessment_evidence_sha256,previous_case_receipt_sha256,admitted_at,valid_until)
 select scope_id,'v2-d002','v2-d002-attempt-1',$1::jsonb,admission_evidence_sha256,reassessment_evidence_sha256,repeat('f',64),admitted_at,valid_until
 from private.monaco_scanner_eval_v2_permits where case_id='v2-d001'`,[JSON.stringify(next.identity)]);
 await f.activate();const a=await f.connect(),b=await f.connect();
 const claims=await Promise.all([rpc(a,f.prepared.identity,'begin_case'),rpc(b,next.identity,'begin_case')]);
 assert.equal(claims[0].allowed,true);assert.equal(claims[1].allowed,false);assert.equal(claims[1].reason,'previous_case_unresolved');
 await complete(a,f.prepared.identity);
 assert.equal((await rpc(b,next.identity,'begin_case')).allowed,false,'an earlier permit cannot stand in for reassessment of the completed preceding case');
 assert.equal((await rpc(a,f.prepared.identity,'inspect')).evaluationCommitmentsMicroUsd,330000);
}));
await test('receipts bind exact submitted requests, reject old receipt reuse and remain idempotent under concurrency',()=>fixture(async f=>{
 await f.admit();await f.activate();const a=await f.connect(),b=await f.connect(),i=f.prepared.identity;
 await rpc(a,i,'begin_case');await rpc(a,i,'submit_slot',submitArgs('v2-d001','main'));
 for(const patch of [{providerRequestId:'synthetic-old-request-d001-main'},{responseId:'synthetic-old-response-d001-main'},
  {requestId:row('v2-d002','main').requestId},{model:'other'},{usage:{input_tokens:1,output_tokens:7001,total_tokens:7002}},
  {usage:{input_tokens:1,output_tokens:1,total_tokens:5}},{responseSha256:'bad'},{responseSha256:null},{responseId:null},{providerRequestId:null},{model:null},{serviceTier:null},{usage:null},{requestId:null}])
  await assert.rejects(()=>rpc(a,i,'receipt_slot',{...receiptArgs('v2-d001','main'),...patch}));
 const replies=await Promise.all([rpc(a,i,'receipt_slot',receiptArgs('v2-d001','main')),rpc(b,i,'receipt_slot',receiptArgs('v2-d001','main'))]);
 assert.equal(replies.filter(x=>x.idempotent).length,1);
 await assert.rejects(()=>rpc(a,i,'receipt_slot',{...receiptArgs('v2-d001','main'),responseSha256:'b'.repeat(64)}),/conflict/);
 assert.equal((await f.owner.query('select count(*)::int as n from private.monaco_scanner_eval_v2_receipts')).rows[0].n,1);
}));
await test('revocation stops new submissions while genuine late receipts and held reservations survive',()=>fixture(async f=>{
 await f.admit();await f.activate();const r=await f.connect(),i=f.prepared.identity;
 await rpc(r,i,'begin_case');await rpc(r,i,'submit_slot',submitArgs('v2-d001','main'));
 await f.owner.query("insert into private.monaco_scanner_eval_v2_revocations values($1,'scope',repeat('f',64),clock_timestamp())",[P.scopeId]);
 assert.equal((await rpc(r,i,'inspect')).reason,'revoked');
 assert.equal((await rpc(r,i,'receipt_slot',receiptArgs('v2-d001','main'))).status,'receipted');
 await assert.rejects(()=>rpc(r,i,'submit_slot',submitArgs('v2-d001','primary_precision')));
 assert.equal((await rpc(r,i,'stop_case',{reason:'CANCELLED'})).status,'stopped');
 assert.equal((await rpc(r,i,'inspect')).evaluationCommitmentsMicroUsd,330000);
 await assert.rejects(()=>f.next('v2-d002'));
}));
await test('late diagnostic accounting after revocation retains full reservation and cannot authorise another send',()=>fixture(async f=>{
 await f.admit();await f.activate();const r=await f.connect(),i=f.prepared.identity;
 await rpc(r,i,'begin_case');
 for(const slot of ['main','primary_precision']){
  await rpc(r,i,'submit_slot',submitArgs('v2-d001',slot));await rpc(r,i,'receipt_slot',receiptArgs('v2-d001',slot));
 }
 await f.owner.query("insert into private.monaco_scanner_eval_v2_revocations values($1,'scope',repeat('f',64),clock_timestamp())",[P.scopeId]);
 await assert.rejects(()=>rpc(r,i,'finish_case',{diagnosticSha256:null,diagnosticArtifactId:'1'}));
 const final=await rpc(r,i,'finish_case',finishArgs('v2-d001'));
 assert.equal(final.status,'completed');assert.equal(final.reservedMicroUsd,330000);assert.equal(final.financiallySettled,false);
 await assert.rejects(()=>rpc(r,i,'submit_slot',submitArgs('v2-d001','rescue_precision')));
 assert.equal((await rpc(r,i,'stop_case',{reason:'ACCOUNTING_ACK_UNKNOWN'})).status,'completed');
}));
await test('expired permit cannot begin or dispatch and no caller can replace its runtime identity',()=>fixture(async f=>{
 const c=structuredClone(f.config);c.planBytes=f.config.planBytes;c.attempt.validUntil=new Date(Date.now()+1800).toISOString();
 const p=buildEvaluationV2Admission(c);await f.owner.query(p.admissionSql);await f.activate();const r=await f.connect();
 await rpc(r,p.identity,'begin_case');await rpc(r,p.identity,'submit_slot',submitArgs('v2-d001','main'));
 await f.owner.query('select pg_sleep(1.9)');
 assert.equal((await rpc(r,p.identity,'inspect')).reason,'expired');
 await rpc(r,p.identity,'receipt_slot',receiptArgs('v2-d001','main'));
 await assert.rejects(()=>rpc(r,p.identity,'submit_slot',submitArgs('v2-d001','primary_precision')));
 assert.equal((await rpc(r,p.identity,'begin_case')).allowed,false);
}));
await test('every new case needs separate reassessment; all six keep330000 each and original1506400 unchanged',()=>fixture(async f=>{
 await f.admit();await f.activate();let runner=await f.connect(),p=f.prepared;
 for(const [index,id] of P.caseIds.entries()){
  if(index){const next=await f.next(id);runner=next.runner;p=next.prepared;}
  assert.equal((await rpc(runner,p.identity,'begin_case')).allowed,true);
  const final=await complete(runner,p.identity,{rescue:index===3});
  assert.equal(final.status,'completed');assert.equal(final.financiallySettled,false);assert.equal(final.actualMicroUsd,null);
  assert.equal(final.reservedMicroUsd,330000);assert.equal(final.aggregateCommittedMicroUsd,1506400+(index+1)*330000);
  assert.equal((await rpc(runner,p.identity,'finish_case',finishArgs(id))).idempotent,true);
  assert.equal((await rpc(runner,p.identity,'begin_case')).allowed,false);
  assert.equal(await f.digest(),f.before);
 }
 const final=await rpc(runner,p.identity,'inspect');assert.equal(final.aggregateCommittedMicroUsd,3486400);assert.equal(final.remainingMicroUsd,1513600);
 const counts=(await f.owner.query(`select (select count(*)::int from private.monaco_scanner_eval_v2_accounts) as accounts,
 (select sum(reserved_microusd)::int from private.monaco_scanner_eval_v2_claims) as held,
 (select count(*)::int from private.monaco_scanner_eval_v2_accounts where unused_rescue_voided) as voided`)).rows[0];
 assert.deepEqual(counts,{accounts:6,held:1980000,voided:5});
}));
await test('unknown submission or interrupted diagnostic accounting blocks every later permit without refund',()=>fixture(async f=>{
 await f.admit();await f.activate();const r=await f.connect(),i=f.prepared.identity;
 await rpc(r,i,'begin_case');await rpc(r,i,'submit_slot',submitArgs('v2-d001','main'));
 await rpc(r,i,'stop_case',{reason:'TRANSPORT_OUTCOME_UNKNOWN'});
 await assert.rejects(()=>rpc(r,i,'finish_case',finishArgs('v2-d001')));
 await assert.rejects(()=>f.next('v2-d002'));
 const counts=(await f.owner.query('select count(*)::int as n,sum(reserved_microusd)::int as held from private.monaco_scanner_eval_v2_claims')).rows[0];
 assert.deepEqual(counts,{n:1,held:330000});assert.equal(await f.digest(),f.before);
}));
await test('v2 claim holds original allowance lock so a racing old cost increase must recheck combined cap',()=>fixture(async f=>{
 await f.admit();await f.activate();const r=await f.connect(),i=f.prepared.identity;
 await r.query('begin');await rpc(r,i,'begin_case');
 let finished=false;
 const increase=f.owner.query("update private.pocket_benchmark_pilot_calls set actual_microusd=3314000 where case_id='d001' and slot='main'")
  .then(()=>{finished=true;return null;},error=>{finished=true;return error;});
 await new Promise(resolve=>setTimeout(resolve,100));assert.equal(finished,false,'old cost update waits for shared parent allowance lock');
 await r.query('commit');const error=await increase;assert.match(error?.message??'',/aggregate cap/);
 assert.equal((await rpc(r,i,'inspect')).aggregateCommittedMicroUsd,1836400);assert.equal(await f.digest(),f.before);
}));
await test('old cost update first serializes ahead of v2 and changed original evidence prevents a claim',()=>fixture(async f=>{
 await f.admit();await f.activate();const r=await f.connect(),i=f.prepared.identity;
 await f.owner.query('begin');await f.owner.query("update private.pocket_benchmark_pilot_calls set actual_microusd=3314000 where case_id='d001' and slot='main'");
 let finished=false;const claim=rpc(r,i,'begin_case').then(value=>{finished=true;return value;},error=>{finished=true;return error;});
 await new Promise(resolve=>setTimeout(resolve,100));assert.equal(finished,false,'new claim waits for original accounting');
 await f.owner.query('commit');const denied=await claim;assert.match(denied.message??'',/Original six-case/);
 assert.equal((await f.owner.query('select count(*)::int as n from private.monaco_scanner_eval_v2_claims')).rows[0].n,0);
}));
await test('malformed future approval SQL and changed original request/history cannot be admitted',()=>fixture(async f=>{
 const bad=f.prepared.admissionSql.replaceAll('POCKET_SCANNER_EVALUATION_V2_EXTENSION_APPROVAL','HOLD_NOT_APPROVED');
 await assert.rejects(()=>f.owner.query(bad));await f.owner.query('rollback');
 assert.equal((await f.owner.query('select count(*)::int as n from private.monaco_scanner_eval_v2_scopes')).rows[0].n,0);
 const changed=f.prepared.admissionSql.replaceAll(f.before,'f'.repeat(64));
 await assert.rejects(()=>f.owner.query(changed));await f.owner.query('rollback');assert.equal(await f.digest(),f.before);
}));
await control.query('drop role monaco_ledger_runner');await control.query('drop role monaco_ledger_owner');await control.end();
