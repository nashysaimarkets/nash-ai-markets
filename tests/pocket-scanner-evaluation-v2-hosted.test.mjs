import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {EventEmitter} from 'node:events';
import {V2,sha256} from '../scripts/pocket-scanner-evaluation-v2-source.mjs';
import {generateRecipientKeyPair} from '../scripts/pocket-monaco-confidential-transport.mjs';
import {validateRunAdmission,runHostedEvaluation,resolveCurrentEvaluationJob,executeProtectedEvaluation} from '../scripts/pocket-scanner-evaluation-v2-hosted-entry.mjs';
const require=createRequire(import.meta.url),{runLocalAction}=require('../.github/actions/pocket-scanner-evaluation-v2/entry.cjs');
const planBytes=readFileSync(new URL('../docs/monaco-126/scanner-evaluation-v2-2026-10-24/PLAN.json',import.meta.url)),key=generateRecipientKeyPair();
function fixture(){
  const caseId='v2-d001',context={repository:V2.repository,event:'push',ref:`refs/heads/monaco-scanner-evaluation-v2-run-${caseId}`,
    runId:'900000001',runAttempt:'1',jobId:'900000002',sourceSha:'a'.repeat(40),evidenceSha:'b'.repeat(40),wrapperSha:'c'.repeat(40)};
  const config={kind:'POCKET_SCANNER_EVALUATION_V2_RUN_ADMISSION',status:'EXECUTION_APPROVED',caseId,runtimeSourceSha:context.sourceSha,planSha256:sha256(planBytes),
    scopeApproval:{status:'APPROVED',scopeId:V2.scopeId,ownerDirectiveSha256:'d'.repeat(64),planSha256:sha256(planBytes),appSourceSha:V2.appSourceSha,
      approvalRef:'https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-999999999999',maximumNewMicroUsd:1980000,aggregateCapMicroUsd:5000000},
    admissionEvidenceSha256:'e'.repeat(64),reassessmentEvidenceSha256:'f'.repeat(64),previousCaseReceiptSha256:null,input:{bundleSha256:'1'.repeat(64),maxWaitMs:300000},
    output:{retentionDays:7,recipientPublicKeyPem:key.publicKeyPem,recipientPublicKeySha256:key.publicKeySha256}};
  return {config,context,caseId,planBytes};
}
test('static approved evidence has no self/dynamic hashes and resolves to exact independently permitted identity',()=>{
  const f=fixture(),id=validateRunAdmission(f);assert.equal(id.evaluation.evidenceSha,f.context.evidenceSha);
  assert.equal(id.evaluation.runId,f.context.runId);assert.equal(id.evaluation.jobId,f.context.jobId);assert.equal(f.config.identity,undefined);
  assert.throws(()=>validateRunAdmission({...f,config:{...f.config,identity:id}}));
  for(const old of ['6165012632','6309459418','6383327587','6383999765'])assert.throws(()=>validateRunAdmission({...f,config:{...f.config,scopeApproval:{...f.config.scopeApproval,
    approvalRef:`https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-${old}`}}}));
});
test('default missing/unapproved scope cannot load runtime, resolve GitHub metadata or touch credentials',async()=>{
  let effects=0;const f=fixture();f.config.status='OFFLINE_PREPARED';
  const env=new Proxy({}, {get(){throw Error('No credential or environment lookup is allowed');}});
  const result=await runHostedEvaluation({env,argv:['--run-once','--case','v2-d001']},{loadInputs:()=>f,
    loadRuntime:()=>{effects++;},resolveJob:()=>{effects++;},execute:()=>{effects++;},createReceiver:()=>{effects++;}});
  assert.equal(result.status,'HOLD');assert.equal(result.transportSendAttempts,0);assert.equal(effects,0);
});
test('unmodified protected entry rejects a synthetic key before SQL, input or provider construction',async()=>{
  let effects=0;class NeverConstruct{constructor(){effects++;throw Error('No credential-bearing effects allowed');}}
  const runtime={versions:{openai:'6.48.0',pg:'8.16.3','@actions/artifact':'6.3.1'},OpenAI:NeverConstruct,Client:NeverConstruct,ArtifactClient:NeverConstruct};
  const r=await executeProtectedEvaluation(fixture(),{runtime,receiveInputOnce:async()=>{effects++;},
    credentials:{existingKey:'SYNTHETIC_ONLY_NOT_THE_USER_KEY',ledgerPassword:'synthetic-test-password'}});
  assert.equal(r.status,'HOLD');assert.equal(r.transportSendAttempts,0);assert.equal(effects,0);
});
test('one namedcase with metadata identity reaches the single injected executor once',async()=>{
  const f=fixture();delete f.context.jobId;const calls=[];
  const result=await runHostedEvaluation({env:{RUNNER_TEMP:'/tmp',GITHUB_TOKEN:'synthetic'},argv:['--run-once','--case','v2-d001']},{
    loadInputs:()=>f,resolveJob:async()=>{calls.push('metadata');return {jobId:'900000002'};},
    loadRuntime:async()=>{calls.push('runtime');return {};},createReceiver:()=>()=>{},
    execute:async input=>{calls.push('execute');assert.equal(validateRunAdmission(input).evaluation.jobId,'900000002');return {status:'COMPLETED'};}});
  assert.equal(result.status,'COMPLETED');assert.deepEqual(calls,['metadata','runtime','execute']);
});
function metadataFixture(patchRun={},patchJobs={},headers={}){
  const f=fixture(),env={GITHUB_REPOSITORY:V2.repository,GITHUB_JOB:'evaluation',GITHUB_EVENT_NAME:'push',GITHUB_RUN_ATTEMPT:'1',
    GITHUB_RUN_ID:f.context.runId,GITHUB_SHA:f.context.wrapperSha,GITHUB_REF:f.context.ref,GITHUB_TOKEN:'SYNTHETIC_INERT_TOKEN'};
  const run={id:Number(env.GITHUB_RUN_ID),run_attempt:1,status:'in_progress',head_sha:env.GITHUB_SHA,event:'push',head_branch:env.GITHUB_REF.slice('refs/heads/'.length),
    path:'.github/workflows/pocket-scanner-evaluation-v2-run.yml',repository:{full_name:V2.repository},...patchRun};
  const job={id:900000002,name:'Pocket scanner evaluation v2',run_id:run.id,run_attempt:1,head_sha:env.GITHUB_SHA,status:'in_progress'};
  const jobs={total_count:1,jobs:[job],...patchJobs},calls=[];
  const fetchImpl=async(url,options)=>{calls.push({url,options});assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
    assert.ok(url.startsWith(`https://api.github.com/repos/${V2.repository}/actions/runs/${env.GITHUB_RUN_ID}`));
    const data=url.includes('/jobs?')?jobs:run,bytes=Buffer.from(JSON.stringify(data));
    return {status:200,url,redirected:false,headers:new Headers({'x-github-request-id':'SYNTHETIC','content-type':'application/json','content-length':String(bytes.length),...headers}),body:new Response(bytes).body};};
  return {env,fetchImpl,calls,job};
}
test('official run and current job metadata jointly resolve the dynamic numeric job identity',async()=>{
  const f=metadataFixture();f.env.REVIEWED_JOB_ID='999999999';
  assert.deepEqual(await resolveCurrentEvaluationJob(f.env,{fetchImpl:f.fetchImpl}),{jobId:'900000002'});assert.equal(f.calls.length,2);
  assert.ok(f.calls.every(c=>c.options.signal instanceof AbortSignal));
});
test('mismatched run, ambiguous jobs, pagination and incomplete inventories fail before runtime',async()=>{
  const baseline=metadataFixture();
  for(const f of [metadataFixture({head_sha:'0'.repeat(40)}),metadataFixture({event:'workflow_dispatch'}),metadataFixture({run_attempt:2}),
    metadataFixture({path:'.github/workflows/unrelated.yml'}),metadataFixture({status:'completed'}),
    metadataFixture({}, {total_count:2,jobs:[baseline.job,baseline.job]}),metadataFixture({}, {total_count:2}),
    metadataFixture({}, {}, {link:'<https://api.github.com/next>; rel="next"'}),metadataFixture({}, {jobs:[{...baseline.job,status:'completed'}]}),
    metadataFixture({}, {jobs:[{...baseline.job,head_sha:'0'.repeat(40)}]}),metadataFixture({}, {jobs:[{...baseline.job,run_attempt:2}]}),
    metadataFixture({}, {jobs:[{...baseline.job,run_id:900000003}]}),metadataFixture({}, {jobs:[{...baseline.job,id:undefined}]})]){
    await assert.rejects(resolveCurrentEvaluationJob(f.env,{fetchImpl:f.fetchImpl}));
  }
});
test('action process boundary runs only the pinned Node binary and single explicit v2case',async()=>{
  let childArgs;const child=new EventEmitter();child.kill=()=>{};
  const env={ACTIONS_RUNTIME_TOKEN:'synthetic',ACTIONS_RESULTS_URL:'https://synthetic.invalid',GITHUB_RETENTION_DAYS:'7',
    MONACO_PINNED_NODE_EXECUTABLE:process.execPath,POCKET_EVALUATION_CASE_ID:'v2-d001',NODE_OPTIONS:'--require malicious',NODE_PATH:'/untrusted'};
  const result=await runLocalAction({env,probeProcess:()=>({status:0,signal:null,stdout:'v24.19.0\n',stderr:''}),
    spawnProcess:(_binary,args,options)=>{childArgs=args;assert.equal(options.shell,false);assert.equal(options.env.NODE_OPTIONS,undefined);assert.equal(options.env.NODE_PATH,undefined);
      queueMicrotask(()=>child.emit('close',0,null));return child;},signals:new EventEmitter()});
  assert.equal(result,0);assert.deepEqual(childArgs.slice(1),['--run-once','--case','v2-d001']);
  for(const bad of ['d001','v2-d001,v2-d002','v2-e001'])await assert.rejects(runLocalAction({env:{...env,POCKET_EVALUATION_CASE_ID:bad},probeProcess:()=>{throw Error('No probe');}}));
});
