/** Existing node:test + PGlite harness; synthetic data, local disposable DB only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createIsolatedLedgerBridge,loadFrozenRunnerPlan,FROZEN_PLAN_SHA256,type RunnerIdentity} from '../scripts/pocket-monaco-runner-bridge.ts';
const modulePath=process.env.MONACO_RUNNER_QA_PGLITE_MODULE;
assert.ok(modulePath&&isAbsolute(modulePath)&&modulePath.endsWith('/@electric-sql/pglite/dist/index.js'),'Explicit existing local PGlite required');
const {PGlite}=await import(pathToFileURL(modulePath!).href);
const {pgcrypto}=await import(pathToFileURL(join(modulePath!,'../contrib/pgcrypto.js')).href);
const root=new URL('../',import.meta.url);
const baseSql=readFileSync(new URL('supabase/migrations/20261014113000_pocket_benchmark_pilot.sql',root),'utf8');
const extension=readFileSync(new URL('supabase/proposed/monaco-isolated-runner.sql',root),'utf8').replace("existing_key_tracking_id='key_EjND5GXtuqF2K0hp'","existing_key_tracking_id='key_aD5pc20EZBLGECNC'");
const plan=loadFrozenRunnerPlan();
const identity:RunnerIdentity={environment:'monaco-first-six-inference',sourceSha:'a'.repeat(40),backendRef:'q'.repeat(20),
 projectRef:'proj_LTmAIE2Ve7gUAFJ9M74ZxIBI',keyTrackingId:'key_aD5pc20EZBLGECNC',keyFingerprintSha256:'b'.repeat(64),planSha256:FROZEN_PLAN_SHA256};
const ledger='monaco-first-six-aggregate';
const functions:Record<string,string[]>={inspect_monaco_isolated_runner:['p_key','p_identity'],
 claim_pocket_benchmark_case:['p_ledger_key','p_case_id','p_project_ref','p_owner_approval_ref','p_candidate_sha','p_plan'],
 submit_pocket_benchmark_call:['p_ledger_key','p_case_id','p_slot','p_envelope_sha256'],
 record_pocket_benchmark_receipt:['p_ledger_key','p_case_id','p_slot','p_provider_request_id','p_response_id','p_model','p_service_tier','p_usage','p_envelope_sha256'],
 void_pocket_benchmark_call:['p_ledger_key','p_case_id','p_slot','p_reason'],account_pocket_benchmark_reserved_case:['p_ledger_key','p_case_id']};
let db:any;
let calls=0;
const port={rpc:async(name:string,args:Record<string,unknown>)=>{
 assert.ok(functions[name]);calls++;
 await db.exec('savepoint rpc; set local role service_role');
 try{const values=functions[name].map(k=>typeof args[k]==='object'?JSON.stringify(args[k]):args[k]);
  const out=await db.query(`select public.${name}(${values.map((_,i)=>'$'+(i+1)).join(',')}) as result`,values);
  await db.exec('reset role; release savepoint rpc');return {data:out.rows[0].result,error:null};
 }catch(e:any){await db.exec('rollback to savepoint rpc; reset role; release savepoint rpc');return {data:null,error:e.message};}
}};
const bridge=()=>createIsolatedLedgerBridge(port,ledger,identity);
async function initialize(path?:string){
 const instance=new PGlite({dataDir:path,extensions:{pgcrypto}});
 await instance.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema private;grant usage on schema private to service_role;create schema extensions;create extension pgcrypto with schema extensions;");
 await instance.exec(baseSql);await instance.exec(extension);return instance;
}
async function seed(prior:number|null=0,options:{backend?:string;partial?:boolean}={}){
 await db.query(`insert into private.monaco_runner_binding
  (ledger_key,backend_ref,environment_name,runner_source_sha,project_ref,existing_key_tracking_id,key_fingerprint_sha256,
   paid_scope_ref,plan_sha256,setup_approval_sha256,processor_acceptance_sha256,binding_evidence_sha256)
  values($1,$2,$3,$4,$5,$6,$7,'issue126-6309459418',$8,$9,$9,$9)`,
  [ledger,options.backend??identity.backendRef,identity.environment,identity.sourceSha,identity.projectRef,identity.keyTrackingId,identity.keyFingerprintSha256,FROZEN_PLAN_SHA256,'c'.repeat(64)]);
 await db.query(`insert into private.pocket_benchmark_pilot_ledgers
  (ledger_key,cap_microusd,project_ref,owner_approval_ref,candidate_sha,rate_tier,pricing_evidence_ref,allowed_case_ids,config_verified_at,enabled)
  values($1,5000000,$2,'comment-6165012632',$3,'default','synthetic-pricing-evidence',array['d001','d002','d003','d004','d005','d006'],now(),true)`,
  [ledger,identity.projectRef,plan.scannerCandidateSha]);
 if(prior!==null)await db.query(`insert into private.monaco_prior_budget values(true,$1,0,0,true,true,true,'SYNTHETIC-ONLY-budget-evidence',$2,now())`,[prior,'d'.repeat(64)]);
 for(const c of plan.calls.slice(0,options.partial?17:18))await db.query('insert into private.monaco_request_pins values($1,$2,$3)',[c.caseId,c.slot,c.fingerprint]);
 await db.query(`insert into private.pocket_benchmark_budget_configs
  (ledger_key,project_ref,candidate_sha,staging_ref,key_tracking_id,key_fingerprint_sha256,model,service_tier,pricing_evidence_ref,runtime_evidence_sha256,reviewer_ref,verified_at,valid_until)
  values($1,$2,$3,$4,$5,$6,'gpt-5-mini-2025-08-07','default','synthetic-pricing-evidence',$7,'SYNTHETIC-QA',now(),now()+interval '1 hour')`,
  [ledger,identity.projectRef,plan.scannerCandidateSha,identity.backendRef,identity.keyTrackingId,identity.keyFingerprintSha256,'e'.repeat(64)]);
}
async function check(name:string,run:()=>Promise<void>){await test(name,async()=>{await db.exec('begin');calls=0;try{await run();}finally{await db.exec('rollback');}});}
const fixtureReceipt=(id:string)=>({requestId:'mock-req-'+id,responseId:'mock-resp-'+id,model:plan.model,serviceTier:'default',usage:{input_tokens:1,output_tokens:1,total_tokens:2}});
db=await initialize();
await check('empty installed proposal denies before any case reservation',async()=>{await assert.rejects(()=>bridge().claim('d001'));assert.equal((await db.query('select count(*)::int as n from private.pocket_benchmark_pilot_cases')).rows[0].n,0);});
await check('missing prior budget remains unknown and blocks, never zero',async()=>{await seed(null);await assert.rejects(()=>bridge().claim('d001'));});
await check('maximum permitted prior exposure includes all 18 reservations',async()=>{await seed(3082400);const r=await bridge().claim('d001');assert.equal(r.budget.remaining_microusd,1598000);assert.equal(r.claim.allowed,true);assert.equal('remaining_microusd' in r.claim,false);});
await check('one microdollar too much prior exposure blocks whole run',async()=>{await seed(3082401);await assert.rejects(()=>bridge().claim('d001'));assert.equal((await db.query('select count(*)::int as n from private.pocket_benchmark_pilot_calls')).rows[0].n,0);});
await check('shared-live project cannot be seeded',async()=>{await assert.rejects(()=>seed(0,{backend:'pxlqvaddvghjjhenqmdh'}));});
await check('partial frozen request inventory cannot admit a run',async()=>{await seed(0,{partial:true});await assert.rejects(()=>bridge().claim('d001'));});
await check('wrong runtime key/source/backend identity fails before claim',async()=>{await seed();for(const field of ['keyFingerprintSha256','sourceSha','backendRef'] as const){const changed={...identity,[field]:field==='sourceSha'?'f'.repeat(40):field==='backendRef'?'w'.repeat(20):'f'.repeat(64)};await assert.rejects(()=>createIsolatedLedgerBridge(port,ledger,changed).claim('d001'));}});
await check('previous inference key is rejected locally',async()=>{assert.throws(()=>createIsolatedLedgerBridge(port,ledger,{...identity,keyTrackingId:'key_EjND5GXtuqF2K0hp'}));assert.equal(calls,0);});
await check('old metadata-only key is rejected locally',async()=>{assert.throws(()=>createIsolatedLedgerBridge(port,ledger,{...identity,keyTrackingId:'key_WQtXX6p9qXaV7yrJ'}));assert.equal(calls,0);});
await check('extra credential-shaped fields never enter an RPC payload',async()=>{assert.throws(()=>createIsolatedLedgerBridge(port,ledger,{...identity,apiKey:'SYNTHETIC-NOT-A-SECRET'} as RunnerIdentity));assert.equal(calls,0);});
await check('unknown inspector output cannot lead to a reservation',async()=>{let n=0;const bad={rpc:async()=>{n++;return{data:{},error:null};}};await assert.rejects(()=>createIsolatedLedgerBridge(bad,ledger,identity).claim('d001'));assert.equal(n,1);});
await check('raw client failure text cannot leak through the bridge',async()=>{const bad={rpc:async()=>{throw Error('SYNTHETIC-SENSITIVE-CLIENT-DETAIL');}};await assert.rejects(()=>createIsolatedLedgerBridge(bad,ledger,identity).inspect(),(e:Error)=>!e.message.includes('SYNTHETIC-SENSITIVE')&&e.message.includes('retain reservation'));});
await check('second chart waits for unresolved first chart',async()=>{await seed();assert.equal((await bridge().claim('d001')).claim.allowed,true);const r=await bridge().claim('d002');assert.equal(r.claim.reason,'previous_case_unresolved');});
await check('duplicate first-six claims do not create fresh allowance',async()=>{await seed();await bridge().claim('d001');const r=await bridge().claim('d001');assert.equal(r.claim.idempotent,true);assert.equal((await db.query('select count(*)::int as n from private.pocket_benchmark_pilot_calls')).rows[0].n,3);});
await check('held-out case rejected without database calls',async()=>{await assert.rejects(()=>bridge().claim('e001'));assert.equal(calls,0);});
await check('wrong request hash rejected before submit and by SQL bypass path',async()=>{await seed();await bridge().claim('d001');await assert.rejects(()=>bridge().submit('d001','main','0'.repeat(64)));const r=await port.rpc('submit_pocket_benchmark_call',{p_ledger_key:ledger,p_case_id:'d001',p_slot:'main',p_envelope_sha256:'0'.repeat(64)});assert.ok(r.error);});
await check('lost submit acknowledgement retains submitted reservation, never retries',async()=>{await seed();await bridge().claim('d001');let submits=0;const lost={rpc:async(n:string,a:Record<string,unknown>)=>{const r=await port.rpc(n,a);if(n==='submit_pocket_benchmark_call'){submits++;throw Error('mock lost acknowledgement');}return r;}};
 const b=createIsolatedLedgerBridge(lost,ledger,identity);await assert.rejects(()=>b.submit('d001','main',plan.calls.find(c=>c.caseId==='d001'&&c.slot==='main')!.fingerprint));assert.equal(submits,1);assert.equal((await db.query("select status from private.pocket_benchmark_pilot_calls where case_id='d001' and slot='main'")).rows[0].status,'submitted');
 await assert.rejects(()=>bridge().voidUnused('d001','main'));assert.equal((await bridge().claim('d002')).claim.reason,'previous_case_unresolved');});
await check('immutable receipt recovery and reservation accounting reuse existing SQL',async()=>{await seed(1000000);const b=bridge();await b.claim('d001');for(const slot of ['main','primary_precision'] as const){await b.submit('d001',slot,plan.calls.find(c=>c.caseId==='d001'&&c.slot===slot)!.fingerprint);await b.recordReceipt('d001',slot,fixtureReceipt(slot));}
 await b.recordReceipt('d001','main',fixtureReceipt('main'));await assert.rejects(()=>b.recordReceipt('d001','main',fixtureReceipt('conflict')));await b.voidUnused('d001','rescue_precision');await b.account('d001');const next=await b.claim('d002');assert.equal(next.claim.allowed,true);assert.equal(next.budget.prior_exposure_microusd,1000000);assert.equal(next.budget.financially_settled,false);});
await check('runtime roles cannot fabricate carry-in evidence or reset it',async()=>{await seed();for(const role of ['anon','authenticated','service_role']){const row=await db.query("select has_table_privilege($1,'private.monaco_prior_budget','INSERT') as allowed",[role]);assert.equal(row.rows[0].allowed,false);}
 for(const sql of ['update private.monaco_prior_budget set spent_microusd=0','delete from private.monaco_prior_budget','truncate private.monaco_prior_budget cascade']){await db.exec('savepoint attempt');await assert.rejects(()=>db.exec(sql));await db.exec('rollback to savepoint attempt');}});
await check('declared approvals or completed mocks cannot enable provider dispatch',async()=>{await seed();assert.throws(()=>bridge().dispatch(),/DISABLED/);});
await check('larger settled cost cannot omit prior exposure from its cap check',async()=>{await seed(3082400);await bridge().claim('d001');await assert.rejects(()=>db.exec("update private.pocket_benchmark_pilot_calls set actual_microusd=2000000 where case_id='d001' and slot='main'"),/combined prior/);});
await db.close();
await test('durable SQL close/reopen preserves unknown submissions and denies replay',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'monaco-runner-sql-'));try{
 db=await initialize(dir);await db.exec('begin');await seed(500000);const b=bridge();await b.claim('d001');await b.submit('d001','main',plan.calls.find(c=>c.caseId==='d001'&&c.slot==='main')!.fingerprint);await db.exec('commit');await db.close();
 db=new PGlite({dataDir:dir,extensions:{pgcrypto}});await db.exec('begin');const duplicate=await bridge().claim('d001');assert.equal(duplicate.claim.idempotent,true);assert.equal(duplicate.budget.prior_exposure_microusd,500000);assert.equal((await bridge().claim('d002')).claim.reason,'previous_case_unresolved');await db.exec('rollback');await db.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});
