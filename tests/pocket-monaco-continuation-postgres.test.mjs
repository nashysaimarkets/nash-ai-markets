/** Real disposable localhost PostgreSQL only; synthetic receipts, no provider.
 * Run this file alone, serially, on PG17 using the existing locked pg driver.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {prepareNeonLedgerSql} from '../scripts/prepare-monaco-neon-ledger.mjs';
import {buildContinuationAdmission,CONTINUATION_PINS as P} from '../scripts/prepare-monaco-continuation-admission.mjs';
import {createNeonSqlPort} from '../scripts/pocket-monaco-neon-port.ts';

assert.equal(process.env.MONACO_QA_DISPOSABLE_POSTGRES,'true','Disposable localhost PostgreSQL required');
const {Client}=(await import(pathToFileURL(process.env.MONACO_QA_PG_MODULE))).default;
const base={host:'127.0.0.1',port:5432,user:'postgres',database:'postgres',connectionTimeoutMillis:5000};
const control=new Client(base);await control.connect();
const migration=readFileSync(new URL('../database/neon/20261024-first-six-continuation.sql',import.meta.url),'utf8');
const planBytes=readFileSync(new URL('../docs/monaco-126/internal-diagnostics/FIRST-SIX-PROVIDER-PLAN.json',import.meta.url));
const plan=JSON.parse(planBytes),slots=['main','primary_precision','rescue_precision'];
const n={organizationId:'org-icy-butterfly-11039021',projectId:'bitter-grass-28096464',branchId:'br-aged-mode-zaa9u7lr',
 endpointHost:'ep-silent-fire-za1s230f.c-2.eu-west-2.aws.neon.tech',databaseName:'monaco_ledger',
 roleName:'monaco_ledger_runner',controlPlaneEvidenceSha256:P.controlPlaneSha256};
const originalIdentity={environment:'monaco-first-six-inference',sourceSha:P.originalSourceSha,
 backendRef:P.backendRef,projectRef:P.projectRef,keyTrackingId:P.keyTrackingId,
 keyFingerprintSha256:P.keyFingerprintSha256,planSha256:P.planSha256};
const fingerprint=(id,slot)=>plan.calls.find(c=>c.caseId===id&&c.slot===slot).fingerprint;
const callPlan=slots.map(slot=>({slot,model:'gpt-5-mini-2025-08-07',serviceTier:'default',
 maxOutputTokens:slot==='main'?7000:1400,maxInputTextChars:30000,maxSchemaBytes:30000,maxImages:2,
 maxImageBytes:8000000,maxImageWidth:4096,maxImageHeight:4096,maxImagePixels:33554432,
 maxCostMicroUsd:slot==='main'?114000:102800,costBoundEvidenceRef:'synthetic-existing-frozen-bound'}));
const claimArgs=id=>({p_ledger_key:P.ledgerKey,p_case_id:id,p_project_ref:P.projectRef,
 p_owner_approval_ref:'comment-6165012632',p_candidate_sha:P.candidateSha,p_plan:callPlan});
const receiptArgs=(id,slot,request=`synthetic-request-${id}-${slot}`)=>({p_ledger_key:P.ledgerKey,p_case_id:id,p_slot:slot,
 p_provider_request_id:request,p_response_id:`synthetic-response-${id}-${slot}`,p_model:'gpt-5-mini-2025-08-07',
 p_service_tier:'default',p_usage:{input_tokens:1,output_tokens:1,total_tokens:2},p_envelope_sha256:fingerprint(id,slot)});
async function rpc(client,identity,operation,args){
 return (await client.query('select public.monaco_neon_rpc($1::jsonb,$2::jsonb,$3::text,$4::jsonb) as r',
  [JSON.stringify(n),JSON.stringify(identity),operation,JSON.stringify(args)])).rows[0].r;
}
async function inspect(owner,identity){return (await owner.query('select private.inspect_monaco_isolated_runner($1,$2::jsonb) as r',
 [P.ledgerKey,JSON.stringify(identity)])).rows[0].r;}
async function history(c,{predecessorOnly=false}={}){const out={};for(const table of ['monaco_neon_identity',
 'monaco_runner_binding','monaco_prior_budget','monaco_request_pins','pocket_benchmark_pilot_ledgers',
 'pocket_benchmark_pilot_cases','pocket_benchmark_pilot_calls','pocket_benchmark_budget_accounts','pocket_benchmark_budget_configs']){
 const where=table==='pocket_benchmark_budget_configs'?` where runtime_evidence_sha256='${P.originalBindingEvidenceSha256}'`
  :predecessorOnly&&['pocket_benchmark_pilot_cases','pocket_benchmark_pilot_calls','pocket_benchmark_budget_accounts'].includes(table)
   ?" where case_id='d001'":'';
 out[table]=(await c.query(`select to_jsonb(t) as row from private.${table} t${where} order by to_jsonb(t)::text`)).rows;
 }return out;}
const historicalDigest=async c=>createHash('sha256').update(JSON.stringify(await history(c,{predecessorOnly:true}))).digest('hex');
await control.query('create role monaco_ledger_owner login nosuperuser createrole noinherit nobypassrls');

async function fixture(body,{changedPin=false}={}){
 await control.query('create database monaco_ledger owner monaco_ledger_owner');
 const owner=new Client({...base,user:'monaco_ledger_owner',database:'monaco_ledger'});await owner.connect();
 const clients=[];
 const connect=async()=>{const c=new Client({...base,user:'monaco_ledger_runner',database:'monaco_ledger'});
  await c.connect();clients.push(c);return c;};
 try{
  await owner.query(prepareNeonLedgerSql());
  await owner.query(`insert into private.monaco_neon_identity(singleton,organization_id,project_id,branch_id,endpoint_host,
   database_name,runner_role,control_plane_evidence_sha256,verified_at) values(true,$1,$2,$3,$4,$5,$6,$7,now())`,Object.values(n));
  await owner.query(`insert into private.monaco_runner_binding(ledger_key,backend_ref,environment_name,runner_source_sha,
   project_ref,existing_key_tracking_id,key_fingerprint_sha256,paid_scope_ref,plan_sha256,
   setup_approval_sha256,processor_acceptance_sha256,binding_evidence_sha256)
   values($1,$2,$3,$4,$5,$6,$7,'issue126-6309459418',$8,repeat('c',64),repeat('d',64),$9)`,
   [P.ledgerKey,P.backendRef,originalIdentity.environment,P.originalSourceSha,P.projectRef,P.keyTrackingId,
    P.keyFingerprintSha256,P.planSha256,P.originalBindingEvidenceSha256]);
  await owner.query(`insert into private.pocket_benchmark_pilot_ledgers(ledger_key,cap_microusd,project_ref,owner_approval_ref,
   candidate_sha,rate_tier,pricing_evidence_ref,allowed_case_ids,config_verified_at,enabled)
   values($1,5000000,$2,'comment-6165012632',$3,'default','synthetic-existing-pricing',
   array['d001','d002','d003','d004','d005','d006'],now(),true)`,[P.ledgerKey,P.projectRef,P.candidateSha]);
  await owner.query("insert into private.monaco_prior_budget values(true,0,0,0,true,true,true,'synthetic-original-prior-evidence',repeat('d',64),now())");
  for(const c of plan.calls)await owner.query('insert into private.monaco_request_pins values($1,$2,$3)',
   [c.caseId,c.slot,changedPin&&c.caseId==='d006'&&c.slot==='rescue_precision'?'f'.repeat(64):c.fingerprint]);
  await owner.query(`insert into private.pocket_benchmark_budget_configs(ledger_key,project_ref,candidate_sha,staging_ref,
   key_tracking_id,key_fingerprint_sha256,model,service_tier,pricing_evidence_ref,runtime_evidence_sha256,
   reviewer_ref,verified_at,valid_until) values($1,$2,$3,$4,$5,$6,'gpt-5-mini-2025-08-07','default',
   'synthetic-existing-pricing',$7,'synthetic-original-review',now(),now()+interval '1 hour')`,
   [P.ledgerKey,P.projectRef,P.candidateSha,P.backendRef,P.keyTrackingId,P.keyFingerprintSha256,P.originalBindingEvidenceSha256]);
  await owner.query('alter role monaco_ledger_runner login');
  const predecessor=await connect();
  assert.equal((await rpc(predecessor,originalIdentity,'claim_pocket_benchmark_case',claimArgs('d001'))).allowed,true);
  for(const slot of slots.slice(0,2)){
   await rpc(predecessor,originalIdentity,'submit_pocket_benchmark_call',{
    p_ledger_key:P.ledgerKey,p_case_id:'d001',p_slot:slot,p_envelope_sha256:fingerprint('d001',slot)});
   await rpc(predecessor,originalIdentity,'record_pocket_benchmark_receipt',receiptArgs('d001',slot));
  }
  await rpc(predecessor,originalIdentity,'void_pocket_benchmark_call',{p_ledger_key:P.ledgerKey,p_case_id:'d001',
   p_slot:'rescue_precision',p_reason:'Not dispatched; existing rescue/cancellation predicate'});
  assert.equal((await rpc(predecessor,originalIdentity,'account_pocket_benchmark_reserved_case',{
   p_ledger_key:P.ledgerKey,p_case_id:'d001'})).reserved_microusd,216800);
  await predecessor.end();clients.splice(clients.indexOf(predecessor),1);
  await owner.query('alter role monaco_ledger_runner nologin');
  const originalBinding=(await owner.query('select * from private.monaco_runner_binding')).rows[0];
  const account=(await owner.query('select * from private.pocket_benchmark_budget_accounts')).rows[0];
  const binding={verified:true,...originalIdentity,sourceSha:'a'.repeat(40),ledgerKey:P.ledgerKey,controlPlaneEvidenceSha256:P.controlPlaneSha256};
  const evidence={kind:'MONACO_FIRST_SIX_CONTINUATION_V1',originalSourceSha:P.originalSourceSha,
   originalRunId:P.originalRunId,remainingCaseIds:[...P.remainingCaseIds],priorReceiptSha256:account.receipt_sha256,
   priorCommittedMicroUsd:216800,previousTransportSendAttempts:2,maximumAdditionalSends:15,
   maximumAdditionalExposureMicroUsd:1598000,maximumCombinedSends:17,maximumCombinedExposureMicroUsd:1814800,originalCaseImmutable:true};
  const prepared=buildContinuationAdmission({binding,bindingEvidenceSha256:'c'.repeat(64),evidence,
   authorizationEvidenceSha256:'d'.repeat(64),evidenceSha:'e'.repeat(40),runId:'50000000001',
   carryIn:{observed_at:new Date().toISOString(),runner_can_login:false,runner_sessions:0,cases:1,calls:3,
    original_binding:originalBinding,d001_account:account},planBytes});
  await body({owner,connect,prepared,binding,evidence,account,install:()=>owner.query(migration),
   admit:()=>owner.query(prepared.admissionSql),activate:()=>owner.query(prepared.activationSql)});
 }finally{
  await Promise.all(clients.map(c=>c.end().catch(()=>{})));
  await owner.query('rollback');await owner.query('alter role monaco_ledger_runner nologin');
  await owner.end();await control.query('drop database monaco_ledger');
 }
}

await test('append-only admission preserves original binding/history, scopes the real successor and keeps role privileges',()=>fixture(async f=>{
 const before=await history(f.owner);await f.install();
 await assert.rejects(()=>inspect(f.owner,f.prepared.identity));
 assert.equal((await inspect(f.owner,originalIdentity)).binding_matches,true);
 await f.admit();assert.deepEqual(await history(f.owner),before);
 const result=await inspect(f.owner,f.prepared.identity);
 assert.equal(result.continuation_allowed,true);assert.equal(result.new_commitments_microusd,216800);
 assert.deepEqual(result.continuation_case_ids,[...P.remainingCaseIds]);assert.equal(result.continuation_run_id,'50000000001');
 assert.equal(result.predecessor_source_sha,P.originalSourceSha);assert.equal(result.continuation_source_sha,'a'.repeat(40));
 assert.equal(result.predecessor_run_id,P.originalRunId);assert.equal(result.prior_receipt_sha256,f.account.receipt_sha256);
 assert.equal(result.continuation_evidence_sha,'e'.repeat(40));assert.equal(result.continuation_previous_commitments_microusd,216800);
 assert.equal(typeof result.continuation_valid_until,'string');assert.ok(Number.isFinite(Date.parse(result.continuation_valid_until)));
 assert.equal((await f.owner.query('select count(*)::int as n from private.pocket_benchmark_budget_configs')).rows[0].n,2);
 const access=(await f.owner.query(`select
  has_function_privilege('monaco_ledger_runner','public.monaco_neon_rpc(jsonb,jsonb,text,jsonb)','EXECUTE') as rpc,
  has_function_privilege('monaco_ledger_runner','private.assert_monaco_first_six_continuation(text,jsonb)','EXECUTE') as helper,
  has_table_privilege('monaco_ledger_runner','private.monaco_first_six_continuation','SELECT,INSERT,UPDATE,DELETE') as data`)).rows[0];
 assert.deepEqual(access,{rpc:true,helper:false,data:false});
 await assert.rejects(()=>f.admit());await f.owner.query('rollback');assert.deepEqual(await history(f.owner),before);
 for(const sql of ["update private.monaco_first_six_continuation set successor_source_sha=repeat('f',40)",
  'delete from private.monaco_first_six_continuation','truncate private.monaco_first_six_continuation',
  "update private.monaco_runner_binding set runner_source_sha=repeat('f',40)"]){await assert.rejects(()=>f.owner.query(sql));}
}));
await test('wrong source, evidence, run, attempt, predecessor digest and old-source impersonation refuse',()=>fixture(async f=>{
 await f.install();await f.admit();
 for(const change of [i=>i.sourceSha='f'.repeat(40),i=>i.continuation.evidenceSha='f'.repeat(40),
  i=>i.continuation.runId='50000000002',i=>i.continuation.runAttempt='2',
  i=>i.continuation.priorReceiptSha256='f'.repeat(64),i=>delete i.continuation,
  i=>i.sourceSha=P.originalSourceSha,i=>i.extra='unreviewed']){
  const identity=structuredClone(f.prepared.identity);change(identity);await assert.rejects(()=>inspect(f.owner,identity));
 }
 await assert.rejects(()=>inspect(f.owner,{...originalIdentity,extra:'unreviewed'}));
}));
await test('successor RPC denies predecessor, voided rescue, held-out and missing case targets before mutation',()=>fixture(async f=>{
 await f.install();await f.admit();await f.activate();const runner=await f.connect();const before=await history(f.owner);
 for(const id of ['d001','e001',null]){
  await assert.rejects(()=>rpc(runner,f.prepared.identity,'claim_pocket_benchmark_case',claimArgs(id)));
  await assert.rejects(()=>rpc(runner,f.prepared.identity,'submit_pocket_benchmark_call',{
   p_ledger_key:P.ledgerKey,p_case_id:id,p_slot:'rescue_precision',p_envelope_sha256:fingerprint('d001','rescue_precision')}));
 }
 assert.deepEqual(await history(f.owner),before);
}));
await test('overlapping claims reserve d002 once; unresolved successor receipt blocks d003 and cannot reuse d001 IDs',()=>fixture(async f=>{
 await f.install();await f.admit();await f.activate();const left=await f.connect(),right=await f.connect();
 const claims=await Promise.all([rpc(left,f.prepared.identity,'claim_pocket_benchmark_case',claimArgs('d002')),
  rpc(right,f.prepared.identity,'claim_pocket_benchmark_case',claimArgs('d002'))]);
 assert.equal(claims.filter(c=>c.allowed===true).length,1);assert.equal(claims.filter(c=>c.idempotent===true).length,1);
 assert.equal((await rpc(left,f.prepared.identity,'claim_pocket_benchmark_case',claimArgs('d003'))).reason,'previous_case_unresolved');
 await rpc(left,f.prepared.identity,'submit_pocket_benchmark_call',{p_ledger_key:P.ledgerKey,p_case_id:'d002',p_slot:'main',
  p_envelope_sha256:fingerprint('d002','main')});
 await assert.rejects(()=>rpc(left,f.prepared.identity,'record_pocket_benchmark_receipt',receiptArgs('d002','main','synthetic-request-d001-main')));
 const replay=await rpc(left,f.prepared.identity,'submit_pocket_benchmark_call',{p_ledger_key:P.ledgerKey,p_case_id:'d002',p_slot:'main',
  p_envelope_sha256:fingerprint('d002','main')});assert.equal(replay.claimed,false);
 assert.equal((await inspect(f.owner,f.prepared.identity)).new_commitments_microusd,536400);
 assert.equal((await f.owner.query('select * from private.pocket_benchmark_budget_accounts where case_id=\'d001\'')).rows[0].receipt_sha256,f.account.receipt_sha256);
}));
await test('all five untouched cases progress through the real eight-field Neon port and reach only the original combined bound',()=>fixture(async f=>{
 const beforeDigest=await historicalDigest(f.owner);await f.install();await f.admit();await f.activate();const runner=await f.connect();
 const port=createNeonSqlPort(runner,n,f.prepared.identity);
 const call=async(name,args)=>{const r=await port.rpc(name,args);assert.equal(r.error,null);return r.data;};
 const initial=await call('inspect_monaco_isolated_runner',{p_key:P.ledgerKey,p_identity:f.prepared.identity});
 assert.equal(initial.continuation_allowed,true);assert.equal(initial.continuation_source_sha,f.prepared.identity.sourceSha);
 assert.equal(initial.continuation_run_id,f.prepared.identity.continuation.runId);
 assert.equal(initial.prior_receipt_sha256,f.prepared.identity.continuation.priorReceiptSha256);
 const oversize=claimArgs('d002');oversize.p_plan=structuredClone(oversize.p_plan);oversize.p_plan[2].maxCostMicroUsd++;
 const rejected=await port.rpc('claim_pocket_benchmark_case',oversize);assert.ok(rejected.error);
 assert.equal((await f.owner.query('select count(*)::int as n from private.pocket_benchmark_pilot_cases')).rows[0].n,1);
 for(const [index,id] of P.remainingCaseIds.entries()){
  assert.equal((await call('claim_pocket_benchmark_case',claimArgs(id))).allowed,true);
  for(const slot of slots){
   assert.equal((await call('submit_pocket_benchmark_call',{p_ledger_key:P.ledgerKey,p_case_id:id,p_slot:slot,
    p_envelope_sha256:fingerprint(id,slot)})).claimed,true);
   await call('record_pocket_benchmark_receipt',receiptArgs(id,slot));
  }
  const accounting=await call('account_pocket_benchmark_reserved_case',{p_ledger_key:P.ledgerKey,p_case_id:id});
  assert.equal(accounting.accounted,true);assert.equal(accounting.reserved_microusd,319600);
  assert.equal(accounting.committed_microusd,216800+(index+1)*319600);
 }
 const final=await call('inspect_monaco_isolated_runner',{p_key:P.ledgerKey,p_identity:f.prepared.identity});
 assert.equal(final.new_commitments_microusd,1814800);assert.equal(final.remaining_microusd,3185200);
 const totals=(await f.owner.query(`select count(*)::int as total,count(*) filter(where status='submitted')::int as submitted,
  count(*) filter(where status='voided')::int as voided from private.pocket_benchmark_pilot_calls`)).rows[0];
 assert.deepEqual(totals,{total:18,submitted:17,voided:1});
 assert.equal((await f.owner.query('select count(*)::int as n from private.pocket_benchmark_budget_accounts')).rows[0].n,6);
 for(const id of P.remainingCaseIds)assert.equal((await call('claim_pocket_benchmark_case',claimArgs(id))).allowed,false);
 assert.ok((await port.rpc('claim_pocket_benchmark_case',claimArgs('d007'))).error);
 assert.equal(await historicalDigest(f.owner),beforeDigest);
}));
await test('changed predecessor accounting digest prevents admission without creating a continuation or configuration',()=>fixture(async f=>{
 const before=await history(f.owner);await f.install();
 const changed=f.prepared.admissionSql.replaceAll(f.account.receipt_sha256,'f'.repeat(64));
 assert.notEqual(changed,f.prepared.admissionSql);await assert.rejects(()=>f.owner.query(changed));await f.owner.query('rollback');
 assert.deepEqual(await history(f.owner),before);
 assert.equal((await f.owner.query('select count(*)::int as n from private.monaco_first_six_continuation')).rows[0].n,0);
 assert.equal((await f.owner.query('select count(*)::int as n from private.pocket_benchmark_budget_configs')).rows[0].n,1);
}));
await test('changed frozen pin inventory prevents admission atomically',()=>fixture(async f=>{
 const before=await history(f.owner);await f.install();await assert.rejects(()=>f.admit());await f.owner.query('rollback');
 assert.deepEqual(await history(f.owner),before);
 assert.equal((await f.owner.query('select count(*)::int as n from private.monaco_first_six_continuation')).rows[0].n,0);
 assert.equal((await f.owner.query('select count(*)::int as n from private.pocket_benchmark_budget_configs')).rows[0].n,1);
},{changedPin:true}));
await test('expired continuation configuration refuses even when original credentials and binding still match',()=>fixture(async f=>{
 await f.install();
 const short=f.prepared.admissionSql.replace("CURRENT_TIMESTAMP,CURRENT_TIMESTAMP+INTERVAL '60 minutes'",
  "CURRENT_TIMESTAMP,CURRENT_TIMESTAMP+INTERVAL '1 second'");
 assert.notEqual(short,f.prepared.admissionSql);await f.owner.query(short);
 await f.owner.query('select pg_sleep(1.1)');await assert.rejects(()=>inspect(f.owner,f.prepared.identity));
 await assert.rejects(()=>f.activate());
 assert.equal((await f.owner.query("select rolcanlogin from pg_roles where rolname='monaco_ledger_runner'")).rows[0].rolcanlogin,false);
}));
await control.query('drop role monaco_ledger_runner');await control.query('drop role monaco_ledger_owner');await control.end();
