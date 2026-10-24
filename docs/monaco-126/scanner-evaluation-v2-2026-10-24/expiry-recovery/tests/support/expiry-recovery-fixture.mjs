/** Disposable, synthetic-only ledger fixture. Executes the accepted SQL unchanged.
 * PGlite uses one local WASM connection: this proves SQL/role/state behavior,
 * not hosted authentication, TLS, PG17 compatibility or concurrent sessions.
 */
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {prepareNeonLedgerSql} from '../../../../scanner-evaluation-v2/scripts/prepare-monaco-neon-ledger.mjs';
import {admissionFixture,buildEvaluationV2Admission,P as L,plan} from '../../../../scanner-evaluation-v2/tests/support/pocket-scanner-evaluation-v2-ledger-fixture.mjs';
import {buildRecoveryProposal,ownerAmendmentBody,ownerApprovalPrompt,P as R} from '../../recovery-builder.mjs';

export const acceptedRoot=resolve(fileURLToPath(new URL('../../../../scanner-evaluation-v2/',import.meta.url)));
const packageRoot=process.env.POCKET_QA_PGLITE_ROOT??'/workspace/scratch/29e2bd9f5a5a/qa-tools/node_modules/@electric-sql/pglite';
const {PGlite}=await import(pathToFileURL(join(packageRoot,'dist/index.js')));
const {pgcrypto}=await import(pathToFileURL(join(packageRoot,'dist/contrib/pgcrypto.js')));
const migration=readFileSync(join(acceptedRoot,'database/neon/proposed/20261024-scanner-evaluation-v2.sql'),'utf8');
const oldPlan=JSON.parse(readFileSync(join(acceptedRoot,'docs/monaco-126/internal-diagnostics/FIRST-SIX-PROVIDER-PLAN.json'),'utf8'));
const n={organizationId:'org-icy-butterfly-11039021',projectId:'bitter-grass-28096464',branchId:'br-aged-mode-zaa9u7lr',
 endpointHost:'ep-silent-fire-za1s230f.c-2.eu-west-2.aws.neon.tech',databaseName:'monaco_ledger',roleName:'monaco_ledger_runner',controlPlaneEvidenceSha256:L.controlPlaneSha256};
const oldIdentity={environment:'monaco-first-six-inference',sourceSha:L.originalSourceSha,backendRef:L.backendRef,projectRef:L.projectRef,
 keyTrackingId:L.keyTrackingId,keyFingerprintSha256:L.keyFingerprintSha256,planSha256:L.planSha256};
const oldCallPlan=L.slotNames.map(slot=>({slot,model:'gpt-5-mini-2025-08-07',serviceTier:'default',maxOutputTokens:slot==='main'?7000:1400,
 maxInputTextChars:30000,maxSchemaBytes:30000,maxImages:2,maxImageBytes:8000000,maxImageWidth:4096,maxImageHeight:4096,maxImagePixels:33554432,
 maxCostMicroUsd:slot==='main'?114000:102800,costBoundEvidenceRef:'synthetic-original-bound'}));
export const sha=x=>createHash('sha256').update(x).digest('hex');
export const row=(id,slot)=>plan.cases.find(c=>c.caseId===id).calls.find(c=>c.slot===slot);
export const submitArgs=(id,slot)=>{const r=row(id,slot);return {slot,requestId:r.requestId,fingerprint:r.fingerprint,requestSha256:r.requestSha256};};
export const receiptArgs=(id,slot)=>({slot,requestId:row(id,slot).requestId,providerRequestId:`synthetic-request-${id}-${slot}`,
 responseId:`synthetic-response-${id}-${slot}`,model:'gpt-5-mini-2025-08-07',serviceTier:'default',
 usage:{input_tokens:1,output_tokens:1,total_tokens:2},responseSha256:'f'.repeat(64)});
export const finishArgs=id=>({diagnosticSha256:'a'.repeat(64),diagnosticArtifactId:String(97000000000+Number(id.at(-1)))});

export async function createFixture({scopeLifeMs=3600000,permitLifeMs=1000,waitForPermitExpiry=true,beforePermitExpiry}={}){
 const trace=stage=>{if(process.env.POCKET_QA_TRACE==='1')console.log('# fixture: '+stage);};
 const dataDir=await mkdtemp(join(tmpdir(),'pocket-unused-lease-pglite-'));
 let db=new PGlite({dataDir,extensions:{pgcrypto}});
 try{
  trace('create isolated owner/database');
  await db.exec('CREATE ROLE monaco_ledger_owner LOGIN NOSUPERUSER CREATEROLE NOINHERIT NOBYPASSRLS');
  await db.exec('CREATE DATABASE monaco_ledger OWNER monaco_ledger_owner');
  await db.close();
  db=new PGlite({dataDir,database:'monaco_ledger',extensions:{pgcrypto}});
  const owner=async()=>db.exec('RESET SESSION AUTHORIZATION; SET SESSION AUTHORIZATION monaco_ledger_owner');
  const runner=async()=>db.exec('RESET SESSION AUTHORIZATION; SET SESSION AUTHORIZATION monaco_ledger_runner');
  const ownerQuery=async(sql,args=[])=>{await owner();return db.query(sql,args);};
  const ownerExec=async sql=>{await owner();return db.exec(sql);};
  const inactive=async()=>ownerExec('ALTER ROLE monaco_ledger_runner NOLOGIN');
  const activate=async()=>ownerExec('ALTER ROLE monaco_ledger_runner LOGIN');
  const call=async(identity,op,args={},neon=n)=>{await runner();return (await db.query(
   'SELECT public.monaco_scanner_evaluation_v2_rpc($1::jsonb,$2::jsonb,$3,$4::jsonb) AS r',
   [JSON.stringify(neon),JSON.stringify(identity),op,JSON.stringify(args)])).rows[0].r;};
  const oldRpc=async(op,args)=>{await runner();return (await db.query(
   'SELECT public.monaco_neon_rpc($1::jsonb,$2::jsonb,$3,$4::jsonb) AS r',
   [JSON.stringify(n),JSON.stringify(oldIdentity),op,JSON.stringify(args)])).rows[0].r;};
  await owner();await db.exec("SET timezone='UTC'");
  trace('install accepted old ledger');
  await db.exec(prepareNeonLedgerSql());
  trace('seed exact synthetic physical identity and original budget');
  await db.query(`INSERT INTO private.monaco_neon_identity(singleton,organization_id,project_id,branch_id,endpoint_host,database_name,runner_role,control_plane_evidence_sha256,verified_at)
   VALUES(true,$1,$2,$3,$4,$5,$6,$7,now())`,Object.values(n));
  await db.query(`INSERT INTO private.monaco_runner_binding(ledger_key,backend_ref,environment_name,runner_source_sha,project_ref,existing_key_tracking_id,key_fingerprint_sha256,paid_scope_ref,plan_sha256,setup_approval_sha256,processor_acceptance_sha256,binding_evidence_sha256)
   VALUES($1,$2,$3,$4,$5,$6,$7,'issue126-6309459418',$8,repeat('c',64),repeat('d',64),$9)`,
   [L.ledgerKey,L.backendRef,oldIdentity.environment,L.originalSourceSha,L.projectRef,L.keyTrackingId,L.keyFingerprintSha256,L.planSha256,L.originalBindingEvidenceSha256]);
  await db.query(`INSERT INTO private.pocket_benchmark_pilot_ledgers(ledger_key,cap_microusd,project_ref,owner_approval_ref,candidate_sha,rate_tier,pricing_evidence_ref,allowed_case_ids,config_verified_at,enabled)
   VALUES($1,5000000,$2,'comment-6165012632',$3,'default','synthetic-original-pricing',array['d001','d002','d003','d004','d005','d006'],now(),true)`,[L.ledgerKey,L.projectRef,L.candidateSha]);
  await db.exec("INSERT INTO private.monaco_prior_budget VALUES(true,0,0,0,true,true,true,'synthetic-original-prior',repeat('d',64),now())");
  for(const c of oldPlan.calls)await db.query('INSERT INTO private.monaco_request_pins VALUES($1,$2,$3)',[c.caseId,c.slot,c.fingerprint]);
  await db.query(`INSERT INTO private.pocket_benchmark_budget_configs(ledger_key,project_ref,candidate_sha,staging_ref,key_tracking_id,key_fingerprint_sha256,model,service_tier,pricing_evidence_ref,runtime_evidence_sha256,reviewer_ref,verified_at,valid_until)
   VALUES($1,$2,$3,$4,$5,$6,'gpt-5-mini-2025-08-07','default','synthetic-original-pricing',$7,'synthetic-original-review',now(),now()+interval '2 hours')`,
   [L.ledgerKey,L.projectRef,L.candidateSha,L.backendRef,L.keyTrackingId,L.keyFingerprintSha256,L.originalBindingEvidenceSha256]);
  await activate();
  trace('complete original six through actual RPC');
  for(const id of ['d001','d002','d003','d004','d005','d006']){
   assert.equal((await oldRpc('claim_pocket_benchmark_case',{p_ledger_key:L.ledgerKey,p_case_id:id,p_project_ref:L.projectRef,p_owner_approval_ref:'comment-6165012632',p_candidate_sha:L.candidateSha,p_plan:oldCallPlan})).allowed,true);
   for(const slot of L.slotNames){
    const base={p_ledger_key:L.ledgerKey,p_case_id:id,p_slot:slot};
    if(slot==='rescue_precision'&&!['d004','d005'].includes(id))await oldRpc('void_pocket_benchmark_call',{...base,p_reason:'Not dispatched; existing rescue/cancellation predicate'});
    else{
     const fingerprint=oldPlan.calls.find(c=>c.caseId===id&&c.slot===slot).fingerprint;
     await oldRpc('submit_pocket_benchmark_call',{...base,p_envelope_sha256:fingerprint});
     await oldRpc('record_pocket_benchmark_receipt',{...base,p_provider_request_id:`synthetic-old-request-${id}-${slot}`,p_response_id:`synthetic-old-response-${id}-${slot}`,
      p_model:'gpt-5-mini-2025-08-07',p_service_tier:'default',p_usage:{input_tokens:1,output_tokens:1,total_tokens:2},p_envelope_sha256:fingerprint});
    }
   }
   await oldRpc('account_pocket_benchmark_reserved_case',{p_ledger_key:L.ledgerKey,p_case_id:id});
  }
  await inactive();await db.exec(migration);
  trace('installed accepted v2 migration');
  const digest=async()=>(await ownerQuery('SELECT private.monaco_scanner_eval_v2_original_digest() AS h')).rows[0].h;
  const originalDigest=await digest(),now=Date.now();
  const config=admissionFixture({carryIn:{originalHistorySha256:originalDigest},now});
  config.runtimeSourceSha=R.source;config.approval.runtimeSourceSha=R.source;config.approval.approvalRef=R.oldRef;
  config.approval.validUntil=new Date(now+scopeLifeMs).toISOString();
  config.attempt.validUntil=new Date(now+Math.min(scopeLifeMs,600000)).toISOString();
  const first=buildEvaluationV2Admission(config);await db.exec(first.admissionSql);
  trace('complete synthetic v2-d001');
  await activate();assert.equal((await call(first.identity,'begin_case')).allowed,true);
  for(const slot of L.slotNames){
   assert.equal((await call(first.identity,'submit_slot',submitArgs('v2-d001',slot))).claimed,true);
   assert.equal((await call(first.identity,'receipt_slot',receiptArgs('v2-d001',slot))).status,'receipted');
  }
  assert.equal((await call(first.identity,'finish_case',finishArgs('v2-d001'))).status,'completed');
  await inactive();
  const priorReceipt=(await db.query("SELECT receipt_sha256 FROM private.monaco_scanner_eval_v2_accounts WHERE case_id='v2-d001'")).rows[0].receipt_sha256;
  const permitNow=Date.now(),next=admissionFixture({caseId:R.case,previousCaseReceiptSha256:priorReceipt,carryIn:{originalHistorySha256:originalDigest},now:permitNow});
  next.runtimeSourceSha=R.source;next.approval=config.approval;
  Object.assign(next.attempt,{evidenceSha:R.evidence,wrapperSha:R.wrapper,runId:R.run,jobId:R.job,validUntil:new Date(permitNow+permitLifeMs).toISOString()});
  const prepared=buildEvaluationV2Admission(next);await db.exec(prepared.admissionSql);
  trace('admitted exact d002 fixture, measuring proposal');
  const snapshot=async()=>{
   const result=(await ownerQuery(`SELECT jsonb_build_object(
    'scope',(SELECT to_jsonb(s) FROM private.monaco_scanner_eval_v2_scopes s),
    'permit',(SELECT to_jsonb(p) FROM private.monaco_scanner_eval_v2_permits p WHERE case_id='v2-d002'),
    'prior',jsonb_build_object(
     'permit',(SELECT to_jsonb(p) FROM private.monaco_scanner_eval_v2_permits p WHERE case_id='v2-d001'),
     'claim',(SELECT to_jsonb(c) FROM private.monaco_scanner_eval_v2_claims c WHERE case_id='v2-d001'),
     'account',(SELECT to_jsonb(a) FROM private.monaco_scanner_eval_v2_accounts a WHERE case_id='v2-d001'),
     'submissions',(SELECT jsonb_agg(to_jsonb(d) ORDER BY slot) FROM private.monaco_scanner_eval_v2_submissions d WHERE case_id='v2-d001'),
     'receipts',(SELECT jsonb_agg(to_jsonb(r) ORDER BY slot) FROM private.monaco_scanner_eval_v2_receipts r WHERE case_id='v2-d001'),
     'pins',(SELECT jsonb_agg(to_jsonb(p) ORDER BY case_id,slot) FROM private.monaco_scanner_eval_v2_pins p))) AS r`)).rows[0].r;
   return {...result,originalDigest:await digest()};
  };
  const original=await snapshot();
  const installedObservation=(await db.query(`SELECT prosrc AS body,encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex') AS body_sha256,
   pg_get_userbyid(proowner) AS owner,prosecdef AS security_definer,proconfig AS settings,proacl::text AS acl
   FROM pg_proc WHERE oid='public.monaco_scanner_evaluation_v2_rpc(jsonb,jsonb,text,jsonb)'::regprocedure`)).rows[0];
  const proposal=buildRecoveryProposal({acceptedRoot,installedObservation});
  const fixture={db,dataDir,owner,runner,ownerQuery,ownerExec,inactive,activate,digest,original,originalDigest,prepared,proposal,
   identity:prepared.identity,rpc:(op,args={},identity=prepared.identity,neon=n)=>call(identity,op,args,neon),snapshot,
   async close(){await db.close();await rm(dataDir,{recursive:true,force:true});},
   async waitUntil(iso){await delay(Math.max(0,Date.parse(iso)-Date.now()+30));},
   async rollback(){await db.exec('ROLLBACK');await owner();},
   async begin(){await owner();await db.exec('BEGIN');},
   async rejected(fn,pattern){
    await db.exec('SAVEPOINT expected_rejection');let thrown;
    try{await fn();}catch(error){thrown=error;}
    await db.exec('ROLLBACK TO SAVEPOINT expected_rejection; RELEASE SAVEPOINT expected_rejection');
    assert.ok(thrown,'Expected actual SQL rejection');assert.match(thrown.code??'',/^[0-9A-Z]{5}$/,'Must be a database SQLSTATE, not a fixture assertion');
    if(pattern)assert.match(thrown.message,pattern);return thrown;
   },
   async witness({leaseMs=600000}={}){
    const {scope,permit,prior}=await snapshot(),stamp=new Date().toISOString();
    const requestText=ownerApprovalPrompt(proposal.proposalSha256),ownerResponseText='Yes';
    const decisionPins={proposalSha256:proposal.proposalSha256,approvalRequestSha256:sha(requestText),ownerResponseSha256:sha(ownerResponseText)};
    const body=ownerAmendmentBody(decisionPins);
    const amendment={kind:'POCKET_SCANNER_EVALUATION_V2_UNUSED_PERMIT_RECOVERY_AMENDMENT',approvedBy:'OWNER',
     approvalRef:'https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-99999999999',
     approvalBodySha256:sha(body),approvedAt:stamp,...decisionPins,targetIdentity:permit.identity,
     originalPermit:permit,originalScope:scope,previousCaseReceiptSha256:permit.previous_case_receipt_sha256,
     maximumLeases:1,maximumLeaseSeconds:3600,maximumLoginSeconds:1200,retries:0,caseBoundMicroUsd:330000,aggregateCapMicroUsd:5000000};
    return {scope_id:R.scope,case_id:R.case,attempt_id:R.attempt,original_scope:scope,original_permit:permit,prior_evidence:prior,
     original_history_sha256:originalDigest,amendment,
     owner_comment:{url:amendment.approvalRef,author:'nashysaimarkets',createdAt:stamp,body},
     owner_decision:{decision:'APPROVED',requestText,ownerResponseText,recordedAt:stamp},proposal_sha256:proposal.proposalSha256,
     review_evidence_sha256:'1'.repeat(64),pending_evidence_sha256:'2'.repeat(64),pending_observed_at:stamp,
     ledger_evidence_sha256:'3'.repeat(64),ledger_observed_at:stamp,valid_until:new Date(Date.now()+leaseMs).toISOString()};
   },
   async authorize(w){await owner();await db.query("SELECT set_config('monaco.unused_lease_amendment',$1,true),set_config('monaco.unused_lease_proposal_sha256',$2,true)",[JSON.stringify(w.amendment),w.proposal_sha256]);},
   async install(w){await fixture.authorize(w);await db.exec(proposal.installSql);},
   async grant(w){await fixture.authorize(w);return fixture.insertLease(w);},
   async insertLease(w){
    const columns=Object.keys(w);assert.ok(columns.every(c=>/^[a-z_][a-z_0-9]*$/.test(c)));
    const args=Object.values(w).map(v=>v&&typeof v==='object'?JSON.stringify(v):v);
    return db.query(`INSERT INTO private.monaco_scanner_eval_v2_unused_leases(${columns.join(',')}) VALUES(${args.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING to_jsonb(monaco_scanner_eval_v2_unused_leases) AS r`,args);
   }
  };
  if(beforePermitExpiry)await beforePermitExpiry(fixture);
  if(waitForPermitExpiry)await fixture.waitUntil(original.permit.valid_until);
  await inactive();return fixture;
 }catch(error){console.error('# fixture setup error:',error.message,error.code??'',error.where??'');await db.close().catch(()=>{});await rm(dataDir,{recursive:true,force:true});throw error;}
}
