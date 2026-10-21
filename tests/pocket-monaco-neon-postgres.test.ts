/** Real independent PostgreSQL sessions, only disposable localhost PG17.
 * No Neon/cloud credentials, charts, provider traffic, or ledger allowances. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {prepareNeonLedgerSql} from '../scripts/prepare-monaco-neon-ledger.mjs';
import {createNeonSqlPort,validateNeonIdentity,type NeonIdentity} from '../scripts/pocket-monaco-neon-port.ts';
import {createIsolatedLedgerBridge,loadFrozenRunnerPlan,FROZEN_PLAN_SHA256} from '../scripts/pocket-monaco-runner-bridge.ts';
assert.equal(process.env.MONACO_QA_DISPOSABLE_POSTGRES,'true','Disposable local PostgreSQL only');
const {Client}=(await import(pathToFileURL(process.env.MONACO_QA_PG_MODULE!).href)).default;
const config={host:'127.0.0.1',port:5432,user:'postgres',database:'postgres',connectionTimeoutMillis:5000};
const control=new Client(config);await control.connect();
const plan=loadFrozenRunnerPlan();let serial=0;
const ledger='monaco-first-six-aggregate';
const fp=(id:string,slot:string)=>plan.calls.find(c=>c.caseId===id&&c.slot===slot)!.fingerprint;
async function fixture(prior:number|null=0){
 const db='monaco_neon_qa_'+(++serial);await control.query(`create database ${db}`);
 const admin=new Client({...config,database:db});await admin.connect();
 await admin.query(prepareNeonLedgerSql());
 const n:NeonIdentity={organizationId:'org-synthetic-qa',projectId:'synthetic-qa-project',branchId:'br-synthetic-qa',
  endpointHost:'ep-synthetic-qa.eu-west-2.aws.neon.tech',databaseName:db,roleName:'monaco_ledger_runner',controlPlaneEvidenceSha256:'1'.repeat(64)};
 const identity={environment:'monaco-first-six-inference',sourceSha:'a'.repeat(40),backendRef:validateNeonIdentity(n),
  projectRef:'proj_LTmAIE2Ve7gUAFJ9M74ZxIBI',keyTrackingId:'key_EjND5GXtuqF2K0hp',keyFingerprintSha256:'b'.repeat(64),planSha256:FROZEN_PLAN_SHA256};
 const connections:any[]=[];
 const connect=async()=>{const c=new Client({...config,database:db,user:'monaco_ledger_runner'});await c.connect();connections.push(c);return c;};
 const bridge=(c:any,other=identity)=>createIsolatedLedgerBridge(createNeonSqlPort(c,n,other),ledger,other);
 async function seed(){
  await admin.query(`insert into private.monaco_neon_identity(singleton,organization_id,project_id,branch_id,endpoint_host,database_name,runner_role,control_plane_evidence_sha256,verified_at)
   values(true,$1,$2,$3,$4,$5,$6,$7,now())`,Object.values(n));
  await admin.query(`insert into private.monaco_runner_binding(ledger_key,backend_ref,environment_name,runner_source_sha,project_ref,existing_key_tracking_id,key_fingerprint_sha256,
   paid_scope_ref,plan_sha256,setup_approval_sha256,processor_acceptance_sha256,binding_evidence_sha256)
   values($1,$2,$3,$4,$5,$6,$7,'issue126-6309459418',$8,$9,$9,$9)`,
   [ledger,identity.backendRef,identity.environment,identity.sourceSha,identity.projectRef,identity.keyTrackingId,identity.keyFingerprintSha256,FROZEN_PLAN_SHA256,'c'.repeat(64)]);
  await admin.query(`insert into private.pocket_benchmark_pilot_ledgers(ledger_key,cap_microusd,project_ref,owner_approval_ref,candidate_sha,rate_tier,pricing_evidence_ref,allowed_case_ids,config_verified_at,enabled)
   values($1,5000000,$2,'comment-6165012632',$3,'default','synthetic-pricing-evidence',array['d001','d002','d003','d004','d005','d006'],now(),true)`,[ledger,identity.projectRef,plan.scannerCandidateSha]);
  if(prior!==null)await admin.query(`insert into private.monaco_prior_budget values(true,$1,0,0,true,true,true,'SYNTHETIC-ONLY-budget-evidence',$2,now())`,[prior,'d'.repeat(64)]);
  for(const c of plan.calls)await admin.query('insert into private.monaco_request_pins values($1,$2,$3)',[c.caseId,c.slot,c.fingerprint]);
  await admin.query(`insert into private.pocket_benchmark_budget_configs(ledger_key,project_ref,candidate_sha,staging_ref,key_tracking_id,key_fingerprint_sha256,model,service_tier,pricing_evidence_ref,runtime_evidence_sha256,reviewer_ref,verified_at,valid_until)
   values($1,$2,$3,$4,$5,$6,'gpt-5-mini-2025-08-07','default','synthetic-pricing-evidence',$7,'SYNTHETIC-QA',now(),now()+interval '1 hour')`,[ledger,identity.projectRef,plan.scannerCandidateSha,identity.backendRef,identity.keyTrackingId,identity.keyFingerprintSha256,'e'.repeat(64)]);
 }
 await admin.query('alter role monaco_ledger_runner login'); // Only local trust-auth QA; never hosted setup.
 return {admin,n,identity,bridge,connect,seed,close:async()=>{await Promise.all(connections.map(c=>c.end().catch(()=>{})));await admin.end();await control.query(`drop database ${db}`);}};
}
const count=async(f:any,table:string)=>Number((await f.admin.query(`select count(*) as n from private.${table}`)).rows[0].n);
async function run(name:string,body:(f:any)=>Promise<void>,prior:number|null=0){
 await test(name,async()=>{const f=await fixture(prior);try{await body(f);}finally{await f.close();}});
}
await run('empty installed ledger cannot reserve and never assumes unused budget',async f=>{
 const b=f.bridge(await f.connect());await assert.rejects(()=>b.claim('d001'));assert.equal(await count(f,'pocket_benchmark_pilot_calls'),0);
},null);
// Individual tests own a fresh disposable database; none resets a real allowance.
await run('missing carry-in remains unknown after verified Neon schema binding',async f=>{await f.seed();const b=f.bridge(await f.connect());await assert.rejects(()=>b.claim('d001'));assert.equal(await count(f,'pocket_benchmark_pilot_calls'),0);},null);
await run('exact aggregate cap boundary includes carry-in and all18 request reservations',async f=>{await f.seed();const r=await f.bridge(await f.connect()).claim('d001');assert.equal(r.claim.allowed,true);assert.equal(r.budget.remaining_microusd,1598000);},3082400);
await run('one microdollar above permitted carry-in rejects atomically',async f=>{await f.seed();const b=f.bridge(await f.connect());await assert.rejects(()=>b.claim('d001'));assert.equal(await count(f,'pocket_benchmark_pilot_cases'),0);assert.equal(await count(f,'pocket_benchmark_pilot_calls'),0);},3082401);
await run('runtime role has no table, schema creation, membership or private function privileges',async f=>{
 const c=await f.connect();for(const sql of ['select * from private.monaco_prior_budget','insert into private.monaco_prior_budget values(true,0,0,0,true,true,true,\'false evidence\',repeat(\'a\',64),now())','create table public.attack(x int)','set role postgres',"select private.monaco_budget_state('x')","select public.settle_pocket_benchmark_call('x','d001','main',0,'x')"]){await assert.rejects(()=>c.query(sql));}
 const r=(await f.admin.query("select rolsuper,rolcreatedb,rolcreaterole,rolinherit,rolreplication,rolbypassrls from pg_roles where rolname='monaco_ledger_runner'")).rows[0];assert.ok(Object.values(r).every(v=>v===false));
});
await run('concurrent duplicate claims create exactly one case and three reservations',async f=>{await f.seed();const a=f.bridge(await f.connect()),b=f.bridge(await f.connect());const r=await Promise.all([a.claim('d001'),b.claim('d001')]);assert.equal(r.filter((x:any)=>x.claim.allowed===true).length,1);assert.equal(await count(f,'pocket_benchmark_pilot_cases'),1);assert.equal(await count(f,'pocket_benchmark_pilot_calls'),3);});
await run('concurrent different charts cannot bypass one-chart outstanding exposure lock',async f=>{await f.seed();const a=f.bridge(await f.connect()),b=f.bridge(await f.connect());const r=await Promise.all([a.claim('d001'),b.claim('d002')]);assert.equal(r.filter((x:any)=>x.claim.allowed===true).length,1);assert.equal(r.filter((x:any)=>x.claim.reason==='previous_case_unresolved').length,1);});
await run('concurrent submit owns exactly one provider dispatch entitlement',async f=>{await f.seed();const a=f.bridge(await f.connect()),b=f.bridge(await f.connect());await a.claim('d001');const r=await Promise.all([a.submit('d001','main',fp('d001','main')),b.submit('d001','main',fp('d001','main'))]);assert.equal(r.filter((x:any)=>x.claimed===true).length,1);});
await run('crashed connection rolls back uncommitted atomic reservation',async f=>{await f.seed();const c=await f.connect();await c.query('begin');await f.bridge(c).claim('d001');await c.end();assert.equal(await count(f,'pocket_benchmark_pilot_calls'),0);assert.equal((await f.bridge(await f.connect()).claim('d001')).claim.allowed,true);});
await run('committed unknown submission survives connection crash and denies retry or void',async f=>{await f.seed();const c=await f.connect(),b=f.bridge(c);await b.claim('d001');await b.submit('d001','main',fp('d001','main'));await c.end();const recovered=f.bridge(await f.connect());assert.equal((await recovered.submit('d001','main',fp('d001','main'))).claimed,false);await assert.rejects(()=>recovered.voidUnused('d001','main'));assert.equal((await recovered.claim('d002')).claim.reason,'previous_case_unresolved');});
await run('immutable prior exposure and receipt resist reset even through admin DML',async f=>{await f.seed();const b=f.bridge(await f.connect());await b.claim('d001');await b.submit('d001','main',fp('d001','main'));
 const receipt={requestId:'qa-req',responseId:'qa-resp',model:plan.model,serviceTier:'default',usage:{input_tokens:1,output_tokens:1,total_tokens:2}};
 await b.recordReceipt('d001','main',receipt);await b.recordReceipt('d001','main',receipt);await assert.rejects(()=>b.recordReceipt('d001','main',{...receipt,responseId:'different'}));
 for(const sql of ['delete from private.monaco_prior_budget','truncate private.monaco_prior_budget cascade',"update private.monaco_prior_budget set spent_microusd=0",'delete from private.pocket_benchmark_pilot_calls',"update private.pocket_benchmark_pilot_calls set provider_response_id='changed' where receipt_recorded_at is not null"]){await assert.rejects(()=>f.admin.query(sql));}
},1000000);
await run('unknown or fabricated project/branch/database/key identity cannot reserve',async f=>{await f.seed();const c=await f.connect();for(const key of ['branchId','projectId','databaseName','controlPlaneEvidenceSha256']){const n={...f.n,[key]:key==='controlPlaneEvidenceSha256'?'2'.repeat(64):key==='branchId'?'br-wrong':'wrong'};const id={...f.identity,backendRef:validateNeonIdentity(n)};await assert.rejects(()=>createIsolatedLedgerBridge(createNeonSqlPort(c,n,id),ledger,id).claim('d001'));}assert.equal(await count(f,'pocket_benchmark_pilot_calls'),0);});
await run('raw response and chart payload storage paths are denied by SQL',async f=>{await f.seed();const c=await f.connect(),b=f.bridge(c);await b.claim('d001');await b.submit('d001','main',fp('d001','main'));
 await assert.rejects(()=>f.admin.query("update private.pocket_benchmark_pilot_cases set measurement='{\"prompt\":\"forbidden\"}'::jsonb"));
 const port=createNeonSqlPort(c,f.n,f.identity);const r=await port.rpc('record_pocket_benchmark_receipt',{p_ledger_key:ledger,p_case_id:'d001',p_slot:'main',p_provider_request_id:'qa-req',p_response_id:'qa-resp',p_model:plan.model,p_service_tier:'default',p_usage:{input_tokens:1,output_tokens:1,total_tokens:2,raw_response:'forbidden'},p_envelope_sha256:fp('d001','main')});assert.ok(r.error);
});
await run('aggregate cap applies to larger actual costs; no second allowance or held-out run',async f=>{await f.seed();const b=f.bridge(await f.connect());await b.claim('d001');await assert.rejects(()=>f.admin.query("update private.pocket_benchmark_pilot_calls set actual_microusd=2000000 where slot='main'"));await assert.rejects(()=>b.claim('e001'));await assert.rejects(()=>f.admin.query("insert into private.pocket_benchmark_pilot_ledgers select 'second-allowance',cap_microusd,project_ref,owner_approval_ref,candidate_sha,rate_tier,pricing_evidence_ref,allowed_case_ids,config_verified_at,enabled,created_at from private.pocket_benchmark_pilot_ledgers"));},3082400);
await control.end();
